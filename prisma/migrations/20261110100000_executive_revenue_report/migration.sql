CREATE TABLE "openrouter_usage" (
    "id" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" DECIMAL(20,12),
    "usageAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "openrouter_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "openrouter_usage_createdAt_idx" ON "openrouter_usage"("createdAt");
CREATE INDEX "openrouter_usage_division_createdAt_idx" ON "openrouter_usage"("division", "createdAt");

CREATE TABLE "business_leads" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "valueIdr" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "convertedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_leads_status_createdAt_idx" ON "business_leads"("status", "createdAt");
CREATE INDEX "business_leads_convertedAt_idx" ON "business_leads"("convertedAt");
CREATE INDEX "business_leads_soldAt_idx" ON "business_leads"("soldAt");
