CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);
