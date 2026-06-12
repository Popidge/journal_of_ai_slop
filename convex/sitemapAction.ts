"use node";
import { internalAction } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { createHash } from "node:crypto";
import { internal } from "./_generated/api";
import { SITEMAP_METADATA_NAME } from "./sitemap";

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
const SITEMAP_META_NAMESPACE = "http://www.google.com/schemas/sitemap-meta/0.9";
const SITEMAP_NEWS_NAMESPACE = "http://www.google.com/schemas/sitemap-news/0.9";
const escapeXmlValue = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const absolutePath = (path: string) => (path === "" ? SITE_URL : `${SITE_URL}/${path}`);

export const regenerateSitemap = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const papers = await ctx.runQuery(internal.sitemap.listAcceptedPapersForSitemap, {});

    const buildMetadata = (paper: (typeof papers)[number]) => {
      const tokens = typeof paper.totalTokens === "number" ? paper.totalTokens : 0;
      const keywords = paper.tags.join(", ");
      const publishedDate = new Date(paper.submittedAt).toISOString().split("T")[0];

      const newsMetadata = [
        "    <news:news>",
        "      <news:publication>",
        "        <news:name>The Journal of AI Slop™</news:name>",
        "        <news:language>en</news:language>",
        "      </news:publication>",
        `      <news:publication_date>${escapeXmlValue(publishedDate)}</news:publication_date>`,
        `      <news:title>${escapeXmlValue(paper.title)}</news:title>`,
        `      <news:keywords>${escapeXmlValue(keywords)}</news:keywords>`,
        "    </news:news>",
      ];

      const metadata: string[] = [
        ...newsMetadata,
        `    <meta:keywords>${escapeXmlValue(keywords)}</meta:keywords>`,
        `    <meta:tags>${escapeXmlValue(keywords)}</meta:tags>`,
        `    <meta:review-count>${paper.reviewCount}</meta:review-count>`,
        `    <meta:impact>${tokens}</meta:impact>`,
        `    <meta:token-count>${tokens}</meta:token-count>`,
        `    <meta:published-date>${escapeXmlValue(publishedDate)}</meta:published-date>`,
      ];

      if (paper.slopIdentifier?.slopId) {
        metadata.push(`    <meta:identifier>${escapeXmlValue(paper.slopIdentifier.slopId)}</meta:identifier>`);
      }

      if (paper.slopIdentifier?.link && !paper.slopIdentifier.fromLocalJournal) {
        metadata.push(`    <meta:canonical>${escapeXmlValue(paper.slopIdentifier.link)}</meta:canonical>`);
      }

      return metadata;
    };

    type SitemapEntry = {
      loc: string;
      lastmod?: string;
      metadata?: string[];
    };

    const urls: SitemapEntry[] = [
      ...SITEMAP_STATIC_PATHS.map((path) => ({ loc: absolutePath(path) })),
      ...papers.map((paper: (typeof papers)[number]) => {
        const lastmod = Number.isFinite(paper.lastmod)
          ? new Date(paper.lastmod).toISOString()
          : undefined;
        return {
          loc: `${SITE_URL}/papers/${paper.paperId}`,
          lastmod,
          metadata: buildMetadata(paper),
        };
      }),
    ];

    const entriesXml = urls
      .map((entry) => {
        const fragments = [
          "  <url>",
          `    <loc>${escapeXmlValue(entry.loc)}</loc>`,
          "    <changefreq>never</changefreq>",
          "    <priority>0.8</priority>",
        ];
        if (entry.lastmod) {
          fragments.push(`    <lastmod>${escapeXmlValue(entry.lastmod)}</lastmod>`);
        }
        if (entry.metadata) {
          fragments.push(...entry.metadata);
        }
        fragments.push("  </url>");
        return fragments.join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<urlset xmlns="${SITEMAP_XML_NAMESPACE}" xmlns:meta="${SITEMAP_META_NAMESPACE}" xmlns:news="${SITEMAP_NEWS_NAMESPACE}">`,
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
