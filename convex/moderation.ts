"use node";
import ContentSafetyClient, { AnalyzeTextParameters, TextCategoriesAnalysisOutput, isUnexpected } from "@azure-rest/ai-content-safety";
import { AzureKeyCredential } from "@azure/core-auth";
import {
  isPipelineSmokeTestMode,
  logPipelineSmokeTest,
} from "./pipelineSmokeTest";

const CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT = 9500;
const CATEGORY_SEVERITY_THRESHOLD = 4;
const OVERALL_SEVERITY_THRESHOLD = 6;
const MODERATION_CATEGORIES = ["Hate", "SelfHarm", "Sexual", "Violence"] as const;

export type ModerationCategory = {
  category: string;
  severity: number;
};

export type ModerationVerdict = {
  blocked: boolean;
  overallSeverity: number;
  categories: ModerationCategory[];
  requestId?: string;
  reason: string;
};

export type PaperForModeration = {
  title: string;
  authors: string;
  tags: string[];
  content: string;
};

type ContentSafetyClientType = ReturnType<typeof ContentSafetyClient>;

let cachedContentSafetyClient: ContentSafetyClientType | null = null;

const isContentSafetyTestMode = (): boolean => {
  const flag = process.env.CONTENT_SAFETY_TEST;
  if (!flag) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(flag.toLowerCase());
};

const getContentSafetyClient = (): ContentSafetyClientType => {
  if (cachedContentSafetyClient) {
    return cachedContentSafetyClient;
  }

  const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
  const key = process.env.CONTENT_SAFETY_KEY;
  if (!endpoint || !key) {
    throw new Error("CONTENT_SAFETY_ENDPOINT and CONTENT_SAFETY_KEY must be set to run the moderation pipeline");
  }

  cachedContentSafetyClient = ContentSafetyClient(endpoint, new AzureKeyCredential(key));
  return cachedContentSafetyClient;
};

const buildModerationText = (paper: PaperForModeration): string => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tags)";

  return [
    `Title: ${paper.title}`,
    `Authors: ${paper.authors}`,
    `Tags: ${tags}`,
    "",
    paper.content,
  ].join("\n");
};

const findChunkEnd = (content: string, start: number, maxLength: number): number => {
  const hardEnd = Math.min(content.length, start + maxLength);
  if (hardEnd >= content.length) {
    return content.length;
  }

  const window = content.slice(start, hardEnd);
  const boundaryPatterns = [
    /\n{2,}/g,
    /[.!?]["')\]]?\s+/g,
    /\n/g,
    /\s+/g,
  ];

  for (const pattern of boundaryPatterns) {
    let latestEnd = -1;
    let match = pattern.exec(window);
    while (match !== null) {
      latestEnd = match.index + match[0].length;
      match = pattern.exec(window);
    }
    if (latestEnd > 0) {
      return start + latestEnd;
    }
  }

  return hardEnd;
};

const splitModerationContent = (content: string, maxChunkLength: number): string[] => {
  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = findChunkEnd(content, start, maxChunkLength);
    const chunk = content.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end;

    while (start < content.length && /\s/.test(content[start])) {
      start += 1;
    }
  }

  return chunks.length > 0 ? chunks : [content];
};

const buildModerationPayloads = (paper: PaperForModeration): string[] => {
  const tags = paper.tags.length ? paper.tags.join(", ") : "(no tags)";
  const metadata = [
    `Title: ${paper.title}`,
    `Authors: ${paper.authors}`,
    `Tags: ${tags}`,
  ].join("\n");
  const metadataPrefix = `${metadata}\n\n`;

  if (metadataPrefix.length >= CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
    throw new Error("Paper metadata exceeds Azure Content Safety payload limit");
  }

  const text = buildModerationText(paper);
  if (text.length <= CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
    return [text];
  }

  const chunkPrefixSample = `${metadata}\nChunk 999 of 999\n\n`;
  const maxContentChunkLength =
    CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT - chunkPrefixSample.length;
  if (maxContentChunkLength <= 0) {
    throw new Error("Paper metadata leaves no room for moderation content");
  }

  const chunks = splitModerationContent(paper.content, maxContentChunkLength);
  const totalChunks = chunks.length;

  return chunks.map((chunk, index) => {
    const prefix = `${metadata}\nChunk ${index + 1} of ${totalChunks}\n\n`;
    const payload = `${prefix}${chunk}`;
    if (payload.length > CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
      throw new Error(`Moderation chunk ${index + 1} exceeds payload limit`);
    }
    return payload;
  });
};

const mergeModerationCategories = (chunks: ModerationCategory[][]): ModerationCategory[] => {
  const severityByCategory = new Map<string, number>();
  for (const categories of chunks) {
    for (const entry of categories) {
      severityByCategory.set(
        entry.category,
        Math.max(severityByCategory.get(entry.category) ?? 0, entry.severity),
      );
    }
  }

  return [...severityByCategory.entries()].map(([category, severity]) => ({
    category,
    severity,
  }));
};

export const analyzeWithContentSafety = async (paper: PaperForModeration): Promise<ModerationVerdict> => {
  if (isPipelineSmokeTestMode()) {
    logPipelineSmokeTest("Azure Content Safety mocked", {
      title: paper.title,
    });
    return {
      blocked: false,
      overallSeverity: 0,
      categories: MODERATION_CATEGORIES.map((category) => ({
        category,
        severity: 0,
      })),
      requestId: "pipeline-smoke-test",
      reason: "pipeline_smoke_test_safe",
    };
  }

  if (isContentSafetyTestMode()) {
    const categories: ModerationCategory[] = [
      { category: "Hate", severity: CATEGORY_SEVERITY_THRESHOLD + 1 },
      { category: "Violence", severity: 2 },
    ];
    const overallSeverity = categories.reduce((sum, entry) => sum + entry.severity, 0);
    return {
      blocked: true,
      overallSeverity,
      categories,
      requestId: "content-safety-test-mode",
      reason: "test_mode_forced_block",
    };
  }

  try {
    const client = getContentSafetyClient();
    const payloads = buildModerationPayloads(paper);
    const chunkResults: Array<{
      categories: ModerationCategory[];
      overallSeverity: number;
      requestId?: string;
    }> = [];

    for (const [index, text] of payloads.entries()) {
      if (text.length > CONTENT_SAFETY_PAYLOAD_CHARACTER_LIMIT) {
        throw new Error(`Moderation chunk ${index + 1} exceeds payload limit`);
      }

      const parameters: AnalyzeTextParameters = {
        body: {
          text,
          categories: [...MODERATION_CATEGORIES],
        },
      };

      const response = await client.path("/text:analyze").post(parameters);
      if (isUnexpected(response)) {
        const message = (response.body as { error?: { message?: string } })?.error?.message ?? "Azure Content Safety returned an unexpected response";
        throw new Error(message);
      }

      const categoriesAnalysis: TextCategoriesAnalysisOutput[] = Array.isArray(response.body.categoriesAnalysis)
        ? response.body.categoriesAnalysis
        : [];

      const categories = categoriesAnalysis.map((analysis) => {
        const category = typeof analysis.category === "string" ? analysis.category : "Unknown";
        const severityValue = typeof analysis.severity === "number" ? analysis.severity : 0;
        return {
          category,
          severity: severityValue,
        };
      });

      chunkResults.push({
        categories,
        overallSeverity: categories.reduce((sum, entry) => sum + entry.severity, 0),
        requestId: (response.body as { id?: string }).id ?? undefined,
      });
    }

    const categories = mergeModerationCategories(
      chunkResults.map((result) => result.categories),
    );
    const overallSeverity = Math.max(
      0,
      ...chunkResults.map((result) => result.overallSeverity),
    );
    const blockedByCategory = chunkResults.some((result) =>
      result.categories.some((entry) => entry.severity >= CATEGORY_SEVERITY_THRESHOLD),
    );
    const blockedByOverall = chunkResults.some(
      (result) => result.overallSeverity >= OVERALL_SEVERITY_THRESHOLD,
    );
    const blocked = blockedByCategory || blockedByOverall;

    let reason = "below_thresholds";
    if (blocked) {
      if (blockedByCategory && blockedByOverall) {
        reason = "overall_and_category_threshold_exceeded";
      } else if (blockedByCategory) {
        reason = "category_threshold_exceeded";
      } else {
        reason = "overall_threshold_exceeded";
      }
    }

    const requestIds = chunkResults
      .map((result) => result.requestId)
      .filter((requestId): requestId is string => Boolean(requestId));

    return {
      blocked,
      overallSeverity,
      categories,
      requestId: requestIds.length ? requestIds.join(",") : undefined,
      reason,
    };
  } catch (error) {
    console.error("Azure Content Safety moderation failed", error);
    return {
      blocked: true,
      overallSeverity: 0,
      categories: [],
      reason: `moderation_failed:${error instanceof Error ? error.message : "unknown_error"}`,
    };
  }
};
