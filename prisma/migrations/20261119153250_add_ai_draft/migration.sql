-- CreateTable
CREATE TABLE "AIDraft" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "aiModel" TEXT NOT NULL,
    "promptHash" TEXT,
    "rejectReason" TEXT,
    "publishedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,

    CONSTRAINT "AIDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIDraft_status_type_createdAt_idx" ON "AIDraft"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AIDraft_createdAt_idx" ON "AIDraft"("createdAt");
