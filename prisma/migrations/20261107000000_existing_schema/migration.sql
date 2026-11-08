CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISED');

CREATE TABLE "knowledge_base" (
  "id" TEXT NOT NULL,
  "product_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "draft_tasks" (
  "id" TEXT NOT NULL,
  "division" TEXT NOT NULL,
  "staff_name" TEXT NOT NULL,
  "trigger_reason" TEXT NOT NULL,
  "content_title" TEXT NOT NULL,
  "full_content" TEXT NOT NULL,
  "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
  "target_platform" TEXT,
  "scheduled_time" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "draft_tasks_pkey" PRIMARY KEY ("id")
);
