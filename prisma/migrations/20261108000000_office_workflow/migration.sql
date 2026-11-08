CREATE TABLE "OfficeTicket" (
  "id" TEXT NOT NULL,
  "division" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficeDraft" (
  "id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "ticketId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficeDraftEvent" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeDraftEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OfficeDraft" ADD CONSTRAINT "OfficeDraft_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "OfficeTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficeDraftEvent" ADD CONSTRAINT "OfficeDraftEvent_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "OfficeDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
