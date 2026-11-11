ALTER TABLE "openrouter_usage" ADD COLUMN "product" TEXT;

CREATE INDEX "openrouter_usage_product_createdAt_idx" ON "openrouter_usage"("product", "createdAt");
