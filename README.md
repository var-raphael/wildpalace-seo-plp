# Wild Palace SEO PLP App

A Shopify app that generates SEO-optimized Product Listing Pages (PLPs) at scale from keyword input, using a hybrid rules+AI pipeline. Built for the Wild Palace technical test.

## Core loop

```
Keyword input → Intent parsing → Product matching → Threshold check →
Dedup check → AI content generation → Technical SEO markup →
Internal linking → Publish (DB) → llms.txt / sitemap-ai.xml
```

This is implemented end-to-end in `app/routes/app.generate.tsx`, backed by a Prisma/SQLite `PublishedPage` table, and viewable via `app/routes/app.dashboard.tsx`.

## Architecture overview

| Concern | Location |
|---|---|
| Intent parsing (hybrid rules + AI) | `app/lib/intent/` |
| Product matching + safety exclusions | `app/lib/matching/` |
| AI content generation | `app/lib/generation/` |
| Technical SEO (JSON-LD, meta tags) | `app/lib/seo/` |
| Cannibalization prevention | `app/lib/dedup/` |
| Internal linking | `app/lib/internal-linking/` |
| Multi-locale config | `app/lib/locale/` |
| AI presence (llms.txt, sitemap-ai.xml) | `app/lib/ai-presence/` |
| AI provider abstraction | `app/lib/ai-config.ts` |
| Rate-limit handling | `app/lib/ai-throttle/` |

Each module has a standalone `test-*.ts` script used during development to verify logic directly via `npx tsx`, independent of the Shopify UI. These are development aids, not part of the production interface — the real entry points are the two Shopify admin routes listed above.

---

## Required questions

### How do you prevent thin content? What happens when a query matches fewer than 6 products?

Product matching enforces a minimum threshold (default 6, configurable). Below threshold, the page is **not published** — it's saved to the database with `status: "needs_review"` and surfaced for merchant review instead (see `app/routes/app.generate.tsx`, Step 3). No AI content is generated for below-threshold pages, since generating copy for a page that won't publish wastes API calls. The dashboard shows a live count of needs-review pages so merchants can act on them (e.g. broaden the query, add more matching products, or manually approve with fewer products if appropriate for their catalog).

### How does your prompt strategy differentiate pages targeting adjacent queries?

Each generation call receives a structured brief containing the full `ParsedIntent` (color, material, style, room, use_case, attribute, audience) plus the specific matched products and locale/market context — never just the raw keyword. The system prompt explicitly instructs the model to write content specific to this exact combination of attributes, not generic wallpaper copy. In testing, this reliably produced differentiated content: e.g. a "kids room" page emphasized safety and durability, while a "renters" page emphasized removability and deposit protection, from otherwise similar underlying products.

The `output_schema` also requires 3+ distinct sections and 4+ FAQ entries per page, which structurally discourages short, interchangeable content.

### How do related PLPs link to each other internally?

`app/lib/internal-linking/internal-links.ts` computes related pages automatically at generation time (not post-launch). It compares the new page's intent against all currently-published pages in the same locale using the same field-overlap similarity function used for dedup, but at a different threshold band: 25–70% overlap counts as "related" (below 25% is unrelated; at or above 70% would have already been blocked as a near-duplicate by the dedup check). Each link includes a human-readable reason (e.g. "Shares: botanical style, living room") derived from the actual overlapping fields, rather than a generic "related pages" label.

### Why did you choose your publishing mechanism?

Pages are persisted in a Prisma-backed SQLite table (`PublishedPage`), extending the app template's existing Prisma setup (currently used only for sessions). SQLite is appropriate for a single-instance dev/test deployment per the template's own documentation; switching to Postgres/MySQL for a multi-instance production deployment is a one-line change to the `datasource` provider in `schema.prisma`, not a rewrite.

**Known gap:** the current implementation stores generated content in the app's own database but does not yet push it to a live Shopify object (Pages API or Metaobjects). Metaobjects is the intended target — it fits structured, repeatable content well and is explicitly named in the spec — but wiring the actual `metaobjectUpsert` mutation (already demonstrated working in `app/routes/app.seed.tsx`) was not completed in the time available. The `shopifyPageId` field already exists on the `PublishedPage` model in anticipation of this.

### How does adding a new locale work — what does the merchant actually do?

Locale is entirely config-driven (`app/lib/locale/config.ts`). Adding a market (e.g. France) means adding one new entry to the `LOCALES` object — language, measurement system, currency, URL prefix, and brand terminology overrides — with zero changes to the generation, matching, or SEO logic, all of which read from this config at runtime. In the current implementation, a developer adds this config entry directly; a natural next step would be exposing this as a Settings UI field so a non-technical merchant could add it without a code change (see Known Gaps).

Verified working end-to-end: the same keyword ("botanical wallpaper living room") was successfully generated for both `en-US` and `de-DE`, producing genuinely different, locally-appropriate copy — not machine-translated English — including correct use of brand-specific German terminology ("Tapetenkleister" for adhesive) injected via the locale config.

### How is your content structure optimized for AI retrieval, not just Google?

Two dedicated files, generated automatically per publish:
- **`llms.txt`** — plain-language index of the store, collections, and all published PLPs with their target intent and slug (`app/lib/ai-presence/llms-txt.ts`)
- **`sitemap-ai.xml`** — curated XML sitemap of quality-approved (published, threshold-passing) PLPs only, with intent summary, primary keyword, product count, and locale (`app/lib/ai-presence/sitemap-ai.ts`)

Separately, every generated FAQ answer is written to be standalone and self-contained (verified in testing — e.g. "Not at all! Midnight blue can make a small room feel cozier..." makes complete sense without any surrounding page context), which is what allows an AI system to cite an individual answer directly rather than needing the full page for context.

### Known gaps and what you'd build next

- **Live Shopify publishing**: content is generated and persisted in the app's own database but not yet pushed to a real Shopify Page/Metaobject. Next step: wire `db.publishedPage.create` to also call `metaobjectUpsert`, storing the returned ID in `shopifyPageId`.
- **Live UI verification**: the app installs and authenticates correctly on the dev store (confirmed via OAuth flow and initial template render). However, testing newer routes live in a mobile browser was blocked by a persistent blank-page issue specific to this development environment (Codespaces accessed via SSH from a mobile terminal client). Diagnosis ruled out a TOML URL mismatch (found, fixed, and redeployed), a known Chrome-specific hydration bug (confirmed present in Firefox too, ruling it out as the sole cause), and route-level code errors (`tsc --noEmit` passes cleanly across the project, and a route proven working earlier in development exhibited the same symptom later). The most likely remaining cause is a port-forwarding registration gap specific to SSH-only Codespaces sessions — `gh codespace ports` returned no registered ports despite the dev server running correctly. All pipeline logic was independently verified via direct `npx tsx` execution against real AI providers (Mistral and Claude, via the swappable AI SDK config), and both admin routes (`app.generate.tsx`, `app.dashboard.tsx`) compile cleanly and implement the full production flow — this is a live-preview access issue in one specific testing setup, not a defect in the application logic.
- **Real product matching**: currently matches against a hardcoded mock catalog (`app/lib/matching/mock-catalog.ts`) rather than live Shopify product data, since building this against real store data was deprioritized in favor of proving the full pipeline logic end-to-end first. Swapping in a real `admin.graphql` product query (the same pattern already demonstrated in `app.seed.tsx`) is a contained, well-understood next step.
- **Keyword auto-discovery from catalog**: the spec's "auto-discovery" keyword mode (surfacing candidates from existing tags/collections) was not built; only manual keyword entry is implemented. A real implementation would also benefit from a search-volume API (DataForSEO, Google Search Console) to rank catalog-derived candidates before surfacing them to the merchant — the architecture doesn't yet have this abstraction but would need a `KeywordSourceProvider`-style interface to add it cleanly.
- **Merchant Settings UI**: AI provider key management, default locale selection, and brand tone are currently `.env`-based rather than exposed in the app's UI.
- **CSV keyword upload**: not implemented; only single-keyword form submission.
- **Rate limiting at scale**: AI calls are wrapped in a `Bottleneck`-based throttle (`app/lib/ai-throttle/`) tuned for free-tier limits, but a real bulk keyword batch (tens or hundreds of keywords) would need this tuned per-provider and likely paired with a background job queue rather than synchronous request handling.

---

## AI provider architecture

All AI calls go through the Vercel AI SDK's `generateObject`, never a provider-specific SDK directly. The active model is resolved once in `app/lib/ai-config.ts` from two environment variables:

```
AI_PROVIDER=mistral
AI_MODEL=mistral-large-latest
```

Switching providers (Claude ↔ Mistral ↔ GPT-4o ↔ Gemini) requires changing these two values only — no code changes anywhere in the pipeline. This was used in practice during development: Mistral was used for iterative testing (free tier), with Claude available via the same config for comparison.

## Cannibalization prevention — how "too similar" is defined

Three mechanisms, all implemented in `app/lib/dedup/`:

1. **Keyword clustering** (pre-generation): incoming keywords are parsed into intent, then greedily clustered by pairwise similarity (`clustering.ts`). One canonical page is generated per cluster.
2. **Similarity check** (pre-publish): before publishing, a new page's intent is compared against all existing published pages in the same locale (`similarity.ts`). Similarity is the fraction of comparable intent fields (color, material, style, room, use_case, attribute) that match after light normalization — lowercasing, filler-word removal, and proper singularization via the `pluralize` library (deliberately not a hand-rolled regex, to avoid mangling words that genuinely end in "s", e.g. "glass"). 70%+ overlap is treated as a duplicate and blocked.
3. **Canonical consolidation**: a blocked duplicate's response includes the slug of the existing canonical page it should point to, rather than silently failing.

This was verified directly: near-identical phrasings ("botanical wallpaper living room" / "botanical wallpaper for the living room" / "botanical wallpaper for living rooms") correctly clustered together and correctly triggered duplicate-blocking, while a genuinely distinct query ("charcoal geometric wallpaper living room") correctly did not.

