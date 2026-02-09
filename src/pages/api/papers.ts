import type { APIRoute } from "astro";
import { resolveConvexSiteOrigin } from "@/lib/papersApi";

export const prerender = false;

const buildConvexUrl = (requestUrl: URL) => {
  const origin = resolveConvexSiteOrigin();
  if (!origin) {
    throw new Error(
      "Missing Convex site origin. Set PUBLIC_CONVEX_SITE_URL or PUBLIC_CONVEX_URL.",
    );
  }

  const url = new URL("/api/papers", origin);
  for (const [key, value] of requestUrl.searchParams) {
    url.searchParams.append(key, value);
  }
  return url;
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const target = buildConvexUrl(new URL(request.url));
    const response = await fetch(target, {
      headers: {
        Accept: "application/json",
      },
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control":
          response.headers.get("cache-control") ??
          "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach papers API";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const target = buildConvexUrl(new URL(request.url));
    const payload = await request.text();

    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload,
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit paper";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
