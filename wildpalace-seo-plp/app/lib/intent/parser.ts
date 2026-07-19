import { generateObject } from "ai";
import { z } from "zod";
import { aiModel } from "../ai-config";
import { COLORS, MATERIALS, ROOMS, STYLES } from "./vocab";
import type { ParsedIntent } from "./types";
import { throttledAiCall } from "../ai-throttle/throttle";

// --- Rules-based extraction ---
// Finds the first matching term from a vocab list inside the keyword string.
// Checks longer phrases first so "kids room" matches before a hypothetical "room".
function findMatch(keyword: string, vocab: string[]): string | null {
  const lower = keyword.toLowerCase();
  const sorted = [...vocab].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    if (lower.includes(term)) return term;
  }
  return null;
}

// --- AI fallback schema ---
// Only the fuzzy fields go through the model — attribute and audience have
// too much natural-language variation to hardcode (e.g. "sustainable",
// "eco-friendly", "budget-friendly" all mean roughly the same thing).
const fuzzySchema = z.object({
  attribute: z
    .string()
    .nullable()
    .describe(
      'A qualifying attribute like "sustainable", "budget", "premium", or null if none present',
    ),
  use_case: z
    .string()
    .nullable()
    .describe(
      'A usage scenario like "kids room", "renters", "small spaces", or null if none present',
    ),
  audience: z
    .string()
    .nullable()
    .describe(
      'Who this is likely targeted at, e.g. "parents", "renters", "designers", or null if unclear',
    ),
});

async function parseFuzzyFieldsWithAI(
  keyword: string,
): Promise<z.infer<typeof fuzzySchema>> {
  const object = await throttledAiCall(async () => {
    const { object } = await generateObject({
      model: aiModel,
      schema: fuzzySchema,
      prompt: `Extract the qualifying attribute, use case, and target audience from this wallpaper search query. Return null for any field that isn't clearly present.\n\nQuery: "${keyword}"`,
    });
    return object;
  });
  return object;
}

// --- Main entry point ---
export async function parseIntent(keyword: string): Promise<ParsedIntent> {
  // Step 1: deterministic lookups against known vocab
  const color = findMatch(keyword, COLORS);
  const material = findMatch(keyword, MATERIALS);
  const style = findMatch(keyword, STYLES);
  const room = findMatch(keyword, ROOMS);

  // Step 2: AI fallback for the fuzzy fields only
  const fuzzy = await parseFuzzyFieldsWithAI(keyword);

  return {
    color,
    material,
    style,
    room,
    use_case: fuzzy.use_case ?? room, // fall back to room if AI finds nothing extra
    attribute: fuzzy.attribute,
    audience: fuzzy.audience,
    raw_keyword: keyword,
  };
}
