import { Router, Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth";
import { requireAdmin, checkAdminPermission } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import * as jobMonitoringService from "../services/jobMonitoringService";
import * as healthCheckService from "../services/healthCheckService";
import * as systemErrorService from "../services/systemErrorService";
import { z } from "zod";

const router = Router();

const checkOpsAccess = (requiredPermission: Permission) => {
  return [
    authenticateToken as any,
    requireAdmin(requiredPermission) as any,
  ];
};

router.get("/jobs", checkOpsAccess(Permission.VIEW_SYSTEM_JOBS), async (req: Request, res: Response) => {
  try {
    const { limit, jobName, jobCategory, status, environment } = req.query;

    const jobs = await jobMonitoringService.getRecentJobs({
      limit: limit ? parseInt(limit as string) : 50,
      jobName: jobName as string,
      jobCategory: jobCategory as string,
      status: status as any,
      environment: environment as string,
    });

    res.json({ jobs });
  } catch (error) {
    console.error("[Operations] Get jobs error:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/stats", checkOpsAccess(Permission.VIEW_SYSTEM_JOBS), async (req: Request, res: Response) => {
  try {
    const { hours } = req.query;
    const timeRangeHours = hours ? parseInt(hours as string) : 24;

    const stats = await jobMonitoringService.getJobStats(timeRangeHours);

    res.json({ stats });
  } catch (error) {
    console.error("[Operations] Get job stats error:", error);
    res.status(500).json({ error: "Failed to fetch job stats" });
  }
});

router.get("/jobs/running", checkOpsAccess(Permission.VIEW_SYSTEM_JOBS), async (req: Request, res: Response) => {
  try {
    const jobs = await jobMonitoringService.getRunningJobs();
    res.json({ jobs });
  } catch (error) {
    console.error("[Operations] Get running jobs error:", error);
    res.status(500).json({ error: "Failed to fetch running jobs" });
  }
});

router.get("/jobs/failed", checkOpsAccess(Permission.VIEW_SYSTEM_JOBS), async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const jobs = await jobMonitoringService.getFailedJobs(limit ? parseInt(limit as string) : 20);
    res.json({ jobs });
  } catch (error) {
    console.error("[Operations] Get failed jobs error:", error);
    res.status(500).json({ error: "Failed to fetch failed jobs" });
  }
});

router.post("/jobs/:jobId/cancel", checkOpsAccess(Permission.MANAGE_SYSTEM_JOBS), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;

    await jobMonitoringService.cancelJob(jobId, reason);

    res.json({ message: "Job cancelled" });
  } catch (error) {
    console.error("[Operations] Cancel job error:", error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

router.get("/health", checkOpsAccess(Permission.VIEW_HEALTH_CHECKS), async (req: Request, res: Response) => {
  try {
    const healthSummary = await healthCheckService.runAllHealthChecks();
    res.json(healthSummary);
  } catch (error) {
    console.error("[Operations] Health check error:", error);
    res.status(500).json({ error: "Failed to run health checks" });
  }
});

router.get("/health/latest", checkOpsAccess(Permission.VIEW_HEALTH_CHECKS), async (req: Request, res: Response) => {
  try {
    const checks = await healthCheckService.getLatestHealthChecks();
    res.json({ checks });
  } catch (error) {
    console.error("[Operations] Get latest health checks error:", error);
    res.status(500).json({ error: "Failed to fetch health checks" });
  }
});

router.post("/health/:serviceName/check", checkOpsAccess(Permission.RUN_HEALTH_CHECKS), async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const result = await healthCheckService.runHealthCheck(serviceName);
    res.json(result);
  } catch (error) {
    console.error("[Operations] Run health check error:", error);
    res.status(500).json({ error: "Failed to run health check" });
  }
});

router.get("/health/:serviceName/history", checkOpsAccess(Permission.VIEW_HEALTH_CHECKS), async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { limit } = req.query;

    const history = await healthCheckService.getHealthCheckHistory(
      serviceName,
      limit ? parseInt(limit as string) : 100
    );

    res.json({ history });
  } catch (error) {
    console.error("[Operations] Get health check history error:", error);
    res.status(500).json({ error: "Failed to fetch health check history" });
  }
});

const errorFiltersSchema = z.object({
  service: z.string().optional(),
  severity: z.enum(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]).optional(),
  severities: z.array(z.enum(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])).optional(),
  isResolved: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  correlationId: z.string().optional(),
  userId: z.string().optional(),
  countryCode: z.string().optional(),
  environment: z.string().optional(),
  searchQuery: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});

router.get("/errors", checkOpsAccess(Permission.VIEW_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const params = errorFiltersSchema.parse({
      ...req.query,
      isResolved: req.query.isResolved === "true" ? true : req.query.isResolved === "false" ? false : undefined,
      severities: req.query.severities ? (req.query.severities as string).split(",") : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });

    const { errors, total } = await systemErrorService.getErrors(
      {
        service: params.service,
        severity: params.severity,
        severities: params.severities,
        isResolved: params.isResolved,
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        endDate: params.endDate ? new Date(params.endDate) : undefined,
        correlationId: params.correlationId,
        userId: params.userId,
        countryCode: params.countryCode,
        environment: params.environment,
        searchQuery: params.searchQuery,
      },
      params.limit || 100,
      params.offset || 0
    );

    res.json({ errors, total });
  } catch (error) {
    console.error("[Operations] Get errors error:", error);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

router.get("/errors/stats", checkOpsAccess(Permission.VIEW_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const { hours } = req.query;
    const timeRangeHours = hours ? parseInt(hours as string) : 24;

    const stats = await systemErrorService.getErrorStats(timeRangeHours);

    res.json({ stats });
  } catch (error) {
    console.error("[Operations] Get error stats error:", error);
    res.status(500).json({ error: "Failed to fetch error stats" });
  }
});

router.get("/errors/trend", checkOpsAccess(Permission.VIEW_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const { hours, bucketMinutes } = req.query;
    
    const trend = await systemErrorService.getErrorTrend(
      hours ? parseInt(hours as string) : 24,
      bucketMinutes ? parseInt(bucketMinutes as string) : 60
    );

    res.json({ trend });
  } catch (error) {
    console.error("[Operations] Get error trend error:", error);
    res.status(500).json({ error: "Failed to fetch error trend" });
  }
});

router.get("/errors/critical", checkOpsAccess(Permission.VIEW_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const errors = await systemErrorService.getRecentCriticalErrors(
      limit ? parseInt(limit as string) : 10
    );
    res.json({ errors });
  } catch (error) {
    console.error("[Operations] Get critical errors error:", error);
    res.status(500).json({ error: "Failed to fetch critical errors" });
  }
});

router.get("/errors/services", checkOpsAccess(Permission.VIEW_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const services = await systemErrorService.getServices();
    res.json({ services });
  } catch (error) {
    console.error("[Operations] Get services error:", error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

router.get("/errors/:errorId", checkOpsAccess(Permission.VIEW_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const { errorId } = req.params;
    const error = await systemErrorService.getErrorById(errorId);

    if (!error) {
      return res.status(404).json({ error: "Error not found" });
    }

    res.json({ error });
  } catch (error) {
    console.error("[Operations] Get error by ID error:", error);
    res.status(500).json({ error: "Failed to fetch error" });
  }
});

router.post("/errors/:errorId/resolve", checkOpsAccess(Permission.RESOLVE_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const { errorId } = req.params;
    const { resolution } = req.body;
    const admin = (req as any).admin;

    if (!resolution) {
      return res.status(400).json({ error: "Resolution is required" });
    }

    await systemErrorService.resolveError(errorId, admin.email, resolution);

    res.json({ message: "Error resolved" });
  } catch (error) {
    console.error("[Operations] Resolve error error:", error);
    res.status(500).json({ error: "Failed to resolve error" });
  }
});

router.post("/errors/bulk-resolve", checkOpsAccess(Permission.RESOLVE_SYSTEM_ERRORS), async (req: Request, res: Response) => {
  try {
    const { errorIds, resolution } = req.body;
    const admin = (req as any).admin;

    if (!errorIds || !Array.isArray(errorIds) || errorIds.length === 0) {
      return res.status(400).json({ error: "Error IDs are required" });
    }

    if (!resolution) {
      return res.status(400).json({ error: "Resolution is required" });
    }

    const count = await systemErrorService.bulkResolveErrors(errorIds, admin.email, resolution);

    res.json({ message: `${count} errors resolved` });
  } catch (error) {
    console.error("[Operations] Bulk resolve errors error:", error);
    res.status(500).json({ error: "Failed to resolve errors" });
  }
});

router.get("/summary", checkOpsAccess(Permission.VIEW_OPERATIONS_CONSOLE), async (req: Request, res: Response) => {
  try {
    const [jobStats, errorStats, healthSummary, runningJobs, criticalErrors] = await Promise.all([
      jobMonitoringService.getJobStats(24),
      systemErrorService.getErrorStats(24),
      healthCheckService.runAllHealthChecks(),
      jobMonitoringService.getRunningJobs(),
      systemErrorService.getRecentCriticalErrors(5),
    ]);

    res.json({
      jobs: {
        ...jobStats,
        running: runningJobs.length,
      },
      errors: {
        ...errorStats,
        recentCritical: criticalErrors,
      },
      health: {
        status: healthSummary.overallStatus,
        ...healthSummary.stats,
      },
    });
  } catch (error) {
    console.error("[Operations] Get summary error:", error);
    res.status(500).json({ error: "Failed to fetch operations summary" });
  }
});

export default router;
