import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SITEMAP_METADATA_NAME } from "./sitemap";

const router = httpRouter();

router.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx, _req) => {
    const metadata = await ctx.runQuery(internal.sitemap.getSitemapMetadataByName, {
      name: SITEMAP_METADATA_NAME,
    });

    if (!metadata) {
      return new Response("Sitemap not found", { status: 404 });
    }

    const storage = ctx.storage as unknown as {
      get: (fileId: string) => Promise<ArrayBuffer | null>;
    };
    const fileData = await storage.get(metadata.fileId);
    if (!fileData) {
      return new Response("Sitemap asset missing", { status: 404 });
    }

    return new Response(fileData, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  }),
});

export default router;
