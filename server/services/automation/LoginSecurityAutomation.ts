/**
 * SafeGo Login Security Automation Service
 * Handles login security threats:
 * - Brute force detection
 * - Device trust checks
 * - VPN/proxy fraud detection
 * - Duplicate device monitoring
 */

import { prisma } from '../../db';

interface LoginAttempt {
  userId?: string;
  email: string;
  ipAddress: string;
  deviceId: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  country?: string;
  isVPN?: boolean;
  isProxy?: boolean;
}

interface DeviceTrust {
  deviceId: string;
  userId: string;
  trustScore: number;
  lastSeen: Date;
  loginCount: number;
  isTrusted: boolean;
}

interface LoginSecurityConfig {
  bruteForce: {
    enabled: boolean;
    maxAttempts: number;
    windowMinutes: number;
    lockoutMinutes: number;
    escalatingLockout: boolean;
  };
  deviceTrust: {
    enabled: boolean;
    minTrustScore: number;
    requireVerificationForNew: boolean;
    maxDevicesPerUser: number;
  };
  vpnProxy: {
    enabled: boolean;
    blockVPN: boolean;
    blockProxy: boolean;
    allowedCountries: string[];
    blockTor: boolean;
  };
  duplicateDevice: {
    enabled: boolean;
    maxUsersPerDevice: number;
    alertOnDuplicate: boolean;
  };
}

class LoginSecurityAutomation {
  private config: LoginSecurityConfig;
  private loginAttempts: Map<string, LoginAttempt[]> = new Map();
  private deviceUsers: Map<string, Set<string>> = new Map();
  private userDevices: Map<string, DeviceTrust[]> = new Map();
  private lockedAccounts: Map<string, { until: Date; attempts: number }> = new Map();
  private isRunning: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private knownVPNRanges: string[] = [
    '104.238.', '198.54.', '209.127.', '45.33.', '66.70.',
  ];

  private knownProxyPatterns: string[] = [
    'proxy', 'vpn', 'tor', 'anonymizer',
  ];

  constructor() {
    this.config = {
      bruteForce: {
        enabled: true,
        maxAttempts: 5,
        windowMinutes: 15,
        lockoutMinutes: 30,
        escalatingLockout: true,
      },
      deviceTrust: {
        enabled: true,
        minTrustScore: 0.5,
        requireVerificationForNew: true,
        maxDevicesPerUser: 5,
      },
      vpnProxy: {
        enabled: true,
        blockVPN: false,
        blockProxy: true,
        allowedCountries: [],
        blockTor: true,
      },
      duplicateDevice: {
        enabled: true,
        maxUsersPerDevice: 2,
        alertOnDuplicate: true,
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 300000);

    await this.logAutomation('LOGIN_SECURITY', 'SYSTEM', 'started', { config: this.config });
    console.log('[LoginSecurity] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('[LoginSecurity] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: LoginSecurityConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<LoginSecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): LoginSecurityConfig {
    return this.config;
  }

  async checkBruteForce(attempt: LoginAttempt): Promise<{
    blocked: boolean;
    reason?: string;
    lockoutMinutes?: number;
  }> {
    if (!this.config.bruteForce.enabled) return { blocked: false };

    const key = attempt.email.toLowerCase();

    const lockout = this.lockedAccounts.get(key);
    if (lockout && lockout.until > new Date()) {
      const remainingMinutes = Math.ceil((lockout.until.getTime() - Date.now()) / 60000);
      
      await this.logAutomation('LOGIN_SECURITY', key, 'blocked_lockout', {
        remainingMinutes,
        ipAddress: attempt.ipAddress,
      });

      return {
        blocked: true,
        reason: 'Account temporarily locked due to too many failed attempts',
        lockoutMinutes: remainingMinutes,
      };
    }

    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, []);
    }

    const attempts = this.loginAttempts.get(key)!;
    const windowStart = new Date(Date.now() - this.config.bruteForce.windowMinutes * 60000);
    const recentAttempts = attempts.filter(a => a.timestamp > windowStart && !a.success);

    if (!attempt.success) {
      attempts.push(attempt);
    }

    if (recentAttempts.length >= this.config.bruteForce.maxAttempts) {
      let lockoutMinutes = this.config.bruteForce.lockoutMinutes;
      
      if (this.config.bruteForce.escalatingLockout) {
        const previousLockout = this.lockedAccounts.get(key);
        const escalationFactor = previousLockout ? Math.min(previousLockout.attempts + 1, 5) : 1;
        lockoutMinutes = lockoutMinutes * escalationFactor;
      }

      this.lockedAccounts.set(key, {
        until: new Date(Date.now() + lockoutMinutes * 60000),
        attempts: (this.lockedAccounts.get(key)?.attempts || 0) + 1,
      });

      await this.logAutomation('LOGIN_SECURITY', key, 'brute_force_lockout', {
        attempts: recentAttempts.length,
        lockoutMinutes,
        ipAddresses: Array.from(new Set(recentAttempts.map(a => a.ipAddress))),
      });

      return {
        blocked: true,
        reason: 'Too many failed login attempts',
        lockoutMinutes,
      };
    }

    return { blocked: false };
  }

  async checkDeviceTrust(userId: string, deviceId: string, userAgent: string): Promise<{
    trusted: boolean;
    requiresVerification: boolean;
    trustScore: number;
    reason?: string;
  }> {
    if (!this.config.deviceTrust.enabled) {
      return { trusted: true, requiresVerification: false, trustScore: 1 };
    }

    if (!this.userDevices.has(userId)) {
      this.userDevices.set(userId, []);
    }

    const devices = this.userDevices.get(userId)!;
    let device = devices.find(d => d.deviceId === deviceId);

    if (!device) {
      if (devices.length >= this.config.deviceTrust.maxDevicesPerUser) {
        await this.logAutomation('LOGIN_SECURITY', userId, 'max_devices_exceeded', {
          deviceId,
          currentDevices: devices.length,
          maxAllowed: this.config.deviceTrust.maxDevicesPerUser,
        });

        return {
          trusted: false,
          requiresVerification: true,
          trustScore: 0,
          reason: 'Maximum devices limit reached. Please remove an existing device.',
        };
      }

      device = {
        deviceId,
        userId,
        trustScore: 0.3,
        lastSeen: new Date(),
        loginCount: 1,
        isTrusted: false,
      };
      devices.push(device);

      await this.logAutomation('LOGIN_SECURITY', userId, 'new_device_detected', {
        deviceId,
        userAgent,
      });

      return {
        trusted: false,
        requiresVerification: this.config.deviceTrust.requireVerificationForNew,
        trustScore: device.trustScore,
        reason: 'New device detected. Verification required.',
      };
    }

    device.lastSeen = new Date();
    device.loginCount++;
    device.trustScore = Math.min(1, device.trustScore + 0.1);

    if (device.trustScore >= this.config.deviceTrust.minTrustScore) {
      device.isTrusted = true;
    }

    return {
      trusted: device.isTrusted,
      requiresVerification: !device.isTrusted,
      trustScore: device.trustScore,
    };
  }

  async checkVPNProxy(ipAddress: string, userAgent: string): Promise<{
    blocked: boolean;
    isVPN: boolean;
    isProxy: boolean;
    isTor: boolean;
    reason?: string;
  }> {
    if (!this.config.vpnProxy.enabled) {
      return { blocked: false, isVPN: false, isProxy: false, isTor: false };
    }

    const isVPN = this.detectVPN(ipAddress);
    const isProxy = this.detectProxy(userAgent);
    const isTor = this.detectTor(userAgent, ipAddress);

    let blocked = false;
    let reason: string | undefined;

    if (isVPN && this.config.vpnProxy.blockVPN) {
      blocked = true;
      reason = 'VPN detected. Please disable VPN to continue.';
    }

    if (isProxy && this.config.vpnProxy.blockProxy) {
      blocked = true;
      reason = 'Proxy detected. Please connect directly.';
    }

    if (isTor && this.config.vpnProxy.blockTor) {
      blocked = true;
      reason = 'Tor network detected. Please use a regular connection.';
    }

    if (blocked) {
      await this.logAutomation('LOGIN_SECURITY', ipAddress, 'vpn_proxy_blocked', {
        isVPN,
        isProxy,
        isTor,
        userAgent,
      });
    }

    return { blocked, isVPN, isProxy, isTor, reason };
  }

  async checkDuplicateDevice(userId: string, deviceId: string): Promise<{
    duplicate: boolean;
    otherUsers: string[];
    alert: boolean;
  }> {
    if (!this.config.duplicateDevice.enabled) {
      return { duplicate: false, otherUsers: [], alert: false };
    }

    if (!this.deviceUsers.has(deviceId)) {
      this.deviceUsers.set(deviceId, new Set());
    }

    const users = this.deviceUsers.get(deviceId)!;
    users.add(userId);

    const otherUsers = Array.from(users).filter(u => u !== userId);
    const duplicate = users.size > 1;

    if (duplicate && this.config.duplicateDevice.alertOnDuplicate) {
      await this.logAutomation('LOGIN_SECURITY', deviceId, 'duplicate_device', {
        userId,
        allUsers: Array.from(users),
        exceedsLimit: users.size > this.config.duplicateDevice.maxUsersPerDevice,
      });
    }

    return {
      duplicate,
      otherUsers,
      alert: users.size > this.config.duplicateDevice.maxUsersPerDevice,
    };
  }

  async processLogin(attempt: LoginAttempt): Promise<{
    allowed: boolean;
    requiresVerification: boolean;
    reasons: string[];
    actions: string[];
  }> {
    const results = {
      allowed: true,
      requiresVerification: false,
      reasons: [] as string[],
      actions: [] as string[],
    };

    const bruteForceCheck = await this.checkBruteForce(attempt);
    if (bruteForceCheck.blocked) {
      results.allowed = false;
      results.reasons.push(bruteForceCheck.reason!);
      results.actions.push('account_locked');
    }

    const vpnCheck = await this.checkVPNProxy(attempt.ipAddress, attempt.userAgent);
    if (vpnCheck.blocked) {
      results.allowed = false;
      results.reasons.push(vpnCheck.reason!);
      results.actions.push('vpn_proxy_blocked');
    }

    if (attempt.userId) {
      const deviceTrustCheck = await this.checkDeviceTrust(
        attempt.userId,
        attempt.deviceId,
        attempt.userAgent
      );
      if (!deviceTrustCheck.trusted) {
        results.requiresVerification = deviceTrustCheck.requiresVerification;
        if (deviceTrustCheck.reason) {
          results.reasons.push(deviceTrustCheck.reason);
        }
        results.actions.push('verification_required');
      }

      const duplicateCheck = await this.checkDuplicateDevice(attempt.userId, attempt.deviceId);
      if (duplicateCheck.alert) {
        results.reasons.push('Device used by multiple accounts');
        results.actions.push('duplicate_device_alert');
      }
    }

    await this.logAutomation('LOGIN_SECURITY', attempt.email, 'login_processed', {
      allowed: results.allowed,
      requiresVerification: results.requiresVerification,
      attempt: {
        ipAddress: attempt.ipAddress,
        deviceId: attempt.deviceId,
        success: attempt.success,
      },
      checks: {
        bruteForce: !bruteForceCheck.blocked,
        vpnProxy: !vpnCheck.blocked,
      },
    });

    return results;
  }

  async unlockAccount(email: string, adminId: string): Promise<void> {
    const key = email.toLowerCase();
    this.lockedAccounts.delete(key);
    this.loginAttempts.delete(key);

    await this.logAutomation('LOGIN_SECURITY', key, 'admin_unlock', {
      adminId,
      unlockedAt: new Date().toISOString(),
    });
  }

  async trustDevice(userId: string, deviceId: string, adminId: string): Promise<void> {
    const devices = this.userDevices.get(userId);
    if (devices) {
      const device = devices.find(d => d.deviceId === deviceId);
      if (device) {
        device.isTrusted = true;
        device.trustScore = 1;
      }
    }

    await this.logAutomation('LOGIN_SECURITY', userId, 'device_trusted', {
      deviceId,
      adminId,
      trustedAt: new Date().toISOString(),
    });
  }

  async getSecurityStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'LOGIN_SECURITY',
        createdAt: { gte: startDate },
      },
    });

    return {
      totalEvents: logs.length,
      bruteForceAttempts: logs.filter(l => l.status === 'brute_force_lockout').length,
      vpnBlocked: logs.filter(l => l.status === 'vpn_proxy_blocked').length,
      newDevices: logs.filter(l => l.status === 'new_device_detected').length,
      duplicateDevices: logs.filter(l => l.status === 'duplicate_device').length,
      currentLockouts: this.lockedAccounts.size,
    };
  }

  async getLockedAccounts(): Promise<Array<{ email: string; until: Date; attempts: number }>> {
    const now = new Date();
    const locked: Array<{ email: string; until: Date; attempts: number }> = [];

    this.lockedAccounts.forEach((lockout, email) => {
      if (lockout.until > now) {
        locked.push({ email, until: lockout.until, attempts: lockout.attempts });
      }
    });

    return locked;
  }

  private detectVPN(ipAddress: string): boolean {
    return this.knownVPNRanges.some(range => ipAddress.startsWith(range));
  }

  private detectProxy(userAgent: string): boolean {
    const lowerUA = userAgent.toLowerCase();
    return this.knownProxyPatterns.some(pattern => lowerUA.includes(pattern));
  }

  private detectTor(userAgent: string, ipAddress: string): boolean {
    const lowerUA = userAgent.toLowerCase();
    return lowerUA.includes('tor') || ipAddress.includes('.onion');
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    this.loginAttempts.forEach((attempts, key) => {
      const filtered = attempts.filter(a => a.timestamp > cutoff);
      if (filtered.length === 0) {
        this.loginAttempts.delete(key);
      } else {
        this.loginAttempts.set(key, filtered);
      }
    });

    const now = new Date();
    this.lockedAccounts.forEach((lockout, key) => {
      if (lockout.until < now) {
        this.lockedAccounts.delete(key);
      }
    });
  }

  private async logAutomation(
    automationType: string,
    entityId: string,
    status: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType,
          entityType: 'login',
          entityId,
          status,
          details,
        },
      });
    } catch (error) {
      console.error('[LoginSecurity] Log error:', error);
    }
  }
}

export const loginSecurityAutomation = new LoginSecurityAutomation();
