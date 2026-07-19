import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deletePlpMetaobject, publishPlpMetaobject } from "../lib/publishing/shopify-publish";

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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");
  const pageId = String(formData.get("pageId") ?? "");

  if (intent === "delete" && pageId) {
    // Scope to this shop so one merchant can't delete another's rows by
    // guessing/tampering with a pageId.
    const page = await db.publishedPage.findFirst({
      where: { id: pageId, shop },
    });

    if (!page) {
      return { ok: false, error: "Page not found." };
    }

    const shopifyErrors: string[] = [];

    // If a live Shopify metaobject backs this page, delete it first so we
    // don't leave an orphaned, unmanaged object on the store. If Shopify
    // deletion fails, we still remove the DB row (it's the merchant-facing
    // record) but surface the failure so the merchant knows to check Shopify.
    if (page.shopifyPageId) {
      const result = await deletePlpMetaobject(admin, page.shopifyPageId);
      if (result.errors.length > 0) {
        shopifyErrors.push(...result.errors);
      }
    }

    await db.publishedPage.delete({ where: { id: pageId } });

    return {
      ok: true,
      action: "delete" as const,
      deletedId: pageId,
      shopifyErrors: shopifyErrors.length > 0 ? shopifyErrors : undefined,
    };
  }

  if (intent === "publish" && pageId) {
    const page = await db.publishedPage.findFirst({
      where: { id: pageId, shop, status: "draft" },
    });

    if (!page) {
      return { ok: false, error: "Draft not found." };
    }

    // Content was already generated when this was saved as a draft — just
    // push the stored content to Shopify now. No new AI call.
    const metaobjectResult = await publishPlpMetaobject({
      admin,
      slug: page.slug,
      locale: page.locale,
      h1: page.h1,
      intro: page.intro,
      sectionsJson: page.sectionsJson,
      faqJson: page.faqJson,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      schemaMarkupJson: page.schemaMarkupJson,
    });

    await db.publishedPage.update({
      where: { id: pageId },
      data: {
        status: "published",
        shopifyPageId: metaobjectResult.metaobjectId,
        publishedAt: new Date(),
      },
    });

    return {
      ok: true,
      action: "publish" as const,
      publishedId: pageId,
      shopifyErrors: metaobjectResult.errors.length > 0 ? metaobjectResult.errors : undefined,
    };
  }

  return { ok: false };
};

function statusTone(status: string): "success" | "warning" | "critical" | "neutral" {
  if (status === "published") return "success";
  if (status === "needs_review") return "warning";
  if (status === "draft") return "neutral";
  return "neutral";
}

function DeleteButton({ pageId, title }: { pageId: string; title: string }) {
  const fetcher = useFetcher<typeof action>();
  const isDeleting = fetcher.state !== "idle";

  const handleDelete = () => {
    if (!confirm(`Delete "${title || "(untitled)"}"? This can't be undone.`)) {
      return;
    }
    fetcher.submit(
      { _action: "delete", pageId },
      { method: "POST" },
    );
  };

  const result = fetcher.data;
  const shopifyErrors =
    result && "shopifyErrors" in result && result.action === "delete"
      ? result.shopifyErrors
      : undefined;

  return (
    <s-stack direction="block" gap="base">
      <s-button
        variant="tertiary"
        tone="critical"
        onClick={handleDelete}
        {...(isDeleting ? { loading: true } : {})}
      >
        Delete
      </s-button>
      {shopifyErrors && shopifyErrors.length > 0 && (
        <s-text tone="critical">
          Deleted, but Shopify sync failed: {shopifyErrors.join(", ")}
        </s-text>
      )}
    </s-stack>
  );
}

function PublishButton({ pageId, title }: { pageId: string; title: string }) {
  const fetcher = useFetcher<typeof action>();
  const isPublishing = fetcher.state !== "idle";

  const handlePublish = () => {
    if (!confirm(`Publish "${title || "(untitled)"}" to Shopify now?`)) {
      return;
    }
    fetcher.submit(
      { _action: "publish", pageId },
      { method: "POST" },
    );
  };

  const result = fetcher.data;
  const shopifyErrors =
    result && "shopifyErrors" in result && result.action === "publish"
      ? result.shopifyErrors
      : undefined;

  return (
    <s-stack direction="block" gap="base">
      <s-button
        onClick={handlePublish}
        {...(isPublishing ? { loading: true } : {})}
      >
        Publish
      </s-button>
      {shopifyErrors && shopifyErrors.length > 0 && (
        <s-text tone="critical">
          Published, but Shopify sync had issues: {shopifyErrors.join(", ")}
        </s-text>
      )}
    </s-stack>
  );
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
              <s-table-header>Actions</s-table-header>
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
                  <s-table-cell>
                    <s-stack direction="inline" gap="base">
                      <s-button variant="tertiary" href={`/app/plp/${page.id}`}>
                        View
                      </s-button>
                      {page.status === "needs_review" && (
                        <s-button href={`/app/review/${page.id}`}>
                          Review
                        </s-button>
                      )}
                      {page.status === "draft" && (
                        <PublishButton pageId={page.id} title={page.h1} />
                      )}
                      <DeleteButton pageId={page.id} title={page.h1} />
                    </s-stack>
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
