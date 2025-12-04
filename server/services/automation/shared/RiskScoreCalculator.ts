import { prisma } from '../../../db';

type RiskLevelType = 'low' | 'medium' | 'high' | 'critical';
type RiskScoreTypeValue = 'customer_abuse' | 'partner_fraud' | 'payment_risk' | 'partner_risk_monitor' | 'order_risk' | 'driver_fatigue';

interface RiskFactors {
  [key: string]: number;
}

interface RiskCalculationResult {
  score: number;
  riskLevel: RiskLevelType;
  factors: RiskFactors;
  trend: 'improving' | 'stable' | 'worsening';
}

export class RiskScoreCalculator {
  private static instance: RiskScoreCalculator;

  private constructor() {}

  static getInstance(): RiskScoreCalculator {
    if (!RiskScoreCalculator.instance) {
      RiskScoreCalculator.instance = new RiskScoreCalculator();
    }
    return RiskScoreCalculator.instance;
  }

  calculateRiskLevel(score: number): RiskLevelType {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  async calculateCustomerAbuseScore(customerId: string): Promise<RiskCalculationResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [refundCount, cancelCount, supportTickets] = await Promise.all([
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
          status: 'cancelled',
          cancelledAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.customerSupportTicket.count({
        where: {
          customerId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const factors: RiskFactors = {
      refund_abuse: Math.min(refundCount * 10, 40),
      cancellation_abuse: Math.min(cancelCount * 5, 30),
      support_pattern: Math.min(supportTickets * 8, 30),
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0);
    const riskLevel = this.calculateRiskLevel(score);

    const previousScore = await this.getPreviousScore(customerId, 'customer_abuse');
    const trend = this.calculateTrend(score, previousScore);

    return { score, riskLevel, factors, trend };
  }

  async calculatePartnerFraudScore(
    partnerId: string,
    partnerType: 'restaurant' | 'shop'
  ): Promise<RiskCalculationResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let orderCount = 0;
    let cancelledCount = 0;

    if (partnerType === 'restaurant') {
      [orderCount, cancelledCount] = await Promise.all([
        prisma.foodOrder.count({
          where: { restaurantId: partnerId, createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma.foodOrder.count({
          where: { 
            restaurantId: partnerId, 
            status: 'cancelled',
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
      ]);
    }

    const cancellationRate = orderCount > 0 ? (cancelledCount / orderCount) * 100 : 0;

    const factors: RiskFactors = {
      cancellation_spike: cancellationRate > 20 ? Math.min(cancellationRate * 1.5, 40) : 0,
      order_pattern_anomaly: 0,
      self_order_detection: 0,
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0);
    const riskLevel = this.calculateRiskLevel(score);

    const previousScore = await this.getPreviousScore(partnerId, 'partner_fraud');
    const trend = this.calculateTrend(score, previousScore);

    return { score, riskLevel, factors, trend };
  }

  async calculatePaymentRiskScore(customerId: string): Promise<RiskCalculationResult> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [totalTransactions, refunds] = await Promise.all([
      prisma.walletTransaction.count({
        where: { 
          wallet: { ownerId: customerId, ownerType: 'customer' },
          createdAt: { gte: ninetyDaysAgo } 
        },
      }),
      prisma.walletTransaction.count({
        where: {
          wallet: { ownerId: customerId, ownerType: 'customer' },
          referenceType: 'manual_adjustment',
          direction: 'credit',
          createdAt: { gte: ninetyDaysAgo },
        },
      }),
    ]);

    const refundRate = totalTransactions > 0 ? (refunds / totalTransactions) * 100 : 0;

    const factors: RiskFactors = {
      refund_rate: refundRate > 15 ? Math.min(refundRate * 1.5, 50) : 0,
      payment_history: 0,
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0);
    const riskLevel = this.calculateRiskLevel(score);

    const previousScore = await this.getPreviousScore(customerId, 'payment_risk');
    const trend = this.calculateTrend(score, previousScore);

    return { score, riskLevel, factors, trend };
  }

  async calculatePartnerRiskMonitorScore(
    partnerId: string,
    partnerType: 'driver' | 'restaurant' | 'shop'
  ): Promise<RiskCalculationResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let completedCount = 0;
    let issueCount = 0;

    if (partnerType === 'driver') {
      [completedCount, issueCount] = await Promise.all([
        prisma.ride.count({
          where: { driverId: partnerId, status: 'completed', completedAt: { gte: thirtyDaysAgo } },
        }),
        prisma.driverSupportTicket.count({
          where: { driverId: partnerId, createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);
    } else if (partnerType === 'restaurant') {
      [completedCount, issueCount] = await Promise.all([
        prisma.foodOrder.count({
          where: { restaurantId: partnerId, status: 'delivered', createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma.driverSupportTicket.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);
    }

    const issueRate = completedCount > 0 ? (issueCount / completedCount) * 100 : 0;

    const factors: RiskFactors = {
      issue_rate: Math.min(issueRate * 3, 40),
      late_completion_rate: 0,
      cancellation_pattern: 0,
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0);
    const riskLevel = this.calculateRiskLevel(score);

    const previousScore = await this.getPreviousScore(partnerId, 'partner_risk_monitor');
    const trend = this.calculateTrend(score, previousScore);

    return { score, riskLevel, factors, trend };
  }

  private async getPreviousScore(entityId: string, scoreType: string): Promise<number | null> {
    const previous = await prisma.riskScore.findFirst({
      where: { entityId, scoreType: scoreType as any },
      orderBy: { calculatedAt: 'desc' },
    });
    return previous?.score ?? null;
  }

  private calculateTrend(
    currentScore: number,
    previousScore: number | null
  ): 'improving' | 'stable' | 'worsening' {
    if (previousScore === null) return 'stable';
    const diff = currentScore - previousScore;
    if (diff > 5) return 'worsening';
    if (diff < -5) return 'improving';
    return 'stable';
  }

  async saveRiskScore(
    entityType: string,
    entityId: string,
    scoreType: RiskScoreTypeValue,
    result: RiskCalculationResult,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    await prisma.riskScore.upsert({
      where: {
        entityType_entityId_scoreType: { entityType, entityId, scoreType: scoreType as any },
      },
      update: {
        score: result.score,
        riskLevel: result.riskLevel as any,
        factors: result.factors,
        trend: result.trend,
        calculatedAt: new Date(),
        ...additionalData,
      },
      create: {
        entityType,
        entityId,
        scoreType: scoreType as any,
        score: result.score,
        riskLevel: result.riskLevel as any,
        factors: result.factors,
        trend: result.trend,
        ...additionalData,
      },
    });
  }
}

export const riskScoreCalculator = RiskScoreCalculator.getInstance();
