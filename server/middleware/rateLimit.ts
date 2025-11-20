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
