-- CreateTable
CREATE TABLE "BitLabProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questCode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BitLabProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BitLabProof_userId_idx" ON "BitLabProof"("userId");

-- CreateIndex
CREATE INDEX "BitLabProof_questCode_idx" ON "BitLabProof"("questCode");

-- CreateIndex
CREATE UNIQUE INDEX "BitLabProof_userId_questCode_kind_key" ON "BitLabProof"("userId", "questCode", "kind");

-- AddForeignKey
ALTER TABLE "BitLabProof" ADD CONSTRAINT "BitLabProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
