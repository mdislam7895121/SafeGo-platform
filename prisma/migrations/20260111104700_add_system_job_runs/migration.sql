-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SystemJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_job_runs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobCategory" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SystemJobStatus" NOT NULL DEFAULT 'RUNNING',
    "durationMs" INTEGER,
    "recordsProcessed" INTEGER,
    "recordsSucceeded" INTEGER,
    "recordsFailed" INTEGER,
    "errorSummary" TEXT,
    "errorDetails" JSONB,
    "triggeredBy" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'development',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_job_runs_jobName_idx" ON "system_job_runs"("jobName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_job_runs_jobCategory_idx" ON "system_job_runs"("jobCategory");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_job_runs_status_idx" ON "system_job_runs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_job_runs_startedAt_idx" ON "system_job_runs"("startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_job_runs_environment_idx" ON "system_job_runs"("environment");
