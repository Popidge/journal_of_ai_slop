import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { PUBLIC_PIPELINE_FAILURE_REASON } from "./paperPublicContract";
import { MAX_REVIEW_ATTEMPTS } from "./reviewConfig";

type PipelineStage =
  | "moderation"
  | "peer_review"
  | "tally"
  | "publishing_editor"
  | "finalize";

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

export const getQueueNotificationEmail = internalQuery({
  args: {
    queueId: v.id("papersQueue"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const queueItem = await ctx.db.get("papersQueue", args.queueId);
    const notificationEmail = queueItem?.notificationEmail?.trim();
    return notificationEmail?.length ? notificationEmail : null;
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

export const rejectAfterStageFailure = internalMutation({
  args: {
    queueId: v.id("papersQueue"),
    paperId: v.id("papers"),
    stage: pipelineStage,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.error("Rejecting paper after exhausted pipeline stage", {
      queueId: args.queueId,
      paperId: args.paperId,
      stage: args.stage,
    });
    const paper = await ctx.db.get("papers", args.paperId);
    if (paper) {
      await ctx.runMutation(internal.papers.updatePaperStatus, {
        paperId: args.paperId,
        status: "rejected",
        pipelineFailureReason: PUBLIC_PIPELINE_FAILURE_REASON,
      });
    }

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
      console.error("Review pipeline stage exhausted retries", {
        queueId: args.queueId,
        paperId: queueItem.paperId,
        stage: queueItem.stage ?? "moderation",
        stageAttempts,
        reason: args.reason,
      });
      await ctx.runMutation(internal.papersQueue.rejectAfterStageFailure, {
        queueId: args.queueId,
        paperId: queueItem.paperId,
        stage: queueItem.stage ?? "moderation",
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
    const queueItem = await ctx.db.get("papersQueue", args.queueId);
    if (!queueItem) {
      throw new Error("QUEUE_ITEM_NOT_FOUND");
    }
    if (queueItem.status !== "processing") {
      throw new Error("QUEUE_STAGE_TRANSITION_REQUIRES_PROCESSING");
    }

    const currentStage: PipelineStage = queueItem.stage ?? "moderation";
    let expectedNextStage: PipelineStage | null;

    switch (currentStage) {
      case "moderation":
        expectedNextStage = "peer_review";
        break;
      case "peer_review":
        expectedNextStage = "tally";
        break;
      case "tally": {
        const paper = await ctx.db.get("papers", queueItem.paperId);
        expectedNextStage = paper?.status === "accepted"
          ? "publishing_editor"
          : paper?.status === "rejected"
            ? "finalize"
            : null;
        break;
      }
      case "publishing_editor":
        expectedNextStage = "finalize";
        break;
      case "finalize":
        expectedNextStage = null;
        break;
    }

    if (args.stage !== expectedNextStage) {
      throw new Error("INVALID_QUEUE_STAGE_TRANSITION");
    }

    await ctx.db.patch("papersQueue", args.queueId, {
      stage: args.stage,
      stageAttempts: 0,
    });
    return null;
  },
});
