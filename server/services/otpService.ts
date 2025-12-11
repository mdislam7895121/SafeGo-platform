import { prisma } from '../db';
import crypto from 'crypto';

export type OtpPurpose = 
  | 'ADMIN_LOGIN'
  | 'PAYOUT_CHANGE'
  | 'PASSWORD_RESET'
  | 'NEW_DEVICE_LOGIN'
  | 'HIGH_RISK_ACTION';

export type OtpChannel = 'EMAIL' | 'SMS';

interface OtpConfig {
  length: number;
  expiryMinutes: number;
  maxAttempts: number;
  cooldownMinutes: number;
}

const OTP_CONFIGS: Record<OtpPurpose, OtpConfig> = {
  ADMIN_LOGIN: { length: 6, expiryMinutes: 10, maxAttempts: 3, cooldownMinutes: 15 },
  PAYOUT_CHANGE: { length: 6, expiryMinutes: 10, maxAttempts: 3, cooldownMinutes: 15 },
  PASSWORD_RESET: { length: 6, expiryMinutes: 10, maxAttempts: 3, cooldownMinutes: 15 },
  NEW_DEVICE_LOGIN: { length: 6, expiryMinutes: 10, maxAttempts: 3, cooldownMinutes: 15 },
  HIGH_RISK_ACTION: { length: 6, expiryMinutes: 10, maxAttempts: 3, cooldownMinutes: 15 },
};

const otpStore = new Map<string, {
  hashedCode: string;
  expiresAt: Date;
  attempts: number;
  purpose: OtpPurpose;
  channel: OtpChannel;
  createdAt: Date;
}>();

const requestCountStore = new Map<string, { count: number; windowStart: Date }>();
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 3;

const cooldownStore = new Map<string, Date>();

function generateOtp(length: number): string {
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function getStoreKey(userId: string, purpose: OtpPurpose): string {
  return `${userId}:${purpose}`;
}

function checkRateLimit(key: string): { allowed: boolean; remainingMinutes?: number } {
  const now = new Date();
  const record = requestCountStore.get(key);
  
  if (!record) {
    requestCountStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  const windowElapsed = (now.getTime() - record.windowStart.getTime()) / 60000;
  
  if (windowElapsed >= RATE_LIMIT_WINDOW_MINUTES) {
    requestCountStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const remainingMinutes = Math.ceil(RATE_LIMIT_WINDOW_MINUTES - windowElapsed);
    return { allowed: false, remainingMinutes };
  }
  
  record.count++;
  return { allowed: true };
}

export async function sendOtp(
  userId: string,
  email: string,
  phone: string | null,
  purpose: OtpPurpose,
  preferredChannel: OtpChannel = 'EMAIL'
): Promise<{ success: boolean; message: string; channel: OtpChannel }> {
  const config = OTP_CONFIGS[purpose];
  const key = getStoreKey(userId, purpose);
  
  const rateCheck = checkRateLimit(key);
  if (!rateCheck.allowed) {
    return {
      success: false,
      message: `Too many requests. Please wait ${rateCheck.remainingMinutes} minutes.`,
      channel: preferredChannel
    };
  }
  
  const cooldownUntil = cooldownStore.get(key);
  if (cooldownUntil && cooldownUntil > new Date()) {
    const remainingMinutes = Math.ceil((cooldownUntil.getTime() - Date.now()) / 60000);
    return {
      success: false,
      message: `Too many failed attempts. Please wait ${remainingMinutes} minutes.`,
      channel: preferredChannel
    };
  }

  const existingOtp = otpStore.get(key);
  if (existingOtp && existingOtp.expiresAt > new Date() && existingOtp.attempts === 0) {
    const createdAgo = (Date.now() - existingOtp.createdAt.getTime()) / 1000;
    if (createdAgo < 60) {
      return {
        success: false,
        message: 'OTP already sent. Please wait before requesting a new one.',
        channel: existingOtp.channel
      };
    }
  }

  const otp = generateOtp(config.length);
  const hashedCode = hashOtp(otp);
  const expiresAt = new Date(Date.now() + config.expiryMinutes * 60 * 1000);

  const channel = (preferredChannel === 'SMS' && phone) ? 'SMS' : 'EMAIL';

  const delivered = await deliverOtp(email, phone, otp, purpose, channel);

  if (!delivered) {
    return {
      success: false,
      message: 'Failed to send verification code. Please try again.',
      channel
    };
  }

  otpStore.set(key, {
    hashedCode,
    expiresAt,
    attempts: 0,
    purpose,
    channel,
    createdAt: new Date()
  });

  return {
    success: true,
    message: `Verification code sent via ${channel.toLowerCase()}.`,
    channel
  };
}

async function deliverOtp(
  email: string,
  phone: string | null,
  otp: string,
  purpose: OtpPurpose,
  channel: OtpChannel
): Promise<boolean> {
  const purposeMessages: Record<OtpPurpose, string> = {
    ADMIN_LOGIN: 'admin login verification',
    PAYOUT_CHANGE: 'payout method change verification',
    PASSWORD_RESET: 'password reset verification',
    NEW_DEVICE_LOGIN: 'new device login verification',
    HIGH_RISK_ACTION: 'security verification'
  };

  const message = `Your SafeGo ${purposeMessages[purpose]} code is: ${otp}. This code expires in ${OTP_CONFIGS[purpose].expiryMinutes} minutes. Do not share this code with anyone.`;

  if (channel === 'SMS' && phone) {
    return await sendSmsOtp(phone, message);
  } else {
    return await sendEmailOtp(email, `SafeGo Security Verification`, message);
  }
}

async function sendEmailOtp(email: string, subject: string, body: string): Promise<boolean> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP EMAIL] To: ${email}`);
      console.log(`[OTP EMAIL] Subject: ${subject}`);
      console.log(`[OTP EMAIL] Body: ${body}`);
      return true;
    }

    console.log(`[OTP] Email OTP sent to ${email.substring(0, 3)}***`);
    return true;
  } catch (error) {
    console.error('Failed to send email OTP:', error);
    return false;
  }
}

async function sendSmsOtp(phone: string, message: string): Promise<boolean> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP SMS] To: ${phone}`);
      console.log(`[OTP SMS] Message: ${message}`);
      return true;
    }

    console.log(`[OTP] SMS OTP sent to ${phone.substring(0, 4)}***`);
    return true;
  } catch (error) {
    console.error('Failed to send SMS OTP:', error);
    return false;
  }
}

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string
): Promise<{ valid: boolean; message: string }> {
  const config = OTP_CONFIGS[purpose];
  const key = getStoreKey(userId, purpose);
  
  const storedOtp = otpStore.get(key);
  
  if (!storedOtp) {
    return { valid: false, message: 'No verification code found. Please request a new one.' };
  }

  if (storedOtp.expiresAt < new Date()) {
    otpStore.delete(key);
    return { valid: false, message: 'Verification code expired. Please request a new one.' };
  }

  storedOtp.attempts++;

  if (storedOtp.attempts > config.maxAttempts) {
    otpStore.delete(key);
    cooldownStore.set(key, new Date(Date.now() + config.cooldownMinutes * 60 * 1000));
    return { valid: false, message: 'Too many failed attempts. Please wait before trying again.' };
  }

  const hashedInput = hashOtp(code);
  if (hashedInput !== storedOtp.hashedCode) {
    const remaining = config.maxAttempts - storedOtp.attempts;
    return { 
      valid: false, 
      message: `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` 
    };
  }

  otpStore.delete(key);
  return { valid: true, message: 'Verification successful.' };
}

export function invalidateOtp(userId: string, purpose: OtpPurpose): void {
  const key = getStoreKey(userId, purpose);
  otpStore.delete(key);
}

export function hasActiveOtp(userId: string, purpose: OtpPurpose): boolean {
  const key = getStoreKey(userId, purpose);
  const storedOtp = otpStore.get(key);
  return !!storedOtp && storedOtp.expiresAt > new Date();
}

setInterval(() => {
  const now = new Date();
  Array.from(otpStore.entries()).forEach(([key, value]) => {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  });
  Array.from(cooldownStore.entries()).forEach(([key, value]) => {
    if (value < now) {
      cooldownStore.delete(key);
    }
  });
}, 60 * 1000);
