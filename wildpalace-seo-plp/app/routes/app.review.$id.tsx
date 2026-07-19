import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { fetchStoreCatalog } from "../lib/matching/shopify-catalog";
import { matchProducts } from "../lib/matching/matcher";
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

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const id = params.id;

  if (!id) {
    throw new Response("Not found", { status: 404 });
  }

  const page = await db.publishedPage.findFirst({
    where: { id, shop, status: "needs_review" },
  });

  if (!page) {
    throw new Response("Not found or not pending review", { status: 404 });
  }

  const catalog = await fetchStoreCatalog(admin);
  const intent = JSON.parse(page.intentJson) as ParsedIntent;
  const currentlyMatchedIds = new Set(
    page.productIds ? page.productIds.split(",") : [],
  );

  // Re-score against the full catalog so the merchant can see everything
  // available, not just what the automatic matcher originally picked.
  const { matchedProducts, threshold } = matchProducts(intent, catalog, 6);
  const matchedIds = new Set(matchedProducts.map((p) => p.id));

  return {
    page: { id: page.id, h1: page.h1, locale: page.locale, slug: page.slug },
    intent,
    threshold,
    catalog,
    // Pre-check: whatever was matched at save time, union with a fresh match
    // in case the catalog changed since. Merchant can uncheck/check freely.
    preselectedIds: Array.from(new Set([...currentlyMatchedIds, ...matchedIds])),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const id = params.id;

  if (!id) {
    return { error: "Missing page id." };
  }

  const page = await db.publishedPage.findFirst({
    where: { id, shop, status: "needs_review" },
  });

  if (!page) {
    return { error: "Page not found or already reviewed." };
  }

  const formData = await request.formData();
  const decision = String(formData.get("_action") ?? "");

  if (decision === "reject") {
    await db.publishedPage.delete({ where: { id } });
    return { ok: true, action: "reject" as const };
  }

  if (decision !== "approve") {
    return { error: "Unknown action." };
  }

  const selectedIds = formData.getAll("productId").map(String);
  const override = formData.get("override") === "on";

  const catalog = await fetchStoreCatalog(admin);
  const intent = JSON.parse(page.intentJson) as ParsedIntent;
  const selectedProducts = catalog.filter((p) => selectedIds.includes(p.id));

  const threshold = 6;
  const meetsThreshold = selectedProducts.length >= threshold;

  if (!meetsThreshold && !override) {
    return {
      error: `Only ${selectedProducts.length} products selected (minimum ${threshold}). Check "publish anyway" to override.`,
    };
  }

  // Same dedup + related-links + publish pipeline app.generate.tsx uses for
  // a fresh publish, applied here to the merchant-approved product set.
  const existingRecords = await db.publishedPage.findMany({
    where: { shop, locale: page.locale, status: "published" },
  });

  const existingForSimilarity: SimilarityPage[] = existingRecords
    .filter((r) => r.slug !== page.slug)
    .map((r) => ({
      slug: r.slug,
      locale: r.locale,
      intent: JSON.parse(r.intentJson) as ParsedIntent,
    }));

  const similarityResult = checkAgainstExistingPages(
    intent,
    page.locale,
    existingForSimilarity,
  );

  if (similarityResult.isDuplicate) {
    return {
      error: `Too similar to an existing page: ${similarityResult.mostSimilarPage?.slug} (${(similarityResult.similarityScore * 100).toFixed(0)}% match).`,
    };
  }

  const linkCandidates: LinkCandidate[] = existingRecords
    .filter((r) => r.slug !== page.slug)
    .map((r) => ({
      slug: r.slug,
      locale: r.locale,
      h1: r.h1,
      intent: JSON.parse(r.intentJson) as ParsedIntent,
    }));

  const relatedLinks = findRelatedPages(intent, page.slug, linkCandidates);

  const plp = await generatePLPContent({
    intent,
    products: selectedProducts,
    locale: page.locale,
  });

  const altTexts = await generateAltTexts(
    selectedProducts.map((p) => ({ id: p.id, title: p.title })),
    intent,
  );

  const pageUrl = `https://wildpalace.com/${page.locale.toLowerCase()}/${page.slug}`;
  const jsonLd = buildJsonLd({
    plp,
    products: selectedProducts,
    pageUrl,
    storeName: "Wild Palace",
    storeUrl: "https://wildpalace.com",
    locale: page.locale,
  });

  const metaobjectResult = await publishPlpMetaobject({
    admin,
    slug: page.slug,
    locale: page.locale,
    h1: plp.h1,
    intro: plp.intro,
    sectionsJson: JSON.stringify(plp.sections),
    faqJson: JSON.stringify(plp.faq),
    metaTitle: plp.meta_title,
    metaDescription: plp.meta_description,
    schemaMarkupJson: JSON.stringify(jsonLd),
  });

  await db.publishedPage.update({
    where: { id },
    data: {
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
      productIds: selectedProducts.map((p) => p.id).join(","),
      productCount: selectedProducts.length,
      publishedAt: new Date(),
    },
  });

  return {
    ok: true,
    action: "approve" as const,
    shopifyErrors: metaobjectResult.errors.length > 0 ? metaobjectResult.errors : undefined,
  };
};

export default function ReviewPage() {
  const { page, intent, threshold, catalog, preselectedIds } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set(preselectedIds));
  const [override, setOverride] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const isSubmitting = fetcher.state !== "idle";

  const filteredCatalog = catalog.filter((product) => {
    if (showSelectedOnly && !selected.has(product.id)) return false;
    if (!filterText.trim()) return true;
    const needle = filterText.toLowerCase();
    return (
      product.title.toLowerCase().includes(needle) ||
      product.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = () => {
    const formData = new FormData();
    formData.set("_action", "approve");
    if (override) formData.set("override", "on");
    selected.forEach((id) => formData.append("productId", id));
    fetcher.submit(formData, { method: "POST" });
  };

  const handleReject = () => {
    if (!confirm(`Reject and delete "${page.h1 || "(untitled)"}"? This can't be undone.`)) {
      return;
    }
    fetcher.submit({ _action: "reject" }, { method: "POST" });
  };

  const result = fetcher.data;

  if (result?.ok) {
    return (
      <s-page heading="Review complete">
        <s-section heading="Done">
          <s-paragraph>
            {result.action === "approve"
              ? "Page approved and published."
              : "Page rejected and removed."}
          </s-paragraph>
          {result.shopifyErrors && result.shopifyErrors.length > 0 && (
            <s-text tone="critical">
              Published, but Shopify sync had issues: {result.shopifyErrors.join(", ")}
            </s-text>
          )}
          <s-button onClick={() => navigate("/app/dashboard")}>
            Back to dashboard
          </s-button>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={`Review: ${page.h1 || "(untitled)"}`}>
      <s-section heading="Parsed intent">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            <code>{JSON.stringify(intent, null, 2)}</code>
          </pre>
        </s-box>
      </s-section>

      <s-section heading={`Products (${selected.size} selected, ${threshold} minimum)`}>
        <s-badge tone={selected.size >= threshold ? "success" : "warning"}>
          {selected.size} / {threshold} minimum
        </s-badge>
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Filter by title or tag"
            value={filterText}
            onChange={(e: any) => setFilterText(e.target.value)}
            placeholder="e.g. navy, kids-room"
          />
          <label>
            <input
              type="checkbox"
              checked={showSelectedOnly}
              onChange={(e) => setShowSelectedOnly(e.target.checked)}
            />{" "}
            Show selected only
          </label>
        </s-stack>
        {filteredCatalog.length === 0 && (
          <s-paragraph>No products match this filter.</s-paragraph>
        )}
        <s-unordered-list>
          {filteredCatalog.map((product) => (
            <s-list-item key={product.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggle(product.id)}
                />{" "}
                {product.title}{" "}
                {product.tags.length > 0 && (
                  <span style={{ opacity: 0.6 }}>({product.tags.join(", ")})</span>
                )}
              </label>
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      {result?.error && (
        <s-section heading="Cannot publish">
          <s-paragraph>{result.error}</s-paragraph>
        </s-section>
      )}

      <s-section heading="Decision">
        <s-stack direction="block" gap="base">
          {selected.size < threshold && (
            <label>
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />{" "}
              Publish anyway despite being below the {threshold}-product minimum
            </label>
          )}
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={handleApprove}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Approve &amp; publish
            </s-button>
            <s-button
              variant="tertiary"
              tone="critical"
              onClick={handleReject}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Reject &amp; delete
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
