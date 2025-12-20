"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createHmac, randomBytes } from "node:crypto";

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

const percentEncode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/[!*'()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const buildOAuthHeader = (payload: { text: string; reply?: { in_reply_to_tweet_id: string } }) => {
  const consumerKey = process.env.TWITTER_CLIENT_ID;
  const consumerSecret = process.env.TWITTER_CLIENT_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    throw new Error("TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET must all be set to post tweets");
  }

  const oauthTimestamp = Math.floor(Date.now() / 1000).toString();
  const oauthNonce = randomBytes(16).toString("hex");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: oauthNonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: oauthTimestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const paramsBase = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
    .join("&");

  const baseString = [
    "POST",
    percentEncode(TWITTER_API_URL),
    percentEncode(paramsBase),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
      .join(", ")
  );
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
      buildOAuthHeader({ text: args.tweetBody });
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

    const authorization = buildOAuthHeader(payload);
    const response = await fetch(TWITTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
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
