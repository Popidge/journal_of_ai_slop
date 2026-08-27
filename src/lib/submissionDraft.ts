export const AVAILABLE_TAGS = [
  "Actually Academic",
  "Pseudo academic",
  "Nonsense",
  "Pure Slop",
  "🤷‍♂️",
] as const;

export const LLM_SIGNIFIERS = [
  "GPT",
  "Claude",
  "Gemini",
  "Grok",
  "LLaMA",
  "Llama",
  "Bard",
  "Kimi",
  "Minimax",
  "Phi",
  "Qwen",
  "GLM",
  "DeepSeek",
  "Mistral",
  "Mixtral",
  "Gemma",
  "Command",
  "Nova",
  "Jamba",
] as const;

export const CONTENT_CHARACTER_LIMIT = 19000;
export const CONTENT_WARNING_THRESHOLD = 18000;
export const RESEARCH_DESK_DRAFT_KEY = "slop_research_desk_draft";

export type SubmissionDraft = {
  title: string;
  authors: string;
  content: string;
  tags: string[];
};

export type ResearchDeskDraft = SubmissionDraft & {
  sourcePaperIds: string[];
  preparedAt: number;
};

export const emptySubmissionDraft = (): SubmissionDraft => ({
  title: "",
  authors: "",
  content: "",
  tags: [],
});

export const isAvailableTag = (
  value: string,
): value is (typeof AVAILABLE_TAGS)[number] =>
  AVAILABLE_TAGS.some((tag) => tag === value);

export const includesLlmAuthor = (authors: string): boolean =>
  LLM_SIGNIFIERS.some((model) =>
    authors.toLowerCase().includes(model.toLowerCase()),
  );

export const readResearchDeskDraft = (): ResearchDeskDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem(RESEARCH_DESK_DRAFT_KEY);
  if (!stored) {
    return null;
  }

  try {
    const value = JSON.parse(stored) as Partial<ResearchDeskDraft>;
    if (
      typeof value.title !== "string" ||
      typeof value.authors !== "string" ||
      typeof value.content !== "string" ||
      !Array.isArray(value.tags) ||
      !value.tags.every(
        (tag) => typeof tag === "string" && isAvailableTag(tag),
      )
    ) {
      return null;
    }

    return {
      title: value.title.slice(0, 300),
      authors: value.authors.slice(0, 500),
      content: value.content.slice(0, CONTENT_CHARACTER_LIMIT),
      tags: value.tags,
      sourcePaperIds: Array.isArray(value.sourcePaperIds)
        ? value.sourcePaperIds.filter(
            (paperId): paperId is string => typeof paperId === "string",
          )
        : [],
      preparedAt:
        typeof value.preparedAt === "number" ? value.preparedAt : Date.now(),
    };
  } catch {
    return null;
  }
};

export const writeResearchDeskDraft = (draft: ResearchDeskDraft): void => {
  window.sessionStorage.setItem(
    RESEARCH_DESK_DRAFT_KEY,
    JSON.stringify(draft),
  );
};

export const clearResearchDeskDraft = (): void => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(RESEARCH_DESK_DRAFT_KEY);
  }
};
