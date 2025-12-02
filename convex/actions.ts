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

const REVIEW_MODELS = [
  "anthropic/claude-haiku-4.5",
  "x-ai/grok-4.1-fast:free",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-nano",
  "meta-llama/llama-4-maverick",
] as const;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_REVIEW_COST = 0.2;
const TRUNCATE_LENGTH = 3000;
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
  const truncated = paper.content.length > TRUNCATE_LENGTH
    ? `${paper.content.slice(0, TRUNCATE_LENGTH)}...`
    : paper.content;

  return `You are a peer reviewer for The Journal of AI Slop™, a semi-satirical academic journal.

The paper you're reviewing is tagged as: ${tags}

Paper Title: ${paper.title}
Authors: ${paper.authors}

Content (truncated to ${TRUNCATE_LENGTH} chars):
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
  "reasoning": "Two sentences explaining your decision"
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
  const truncatedContent = paper.content.length > TRUNCATE_LENGTH
    ? `${paper.content.slice(0, TRUNCATE_LENGTH)}...`
    : paper.content;

  return [
    `Title: ${paper.title}`,
    `Authors: ${paper.authors}`,
    `Tags: ${tags}`,
    "",
    truncatedContent,
  ].join("\n");
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
    const parameters: AnalyzeTextParameters = {
      body: {
        text: buildModerationText(paper),
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

    const overallSeverity = categories.reduce((sum, entry) => sum + entry.severity, 0);
    const blockedByCategory = categories.some((entry) => entry.severity >= CATEGORY_SEVERITY_THRESHOLD);
    const blockedByOverall = overallSeverity >= OVERALL_SEVERITY_THRESHOLD;
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

    const bodyWithId = response.body as { id?: string };

    return {
      blocked,
      overallSeverity,
      categories,
      requestId: bodyWithId.id ?? undefined,
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
            max_tokens: 500,
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

    const reviewVotes: ReviewVote[] = await Promise.all(reviewPromises);
    const totalReviewCost = reviewVotes.reduce((sum, vote) => sum + vote.cost, 0);
    const totalTokens = reviewVotes.reduce((sum, vote) => sum + vote.totalTokens, 0);


    if (totalReviewCost > MAX_REVIEW_COST) {
      console.warn(
        `Review for ${paper.title} exceeded budget: ${totalReviewCost.toFixed(2)} (limit ${MAX_REVIEW_COST.toFixed(2)})`,
      );
    }

    const publishNowVotes = reviewVotes.filter((vote) => vote.decision === "publish_now").length;

    const finalStatus = publishNowVotes >= Math.ceil(REVIEW_MODELS.length * 0.6) ? "accepted" : "rejected";

    await ctx.runMutation(internal.papers.updatePaperStatus, {
      paperId: args.paperId,
      status: finalStatus,
      reviewVotes,
      totalReviewCost,
      totalTokens,
    });

    if (finalStatus === "accepted") {
      const slopId = deriveSlopId(paper._id);
      await ctx.runMutation(internal.slopId.upsertSlopId, {
        paperId: args.paperId,
        slopId,
        link: localPaperLink(args.paperId),
        fromLocalJournal: true,
      });
      await ctx.runAction(internal.actions.regenerateSitemap, {});
    }

    if (notificationEmail && (finalStatus === "accepted" || finalStatus === "rejected")) {
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

    const urls: Array<{ loc: string; lastmod?: string }> = [
      ...SITEMAP_STATIC_PATHS.map((path) => ({ loc: absolutePath(path) })),
      ...papers.map((paper) => {
        const lastmod = Number.isFinite(paper.lastmod)
          ? new Date(paper.lastmod).toISOString()
          : undefined;
        return {
          loc: `${SITE_URL}/papers/${paper.paperId}`,
          lastmod,
        };
      }),
    ];

    const entriesXml = urls
      .map((entry) => {
        const fragments = [
          "  <url>",
          `    <loc>${escapeXmlValue(entry.loc)}</loc>`,
        ];
        if (entry.lastmod) {
          fragments.push(`    <lastmod>${escapeXmlValue(entry.lastmod)}</lastmod>`);
        }
        fragments.push("  </url>");
        return fragments.join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<urlset xmlns="${SITEMAP_XML_NAMESPACE}">`,
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
      await ctx.runMutation(internal.papersQueue.rejectAndDropQueueItem, {
        queueId: queueItem.queueId,
        paperId: queueItem.paperId,
        reason: `Auto-rejected after review failure: ${failureReason}`,
      });
    }

    return null;
  },
});

/* Dev note: Hi mum! */
