CREATE TABLE "Warung" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warung_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warung_normalizedName_key" ON "Warung"("normalizedName");

CREATE TABLE "WarungLicense" (
    "id" TEXT NOT NULL,
    "warungId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarungLicense_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WarungLicense_warungId_fkey" FOREIGN KEY ("warungId") REFERENCES "Warung"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "WarungLicense_warungId_createdAt_idx" ON "WarungLicense"("warungId", "createdAt");
