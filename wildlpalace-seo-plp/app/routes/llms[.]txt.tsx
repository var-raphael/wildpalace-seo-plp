import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { generateLlmsTxt } from "../lib/ai-presence/llms-txt";

// PUBLIC ROUTE — no authenticate.admin() here on purpose. This file is meant
// to be fetched by AI crawlers (ChatGPT, Perplexity, etc.), the same way
// robots.txt is fetched by search engine crawlers — neither can complete an
// OAuth login flow, so this must not require a Shopify admin session.
//
// Shop is resolved from a `?shop=` query param rather than a session, since
// there is no session for an anonymous crawler request. In production this
// would be served from the storefront domain directly (e.g.
// wildpalace.com/llms.txt) with the shop implicit from the domain itself;
// the query-param version here is a stand-in appropriate for a single dev
// store during testing.
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

  const content = generateLlmsTxt({
    storeName: "Wild Palace",
    storeUrl: `https://${shop}`,
    storeDescription:
      "Wild Palace is a premium wallpaper brand offering sustainable, design-forward wallpaper for every room.",
    collections: ["Living Room", "Bedroom", "Kids Room", "Nursery"],
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
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

