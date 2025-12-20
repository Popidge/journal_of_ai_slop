"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { randomUUID } from "node:crypto";
import { internal } from "./_generated/api";
import { SLOPBOT_PERSONA, appendLinkToTweet, buildPublicationTweetPrompt, describeReviewTone, generateSlopbotTweet } from "./slopbotPrompts";

export const tweetPublishedPaper = internalAction({
  args: {
    paperId: v.id("papers"),
  },
  returns: v.object({
    paperId: v.id("papers"),
    postBody: v.string(),
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

    let finalTweet: string;
    try {
      const draft = await generateSlopbotTweet(prompt);
      finalTweet = appendLinkToTweet(draft, args.paperId);
    } catch (error) {
      await ctx.runMutation(internal.slopbotTweets.recordPostOutcome, {
        postType: "new_publication",
        paperId: args.paperId,
        persona: SLOPBOT_PERSONA,
        status: "failed_generation",
        error: error instanceof Error ? error.message : String(error),
        runId,
        postBody: undefined,
      });
      throw error;
    }

    await ctx.runMutation(internal.slopbotTweets.recordPostOutcome, {
      postType: "new_publication",
      paperId: args.paperId,
      persona: SLOPBOT_PERSONA,
      status: "drafted",
      runId,
      postBody: finalTweet,
      tweetType: "new_publication",
      tweetBody: finalTweet,
    });

    return {
      paperId: args.paperId,
      postBody: finalTweet,
    };
  },
});
