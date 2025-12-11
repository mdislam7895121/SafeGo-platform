import { prisma } from '../db';
import { SystemErrorSeverity } from '@prisma/client';

export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  driverId?: string;
  rideId?: string;
  orderId?: string;
  countryCode?: string;
  userAgent?: string;
  ipAddress?: string;
  requestPath?: string;
  requestMethod?: string;
  metadata?: object;
}

export interface LoggedError {
  id: string;
  service: string;
  severity: SystemErrorSeverity;
  errorCode?: string;
  errorType?: string;
  message: string;
  stackTrace?: string;
  context: ErrorContext;
  createdAt: Date;
}

export type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export async function logError(
  service: string,
  severity: Severity,
  message: string,
  error?: Error | unknown,
  context?: ErrorContext
): Promise<string> {
  const errorType = error instanceof Error ? error.constructor.name : undefined;
  const stackTrace = error instanceof Error ? error.stack : undefined;
  const errorCode = extractErrorCode(error);

  try {
    const record = await prisma.systemError.create({
      data: {
        service,
        severity: severity as SystemErrorSeverity,
        errorCode,
        errorType,
        message,
        stackTrace,
        correlationId: context?.correlationId,
        userId: context?.userId,
        driverId: context?.driverId,
        rideId: context?.rideId,
        orderId: context?.orderId,
        countryCode: context?.countryCode,
        userAgent: context?.userAgent,
        ipAddress: context?.ipAddress,
        requestPath: context?.requestPath,
        requestMethod: context?.requestMethod,
        environment: process.env.NODE_ENV || 'development',
        metadata: context?.metadata || {},
      },
    });

    if (severity === 'CRITICAL' || severity === 'ERROR') {
      console.error(`[${service}] ${severity}: ${message}`, error);
    } else if (severity === 'WARNING') {
      console.warn(`[${service}] ${severity}: ${message}`);
    }

    return record.id;
  } catch (logError) {
    console.error('[SystemError] Failed to log error:', logError);
    console.error('[SystemError] Original error:', service, severity, message, error);
    return '';
  }
}

function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  
  const e = error as Record<string, any>;
  return e.code || e.errorCode || e.status?.toString();
}

export async function logCritical(
  service: string,
  message: string,
  error?: Error | unknown,
  context?: ErrorContext
): Promise<string> {
  return logError(service, 'CRITICAL', message, error, context);
}

export async function logErrorLevel(
  service: string,
  message: string,
  error?: Error | unknown,
  context?: ErrorContext
): Promise<string> {
  return logError(service, 'ERROR', message, error, context);
}

export async function logWarning(
  service: string,
  message: string,
  context?: ErrorContext
): Promise<string> {
  return logError(service, 'WARNING', message, undefined, context);
}

export async function logInfo(
  service: string,
  message: string,
  context?: ErrorContext
): Promise<string> {
  return logError(service, 'INFO', message, undefined, context);
}

export interface ErrorFilters {
  service?: string;
  severity?: Severity;
  severities?: Severity[];
  isResolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  correlationId?: string;
  userId?: string;
  countryCode?: string;
  environment?: string;
  searchQuery?: string;
}

export async function getErrors(
  filters?: ErrorFilters,
  limit: number = 100,
  offset: number = 0
) {
  const where: Record<string, any> = {};

  if (filters?.service) where.service = filters.service;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.severities) where.severity = { in: filters.severities };
  if (filters?.isResolved !== undefined) where.isResolved = filters.isResolved;
  if (filters?.correlationId) where.correlationId = filters.correlationId;
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.countryCode) where.countryCode = filters.countryCode;
  if (filters?.environment) where.environment = filters.environment;

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  if (filters?.searchQuery) {
    where.OR = [
      { message: { contains: filters.searchQuery, mode: 'insensitive' } },
      { errorCode: { contains: filters.searchQuery, mode: 'insensitive' } },
      { service: { contains: filters.searchQuery, mode: 'insensitive' } },
    ];
  }

  const [errors, total] = await Promise.all([
    prisma.systemError.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.systemError.count({ where }),
  ]);

  return { errors, total };
}

export async function getErrorById(id: string) {
  return prisma.systemError.findUnique({
    where: { id },
  });
}

export async function resolveError(
  id: string,
  resolvedBy: string,
  resolution: string
): Promise<void> {
  await prisma.systemError.update({
    where: { id },
    data: {
      isResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      resolution,
    },
  });
}

export async function bulkResolveErrors(
  ids: string[],
  resolvedBy: string,
  resolution: string
): Promise<number> {
  const result = await prisma.systemError.updateMany({
    where: { id: { in: ids } },
    data: {
      isResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      resolution,
    },
  });
  return result.count;
}

export async function getErrorStats(timeRangeHours: number = 24) {
  const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

  const errors = await prisma.systemError.findMany({
    where: { createdAt: { gte: since } },
    select: {
      severity: true,
      service: true,
      isResolved: true,
    },
  });

  const bySeverity = errors.reduce((acc, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byService = errors.reduce((acc, e) => {
    acc[e.service] = (acc[e.service] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const unresolved = errors.filter(e => !e.isResolved).length;
  const critical = errors.filter(e => e.severity === 'CRITICAL').length;

  return {
    total: errors.length,
    unresolved,
    critical,
    bySeverity,
    byService,
    timeRangeHours,
  };
}

export async function getServices(): Promise<string[]> {
  const result = await prisma.systemError.findMany({
    select: { service: true },
    distinct: ['service'],
  });
  return result.map(r => r.service);
}

export async function getRecentCriticalErrors(limit: number = 10) {
  return prisma.systemError.findMany({
    where: {
      severity: { in: ['CRITICAL', 'ERROR'] },
      isResolved: false,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function cleanupOldErrors(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  const result = await prisma.systemError.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      isResolved: true,
    },
  });

  console.log(`[SystemError] Cleaned up ${result.count} old resolved errors`);
  return result.count;
}

export async function getErrorTrend(hours: number = 24, bucketMinutes: number = 60) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const errors = await prisma.systemError.findMany({
    where: { createdAt: { gte: since } },
    select: {
      createdAt: true,
      severity: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const buckets: { time: Date; count: number; critical: number }[] = [];
  const bucketMs = bucketMinutes * 60 * 1000;
  let currentBucketStart = new Date(since.getTime());

  while (currentBucketStart < new Date()) {
    const bucketEnd = new Date(currentBucketStart.getTime() + bucketMs);
    const bucketErrors = errors.filter(
      e => e.createdAt >= currentBucketStart && e.createdAt < bucketEnd
    );

    buckets.push({
      time: new Date(currentBucketStart),
      count: bucketErrors.length,
      critical: bucketErrors.filter(e => e.severity === 'CRITICAL').length,
    });

    currentBucketStart = bucketEnd;
  }

  return buckets;
}
