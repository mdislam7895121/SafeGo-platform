/**
 * SafeGo Partner Risk Monitoring Automation Service
 * Monitors partner risk metrics:
 * - Cancellation rates
 * - Late completion tracking
 * - Issue frequency
 * Auto-adjusts partner_risk_score
 */

import { prisma } from '../../db';

interface PartnerRiskMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  lateCompletions: number;
  issueCount: number;
  completionRate: number;
  cancellationRate: number;
  lateRate: number;
}

interface PartnerRiskMonitoringConfig {
  enabled: boolean;
  scanIntervalMs: number;
  cancellation: {
    enabled: boolean;
    normalCancellationRate: number;
    highCancellationRate: number;
    criticalCancellationRate: number;
  };
  lateCompletion: {
    enabled: boolean;
    normalLateRate: number;
    highLateRate: number;
    lateThresholdMinutes: number;
  };
  issues: {
    enabled: boolean;
    maxIssuesPerWeek: number;
    issueImpactMultiplier: number;
  };
  autoAdjust: {
    enabled: boolean;
    adjustOnHighRisk: boolean;
    suspendOnCriticalRisk: boolean;
    notifyOnMediumRisk: boolean;
  };
  thresholds: {
    lowRiskScore: number;
    mediumRiskScore: number;
    highRiskScore: number;
    criticalRiskScore: number;
  };
}

class PartnerRiskMonitoringAutomation {
  private config: PartnerRiskMonitoringConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 600000,
      cancellation: {
        enabled: true,
        normalCancellationRate: 0.05,
        highCancellationRate: 0.15,
        criticalCancellationRate: 0.25,
      },
      lateCompletion: {
        enabled: true,
        normalLateRate: 0.1,
        highLateRate: 0.25,
        lateThresholdMinutes: 30,
      },
      issues: {
        enabled: true,
        maxIssuesPerWeek: 3,
        issueImpactMultiplier: 10,
      },
      autoAdjust: {
        enabled: true,
        adjustOnHighRisk: true,
        suspendOnCriticalRisk: true,
        notifyOnMediumRisk: true,
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
      this.runRiskMonitoringScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('PARTNER_RISK_MONITOR', 'SYSTEM', 'started', { config: this.config });
    console.log('[PartnerRiskMonitoring] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[PartnerRiskMonitoring] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: PartnerRiskMonitoringConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<PartnerRiskMonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): PartnerRiskMonitoringConfig {
    return this.config;
  }

  async monitorDriver(driverId: string): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metrics: PartnerRiskMetrics;
    adjusted: boolean;
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalRides, completedRides, cancelledRides, supportTickets] = await Promise.all([
      prisma.ride.count({
        where: {
          driverId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.ride.count({
        where: {
          driverId,
          status: 'completed',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.ride.count({
        where: {
          driverId,
          status: 'cancelled',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.driverSupportTicket.count({
        where: {
          driverId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const completionRate = totalRides > 0 ? completedRides / totalRides : 1;
    const cancellationRate = totalRides > 0 ? cancelledRides / totalRides : 0;

    const metrics: PartnerRiskMetrics = {
      totalOrders: totalRides,
      completedOrders: completedRides,
      cancelledOrders: cancelledRides,
      lateCompletions: 0,
      issueCount: supportTickets,
      completionRate,
      cancellationRate,
      lateRate: 0,
    };

    let score = 0;

    if (this.config.cancellation.enabled && totalRides >= 5) {
      if (cancellationRate >= this.config.cancellation.criticalCancellationRate) {
        score += 40;
      } else if (cancellationRate >= this.config.cancellation.highCancellationRate) {
        score += 25;
      } else if (cancellationRate > this.config.cancellation.normalCancellationRate) {
        score += 10;
      }
    }

    if (this.config.issues.enabled && supportTickets > 0) {
      const excessIssues = Math.max(0, supportTickets - this.config.issues.maxIssuesPerWeek);
      score += Math.min(excessIssues * this.config.issues.issueImpactMultiplier, 30);
    }

    if (completionRate < 0.8 && totalRides >= 5) {
      score += Math.round((1 - completionRate) * 30);
    }

    score = Math.min(score, 100);

    const riskLevel = this.calculateRiskLevel(score);
    const adjusted = await this.checkAndApplyAdjustments(driverId, 'driver', score, riskLevel, metrics);

    return { score, riskLevel, metrics, adjusted };
  }

  async monitorRestaurant(restaurantId: string): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metrics: PartnerRiskMetrics;
    adjusted: boolean;
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalOrders, completedOrders, cancelledOrders, supportTickets] = await Promise.all([
      prisma.foodOrder.count({
        where: {
          restaurantId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.foodOrder.count({
        where: {
          restaurantId,
          status: 'delivered',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.foodOrder.count({
        where: {
          restaurantId,
          status: 'cancelled',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.restaurantSupportTicket.count({
        where: {
          restaurantId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const completionRate = totalOrders > 0 ? completedOrders / totalOrders : 1;
    const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;

    const metrics: PartnerRiskMetrics = {
      totalOrders,
      completedOrders,
      cancelledOrders,
      lateCompletions: 0,
      issueCount: supportTickets,
      completionRate,
      cancellationRate,
      lateRate: 0,
    };

    let score = 0;

    if (this.config.cancellation.enabled && totalOrders >= 5) {
      if (cancellationRate >= this.config.cancellation.criticalCancellationRate) {
        score += 40;
      } else if (cancellationRate >= this.config.cancellation.highCancellationRate) {
        score += 25;
      } else if (cancellationRate > this.config.cancellation.normalCancellationRate) {
        score += 10;
      }
    }

    if (this.config.issues.enabled && supportTickets > 0) {
      const excessIssues = Math.max(0, supportTickets - this.config.issues.maxIssuesPerWeek);
      score += Math.min(excessIssues * this.config.issues.issueImpactMultiplier, 30);
    }

    if (completionRate < 0.9 && totalOrders >= 5) {
      score += Math.round((1 - completionRate) * 30);
    }

    score = Math.min(score, 100);

    const riskLevel = this.calculateRiskLevel(score);
    const adjusted = await this.checkAndApplyAdjustments(restaurantId, 'restaurant', score, riskLevel, metrics);

    return { score, riskLevel, metrics, adjusted };
  }

  async runRiskMonitoringScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const [activeDrivers, activeRestaurants] = await Promise.all([
        prisma.driverProfile.findMany({
          where: { isSuspended: false },
          select: { id: true },
          take: 50,
        }),
        prisma.restaurantProfile.findMany({
          where: { isActive: true },
          select: { id: true },
          take: 50,
        }),
      ]);

      let adjustedCount = 0;

      for (const driver of activeDrivers) {
        const result = await this.monitorDriver(driver.id);
        if (result.adjusted) adjustedCount++;

        if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
          await this.upsertRiskScore(driver.id, 'driver', result);
        }
      }

      for (const restaurant of activeRestaurants) {
        const result = await this.monitorRestaurant(restaurant.id);
        if (result.adjusted) adjustedCount++;

        if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
          await this.upsertRiskScore(restaurant.id, 'restaurant', result);
        }
      }

      await this.logAutomation('PARTNER_RISK_MONITOR', 'SYSTEM', 'scan_completed', {
        driversScanned: activeDrivers.length,
        restaurantsScanned: activeRestaurants.length,
        adjustedCount,
      });
    } catch (error) {
      console.error('[PartnerRiskMonitoring] Scan error:', error);
      await this.logAutomation('PARTNER_RISK_MONITOR', 'SYSTEM', 'scan_error', {
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

  private async checkAndApplyAdjustments(
    entityId: string,
    entityType: 'driver' | 'restaurant',
    score: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    metrics: PartnerRiskMetrics
  ): Promise<boolean> {
    if (!this.config.autoAdjust.enabled) return false;

    let adjusted = false;

    if (riskLevel === 'critical' && this.config.autoAdjust.suspendOnCriticalRisk) {
      if (entityType === 'driver') {
        await prisma.driverProfile.update({
          where: { id: entityId },
          data: {
            isSuspended: true,
            suspendedAt: new Date(),
            suspensionReason: `Auto-suspended due to high risk score: ${score}`,
          },
        });
      } else {
        await prisma.restaurantProfile.update({
          where: { id: entityId },
          data: {
            isActive: false,
            verificationStatus: 'suspended',
          },
        });
      }
      adjusted = true;

      await this.logAutomation('PARTNER_RISK_MONITOR', entityId, 'partner_suspended', {
        entityType,
        score,
        riskLevel,
        metrics,
      });
    } else if (riskLevel === 'high' && this.config.autoAdjust.adjustOnHighRisk) {
      await this.logAutomation('PARTNER_RISK_MONITOR', entityId, 'high_risk_flagged', {
        entityType,
        score,
        riskLevel,
        metrics,
      });
      adjusted = true;
    } else if (riskLevel === 'medium' && this.config.autoAdjust.notifyOnMediumRisk) {
      await this.logAutomation('PARTNER_RISK_MONITOR', entityId, 'medium_risk_noted', {
        entityType,
        score,
        riskLevel,
        metrics,
      });
    }

    return adjusted;
  }

  private async upsertRiskScore(
    entityId: string,
    entityType: 'driver' | 'restaurant',
    result: { score: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; metrics: PartnerRiskMetrics; adjusted: boolean }
  ): Promise<void> {
    const existing = await prisma.riskScore.findFirst({
      where: {
        entityType,
        entityId,
        scoreType: 'partner_risk_monitor',
      },
    });

    const previousScore = existing?.score || 0;
    const trend = result.score > previousScore ? 'worsening' : result.score < previousScore ? 'improving' : 'stable';

    const data = {
      score: result.score,
      riskLevel: result.riskLevel,
      trend,
      factors: {
        cancellation_rate: result.metrics.cancellationRate,
        completion_rate: result.metrics.completionRate,
        issue_count: result.metrics.issueCount,
        late_rate: result.metrics.lateRate,
      },
      restricted: result.adjusted,
      restrictedAt: result.adjusted ? new Date() : null,
      restrictionReason: result.adjusted ? `Auto-adjusted due to risk level: ${result.riskLevel}` : null,
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
          entityType,
          entityId,
          scoreType: 'partner_risk_monitor',
          ...data,
        },
      });
    }
  }

  async getRiskMonitoringStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'PARTNER_RISK_MONITOR',
        createdAt: { gte: startDate },
      },
    });

    const riskScores = await prisma.riskScore.findMany({
      where: {
        scoreType: 'partner_risk_monitor',
        calculatedAt: { gte: startDate },
      },
    });

    return {
      totalScans: logs.filter(l => l.status === 'scan_completed').length,
      partnersSuspended: logs.filter(l => l.status === 'partner_suspended').length,
      highRiskFlagged: logs.filter(l => l.status === 'high_risk_flagged').length,
      riskScoresByLevel: {
        low: riskScores.filter(r => r.riskLevel === 'low').length,
        medium: riskScores.filter(r => r.riskLevel === 'medium').length,
        high: riskScores.filter(r => r.riskLevel === 'high').length,
        critical: riskScores.filter(r => r.riskLevel === 'critical').length,
      },
      byEntityType: {
        driver: riskScores.filter(r => r.entityType === 'driver').length,
        restaurant: riskScores.filter(r => r.entityType === 'restaurant').length,
      },
      trendAnalysis: {
        improving: riskScores.filter(r => r.trend === 'improving').length,
        stable: riskScores.filter(r => r.trend === 'stable').length,
        worsening: riskScores.filter(r => r.trend === 'worsening').length,
      },
    };
  }

  async getHighRiskPartners(): Promise<any[]> {
    return await prisma.riskScore.findMany({
      where: {
        scoreType: 'partner_risk_monitor',
        riskLevel: { in: ['high', 'critical'] },
      },
      orderBy: { score: 'desc' },
      take: 50,
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
          entityType: 'partner',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[PartnerRiskMonitoring] Log error:', error);
    }
  }
}

export const partnerRiskMonitoringAutomation = new PartnerRiskMonitoringAutomation();
