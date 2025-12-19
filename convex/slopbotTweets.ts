import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const HIGHLIGHT_LIMIT = 50;

const resetHighlightsToPending = async (ctx: { db: any }) => {
  for await (const entry of ctx.db.query("highlightedPapers").order("asc")) {
    await ctx.db.patch("highlightedPapers", entry._id, { dateHighlighted: undefined });
  }
};

export const reserveHighlightCandidate = internalMutation({
  args: {
    runId: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      highlightId: v.id("highlightedPapers"),
      paperId: v.id("papers"),
    }),
  ),
  handler: async (ctx) => {
    const candidates = await ctx.db
      .query("highlightedPapers")
      .withIndex("by_dateHighlighted", (q) => q.eq("dateHighlighted", undefined))
      .order("asc")
      .take(HIGHLIGHT_LIMIT);

    const eligible: { _id: Id<"highlightedPapers">; paperId: Id<"papers"> }[] = [];
    for (const candidate of candidates) {
      const paper = await ctx.db.get("papers", candidate.paperId);
      if (!paper || paper.status !== "accepted") {
        continue;
      }
      eligible.push(candidate);
    }

    if (eligible.length === 0) {
      await resetHighlightsToPending(ctx);
      return null;
    }

    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    await ctx.db.patch("highlightedPapers", chosen._id, { dateHighlighted: Date.now() });
    return {
      highlightId: chosen._id,
      paperId: chosen.paperId,
    };
  },
});

export const markHighlightCandidateAsFailed = internalMutation({
  args: {
    highlightId: v.id("highlightedPapers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("highlightedPapers", args.highlightId, { dateHighlighted: undefined });
    return null;
  },
});

export const ensureHighlightedPaperRecord = internalMutation({
  args: {
    paperId: v.id("papers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("highlightedPapers")
      .withIndex("by_paperId", (q) => q.eq("paperId", args.paperId))
      .take(1);

    if (existing.length === 0) {
      await ctx.db.insert("highlightedPapers", {
        paperId: args.paperId,
        dateHighlighted: undefined,
      });
    }
    return null;
  },
});

export const recordTweetOutcome = internalMutation({
  args: {
    tweetType: v.union(v.literal("new_publication"), v.literal("daily_highlight")),
    paperId: v.optional(v.id("papers")),
    highlightId: v.optional(v.id("highlightedPapers")),
    tweetId: v.optional(v.string()),
    tweetBody: v.string(),
    persona: v.string(),
    status: v.union(v.literal("success"), v.literal("failed")),
    error: v.optional(v.string()),
    runId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("slopTweets", {
      tweetType: args.tweetType,
      paperId: args.paperId,
      highlightId: args.highlightId,
      tweetId: args.tweetId,
      tweetBody: args.tweetBody,
      persona: args.persona,
      postedAt: Date.now(),
      status: args.status,
      error: args.error,
      runId: args.runId,
    });
    return null;
  },
});
