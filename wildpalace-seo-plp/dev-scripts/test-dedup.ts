import { parseIntent } from "../app/lib/intent/parser";
import { clusterKeywords } from "../app/lib/dedup/clustering";
import { checkAgainstExistingPages, type PublishedPage } from "../app/lib/dedup/similarity";

async function main() {
  const keywordBatch = [
    "botanical wallpaper living room",
    "botanical wallpaper for living rooms",
    "botanical wallpaper for the living room",
    "sustainable midnight blue wallpaper kids room",
    "peel and stick botanical wallpaper for renters",
    "charcoal geometric wallpaper living room",
  ];

  console.log("=== STEP 1: Keyword clustering (pre-generation) ===\n");

  const intents = [];
  for (const kw of keywordBatch) {
    intents.push(await parseIntent(kw));
    await new Promise((resolve) => setTimeout(resolve, 15000)); // 15s between calls to respect Mistral's free-tier rate limit

  }

  const clusters = clusterKeywords(intents);

  clusters.forEach((cluster, i) => {
    console.log(`Cluster ${i + 1} (${cluster.members.length} keyword(s)):`);
    cluster.members.forEach((m) => console.log(`  - "${m.raw_keyword}"`));
    console.log(
      `  → Canonical page would target: "${cluster.representativeIntent.raw_keyword}"\n`,
    );
  });

  console.log(`\nTotal clusters: ${clusters.length} (from ${keywordBatch.length} raw keywords)`);

  console.log("\n\n=== STEP 2: Similarity check against already-published pages ===\n");

  const existingPages: PublishedPage[] = [
    {
      slug: "botanical-wallpaper-living-room",
      intent: await parseIntent("botanical wallpaper living room"),
      locale: "en-us",
    },
  ];

  const candidateIntent = await parseIntent("botanical wallpaper for the living room");
  const result = checkAgainstExistingPages(candidateIntent, "en-us", existingPages);

  console.log("New candidate:", candidateIntent.raw_keyword);
  console.log("Similarity score:", result.similarityScore.toFixed(2));
  console.log("Is duplicate:", result.isDuplicate);
  if (result.isDuplicate) {
    console.log(
      `→ Would be BLOCKED and pointed to canonical: /${result.mostSimilarPage?.slug}`,
    );
  } else {
    console.log("→ Would proceed to publishing as a distinct page");
  }

  console.log("\n---\n");
  const distinctIntent = await parseIntent("charcoal geometric wallpaper living room");
  const distinctResult = checkAgainstExistingPages(distinctIntent, "en-us", existingPages);

  console.log("New candidate:", distinctIntent.raw_keyword);
  console.log("Similarity score:", distinctResult.similarityScore.toFixed(2));
  console.log("Is duplicate:", distinctResult.isDuplicate);
  console.log(
    distinctResult.isDuplicate
      ? "→ Would be blocked"
      : "→ Would proceed to publishing as a distinct page (correct — different color/style)",
  );
}

main();
