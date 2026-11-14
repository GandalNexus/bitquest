-- CreateTable: LightningReward (P4 — sats réels, feature flag lightning.rewards)
CREATE TABLE "LightningReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceBolt11" TEXT NOT NULL,
    "amountMsat" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "preimageHex" TEXT,
    "feeMsat" INTEGER,
    "failureReason" TEXT,
    "attemptContext" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "LightningReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LightningReward_userId_createdAt_idx" ON "LightningReward"("userId", "createdAt");
CREATE INDEX "LightningReward_status_createdAt_idx" ON "LightningReward"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "LightningReward" ADD CONSTRAINT "LightningReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
