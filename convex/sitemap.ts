import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const SITEMAP_METADATA_NAME = "latest";

export const listAcceptedPapersForSitemap = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      paperId: v.id("papers"),
      lastmod: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("papers")
      .withIndex("by_status", (q) => q.eq("status", "accepted"))
      .order("desc")
      .collect();

    return rows.map((row) => ({
      paperId: row._id,
      lastmod: typeof row.submittedAt === "number" ? row.submittedAt : row._creationTime,
    }));
  },
});

export const getSitemapMetadataByName = internalQuery({
  args: {
    name: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      fileId: v.id("_storage"),
      generatedAt: v.number(),
      hash: v.string(),
      entryCount: v.number(),
      contentLength: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("sitemaps")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .order("desc")
      .take(1);

    if (docs.length === 0) {
      return null;
    }

    const doc = docs[0];
    return {
      name: doc.name,
      fileId: doc.fileId,
      generatedAt: doc.generatedAt,
      hash: doc.hash,
      entryCount: doc.entryCount,
      contentLength: doc.contentLength,
    };
  },
});

export const upsertSitemapMetadata = internalMutation({
  args: {
    name: v.string(),
    fileId: v.id("_storage"),
    generatedAt: v.number(),
    hash: v.string(),
    entryCount: v.number(),
    contentLength: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("sitemaps")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .order("desc")
      .take(1);

    if (docs.length === 0) {
      await ctx.db.insert("sitemaps", args);
    } else {
      await ctx.db.replace(docs[0]._id, {
        name: args.name,
        fileId: args.fileId,
        generatedAt: args.generatedAt,
        hash: args.hash,
        entryCount: args.entryCount,
        contentLength: args.contentLength,
      });
    }

    return null;
  },
});
