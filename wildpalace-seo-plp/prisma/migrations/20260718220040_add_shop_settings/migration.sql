-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "aiProvider" TEXT NOT NULL DEFAULT 'mistral',
    "aiModel" TEXT NOT NULL DEFAULT 'mistral-large-latest',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en-US',
    "brandTone" TEXT NOT NULL DEFAULT '',
    "competitorUrls" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");
