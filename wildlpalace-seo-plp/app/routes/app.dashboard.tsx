import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const pages = await db.publishedPage.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = {
    published: pages.filter((p) => p.status === "published").length,
    needs_review: pages.filter((p) => p.status === "needs_review").length,
    draft: pages.filter((p) => p.status === "draft").length,
  };

  return { pages, counts };
};

function statusTone(status: string): "success" | "warning" | "critical" | "neutral" {
  if (status === "published") return "success";
  if (status === "needs_review") return "warning";
  if (status === "draft") return "neutral";
  return "neutral";
}

export default function Dashboard() {
  const { pages, counts } = useLoaderData<typeof loader>();

  return (
    <s-page heading="PLP Dashboard">
      <s-button slot="primary-action" href="/app/generate">
        Generate new PLP
      </s-button>

      <s-section heading="Overview">
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

      <s-section heading={`All PLPs (${pages.length})`}>
        {pages.length === 0 ? (
          <s-paragraph>
            No PLPs generated yet. Click "Generate new PLP" to create your first one.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Title</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Locale</s-table-header>
              <s-table-header>Products</s-table-header>
              <s-table-header>Slug</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {pages.map((page) => (
                <s-table-row key={page.id}>
                  <s-table-cell>{page.h1 || "(untitled)"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(page.status)}>{page.status}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{page.locale}</s-table-cell>
                  <s-table-cell>{page.productCount}</s-table-cell>
                  <s-table-cell>{page.slug}</s-table-cell>
                  <s-table-cell>
                    {new Date(page.createdAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
