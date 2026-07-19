// Dumps a saved PublishedPage (draft or published) as a clean JSON file
// under examples/, for the assignment's required example-output deliverable.
//
// Usage:
//   npx tsx dev-scripts/export-example.ts <slug> <locale> <output-filename>
//
// Example:
//   npx tsx dev-scripts/export-example.ts botanical-wallpaper-living-room en-US style-room-botanical-living-room.json

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const [slug, locale, outputFilename] = process.argv.slice(2);

  if (!slug || !locale || !outputFilename) {
    console.error(
      "Usage: npx tsx dev-scripts/export-example.ts <slug> <locale> <output-filename>",
    );
    process.exit(1);
  }

  const page = await prisma.publishedPage.findFirst({
    where: { slug, locale },
  });

  if (!page) {
    console.error(`No page found for slug="${slug}" locale="${locale}"`);
    process.exit(1);
  }

  const output = {
    slug: page.slug,
    locale: page.locale,
    status: page.status,
    h1: page.h1,
    intro: page.intro,
    sections: JSON.parse(page.sectionsJson || "[]"),
    faq: JSON.parse(page.faqJson || "[]"),
    meta_title: page.metaTitle,
    meta_description: page.metaDescription,
    schema_markup: JSON.parse(page.schemaMarkupJson || "{}"),
    intent: JSON.parse(page.intentJson || "{}"),
    product_count: page.productCount,
    related_links: JSON.parse(page.relatedLinksJson || "[]"),
    alt_texts: JSON.parse(page.altTextsJson || "{}"),
  };

  const outPath = join("example-output", outputFilename);
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
