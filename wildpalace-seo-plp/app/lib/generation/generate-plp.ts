import { generateObject } from "ai";
import { aiModel } from "../ai-config";
import { plpOutputSchema, type PLPOutput } from "./schema";
import { getLocaleConfig } from "../locale/config";
import {
  selectPageConfig,
  getPageConfig,
  fillPromptTemplate,
} from "./page-config-loader";
import type { ParsedIntent } from "../intent/types";
import type { MockProduct } from "../matching/mock-catalog";

interface GeneratePLPInput {
  intent: ParsedIntent;
  products: MockProduct[];
  locale: string;
}

const MAX_RETRIES = 2;

export async function generatePLPContent(
  input: GeneratePLPInput,
): Promise<PLPOutput> {
  const { intent, products, locale } = input;

  const localeConfig = getLocaleConfig(locale);

  // Select and load the page-type config — this is what makes prompting
  // genuinely different per page type (style-room vs use-case vs
  // locale-specific), rather than one shared prompt for everything.
  const configId = selectPageConfig(intent, locale);
  const pageConfig = getPageConfig(configId);

  const marketContext = `Language: ${localeConfig.language} — write entirely in this language. Measurement system: ${localeConfig.measurementSystem} (use ${localeConfig.measurementSystem === "imperial" ? "feet/inches" : "centimeters/meters"} for dimensions). Currency: ${localeConfig.currency} (${localeConfig.currencySymbol}). Local terminology: ${JSON.stringify(localeConfig.terminology)} — use these exact terms.`;

  const productsJson = JSON.stringify(
    products.map((p) => ({ title: p.title, tags: p.tags })),
  );

  const userPrompt =
    fillPromptTemplate(
      pageConfig.generation.user_prompt_template,
      intent,
      productsJson,
      marketContext,
    ) +
    `\n\nWrite copy specific to this exact combination of attributes and this exact market — do not write generic wallpaper copy that could apply to any page or any country. IMPORTANT: meta_title must be 60 characters or fewer — count carefully before responding.`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { object } = await generateObject({
        model: aiModel,
        schema: plpOutputSchema,
        system: pageConfig.generation.system_prompt,
        prompt: userPrompt,
        temperature: pageConfig.generation.temperature,
      });
      return object;
    } catch (err: any) {
      lastError = err;
      console.warn(`Generation attempt ${attempt + 1} failed:`, err?.message);
    }
  }

  throw new Error(
    `PLP generation failed after ${MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}
