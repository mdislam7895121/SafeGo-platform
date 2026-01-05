import { Request, Response, NextFunction } from "express";
import { getClientIp } from "../utils/ip";
import { AuthRequest } from "./auth";

interface RateLimitWindow {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

const tripActionStore = new Map<string, RateLimitWindow>();
const chatStore = new Map<string, RateLimitWindow>();
const webhookStore = new Map<string, RateLimitWindow>();
const authIdentifierStore = new Map<string, RateLimitWindow>();

const TRIP_ACTION_LIMITS = {
  maxRequests: 120,
  windowMs: 5 * 60 * 1000,
  blockDurationMs: 5 * 60 * 1000,
};

const CHAT_LIMITS = {
  maxRequests: 60,
  windowMs: 60 * 1000,
  blockDurationMs: 60 * 1000,
};

const WEBHOOK_LIMITS = {
  maxRequests: 120,
  windowMs: 60 * 1000,
  blockDurationMs: 60 * 1000,
};

const AUTH_LIMITS = {
  maxRequestsPerIP: 20,
  maxRequestsPerIdentifier: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
};

setInterval(() => {
  const now = Date.now();
  const cleanupStores = [tripActionStore, chatStore, webhookStore, authIdentifierStore];
  
  for (const store of cleanupStores) {
    for (const [key, window] of Array.from(store.entries())) {
      if (window.blockedUntil && window.blockedUntil < now) {
        store.delete(key);
      } else if (now - window.windowStart > 30 * 60 * 1000) {
        store.delete(key);
      }
    }
  }
}, 60 * 1000);

function checkRateLimit(
  store: Map<string, RateLimitWindow>,
  key: string,
  limits: { maxRequests: number; windowMs: number; blockDurationMs: number }
): { allowed: boolean; remaining: number; blockedUntil?: number } {
  const now = Date.now();
  let window = store.get(key);

  if (window?.blockedUntil && window.blockedUntil > now) {
    return { allowed: false, remaining: 0, blockedUntil: window.blockedUntil };
  }

  if (!window || now - window.windowStart > limits.windowMs) {
    window = { count: 0, windowStart: now };
    store.set(key, window);
  }

  window.count++;
  const remaining = Math.max(0, limits.maxRequests - window.count);

  if (window.count > limits.maxRequests) {
    window.blockedUntil = now + limits.blockDurationMs;
    store.set(key, window);
    
    console.warn(`[RateLimiter] Blocked key: ${key.substring(0, 20)}... - limit exceeded`);
    return { allowed: false, remaining: 0, blockedUntil: window.blockedUntil };
  }

  store.set(key, window);
  return { allowed: true, remaining };
}

export function tripActionLimiter(req: AuthRequest, res: Response, next: NextFunction): void {
  const userId = req.user?.userId;
  if (!userId) {
    return next();
  }

  const key = `trip:${userId}`;
  const result = checkRateLimit(tripActionStore, key, TRIP_ACTION_LIMITS);

  res.setHeader("X-RateLimit-Limit", TRIP_ACTION_LIMITS.maxRequests.toString());
  res.setHeader("X-RateLimit-Remaining", result.remaining.toString());

  if (!result.allowed) {
    const retryAfter = result.blockedUntil 
      ? Math.ceil((result.blockedUntil - Date.now()) / 1000)
      : TRIP_ACTION_LIMITS.blockDurationMs / 1000;
    
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({
      error: "Too many trip actions. Please slow down.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter,
    });
    return;
  }

  next();
}

export function chatLimiter(req: AuthRequest, res: Response, next: NextFunction): void {
  const userId = req.user?.userId;
  if (!userId) {
    return next();
  }

  const key = `chat:${userId}`;
  const result = checkRateLimit(chatStore, key, CHAT_LIMITS);

  res.setHeader("X-RateLimit-Limit", CHAT_LIMITS.maxRequests.toString());
  res.setHeader("X-RateLimit-Remaining", result.remaining.toString());

  if (!result.allowed) {
    const retryAfter = result.blockedUntil 
      ? Math.ceil((result.blockedUntil - Date.now()) / 1000)
      : CHAT_LIMITS.blockDurationMs / 1000;
    
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({
      error: "Too many messages. Please wait before sending more.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter,
    });
    return;
  }

  next();
}

export function webhookLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const key = `webhook:${ip}`;
  const result = checkRateLimit(webhookStore, key, WEBHOOK_LIMITS);

  if (!result.allowed) {
    const retryAfter = result.blockedUntil 
      ? Math.ceil((result.blockedUntil - Date.now()) / 1000)
      : WEBHOOK_LIMITS.blockDurationMs / 1000;
    
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  next();
}

export function authLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const identifier = req.body?.email || req.body?.phone || req.body?.phoneNumber;
  
  const ipKey = `auth:ip:${ip}`;
  const ipResult = checkRateLimit(authIdentifierStore, ipKey, {
    maxRequests: AUTH_LIMITS.maxRequestsPerIP,
    windowMs: AUTH_LIMITS.windowMs,
    blockDurationMs: AUTH_LIMITS.blockDurationMs,
  });

  if (!ipResult.allowed) {
    const retryAfter = ipResult.blockedUntil 
      ? Math.ceil((ipResult.blockedUntil - Date.now()) / 1000)
      : AUTH_LIMITS.blockDurationMs / 1000;
    
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({
      error: "Too many authentication attempts from this IP. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter,
    });
    return;
  }

  if (identifier) {
    const identifierKey = `auth:id:${identifier}`;
    const identifierResult = checkRateLimit(authIdentifierStore, identifierKey, {
      maxRequests: AUTH_LIMITS.maxRequestsPerIdentifier,
      windowMs: AUTH_LIMITS.windowMs,
      blockDurationMs: AUTH_LIMITS.blockDurationMs,
    });

    if (!identifierResult.allowed) {
      const retryAfter = identifierResult.blockedUntil 
        ? Math.ceil((identifierResult.blockedUntil - Date.now()) / 1000)
        : AUTH_LIMITS.blockDurationMs / 1000;
      
      res.setHeader("Retry-After", retryAfter.toString());
      res.status(429).json({
        error: "Too many authentication attempts for this account. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
      });
      return;
    }
  }

  next();
}
