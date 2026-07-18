import { parseIntent } from "../intent/parser";
import { matchProducts } from "../matching/matcher";
import { MOCK_CATALOG } from "../matching/mock-catalog";
import { generatePLPContent } from "./generate-plp";
import { getLocaleConfig } from "../locale/config";

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
