import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { verifyTwoFactorToken, getTwoFactorSecret, isTwoFactorEnabled } from '../services/twoFactorService';
import { logAuditEvent } from '../utils/audit';
import { getClientIp } from '../utils/ip';

export interface PayoutAuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email?: string;
  };
  payoutAuth?: {
    verified: boolean;
    method: '2fa' | 'password' | 'none';
  };
}

export async function requirePayoutVerification(
  req: PayoutAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { twoFactorCode, password } = req.body;

    if (!userId || !role) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (role === 'admin') {
      const adminProfile = await prisma.adminProfile.findUnique({
        where: { userId },
        select: { twoFactorEnabled: true, twoFactorSecret_encrypted: true }
      });

      if (adminProfile?.twoFactorEnabled) {
        if (!twoFactorCode) {
          res.status(403).json({ 
            error: 'Two-factor authentication required for payout operations',
            requiresTwoFactor: true
          });
          return;
        }

        if (!adminProfile.twoFactorSecret_encrypted) {
          res.status(500).json({ error: '2FA configuration error' });
          return;
        }

        const isValid = await verifyTwoFactorToken(adminProfile.twoFactorSecret_encrypted, twoFactorCode);
        if (!isValid) {
          await logAuditEvent({
            actorId: userId,
            actorEmail: req.user?.email || '',
            actorRole: 'admin',
            ipAddress: getClientIp(req),
            actionType: 'PAYOUT_2FA_FAILED',
            entityType: 'payout',
            description: 'Admin failed 2FA verification for payout operation',
            success: false
          });

          res.status(401).json({ error: 'Invalid two-factor code' });
          return;
        }

        req.payoutAuth = { verified: true, method: '2fa' };
        next();
        return;
      }
    }

    if (role === 'driver' || role === 'restaurant') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, email: true }
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!password) {
        res.status(403).json({ 
          error: 'Password verification required for payout method changes',
          requiresPassword: true
        });
        return;
      }

      const bcrypt = await import('bcrypt');
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        await logAuditEvent({
          actorId: userId,
          actorEmail: user.email,
          actorRole: role,
          ipAddress: getClientIp(req),
          actionType: 'PAYOUT_PASSWORD_VERIFICATION_FAILED',
          entityType: 'payout',
          description: `${role} failed password verification for payout method change`,
          success: false
        });

        res.status(401).json({ error: 'Invalid password' });
        return;
      }

      await logAuditEvent({
        actorId: userId,
        actorEmail: user.email,
        actorRole: role,
        ipAddress: getClientIp(req),
        actionType: 'PAYOUT_PASSWORD_VERIFIED',
        entityType: 'payout',
        description: `${role} verified password for payout method change`,
        success: true
      });

      req.payoutAuth = { verified: true, method: 'password' };
      next();
      return;
    }

    req.payoutAuth = { verified: false, method: 'none' };
    next();
  } catch (error) {
    console.error('Payout verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function logPayoutMethodChange(
  userId: string,
  email: string,
  role: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  methodId: string,
  details: any,
  req: Request
): Promise<void> {
  await logAuditEvent({
    actorId: userId,
    actorEmail: email,
    actorRole: role,
    ipAddress: getClientIp(req),
    actionType: `PAYOUT_METHOD_${action}`,
    entityType: 'payout_method',
    entityId: methodId,
    description: `${role} ${action.toLowerCase()}d payout method`,
    metadata: details,
    success: true
  });
}
