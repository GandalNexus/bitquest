-- Baseline : BitLabProofAttempt a été créée hors-migration (prisma db push)
-- lors du hardening P0.x. Cette migration la déclare pour aligner l'historique
-- Prisma sur l'état réel de la DB. IF NOT EXISTS pour les environnements dev
-- qui ont déjà la table, idempotent sur une base fraîche.

CREATE TABLE IF NOT EXISTS "BitLabProofAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questCode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reasonMessage" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BitLabProofAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BitLabProofAttempt_userId_createdAt_idx"
    ON "BitLabProofAttempt"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "BitLabProofAttempt_questCode_createdAt_idx"
    ON "BitLabProofAttempt"("questCode", "createdAt");

CREATE INDEX IF NOT EXISTS "BitLabProofAttempt_outcome_createdAt_idx"
    ON "BitLabProofAttempt"("outcome", "createdAt");
