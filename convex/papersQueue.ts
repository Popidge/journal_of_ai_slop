import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { MAX_REVIEW_ATTEMPTS } from "./reviewConfig";

const pipelineStage = v.union(
  v.literal("moderation"),
  v.literal("peer_review"),
  v.literal("tally"),
  v.literal("publishing_editor"),
  v.literal("finalize"),
);

const queuedPaperResult = v.object({
  queueId: v.id("papersQueue"),
  paperId: v.id("papers"),
  notificationEmail: v.optional(v.string()),
  stage: pipelineStage,
});

export const enqueuePaper = internalMutation({
  args: {
    paperId: v.id("papers"),
    notificationEmail: v.optional(v.string()),
  },
  returns: v.id("papersQueue"),
  handler: async (ctx, args) => {
    const normalizedEmail = args.notificationEmail?.trim();

    const existing = await ctx.db
      .query("papersQueue")
      .withIndex("by_paperId", (q) => q.eq("paperId", args.paperId))
      .take(1);

    if (existing.length > 0) {
      const existingEmail = existing[0].notificationEmail;
      if (normalizedEmail?.length && normalizedEmail !== existingEmail) {
        await ctx.db.patch("papersQueue", existing[0]._id, { notificationEmail: normalizedEmail });
      }
      return existing[0]._id;
    }

    const queuedAt = Date.now();
    return await ctx.db.insert("papersQueue", {
      paperId: args.paperId,
      queuedAt,
      status: "pending",
      attempts: 0,
      notificationEmail: normalizedEmail?.length ? normalizedEmail : undefined,
      retryAfter: queuedAt,
    });
  },
});

export const acquireNextPaperForReview = internalMutation({
  args: {},
  returns: v.union(v.null(), queuedPaperResult),
  handler: async (ctx) => {
    const now = Date.now();
    const candidate = await ctx.db
      .query("papersQueue")
      .withIndex("by_status_and_retryAfter_and_queuedAt", (q) =>
        q.eq("status", "pending").lte("retryAfter", now),
      )
      .order("asc")
      .first();

    if (!candidate) {
      return null;
    }
    await ctx.db.patch("papersQueue", candidate._id, {
      status: "processing",
      attempts: (candidate.attempts ?? 0) + 1,
      stageAttempts: 0,
      processingStartedAt: now,
      stage: candidate.stage ?? "moderation",
    });

    return {
      queueId: candidate._id,
      paperId: candidate.paperId,
      notificationEmail: candidate.notificationEmail,
      stage: candidate.stage ?? "moderation",
    };
  },
});

export const completeQueueItem = internalMutation({
  args: {
    queueId: v.id("papersQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("papersQueue", args.queueId);
    return null;
  },
});

export const rejectAndDropQueueItem = internalMutation({
  args: {
    queueId: v.id("papersQueue"),
    paperId: v.id("papers"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.papers.updatePaperStatus, {
      paperId: args.paperId,
      status: "rejected",
      reviewVotes: [
        {
          agentId: "council-queue",
          decision: "reject",
          reasoning: args.reason,
          cost: 0,
        },
      ],
      totalReviewCost: 0,
    });

    await ctx.db.delete("papersQueue", args.queueId);
    return null;
  },
});

export const releaseQueueItemAfterFailure = internalMutation({
  args: {
    queueId: v.id("papersQueue"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const queueItem = await ctx.db.get("papersQueue", args.queueId);
    if (!queueItem) {
      return null;
    }

    const stageAttempts = (queueItem.stageAttempts ?? 0) + 1;
    if (stageAttempts >= MAX_REVIEW_ATTEMPTS) {
      await ctx.runMutation(internal.papersQueue.rejectAndDropQueueItem, {
        queueId: args.queueId,
        paperId: queueItem.paperId,
        reason: `Auto-rejected after ${MAX_REVIEW_ATTEMPTS} attempts at stage ${queueItem.stage ?? "unknown"}: ${args.reason}`,
      });
      return null;
    }

    const backoffMs = Math.min(
      1000 * 60 * Math.pow(2, stageAttempts - 1),
      1000 * 60 * 60, // cap at 1 hour
    );

    await ctx.db.patch("papersQueue", args.queueId, {
      status: "pending",
      stageAttempts,
      retryAfter: Date.now() + backoffMs,
      lastError: args.reason,
      processingStartedAt: undefined,
    });
    return null;
  },
});

export const advanceQueueStage = internalMutation({
  args: {
    queueId: v.id("papersQueue"),
    stage: pipelineStage,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("papersQueue", args.queueId, {
      stage: args.stage,
      stageAttempts: 0,
    });
    return null;
  },
});
