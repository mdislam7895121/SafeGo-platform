import { prisma } from "../../lib/prisma";
import { Role } from "./rbac";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<Role, RateLimitConfig> = {
  CUSTOMER: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
  DRIVER: { maxRequests: 40, windowMs: 60 * 60 * 1000 },
  RESTAURANT: { maxRequests: 40, windowMs: 60 * 60 * 1000 },
  ADMIN: { maxRequests: 200, windowMs: 60 * 60 * 1000 },
};

function getWindowStart(windowMs: number): Date {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return new Date(windowStart);
}

export async function checkRateLimit(userId: string, role: Role): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const config = RATE_LIMITS[role] || RATE_LIMITS.CUSTOMER;
  const windowStart = getWindowStart(config.windowMs);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  try {
    const existing = await prisma.safePilotRateLimit.findUnique({
      where: {
        userId_windowStart: { userId, windowStart },
      },
    });

    const currentCount = existing?.requestCount || 0;
    const remaining = Math.max(0, config.maxRequests - currentCount);
    const allowed = currentCount < config.maxRequests;

    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error("[SafePilot RateLimit] Check error:", error);
    return { allowed: true, remaining: config.maxRequests, resetAt };
  }
}

export async function incrementRateLimit(userId: string, role: Role): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const config = RATE_LIMITS[role] || RATE_LIMITS.CUSTOMER;
  const windowStart = getWindowStart(config.windowMs);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  try {
    const result = await prisma.safePilotRateLimit.upsert({
      where: {
        userId_windowStart: { userId, windowStart },
      },
      update: {
        requestCount: { increment: 1 },
      },
      create: {
        userId,
        role: role as any,
        windowStart,
        requestCount: 1,
      },
    });

    const remaining = Math.max(0, config.maxRequests - result.requestCount);
    const allowed = result.requestCount <= config.maxRequests;

    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error("[SafePilot RateLimit] Increment error:", error);
    return { allowed: true, remaining: config.maxRequests, resetAt };
  }
}

export async function getRateLimitStatus(userId: string, role: Role): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}> {
  const config = RATE_LIMITS[role] || RATE_LIMITS.CUSTOMER;
  const windowStart = getWindowStart(config.windowMs);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  try {
    const existing = await prisma.safePilotRateLimit.findUnique({
      where: {
        userId_windowStart: { userId, windowStart },
      },
    });

    const used = existing?.requestCount || 0;
    const remaining = Math.max(0, config.maxRequests - used);

    return {
      used,
      limit: config.maxRequests,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error("[SafePilot RateLimit] Status error:", error);
    return {
      used: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt,
    };
  }
}

export async function cleanupOldRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  try {
    const result = await prisma.safePilotRateLimit.deleteMany({
      where: {
        windowStart: { lt: cutoff },
      },
    });
    return result.count;
  } catch (error) {
    console.error("[SafePilot RateLimit] Cleanup error:", error);
    return 0;
  }
}
