"use node";
import { createHash } from "node:crypto";
import { Id } from "./_generated/dataModel";

const SLOP_ID_DIGITS = 10;
const HASH_BYTES = 5;

export const deriveSlopId = (paperId: Id<"papers">): string => {
  const hash = createHash("sha256").update(paperId).digest();
  let value = 0n;
  for (let i = 0; i < HASH_BYTES; i++) {
    value = (value << 8n) | BigInt(hash[i]);
  }
  const decimal = value.toString().padStart(SLOP_ID_DIGITS, "0");
  const digits = decimal.length > SLOP_ID_DIGITS ? decimal.slice(0, SLOP_ID_DIGITS) : decimal;
  const year = new Date().getUTCFullYear();
  return `slop:${year}:${digits}`;
};

export const localPaperLink = (paperId: Id<"papers">) => `papers/${paperId}`;
