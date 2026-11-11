DROP INDEX "VideoJob_draftId_key";

ALTER TABLE "VideoJob" ADD COLUMN "activeDraftId" TEXT;

UPDATE "VideoJob"
SET "activeDraftId" = "draftId"
WHERE "status" IN ('QUEUED', 'RUNNING', 'UNKNOWN');

CREATE UNIQUE INDEX "VideoJob_activeDraftId_key" ON "VideoJob"("activeDraftId");
CREATE INDEX "VideoJob_draftId_createdAt_idx" ON "VideoJob"("draftId", "createdAt");
