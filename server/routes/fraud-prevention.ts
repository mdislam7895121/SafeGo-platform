import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { z } from "zod";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Access token required" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "safego-jwt-secret") as any;
    req.user = { id: decoded.userId || decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !["admin", "super_admin", "SUPER_ADMIN", "ADMIN", "RISK_ADMIN", "COMPLIANCE_ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(authenticateToken);

// =====================================================================
// TASK 16: Device Fingerprint & One-Account-Per-Device
// =====================================================================

const deviceFingerprintSchema = z.object({
  deviceId: z.string().min(1),
  deviceHash: z.string().optional(),
  os: z.string().min(1),
  osVersion: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  appVersion: z.string().optional(),
  browserInfo: z.string().optional(),
  ipAddress: z.string().optional(),
  countryCode: z.string().optional(),
  regionCode: z.string().optional(),
});

router.post("/device/register", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const data = deviceFingerprintSchema.parse(req.body);

    const existingDevice = await prisma.deviceFingerprint.findUnique({
      where: { userId_deviceId: { userId, deviceId: data.deviceId } },
    });

    if (existingDevice) {
      const updated = await prisma.deviceFingerprint.update({
        where: { id: existingDevice.id },
        data: {
          lastSeenAt: new Date(),
          loginCount: { increment: 1 },
          lastKnownIp: data.ipAddress,
          appVersion: data.appVersion,
        },
      });
      return res.json({ device: updated, status: "existing" });
    }

    // TASK 16: Check if this device is already registered to a DIFFERENT account (one-account-per-device)
    const deviceOnOtherAccounts = await prisma.deviceFingerprint.findMany({
      where: {
        deviceId: data.deviceId,
        userId: { not: userId },
        isBlocked: false,
      },
    });

    // Check if device is whitelisted for cross-account use
    const deviceWhitelisted = await prisma.deviceWhitelist.findFirst({
      where: {
        deviceId: data.deviceId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (deviceOnOtherAccounts.length > 0 && !deviceWhitelisted) {
      // Device is already used by another account - this is a fraud event
      await prisma.fraudEvent.create({
        data: {
          userId,
          userRole,
          eventType: "device_mismatch",
          severity: "high",
          description: `Device already registered to ${deviceOnOtherAccounts.length} other account(s). Possible multi-account fraud.`,
          deviceId: data.deviceId,
          deviceHash: data.deviceHash,
          ipAddress: data.ipAddress,
          scoreImpact: 30,
          autoRestrictApplied: true,
        },
      });

      // Also log event for the other accounts using this device
      for (const otherDevice of deviceOnOtherAccounts) {
        await prisma.fraudEvent.create({
          data: {
            userId: otherDevice.userId,
            userRole: otherDevice.userRole,
            eventType: "device_mismatch",
            severity: "high",
            description: `Another account attempted to use this device. Device shared with user ${userId.slice(0, 8)}...`,
            deviceId: data.deviceId,
            deviceHash: data.deviceHash,
            ipAddress: data.ipAddress,
            scoreImpact: 20,
          },
        });
        await updateFraudScore(otherDevice.userId, otherDevice.userRole, "deviceMismatch", 20);
      }

      await updateFraudScore(userId, userRole, "deviceMismatch", 30);

      // Block this registration and restrict the user
      return res.status(403).json({
        error: "Device already in use",
        message: "This device is already registered to another account. One account per device is enforced.",
        restricted: true,
        fraudEvent: "device_mismatch",
      });
    }

    // Check if user has too many devices (multi_device_login)
    const userDevices = await prisma.deviceFingerprint.findMany({
      where: { userId, isBlocked: false },
    });

    const userDeviceWhitelisted = await prisma.deviceWhitelist.findFirst({
      where: { userId, deviceId: data.deviceId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });

    if (userDevices.length > 0 && !userDeviceWhitelisted) {
      await prisma.fraudEvent.create({
        data: {
          userId,
          userRole,
          eventType: "multi_device_login",
          severity: "medium",
          description: `User attempted login from new device. Existing devices: ${userDevices.length}`,
          deviceId: data.deviceId,
          deviceHash: data.deviceHash,
          ipAddress: data.ipAddress,
          scoreImpact: 10,
        },
      });

      await updateFraudScore(userId, userRole, "deviceMismatch", 10);
    }

    const newDevice = await prisma.deviceFingerprint.create({
      data: {
        userId,
        userRole,
        deviceId: data.deviceId,
        deviceHash: data.deviceHash || data.deviceId,
        os: data.os,
        osVersion: data.osVersion,
        model: data.model,
        manufacturer: data.manufacturer,
        appVersion: data.appVersion,
        browserInfo: data.browserInfo,
        ipAddress: data.ipAddress,
        lastKnownIp: data.ipAddress,
        countryCode: data.countryCode,
        regionCode: data.regionCode,
      },
    });

    res.json({
      device: newDevice,
      status: "new",
      warning: userDevices.length > 0 && !userDeviceWhitelisted,
    });
  } catch (error: any) {
    console.error("[FraudPrevention] Device register error:", error);
    res.status(500).json({ error: error.message || "Failed to register device" });
  }
});

router.get("/device/list", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const devices = await prisma.deviceFingerprint.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
    });
    res.json({ devices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/device/logout-others", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentDeviceId } = req.body;

    await prisma.deviceFingerprint.updateMany({
      where: { userId, deviceId: { not: currentDeviceId } },
      data: { isBlocked: true, blockedReason: "Logged out by user" },
    });

    res.json({ success: true, message: "Other devices logged out" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/admin/devices", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, page = "1", limit = "20" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = userId ? { userId: userId as string } : {};
    const [devices, total] = await Promise.all([
      prisma.deviceFingerprint.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { lastSeenAt: "desc" },
      }),
      prisma.deviceFingerprint.count({ where }),
    ]);

    res.json({ devices, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/admin/device/whitelist", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, deviceId, reason, expiresAt } = req.body;
    const adminId = req.user!.id;

    const whitelist = await prisma.deviceWhitelist.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: {
        userId,
        userRole: "customer",
        deviceId,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: adminId,
      },
      update: {
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await prisma.deviceFingerprint.updateMany({
      where: { userId, deviceId },
      data: { isWhitelisted: true, whitelistedBy: adminId, whitelistedAt: new Date(), whitelistReason: reason },
    });

    res.json({ whitelist, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/admin/device/whitelist/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.deviceWhitelist.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// TASK 18: Fake GPS Detection
// =====================================================================

const gpsCheckSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timestamp: z.string().optional(),
  accuracy: z.number().optional(),
  deviceId: z.string().optional(),
  ipAddress: z.string().optional(),
});

router.post("/gps/validate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const data = gpsCheckSchema.parse(req.body);

    const lastLocation = await prisma.fraudEvent.findFirst({
      where: { userId, eventType: { in: ["fake_gps_detected", "impossible_movement"] } },
      orderBy: { createdAt: "desc" },
    });

    let isSuspicious = false;
    let fraudType: string | null = null;
    let details: any = {};

    if (lastLocation && lastLocation.latitude && lastLocation.longitude) {
      const distance = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        data.latitude,
        data.longitude
      );
      const timeDiff = (new Date().getTime() - lastLocation.createdAt.getTime()) / 1000;

      if (distance > 5 && timeDiff < 5) {
        isSuspicious = true;
        fraudType = "impossible_movement";
        details = {
          previousLat: lastLocation.latitude,
          previousLng: lastLocation.longitude,
          currentLat: data.latitude,
          currentLng: data.longitude,
          distanceKm: distance,
          timeSeconds: timeDiff,
        };
      }
    }

    if (isSuspicious && fraudType) {
      await prisma.fraudEvent.create({
        data: {
          userId,
          userRole,
          eventType: fraudType as any,
          severity: "high",
          description: `Impossible movement detected: ${details.distanceKm?.toFixed(2)}km in ${details.timeSeconds}s`,
          latitude: data.latitude,
          longitude: data.longitude,
          previousLat: details.previousLat,
          previousLng: details.previousLng,
          distanceKm: details.distanceKm,
          timeSeconds: Math.round(details.timeSeconds),
          deviceId: data.deviceId,
          ipAddress: data.ipAddress,
          scoreImpact: 25,
          autoRestrictApplied: true,
        },
      });

      await updateFraudScore(userId, userRole, "fakeGps", 25);

      return res.json({
        valid: false,
        reason: "suspicious_movement",
        restricted: true,
        message: "Location validation failed. Your account has been flagged for review.",
      });
    }

    res.json({ valid: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/admin/gps-fraud", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { eventType: { in: ["fake_gps_detected", "impossible_movement", "gps_ip_mismatch"] } };
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      prisma.fraudEvent.findMany({ where, skip, take: parseInt(limit as string), orderBy: { createdAt: "desc" } }),
      prisma.fraudEvent.count({ where }),
    ]);

    res.json({ events, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// TASK 19: COD Fraud Protection
// =====================================================================

const codFraudSchema = z.object({
  parcelId: z.string().optional(),
  orderId: z.string().optional(),
  codAmount: z.number(),
  expectedAmount: z.number().optional(),
  collectedAmount: z.number().optional(),
  fraudType: z.enum([
    "repeated_cancellation",
    "high_value_abuse",
    "location_mismatch",
    "delivery_not_received_claim",
    "payment_dispute",
    "fake_cod_amount",
    "collection_tampering",
  ]),
  description: z.string(),
});

router.post("/cod/report", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, userRole, ...data } = req.body;
    const parsed = codFraudSchema.parse(data);

    const discrepancy = parsed.expectedAmount && parsed.collectedAmount
      ? parsed.expectedAmount - parsed.collectedAmount
      : null;

    const log = await prisma.codFraudLog.create({
      data: {
        userId,
        userRole,
        parcelId: parsed.parcelId,
        orderId: parsed.orderId,
        fraudType: parsed.fraudType,
        codAmount: parsed.codAmount,
        expectedAmount: parsed.expectedAmount,
        collectedAmount: parsed.collectedAmount,
        discrepancy,
        description: parsed.description,
      },
    });

    await prisma.fraudEvent.create({
      data: {
        userId,
        userRole,
        eventType: "cod_fraud_suspected",
        severity: "high",
        description: parsed.description,
        parcelId: parsed.parcelId,
        orderId: parsed.orderId,
        scoreImpact: 20,
      },
    });

    await updateFraudScore(userId, userRole, "codFraud", 20);

    res.json({ log, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/cod/logs", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", userId, status, fraudType } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (fraudType) where.fraudType = fraudType;

    const [logs, total] = await Promise.all([
      prisma.codFraudLog.findMany({ where, skip, take: parseInt(limit as string), orderBy: { createdAt: "desc" } }),
      prisma.codFraudLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/cod/logs/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNote, resolution, autoRestricted } = req.body;
    const adminId = req.user!.id;

    const log = await prisma.codFraudLog.update({
      where: { id },
      data: {
        status,
        reviewNote,
        resolution,
        autoRestricted,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    res.json({ log, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// TASK 20: Partner/Merchant Manipulation Detection
// =====================================================================

router.post("/partner/report", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { partnerId, partnerType, fraudType, description, evidence, relatedOrderIds, relatedRideIds, estimatedLoss } = req.body;

    const log = await prisma.partnerFraudLog.create({
      data: {
        partnerId,
        partnerType,
        fraudType,
        description,
        evidence,
        relatedOrderIds: relatedOrderIds || [],
        relatedRideIds: relatedRideIds || [],
        estimatedLoss,
      },
    });

    await prisma.fraudEvent.create({
      data: {
        userId: partnerId,
        userRole: partnerType,
        eventType: "partner_manipulation",
        severity: "high",
        description,
        scoreImpact: 30,
      },
    });

    await updateFraudScore(partnerId, partnerType, "partnerManipulation", 30);

    res.json({ log, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/partner/logs", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", partnerId, status, fraudType } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (partnerId) where.partnerId = partnerId;
    if (status) where.status = status;
    if (fraudType) where.fraudType = fraudType;

    const [logs, total] = await Promise.all([
      prisma.partnerFraudLog.findMany({ where, skip, take: parseInt(limit as string), orderBy: { createdAt: "desc" } }),
      prisma.partnerFraudLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/partner/logs/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNote, resolution, autoRestricted, recoveredAmount } = req.body;
    const adminId = req.user!.id;

    const log = await prisma.partnerFraudLog.update({
      where: { id },
      data: {
        status,
        reviewNote,
        resolution,
        autoRestricted,
        recoveredAmount,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    res.json({ log, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// TASK 21: IP Anomaly Detection
// =====================================================================

const ipAnomalySchema = z.object({
  currentIp: z.string(),
  previousIp: z.string().optional(),
  currentCountry: z.string().optional(),
  previousCountry: z.string().optional(),
  gpsLatitude: z.number().optional(),
  gpsLongitude: z.number().optional(),
  gpsCountry: z.string().optional(),
});

router.post("/ip/validate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const data = ipAnomalySchema.parse(req.body);

    let anomalyType: string | null = null;
    let severity: "low" | "medium" | "high" | "critical" = "medium";
    let requiresReverification = false;

    if (data.currentCountry && data.previousCountry && data.currentCountry !== data.previousCountry) {
      anomalyType = "country_mismatch";
      severity = "high";
      requiresReverification = true;
    }

    if (data.gpsCountry && data.currentCountry && data.gpsCountry !== data.currentCountry) {
      anomalyType = "gps_ip_region_mismatch";
      severity = "high";
      requiresReverification = true;
    }

    if (anomalyType) {
      await prisma.ipAnomalyLog.create({
        data: {
          userId,
          userRole,
          anomalyType: anomalyType as any,
          severity,
          currentIp: data.currentIp,
          previousIp: data.previousIp,
          currentCountry: data.currentCountry,
          previousCountry: data.previousCountry,
          gpsLatitude: data.gpsLatitude,
          gpsLongitude: data.gpsLongitude,
          gpsCountry: data.gpsCountry,
          description: `IP anomaly detected: ${anomalyType}`,
          requiresReverification,
        },
      });

      await prisma.fraudEvent.create({
        data: {
          userId,
          userRole,
          eventType: "ip_anomaly",
          severity,
          description: `IP anomaly: ${anomalyType}`,
          ipAddress: data.currentIp,
          previousIp: data.previousIp,
          scoreImpact: 15,
        },
      });

      await updateFraudScore(userId, userRole, "ipAnomaly", 15);

      return res.json({
        valid: false,
        anomalyType,
        requiresReverification,
        message: "IP anomaly detected. Additional verification may be required.",
      });
    }

    res.json({ valid: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ip/logs", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", userId, anomalyType, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (userId) where.userId = userId;
    if (anomalyType) where.anomalyType = anomalyType;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.ipAnomalyLog.findMany({ where, skip, take: parseInt(limit as string), orderBy: { createdAt: "desc" } }),
      prisma.ipAnomalyLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/ip/logs/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNote, resolution, reverificationCompleted } = req.body;
    const adminId = req.user!.id;

    const log = await prisma.ipAnomalyLog.update({
      where: { id },
      data: {
        status,
        reviewNote,
        resolution,
        reverificationCompleted,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    res.json({ log, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// TASK 22: Fraud Score System
// =====================================================================

router.get("/score/:userId", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const score = await prisma.fraudScore.findUnique({ where: { userId } });

    if (!score) {
      return res.json({
        userId,
        currentScore: 0,
        isRestricted: false,
        componentScores: {
          deviceMismatch: 0,
          fakeGps: 0,
          ipAnomaly: 0,
          codFraud: 0,
          reportFrequency: 0,
          cancellationAbuse: 0,
          partnerManipulation: 0,
        },
      });
    }

    res.json({
      ...score,
      componentScores: {
        deviceMismatch: score.deviceMismatchScore,
        fakeGps: score.fakeGpsScore,
        ipAnomaly: score.ipAnomalyScore,
        codFraud: score.codFraudScore,
        reportFrequency: score.reportFrequencyScore,
        cancellationAbuse: score.cancellationAbuseScore,
        partnerManipulation: score.partnerManipulationScore,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/scores", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", minScore, isRestricted } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (minScore) where.currentScore = { gte: parseInt(minScore as string) };
    if (isRestricted === "true") where.isRestricted = true;

    const [scores, total] = await Promise.all([
      prisma.fraudScore.findMany({ where, skip, take: parseInt(limit as string), orderBy: { currentScore: "desc" } }),
      prisma.fraudScore.count({ where }),
    ]);

    res.json({ scores, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/score/clear/:userId", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { clearanceNote } = req.body;
    const adminId = req.user!.id;

    const score = await prisma.fraudScore.update({
      where: { userId },
      data: {
        isRestricted: false,
        requiresManualClearance: false,
        clearedBy: adminId,
        clearedAt: new Date(),
        clearanceNote,
        previousScore: 0,
        currentScore: 0,
        deviceMismatchScore: 0,
        fakeGpsScore: 0,
        ipAnomalyScore: 0,
        codFraudScore: 0,
        reportFrequencyScore: 0,
        cancellationAbuseScore: 0,
        partnerManipulationScore: 0,
      },
    });

    res.json({ score, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// FRAUD EVENTS (Unified Log)
// =====================================================================

router.get("/events", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", userId, eventType, severity, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (userId) where.userId = userId;
    if (eventType) where.eventType = eventType;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      prisma.fraudEvent.findMany({ where, skip, take: parseInt(limit as string), orderBy: { createdAt: "desc" } }),
      prisma.fraudEvent.count({ where }),
    ]);

    res.json({ events, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/events/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNote, resolution } = req.body;
    const adminId = req.user!.id;

    const event = await prisma.fraudEvent.update({
      where: { id },
      data: {
        status,
        reviewNote,
        resolution,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        ...(status === "resolved" ? { resolvedBy: adminId, resolvedAt: new Date() } : {}),
      },
    });

    res.json({ event, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// FRAUD PREVENTION SETTINGS
// =====================================================================

router.get("/settings", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.query;
    const where = category ? { category: category as string } : {};
    const settings = await prisma.fraudPreventionSettings.findMany({ where, orderBy: { category: "asc" } });

    const defaultSettings = [
      { settingKey: "gps_distance_threshold_km", settingValue: "5", category: "gps", description: "Max distance in km for 5 second window" },
      { settingKey: "gps_time_threshold_sec", settingValue: "5", category: "gps", description: "Time window for distance check" },
      { settingKey: "fraud_score_threshold", settingValue: "70", category: "score", description: "Score threshold for auto-restriction" },
      { settingKey: "max_devices_per_user", settingValue: "2", category: "device", description: "Max allowed devices before flagging" },
      { settingKey: "cod_cancellation_threshold", settingValue: "3", category: "cod", description: "Max COD cancellations before flagging" },
      { settingKey: "ip_country_change_hours", settingValue: "1", category: "ip", description: "Min hours between country changes" },
    ];

    const existingKeys = settings.map(s => s.settingKey);
    const missingSettings = defaultSettings.filter(d => !existingKeys.includes(d.settingKey));

    if (missingSettings.length > 0) {
      await prisma.fraudPreventionSettings.createMany({
        data: missingSettings.map(s => ({ ...s, defaultValue: s.settingValue })),
        skipDuplicates: true,
      });
    }

    const allSettings = await prisma.fraudPreventionSettings.findMany({ where, orderBy: { category: "asc" } });
    res.json({ settings: allSettings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/settings/:key", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { settingValue, isActive } = req.body;
    const adminId = req.user!.id;

    const setting = await prisma.fraudPreventionSettings.update({
      where: { settingKey: key },
      data: { settingValue, isActive, updatedBy: adminId },
    });

    res.json({ setting, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// DASHBOARD STATS
// =====================================================================

router.get("/dashboard", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalFraudEvents,
      todayFraudEvents,
      pendingReview,
      restrictedUsers,
      highRiskUsers,
      deviceMismatchCount,
      fakeGpsCount,
      codFraudCount,
      ipAnomalyCount,
      partnerFraudCount,
    ] = await Promise.all([
      prisma.fraudEvent.count(),
      prisma.fraudEvent.count({ where: { createdAt: { gte: today } } }),
      prisma.fraudEvent.count({ where: { status: "detected" } }),
      prisma.fraudScore.count({ where: { isRestricted: true } }),
      prisma.fraudScore.count({ where: { currentScore: { gte: 70 } } }),
      prisma.fraudEvent.count({ where: { eventType: { in: ["device_mismatch", "multi_device_login"] } } }),
      prisma.fraudEvent.count({ where: { eventType: { in: ["fake_gps_detected", "impossible_movement"] } } }),
      prisma.codFraudLog.count(),
      prisma.ipAnomalyLog.count(),
      prisma.partnerFraudLog.count(),
    ]);

    res.json({
      summary: {
        totalFraudEvents,
        todayFraudEvents,
        pendingReview,
        restrictedUsers,
        highRiskUsers,
      },
      byCategory: {
        deviceMismatch: deviceMismatchCount,
        fakeGps: fakeGpsCount,
        codFraud: codFraudCount,
        ipAnomaly: ipAnomalyCount,
        partnerFraud: partnerFraudCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// ENFORCEMENT CHECK (Called by other services)
// =====================================================================

router.get("/check/:userId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { action } = req.query;

    const score = await prisma.fraudScore.findUnique({ where: { userId } });

    if (!score) {
      return res.json({ allowed: true, fraudScore: 0, isRestricted: false });
    }

    const settings = await prisma.fraudPreventionSettings.findMany({ where: { isActive: true } });
    const thresholdSetting = settings.find(s => s.settingKey === "fraud_score_threshold");
    const threshold = thresholdSetting ? parseInt(thresholdSetting.settingValue) : 70;

    const isRestricted = score.isRestricted || score.currentScore >= threshold;

    if (isRestricted && action) {
      const restrictedActions = ["ride_request", "parcel_request", "food_order", "cod_payment", "delivery_accept"];
      if (restrictedActions.includes(action as string)) {
        return res.json({
          allowed: false,
          fraudScore: score.currentScore,
          isRestricted: true,
          reason: "Your account is under review due to suspicious activity.",
        });
      }
    }

    res.json({
      allowed: !isRestricted,
      fraudScore: score.currentScore,
      isRestricted,
      requiresManualClearance: score.requiresManualClearance,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

async function updateFraudScore(
  userId: string,
  userRole: string,
  category: "deviceMismatch" | "fakeGps" | "ipAnomaly" | "codFraud" | "reportFrequency" | "cancellationAbuse" | "partnerManipulation",
  impact: number
): Promise<void> {
  try {
    const existing = await prisma.fraudScore.findUnique({ where: { userId } });

    const scoreField = `${category}Score` as keyof typeof existing;
    const countField = `${category}Count` as keyof typeof existing;

    if (existing) {
      const newCategoryScore = Math.min(100, (existing[scoreField] as number || 0) + impact);
      const newTotalScore = Math.min(100, existing.currentScore + impact);
      const isRestricted = newTotalScore >= 70;

      await prisma.fraudScore.update({
        where: { userId },
        data: {
          previousScore: existing.currentScore,
          currentScore: newTotalScore,
          peakScore: Math.max(existing.peakScore, newTotalScore),
          [scoreField]: newCategoryScore,
          [countField]: { increment: 1 },
          isRestricted,
          restrictedAt: isRestricted && !existing.isRestricted ? new Date() : existing.restrictedAt,
          restrictionReason: isRestricted ? `Fraud score exceeded threshold (${newTotalScore})` : existing.restrictionReason,
          requiresManualClearance: isRestricted,
          lastCalculatedAt: new Date(),
        },
      });
    } else {
      const isRestricted = impact >= 70;
      await prisma.fraudScore.create({
        data: {
          userId,
          userRole,
          currentScore: impact,
          peakScore: impact,
          [scoreField]: impact,
          [countField]: 1,
          isRestricted,
          restrictedAt: isRestricted ? new Date() : null,
          restrictionReason: isRestricted ? `Fraud score exceeded threshold (${impact})` : null,
          requiresManualClearance: isRestricted,
        },
      });
    }
  } catch (error) {
    console.error("[FraudScore] Update error:", error);
  }
}

export default router;
