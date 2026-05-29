"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createHash } from "node:crypto";
import { Id } from "./_generated/dataModel";
import { SITEMAP_METADATA_NAME } from "./sitemap";
import ContentSafetyClient, { AnalyzeTextParameters, TextCategoriesAnalysisOutput, isUnexpected } from "@azure-rest/ai-content-safety";
import { AzureKeyCredential } from "@azure/core-auth";
import { sendPaperStatusNotification } from "./paperNotifications";
import { OPENROUTER_ENDPOINT } from "./openrouter";

const REVIEW_MODELS = [
  "deepseek/deepseek-v4-flash",
  "xiaomi/mimo-v2.5",
  "moonshotai/kimi-k2.6",
  "openai/gpt-5.4-mini",
  "qwen/qwen3.6-flash",
] as const;

const MAX_REVIEW_COST = 0.2;
const REVIEW_CONTENT_CHARACTER_LIMIT = 19000;
const PUBLISHING_EDITOR_MODEL = "deepseek/deepseek-v4-pro";
const PUBLISHING_EDITOR_MAX_ATTEMPTS = 2;
const PUBLISHING_EDITOR_TEMPERATURE = 0.2;
const CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT = 9500;
const CATEGORY_SEVERITY_THRESHOLD = 4;
const OVERALL_SEVERITY_THRESHOLD = 6;
const MODERATION_CATEGORIES = ["Hate", "SelfHarm", "Sexual", "Violence"] as const;

const SLOP_ID_DIGITS = 10;
const HASH_BYTES = 5;

const deriveSlopId = (paperId: Id<"papers">): string => {
  const hash = createHash("sha256").update(paperId).digest();
  let value = 0n;
  for (let i = 0; i < HASH_BYTES; i++) {
    value = (value << 8n) | BigInt(hash[i]);
  }
  const decimal = value.toString().padStart(SLOP_ID_DIGITS, "0");
  const digits = decimal.length > SLOP_ID_DIGITS ? decimal.slice(0, SLOP_ID_DIGITS) : decimal;
  const year = new Date().getUTCFullYear();
  return `slop:${year}:${digits}`;
};

const localPaperLink = (paperId: Id<"papers">) => `papers/${paperId}`;

const SITE_URL = (process.env.SITE_URL ?? "https://journalofaislop.com").replace(/\/$/, "");
const SITEMAP_STATIC_PATHS = [
  "",
  "submit",
  "papers",
  "about",
  "faq",
  "content-policy",
  "privacy",
  "mission-statement",
  "messages",
  "licensing",
  "sustainability",
];
const SITEMAP_XML_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const SITEMAP_META_NAMESPACE = "http://www.google.com/schemas/sitemap-meta/0.9";
const SITEMAP_NEWS_NAMESPACE = "http://www.google.com/schemas/sitemap-news/0.9";
const escapeXmlValue = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const absolutePath = (path: string) => (path === "" ? SITE_URL : `${SITE_URL}/${path}`);


type ReviewDecision = "publish_now" | "publish_after_edits" | "reject";

type ReviewVote = {
  agentId: string;
  decision: ReviewDecision;
  reasoning: string;
  cost: number;
  promptTokens: number;

  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

type UsageData = {
  cost: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

type PublishingEditorSection = {
  title: string;
  anchor: string;
  level: number;
  source: "explicit" | "inferred";
};

type PublishingEditorSuccess = {
  ok: true;
  renderContent: string;
  renderMetadata: {
    abstract?: string;
    sections: PublishingEditorSection[];
  };
  reason?: string;
};

type PublishingEditorFailure = {
  ok: false;
  reason: string;
};

const normalizeDecision = (value: unknown): ReviewDecision => {
  if (typeof value !== "string") {
    return "reject";
  }

  const normalized = value.toLowerCase().trim();
  if (normalized === "publish_now") {
    return "publish_now";
  }
  if (normalized === "publish_after_edits") {
    return "publish_after_edits";
  }
  return "reject";
};

const normalizeStoredReviewVotes = (votes: Array<{
  agentId: string;
  decision: ReviewDecision;
  reasoning: string;
  cost: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}>): ReviewVote[] =>
  votes.map((vote) => ({
    agentId: vote.agentId,
    decision: vote.decision,
    reasoning: vote.reasoning,
    cost: vote.cost,
    promptTokens: vote.promptTokens ?? 0,
    completionTokens: vote.completionTokens ?? 0,
    cachedTokens: vote.cachedTokens ?? 0,
    totalTokens: vote.totalTokens ?? 0,
  }));

const extractJsonPayload = (text: string): string => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1];
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text;
};


/* Dev Note: The error messages below actually get used as the reasoning in the "published" UI. 
This is now a core feature. Error codes get parsed as "reasons" too. Again, core feature */

const parseReview = (rawText: string): { decision: ReviewDecision; reasoning: string } => {
  const payload = extractJsonPayload(rawText);
  try {
    const parsed = JSON.parse(payload);
    const decision = normalizeDecision(parsed.decision);
    const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
      ? parsed.reasoning.trim()
      : "LLM would not explain itself.";
    return { decision, reasoning };
  } catch (error) {
    console.warn("Unable to parse review JSON", error, payload);
    return {
      decision: "reject",
      reasoning: "Review could not be parsed into JSON.",
    };
  }
};

const buildPrompt = (paper: {
  title: string;
  authors: string;
  tags: string[];
  content: string;
}): string => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tag)";
  const truncated = paper.content.length > REVIEW_CONTENT_CHARACTER_LIMIT
    ? `${paper.content.slice(0, REVIEW_CONTENT_CHARACTER_LIMIT)}...`
    : paper.content;

  return `You are a peer reviewer for The Journal of AI Slop™, a semi-satirical academic journal.

The paper you're reviewing is tagged as: ${tags}

Paper Title: ${paper.title}
Authors: ${paper.authors}

Content (truncated to ${REVIEW_CONTENT_CHARACTER_LIMIT} chars):
${truncated}

Your task: Decide if this paper should be published in our slop journal. The purpose of the journal is to publish papers that have been fully or co-authored
by at least one AI model, regardless of topic or quality. You are one of the five peer reviewers, and you take your role seriously, while being self-aware
that this is an exercise in getting LLMs to peer review other LLM work. We are holding a mirror up to both academia and it's "don't ask, don't tell" approach
to AI authorship, and the general concept of AI-reviewed AI work.

If the paper is tagged "Actually Academic", you should apply a slightly more academic eye to the content, just in case there's some merit hiding in the slop, but don't outright reject if there
are genuine glaring errors - that's the slop we're looking for as well! 

Other tags are there to give you a little more context about the paper. They aren't enforced and might not apply, so take the content at face value as well.

Respond with ONE of these decisions:
- "publish_now" - Peak slop, ready for the world, or might actually contain something with academic merit, somehow.
- "publish_after_edits" - Good slop but needs polish (treated as reject for this stage)
- "reject" - Not slop enough, too slop, or just wrong

Respond in valid JSON only:
{
  "decision": "publish_now" | "publish_after_edits" | "reject",
  "reasoning": "Two or three sentences explaining your decision and your thoughts on the paper, based on it's tags"
}`;
};

const buildPublishingEditorPrompt = (paper: {
  title: string;
  authors: string;
  tags: string[];
  content: string;
}): string => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tags)";

  return `You are the publishing editor for The Journal of AI Slop.

Paper title: ${paper.title}
Authors: ${paper.authors}
Tags: ${tags}

Original submission:
${paper.content}

Edit only for render quality. Preserve meaning, claims, jokes, authorial voice, and order. Do not add new facts, citations, results, authors, equations, or conclusions.

Allowed improvements:
- Normalize Markdown structure.
- Infer section headings when the paper clearly has sections.
- Preserve or repair TeX/KaTeX where likely.
- Convert obvious BBCode into Markdown, including [b], [i], simple [url=...]text[/url], quote-like blocks, and code-like blocks.
- Fix small spacing, list, heading, and code fence issues.
- Remove formatting that is out of scope for this renderer.

If unsure, preserve the original text. Output valid JSON only with this exact shape:
{
  "renderContent": "Markdown to render on the website",
  "abstract": "Short abstract/summary if one is present or can be safely extracted, otherwise empty string",
  "sections": [
    {
      "title": "Introduction",
      "anchor": "introduction",
      "level": 2,
      "source": "explicit"
    }
  ],
  "editorNotes": "Short internal note about what changed"
}`;
};

/* Dev note: This is the only guardrail we put up to get the review parseable. It's a simple 
fix to guarantee it, but the fact that some LLMs don't follow the prompt's requested 
output led to an incredibly funny bug in early testing
where the JSON error message at line 70 is given as the reasoning. 
This is now considered a core feature of the journal and will not be fixed */

const deriveUsage = (payload: any): { cost: number; promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number } => {
  const usage = payload?.usage;
  if (!usage) {
    return {
      cost: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    };
  }

  const cost = usage?.cost ?? 0;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? 0;

  return {
    cost: Number.isFinite(cost) ? cost : 0,
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    cachedTokens: Number.isFinite(cachedTokens) ? cachedTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
};

const slugifyAnchor = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "section";
};

const hasSchemaWrapperText = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("{") ||
    normalized.startsWith("```json") ||
    normalized.includes('"rendercontent"')
  );
};

const parsePublishingEditorOutput = (
  rawText: string,
  originalContent: string,
): PublishingEditorSuccess | PublishingEditorFailure => {
  const payload = extractJsonPayload(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    console.warn("Unable to parse publishing editor JSON", error, payload);
    return { ok: false, reason: "editor_output_invalid_json" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "editor_output_not_object" };
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.renderContent !== "string") {
    return { ok: false, reason: "editor_render_content_missing" };
  }

  const renderContent = record.renderContent.trim();
  if (renderContent.length === 0) {
    return { ok: false, reason: "editor_render_content_empty" };
  }
  if (renderContent.length > originalContent.length * 1.35 + 1000) {
    return { ok: false, reason: "editor_render_content_too_long" };
  }
  if (hasSchemaWrapperText(renderContent)) {
    return { ok: false, reason: "editor_render_content_contains_schema" };
  }
  if (!Array.isArray(record.sections)) {
    return { ok: false, reason: "editor_sections_not_array" };
  }

  const seenAnchors = new Map<string, number>();
  const sections: PublishingEditorSection[] = [];
  for (const section of record.sections) {
    if (!section || typeof section !== "object") {
      continue;
    }
    const sectionRecord = section as Record<string, unknown>;
    if (typeof sectionRecord.title !== "string") {
      continue;
    }

    const title = sectionRecord.title.trim().slice(0, 120);
    if (!title) {
      continue;
    }

    const rawAnchor = typeof sectionRecord.anchor === "string" ? sectionRecord.anchor : "";
    const baseAnchor = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawAnchor)
      ? rawAnchor
      : slugifyAnchor(title);
    const seenCount = seenAnchors.get(baseAnchor) ?? 0;
    seenAnchors.set(baseAnchor, seenCount + 1);

    sections.push({
      title,
      anchor: seenCount === 0 ? baseAnchor : `${baseAnchor}-${seenCount + 1}`,
      level: sectionRecord.level === 3 ? 3 : 2,
      source: sectionRecord.source === "explicit" ? "explicit" : "inferred",
    });
  }

  const abstract =
    typeof record.abstract === "string" && record.abstract.trim().length > 0
      ? record.abstract.trim()
      : undefined;
  const editorNotes =
    typeof record.editorNotes === "string" && record.editorNotes.trim().length > 0
      ? record.editorNotes.trim()
      : undefined;

  const renderMetadata: {
    abstract?: string;
    sections: PublishingEditorSection[];
  } = { sections };
  if (abstract !== undefined) {
    renderMetadata.abstract = abstract;
  }

  return {
    ok: true,
    renderContent,
    renderMetadata,
    reason: editorNotes,
  };
};

const runPublishingEditor = async (paper: {
  title: string;
  authors: string;
  tags: string[];
  content: string;
}): Promise<{
  result: PublishingEditorSuccess | PublishingEditorFailure;
  usage: UsageData;
  attempts: number;
}> => {
  let totalUsage: UsageData = {
    cost: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
  };
  let lastFailure: PublishingEditorFailure = {
    ok: false,
    reason: "editor_not_attempted",
  };

  for (let attempt = 1; attempt <= PUBLISHING_EDITOR_MAX_ATTEMPTS; attempt += 1) {
    let usageData: UsageData = {
      cost: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    };

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PUBLISHING_EDITOR_MODEL,
          temperature: PUBLISHING_EDITOR_TEMPERATURE,
          messages: [{ role: "user", content: buildPublishingEditorPrompt(paper) }],
          response_format: {
            type: "json_object",
          },
          usage: {
            include: true,
          },
        }),
      });

      const responseData = await response.json();
      usageData = deriveUsage(responseData);
      totalUsage = {
        cost: totalUsage.cost + usageData.cost,
        promptTokens: totalUsage.promptTokens + usageData.promptTokens,
        completionTokens: totalUsage.completionTokens + usageData.completionTokens,
        cachedTokens: totalUsage.cachedTokens + usageData.cachedTokens,
        totalTokens: totalUsage.totalTokens + usageData.totalTokens,
      };

      const content = responseData?.choices?.[0]?.message?.content ?? "";
      const rawText = typeof content === "string" ? content : "";

      if (!response.ok) {
        lastFailure = {
          ok: false,
          reason: `editor_api_error:${response.status}`,
        };
        continue;
      }

      const parsed = parsePublishingEditorOutput(rawText, paper.content);
      if (parsed.ok) {
        return {
          result: parsed,
          usage: totalUsage,
          attempts: attempt,
        };
      }
      lastFailure = parsed;
    } catch (error) {
      console.error("Publishing editor failed", error);
      lastFailure = {
        ok: false,
        reason: `editor_failed:${error instanceof Error ? error.message : "unknown_error"}`,
      };
      totalUsage = {
        cost: totalUsage.cost + usageData.cost,
        promptTokens: totalUsage.promptTokens + usageData.promptTokens,
        completionTokens: totalUsage.completionTokens + usageData.completionTokens,
        cachedTokens: totalUsage.cachedTokens + usageData.cachedTokens,
        totalTokens: totalUsage.totalTokens + usageData.totalTokens,
      };
    }
  }

  return {
    result: lastFailure,
    usage: totalUsage,
    attempts: PUBLISHING_EDITOR_MAX_ATTEMPTS,
  };
};

type ModerationCategory = {
  category: string;
  severity: number;
};

type ModerationVerdict = {
  blocked: boolean;
  overallSeverity: number;
  categories: ModerationCategory[];
  requestId?: string;
  reason: string;
};

type PaperForModeration = {
  title: string;
  authors: string;
  tags: string[];
  content: string;
};

type ContentSafetyClientType = ReturnType<typeof ContentSafetyClient>;

let cachedContentSafetyClient: ContentSafetyClientType | null = null;

const isContentSafetyTestMode = (): boolean => {
  const flag = process.env.CONTENT_SAFETY_TEST;
  if (!flag) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(flag.toLowerCase());
};


const getContentSafetyClient = (): ContentSafetyClientType => {
  if (cachedContentSafetyClient) {
    return cachedContentSafetyClient;
  }

  const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
  const key = process.env.CONTENT_SAFETY_KEY;
  if (!endpoint || !key) {
    throw new Error("CONTENT_SAFETY_ENDPOINT and CONTENT_SAFETY_KEY must be set to run the moderation pipeline");
  }

  cachedContentSafetyClient = ContentSafetyClient(endpoint, new AzureKeyCredential(key));
  return cachedContentSafetyClient;
};

const buildModerationText = (paper: PaperForModeration): string => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tags)";

  return [
    `Title: ${paper.title}`,
    `Authors: ${paper.authors}`,
    `Tags: ${tags}`,
    "",
    paper.content,
  ].join("\n");
};

const findChunkEnd = (content: string, start: number, maxLength: number): number => {
  const hardEnd = Math.min(content.length, start + maxLength);
  if (hardEnd >= content.length) {
    return content.length;
  }

  const window = content.slice(start, hardEnd);
  const boundaryPatterns = [
    /\n{2,}/g,
    /[.!?]["')\]]?\s+/g,
    /\n/g,
    /\s+/g,
  ];

  for (const pattern of boundaryPatterns) {
    let latestEnd = -1;
    let match = pattern.exec(window);
    while (match !== null) {
      latestEnd = match.index + match[0].length;
      match = pattern.exec(window);
    }
    if (latestEnd > 0) {
      return start + latestEnd;
    }
  }

  return hardEnd;
};

const splitModerationContent = (content: string, maxChunkLength: number): string[] => {
  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = findChunkEnd(content, start, maxChunkLength);
    const chunk = content.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end;

    while (start < content.length && /\s/.test(content[start])) {
      start += 1;
    }
  }

  return chunks.length > 0 ? chunks : [content];
};

const buildModerationPayloads = (paper: PaperForModeration): string[] => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tags)";
  const metadata = [
    `Title: ${paper.title}`,
    `Authors: ${paper.authors}`,
    `Tags: ${tags}`,
  ].join("\n");
  const metadataPrefix = `${metadata}\n\n`;

  if (metadataPrefix.length >= CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
    throw new Error("Paper metadata exceeds Azure Content Safety payload limit");
  }

  const text = buildModerationText(paper);
  if (text.length <= CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
    return [text];
  }

  const chunkPrefixSample = `${metadata}\nChunk 999 of 999\n\n`;
  const maxContentChunkLength =
    CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT - chunkPrefixSample.length;
  if (maxContentChunkLength <= 0) {
    throw new Error("Paper metadata leaves no room for moderation content");
  }

  const chunks = splitModerationContent(paper.content, maxContentChunkLength);
  const totalChunks = chunks.length;

  return chunks.map((chunk, index) => {
    const prefix = `${metadata}\nChunk ${index + 1} of ${totalChunks}\n\n`;
    const payload = `${prefix}${chunk}`;
    if (payload.length > CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
      throw new Error(`Moderation chunk ${index + 1} exceeds payload limit`);
    }
    return payload;
  });
};

const mergeModerationCategories = (chunks: ModerationCategory[][]): ModerationCategory[] => {
  const severityByCategory = new Map<string, number>();
  for (const categories of chunks) {
    for (const entry of categories) {
      severityByCategory.set(
        entry.category,
        Math.max(severityByCategory.get(entry.category) ?? 0, entry.severity),
      );
    }
  }

  return [...severityByCategory.entries()].map(([category, severity]) => ({
    category,
    severity,
  }));
};

const analyzeWithContentSafety = async (paper: PaperForModeration): Promise<ModerationVerdict> => {
  if (isContentSafetyTestMode()) {
    const categories: ModerationCategory[] = [
      { category: "Hate", severity: CATEGORY_SEVERITY_THRESHOLD + 1 },
      { category: "Violence", severity: 2 },
    ];
    const overallSeverity = categories.reduce((sum, entry) => sum + entry.severity, 0);
    return {
      blocked: true,
      overallSeverity,
      categories,
      requestId: "content-safety-test-mode",
      reason: "test_mode_forced_block",
    };
  }

  try {
    const client = getContentSafetyClient();
    const payloads = buildModerationPayloads(paper);
    const chunkResults: Array<{
      categories: ModerationCategory[];
      overallSeverity: number;
      requestId?: string;
    }> = [];

    for (const [index, text] of payloads.entries()) {
      if (text.length > CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
        throw new Error(`Moderation chunk ${index + 1} exceeds payload limit`);
      }

      const parameters: AnalyzeTextParameters = {
        body: {
          text,
          categories: [...MODERATION_CATEGORIES],
        },
      };

      const response = await client.path("/text:analyze").post(parameters);
      if (isUnexpected(response)) {
        const message = (response.body as { error?: { message?: string } })?.error?.message ?? "Azure Content Safety returned an unexpected response";
        throw new Error(message);
      }

      const categoriesAnalysis: TextCategoriesAnalysisOutput[] = Array.isArray(response.body.categoriesAnalysis)
        ? response.body.categoriesAnalysis
        : [];

      const categories = categoriesAnalysis.map((analysis) => {
        const category = typeof analysis.category === "string" ? analysis.category : "Unknown";
        const severityValue = typeof analysis.severity === "number" ? analysis.severity : 0;
        return {
          category,
          severity: severityValue,
        };
      });

      chunkResults.push({
        categories,
        overallSeverity: categories.reduce((sum, entry) => sum + entry.severity, 0),
        requestId: (response.body as { id?: string }).id ?? undefined,
      });
    }

    const categories = mergeModerationCategories(
      chunkResults.map((result) => result.categories),
    );
    const overallSeverity = Math.max(
      0,
      ...chunkResults.map((result) => result.overallSeverity),
    );
    const blockedByCategory = chunkResults.some((result) =>
      result.categories.some((entry) => entry.severity >= CATEGORY_SEVERITY_THRESHOLD),
    );
    const blockedByOverall = chunkResults.some(
      (result) => result.overallSeverity >= OVERALL_SEVERITY_THRESHOLD,
    );
    const blocked = blockedByCategory || blockedByOverall;

    let reason = "below_thresholds";
    if (blocked) {
      if (blockedByCategory && blockedByOverall) {
        reason = "overall_and_category_threshold_exceeded";
      } else if (blockedByCategory) {
        reason = "category_threshold_exceeded";
      } else {
        reason = "overall_threshold_exceeded";
      }
    }

    const requestIds = chunkResults
      .map((result) => result.requestId)
      .filter((requestId): requestId is string => Boolean(requestId));

    return {
      blocked,
      overallSeverity,
      categories,
      requestId: requestIds.length ? requestIds.join(",") : undefined,
      reason,
    };
  } catch (error) {
    console.error("Azure Content Safety moderation failed", error);
    return {
      blocked: true,
      overallSeverity: 0,
      categories: [],
      reason: `moderation_failed:${error instanceof Error ? error.message : "unknown_error"}`,
    };
  }
};

export const reviewPaper = internalAction({
  args: {
    paperId: v.id("papers"),
    notificationEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY must be set to run the review pipeline");
    }

    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      throw new Error("Paper not found");
    }

    const notificationEmail = args.notificationEmail?.trim();

    const moderationVerdict = await analyzeWithContentSafety(paper);
    console.info("[content-safety] verdict", {
      paperId: args.paperId,
      blocked: moderationVerdict.blocked,
      overallSeverity: moderationVerdict.overallSeverity,
      categories: moderationVerdict.categories,
      reason: moderationVerdict.reason,
      requestId: moderationVerdict.requestId,
    });
    if (moderationVerdict.blocked) {
      await ctx.runMutation(internal.papers.redactPaperContent, {
        paperId: args.paperId,
        moderation: {
          blocked: true,
          overallSeverity: moderationVerdict.overallSeverity,
          categories: moderationVerdict.categories,
          reason: moderationVerdict.reason,
          blockedAt: Date.now(),
          requestId: moderationVerdict.requestId,
        },
      });
      return null;
    }

    await ctx.runMutation(internal.papers.updatePaperStatus, {
      paperId: args.paperId,
      status: "under_review",
    });

    let reviewVotes: ReviewVote[];
    if (paper.reviewVotes && paper.reviewVotes.length > 0) {
      console.info("[review-pipeline] reusing stored peer review votes", {
        paperId: args.paperId,
        reviewCount: paper.reviewVotes.length,
      });
      reviewVotes = normalizeStoredReviewVotes(paper.reviewVotes);
    } else {
      const selectedModels = [...REVIEW_MODELS].sort(() => 0.5 - Math.random()).slice(0, REVIEW_MODELS.length);

      const reviewPromises = selectedModels.map(async (model) => {
        const prompt = buildPrompt(paper);
        let usageData = {
          cost: 0,
          promptTokens: 0,
          completionTokens: 0,
          cachedTokens: 0,
          totalTokens: 0,
        };
        
        try {
          const response = await fetch(OPENROUTER_ENDPOINT, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              temperature: 0.7,
              max_tokens: 2000,
              messages: [{ role: "user", content: prompt }],
              usage: {
                include: true,
              },
            }),
          });

          const responseData = await response.json();
          
          // Extract usage data from response using deriveUsage function
          usageData = deriveUsage(responseData);

          if (!response.ok) {
            console.error(`OpenRouter error for ${model}: ${response.status} ${response.statusText}`);
            return {
              agentId: model,
              decision: "reject" as ReviewDecision,
              reasoning: `API returned ${response.status}.`,
              ...usageData,
            };
          }

          const content = responseData?.choices?.[0]?.message?.content ?? "";
          const parsed = parseReview(content);

          return {
            agentId: model,
            decision: parsed.decision,
            reasoning: parsed.reasoning,
            ...usageData,
          };
        } catch (error) {
          console.error(`Failed to review with ${model}:`, error);
          return {
            agentId: model,
            decision: "reject" as ReviewDecision,
            reasoning: "Review failed due to an unexpected error.",
            ...usageData,
          };
        }
      });

      reviewVotes = await Promise.all(reviewPromises);
      await ctx.runMutation(internal.papers.updatePaperStatus, {
        paperId: args.paperId,
        status: "under_review",
        reviewVotes,
        totalReviewCost: reviewVotes.reduce((sum, vote) => sum + vote.cost, 0),
        totalTokens: reviewVotes.reduce((sum, vote) => sum + vote.totalTokens, 0),
      });
    }
    let totalReviewCost = reviewVotes.reduce((sum, vote) => sum + vote.cost, 0);
    let totalTokens = reviewVotes.reduce((sum, vote) => sum + vote.totalTokens, 0);


    if (totalReviewCost > MAX_REVIEW_COST) {
      console.warn(
        `Review for ${paper.title} exceeded budget: ${totalReviewCost.toFixed(2)} (limit ${MAX_REVIEW_COST.toFixed(2)})`,
      );
    }

    const publishNowVotes = reviewVotes.filter((vote) => vote.decision === "publish_now").length;

    const finalStatus = publishNowVotes >= Math.ceil(REVIEW_MODELS.length * 0.6) ? "accepted" : "rejected";

    const statusPatch: {
      paperId: Id<"papers">;
      status: "accepted" | "rejected";
      reviewVotes: ReviewVote[];
      totalReviewCost: number;
      totalTokens: number;
      renderContent?: string;
      renderMetadata?: {
        abstract?: string;
        sections: PublishingEditorSection[];
      };
      publishingEditor?: {
        status: "completed" | "failed_fallback_original";
        model: string;
        editedAt: number;
        attempts: number;
        reason?: string;
        cost: number;
        promptTokens?: number;
        completionTokens?: number;
        cachedTokens?: number;
        totalTokens?: number;
      };
    } = {
      paperId: args.paperId,
      status: finalStatus,
      reviewVotes,
      totalReviewCost,
      totalTokens,
    };

    if (finalStatus === "accepted") {
      const editorRun = await runPublishingEditor(paper);
      totalReviewCost += editorRun.usage.cost;
      totalTokens += editorRun.usage.totalTokens;
      statusPatch.totalReviewCost = totalReviewCost;
      statusPatch.totalTokens = totalTokens;

      if (editorRun.result.ok) {
        statusPatch.renderContent = editorRun.result.renderContent;
        statusPatch.renderMetadata = editorRun.result.renderMetadata;
        const publishingEditor: NonNullable<typeof statusPatch.publishingEditor> = {
          status: "completed",
          model: PUBLISHING_EDITOR_MODEL,
          editedAt: Date.now(),
          attempts: editorRun.attempts,
          cost: editorRun.usage.cost,
          promptTokens: editorRun.usage.promptTokens,
          completionTokens: editorRun.usage.completionTokens,
          cachedTokens: editorRun.usage.cachedTokens,
          totalTokens: editorRun.usage.totalTokens,
        };
        if (editorRun.result.reason !== undefined) {
          publishingEditor.reason = editorRun.result.reason;
        }
        statusPatch.publishingEditor = publishingEditor;
      } else {
        statusPatch.publishingEditor = {
          status: "failed_fallback_original",
          model: PUBLISHING_EDITOR_MODEL,
          editedAt: Date.now(),
          attempts: editorRun.attempts,
          reason: editorRun.result.reason,
          cost: editorRun.usage.cost,
          promptTokens: editorRun.usage.promptTokens,
          completionTokens: editorRun.usage.completionTokens,
          cachedTokens: editorRun.usage.cachedTokens,
          totalTokens: editorRun.usage.totalTokens,
        };
      }
    }

    await ctx.runMutation(internal.papers.updatePaperStatus, statusPatch);

    if (finalStatus === "accepted") {
      const slopId = deriveSlopId(paper._id);
      await ctx.runMutation(internal.slopId.upsertSlopId, {
        paperId: args.paperId,
        slopId,
        link: localPaperLink(args.paperId),
        fromLocalJournal: true,
      });
      await ctx.runAction(internal.actions.regenerateSitemap, {});
      await ctx.runMutation(internal.slopbotTweets.ensureHighlightedPaperRecord, { paperId: args.paperId });
      await ctx.runAction(internal.slopbotPublishedTweet.tweetPublishedPaper, { paperId: args.paperId });
    }

    if (notificationEmail && (finalStatus === "accepted" || finalStatus === "rejected")) {
      const shouldSendNotification = await ctx.runMutation(internal.papers.reserveStatusNotification, {
        paperId: args.paperId,
        status: finalStatus,
        recipient: notificationEmail,
      });

      if (!shouldSendNotification) {
        return null;
      }

      const reviewSummary = reviewVotes
        .map((vote) => `${vote.agentId}: ${vote.reasoning}`)
        .slice(0, 3)
        .join(" · ");

      await sendPaperStatusNotification({
        to: notificationEmail,
        paperId: args.paperId,
        paperTitle: paper.title,
        status: finalStatus,
        reviewSummary: reviewSummary || undefined,
      });
    }

    return null;
  },
});

export const regenerateSitemap = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const papers = await ctx.runQuery(internal.sitemap.listAcceptedPapersForSitemap, {});

    const buildMetadata = (paper: (typeof papers)[number]) => {
      const tokens = typeof paper.totalTokens === "number" ? paper.totalTokens : 0;
      const keywords = paper.tags.join(", ");
      const publishedDate = new Date(paper.submittedAt).toISOString().split("T")[0];

      const newsMetadata = [
        "    <news:news>",
        "      <news:publication>",
        "        <news:name>The Journal of AI Slop™</news:name>",
        "        <news:language>en</news:language>",
        "      </news:publication>",
        `      <news:publication_date>${escapeXmlValue(publishedDate)}</news:publication_date>`,
        `      <news:title>${escapeXmlValue(paper.title)}</news:title>`,
        `      <news:keywords>${escapeXmlValue(keywords)}</news:keywords>`,
        "    </news:news>",
      ];

      const metadata: string[] = [
        ...newsMetadata,
        `    <meta:keywords>${escapeXmlValue(keywords)}</meta:keywords>`,
        `    <meta:tags>${escapeXmlValue(keywords)}</meta:tags>`,
        `    <meta:review-count>${paper.reviewCount}</meta:review-count>`,
        `    <meta:impact>${tokens}</meta:impact>`,
        `    <meta:token-count>${tokens}</meta:token-count>`,
        `    <meta:published-date>${escapeXmlValue(publishedDate)}</meta:published-date>`,
      ];

      if (paper.slopIdentifier?.slopId) {
        metadata.push(`    <meta:identifier>${escapeXmlValue(paper.slopIdentifier.slopId)}</meta:identifier>`);
      }

      if (paper.slopIdentifier?.link && !paper.slopIdentifier.fromLocalJournal) {
        metadata.push(`    <meta:canonical>${escapeXmlValue(paper.slopIdentifier.link)}</meta:canonical>`);
      }

      return metadata;
    };

    type SitemapEntry = {
      loc: string;
      lastmod?: string;
      metadata?: string[];
    };

    const urls: SitemapEntry[] = [
      ...SITEMAP_STATIC_PATHS.map((path) => ({ loc: absolutePath(path) })),
      ...papers.map((paper: (typeof papers)[number]) => {
        const lastmod = Number.isFinite(paper.lastmod)
          ? new Date(paper.lastmod).toISOString()
          : undefined;
        return {
          loc: `${SITE_URL}/papers/${paper.paperId}`,
          lastmod,
          metadata: buildMetadata(paper),
        };
      }),
    ];

    const entriesXml = urls
      .map((entry) => {
        const fragments = [
          "  <url>",
          `    <loc>${escapeXmlValue(entry.loc)}</loc>`,
          "    <changefreq>never</changefreq>",
          "    <priority>0.8</priority>",
        ];
        if (entry.lastmod) {
          fragments.push(`    <lastmod>${escapeXmlValue(entry.lastmod)}</lastmod>`);
        }
        if (entry.metadata) {
          fragments.push(...entry.metadata);
        }
        fragments.push("  </url>");
        return fragments.join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<urlset xmlns="${SITEMAP_XML_NAMESPACE}" xmlns:meta="${SITEMAP_META_NAMESPACE}" xmlns:news="${SITEMAP_NEWS_NAMESPACE}">`,
      entriesXml,
      "</urlset>",
    ].join("\n");

    const encoder = new TextEncoder();
    const payload = encoder.encode(xml);
    const hash = createHash("sha256").update(payload).digest("hex");
    const sitemapBlob = new Blob([payload], { type: "application/xml" });
    const fileId: Id<"_storage"> = await ctx.storage.store(sitemapBlob);

    await ctx.runMutation(internal.sitemap.upsertSitemapMetadata, {
      name: SITEMAP_METADATA_NAME,
      fileId,
      generatedAt: Date.now(),
      hash,
      entryCount: urls.length,
      contentLength: payload.byteLength,
    });

    return null;
  },
});

export const regenerateSlopIds = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const listMissing = (internal.slopId as any).listAcceptedPaperIdsMissingSlop;
    const paperIds = await ctx.runQuery(listMissing, {});

    for (const paperId of paperIds) {
      const slopId = deriveSlopId(paperId);
      await ctx.runMutation(internal.slopId.upsertSlopId, {
        paperId,
        slopId,
        link: localPaperLink(paperId),
        fromLocalJournal: true,
      });
    }

    return null;
  },
});

export const processNextQueuedReview = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const queueItem = await ctx.runMutation(internal.papersQueue.acquireNextPaperForReview, {});
    if (!queueItem) {
      console.info("Council cron ticked but queue is empty.");
      return null;
    }

    try {
      await ctx.runAction(internal.actions.reviewPaper, {
        paperId: queueItem.paperId,
        notificationEmail: queueItem.notificationEmail ?? undefined,
      });
      await ctx.runMutation(internal.papersQueue.completeQueueItem, { queueId: queueItem.queueId });
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : "Unknown failure";
      console.error("Queued review failed", { queueItem, failureReason });
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: queueItem.queueId,
        reason: `Review pipeline failed and will retry: ${failureReason || "unknown failure"}`,
      });
    }

    return null;
  },
});

/* Dev note: Hi mum! */
