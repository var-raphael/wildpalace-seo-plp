// app/lib/generation/test-generate.ts
import { parseIntent } from "../intent/parser";
import { matchProducts } from "../matching/matcher";
import { MOCK_CATALOG } from "../matching/mock-catalog";
import { generatePLPContent } from "./generate-plp";

async function main() {
  const keyword = "sustainable midnight blue wallpaper kids room";

  const intent = await parseIntent(keyword);
  const { matchedProducts, meetsThreshold } = matchProducts(intent, MOCK_CATALOG);

  console.log("Intent:", intent);
  console.log(`Matched ${matchedProducts.length} products, meetsThreshold: ${meetsThreshold}`);

  if (!meetsThreshold) {
    console.log("⚠️  Below threshold — would be flagged for merchant review, not published. Generating anyway for testing purposes.");
  }

  const content = await generatePLPContent({
    intent,
    products: matchedProducts,
    locale: "en-US",
  });

  console.log("\n=== Generated PLP ===");
  console.log(JSON.stringify(content, null, 2));
}

main();
