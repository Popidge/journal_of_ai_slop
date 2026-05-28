import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const DEFAULT_LABEL = "default";
const STRIPE_CLIMATE_GBP_PER_CO2_KG = 1;
const SOLAR_AID_GBP_PER_KWH = 0.3;

const offsetTypeValidator = v.union(
  v.literal("carbon_removal"),
  v.literal("renewable_energy"),
  v.literal("other"),
);

const snapshotProjection = v.object({
  _id: v.id("carbonLedgerSnapshots"),
  _creationTime: v.number(),
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
});

const offsetProjection = v.object({
  _id: v.id("carbonOffsets"),
  _creationTime: v.number(),
  organization: v.string(),
  offsetType: offsetTypeValidator,
  amountGbp: v.number(),
  purchasedAt: v.number(),
  receiptUrl: v.optional(v.string()),
  receiptLabel: v.optional(v.string()),
  notes: v.optional(v.string()),
  co2KgClaimed: v.optional(v.number()),
  energyKWhClaimed: v.optional(v.number()),
  createdAt: v.number(),
});

const reviewedPaperProjection = v.object({
  reviewedAt: v.number(),
  totalTokens: v.number(),
});

const ledgerProjection = v.object({
  snapshot: v.union(snapshotProjection, v.null()),
  offsets: v.array(offsetProjection),
  totalOffsetGbp: v.number(),
  totalCarbonRemovalGbp: v.number(),
  totalRenewableEnergyGbp: v.number(),
  totalCo2KgClaimed: v.number(),
  totalEnergyKWhClaimed: v.number(),
  remainingStripeClimateGbp: v.number(),
  remainingSolarAidGbp: v.number(),
  remainingTotalGbp: v.number(),
});

const snapshotArgs = {
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
};

const calculateSnapshot = (params: {
  label: string;
  calculatedAt: number;
  lastIncludedReviewedAt?: number;
  paperCount: number;
  totalTokens: number;
  energyPerTokenWh: number;
  co2PerWh: number;
}) => {
  const totalEnergyWh = params.totalTokens * params.energyPerTokenWh;
  const totalEnergyKWh = totalEnergyWh / 1000;
  const totalCo2g = totalEnergyWh * params.co2PerWh;
  const totalCo2kg = totalCo2g / 1000;

  return {
    ...params,
    totalEnergyWh,
    totalEnergyKWh,
    totalCo2g,
    totalCo2kg,
    stripeClimateDueGbp: totalCo2kg * STRIPE_CLIMATE_GBP_PER_CO2_KG,
    solarAidDueGbp: totalEnergyKWh * SOLAR_AID_GBP_PER_KWH,
  };
};

export const getLedger = query({
  args: {},
  returns: ledgerProjection,
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("carbonLedgerSnapshots")
      .withIndex("by_label", (q) => q.eq("label", DEFAULT_LABEL))
      .order("desc")
      .take(1);
    const snapshot = snapshots[0] ?? null;
    const offsets = await ctx.db
      .query("carbonOffsets")
      .withIndex("by_purchasedAt")
      .order("desc")
      .collect();

    const totalOffsetGbp = offsets.reduce((sum, offset) => sum + offset.amountGbp, 0);
    const totalCarbonRemovalGbp = offsets
      .filter((offset) => offset.offsetType === "carbon_removal")
      .reduce((sum, offset) => sum + offset.amountGbp, 0);
    const totalRenewableEnergyGbp = offsets
      .filter((offset) => offset.offsetType === "renewable_energy")
      .reduce((sum, offset) => sum + offset.amountGbp, 0);
    const totalCo2KgClaimed = offsets.reduce((sum, offset) => sum + (offset.co2KgClaimed ?? 0), 0);
    const totalEnergyKWhClaimed = offsets.reduce((sum, offset) => sum + (offset.energyKWhClaimed ?? 0), 0);
    const remainingStripeClimateGbp = Math.max(
      (snapshot?.stripeClimateDueGbp ?? 0) - totalCarbonRemovalGbp,
      0,
    );
    const remainingSolarAidGbp = Math.max(
      (snapshot?.solarAidDueGbp ?? 0) - totalRenewableEnergyGbp,
      0,
    );

    return {
      snapshot,
      offsets,
      totalOffsetGbp,
      totalCarbonRemovalGbp,
      totalRenewableEnergyGbp,
      totalCo2KgClaimed,
      totalEnergyKWhClaimed,
      remainingStripeClimateGbp,
      remainingSolarAidGbp,
      remainingTotalGbp: remainingStripeClimateGbp + remainingSolarAidGbp,
    };
  },
});

export const listReviewedPapersAfter = internalQuery({
  args: {
    reviewedAfter: v.optional(v.number()),
  },
  returns: v.array(reviewedPaperProjection),
  handler: async (ctx, args) => {
    const statuses = ["accepted", "rejected"] as const;
    const papers: Array<{ reviewedAt: number; totalTokens: number }> = [];

    for (const status of statuses) {
      const queryBuilder = ctx.db
        .query("papers")
        .withIndex("by_status_reviewedAt", (q) => {
          const statusQuery = q.eq("status", status);
          return args.reviewedAfter === undefined
            ? statusQuery
            : statusQuery.gt("reviewedAt", args.reviewedAfter);
        });

      for await (const paper of queryBuilder.order("asc")) {
        if (paper.moderation?.blocked) continue;
        if (typeof paper.reviewedAt !== "number") continue;
        if (typeof paper.totalTokens !== "number" || paper.totalTokens <= 0) continue;
        papers.push({
          reviewedAt: paper.reviewedAt,
          totalTokens: paper.totalTokens,
        });
      }
    }

    return papers.sort((a, b) => a.reviewedAt - b.reviewedAt);
  },
});

export const getLatestSnapshot = internalQuery({
  args: {},
  returns: v.union(snapshotProjection, v.null()),
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("carbonLedgerSnapshots")
      .withIndex("by_label", (q) => q.eq("label", DEFAULT_LABEL))
      .order("desc")
      .take(1);
    return snapshots[0] ?? null;
  },
});

export const upsertLedgerSnapshot = internalMutation({
  args: snapshotArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("carbonLedgerSnapshots")
      .withIndex("by_label", (q) => q.eq("label", args.label))
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch("carbonLedgerSnapshots", existing[0]._id, args);
    } else {
      await ctx.db.insert("carbonLedgerSnapshots", args);
    }

    return null;
  },
});

export const recordOffset = mutation({
  args: {
    adminKey: v.string(),
    organization: v.string(),
    offsetType: offsetTypeValidator,
    amountGbp: v.number(),
    purchasedAt: v.number(),
    receiptUrl: v.optional(v.string()),
    receiptLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
    co2KgClaimed: v.optional(v.number()),
    energyKWhClaimed: v.optional(v.number()),
  },
  returns: v.id("carbonOffsets"),
  handler: async (ctx, args) => {
    const configuredAdminKey = process.env.CARBON_LEDGER_ADMIN_KEY;
    if (!configuredAdminKey || args.adminKey !== configuredAdminKey) {
      throw new Error("Unauthorized carbon ledger offset entry.");
    }

    return await ctx.db.insert("carbonOffsets", {
      organization: args.organization.trim(),
      offsetType: args.offsetType,
      amountGbp: args.amountGbp,
      purchasedAt: args.purchasedAt,
      receiptUrl: args.receiptUrl?.trim() || undefined,
      receiptLabel: args.receiptLabel?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      co2KgClaimed: args.co2KgClaimed,
      energyKWhClaimed: args.energyKWhClaimed,
      createdAt: Date.now(),
    });
  },
});

export const recalculateDailyLedger = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const [latestSnapshot, impact] = await Promise.all([
      ctx.runQuery(internal.carbonLedger.getLatestSnapshot, {}),
      ctx.runQuery(api.environmentalImpact.getImpactValues, { label: DEFAULT_LABEL }),
    ]);
    const reviewedPapers = await ctx.runQuery(internal.carbonLedger.listReviewedPapersAfter, {
      reviewedAfter: latestSnapshot?.lastIncludedReviewedAt,
    });
    const additionalTokens = reviewedPapers.reduce((sum, paper) => sum + paper.totalTokens, 0);
    const lastIncludedReviewedAt = reviewedPapers.reduce<number | undefined>(
      (latest, paper) => Math.max(latest ?? paper.reviewedAt, paper.reviewedAt),
      latestSnapshot?.lastIncludedReviewedAt,
    );

    const snapshot = calculateSnapshot({
      label: DEFAULT_LABEL,
      calculatedAt: Date.now(),
      lastIncludedReviewedAt,
      paperCount: (latestSnapshot?.paperCount ?? 0) + reviewedPapers.length,
      totalTokens: (latestSnapshot?.totalTokens ?? 0) + additionalTokens,
      energyPerTokenWh: impact?.energyPerTokenWh ?? 0,
      co2PerWh: impact?.co2PerWh ?? 0,
    });

    await ctx.runMutation(internal.carbonLedger.upsertLedgerSnapshot, snapshot);
    return null;
  },
});

export const rebuildLedgerSnapshot = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const [impact, reviewedPapers] = await Promise.all([
      ctx.runQuery(api.environmentalImpact.getImpactValues, { label: DEFAULT_LABEL }),
      ctx.runQuery(internal.carbonLedger.listReviewedPapersAfter, {}),
    ]);
    const totalTokens = reviewedPapers.reduce((sum, paper) => sum + paper.totalTokens, 0);
    const lastIncludedReviewedAt = reviewedPapers.reduce<number | undefined>(
      (latest, paper) => Math.max(latest ?? paper.reviewedAt, paper.reviewedAt),
      undefined,
    );

    const snapshot = calculateSnapshot({
      label: DEFAULT_LABEL,
      calculatedAt: Date.now(),
      lastIncludedReviewedAt,
      paperCount: reviewedPapers.length,
      totalTokens,
      energyPerTokenWh: impact?.energyPerTokenWh ?? 0,
      co2PerWh: impact?.co2PerWh ?? 0,
    });

    await ctx.runMutation(internal.carbonLedger.upsertLedgerSnapshot, snapshot);
    return null;
  },
});

export const rebuildLedgerSnapshotPublic = action({
  args: {
    adminKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const configuredAdminKey = process.env.CARBON_LEDGER_ADMIN_KEY;
    if (!configuredAdminKey || args.adminKey !== configuredAdminKey) {
      throw new Error("Unauthorized carbon ledger rebuild.");
    }

    await ctx.runAction(internal.carbonLedger.rebuildLedgerSnapshot, {});
    return null;
  },
});
