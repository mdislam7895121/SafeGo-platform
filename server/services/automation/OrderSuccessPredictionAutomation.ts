/**
 * SafeGo Order Success Prediction Automation Service (Module 3)
 * Predicts order success/failure probability before acceptance:
 * - Cancellation chance prediction
 * - Payment failure probability
 * - Delay probability estimation
 * Returns "order_risk_level" before dispatch
 * Adjusts dispatch logic based on risk assessment
 */

import { prisma } from '../../db';

interface OrderRiskAssessment {
  orderId: string;
  orderType: string;
  cancellationProbability: number;
  paymentFailureProbability: number;
  delayProbability: number;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: Record<string, any>;
  recommendations: string[];
  dispatchAdjustment: {
    priorityBoost: number;
    requirePrepayment: boolean;
    assignPremiumDriver: boolean;
    addBufferTime: number;
  };
}

interface CustomerRiskProfile {
  customerId: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  paymentFailures: number;
  paymentFailureRate: number;
  avgOrderValue: number;
  lastOrderAt?: Date;
}

interface OrderSuccessPredictionConfig {
  enabled: boolean;
  scanIntervalMs: number;
  thresholds: {
    highCancelRisk: number;
    highPaymentFailureRisk: number;
    highDelayRisk: number;
    criticalRiskScore: number;
    highRiskScore: number;
    mediumRiskScore: number;
  };
  customerHistory: {
    minOrdersForPrediction: number;
    cancelRateWeight: number;
    paymentFailureWeight: number;
    recencyWeight: number;
  };
  dispatchRules: {
    requirePrepaymentAboveRisk: number;
    assignPremiumDriverAboveRisk: number;
    addBufferTimeMinutes: number;
  };
  autoActions: {
    blockHighRiskCOD: boolean;
    prioritizeLowRisk: boolean;
    deprioritizeHighRisk: boolean;
  };
}

class OrderSuccessPredictionAutomation {
  private static instance: OrderSuccessPredictionAutomation;
  private config: OrderSuccessPredictionConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 60000,
      thresholds: {
        highCancelRisk: 0.4,
        highPaymentFailureRisk: 0.3,
        highDelayRisk: 0.5,
        criticalRiskScore: 85,
        highRiskScore: 65,
        mediumRiskScore: 35,
      },
      customerHistory: {
        minOrdersForPrediction: 2,
        cancelRateWeight: 0.35,
        paymentFailureWeight: 0.4,
        recencyWeight: 0.25,
      },
      dispatchRules: {
        requirePrepaymentAboveRisk: 70,
        assignPremiumDriverAboveRisk: 60,
        addBufferTimeMinutes: 10,
      },
      autoActions: {
        blockHighRiskCOD: true,
        prioritizeLowRisk: true,
        deprioritizeHighRisk: true,
      },
    };
  }

  static getInstance(): OrderSuccessPredictionAutomation {
    if (!OrderSuccessPredictionAutomation.instance) {
      OrderSuccessPredictionAutomation.instance = new OrderSuccessPredictionAutomation();
    }
    return OrderSuccessPredictionAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runPredictionScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('ORDER_SUCCESS_PREDICTION', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[OrderSuccessPrediction] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[OrderSuccessPrediction] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: OrderSuccessPredictionConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<OrderSuccessPredictionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): OrderSuccessPredictionConfig {
    return this.config;
  }

  async predictOrderRisk(
    orderType: 'ride' | 'food' | 'parcel' | 'shop' | 'ticket' | 'rental',
    orderId: string,
    customerId: string,
    orderValue: number,
    paymentMethod: string
  ): Promise<OrderRiskAssessment> {
    const customerProfile = await this.getCustomerRiskProfile(customerId, orderType);
    
    const cancellationProbability = this.calculateCancellationProbability(customerProfile, orderType);
    const paymentFailureProbability = this.calculatePaymentFailureProbability(
      customerProfile,
      paymentMethod,
      orderValue
    );
    const delayProbability = await this.calculateDelayProbability(orderType);

    const riskScore = this.calculateOverallRiskScore(
      cancellationProbability,
      paymentFailureProbability,
      delayProbability
    );

    const overallRiskLevel = this.determineRiskLevel(riskScore);
    const riskFactors = this.identifyRiskFactors(
      customerProfile,
      cancellationProbability,
      paymentFailureProbability,
      delayProbability,
      paymentMethod
    );

    const recommendations = this.generateRecommendations(riskScore, riskFactors, paymentMethod);
    const dispatchAdjustment = this.calculateDispatchAdjustment(riskScore, overallRiskLevel);

    const assessment: OrderRiskAssessment = {
      orderId,
      orderType,
      cancellationProbability,
      paymentFailureProbability,
      delayProbability,
      overallRiskLevel,
      riskScore,
      riskFactors,
      recommendations,
      dispatchAdjustment,
    };

    await this.saveOrderRiskPrediction(assessment);

    await this.logAutomation('ORDER_SUCCESS_PREDICTION', orderId, 'prediction_created', {
      customerId,
      riskScore,
      riskLevel: overallRiskLevel,
      recommendations,
    });

    return assessment;
  }

  async getCustomerRiskProfile(customerId: string, orderType: string): Promise<CustomerRiskProfile> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    let totalOrders = 0;
    let cancelledOrders = 0;
    let paymentFailures = 0;
    let totalValue = 0;
    let lastOrderAt: Date | undefined;

    if (orderType === 'ride') {
      const rides = await prisma.ride.findMany({
        where: { customerId, createdAt: { gte: ninetyDaysAgo } },
        select: { status: true, totalFare: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      totalOrders = rides.length;
      cancelledOrders = rides.filter(r => r.status === 'cancelled').length;
      totalValue = rides.reduce((sum, r) => sum + (r.totalFare?.toNumber() || 0), 0);
      lastOrderAt = rides[0]?.createdAt;
    } else if (orderType === 'food') {
      const orders = await prisma.foodOrder.findMany({
        where: { customerId, createdAt: { gte: ninetyDaysAgo } },
        select: { status: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      totalOrders = orders.length;
      cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      totalValue = orders.reduce((sum, o) => sum + (o.totalAmount?.toNumber() || 0), 0);
      lastOrderAt = orders[0]?.createdAt;
    } else if (orderType === 'parcel') {
      const deliveries = await prisma.delivery.findMany({
        where: { customerId, createdAt: { gte: ninetyDaysAgo } },
        select: { status: true, serviceFare: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      totalOrders = deliveries.length;
      cancelledOrders = deliveries.filter(d => d.status === 'cancelled').length;
      totalValue = deliveries.reduce((sum, d) => sum + (d.serviceFare?.toNumber() || 0), 0);
      lastOrderAt = deliveries[0]?.createdAt;
    }

    const failedPayments = await prisma.payment.count({
      where: {
        customerId,
        status: 'failed',
        createdAt: { gte: ninetyDaysAgo },
      },
    });

    const totalPaymentAttempts = await prisma.payment.count({
      where: {
        customerId,
        createdAt: { gte: ninetyDaysAgo },
      },
    });

    return {
      customerId,
      totalOrders,
      cancelledOrders,
      cancelRate: totalOrders > 0 ? cancelledOrders / totalOrders : 0,
      paymentFailures: failedPayments,
      paymentFailureRate: totalPaymentAttempts > 0 ? failedPayments / totalPaymentAttempts : 0,
      avgOrderValue: totalOrders > 0 ? totalValue / totalOrders : 0,
      lastOrderAt,
    };
  }

  private calculateCancellationProbability(
    profile: CustomerRiskProfile,
    orderType: string
  ): number {
    if (profile.totalOrders < this.config.customerHistory.minOrdersForPrediction) {
      return 0.15;
    }

    let baseProbability = profile.cancelRate;

    const typeMultipliers: Record<string, number> = {
      ride: 1.0,
      food: 0.8,
      parcel: 0.6,
      shop: 0.7,
      ticket: 0.4,
      rental: 0.5,
    };

    baseProbability *= typeMultipliers[orderType] || 1.0;

    if (profile.lastOrderAt) {
      const daysSinceLastOrder = (Date.now() - profile.lastOrderAt.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastOrder > 60) {
        baseProbability *= 1.3;
      } else if (daysSinceLastOrder > 30) {
        baseProbability *= 1.15;
      }
    }

    return Math.min(baseProbability, 1.0);
  }

  private calculatePaymentFailureProbability(
    profile: CustomerRiskProfile,
    paymentMethod: string,
    orderValue: number
  ): number {
    let baseProbability = profile.paymentFailureRate;

    const methodRiskMultipliers: Record<string, number> = {
      cash: 0.05,
      cod: 0.1,
      card: 0.15,
      wallet: 0.08,
      bkash: 0.1,
      nagad: 0.1,
      stripe: 0.12,
    };

    baseProbability += methodRiskMultipliers[paymentMethod.toLowerCase()] || 0.1;

    if (profile.avgOrderValue > 0 && orderValue > profile.avgOrderValue * 2) {
      baseProbability *= 1.25;
    }

    return Math.min(baseProbability, 1.0);
  }

  private async calculateDelayProbability(orderType: string): Promise<number> {
    const now = new Date();
    const hour = now.getHours();

    let baseDelay = 0.1;

    if ((hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)) {
      baseDelay = 0.35;
    } else if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      baseDelay = 0.25;
    }

    const typeDelayFactors: Record<string, number> = {
      ride: 1.0,
      food: 1.3,
      parcel: 0.8,
      shop: 0.9,
      ticket: 0.4,
      rental: 0.3,
    };

    baseDelay *= typeDelayFactors[orderType] || 1.0;

    const trafficSnapshot = await prisma.trafficSnapshot.findFirst({
      where: { expiresAt: { gt: now } },
      orderBy: { observedAt: 'desc' },
    });

    if (trafficSnapshot && trafficSnapshot.congestionScore > 50) {
      baseDelay *= 1 + (trafficSnapshot.congestionScore / 200);
    }

    return Math.min(baseDelay, 1.0);
  }

  private calculateOverallRiskScore(
    cancellationProb: number,
    paymentFailureProb: number,
    delayProb: number
  ): number {
    const cancelWeight = this.config.customerHistory.cancelRateWeight;
    const paymentWeight = this.config.customerHistory.paymentFailureWeight;
    const delayWeight = 1 - cancelWeight - paymentWeight;

    const weightedScore =
      cancellationProb * cancelWeight * 100 +
      paymentFailureProb * paymentWeight * 100 +
      delayProb * delayWeight * 100;

    return Math.min(Math.round(weightedScore), 100);
  }

  private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= this.config.thresholds.criticalRiskScore) return 'critical';
    if (riskScore >= this.config.thresholds.highRiskScore) return 'high';
    if (riskScore >= this.config.thresholds.mediumRiskScore) return 'medium';
    return 'low';
  }

  private identifyRiskFactors(
    profile: CustomerRiskProfile,
    cancellationProb: number,
    paymentFailureProb: number,
    delayProb: number,
    paymentMethod: string
  ): Record<string, any> {
    const factors: Record<string, any> = {};

    if (cancellationProb > this.config.thresholds.highCancelRisk) {
      factors.highCancellationRisk = {
        probability: cancellationProb,
        historicalCancelRate: profile.cancelRate,
        threshold: this.config.thresholds.highCancelRisk,
      };
    }

    if (paymentFailureProb > this.config.thresholds.highPaymentFailureRisk) {
      factors.highPaymentFailureRisk = {
        probability: paymentFailureProb,
        historicalFailureRate: profile.paymentFailureRate,
        paymentMethod,
        threshold: this.config.thresholds.highPaymentFailureRisk,
      };
    }

    if (delayProb > this.config.thresholds.highDelayRisk) {
      factors.highDelayRisk = {
        probability: delayProb,
        threshold: this.config.thresholds.highDelayRisk,
      };
    }

    if (profile.totalOrders < this.config.customerHistory.minOrdersForPrediction) {
      factors.newCustomer = {
        orderCount: profile.totalOrders,
        minRequired: this.config.customerHistory.minOrdersForPrediction,
      };
    }

    return factors;
  }

  private generateRecommendations(
    riskScore: number,
    riskFactors: Record<string, any>,
    paymentMethod: string
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore >= this.config.dispatchRules.requirePrepaymentAboveRisk) {
      if (paymentMethod.toLowerCase() === 'cod' || paymentMethod.toLowerCase() === 'cash') {
        recommendations.push('REQUIRE_PREPAYMENT');
      }
    }

    if (riskScore >= this.config.dispatchRules.assignPremiumDriverAboveRisk) {
      recommendations.push('ASSIGN_PREMIUM_DRIVER');
    }

    if (riskFactors.highDelayRisk) {
      recommendations.push('ADD_BUFFER_TIME');
    }

    if (riskFactors.highCancellationRisk) {
      recommendations.push('CONFIRM_ORDER_VIA_CALL');
    }

    if (riskFactors.newCustomer) {
      recommendations.push('MONITOR_FIRST_ORDER');
    }

    return recommendations;
  }

  private calculateDispatchAdjustment(
    riskScore: number,
    riskLevel: string
  ): OrderRiskAssessment['dispatchAdjustment'] {
    let priorityBoost = 0;

    if (riskLevel === 'low' && this.config.autoActions.prioritizeLowRisk) {
      priorityBoost = 10;
    } else if (riskLevel === 'high' && this.config.autoActions.deprioritizeHighRisk) {
      priorityBoost = -5;
    } else if (riskLevel === 'critical' && this.config.autoActions.deprioritizeHighRisk) {
      priorityBoost = -10;
    }

    return {
      priorityBoost,
      requirePrepayment: riskScore >= this.config.dispatchRules.requirePrepaymentAboveRisk,
      assignPremiumDriver: riskScore >= this.config.dispatchRules.assignPremiumDriverAboveRisk,
      addBufferTime:
        riskLevel === 'high' || riskLevel === 'critical'
          ? this.config.dispatchRules.addBufferTimeMinutes
          : 0,
    };
  }

  private async saveOrderRiskPrediction(assessment: OrderRiskAssessment): Promise<void> {
    try {
      await prisma.orderRiskPrediction.create({
        data: {
          orderType: assessment.orderType,
          orderId: assessment.orderId,
          cancellationProbability: assessment.cancellationProbability,
          paymentFailureProbability: assessment.paymentFailureProbability,
          delayProbability: assessment.delayProbability,
          overallRiskLevel: assessment.overallRiskLevel,
          riskScore: assessment.riskScore,
          riskFactors: assessment.riskFactors,
          recommendations: assessment.recommendations,
          dispatchAdjustment: assessment.dispatchAdjustment,
          dispatchPriorityBoost: assessment.dispatchAdjustment.priorityBoost,
        },
      });
    } catch (error) {
      console.error('[OrderSuccessPrediction] Failed to save prediction:', error);
    }
  }

  async recordActualOutcome(
    orderId: string,
    outcome: 'completed' | 'cancelled' | 'payment_failed' | 'delayed'
  ): Promise<void> {
    try {
      const prediction = await prisma.orderRiskPrediction.findFirst({
        where: { orderId },
        orderBy: { predictedAt: 'desc' },
      });

      if (prediction) {
        let accuracy = 0;

        if (outcome === 'completed' && prediction.overallRiskLevel === 'low') {
          accuracy = 1.0;
        } else if (outcome === 'cancelled' && prediction.cancellationProbability > 0.5) {
          accuracy = 1.0;
        } else if (outcome === 'payment_failed' && prediction.paymentFailureProbability > 0.3) {
          accuracy = 1.0;
        } else if (outcome === 'delayed' && prediction.delayProbability > 0.4) {
          accuracy = 1.0;
        } else {
          accuracy = 0.5;
        }

        await prisma.orderRiskPrediction.update({
          where: { id: prediction.id },
          data: {
            actualOutcome: outcome,
            outcomeRecordedAt: new Date(),
            predictionAccuracy: accuracy,
          },
        });

        await this.logAutomation('ORDER_SUCCESS_PREDICTION', orderId, 'outcome_recorded', {
          predictedRiskLevel: prediction.overallRiskLevel,
          actualOutcome: outcome,
          accuracy,
        });
      }
    } catch (error) {
      console.error('[OrderSuccessPrediction] Failed to record outcome:', error);
    }
  }

  private async runPredictionScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const pendingRides = await prisma.ride.findMany({
        where: {
          status: 'requested',
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        select: { id: true, customerId: true, totalFare: true, paymentMethod: true },
        take: 50,
      });

      for (const ride of pendingRides) {
        const existingPrediction = await prisma.orderRiskPrediction.findFirst({
          where: { orderId: ride.id },
        });

        if (!existingPrediction) {
          await this.predictOrderRisk(
            'ride',
            ride.id,
            ride.customerId,
            ride.totalFare?.toNumber() || 0,
            ride.paymentMethod || 'cash'
          );
        }
      }

      const pendingFoodOrders = await prisma.foodOrder.findMany({
        where: {
          status: 'placed',
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        select: { id: true, customerId: true, totalAmount: true, paymentMethod: true },
        take: 50,
      });

      for (const order of pendingFoodOrders) {
        const existingPrediction = await prisma.orderRiskPrediction.findFirst({
          where: { orderId: order.id },
        });

        if (!existingPrediction) {
          await this.predictOrderRisk(
            'food',
            order.id,
            order.customerId,
            order.totalAmount?.toNumber() || 0,
            order.paymentMethod || 'cash'
          );
        }
      }

      await this.logAutomation('ORDER_SUCCESS_PREDICTION', 'SYSTEM', 'scan_completed', {
        ridesProcessed: pendingRides.length,
        foodOrdersProcessed: pendingFoodOrders.length,
      });
    } catch (error) {
      console.error('[OrderSuccessPrediction] Scan error:', error);
      await this.logAutomation('ORDER_SUCCESS_PREDICTION', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  async getPredictionStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const predictions = await prisma.orderRiskPrediction.findMany({
      where: { predictedAt: { gte: startDate } },
    });

    const withOutcomes = predictions.filter(p => p.actualOutcome);
    const avgAccuracy =
      withOutcomes.length > 0
        ? withOutcomes.reduce((sum, p) => sum + (p.predictionAccuracy || 0), 0) / withOutcomes.length
        : 0;

    return {
      totalPredictions: predictions.length,
      byRiskLevel: {
        low: predictions.filter(p => p.overallRiskLevel === 'low').length,
        medium: predictions.filter(p => p.overallRiskLevel === 'medium').length,
        high: predictions.filter(p => p.overallRiskLevel === 'high').length,
        critical: predictions.filter(p => p.overallRiskLevel === 'critical').length,
      },
      byOrderType: predictions.reduce((acc, p) => {
        acc[p.orderType] = (acc[p.orderType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      outcomesRecorded: withOutcomes.length,
      avgPredictionAccuracy: avgAccuracy,
      avgRiskScore:
        predictions.length > 0
          ? predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length
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
          entityType: 'order',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[OrderSuccessPrediction] Log error:', error);
    }
  }
}

export const orderSuccessPredictionAutomation = OrderSuccessPredictionAutomation.getInstance();
