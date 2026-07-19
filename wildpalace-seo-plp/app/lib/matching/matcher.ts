import type { ParsedIntent } from "../intent/types";
import type { MockProduct } from "./mock-catalog";

const ROOM_TO_COLLECTION: Record<string, string> = {
  "living room": "living-room",
  bedroom: "bedroom",
  "kids room": "kids-room",
  nursery: "nursery",
};

const UNSAFE_FOR_KIDS_TAGS = ["charcoal", "moody", "dark", "gothic", "black"];

function passesHardExclusions(
  product: MockProduct,
  intent: ParsedIntent,
): boolean {
  const isKidsOrNursery =
    intent.room === "kids room" || intent.room === "nursery";

  if (isKidsOrNursery) {
    const hasUnsafeTag = product.tags.some((tag) =>
      UNSAFE_FOR_KIDS_TAGS.includes(tag.toLowerCase()),
    );
    if (hasUnsafeTag) return false;
  }

  return true;
}

function scoreProduct(product: MockProduct, intent: ParsedIntent): number {
  let score = 0;
  const titleLower = product.title.toLowerCase();
  const tagsLower = product.tags.map((t) => t.toLowerCase());

  const fieldsToCheck = [
    intent.color,
    intent.material,
    intent.style,
    intent.attribute,
  ];

  for (const field of fieldsToCheck) {
    if (!field) continue;
    const normalized = field.toLowerCase().replace(/\s+/g, "-");
    if (
      tagsLower.some(
        (tag) => tag.includes(normalized) || normalized.includes(tag),
      ) ||
      titleLower.includes(field.toLowerCase())
    ) {
      score += 1;
    }
  }

  if (intent.room) {
    const expectedCollection = ROOM_TO_COLLECTION[intent.room];
    if (expectedCollection && product.collection === expectedCollection) {
      score += 1;
    }
  }

  return score;
}

export interface MatchResult {
  matchedProducts: MockProduct[];
  meetsThreshold: boolean;
  threshold: number;
}

const MINIMUM_PRODUCT_THRESHOLD = 6;

export function matchProducts(
  intent: ParsedIntent,
  catalog: MockProduct[],
  threshold: number = MINIMUM_PRODUCT_THRESHOLD,
): MatchResult {
  const safeProducts = catalog.filter((p) => passesHardExclusions(p, intent));

  const scored = safeProducts
    .map((product) => ({ product, score: scoreProduct(product, intent) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const matchedProducts = scored.map((entry) => entry.product);

  return {
    matchedProducts,
    meetsThreshold: matchedProducts.length >= threshold,
    threshold,
  };
}
