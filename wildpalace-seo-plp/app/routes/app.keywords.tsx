import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { fetchStoreCatalog } from "../lib/matching/shopify-catalog";
import { discoverKeywords } from "../lib/keyword-discovery/auto-discover";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const catalog = await fetchStoreCatalog(admin);
  const candidates = discoverKeywords(catalog);

  // Cap what we show — a real catalog could produce hundreds of
  // combinations; surfacing all of them at once isn't useful to a merchant.
  return { candidates: candidates.slice(0, 50), totalFound: candidates.length };
};

export default function KeywordManager() {
  const { candidates, totalFound } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <s-page heading="Keyword Manager">
      <s-section heading={`Discovered keywords (${candidates.length} of ${totalFound})`}>
        <s-paragraph>
          Auto-generated from your store's product tags and collections.
          Click any keyword to generate a PLP for it.
        </s-paragraph>

        {candidates.length === 0 ? (
          <s-paragraph>
            No keyword candidates found. Make sure your products have tags
            and are assigned to collections.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Keyword</s-table-header>
              <s-table-header>Source</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {candidates.map((c) => (
                <s-table-row key={c.keyword}>
                  <s-table-cell>{c.keyword}</s-table-cell>
                  <s-table-cell>{c.source}</s-table-cell>
                  <s-table-cell>
                    <s-button
                      variant="tertiary"
                      onClick={() =>
                        navigate(
                          `/app/generate?keyword=${encodeURIComponent(c.keyword)}`,
                        )
                      }
                    >
                      Generate
                    </s-button>
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
