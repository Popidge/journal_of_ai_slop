type Person = {
  "@type": "Person";
  name: string;
};

const LAST_FIRST_PATTERN = /^[^,]+,\s*[^,]+$/;

const normalizeAuthorsArray = (authors: unknown[]): string[] => {
  return authors
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
};

const splitAuthorString = (value: string): string[] => {
  const chunks = value
    .split(/\s*;\s*|\s+and\s+|\s*&\s*/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const normalized: string[] = [];
  for (const chunk of chunks) {
    if (LAST_FIRST_PATTERN.test(chunk)) {
      normalized.push(chunk);
      continue;
    }

    const commaSplit = chunk
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (commaSplit.length === 0) {
      continue;
    }

    normalized.push(...commaSplit);
  }

  return normalized;
};

export const normalizeAuthorNames = (authors: unknown): string[] => {
  if (Array.isArray(authors)) {
    return normalizeAuthorsArray(authors);
  }

  if (typeof authors !== "string") {
    return [];
  }

  const trimmed = authors.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeAuthorsArray(parsed);
    }
  } catch {
    // Non-JSON string author field.
  }

  return splitAuthorString(trimmed);
};

export const toPersonSchemaAuthors = (authors: unknown): Person[] => {
  return normalizeAuthorNames(authors).map((name) => ({
    "@type": "Person",
    name,
  }));
};
