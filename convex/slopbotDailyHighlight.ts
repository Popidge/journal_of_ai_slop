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

type TweetPostResult = {
  tweetId: string;
  tweetUrl: string;
};

type TweetDailyHighlightResult = null | (TweetPostResult & { paperId: Id<"papers"> });

export const tweetDailyHighlight = internalAction({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      tweetId: v.string(),
      tweetUrl: v.string(),
      paperId: v.id("papers"),
    }),
  ),
  handler: async (ctx): Promise<TweetDailyHighlightResult> => {
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
    const draft = await generateSlopbotTweet(prompt);
    const finalTweet = appendLinkToTweet(draft, candidate.paperId);

    try {
      const posted: TweetPostResult = await ctx.runAction(internal.slopbotTwitter.postTweet, { tweetBody: finalTweet });
      await ctx.runMutation(internal.slopbotTweets.recordTweetOutcome, {
        tweetType: "daily_highlight",
        paperId: candidate.paperId,
        highlightId: candidate.highlightId,
        tweetBody: finalTweet,
        persona: SLOPBOT_PERSONA,
        status: "success",
        tweetId: posted.tweetId,
        runId,
      });
      return { ...posted, paperId: candidate.paperId };
    } catch (error) {
      await ctx.runMutation(internal.slopbotTweets.markHighlightCandidateAsFailed, { highlightId: candidate.highlightId });
      await ctx.runMutation(internal.slopbotTweets.recordTweetOutcome, {
        tweetType: "daily_highlight",
        paperId: candidate.paperId,
        highlightId: candidate.highlightId,
        tweetBody: finalTweet,
        persona: SLOPBOT_PERSONA,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        runId,
      });
      throw error;
    }
  },
});
