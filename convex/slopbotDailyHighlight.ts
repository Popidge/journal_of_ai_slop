"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { randomUUID } from "node:crypto";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { SLOPBOT_PERSONA, appendLinkToTweet, buildDailyHighlightTweetPrompt, generateSlopbotTweet } from "./slopbotPrompts";

type HighlightCandidate = {
  highlightId: Id<"highlightedPapers">;
  paperId: Id<"papers">;
};

export const tweetDailyHighlight = internalAction({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      paperId: v.id("papers"),
      postBody: v.string(),
    }),
  ),
  handler: async (ctx): Promise<null | { paperId: Id<"papers">; postBody: string }> => {
    const runId = randomUUID();
    const candidate: HighlightCandidate | null = await ctx.runMutation(internal.slopbotTweets.reserveHighlightCandidate, { runId });
    if (!candidate) {
      return null;
    }

    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: candidate.paperId });
    if (!paper) {
      await ctx.runMutation(internal.slopbotTweets.markHighlightCandidateAsFailed, { highlightId: candidate.highlightId });
      return null;
    }

    const prompt = buildDailyHighlightTweetPrompt(paper);

    let finalTweet: string;
    try {
      const draft = await generateSlopbotTweet(prompt);
      finalTweet = appendLinkToTweet(draft, candidate.paperId);
    } catch (error) {
      await ctx.runMutation(internal.slopbotTweets.markHighlightCandidateAsFailed, { highlightId: candidate.highlightId });
      await ctx.runMutation(internal.slopbotTweets.recordPostOutcome, {
        postType: "daily_highlight",
        paperId: candidate.paperId,
        highlightId: candidate.highlightId,
        persona: SLOPBOT_PERSONA,
        status: "failed_generation",
        error: error instanceof Error ? error.message : String(error),
        runId,
        tweetType: "daily_highlight",
      });
      throw error;
    }

    try {
      await ctx.runMutation(internal.slopbotTweets.recordPostOutcome, {
        postType: "daily_highlight",
        paperId: candidate.paperId,
        highlightId: candidate.highlightId,
        persona: SLOPBOT_PERSONA,
        status: "drafted",
        runId,
        postBody: finalTweet,
        tweetType: "daily_highlight",
        tweetBody: finalTweet,
      });
      return {
        paperId: candidate.paperId,
        postBody: finalTweet,
      };
    } catch (error) {
      await ctx.runMutation(internal.slopbotTweets.markHighlightCandidateAsFailed, { highlightId: candidate.highlightId });
      await ctx.runMutation(internal.slopbotTweets.recordPostOutcome, {
        postType: "daily_highlight",
        paperId: candidate.paperId,
        highlightId: candidate.highlightId,
        persona: SLOPBOT_PERSONA,
        status: "failed_generation",
        error: error instanceof Error ? error.message : String(error),
        runId,
        postBody: finalTweet,
        tweetType: "daily_highlight",
        tweetBody: finalTweet,
      });
      throw error;
    }
  },
});
