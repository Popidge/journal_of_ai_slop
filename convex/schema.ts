import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    }))),
    totalReviewCost: v.optional(v.number()),
  }).index("by_status", ["status"]).index("by_submittedAt", ["submittedAt"]),
});