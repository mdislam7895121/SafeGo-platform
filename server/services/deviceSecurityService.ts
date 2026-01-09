import { prisma } from '../db';
import crypto from 'crypto';
import { getClientIp } from '../utils/ip';
import { Request } from 'express';

export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform: string;
  browser: string;
  ipAddress: string;
  ipRegion: string | null;
  ipCountry: string | null;
}

export interface LoginRiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isNewDevice: boolean;
  isNewIpRegion: boolean;
  requiresVerification: boolean;
  reasons: string[];
}

interface KnownDevice {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
  ipRegion: string | null;
  lastUsedAt: Date;
  createdAt: Date;
  trusted: boolean;
}

const knownDevicesStore = new Map<string, KnownDevice[]>();

const suspiciousIpStore = new Map<string, {
  count: number;
  lastAttempt: Date;
}>();

export function extractDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ipAddress = getClientIp(req);
  
  const platform = extractPlatform(userAgent);
  const browser = extractBrowser(userAgent);
  
  const fingerprintData = [
    userAgent,
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    platform,
    browser
  ].join('|');
  
  const fingerprint = crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex')
    .substring(0, 32);

  const ipGeo = getIpGeolocation(ipAddress);

  return {
    fingerprint,
    userAgent,
    platform,
    browser,
    ipAddress,
    ipRegion: ipGeo.region,
    ipCountry: ipGeo.country
  };
}

function extractPlatform(userAgent: string): string {
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  return 'Unknown';
}

function extractBrowser(userAgent: string): string {
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Edg/i.test(userAgent)) return 'Edge';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Safari/i.test(userAgent)) return 'Safari';
  if (/Opera|OPR/i.test(userAgent)) return 'Opera';
  return 'Unknown';
}

function getIpGeolocation(ip: string): { region: string | null; country: string | null } {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { region: 'Local', country: 'LOCAL' };
  }
  
  return { region: null, country: null };
}

export async function assessLoginRisk(
  userId: string,
  deviceInfo: DeviceInfo,
  role: string
): Promise<LoginRiskAssessment> {
  const reasons: string[] = [];
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  const knownDevices = knownDevicesStore.get(userId) || [];
  
  const existingDevice = knownDevices.find(d => d.fingerprint === deviceInfo.fingerprint);
  const isNewDevice = !existingDevice;
  
  if (isNewDevice) {
    reasons.push('New device detected');
    riskLevel = 'MEDIUM';
  }

  const knownRegions = new Set(knownDevices.map(d => d.ipRegion).filter(Boolean));
  const isNewIpRegion = deviceInfo.ipRegion && !knownRegions.has(deviceInfo.ipRegion) && knownRegions.size > 0;
  
  if (isNewIpRegion) {
    reasons.push('Login from new geographic region');
    riskLevel = 'HIGH';
  }

  const suspiciousActivity = suspiciousIpStore.get(deviceInfo.ipAddress);
  if (suspiciousActivity && suspiciousActivity.count >= 3) {
    reasons.push('Multiple failed login attempts from this IP');
    riskLevel = 'HIGH';
  }

  const isHighRiskRole = role === 'admin';
  if (isHighRiskRole && isNewDevice) {
    reasons.push('Admin login from new device');
    riskLevel = 'HIGH';
  }

  const requiresVerification = riskLevel === 'HIGH' || (riskLevel === 'MEDIUM' && isHighRiskRole);

  return {
    riskLevel,
    isNewDevice,
    isNewIpRegion: !!isNewIpRegion,
    requiresVerification,
    reasons
  };
}

export async function registerDevice(
  userId: string,
  deviceInfo: DeviceInfo,
  trusted: boolean = false
): Promise<void> {
  const devices = knownDevicesStore.get(userId) || [];
  
  const existingIndex = devices.findIndex(d => d.fingerprint === deviceInfo.fingerprint);
  
  const device: KnownDevice = {
    id: crypto.randomUUID(),
    userId,
    fingerprint: deviceInfo.fingerprint,
    userAgent: deviceInfo.userAgent,
    ipAddress: deviceInfo.ipAddress,
    ipRegion: deviceInfo.ipRegion,
    lastUsedAt: new Date(),
    createdAt: existingIndex >= 0 ? devices[existingIndex].createdAt : new Date(),
    trusted
  };

  if (existingIndex >= 0) {
    devices[existingIndex] = device;
  } else {
    devices.push(device);
    if (devices.length > 10) {
      devices.sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
      devices.splice(10);
    }
  }

  knownDevicesStore.set(userId, devices);
}

export async function getKnownDevices(userId: string): Promise<KnownDevice[]> {
  return knownDevicesStore.get(userId) || [];
}

export async function removeDevice(userId: string, fingerprint: string): Promise<boolean> {
  const devices = knownDevicesStore.get(userId) || [];
  const index = devices.findIndex(d => d.fingerprint === fingerprint);
  
  if (index >= 0) {
    devices.splice(index, 1);
    knownDevicesStore.set(userId, devices);
    return true;
  }
  return false;
}

export async function removeAllDevices(userId: string, exceptFingerprint?: string): Promise<number> {
  const devices = knownDevicesStore.get(userId) || [];
  
  if (exceptFingerprint) {
    const keptDevice = devices.find(d => d.fingerprint === exceptFingerprint);
    if (keptDevice) {
      knownDevicesStore.set(userId, [keptDevice]);
      return devices.length - 1;
    }
  }
  
  knownDevicesStore.delete(userId);
  return devices.length;
}

export function recordFailedLogin(ipAddress: string): void {
  const existing = suspiciousIpStore.get(ipAddress) || { count: 0, lastAttempt: new Date() };
  existing.count++;
  existing.lastAttempt = new Date();
  suspiciousIpStore.set(ipAddress, existing);
}

export function clearFailedLogins(ipAddress: string): void {
  suspiciousIpStore.delete(ipAddress);
}

// PRODUCTION SAFETY: Only start cleanup interval when observability is enabled
if (process.env.DISABLE_OBSERVABILITY !== "true") {
  setInterval(() => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    Array.from(suspiciousIpStore.entries()).forEach(([key, value]) => {
      if (value.lastAttempt.getTime() < hourAgo) {
        suspiciousIpStore.delete(key);
      }
    });
  }, 15 * 60 * 1000);
}
