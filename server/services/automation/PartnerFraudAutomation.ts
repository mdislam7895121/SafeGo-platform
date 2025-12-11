/**
 * SafeGo Partner Fraud Automation Service
 * Detects and handles restaurant/shop fraud patterns:
 * - Fake orders detection
 * - Repeated self-orders
 * - Abnormal cancellation spikes
 * Auto-flags shop/restaurant with partner_risk_score
 */

import { prisma } from '../../db';

interface FraudMetrics {
  fakeOrderCount: number;
  selfOrderCount: number;
  cancellationSpikes: number;
  suspiciousPatternCount: number;
  lastFraudulentAction?: Date;
}

interface PartnerFraudConfig {
  enabled: boolean;
  scanIntervalMs: number;
  fakeOrders: {
    enabled: boolean;
    minOrderValueForCheck: number;
    suspiciousPatterns: string[];
  };
  selfOrders: {
    enabled: boolean;
    maxSelfOrdersPerDay: number;
    sameDeviceThreshold: number;
  };
  cancellationSpikes: {
    enabled: boolean;
    normalCancellationRate: number;
    spikeThreshold: number;
    windowHours: number;
  };
  autoFlag: {
    enabled: boolean;
    flagOnHighRisk: boolean;
    flagOnCriticalRisk: boolean;
    suspendOnCritical: boolean;
  };
  thresholds: {
    lowRiskScore: number;
    mediumRiskScore: number;
    highRiskScore: number;
    criticalRiskScore: number;
  };
}

class PartnerFraudAutomation {
  private config: PartnerFraudConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 600000,
      fakeOrders: {
        enabled: true,
        minOrderValueForCheck: 100,
        suspiciousPatterns: ['same_address', 'round_amounts', 'rapid_succession'],
      },
      selfOrders: {
        enabled: true,
        maxSelfOrdersPerDay: 2,
        sameDeviceThreshold: 3,
      },
      cancellationSpikes: {
        enabled: true,
        normalCancellationRate: 0.1,
        spikeThreshold: 0.3,
        windowHours: 24,
      },
      autoFlag: {
        enabled: true,
        flagOnHighRisk: true,
        flagOnCriticalRisk: true,
        suspendOnCritical: true,
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
      this.runFraudDetectionScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('PARTNER_FRAUD', 'SYSTEM', 'started', { config: this.config });
    console.log('[PartnerFraud] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[PartnerFraud] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: PartnerFraudConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<PartnerFraudConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): PartnerFraudConfig {
    return this.config;
  }

  async analyzeRestaurant(restaurantId: string): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metrics: FraudMetrics;
    flagged: boolean;
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalOrders, cancelledOrders, completedOrders] = await Promise.all([
      prisma.foodOrder.count({
        where: {
          restaurantId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.foodOrder.count({
        where: {
          restaurantId,
          status: 'cancelled',
          cancelledAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.foodOrder.count({
        where: {
          restaurantId,
          status: 'delivered',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const recentOrders = totalOrders > 0 ? await prisma.foodOrder.findMany({
      where: {
        restaurantId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        customerId: true,
        serviceFare: true,
        deliveryAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) : [];

    const selfOrderCount = this.detectSelfOrders(recentOrders, restaurantId);
    const fakeOrderIndicators = this.detectFakeOrderPatterns(recentOrders);
    
    const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;
    const cancellationSpike = cancellationRate > this.config.cancellationSpikes.spikeThreshold ? 1 : 0;

    const metrics: FraudMetrics = {
      fakeOrderCount: fakeOrderIndicators,
      selfOrderCount,
      cancellationSpikes: cancellationSpike,
      suspiciousPatternCount: selfOrderCount + fakeOrderIndicators + cancellationSpike,
    };

    let score = 0;

    if (this.config.selfOrders.enabled && selfOrderCount > 0) {
      score += Math.min(selfOrderCount * 20, 40);
    }

    if (this.config.fakeOrders.enabled && fakeOrderIndicators > 0) {
      score += Math.min(fakeOrderIndicators * 15, 35);
    }

    if (this.config.cancellationSpikes.enabled && cancellationSpike > 0) {
      score += Math.min(cancellationRate * 100, 25);
    }

    score = Math.min(score, 100);

    const riskLevel = this.calculateRiskLevel(score);
    const flagged = await this.checkAndApplyFlags(restaurantId, 'restaurant', score, riskLevel, metrics);

    return { score, riskLevel, metrics, flagged };
  }

  async analyzeShop(shopId: string): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metrics: FraudMetrics;
    flagged: boolean;
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalOrders, cancelledOrders] = await Promise.all([
      prisma.productOrder.count({
        where: {
          shopPartnerId: shopId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.productOrder.count({
        where: {
          shopPartnerId: shopId,
          status: { in: ['cancelled_by_customer', 'cancelled_by_shop', 'cancelled_by_driver'] },
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
    ]);

    const recentOrders = totalOrders > 0 ? await prisma.productOrder.findMany({
      where: {
        shopPartnerId: shopId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        customerId: true,
        totalAmount: true,
        deliveryAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) : [];

    const selfOrderCount = this.detectSelfOrdersShop(recentOrders, shopId);
    const fakeOrderIndicators = this.detectFakeOrderPatternsShop(recentOrders);
    
    const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;
    const cancellationSpike = cancellationRate > this.config.cancellationSpikes.spikeThreshold ? 1 : 0;

    const metrics: FraudMetrics = {
      fakeOrderCount: fakeOrderIndicators,
      selfOrderCount,
      cancellationSpikes: cancellationSpike,
      suspiciousPatternCount: selfOrderCount + fakeOrderIndicators + cancellationSpike,
    };

    let score = 0;

    if (this.config.selfOrders.enabled && selfOrderCount > 0) {
      score += Math.min(selfOrderCount * 20, 40);
    }

    if (this.config.fakeOrders.enabled && fakeOrderIndicators > 0) {
      score += Math.min(fakeOrderIndicators * 15, 35);
    }

    if (this.config.cancellationSpikes.enabled && cancellationSpike > 0) {
      score += Math.min(cancellationRate * 100, 25);
    }

    score = Math.min(score, 100);

    const riskLevel = this.calculateRiskLevel(score);
    const flagged = await this.checkAndApplyFlags(shopId, 'shop', score, riskLevel, metrics);

    return { score, riskLevel, metrics, flagged };
  }

  async runFraudDetectionScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const [activeRestaurants, activeShops] = await Promise.all([
        prisma.restaurantProfile.findMany({
          where: { isActive: true },
          select: { id: true },
          take: 50,
        }),
        prisma.shopPartner.findMany({
          where: { isActive: true },
          select: { id: true },
          take: 50,
        }),
      ]);

      let flaggedCount = 0;

      for (const restaurant of activeRestaurants) {
        const result = await this.analyzeRestaurant(restaurant.id);
        if (result.flagged) flaggedCount++;
      }

      for (const shop of activeShops) {
        const result = await this.analyzeShop(shop.id);
        if (result.flagged) flaggedCount++;
      }

      await this.logAutomation('PARTNER_FRAUD', 'SYSTEM', 'scan_completed', {
        restaurantsScanned: activeRestaurants.length,
        shopsScanned: activeShops.length,
        flaggedCount,
      });
    } catch (error) {
      console.error('[PartnerFraud] Scan error:', error);
      await this.logAutomation('PARTNER_FRAUD', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private detectSelfOrders(orders: any[], restaurantId: string): number {
    const addressGroups = new Map<string, number>();
    
    for (const order of orders) {
      const addr = order.deliveryAddress?.toLowerCase() || '';
      addressGroups.set(addr, (addressGroups.get(addr) || 0) + 1);
    }

    let suspiciousCount = 0;
    addressGroups.forEach((count) => {
      if (count > this.config.selfOrders.maxSelfOrdersPerDay) {
        suspiciousCount++;
      }
    });

    return suspiciousCount;
  }

  private detectSelfOrdersShop(orders: any[], shopId: string): number {
    const addressGroups = new Map<string, number>();
    
    for (const order of orders) {
      const addr = order.deliveryAddress?.toLowerCase() || '';
      addressGroups.set(addr, (addressGroups.get(addr) || 0) + 1);
    }

    let suspiciousCount = 0;
    addressGroups.forEach((count) => {
      if (count > this.config.selfOrders.maxSelfOrdersPerDay) {
        suspiciousCount++;
      }
    });

    return suspiciousCount;
  }

  private detectFakeOrderPatterns(orders: any[]): number {
    let indicators = 0;

    const roundAmountOrders = orders.filter(o => {
      const amount = Number(o.totalAmount);
      return amount > 0 && amount % 100 === 0;
    });

    if (roundAmountOrders.length > orders.length * 0.5) {
      indicators++;
    }

    for (let i = 1; i < orders.length; i++) {
      const timeDiff = new Date(orders[i - 1].createdAt).getTime() - new Date(orders[i].createdAt).getTime();
      if (timeDiff < 60000) {
        indicators++;
      }
    }

    return indicators;
  }

  private detectFakeOrderPatternsShop(orders: any[]): number {
    return this.detectFakeOrderPatterns(orders);
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.config.thresholds.criticalRiskScore) return 'critical';
    if (score >= this.config.thresholds.highRiskScore) return 'high';
    if (score >= this.config.thresholds.mediumRiskScore) return 'medium';
    return 'low';
  }

  private async checkAndApplyFlags(
    entityId: string,
    entityType: 'restaurant' | 'shop',
    score: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    metrics: FraudMetrics
  ): Promise<boolean> {
    if (!this.config.autoFlag.enabled) return false;

    const shouldFlag =
      (riskLevel === 'critical' && this.config.autoFlag.flagOnCriticalRisk) ||
      (riskLevel === 'high' && this.config.autoFlag.flagOnHighRisk);

    if (shouldFlag) {
      if (entityType === 'restaurant') {
        await prisma.restaurantProfile.update({
          where: { id: entityId },
          data: {
            isActive: riskLevel === 'critical' && this.config.autoFlag.suspendOnCritical ? false : undefined,
            verificationStatus: 'under_review',
          },
        });
      } else {
        await prisma.shopPartner.update({
          where: { id: entityId },
          data: {
            isActive: riskLevel === 'critical' && this.config.autoFlag.suspendOnCritical ? false : undefined,
            verificationStatus: 'under_review',
          },
        });
      }

      await this.upsertRiskScore(entityId, entityType, { score, riskLevel, metrics, flagged: true });

      await this.logAutomation('PARTNER_FRAUD', entityId, 'partner_flagged', {
        entityType,
        score,
        riskLevel,
        metrics,
        suspended: riskLevel === 'critical' && this.config.autoFlag.suspendOnCritical,
      });

      return true;
    }

    return false;
  }

  private async upsertRiskScore(
    entityId: string,
    entityType: 'restaurant' | 'shop',
    result: { score: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'; metrics: FraudMetrics; flagged: boolean }
  ): Promise<void> {
    const existing = await prisma.riskScore.findFirst({
      where: {
        entityType,
        entityId,
        scoreType: 'partner_fraud',
      },
    });

    const data = {
      score: result.score,
      riskLevel: result.riskLevel,
      fraudMetrics: {
        fake_orders: result.metrics.fakeOrderCount,
        self_orders: result.metrics.selfOrderCount,
        cancellation_spikes: result.metrics.cancellationSpikes,
      },
      restricted: result.flagged,
      restrictedAt: result.flagged ? new Date() : null,
      restrictionReason: result.flagged ? 'Auto-flagged due to fraud pattern detection' : null,
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
          scoreType: 'partner_fraud',
          ...data,
        },
      });
    }
  }

  async getFraudStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'PARTNER_FRAUD',
        createdAt: { gte: startDate },
      },
    });

    const riskScores = await prisma.riskScore.findMany({
      where: {
        scoreType: 'partner_fraud',
        calculatedAt: { gte: startDate },
      },
    });

    return {
      totalScans: logs.filter((l: { status: string }) => l.status === 'scan_completed').length,
      partnersFlagged: logs.filter((l: { status: string }) => l.status === 'partner_flagged').length,
      riskScoresByLevel: {
        low: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'low').length,
        medium: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'medium').length,
        high: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'high').length,
        critical: riskScores.filter((r: { riskLevel: string }) => r.riskLevel === 'critical').length,
      },
      byEntityType: {
        restaurant: riskScores.filter((r: { entityType: string }) => r.entityType === 'restaurant').length,
        shop: riskScores.filter((r: { entityType: string }) => r.entityType === 'shop').length,
      },
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
          entityType: 'partner',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[PartnerFraud] Log error:', error);
    }
  }
}

export const partnerFraudAutomation = new PartnerFraudAutomation();
