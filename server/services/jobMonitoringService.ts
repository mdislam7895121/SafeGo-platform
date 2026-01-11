import { prisma } from '../db';
import { SystemJobStatus } from '@prisma/client';

let TABLE_MISSING_LOGGED = false;

function logTableMissingOnce(operation: string) {
  if (!TABLE_MISSING_LOGGED) {
    console.warn(`[JobMonitor] system_job_runs table not available - ${operation} skipped. Run Prisma migrations.`);
    TABLE_MISSING_LOGGED = true;
  }
}

function isTableMissingError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('P2021');
}

interface JobStartResult {
  id: string;
  startedAt: Date;
}

interface JobResult {
  recordsProcessed?: number;
  recordsSucceeded?: number;
  recordsFailed?: number;
  errorSummary?: string;
  errorDetails?: object;
  metadata?: object;
}

export type JobCategory = 
  | 'payments'
  | 'sync'
  | 'cleanup'
  | 'analytics'
  | 'notifications'
  | 'reconciliation'
  | 'kyc'
  | 'payout'
  | 'security';

export interface JobConfig {
  jobName: string;
  jobCategory: JobCategory;
  triggeredBy?: string;
  environment?: string;
  metadata?: object;
}

const STUB_JOB: JobStartResult = { id: 'stub-job-id', startedAt: new Date() };

export async function startJob(config: JobConfig): Promise<JobStartResult> {
  try {
    const job = await prisma.systemJobRun.create({
      data: {
        jobName: config.jobName,
        jobCategory: config.jobCategory,
        triggeredBy: config.triggeredBy || 'scheduler',
        environment: config.environment || process.env.NODE_ENV || 'development',
        metadata: config.metadata || {},
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    console.log(`[JobMonitor] Started job: ${config.jobName} (${job.id})`);
    
    return {
      id: job.id,
      startedAt: job.startedAt,
    };
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('startJob');
      return STUB_JOB;
    }
    throw error;
  }
}

export async function completeJob(
  jobId: string,
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED',
  result?: JobResult
): Promise<void> {
  if (jobId === 'stub-job-id') return;

  try {
    const job = await prisma.systemJobRun.findUnique({
      where: { id: jobId },
      select: { startedAt: true, jobName: true },
    });

    if (!job) {
      console.error(`[JobMonitor] Job not found: ${jobId}`);
      return;
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - job.startedAt.getTime();

    await prisma.systemJobRun.update({
      where: { id: jobId },
      data: {
        status: status as SystemJobStatus,
        finishedAt,
        durationMs,
        recordsProcessed: result?.recordsProcessed,
        recordsSucceeded: result?.recordsSucceeded,
        recordsFailed: result?.recordsFailed,
        errorSummary: result?.errorSummary,
        errorDetails: result?.errorDetails,
        metadata: result?.metadata,
      },
    });

    console.log(`[JobMonitor] Completed job: ${job.jobName} (${jobId}) - ${status} in ${durationMs}ms`);
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('completeJob');
      return;
    }
    throw error;
  }
}

export async function withJobTracking<T>(
  config: JobConfig,
  jobFn: () => Promise<T>
): Promise<T> {
  const jobStart = await startJob(config);
  
  try {
    const result = await jobFn();
    
    const jobResult: JobResult = {};
    if (typeof result === 'object' && result !== null) {
      const r = result as Record<string, any>;
      if ('recordsProcessed' in r) jobResult.recordsProcessed = r.recordsProcessed;
      if ('recordsSucceeded' in r) jobResult.recordsSucceeded = r.recordsSucceeded;
      if ('recordsFailed' in r) jobResult.recordsFailed = r.recordsFailed;
    }
    
    await completeJob(jobStart.id, 'SUCCESS', jobResult);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await completeJob(jobStart.id, 'FAILED', {
      errorSummary: errorMessage,
      errorDetails: { stack: errorStack },
    });
    
    throw error;
  }
}

export async function getRecentJobs(options?: {
  limit?: number;
  jobName?: string;
  jobCategory?: string;
  status?: SystemJobStatus;
  environment?: string;
}) {
  try {
    const where: Record<string, any> = {};
    
    if (options?.jobName) where.jobName = options.jobName;
    if (options?.jobCategory) where.jobCategory = options.jobCategory;
    if (options?.status) where.status = options.status;
    if (options?.environment) where.environment = options.environment;

    return await prisma.systemJobRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: options?.limit || 50,
    });
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('getRecentJobs');
      return [];
    }
    throw error;
  }
}

export async function getJobStats(timeRangeHours: number = 24) {
  try {
    const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    
    const jobs = await prisma.systemJobRun.findMany({
      where: { startedAt: { gte: since } },
      select: {
        status: true,
        jobCategory: true,
        durationMs: true,
      },
    });

    const byStatus = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCategory = jobs.reduce((acc, job) => {
      acc[job.jobCategory] = (acc[job.jobCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const durations = jobs.filter(j => j.durationMs).map(j => j.durationMs!);
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    return {
      total: jobs.length,
      byStatus,
      byCategory,
      avgDurationMs: Math.round(avgDuration),
      successRate: jobs.length > 0 
        ? Math.round((byStatus['SUCCESS'] || 0) / jobs.length * 100) 
        : 100,
      timeRangeHours,
    };
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('getJobStats');
      return {
        total: 0,
        byStatus: {},
        byCategory: {},
        avgDurationMs: 0,
        successRate: 100,
        timeRangeHours,
      };
    }
    throw error;
  }
}

export async function cancelJob(jobId: string, reason?: string): Promise<void> {
  if (jobId === 'stub-job-id') return;

  try {
    await prisma.systemJobRun.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        finishedAt: new Date(),
        errorSummary: reason || 'Job cancelled',
      },
    });
    
    console.log(`[JobMonitor] Cancelled job: ${jobId}`);
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('cancelJob');
      return;
    }
    throw error;
  }
}

export async function getRunningJobs() {
  try {
    return await prisma.systemJobRun.findMany({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'asc' },
    });
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('getRunningJobs');
      return [];
    }
    throw error;
  }
}

export async function getFailedJobs(limit: number = 20) {
  try {
    return await prisma.systemJobRun.findMany({
      where: { status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('getFailedJobs');
      return [];
    }
    throw error;
  }
}

export async function retryFailedJob(
  jobId: string,
  jobFn: () => Promise<any>,
  adminEmail: string
): Promise<string> {
  try {
    const originalJob = await prisma.systemJobRun.findUnique({
      where: { id: jobId },
    });

    if (!originalJob) {
      throw new Error('Original job not found');
    }

    const newJob = await startJob({
      jobName: originalJob.jobName,
      jobCategory: originalJob.jobCategory as JobCategory,
      triggeredBy: `retry:${adminEmail}`,
      metadata: {
        originalJobId: jobId,
        retryReason: 'manual_retry',
      },
    });

    try {
      await jobFn();
      await completeJob(newJob.id, 'SUCCESS');
      return newJob.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await completeJob(newJob.id, 'FAILED', {
        errorSummary: errorMessage,
      });
      throw error;
    }
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('retryFailedJob');
      throw new Error('Job monitoring not available - migrations pending');
    }
    throw error;
  }
}

export async function cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await prisma.systemJobRun.deleteMany({
      where: {
        startedAt: { lt: cutoffDate },
        status: { in: ['SUCCESS', 'CANCELLED'] },
      },
    });

    console.log(`[JobMonitor] Cleaned up ${result.count} old jobs`);
    return result.count;
  } catch (error) {
    if (isTableMissingError(error)) {
      logTableMissingOnce('cleanupOldJobs');
      return 0;
    }
    throw error;
  }
}
