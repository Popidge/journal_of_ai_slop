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

const queueStatus = v.union(v.literal("pending"), v.literal("processing"));

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
      totalTokens: v.optional(v.number()),
      moderation: v.optional(moderationSummary),

  })
    .index("by_status", ["status"])
    .index("by_submittedAt", ["submittedAt"]),

  highlightedPapers: defineTable({
    paperId: v.id("papers"),
    dateHighlighted: v.optional(v.number()),
  })
    .index("by_paperId", ["paperId"])
    .index("by_dateHighlighted", ["dateHighlighted"]),

  editorsComments: defineTable({
    paperId: v.id("papers"),
    editorComment: v.string(),
  }).index("by_paperId", ["paperId"]),

  papersQueue: defineTable({
    paperId: v.id("papers"),
    queuedAt: v.number(),
    status: queueStatus,
    lastError: v.optional(v.string()),
    notificationEmail: v.optional(v.string()),
  })
    .index("by_paperId", ["paperId"])
    .index("by_status_and_queuedAt", ["status", "queuedAt"]),
  environmentalImpactValues: defineTable({
    label: v.string(),
    energyPerTokenWh: v.number(),
    co2PerWh: v.number(),
  }).index("by_label", ["label"]),

  slopIdentifiers: defineTable({
    slopId: v.string(),
    paperId: v.optional(v.id("papers")),
    link: v.string(),
    fromLocalJournal: v.boolean(),
  })
    .index("by_slopId", ["slopId"])
    .index("by_paperId", ["paperId"]),

  slopTweets: defineTable({
    tweetType: v.union(v.literal("new_publication"), v.literal("daily_highlight")),
    paperId: v.optional(v.id("papers")),
    highlightId: v.optional(v.id("highlightedPapers")),
    tweetId: v.optional(v.string()),
    tweetBody: v.string(),
    persona: v.string(),
    postedAt: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("success"), v.literal("failed")),
    error: v.optional(v.string()),
    runId: v.optional(v.string()),
  })
    .index("by_tweetType", ["tweetType"])
    .index("by_paperId", ["paperId"]),

  sitemaps: defineTable({
    name: v.string(),
    fileId: v.id("_storage"),
    generatedAt: v.number(),
    hash: v.string(),
    entryCount: v.number(),
    contentLength: v.number(),
  }).index("by_name", ["name"]),
});
