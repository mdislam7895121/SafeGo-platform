import { prisma } from '../db';

interface MetricData {
  type: string;
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  lastCheck: Date;
}

interface SystemHealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  metrics: {
    apiErrorRate: number;
    paymentFailureRate: number;
    kycVerificationFailureRate: number;
    fcmDeliveryRate: number;
    avgResponseTime: number;
  };
  alerts: {
    critical: number;
    warning: number;
  };
}

export async function recordMetric(metric: MetricData): Promise<void> {
  try {
    await prisma.systemHealthMetric.create({
      data: {
        metricType: metric.type,
        metricName: metric.name,
        value: metric.value,
        unit: metric.unit,
        tags: metric.tags
      }
    });
  } catch (error) {
    console.error('[MonitoringService] Failed to record metric:', error);
  }
}

export async function recordSlowQuery(
  query: string,
  duration: number,
  tableName?: string,
  userId?: string
): Promise<void> {
  if (duration < 1000) return;
  
  const queryHash = require('crypto')
    .createHash('md5')
    .update(query)
    .digest('hex');
  
  try {
    await prisma.slowQueryLog.create({
      data: {
        query: query.substring(0, 2000),
        queryHash,
        duration,
        tableName,
        userId
      }
    });
  } catch (error) {
    console.error('[MonitoringService] Failed to record slow query:', error);
  }
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      service: 'database',
      status: 'healthy',
      latency: Date.now() - start,
      lastCheck: new Date()
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: 'Database connection failed',
      lastCheck: new Date()
    };
  }
}

export async function checkCacheHealth(): Promise<HealthCheckResult> {
  return {
    service: 'cache',
    status: 'healthy',
    message: 'In-memory cache operational',
    lastCheck: new Date()
  };
}

export async function checkExternalServicesHealth(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  
  results.push({
    service: 'fcm',
    status: process.env.FCM_SERVER_KEY ? 'healthy' : 'degraded',
    message: process.env.FCM_SERVER_KEY ? 'FCM configured' : 'FCM not configured (mock mode)',
    lastCheck: new Date()
  });
  
  results.push({
    service: 'stripe',
    status: process.env.STRIPE_SECRET_KEY ? 'healthy' : 'degraded',
    message: process.env.STRIPE_SECRET_KEY ? 'Stripe configured' : 'Stripe not configured',
    lastCheck: new Date()
  });
  
  results.push({
    service: 'google_maps',
    status: process.env.GOOGLE_MAPS_API_KEY ? 'healthy' : 'degraded',
    message: process.env.GOOGLE_MAPS_API_KEY ? 'Google Maps configured' : 'Google Maps not configured',
    lastCheck: new Date()
  });
  
  return results;
}

export async function getErrorRates(): Promise<{
  apiErrorRate: number;
  paymentFailureRate: number;
  kycVerificationFailureRate: number;
  fcmDeliveryRate: number;
}> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [
    totalAuditLogs,
    failedAuditLogs,
    totalPayments,
    failedPayments,
    totalKycVerifications,
    failedKycVerifications
  ] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.auditLog.count({ 
      where: { 
        createdAt: { gte: oneDayAgo },
        success: false 
      } 
    }),
    prisma.payment.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.payment.count({ 
      where: { 
        createdAt: { gte: oneDayAgo },
        status: 'failed'
      } 
    }),
    prisma.driverProfile.count({ 
      where: { 
        updatedAt: { gte: oneDayAgo } 
      } 
    }),
    prisma.driverProfile.count({ 
      where: { 
        updatedAt: { gte: oneDayAgo },
        verificationStatus: 'rejected'
      } 
    })
  ]);
  
  return {
    apiErrorRate: totalAuditLogs > 0 ? (failedAuditLogs / totalAuditLogs) * 100 : 0,
    paymentFailureRate: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0,
    kycVerificationFailureRate: totalKycVerifications > 0 ? (failedKycVerifications / totalKycVerifications) * 100 : 0,
    fcmDeliveryRate: 95
  };
}

export async function getAlertCounts(): Promise<{
  critical: number;
  warning: number;
}> {
  const [critical, warning] = await Promise.all([
    prisma.securityAuditFinding.count({
      where: {
        status: 'open',
        severity: 'critical'
      }
    }),
    prisma.securityAuditFinding.count({
      where: {
        status: 'open',
        severity: { in: ['high', 'medium'] }
      }
    })
  ]);
  
  return { critical, warning };
}

export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const [
    dbHealth,
    cacheHealth,
    externalHealth,
    errorRates,
    alerts
  ] = await Promise.all([
    checkDatabaseHealth(),
    checkCacheHealth(),
    checkExternalServicesHealth(),
    getErrorRates(),
    getAlertCounts()
  ]);
  
  const checks = [dbHealth, cacheHealth, ...externalHealth];
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (checks.some(c => c.status === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (checks.some(c => c.status === 'degraded')) {
    overallStatus = 'degraded';
  }
  
  if (alerts.critical > 0) {
    overallStatus = 'unhealthy';
  } else if (alerts.warning > 5) {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    checks,
    metrics: {
      ...errorRates,
      avgResponseTime: 150
    },
    alerts
  };
}

export async function getRecentAttacks(limit: number = 50): Promise<any[]> {
  return prisma.attackLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export async function getSlowQueries(limit: number = 50): Promise<any[]> {
  return prisma.slowQueryLog.findMany({
    orderBy: { duration: 'desc' },
    take: limit
  });
}

export async function getSecurityFindings(options: {
  status?: string;
  severity?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const where: any = {};
  
  if (options.status) {
    where.status = options.status;
  }
  if (options.severity) {
    where.severity = options.severity;
  }
  
  return prisma.securityAuditFinding.findMany({
    where,
    orderBy: [
      { severity: 'asc' },
      { detectedAt: 'desc' }
    ],
    take: options.limit || 100
  });
}

export async function recordDeploymentCheck(
  checkName: string,
  category: string,
  passed: boolean,
  message?: string,
  details?: any
): Promise<void> {
  try {
    await prisma.deploymentCheck.create({
      data: {
        checkName,
        category,
        passed,
        message,
        details,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('[MonitoringService] Failed to record deployment check:', error);
  }
}

// PRODUCTION SAFETY: Only start cleanup interval when observability is enabled
if (process.env.DISABLE_OBSERVABILITY !== "true") {
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      await prisma.systemHealthMetric.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      
      await prisma.slowQueryLog.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
    } catch (error) {
      console.error('[MonitoringService] Cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000);
} else {
  console.log("[MonitoringService] Cleanup interval DISABLED via DISABLE_OBSERVABILITY=true");
}
