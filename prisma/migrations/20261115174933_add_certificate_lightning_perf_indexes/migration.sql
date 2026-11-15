-- CreateIndex
CREATE INDEX "Certificate_attestationId_format_idx" ON "Certificate"("attestationId", "format");

-- CreateIndex
CREATE INDEX "LightningReward_userId_status_createdAt_idx" ON "LightningReward"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LightningReward_failureReason_createdAt_idx" ON "LightningReward"("failureReason", "createdAt");
