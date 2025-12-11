import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { createTokenPair, refreshTokenPair, revokeAllUserTokens, revokeTokenFamily } from "../middleware/jwtRotation";
import { checkOTPRateLimit, recordOTPRequest, recordOTPVerification } from "../middleware/otpRateLimiter";
import { checkLoginThrottle, recordLoginAttempt, clearLoginBlocks } from "../middleware/loginThrottling";
import { checkSuspiciousLogin, createSecurityAlert, acknowledgeSecurityAlert, reviewSecurityAlert } from "../middleware/suspiciousLoginAlerts";
import { unblockIdentifier, getRateLimitStats } from "../middleware/apiRateLimiter";
import { getWAFStats } from "../middleware/wafMiddleware";
import { createAdminAuditLog, verifyAuditLogIntegrity } from "../middleware/adminAuditLog";

const router = Router();
const prisma = new PrismaClient();

router.post("/token/create", async (req: Request, res: Response) => {
  try {
    const { userId, userRole, email, deviceId, deviceFingerprint, ipAddress, userAgent } = req.body;

    if (!userId || !userRole) {
      return res.status(400).json({ error: "userId and userRole are required" });
    }

    const tokens = await createTokenPair(userId, userRole, email, {
      deviceId,
      deviceFingerprint,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers["user-agent"],
    });

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenFamily: tokens.tokenFamily,
    });
  } catch (error: any) {
    console.error("[Security] Token creation error:", error);
    res.status(500).json({ error: "Failed to create tokens" });
  }
});

router.post("/token/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken, deviceId, ipAddress, userAgent } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const tokens = await refreshTokenPair(refreshToken, {
      deviceId,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers["user-agent"],
    });

    if (!tokens) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error: any) {
    console.error("[Security] Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh tokens" });
  }
});

router.post("/token/revoke-user", async (req: Request, res: Response) => {
  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const count = await revokeAllUserTokens(userId, reason || "User logout");
    res.json({ success: true, revokedCount: count });
  } catch (error: any) {
    console.error("[Security] Token revocation error:", error);
    res.status(500).json({ error: "Failed to revoke tokens" });
  }
});

router.post("/token/revoke-family", async (req: Request, res: Response) => {
  try {
    const { tokenFamily, reason } = req.body;

    if (!tokenFamily) {
      return res.status(400).json({ error: "tokenFamily is required" });
    }

    const count = await revokeTokenFamily(tokenFamily, reason || "Session terminated");
    res.json({ success: true, revokedCount: count });
  } catch (error: any) {
    console.error("[Security] Token family revocation error:", error);
    res.status(500).json({ error: "Failed to revoke token family" });
  }
});

router.get("/device-history/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { includeRemoved } = req.query;

    const devices = await prisma.deviceHistory.findMany({
      where: {
        userId,
        ...(includeRemoved !== "true" && { removedByUser: false }),
      },
      orderBy: { lastSeenAt: "desc" },
    });

    res.json({ devices });
  } catch (error: any) {
    console.error("[Security] Device history error:", error);
    res.status(500).json({ error: "Failed to fetch device history" });
  }
});

router.post("/device-history", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      userRole,
      deviceId,
      deviceName,
      deviceModel,
      osName,
      osVersion,
      appVersion,
      platform,
      ipAddress,
      ipCountry,
      ipCity,
      riskScore,
      riskFactors,
    } = req.body;

    if (!userId || !userRole || !deviceId) {
      return res.status(400).json({ error: "userId, userRole, and deviceId are required" });
    }

    const existingDevice = await prisma.deviceHistory.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (existingDevice) {
      const updated = await prisma.deviceHistory.update({
        where: { id: existingDevice.id },
        data: {
          lastSeenAt: new Date(),
          loginCount: existingDevice.loginCount + 1,
          lastLoginIp: ipAddress || req.ip,
          ipCountry: ipCountry || existingDevice.ipCountry,
          ipCity: ipCity || existingDevice.ipCity,
          appVersion: appVersion || existingDevice.appVersion,
          riskScore: riskScore ?? existingDevice.riskScore,
          riskFactors: riskFactors || existingDevice.riskFactors,
        },
      });

      res.json({ device: updated, isNew: false });
    } else {
      const created = await prisma.deviceHistory.create({
        data: {
          userId,
          userRole,
          deviceId,
          deviceName,
          deviceModel,
          osName,
          osVersion,
          appVersion,
          platform,
          ipAddress: ipAddress || req.ip,
          ipCountry,
          ipCity,
          lastLoginIp: ipAddress || req.ip,
          riskScore: riskScore || 0,
          riskFactors,
        },
      });

      res.json({ device: created, isNew: true });
    }
  } catch (error: any) {
    console.error("[Security] Device history creation error:", error);
    res.status(500).json({ error: "Failed to record device" });
  }
});

router.post("/device-history/:userId/:deviceId/trust", async (req: Request, res: Response) => {
  try {
    const { userId, deviceId } = req.params;

    const device = await prisma.deviceHistory.update({
      where: { userId_deviceId: { userId, deviceId } },
      data: { isTrusted: true },
    });

    res.json({ success: true, device });
  } catch (error: any) {
    console.error("[Security] Device trust error:", error);
    res.status(500).json({ error: "Failed to trust device" });
  }
});

router.delete("/device-history/:userId/:deviceId", async (req: Request, res: Response) => {
  try {
    const { userId, deviceId } = req.params;

    const device = await prisma.deviceHistory.update({
      where: { userId_deviceId: { userId, deviceId } },
      data: {
        isActive: false,
        removedByUser: true,
        removedAt: new Date(),
      },
    });

    res.json({ success: true, device });
  } catch (error: any) {
    console.error("[Security] Device removal error:", error);
    res.status(500).json({ error: "Failed to remove device" });
  }
});

router.get("/login-attempts/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const { limit = "50" } = req.query;

    const attempts = await prisma.loginAttempt.findMany({
      where: { identifier },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
    });

    res.json({ attempts });
  } catch (error: any) {
    console.error("[Security] Login attempts error:", error);
    res.status(500).json({ error: "Failed to fetch login attempts" });
  }
});

router.post("/login-attempts/clear-blocks", async (req: Request, res: Response) => {
  try {
    const { identifier, adminId } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: "identifier is required" });
    }

    const count = await clearLoginBlocks(identifier, adminId);
    res.json({ success: true, clearedCount: count });
  } catch (error: any) {
    console.error("[Security] Clear blocks error:", error);
    res.status(500).json({ error: "Failed to clear blocks" });
  }
});

router.get("/alerts/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { acknowledged } = req.query;

    const alerts = await prisma.securityAlert.findMany({
      where: {
        userId,
        ...(acknowledged === "true" && { acknowledged: true }),
        ...(acknowledged === "false" && { acknowledged: false }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ alerts });
  } catch (error: any) {
    console.error("[Security] Alerts error:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.post("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { userId, wasLegitimate } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    await acknowledgeSecurityAlert(alertId, wasLegitimate ?? true, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Security] Alert acknowledge error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/alerts/:alertId/review", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { adminId, reviewNote } = req.body;

    if (!adminId || !reviewNote) {
      return res.status(400).json({ error: "adminId and reviewNote are required" });
    }

    await reviewSecurityAlert(alertId, adminId, reviewNote);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Security] Alert review error:", error);
    res.status(500).json({ error: "Failed to review alert" });
  }
});

router.post("/rate-limit/unblock", async (req: Request, res: Response) => {
  try {
    const { identifier, adminId, reason } = req.body;

    if (!identifier || !adminId) {
      return res.status(400).json({ error: "identifier and adminId are required" });
    }

    const count = await unblockIdentifier(identifier, adminId, reason || "Admin unblock");
    res.json({ success: true, unblockedCount: count });
  } catch (error: any) {
    console.error("[Security] Unblock error:", error);
    res.status(500).json({ error: "Failed to unblock" });
  }
});

router.get("/rate-limit/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getRateLimitStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[Security] Rate limit stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/rate-limit/blocks", async (req: Request, res: Response) => {
  try {
    const { active = "true", limit = "50" } = req.query;

    const blocks = await prisma.rateLimitBlock.findMany({
      where: {
        ...(active === "true" && { isBlocked: true, blockedUntil: { gt: new Date() } }),
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
    });

    res.json({ blocks });
  } catch (error: any) {
    console.error("[Security] Rate limit blocks error:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.get("/waf/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getWAFStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[Security] WAF stats error:", error);
    res.status(500).json({ error: "Failed to fetch WAF stats" });
  }
});

router.get("/waf/logs", async (req: Request, res: Response) => {
  try {
    const { blocked, threatType, limit = "50" } = req.query;

    const logs = await prisma.wafLog.findMany({
      where: {
        ...(blocked === "true" && { wasBlocked: true }),
        ...(blocked === "false" && { wasBlocked: false }),
        ...(threatType && { threatType: threatType as string }),
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
    });

    res.json({ logs });
  } catch (error: any) {
    console.error("[Security] WAF logs error:", error);
    res.status(500).json({ error: "Failed to fetch WAF logs" });
  }
});

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { adminId, actionCategory, actionSeverity, limit = "100" } = req.query;

    const logs = await prisma.adminFullAuditLog.findMany({
      where: {
        ...(adminId && { adminId: adminId as string }),
        ...(actionCategory && { actionCategory: actionCategory as string }),
        ...(actionSeverity && { actionSeverity: actionSeverity as string }),
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
    });

    res.json({ logs });
  } catch (error: any) {
    console.error("[Security] Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/audit-logs/verify", async (req: Request, res: Response) => {
  try {
    const result = await verifyAuditLogIntegrity();
    res.json(result);
  } catch (error: any) {
    console.error("[Security] Audit verify error:", error);
    res.status(500).json({ error: "Failed to verify audit logs" });
  }
});

router.get("/auth-tokens/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { active = "true" } = req.query;

    const tokens = await prisma.authToken.findMany({
      where: {
        userId,
        ...(active === "true" && { isRevoked: false, refreshExpiresAt: { gt: new Date() } }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tokenFamily: true,
        tokenVersion: true,
        deviceId: true,
        ipAddress: true,
        userAgent: true,
        isRevoked: true,
        revokedReason: true,
        accessExpiresAt: true,
        refreshExpiresAt: true,
        reuseDetected: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ tokens });
  } catch (error: any) {
    console.error("[Security] Auth tokens error:", error);
    res.status(500).json({ error: "Failed to fetch auth tokens" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      activeTokens,
      activeBlocks,
      todayLoginAttempts,
      todayFailedLogins,
      wafBlockedToday,
      alertsToday,
      unacknowledgedAlerts,
      activeDevices,
      auditLogsToday,
    ] = await Promise.all([
      prisma.authToken.count({
        where: { isRevoked: false, refreshExpiresAt: { gt: now } },
      }),
      prisma.rateLimitBlock.count({
        where: { isBlocked: true, blockedUntil: { gt: now } },
      }),
      prisma.loginAttempt.count({
        where: { attemptType: "login", createdAt: { gte: todayStart } },
      }),
      prisma.loginAttempt.count({
        where: { attemptType: "login", success: false, createdAt: { gte: todayStart } },
      }),
      prisma.wafLog.count({
        where: { wasBlocked: true, createdAt: { gte: todayStart } },
      }),
      prisma.securityAlert.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.securityAlert.count({
        where: { acknowledged: false },
      }),
      prisma.deviceHistory.count({
        where: { isActive: true, lastSeenAt: { gte: weekStart } },
      }),
      prisma.adminFullAuditLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
    ]);

    res.json({
      overview: {
        activeTokens,
        activeBlocks,
        activeDevices,
      },
      today: {
        loginAttempts: todayLoginAttempts,
        failedLogins: todayFailedLogins,
        wafBlocked: wafBlockedToday,
        securityAlerts: alertsToday,
        auditLogs: auditLogsToday,
      },
      pending: {
        unacknowledgedAlerts,
      },
    });
  } catch (error: any) {
    console.error("[Security] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

export default router;
