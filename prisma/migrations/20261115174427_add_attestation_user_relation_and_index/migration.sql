-- CreateIndex
CREATE INDEX "Attestation_userId_kind_idx" ON "Attestation"("userId", "kind");

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
