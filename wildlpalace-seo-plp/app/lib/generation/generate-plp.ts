// app/lib/generation/generate-plp.ts
import { generateObject } from "ai";
import { aiModel } from "../ai-config";
import { plpOutputSchema, type PLPOutput } from "./schema";
import type { ParsedIntent } from "../intent/types";
import type { MockProduct } from "../matching/mock-catalog";
import { getLocaleConfig } from "../locale/config";


interface GeneratePLPInput {
  intent: ParsedIntent;
  products: MockProduct[];
  locale: string; // e.g. "en-US", "en-AU"
}

const MAX_RETRIES = 2;

export async function generatePLPContent(
  input: GeneratePLPInput,
): Promise<PLPOutput> {
  const { intent, products, locale } = input;

  const systemPrompt = `You are an interior design and SEO expert writing product listing pages for Wild Palace, a premium wallpaper brand. Write content that is genuinely useful and specific to the given intent — never generic keyword-stuffed filler. Each page must have a real reason to exist: differentiate it clearly from adjacent pages targeting similar but distinct queries.`;

const localeConfig = getLocaleConfig(locale);

const userPrompt = `Create a PLP for the following intent and matched products.

INTENT: ${JSON.stringify(intent)}
PRODUCTS: ${JSON.stringify(products.map((p) => ({ title: p.title, tags: p.tags })))}

MARKET CONTEXT:
- Language: ${localeConfig.language} — write entirely in this language
- Measurement system: ${localeConfig.measurementSystem} (use ${localeConfig.measurementSystem === "imperial" ? "feet/inches" : "centimeters/meters"} for any dimensions)
- Currency: ${localeConfig.currency} (${localeConfig.currencySymbol}) — use this if referencing price
- Local terminology: ${JSON.stringify(localeConfig.terminology)} — use these exact local terms, not generic ones

Write copy specific to this exact combination of attributes and this exact market — do not write generic wallpaper copy that could apply to any page or any country. Reference the specific style, room, and qualifying attributes naturally throughout.

IMPORTANT: meta_title must be 60 characters or fewer — count carefully before responding.`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { object } = await generateObject({
        model: aiModel,
        schema: plpOutputSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.5,
      });
      return object;
    } catch (err: any) {
      lastError = err;
      console.warn(`Generation attempt ${attempt + 1} failed:`, err?.message);
      if (err?.cause) console.warn("Cause:", JSON.stringify(err.cause, null, 2));
      if (err?.text) console.warn("Raw model output:", err.text);
    }
  }

  throw new Error(
    `PLP generation failed after ${MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}
