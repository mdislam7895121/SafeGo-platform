import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { verifyTwoFactorToken } from '../services/twoFactorService';
import { sendOtp, verifyOtp, type OtpPurpose } from '../services/otpService';
import { logAuditEvent } from '../utils/audit';
import { logPayoutChange } from '../services/tamperProofAuditService';
import { getClientIp } from '../utils/ip';

export interface PayoutAuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email?: string;
  };
  payoutAuth?: {
    verified: boolean;
    method: '2fa' | 'otp' | 'password' | 'none';
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
    const { twoFactorCode, otpCode, password, requestOtp } = req.body;

    if (!userId || !role) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let phone: string | null = null;
    if (role === 'driver') {
      const driver = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { phoneNumber: true }
      });
      phone = driver?.phoneNumber || null;
    } else if (role === 'restaurant') {
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { userId },
        select: { emergencyContactPhone: true }
      });
      phone = restaurant?.emergencyContactPhone || null;
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
            actorEmail: user.email,
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

        logPayoutChange(req, userId, user.email, 'admin', 'PAYOUT_2FA_VERIFIED', '', 'Admin verified 2FA for payout change');
        req.payoutAuth = { verified: true, method: '2fa' };
        next();
        return;
      }
    }

    if (role === 'driver' || role === 'restaurant') {
      if (requestOtp) {
        const result = await sendOtp(
          userId,
          user.email,
          phone,
          'PAYOUT_CHANGE' as OtpPurpose,
          phone ? 'SMS' : 'EMAIL'
        );

        res.status(200).json({
          otpSent: result.success,
          message: result.message,
          channel: result.channel
        });
        return;
      }

      if (!otpCode || !password) {
        res.status(403).json({ 
          error: 'Both OTP and password required for payout method changes',
          requiresVerification: true,
          methods: ['otp', 'password'],
          missingOtp: !otpCode,
          missingPassword: !password
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

      const otpResult = await verifyOtp(userId, 'PAYOUT_CHANGE', otpCode);
      
      if (!otpResult.valid) {
        await logAuditEvent({
          actorId: userId,
          actorEmail: user.email,
          actorRole: role,
          ipAddress: getClientIp(req),
          actionType: 'PAYOUT_OTP_VERIFICATION_FAILED',
          entityType: 'payout',
          description: `${role} failed OTP verification for payout method change`,
          success: false
        });

        res.status(401).json({ error: otpResult.message });
        return;
      }

      logPayoutChange(req, userId, user.email, role, 'PAYOUT_2FA_VERIFIED', '', `${role} verified OTP + password for payout change`);
      req.payoutAuth = { verified: true, method: 'otp' };
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
