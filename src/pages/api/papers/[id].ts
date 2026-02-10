import type { APIRoute } from "astro";
import { resolveConvexSiteOrigin } from "@/lib/papersApi";

export const prerender = false;

const buildConvexUrl = (id: string) => {
  const origin = resolveConvexSiteOrigin();
  if (!origin) {
    throw new Error("Missing Convex site origin. Set CONVEX_SITE_URL.");
  }

  return new URL(`/api/papers/${id}`, origin);
};

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: "Paper ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const target = buildConvexUrl(id);
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
      error instanceof Error ? error.message : "Failed to reach paper API";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
