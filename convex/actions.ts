"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const REVIEW_MODELS = [
  "anthropic/claude-3-haiku",
  "x-ai/grok-4.1-fast:free",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-nano",
  "meta-llama/llama-3.3-70b-instruct",
] as const;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_REVIEW_COST = 0.2;
const TRUNCATE_LENGTH = 2000;

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

  return `You are a peer reviewer for The Journal of AI Slop™, a satirical academic journal.

The paper you're reviewing is tagged as: ${tags}

Paper Title: ${paper.title}
Authors: ${paper.authors}

Content (truncated to ${TRUNCATE_LENGTH} chars):
${truncated}

Your task: Decide if this paper should be published in our slop journal.

Respond with ONE of these decisions:
- "publish_now" - Peak slop, ready for the world
- "publish_after_edits" - Good slop but needs polish (treated as reject for this stage)
- "reject" - Not slop enough, too slop, or just wrong

Respond in valid JSON only:
{
  "decision": "publish_now" | "publish_after_edits" | "reject",
  "reasoning": "One sentence explaining your decision"
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

export const reviewPaper = internalAction({
  args: { paperId: v.id("papers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY must be set to run the review pipeline");
    }

    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      throw new Error("Paper not found");
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

    if (totalReviewCost > MAX_REVIEW_COST) {
      console.warn(
        `Review for ${paper.title} exceeded budget: $${totalReviewCost.toFixed(2)} (limit $${MAX_REVIEW_COST.toFixed(2)})`,
      );
    }

    const publishNowVotes = reviewVotes.filter((vote) => vote.decision === "publish_now").length;

    const finalStatus = publishNowVotes >= Math.ceil(REVIEW_MODELS.length * 0.6) ? "accepted" : "rejected";

    await ctx.runMutation(internal.papers.updatePaperStatus, {
      paperId: args.paperId,
      status: finalStatus,
      reviewVotes,
      totalReviewCost,
    });

    return null;
  },
});

/* Dev note: Hi mum! */
