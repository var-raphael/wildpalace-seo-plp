import { parseIntent } from "../app/lib/intent/parser";
import { matchProducts } from "../app/lib/matching/matcher";
import { MOCK_CATALOG } from "../app/lib/matching/mock-catalog";
import { generatePLPContent } from "../app/lib/generation/generate-plp";
import {
  recordPublishedPage,
  getAllPublishedPages,
} from "../app/lib/ai-presence/published-pages";
import { generateLlmsTxt } from "../app/lib/ai-presence/llms-txt";
import { generateSitemapAi } from "../app/lib/ai-presence/sitemap-ai";

const STORE_URL = "https://wildpalace.com";
const STORE_NAME = "Wild Palace";
const STORE_DESCRIPTION =
  "Wild Palace is a premium wallpaper brand offering sustainable, design-forward wallpaper for every room — from botanical grasscloth to peel-and-stick options for renters.";
const COLLECTIONS = ["Living Room", "Bedroom", "Kids Room", "Nursery"];

const pagesToGenerate = [
  {
    keyword: "sustainable midnight blue wallpaper kids room",
    locale: "en-US",
    slug: "sustainable-midnight-blue-wallpaper-kids-room",
  },
  {
    keyword: "botanical wallpaper living room",
    locale: "de-DE",
    slug: "botanische-tapete-wohnzimmer",
  },
];

async function main() {
  for (const { keyword, locale, slug } of pagesToGenerate) {
    const intent = await parseIntent(keyword);
    const { matchedProducts } = matchProducts(intent, MOCK_CATALOG);

    const plp = await generatePLPContent({
      intent,
      products: matchedProducts,
      locale,
    });

    recordPublishedPage({
      slug,
      locale,
      intent,
      h1: plp.h1,
      metaDescription: plp.meta_description,
      productCount: matchedProducts.length,
      publishedAt: new Date().toISOString(),
    });

    console.log(`Published: ${plp.h1} (${locale})`);
  }

  const publishedPages = getAllPublishedPages();

  console.log("\n\n=== llms.txt ===\n");
  const llmsTxt = generateLlmsTxt({
    storeName: STORE_NAME,
    storeUrl: STORE_URL,
    storeDescription: STORE_DESCRIPTION,
    collections: COLLECTIONS,
    publishedPages,
  });
  console.log(llmsTxt);

  console.log("\n\n=== sitemap-ai.xml ===\n");
  const sitemapAi = generateSitemapAi({
    storeUrl: STORE_URL,
    publishedPages,
  });
  console.log(sitemapAi);
}

main();
