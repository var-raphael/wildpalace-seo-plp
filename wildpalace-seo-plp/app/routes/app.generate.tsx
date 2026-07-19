import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useSearchParams, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

import { parseIntent } from "../lib/intent/parser";
import { matchProducts } from "../lib/matching/matcher";
import { fetchStoreCatalog } from "../lib/matching/shopify-catalog";
import { generatePLPContent } from "../lib/generation/generate-plp";
import { buildJsonLd } from "../lib/seo/json-ld";
import { generateAltTexts } from "../lib/seo/alt-text";
import { publishPlpMetaobject } from "../lib/publishing/shopify-publish";
import {
  checkAgainstExistingPages,
  type PublishedPage as SimilarityPage,
} from "../lib/dedup/similarity";
import {
  findRelatedPages,
  type LinkCandidate,
} from "../lib/internal-linking/internal-links";
import type { ParsedIntent } from "../lib/intent/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await db.shopSettings.findUnique({
    where: { shop: session.shop },
  });
  return {
    defaultLocale: settings?.defaultLocale ?? "en-US",
    brandTone: settings?.brandTone ?? "",
  };
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const keyword = String(formData.get("keyword") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en-US");
  const mode = String(formData.get("intent") ?? "generate");

  if (!keyword) {
    return { error: "Please enter a keyword.", mode: "error" as const };
  }

  const catalog = await fetchStoreCatalog(admin);
  const intent = await parseIntent(keyword);
  const { matchedProducts, meetsThreshold, threshold } = matchProducts(
    intent,
    catalog,
  );

  const slug = slugify(keyword);

  // Preview-only path: return matches without generating or publishing,
  // so the merchant can sanity-check before spending an AI call.
  if (mode === "preview") {
    return {
      mode: "preview" as const,
      intent,
      matchedProducts,
      meetsThreshold,
      threshold,
    };
  }

  if (!meetsThreshold) {
    const saved = await db.publishedPage.upsert({
      where: { shop_slug_locale: { shop, slug, locale } },
      create: {
        shop,
        slug,
        locale,
        status: "needs_review",
        h1: keyword,
        intro: "",
        sectionsJson: "[]",
        faqJson: "[]",
        metaTitle: "",
        metaDescription: "",
        schemaMarkupJson: "{}",
        relatedLinksJson: "[]",
        altTextsJson: "{}",
        intentJson: JSON.stringify(intent),
        productIds: matchedProducts.map((p) => p.id).join(","),
        productCount: matchedProducts.length,
      },
      update: {
        status: "needs_review",
        intentJson: JSON.stringify(intent),
        productIds: matchedProducts.map((p) => p.id).join(","),
        productCount: matchedProducts.length,
      },
    });

    return {
      mode: "result" as const,
      status: "needs_review" as const,
      message: `Only ${matchedProducts.length} matching products found (minimum ${threshold} required). Saved for merchant review, not published.`,
      pageId: saved.id,
    };
  }

  const existingRecords = await db.publishedPage.findMany({
    where: { shop, locale, status: "published" },
  });

  const existingForSimilarity: SimilarityPage[] = existingRecords
    .filter((r) => r.slug !== slug)
    .map((r) => ({
      slug: r.slug,
      locale: r.locale,
      intent: JSON.parse(r.intentJson) as ParsedIntent,
    }));

  const similarityResult = checkAgainstExistingPages(
    intent,
    locale,
    existingForSimilarity,
  );

  if (similarityResult.isDuplicate) {
    return {
      mode: "result" as const,
      status: "blocked_duplicate" as const,
      message: `This keyword is too similar to an existing page (${(similarityResult.similarityScore * 100).toFixed(0)}% match). Not publishing a near-duplicate.`,
      canonicalSlug: similarityResult.mostSimilarPage?.slug,
    };
  }

  const linkCandidates: LinkCandidate[] = existingRecords
    .filter((r) => r.slug !== slug)
    .map((r) => ({
      slug: r.slug,
      locale: r.locale,
      h1: r.h1,
      intent: JSON.parse(r.intentJson) as ParsedIntent,
    }));

  const relatedLinks = findRelatedPages(intent, slug, linkCandidates);

  const plp = await generatePLPContent({
    intent,
    products: matchedProducts,
    locale,
  });

  const altTexts = await generateAltTexts(
    matchedProducts.map((p) => ({ id: p.id, title: p.title })),
    intent,
  );

  const pageUrl = `https://wildpalace.com/${locale.toLowerCase()}/${slug}`;
  const jsonLd = buildJsonLd({
    plp,
    products: matchedProducts,
    pageUrl,
    storeName: "Wild Palace",
    storeUrl: "https://wildpalace.com",
    locale,
  });

  const metaobjectResult = await publishPlpMetaobject({
    admin,
    slug,
    locale,
    h1: plp.h1,
    intro: plp.intro,
    sectionsJson: JSON.stringify(plp.sections),
    faqJson: JSON.stringify(plp.faq),
    metaTitle: plp.meta_title,
    metaDescription: plp.meta_description,
    schemaMarkupJson: JSON.stringify(jsonLd),
  });

  const saved = await db.publishedPage.upsert({
    where: { shop_slug_locale: { shop, slug, locale } },
    create: {
      shop,
      slug,
      locale,
      status: "published",
      relatedLinksJson: JSON.stringify(relatedLinks),
      altTextsJson: JSON.stringify(altTexts),
      shopifyPageId: metaobjectResult.metaobjectId,
      h1: plp.h1,
      intro: plp.intro,
      sectionsJson: JSON.stringify(plp.sections),
      faqJson: JSON.stringify(plp.faq),
      metaTitle: plp.meta_title,
      metaDescription: plp.meta_description,
      schemaMarkupJson: JSON.stringify(jsonLd),
      intentJson: JSON.stringify(intent),
      productIds: matchedProducts.map((p) => p.id).join(","),
      productCount: matchedProducts.length,
      publishedAt: new Date(),
    },
    update: {
      status: "published",
      relatedLinksJson: JSON.stringify(relatedLinks),
      altTextsJson: JSON.stringify(altTexts),
      shopifyPageId: metaobjectResult.metaobjectId,
      h1: plp.h1,
      intro: plp.intro,
      sectionsJson: JSON.stringify(plp.sections),
      faqJson: JSON.stringify(plp.faq),
      metaTitle: plp.meta_title,
      metaDescription: plp.meta_description,
      schemaMarkupJson: JSON.stringify(jsonLd),
      intentJson: JSON.stringify(intent),
      productIds: matchedProducts.map((p) => p.id).join(","),
      productCount: matchedProducts.length,
      publishedAt: new Date(),
    },
  });

  return {
    mode: "result" as const,
    status: "published" as const,
    message: `Published: ${plp.h1}${metaobjectResult.errors.length > 0 ? " (Shopify metaobject sync had issues — see server logs)" : ""}`,
    page: { ...saved, plp, jsonLd, relatedLinks, altTexts },
  };
};

export default function GeneratePage() {
  const { defaultLocale } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [locale, setLocale] = useState(defaultLocale);
  const isLoading = fetcher.state !== "idle";

  const handlePreview = () => {
    fetcher.submit({ keyword, locale, intent: "preview" }, { method: "POST" });
  };

  const handleGenerate = () => {
    fetcher.submit({ keyword, locale, intent: "generate" }, { method: "POST" });
  };

  const result = fetcher.data;

  return (
    <s-page heading="Generate PLP">
      <s-section heading="Enter a keyword">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Keyword"
            value={keyword}
            onChange={(e: any) => setKeyword(e.target.value)}
            placeholder="e.g. sustainable midnight blue wallpaper kids room"
          />
          <s-select
            label="Locale"
            value={locale}
            onChange={(e: any) => setLocale(e.target.value)}
          >
            <s-option value="en-US">English (US)</s-option>
            <s-option value="en-AU">English (Australia)</s-option>
            <s-option value="de-DE">German</s-option>
          </s-select>
          <s-stack direction="inline" gap="base">
            <s-button
              variant="tertiary"
              onClick={handlePreview}
              {...(isLoading ? { loading: true } : {})}
            >
              Preview Match
            </s-button>
            <s-button
              onClick={handleGenerate}
              {...(isLoading ? { loading: true } : {})}
            >
              Generate PLP
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      {result?.mode === "preview" && (
        <s-section heading="Match preview">
          <s-badge tone={result.meetsThreshold ? "success" : "warning"}>
            {result.matchedProducts.length} / {result.threshold} minimum
          </s-badge>
          {result.matchedProducts.length > 0 && (
            <s-unordered-list>
              {result.matchedProducts.map((p: any) => (
                <s-list-item key={p.id}>{p.title}</s-list-item>
              ))}
            </s-unordered-list>
          )}
          <s-paragraph>
            Review the matches above, then click "Generate PLP" to continue.
          </s-paragraph>
        </s-section>
      )}

      {result?.mode === "error" && (
        <s-section heading="Result">
          <s-paragraph>{result.error}</s-paragraph>
        </s-section>
      )}

      {result?.mode === "result" && (
        <s-section heading="Result">
          <s-stack direction="block" gap="base">
            <s-badge
              tone={
                result.status === "published"
                  ? "success"
                  : result.status === "needs_review"
                    ? "warning"
                    : "critical"
              }
            >
              {result.status}
            </s-badge>
            <s-paragraph>{result.message}</s-paragraph>

            {result.status === "published" && "page" in result && (
              <>
                {result.page.relatedLinks.length > 0 && (
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <s-heading>Related pages (auto-linked)</s-heading>
                    <s-unordered-list>
                      {result.page.relatedLinks.map((link: any) => (
                        <s-list-item key={link.slug}>
                          {link.h1} — {link.reason}
                        </s-list-item>
                      ))}
                    </s-unordered-list>
                  </s-box>
                )}
                {Object.keys(result.page.altTexts).length > 0 && (
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <s-heading>Product image alt text</s-heading>
                    <s-unordered-list>
                      {Object.entries(result.page.altTexts).map(
                        ([id, text]: [string, any]) => (
                          <s-list-item key={id}>{text}</s-list-item>
                        ),
                      )}
                    </s-unordered-list>
                  </s-box>
                )}
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                    <code>{JSON.stringify(result.page.plp, null, 2)}</code>
                  </pre>
                </s-box>
              </>
            )}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
