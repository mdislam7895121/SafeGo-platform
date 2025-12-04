/**
 * SafeGo Auto Payout Processing Service
 * Small payouts auto-approved, risky payouts auto-flagged, admin override preserved
 */

import { prisma } from '../../db';
import { Prisma, PayoutStatus } from '@prisma/client';

export interface PayoutRequest {
  walletId: string;
  ownerId: string;
  ownerType: 'driver' | 'restaurant' | 'shop_partner' | 'ticket_operator';
  amount: number;
  method: string;
  payoutMethodId?: string;
  countryCode: string;
  requestedBy: 'partner' | 'system' | 'admin';
  adminId?: string;
}

export interface PayoutDecision {
  approved: boolean;
  autoApproved: boolean;
  flagged: boolean;
  flagReason?: string;
  requiresAdminReview: boolean;
  riskScore: number;
  riskFactors: string[];
  estimatedProcessingTime: string;
  payoutId?: string;
}

export interface PayoutConfig {
  autoApproveThreshold: number;
  highRiskThreshold: number;
  dailyLimitPerPartner: number;
  weeklyLimitPerPartner: number;
  minimumAccountAge: number;
  minimumCompletedTrips: number;
  suspiciousPatternThreshold: number;
  instantPayoutFee: number;
  standardPayoutDelay: number;
}

interface RiskAssessment {
  score: number;
  factors: string[];
  recommendation: 'approve' | 'review' | 'reject';
}

const DEFAULT_CONFIG: PayoutConfig = {
  autoApproveThreshold: 500,
  highRiskThreshold: 5000,
  dailyLimitPerPartner: 10000,
  weeklyLimitPerPartner: 50000,
  minimumAccountAge: 7,
  minimumCompletedTrips: 10,
  suspiciousPatternThreshold: 3,
  instantPayoutFee: 0.5,
  standardPayoutDelay: 2,
};

export class AutoPayoutService {
  private static instance: AutoPayoutService;
  private config: PayoutConfig;
  private isRunning: boolean;
  private processingQueue: Map<string, PayoutRequest>;

  private constructor() {
    this.config = DEFAULT_CONFIG;
    this.isRunning = false;
    this.processingQueue = new Map();
  }

  public static getInstance(): AutoPayoutService {
    if (!AutoPayoutService.instance) {
      AutoPayoutService.instance = new AutoPayoutService();
    }
    return AutoPayoutService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[AutoPayoutService] Started');
  }

  stop(): void {
    this.isRunning = false;
    console.log('[AutoPayoutService] Stopped');
  }

  async processPayoutRequest(request: PayoutRequest): Promise<PayoutDecision> {
    const riskAssessment = await this.assessRisk(request);
    
    const limitCheck = await this.checkLimits(request);
    if (!limitCheck.passed) {
      return {
        approved: false,
        autoApproved: false,
        flagged: true,
        flagReason: limitCheck.reason,
        requiresAdminReview: true,
        riskScore: riskAssessment.score,
        riskFactors: [...riskAssessment.factors, limitCheck.reason!],
        estimatedProcessingTime: 'Pending admin review',
      };
    }

    if (riskAssessment.recommendation === 'reject') {
      await this.flagPayout(request, riskAssessment.factors);
      return {
        approved: false,
        autoApproved: false,
        flagged: true,
        flagReason: riskAssessment.factors.join('; '),
        requiresAdminReview: true,
        riskScore: riskAssessment.score,
        riskFactors: riskAssessment.factors,
        estimatedProcessingTime: 'Pending admin review',
      };
    }

    if (
      request.amount <= this.config.autoApproveThreshold &&
      riskAssessment.recommendation === 'approve'
    ) {
      const payout = await this.createAndProcessPayout(request, true);
      return {
        approved: true,
        autoApproved: true,
        flagged: false,
        requiresAdminReview: false,
        riskScore: riskAssessment.score,
        riskFactors: riskAssessment.factors,
        estimatedProcessingTime: 'Processing immediately',
        payoutId: payout.id,
      };
    }

    if (request.amount > this.config.highRiskThreshold) {
      const payout = await this.createPendingPayout(request);
      await this.flagPayout(request, ['High value payout requires review']);
      return {
        approved: false,
        autoApproved: false,
        flagged: true,
        flagReason: 'High value payout requires admin approval',
        requiresAdminReview: true,
        riskScore: riskAssessment.score,
        riskFactors: riskAssessment.factors,
        estimatedProcessingTime: '24-48 hours pending review',
        payoutId: payout.id,
      };
    }

    const payout = await this.createAndProcessPayout(request, false);
    return {
      approved: true,
      autoApproved: false,
      flagged: riskAssessment.factors.length > 0,
      flagReason: riskAssessment.factors.length > 0 
        ? riskAssessment.factors.join('; ') 
        : undefined,
      requiresAdminReview: false,
      riskScore: riskAssessment.score,
      riskFactors: riskAssessment.factors,
      estimatedProcessingTime: `${this.config.standardPayoutDelay} business days`,
      payoutId: payout.id,
    };
  }

  private async assessRisk(request: PayoutRequest): Promise<RiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    const accountAge = await this.getAccountAgeInDays(request.ownerId, request.ownerType);
    if (accountAge < this.config.minimumAccountAge) {
      score += 30;
      factors.push(`New account (${accountAge} days old)`);
    }

    const completedTrips = await this.getCompletedTripsCount(request.ownerId, request.ownerType);
    if (completedTrips < this.config.minimumCompletedTrips) {
      score += 20;
      factors.push(`Low activity (${completedTrips} completed trips)`);
    }

    const recentPayouts = await this.getRecentPayoutsCount(request.ownerId, 24);
    if (recentPayouts >= this.config.suspiciousPatternThreshold) {
      score += 40;
      factors.push(`Unusual payout frequency (${recentPayouts} in 24h)`);
    }

    const wallet = await prisma.wallet.findFirst({
      where: { ownerId: request.ownerId },
    });
    if (wallet && Number(wallet.negativeBalance) > 0) {
      score += 25;
      factors.push('Outstanding negative balance');
    }

    const hasFraudAlerts = await this.checkFraudAlerts(request.ownerId);
    if (hasFraudAlerts) {
      score += 50;
      factors.push('Previous fraud alerts on account');
    }

    const payoutMethodAge = await this.getPayoutMethodAge(request.payoutMethodId);
    if (payoutMethodAge !== null && payoutMethodAge < 3) {
      score += 15;
      factors.push('Recently added payout method');
    }

    let recommendation: 'approve' | 'review' | 'reject';
    if (score >= 70) {
      recommendation = 'reject';
    } else if (score >= 40) {
      recommendation = 'review';
    } else {
      recommendation = 'approve';
    }

    return { score, factors, recommendation };
  }

  private async checkLimits(request: PayoutRequest): Promise<{ passed: boolean; reason?: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [dailyTotal, weeklyTotal] = await Promise.all([
      prisma.payout.aggregate({
        where: {
          ownerId: request.ownerId,
          createdAt: { gte: today },
          status: { not: 'failed' },
        },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: {
          ownerId: request.ownerId,
          createdAt: { gte: weekAgo },
          status: { not: 'failed' },
        },
        _sum: { amount: true },
      }),
    ]);

    const dailyPayoutTotal = Number(dailyTotal._sum.amount || 0);
    const weeklyPayoutTotal = Number(weeklyTotal._sum.amount || 0);

    if (dailyPayoutTotal + request.amount > this.config.dailyLimitPerPartner) {
      return {
        passed: false,
        reason: `Daily limit exceeded (${dailyPayoutTotal}/${this.config.dailyLimitPerPartner})`,
      };
    }

    if (weeklyPayoutTotal + request.amount > this.config.weeklyLimitPerPartner) {
      return {
        passed: false,
        reason: `Weekly limit exceeded (${weeklyPayoutTotal}/${this.config.weeklyLimitPerPartner})`,
      };
    }

    return { passed: true };
  }

  private async getAccountAgeInDays(ownerId: string, ownerType: string): Promise<number> {
    let profile;
    
    switch (ownerType) {
      case 'driver':
        profile = await prisma.driverProfile.findUnique({
          where: { id: ownerId },
          select: { createdAt: true },
        });
        break;
      case 'restaurant':
        profile = await prisma.restaurantProfile.findUnique({
          where: { id: ownerId },
          select: { createdAt: true },
        });
        break;
      case 'shop_partner':
        profile = await prisma.shopPartnerProfile.findUnique({
          where: { id: ownerId },
          select: { createdAt: true },
        });
        break;
      default:
        return 365;
    }

    if (!profile) return 0;
    return Math.floor((Date.now() - profile.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  }

  private async getCompletedTripsCount(ownerId: string, ownerType: string): Promise<number> {
    switch (ownerType) {
      case 'driver':
        return prisma.ride.count({
          where: { driverId: ownerId, status: 'completed' },
        });
      case 'restaurant':
        return prisma.foodOrder.count({
          where: { restaurantId: ownerId, status: 'delivered' },
        });
      case 'shop_partner':
        return prisma.productOrder.count({
          where: { shopPartnerId: ownerId, status: 'delivered' },
        });
      default:
        return 100;
    }
  }

  private async getRecentPayoutsCount(ownerId: string, hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return prisma.payout.count({
      where: {
        ownerId,
        createdAt: { gte: since },
      },
    });
  }

  private async checkFraudAlerts(ownerId: string): Promise<boolean> {
    const alerts = await prisma.automationLog.count({
      where: {
        automationType: 'fraud_detection',
        entityId: ownerId,
        status: { in: ['flagged', 'confirmed'] },
      },
    });
    return alerts > 0;
  }

  private async getPayoutMethodAge(payoutMethodId?: string): Promise<number | null> {
    if (!payoutMethodId) return null;
    
    const method = await prisma.restaurantPayoutMethod.findUnique({
      where: { id: payoutMethodId },
      select: { createdAt: true },
    });

    if (!method) return null;
    return Math.floor((Date.now() - method.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  }

  private async createAndProcessPayout(
    request: PayoutRequest,
    immediate: boolean
  ): Promise<any> {
    const wallet = await prisma.wallet.findFirst({
      where: { ownerId: request.ownerId },
    });

    if (!wallet || Number(wallet.availableBalance) < request.amount) {
      throw new Error('Insufficient balance');
    }

    const payout = await prisma.$transaction(async (tx) => {
      const newPayout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          countryCode: request.countryCode,
          ownerType: request.ownerType as any,
          ownerId: request.ownerId,
          amount: new Prisma.Decimal(request.amount),
          feeAmount: immediate 
            ? new Prisma.Decimal(request.amount * this.config.instantPayoutFee / 100) 
            : new Prisma.Decimal(0),
          netAmount: immediate 
            ? new Prisma.Decimal(request.amount * (1 - this.config.instantPayoutFee / 100))
            : new Prisma.Decimal(request.amount),
          method: request.method as any,
          status: immediate ? 'processing' : 'pending',
          payoutMethodId: request.payoutMethodId,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: {
            decrement: request.amount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: wallet.ownerType,
          countryCode: wallet.countryCode,
          serviceType: 'payout',
          direction: 'debit',
          amount: new Prisma.Decimal(request.amount),
          balanceSnapshot: new Prisma.Decimal(Number(wallet.availableBalance) - request.amount),
          negativeBalanceSnapshot: wallet.negativeBalance,
          referenceType: 'payout',
          referenceId: newPayout.id,
          description: `Payout request - ${request.method}`,
        },
      });

      return newPayout;
    });

    await this.logPayout(request, payout, immediate ? 'auto_approved' : 'approved');

    return payout;
  }

  private async createPendingPayout(request: PayoutRequest): Promise<any> {
    const wallet = await prisma.wallet.findFirst({
      where: { ownerId: request.ownerId },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const payout = await prisma.payout.create({
      data: {
        walletId: wallet.id,
        countryCode: request.countryCode,
        ownerType: request.ownerType as any,
        ownerId: request.ownerId,
        amount: new Prisma.Decimal(request.amount),
        feeAmount: new Prisma.Decimal(0),
        netAmount: new Prisma.Decimal(request.amount),
        method: request.method as any,
        status: 'pending',
        payoutMethodId: request.payoutMethodId,
      },
    });

    await this.logPayout(request, payout, 'pending_review');

    return payout;
  }

  private async flagPayout(request: PayoutRequest, reasons: string[]): Promise<void> {
    await prisma.automationLog.create({
      data: {
        automationType: 'payout_risk',
        entityType: request.ownerType,
        entityId: request.ownerId,
        status: 'flagged',
        metadata: {
          amount: request.amount,
          method: request.method,
          reasons,
          requestedBy: request.requestedBy,
        },
      },
    });
  }

  private async logPayout(
    request: PayoutRequest,
    payout: any,
    status: string
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'auto_payout',
          entityType: request.ownerType,
          entityId: request.ownerId,
          status,
          score: request.amount,
          metadata: {
            payoutId: payout.id,
            amount: request.amount,
            method: request.method,
            requestedBy: request.requestedBy,
          },
        },
      });
    } catch (error) {
      console.error('[AutoPayoutService] Failed to log payout:', error);
    }
  }

  async adminApprove(
    payoutId: string,
    adminId: string,
    notes?: string
  ): Promise<void> {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout || payout.status !== 'pending') {
      throw new Error('Payout not found or not pending');
    }

    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payoutId },
        data: { status: 'processing' },
      });

      const wallet = await tx.wallet.findUnique({
        where: { id: payout.walletId },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: {
              decrement: Number(payout.amount),
            },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: wallet.ownerType,
            countryCode: wallet.countryCode,
            serviceType: 'payout',
            direction: 'debit',
            amount: payout.amount,
            balanceSnapshot: new Prisma.Decimal(Number(wallet.availableBalance) - Number(payout.amount)),
            negativeBalanceSnapshot: wallet.negativeBalance,
            referenceType: 'payout',
            referenceId: payoutId,
            description: `Payout approved by admin ${adminId}`,
            createdByAdminId: adminId,
          },
        });
      }
    });

    await prisma.automationLog.create({
      data: {
        automationType: 'auto_payout',
        entityType: 'admin_approval',
        entityId: payoutId,
        status: 'approved',
        metadata: { adminId, notes },
      },
    });
  }

  async adminReject(
    payoutId: string,
    adminId: string,
    reason: string
  ): Promise<void> {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'failed',
        failureReason: reason,
      },
    });

    await prisma.automationLog.create({
      data: {
        automationType: 'auto_payout',
        entityType: 'admin_rejection',
        entityId: payoutId,
        status: 'rejected',
        metadata: { adminId, reason },
      },
    });
  }

  async getPendingPayouts(limit: number = 50): Promise<any[]> {
    return prisma.payout.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getFlaggedPayouts(limit: number = 50): Promise<any[]> {
    return prisma.automationLog.findMany({
      where: {
        automationType: 'payout_risk',
        status: 'flagged',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  updateConfig(newConfig: Partial<PayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): PayoutConfig {
    return { ...this.config };
  }
}

export const autoPayoutService = AutoPayoutService.getInstance();
