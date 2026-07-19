import { parseIntent } from "../app/lib/intent/parser";
import { matchProducts } from "../app/lib/matching/matcher";
import { MOCK_CATALOG } from "../app/lib/matching/mock-catalog";
import { generatePLPContent } from "../app/lib/generation/generate-plp";
import { buildJsonLd } from "../app/lib/seo/json-ld";
import { buildMetaTags } from "../app/lib/seo/meta-tags";

async function main() {
  const keyword = "sustainable midnight blue wallpaper kids room";
  const locale = "en-US";
  const slug = "sustainable-midnight-blue-wallpaper-kids-room";
  const storeUrl = "https://wildpalace.com";
  const pageUrl = `${storeUrl}/en-us/${slug}`;

  const intent = await parseIntent(keyword);
  const { matchedProducts, meetsThreshold } = matchProducts(intent, MOCK_CATALOG);

  const plp = await generatePLPContent({
    intent,
    products: matchedProducts,
    locale,
  });

  const jsonLd = buildJsonLd({
    plp,
    products: matchedProducts,
    pageUrl,
    storeName: "Wild Palace",
    storeUrl,
    locale,
  });

  const metaTags = buildMetaTags({
    pageUrl,
    locale: "en-us",
    localeVariants: [
      { locale: "en-us", url: pageUrl },
      { locale: "en-au", url: `${storeUrl}/en-au/${slug}` },
    ],
    isPublished: meetsThreshold,
  });

  console.log("\n=== JSON-LD: CollectionPage ===");
  console.log(JSON.stringify(jsonLd.collectionPage, null, 2));

  console.log("\n=== JSON-LD: ItemList ===");
  console.log(JSON.stringify(jsonLd.itemList, null, 2));

  console.log("\n=== JSON-LD: FAQPage ===");
  console.log(JSON.stringify(jsonLd.faqPage, null, 2));

  console.log("\n=== JSON-LD: BreadcrumbList ===");
  console.log(JSON.stringify(jsonLd.breadcrumbList, null, 2));

  console.log("\n=== Meta tags ===");
  console.log(metaTags.canonical);
  console.log(metaTags.hreflangTags);
  console.log(metaTags.robots);
}

main();
