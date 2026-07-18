export interface ParsedIntent {
  color: string | null;
  material: string | null;
  style: string | null;
  room: string | null;
  use_case: string | null;
  attribute: string | null; // e.g. "sustainable", "budget", "premium"
  audience: string | null; // e.g. "parents", "renters", "designers"
  raw_keyword: string; // always keep the original for debugging/logging
}
