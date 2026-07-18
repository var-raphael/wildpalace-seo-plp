export interface LocaleConfig {
  code: string; // e.g. "en-US", "en-AU", "de-DE"
  language: string; // e.g. "English", "German"
  measurementSystem: "imperial" | "metric";
  currency: string; // e.g. "USD", "AUD", "EUR"
  currencySymbol: string;
  urlPrefix: string; // e.g. "en-us", "en-au", "de-de"
  terminology: Record<string, string>; // local term overrides
}

// Adding a new market = adding a new entry here. No code changes needed
// elsewhere in the pipeline — generation, JSON-LD, and meta tags all read
// from this config.
export const LOCALES: Record<string, LocaleConfig> = {
  "en-US": {
    code: "en-US",
    language: "English (US)",
    measurementSystem: "imperial",
    currency: "USD",
    currencySymbol: "$",
    urlPrefix: "en-us",
    terminology: {
      adhesive: "wallpaper paste",
      apartment: "apartment",
    },
  },
  "en-AU": {
    code: "en-AU",
    language: "English (Australian)",
    measurementSystem: "metric",
    currency: "AUD",
    currencySymbol: "A$",
    urlPrefix: "en-au",
    terminology: {
      adhesive: "wallpaper adhesive",
      apartment: "flat",
    },
  },
  "de-DE": {
    code: "de-DE",
    language: "German",
    measurementSystem: "metric",
    currency: "EUR",
    currencySymbol: "€",
    urlPrefix: "de-de",
    terminology: {
      adhesive: "Tapetenkleister",
      apartment: "Wohnung",
    },
  },
};

export function getLocaleConfig(code: string): LocaleConfig {
  const config = LOCALES[code];
  if (!config) throw new Error(`Unknown locale: ${code}`);
  return config;
}
