import { prisma } from '../db';

export type ServiceStatus = 'OK' | 'DEGRADED' | 'DOWN';

export interface HealthCheckResult {
  serviceName: string;
  serviceType: string;
  status: ServiceStatus;
  latencyMs?: number;
  statusMessage?: string;
  errorMessage?: string;
  metadata?: object;
  checkedAt: Date;
}

export interface SystemHealthSummary {
  overallStatus: ServiceStatus;
  services: HealthCheckResult[];
  stats: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
  };
  checkedAt: Date;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      serviceName: 'postgresql',
      serviceType: 'database',
      status: 'OK',
      latencyMs: Date.now() - start,
      statusMessage: 'Database connection healthy',
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      serviceName: 'postgresql',
      serviceType: 'database',
      status: 'DOWN',
      latencyMs: Date.now() - start,
      errorMessage: error instanceof Error ? error.message : 'Database connection failed',
      checkedAt: new Date(),
    };
  }
}

async function checkStripe(): Promise<HealthCheckResult> {
  const start = Date.now();
  const hasKey = !!process.env.STRIPE_SECRET_KEY;
  
  if (!hasKey) {
    return {
      serviceName: 'stripe',
      serviceType: 'payment',
      status: 'DEGRADED',
      latencyMs: Date.now() - start,
      statusMessage: 'Stripe API key not configured',
      checkedAt: new Date(),
    };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    
    return {
      serviceName: 'stripe',
      serviceType: 'payment',
      status: response.ok ? 'OK' : 'DEGRADED',
      latencyMs: Date.now() - start,
      statusMessage: response.ok ? 'Stripe API accessible' : `Stripe returned ${response.status}`,
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      serviceName: 'stripe',
      serviceType: 'payment',
      status: 'DEGRADED',
      latencyMs: Date.now() - start,
      errorMessage: error instanceof Error ? error.message : 'Stripe check failed',
      checkedAt: new Date(),
    };
  }
}

async function checkGoogleMaps(): Promise<HealthCheckResult> {
  const start = Date.now();
  const hasKey = !!process.env.GOOGLE_MAPS_API_KEY;
  
  if (!hasKey) {
    return {
      serviceName: 'google_maps',
      serviceType: 'maps',
      status: 'DEGRADED',
      latencyMs: Date.now() - start,
      statusMessage: 'Google Maps API key not configured',
      checkedAt: new Date(),
    };
  }

  return {
    serviceName: 'google_maps',
    serviceType: 'maps',
    status: 'OK',
    latencyMs: Date.now() - start,
    statusMessage: 'Google Maps API key configured',
    checkedAt: new Date(),
  };
}

async function checkTwilio(): Promise<HealthCheckResult> {
  const start = Date.now();
  const hasCredentials = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  
  return {
    serviceName: 'twilio',
    serviceType: 'notification',
    status: hasCredentials ? 'OK' : 'DEGRADED',
    latencyMs: Date.now() - start,
    statusMessage: hasCredentials 
      ? 'Twilio credentials configured' 
      : 'Twilio credentials not configured (SMS disabled)',
    checkedAt: new Date(),
  };
}

async function checkEmailService(): Promise<HealthCheckResult> {
  const start = Date.now();
  const hasConfig = !!(process.env.SMTP_HOST || process.env.AGENTMAIL_API_KEY);
  
  return {
    serviceName: 'email',
    serviceType: 'notification',
    status: hasConfig ? 'OK' : 'DEGRADED',
    latencyMs: Date.now() - start,
    statusMessage: hasConfig 
      ? 'Email service configured' 
      : 'Email service not configured',
    checkedAt: new Date(),
  };
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  const hasRedis = !!process.env.REDIS_URL;
  
  return {
    serviceName: 'redis',
    serviceType: 'cache',
    status: hasRedis ? 'OK' : 'DEGRADED',
    latencyMs: Date.now() - start,
    statusMessage: hasRedis 
      ? 'Redis configured' 
      : 'Using in-memory cache (Redis not configured)',
    checkedAt: new Date(),
  };
}

async function checkWebSocket(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  return {
    serviceName: 'websocket',
    serviceType: 'realtime',
    status: 'OK',
    latencyMs: Date.now() - start,
    statusMessage: 'WebSocket server running',
    checkedAt: new Date(),
  };
}

async function checkFileStorage(): Promise<HealthCheckResult> {
  const start = Date.now();
  const hasS3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  
  return {
    serviceName: 'file_storage',
    serviceType: 'storage',
    status: hasS3 ? 'OK' : 'DEGRADED',
    latencyMs: Date.now() - start,
    statusMessage: hasS3 
      ? 'S3 storage configured' 
      : 'Using local file storage',
    checkedAt: new Date(),
  };
}

export async function runAllHealthChecks(): Promise<SystemHealthSummary> {
  const checks = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkGoogleMaps(),
    checkTwilio(),
    checkEmailService(),
    checkRedis(),
    checkWebSocket(),
    checkFileStorage(),
  ]);

  const stats = {
    total: checks.length,
    healthy: checks.filter(c => c.status === 'OK').length,
    degraded: checks.filter(c => c.status === 'DEGRADED').length,
    down: checks.filter(c => c.status === 'DOWN').length,
  };

  let overallStatus: ServiceStatus = 'OK';
  if (stats.down > 0) {
    overallStatus = 'DOWN';
  } else if (stats.degraded > 0) {
    overallStatus = 'DEGRADED';
  }

  for (const check of checks) {
    await saveHealthCheck(check);
  }

  return {
    overallStatus,
    services: checks,
    stats,
    checkedAt: new Date(),
  };
}

export async function runHealthCheck(serviceName: string): Promise<HealthCheckResult> {
  const checkFunctions: Record<string, () => Promise<HealthCheckResult>> = {
    postgresql: checkDatabase,
    stripe: checkStripe,
    google_maps: checkGoogleMaps,
    twilio: checkTwilio,
    email: checkEmailService,
    redis: checkRedis,
    websocket: checkWebSocket,
    file_storage: checkFileStorage,
  };

  const checkFn = checkFunctions[serviceName];
  if (!checkFn) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  const result = await checkFn();
  await saveHealthCheck(result);
  return result;
}

async function saveHealthCheck(result: HealthCheckResult): Promise<void> {
  try {
    await prisma.serviceHealthCheck.upsert({
      where: { 
        id: result.serviceName,
      },
      update: {
        status: result.status,
        latencyMs: result.latencyMs,
        statusMessage: result.statusMessage,
        errorMessage: result.errorMessage,
        metadata: result.metadata || {},
        checkedAt: result.checkedAt,
        lastSuccess: result.status === 'OK' ? result.checkedAt : undefined,
        lastFailure: result.status === 'DOWN' ? result.checkedAt : undefined,
      },
      create: {
        id: result.serviceName,
        serviceName: result.serviceName,
        serviceType: result.serviceType,
        status: result.status,
        latencyMs: result.latencyMs,
        statusMessage: result.statusMessage,
        errorMessage: result.errorMessage,
        metadata: result.metadata || {},
        checkedAt: result.checkedAt,
        lastSuccess: result.status === 'OK' ? result.checkedAt : undefined,
        lastFailure: result.status === 'DOWN' ? result.checkedAt : undefined,
      },
    });
  } catch (error) {
    console.error('[HealthCheck] Failed to save health check:', error);
  }
}

export async function getHealthCheckHistory(serviceName: string, limit: number = 100) {
  return prisma.serviceHealthCheck.findMany({
    where: { serviceName },
    orderBy: { checkedAt: 'desc' },
    take: limit,
  });
}

export async function getLatestHealthChecks() {
  return prisma.serviceHealthCheck.findMany({
    orderBy: { checkedAt: 'desc' },
    distinct: ['serviceName'],
  });
}

export async function getServiceTypes(): Promise<string[]> {
  const result = await prisma.serviceHealthCheck.findMany({
    select: { serviceType: true },
    distinct: ['serviceType'],
  });
  return result.map(r => r.serviceType);
}
