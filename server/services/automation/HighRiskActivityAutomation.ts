/**
 * SafeGo High-Risk Activity Auto Freeze Automation
 * Triggers account freeze when detecting:
 * - Document mismatch
 * - Multi-account sharing
 * - Suspicious payouts
 * - Payment anomalies
 * All require admin review
 */

import { prisma } from '../../db';

type RiskType = 
  | 'DOCUMENT_MISMATCH'
  | 'MULTI_ACCOUNT_SHARING'
  | 'SUSPICIOUS_PAYOUT'
  | 'PAYMENT_ANOMALY'
  | 'IDENTITY_FRAUD'
  | 'ACCOUNT_TAKEOVER'
  | 'MONEY_LAUNDERING'
  | 'CHARGEBACK_PATTERN';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskAlert {
  id: string;
  userId: string;
  riskType: RiskType;
  riskLevel: RiskLevel;
  riskScore: number;
  details: Record<string, any>;
  frozen: boolean;
  requiresReview: boolean;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: string;
}

interface HighRiskConfig {
  documentMismatch: {
    enabled: boolean;
    autoFreeze: boolean;
    mismatchThreshold: number;
  };
  multiAccountSharing: {
    enabled: boolean;
    autoFreeze: boolean;
    maxSharedDevices: number;
    maxSharedPaymentMethods: number;
  };
  suspiciousPayout: {
    enabled: boolean;
    autoFreeze: boolean;
    unusualAmountMultiplier: number;
    rapidPayoutThreshold: number;
    newAccountPayoutDays: number;
  };
  paymentAnomaly: {
    enabled: boolean;
    autoFreeze: boolean;
    chargebackThreshold: number;
    failedPaymentThreshold: number;
    velocityCheckWindow: number;
  };
  riskScoring: {
    freezeThreshold: number;
    reviewThreshold: number;
    weights: {
      documentMismatch: number;
      multiAccount: number;
      suspiciousPayout: number;
      paymentAnomaly: number;
    };
  };
}

class HighRiskActivityAutomation {
  private config: HighRiskConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private userRiskScores: Map<string, number> = new Map();
  private deviceToUsers: Map<string, Set<string>> = new Map();
  private paymentMethodToUsers: Map<string, Set<string>> = new Map();

  constructor() {
    this.config = {
      documentMismatch: {
        enabled: true,
        autoFreeze: true,
        mismatchThreshold: 0.3,
      },
      multiAccountSharing: {
        enabled: true,
        autoFreeze: true,
        maxSharedDevices: 2,
        maxSharedPaymentMethods: 1,
      },
      suspiciousPayout: {
        enabled: true,
        autoFreeze: true,
        unusualAmountMultiplier: 5,
        rapidPayoutThreshold: 3,
        newAccountPayoutDays: 7,
      },
      paymentAnomaly: {
        enabled: true,
        autoFreeze: true,
        chargebackThreshold: 2,
        failedPaymentThreshold: 5,
        velocityCheckWindow: 24,
      },
      riskScoring: {
        freezeThreshold: 80,
        reviewThreshold: 50,
        weights: {
          documentMismatch: 40,
          multiAccount: 30,
          suspiciousPayout: 35,
          paymentAnomaly: 25,
        },
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(async () => {
      await this.runRiskScan();
    }, 15 * 60 * 1000);

    await this.logAutomation('HIGH_RISK', 'SYSTEM', 'started', { config: this.config });
    console.log('[HighRisk] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[HighRisk] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: HighRiskConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<HighRiskConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): HighRiskConfig {
    return this.config;
  }

  async checkDocumentMismatch(
    userId: string,
    documentData: {
      documentName: string;
      profileName: string;
      documentPhoto?: string;
      selfiePhoto?: string;
      facialMatchScore?: number;
    }
  ): Promise<RiskAlert | null> {
    if (!this.config.documentMismatch.enabled) return null;

    const issues: string[] = [];
    let riskScore = 0;

    const nameSimilarity = this.calculateNameSimilarity(
      documentData.documentName,
      documentData.profileName
    );

    if (nameSimilarity < (1 - this.config.documentMismatch.mismatchThreshold)) {
      issues.push(`Name mismatch: Document "${documentData.documentName}" vs Profile "${documentData.profileName}"`);
      riskScore += 50;
    }

    if (documentData.facialMatchScore !== undefined) {
      if (documentData.facialMatchScore < 0.8) {
        issues.push(`Facial match score below threshold: ${(documentData.facialMatchScore * 100).toFixed(1)}%`);
        riskScore += 40;
      }
    }

    if (issues.length > 0) {
      const riskLevel = this.calculateRiskLevel(riskScore);

      return await this.createRiskAlert(
        userId,
        'DOCUMENT_MISMATCH',
        riskLevel,
        riskScore,
        {
          issues,
          documentName: documentData.documentName,
          profileName: documentData.profileName,
          facialMatchScore: documentData.facialMatchScore,
        },
        this.config.documentMismatch.autoFreeze && riskLevel === 'critical'
      );
    }

    return null;
  }

  async checkMultiAccountSharing(
    userId: string,
    deviceId: string,
    paymentMethodFingerprint?: string
  ): Promise<RiskAlert | null> {
    if (!this.config.multiAccountSharing.enabled) return null;

    const issues: string[] = [];
    let riskScore = 0;

    if (!this.deviceToUsers.has(deviceId)) {
      this.deviceToUsers.set(deviceId, new Set());
    }
    const deviceUsers = this.deviceToUsers.get(deviceId)!;
    deviceUsers.add(userId);

    if (deviceUsers.size > this.config.multiAccountSharing.maxSharedDevices) {
      issues.push(`Device shared by ${deviceUsers.size} accounts (max: ${this.config.multiAccountSharing.maxSharedDevices})`);
      riskScore += 35;
    }

    if (paymentMethodFingerprint) {
      if (!this.paymentMethodToUsers.has(paymentMethodFingerprint)) {
        this.paymentMethodToUsers.set(paymentMethodFingerprint, new Set());
      }
      const paymentUsers = this.paymentMethodToUsers.get(paymentMethodFingerprint)!;
      paymentUsers.add(userId);

      if (paymentUsers.size > this.config.multiAccountSharing.maxSharedPaymentMethods) {
        issues.push(`Payment method shared by ${paymentUsers.size} accounts`);
        riskScore += 50;
      }
    }

    if (issues.length > 0) {
      const riskLevel = this.calculateRiskLevel(riskScore);

      return await this.createRiskAlert(
        userId,
        'MULTI_ACCOUNT_SHARING',
        riskLevel,
        riskScore,
        {
          issues,
          deviceId,
          sharedWithUsers: Array.from(deviceUsers).filter(u => u !== userId),
        },
        this.config.multiAccountSharing.autoFreeze && riskLevel === 'critical'
      );
    }

    return null;
  }

  async checkSuspiciousPayout(
    userId: string,
    payoutData: {
      amount: number;
      averageAmount: number;
      payoutsLast24h: number;
      accountAgeDays: number;
      destinationNew: boolean;
    }
  ): Promise<RiskAlert | null> {
    if (!this.config.suspiciousPayout.enabled) return null;

    const issues: string[] = [];
    let riskScore = 0;

    if (payoutData.amount > payoutData.averageAmount * this.config.suspiciousPayout.unusualAmountMultiplier) {
      issues.push(`Payout amount ${payoutData.amount} is ${(payoutData.amount / payoutData.averageAmount).toFixed(1)}x average`);
      riskScore += 30;
    }

    if (payoutData.payoutsLast24h >= this.config.suspiciousPayout.rapidPayoutThreshold) {
      issues.push(`${payoutData.payoutsLast24h} payout requests in 24h`);
      riskScore += 25;
    }

    if (payoutData.accountAgeDays < this.config.suspiciousPayout.newAccountPayoutDays) {
      issues.push(`Account only ${payoutData.accountAgeDays} days old`);
      riskScore += 20;
    }

    if (payoutData.destinationNew) {
      issues.push('Payout to newly added destination');
      riskScore += 15;
    }

    if (issues.length >= 2 || riskScore >= 50) {
      const riskLevel = this.calculateRiskLevel(riskScore);

      return await this.createRiskAlert(
        userId,
        'SUSPICIOUS_PAYOUT',
        riskLevel,
        riskScore,
        {
          issues,
          payoutAmount: payoutData.amount,
          averageAmount: payoutData.averageAmount,
          payoutsLast24h: payoutData.payoutsLast24h,
          accountAgeDays: payoutData.accountAgeDays,
        },
        this.config.suspiciousPayout.autoFreeze && riskLevel === 'critical'
      );
    }

    return null;
  }

  async checkPaymentAnomaly(
    userId: string,
    paymentData: {
      chargebackCount: number;
      failedPaymentsLast24h: number;
      declinedCardsUsed: number;
      unusualTimestamp: boolean;
      foreignCard: boolean;
    }
  ): Promise<RiskAlert | null> {
    if (!this.config.paymentAnomaly.enabled) return null;

    const issues: string[] = [];
    let riskScore = 0;

    if (paymentData.chargebackCount >= this.config.paymentAnomaly.chargebackThreshold) {
      issues.push(`${paymentData.chargebackCount} chargebacks on record`);
      riskScore += 40;
    }

    if (paymentData.failedPaymentsLast24h >= this.config.paymentAnomaly.failedPaymentThreshold) {
      issues.push(`${paymentData.failedPaymentsLast24h} failed payments in 24h`);
      riskScore += 30;
    }

    if (paymentData.declinedCardsUsed > 2) {
      issues.push(`${paymentData.declinedCardsUsed} different declined cards used`);
      riskScore += 25;
    }

    if (paymentData.unusualTimestamp) {
      issues.push('Payment at unusual time');
      riskScore += 10;
    }

    if (issues.length > 0) {
      const riskLevel = this.calculateRiskLevel(riskScore);

      return await this.createRiskAlert(
        userId,
        'PAYMENT_ANOMALY',
        riskLevel,
        riskScore,
        {
          issues,
          chargebackCount: paymentData.chargebackCount,
          failedPaymentsLast24h: paymentData.failedPaymentsLast24h,
          declinedCardsUsed: paymentData.declinedCardsUsed,
        },
        this.config.paymentAnomaly.autoFreeze && riskLevel === 'critical'
      );
    }

    return null;
  }

  async runRiskScan(): Promise<{
    scanned: number;
    alertsGenerated: number;
    accountsFrozen: number;
  }> {
    const results = {
      scanned: 0,
      alertsGenerated: 0,
      accountsFrozen: 0,
    };

    try {
      await this.logAutomation('HIGH_RISK', 'SYSTEM', 'scan_completed', results);
    } catch (error) {
      console.error('[HighRisk] Scan error:', error);
    }

    return results;
  }

  async getActiveAlerts(limit: number = 50): Promise<any[]> {
    return await prisma.automationLog.findMany({
      where: {
        automationType: 'HIGH_RISK',
        status: { in: ['alert', 'frozen', 'pending_review'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async reviewAlert(
    alertId: string,
    adminId: string,
    decision: 'approve' | 'dismiss' | 'escalate',
    notes: string
  ): Promise<void> {
    const log = await prisma.automationLog.findUnique({
      where: { id: alertId },
    });

    if (!log) throw new Error('Alert not found');

    const details = log.details as Record<string, any>;
    const userId = log.entityId;

    let newStatus = 'reviewed';
    if (decision === 'approve' && details?.frozen) {
      newStatus = 'frozen_confirmed';
    } else if (decision === 'dismiss') {
      newStatus = 'dismissed';
      if (details?.frozen) {
        await this.unfreezeAccount(userId);
      }
    } else if (decision === 'escalate') {
      newStatus = 'escalated';
    }

    await prisma.automationLog.update({
      where: { id: alertId },
      data: {
        status: newStatus,
        details: {
          ...details,
          reviewedBy: adminId,
          reviewedAt: new Date().toISOString(),
          decision,
          notes,
        },
      },
    });

    await this.logAutomation('HIGH_RISK', alertId, 'reviewed', {
      adminId,
      decision,
      notes,
      previousStatus: log.status,
    });
  }

  async unfreezeAccount(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isAccountLocked: false,
          accountLockedAt: null,
        },
      });

      await this.logAutomation('HIGH_RISK', userId, 'unfrozen', {
        unfrozenAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[HighRisk] Unfreeze error:', error);
    }
  }

  async getStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'HIGH_RISK',
        createdAt: { gte: startDate },
      },
    });

    const stats: Record<string, any> = {
      totalAlerts: logs.length,
      byType: {},
      byLevel: { low: 0, medium: 0, high: 0, critical: 0 },
      frozen: 0,
      reviewed: 0,
      dismissed: 0,
      escalated: 0,
    };

    logs.forEach(log => {
      const details = log.details as Record<string, any>;
      const riskType = details?.riskType || 'unknown';
      const riskLevel = details?.riskLevel || 'medium';

      stats.byType[riskType] = (stats.byType[riskType] || 0) + 1;
      stats.byLevel[riskLevel]++;

      if (details?.frozen) stats.frozen++;
      if (log.status === 'reviewed' || log.status === 'frozen_confirmed') stats.reviewed++;
      if (log.status === 'dismissed') stats.dismissed++;
      if (log.status === 'escalated') stats.escalated++;
    });

    return stats;
  }

  getUserRiskScore(userId: string): number {
    return this.userRiskScores.get(userId) || 0;
  }

  private async createRiskAlert(
    userId: string,
    riskType: RiskType,
    riskLevel: RiskLevel,
    riskScore: number,
    details: Record<string, any>,
    shouldFreeze: boolean
  ): Promise<RiskAlert> {
    const alert: RiskAlert = {
      id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      riskType,
      riskLevel,
      riskScore,
      details,
      frozen: shouldFreeze,
      requiresReview: true,
      createdAt: new Date(),
    };

    this.updateUserRiskScore(userId, riskScore);

    if (shouldFreeze) {
      await this.freezeAccount(userId, riskType, details);
    }

    await this.logAutomation('HIGH_RISK', userId, shouldFreeze ? 'frozen' : 'alert', {
      alertId: alert.id,
      riskType,
      riskLevel,
      riskScore,
      details,
      frozen: shouldFreeze,
    });

    console.log(`[HighRisk] Alert: ${riskType} for user ${userId} (${riskLevel}, score: ${riskScore})`);

    return alert;
  }

  private async freezeAccount(userId: string, reason: RiskType, details: Record<string, any>): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isAccountLocked: true,
          accountLockedAt: new Date(),
        },
      });

      console.log(`[HighRisk] Account frozen: ${userId} (${reason})`);
    } catch (error) {
      console.error('[HighRisk] Freeze error:', error);
    }
  }

  private updateUserRiskScore(userId: string, additionalScore: number): void {
    const currentScore = this.userRiskScores.get(userId) || 0;
    const newScore = Math.min(100, currentScore + additionalScore);
    this.userRiskScores.set(userId, newScore);
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    let matchCount = 0;
    const shorterWords = shorter.split(/\s+/);
    const longerWords = longer.split(/\s+/);

    for (const word of shorterWords) {
      if (longerWords.some(w => w === word || w.includes(word) || word.includes(w))) {
        matchCount++;
      }
    }

    return matchCount / Math.max(shorterWords.length, longerWords.length);
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
          entityType: 'risk',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[HighRisk] Log error:', error);
    }
  }
}

export const highRiskActivityAutomation = new HighRiskActivityAutomation();
