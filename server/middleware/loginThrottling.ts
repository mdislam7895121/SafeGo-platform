import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOGIN_LIMITS = {
  maxAttempts: 5,
  cooldownMinutes: 5,
  lockThreshold: 10,
  lockDurationMinutes: 30,
  windowMinutes: 15,
};

interface LoginThrottleResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
  cooldownUntil?: Date;
  reason?: string;
}

export async function checkLoginThrottle(
  identifier: string,
  identifierType: "email" | "phone" | "user_id",
  deviceInfo?: {
    deviceId?: string;
    deviceFingerprint?: string;
    ipAddress?: string;
  }
): Promise<LoginThrottleResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOGIN_LIMITS.windowMinutes * 60 * 1000);

  const existingLock = await prisma.loginAttempt.findFirst({
    where: {
      OR: [
        { identifier },
        deviceInfo?.deviceId ? { deviceId: deviceInfo.deviceId } : {},
        deviceInfo?.deviceFingerprint ? { deviceFingerprint: deviceInfo.deviceFingerprint } : {},
      ],
      attemptType: "login",
      isBlocked: true,
      blockedUntil: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingLock) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: existingLock.blockedUntil!,
      reason: existingLock.blockReason || "Account temporarily locked",
    };
  }

  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      OR: [
        { identifier },
        deviceInfo?.deviceId ? { deviceId: deviceInfo.deviceId } : {},
        deviceInfo?.deviceFingerprint ? { deviceFingerprint: deviceInfo.deviceFingerprint } : {},
      ],
      attemptType: "login",
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  const remainingAttempts = Math.max(0, LOGIN_LIMITS.maxAttempts - failedAttempts);

  if (failedAttempts >= LOGIN_LIMITS.lockThreshold) {
    const lockedUntil = new Date(now.getTime() + LOGIN_LIMITS.lockDurationMinutes * 60 * 1000);

    await prisma.loginAttempt.create({
      data: {
        identifier,
        identifierType,
        attemptType: "login",
        success: false,
        failureReason: "Account locked due to excessive failed attempts",
        deviceId: deviceInfo?.deviceId,
        deviceFingerprint: deviceInfo?.deviceFingerprint,
        ipAddress: deviceInfo?.ipAddress,
        isBlocked: true,
        blockedUntil: lockedUntil,
        blockReason: `Account locked: ${failedAttempts} failed attempts`,
        attemptCount: failedAttempts,
      },
    });

    console.warn(`[LoginThrottling] Account locked: ${identifier} - ${failedAttempts} failed attempts`);

    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil,
      reason: `Account temporarily locked. Please try again in ${LOGIN_LIMITS.lockDurationMinutes} minutes.`,
    };
  }

  if (failedAttempts >= LOGIN_LIMITS.maxAttempts) {
    const cooldownUntil = new Date(now.getTime() + LOGIN_LIMITS.cooldownMinutes * 60 * 1000);

    await prisma.loginAttempt.create({
      data: {
        identifier,
        identifierType,
        attemptType: "login",
        success: false,
        failureReason: "Cooldown period active",
        deviceId: deviceInfo?.deviceId,
        deviceFingerprint: deviceInfo?.deviceFingerprint,
        ipAddress: deviceInfo?.ipAddress,
        isBlocked: true,
        blockedUntil: cooldownUntil,
        blockReason: `Cooldown: ${failedAttempts} failed attempts`,
        attemptCount: failedAttempts,
      },
    });

    console.warn(`[LoginThrottling] Cooldown activated: ${identifier} - ${failedAttempts} failed attempts`);

    return {
      allowed: false,
      remainingAttempts: 0,
      cooldownUntil,
      reason: `Too many failed attempts. Please wait ${LOGIN_LIMITS.cooldownMinutes} minutes.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts,
  };
}

export async function recordLoginAttempt(
  identifier: string,
  identifierType: "email" | "phone" | "user_id",
  success: boolean,
  failureReason?: string,
  deviceInfo?: {
    deviceId?: string;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    countryCode?: string;
  }
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      identifier,
      identifierType,
      attemptType: "login",
      success,
      failureReason: success ? undefined : failureReason || "Invalid credentials",
      deviceId: deviceInfo?.deviceId,
      deviceFingerprint: deviceInfo?.deviceFingerprint,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      countryCode: deviceInfo?.countryCode,
    },
  });

  if (success) {
    await prisma.loginAttempt.updateMany({
      where: {
        identifier,
        attemptType: "login",
        isBlocked: true,
        blockedUntil: { gt: new Date() },
      },
      data: {
        isBlocked: false,
      },
    });
  }
}

export async function clearLoginBlocks(
  identifier: string,
  adminId?: string
): Promise<number> {
  const result = await prisma.loginAttempt.updateMany({
    where: {
      identifier,
      isBlocked: true,
    },
    data: {
      isBlocked: false,
    },
  });

  console.log(`[LoginThrottling] Cleared ${result.count} blocks for ${identifier} by admin ${adminId || "system"}`);
  return result.count;
}

export const loginThrottlingMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const email = req.body.email;
  const phone = req.body.phone || req.body.phoneNumber;
  const deviceId = req.body.deviceId || req.headers["x-device-id"];
  const deviceFingerprint = req.body.deviceFingerprint || req.headers["x-device-fingerprint"];
  const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0];

  const identifier = email || phone;
  const identifierType = email ? "email" : "phone";

  if (!identifier) {
    return next();
  }

  const result = await checkLoginThrottle(identifier, identifierType, {
    deviceId: deviceId as string,
    deviceFingerprint: deviceFingerprint as string,
    ipAddress,
  });

  if (!result.allowed) {
    return res.status(429).json({
      error: "Login throttled",
      message: result.reason,
      lockedUntil: result.lockedUntil,
      cooldownUntil: result.cooldownUntil,
      retryAfter: result.lockedUntil
        ? Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000)
        : result.cooldownUntil
        ? Math.ceil((result.cooldownUntil.getTime() - Date.now()) / 1000)
        : LOGIN_LIMITS.cooldownMinutes * 60,
    });
  }

  (req as any).loginThrottle = {
    remainingAttempts: result.remainingAttempts,
  };

  next();
};
