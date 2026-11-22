-- Ajout du modèle Partner (sponsors / partenaires affichés sur /gandalnexus).
-- Additive uniquement : nouvelle table, aucun impact sur l'existant.

CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "initials" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Partner_order_idx" ON "Partner"("order");
CREATE INDEX "Partner_publishedAt_idx" ON "Partner"("publishedAt");
CREATE INDEX "Partner_tier_idx" ON "Partner"("tier");
