import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

// The 4 collections we need. Each product will be assigned to one of these.
const COLLECTIONS = [
  { title: "Living Room", handle: "living-room" },
  { title: "Bedroom", handle: "bedroom" },
  { title: "Kids Room", handle: "kids-room" },
  { title: "Nursery", handle: "nursery" },
];

// Our test catalog. `collection` here refers to the handle above.
const PRODUCTS = [
  {
    title: "Botanical Grasscloth Wallpaper",
    tags: ["botanical", "grasscloth", "sustainable", "green"],
    collection: "living-room",
  },
  {
    title: "Midnight Blue Kids Wallpaper",
    tags: ["midnight-blue", "peel-and-stick", "playful"],
    collection: "kids-room",
  },
  {
    title: "Sustainable Sage Green Nursery Wallpaper",
    tags: ["sage-green", "sustainable", "organic"],
    collection: "nursery",
  },
  {
    title: "Peel and Stick Botanical Wallpaper (Renters)",
    tags: ["peel-and-stick", "botanical", "renter-friendly", "removable"],
    collection: "living-room",
  },
  {
    title: "Charcoal Geometric Living Room Wallpaper",
    tags: ["charcoal", "geometric", "modern"],
    collection: "living-room",
  },
  {
    title: "Blush Pink Floral Bedroom Wallpaper",
    tags: ["blush-pink", "floral", "romantic"],
    collection: "bedroom",
  },
  {
    title: "Textured Grasscloth Neutral Wallpaper",
    tags: ["grasscloth", "neutral", "beige", "natural-material"],
    collection: "living-room",
  },
  {
    title: "Navy Nautical Kids Wallpaper",
    tags: ["navy", "nautical", "playful"],
    collection: "kids-room",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // --- Step 1: create collections, remember their IDs by handle.
  // Skips creation if a collection with that handle already exists, so
  // re-running seed doesn't error or duplicate. ---
  const collectionIds: Record<string, string> = {};

  for (const col of COLLECTIONS) {
    const existingResponse = await admin.graphql(
      `#graphql
        query findCollectionByHandle($handle: String!) {
          collectionByHandle(handle: $handle) { id handle }
        }`,
      { variables: { handle: col.handle } },
    );
    const existingJson = await existingResponse.json();
    const existing = existingJson.data?.collectionByHandle;

    if (existing) {
      collectionIds[col.handle] = existing.id;
      continue;
    }

    const response = await admin.graphql(
      `#graphql
        mutation createCollection($input: CollectionInput!) {
          collectionCreate(input: $input) {
            collection { id handle }
            userErrors { field message }
          }
        }`,
      { variables: { input: { title: col.title, handle: col.handle } } },
    );
    const json = await response.json();
    const created = json.data?.collectionCreate?.collection;
    if (created) collectionIds[col.handle] = created.id;
  }

  // --- Step 2: create each product with its tags, skipping any that
  // already exist by title so re-running seed doesn't duplicate the catalog ---
  const createdProducts: any[] = [];

  for (const p of PRODUCTS) {
    const existingResponse = await admin.graphql(
      `#graphql
        query findProductByTitle($query: String!) {
          products(first: 1, query: $query) {
            nodes { id title handle tags }
          }
        }`,
      { variables: { query: `title:'${p.title.replace(/'/g, "\\'")}'` } },
    );
    const existingJson = await existingResponse.json();
    const existing = existingJson.data?.products?.nodes?.[0];

    if (existing) {
      createdProducts.push({ ...existing, collectionHandle: p.collection });
      continue;
    }

    const response = await admin.graphql(
      `#graphql
        mutation createProduct($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product { id title handle tags }
            userErrors { field message }
          }
        }`,
      {
        variables: {
          product: {
            title: p.title,
            tags: p.tags,
          },
        },
      },
    );
    const json = await response.json();
    const product = json.data?.productCreate?.product;
    if (product) {
      createdProducts.push({ ...product, collectionHandle: p.collection });
    }
  }

  // --- Step 3: assign each product to its collection ---
  for (const product of createdProducts) {
    const collectionId = collectionIds[product.collectionHandle];
    if (!collectionId) continue;

    await admin.graphql(
      `#graphql
        mutation addToCollection($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            userErrors { field message }
          }
        }`,
      { variables: { id: collectionId, productIds: [product.id] } },
    );
  }

  return { collections: collectionIds, products: createdProducts };
};

export default function Seed() {
  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state !== "idle";

  const runSeed = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Seed test data">
      <s-button
        slot="primary-action"
        onClick={runSeed}
        {...(isLoading ? { loading: true } : {})}
      >
        Seed wallpaper catalog
      </s-button>

      <s-section heading="Seed Wild Palace test catalog">
        <s-paragraph>
          Creates 4 collections and 8 wallpaper products with realistic tags,
          for testing intent parsing and product matching.
        </s-paragraph>
      </s-section>

      {fetcher.data && (
        <s-section heading="Result">
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(fetcher.data, null, 2)}
          </pre>
        </s-section>
      )}
    </s-page>
  );
}
