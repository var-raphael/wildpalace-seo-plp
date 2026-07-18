// app/lib/seo/meta-tags.ts

interface LocaleVariant {
  locale: string; // e.g. "en-us", "en-au"
  url: string;
}

interface MetaTagsInput {
  pageUrl: string; // this page's own canonical URL
  locale: string;
  localeVariants: LocaleVariant[]; // all locale versions of this same page, including itself
  isPublished: boolean; // false for drafts/below-threshold pages
}

export function buildMetaTags(input: MetaTagsInput) {
  const { pageUrl, locale, localeVariants, isPublished } = input;

  const canonical = `<link rel="canonical" href="${pageUrl}" />`;

  // hreflang: every locale variant must reference every other variant,
  // including itself (self-referencing is required by the spec).
  const hreflangTags = localeVariants
    .map(
      (variant) =>
        `<link rel="alternate" hreflang="${variant.locale}" href="${variant.url}" />`,
    )
    .join("\n");

  // Draft/below-threshold pages must never be indexed — Shopify indexes
  // published pages immediately, so this is a hard requirement, not optional.
  const robots = isPublished
    ? `<meta name="robots" content="index, follow" />`
    : `<meta name="robots" content="noindex, nofollow" />`;

  return { canonical, hreflangTags, robots };
}
