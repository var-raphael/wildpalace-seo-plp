import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { generateSitemapAi } from "../lib/ai-presence/sitemap-ai";

// PUBLIC ROUTE — same reasoning as llms.txt: AI crawlers cannot authenticate,
// so this must not require a Shopify admin session. See llms[.]txt.tsx for
// the full explanation of the shop-resolution approach used here.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  const pages = await db.publishedPage.findMany({
    where: { shop, status: "published" },
    orderBy: { publishedAt: "desc" },
  });

  const content = generateSitemapAi({
    storeUrl: `https://${shop}`,
    publishedPages: pages.map((p) => ({
      slug: p.slug,
      locale: p.locale,
      intent: JSON.parse(p.intentJson),
      h1: p.h1,
      metaDescription: p.metaDescription,
      productCount: p.productCount,
      publishedAt: p.publishedAt?.toISOString() ?? p.createdAt.toISOString(),
    })),
  });

  return new Response(content, {
    headers: { "Content-Type": "application/xml" },
  });
};

