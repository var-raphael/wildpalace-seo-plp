import { calculateSimilarity } from "../dedup/similarity";
import type { ParsedIntent } from "../intent/types";

export interface LinkCandidate {
  slug: string;
  locale: string;
  h1: string;
  intent: ParsedIntent;
}

export interface InternalLink {
  slug: string;
  h1: string;
  reason: string;
}

const MIN_RELATION_THRESHOLD = 0.25;
const MAX_RELATION_THRESHOLD = 0.7;
const MAX_LINKS_PER_PAGE = 4;

function describeRelation(a: ParsedIntent, b: ParsedIntent): string {
  const shared: string[] = [];
  if (a.style && a.style === b.style) shared.push(`${a.style} style`);
  if (a.room && a.room === b.room) shared.push(`${a.room}`);
  if (a.material && a.material === b.material) shared.push(`${a.material}`);
  if (a.color && a.color === b.color) shared.push(`${a.color}`);
  if (a.attribute && a.attribute === b.attribute) shared.push(a.attribute);

  return shared.length > 0 ? `Shares: ${shared.join(", ")}` : "Related intent";
}

export function findRelatedPages(
  currentIntent: ParsedIntent,
  currentSlug: string,
  candidates: LinkCandidate[],
): InternalLink[] {
  const scored = candidates
    .filter((c) => c.slug !== currentSlug)
    .map((candidate) => ({
      candidate,
      score: calculateSimilarity(currentIntent, candidate.intent),
    }))
    .filter(
      (entry) =>
        entry.score >= MIN_RELATION_THRESHOLD &&
        entry.score < MAX_RELATION_THRESHOLD,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LINKS_PER_PAGE);

  return scored.map(({ candidate }) => ({
    slug: candidate.slug,
    h1: candidate.h1,
    reason: describeRelation(currentIntent, candidate.intent),
  }));
}
