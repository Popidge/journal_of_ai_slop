"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const TWITTER_API_URL = "https://api.twitter.com/2/tweets";
const TWITTER_ACCOUNT_HANDLE = "journalofaislop";
const MAX_TWEET_LENGTH = 280;
const DEBUG_FLAGS = new Set(["1", "true", "yes", "on"]);

const isDebugMode = (): boolean => {
  const flag = process.env.SLOPBOT_DEBUG_MODE;
  if (!flag) {
    return false;
  }
  return DEBUG_FLAGS.has(flag.toLowerCase());
};

export const postTweet = internalAction({
  args: {
    tweetBody: v.string(),
    inReplyToTweetId: v.optional(v.string()),
  },
  returns: v.object({
    tweetId: v.string(),
    tweetUrl: v.string(),
  }),
  handler: async (_ctx, args) => {
    const debugMode = isDebugMode();
    if (!debugMode) {
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;
      if (!bearerToken) {
        throw new Error("TWITTER_BEARER_TOKEN must be set to post tweets");
      }
    }

    if (args.tweetBody.length > MAX_TWEET_LENGTH) {
      throw new Error(`Tweet exceeds ${MAX_TWEET_LENGTH} characters`);
    }

    const payload: { text: string; reply?: { in_reply_to_tweet_id: string } } = {
      text: args.tweetBody,
    };

    if (args.inReplyToTweetId) {
      payload.reply = { in_reply_to_tweet_id: args.inReplyToTweetId };
    }

    if (debugMode) {
      const debugTweetId = `debug-${Date.now()}`;
      console.info("[SLOPBOT DEBUG] Generated tweet:", payload.text);
      return {
        tweetId: debugTweetId,
        tweetUrl: `https://debug/${TWITTER_ACCOUNT_HANDLE}/status/${debugTweetId}`,
      };
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN!;
    const response = await fetch(TWITTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData?.error?.message ?? responseData?.detail ?? responseData?.title ?? "Unknown error";
      console.error("Twitter post failed", responseData);
      throw new Error(`Twitter API error: ${errorMessage}`);
    }

    const tweetId = responseData?.data?.id;
    if (typeof tweetId !== "string") {
      throw new Error("Twitter API did not return a tweet ID");
    }

    return {
      tweetId,
      tweetUrl: `https://twitter.com/${TWITTER_ACCOUNT_HANDLE}/status/${tweetId}`,
    };
  },
});
