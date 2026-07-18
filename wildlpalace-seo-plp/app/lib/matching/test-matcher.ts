import { parseIntent } from "../intent/parser";
import { matchProducts } from "./matcher";
import { MOCK_CATALOG } from "./mock-catalog";

const testKeywords = [
  "sustainable midnight blue wallpaper kids room",
  "peel and stick botanical wallpaper for renters",
  "charcoal geometric wallpaper living room",
  "botanical wallpaper for a bright cheerful kids room",
];

async function main() {
  for (const keyword of testKeywords) {
    const intent = await parseIntent(keyword);
    const result = matchProducts(intent, MOCK_CATALOG);

    console.log("\n=== Keyword:", keyword, "===");
    console.log("Parsed intent:", JSON.stringify(intent));
    console.log(
      `Matched ${result.matchedProducts.length} products (threshold: ${result.threshold}, meets threshold: ${result.meetsThreshold})`,
    );
    result.matchedProducts.forEach((p) =>
      console.log(`  - ${p.title} [${p.tags.join(", ")}]`),
    );
  }
}

main();
