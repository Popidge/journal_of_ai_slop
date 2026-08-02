"use node";
import { OPENROUTER_ENDPOINT } from "./openrouter";
import {
  isPipelineSmokeTestMode,
  logPipelineSmokeTest,
} from "./pipelineSmokeTest";
import { REVIEWER_PERSONAS, type ReviewModel } from "./reviewConfig";

const REVIEW_CONTENT_CHARACTER_LIMIT = 19000;
export const PUBLISHING_EDITOR_MODEL = "deepseek/deepseek-v4-pro";
const PUBLISHING_EDITOR_MAX_ATTEMPTS = 2;
const PUBLISHING_EDITOR_TEMPERATURE = 0.2;

export type ReviewDecision = "publish_now" | "publish_after_edits" | "reject";

export type ReviewVote = {
  agentId: string;
  decision: ReviewDecision;
  reasoning: string;
  cost: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

export type UsageData = {
  cost: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

export type PublishingEditorSection = {
  title: string;
  anchor: string;
  level: number;
  source: "explicit" | "inferred";
};

export type PublishingEditorSuccess = {
  ok: true;
  renderContent: string;
  renderMetadata: {
    abstract?: string;
    sections: PublishingEditorSection[];
  };
  reason?: string;
};

export type PublishingEditorFailure = {
  ok: false;
  reason: string;
};

export const normalizeDecision = (value: unknown): ReviewDecision => {
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

export const normalizeStoredReviewVotes = (votes: Array<{
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

export const extractJsonPayload = (text: string): string => {
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

export const parseReview = (rawText: string): { decision: ReviewDecision; reasoning: string } => {
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

export const buildPrompt = (paper: {
  title: string;
  authors: string;
  tags: string[];
  content: string;
}, model: ReviewModel): string => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tag)";
  const truncated = paper.content.length > REVIEW_CONTENT_CHARACTER_LIMIT
    ? `${paper.content.slice(0, REVIEW_CONTENT_CHARACTER_LIMIT)}...`
    : paper.content;

  return `You are a peer reviewer for The Journal of AI Slop™, a semi-satirical academic journal.

Your reviewer character:
${REVIEWER_PERSONAS[model]}

Stay in character in your reasoning, but the journal's ethos and review criteria below always take priority over the character.

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

export const buildPublishingEditorPrompt = (paper: {
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

export const deriveUsage = (payload: any): UsageData => {
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

export const slugifyAnchor = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "section";
};

export const hasSchemaWrapperText = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("{") ||
    normalized.startsWith("```json") ||
    normalized.includes('"rendercontent"')
  );
};

export const parsePublishingEditorOutput = (
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

export const runPublishingEditor = async (paper: {
  title: string;
  authors: string;
  tags: string[];
  content: string;
}): Promise<{
  result: PublishingEditorSuccess | PublishingEditorFailure;
  usage: UsageData;
  attempts: number;
}> => {
  if (isPipelineSmokeTestMode()) {
    logPipelineSmokeTest("publishing editor OpenRouter call mocked", {
      title: paper.title,
    });
    return {
      result: {
        ok: true,
        renderContent: paper.content,
        renderMetadata: {
          abstract: "A deterministic abstract produced by pipeline smoke-test mode.",
          sections: [
            {
              title: "Smoke-Test Findings",
              anchor: "smoke-test-findings",
              level: 2,
              source: "inferred",
            },
          ],
        },
        reason: "pipeline_smoke_test_mock",
      },
      usage: {
        cost: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
      },
      attempts: 1,
    };
  }

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
      const usageData = deriveUsage(responseData);
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
    }
  }

  return {
    result: lastFailure,
    usage: totalUsage,
    attempts: PUBLISHING_EDITOR_MAX_ATTEMPTS,
  };
};

export const buildReviewVote = (model: string, decision: ReviewDecision, reasoning: string, usage: UsageData): ReviewVote => ({
  agentId: model,
  decision,
  reasoning,
  cost: usage.cost,
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  cachedTokens: usage.cachedTokens,
  totalTokens: usage.totalTokens,
});

export const buildPublishingEditorRecord = (
  status: "completed" | "failed_fallback_original",
  model: string,
  editedAt: number,
  attempts: number,
  usage: UsageData,
  reason?: string,
) => ({
  status,
  model,
  editedAt,
  attempts,
  cost: usage.cost,
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  cachedTokens: usage.cachedTokens,
  totalTokens: usage.totalTokens,
  reason,
});

export const buildStatusPatch = (
  paperId: string,
  status: "accepted" | "rejected",
  reviewVotes: ReviewVote[],
  totalReviewCost: number,
  totalTokens: number,
  renderContent?: string,
  renderMetadata?: { abstract?: string; sections: PublishingEditorSection[] },
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
  },
) => ({
  paperId,
  status,
  reviewVotes,
  totalReviewCost,
  totalTokens,
  renderContent,
  renderMetadata,
  publishingEditor,
});
