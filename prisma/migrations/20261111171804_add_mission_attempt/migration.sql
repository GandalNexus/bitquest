-- CreateTable
CREATE TABLE "MissionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "questCode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CREATED',
    "launchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "proofId" TEXT,
    "resultJson" TEXT,
    "returnTo" TEXT,

    CONSTRAINT "MissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionAttempt_userId_state_idx" ON "MissionAttempt"("userId", "state");

-- CreateIndex
CREATE INDEX "MissionAttempt_userId_launchedAt_idx" ON "MissionAttempt"("userId", "launchedAt");

-- CreateIndex
CREATE INDEX "MissionAttempt_questCode_idx" ON "MissionAttempt"("questCode");

-- CreateIndex
CREATE INDEX "MissionAttempt_state_expiresAt_idx" ON "MissionAttempt"("state", "expiresAt");

-- AddForeignKey
ALTER TABLE "MissionAttempt" ADD CONSTRAINT "MissionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
