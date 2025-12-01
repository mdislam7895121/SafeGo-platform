import { prisma } from '../db';
import crypto from 'crypto';
import { getClientIp } from '../utils/ip';
import { Request } from 'express';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const SIGNED_URL_EXPIRY_MS = 5 * 60 * 1000;

interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  signature: string;
}

interface KycAccessParams {
  adminId: string;
  targetUserType: string;
  targetUserId: string;
  action: 'view' | 'download' | 'decrypt' | 'share' | 'verify' | 'reject';
  documentType?: string;
  documentId?: string;
  ipAddress: string;
  userAgent?: string;
}

export async function logKycAccess(params: KycAccessParams): Promise<void> {
  try {
    await prisma.kycAccessLog.create({
      data: {
        adminId: params.adminId,
        targetUserType: params.targetUserType,
        targetUserId: params.targetUserId,
        action: params.action,
        documentType: params.documentType,
        documentId: params.documentId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        accessGranted: true
      }
    });
  } catch (error) {
    console.error('[KYCSecurityService] Failed to log access:', error);
  }
}

export async function logKycAccessDenied(
  params: Omit<KycAccessParams, 'action'> & { action?: string; reason: string }
): Promise<void> {
  try {
    await prisma.kycAccessLog.create({
      data: {
        adminId: params.adminId,
        targetUserType: params.targetUserType,
        targetUserId: params.targetUserId,
        action: (params.action as any) || 'view',
        documentType: params.documentType,
        documentId: params.documentId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        accessGranted: false,
        accessDeniedReason: params.reason
      }
    });
  } catch (error) {
    console.error('[KYCSecurityService] Failed to log denied access:', error);
  }
}

export function generateSignedUrl(
  documentPath: string,
  adminId: string,
  expiryMs: number = SIGNED_URL_EXPIRY_MS
): SignedUrlResult {
  const expiresAt = new Date(Date.now() + expiryMs);
  const payload = `${documentPath}:${adminId}:${expiresAt.getTime()}`;
  
  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  const signedPath = `/api/kyc/documents/signed?path=${encodeURIComponent(documentPath)}&expires=${expiresAt.getTime()}&admin=${adminId}&sig=${signature}`;
  
  return {
    url: signedPath,
    expiresAt,
    signature
  };
}

export function verifySignedUrl(
  path: string,
  adminId: string,
  expires: number,
  signature: string
): { valid: boolean; reason?: string } {
  if (Date.now() > expires) {
    return { valid: false, reason: 'URL has expired' };
  }
  
  const payload = `${path}:${adminId}:${expires}`;
  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

export function encryptKycData(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return iv.toString('hex') + ':' + encrypted + ':' + authTag;
}

export function decryptKycData(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');
  
  const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export async function detectSuspiciousKycAccess(adminId: string): Promise<{
  suspicious: boolean;
  reason?: string;
  recentAccessCount?: number;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentAccesses = await prisma.kycAccessLog.count({
    where: {
      adminId,
      timestamp: { gte: oneHourAgo }
    }
  });
  
  if (recentAccesses > 50) {
    return {
      suspicious: true,
      reason: 'Abnormally high KYC access volume',
      recentAccessCount: recentAccesses
    };
  }
  
  const distinctUsers = await prisma.kycAccessLog.groupBy({
    by: ['targetUserId'],
    where: {
      adminId,
      timestamp: { gte: oneHourAgo }
    }
  });
  
  if (distinctUsers.length > 30) {
    return {
      suspicious: true,
      reason: 'Accessing unusually large number of distinct user records',
      recentAccessCount: distinctUsers.length
    };
  }
  
  return { suspicious: false };
}

export async function getKycAccessAuditTrail(
  targetUserId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  logs: any[];
  total: number;
}> {
  const { limit = 50, offset = 0 } = options;
  
  const [logs, total] = await Promise.all([
    prisma.kycAccessLog.findMany({
      where: { targetUserId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.kycAccessLog.count({ where: { targetUserId } })
  ]);
  
  return { logs, total };
}

export function createKycAccessMiddleware(documentType?: string) {
  return async (req: Request, res: any, next: any): Promise<void> => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const adminRoles = ['admin', 'super_admin', 'compliance_admin'];
    if (!adminRoles.includes(user.role)) {
      await logKycAccessDenied({
        adminId: user.id,
        targetUserType: req.params.userType || 'unknown',
        targetUserId: req.params.userId || req.params.id || 'unknown',
        documentType,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        reason: 'Insufficient role permissions'
      });
      
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    const suspiciousCheck = await detectSuspiciousKycAccess(user.id);
    if (suspiciousCheck.suspicious) {
      await logKycAccessDenied({
        adminId: user.id,
        targetUserType: req.params.userType || 'unknown',
        targetUserId: req.params.userId || req.params.id || 'unknown',
        documentType,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        reason: suspiciousCheck.reason || 'Suspicious access pattern detected'
      });
      
      await prisma.attackLog.create({
        data: {
          type: 'suspicious_pattern',
          sourceIp: getClientIp(req),
          userId: user.id,
          userType: user.role,
          requestPath: req.path,
          requestMethod: req.method,
          detectionReason: suspiciousCheck.reason || 'Suspicious KYC access pattern',
          detectionDetails: { recentAccessCount: suspiciousCheck.recentAccessCount },
          blocked: true
        }
      });
      
      res.status(429).json({ error: 'Access temporarily restricted due to unusual activity' });
      return;
    }
    
    await logKycAccess({
      adminId: user.id,
      targetUserType: req.params.userType || 'unknown',
      targetUserId: req.params.userId || req.params.id || 'unknown',
      action: 'view',
      documentType,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });
    
    next();
  };
}
