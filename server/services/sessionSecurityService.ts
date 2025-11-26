import crypto from 'crypto';
import { DeviceInfo } from './deviceSecurityService';

interface UserSession {
  sessionId: string;
  userId: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedReason?: string;
}

const sessionsStore = new Map<string, UserSession>();
const userSessionsIndex = new Map<string, Set<string>>();
const revokedTokensStore = new Map<string, Date>();

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const ADMIN_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const REVOKED_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  role: string
): string {
  const sessionId = crypto.randomUUID();
  const duration = role === 'admin' ? ADMIN_SESSION_DURATION_MS : SESSION_DURATION_MS;
  
  const session: UserSession = {
    sessionId,
    userId,
    deviceFingerprint: deviceInfo.fingerprint,
    ipAddress: deviceInfo.ipAddress,
    userAgent: deviceInfo.userAgent,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + duration),
    isActive: true
  };

  sessionsStore.set(sessionId, session);

  let userSessions = userSessionsIndex.get(userId);
  if (!userSessions) {
    userSessions = new Set();
    userSessionsIndex.set(userId, userSessions);
  }
  userSessions.add(sessionId);

  return sessionId;
}

export function validateSession(sessionId: string): UserSession | null {
  const session = sessionsStore.get(sessionId);
  
  if (!session) return null;
  if (!session.isActive) return null;
  if (session.expiresAt < new Date()) {
    invalidateSession(sessionId, 'Session expired');
    return null;
  }

  session.lastActivityAt = new Date();
  return session;
}

export function invalidateSession(sessionId: string, reason: string = 'Manual logout'): boolean {
  const session = sessionsStore.get(sessionId);
  if (!session) return false;

  session.isActive = false;
  session.revokedAt = new Date();
  session.revokedReason = reason;

  revokedTokensStore.set(sessionId, new Date(Date.now() + REVOKED_TOKEN_RETENTION_MS));

  return true;
}

export function revokeAllUserSessions(
  userId: string,
  reason: string,
  exceptSessionId?: string
): number {
  const userSessions = userSessionsIndex.get(userId);
  if (!userSessions) return 0;

  let revokedCount = 0;

  userSessions.forEach(sessionId => {
    if (sessionId !== exceptSessionId) {
      if (invalidateSession(sessionId, reason)) {
        revokedCount++;
      }
    }
  });

  console.log(`[SessionSecurity] Revoked ${revokedCount} sessions for user ${userId}: ${reason}`);

  return revokedCount;
}

export function revokeSessionsByDevice(
  userId: string,
  deviceFingerprint: string,
  reason: string
): number {
  const userSessions = userSessionsIndex.get(userId);
  if (!userSessions) return 0;

  let revokedCount = 0;

  userSessions.forEach(sessionId => {
    const session = sessionsStore.get(sessionId);
    if (session && session.deviceFingerprint === deviceFingerprint && session.isActive) {
      if (invalidateSession(sessionId, reason)) {
        revokedCount++;
      }
    }
  });

  return revokedCount;
}

export function getActiveSessions(userId: string): UserSession[] {
  const userSessions = userSessionsIndex.get(userId);
  if (!userSessions) return [];

  const activeSessions: UserSession[] = [];
  
  userSessions.forEach(sessionId => {
    const session = sessionsStore.get(sessionId);
    if (session && session.isActive && session.expiresAt > new Date()) {
      activeSessions.push({
        ...session
      });
    }
  });

  return activeSessions.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
}

export function isTokenRevoked(sessionId: string): boolean {
  return revokedTokensStore.has(sessionId);
}

export async function onPasswordChange(userId: string, currentSessionId?: string): Promise<void> {
  const revokedCount = revokeAllUserSessions(
    userId,
    'Password changed - all sessions revoked for security',
    currentSessionId
  );
  
  console.log(`[SessionSecurity] Password change: revoked ${revokedCount} sessions for user ${userId}`);
}

export async function onSuspiciousLogin(
  userId: string,
  deviceInfo: DeviceInfo,
  reasons: string[]
): Promise<void> {
  const message = `Suspicious login detected: ${reasons.join(', ')}`;
  
  const revokedCount = revokeAllUserSessions(userId, message);
  
  console.log(`[SessionSecurity] Suspicious login: revoked ${revokedCount} sessions for user ${userId}`);
  console.log(`[SessionSecurity] Reasons: ${reasons.join(', ')}`);
}

setInterval(() => {
  const now = new Date();
  
  Array.from(sessionsStore.entries()).forEach(([sessionId, session]) => {
    if (session.expiresAt < now || (!session.isActive && session.revokedAt)) {
      const retentionEnd = session.revokedAt 
        ? new Date(session.revokedAt.getTime() + 24 * 60 * 60 * 1000)
        : now;
      
      if (retentionEnd < now) {
        sessionsStore.delete(sessionId);
        const userSessions = userSessionsIndex.get(session.userId);
        if (userSessions) {
          userSessions.delete(sessionId);
          if (userSessions.size === 0) {
            userSessionsIndex.delete(session.userId);
          }
        }
      }
    }
  });

  Array.from(revokedTokensStore.entries()).forEach(([token, expiresAt]) => {
    if (expiresAt < now) {
      revokedTokensStore.delete(token);
    }
  });
}, 60 * 60 * 1000);
