import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const pages = await db.publishedPage.findMany({ where: { shop } });
  const counts = {
    published: pages.filter((p) => p.status === "published").length,
    needs_review: pages.filter((p) => p.status === "needs_review").length,
    draft: pages.filter((p) => p.status === "draft").length,
  };

  return { counts };
};

export default function Index() {
  const { counts } = useLoaderData<typeof loader>();

  return (
    <s-page heading="SEO PLP App">
      <s-button slot="primary-action" href="/app/generate">
        Generate a PLP
      </s-button>

      <s-section heading="Overview">
        <s-paragraph>
          Generate SEO-optimized Product Listing Pages at scale, matched to
          search intent and published straight to your store.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text>Published</s-text>
            <s-heading>{counts.published}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text>Needs Review</s-text>
            <s-heading>{counts.needs_review}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text>Draft</s-text>
            <s-heading>{counts.draft}</s-heading>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Get started">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Dashboard</s-heading>
              <s-paragraph>
                See every PLP you've generated — published, in draft, or
                waiting on review — and manage each one from a single table.
              </s-paragraph>
              <s-button href="/app/dashboard">Open dashboard</s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Generate a PLP</s-heading>
              <s-paragraph>
                Enter a keyword, preview which products match, then generate
                and publish a new page — or save it as a draft first.
              </s-paragraph>
              <s-button href="/app/generate">Generate</s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Keyword Manager</s-heading>
              <s-paragraph>
                Auto-discovered keyword opportunities pulled from your
                product tags, collections, and titles — no manual research
                needed.
              </s-paragraph>
              <s-button href="/app/keywords">View keywords</s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>CSV Upload</s-heading>
              <s-paragraph>
                Supplement or override auto-discovery with your own keyword
                list — one keyword per line.
              </s-paragraph>
              <s-button href="/app/csv-upload">Upload CSV</s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Settings</s-heading>
              <s-paragraph>
                Configure your AI provider, default locale, brand tone, and
                competitor URLs.
              </s-paragraph>
              <s-button href="/app/settings">Open settings</s-button>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
