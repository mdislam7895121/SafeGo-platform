import { prisma } from "../db";
import os from "os";

type LogCategory = "API" | "AUTH" | "FRAUD" | "DRIVER" | "ERROR" | "PAYMENT" | "SYSTEM";
type LogSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

interface MetricData {
  metricType: string;
  value: number;
  unit: string;
  windowMinutes?: number;
  hostId?: string;
  metadata?: Record<string, any>;
}

interface LogData {
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  source: string;
  userId?: string;
  adminId?: string;
  requestId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  errorCode?: string;
  stackTrace?: string;
  ipAddress?: string;
  userAgent?: string;
  countryCode?: string;
  metadata?: Record<string, any>;
}

interface CorrelatedEvent {
  eventType: string;
  eventId: string;
  eventTime: Date;
  confidence: number;
}

interface EventCorrelationData {
  rootEventType: string;
  rootEventId: string;
  rootEventTime: Date;
  correlatedEvents: CorrelatedEvent[];
  suggestedRootCause?: string;
  confidenceScore?: number;
  affectedUserId?: string;
  affectedDriverId?: string;
  affectedOrderId?: string;
  affectedRideId?: string;
  impactLevel?: string;
  estimatedImpact?: string;
}

export const observabilityService = {
  async recordMetric(data: MetricData): Promise<void> {
    const now = new Date();
    const windowMinutes = data.windowMinutes || 1;
    const windowStart = new Date(Math.floor(now.getTime() / (windowMinutes * 60000)) * (windowMinutes * 60000));
    const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60000);

    await prisma.systemMetric.create({
      data: {
        metricType: data.metricType,
        value: data.value,
        unit: data.unit,
        windowStart,
        windowEnd,
        windowMinutes,
        environment: process.env.NODE_ENV || "development",
        hostId: data.hostId || os.hostname(),
        minValue: data.value,
        maxValue: data.value,
        avgValue: data.value,
        sampleCount: 1,
        metadata: data.metadata || {},
      },
    });
  },

  async collectSystemMetrics(): Promise<{
    cpu: number;
    memory: number;
    dbConnections: number;
    jobQueueDepth: number;
    websocketConnections: number;
  }> {
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    const [jobQueueDepth, websocketEstimate] = await Promise.all([
      prisma.systemJobRun.count({
        where: { status: "RUNNING" }
      }),
      Promise.resolve(Math.floor(Math.random() * 50) + 10),
    ]);

    const dbConnections = 10;

    return {
      cpu: Math.round(cpuUsage * 100) / 100,
      memory: Math.round(memoryUsage * 100) / 100,
      dbConnections,
      jobQueueDepth,
      websocketConnections: websocketEstimate,
    };
  },

  async getMetrics(params: {
    metricType?: string;
    windowMinutes?: number;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<any[]> {
    const { metricType, windowMinutes, startTime, endTime, limit = 100 } = params;
    const now = new Date();

    return prisma.systemMetric.findMany({
      where: {
        ...(metricType && { metricType }),
        ...(windowMinutes && { windowMinutes }),
        windowStart: {
          gte: startTime || new Date(now.getTime() - 60 * 60 * 1000),
          lte: endTime || now,
        },
      },
      orderBy: { windowStart: "desc" },
      take: limit,
    });
  },

  async getMetricTrends(metricType: string, hours: number = 1): Promise<{
    oneMinute: any[];
    fiveMinute: any[];
    fifteenMinute: any[];
  }> {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const [oneMinute, fiveMinute, fifteenMinute] = await Promise.all([
      prisma.systemMetric.findMany({
        where: {
          metricType,
          windowMinutes: 1,
          windowStart: { gte: startTime },
        },
        orderBy: { windowStart: "asc" },
        take: 60,
      }),
      prisma.systemMetric.findMany({
        where: {
          metricType,
          windowMinutes: 5,
          windowStart: { gte: startTime },
        },
        orderBy: { windowStart: "asc" },
        take: 12,
      }),
      prisma.systemMetric.findMany({
        where: {
          metricType,
          windowMinutes: 15,
          windowStart: { gte: startTime },
        },
        orderBy: { windowStart: "asc" },
        take: 4,
      }),
    ]);

    return { oneMinute, fiveMinute, fifteenMinute };
  },

  async recordLog(data: LogData): Promise<void> {
    await prisma.observabilityLog.create({
      data: {
        category: data.category,
        severity: data.severity,
        message: data.message,
        source: data.source,
        userId: data.userId,
        adminId: data.adminId,
        requestId: data.requestId,
        sessionId: data.sessionId,
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        latencyMs: data.latencyMs,
        errorCode: data.errorCode,
        stackTrace: data.stackTrace,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        countryCode: data.countryCode,
        metadata: data.metadata || {},
      },
    });
  },

  async getLogs(params: {
    category?: LogCategory;
    severity?: LogSeverity;
    source?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const { 
      category, 
      severity, 
      source, 
      userId, 
      startTime, 
      endTime, 
      searchQuery,
      limit = 100, 
      offset = 0 
    } = params;

    const now = new Date();
    const where: any = {
      createdAt: {
        gte: startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000),
        lte: endTime || now,
      },
    };

    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (source) where.source = { contains: source, mode: "insensitive" };
    if (userId) where.userId = userId;
    if (searchQuery) {
      where.OR = [
        { message: { contains: searchQuery, mode: "insensitive" } },
        { errorCode: { contains: searchQuery, mode: "insensitive" } },
        { path: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.observabilityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.observabilityLog.count({ where }),
    ]);

    return { logs, total };
  },

  async getLogStats(hours: number = 24): Promise<{
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    errorRate: number;
    totalLogs: number;
  }> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [categoryStats, severityStats, sourceStats, totalLogs, errorLogs] = await Promise.all([
      prisma.observabilityLog.groupBy({
        by: ["category"],
        where: { createdAt: { gte: startTime } },
        _count: true,
      }),
      prisma.observabilityLog.groupBy({
        by: ["severity"],
        where: { createdAt: { gte: startTime } },
        _count: true,
      }),
      prisma.observabilityLog.groupBy({
        by: ["source"],
        where: { createdAt: { gte: startTime } },
        _count: true,
        take: 10,
        orderBy: { _count: { source: "desc" } },
      }),
      prisma.observabilityLog.count({
        where: { createdAt: { gte: startTime } },
      }),
      prisma.observabilityLog.count({
        where: {
          createdAt: { gte: startTime },
          severity: { in: ["ERROR", "CRITICAL"] },
        },
      }),
    ]);

    return {
      byCategory: Object.fromEntries(categoryStats.map(s => [s.category, s._count])),
      bySeverity: Object.fromEntries(severityStats.map(s => [s.severity, s._count])),
      bySource: Object.fromEntries(sourceStats.map(s => [s.source, s._count])),
      errorRate: totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0,
      totalLogs,
    };
  },

  async createEventCorrelation(data: EventCorrelationData): Promise<any> {
    const correlationId = crypto.randomUUID();

    return prisma.eventCorrelation.create({
      data: {
        correlationId,
        rootEventType: data.rootEventType,
        rootEventId: data.rootEventId,
        rootEventTime: data.rootEventTime,
        correlatedEvents: data.correlatedEvents,
        suggestedRootCause: data.suggestedRootCause,
        confidenceScore: data.confidenceScore,
        analysisStatus: "PENDING",
        affectedUserId: data.affectedUserId,
        affectedDriverId: data.affectedDriverId,
        affectedOrderId: data.affectedOrderId,
        affectedRideId: data.affectedRideId,
        impactLevel: data.impactLevel,
        estimatedImpact: data.estimatedImpact,
      },
    });
  },

  async getEventCorrelations(params: {
    rootEventType?: string;
    analysisStatus?: string;
    impactLevel?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ correlations: any[]; total: number }> {
    const { 
      rootEventType, 
      analysisStatus, 
      impactLevel,
      startTime, 
      endTime, 
      limit = 50, 
      offset = 0 
    } = params;

    const where: any = {};
    if (rootEventType) where.rootEventType = rootEventType;
    if (analysisStatus) where.analysisStatus = analysisStatus;
    if (impactLevel) where.impactLevel = impactLevel;
    if (startTime || endTime) {
      where.rootEventTime = {};
      if (startTime) where.rootEventTime.gte = startTime;
      if (endTime) where.rootEventTime.lte = endTime;
    }

    const [correlations, total] = await Promise.all([
      prisma.eventCorrelation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.eventCorrelation.count({ where }),
    ]);

    return { correlations, total };
  },

  async updateCorrelationStatus(
    correlationId: string,
    status: string,
    resolutionNotes?: string,
    resolvedBy?: string
  ): Promise<any> {
    return prisma.eventCorrelation.update({
      where: { correlationId },
      data: {
        analysisStatus: status,
        ...(status === "CONFIRMED" || status === "DISMISSED" ? {
          resolvedAt: new Date(),
          resolvedBy,
          resolutionNotes,
        } : {}),
      },
    });
  },

  async findRelatedEvents(eventType: string, eventId: string, timeWindowMinutes: number = 30): Promise<{
    incidents: any[];
    fraudAlerts: any[];
    paymentFailures: any[];
    driverViolations: any[];
  }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);

    const [incidents, fraudAlerts, paymentFailures, driverViolations] = await Promise.all([
      prisma.incidentReport?.findMany?.({
        where: { createdAt: { gte: windowStart } },
        take: 10,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
      prisma.fraudAlert?.findMany?.({
        where: { createdAt: { gte: windowStart } },
        take: 10,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
      prisma.observabilityLog.findMany({
        where: {
          category: "PAYMENT",
          severity: { in: ["ERROR", "CRITICAL"] },
          createdAt: { gte: windowStart },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.driverViolation?.findMany?.({
        where: { createdAt: { gte: windowStart } },
        take: 10,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
    ]);

    return {
      incidents: incidents || [],
      fraudAlerts: fraudAlerts || [],
      paymentFailures: paymentFailures || [],
      driverViolations: driverViolations || [],
    };
  },

  async suggestRootCause(correlatedEvents: CorrelatedEvent[]): Promise<{
    suggestion: string;
    confidence: number;
  }> {
    if (correlatedEvents.length === 0) {
      return { suggestion: "Insufficient data for analysis", confidence: 0 };
    }

    const eventTypes = correlatedEvents.map(e => e.eventType);
    
    if (eventTypes.includes("payment_failure") && eventTypes.includes("fraud_alert")) {
      return {
        suggestion: "Potential fraud-related payment block. Review fraud detection rules and user payment history.",
        confidence: 0.85,
      };
    }
    
    if (eventTypes.includes("driver_violation") && eventTypes.includes("incident")) {
      return {
        suggestion: "Driver behavior issue leading to safety incident. Recommend driver retraining or suspension review.",
        confidence: 0.78,
      };
    }
    
    if (eventTypes.filter(t => t === "error").length >= 3) {
      return {
        suggestion: "Multiple system errors detected. Check service health and recent deployments.",
        confidence: 0.72,
      };
    }

    return {
      suggestion: "Pattern analysis inconclusive. Manual review recommended.",
      confidence: 0.45,
    };
  },

  async getServiceHealth(): Promise<any[]> {
    const recentChecks = await prisma.serviceHealthCheck.findMany({
      orderBy: { checkedAt: "desc" },
      take: 20,
    });

    const servicesMap = new Map<string, any>();
    for (const check of recentChecks) {
      if (!servicesMap.has(check.serviceName)) {
        servicesMap.set(check.serviceName, check);
      }
    }

    return Array.from(servicesMap.values());
  },

  async getRecentJobs(limit: number = 20): Promise<any[]> {
    return prisma.systemJobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },

  async getRecentErrors(limit: number = 20): Promise<any[]> {
    return prisma.systemError.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async exportLogs(params: {
    format: "csv" | "json";
    category?: LogCategory;
    severity?: LogSeverity;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<string> {
    const { format, category, severity, startTime, endTime, limit = 1000 } = params;
    
    const now = new Date();
    const logs = await prisma.observabilityLog.findMany({
      where: {
        ...(category && { category }),
        ...(severity && { severity }),
        createdAt: {
          gte: startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lte: endTime || now,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (format === "json") {
      return JSON.stringify(logs, null, 2);
    }

    const headers = [
      "id", "category", "severity", "message", "source", "userId", 
      "method", "path", "statusCode", "latencyMs", "errorCode", "createdAt"
    ];
    
    const rows = logs.map(log => [
      log.id,
      log.category,
      log.severity,
      `"${(log.message || "").replace(/"/g, '""')}"`,
      log.source,
      log.userId || "",
      log.method || "",
      log.path || "",
      log.statusCode || "",
      log.latencyMs || "",
      log.errorCode || "",
      log.createdAt.toISOString(),
    ].join(","));

    return [headers.join(","), ...rows].join("\n");
  },
};

export type { LogCategory, LogSeverity, MetricData, LogData, CorrelatedEvent, EventCorrelationData };
