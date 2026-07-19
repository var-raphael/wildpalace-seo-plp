// app/lib/dedup/clustering.ts
import type { ParsedIntent } from "../intent/types";
import { calculateSimilarity } from "./similarity";

export interface KeywordCluster {
  representativeIntent: ParsedIntent; // the "canonical" keyword for this cluster
  members: ParsedIntent[]; // all keywords that fell into this cluster
}

const CLUSTER_THRESHOLD = 0.7; // same threshold as similarity check, kept consistent

// Simple greedy clustering: walk through keywords, assign each to the first
// existing cluster it's similar enough to, or start a new cluster.
// This is O(n²) but for a merchant's keyword batch (tens to low hundreds
// per run) that's entirely fine — no need for anything fancier here.
export function clusterKeywords(intents: ParsedIntent[]): KeywordCluster[] {
  const clusters: KeywordCluster[] = [];

  for (const intent of intents) {
    const matchingCluster = clusters.find(
      (cluster) =>
        calculateSimilarity(intent, cluster.representativeIntent) >=
        CLUSTER_THRESHOLD,
    );

    if (matchingCluster) {
      matchingCluster.members.push(intent);
    } else {
      clusters.push({ representativeIntent: intent, members: [intent] });
    }
  }

  return clusters;
}
