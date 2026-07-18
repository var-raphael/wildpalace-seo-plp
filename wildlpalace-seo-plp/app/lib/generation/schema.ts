// app/lib/generation/schema.ts
import { z } from "zod";

export const plpOutputSchema = z.object({
  h1: z.string().describe("Unique H1 matching the target keyword exactly"),
  intro: z.string().describe("Opening paragraph, 2-3 sentences, states the page topic clearly in the first 100 words"),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        content: z.string(),
      }),
    )
    .min(3)
    .describe("Body sections expanding topical coverage, not restating the H1"),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string().describe("Standalone answer, understandable without surrounding context"),
      }),
    )
    .min(4),
  meta_title: z.string().max(70).describe("SEO meta title, STRICT MAXIMUM 60 characters. Count carefully. Written for CTR."),
  meta_description: z.string().describe("SEO meta description, written for CTR"),
});

export type PLPOutput = z.infer<typeof plpOutputSchema>;
