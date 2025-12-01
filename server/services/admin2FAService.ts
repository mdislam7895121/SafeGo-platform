import { prisma } from '../db';
import crypto from 'crypto';
import * as OTPAuth from 'otpauth';

export interface TOTPSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export class Admin2FAService {
  private static instance: Admin2FAService;
  private readonly encryptionKey: Buffer;
  private readonly issuer = 'SafeGo Admin';

  constructor() {
    const key = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
    this.encryptionKey = Buffer.from(key.slice(0, 32).padEnd(32, '0'));
  }

  static getInstance(): Admin2FAService {
    if (!this.instance) {
      this.instance = new Admin2FAService();
    }
    return this.instance;
  }

  async initiate2FASetup(adminId: string, email: string): Promise<TOTPSetupResult> {
    const secret = new OTPAuth.Secret({ size: 20 });
    
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });

    const qrCodeUrl = totp.toString();
    
    const backupCodes = this.generateBackupCodes(8);

    const { encrypted: encryptedSecret, iv: secretIv } = this.encrypt(secret.base32);
    const encryptedBackupCodes = this.encrypt(JSON.stringify(backupCodes));

    const existing = await prisma.adminTotpSecret.findUnique({
      where: { adminId }
    });

    if (existing) {
      await prisma.adminTotpSecret.update({
        where: { adminId },
        data: {
          encryptedSecret,
          secretIv,
          backupCodes: encryptedBackupCodes.encrypted,
          isEnabled: false,
          failedAttempts: 0,
          lockedUntil: null
        }
      });
    } else {
      await prisma.adminTotpSecret.create({
        data: {
          adminId,
          encryptedSecret,
          secretIv,
          backupCodes: encryptedBackupCodes.encrypted,
          isEnabled: false,
          failedAttempts: 0
        }
      });
    }

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes
    };
  }

  async verify2FASetup(adminId: string, token: string): Promise<boolean> {
    const totpSecret = await prisma.adminTotpSecret.findUnique({
      where: { adminId }
    });

    if (!totpSecret) {
      throw new Error('2FA not initiated');
    }

    const secret = this.decrypt(totpSecret.encryptedSecret, totpSecret.secretIv);
    
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: 'verify',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    const delta = totp.validate({ token, window: 1 });
    
    if (delta !== null) {
      await prisma.adminTotpSecret.update({
        where: { adminId },
        data: {
          isEnabled: true,
          lastVerifiedAt: new Date(),
          failedAttempts: 0
        }
      });

      await prisma.adminProfile.update({
        where: { id: adminId },
        data: { twoFactorEnabled: true }
      });

      return true;
    }

    return false;
  }

  async verifyTOTP(adminId: string, token: string): Promise<{
    valid: boolean;
    locked: boolean;
    remainingAttempts?: number;
  }> {
    const totpSecret = await prisma.adminTotpSecret.findUnique({
      where: { adminId }
    });

    if (!totpSecret || !totpSecret.isEnabled) {
      return { valid: false, locked: false };
    }

    if (totpSecret.lockedUntil && totpSecret.lockedUntil > new Date()) {
      return { valid: false, locked: true };
    }

    const secret = this.decrypt(totpSecret.encryptedSecret, totpSecret.secretIv);
    
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: 'verify',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    const delta = totp.validate({ token, window: 1 });
    
    if (delta !== null) {
      await prisma.adminTotpSecret.update({
        where: { adminId },
        data: {
          lastVerifiedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null
        }
      });
      return { valid: true, locked: false };
    }

    const failedAttempts = totpSecret.failedAttempts + 1;
    const maxAttempts = 5;
    
    let lockedUntil: Date | null = null;
    if (failedAttempts >= maxAttempts) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await prisma.adminTotpSecret.update({
      where: { adminId },
      data: {
        failedAttempts,
        lockedUntil
      }
    });

    return {
      valid: false,
      locked: lockedUntil !== null,
      remainingAttempts: Math.max(0, maxAttempts - failedAttempts)
    };
  }

  async verifyBackupCode(adminId: string, code: string): Promise<boolean> {
    const totpSecret = await prisma.adminTotpSecret.findUnique({
      where: { adminId }
    });

    if (!totpSecret || !totpSecret.backupCodes) {
      return false;
    }

    try {
      const encryptedData = totpSecret.backupCodes as string;
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      const backupCodes: string[] = JSON.parse(
        this.decrypt(encryptedData, ivHex)
      );

      const codeIndex = backupCodes.indexOf(code.toUpperCase());
      
      if (codeIndex === -1) {
        return false;
      }

      backupCodes.splice(codeIndex, 1);
      const { encrypted: newEncrypted } = this.encrypt(JSON.stringify(backupCodes));

      await prisma.adminTotpSecret.update({
        where: { adminId },
        data: {
          backupCodes: newEncrypted,
          backupCodesUsed: { increment: 1 },
          lastVerifiedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null
        }
      });

      return true;
    } catch (error) {
      console.error('[Admin2FAService] Failed to verify backup code:', error);
      return false;
    }
  }

  async disable2FA(adminId: string): Promise<void> {
    await prisma.$transaction([
      prisma.adminTotpSecret.delete({
        where: { adminId }
      }),
      prisma.adminProfile.update({
        where: { id: adminId },
        data: { twoFactorEnabled: false }
      })
    ]);
  }

  async regenerateBackupCodes(adminId: string): Promise<string[]> {
    const totpSecret = await prisma.adminTotpSecret.findUnique({
      where: { adminId }
    });

    if (!totpSecret || !totpSecret.isEnabled) {
      throw new Error('2FA not enabled');
    }

    const backupCodes = this.generateBackupCodes(8);
    const { encrypted } = this.encrypt(JSON.stringify(backupCodes));

    await prisma.adminTotpSecret.update({
      where: { adminId },
      data: {
        backupCodes: encrypted,
        backupCodesUsed: 0
      }
    });

    return backupCodes;
  }

  async is2FAEnabled(adminId: string): Promise<boolean> {
    const totpSecret = await prisma.adminTotpSecret.findUnique({
      where: { adminId },
      select: { isEnabled: true }
    });

    return totpSecret?.isEnabled || false;
  }

  async get2FAStatus(adminId: string): Promise<{
    enabled: boolean;
    lastVerified: Date | null;
    backupCodesRemaining: number;
    locked: boolean;
    lockedUntil: Date | null;
  }> {
    const totpSecret = await prisma.adminTotpSecret.findUnique({
      where: { adminId }
    });

    if (!totpSecret) {
      return {
        enabled: false,
        lastVerified: null,
        backupCodesRemaining: 0,
        locked: false,
        lockedUntil: null
      };
    }

    let backupCodesRemaining = 0;
    if (totpSecret.backupCodes) {
      try {
        const encryptedData = totpSecret.backupCodes as string;
        const [ivHex] = encryptedData.split(':');
        const codes = JSON.parse(this.decrypt(encryptedData, ivHex));
        backupCodesRemaining = codes.length;
      } catch {
        backupCodesRemaining = 8 - totpSecret.backupCodesUsed;
      }
    }

    return {
      enabled: totpSecret.isEnabled,
      lastVerified: totpSecret.lastVerifiedAt,
      backupCodesRemaining,
      locked: totpSecret.lockedUntil ? totpSecret.lockedUntil > new Date() : false,
      lockedUntil: totpSecret.lockedUntil
    };
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  private encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      encrypted: iv.toString('hex') + ':' + authTag + ':' + encrypted,
      iv: iv.toString('hex')
    };
  }

  private decrypt(encryptedData: string, ivHex: string): string {
    const [storedIv, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(storedIv, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

export const admin2FAService = Admin2FAService.getInstance();
