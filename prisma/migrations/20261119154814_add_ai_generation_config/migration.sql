-- CreateTable
CREATE TABLE "AIGenerationConfig" (
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cadenceHours" INTEGER NOT NULL DEFAULT 24,
    "maxPerRun" INTEGER NOT NULL DEFAULT 1,
    "hint" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIGenerationConfig_pkey" PRIMARY KEY ("type")
);
