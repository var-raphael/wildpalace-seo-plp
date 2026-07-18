import type { ShopifyProduct } from "../matching/shopify-catalog";

export interface KeywordCandidate {
  keyword: string;
  source: string; // which product/tag combo produced this, for transparency
}

// Generates candidate keywords by combining real catalog data — tags,
// collections, and product attributes — rather than any external API or
// invented list. This directly implements the spec's default "auto-discovery"
// mode: surfacing opportunities from what the merchant already sells.
export function discoverKeywords(catalog: ShopifyProduct[]): KeywordCandidate[] {
  const candidates: KeywordCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(keyword: string, source: string) {
    const normalized = keyword.toLowerCase().trim();
    if (seen.has(normalized) || normalized.length < 3) return;
    seen.add(normalized);
    candidates.push({ keyword: normalized, source });
  }

  // Group tags by collection so we can combine "tag + collection" pairs —
  // this mirrors real search behavior ("botanical wallpaper living room")
  // far better than either signal alone.
  const collectionTags = new Map<string, Set<string>>();

  for (const product of catalog) {
    if (!product.collection) continue;
    if (!collectionTags.has(product.collection)) {
      collectionTags.set(product.collection, new Set());
    }
    const tagSet = collectionTags.get(product.collection)!;
    for (const tag of product.tags) {
      tagSet.add(tag);
    }
  }

  // Combine each tag with its collection (e.g. "botanical" + "living-room"
  // -> "botanical wallpaper living room")
  for (const [collection, tags] of collectionTags.entries()) {
    const roomName = collection.replace(/-/g, " ");
    for (const tag of tags) {
      const tagName = tag.replace(/-/g, " ");
      addCandidate(
        `${tagName} wallpaper ${roomName}`,
        `tag "${tag}" + collection "${collection}"`,
      );
    }
  }

  // Also surface tag-only candidates (broader, room-agnostic queries)
  const allTags = new Set(catalog.flatMap((p) => p.tags));
  for (const tag of allTags) {
    addCandidate(`${tag.replace(/-/g, " ")} wallpaper`, `tag "${tag}"`);
  }

  return candidates;
}
