import { query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const identifierValidator = v.object({
  _id: v.id("slopIdentifiers"),
  _creationTime: v.number(),
  slopId: v.string(),
  paperId: v.optional(v.id("papers")),
  link: v.string(),
  fromLocalJournal: v.boolean(),
});

const slopIdPattern = /^slop:\d{4}:\d{10}$/;

const fetchIdentifierByPaperId = async (ctx: any, paperId: Id<"papers">) => {
  return await ctx.db
    .query("slopIdentifiers")
    .withIndex("by_paperId", (q: any) => q.eq("paperId", paperId))
    .unique();
};

export const getByPaperId = query({
  args: {
    paperId: v.id("papers"),
  },
  returns: v.union(identifierValidator, v.null()),
  handler: async (ctx, args) => {
    const identifier = await fetchIdentifierByPaperId(ctx, args.paperId);
    return identifier ?? null;
  },
});

export const getBySlopId = query({
  args: {
    slopId: v.string(),
  },
  returns: v.union(identifierValidator, v.null()),
  handler: async (ctx, args) => {
    const identifier = await ctx.db
      .query("slopIdentifiers")
      .withIndex("by_slopId", (q: any) => q.eq("slopId", args.slopId))
      .unique();
    return identifier ?? null;
  },
});

export const getByPaperIds = query({
  args: {
    paperIds: v.array(v.id("papers")),
  },
  returns: v.array(identifierValidator),
  handler: async (ctx, args) => {
    const identifiers = [];
    for (const paperId of args.paperIds) {
      const identifier = await fetchIdentifierByPaperId(ctx, paperId);
      if (identifier) {
        identifiers.push(identifier);
      }
    }
    return identifiers;
  },
});

export const listAcceptedPaperIdsMissingSlop = query({
  args: {},
  returns: v.array(v.id("papers")),
  handler: async (ctx) => {
    const missing: Array<Id<"papers">> = [];
    const accepted = ctx.db
      .query("papers")
      .withIndex("by_status", (q: any) => q.eq("status", "accepted"));

    for await (const paper of accepted) {
      const identifier = await fetchIdentifierByPaperId(ctx, paper._id);
      if (!identifier) {
        missing.push(paper._id);
      }
    }

    return missing;
  },
});

export const upsertSlopId = internalMutation({
  args: {
    slopId: v.string(),
    paperId: v.optional(v.id("papers")),
    link: v.string(),
    fromLocalJournal: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedSlopId = args.slopId.trim();
    if (!slopIdPattern.test(normalizedSlopId)) {
      throw new Error("Slop ID must match slop:YYYY:NNNNNNNNNN");
    }

    const paperId = args.paperId === undefined ? undefined : args.paperId;

    const existingBySlopId = await ctx.db
      .query("slopIdentifiers")
      .withIndex("by_slopId", (q: any) => q.eq("slopId", normalizedSlopId))
      .unique();

    if (existingBySlopId) {
      if ((paperId !== undefined && existingBySlopId.paperId !== undefined && existingBySlopId.paperId === paperId) ||
        (paperId === undefined && existingBySlopId.paperId === undefined)) {
        return null;
      }
      throw new Error("Slop ID already assigned to another paper");
    }

    if (paperId !== undefined) {
      const existingByPaperId = await ctx.db
        .query("slopIdentifiers")
        .withIndex("by_paperId", (q: any) => q.eq("paperId", paperId))
        .unique();
      if (existingByPaperId) {
        if (existingByPaperId.slopId === normalizedSlopId) {
          return null;
        }
        throw new Error("Paper already has a different Slop ID");
      }
    }

    await ctx.db.insert("slopIdentifiers", {
      slopId: normalizedSlopId,
      paperId,
      link: args.link,
      fromLocalJournal: args.fromLocalJournal,
    });

    return null;
  },
});
