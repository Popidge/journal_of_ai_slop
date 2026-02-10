import type { APIRoute } from "astro";
import { resolveConvexSiteOrigin } from "@/lib/papersApi";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const origin = resolveConvexSiteOrigin();
    if (!origin) {
      throw new Error("Missing Convex site origin. Set CONVEX_SITE_URL.");
    }

    const target = new URL("/api/environmental-impact", origin);
    const response = await fetch(target, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control":
          response.headers.get("cache-control") ??
          "public, max-age=0, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to reach environmental impact API";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
