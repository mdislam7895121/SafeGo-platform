import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { observabilityService } from "./services/observabilityService";

const app = express();

// Global CORS for production frontend
const corsOptions = {
  origin: ["https://safegoglobal.com", "https://www.safegoglobal.com"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ROOT HEALTH CHECK (Railway + local)
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "SafeGo API",
    timestamp: new Date().toISOString(),
  });
});

// Some environments hit /api/health
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "SafeGo API",
    timestamp: new Date().toISOString(),
  });
});

// Legacy plaintext health endpoint expected by some platforms
app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});
const DISABLE_OBSERVABILITY =
  process.env.DISABLE_OBSERVABILITY === "true" ||
  process.env.DISABLE_SYSTEM_METRICS === "true";

const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ROLES = ["SUPER_ADMIN", "INFRA_ADMIN"];

interface AuthenticatedObservabilitySocket extends WebSocket {
  adminId?: string;
  adminEmail?: string;
  adminRole?: string;
  isAlive?: boolean;
  subscriptions?: Set<string>;
}

interface MetricsUpdate {
  type: "metrics_update";
  payload: {
    timestamp: string;
    cpu: number;
    memory: number;
    dbConnections: number;
    jobQueueDepth: number;
    websocketConnections: number;
  };
}

interface LogUpdate {
  type: "log_update";
  payload: {
    id: string;
    category: string;
    severity: string;
    message: string;
    source: string;
    createdAt: string;
  };
}

interface AlertUpdate {
  type: "alert_update";
  payload: {
    metricType: string;
    alertSeverity: string;
    alertMessage: string;
    currentValue: number;
    thresholdValue: number;
    triggeredAt: string;
  };
}

type ObservabilityEvent = MetricsUpdate | LogUpdate | AlertUpdate | { type: "connected" | "error"; payload: any };

const observabilityConnections = new Map<string, AuthenticatedObservabilitySocket>();
let wss: WebSocketServer | null = null;
let metricsInterval: NodeJS.Timeout | null = null;
const MAX_OBSERVABILITY_CONNECTIONS = 20;

export function setupObservabilityWebSocket(server: HTTPServer) {
  if (wss) {
    console.log('[Observability WebSocket] Already initialized, skipping duplicate setup');
    return;
  }

  // PRODUCTION SAFETY: Guard metrics collection by DATABASE_URL availability
  const OBSERVABILITY_DB_DISABLED = !process.env.DATABASE_URL || DISABLE_OBSERVABILITY;
  if (OBSERVABILITY_DB_DISABLED && !process.env.DATABASE_URL) {
    console.log('[Observability WebSocket] DATABASE_URL not set - metrics collection DISABLED (server will still listen)');
  }
  

  wss = new WebSocketServer({ server, path: "/api/admin/observability/ws" });

  wss.on("connection", async (ws: AuthenticatedObservabilitySocket, req) => {
    if (wss!.clients.size > MAX_OBSERVABILITY_CONNECTIONS) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Server at capacity" } }));
      ws.close();
      return;
    }
    
    ws.isAlive = true;
    ws.subscriptions = new Set(["metrics", "logs", "alerts"]);

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "No token provided" } }));
      ws.close();
      return;
    }

    if (!JWT_SECRET) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Server configuration error" } }));
      ws.close();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };

      const admin = await prisma.adminProfile.findUnique({
        where: { userId: decoded.id },
        select: {
          id: true,
          adminRole: true,
          user: { select: { email: true } },
        },
      });

      if (!admin) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Admin account not found" } }));
        ws.close();
        return;
      }

      if (!ALLOWED_ROLES.includes(admin.adminRole)) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Insufficient permissions for observability access" } }));
        ws.close();
        return;
      }

      ws.adminId = admin.id;
      ws.adminEmail = admin.user.email;
      ws.adminRole = admin.adminRole;

      observabilityConnections.set(admin.id, ws);

      ws.send(JSON.stringify({
        type: "connected",
        payload: {
          adminId: admin.id,
          adminRole: admin.adminRole,
          subscriptions: Array.from(ws.subscriptions),
        },
      }));

      const initialMetrics = await observabilityService.collectSystemMetrics();
      ws.send(JSON.stringify({
        type: "metrics_update",
        payload: {
          timestamp: new Date().toISOString(),
          ...initialMetrics,
        },
      }));

    } catch (error) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid token" } }));
      ws.close();
      return;
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleObservabilityMessage(ws, message);
      } catch (error) {
        console.error("[ObservabilityWS] Error handling message:", error);
      }
    });

    ws.on("close", () => {
      if (ws.adminId) {
        observabilityConnections.delete(ws.adminId);
      }
    });
  });

  const pingInterval = setInterval(() => {
    wss?.clients.forEach((ws: AuthenticatedObservabilitySocket) => {
      if (ws.isAlive === false) {
        if (ws.adminId) {
          observabilityConnections.delete(ws.adminId);
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // PRODUCTION SAFETY: Only start metrics collection if DATABASE_URL is available
  // This prevents boot-time Prisma errors from crashing the server
  if (!OBSERVABILITY_DB_DISABLED) {
    metricsInterval = setInterval(async () => {
      try {
        const metrics = await observabilityService.collectSystemMetrics();
        const metricsUpdate: MetricsUpdate = {
          type: "metrics_update",
          payload: {
            timestamp: new Date().toISOString(),
            ...metrics,
          },
        };

        await observabilityService.recordMetric({
          metricType: "cpu_usage",
          value: metrics.cpu,
          unit: "percent",
          windowMinutes: 1,
        });
        await observabilityService.recordMetric({
          metricType: "memory_usage",
          value: metrics.memory,
          unit: "percent",
          windowMinutes: 1,
        });

        broadcastToSubscribers("metrics", metricsUpdate);
        
        await checkThresholdAlerts(metrics);
      } catch (error) {
        console.error("[ObservabilityWS] Error collecting metrics:", error);
      }
    }, 60000);
  } else {
    console.log("[ObservabilityWS] Metrics interval DISABLED (DATABASE_URL not set)");
  }

  wss.on("close", () => {
    clearInterval(pingInterval);
    if (metricsInterval) {
      clearInterval(metricsInterval);
    }
  });

  console.log("Observability WebSocket server initialized at /api/admin/observability/ws");
}

async function handleObservabilityMessage(ws: AuthenticatedObservabilitySocket, message: any) {
  switch (message.type) {
    case "subscribe":
      if (message.channel && typeof message.channel === "string") {
        ws.subscriptions?.add(message.channel);
        ws.send(JSON.stringify({
          type: "subscribed",
          payload: { channel: message.channel },
        }));
      }
      break;

    case "unsubscribe":
      if (message.channel && typeof message.channel === "string") {
        ws.subscriptions?.delete(message.channel);
        ws.send(JSON.stringify({
          type: "unsubscribed",
          payload: { channel: message.channel },
        }));
      }
      break;

    case "request_metrics":
      const metrics = await observabilityService.collectSystemMetrics();
      ws.send(JSON.stringify({
        type: "metrics_update",
        payload: {
          timestamp: new Date().toISOString(),
          ...metrics,
        },
      }));
      break;

    case "request_logs":
      const { logs } = await observabilityService.getLogs({
        limit: message.limit || 50,
        category: message.category,
        severity: message.severity,
      });
      ws.send(JSON.stringify({
        type: "logs_batch",
        payload: { logs },
      }));
      break;
  }
}

function broadcastToSubscribers(channel: string, event: ObservabilityEvent) {
  observabilityConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN && ws.subscriptions?.has(channel)) {
      ws.send(JSON.stringify(event));
    }
  });
}

async function checkThresholdAlerts(metrics: { cpu: number; memory: number; dbConnections: number; jobQueueDepth: number }) {
  const alerts = await prisma.metricThresholdAlert.findMany({
    where: { isEnabled: true },
  });

  for (const alert of alerts) {
    let currentValue: number | undefined;
    
    switch (alert.metricType) {
      case "cpu_usage":
        currentValue = metrics.cpu;
        break;
      case "memory_usage":
        currentValue = metrics.memory;
        break;
      case "db_connections":
        currentValue = metrics.dbConnections;
        break;
      case "job_queue_depth":
        currentValue = metrics.jobQueueDepth;
        break;
    }

    if (currentValue === undefined) continue;

    const thresholdValue = Number(alert.thresholdValue);
    let shouldTrigger = false;

    switch (alert.thresholdType) {
      case "ABOVE":
        shouldTrigger = currentValue > thresholdValue;
        break;
      case "BELOW":
        shouldTrigger = currentValue < thresholdValue;
        break;
      case "EQUALS":
        shouldTrigger = currentValue === thresholdValue;
        break;
    }

    if (shouldTrigger) {
      const now = new Date();
      const lastTriggered = alert.lastTriggeredAt;
      const cooldownMs = alert.cooldownMinutes * 60 * 1000;

      if (!lastTriggered || (now.getTime() - lastTriggered.getTime()) > cooldownMs) {
        await prisma.metricThresholdAlert.update({
          where: { id: alert.id },
          data: {
            lastTriggeredAt: now,
            triggerCount: { increment: 1 },
          },
        });

        if (alert.notifyWebSocket) {
          const alertUpdate: AlertUpdate = {
            type: "alert_update",
            payload: {
              metricType: alert.metricType,
              alertSeverity: alert.alertSeverity,
              alertMessage: alert.alertMessage,
              currentValue,
              thresholdValue,
              triggeredAt: now.toISOString(),
            },
          };
          broadcastToSubscribers("alerts", alertUpdate);
        }
      }
    }
  }
}

export function broadcastLogUpdate(log: {
  id: string;
  category: string;
  severity: string;
  message: string;
  source: string;
  createdAt: Date;
}) {
  const logUpdate: LogUpdate = {
    type: "log_update",
    payload: {
      id: log.id,
      category: log.category,
      severity: log.severity,
      message: log.message,
      source: log.source,
      createdAt: log.createdAt.toISOString(),
    },
  };
  broadcastToSubscribers("logs", logUpdate);
}

export function getConnectedAdminCount(): number {
  return observabilityConnections.size;
}

const PORT = Number(process.env.PORT || 8080);

// Global error handlers to prevent silent crashes
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  // Do NOT exit; allow graceful degradation
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at promise:", promise, "reason:", reason);
  // Do NOT exit; allow graceful degradation
});

// Initialize server with all registered routes and start listening
(async () => {
  try {
    console.log(`[STARTUP] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[STARTUP] Port: ${PORT}`);
    console.log(`[STARTUP] Registering routes...`);
    
    const httpServer = await registerRoutes(app);
    
    console.log(`[STARTUP] Routes registered successfully`);
    console.log(`[STARTUP] Health endpoints: GET /health, GET /api/health, GET /healthz`);
    console.log(`[STARTUP] Auth endpoints available at /api/auth/*`);
    
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`[STARTUP] Server listening on 0.0.0.0:${PORT}`);
      console.log(`[STARTUP] Server listening on port ${PORT}`);
      console.log(`[STARTUP] Ready to accept requests`);
      console.log(`[STARTUP] Server running and stable`);
      console.log("[STARTUP] Process will remain alive and awaiting connections");
    });
  } catch (error) {
    console.error("[STARTUP] Failed to register routes:", error);
    console.error("[STARTUP] Retaining process alive for debugging. Manual restart required.");
    // Do NOT call process.exit(); keep alive for diagnostics
  }
})();






