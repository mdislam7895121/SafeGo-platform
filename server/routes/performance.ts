/**
 * Step 50: Enterprise Performance Dashboard Routes
 * Provides real-time telemetry, system metrics, and stability monitoring
 * with comprehensive RBAC enforcement and audit logging
 */

import { Router } from "express";
import { Permission } from "../utils/permissions";
import { checkPermission } from "../middleware/authz";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";
import { rateLimitAnalytics } from "../middleware/rateLimit";
import { telemetryService } from "../services/telemetry";
import { stabilityGuard } from "../services/stabilityGuard";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

// Apply security middleware to all performance routes
router.use(rateLimitAnalytics); // Rate limiting (60 requests/min per user)

// ====================================================
// Input sanitization helper
// ====================================================

function sanitizeQueryInput(input: string | undefined, maxLength: number = 50): string {
  if (!input) return "";
  return String(input)
    .trim()
    .slice(0, maxLength)
    .replace(/[^\w\s-]/g, ""); // Allow only alphanumeric, whitespace, hyphens
}

function validateTimeRange(minutes: string | undefined): number {
  const parsed = parseInt(minutes || "60", 10);
  if (isNaN(parsed) || parsed < 1) return 60;
  return Math.min(parsed, 1440); // Max 24 hours
}

// ====================================================
// GET /api/admin/performance/overview
// ====================================================

router.get(
  "/overview",
  checkPermission(Permission.VIEW_PERFORMANCE_DASHBOARD),
  async (req: AuthRequest, res) => {
    try {
      const hoursParam = sanitizeQueryInput(req.query.hours as string, 3);
      const hours = Math.min(parseInt(hoursParam || "24", 10), 168); // Max 7 days

      const [currentMetrics, trafficOverview, dbStats, recentAlerts] = await Promise.all([
        telemetryService.getCurrentMetrics(),
        telemetryService.getTrafficOverview(hours),
        telemetryService.getDatabaseStats(),
        stabilityGuard.getRecentAlerts(5),
      ]);

      const overviewData = {
        current: currentMetrics,
        traffic: trafficOverview,
        database: dbStats,
        alerts: recentAlerts.map(a => ({
          severity: a.severity,
          metric: a.metric,
          message: a.message,
          timestamp: a.timestamp,
        })),
        timeRange: `${hours}h`,
      };

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.VIEW_PERFORMANCE_DASHBOARD,
        entityType: EntityType.PERFORMANCE,
        description: `Viewed performance overview (${hours}h)`,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json(overviewData);
    } catch (error) {
      console.error("[Performance] Overview error:", error);
      res.status(500).json({ error: "Failed to fetch performance overview" });
    }
  }
);

// ====================================================
// GET /api/admin/performance/database
// ====================================================

router.get(
  "/database",
  checkPermission(Permission.VIEW_PERFORMANCE_DASHBOARD),
  async (req: AuthRequest, res) => {
    try {
      const minutesParam = sanitizeQueryInput(req.query.minutes as string, 4);
      const minutes = validateTimeRange(minutesParam);

      const historicalSnapshots = telemetryService.getHistoricalSnapshots(minutes);
      const dbStats = await telemetryService.getDatabaseStats();

      // Calculate trends
      const queryTrends = historicalSnapshots.map(s => ({
        timestamp: s.timestamp,
        queryCount: s.queryCount,
        avgQueryTime: s.queryCount > 0 ? Math.round(s.totalQueryTime / s.queryCount) : 0,
        slowQueries: s.slowQueryCount,
      }));

      const databaseData = {
        summary: dbStats,
        trends: queryTrends,
        timeRange: `${minutes}m`,
      };

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.VIEW_PERFORMANCE_DASHBOARD,
        entityType: EntityType.PERFORMANCE,
        description: `Viewed database performance (${minutes}m)`,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json(databaseData);
    } catch (error) {
      console.error("[Performance] Database error:", error);
      res.status(500).json({ error: "Failed to fetch database performance" });
    }
  }
);

// ====================================================
// GET /api/admin/performance/system
// ====================================================

router.get(
  "/system",
  checkPermission(Permission.VIEW_PERFORMANCE_DASHBOARD),
  async (req: AuthRequest, res) => {
    try {
      const minutesParam = sanitizeQueryInput(req.query.minutes as string, 4);
      const minutes = validateTimeRange(minutesParam);

      const currentMetrics = await telemetryService.getCurrentMetrics();
      const historicalSnapshots = telemetryService.getHistoricalSnapshots(minutes);

      // Calculate system trends
      const memoryTrends = historicalSnapshots.map(() => ({
        timestamp: new Date(),
        memoryUsagePercent: currentMetrics.system.memoryUsage,
      }));

      const systemData = {
        current: currentMetrics.system,
        trends: {
          memory: memoryTrends,
        },
        timeRange: `${minutes}m`,
      };

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.VIEW_PERFORMANCE_DASHBOARD,
        entityType: EntityType.PERFORMANCE,
        description: `Viewed system health (${minutes}m)`,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json(systemData);
    } catch (error) {
      console.error("[Performance] System error:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  }
);

// ====================================================
// GET /api/admin/performance/alerts
// ====================================================

router.get(
  "/alerts",
  checkPermission(Permission.VIEW_PERFORMANCE_DASHBOARD),
  async (req: AuthRequest, res) => {
    try {
      const limitParam = sanitizeQueryInput(req.query.limit as string, 3);
      const limit = Math.min(parseInt(limitParam || "20", 10), 50);

      const alerts = stabilityGuard.getRecentAlerts(limit);

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.VIEW_PERFORMANCE_DASHBOARD,
        entityType: EntityType.PERFORMANCE,
        description: `Viewed stability alerts (limit: ${limit})`,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json({ alerts });
    } catch (error) {
      console.error("[Performance] Alerts error:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  }
);

// ====================================================
// GET /api/admin/performance/thresholds
// ====================================================

router.get(
  "/thresholds",
  checkPermission(Permission.VIEW_PERFORMANCE_DASHBOARD),
  async (req: AuthRequest, res) => {
    try {
      const thresholds = stabilityGuard.getThresholds();

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.VIEW_PERFORMANCE_DASHBOARD,
        entityType: EntityType.PERFORMANCE,
        description: "Viewed stability thresholds",
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json({ thresholds });
    } catch (error) {
      console.error("[Performance] Thresholds error:", error);
      res.status(500).json({ error: "Failed to fetch thresholds" });
    }
  }
);

// ====================================================
// PUT /api/admin/performance/thresholds
// ====================================================

router.put(
  "/thresholds",
  checkPermission(Permission.EDIT_SETTINGS), // Only SUPER_ADMIN can update thresholds
  async (req: AuthRequest, res) => {
    try {
      const { errorRatePercent, dbLatencyMs, memoryUsagePercent, slowQueryCount } = req.body;

      const updates: any = {};
      if (errorRatePercent !== undefined) updates.errorRatePercent = Math.max(0, Math.min(100, parseFloat(errorRatePercent)));
      if (dbLatencyMs !== undefined) updates.dbLatencyMs = Math.max(0, parseInt(dbLatencyMs, 10));
      if (memoryUsagePercent !== undefined) updates.memoryUsagePercent = Math.max(0, Math.min(100, parseFloat(memoryUsagePercent)));
      if (slowQueryCount !== undefined) updates.slowQueryCount = Math.max(0, parseInt(slowQueryCount, 10));

      const updatedThresholds = stabilityGuard.updateThresholds(updates);

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.SETTINGS_UPDATED,
        entityType: EntityType.PERFORMANCE,
        description: "Updated stability thresholds",
        metadata: { updates },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json({ thresholds: updatedThresholds });
    } catch (error) {
      console.error("[Performance] Update thresholds error:", error);
      res.status(500).json({ error: "Failed to update thresholds" });
    }
  }
);

// ====================================================
// GET /api/admin/performance/traffic
// ====================================================

router.get(
  "/traffic",
  checkPermission(Permission.VIEW_PERFORMANCE_DASHBOARD),
  async (req: AuthRequest, res) => {
    try {
      const minutesParam = sanitizeQueryInput(req.query.minutes as string, 4);
      const minutes = validateTimeRange(minutesParam);

      const historicalSnapshots = telemetryService.getHistoricalSnapshots(minutes);

      // Calculate traffic trends
      const trafficTrends = historicalSnapshots.map(s => ({
        timestamp: s.timestamp,
        requestCount: s.requestCount,
        errorCount: s.errorCount,
        successRate: s.requestCount > 0 
          ? ((s.requestCount - s.errorCount) / s.requestCount * 100).toFixed(2)
          : "100.00",
        avgResponseTime: s.requestCount > 0 
          ? Math.round(s.totalResponseTime / s.requestCount)
          : 0,
      }));

      const trafficData = {
        trends: trafficTrends,
        timeRange: `${minutes}m`,
      };

      // Audit log
      await logAuditEvent({
        actorId: (req.user as any)?.id || null,
        actorEmail: (req.user as any)?.email || "unknown",
        actorRole: (req.user as any)?.role || "unknown",
        actionType: ActionType.VIEW_PERFORMANCE_DASHBOARD,
        entityType: EntityType.PERFORMANCE,
        description: `Viewed traffic trends (${minutes}m)`,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        success: true,
      });

      res.json(trafficData);
    } catch (error) {
      console.error("[Performance] Traffic error:", error);
      res.status(500).json({ error: "Failed to fetch traffic data" });
    }
  }
);

export default router;
