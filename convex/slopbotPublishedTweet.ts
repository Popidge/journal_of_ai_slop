"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { randomUUID } from "node:crypto";
import { internal } from "./_generated/api";
import { SLOPBOT_PERSONA, appendLinkToTweet, buildPublicationTweetPrompt, describeReviewTone, generateSlopbotTweet } from "./slopbotPrompts";

type TweetPostResult = {
  tweetId: string;
  tweetUrl: string;
};

export const tweetPublishedPaper = internalAction({
  args: {
    paperId: v.id("papers"),
  },
  returns: v.object({
    tweetId: v.string(),
    tweetUrl: v.string(),
    paperId: v.id("papers"),
  }),
  handler: async (ctx, args) => {
    const runId = randomUUID();
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      throw new Error("Paper not found for tweeting");
    }

    if (paper.status !== "accepted") {
      throw new Error("Only accepted papers are tweeted");
    }

    await ctx.runMutation(internal.slopbotTweets.ensureHighlightedPaperRecord, { paperId: args.paperId });

    const tone = describeReviewTone(paper.reviewVotes ?? undefined);
    const prompt = buildPublicationTweetPrompt(paper, tone);
    const draft = await generateSlopbotTweet(prompt);
    const finalTweet = appendLinkToTweet(draft, args.paperId);

    try {
      const posted: TweetPostResult = await ctx.runAction(internal.slopbotTwitter.postTweet, { tweetBody: finalTweet });
      await ctx.runMutation(internal.slopbotTweets.recordTweetOutcome, {
        tweetType: "new_publication",
        paperId: args.paperId,
        tweetBody: finalTweet,
        persona: SLOPBOT_PERSONA,
        status: "success",
        tweetId: posted.tweetId,
        runId,
      });
      return { ...posted, paperId: args.paperId };
    } catch (error) {
      await ctx.runMutation(internal.slopbotTweets.recordTweetOutcome, {
        tweetType: "new_publication",
        paperId: args.paperId,
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
