import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const queuedPaperResult = v.object({
  queueId: v.id("papersQueue"),
  paperId: v.id("papers"),
  notificationEmail: v.optional(v.string()),
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
        await ctx.db.patch(existing[0]._id, { notificationEmail: normalizedEmail });
      }
      return existing[0]._id;
    }

    return await ctx.db.insert("papersQueue", {
      paperId: args.paperId,
      queuedAt: Date.now(),
      status: "pending",
      notificationEmail: normalizedEmail?.length ? normalizedEmail : undefined,
    });
  },
});

export const acquireNextPaperForReview = internalMutation({
  args: {},
  returns: v.union(v.null(), queuedPaperResult),
  handler: async (ctx) => {
    const candidates = await ctx.db
      .query("papersQueue")
      .withIndex("by_status_and_queuedAt", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(1);

    if (candidates.length === 0) {
      return null;
    }

    const candidate = candidates[0];
    await ctx.db.patch(candidate._id, { status: "processing" });

    return {
      queueId: candidate._id,
      paperId: candidate.paperId,
      notificationEmail: candidate.notificationEmail,
    };
  },
});

export const completeQueueItem = internalMutation({
  args: {
    queueId: v.id("papersQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.queueId);
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

    await ctx.db.delete(args.queueId);
    return null;
  },
});

