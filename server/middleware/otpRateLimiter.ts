import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OTP_LIMITS = {
  perMinute: 3,
  perHour: 8,
  blockDurationMinutes: 15,
};

interface OTPRateLimitResult {
  allowed: boolean;
  remainingMinute: number;
  remainingHour: number;
  blockedUntil?: Date;
  reason?: string;
}

export async function checkOTPRateLimit(
  identifier: string,
  identifierType: "phone" | "email" | "device_id" | "ip",
  deviceInfo?: {
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    countryCode?: string;
  }
): Promise<OTPRateLimitResult> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const existingBlock = await prisma.loginAttempt.findFirst({
    where: {
      identifier,
      identifierType,
      attemptType: "otp_request",
      isBlocked: true,
      blockedUntil: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingBlock) {
    return {
      allowed: false,
      remainingMinute: 0,
      remainingHour: 0,
      blockedUntil: existingBlock.blockedUntil!,
      reason: existingBlock.blockReason || "OTP rate limit exceeded",
    };
  }

  const minuteCount = await prisma.loginAttempt.count({
    where: {
      identifier,
      identifierType,
      attemptType: "otp_request",
      otpSent: true,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  const hourCount = await prisma.loginAttempt.count({
    where: {
      identifier,
      identifierType,
      attemptType: "otp_request",
      otpSent: true,
      createdAt: { gte: oneHourAgo },
    },
  });

  const remainingMinute = Math.max(0, OTP_LIMITS.perMinute - minuteCount);
  const remainingHour = Math.max(0, OTP_LIMITS.perHour - hourCount);

  if (minuteCount >= OTP_LIMITS.perMinute) {
    const blockedUntil = new Date(now.getTime() + OTP_LIMITS.blockDurationMinutes * 60 * 1000);

    await prisma.loginAttempt.create({
      data: {
        identifier,
        identifierType,
        attemptType: "otp_request",
        success: false,
        failureReason: "Rate limit exceeded (per minute)",
        deviceId: deviceInfo?.deviceId,
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        countryCode: deviceInfo?.countryCode,
        isBlocked: true,
        blockedUntil,
        blockReason: `Exceeded ${OTP_LIMITS.perMinute} OTP requests per minute`,
      },
    });

    console.warn(`[OTPRateLimiter] Blocked ${identifierType}:${identifier} - minute limit exceeded`);

    return {
      allowed: false,
      remainingMinute: 0,
      remainingHour,
      blockedUntil,
      reason: `Too many OTP requests. Please wait ${OTP_LIMITS.blockDurationMinutes} minutes.`,
    };
  }

  if (hourCount >= OTP_LIMITS.perHour) {
    const blockedUntil = new Date(now.getTime() + OTP_LIMITS.blockDurationMinutes * 60 * 1000);

    await prisma.loginAttempt.create({
      data: {
        identifier,
        identifierType,
        attemptType: "otp_request",
        success: false,
        failureReason: "Rate limit exceeded (per hour)",
        deviceId: deviceInfo?.deviceId,
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        countryCode: deviceInfo?.countryCode,
        isBlocked: true,
        blockedUntil,
        blockReason: `Exceeded ${OTP_LIMITS.perHour} OTP requests per hour`,
      },
    });

    console.warn(`[OTPRateLimiter] Blocked ${identifierType}:${identifier} - hour limit exceeded`);

    return {
      allowed: false,
      remainingMinute,
      remainingHour: 0,
      blockedUntil,
      reason: `Too many OTP requests this hour. Please wait ${OTP_LIMITS.blockDurationMinutes} minutes.`,
    };
  }

  return {
    allowed: true,
    remainingMinute,
    remainingHour,
  };
}

export async function recordOTPRequest(
  identifier: string,
  identifierType: "phone" | "email" | "device_id" | "ip",
  otpSent: boolean,
  deviceInfo?: {
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    countryCode?: string;
  }
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      identifier,
      identifierType,
      attemptType: "otp_request",
      success: otpSent,
      otpSent,
      deviceId: deviceInfo?.deviceId,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      countryCode: deviceInfo?.countryCode,
    },
  });
}

export async function recordOTPVerification(
  identifier: string,
  identifierType: "phone" | "email",
  success: boolean,
  deviceInfo?: {
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      identifier,
      identifierType,
      attemptType: "otp_verify",
      success,
      otpVerified: success,
      failureReason: success ? undefined : "Invalid OTP code",
      deviceId: deviceInfo?.deviceId,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
    },
  });
}

export const otpRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const phone = req.body.phone || req.body.phoneNumber;
  const email = req.body.email;
  const deviceId = req.body.deviceId || req.headers["x-device-id"];
  const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0];

  const identifier = phone || email;
  const identifierType = phone ? "phone" : "email";

  if (!identifier) {
    return next();
  }

  const result = await checkOTPRateLimit(identifier, identifierType, {
    deviceId: deviceId as string,
    ipAddress,
    userAgent: req.headers["user-agent"],
  });

  if (!result.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: result.reason,
      blockedUntil: result.blockedUntil,
      retryAfter: result.blockedUntil
        ? Math.ceil((result.blockedUntil.getTime() - Date.now()) / 1000)
        : OTP_LIMITS.blockDurationMinutes * 60,
    });
  }

  (req as any).otpRateLimit = {
    remainingMinute: result.remainingMinute,
    remainingHour: result.remainingHour,
  };

  next();
};
