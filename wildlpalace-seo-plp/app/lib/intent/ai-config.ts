import { anthropic } from "@ai-sdk/anthropic";
import { mistral } from "@ai-sdk/mistral";
// import { openai } from "@ai-sdk/openai";
// import { google } from "@ai-sdk/google";

// Central place that decides which model powers the whole app.
// Switching providers = change AI_PROVIDER / AI_MODEL in .env, nothing else.
//
// .env example:
//   AI_PROVIDER=mistral
//   AI_MODEL=mistral-large-latest

const provider = process.env.AI_PROVIDER ?? "anthropic";
const modelName = process.env.AI_MODEL ?? "claude-sonnet-4-5";

function resolveModel() {
  switch (provider) {
    case "anthropic":
      return anthropic(modelName);
    case "mistral":
      return mistral(modelName);
    // case "openai":
    //   return openai(modelName);
    // case "google":
    //   return google(modelName);
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}

export const aiModel = resolveModel();
