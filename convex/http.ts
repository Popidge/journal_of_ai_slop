import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

// API Routes

// GET /api/papers - List papers
router.route({
  path: "/api/papers",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const rawCursor = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    // Validate cursor format if provided (should be base64-like string)
    let cursor: string | null = null;
    if (rawCursor !== null && rawCursor.length > 0 && /^[A-Za-z0-9_-]+$/.test(rawCursor)) {
      cursor = rawCursor;
    }

    // Validate limit
    const validatedLimit = Math.min(Math.max(limit, 1), 50);

    const paginationOpts = {
      numItems: validatedLimit,
      cursor,
    };

    const page = await ctx.runQuery(api.papers.listPublicPapersPage, {
      paginationOpts,
      status: "accepted",
    });

    // Filter out blocked papers and format response
    const papers = page.papers
      .filter((paper) => !paper.moderation?.blocked)
      .map((paper) => ({
        _id: paper._id,
        _creationTime: paper._creationTime,
        title: paper.title,
        authors: paper.authors,
        content: paper.content,
        tags: paper.tags,
        submittedAt: paper.submittedAt,
        status: paper.status,
        reviewVotes: paper.reviewVotes,
        totalReviewCost: paper.totalReviewCost,
        totalTokens: paper.totalTokens,
      }));

    return new Response(JSON.stringify({ papers, cursor: page.cursor }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/papers - Submit paper
router.route({
  path: "/api/papers",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Validation constants (matching SubmitPaper.tsx)
    const CONTENT_CHARACTER_LIMIT = 9500;
    const LLM_SIGNIFIERS = ["GPT", "Claude", "Gemini", "Grok", "LLaMA", "Bard", "Kimi", "Minimax", "Phi", "Qwen"];
    const AVAILABLE_TAGS = ["Actually Academic", "Pseudo academic", "Nonsense", "Pure Slop", "🤷‍♂️"];

    let body: {
      title?: string;
      authors?: string;
      content?: string;
      tags?: string[];
      notificationEmail?: string;
      confirmTerms?: boolean;
    };

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const errors: string[] = [];

    // Validate title
    if (!body.title?.trim()) {
      errors.push("Title is required");
    }

    // Validate authors (must include at least one AI model)
    if (!body.authors?.trim()) {
      errors.push("Authors are required");
    } else {
      const includesLLM = LLM_SIGNIFIERS.some((model) =>
        body.authors!.toLowerCase().includes(model.toLowerCase()),
      );
      if (!includesLLM) {
        errors.push("Authors must mention at least one AI model such as GPT-4, Claude, or Gemini");
      }
    }

    // Validate content
    if (!body.content?.trim()) {
      errors.push("Content is required");
    } else if (body.content.length > CONTENT_CHARACTER_LIMIT) {
      errors.push(`Content must be ${CONTENT_CHARACTER_LIMIT.toLocaleString()} characters or fewer`);
    }

    // Validate tags
    if (!body.tags || body.tags.length === 0) {
      errors.push("At least one tag is required");
    } else if (!Array.isArray(body.tags)) {
      errors.push("Tags must be an array");
    } else {
      const invalidTags = body.tags.filter((tag) => !AVAILABLE_TAGS.includes(tag));
      if (invalidTags.length > 0) {
        errors.push(`Invalid tags: ${invalidTags.join(", ")}`);
      }
    }

    // Validate email if provided
    const normalizedEmail = body.notificationEmail?.trim();
    if (normalizedEmail) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailRegex.test(normalizedEmail)) {
        errors.push("Notification email must be a valid email address");
      }
    }

    // Validate terms confirmation
    if (body.confirmTerms !== true) {
      errors.push("You must confirm the terms and conditions");
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      // Submit the paper using the existing mutation
      const paperId = await ctx.runMutation(api.papers.submitPaper, {
        title: body.title!.trim(),
        authors: body.authors!.trim(),
        content: body.content!.trim(),
        tags: body.tags!,
        notificationEmail: normalizedEmail || undefined,
      });

      return new Response(
        JSON.stringify({ paperId, message: "Paper submitted successfully" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({ error: "Failed to submit paper", details: [message] }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

// GET /api/papers/:id - Get single paper using pathPrefix
router.route({
  pathPrefix: "/api/papers/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    // Extract id from the URL path parameter using pathPrefix
    // The request URL will be something like /api/papers/j579p9n8pb1rk02crpg01122t97xcd25
    const url = new URL(req.url);
    const pathname = url.pathname;
    const prefix = "/api/papers/";

    let id: string | null = null;
    if (pathname.startsWith(prefix)) {
      id = pathname.slice(prefix.length);
    }

    // Validate ID format (Convex IDs are typically 20+ chars alphanumeric)
    if (!id || typeof id !== "string" || id.length < 20 || !/^[a-zA-Z0-9_]+$/.test(id)) {
      return new Response(
        JSON.stringify({ error: "Paper ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const paper = await ctx.runQuery(internal.papers.internalGetPaper, {
      id: id as Id<"papers">,
    });

    if (!paper) {
      return new Response(
        JSON.stringify({ error: "Paper not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        _id: paper._id,
        _creationTime: paper._creationTime,
        title: paper.title,
        authors: paper.authors,
        content: paper.content,
        tags: paper.tags,
        submittedAt: paper.submittedAt,
        status: paper.status,
        reviewVotes: paper.reviewVotes,
        totalReviewCost: paper.totalReviewCost,
        totalTokens: paper.totalTokens,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
});

export default router;
