import { OPENROUTER_ENDPOINT, DEFAULT_OPENROUTER_MODEL } from "./openrouter";

const SITE_URL = (process.env.SITE_URL ?? "https://journalofaislop.com").replace(/\/$/, "");
export const SLOPBOT_PERSONA = "SLOPBOT, the Chief Confusion Officer and Deputy Editor of The Journal of AI Slop™";
const MAX_MODEL_TOKENS = 10000;
const MODEL_TEMPERATURE = 0.85;
const DEBUG_FLAGS = new Set(["1", "true", "yes", "on"]);

const isDebugMode = () => {
  const flag = process.env.SLOPBOT_DEBUG_MODE;
  if (!flag) {
    return false;
  }
  return DEBUG_FLAGS.has(flag.toLowerCase());
};

const logDebug = (label: string, payload: unknown) => {
  if (!isDebugMode()) {
    return;
  }
  console.info(`[SLOPBOT DEBUG] ${label}`, payload);
};

type OpenRouterChatContent =
  | string
  | Array<{ type?: string; text?: string }>
  | { type?: string; text?: string };

const extractMessageText = (content: OpenRouterChatContent | null | undefined): string => {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        return item?.text ?? "";
      })
      .join("")
      .trim();
  }
  if (content && typeof content === "object") {
    return (content.text ?? "").trim();
  }
  return "";
};

type ReviewVote = {
  decision: "publish_now" | "publish_after_edits" | "reject";
};

export const describeReviewTone = (votes: ReviewVote[] | undefined): string => {
  if (!votes || votes.length === 0) {
    return "a zen mix of confusion and pride";
  }

  const total = votes.length;
  const publishNow = votes.filter((vote) => vote.decision === "publish_now").length;
  const publishAfter = votes.filter((vote) => vote.decision === "publish_after_edits").length;

  if (publishNow >= Math.ceil(total * 0.6)) {
    return "a gleeful stamp of approval";
  }

  if (publishAfter > 0) {
    return "a wry nod with a new stack of edit notes";
  }

  return "a bewildered but resolute shrug";
};

export const buildPublicationTweetPrompt = (paper: { title: string; authors: string; tags: string[]; reviewVotes?: ReviewVote[] }, tone?: string): string => {
  const tagList = paper.tags.length ? paper.tags.join(", ") : "no-tags";
  const reviewTone = tone ?? describeReviewTone(paper.reviewVotes);
  return `You are ${SLOPBOT_PERSONA}. Compose a single tweet about the newly accepted paper titled “${paper.title}” by ${paper.authors}. Mention that the paper is tagged ${tagList} and that the peer-review council arrived at ${reviewTone}. Keep the voice playful, slightly confused, and proudly editorial. Do not include a URL; it will be appended later. Keep the tweet under 220 characters so the link can be comfortably added.`;
};

export const buildDailyHighlightTweetPrompt = (paper: { title: string; authors: string; tags: string[]; submittedAt: number }) => {
  const publishedDate = new Date(paper.submittedAt).toDateString();
  const tagList = paper.tags.length ? paper.tags.join(", ") : "no tags";
  return `You are ${SLOPBOT_PERSONA}. Draft a short, editorialized tweet highlighting the archival paper titled “${paper.title}” by ${paper.authors}, submitted on ${publishedDate} with tags ${tagList}. Frame it as a daily pick from the vault, balancing admiration with bemusement. Keep the tweet under 220 characters. Leave the URL out; it will be appended later.`;
};

export const appendLinkToTweet = (tweet: string, paperId: string): string => {
  const link = `${SITE_URL}/papers/${paperId}`;
  const trimmed = tweet.trim();
  const tail = ` ${link}`;
  const maxLength = 280 - tail.length;
  let base = trimmed;
  if (maxLength < 0) {
    throw new Error("Paper link exceeds Twitter length limit");
  }
  if (base.length > maxLength) {
    base = `${base.slice(0, Math.max(0, maxLength - 1))}…`;
  }
  return `${base}${tail}`;
};

export const generateSlopbotTweet = async (prompt: string): Promise<string> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required to generate SLOPBOT tweets");
  }

  const payload = {
    model: DEFAULT_OPENROUTER_MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: MAX_MODEL_TOKENS,
    messages: [{ role: "user", content: prompt }],
    usage: { include: true },
  };

  logDebug("OpenRouter request", {
    endpoint: OPENROUTER_ENDPOINT,
    body: payload,
    promptLength: prompt.length,
  });

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  logDebug("OpenRouter response", {
    status: response.status,
    ok: response.ok,
    body: data,
  });
  if (!response.ok) {
    const message = data?.detail ?? data?.message ?? data?.error ?? "Unknown OpenRouter error";
    throw new Error(`OpenRouter error: ${message}`);
  }

  const firstChoice = data?.choices?.[0] as { message?: { role?: string; content?: OpenRouterChatContent } } | undefined;
  const messagePayload = firstChoice?.message;
  logDebug("OpenRouter first choice", {
    index: 0,
    exists: Boolean(firstChoice),
    role: messagePayload?.role,
    rawContent: messagePayload?.content,
  });

  const result = extractMessageText(messagePayload?.content);
  logDebug("OpenRouter extracted text", { text: result });
  if (!result) {
    throw new Error("OpenRouter returned an empty response for the tweet prompt");
  }

  return result;
};
