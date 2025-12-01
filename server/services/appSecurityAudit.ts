import { prisma } from '../db';
import { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../utils/ip';
import crypto from 'crypto';

interface RoutePermission {
  path: string;
  method: string;
  allowedRoles: string[];
  requiresAuth: boolean;
  requiresOwnership?: boolean;
  ownershipField?: string;
}

const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/api/admin', method: '*', allowedRoles: ['admin', 'super_admin', 'country_admin', 'city_admin', 'compliance_admin', 'support_admin', 'finance_admin', 'readonly_admin'], requiresAuth: true },
  { path: '/api/driver', method: '*', allowedRoles: ['driver'], requiresAuth: true },
  { path: '/api/customer', method: '*', allowedRoles: ['customer'], requiresAuth: true },
  { path: '/api/restaurant', method: '*', allowedRoles: ['restaurant'], requiresAuth: true },
  
  { path: '/api/admin/customers/:id', method: 'GET', allowedRoles: ['admin', 'super_admin', 'support_admin'], requiresAuth: true },
  { path: '/api/admin/drivers/:id', method: 'GET', allowedRoles: ['admin', 'super_admin', 'support_admin'], requiresAuth: true },
  { path: '/api/admin/drivers/:id/kyc', method: 'GET', allowedRoles: ['admin', 'super_admin', 'compliance_admin'], requiresAuth: true },
  { path: '/api/admin/payout', method: '*', allowedRoles: ['admin', 'super_admin', 'finance_admin'], requiresAuth: true },
  { path: '/api/admin/settlements', method: '*', allowedRoles: ['admin', 'super_admin', 'finance_admin'], requiresAuth: true },
  
  { path: '/api/rides/:id', method: 'GET', allowedRoles: ['customer', 'driver', 'admin'], requiresAuth: true, requiresOwnership: true },
  { path: '/api/food-orders/:id', method: 'GET', allowedRoles: ['customer', 'driver', 'restaurant', 'admin'], requiresAuth: true, requiresOwnership: true },
  { path: '/api/parcels/:id', method: 'GET', allowedRoles: ['customer', 'driver', 'admin'], requiresAuth: true, requiresOwnership: true },
  
  { path: '/api/driver/wallet', method: '*', allowedRoles: ['driver'], requiresAuth: true, requiresOwnership: true },
  { path: '/api/driver/earnings', method: '*', allowedRoles: ['driver'], requiresAuth: true, requiresOwnership: true },
  { path: '/api/driver/profile', method: '*', allowedRoles: ['driver'], requiresAuth: true, requiresOwnership: true },
];

const SENSITIVE_FIELDS = [
  'nid', 'nidNumber', 'nidFrontImage', 'nidBackImage',
  'governmentId', 'governmentIdLast4', 'ssnLast4',
  'licenseNumber', 'licenseImage', 'passportNumber',
  'phoneNumber', 'phone', 'email',
  'permanentAddress', 'presentAddress', 'homeAddress',
  'dateOfBirth', 'fatherName',
  'password', 'passwordHash', 'sessionToken', 'refreshToken',
  'apiKey', 'secretKey', 'encryptionKey'
];

export interface SecurityAuditResult {
  passed: boolean;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation?: string;
  evidence?: any;
}

export async function runSecurityAudit(): Promise<SecurityAuditResult> {
  const findings: SecurityFinding[] = [];
  
  const rbacFindings = await auditRBACEnforcement();
  findings.push(...rbacFindings);
  
  const authFindings = await auditAuthentication();
  findings.push(...authFindings);
  
  const inputFindings = await auditInputValidation();
  findings.push(...inputFindings);
  
  const dataFindings = await auditDataExposure();
  findings.push(...dataFindings);
  
  for (const finding of findings) {
    try {
      await prisma.securityAuditFinding.create({
        data: {
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          recommendation: finding.recommendation,
          evidence: finding.evidence,
          status: 'open'
        }
      });
    } catch (error) {
      console.error('[AppSecurityAudit] Failed to store finding:', error);
    }
  }
  
  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length
  };
  
  return {
    passed: summary.critical === 0 && summary.high === 0,
    findings,
    summary
  };
}

async function auditRBACEnforcement(): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  
  const recentAttempts = await prisma.auditLog.findMany({
    where: {
      actionType: { in: ['UNAUTHORIZED_ACCESS', 'FORBIDDEN_ACCESS', 'PERMISSION_DENIED'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    take: 100
  });
  
  if (recentAttempts.length > 20) {
    findings.push({
      severity: 'high',
      category: 'RBAC',
      title: 'High volume of unauthorized access attempts',
      description: `${recentAttempts.length} unauthorized access attempts detected in the last 24 hours`,
      recommendation: 'Review access patterns and consider implementing additional access controls',
      evidence: { attemptCount: recentAttempts.length }
    });
  }
  
  return findings;
}

async function auditAuthentication(): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  
  const failedLogins = await prisma.auditLog.findMany({
    where: {
      actionType: { in: ['LOGIN_FAILED', 'ADMIN_LOGIN_FAILED'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
  
  const ipCounts = new Map<string, number>();
  for (const log of failedLogins) {
    const ip = log.ipAddress || 'unknown';
    ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
  }
  
  for (const [ip, count] of ipCounts.entries()) {
    if (count > 10) {
      findings.push({
        severity: 'high',
        category: 'Authentication',
        title: 'Potential brute force attack detected',
        description: `IP ${ip} has ${count} failed login attempts in the last 24 hours`,
        recommendation: 'Consider blocking this IP and investigating the source',
        evidence: { ip, failedAttempts: count }
      });
    }
  }
  
  return findings;
}

async function auditInputValidation(): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  
  const attackLogs = await prisma.attackLog.findMany({
    where: {
      type: { in: ['injection_attempt', 'xss_attempt'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
  
  if (attackLogs.length > 0) {
    findings.push({
      severity: 'medium',
      category: 'Input Validation',
      title: 'Injection attempts detected',
      description: `${attackLogs.length} potential injection attacks detected and blocked`,
      recommendation: 'Review input validation and sanitization practices',
      evidence: { attackCount: attackLogs.length }
    });
  }
  
  return findings;
}

async function auditDataExposure(): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  
  findings.push({
    severity: 'info',
    category: 'Data Protection',
    title: 'Sensitive field masking active',
    description: `${SENSITIVE_FIELDS.length} sensitive fields are configured for masking in logs`,
    recommendation: 'Regularly review and update the sensitive fields list'
  });
  
  return findings;
}

export function checkIDOR(
  resourceUserId: string | null | undefined,
  requestUserId: string,
  userRole: string,
  adminRoles: string[] = ['admin', 'super_admin', 'support_admin']
): { allowed: boolean; reason?: string } {
  if (adminRoles.includes(userRole)) {
    return { allowed: true };
  }
  
  if (!resourceUserId) {
    return { allowed: false, reason: 'Resource has no owner' };
  }
  
  if (resourceUserId === requestUserId) {
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'User does not own this resource' };
}

export function idorProtection(ownershipExtractor: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const adminRoles = ['admin', 'super_admin', 'support_admin', 'country_admin', 'city_admin', 'compliance_admin', 'finance_admin'];
    if (adminRoles.includes(user.role)) {
      next();
      return;
    }
    
    try {
      const resourceOwnerId = await ownershipExtractor(req);
      const check = checkIDOR(resourceOwnerId, user.id, user.role, adminRoles);
      
      if (!check.allowed) {
        const ip = getClientIp(req);
        
        await prisma.attackLog.create({
          data: {
            type: 'idor_attempt',
            sourceIp: ip,
            userId: user.id,
            userType: user.role,
            requestPath: req.path,
            requestMethod: req.method,
            detectionReason: check.reason || 'IDOR attempt detected',
            blocked: true
          }
        });
        
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      
      next();
    } catch (error) {
      console.error('[IDOR Protection] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function maskSensitiveData(data: any): any {
  if (!data) return data;
  
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }
  
  const masked = { ...data };
  
  for (const key of Object.keys(masked)) {
    const keyLower = key.toLowerCase();
    
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      keyLower === field.toLowerCase() || 
      keyLower.includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      if (typeof masked[key] === 'string') {
        const value = masked[key];
        if (value.length <= 4) {
          masked[key] = '****';
        } else {
          masked[key] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
        }
      } else {
        masked[key] = '[REDACTED]';
      }
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  
  return masked;
}

export function validateRoleAccess(requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!requiredRoles.includes(user.role)) {
      const ip = getClientIp(req);
      
      prisma.attackLog.create({
        data: {
          type: 'unauthorized_access',
          sourceIp: ip,
          userId: user.id,
          userType: user.role,
          requestPath: req.path,
          requestMethod: req.method,
          detectionReason: `Role ${user.role} not authorized for this endpoint`,
          blocked: true
        }
      }).catch(err => console.error('[RoleAccess] Failed to log:', err));
      
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
}

export async function getSecurityAuditSummary(): Promise<{
  openFindings: number;
  criticalCount: number;
  recentAttacks: number;
  blockedIPs: number;
}> {
  const [openFindings, recentAttacks] = await Promise.all([
    prisma.securityAuditFinding.groupBy({
      by: ['severity'],
      where: { status: 'open' },
      _count: true
    }),
    prisma.attackLog.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        blocked: true
      }
    })
  ]);
  
  const criticalCount = openFindings.find(f => f.severity === 'critical')?._count || 0;
  const totalOpen = openFindings.reduce((sum, f) => sum + f._count, 0);
  
  return {
    openFindings: totalOpen,
    criticalCount,
    recentAttacks,
    blockedIPs: 0
  };
}
