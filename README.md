# Wild Palace SEO PLP App - Technical Documentation

A Shopify app that generates SEO-optimized Product Listing Pages (PLPs) at scale from keyword input, using a hybrid rules+AI pipeline against a store's real product catalog.

## Core loop

```
Keyword input (manual / auto-discovery / CSV)
  → Intent parsing (hybrid rules + AI)
  → Product matching (real Shopify catalog)
  → Threshold check (min 6 products)
  → Dedup / cannibalization check
  → AI content generation (per-page-type config)
  → Alt text generation
  → Technical SEO markup (JSON-LD, canonical, hreflang)
  → Internal linking (computed at generation time)
  → Publish (Shopify Metaobject + local DB)
  → llms.txt / sitemap-ai.xml (auto-regenerated)
```

Implemented end-to-end in `app/routes/app.generate.tsx`, with a parallel path for merchant-reviewed pages in `app/routes/app.review.$id.tsx`.

---

## Architecture map

| Concern | Location |
|---|---|
| Intent parsing | `app/lib/intent/` |
| Product matching | `app/lib/matching/` |
| Real Shopify catalog fetch | `app/lib/matching/shopify-catalog.ts` |
| AI content generation | `app/lib/generation/` |
| Per-page-type prompt configs | `app/lib/page-configs/*.json` |
| Technical SEO (JSON-LD, meta) | `app/lib/seo/` |
| Alt text generation | `app/lib/seo/alt-text.ts` |
| Cannibalization prevention | `app/lib/dedup/` |
| Internal linking | `app/lib/internal-linking/` |
| Multi-locale config | `app/lib/locale/` |
| AI presence files | `app/lib/ai-presence/` |
| Real Shopify publishing (create and delete) | `app/lib/publishing/shopify-publish.ts` |
| Keyword auto-discovery | `app/lib/keyword-discovery/` |
| AI provider abstraction | `app/lib/ai-config.ts` |
| Rate-limit handling | `app/lib/ai-throttle/` |

### Admin routes (the actual product surface)

| Route | Purpose |
|---|---|
| `/app` | Landing page. Overview counts (published, needs review, draft) plus links into every feature below. |
| `/app/generate` | Core flow: keyword, preview match, then generate and publish, or save as a draft first |
| `/app/keywords` | Auto-discovery from live catalog tags/collections |
| `/app/csv-upload` | Manual keyword list upload |
| `/app/dashboard` | All PLPs with status (published, needs review, draft), with view, review, publish, and delete actions per row |
| `/app/plp/:id` | Read-only detail view of any saved page's full generated content |
| `/app/review/:id` | Merchant review flow for pages below the product threshold. Editable product checklist against the live catalog, with an explicit override to publish anyway |
| `/app/settings` | Default locale, brand tone, competitor URLs, AI provider selection |
| `/app/seed` | Dev-only. Seeds a test wallpaper catalog. Idempotent (checks for existing products/collections by title and handle before creating). Not part of the product. |

### Public routes (unauthenticated, for crawlers)

| Route | Purpose |
|---|---|
| `/llms.txt?shop=X` | Plain-language store/PLP index for AI crawlers |
| `/sitemap-ai.xml?shop=X` | Structured XML sitemap for AI crawlers |

---

## Technical decisions and why

### 1. Hybrid rules + AI intent parsing, not pure-AI or pure-rules
Known catalog vocabulary (colors, materials, styles, rooms, the things that map directly to real product tags) is matched deterministically via string lookup: fast, free, 100% consistent. Only genuinely open-ended fields (`attribute`, `use_case`, `audience`) go through an AI call, since these can't be reasonably enumerated in advance ("sustainable," "eco-friendly," "budget-friendly" all mean similar things but can't all be hardcoded). This keeps cost and latency down while still handling natural language variation.

### 2. Vercel AI SDK, not a provider-specific SDK
All AI calls go through `generateObject()`, never Anthropic's or Mistral's SDK directly. The active provider/model is resolved once in `app/lib/ai-config.ts` from two env vars (`AI_PROVIDER`, `AI_MODEL`). Switching providers is a config change, not a code change, verified in practice by developing against Mistral (free tier) and confirming Claude works via the same code path.

### 3. Scoring-based product matching, not boolean include/exclude
Each product earns points for each intent field it matches (color, material, style, room, attribute). This lets partial matches rank sensibly rather than being all-or-nothing, and gives a natural place to enforce hard safety exclusions (see #4) as a pre-filter before scoring.

### 4. Hard safety exclusion for sensitive rooms, separate from scoring
Kids' rooms and nurseries have a hardcoded exclusion list (dark/moody/gothic-tagged products) that runs before scoring, not as just another weighted factor. A "kids room" query must never surface inappropriate wallpaper regardless of how well it otherwise scores, so this needed to be a hard rule, not a soft preference.

### 5. Minimum product threshold blocks publishing by default, not just warns
Below 6 matched products, an automatic generation attempt is saved with `status: "needs_review"` and never reaches AI generation or publishing. This avoids wasting AI calls on pages that won't ship, and directly prevents thin-content pages from going live without a human decision. See decision #22 for the explicit, merchant-driven exception to this rule.

### 6. Structured JSON-LD is built with plain code, not AI-generated
The AI generates prose content (h1, intro, sections, FAQ) but `schema_markup` (CollectionPage, ItemList, FAQPage, BreadcrumbList) is assembled deterministically from data already in hand. Structured data needs to be syntactically perfect for search engines to parse; trusting an LLM to hand-write valid JSON-LD adds hallucination risk for no benefit when the same data can be templated directly.

### 7. Per-page-type JSON config files, not one shared prompt
`app/lib/page-configs/` holds separate configs (`style-room`, `use-case`, `locale-specific`), each with its own system prompt, temperature, and prompt template, matching the spec's JSON config architecture. `selectPageConfig()` picks the right one automatically based on the parsed intent's shape (has both style and room, style-room; has a locale outside en-US, locale-specific; otherwise, use-case). The output schema (Zod) stays shared across all types deliberately, so downstream consumers (JSON-LD builder, dashboard, DB) can rely on one consistent shape.

### 8. Field-overlap similarity for dedup, not embeddings
Two pages are compared by what fraction of their parsed intent fields (color, material, style, room, use_case, attribute) match exactly after normalization. This is deliberately simpler than a vector/embedding approach. It's explainable (you can point to exactly which fields matched), free to compute, and appropriate given intent is already structured data, not raw text needing semantic comparison.

### 9. `pluralize` library for text normalization, not a hand-rolled regex
Early version used a regex stripping trailing "s" for de-pluralization, which would have incorrectly mangled words that genuinely end in "s" (e.g. "glass" to "glas"). Replaced with the `pluralize` npm library, which uses real English pluralization rules.

### 10. One similarity function, two different threshold bands
The same `calculateSimilarity()` powers both dedup (70% or higher, blocked as a duplicate) and internal linking (25% to 70%, related page worth linking). This avoids duplicate logic while correctly treating "very similar" and "somewhat similar" as different, useful signals rather than the same thing.

### 11. Internal linking computed at generation time, not post-hoc
Every new published page automatically queries existing published pages, scores them for relatedness, and stores up to 4 related links with human-readable reasons (e.g. "Shares: botanical style, living room"). This runs inline in the publish flow, not as a separate batch job, satisfying the spec's requirement that linking isn't a "post-launch concern." See Known Gaps for a real limitation of this on a small catalog.

### 12. Locale as explicit config, not auto-detected
`app/lib/locale/config.ts` is a manually-maintained map of locale to language, measurement system, currency, URL prefix, and brand terminology overrides. Auto-detecting target market from request signals was considered and deliberately rejected: which markets to target is a merchant business decision, not something inferable from a visitor's browser locale. Pre-generating page variants for chosen markets is a different problem than adapting a live page per visitor.

### 13. Real Shopify Metaobjects, not just internal DB storage
Every published page writes to both the app's own Prisma/SQLite table (fast queries for dashboard, dedup, and related-links) and a real Shopify Metaobject via `metaobjectUpsert` (the actual publishing mechanism named in the spec). The Metaobject ID is stored back on the DB row (`shopifyPageId`).

### 14. SQLite via Prisma, not Postgres/MySQL
The template ships with this already configured for sessions; extending it for `PublishedPage` and `ShopSettings` avoids introducing new infrastructure. Appropriate for a single-instance dev/test deployment; switching providers for a multi-instance production deployment is a one-line change to `schema.prisma`'s `datasource` block, not a rewrite.

### 15. Upsert, not create, for publish operations
`PublishedPage` has a `@@unique([shop, slug, locale])` constraint. Regenerating an existing keyword (e.g. after the catalog grows, or retrying a previously-flagged page) needed to update the existing row, not fail on a constraint violation. `upsert` handles both the first-time and repeat cases with the same code path.

### 16. Public, unauthenticated routes for llms.txt and sitemap-ai.xml
These files are meant to be fetched by AI crawlers, which cannot complete an OAuth login flow, so unlike every other route in this app, they deliberately do NOT call `authenticate.admin()`. Shop is resolved via a `?shop=` query parameter as a stand-in appropriate for a single dev store; a production version would resolve shop from the storefront domain itself.

### 17. Bottleneck for AI rate limiting, not p-limit
`p-limit` only caps concurrent calls; it doesn't prevent bursts within a time window. Mistral's free tier limits requests per minute (4/min), which is a rate-over-time constraint, not a concurrency constraint. `Bottleneck`'s reservoir/refill model matches this shape directly. All AI calls in the intent parser route through a shared limiter (`app/lib/ai-throttle/`).

### 18. Batched alt text generation, not one AI call per product
`generateAltTexts()` sends all matched products for a page in a single AI call with a structured array output, rather than N separate calls. Cheaper, faster, and reduces exposure to per-minute rate limits at scale.

### 19. PapaParse for CSV parsing, not hand-rolled string splitting
An initial hand-rolled parser (`split("\n")`, `split(",")`) broke on a real-world file containing a UTF-8 BOM. The BOM character corrupted the header-detection check and, combined with a downstream bug, caused a keyword to be mangled character by character before reaching the matcher. Replaced with `papaparse`, a maintained library that correctly handles BOMs, quoting, and encoding edge cases that are easy to miss by hand.

### 20. Settings are captured but only partially wired into the pipeline (see Known Gaps)
`ShopSettings` (default locale, brand tone, competitor URLs, AI provider/model) persists correctly to the database. `defaultLocale` is read back and used to pre-fill the Generate screen. `brandTone` and `competitorUrls` are captured but not yet consumed by the generation prompt, a real but honestly-scoped gap. The AI API key deliberately remains env-only rather than DB-stored, since storing a live secret in a plain database table is a real security risk that a settings-UI convenience doesn't justify.

### 21. Draft as a real, separate status, not just a UI label
The Merchant UI spec names draft, published, and needs review as the three required statuses, but the original generation flow only ever produced the latter two. "Save as draft" now runs the full content pipeline (intent, matching, generation, alt text, JSON-LD, related links) but deliberately stops before `publishPlpMetaobject`, so nothing goes live on the store until the merchant chooses to publish it. Publishing a draft later reuses the already-generated content rather than calling the AI provider a second time, since the content was already produced and approved once.

### 22. Review page publishes through the same full pipeline as a fresh generate, not a status flip
A `needs_review` page is saved with empty content (no sections, no FAQ, no schema markup) because it never reached generation. Simply flipping its status to `published` would put a live-looking, empty page on the dashboard with no real content and no Shopify object behind it, which is worse than leaving it in review. Instead, approving a review re-runs the same content generation, alt text, JSON-LD, dedup check, and Shopify publish steps a fresh generate would use, applied to whatever product set the merchant has selected on the review screen. The 6-product minimum is still enforced by default here too; an explicit "publish anyway" checkbox is the only way to override it, and doing so is visible afterward in the saved `product_count`, so an override is always traceable in the data rather than silent.

### 23. Deleting a page also deletes its live Shopify metaobject
Early versions of the dashboard delete action only removed the local DB row, which would leave a real, unmanaged Metaobject sitting on the store with nothing in the app referencing it anymore. `deletePlpMetaobject()` is called first when a `shopifyPageId` exists, and the DB row is only removed after. If the Shopify deletion fails, the local row is still removed (it's the merchant-facing record) but the failure is surfaced in the UI so the merchant knows to check Shopify directly, rather than silently leaving an orphan.

### 24. The landing page was rebuilt from Shopify CLI's demo scaffold
The template's default `/app` route ships as a "Generate a product" demo unrelated to this app, and the original nav only linked to that demo and an unused "Additional page." Every real feature (dashboard, generate, keyword manager, CSV upload, settings) was reachable only by typing the exact URL, which isn't a reasonable expectation for a merchant using an embedded admin app. The index route now shows live status counts and a card per feature with a direct link, so the whole app is navigable without knowing any route names in advance.

---

## Required questions

### How do you prevent thin content? What happens when a query matches fewer than 6 products?
Matching enforces a minimum threshold (default 6). Below it, an automatic generation attempt is saved with `status: "needs_review"` and never reaches AI generation, so no content is generated for a page that won't publish by default. The dashboard surfaces a live count of needs-review pages for merchant action, and the dedicated review screen (`/app/review/:id`) lets a merchant look at the full catalog, adjust which products are included, and either bring the page above threshold or explicitly override the minimum with a visible, traceable checkbox. The override is intentionally not silent: pages published this way keep their true `product_count` in the data, so a below-threshold publish is always identifiable later.

### How does your prompt strategy differentiate pages targeting adjacent queries?
Each generation call receives the full structured intent (not just the raw keyword), the specific matched products, market context (language, units, currency, local terms), and a page-type-specific system prompt (see decision #7), never one generic prompt for everything. Verified in testing: a botanical living room page focused on furniture pairing and lighting, a peel-and-stick renters page focused on installation and damage-free removal, and neither reads as the other with the noun swapped. A German market page used correct local terminology and metric units throughout, not translated English.

### How do related PLPs link to each other internally?
Computed automatically at generation time (decision #11) by comparing the new page's intent against all currently-published pages in the same locale, using the same similarity function as dedup but a different, lower threshold band (25% to 70% overlap counts as related). This produces real links once enough overlapping pages exist; see Known Gaps for its behavior on a small catalog.

### Why did you choose your publishing mechanism?
Shopify Metaobjects (decision #13), because the content is structured and repeatable, matching Metaobjects' intended use case, and it's explicitly named as an option in the spec. Combined with local DB storage for fast dashboard, dedup, and related-links queries that would be slower against the Admin API directly.

### How does adding a new locale work? What does the merchant actually do?
A developer adds one entry to `app/lib/locale/config.ts` (language, units, currency, URL prefix, terminology overrides), with zero changes needed to generation, matching, or SEO logic, all of which read from this config at runtime. Verified: the same keyword produced genuinely different, locally-appropriate English and German pages from this config alone, including correct metric measurements and German-specific terminology rather than a translated English page.

### How is your content structure optimized for AI retrieval, not just Google?
`llms.txt` and `sitemap-ai.xml` (decision #16) are real, publicly fetchable, auto-regenerating files listing every published page with its intent, slug, and summary. Separately, every generated FAQ answer is written to be standalone, understandable without surrounding page context, which is what allows an AI system to cite an individual answer directly rather than needing the whole page for context.

### Known gaps and what you'd build next
- **Settings to prompt integration.** `brandTone` and `competitorUrls` are captured and persisted but not yet injected into the generation prompt.
- **Auto-discovery includes Shopify's default "frontpage" collection.** Harmless but not a real product category; a production version would exclude system collections.
- **Match preview and generate are one screen now** (originally two, merged during development) but still submit as separate requests (preview, then generate) rather than one continuous flow.
- **CSV parsing** initially had a real bug (BOM handling, decision #19) caught through live testing and fixed by switching to a proper library, a reminder that hand-rolled parsing of user-uploaded files is a common, easy-to-underestimate source of bugs.
- **No keyword ranking/volume data.** Auto-discovery surfaces catalog-derived candidates but doesn't score them by actual search volume or difficulty. A production version would integrate a search API (DataForSEO, Google Search Console) to rank candidates before surfacing them; the current architecture doesn't yet have this abstraction.
- **Internal linking can return empty on a small catalog.** The mechanism is verified working (decision #11), but it depends on enough already-published pages sharing overlapping intent fields to clear the relatedness threshold. On this project's small seed catalog, pages with genuinely different intents (a botanical living-room page and a peel-and-stick renters page, for example) correctly find no related pages, since there isn't enough real overlap yet. A store's actual catalog, or simply more published pages over time, would surface real links; this is a data-sparsity limitation of the test environment, not a defect in the matching logic.
- **Edit for an existing published page** currently means regenerating it from `/app/generate` with the same keyword and locale, which re-runs the full pipeline rather than allowing field-level edits to already-published content. A true in-place editor is a reasonable next step.

---

## Example JSON outputs

Three examples generated and verified during development (style-based, use-case-based, non-English locale) are available in `/example-output`, captured from real, live generation runs against the actual AI provider and Shopify catalog, not fabricated samples.

- `style-room-botanical-living-room.json`: style-based (botanical x living room)
- `use-case-peel-and-stick-renters.json`: use-case-based (peel and stick for renters)
- `locale-de-de-example.json`: non-English locale (de-DE)

