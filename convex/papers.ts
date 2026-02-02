import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("under_review"),
  v.literal("accepted"),
  v.literal("rejected"),
);

const publicStatusValidator = v.union(v.literal("accepted"), v.literal("rejected"));

const reviewVoteValidator = v.object({
  agentId: v.string(),
  decision: v.union(
    v.literal("publish_now"),
    v.literal("publish_after_edits"),
    v.literal("reject"),
  ),
  reasoning: v.string(),
  cost: v.number(),
  promptTokens: v.optional(v.number()),
  completionTokens: v.optional(v.number()),
  cachedTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
});

const moderationCategoryValidator = v.object({
  category: v.string(),
  severity: v.number(),
});

const moderationSummaryValidator = v.object({
  blocked: v.boolean(),
  overallSeverity: v.number(),
  categories: v.array(moderationCategoryValidator),
  reason: v.string(),
  blockedAt: v.number(),
  requestId: v.optional(v.string()),
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
  promptTokens: v.optional(v.number()),
  completionTokens: v.optional(v.number()),
  cachedTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  moderation: v.optional(moderationSummaryValidator),
});

type PaperDoc = Doc<"papers">;
type PaperId = Id<"papers">;

export const submitPaper = mutation({
  args: {
    title: v.string(),
    authors: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    notificationEmail: v.optional(v.string()),
  },
  returns: v.id("papers"),
  handler: async (ctx, args) => {
    const paperId = await ctx.db.insert("papers", {
      title: args.title,
      authors: args.authors,
      content: args.content,
      tags: args.tags,
      submittedAt: Date.now(),
      status: "pending",
    });

    const normalizedEmail = args.notificationEmail?.trim();

    await ctx.runMutation(internal.papersQueue.enqueuePaper, {
      paperId,
      notificationEmail: normalizedEmail?.length ? normalizedEmail : undefined,
    });
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

export const listPublicPapersPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(publicStatusValidator),
  },
  returns: v.object({
    papers: v.array(paperProjection),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const status = args.status ?? "accepted";
    const page = await ctx.db
      .query("papers")
      .withIndex("by_status", (q: any) => q.eq("status", status))
      .order("desc")
      .paginate(args.paginationOpts);

    const papers = page.page.filter((paper) => !paper.moderation?.blocked);
    return {
      papers,
      cursor: page.continueCursor ?? null,
    };
  },
});

export const listCommentedPapers = query({
  args: {
    status: v.optional(publicStatusValidator),
  },
  returns: v.array(paperProjection),
  handler: async (ctx, args) => {
    const statusFilter = args.status ?? "accepted";
    const seenPaperIds = new Set<PaperId>();
    const uniquePaperIds: PaperId[] = [];

    const comments = await ctx.db.query("editorsComments").order("desc").collect();
    const commentRows = comments as Array<{ paperId: PaperId }>;

    for (const comment of commentRows) {
      if (!seenPaperIds.has(comment.paperId)) {
        seenPaperIds.add(comment.paperId);
        uniquePaperIds.push(comment.paperId);
      }
    }

    const papers: PaperDoc[] = [];
    for (const paperId of uniquePaperIds) {
      const paper = await ctx.db.get(paperId);
      if (!paper) continue;
      if (paper.moderation?.blocked) continue;
      if (paper.status !== statusFilter) continue;
      papers.push(paper);
    }

    return papers;
  },
});

export const updatePaperStatus = internalMutation({
  args: {
    paperId: v.id("papers"),
    status: statusValidator,
    reviewVotes: v.optional(v.array(reviewVoteValidator)),
    totalReviewCost: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
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
    if (args.totalTokens !== undefined) {
      patch.totalTokens = args.totalTokens;
    }

    await ctx.db.patch(args.paperId, patch);
    return null;
  },
});

export const redactPaperContent = internalMutation({
  args: {
    paperId: v.id("papers"),
    moderation: moderationSummaryValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paperId, {
      title: "[REDACTED]",
      authors: "[REDACTED]",
      content: "[REDACTED]",
      tags: [],
      status: "rejected",
      reviewVotes: [],
      totalReviewCost: 0,
      totalTokens: 0,
      moderation: args.moderation,
    });
    return null;
  },
});

