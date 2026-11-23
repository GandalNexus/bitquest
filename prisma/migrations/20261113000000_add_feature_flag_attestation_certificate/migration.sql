-- CreateTable: FeatureFlag (P3)
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "userIds" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateTable: Attestation (P3)
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_userId_kind_targetCode_key" ON "Attestation"("userId", "kind", "targetCode");
CREATE INDEX "Attestation_userId_issuedAt_idx" ON "Attestation"("userId", "issuedAt");
CREATE INDEX "Attestation_kind_targetCode_idx" ON "Attestation"("kind", "targetCode");

-- CreateTable: Certificate (P3)
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "attestationId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "publicUrl" TEXT,
    "signatureJson" TEXT NOT NULL DEFAULT '{}',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certificate_attestationId_idx" ON "Certificate"("attestationId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "Attestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
