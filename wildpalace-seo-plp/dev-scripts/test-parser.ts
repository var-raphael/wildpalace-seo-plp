import { parseIntent } from "../app/lib/intent/parser";

const testKeywords = [
  "sustainable midnight blue wallpaper kids room",
  "peel and stick botanical wallpaper for renters",
  "charcoal geometric wallpaper living room",
  "budget grasscloth wallpaper for small apartments",
];

async function main() {
  for (const keyword of testKeywords) {
    const result = await parseIntent(keyword);
    console.log("\nInput:", keyword);
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
