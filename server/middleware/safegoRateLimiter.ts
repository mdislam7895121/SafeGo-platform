import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { logAuditEvent } from '../utils/audit';
import { getClientIp } from '../utils/ip';
import crypto from 'crypto';

interface RateLimitWindow {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

interface EndpointConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
  description: string;
}

const rateLimitStore = new Map<string, RateLimitWindow>();

const BLOCK_DURATION_MS = 15 * 60 * 1000;

const ENDPOINT_CONFIGS: Record<string, EndpointConfig> = {
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Authentication endpoints'
  },
  booking: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Ride/food/parcel booking'
  },
  payment: {
    maxRequests: 3,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Payment endpoints'
  },
  admin: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Admin panel'
  },
  maps: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Public maps/search'
  },
  webhook: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Webhook callbacks'
  },
  sensitive: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Sensitive data access'
  },
  default: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    blockDurationMs: BLOCK_DURATION_MS,
    description: 'Default rate limit'
  }
};

function getEndpointCategory(path: string, method: string): string {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('/auth/login') || 
      pathLower.includes('/auth/register') ||
      pathLower.includes('/auth/otp') ||
      pathLower.includes('/auth/verify')) {
    return 'auth';
  }
  
  if ((pathLower.includes('/rides') && method === 'POST') ||
      (pathLower.includes('/food-orders') && method === 'POST') ||
      (pathLower.includes('/parcel') && method === 'POST') ||
      pathLower.includes('/book')) {
    return 'booking';
  }
  
  if (pathLower.includes('/payment') ||
      pathLower.includes('/payout') ||
      pathLower.includes('/wallet/withdraw') ||
      pathLower.includes('/checkout')) {
    return 'payment';
  }
  
  if (pathLower.startsWith('/api/admin')) {
    return 'admin';
  }
  
  if (pathLower.includes('/maps') ||
      pathLower.includes('/geocode') ||
      pathLower.includes('/places') ||
      pathLower.includes('/directions') ||
      pathLower.includes('/search')) {
    return 'maps';
  }
  
  if (pathLower.includes('/webhook')) {
    return 'webhook';
  }
  
  if (pathLower.includes('/kyc') ||
      pathLower.includes('/documents') ||
      pathLower.includes('/identity')) {
    return 'sensitive';
  }
  
  return 'default';
}

async function logAttack(
  ip: string,
  userId: string | null,
  userType: string | null,
  path: string,
  method: string,
  reason: string,
  category: string
): Promise<void> {
  try {
    await prisma.attackLog.create({
      data: {
        type: 'rate_limit_exceeded',
        sourceIp: ip,
        userId,
        userType,
        requestPath: path,
        requestMethod: method,
        detectionReason: reason,
        detectionDetails: { category, timestamp: new Date().toISOString() },
        blocked: true
      }
    });
  } catch (error) {
    console.error('[SafeGoRateLimiter] Failed to log attack:', error);
  }
}

export function safegoRateLimiter(customCategory?: string) {
  return async function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const ip = getClientIp(req);
    const userId = (req as any).user?.id || null;
    const userType = (req as any).user?.role || null;
    const path = req.path;
    const method = req.method;
    
    const category = customCategory || getEndpointCategory(path, method);
    const config = ENDPOINT_CONFIGS[category] || ENDPOINT_CONFIGS.default;
    
    const keyBase = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `${category}:${keyBase}`;
    
    const now = Date.now();
    let window = rateLimitStore.get(key);
    
    if (window?.blockedUntil && window.blockedUntil > now) {
      const remainingMs = window.blockedUntil - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      
      res.setHeader('Retry-After', Math.ceil(remainingMs / 1000).toString());
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Math.ceil(window.blockedUntil / 1000).toString());
      
      res.status(429).json({
        error: `Too many requests. IP blocked for ${remainingMin} minutes.`,
        retryAfter: remainingMs
      });
      return;
    }
    
    if (!window || (now - window.windowStart > config.windowMs)) {
      window = {
        count: 0,
        windowStart: now
      };
      rateLimitStore.set(key, window);
    }
    
    window.count++;
    
    const remaining = Math.max(0, config.maxRequests - window.count);
    const resetTime = window.windowStart + config.windowMs;
    
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
    res.setHeader('X-RateLimit-Category', category);
    
    if (window.count > config.maxRequests) {
      window.blockedUntil = now + config.blockDurationMs;
      rateLimitStore.set(key, window);
      
      const reason = `Rate limit exceeded for ${category}: ${window.count}/${config.maxRequests} requests in window`;
      
      await Promise.all([
        logAttack(ip, userId, userType, path, method, reason, category),
        logAuditEvent({
          actorId: userId,
          actorEmail: (req as any).user?.email || null,
          actorRole: userType || 'unknown',
          ipAddress: ip,
          actionType: 'RATE_LIMIT_EXCEEDED',
          entityType: 'security',
          description: reason,
          metadata: {
            category,
            requestCount: window.count,
            blockedUntil: new Date(window.blockedUntil).toISOString()
          },
          success: false
        })
      ]);
      
      res.setHeader('Retry-After', Math.ceil(config.blockDurationMs / 1000).toString());
      
      res.status(429).json({
        error: `Too many ${config.description} requests. IP blocked for 15 minutes.`,
        retryAfter: config.blockDurationMs
      });
      return;
    }
    
    rateLimitStore.set(key, window);
    next();
  };
}

export const rateLimitAuth = safegoRateLimiter('auth');
export const rateLimitBooking = safegoRateLimiter('booking');
export const rateLimitPayment = safegoRateLimiter('payment');
export const rateLimitAdmin = safegoRateLimiter('admin');
export const rateLimitMaps = safegoRateLimiter('maps');
export const rateLimitWebhook = safegoRateLimiter('webhook');
export const rateLimitSensitive = safegoRateLimiter('sensitive');
export const rateLimitDefault = safegoRateLimiter('default');

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  
  for (const [key, window] of entries) {
    const categoryKey = key.split(':')[0];
    const config = ENDPOINT_CONFIGS[categoryKey] || ENDPOINT_CONFIGS.default;
    
    if (window.blockedUntil && window.blockedUntil < now) {
      rateLimitStore.delete(key);
    } else if (now - window.windowStart > config.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

export function getRateLimitStats(): {
  activeWindows: number;
  blockedIPs: number;
  byCategory: Record<string, number>;
} {
  const stats = {
    activeWindows: 0,
    blockedIPs: 0,
    byCategory: {} as Record<string, number>
  };
  
  const now = Date.now();
  
  for (const [key, window] of rateLimitStore.entries()) {
    const category = key.split(':')[0];
    stats.activeWindows++;
    
    if (window.blockedUntil && window.blockedUntil > now) {
      stats.blockedIPs++;
    }
    
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
  }
  
  return stats;
}
