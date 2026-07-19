import styleRoomConfig from "../page-configs/style-room.json";
import useCaseConfig from "../page-configs/use-case.json";
import localeSpecificConfig from "../page-configs/locale-specific.json";
import type { ParsedIntent } from "../intent/types";

export type PageConfigId = "style-room" | "use-case" | "locale-specific";

const CONFIGS: Record<PageConfigId, typeof styleRoomConfig> = {
  "style-room": styleRoomConfig,
  "use-case": useCaseConfig,
  "locale-specific": localeSpecificConfig,
};

// Decides which page-type config applies to a given intent. This is a
// simple rule-based classifier: if the intent has both a style and a room,
// it's a style-room page; if it has a use_case but no clear style, it's a
// use-case page; locale-specific overrides both when targeting a non-US market.
export function selectPageConfig(
  intent: ParsedIntent,
  locale: string,
): PageConfigId {
  if (locale !== "en-US") return "locale-specific";
  if (intent.style && intent.room) return "style-room";
  return "use-case";
}

export function getPageConfig(id: PageConfigId) {
  return CONFIGS[id];
}

// Fills a config's user_prompt_template with real values, replacing the
// {placeholder} tokens the spec's JSON config format defines.
export function fillPromptTemplate(
  template: string,
  intent: ParsedIntent,
  productsJson: string,
  marketContext: string,
): string {
  return template
    .replace("{style}", intent.style ?? "")
    .replace("{room}", intent.room ?? "")
    .replace("{use_case}", intent.use_case ?? "")
    .replace("{intent_json}", JSON.stringify(intent))
    .replace("{products_json}", productsJson)
    .replace("{market_context}", marketContext);
}
