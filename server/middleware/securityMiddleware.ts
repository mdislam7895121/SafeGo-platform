import { Request, Response, NextFunction } from 'express';
import { admin2FAService } from '../services/admin2FAService';
import { adminIpWhitelistService } from '../services/adminIpWhitelistService';
import { developerAccessControl } from '../services/developerAccessControl';
import { botDefenseService } from '../services/botDefenseService';
import { apiFirewallService } from '../services/apiFirewallService';
import { adminActivityMonitor } from '../services/adminActivityMonitor';
import { deviceTrustService } from '../services/deviceTrustService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    adminId?: string;
    totpVerified?: boolean;
  };
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
    requiresChallenge?: boolean;
    requiresAuditLog?: boolean;
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function requireTotpVerified(options?: {
  bypassForRoles?: string[];
  redirectOnFailure?: boolean;
}) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (options?.bypassForRoles?.includes(user.role)) {
      return next();
    }

    if (!user.adminId) {
      return next();
    }

    const is2FAEnabled = await admin2FAService.is2FAEnabled(user.adminId);

    if (!is2FAEnabled) {
      return next();
    }

    if (!user.totpVerified) {
      return res.status(403).json({
        success: false,
        error: 'Two-factor authentication required',
        requiresTOTP: true
      });
    }

    next();
  };
}

export function enforceIpWhitelist(options?: {
  requireForRoles?: string[];
  allowAllIfEmpty?: boolean;
}) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const ipAddress = getClientIp(req);

    if (!user?.adminId) {
      return next();
    }

    if (options?.requireForRoles && !options.requireForRoles.includes(user.role)) {
      return next();
    }

    const result = await adminIpWhitelistService.checkAdminAccess(
      ipAddress,
      user.adminId,
      user.role
    );

    if (!result.allowed && result.requiresWhitelist) {
      await adminActivityMonitor.recordAndAnalyze({
        adminId: user.adminId,
        action: 'ip_blocked',
        resourceType: 'security',
        ipAddress,
        timestamp: new Date()
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: result.reason || 'IP address not in whitelist'
      });
    }

    next();
  };
}

export function enforceDeveloperPolicies() {
  return developerAccessControl.createMiddleware();
}

export function botProtection(options?: {
  strictMode?: boolean;
  bypassForAuthenticated?: boolean;
}) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (options?.bypassForAuthenticated && req.user) {
      return next();
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const isBlocked = await botDefenseService.isIpBlocked(ipAddress);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await botDefenseService.analyzeRequest({
      ipAddress,
      userAgent,
      requestPath: req.path,
      fingerprint: req.headers['x-device-fingerprint'] as string | undefined,
      userId: req.user?.id,
      headers: {
        'accept-language': req.headers['accept-language'] as string | undefined,
        'accept-encoding': req.headers['accept-encoding'] as string | undefined,
        'x-forwarded-for': req.headers['x-forwarded-for'] as string | undefined
      }
    });

    if (result.isBot && options?.strictMode) {
      return res.status(403).json({
        success: false,
        error: 'Automated access not allowed'
      });
    }

    if (result.requiresChallenge && result.challengeType) {
      const challenge = await botDefenseService.createChallenge(
        ipAddress,
        userAgent,
        result.challengeType
      );

      return res.status(429).json({
        success: false,
        error: 'Challenge required',
        challenge: {
          id: challenge.challengeId,
          type: challenge.challengeType,
          data: challenge.challengeData,
          expiresAt: challenge.expiresAt
        }
      });
    }

    if (!req.securityContext) {
      req.securityContext = {
        ipAddress,
        userAgent
      };
    }

    next();
  };
}

export function rateLimit() {
  return apiFirewallService.createMiddleware();
}

export function deviceBinding() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

    if (!deviceFingerprint) {
      return next();
    }

    const riskAssessment = await deviceTrustService.recordLoginEvent({
      userId: req.user.id,
      device: {
        fingerprint: deviceFingerprint,
        name: req.headers['x-device-name'] as string | undefined,
        model: req.headers['x-device-model'] as string | undefined,
        osVersion: req.headers['x-device-os'] as string | undefined,
        appVersion: req.headers['x-app-version'] as string | undefined
      },
      ipAddress,
      userAgent,
      eventType: 'session_refresh'
    });

    if (riskAssessment.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Device blocked',
        message: 'This device has been blocked for security reasons'
      });
    }

    if (riskAssessment.requiresVerification) {
      if (!req.securityContext) {
        req.securityContext = {
          ipAddress,
          userAgent,
          deviceFingerprint
        };
      }
      req.securityContext.requiresChallenge = true;
    }

    next();
  };
}

export function auditLogger(options?: {
  resourceType?: string;
  sensitiveFields?: string[];
}) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function (body) {
      const duration = Date.now() - startTime;

      if (req.user?.adminId && (req as any).requiresAuditLog) {
        const ipAddress = getClientIp(req);

        adminActivityMonitor.recordAndAnalyze({
          adminId: req.user.adminId,
          action: `${req.method}:${req.path}`,
          resourceType: options?.resourceType || 'api',
          metadata: {
            duration,
            statusCode: res.statusCode,
            method: req.method,
            path: req.path
          },
          ipAddress,
          timestamp: new Date()
        }).catch(err => {
          console.error('[AuditLogger] Failed to record activity:', err);
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  };
}

export function createSecurityContext() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;

    req.securityContext = {
      ipAddress,
      userAgent,
      deviceFingerprint
    };

    next();
  };
}

export function combinedSecurityMiddleware(options?: {
  enableBotProtection?: boolean;
  enableRateLimit?: boolean;
  enableDeviceTrust?: boolean;
  strictMode?: boolean;
}) {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [
    securityHeaders(),
    createSecurityContext()
  ];

  if (options?.enableRateLimit !== false) {
    middlewares.push(rateLimit());
  }

  if (options?.enableBotProtection !== false) {
    middlewares.push(botProtection({ 
      strictMode: options?.strictMode,
      bypassForAuthenticated: true 
    }));
  }

  if (options?.enableDeviceTrust !== false) {
    middlewares.push(deviceBinding());
  }

  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    const runNext = (err?: any) => {
      if (err) {
        return next(err);
      }

      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      try {
        middleware(req, res, runNext);
      } catch (error) {
        next(error);
      }
    };

    runNext();
  };
}

export function adminSecurityMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const middlewares = [
      requireTotpVerified(),
      enforceIpWhitelist({ requireForRoles: ['SUPER_ADMIN', 'FINANCE_ADMIN'] }),
      enforceDeveloperPolicies(),
      auditLogger({ resourceType: 'admin' })
    ];

    let index = 0;

    const runNext = (err?: any) => {
      if (err) {
        return next(err);
      }

      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      try {
        middleware(req, res, runNext);
      } catch (error) {
        next(error);
      }
    };

    runNext();
  };
}
