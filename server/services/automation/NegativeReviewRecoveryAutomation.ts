/**
 * SafeGo Negative Review Recovery Automation Service (Module 9)
 * Detects negative reviews and auto-generates recovery plans
 * - Detect reviews <= 3 stars
 * - Auto-generate apology + optional coupon
 * - Log in admin dashboard
 */

import { prisma } from '../../db';

interface ReviewRecoveryConfig {
  enabled: boolean;
  scanIntervalMs: number;
  detection: {
    minRatingForRecovery: number;
    severityThresholds: {
      mild: number;
      moderate: number;
      severe: number;
    };
  };
  actions: {
    autoApologyEnabled: boolean;
    autoCouponEnabled: boolean;
    autoEscalateEnabled: boolean;
    couponValues: {
      mild: number;
      moderate: number;
      severe: number;
    };
    couponType: 'percentage' | 'fixed_amount';
  };
  notifications: {
    notifyCustomer: boolean;
    notifyPartner: boolean;
    notifyAdmin: boolean;
    adminAlertThreshold: number;
  };
  followUp: {
    enabled: boolean;
    followUpDelayHours: number;
    maxFollowUps: number;
  };
}

interface ReviewData {
  id: string;
  rating: number;
  reviewText: string | null;
  reviewType: string;
  entityType: string;
  entityId: string;
  customerId: string;
  createdAt: Date;
}

class NegativeReviewRecoveryAutomation {
  private static instance: NegativeReviewRecoveryAutomation;
  private config: ReviewRecoveryConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  private apologyTemplates: Record<string, string[]> = {
    mild: [
      "We're sorry your experience didn't meet expectations. We value your feedback and are working to improve.",
      "Thank you for your honest feedback. We apologize for any inconvenience and will use this to do better.",
    ],
    moderate: [
      "We sincerely apologize for the experience you had. Your satisfaction is important to us, and we're committed to making it right.",
      "We're truly sorry for falling short of your expectations. Please accept our apology and this token of appreciation.",
    ],
    severe: [
      "We deeply apologize for the experience you had with us. This is not the standard we strive for, and we take your feedback very seriously.",
      "We are extremely sorry for the poor experience. Your feedback has been escalated to our management team for immediate action.",
    ],
  };

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 300000, // 5 minutes
      detection: {
        minRatingForRecovery: 3,
        severityThresholds: {
          mild: 3,
          moderate: 2,
          severe: 1,
        },
      },
      actions: {
        autoApologyEnabled: true,
        autoCouponEnabled: true,
        autoEscalateEnabled: true,
        couponValues: {
          mild: 10,
          moderate: 15,
          severe: 25,
        },
        couponType: 'percentage',
      },
      notifications: {
        notifyCustomer: true,
        notifyPartner: true,
        notifyAdmin: true,
        adminAlertThreshold: 2,
      },
      followUp: {
        enabled: true,
        followUpDelayHours: 48,
        maxFollowUps: 2,
      },
    };
  }

  static getInstance(): NegativeReviewRecoveryAutomation {
    if (!NegativeReviewRecoveryAutomation.instance) {
      NegativeReviewRecoveryAutomation.instance = new NegativeReviewRecoveryAutomation();
    }
    return NegativeReviewRecoveryAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runReviewRecoveryScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('REVIEW_RECOVERY', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[ReviewRecovery] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[ReviewRecovery] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: ReviewRecoveryConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<ReviewRecoveryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): ReviewRecoveryConfig {
    return this.config;
  }

  async runReviewRecoveryScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const negativeReviews = await this.findUnprocessedNegativeReviews();

      for (const review of negativeReviews) {
        await this.processNegativeReview(review);
      }

      await this.processFollowUps();

      await this.logAutomation('REVIEW_RECOVERY', 'SYSTEM', 'scan_completed', {
        reviewsProcessed: negativeReviews.length,
      });
    } catch (error) {
      console.error('[ReviewRecovery] Scan error:', error);
      await this.logAutomation('REVIEW_RECOVERY', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private async findUnprocessedNegativeReviews(): Promise<ReviewData[]> {
    const reviews: ReviewData[] = [];

    const rideReviews = await prisma.review.findMany({
      where: {
        rating: { lte: this.config.detection.minRatingForRecovery },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      take: 100,
    });

    const processedReviewIds = await prisma.reviewRecoveryPlan.findMany({
      where: {
        reviewId: { in: rideReviews.map(r => r.id) },
      },
      select: { reviewId: true },
    });

    const processedIds = new Set(processedReviewIds.map(p => p.reviewId));

    for (const review of rideReviews) {
      if (!processedIds.has(review.id)) {
        reviews.push({
          id: review.id,
          rating: review.rating,
          reviewText: review.comment || null,
          reviewType: review.entityType === 'restaurant' ? 'food_order' : 'ride',
          entityType: review.entityType,
          entityId: review.entityId,
          customerId: review.customerId || '',
          createdAt: review.createdAt,
        });
      }
    }

    return reviews;
  }

  private async processNegativeReview(review: ReviewData): Promise<void> {
    const severity = this.determineSeverity(review.rating);
    const issueCategories = this.analyzeReviewText(review.reviewText);
    const recommendedAction = this.determineRecommendedAction(severity, issueCategories);

    let couponCode: string | undefined;
    let couponValue: number | undefined;

    if (this.config.actions.autoCouponEnabled && recommendedAction !== 'escalate') {
      couponCode = this.generateCouponCode();
      couponValue = this.config.actions.couponValues[severity];
    }

    const apologyMessage = this.generateApologyMessage(severity, issueCategories);

    const recoveryPlan = await prisma.reviewRecoveryPlan.create({
      data: {
        reviewId: review.id,
        reviewType: review.reviewType,
        entityType: review.entityType,
        entityId: review.entityId,
        customerId: review.customerId,
        rating: review.rating,
        reviewText: review.reviewText,
        severity,
        issueCategories,
        recommendedAction,
        couponCode,
        couponValue: couponValue ? couponValue : null,
        couponType: this.config.actions.couponType,
        apologyMessage,
        apologyMessageGenerated: true,
        status: 'pending',
        followUpAt: this.config.followUp.enabled
          ? new Date(Date.now() + this.config.followUp.followUpDelayHours * 60 * 60 * 1000)
          : null,
      },
    });

    if (this.config.notifications.notifyCustomer && this.config.actions.autoApologyEnabled) {
      await this.sendCustomerNotification(recoveryPlan.id, review.customerId, apologyMessage, couponCode);
    }

    if (this.config.notifications.notifyPartner) {
      await this.notifyPartner(review.entityType, review.entityId, review, severity);
    }

    if (this.config.notifications.notifyAdmin && review.rating <= this.config.notifications.adminAlertThreshold) {
      await this.createAdminAlert(recoveryPlan.id, review, severity);
    }

    await this.logAutomation('REVIEW_RECOVERY', review.customerId, 'recovery_plan_created', {
      planId: recoveryPlan.id,
      reviewId: review.id,
      severity,
      action: recommendedAction,
      couponGenerated: !!couponCode,
    });
  }

  private determineSeverity(rating: number): 'mild' | 'moderate' | 'severe' {
    if (rating <= this.config.detection.severityThresholds.severe) return 'severe';
    if (rating <= this.config.detection.severityThresholds.moderate) return 'moderate';
    return 'mild';
  }

  private analyzeReviewText(text: string | null): Record<string, boolean> {
    const categories: Record<string, boolean> = {
      late_delivery: false,
      quality_issue: false,
      wrong_order: false,
      poor_service: false,
      cleanliness: false,
      price_issue: false,
      communication: false,
    };

    if (!text) return categories;

    const lowerText = text.toLowerCase();

    if (lowerText.includes('late') || lowerText.includes('delay') || lowerText.includes('slow')) {
      categories.late_delivery = true;
    }
    if (lowerText.includes('quality') || lowerText.includes('bad') || lowerText.includes('cold') || lowerText.includes('stale')) {
      categories.quality_issue = true;
    }
    if (lowerText.includes('wrong') || lowerText.includes('mistake') || lowerText.includes('missing')) {
      categories.wrong_order = true;
    }
    if (lowerText.includes('rude') || lowerText.includes('service') || lowerText.includes('attitude')) {
      categories.poor_service = true;
    }
    if (lowerText.includes('dirty') || lowerText.includes('clean') || lowerText.includes('hygiene')) {
      categories.cleanliness = true;
    }
    if (lowerText.includes('expensive') || lowerText.includes('price') || lowerText.includes('overcharge')) {
      categories.price_issue = true;
    }
    if (lowerText.includes('contact') || lowerText.includes('call') || lowerText.includes('respond')) {
      categories.communication = true;
    }

    return categories;
  }

  private determineRecommendedAction(severity: string, categories: Record<string, boolean>): string {
    if (severity === 'severe') {
      return 'escalate';
    }

    const issueCount = Object.values(categories).filter(v => v).length;

    if (issueCount >= 3 || categories.cleanliness) {
      return 'escalate';
    }

    if (severity === 'moderate' || issueCount >= 2) {
      return 'coupon';
    }

    return 'apology';
  }

  private generateApologyMessage(severity: string, categories: Record<string, boolean>): string {
    const templates = this.apologyTemplates[severity] || this.apologyTemplates.mild;
    const baseMessage = templates[Math.floor(Math.random() * templates.length)];

    const issues = Object.entries(categories)
      .filter(([_, v]) => v)
      .map(([k]) => k.replace('_', ' '));

    if (issues.length > 0) {
      return `${baseMessage} We understand there were issues with: ${issues.join(', ')}.`;
    }

    return baseMessage;
  }

  private generateCouponCode(): string {
    const prefix = 'SORRY';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
  }

  private async sendCustomerNotification(
    planId: string,
    customerId: string,
    message: string,
    couponCode?: string
  ): Promise<void> {
    await prisma.reviewRecoveryPlan.update({
      where: { id: planId },
      data: {
        notificationSent: true,
        notificationSentAt: new Date(),
        status: 'action_taken',
      },
    });

    await this.logAutomation('REVIEW_RECOVERY', customerId, 'customer_notified', {
      planId,
      hasCoupon: !!couponCode,
    });
  }

  private async notifyPartner(entityType: string, entityId: string, review: ReviewData, severity: string): Promise<void> {
    await prisma.reviewRecoveryPlan.updateMany({
      where: { reviewId: review.id },
      data: {
        partnerNotified: true,
        partnerNotifiedAt: new Date(),
      },
    });

    await this.logAutomation('REVIEW_RECOVERY', entityId, 'partner_notified', {
      entityType,
      reviewId: review.id,
      severity,
    });
  }

  private async createAdminAlert(planId: string, review: ReviewData, severity: string): Promise<void> {
    await this.logAutomation('REVIEW_RECOVERY', 'ADMIN', 'admin_alert_created', {
      planId,
      reviewId: review.id,
      entityType: review.entityType,
      entityId: review.entityId,
      severity,
      rating: review.rating,
    });
  }

  private async processFollowUps(): Promise<void> {
    if (!this.config.followUp.enabled) return;

    const pendingFollowUps = await prisma.reviewRecoveryPlan.findMany({
      where: {
        status: 'action_taken',
        followUpAt: { lte: new Date() },
        resolvedAt: null,
      },
      take: 50,
    });

    for (const plan of pendingFollowUps) {
      await this.logAutomation('REVIEW_RECOVERY', plan.customerId, 'follow_up_processed', {
        planId: plan.id,
      });
    }
  }

  async getRecoveryStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const total = await prisma.reviewRecoveryPlan.count({
      where: { createdAt: { gte: startDate } },
    });

    const bySeverity = await prisma.reviewRecoveryPlan.groupBy({
      by: ['severity'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });

    const byStatus = await prisma.reviewRecoveryPlan.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });

    const resolved = await prisma.reviewRecoveryPlan.count({
      where: { createdAt: { gte: startDate }, status: 'resolved' },
    });

    return {
      total,
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count.id])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.id])),
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
    };
  }

  private async logAutomation(
    automationType: string,
    entityId: string,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType,
          entityId,
          action,
          metadata,
        },
      });
    } catch (error) {
      console.error('[ReviewRecovery] Failed to log automation:', error);
    }
  }
}

export const negativeReviewRecoveryAutomation = NegativeReviewRecoveryAutomation.getInstance();
export { NegativeReviewRecoveryAutomation };
