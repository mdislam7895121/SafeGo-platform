/**
 * Step 50: System Stability Guard
 * Monitors critical thresholds and triggers alerts
 */

import { logAuditEvent, ActionType, EntityType } from "../utils/audit";
import { telemetryService } from "./telemetry";

interface StabilityThresholds {
  errorRatePercent: number;
  dbLatencyMs: number;
  memoryUsagePercent: number;
  slowQueryCount: number;
}

interface StabilityAlert {
  id: string;
  severity: "warning" | "critical";
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

class StabilityGuard {
  private static instance: StabilityGuard;
  private alerts: StabilityAlert[] = [];
  private readonly maxAlerts = 50;
  private monitoringEnabled = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Default thresholds (configurable)
  private thresholds: StabilityThresholds = {
    errorRatePercent: 5.0,      // 5% error rate
    dbLatencyMs: 500,            // 500ms average query time
    memoryUsagePercent: 85,      // 85% memory usage
    slowQueryCount: 10,          // 10 slow queries per minute
  };

  private constructor() {
    // PRODUCTION SAFETY: Do NOT auto-start monitoring
    // Call startMonitoring() explicitly only when observability is enabled
    if (process.env.DISABLE_OBSERVABILITY !== "true") {
      this.startMonitoring();
    } else {
      console.log("[StabilityGuard] DISABLED via DISABLE_OBSERVABILITY=true");
    }
  }

  static getInstance(): StabilityGuard {
    if (!StabilityGuard.instance) {
      StabilityGuard.instance = new StabilityGuard();
    }
    return StabilityGuard.instance;
  }

  /**
   * Start continuous monitoring (only when not disabled)
   */
  private startMonitoring() {
    if (this.monitoringEnabled || process.env.DISABLE_OBSERVABILITY === "true") {
      return;
    }
    this.monitoringEnabled = true;
    console.log("[StabilityGuard] Starting continuous monitoring (30s interval)");
    // Check stability every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkStability();
    }, 30000);
  }

  /**
   * Check all stability metrics
   */
  private async checkStability() {
    try {
      const metrics = await telemetryService.getCurrentMetrics();
      const trafficOverview = await telemetryService.getTrafficOverview(1); // Last hour
      const dbStats = await telemetryService.getDatabaseStats();

      // Check error rate
      const errorRate = parseFloat(trafficOverview.errorRate);
      if (errorRate > this.thresholds.errorRatePercent) {
        this.triggerAlert({
          severity: errorRate > this.thresholds.errorRatePercent * 2 ? "critical" : "warning",
          metric: "Error Rate",
          currentValue: errorRate,
          threshold: this.thresholds.errorRatePercent,
          message: `Error rate (${errorRate}%) exceeds threshold (${this.thresholds.errorRatePercent}%)`,
        });
      }

      // Check database latency
      if (dbStats.avgQueryTime > this.thresholds.dbLatencyMs) {
        this.triggerAlert({
          severity: dbStats.avgQueryTime > this.thresholds.dbLatencyMs * 2 ? "critical" : "warning",
          metric: "Database Latency",
          currentValue: dbStats.avgQueryTime,
          threshold: this.thresholds.dbLatencyMs,
          message: `Avg query time (${dbStats.avgQueryTime}ms) exceeds threshold (${this.thresholds.dbLatencyMs}ms)`,
        });
      }

      // Check memory usage
      if (metrics.system.memoryUsage > this.thresholds.memoryUsagePercent) {
        this.triggerAlert({
          severity: metrics.system.memoryUsage > 95 ? "critical" : "warning",
          metric: "Memory Usage",
          currentValue: metrics.system.memoryUsage,
          threshold: this.thresholds.memoryUsagePercent,
          message: `Memory usage (${metrics.system.memoryUsage}%) exceeds threshold (${this.thresholds.memoryUsagePercent}%)`,
        });
      }

      // Check slow queries
      if (metrics.database.slowQueries > this.thresholds.slowQueryCount) {
        this.triggerAlert({
          severity: "warning",
          metric: "Slow Queries",
          currentValue: metrics.database.slowQueries,
          threshold: this.thresholds.slowQueryCount,
          message: `Slow queries (${metrics.database.slowQueries}) exceeds threshold (${this.thresholds.slowQueryCount})`,
        });
      }
    } catch (error) {
      console.error("[Stability Guard] Monitoring error:", error);
    }
  }

  /**
   * Trigger a stability alert
   */
  private async triggerAlert(params: Omit<StabilityAlert, "id" | "timestamp">) {
    const alert: StabilityAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...params,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }

    // Log to audit trail
    await logAuditEvent({
      actorId: null,
      actorEmail: "system",
      actorRole: "system",
      actionType: ActionType.STABILITY_ALERT_TRIGGERED,
      entityType: EntityType.PERFORMANCE,
      description: alert.message,
      metadata: {
        severity: alert.severity,
        metric: alert.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
      },
      success: true,
    });

    console.warn(`[Stability Guard] ${alert.severity.toUpperCase()}: ${alert.message}`);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): StabilityAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): StabilityThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds (admin only)
   */
  updateThresholds(newThresholds: Partial<StabilityThresholds>): StabilityThresholds {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds,
    };
    return { ...this.thresholds };
  }

  /**
   * Clear all alerts
   */
  clearAlerts() {
    this.alerts = [];
  }
}

// PRODUCTION SAFETY: No-op stub for when observability is disabled
const noOpStabilityStub = {
  getRecentAlerts: () => [],
  getThresholds: () => ({ errorRatePercent: 5, dbLatencyMs: 500, memoryUsagePercent: 85, slowQueryCount: 10 }),
  updateThresholds: () => ({ errorRatePercent: 5, dbLatencyMs: 500, memoryUsagePercent: 85, slowQueryCount: 10 }),
  clearAlerts: () => {},
} as unknown as StabilityGuard;

// PRODUCTION SAFETY: Lazy instantiation using getter to prevent auto-initialization
let _cachedStabilityGuard: StabilityGuard | null = null;

function getStabilityGuardInternal(): StabilityGuard {
  if (process.env.DISABLE_OBSERVABILITY === "true") {
    return noOpStabilityStub;
  }
  if (!_cachedStabilityGuard) {
    _cachedStabilityGuard = StabilityGuard.getInstance();
  }
  return _cachedStabilityGuard;
}

// Use Proxy to defer instantiation until first property access
export const stabilityGuard = new Proxy({} as StabilityGuard, {
  get(_target, prop) {
    const service = getStabilityGuardInternal();
    const value = (service as any)[prop];
    return typeof value === 'function' ? value.bind(service) : value;
  }
});
