import type { PublishedPageRecord } from "./published-pages";

interface SitemapAiInput {
  storeUrl: string;
  publishedPages: PublishedPageRecord[];
}

// Curated, metadata-rich sitemap specifically for AI crawlers — separate
// from Shopify's built-in sitemap.xml (which handles standard search
// engine discovery automatically and shouldn't be duplicated here).
// Only quality-approved (i.e. actually published, threshold-passing)
// pages appear — draft/below-threshold pages are never included.
export function generateSitemapAi(input: SitemapAiInput): string {
  const { storeUrl, publishedPages } = input;

  const urlEntries = publishedPages
    .map((page) => {
      const url = `${storeUrl}/${page.locale.toLowerCase()}/${page.slug}`;
      return `  <url>
    <loc>${url}</loc>
    <locale>${page.locale}</locale>
    <intent-summary>${escapeXml(page.metaDescription)}</intent-summary>
    <primary-keyword>${escapeXml(page.h1)}</primary-keyword>
    <product-count>${page.productCount}</product-count>
    <last-updated>${page.publishedAt}</last-updated>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://wildpalace.com/sitemap-ai-schema">
${urlEntries}
</urlset>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
