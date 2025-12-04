/**
 * SafeGo Customer Payment Scoring Automation Service
 * Scores customers based on payment behavior:
 * - Payment success rate
 * - Refund frequency
 * - Risk flags
 * High-risk customers get COD restricted
 */

import { prisma } from '../../db';

interface PaymentMetrics {
  totalTransactions: number;
  successfulPayments: number;
  failedPayments: number;
  refundCount: number;
  chargebackCount: number;
  successRate: number;
  refundRatio: number;
}

interface CustomerPaymentScoringConfig {
  enabled: boolean;
  scanIntervalMs: number;
  successRate: {
    enabled: boolean;
    minSuccessRate: number;
    criticalSuccessRate: number;
  };
  refunds: {
    enabled: boolean;
    maxRefundsPerMonth: number;
    highRefundRatioThreshold: number;
  };
  chargebacks: {
    enabled: boolean;
    maxChargebacksPerYear: number;
    chargebackPenaltyMultiplier: number;
  };
  codRestriction: {
    enabled: boolean;
    restrictOnHighRisk: boolean;
    restrictOnCriticalRisk: boolean;
    minTransactionsForRestriction: number;
  };
  thresholds: {
    lowRiskScore: number;
    mediumRiskScore: number;
    highRiskScore: number;
    criticalRiskScore: number;
  };
}

class CustomerPaymentScoringAutomation {
  private config: CustomerPaymentScoringConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 600000,
      successRate: {
        enabled: true,
        minSuccessRate: 0.85,
        criticalSuccessRate: 0.5,
      },
      refunds: {
        enabled: true,
        maxRefundsPerMonth: 3,
        highRefundRatioThreshold: 0.15,
      },
      chargebacks: {
        enabled: true,
        maxChargebacksPerYear: 2,
        chargebackPenaltyMultiplier: 25,
      },
      codRestriction: {
        enabled: true,
        restrictOnHighRisk: true,
        restrictOnCriticalRisk: true,
        minTransactionsForRestriction: 5,
      },
      thresholds: {
        lowRiskScore: 25,
        mediumRiskScore: 50,
        highRiskScore: 75,
        criticalRiskScore: 90,
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runPaymentScoringBatch();
    }, this.config.scanIntervalMs);

    await this.logAutomation('CUSTOMER_PAYMENT_SCORING', 'SYSTEM', 'started', { config: this.config });
    console.log('[CustomerPaymentScoring] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[CustomerPaymentScoring] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: CustomerPaymentScoringConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<CustomerPaymentScoringConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): CustomerPaymentScoringConfig {
    return this.config;
  }

  async scoreCustomer(customerId: string): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metrics: PaymentMetrics;
    codRestricted: boolean;
  }> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allPayments, refunds, chargebacks] = await Promise.all([
      prisma.payment.findMany({
        where: {
          customerId,
          createdAt: { gte: ninetyDaysAgo },
        },
        select: {
          id: true,
          status: true,
          amount: true,
          createdAt: true,
        },
      }),
      prisma.walletTransaction.count({
        where: {
          wallet: { ownerId: customerId, ownerType: 'customer' },
          referenceType: 'manual_adjustment',
          direction: 'credit',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.payment.count({
        where: {
          customerId,
          status: 'refunded',
          createdAt: { gte: ninetyDaysAgo },
        },
      }),
    ]);

    const successfulPayments = allPayments.filter(p => 
      p.status === 'succeeded' || p.status === 'captured'
    ).length;

    const failedPayments = allPayments.filter(p => 
      p.status === 'failed' || p.status === 'cancelled'
    ).length;

    const totalTransactions = allPayments.length;
    const successRate = totalTransactions > 0 ? successfulPayments / totalTransactions : 1;
    const refundRatio = totalTransactions > 0 ? refunds / totalTransactions : 0;

    const metrics: PaymentMetrics = {
      totalTransactions,
      successfulPayments,
      failedPayments,
      refundCount: refunds,
      chargebackCount: chargebacks,
      successRate,
      refundRatio,
    };

    let score = 0;

    if (this.config.successRate.enabled && totalTransactions >= 3) {
      if (successRate < this.config.successRate.criticalSuccessRate) {
        score += 40;
      } else if (successRate < this.config.successRate.minSuccessRate) {
        score += Math.round((1 - successRate) * 50);
      }
    }

    if (this.config.refunds.enabled) {
      if (refunds > this.config.refunds.maxRefundsPerMonth) {
        score += Math.min((refunds - this.config.refunds.maxRefundsPerMonth) * 10, 30);
      }
      if (refundRatio > this.config.refunds.highRefundRatioThreshold) {
        score += 15;
      }
    }

    if (this.config.chargebacks.enabled && chargebacks > 0) {
      score += Math.min(chargebacks * this.config.chargebacks.chargebackPenaltyMultiplier, 50);
    }

    score = Math.min(score, 100);

    const riskLevel = this.calculateRiskLevel(score);
    const codRestricted = await this.checkAndApplyCODRestriction(customerId, score, riskLevel, metrics);

    return { score, riskLevel, metrics, codRestricted };
  }

  async runPaymentScoringBatch(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const customersWithRecentPayments = await prisma.payment.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { customerId: true },
        distinct: ['customerId'],
        take: 100,
      });

      const uniqueCustomerIds = Array.from(new Set(customersWithRecentPayments.map(p => p.customerId)));
      let restrictedCount = 0;

      for (const customerId of uniqueCustomerIds) {
        const result = await this.scoreCustomer(customerId);

        if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
          await this.upsertRiskScore(customerId, result);
          if (result.codRestricted) restrictedCount++;
        }
      }

      await this.logAutomation('CUSTOMER_PAYMENT_SCORING', 'SYSTEM', 'batch_completed', {
        customersScored: uniqueCustomerIds.length,
        codRestrictedCount: restrictedCount,
      });
    } catch (error) {
      console.error('[CustomerPaymentScoring] Batch error:', error);
      await this.logAutomation('CUSTOMER_PAYMENT_SCORING', 'SYSTEM', 'batch_error', {
        error: String(error),
      });
    }
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.config.thresholds.criticalRiskScore) return 'critical';
    if (score >= this.config.thresholds.highRiskScore) return 'high';
    if (score >= this.config.thresholds.mediumRiskScore) return 'medium';
    return 'low';
  }

  private async checkAndApplyCODRestriction(
    customerId: string,
    score: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    metrics: PaymentMetrics
  ): Promise<boolean> {
    if (!this.config.codRestriction.enabled) return false;

    if (metrics.totalTransactions < this.config.codRestriction.minTransactionsForRestriction) {
      return false;
    }

    const shouldRestrict =
      (riskLevel === 'critical' && this.config.codRestriction.restrictOnCriticalRisk) ||
      (riskLevel === 'high' && this.config.codRestriction.restrictOnHighRisk);

    if (shouldRestrict) {
      await this.logAutomation('CUSTOMER_PAYMENT_SCORING', customerId, 'cod_restricted', {
        score,
        riskLevel,
        metrics,
        reason: 'auto_restriction',
      });

      return true;
    }

    return false;
  }

  private async upsertRiskScore(
    customerId: string,
    result: { score: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; metrics: PaymentMetrics; codRestricted: boolean }
  ): Promise<void> {
    const existing = await prisma.riskScore.findFirst({
      where: {
        entityType: 'customer',
        entityId: customerId,
        scoreType: 'payment_risk',
      },
    });

    const data = {
      score: result.score,
      riskLevel: result.riskLevel,
      paymentMetrics: {
        success_rate: result.metrics.successRate,
        refund_ratio: result.metrics.refundRatio,
        chargeback_count: result.metrics.chargebackCount,
      },
      codRestricted: result.codRestricted,
      calculatedAt: new Date(),
    };

    if (existing) {
      await prisma.riskScore.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.riskScore.create({
        data: {
          entityType: 'customer',
          entityId: customerId,
          scoreType: 'payment_risk',
          ...data,
        },
      });
    }
  }

  async getPaymentScoringStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'CUSTOMER_PAYMENT_SCORING',
        createdAt: { gte: startDate },
      },
    });

    const riskScores = await prisma.riskScore.findMany({
      where: {
        scoreType: 'payment_risk',
        calculatedAt: { gte: startDate },
      },
    });

    const codRestrictedCount = riskScores.filter((r: { codRestricted: boolean }) => r.codRestricted).length;

    return {
      totalBatches: logs.filter((l: { status: string }) => l.status === 'batch_completed').length,
      codRestrictedCustomers: codRestrictedCount,
      riskScoresByLevel: {
        low: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'low').length,
        medium: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'medium').length,
        high: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'high').length,
        critical: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'critical').length,
      },
      averageScore: riskScores.length > 0
        ? riskScores.reduce((sum: number, r: { score: number }) => sum + r.score, 0) / riskScores.length
        : 0,
    };
  }

  async getCODRestrictedCustomers(): Promise<any[]> {
    return await prisma.riskScore.findMany({
      where: {
        scoreType: 'payment_risk',
        codRestricted: true,
      },
      orderBy: { calculatedAt: 'desc' },
      take: 100,
    });
  }

  async removeCODRestriction(customerId: string, adminId: string): Promise<void> {
    const riskScore = await prisma.riskScore.findFirst({
      where: {
        entityType: 'customer',
        entityId: customerId,
        scoreType: 'payment_risk',
      },
    });

    if (riskScore) {
      await prisma.riskScore.update({
        where: { id: riskScore.id },
        data: {
          codRestricted: false,
        },
      });

      await this.logAutomation('CUSTOMER_PAYMENT_SCORING', customerId, 'cod_restriction_removed', {
        adminId,
        previousScore: riskScore.score,
      });
    }
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
          entityType: 'customer',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[CustomerPaymentScoring] Log error:', error);
    }
  }
}

export const customerPaymentScoringAutomation = new CustomerPaymentScoringAutomation();
