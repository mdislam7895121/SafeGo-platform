import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMinutes: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    blockDurationMinutes: 30,
  },
  public: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    blockDurationMinutes: 15,
  },
  partner: {
    windowMs: 60 * 1000,
    maxRequests: 40,
    blockDurationMinutes: 20,
  },
  admin: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    blockDurationMinutes: 10,
  },
};

const requestCounts = new Map<string, { count: number; windowStart: number }>();

function getRouteCategory(path: string): string {
  if (path.includes("/api/auth") || path.includes("/api/login") || path.includes("/api/signup") || path.includes("/api/otp")) {
    return "auth";
  }
  if (path.includes("/api/admin")) {
    return "admin";
  }
  if (path.includes("/api/driver") || path.includes("/api/restaurant") || path.includes("/api/shop")) {
    return "partner";
  }
  return "public";
}

async function checkExistingBlock(identifier: string): Promise<Date | null> {
  const block = await prisma.rateLimitBlock.findFirst({
    where: {
      identifier,
      isBlocked: true,
      blockedUntil: { gt: new Date() },
    },
  });

  return block?.blockedUntil || null;
}

async function createBlock(
  identifier: string,
  identifierType: string,
  routeCategory: string,
  routePath: string,
  requestCount: number,
  limitThreshold: number,
  blockDurationMinutes: number,
  context: { ipAddress?: string; userAgent?: string; countryCode?: string }
): Promise<Date> {
  const blockedUntil = new Date(Date.now() + blockDurationMinutes * 60 * 1000);

  await prisma.rateLimitBlock.create({
    data: {
      identifier,
      identifierType,
      routeCategory,
      routePath,
      requestCount,
      limitThreshold,
      isBlocked: true,
      blockedAt: new Date(),
      blockedUntil,
      blockDurationMinutes,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      countryCode: context.countryCode,
    },
  });

  console.warn(`[APIRateLimiter] Blocked ${identifierType}:${identifier} for ${blockDurationMinutes} minutes`);

  return blockedUntil;
}

export const createRateLimiter = (category: string) => {
  const config = RATE_LIMITS[category] || RATE_LIMITS.public;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
    const userId = (req as any).user?.id;
    const identifier = userId || ipAddress;
    const identifierType = userId ? "user_id" : "ip";

    const blockedUntil = await checkExistingBlock(identifier);
    if (blockedUntil) {
      const retryAfter = Math.ceil((blockedUntil.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many requests",
        message: "You have been temporarily blocked due to excessive requests",
        blockedUntil,
        retryAfter,
      });
    }

    const now = Date.now();
    const key = `${identifier}:${category}`;
    const current = requestCounts.get(key);

    if (!current || now - current.windowStart >= config.windowMs) {
      requestCounts.set(key, { count: 1, windowStart: now });
      return next();
    }

    current.count++;

    if (current.count > config.maxRequests) {
      const blocked = await createBlock(
        identifier,
        identifierType,
        category,
        req.path,
        current.count,
        config.maxRequests,
        config.blockDurationMinutes,
        {
          ipAddress,
          userAgent: req.headers["user-agent"],
        }
      );

      requestCounts.delete(key);

      return res.status(429).json({
        error: "Rate limit exceeded",
        message: `Too many requests. Blocked for ${config.blockDurationMinutes} minutes.`,
        blockedUntil: blocked,
        retryAfter: config.blockDurationMinutes * 60,
      });
    }

    res.setHeader("X-RateLimit-Limit", config.maxRequests);
    res.setHeader("X-RateLimit-Remaining", config.maxRequests - current.count);
    res.setHeader("X-RateLimit-Reset", Math.ceil((current.windowStart + config.windowMs) / 1000));

    next();
  };
};

export const authRateLimiter = createRateLimiter("auth");
export const publicRateLimiter = createRateLimiter("public");
export const partnerRateLimiter = createRateLimiter("partner");
export const adminRateLimiter = createRateLimiter("admin");

export const dynamicRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const category = getRouteCategory(req.path);
  const limiter = createRateLimiter(category);
  return limiter(req, res, next);
};

export async function unblockIdentifier(
  identifier: string,
  adminId: string,
  reason: string
): Promise<number> {
  const result = await prisma.rateLimitBlock.updateMany({
    where: {
      identifier,
      isBlocked: true,
    },
    data: {
      isBlocked: false,
      unblockedAt: new Date(),
      unblockedBy: adminId,
      unblockReason: reason,
    },
  });

  console.log(`[APIRateLimiter] Unblocked ${identifier} by admin ${adminId}: ${reason}`);
  return result.count;
}

export async function getRateLimitStats(): Promise<{
  activeBlocks: number;
  blocksToday: number;
  byCategory: Record<string, number>;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [activeBlocks, blocksToday, byCategory] = await Promise.all([
    prisma.rateLimitBlock.count({
      where: { isBlocked: true, blockedUntil: { gt: now } },
    }),
    prisma.rateLimitBlock.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.rateLimitBlock.groupBy({
      by: ["routeCategory"],
      _count: { id: true },
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return {
    activeBlocks,
    blocksToday,
    byCategory: Object.fromEntries(byCategory.map((c) => [c.routeCategory, c._count.id])),
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now - value.windowStart >= 5 * 60 * 1000) {
      requestCounts.delete(key);
    }
  }
}, 60 * 1000);
