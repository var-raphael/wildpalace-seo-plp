import Bottleneck from "bottleneck";

// Wraps all AI SDK calls so we never exceed the provider's rate limit,
// regardless of how many keywords/pages are queued at once. Numbers here
// are conservative for Mistral's free tier (4 req/min); tune upward for
// a paid tier or a different provider via env if needed.
const REQUESTS_PER_MINUTE = Number(process.env.AI_REQUESTS_PER_MINUTE ?? 4);

export const aiLimiter = new Bottleneck({
  reservoir: REQUESTS_PER_MINUTE,
  reservoirRefreshAmount: REQUESTS_PER_MINUTE,
  reservoirRefreshInterval: 60 * 1000, // refill every 60s
  maxConcurrent: 1, // process one at a time within the window too
});

// Wrap any AI-calling async function with this to respect the limiter.
export function throttledAiCall<T>(fn: () => Promise<T>): Promise<T> {
  return aiLimiter.schedule(fn);
}
