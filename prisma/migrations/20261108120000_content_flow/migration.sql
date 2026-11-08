CREATE TABLE "ContentFlow" (
  "id" TEXT NOT NULL,
  "sourceDraftId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentFlow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentFlow_sourceDraftId_key" ON "ContentFlow"("sourceDraftId");
ALTER TABLE "OfficeJob" ADD COLUMN "contentFlowId" TEXT;
ALTER TABLE "OfficeJob" ADD CONSTRAINT "OfficeJob_contentFlowId_fkey"
  FOREIGN KEY ("contentFlowId") REFERENCES "ContentFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
