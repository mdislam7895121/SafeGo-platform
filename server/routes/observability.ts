const __DISABLE_OBSERVABILITY__ =
  String(process.env.DISABLE_OBSERVABILITY || "").toLowerCase() === "true" ||
  String(process.env.DISABLE_OBSERVABILITY || "").toLowerCase() === "1";
import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { observabilityService } from "../services/observabilityService";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ROLES = ["SUPER_ADMIN", "INFRA_ADMIN"];

interface AuthRequest extends Request {
  admin?: {
    id: string;
    userId: string;
    email: string;
    role: string;
  };
}

async function requireObservabilityAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.slice(7);
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };

    const admin = await prisma.adminProfile.findUnique({
      where: { userId: decoded.id },
      select: {
        id: true,
        userId: true,
        adminRole: true,
        user: { select: { email: true } },
      },
    });

    if (!admin) {
      return res.status(403).json({ error: "Admin account not found" });
    }

    if (!ALLOWED_ROLES.includes(admin.adminRole)) {
      return res.status(403).json({ 
        error: "Insufficient permissions", 
        message: "Observability access requires SUPER_ADMIN or INFRA_ADMIN role" 
      });
    }

    req.admin = {
      id: admin.id,
      userId: admin.userId,
      email: admin.user.email,
      role: admin.adminRole,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

router.get("/metrics", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { metricType, windowMinutes, hours } = req.query;
    
    const hoursNum = hours ? parseInt(hours as string) : 1;
    const startTime = new Date(Date.now() - hoursNum * 60 * 60 * 1000);
    
    const metrics = await observabilityService.getMetrics({
      metricType: metricType as string,
      windowMinutes: windowMinutes ? parseInt(windowMinutes as string) : undefined,
      startTime,
      limit: 200,
    });

    res.json({ metrics });
  } catch (error) {
    console.error("[Observability] Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

router.get("/metrics/current", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const metrics = await observabilityService.collectSystemMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      ...metrics,
    });
  } catch (error) {
    console.error("[Observability] Error fetching current metrics:", error);
    res.status(500).json({ error: "Failed to fetch current metrics" });
  }
});

router.get("/metrics/trends/:metricType", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { metricType } = req.params;
    const { hours } = req.query;
    
    const trends = await observabilityService.getMetricTrends(
      metricType,
      hours ? parseInt(hours as string) : 1
    );

    res.json(trends);
  } catch (error) {
    console.error("[Observability] Error fetching metric trends:", error);
    res.status(500).json({ error: "Failed to fetch metric trends" });
  }
});

router.get("/logs", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      category, 
      severity, 
      source, 
      userId, 
      searchQuery, 
      startTime, 
      endTime,
      limit = "100",
      offset = "0" 
    } = req.query;

    const result = await observabilityService.getLogs({
      category: category as any,
      severity: severity as any,
      source: source as string,
      userId: userId as string,
      searchQuery: searchQuery as string,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json(result);
  } catch (error) {
    console.error("[Observability] Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

router.get("/logs/stats", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { hours } = req.query;
    const stats = await observabilityService.getLogStats(hours ? parseInt(hours as string) : 24);
    res.json(stats);
  } catch (error) {
    console.error("[Observability] Error fetching log stats:", error);
    res.status(500).json({ error: "Failed to fetch log stats" });
  }
});

router.post("/logs/export", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { format = "json", category, severity, startTime, endTime, limit } = req.body;

    const exportData = await observabilityService.exportLogs({
      format: format as "csv" | "json",
      category,
      severity,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      limit: limit || 1000,
    });

    const contentType = format === "csv" ? "text/csv" : "application/json";
    const filename = `logs_export_${new Date().toISOString().slice(0, 10)}.${format}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    console.error("[Observability] Error exporting logs:", error);
    res.status(500).json({ error: "Failed to export logs" });
  }
});

router.get("/correlations", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      rootEventType, 
      analysisStatus, 
      impactLevel,
      startTime, 
      endTime,
      limit = "50",
      offset = "0" 
    } = req.query;

    const result = await observabilityService.getEventCorrelations({
      rootEventType: rootEventType as string,
      analysisStatus: analysisStatus as string,
      impactLevel: impactLevel as string,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json(result);
  } catch (error) {
    console.error("[Observability] Error fetching correlations:", error);
    res.status(500).json({ error: "Failed to fetch correlations" });
  }
});

router.get("/correlations/:correlationId", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { correlationId } = req.params;

    const correlation = await prisma.eventCorrelation.findUnique({
      where: { correlationId },
    });

    if (!correlation) {
      return res.status(404).json({ error: "Correlation not found" });
    }

    res.json(correlation);
  } catch (error) {
    console.error("[Observability] Error fetching correlation:", error);
    res.status(500).json({ error: "Failed to fetch correlation" });
  }
});

router.post("/correlations", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      rootEventType, 
      rootEventId, 
      rootEventTime,
      correlatedEvents,
      suggestedRootCause,
      confidenceScore,
      affectedUserId,
      affectedDriverId,
      affectedOrderId,
      affectedRideId,
      impactLevel,
      estimatedImpact,
    } = req.body;

    const correlation = await observabilityService.createEventCorrelation({
      rootEventType,
      rootEventId,
      rootEventTime: new Date(rootEventTime),
      correlatedEvents: correlatedEvents || [],
      suggestedRootCause,
      confidenceScore,
      affectedUserId,
      affectedDriverId,
      affectedOrderId,
      affectedRideId,
      impactLevel,
      estimatedImpact,
    });

    res.status(201).json(correlation);
  } catch (error) {
    console.error("[Observability] Error creating correlation:", error);
    res.status(500).json({ error: "Failed to create correlation" });
  }
});

router.patch("/correlations/:correlationId/status", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { correlationId } = req.params;
    const { status, resolutionNotes } = req.body;

    const validStatuses = ["PENDING", "ANALYZED", "CONFIRMED", "DISMISSED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const correlation = await observabilityService.updateCorrelationStatus(
      correlationId,
      status,
      resolutionNotes,
      req.admin?.email
    );

    res.json(correlation);
  } catch (error) {
    console.error("[Observability] Error updating correlation status:", error);
    res.status(500).json({ error: "Failed to update correlation status" });
  }
});

router.post("/correlations/find-related", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { eventType, eventId, timeWindowMinutes = 30 } = req.body;

    const relatedEvents = await observabilityService.findRelatedEvents(
      eventType,
      eventId,
      timeWindowMinutes
    );

    res.json(relatedEvents);
  } catch (error) {
    console.error("[Observability] Error finding related events:", error);
    res.status(500).json({ error: "Failed to find related events" });
  }
});

router.post("/correlations/suggest-root-cause", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { correlatedEvents } = req.body;

    const suggestion = await observabilityService.suggestRootCause(correlatedEvents || []);

    res.json(suggestion);
  } catch (error) {
    console.error("[Observability] Error suggesting root cause:", error);
    res.status(500).json({ error: "Failed to suggest root cause" });
  }
});

router.get("/health", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const services = await observabilityService.getServiceHealth();
    res.json({ services });
  } catch (error) {
    console.error("[Observability] Error fetching service health:", error);
    res.status(500).json({ error: "Failed to fetch service health" });
  }
});

router.get("/jobs", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = "20" } = req.query;
    const jobs = await observabilityService.getRecentJobs(parseInt(limit as string));
    res.json({ jobs });
  } catch (error) {
    console.error("[Observability] Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/errors", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = "20" } = req.query;
    const errors = await observabilityService.getRecentErrors(parseInt(limit as string));
    res.json({ errors });
  } catch (error) {
    console.error("[Observability] Error fetching errors:", error);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

router.get("/alerts", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const alerts = await prisma.metricThresholdAlert.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ alerts });
  } catch (error) {
    console.error("[Observability] Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.post("/alerts", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      metricType, 
      thresholdType, 
      thresholdValue, 
      alertSeverity,
      alertMessage,
      cooldownMinutes,
      notifyWebSocket,
      notifyEmail,
      notifyRecipients,
    } = req.body;

    const alert = await prisma.metricThresholdAlert.create({
      data: {
        metricType,
        thresholdType,
        thresholdValue,
        alertSeverity: alertSeverity || "WARNING",
        alertMessage,
        cooldownMinutes: cooldownMinutes || 15,
        notifyWebSocket: notifyWebSocket !== false,
        notifyEmail: notifyEmail || false,
        notifyRecipients: notifyRecipients || [],
        createdBy: req.admin?.id,
        createdByName: req.admin?.email,
      },
    });

    res.status(201).json(alert);
  } catch (error) {
    console.error("[Observability] Error creating alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.patch("/alerts/:id", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      isEnabled, 
      thresholdValue, 
      alertMessage,
      cooldownMinutes,
      notifyWebSocket,
      notifyEmail,
    } = req.body;

    const alert = await prisma.metricThresholdAlert.update({
      where: { id },
      data: {
        ...(isEnabled !== undefined && { isEnabled }),
        ...(thresholdValue !== undefined && { thresholdValue }),
        ...(alertMessage !== undefined && { alertMessage }),
        ...(cooldownMinutes !== undefined && { cooldownMinutes }),
        ...(notifyWebSocket !== undefined && { notifyWebSocket }),
        ...(notifyEmail !== undefined && { notifyEmail }),
      },
    });

    res.json(alert);
  } catch (error) {
    console.error("[Observability] Error updating alert:", error);
    res.status(500).json({ error: "Failed to update alert" });
  }
});

router.delete("/alerts/:id", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.metricThresholdAlert.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Observability] Error deleting alert:", error);
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

router.get("/dashboard", requireObservabilityAccess, async (req: AuthRequest, res: Response) => {
  try {
    const [currentMetrics, logStats, recentErrors, services, pendingCorrelations] = await Promise.all([
      observabilityService.collectSystemMetrics(),
      observabilityService.getLogStats(24),
      observabilityService.getRecentErrors(5),
      observabilityService.getServiceHealth(),
      prisma.eventCorrelation.count({
        where: { analysisStatus: "PENDING" },
      }),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      metrics: currentMetrics,
      logStats,
      recentErrors,
      services,
      pendingCorrelations,
    });
  } catch (error) {
    console.error("[Observability] Error fetching dashboard data:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

export default router;

