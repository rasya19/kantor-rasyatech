CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoJob_draftId_key" ON "VideoJob"("draftId");
CREATE INDEX "VideoJob_status_createdAt_idx" ON "VideoJob"("status", "createdAt");
