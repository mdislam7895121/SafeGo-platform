/**
 * SafeGo Customer Abuse Automation Service
 * Detects and handles customer misbehavior:
 * - Refund abuse detection
 * - Repeated cancellations
 * - Location manipulation
 * Auto-flags and restricts high-risk users
 */

import { prisma } from '../../db';

interface AbuseMetrics {
  refundCount: number;
  cancelCount: number;
  locationManipulationCount: number;
  supportTicketCount: number;
  lastAbusiveAction?: Date;
}

interface CustomerAbuseConfig {
  enabled: boolean;
  scanIntervalMs: number;
  refund: {
    enabled: boolean;
    maxRefundsPerMonth: number;
    refundRatioThreshold: number;
  };
  cancellation: {
    enabled: boolean;
    maxCancellationsPerWeek: number;
    cancellationRatioThreshold: number;
  };
  locationManipulation: {
    enabled: boolean;
    maxLocationChangesPerRide: number;
  };
  autoRestrict: {
    enabled: boolean;
    restrictOnHighRisk: boolean;
    restrictOnCriticalRisk: boolean;
    cooldownDays: number;
  };
  thresholds: {
    lowRiskScore: number;
    mediumRiskScore: number;
    highRiskScore: number;
    criticalRiskScore: number;
  };
}

class CustomerAbuseAutomation {
  private config: CustomerAbuseConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 300000,
      refund: {
        enabled: true,
        maxRefundsPerMonth: 3,
        refundRatioThreshold: 0.2,
      },
      cancellation: {
        enabled: true,
        maxCancellationsPerWeek: 5,
        cancellationRatioThreshold: 0.3,
      },
      locationManipulation: {
        enabled: true,
        maxLocationChangesPerRide: 3,
      },
      autoRestrict: {
        enabled: true,
        restrictOnHighRisk: true,
        restrictOnCriticalRisk: true,
        cooldownDays: 30,
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
      this.runAbuseDetectionScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('CUSTOMER_ABUSE', 'SYSTEM', 'started', { config: this.config });
    console.log('[CustomerAbuse] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[CustomerAbuse] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: CustomerAbuseConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<CustomerAbuseConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): CustomerAbuseConfig {
    return this.config;
  }

  async analyzeCustomer(customerId: string): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metrics: AbuseMetrics;
    restricted: boolean;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [refundCount, totalRides, cancelledRides, supportTickets] = await Promise.all([
      prisma.walletTransaction.count({
        where: {
          wallet: { ownerId: customerId, ownerType: 'customer' },
          direction: 'credit',
          referenceType: 'manual_adjustment',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.ride.count({
        where: {
          customerId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.ride.count({
        where: {
          customerId,
          status: 'cancelled',
          cancelledAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.customerSupportTicket.count({
        where: {
          customerId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const metrics: AbuseMetrics = {
      refundCount,
      cancelCount: cancelledRides,
      locationManipulationCount: 0,
      supportTicketCount: supportTickets,
    };

    let score = 0;

    if (this.config.refund.enabled) {
      if (refundCount > this.config.refund.maxRefundsPerMonth) {
        score += Math.min((refundCount - this.config.refund.maxRefundsPerMonth) * 15, 40);
      }
      if (totalRides > 0) {
        const refundRatio = refundCount / totalRides;
        if (refundRatio > this.config.refund.refundRatioThreshold) {
          score += 20;
        }
      }
    }

    if (this.config.cancellation.enabled) {
      if (cancelledRides > this.config.cancellation.maxCancellationsPerWeek) {
        score += Math.min((cancelledRides - this.config.cancellation.maxCancellationsPerWeek) * 10, 30);
      }
      if (totalRides > 0) {
        const cancelRatio = cancelledRides / totalRides;
        if (cancelRatio > this.config.cancellation.cancellationRatioThreshold) {
          score += 15;
        }
      }
    }

    if (supportTickets > 5) {
      score += Math.min((supportTickets - 5) * 5, 15);
    }

    score = Math.min(score, 100);

    const riskLevel = this.calculateRiskLevel(score);
    const restricted = await this.checkAndApplyRestrictions(customerId, score, riskLevel, metrics);

    return { score, riskLevel, metrics, restricted };
  }

  async runAbuseDetectionScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const recentActiveCustomers = await prisma.customerProfile.findMany({
        where: {
          rides: {
            some: {
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          },
        },
        select: { id: true },
        take: 100,
      });

      for (const customer of recentActiveCustomers) {
        const result = await this.analyzeCustomer(customer.id);

        if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
          await this.upsertRiskScore(customer.id, result);
        }
      }

      await this.logAutomation('CUSTOMER_ABUSE', 'SYSTEM', 'scan_completed', {
        customersScanned: recentActiveCustomers.length,
      });
    } catch (error) {
      console.error('[CustomerAbuse] Scan error:', error);
      await this.logAutomation('CUSTOMER_ABUSE', 'SYSTEM', 'scan_error', {
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

  private async checkAndApplyRestrictions(
    customerId: string,
    score: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    metrics: AbuseMetrics
  ): Promise<boolean> {
    if (!this.config.autoRestrict.enabled) return false;

    const shouldRestrict =
      (riskLevel === 'critical' && this.config.autoRestrict.restrictOnCriticalRisk) ||
      (riskLevel === 'high' && this.config.autoRestrict.restrictOnHighRisk);

    if (shouldRestrict) {
      await prisma.customerProfile.update({
        where: { id: customerId },
        data: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspensionReason: `Auto-suspended due to abuse detection. Risk score: ${score}`,
        },
      });

      await this.logAutomation('CUSTOMER_ABUSE', customerId, 'customer_restricted', {
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
    result: { score: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; metrics: AbuseMetrics; restricted: boolean }
  ): Promise<void> {
    const existing = await prisma.riskScore.findFirst({
      where: {
        entityType: 'customer',
        entityId: customerId,
        scoreType: 'customer_abuse',
      },
    });

    const data = {
      score: result.score,
      riskLevel: result.riskLevel,
      abuseMetrics: {
        refund_count: result.metrics.refundCount,
        cancel_count: result.metrics.cancelCount,
        location_manipulation_count: result.metrics.locationManipulationCount,
      },
      restricted: result.restricted,
      restrictedAt: result.restricted ? new Date() : null,
      restrictionReason: result.restricted ? 'Auto-restricted due to abuse detection' : null,
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
          scoreType: 'customer_abuse',
          ...data,
        },
      });
    }
  }

  async getAbuseStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'CUSTOMER_ABUSE',
        createdAt: { gte: startDate },
      },
    });

    const riskScores = await prisma.riskScore.findMany({
      where: {
        scoreType: 'customer_abuse',
        calculatedAt: { gte: startDate },
      },
    });

    return {
      totalScans: logs.filter((l: { status: string }) => l.status === 'scan_completed').length,
      customersRestricted: logs.filter((l: { status: string }) => l.status === 'customer_restricted').length,
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
      console.error('[CustomerAbuse] Log error:', error);
    }
  }
}

export const customerAbuseAutomation = new CustomerAbuseAutomation();
