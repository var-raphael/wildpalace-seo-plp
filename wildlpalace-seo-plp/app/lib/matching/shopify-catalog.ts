// Fetches real products from the connected Shopify store and reshapes
// them into the same MockProduct-compatible shape the matcher already
// expects, so matchProducts() doesn't need to change at all.
export interface ShopifyProduct {
  id: string;
  title: string;
  tags: string[];
  collection: string; // first collection handle the product belongs to
}

export async function fetchStoreCatalog(admin: any): Promise<ShopifyProduct[]> {
  const response = await admin.graphql(
    `#graphql
      query getCatalog {
        products(first: 100) {
          nodes {
            id
            title
            tags
            collections(first: 1) {
              nodes {
                handle
              }
            }
          }
        }
      }`,
  );

  const json = await response.json();
  const nodes = json.data?.products?.nodes ?? [];

  return nodes.map((p: any) => ({
    id: p.id,
    title: p.title,
    tags: p.tags ?? [],
    collection: p.collections?.nodes?.[0]?.handle ?? "",
  }));
}
