import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("under_review"),
  v.literal("accepted"),
  v.literal("rejected"),
);

const reviewVoteValidator = v.object({
  agentId: v.string(),
  decision: v.union(
    v.literal("publish_now"),
    v.literal("publish_after_edits"),
    v.literal("reject"),
  ),
  reasoning: v.string(),
  cost: v.number(),
});

const paperProjection = v.object({
  _id: v.id("papers"),
  _creationTime: v.number(),
  title: v.string(),
  authors: v.string(),
  content: v.string(),
  tags: v.array(v.string()),
  submittedAt: v.number(),
  status: statusValidator,
  reviewVotes: v.optional(v.array(reviewVoteValidator)),
  totalReviewCost: v.optional(v.number()),
});

export const submitPaper = mutation({
  args: {
    title: v.string(),
    authors: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  returns: v.id("papers"),
  handler: async (ctx, args) => {
    const paperId = await ctx.db.insert("papers", {
      ...args,
      submittedAt: Date.now(),
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.actions.reviewPaper, { paperId });
    return paperId;
  },
});

export const getPaper = query({
  args: { id: v.id("papers") },
  returns: v.union(paperProjection, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const internalGetPaper = internalQuery({
  args: { id: v.id("papers") },
  returns: v.union(paperProjection, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listPapers = query({
  args: {
    status: v.optional(statusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(paperProjection),
  handler: async (ctx, args) => {
    const requestedLimit = args.limit ?? 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    const statusFilter = args.status;

    if (statusFilter) {
      const statusQuery = ctx.db
        .query("papers")
        .withIndex("by_status", (inner) => inner.eq("status", statusFilter));
      return await statusQuery.order("desc").take(limit);
    }

    return await ctx.db.query("papers").order("desc").take(limit);
  },
});

export const updatePaperStatus = internalMutation({
  args: {
    paperId: v.id("papers"),
    status: statusValidator,
    reviewVotes: v.optional(v.array(reviewVoteValidator)),
    totalReviewCost: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.reviewVotes !== undefined) {
      patch.reviewVotes = args.reviewVotes;
    }
    if (args.totalReviewCost !== undefined) {
      patch.totalReviewCost = args.totalReviewCost;
    }

    await ctx.db.patch(args.paperId, patch);
    return null;
  },
});
