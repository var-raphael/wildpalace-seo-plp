// Publishes a generated PLP as a Shopify Metaobject entry. Metaobjects fit
// this use case well: structured, repeatable content with a defined schema,
// queryable via the Storefront API for rendering the actual live page.
export interface PublishToShopifyInput {
  admin: any;
  slug: string;
  locale: string;
  h1: string;
  intro: string;
  sectionsJson: string;
  faqJson: string;
  metaTitle: string;
  metaDescription: string;
  schemaMarkupJson: string;
}

export async function publishPlpMetaobject(
  input: PublishToShopifyInput,
): Promise<{ metaobjectId: string | null; errors: string[] }> {
  const { admin, slug, locale, h1, intro, sectionsJson, faqJson, metaTitle, metaDescription, schemaMarkupJson } = input;

  const response = await admin.graphql(
    `#graphql
      mutation upsertPlpMetaobject($handle: MetaobjectHandleInput!, $values: JSON!) {
        metaobjectUpsert(handle: $handle, values: $values) {
          metaobject { id handle }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        handle: { type: "$app:plp", handle: `${locale.toLowerCase()}-${slug}` },
        values: {
          title: h1,
          intro,
          sections: sectionsJson,
          faq: faqJson,
          meta_title: metaTitle,
          meta_description: metaDescription,
          schema_markup: schemaMarkupJson,
          locale,
          slug,
        },
      },
    },
  );

  const json = await response.json();
  const result = json.data?.metaobjectUpsert;
  const errors = (result?.userErrors ?? []).map((e: any) => e.message);

  return {
    metaobjectId: result?.metaobject?.id ?? null,
    errors,
  };
}


export async function deletePlpMetaobject(
  admin: any,
  metaobjectId: string,
): Promise<{ deletedId: string | null; errors: string[] }> {
  const response = await admin.graphql(
    `#graphql
      mutation deletePlpMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }`,
    {
      variables: { id: metaobjectId },
    },
  );

  const json = await response.json();
  const result = json.data?.metaobjectDelete;
  const errors = (result?.userErrors ?? []).map((e: any) => e.message);

  return {
    deletedId: result?.deletedId ?? null,
    errors,
  };
}
