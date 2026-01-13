// PRODUCTION DIAGNOSTICS: Log memory and NODE_OPTIONS at startup BEFORE anything else
import * as v8 from "v8";
console.log("=".repeat(60));
console.log("RAILWAY STARTUP DIAGNOSTICS");
console.log("=".repeat(60));
console.log("NODE_OPTIONS:", process.env.NODE_OPTIONS || "(not set)");
console.log("NODE_ENV:", process.env.NODE_ENV || "(not set)");
console.log("DISABLE_OBSERVABILITY:", process.env.DISABLE_OBSERVABILITY || "(not set)");
console.log("DISABLE_WEBSOCKETS:", process.env.DISABLE_WEBSOCKETS || "(not set)");
console.log("DISABLE_AUDIT:", process.env.DISABLE_AUDIT || "(not set)");
const startupMem = process.memoryUsage();
console.log("MEM:", {
  heapUsed: Math.round(startupMem.heapUsed / 1024 / 1024) + "MB",
  heapTotal: Math.round(startupMem.heapTotal / 1024 / 1024) + "MB",
  rss: Math.round(startupMem.rss / 1024 / 1024) + "MB",
});
try {
  const heapStats = v8.getHeapStatistics();
  console.log("V8 heap_size_limit:", Math.round(heapStats.heap_size_limit / 1024 / 1024) + "MB");
} catch {
  console.log("V8 heap stats unavailable");
}
console.log("=".repeat(60));

// CRITICAL: Validate security configuration FIRST before ANY imports
// Must be the FIRST import and call to ensure no other modules load insecure defaults
import { guardEnvironment, logProductionStartupBanner, assertDemoModeDisabled, logPaymentGatewayStatus } from "./utils/environmentGuard";
guardEnvironment();
assertDemoModeDisabled();
logProductionStartupBanner();

// Now safe to import other modules (they will throw if secrets missing, but guard already validated)
import express, { type Request, Response, NextFunction } from "express";
import { startMemoryMonitor } from "./utils/memoryMonitor";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { securityHeaders, corsMiddleware, csrfProtection, landingRateLimiter, httpsRedirect, notFoundProbeDetector, cspViolationHandler } from "./middleware/securityHeaders";
import { secureErrorHandler, notFoundHandler } from "./middleware/errorHandler";
import { compressionMiddleware, staticAssetCaching, cdnHeaders, earlyHints } from "./middleware/performance";

const app = express();

// Force HTTPS redirect first (production only)
app.use(httpsRedirect);

// Performance optimizations - compression and caching
app.use(compressionMiddleware);
app.use(staticAssetCaching);
app.use(cdnHeaders);
app.use(earlyHints);

// Apply CORS, security headers, CSRF protection, and landing page rate limiting globally
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(csrfProtection);
app.use(landingRateLimiter);
app.use(notFoundProbeDetector);

// CSP violation reporting endpoint
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), cspViolationHandler);

// Parse cookies for refresh token handling
app.use(cookieParser());

// CRITICAL: Register healthcheck EARLY before heavy imports for fast startup response
// This ensures Railway/Render/Fly.io healthchecks pass while the rest of the app loads
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// Serve attached assets (demo images, stock photos) statically
app.use("/attached_assets", express.static("attached_assets"));

// Serve SEO files with appropriate caching
app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile("sitemap.xml", { root: "./client/public" });
});

app.get("/robots.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile("robots.txt", { root: "./client/public" });
});

app.use((req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf|eot|map)$/)) {
    return next();
  }
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") && (duration > 50 || res.statusCode >= 400)) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 100)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("[Startup] Registering API routes...");
    const server = await registerRoutes(app);
    console.log("[Startup] API routes registered successfully");

    app.use(secureErrorHandler);

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = parseInt(process.env.PORT || '5000', 10);
    
    if (process.env.DISABLE_OBSERVABILITY !== "true") {
      startMemoryMonitor(30000, { warningPercent: 70, criticalPercent: 85 });
    } else {
      console.log("[MemoryMonitor] DISABLED via DISABLE_OBSERVABILITY=true");
    }

    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      logPaymentGatewayStatus();
    });
  } catch (error) {
    console.error("[FATAL] Server startup failed:", error);
    console.error("[FATAL] Routes could not be registered. Exiting...");
    process.exit(1);
  }
})();
