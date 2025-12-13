import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  fraudCheck?: {
    allowed: boolean;
    fraudScore: number;
    isRestricted: boolean;
    reason?: string;
  };
}

async function getFraudThreshold(): Promise<number> {
  try {
    const setting = await prisma.fraudPreventionSettings.findUnique({
      where: { settingKey: "fraud_score_threshold" },
    });
    return setting ? parseInt(setting.settingValue) : 70;
  } catch {
    return 70;
  }
}

export async function checkFraudStatus(userId: string): Promise<{
  allowed: boolean;
  fraudScore: number;
  isRestricted: boolean;
  reason?: string;
}> {
  try {
    const score = await prisma.fraudScore.findUnique({ where: { userId } });

    if (!score) {
      return { allowed: true, fraudScore: 0, isRestricted: false };
    }

    const threshold = await getFraudThreshold();
    const isRestricted = score.isRestricted || score.currentScore >= threshold;

    return {
      allowed: !isRestricted,
      fraudScore: score.currentScore,
      isRestricted,
      reason: isRestricted ? "Account restricted due to suspicious activity" : undefined,
    };
  } catch (error) {
    console.error("[FraudEnforcement] Check error:", error);
    return { allowed: true, fraudScore: 0, isRestricted: false };
  }
}

export function fraudEnforcementMiddleware(restrictedActions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return next();
    }

    try {
      const fraudCheck = await checkFraudStatus(req.user.id);
      req.fraudCheck = fraudCheck;

      if (!fraudCheck.allowed) {
        const action = req.path.split("/").pop() || req.method.toLowerCase();
        if (restrictedActions.some(a => req.path.includes(a) || action === a)) {
          return res.status(403).json({
            error: "Action blocked",
            reason: fraudCheck.reason,
            fraudScore: fraudCheck.fraudScore,
            isRestricted: fraudCheck.isRestricted,
            message: "Your account is currently under review. Please contact support for assistance.",
          });
        }
      }

      next();
    } catch (error) {
      console.error("[FraudEnforcement] Middleware error:", error);
      next();
    }
  };
}

export const rideRequestEnforcement = fraudEnforcementMiddleware([
  "request",
  "ride-request",
  "book",
  "create",
]);

export const parcelRequestEnforcement = fraudEnforcementMiddleware([
  "request",
  "parcel-request",
  "create",
  "schedule",
]);

export const foodOrderEnforcement = fraudEnforcementMiddleware([
  "order",
  "food-order",
  "create",
  "checkout",
]);

export const codPaymentEnforcement = fraudEnforcementMiddleware([
  "cod",
  "cod-payment",
  "collect",
  "verify-cod",
]);

export const deliveryAcceptEnforcement = fraudEnforcementMiddleware([
  "accept",
  "accept-delivery",
  "accept-order",
  "accept-ride",
]);

export const partnerOperationsEnforcement = fraudEnforcementMiddleware([
  "menu-update",
  "pricing-update",
  "availability",
  "toggle-status",
]);

export async function logFraudEvent(
  userId: string,
  userRole: string,
  eventType: string,
  description: string,
  options: {
    severity?: "low" | "medium" | "high" | "critical";
    scoreImpact?: number;
    deviceId?: string;
    ipAddress?: string;
    latitude?: number;
    longitude?: number;
    rideId?: string;
    orderId?: string;
    parcelId?: string;
    autoRestrict?: boolean;
  } = {}
): Promise<void> {
  try {
    await prisma.fraudEvent.create({
      data: {
        userId,
        userRole,
        eventType: eventType as any,
        severity: options.severity || "medium",
        description,
        deviceId: options.deviceId,
        ipAddress: options.ipAddress,
        latitude: options.latitude,
        longitude: options.longitude,
        rideId: options.rideId,
        orderId: options.orderId,
        parcelId: options.parcelId,
        scoreImpact: options.scoreImpact || 0,
        autoRestrictApplied: options.autoRestrict || false,
      },
    });

    if (options.scoreImpact && options.scoreImpact > 0) {
      await updateUserFraudScore(userId, userRole, options.scoreImpact, options.autoRestrict);
    }
  } catch (error) {
    console.error("[FraudEnforcement] Log event error:", error);
  }
}

async function updateUserFraudScore(
  userId: string,
  userRole: string,
  impact: number,
  autoRestrict?: boolean
): Promise<void> {
  try {
    const existing = await prisma.fraudScore.findUnique({ where: { userId } });

    if (existing) {
      const newScore = Math.min(100, existing.currentScore + impact);
      const threshold = await getFraudThreshold();
      const shouldRestrict = autoRestrict || newScore >= threshold;

      await prisma.fraudScore.update({
        where: { userId },
        data: {
          previousScore: existing.currentScore,
          currentScore: newScore,
          peakScore: Math.max(existing.peakScore, newScore),
          isRestricted: shouldRestrict,
          restrictedAt: shouldRestrict && !existing.isRestricted ? new Date() : existing.restrictedAt,
          restrictionReason: shouldRestrict ? `Fraud score: ${newScore}` : existing.restrictionReason,
          requiresManualClearance: shouldRestrict,
          lastCalculatedAt: new Date(),
        },
      });
    } else {
      const threshold = await getFraudThreshold();
      const shouldRestrict = autoRestrict || impact >= threshold;

      await prisma.fraudScore.create({
        data: {
          userId,
          userRole,
          currentScore: impact,
          peakScore: impact,
          isRestricted: shouldRestrict,
          restrictedAt: shouldRestrict ? new Date() : null,
          restrictionReason: shouldRestrict ? `Fraud score: ${impact}` : null,
          requiresManualClearance: shouldRestrict,
        },
      });
    }
  } catch (error) {
    console.error("[FraudEnforcement] Update score error:", error);
  }
}

export async function validateDeviceFingerprint(
  userId: string,
  userRole: string,
  deviceId: string,
  deviceData: {
    os: string;
    model?: string;
    appVersion?: string;
    ipAddress?: string;
  }
): Promise<{ valid: boolean; isNewDevice: boolean; warning?: string }> {
  try {
    const existingDevice = await prisma.deviceFingerprint.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (existingDevice) {
      await prisma.deviceFingerprint.update({
        where: { id: existingDevice.id },
        data: {
          lastSeenAt: new Date(),
          loginCount: { increment: 1 },
          lastKnownIp: deviceData.ipAddress,
          appVersion: deviceData.appVersion,
        },
      });

      if (existingDevice.isBlocked) {
        return { valid: false, isNewDevice: false, warning: "Device is blocked" };
      }

      return { valid: true, isNewDevice: false };
    }

    const otherDevices = await prisma.deviceFingerprint.count({
      where: { userId, isBlocked: false },
    });

    const whitelisted = await prisma.deviceWhitelist.findFirst({
      where: {
        userId,
        deviceId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const maxDevices = 2;
    const isNewDeviceWarning = otherDevices >= maxDevices && !whitelisted;

    if (isNewDeviceWarning) {
      await logFraudEvent(userId, userRole, "multi_device_login", `New device detected. Total devices: ${otherDevices + 1}`, {
        severity: "medium",
        scoreImpact: 10,
        deviceId,
        ipAddress: deviceData.ipAddress,
      });
    }

    await prisma.deviceFingerprint.create({
      data: {
        userId,
        userRole,
        deviceId,
        deviceHash: deviceId,
        os: deviceData.os,
        model: deviceData.model,
        appVersion: deviceData.appVersion,
        ipAddress: deviceData.ipAddress,
        lastKnownIp: deviceData.ipAddress,
      },
    });

    return {
      valid: true,
      isNewDevice: true,
      warning: isNewDeviceWarning ? "Multiple devices detected" : undefined,
    };
  } catch (error) {
    console.error("[FraudEnforcement] Device validation error:", error);
    return { valid: true, isNewDevice: false };
  }
}

export async function validateGpsLocation(
  userId: string,
  userRole: string,
  latitude: number,
  longitude: number,
  options: {
    deviceId?: string;
    ipAddress?: string;
  } = {}
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const lastEvent = await prisma.fraudEvent.findFirst({
      where: {
        userId,
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastEvent || !lastEvent.latitude || !lastEvent.longitude) {
      return { valid: true };
    }

    const distance = calculateDistance(
      lastEvent.latitude,
      lastEvent.longitude,
      latitude,
      longitude
    );

    const timeDiff = (Date.now() - lastEvent.createdAt.getTime()) / 1000;

    const maxDistanceKm = 5;
    const minTimeSeconds = 5;

    if (distance > maxDistanceKm && timeDiff < minTimeSeconds) {
      await logFraudEvent(
        userId,
        userRole,
        "impossible_movement",
        `Impossible movement: ${distance.toFixed(2)}km in ${timeDiff.toFixed(0)}s`,
        {
          severity: "high",
          scoreImpact: 25,
          latitude,
          longitude,
          deviceId: options.deviceId,
          ipAddress: options.ipAddress,
          autoRestrict: true,
        }
      );

      return {
        valid: false,
        reason: "Location validation failed. Suspicious movement detected.",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[FraudEnforcement] GPS validation error:", error);
    return { valid: true };
  }
}

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

export default {
  checkFraudStatus,
  fraudEnforcementMiddleware,
  logFraudEvent,
  validateDeviceFingerprint,
  validateGpsLocation,
  rideRequestEnforcement,
  parcelRequestEnforcement,
  foodOrderEnforcement,
  codPaymentEnforcement,
  deliveryAcceptEnforcement,
  partnerOperationsEnforcement,
};
