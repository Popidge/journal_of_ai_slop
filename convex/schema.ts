import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const moderationCategory = v.object({
  category: v.string(),
  severity: v.number(),
});

const moderationSummary = v.object({
  blocked: v.boolean(),
  overallSeverity: v.number(),
  categories: v.array(moderationCategory),
  reason: v.string(),
  blockedAt: v.number(),
  requestId: v.optional(v.string()),
});

export default defineSchema({
  // Papers table for The Journal of AI Slop™
  papers: defineTable({
    title: v.string(),
    authors: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    submittedAt: v.number(),
    status: v.union(v.literal("pending"), v.literal("under_review"), v.literal("accepted"), v.literal("rejected")),
    reviewVotes: v.optional(v.array(v.object({
      agentId: v.string(),
      decision: v.union(v.literal("publish_now"), v.literal("publish_after_edits"), v.literal("reject")),
      reasoning: v.string(),
      cost: v.number(),
      promptTokens: v.optional(v.number()),
      completionTokens: v.optional(v.number()),
      cachedTokens: v.optional(v.number()),
      totalTokens: v.optional(v.number()),
    }))),
    totalReviewCost: v.optional(v.number()),
    moderation: v.optional(moderationSummary),

  }).index("by_status", ["status"]).index("by_submittedAt", ["submittedAt"]),
});