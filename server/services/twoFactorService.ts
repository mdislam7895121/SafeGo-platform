import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { encryptSensitive, decryptSensitive } from '../utils/crypto';
import { prisma } from '../db';

export async function generateTwoFactorSecret(adminId: string, email: string) {
  const secret = new OTPAuth.Secret({ size: 32 });
  const totp = new OTPAuth.TOTP({
    issuer: 'SafeGo',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret
  });

  const otpauthUrl = totp.toString();

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  const encryptedSecret = encryptSensitive(secret.base32);

  return {
    secret: secret.base32,
    encryptedSecret,
    otpauthUrl,
    qrCodeDataUrl
  };
}

export async function verifyTwoFactorToken(
  encryptedSecret: string,
  token: string
): Promise<boolean> {
  try {
    const secretBase32 = decryptSensitive(encryptedSecret);
    if (!secretBase32) {
      return false;
    }

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32)
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    return false;
  }
}

export async function enableTwoFactor(
  adminId: string,
  encryptedSecret: string
): Promise<string[]> {
  const recoveryCodes = generateRecoveryCodes(8);
  const encryptedRecoveryCodes = encryptSensitive(JSON.stringify(recoveryCodes));

  await prisma.adminProfile.update({
    where: { userId: adminId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret_encrypted: encryptedSecret,
      twoFactorRecoveryCodes_encrypted: encryptedRecoveryCodes
    }
  });

  return recoveryCodes;
}

export async function disableTwoFactor(adminId: string): Promise<void> {
  await prisma.adminProfile.update({
    where: { userId: adminId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret_encrypted: null,
      twoFactorRecoveryCodes_encrypted: null
    }
  });
}

export async function verifyRecoveryCode(
  adminId: string,
  code: string
): Promise<boolean> {
  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: adminId }
  });

  if (!adminProfile || !adminProfile.twoFactorRecoveryCodes_encrypted) {
    return false;
  }

  try {
    const recoveryCodesJson = decryptSensitive(
      adminProfile.twoFactorRecoveryCodes_encrypted
    );
    if (!recoveryCodesJson) {
      return false;
    }

    const recoveryCodes: string[] = JSON.parse(recoveryCodesJson);
    const isValid = recoveryCodes.includes(code);

    if (isValid) {
      const updatedCodes = recoveryCodes.filter(c => c !== code);
      const encryptedUpdatedCodes = encryptSensitive(
        JSON.stringify(updatedCodes)
      );

      await prisma.adminProfile.update({
        where: { userId: adminId },
        data: {
          twoFactorRecoveryCodes_encrypted: encryptedUpdatedCodes
        }
      });
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying recovery code:', error);
    return false;
  }
}

function generateRecoveryCodes(count: number): string[] {
  const codes: string[] = [];
  const crypto = require('crypto');
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

export async function isTwoFactorEnabled(adminId: string): Promise<boolean> {
  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: adminId },
    select: { twoFactorEnabled: true }
  });

  return adminProfile?.twoFactorEnabled || false;
}

export async function getTwoFactorSecret(adminId: string): Promise<string | null> {
  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: adminId },
    select: { twoFactorSecret_encrypted: true }
  });

  return adminProfile?.twoFactorSecret_encrypted || null;
}
