import { z } from "zod";
import { generateObject } from "ai";
import { aiModel } from "../ai-config";
import type { ParsedIntent } from "../intent/types";

export interface ProductForAltText {
  id: string;
  title: string;
}

const altTextSchema = z.object({
  altTexts: z
    .array(
      z.object({
        productId: z.string(),
        altText: z
          .string()
          .max(125)
          .describe(
            "Descriptive alt text for the product image, reflecting the page's search intent, not just the product title. Max 125 characters (standard accessibility guideline).",
          ),
      }),
    )
    .describe("One alt text entry per product provided"),
});

export async function generateAltTexts(
  products: ProductForAltText[],
  intent: ParsedIntent,
): Promise<Record<string, string>> {
  if (products.length === 0) return {};

  const { object } = await generateObject({
    model: aiModel,
    schema: altTextSchema,
    prompt: `Write accessible alt text for each product image below, for a page targeting this search intent: ${JSON.stringify(intent)}.

Products:
${products.map((p) => `- id: ${p.id}, title: "${p.title}"`).join("\n")}

Each alt text should describe what the image likely shows AND reflect the page's intent context (room, style, use case) — not just restate the product title. Keep each under 125 characters.`,
  });

  const map: Record<string, string> = {};
  for (const entry of object.altTexts) {
    map[entry.productId] = entry.altText;
  }
  return map;
}
