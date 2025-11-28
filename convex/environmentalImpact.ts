import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_LABEL = "default";

const impactProjection = v.object({
  _id: v.id("environmentalImpactValues"),
  _creationTime: v.number(),
  label: v.string(),
  energyPerTokenWh: v.number(),
  co2PerWh: v.number(),
});

export const getImpactValues = query({
  args: {
    label: v.optional(v.string()),
  },
  returns: v.union(impactProjection, v.null()),
  handler: async (ctx, args) => {
    const label = args.label ?? DEFAULT_LABEL;
    const records = await ctx.db
      .query("environmentalImpactValues")
      .withIndex("by_label", (q) => q.eq("label", label))
      .take(1);
    return records[0] ?? null;
  },
});

export const internalUpsertImpactValues = internalMutation({
  args: {
    label: v.string(),
    energyPerTokenWh: v.number(),
    co2PerWh: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("environmentalImpactValues")
      .withIndex("by_label", (q) => q.eq("label", args.label))
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        energyPerTokenWh: args.energyPerTokenWh,
        co2PerWh: args.co2PerWh,
      });
    } else {
      await ctx.db.insert("environmentalImpactValues", {
        label: args.label,
        energyPerTokenWh: args.energyPerTokenWh,
        co2PerWh: args.co2PerWh,
      });
    }

    return null;
  },
});
