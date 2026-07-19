import type { PublishedPageRecord } from "./published-pages";

interface LlmsTxtInput {
  storeName: string;
  storeUrl: string;
  storeDescription: string;
  collections: string[]; // e.g. ["Living Room", "Bedroom", "Kids Room", "Nursery"]
  publishedPages: PublishedPageRecord[];
}

// Generates llms.txt content — a plain-language index for AI crawlers,
// analogous to robots.txt but describing what the store actually sells
// and where, rather than what crawlers may/may not access.
export function generateLlmsTxt(input: LlmsTxtInput): string {
  const { storeName, storeUrl, storeDescription, collections, publishedPages } = input;

  const lines: string[] = [];

  lines.push(`# ${storeName}`);
  lines.push("");
  lines.push(storeDescription);
  lines.push("");
  lines.push(`Store URL: ${storeUrl}`);
  lines.push("");
  lines.push("## Collections");
  collections.forEach((c) => lines.push(`- ${c}`));
  lines.push("");
  lines.push("## Product Listing Pages");
  lines.push("");

  for (const page of publishedPages) {
    lines.push(`### ${page.h1}`);
    lines.push(`- URL: ${storeUrl}/${page.locale.toLowerCase()}/${page.slug}`);
    lines.push(`- Locale: ${page.locale}`);
    lines.push(`- Target intent: ${JSON.stringify(page.intent)}`);
    lines.push(`- Product count: ${page.productCount}`);
    lines.push(`- Summary: ${page.metaDescription}`);
    lines.push("");
  }

  return lines.join("\n");
}
