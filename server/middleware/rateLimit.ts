import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { logAuditEvent } from '../utils/audit';
import { getClientIp } from '../utils/ip';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

export async function rateLimitAdminLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const email = req.body.email;
  const ip = getClientIp(req);
  const key = `${ip}:${email}`;

  if (!email) {
    next();
    return;
  }

  const now = Date.now();
  let attempt = loginAttempts.get(key);

  if (attempt && attempt.blockedUntil && attempt.blockedUntil > now) {
    const remainingMs = attempt.blockedUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60000);

    await logAuditEvent({
      actorId: null,
      actorEmail: email,
      actorRole: 'admin',
      ipAddress: ip,
      actionType: 'ADMIN_LOGIN_RATE_LIMITED',
      entityType: 'admin_profile',
      description: `Admin login rate limited for ${email} from ${ip}`,
      metadata: {
        remainingMinutes: remainingMin,
        blockedUntil: new Date(attempt.blockedUntil)
      },
      success: false
    });

    res.status(429).json({
      error: `Too many login attempts. Please try again in ${remainingMin} minutes.`
    });
    return;
  }

  if (!attempt) {
    attempt = {
      count: 0,
      firstAttempt: now
    };
    loginAttempts.set(key, attempt);
  }

  if (now - attempt.firstAttempt > WINDOW_MS) {
    attempt.count = 0;
    attempt.firstAttempt = now;
    delete attempt.blockedUntil;
  }

  attempt.count++;
  loginAttempts.set(key, attempt);

  if (attempt.count > MAX_ATTEMPTS) {
    attempt.blockedUntil = now + BLOCK_DURATION_MS;
    loginAttempts.set(key, attempt);

    await logAuditEvent({
      actorId: null,
      actorEmail: email,
      actorRole: 'admin',
      ipAddress: ip,
      actionType: 'ADMIN_LOGIN_RATE_LIMITED',
      entityType: 'admin_profile',
      description: `Admin login blocked for ${email} from ${ip} after ${MAX_ATTEMPTS} failed attempts`,
      metadata: {
        attempts: attempt.count,
        blockedUntil: new Date(attempt.blockedUntil)
      },
      success: false
    });

    res.status(429).json({
      error: `Too many login attempts. Please try again in 15 minutes.`
    });
    return;
  }

  next();
}

export function resetLoginAttempts(email: string, ip: string): void {
  const key = `${ip}:${email}`;
  loginAttempts.delete(key);
}

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(loginAttempts.entries());
  for (const [key, attempt] of entries) {
    if (attempt.blockedUntil && attempt.blockedUntil < now) {
      loginAttempts.delete(key);
    } else if (now - attempt.firstAttempt > WINDOW_MS * 2) {
      loginAttempts.delete(key);
    }
  }
}, WINDOW_MS);

// ====================================================
// Analytics Rate Limiter
// Prevents abuse while allowing legitimate dashboard usage
// ====================================================

interface AnalyticsRequest {
  count: number;
  windowStart: number;
}

const analyticsRequests = new Map<string, AnalyticsRequest>();

// Analytics rate limiting: 60 requests per minute per user
const ANALYTICS_MAX_REQUESTS = 60;
const ANALYTICS_WINDOW_MS = 60 * 1000; // 1 minute

export async function rateLimitAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.id;
  const ip = getClientIp(req);
  const key = userId ? `user:${userId}` : `ip:${ip}`;

  const now = Date.now();
  let request = analyticsRequests.get(key);

  // Initialize or reset window
  if (!request || (now - request.windowStart > ANALYTICS_WINDOW_MS)) {
    request = {
      count: 0,
      windowStart: now
    };
    analyticsRequests.set(key, request);
  }

  request.count++;
  analyticsRequests.set(key, request);

  // Check if rate limit exceeded
  if (request.count > ANALYTICS_MAX_REQUESTS) {
    const remainingSec = Math.ceil((ANALYTICS_WINDOW_MS - (now - request.windowStart)) / 1000);

    await logAuditEvent({
      actorId: userId || null,
      actorEmail: (req as any).user?.email || null,
      actorRole: 'admin',
      ipAddress: ip,
      actionType: 'ANALYTICS_RATE_LIMITED',
      entityType: 'analytics',
      description: `Analytics API rate limited for ${userId ? 'user ' + userId : 'IP ' + ip}`,
      metadata: {
        requestCount: request.count,
        windowStart: new Date(request.windowStart),
        remainingSeconds: remainingSec
      },
      success: false
    });

    res.status(429).json({
      error: `Analytics rate limit exceeded. Please try again in ${remainingSec} seconds.`
    });
    return;
  }

  next();
}

// Cleanup old analytics request tracking
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(analyticsRequests.entries());
  for (const [key, request] of entries) {
    if (now - request.windowStart > ANALYTICS_WINDOW_MS * 2) {
      analyticsRequests.delete(key);
    }
  }
}, ANALYTICS_WINDOW_MS);

// ====================================================
// Generic API Rate Limiter
// For sensitive routes like payout, support, auth
// ====================================================

interface ApiRequest {
  count: number;
  windowStart: number;
}

const apiRequests = new Map<string, ApiRequest>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  routePrefix: string;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  auth: { maxRequests: 10, windowMs: 60 * 1000, routePrefix: '/api/auth' },
  payout: { maxRequests: 20, windowMs: 60 * 1000, routePrefix: '/api/payout' },
  support: { maxRequests: 30, windowMs: 60 * 1000, routePrefix: '/api/support' },
  sensitive: { maxRequests: 15, windowMs: 60 * 1000, routePrefix: '/api/driver/wallet' }
};

export function createRateLimiter(configKey: keyof typeof RATE_LIMIT_CONFIGS) {
  const config = RATE_LIMIT_CONFIGS[configKey];
  
  return async function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const userId = (req as any).user?.id;
    const ip = getClientIp(req);
    const key = `${configKey}:${userId ? `user:${userId}` : `ip:${ip}`}`;

    const now = Date.now();
    let request = apiRequests.get(key);

    if (!request || (now - request.windowStart > config.windowMs)) {
      request = {
        count: 0,
        windowStart: now
      };
      apiRequests.set(key, request);
    }

    request.count++;
    apiRequests.set(key, request);

    if (request.count > config.maxRequests) {
      const remainingSec = Math.ceil((config.windowMs - (now - request.windowStart)) / 1000);

      await logAuditEvent({
        actorId: userId || null,
        actorEmail: (req as any).user?.email || null,
        actorRole: (req as any).user?.role || 'unknown',
        ipAddress: ip,
        actionType: 'API_RATE_LIMITED',
        entityType: configKey,
        description: `${configKey} API rate limited for ${userId ? 'user ' + userId : 'IP ' + ip}`,
        metadata: {
          requestCount: request.count,
          route: req.path,
          remainingSeconds: remainingSec
        },
        success: false
      });

      res.status(429).json({
        error: `Too many requests. Please try again in ${remainingSec} seconds.`
      });
      return;
    }

    next();
  };
}

export const rateLimitAuth = createRateLimiter('auth');
export const rateLimitPayout = createRateLimiter('payout');
export const rateLimitSupport = createRateLimiter('support');
export const rateLimitSensitive = createRateLimiter('sensitive');

// Cleanup old API request tracking
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(apiRequests.entries());
  for (const [key, request] of entries) {
    const configKey = key.split(':')[0] as keyof typeof RATE_LIMIT_CONFIGS;
    const config = RATE_LIMIT_CONFIGS[configKey];
    if (config && now - request.windowStart > config.windowMs * 2) {
      apiRequests.delete(key);
    }
  }
}, 60 * 1000);
