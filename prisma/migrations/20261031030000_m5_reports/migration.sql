-- M5: PDF hisobot ishlari (TZ 9.9).
-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

-- DropForeignKey
ALTER TABLE "calculation_shares" DROP CONSTRAINT "calculation_shares_calculation_fkey";

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "calculation_id" UUID NOT NULL,
    "lang" VARCHAR(8) NOT NULL DEFAULT 'uz',
    "qr_mode" VARCHAR(16) NOT NULL DEFAULT 'NONE',
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "object_key" VARCHAR(300),
    "error" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_jobs_user_id_createdAt_idx" ON "report_jobs"("user_id", "createdAt");


ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_calculation_fkey" FOREIGN KEY ("calculation_id") REFERENCES "calculations"("id") ON DELETE CASCADE;
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
