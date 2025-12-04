/**
 * SafeGo Fraud Detection Automation Service
 * Detects and handles various types of fraud:
 * - GPS spoofing detection
 * - Fake document detection
 * - Multi-account same device detection
 * - Suspicious payment patterns
 * - Location teleport detection
 * Auto freezes accounts and alerts admins
 */

import { prisma } from '../../db';

interface FraudAlert {
  id: string;
  userId: string;
  fraudType: FraudType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  actionTaken: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

type FraudType = 
  | 'GPS_SPOOFING'
  | 'FAKE_DOCUMENT'
  | 'MULTI_ACCOUNT_SAME_DEVICE'
  | 'SUSPICIOUS_PAYMENT'
  | 'LOCATION_TELEPORT'
  | 'VELOCITY_ANOMALY'
  | 'DEVICE_FINGERPRINT_MISMATCH';

interface GPSCheck {
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy: number;
  mockLocationDetected?: boolean;
}

interface DocumentCheck {
  userId: string;
  documentType: string;
  documentId: string;
  ocrConfidence: number;
  facialMatchScore?: number;
  expiryValid: boolean;
  formatValid: boolean;
}

interface PaymentCheck {
  userId: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  cardFingerprint?: string;
  ipAddress: string;
  deviceId: string;
  timestamp: Date;
}

interface FraudDetectionConfig {
  gpsSpoof: {
    enabled: boolean;
    mockLocationThreshold: number;
    accuracyThreshold: number;
  };
  locationTeleport: {
    enabled: boolean;
    maxSpeedKmh: number;
    minTimeBetweenChecks: number;
  };
  multiAccount: {
    enabled: boolean;
    maxAccountsPerDevice: number;
    deviceFingerprintWeight: number;
  };
  suspiciousPayment: {
    enabled: boolean;
    maxDailyTransactions: number;
    maxDailyAmount: number;
    unusualHoursStart: number;
    unusualHoursEnd: number;
  };
  document: {
    enabled: boolean;
    minOcrConfidence: number;
    minFacialMatchScore: number;
  };
  autoFreeze: {
    enabled: boolean;
    freezeOnCritical: boolean;
    freezeOnHigh: boolean;
  };
}

class FraudDetectionAutomation {
  private config: FraudDetectionConfig;
  private recentLocations: Map<string, GPSCheck[]> = new Map();
  private deviceToUsers: Map<string, Set<string>> = new Map();
  private userTransactions: Map<string, PaymentCheck[]> = new Map();
  private isRunning: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      gpsSpoof: {
        enabled: true,
        mockLocationThreshold: 0.8,
        accuracyThreshold: 10,
      },
      locationTeleport: {
        enabled: true,
        maxSpeedKmh: 200,
        minTimeBetweenChecks: 30000,
      },
      multiAccount: {
        enabled: true,
        maxAccountsPerDevice: 2,
        deviceFingerprintWeight: 0.7,
      },
      suspiciousPayment: {
        enabled: true,
        maxDailyTransactions: 20,
        maxDailyAmount: 50000,
        unusualHoursStart: 2,
        unusualHoursEnd: 5,
      },
      document: {
        enabled: true,
        minOcrConfidence: 0.85,
        minFacialMatchScore: 0.9,
      },
      autoFreeze: {
        enabled: true,
        freezeOnCritical: true,
        freezeOnHigh: true,
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 3600000);

    await this.logAutomation('FRAUD_DETECTION', 'SYSTEM', 'started', { config: this.config });
    console.log('[FraudDetection] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('[FraudDetection] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: FraudDetectionConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<FraudDetectionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): FraudDetectionConfig {
    return this.config;
  }

  async checkGPSSpoofing(check: GPSCheck): Promise<FraudAlert | null> {
    if (!this.config.gpsSpoof.enabled) return null;

    const alerts: FraudAlert[] = [];

    if (check.mockLocationDetected) {
      const alert = await this.createFraudAlert(
        check.userId,
        'GPS_SPOOFING',
        'critical',
        { reason: 'Mock location detected', ...check },
        'Account frozen pending review'
      );
      alerts.push(alert);
    }

    if (check.accuracy > this.config.gpsSpoof.accuracyThreshold * 100) {
      const alert = await this.createFraudAlert(
        check.userId,
        'GPS_SPOOFING',
        'medium',
        { reason: 'Low GPS accuracy suggests spoofing', accuracy: check.accuracy },
        'Flagged for monitoring'
      );
      alerts.push(alert);
    }

    this.storeLocation(check);

    return alerts.length > 0 ? alerts[0] : null;
  }

  async checkLocationTeleport(check: GPSCheck): Promise<FraudAlert | null> {
    if (!this.config.locationTeleport.enabled) return null;

    const userLocations = this.recentLocations.get(check.userId) || [];
    if (userLocations.length === 0) {
      this.storeLocation(check);
      return null;
    }

    const lastLocation = userLocations[userLocations.length - 1];
    const timeDiff = check.timestamp.getTime() - lastLocation.timestamp.getTime();

    if (timeDiff < this.config.locationTeleport.minTimeBetweenChecks) {
      return null;
    }

    const distance = this.calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      check.latitude,
      check.longitude
    );

    const timeHours = timeDiff / 3600000;
    const speedKmh = distance / timeHours;

    if (speedKmh > this.config.locationTeleport.maxSpeedKmh) {
      this.storeLocation(check);
      return await this.createFraudAlert(
        check.userId,
        'LOCATION_TELEPORT',
        'high',
        {
          reason: 'Impossible travel speed detected',
          distance: Math.round(distance * 100) / 100,
          timeMinutes: Math.round(timeDiff / 60000),
          calculatedSpeed: Math.round(speedKmh),
          maxAllowedSpeed: this.config.locationTeleport.maxSpeedKmh,
          from: { lat: lastLocation.latitude, lng: lastLocation.longitude },
          to: { lat: check.latitude, lng: check.longitude },
        },
        'Account flagged for location fraud'
      );
    }

    this.storeLocation(check);
    return null;
  }

  async checkMultiAccountDevice(userId: string, deviceId: string, deviceFingerprint?: string): Promise<FraudAlert | null> {
    if (!this.config.multiAccount.enabled) return null;

    const effectiveDeviceId = deviceFingerprint || deviceId;
    
    if (!this.deviceToUsers.has(effectiveDeviceId)) {
      this.deviceToUsers.set(effectiveDeviceId, new Set());
    }

    const usersOnDevice = this.deviceToUsers.get(effectiveDeviceId)!;
    usersOnDevice.add(userId);

    if (usersOnDevice.size > this.config.multiAccount.maxAccountsPerDevice) {
      return await this.createFraudAlert(
        userId,
        'MULTI_ACCOUNT_SAME_DEVICE',
        'high',
        {
          reason: 'Multiple accounts detected on same device',
          deviceId: effectiveDeviceId,
          accountCount: usersOnDevice.size,
          maxAllowed: this.config.multiAccount.maxAccountsPerDevice,
          affectedUsers: Array.from(usersOnDevice),
        },
        'All accounts on device flagged for review'
      );
    }

    return null;
  }

  async checkSuspiciousPayment(check: PaymentCheck): Promise<FraudAlert | null> {
    if (!this.config.suspiciousPayment.enabled) return null;

    const alerts: FraudAlert[] = [];
    const today = new Date().toISOString().split('T')[0];

    if (!this.userTransactions.has(check.userId)) {
      this.userTransactions.set(check.userId, []);
    }

    const userTx = this.userTransactions.get(check.userId)!;
    const todaysTx = userTx.filter(tx => 
      tx.timestamp && new Date(tx.timestamp).toISOString().split('T')[0] === today
    );

    if (todaysTx.length >= this.config.suspiciousPayment.maxDailyTransactions) {
      const alert = await this.createFraudAlert(
        check.userId,
        'SUSPICIOUS_PAYMENT',
        'high',
        {
          reason: 'Exceeded daily transaction limit',
          transactionCount: todaysTx.length + 1,
          limit: this.config.suspiciousPayment.maxDailyTransactions,
        },
        'Transaction blocked, account flagged'
      );
      alerts.push(alert);
    }

    const todaysTotal = todaysTx.reduce((sum, tx) => sum + tx.amount, 0) + check.amount;
    if (todaysTotal > this.config.suspiciousPayment.maxDailyAmount) {
      const alert = await this.createFraudAlert(
        check.userId,
        'SUSPICIOUS_PAYMENT',
        'high',
        {
          reason: 'Exceeded daily amount limit',
          totalAmount: todaysTotal,
          limit: this.config.suspiciousPayment.maxDailyAmount,
        },
        'Transaction blocked, account flagged'
      );
      alerts.push(alert);
    }

    const hour = new Date().getHours();
    if (hour >= this.config.suspiciousPayment.unusualHoursStart && 
        hour <= this.config.suspiciousPayment.unusualHoursEnd) {
      const alert = await this.createFraudAlert(
        check.userId,
        'SUSPICIOUS_PAYMENT',
        'medium',
        {
          reason: 'Transaction during unusual hours',
          hour,
          amount: check.amount,
        },
        'Flagged for review'
      );
      alerts.push(alert);
    }

    userTx.push({ ...check, timestamp: new Date() as any });

    return alerts.length > 0 ? alerts[0] : null;
  }

  async checkDocument(check: DocumentCheck): Promise<FraudAlert | null> {
    if (!this.config.document.enabled) return null;

    const issues: string[] = [];

    if (check.ocrConfidence < this.config.document.minOcrConfidence) {
      issues.push(`Low OCR confidence: ${(check.ocrConfidence * 100).toFixed(1)}%`);
    }

    if (check.facialMatchScore !== undefined && 
        check.facialMatchScore < this.config.document.minFacialMatchScore) {
      issues.push(`Low facial match score: ${(check.facialMatchScore * 100).toFixed(1)}%`);
    }

    if (!check.expiryValid) {
      issues.push('Document expired or invalid expiry date');
    }

    if (!check.formatValid) {
      issues.push('Document format invalid or tampered');
    }

    if (issues.length > 0) {
      const severity = issues.length >= 3 ? 'critical' : issues.length >= 2 ? 'high' : 'medium';
      return await this.createFraudAlert(
        check.userId,
        'FAKE_DOCUMENT',
        severity,
        {
          reason: 'Document verification failed',
          issues,
          documentType: check.documentType,
          documentId: check.documentId,
          ocrConfidence: check.ocrConfidence,
          facialMatchScore: check.facialMatchScore,
        },
        severity === 'critical' ? 'Account frozen pending document review' : 'Document flagged for manual review'
      );
    }

    return null;
  }

  async runComprehensiveCheck(userId: string): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          driverProfile: true,
          ticketRentalProfile: true,
        },
      });

      if (!user) return alerts;

      const logs = await prisma.automationLog.findMany({
        where: {
          entityId: userId,
          automationType: 'FRAUD_DETECTION',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const recentAlerts = logs.filter(log => log.status === 'alert');
      if (recentAlerts.length >= 5) {
        const alert = await this.createFraudAlert(
          userId,
          'VELOCITY_ANOMALY',
          'critical',
          {
            reason: 'Multiple fraud alerts in 24 hours',
            alertCount: recentAlerts.length,
            alerts: recentAlerts.map(a => ({ type: a.details, time: a.createdAt })),
          },
          'Account frozen for comprehensive review'
        );
        alerts.push(alert);
      }

    } catch (error) {
      console.error('[FraudDetection] Comprehensive check error:', error);
    }

    return alerts;
  }

  async getActiveAlerts(limit: number = 50): Promise<any[]> {
    return await prisma.automationLog.findMany({
      where: {
        automationType: 'FRAUD_DETECTION',
        status: 'alert',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async resolveAlert(alertId: string, adminId: string, resolution: string): Promise<void> {
    await prisma.automationLog.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        details: {
          resolution,
          resolvedBy: adminId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });

    await this.logAutomation('FRAUD_DETECTION', alertId, 'resolved', {
      adminId,
      resolution,
    });
  }

  async getFraudStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'FRAUD_DETECTION',
        createdAt: { gte: startDate },
      },
    });

    const stats: Record<string, any> = {
      total: logs.length,
      byType: {},
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      resolved: 0,
      pending: 0,
      autoFrozen: 0,
    };

    logs.forEach(log => {
      const details = log.details as Record<string, any>;
      const fraudType = details?.fraudType || 'unknown';
      const severity = details?.severity || 'medium';

      stats.byType[fraudType] = (stats.byType[fraudType] || 0) + 1;
      stats.bySeverity[severity]++;

      if (log.status === 'resolved') stats.resolved++;
      else stats.pending++;

      if (details?.actionTaken?.includes('frozen')) stats.autoFrozen++;
    });

    return stats;
  }

  private async createFraudAlert(
    userId: string,
    fraudType: FraudType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    actionTaken: string
  ): Promise<FraudAlert> {
    const alert: FraudAlert = {
      id: `fraud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      fraudType,
      severity,
      details,
      actionTaken,
      createdAt: new Date(),
    };

    if (this.config.autoFreeze.enabled) {
      if ((severity === 'critical' && this.config.autoFreeze.freezeOnCritical) ||
          (severity === 'high' && this.config.autoFreeze.freezeOnHigh)) {
        await this.freezeAccount(userId, fraudType, details);
        alert.actionTaken = `Account frozen: ${actionTaken}`;
      }
    }

    await this.logAutomation('FRAUD_DETECTION', userId, 'alert', {
      alertId: alert.id,
      fraudType,
      severity,
      details,
      actionTaken: alert.actionTaken,
    });

    console.log(`[FraudDetection] Alert: ${fraudType} for user ${userId} (${severity})`);

    return alert;
  }

  private async freezeAccount(userId: string, reason: FraudType, details: Record<string, any>): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isAccountLocked: true,
          accountLockedAt: new Date(),
        },
      });

      await this.logAutomation('FRAUD_DETECTION', userId, 'account_frozen', {
        reason,
        details,
        frozenAt: new Date().toISOString(),
      });

      console.log(`[FraudDetection] Account frozen: ${userId} (${reason})`);
    } catch (error) {
      console.error('[FraudDetection] Failed to freeze account:', error);
    }
  }

  private storeLocation(check: GPSCheck): void {
    if (!this.recentLocations.has(check.userId)) {
      this.recentLocations.set(check.userId, []);
    }
    const locations = this.recentLocations.get(check.userId)!;
    locations.push(check);
    if (locations.length > 100) {
      locations.shift();
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    this.recentLocations.forEach((locations, userId) => {
      const filtered = locations.filter(l => l.timestamp.getTime() > cutoff);
      if (filtered.length === 0) {
        this.recentLocations.delete(userId);
      } else {
        this.recentLocations.set(userId, filtered);
      }
    });

    this.userTransactions.forEach((transactions, userId) => {
      const filtered = transactions.filter(t => 
        t.timestamp && new Date(t.timestamp as any).getTime() > cutoff
      );
      if (filtered.length === 0) {
        this.userTransactions.delete(userId);
      } else {
        this.userTransactions.set(userId, filtered);
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
          entityType: 'user',
          entityId,
          status,
          details,
        },
      });
    } catch (error) {
      console.error('[FraudDetection] Log error:', error);
    }
  }
}

export const fraudDetectionAutomation = new FraudDetectionAutomation();
