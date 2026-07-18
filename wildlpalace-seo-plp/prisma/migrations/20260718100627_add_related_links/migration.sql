-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PublishedPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "h1" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "sectionsJson" TEXT NOT NULL,
    "faqJson" TEXT NOT NULL,
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "schemaMarkupJson" TEXT NOT NULL,
    "intentJson" TEXT NOT NULL,
    "productIds" TEXT NOT NULL,
    "productCount" INTEGER NOT NULL,
    "shopifyPageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "relatedLinksJson" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_PublishedPage" ("createdAt", "faqJson", "h1", "id", "intentJson", "intro", "locale", "metaDescription", "metaTitle", "productCount", "productIds", "publishedAt", "schemaMarkupJson", "sectionsJson", "shop", "shopifyPageId", "slug", "status") SELECT "createdAt", "faqJson", "h1", "id", "intentJson", "intro", "locale", "metaDescription", "metaTitle", "productCount", "productIds", "publishedAt", "schemaMarkupJson", "sectionsJson", "shop", "shopifyPageId", "slug", "status" FROM "PublishedPage";
DROP TABLE "PublishedPage";
ALTER TABLE "new_PublishedPage" RENAME TO "PublishedPage";
CREATE UNIQUE INDEX "PublishedPage_shop_slug_locale_key" ON "PublishedPage"("shop", "slug", "locale");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
