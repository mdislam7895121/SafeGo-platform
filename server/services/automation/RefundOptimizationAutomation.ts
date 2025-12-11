/**
 * SafeGo Refund Optimization Automation Service (Module 16)
 * Auto-determines optimal refund decisions based on:
 * - Issue type and severity analysis
 * - Customer refund history and abuse patterns
 * - Partner complaint history
 * - Fault party determination with confidence scoring
 * - Auto-approval within thresholds, manual review above thresholds
 * Uses RefundDecision model from schema with RefundDecisionType and RefundFaultParty enums
 */

import { prisma } from '../../db';

type RefundDecisionType = 'no_refund' | 'partial_refund' | 'full_refund' | 'credit_only' | 'replacement';
type RefundFaultParty = 'customer' | 'driver' | 'restaurant' | 'shop' | 'system' | 'unknown';
type OrderType = 'ride' | 'food' | 'parcel' | 'shop' | 'ticket' | 'rental';

interface IssueAnalysis {
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  orderType: OrderType;
  orderId: string;
  originalAmount: number;
  complaintId?: string;
}

interface CustomerHistory {
  totalOrders: number;
  refundCount: number;
  refundRate: number;
  totalRefundAmount: number;
  lastRefundDate: Date | null;
  abuseScore: number;
  loyaltyTier: 'new' | 'regular' | 'loyal' | 'vip';
}

interface PartnerHistory {
  partnerId: string;
  partnerType: 'driver' | 'restaurant' | 'shop';
  totalOrders: number;
  complaintCount: number;
  complaintRate: number;
  averageRating: number;
  recentIssues: number;
}

interface RefundRecommendation {
  decisionType: RefundDecisionType;
  faultParty: RefundFaultParty;
  faultConfidence: number;
  recommendedAmount: number;
  autoApproved: boolean;
  requiresManualReview: boolean;
  autoApprovalReason: string | null;
  decisionFactors: Record<string, any>;
}

interface RefundOptimizationConfig {
  enabled: boolean;
  scanIntervalMs: number;
  issueTypeWeights: Record<string, number>;
  autoApproval: {
    enabled: boolean;
    maxAmountThreshold: number;
    maxRefundRateThreshold: number;
    minFaultConfidenceThreshold: number;
    excludeRepeatOffenders: boolean;
    repeatOffenderThreshold: number;
  };
  refundPercentages: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  faultDetermination: {
    customerFaultIndicators: string[];
    driverFaultIndicators: string[];
    restaurantFaultIndicators: string[];
    shopFaultIndicators: string[];
    systemFaultIndicators: string[];
  };
  customerHistory: {
    lookbackDays: number;
    maxRefundsPerMonth: number;
    abuseScoreThreshold: number;
    loyaltyBonus: Record<string, number>;
  };
  partnerHistory: {
    lookbackDays: number;
    highComplaintRateThreshold: number;
    recentIssueWindowDays: number;
  };
  creditOnlyThreshold: {
    enabled: boolean;
    minAmountForCash: number;
    creditMultiplier: number;
  };
}

class RefundOptimizationAutomation {
  private static instance: RefundOptimizationAutomation;
  private config: RefundOptimizationConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 300000,
      issueTypeWeights: {
        late_delivery: 0.6,
        wrong_item: 0.8,
        damaged: 0.9,
        not_received: 1.0,
        quality_issue: 0.7,
        missing_items: 0.75,
        driver_behavior: 0.5,
        safety_concern: 1.0,
        payment_issue: 0.8,
        cancellation: 0.4,
      },
      autoApproval: {
        enabled: true,
        maxAmountThreshold: 50,
        maxRefundRateThreshold: 0.15,
        minFaultConfidenceThreshold: 0.7,
        excludeRepeatOffenders: true,
        repeatOffenderThreshold: 3,
      },
      refundPercentages: {
        low: 0.25,
        medium: 0.50,
        high: 0.75,
        critical: 1.0,
      },
      faultDetermination: {
        customerFaultIndicators: ['no_show', 'wrong_address', 'late_cancel', 'refused_delivery', 'customer_error'],
        driverFaultIndicators: ['late_delivery', 'rude_driver', 'wrong_route', 'damaged_in_transit', 'no_show_driver'],
        restaurantFaultIndicators: ['wrong_item', 'missing_items', 'quality_issue', 'cold_food', 'late_preparation'],
        shopFaultIndicators: ['wrong_product', 'damaged_product', 'missing_product', 'quality_defect'],
        systemFaultIndicators: ['payment_error', 'app_crash', 'dispatch_failure', 'system_timeout'],
      },
      customerHistory: {
        lookbackDays: 90,
        maxRefundsPerMonth: 3,
        abuseScoreThreshold: 70,
        loyaltyBonus: {
          new: 0,
          regular: 5,
          loyal: 10,
          vip: 20,
        },
      },
      partnerHistory: {
        lookbackDays: 30,
        highComplaintRateThreshold: 0.1,
        recentIssueWindowDays: 7,
      },
      creditOnlyThreshold: {
        enabled: true,
        minAmountForCash: 10,
        creditMultiplier: 1.15,
      },
    };
  }

  static getInstance(): RefundOptimizationAutomation {
    if (!RefundOptimizationAutomation.instance) {
      RefundOptimizationAutomation.instance = new RefundOptimizationAutomation();
    }
    return RefundOptimizationAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runRefundOptimizationScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('REFUND_OPTIMIZATION', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[RefundOptimization] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[RefundOptimization] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: RefundOptimizationConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<RefundOptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): RefundOptimizationConfig {
    return this.config;
  }

  async analyzeRefundRequest(
    customerId: string,
    issue: IssueAnalysis,
    partnerId?: string,
    partnerType?: 'driver' | 'restaurant' | 'shop'
  ): Promise<RefundRecommendation> {
    const [customerHistory, partnerHistory] = await Promise.all([
      this.getCustomerHistory(customerId),
      partnerId && partnerType ? this.getPartnerHistory(partnerId, partnerType) : null,
    ]);

    const { faultParty, faultConfidence } = this.determineFaultParty(
      issue,
      customerHistory,
      partnerHistory
    );

    const decisionType = this.determineDecisionType(
      issue,
      faultParty,
      faultConfidence,
      customerHistory
    );

    const recommendedAmount = this.calculateRefundAmount(
      issue.originalAmount,
      issue.severity,
      decisionType,
      customerHistory
    );

    const { autoApproved, requiresManualReview, reason } = this.determineApprovalStatus(
      recommendedAmount,
      faultConfidence,
      customerHistory,
      decisionType
    );

    const decisionFactors = {
      issueSeverity: issue.severity,
      issueType: issue.issueType,
      issueWeight: this.config.issueTypeWeights[issue.issueType] || 0.5,
      customerRefundRate: customerHistory.refundRate,
      customerAbuseScore: customerHistory.abuseScore,
      customerLoyaltyTier: customerHistory.loyaltyTier,
      partnerComplaintRate: partnerHistory?.complaintRate || 0,
      partnerRecentIssues: partnerHistory?.recentIssues || 0,
      faultPartyDetermination: faultParty,
      faultConfidenceLevel: faultConfidence,
      originalAmount: issue.originalAmount,
      calculatedRefundPercentage: recommendedAmount / issue.originalAmount,
    };

    await this.saveRefundDecision(
      issue,
      customerId,
      partnerId,
      {
        decisionType,
        faultParty,
        faultConfidence,
        recommendedAmount,
        autoApproved,
        requiresManualReview,
        autoApprovalReason: reason,
        decisionFactors,
      },
      customerHistory,
      partnerHistory
    );

    await this.logAutomation('REFUND_OPTIMIZATION', customerId, 'refund_analyzed', {
      orderId: issue.orderId,
      orderType: issue.orderType,
      decisionType,
      faultParty,
      faultConfidence,
      recommendedAmount,
      autoApproved,
      requiresManualReview,
    });

    return {
      decisionType,
      faultParty,
      faultConfidence,
      recommendedAmount,
      autoApproved,
      requiresManualReview,
      autoApprovalReason: reason,
      decisionFactors,
    };
  }

  private async getCustomerHistory(customerId: string): Promise<CustomerHistory> {
    const lookbackDate = new Date(Date.now() - this.config.customerHistory.lookbackDays * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalRides, totalFoodOrders, refundDecisions, riskScore] = await Promise.all([
      prisma.ride.count({ where: { customerId, createdAt: { gte: lookbackDate } } }),
      prisma.foodOrder.count({ where: { customerId, createdAt: { gte: lookbackDate } } }),
      prisma.refundDecision.findMany({
        where: {
          customerHistory: { path: ['customerId'], equals: customerId },
          createdAt: { gte: lookbackDate },
        },
        select: {
          actualRefund: true,
          createdAt: true,
        },
      }),
      prisma.riskScore.findFirst({
        where: { entityId: customerId, entityType: 'customer', scoreType: 'customer_abuse' },
        select: { score: true },
      }),
    ]);

    const totalOrders = totalRides + totalFoodOrders;
    const refundCount = refundDecisions.length;
    const refundRate = totalOrders > 0 ? refundCount / totalOrders : 0;
    const totalRefundAmount = refundDecisions.reduce(
      (sum, r) => sum + (r.actualRefund ? Number(r.actualRefund) : 0),
      0
    );

    const lastRefund = refundDecisions
      .filter(r => r.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const abuseScore = riskScore?.score || 0;

    let loyaltyTier: 'new' | 'regular' | 'loyal' | 'vip' = 'new';
    if (totalOrders >= 100) {
      loyaltyTier = 'vip';
    } else if (totalOrders >= 50) {
      loyaltyTier = 'loyal';
    } else if (totalOrders >= 10) {
      loyaltyTier = 'regular';
    }

    return {
      totalOrders,
      refundCount,
      refundRate,
      totalRefundAmount,
      lastRefundDate: lastRefund?.createdAt || null,
      abuseScore,
      loyaltyTier,
    };
  }

  private async getPartnerHistory(partnerId: string, partnerType: 'driver' | 'restaurant' | 'shop'): Promise<PartnerHistory> {
    const lookbackDate = new Date(Date.now() - this.config.partnerHistory.lookbackDays * 24 * 60 * 60 * 1000);
    const recentDate = new Date(Date.now() - this.config.partnerHistory.recentIssueWindowDays * 24 * 60 * 60 * 1000);

    let totalOrders = 0;
    let averageRating = 0;

    if (partnerType === 'driver') {
      const [rides, driverProfile] = await Promise.all([
        prisma.ride.count({ where: { driverId: partnerId, createdAt: { gte: lookbackDate } } }),
        prisma.driverProfile.findFirst({ where: { id: partnerId }, select: { rating: true } }),
      ]);
      totalOrders = rides;
      averageRating = driverProfile?.rating || 0;
    } else if (partnerType === 'restaurant') {
      const [orders, restaurant] = await Promise.all([
        prisma.foodOrder.count({ where: { restaurantId: partnerId, createdAt: { gte: lookbackDate } } }),
        prisma.restaurantProfile.findFirst({ where: { id: partnerId }, select: { rating: true } }),
      ]);
      totalOrders = orders;
      averageRating = restaurant?.rating || 0;
    } else if (partnerType === 'shop') {
      const [orders, shop] = await Promise.all([
        prisma.productOrder.count({ where: { shopId: partnerId, createdAt: { gte: lookbackDate } } }),
        prisma.shopPartner.findFirst({ where: { id: partnerId }, select: { rating: true } }),
      ]);
      totalOrders = orders;
      averageRating = shop?.rating || 0;
    }

    const complaints = await prisma.refundDecision.count({
      where: {
        partnerHistory: { path: ['partnerId'], equals: partnerId },
        createdAt: { gte: lookbackDate },
      },
    });

    const recentIssues = await prisma.refundDecision.count({
      where: {
        partnerHistory: { path: ['partnerId'], equals: partnerId },
        createdAt: { gte: recentDate },
      },
    });

    const complaintRate = totalOrders > 0 ? complaints / totalOrders : 0;

    return {
      partnerId,
      partnerType,
      totalOrders,
      complaintCount: complaints,
      complaintRate,
      averageRating,
      recentIssues,
    };
  }

  private determineFaultParty(
    issue: IssueAnalysis,
    customerHistory: CustomerHistory,
    partnerHistory: PartnerHistory | null
  ): { faultParty: RefundFaultParty; faultConfidence: number } {
    const { faultDetermination } = this.config;
    let scores: Record<RefundFaultParty, number> = {
      customer: 0,
      driver: 0,
      restaurant: 0,
      shop: 0,
      system: 0,
      unknown: 0.1,
    };

    const issueType = issue.issueType.toLowerCase();

    if (faultDetermination.customerFaultIndicators.some(ind => issueType.includes(ind))) {
      scores.customer += 0.7;
    }
    if (faultDetermination.driverFaultIndicators.some(ind => issueType.includes(ind))) {
      scores.driver += 0.7;
    }
    if (faultDetermination.restaurantFaultIndicators.some(ind => issueType.includes(ind))) {
      scores.restaurant += 0.7;
    }
    if (faultDetermination.shopFaultIndicators.some(ind => issueType.includes(ind))) {
      scores.shop += 0.7;
    }
    if (faultDetermination.systemFaultIndicators.some(ind => issueType.includes(ind))) {
      scores.system += 0.7;
    }

    if (customerHistory.abuseScore > this.config.customerHistory.abuseScoreThreshold) {
      scores.customer += 0.3;
    }

    if (customerHistory.refundRate > 0.2) {
      scores.customer += 0.2;
    }

    if (partnerHistory) {
      if (partnerHistory.complaintRate > this.config.partnerHistory.highComplaintRateThreshold) {
        scores[partnerHistory.partnerType] += 0.25;
      }
      if (partnerHistory.recentIssues >= 3) {
        scores[partnerHistory.partnerType] += 0.2;
      }
      if (partnerHistory.averageRating < 3.5) {
        scores[partnerHistory.partnerType] += 0.15;
      }
    }

    if (issue.orderType === 'food') {
      scores.restaurant += 0.1;
    } else if (issue.orderType === 'ride') {
      scores.driver += 0.1;
    } else if (issue.orderType === 'shop') {
      scores.shop += 0.1;
    }

    const maxScore = Math.max(...Object.values(scores));
    const faultParty = (Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'unknown') as RefundFaultParty;

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const faultConfidence = totalScore > 0 ? Math.min(maxScore / totalScore + 0.3, 1) : 0.5;

    return { faultParty, faultConfidence };
  }

  private determineDecisionType(
    issue: IssueAnalysis,
    faultParty: RefundFaultParty,
    faultConfidence: number,
    customerHistory: CustomerHistory
  ): RefundDecisionType {
    if (faultParty === 'customer' && faultConfidence > 0.8) {
      return 'no_refund';
    }

    if (customerHistory.abuseScore > this.config.customerHistory.abuseScoreThreshold) {
      return 'no_refund';
    }

    const issueWeight = this.config.issueTypeWeights[issue.issueType] || 0.5;

    if (issue.severity === 'critical' || (issueWeight >= 0.9 && faultParty !== 'customer')) {
      if (issue.orderType === 'food' || issue.orderType === 'shop') {
        if (issue.issueType === 'wrong_item' || issue.issueType === 'wrong_product') {
          return 'replacement';
        }
      }
      return 'full_refund';
    }

    if (issue.severity === 'high' || issueWeight >= 0.7) {
      if (this.config.creditOnlyThreshold.enabled && 
          issue.originalAmount < this.config.creditOnlyThreshold.minAmountForCash) {
        return 'credit_only';
      }
      return 'partial_refund';
    }

    if (issue.severity === 'medium') {
      return 'credit_only';
    }

    if (customerHistory.loyaltyTier === 'vip' || customerHistory.loyaltyTier === 'loyal') {
      return 'credit_only';
    }

    return 'no_refund';
  }

  private calculateRefundAmount(
    originalAmount: number,
    severity: 'low' | 'medium' | 'high' | 'critical',
    decisionType: RefundDecisionType,
    customerHistory: CustomerHistory
  ): number {
    if (decisionType === 'no_refund') {
      return 0;
    }

    if (decisionType === 'full_refund') {
      return originalAmount;
    }

    if (decisionType === 'replacement') {
      return 0;
    }

    let refundPercentage = this.config.refundPercentages[severity];

    const loyaltyBonus = this.config.customerHistory.loyaltyBonus[customerHistory.loyaltyTier] || 0;
    refundPercentage = Math.min(refundPercentage + (loyaltyBonus / 100), 1);

    if (decisionType === 'credit_only') {
      refundPercentage *= this.config.creditOnlyThreshold.creditMultiplier;
    }

    return Math.round(originalAmount * refundPercentage * 100) / 100;
  }

  private determineApprovalStatus(
    amount: number,
    faultConfidence: number,
    customerHistory: CustomerHistory,
    decisionType: RefundDecisionType
  ): { autoApproved: boolean; requiresManualReview: boolean; reason: string | null } {
    if (!this.config.autoApproval.enabled) {
      return { autoApproved: false, requiresManualReview: true, reason: null };
    }

    if (decisionType === 'no_refund') {
      return { autoApproved: true, requiresManualReview: false, reason: 'No refund required - auto-approved' };
    }

    if (this.config.autoApproval.excludeRepeatOffenders && 
        customerHistory.refundCount >= this.config.autoApproval.repeatOffenderThreshold) {
      return { 
        autoApproved: false, 
        requiresManualReview: true, 
        reason: null 
      };
    }

    if (amount > this.config.autoApproval.maxAmountThreshold) {
      return { 
        autoApproved: false, 
        requiresManualReview: true, 
        reason: null 
      };
    }

    if (customerHistory.refundRate > this.config.autoApproval.maxRefundRateThreshold) {
      return { 
        autoApproved: false, 
        requiresManualReview: true, 
        reason: null 
      };
    }

    if (faultConfidence < this.config.autoApproval.minFaultConfidenceThreshold) {
      return { 
        autoApproved: false, 
        requiresManualReview: true, 
        reason: null 
      };
    }

    const reasons: string[] = [];
    if (amount <= this.config.autoApproval.maxAmountThreshold) {
      reasons.push(`Amount $${amount} within threshold`);
    }
    if (faultConfidence >= this.config.autoApproval.minFaultConfidenceThreshold) {
      reasons.push(`High fault confidence (${Math.round(faultConfidence * 100)}%)`);
    }
    if (customerHistory.refundRate <= this.config.autoApproval.maxRefundRateThreshold) {
      reasons.push(`Low customer refund rate (${Math.round(customerHistory.refundRate * 100)}%)`);
    }

    return { 
      autoApproved: true, 
      requiresManualReview: false, 
      reason: reasons.join('; ') 
    };
  }

  private async saveRefundDecision(
    issue: IssueAnalysis,
    customerId: string,
    partnerId: string | undefined,
    recommendation: RefundRecommendation,
    customerHistory: CustomerHistory,
    partnerHistory: PartnerHistory | null
  ): Promise<void> {
    try {
      await prisma.refundDecision.create({
        data: {
          orderType: issue.orderType,
          orderId: issue.orderId,
          complaintId: issue.complaintId,
          issueType: issue.issueType,
          issueDescription: issue.description,
          originalAmount: issue.originalAmount,
          recommendedRefund: recommendation.recommendedAmount,
          actualRefund: recommendation.autoApproved ? recommendation.recommendedAmount : null,
          decisionType: recommendation.decisionType,
          faultParty: recommendation.faultParty,
          faultConfidence: recommendation.faultConfidence,
          decisionFactors: recommendation.decisionFactors,
          customerHistory: {
            customerId,
            totalOrders: customerHistory.totalOrders,
            refundCount: customerHistory.refundCount,
            refundRate: customerHistory.refundRate,
            abuseScore: customerHistory.abuseScore,
            loyaltyTier: customerHistory.loyaltyTier,
          },
          partnerHistory: partnerHistory ? {
            partnerId: partnerHistory.partnerId,
            partnerType: partnerHistory.partnerType,
            complaintRate: partnerHistory.complaintRate,
            recentIssues: partnerHistory.recentIssues,
            averageRating: partnerHistory.averageRating,
          } : null,
          autoApproved: recommendation.autoApproved,
          autoApprovedReason: recommendation.autoApprovalReason,
          requiresManualReview: recommendation.requiresManualReview,
          processingStatus: recommendation.autoApproved ? 'processing' : 'pending',
        },
      });
    } catch (error) {
      console.error('[RefundOptimization] Failed to save decision:', error);
    }
  }

  async runRefundOptimizationScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const pendingDecisions = await prisma.refundDecision.findMany({
        where: {
          processingStatus: 'processing',
          autoApproved: true,
          refundProcessedAt: null,
        },
        take: 50,
      });

      let processedCount = 0;
      let failedCount = 0;

      for (const decision of pendingDecisions) {
        try {
          await prisma.refundDecision.update({
            where: { id: decision.id },
            data: {
              processingStatus: 'completed',
              refundProcessedAt: new Date(),
              customerNotified: true,
              partnerNotified: decision.faultParty !== 'customer' && decision.faultParty !== 'unknown',
            },
          });
          processedCount++;
        } catch (error) {
          await prisma.refundDecision.update({
            where: { id: decision.id },
            data: { processingStatus: 'failed' },
          });
          failedCount++;
        }
      }

      await this.logAutomation('REFUND_OPTIMIZATION', 'SYSTEM', 'scan_completed', {
        pendingDecisions: pendingDecisions.length,
        processed: processedCount,
        failed: failedCount,
      });
    } catch (error) {
      console.error('[RefundOptimization] Scan error:', error);
      await this.logAutomation('REFUND_OPTIMIZATION', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  async getRefundStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, byDecisionType, byFaultParty, byStatus, autoApproved] = await Promise.all([
      prisma.refundDecision.count({ where: { createdAt: { gte: startDate } } }),
      prisma.refundDecision.groupBy({
        by: ['decisionType'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
        _sum: { recommendedRefund: true },
      }),
      prisma.refundDecision.groupBy({
        by: ['faultParty'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
      }),
      prisma.refundDecision.groupBy({
        by: ['processingStatus'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
      }),
      prisma.refundDecision.count({
        where: { createdAt: { gte: startDate }, autoApproved: true },
      }),
    ]);

    return {
      totalDecisions: total,
      autoApprovalRate: total > 0 ? (autoApproved / total) * 100 : 0,
      byDecisionType: Object.fromEntries(
        byDecisionType.map(d => [d.decisionType, { count: d._count.id, totalAmount: d._sum.recommendedRefund }])
      ),
      byFaultParty: Object.fromEntries(byFaultParty.map(f => [f.faultParty, f._count.id])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.processingStatus, s._count.id])),
    };
  }

  async getPendingReviews(limit: number = 20): Promise<any[]> {
    return prisma.refundDecision.findMany({
      where: {
        requiresManualReview: true,
        processingStatus: 'pending',
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async approveRefund(decisionId: string, adminId: string, notes?: string, modifiedAmount?: number): Promise<void> {
    const decision = await prisma.refundDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new Error('Decision not found');

    await prisma.refundDecision.update({
      where: { id: decisionId },
      data: {
        adminReviewedBy: adminId,
        adminReviewedAt: new Date(),
        adminDecision: 'approved',
        adminNotes: notes,
        actualRefund: modifiedAmount !== undefined ? modifiedAmount : decision.recommendedRefund,
        processingStatus: 'processing',
      },
    });

    await this.logAutomation('REFUND_OPTIMIZATION', adminId, 'admin_approved', {
      decisionId,
      originalAmount: decision.recommendedRefund,
      approvedAmount: modifiedAmount !== undefined ? modifiedAmount : decision.recommendedRefund,
    });
  }

  async rejectRefund(decisionId: string, adminId: string, notes: string): Promise<void> {
    await prisma.refundDecision.update({
      where: { id: decisionId },
      data: {
        adminReviewedBy: adminId,
        adminReviewedAt: new Date(),
        adminDecision: 'rejected',
        adminNotes: notes,
        actualRefund: 0,
        processingStatus: 'completed',
      },
    });

    await this.logAutomation('REFUND_OPTIMIZATION', adminId, 'admin_rejected', {
      decisionId,
      reason: notes,
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
          entityType: 'refund',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[RefundOptimization] Log error:', error);
    }
  }
}

export const refundOptimizationAutomation = RefundOptimizationAutomation.getInstance();
export { RefundOptimizationAutomation };
