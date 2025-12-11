import { prisma } from '../db';
import { DevicePlatform } from '@prisma/client';
import crypto from 'crypto';

export interface DeviceInfo {
  fingerprint: string;
  name?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  platform?: DevicePlatform;
}

export interface LoginEventData {
  userId: string;
  device: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  eventType: 'login_success' | 'login_failed' | 'logout' | 'session_refresh';
}

export interface DeviceRiskAssessment {
  isBlocked: boolean;
  isNewDevice: boolean;
  riskScore: number;
  riskFlags: string[];
  requiresVerification: boolean;
}

export class DeviceTrustService {
  private static instance: DeviceTrustService;

  private readonly HIGH_RISK_THRESHOLD = 70;
  private readonly BLOCK_THRESHOLD = 90;
  private readonly NEW_DEVICE_NOTIFICATION_THRESHOLD = 30;

  static getInstance(): DeviceTrustService {
    if (!this.instance) {
      this.instance = new DeviceTrustService();
    }
    return this.instance;
  }

  async registerDevice(
    userId: string,
    device: DeviceInfo,
    ipAddress?: string
  ): Promise<{ binding: any; isNewDevice: boolean }> {
    const existingBinding = await prisma.deviceBinding.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId,
          deviceFingerprint: device.fingerprint
        }
      }
    });

    if (existingBinding) {
      await prisma.deviceBinding.update({
        where: { id: existingBinding.id },
        data: {
          lastSeenAt: new Date(),
          deviceName: device.name || existingBinding.deviceName,
          deviceModel: device.model || existingBinding.deviceModel,
          osVersion: device.osVersion || existingBinding.osVersion,
          appVersion: device.appVersion || existingBinding.appVersion,
          ipAddress: ipAddress || existingBinding.ipAddress
        }
      });
      
      return { binding: existingBinding, isNewDevice: false };
    }

    const riskScore = await this.calculateDeviceRiskScore(userId, device, ipAddress);

    const binding = await prisma.deviceBinding.create({
      data: {
        userId,
        deviceFingerprint: device.fingerprint,
        deviceName: device.name,
        deviceModel: device.model,
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        platform: device.platform,
        ipAddress,
        riskScore,
        isTrusted: false,
        isBlocked: riskScore >= this.BLOCK_THRESHOLD
      }
    });

    return { binding, isNewDevice: true };
  }

  async recordLoginEvent(data: LoginEventData): Promise<DeviceRiskAssessment> {
    const { binding, isNewDevice } = await this.registerDevice(
      data.userId,
      data.device,
      data.ipAddress
    );

    if (binding.isBlocked) {
      await this.createLoginEvent(binding.id, data, isNewDevice, false);
      return {
        isBlocked: true,
        isNewDevice,
        riskScore: binding.riskScore,
        riskFlags: ['device_blocked'],
        requiresVerification: false
      };
    }

    const riskAssessment = await this.assessLoginRisk(data, binding);

    await this.createLoginEvent(
      binding.id,
      data,
      isNewDevice,
      isNewDevice && riskAssessment.riskScore >= this.NEW_DEVICE_NOTIFICATION_THRESHOLD
    );

    if (isNewDevice && riskAssessment.riskScore >= this.NEW_DEVICE_NOTIFICATION_THRESHOLD) {
      await this.sendNewDeviceNotification(data.userId, data.device, data.ipAddress);
    }

    return riskAssessment;
  }

  async blockDevice(
    userId: string,
    deviceFingerprint: string,
    reason: string
  ): Promise<void> {
    await prisma.deviceBinding.updateMany({
      where: {
        userId,
        deviceFingerprint
      },
      data: {
        isBlocked: true,
        blockReason: reason,
        riskScore: 100
      }
    });
  }

  async unblockDevice(userId: string, deviceFingerprint: string): Promise<void> {
    await prisma.deviceBinding.updateMany({
      where: {
        userId,
        deviceFingerprint
      },
      data: {
        isBlocked: false,
        blockReason: null
      }
    });
  }

  async trustDevice(userId: string, deviceFingerprint: string): Promise<void> {
    await prisma.deviceBinding.updateMany({
      where: {
        userId,
        deviceFingerprint
      },
      data: {
        isTrusted: true,
        riskScore: 0
      }
    });
  }

  async getUserDevices(userId: string): Promise<any[]> {
    return prisma.deviceBinding.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      include: {
        loginEvents: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
  }

  async getRecentLoginEvents(
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    return prisma.deviceLoginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        deviceBinding: {
          select: {
            deviceName: true,
            deviceModel: true,
            platform: true,
            isTrusted: true,
            isBlocked: true
          }
        }
      }
    });
  }

  async getHighRiskDevices(limit: number = 50): Promise<any[]> {
    return prisma.deviceBinding.findMany({
      where: {
        riskScore: { gte: this.HIGH_RISK_THRESHOLD }
      },
      orderBy: { riskScore: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true }
        },
        loginEvents: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });
  }

  async checkDeviceBlocked(
    userId: string,
    deviceFingerprint: string
  ): Promise<boolean> {
    const binding = await prisma.deviceBinding.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId,
          deviceFingerprint
        }
      },
      select: { isBlocked: true }
    });

    return binding?.isBlocked || false;
  }

  async detectSuspiciousActivity(
    userId: string,
    windowMinutes: number = 60
  ): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentLogins = await prisma.deviceLoginEvent.findMany({
      where: {
        userId,
        createdAt: { gte: windowStart },
        eventType: 'login_success'
      },
      include: {
        deviceBinding: true
      }
    });

    const uniqueDevices = new Set(
      recentLogins.map(l => l.deviceBinding.deviceFingerprint)
    ).size;

    if (uniqueDevices > 3) {
      return {
        suspicious: true,
        reason: `Multiple devices (${uniqueDevices}) logged in within ${windowMinutes} minutes`
      };
    }

    const uniqueIPs = new Set(
      recentLogins.map(l => l.ipAddress).filter(Boolean)
    ).size;

    if (uniqueIPs > 5) {
      return {
        suspicious: true,
        reason: `Multiple IPs (${uniqueIPs}) used within ${windowMinutes} minutes`
      };
    }

    const failedLogins = await prisma.deviceLoginEvent.count({
      where: {
        userId,
        createdAt: { gte: windowStart },
        eventType: 'login_failed'
      }
    });

    if (failedLogins >= 5) {
      return {
        suspicious: true,
        reason: `${failedLogins} failed login attempts within ${windowMinutes} minutes`
      };
    }

    return { suspicious: false };
  }

  async generateDeviceFingerprint(components: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  }): Promise<string> {
    const data = [
      components.userAgent,
      components.screenResolution || '',
      components.timezone || '',
      components.language || '',
      components.platform || ''
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async calculateDeviceRiskScore(
    userId: string,
    device: DeviceInfo,
    ipAddress?: string
  ): Promise<number> {
    let score = 0;

    const existingDevices = await prisma.deviceBinding.count({
      where: { userId }
    });

    if (existingDevices === 0) {
      score += 10;
    } else if (existingDevices > 5) {
      score += 30;
    }

    if (ipAddress) {
      const threatSignal = await prisma.apiThreatSignal.findUnique({
        where: { ipAddress }
      });

      if (threatSignal) {
        if (threatSignal.isTor) score += 40;
        if (threatSignal.isVpn) score += 20;
        if (threatSignal.isProxy) score += 25;
        if (threatSignal.isDatacenter) score += 15;
        
        if (threatSignal.reputationScore !== null) {
          score += Math.max(0, 50 - threatSignal.reputationScore) / 2;
        }
      }
    }

    return Math.min(100, score);
  }

  private async assessLoginRisk(
    data: LoginEventData,
    binding: any
  ): Promise<DeviceRiskAssessment> {
    const riskFlags: string[] = [];
    let riskScore = binding.riskScore;

    if (!binding.isTrusted) {
      riskFlags.push('untrusted_device');
      riskScore += 10;
    }

    if (data.ipAddress) {
      const threatSignal = await prisma.apiThreatSignal.findUnique({
        where: { ipAddress: data.ipAddress }
      });

      if (threatSignal?.isTor) {
        riskFlags.push('tor_network');
        riskScore += 30;
      }
      if (threatSignal?.isVpn) {
        riskFlags.push('vpn_detected');
        riskScore += 15;
      }
    }

    const suspiciousActivity = await this.detectSuspiciousActivity(data.userId);
    if (suspiciousActivity.suspicious) {
      riskFlags.push('suspicious_activity');
      riskScore += 25;
    }

    riskScore = Math.min(100, riskScore);

    return {
      isBlocked: binding.isBlocked,
      isNewDevice: false,
      riskScore,
      riskFlags,
      requiresVerification: riskScore >= this.HIGH_RISK_THRESHOLD
    };
  }

  private async createLoginEvent(
    deviceBindingId: string,
    data: LoginEventData,
    isNewDevice: boolean,
    notificationSent: boolean
  ): Promise<void> {
    await prisma.deviceLoginEvent.create({
      data: {
        deviceBindingId,
        userId: data.userId,
        eventType: data.eventType,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        isNewDevice,
        notificationSent
      }
    });
  }

  private async sendNewDeviceNotification(
    userId: string,
    device: DeviceInfo,
    ipAddress?: string
  ): Promise<void> {
    console.log(`[DeviceTrustService] New device notification sent to user ${userId}: ${device.name || device.model || 'Unknown device'} from IP ${ipAddress || 'unknown'}`);
  }
}

export const deviceTrustService = DeviceTrustService.getInstance();
