import { parseIntent } from "../app/lib/intent/parser";
import { matchProducts } from "../app/lib/matching/matcher";
import { MOCK_CATALOG } from "../app/lib/matching/mock-catalog";
import { generatePLPContent } from "../app/lib/generation/generate-plp";
import { getLocaleConfig } from "../app/lib/locale/config";

async function main() {
  const keyword = "botanical wallpaper living room";
  const locale = "de-DE";

  const intent = await parseIntent(keyword);
  const { matchedProducts } = matchProducts(intent, MOCK_CATALOG);
  const localeConfig = getLocaleConfig(locale);

  console.log("Locale config:", localeConfig);
  console.log("Intent:", intent);
  console.log(`Matched ${matchedProducts.length} products`);

  const content = await generatePLPContent({
    intent,
    products: matchedProducts,
    locale,
  });

  console.log("\n=== Generated PLP (German) ===");
  console.log(JSON.stringify(content, null, 2));
}

main();
