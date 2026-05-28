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

export type CarbonOffsetType = "carbon_removal" | "renewable_energy" | "other";

export type CarbonOffset = {
  _id: string;
  _creationTime: number;
  organization: string;
  offsetType: CarbonOffsetType;
  amountGbp: number;
  purchasedAt: number;
  receiptUrl?: string;
  receiptLabel?: string;
  notes?: string;
  co2KgClaimed?: number;
  energyKWhClaimed?: number;
  createdAt: number;
};

export type CarbonLedgerSnapshot = {
  _id: string;
  _creationTime: number;
  label: string;
  calculatedAt: number;
  lastIncludedReviewedAt?: number;
  paperCount: number;
  totalTokens: number;
  energyPerTokenWh: number;
  co2PerWh: number;
  totalEnergyWh: number;
  totalEnergyKWh: number;
  totalCo2g: number;
  totalCo2kg: number;
  stripeClimateDueGbp: number;
  solarAidDueGbp: number;
};

export type CarbonLedger = {
  snapshot: CarbonLedgerSnapshot | null;
  offsets: CarbonOffset[];
  totalOffsetGbp: number;
  totalCarbonRemovalGbp: number;
  totalRenewableEnergyGbp: number;
  totalCo2KgClaimed: number;
  totalEnergyKWhClaimed: number;
  remainingStripeClimateGbp: number;
  remainingSolarAidGbp: number;
  remainingTotalGbp: number;
};

const parseStatus = (status: string | null | undefined): PublicPaperStatus =>
  status === "rejected" ? "rejected" : "accepted";

export const resolvePublicStatus = (value: string | null | undefined) =>
  parseStatus(value);

export const resolveConvexSiteOrigin = (): string | null => {
  const viteEnv =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)
      : undefined;
  const runtimeEnv = typeof process !== "undefined" ? process.env : undefined;
  const convexSiteUrl =
    viteEnv?.PUBLIC_CONVEX_SITE_URL ??
    runtimeEnv?.PUBLIC_CONVEX_SITE_URL ??
    viteEnv?.CONVEX_SITE_URL ??
    runtimeEnv?.CONVEX_SITE_URL;

  if (!convexSiteUrl) {
    const convexUrl =
      viteEnv?.PUBLIC_CONVEX_URL ?? runtimeEnv?.PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return null;
    }

    try {
      const url = new URL(convexUrl);
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
      return url.origin;
    } catch {
      return null;
    }
  }

  try {
    return new URL(convexSiteUrl).origin;
  } catch {
    return null;
  }
};

const buildApiOrigins = (origin: string): string[] => {
  const convexSiteOrigin = resolveConvexSiteOrigin();
  if (convexSiteOrigin) {
    return convexSiteOrigin === origin
      ? [origin]
      : [convexSiteOrigin, origin];
  }

  return [origin];
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

export const fetchCarbonLedger = async (params: {
  origin: string;
}): Promise<CarbonLedger> => {
  const origins = buildApiOrigins(params.origin);
  const errors: string[] = [];

  for (const origin of origins) {
    const url = new URL("/api/carbon-ledger", origin);

    try {
      return await fetchJson<CarbonLedger>(url);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Unknown carbon ledger API error",
      );
    }
  }

  throw new Error(
    `Unable to load carbon ledger. Tried: ${errors.join(" | ")}`,
  );
};
