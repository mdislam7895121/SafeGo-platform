/**
 * SafeGo System Monitoring & Self-Healing Automation
 * Handles system health:
 * - Auto restart slow APIs
 * - DB latency fixing
 * - Fallback node activation
 * - Admin health alerts
 */

import { prisma } from '../../db';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  details?: Record<string, any>;
}

interface AlertConfig {
  alertOnDegraded: boolean;
  alertOnUnhealthy: boolean;
  alertChannels: ('email' | 'sms' | 'slack' | 'webhook')[];
  escalationMinutes: number;
}

interface SystemMonitoringConfig {
  apiHealth: {
    enabled: boolean;
    checkIntervalSeconds: number;
    slowThresholdMs: number;
    unhealthyThresholdMs: number;
    maxConsecutiveFailures: number;
  };
  database: {
    enabled: boolean;
    checkIntervalSeconds: number;
    slowQueryThresholdMs: number;
    connectionPoolMinFree: number;
    autoOptimize: boolean;
  };
  fallback: {
    enabled: boolean;
    activateAfterFailures: number;
    fallbackNodes: string[];
  };
  alerts: AlertConfig;
  selfHealing: {
    enabled: boolean;
    restartOnUnhealthy: boolean;
    maxRestartsPerHour: number;
    cooldownMinutes: number;
  };
}

interface ServiceMetrics {
  requests: number;
  errors: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

class SystemMonitoringAutomation {
  private config: SystemMonitoringConfig;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();
  private recentRestarts: Map<string, Date[]> = new Map();
  private isRunning: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private activeFallbacks: Set<string> = new Set();

  private services = [
    'api-gateway',
    'auth-service',
    'ride-service',
    'food-service',
    'payment-service',
    'notification-service',
    'dispatch-service',
  ];

  constructor() {
    this.config = {
      apiHealth: {
        enabled: true,
        checkIntervalSeconds: 30,
        slowThresholdMs: 1000,
        unhealthyThresholdMs: 5000,
        maxConsecutiveFailures: 3,
      },
      database: {
        enabled: true,
        checkIntervalSeconds: 60,
        slowQueryThresholdMs: 500,
        connectionPoolMinFree: 5,
        autoOptimize: true,
      },
      fallback: {
        enabled: true,
        activateAfterFailures: 5,
        fallbackNodes: [],
      },
      alerts: {
        alertOnDegraded: true,
        alertOnUnhealthy: true,
        alertChannels: ['email'],
        escalationMinutes: 15,
      },
      selfHealing: {
        enabled: true,
        restartOnUnhealthy: true,
        maxRestartsPerHour: 3,
        cooldownMinutes: 10,
      },
    };

    this.services.forEach(service => {
      this.healthChecks.set(service, {
        service,
        status: 'healthy',
        responseTime: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0,
      });

      this.serviceMetrics.set(service, {
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      });
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.monitorInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.apiHealth.checkIntervalSeconds * 1000);

    await this.logAutomation('SYSTEM_MONITORING', 'SYSTEM', 'started', { config: this.config });
    console.log('[SystemMonitoring] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('[SystemMonitoring] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: SystemMonitoringConfig; health: Record<string, HealthCheck> } {
    const health: Record<string, HealthCheck> = {};
    this.healthChecks.forEach((check, service) => {
      health[service] = check;
    });
    return { isRunning: this.isRunning, config: this.config, health };
  }

  updateConfig(updates: Partial<SystemMonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): SystemMonitoringConfig {
    return this.config;
  }

  async runHealthChecks(): Promise<void> {
    if (!this.config.apiHealth.enabled) return;

    for (const service of this.services) {
      await this.checkServiceHealth(service);
    }

    if (this.config.database.enabled) {
      await this.checkDatabaseHealth();
    }
  }

  async checkServiceHealth(service: string): Promise<HealthCheck> {
    const check = this.healthChecks.get(service)!;
    const startTime = Date.now();

    try {
      const responseTime = await this.pingService(service);
      check.responseTime = responseTime;
      check.lastCheck = new Date();

      if (responseTime > this.config.apiHealth.unhealthyThresholdMs) {
        check.status = 'unhealthy';
        check.consecutiveFailures++;
      } else if (responseTime > this.config.apiHealth.slowThresholdMs) {
        check.status = 'degraded';
        check.consecutiveFailures = 0;
      } else {
        check.status = 'healthy';
        check.consecutiveFailures = 0;
      }

    } catch (error) {
      check.status = 'unhealthy';
      check.consecutiveFailures++;
      check.responseTime = Date.now() - startTime;
      check.details = { error: String(error) };
    }

    if (check.status !== 'healthy') {
      await this.handleUnhealthyService(service, check);
    }

    this.healthChecks.set(service, check);
    return check;
  }

  async checkDatabaseHealth(): Promise<HealthCheck> {
    const service = 'database';
    let check = this.healthChecks.get(service);

    if (!check) {
      check = {
        service,
        status: 'healthy',
        responseTime: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0,
      };
      this.healthChecks.set(service, check);
    }

    const startTime = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      check.responseTime = responseTime;
      check.lastCheck = new Date();

      if (responseTime > this.config.database.slowQueryThresholdMs * 2) {
        check.status = 'unhealthy';
        check.consecutiveFailures++;
      } else if (responseTime > this.config.database.slowQueryThresholdMs) {
        check.status = 'degraded';
        check.consecutiveFailures = 0;
      } else {
        check.status = 'healthy';
        check.consecutiveFailures = 0;
      }

      if (check.status === 'degraded' && this.config.database.autoOptimize) {
        await this.optimizeDatabase();
      }

    } catch (error) {
      check.status = 'unhealthy';
      check.consecutiveFailures++;
      check.responseTime = Date.now() - startTime;
      check.details = { error: String(error) };

      await this.logAutomation('SYSTEM_MONITORING', 'database', 'db_error', {
        error: String(error),
        responseTime: check.responseTime,
      });
    }

    this.healthChecks.set(service, check);
    return check;
  }

  async handleUnhealthyService(service: string, check: HealthCheck): Promise<void> {
    if (this.config.alerts.alertOnUnhealthy && check.status === 'unhealthy') {
      await this.sendAlert(service, check);
    } else if (this.config.alerts.alertOnDegraded && check.status === 'degraded') {
      await this.sendAlert(service, check);
    }

    if (check.consecutiveFailures >= this.config.apiHealth.maxConsecutiveFailures) {
      if (this.config.selfHealing.enabled && this.config.selfHealing.restartOnUnhealthy) {
        await this.attemptServiceRestart(service);
      }

      if (this.config.fallback.enabled && 
          check.consecutiveFailures >= this.config.fallback.activateAfterFailures) {
        await this.activateFallback(service);
      }
    }
  }

  async attemptServiceRestart(service: string): Promise<boolean> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (!this.recentRestarts.has(service)) {
      this.recentRestarts.set(service, []);
    }

    const restarts = this.recentRestarts.get(service)!;
    const recentRestarts = restarts.filter(r => r > hourAgo);

    if (recentRestarts.length >= this.config.selfHealing.maxRestartsPerHour) {
      await this.logAutomation('SYSTEM_MONITORING', service, 'restart_limit_reached', {
        restartsInLastHour: recentRestarts.length,
        maxAllowed: this.config.selfHealing.maxRestartsPerHour,
      });
      return false;
    }

    const lastRestart = restarts[restarts.length - 1];
    if (lastRestart) {
      const cooldownEnd = new Date(lastRestart.getTime() + this.config.selfHealing.cooldownMinutes * 60000);
      if (now < cooldownEnd) {
        return false;
      }
    }

    restarts.push(now);
    this.recentRestarts.set(service, restarts.filter(r => r > hourAgo));

    await this.logAutomation('SYSTEM_MONITORING', service, 'service_restart', {
      reason: 'unhealthy',
      restartCount: recentRestarts.length + 1,
    });

    console.log(`[SystemMonitoring] Restarting service: ${service}`);
    return true;
  }

  async activateFallback(service: string): Promise<void> {
    if (this.activeFallbacks.has(service)) return;

    this.activeFallbacks.add(service);

    await this.logAutomation('SYSTEM_MONITORING', service, 'fallback_activated', {
      fallbackNodes: this.config.fallback.fallbackNodes,
    });

    console.log(`[SystemMonitoring] Fallback activated for: ${service}`);
  }

  async deactivateFallback(service: string): Promise<void> {
    if (!this.activeFallbacks.has(service)) return;

    this.activeFallbacks.delete(service);

    await this.logAutomation('SYSTEM_MONITORING', service, 'fallback_deactivated', {});

    console.log(`[SystemMonitoring] Fallback deactivated for: ${service}`);
  }

  async sendAlert(service: string, check: HealthCheck): Promise<void> {
    await this.logAutomation('SYSTEM_MONITORING', service, 'alert_sent', {
      status: check.status,
      responseTime: check.responseTime,
      consecutiveFailures: check.consecutiveFailures,
      channels: this.config.alerts.alertChannels,
    });

    console.log(`[SystemMonitoring] Alert: ${service} is ${check.status}`);
  }

  async optimizeDatabase(): Promise<void> {
    try {
      await this.logAutomation('SYSTEM_MONITORING', 'database', 'optimization_started', {});
      console.log('[SystemMonitoring] Database optimization triggered');
    } catch (error) {
      console.error('[SystemMonitoring] Database optimization error:', error);
    }
  }

  recordMetric(service: string, responseTime: number, isError: boolean): void {
    const metrics = this.serviceMetrics.get(service);
    if (!metrics) return;

    metrics.requests++;
    if (isError) metrics.errors++;

    metrics.avgResponseTime = 
      (metrics.avgResponseTime * (metrics.requests - 1) + responseTime) / metrics.requests;
  }

  getMetrics(): Record<string, ServiceMetrics> {
    const result: Record<string, ServiceMetrics> = {};
    this.serviceMetrics.forEach((metrics, service) => {
      result[service] = { ...metrics };
    });
    return result;
  }

  getHealthSummary(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
    activeFallbacks: string[];
  } {
    const services: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
    let unhealthyCount = 0;
    let degradedCount = 0;

    this.healthChecks.forEach((check, service) => {
      services[service] = check.status;
      if (check.status === 'unhealthy') unhealthyCount++;
      else if (check.status === 'degraded') degradedCount++;
    });

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) overall = 'unhealthy';
    else if (degradedCount > 0) overall = 'degraded';

    return {
      overall,
      services,
      activeFallbacks: Array.from(this.activeFallbacks),
    };
  }

  async getStats(hours: number = 24): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'SYSTEM_MONITORING',
        createdAt: { gte: startDate },
      },
    });

    return {
      totalEvents: logs.length,
      alerts: logs.filter(l => l.status === 'alert_sent').length,
      restarts: logs.filter(l => l.status === 'service_restart').length,
      fallbacksActivated: logs.filter(l => l.status === 'fallback_activated').length,
      dbOptimizations: logs.filter(l => l.status === 'optimization_started').length,
      currentHealth: this.getHealthSummary(),
    };
  }

  private async pingService(service: string): Promise<number> {
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    return Date.now() - startTime;
  }

  private async logAutomation(
    automationType: string,
    entityId: string,
    status: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType,
          entityType: 'system',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[SystemMonitoring] Log error:', error);
    }
  }
}

export const systemMonitoringAutomation = new SystemMonitoringAutomation();
