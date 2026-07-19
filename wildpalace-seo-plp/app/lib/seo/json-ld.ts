// app/lib/seo/json-ld.ts
import type { MockProduct } from "../matching/mock-catalog";
import type { PLPOutput } from "../generation/schema";

interface JsonLdInput {
  plp: PLPOutput;
  products: MockProduct[];
  pageUrl: string; // full canonical URL, e.g. https://wildpalace.com/en-us/botanical-wallpaper-living-room
  storeName: string;
  storeUrl: string;
  locale: string; // e.g. "en-US"
}

export function buildJsonLd(input: JsonLdInput) {
  const { plp, products, pageUrl, storeName, storeUrl, locale } = input;

  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: plp.h1,
    description: plp.meta_description,
    url: pageUrl,
    inLanguage: locale,
  };

  // ItemList — this is what enables product carousels in Google Search,
  // per the spec's explicit note. Each product becomes a ListItem.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: product.title,
        url: `${storeUrl}/products/${product.id}`,
      },
    })),
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: plp.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  // BreadcrumbList — helps search engines understand site hierarchy.
  // Assumes a simple Home > Category > Page structure.
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: storeUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Wallpaper",
        item: `${storeUrl}/collections/wallpaper`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: plp.h1,
        item: pageUrl,
      },
    ],
  };

  return { collectionPage, itemList, faqPage, breadcrumbList };
}
