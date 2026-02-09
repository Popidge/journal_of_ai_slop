export type PublicPaperStatus = "accepted" | "rejected";

export type ReviewVote = {
  agentId: string;
  decision: "publish_now" | "publish_after_edits" | "reject";
  reasoning: string;
  cost: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
};

export type SlopIdentifier = {
  slopId: string;
  link: string;
  fromLocalJournal: boolean;
};

export type EditorComment = {
  comment: string;
  createdAt: number;
};

export type PublicPaper = {
  _id: string;
  _creationTime: number;
  title: string;
  authors: string;
  content: string;
  tags: string[];
  submittedAt: number;
  status: PublicPaperStatus;
  reviewVotes?: ReviewVote[];
  totalReviewCost?: number;
  totalTokens?: number;
  slopIdentifier?: SlopIdentifier | null;
  editorComment?: EditorComment | null;
};

type PapersPageResponse = {
  papers: PublicPaper[];
  cursor: string | null;
};

export type EnvironmentalImpact = {
  energyPerTokenWh: number;
  co2PerWh: number;
};

const parseStatus = (status: string | null | undefined): PublicPaperStatus =>
  status === "rejected" ? "rejected" : "accepted";

export const resolvePublicStatus = (value: string | null | undefined) =>
  parseStatus(value);

export const resolveConvexSiteOrigin = (): string | null => {
  const explicitConvexSiteUrl = import.meta.env.PUBLIC_CONVEX_SITE_URL as
    | string
    | undefined;
  if (explicitConvexSiteUrl) {
    try {
      return new URL(explicitConvexSiteUrl).origin;
    } catch {
      return null;
    }
  }

  const convexUrl =
    (import.meta.env.PUBLIC_CONVEX_URL as string | undefined) ??
    (import.meta.env.VITE_CONVEX_URL as string | undefined);
  if (!convexUrl) {
    return null;
  }

  try {
    const url = new URL(convexUrl);
    if (url.hostname.endsWith(".convex.cloud")) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
      return url.origin;
    }
    return url.origin;
  } catch {
    return null;
  }
};

const buildApiOrigins = (origin: string): string[] => {
  const base = new URL(origin);
  const isLocalDevHost =
    base.hostname === "localhost" ||
    base.hostname === "127.0.0.1" ||
    base.hostname === "0.0.0.0";

  const origins: string[] = isLocalDevHost ? [] : [origin];
  const convexSiteOrigin = resolveConvexSiteOrigin();
  if (convexSiteOrigin && convexSiteOrigin !== origin) {
    origins.push(convexSiteOrigin);
  }
  if (isLocalDevHost) {
    origins.push(origin);
  }
  return origins;
};

const fetchJson = async <T>(url: URL): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}) for ${url.toString()}`,
    );
  }

  return (await response.json()) as T;
};

export const fetchPapersPage = async (params: {
  origin: string;
  status?: string | null;
  cursor?: string | null;
  limit?: number;
  query?: string | null;
}): Promise<PapersPageResponse> => {
  const status = parseStatus(params.status);
  const limit = params.limit ?? 12;
  const validatedLimit = Math.min(Math.max(limit, 1), 50);
  const normalizedQuery = (params.query ?? "").trim().toLowerCase();

  if (normalizedQuery.length > 0) {
    const pageOffset = Math.max(
      0,
      Number.parseInt(params.cursor ?? "0", 10) || 0,
    );
    const scanPageSize = 50;
    const maxScannedPapers = 2000;
    const aggregated: PublicPaper[] = [];

    let upstreamCursor: string | null = null;
    while (aggregated.length < maxScannedPapers) {
      const nextBatch = await fetchPapersPage({
        origin: params.origin,
        status,
        cursor: upstreamCursor,
        limit: scanPageSize,
      });
      if (nextBatch.papers.length === 0) {
        break;
      }
      aggregated.push(...nextBatch.papers);
      upstreamCursor = nextBatch.cursor;
      if (!upstreamCursor) {
        break;
      }
    }

    const filtered = aggregated.filter((paper) => {
      const haystack = [
        paper.title,
        paper.authors,
        paper.tags.join(" "),
        paper.content,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const sliced = filtered.slice(pageOffset, pageOffset + validatedLimit);
    const nextOffset = pageOffset + validatedLimit;

    return {
      papers: sliced,
      cursor: nextOffset < filtered.length ? `${nextOffset}` : null,
    };
  }

  const origins = buildApiOrigins(params.origin);
  const errors: string[] = [];

  for (const origin of origins) {
    const url = new URL("/api/papers", origin);
    url.searchParams.set("status", status);
    url.searchParams.set("limit", `${validatedLimit}`);

    if (params.cursor && params.cursor.length > 0) {
      url.searchParams.set("cursor", params.cursor);
    }

    try {
      return await fetchJson<PapersPageResponse>(url);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Unknown papers API error",
      );
    }
  }

  throw new Error(`Unable to load papers page. Tried: ${errors.join(" | ")}`);
};

export const fetchPaperById = async (params: {
  origin: string;
  id: string;
}): Promise<PublicPaper | null> => {
  if (typeof params.id !== "string") {
    return null;
  }

  const normalizedId = params.id.trim();
  if (normalizedId.length < 20 || !/^[a-zA-Z0-9_]+$/.test(normalizedId)) {
    return null;
  }

  const origins = buildApiOrigins(params.origin);
  const errors: string[] = [];

  for (const origin of origins) {
    const url = new URL(`/api/papers/${normalizedId}`, origin);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      continue;
    }

    if (!response.ok) {
      errors.push(`Request failed (${response.status}) for ${url.toString()}`);
      continue;
    }

    return (await response.json()) as PublicPaper;
  }

  if (errors.length > 0) {
    throw new Error(
      `Unable to load paper ${normalizedId}. Tried: ${errors.join(" | ")}`,
    );
  }

  return null;
};

export const fetchEnvironmentalImpact = async (params: {
  origin: string;
}): Promise<EnvironmentalImpact> => {
  const origins = buildApiOrigins(params.origin);
  const errors: string[] = [];

  for (const origin of origins) {
    const url = new URL("/api/environmental-impact", origin);

    try {
      return await fetchJson<EnvironmentalImpact>(url);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Unknown environmental impact API error",
      );
    }
  }

  throw new Error(
    `Unable to load environmental impact values. Tried: ${errors.join(" | ")}`,
  );
};
