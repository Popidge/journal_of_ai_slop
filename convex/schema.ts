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

const renderSection = v.object({
  title: v.string(),
  anchor: v.string(),
  level: v.number(),
  source: v.union(v.literal("explicit"), v.literal("inferred")),
});

const renderMetadata = v.object({
  abstract: v.optional(v.string()),
  sections: v.array(renderSection),
});

const publishingEditor = v.object({
  status: v.union(
    v.literal("completed"),
    v.literal("failed_fallback_original"),
  ),
  model: v.string(),
  editedAt: v.number(),
  attempts: v.number(),
  reason: v.optional(v.string()),
  cost: v.number(),
  promptTokens: v.optional(v.number()),
  completionTokens: v.optional(v.number()),
  cachedTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
});

const queueStatus = v.union(v.literal("pending"), v.literal("processing"));

export default defineSchema({
  // Papers table for The Journal of AI Slop™
  papers: defineTable({
    title: v.string(),
    authors: v.string(),
    content: v.string(),
    renderContent: v.optional(v.string()),
    renderMetadata: v.optional(renderMetadata),
    publishingEditor: v.optional(publishingEditor),
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
    reviewedAt: v.optional(v.number()),
    moderation: v.optional(moderationSummary),
  })
    .index("by_status", ["status"])
    .index("by_submittedAt", ["submittedAt"])
    .index("by_status_reviewedAt", ["status", "reviewedAt"]),

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
    attempts: v.optional(v.number()),
    processingStartedAt: v.optional(v.number()),
    notificationEmail: v.optional(v.string()),
  })
    .index("by_paperId", ["paperId"])
    .index("by_status_and_queuedAt", ["status", "queuedAt"]),
  environmentalImpactValues: defineTable({
    label: v.string(),
    energyPerTokenWh: v.number(),
    co2PerWh: v.number(),
  }).index("by_label", ["label"]),

  carbonLedgerSnapshots: defineTable({
    label: v.string(),
    calculatedAt: v.number(),
    lastIncludedReviewedAt: v.optional(v.number()),
    paperCount: v.number(),
    totalTokens: v.number(),
    energyPerTokenWh: v.number(),
    co2PerWh: v.number(),
    totalEnergyWh: v.number(),
    totalEnergyKWh: v.number(),
    totalCo2g: v.number(),
    totalCo2kg: v.number(),
    stripeClimateDueGbp: v.number(),
    solarAidDueGbp: v.number(),
  })
    .index("by_label", ["label"])
    .index("by_calculatedAt", ["calculatedAt"]),

  carbonOffsets: defineTable({
    organization: v.string(),
    offsetType: v.union(
      v.literal("carbon_removal"),
      v.literal("renewable_energy"),
      v.literal("other"),
    ),
    amountGbp: v.number(),
    purchasedAt: v.number(),
    receiptUrl: v.optional(v.string()),
    receiptLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    co2KgClaimed: v.optional(v.number()),
    energyKWhClaimed: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_purchasedAt", ["purchasedAt"])
    .index("by_offsetType", ["offsetType"]),

  slopIdentifiers: defineTable({
    slopId: v.string(),
    paperId: v.optional(v.id("papers")),
    link: v.string(),
    fromLocalJournal: v.boolean(),
  })
    .index("by_slopId", ["slopId"])
    .index("by_paperId", ["paperId"]),

  slopTweets: defineTable({
    postType: v.union(v.literal("new_publication"), v.literal("daily_highlight")),
    tweetType: v.optional(v.union(v.literal("new_publication"), v.literal("daily_highlight"))),
    paperId: v.optional(v.id("papers")),
    highlightId: v.optional(v.id("highlightedPapers")),
    externalPostId: v.optional(v.string()),
    tweetId: v.optional(v.string()),
    postBody: v.optional(v.string()),
    tweetBody: v.optional(v.string()),
    persona: v.string(),
    createdAt: v.number(),
    status: v.union(
      v.literal("drafted"),
      v.literal("failed_generation"),
      v.literal("success"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    runId: v.optional(v.string()),
  })
    .index("by_postType", ["postType"])
    .index("by_paperId", ["paperId"]),

  publishedEvents: defineTable({
    key: v.string(),
    paperId: v.id("papers"),
    postType: v.union(v.literal("new_publication"), v.literal("daily_highlight")),
    createdAt: v.number(),
  }).index("by_key", ["key"]),

  notificationEvents: defineTable({
    key: v.string(),
    paperId: v.id("papers"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    recipient: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["key"]),

  sitemaps: defineTable({
    name: v.string(),
    fileId: v.id("_storage"),
    generatedAt: v.number(),
    hash: v.string(),
    entryCount: v.number(),
    contentLength: v.number(),
  }).index("by_name", ["name"]),
});
