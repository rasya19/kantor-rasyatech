CREATE TABLE "VideoRuntimeConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "approvedBudgetIdr" INTEGER NOT NULL DEFAULT 100000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoRuntimeConfig_pkey" PRIMARY KEY ("id")
);
