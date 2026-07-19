import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = params.id;

  if (!id) {
    throw new Response("Not found", { status: 404 });
  }

  const page = await db.publishedPage.findFirst({
    where: { id, shop },
  });

  if (!page) {
    throw new Response("Not found", { status: 404 });
  }

  return {
    page: {
      ...page,
      sections: JSON.parse(page.sectionsJson || "[]"),
      faq: JSON.parse(page.faqJson || "[]"),
      schemaMarkup: JSON.parse(page.schemaMarkupJson || "{}"),
      intent: JSON.parse(page.intentJson || "{}"),
      relatedLinks: JSON.parse(page.relatedLinksJson || "[]"),
      altTexts: JSON.parse(page.altTextsJson || "{}"),
      productIds: page.productIds ? page.productIds.split(",") : [],
    },
  };
};

function statusTone(status: string): "success" | "warning" | "critical" | "neutral" {
  if (status === "published") return "success";
  if (status === "needs_review") return "warning";
  if (status === "draft") return "neutral";
  return "neutral";
}

export default function PlpDetail() {
  const { page } = useLoaderData<typeof loader>();

  return (
    <s-page heading={page.h1 || "(untitled)"}>
      <s-button slot="primary-action" href="/app/dashboard">
        Back to dashboard
      </s-button>

      <s-section heading="Overview">
        <s-stack direction="inline" gap="base">
          <s-badge tone={statusTone(page.status)}>{page.status}</s-badge>
          <s-text>Locale: {page.locale}</s-text>
          <s-text>Products matched: {page.productCount}</s-text>
          <s-text>Slug: {page.slug}</s-text>
          <s-text>Created: {new Date(page.createdAt).toLocaleString()}</s-text>
          {page.publishedAt && (
            <s-text>Published: {new Date(page.publishedAt).toLocaleString()}</s-text>
          )}
          {page.shopifyPageId && (
            <s-text>Shopify metaobject: {page.shopifyPageId}</s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Parsed intent">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            <code>{JSON.stringify(page.intent, null, 2)}</code>
          </pre>
        </s-box>
      </s-section>

      {page.intro && (
        <s-section heading="Intro">
          <s-paragraph>{page.intro}</s-paragraph>
        </s-section>
      )}

      {page.sections.length > 0 && (
        <s-section heading="Sections">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              <code>{JSON.stringify(page.sections, null, 2)}</code>
            </pre>
          </s-box>
        </s-section>
      )}

      {page.faq.length > 0 && (
        <s-section heading="FAQ">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              <code>{JSON.stringify(page.faq, null, 2)}</code>
            </pre>
          </s-box>
        </s-section>
      )}

      {(page.metaTitle || page.metaDescription) && (
        <s-section heading="Meta">
          <s-stack direction="block" gap="base">
            <s-text>Title: {page.metaTitle}</s-text>
            <s-text>Description: {page.metaDescription}</s-text>
          </s-stack>
        </s-section>
      )}

      {page.relatedLinks.length > 0 && (
        <s-section heading="Related pages">
          <s-unordered-list>
            {page.relatedLinks.map((link: any) => (
              <s-list-item key={link.slug}>
                {link.h1} — {link.reason}
              </s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}

      {Object.keys(page.altTexts).length > 0 && (
        <s-section heading="Product image alt text">
          <s-unordered-list>
            {Object.entries(page.altTexts).map(([id, text]: [string, any]) => (
              <s-list-item key={id}>{text}</s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}

      <s-section heading="Full JSON-LD schema markup">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            <code>{JSON.stringify(page.schemaMarkup, null, 2)}</code>
          </pre>
        </s-box>
      </s-section>
    </s-page>
  );
}
