import pluralize from "pluralize";
import type { ParsedIntent } from "../intent/types";

export interface PublishedPage {
  slug: string;
  intent: ParsedIntent;
  locale: string;
}

const COMPARABLE_FIELDS: (keyof ParsedIntent)[] = [
  "color",
  "material",
  "style",
  "room",
  "use_case",
  "attribute",
];

function normalize(value: string | null): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace(/\b(the|a|for)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => pluralize.singular(word))
    .join(" ");
}

export function calculateSimilarity(a: ParsedIntent, b: ParsedIntent): number {
  let matches = 0;
  let comparableCount = 0;

  for (const field of COMPARABLE_FIELDS) {
    const valA = normalize(a[field]);
    const valB = normalize(b[field]);

    if (valA === null && valB === null) continue;
    comparableCount++;

    if (valA !== null && valA === valB) matches++;
  }

  if (comparableCount === 0) return 0;
  return matches / comparableCount;
}

const SIMILARITY_THRESHOLD = 0.7;

export interface SimilarityCheckResult {
  isDuplicate: boolean;
  mostSimilarPage: PublishedPage | null;
  similarityScore: number;
}

export function checkAgainstExistingPages(
  newIntent: ParsedIntent,
  newLocale: string,
  existingPages: PublishedPage[],
): SimilarityCheckResult {
  let highestScore = 0;
  let mostSimilar: PublishedPage | null = null;

  for (const page of existingPages) {
    if (page.locale !== newLocale) continue;

    const score = calculateSimilarity(newIntent, page.intent);
    if (score > highestScore) {
      highestScore = score;
      mostSimilar = page;
    }
  }

  return {
    isDuplicate: highestScore >= SIMILARITY_THRESHOLD,
    mostSimilarPage: mostSimilar,
    similarityScore: highestScore,
  };
}
