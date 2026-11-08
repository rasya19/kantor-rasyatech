CREATE TABLE "OfficeJob" (
  "id" TEXT NOT NULL,
  "division" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instruction" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "ticketId" TEXT,
  "draftId" TEXT,
  "error" TEXT,
  "claimToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OfficeJob_status_createdAt_idx" ON "OfficeJob"("status", "createdAt");
