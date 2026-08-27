export type SubmitPaperInput = {
  title: string;
  authors: string;
  content: string;
  tags: string[];
  notificationEmail?: string;
  confirmTerms: true;
};

export type SubmitPaperResponse = {
  paperId: string;
  message: string;
};

type SubmitPaperError = {
  error?: string;
  details?: string[];
};

export const submitPaper = async (
  input: SubmitPaperInput,
  options: { signal?: AbortSignal } = {},
): Promise<SubmitPaperResponse> => {
  const endpoint = "/api/papers";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Unexpected response (${response.status}) from ${endpoint}: ${text.slice(0, 120)}`,
    );
  }

  const body = (await response.json()) as
    | SubmitPaperResponse
    | SubmitPaperError;

  if (!response.ok) {
    const detail =
      "details" in body && body.details && body.details.length > 0
        ? body.details[0]
        : null;
    const message =
      detail ??
      ("error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to submit paper");
    throw new Error(message);
  }

  return body as SubmitPaperResponse;
};
