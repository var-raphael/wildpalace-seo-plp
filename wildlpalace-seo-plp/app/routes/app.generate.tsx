import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

import { parseIntent } from "../lib/intent/parser";
import { matchProducts } from "../lib/matching/matcher";
import { MOCK_CATALOG } from "../lib/matching/mock-catalog";
import { generatePLPContent } from "../lib/generation/generate-plp";
import { buildJsonLd } from "../lib/seo/json-ld";
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
  await authenticate.admin(request);
  return null;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const keyword = String(formData.get("keyword") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en-US");

  if (!keyword) {
    return { error: "Please enter a keyword." };
  }

  const intent = await parseIntent(keyword);

  const { matchedProducts, meetsThreshold, threshold } = matchProducts(
    intent,
    MOCK_CATALOG,
  );

  const slug = slugify(keyword);

  if (!meetsThreshold) {
    const saved = await db.publishedPage.create({
      data: {
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
        intentJson: JSON.stringify(intent),
        productIds: matchedProducts.map((p) => p.id).join(","),
        productCount: matchedProducts.length,
      },
    });

    return {
      status: "needs_review" as const,
      message: `Only ${matchedProducts.length} matching products found (minimum ${threshold} required). Saved for merchant review, not published.`,
      pageId: saved.id,
    };
  }

  const existingRecords = await db.publishedPage.findMany({
    where: { shop, locale, status: "published" },
  });

  const existingForSimilarity: SimilarityPage[] = existingRecords.map((r) => ({
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
      status: "blocked_duplicate" as const,
      message: `This keyword is too similar to an existing page (${(similarityResult.similarityScore * 100).toFixed(0)}% match). Not publishing a near-duplicate.`,
      canonicalSlug: similarityResult.mostSimilarPage?.slug,
    };
  }

  const linkCandidates: LinkCandidate[] = existingRecords.map((r) => ({
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

  const pageUrl = `https://wildpalace.com/${locale.toLowerCase()}/${slug}`;
  const jsonLd = buildJsonLd({
    plp,
    products: matchedProducts,
    pageUrl,
    storeName: "Wild Palace",
    storeUrl: "https://wildpalace.com",
    locale,
  });

  const saved = await db.publishedPage.create({
    data: {
      shop,
      slug,
      locale,
      status: "published",
      relatedLinksJson: JSON.stringify(relatedLinks),
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
    status: "published" as const,
    message: `Published: ${plp.h1}`,
    page: { ...saved, plp, jsonLd, relatedLinks },
  };
};

export default function GeneratePage() {
  const fetcher = useFetcher<typeof action>();
  const [keyword, setKeyword] = useState("");
  const [locale, setLocale] = useState("en-US");
  const isLoading = fetcher.state !== "idle";

  const handleSubmit = () => {
    fetcher.submit({ keyword, locale }, { method: "POST" });
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
          <s-button
            onClick={handleSubmit}
            {...(isLoading ? { loading: true } : {})}
          >
            Generate PLP
          </s-button>
        </s-stack>
      </s-section>

      {result && (
        <s-section heading="Result">
          {"error" in result && <s-paragraph>{result.error}</s-paragraph>}

          {"status" in result && (
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
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                      <code>{JSON.stringify(result.page.plp, null, 2)}</code>
                    </pre>
                  </s-box>
                </>
              )}
            </s-stack>
          )}
        </s-section>
      )}
    </s-page>
  );
}

