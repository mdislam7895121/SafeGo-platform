import express from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/authz';
import { prisma } from '../db';
import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  enableTwoFactor,
  disableTwoFactor,
  isTwoFactorEnabled,
  getTwoFactorSecret
} from '../services/twoFactorService';
import { logAuditEvent } from '../utils/audit';
import { getClientIp } from '../utils/ip';

const router = express.Router();

router.post(
  '/setup',
  authenticateToken,
  requireAdmin(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.user!.id;
      const email = req.user!.email;

      const isEnabled = await isTwoFactorEnabled(adminId);
      if (isEnabled) {
        return res.status(400).json({ error: '2FA is already enabled' });
      }

      const { secret, encryptedSecret, qrCodeDataUrl} = 
        await generateTwoFactorSecret(adminId, email);

      await prisma.adminProfile.update({
        where: { userId: adminId },
        data: {
          pending2FASecret_encrypted: encryptedSecret,
          pending2FAExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
        }
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: email,
        actorRole: 'admin',
        ipAddress: getClientIp(req),
        actionType: 'ADMIN_2FA_SETUP_INITIATED',
        entityType: 'admin_profile',
        entityId: adminId,
        description: `Admin ${email} initiated 2FA setup`
      });

      res.json({
        qrCode: qrCodeDataUrl,
        secret
      });
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      res.status(500).json({ error: 'Failed to setup 2FA' });
    }
  }
);

router.post(
  '/verify',
  authenticateToken,
  requireAdmin(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      const adminId = req.user!.id;
      const adminProfile = await prisma.adminProfile.findUnique({
        where: { userId: adminId }
      });

      if (!adminProfile?.pending2FASecret_encrypted || 
          !adminProfile.pending2FAExpiresAt ||
          adminProfile.pending2FAExpiresAt < new Date()) {
        return res.status(400).json({ 
          error: 'No pending 2FA setup found or setup expired. Please start setup again.' 
        });
      }

      const pendingSecret = adminProfile.pending2FASecret_encrypted;

      const isValid = await verifyTwoFactorToken(pendingSecret, token);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error('Error verifying 2FA token:', error);
      res.status(500).json({ error: 'Failed to verify token' });
    }
  }
);

router.post(
  '/enable',
  authenticateToken,
  requireAdmin(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      const adminId = req.user!.id;
      const email = req.user!.email;

      const adminProfile = await prisma.adminProfile.findUnique({
        where: { userId: adminId }
      });

      if (!adminProfile?.pending2FASecret_encrypted || 
          !adminProfile.pending2FAExpiresAt ||
          adminProfile.pending2FAExpiresAt < new Date()) {
        return res.status(400).json({ 
          error: 'No pending 2FA setup found or setup expired. Please start setup again.' 
        });
      }

      const pendingSecret = adminProfile.pending2FASecret_encrypted;

      const isValid = await verifyTwoFactorToken(pendingSecret, token);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      await enableTwoFactor(adminId, pendingSecret);
      
      await prisma.adminProfile.update({
        where: { userId: adminId },
        data: {
          pending2FASecret_encrypted: null,
          pending2FAExpiresAt: null
        }
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: email,
        actorRole: 'admin',
        ipAddress: getClientIp(req),
        actionType: 'ADMIN_2FA_ENABLED',
        entityType: 'admin_profile',
        entityId: adminId,
        description: `Admin ${email} enabled 2FA`
      });

      res.json({ 
        success: true, 
        message: '2FA has been enabled successfully' 
      });
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      res.status(500).json({ error: 'Failed to enable 2FA' });
    }
  }
);

router.post(
  '/disable',
  authenticateToken,
  requireAdmin(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token is required for disabling 2FA' });
      }

      const adminId = req.user!.id;
      const email = req.user!.email;

      const encryptedSecret = await getTwoFactorSecret(adminId);
      if (!encryptedSecret) {
        return res.status(400).json({ error: '2FA is not enabled' });
      }

      const isValid = await verifyTwoFactorToken(encryptedSecret, token);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      await disableTwoFactor(adminId);

      await logAuditEvent({
        actorId: adminId,
        actorEmail: email,
        actorRole: 'admin',
        ipAddress: getClientIp(req),
        actionType: 'ADMIN_2FA_DISABLED',
        entityType: 'admin_profile',
        entityId: adminId,
        description: `Admin ${email} disabled 2FA`
      });

      res.json({ 
        success: true, 
        message: '2FA has been disabled successfully' 
      });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  }
);

router.get(
  '/status',
  authenticateToken,
  requireAdmin(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.user!.id;
      const enabled = await isTwoFactorEnabled(adminId);

      res.json({ enabled });
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      res.status(500).json({ error: 'Failed to check 2FA status' });
    }
  }
);

export default router;
