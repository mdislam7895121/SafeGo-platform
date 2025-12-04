/**
 * SafeGo AI Customer Support Automation
 * Handles automated customer support:
 * - Issue classification
 * - Auto refund decision logic
 * - Missing-item auto resolutions
 * - Ride delay auto analysis
 */

import { prisma } from '../../db';

type IssueCategory = 
  | 'RIDE_DELAY'
  | 'RIDE_CANCELLATION'
  | 'RIDE_WRONG_ROUTE'
  | 'RIDE_OVERCHARGE'
  | 'FOOD_MISSING_ITEM'
  | 'FOOD_WRONG_ORDER'
  | 'FOOD_QUALITY'
  | 'FOOD_LATE_DELIVERY'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_DOUBLE_CHARGE'
  | 'DRIVER_BEHAVIOR'
  | 'APP_ISSUE'
  | 'GENERAL_INQUIRY'
  | 'REFUND_REQUEST'
  | 'OTHER';

type ResolutionType = 
  | 'AUTO_REFUND'
  | 'PARTIAL_REFUND'
  | 'CREDIT_ISSUED'
  | 'ESCALATE_TO_HUMAN'
  | 'RESOLVED_WITH_INFO'
  | 'NO_ACTION_NEEDED'
  | 'PENDING_INVESTIGATION';

interface SupportTicket {
  id: string;
  userId: string;
  category: IssueCategory;
  subcategory?: string;
  description: string;
  orderId?: string;
  rideId?: string;
  amount?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  resolution?: ResolutionType;
  createdAt: Date;
}

interface RefundDecision {
  approved: boolean;
  amount: number;
  reason: string;
  confidence: number;
  requiresReview: boolean;
}

interface AICustomerSupportConfig {
  classification: {
    enabled: boolean;
    confidenceThreshold: number;
    autoAssignPriority: boolean;
  };
  autoRefund: {
    enabled: boolean;
    maxAutoRefundAmount: number;
    requireProof: boolean;
    cooldownHours: number;
    maxRefundsPerUser: number;
  };
  missingItem: {
    enabled: boolean;
    autoRefundPercentage: number;
    requirePhotos: boolean;
    maxItemValue: number;
  };
  rideDelay: {
    enabled: boolean;
    delayThresholdMinutes: number;
    compensationPerMinute: number;
    maxCompensation: number;
  };
  escalation: {
    escalateAfterMinutes: number;
    escalateOnLowConfidence: boolean;
    confidenceThreshold: number;
  };
}

class AICustomerSupportAutomation {
  private config: AICustomerSupportConfig;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private userRefundHistory: Map<string, { count: number; lastRefund: Date }> = new Map();

  private categoryKeywords: Record<IssueCategory, string[]> = {
    RIDE_DELAY: ['late', 'delay', 'waiting', 'took too long', 'slow'],
    RIDE_CANCELLATION: ['cancel', 'cancelled', 'driver cancelled', 'no show'],
    RIDE_WRONG_ROUTE: ['wrong route', 'longer route', 'different path', 'wrong way'],
    RIDE_OVERCHARGE: ['overcharged', 'too much', 'expensive', 'wrong fare', 'price'],
    FOOD_MISSING_ITEM: ['missing', 'not included', 'forgot', 'incomplete order'],
    FOOD_WRONG_ORDER: ['wrong order', 'wrong item', 'different', 'not what I ordered'],
    FOOD_QUALITY: ['cold', 'quality', 'bad', 'stale', 'spoiled', 'taste'],
    FOOD_LATE_DELIVERY: ['late delivery', 'took too long', 'waiting for food'],
    PAYMENT_FAILED: ['payment failed', 'transaction failed', 'could not pay'],
    PAYMENT_DOUBLE_CHARGE: ['double charge', 'charged twice', 'duplicate charge'],
    DRIVER_BEHAVIOR: ['rude', 'behavior', 'unprofessional', 'driver issue'],
    APP_ISSUE: ['app', 'bug', 'crash', 'not working', 'error'],
    GENERAL_INQUIRY: ['how to', 'question', 'help', 'information'],
    REFUND_REQUEST: ['refund', 'money back', 'return', 'reimburse'],
    OTHER: [],
  };

  constructor() {
    this.config = {
      classification: {
        enabled: true,
        confidenceThreshold: 0.7,
        autoAssignPriority: true,
      },
      autoRefund: {
        enabled: true,
        maxAutoRefundAmount: 50,
        requireProof: false,
        cooldownHours: 24,
        maxRefundsPerUser: 3,
      },
      missingItem: {
        enabled: true,
        autoRefundPercentage: 100,
        requirePhotos: false,
        maxItemValue: 30,
      },
      rideDelay: {
        enabled: true,
        delayThresholdMinutes: 10,
        compensationPerMinute: 0.5,
        maxCompensation: 20,
      },
      escalation: {
        escalateAfterMinutes: 60,
        escalateOnLowConfidence: true,
        confidenceThreshold: 0.5,
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.processingInterval = setInterval(async () => {
      await this.processOpenTickets();
    }, 60000);

    await this.logAutomation('AI_SUPPORT', 'SYSTEM', 'started', { config: this.config });
    console.log('[AISupport] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('[AISupport] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: AICustomerSupportConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<AICustomerSupportConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): AICustomerSupportConfig {
    return this.config;
  }

  async classifyIssue(description: string): Promise<{
    category: IssueCategory;
    confidence: number;
    suggestedPriority: 'low' | 'medium' | 'high' | 'urgent';
  }> {
    if (!this.config.classification.enabled) {
      return { category: 'OTHER', confidence: 0, suggestedPriority: 'medium' };
    }

    const lowerDesc = description.toLowerCase();
    let bestMatch: IssueCategory = 'OTHER';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      const matchCount = keywords.filter(kw => lowerDesc.includes(kw)).length;
      const score = keywords.length > 0 ? matchCount / keywords.length : 0;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = category as IssueCategory;
      }
    }

    const confidence = Math.min(bestScore * 1.5, 1);
    const suggestedPriority = this.determinePriority(bestMatch, confidence);

    await this.logAutomation('AI_SUPPORT', 'classification', 'classified', {
      description: description.substring(0, 100),
      category: bestMatch,
      confidence,
      suggestedPriority,
    });

    return { category: bestMatch, confidence, suggestedPriority };
  }

  async processTicket(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    switch (ticket.category) {
      case 'FOOD_MISSING_ITEM':
        return await this.handleMissingItem(ticket);
      
      case 'RIDE_DELAY':
        return await this.handleRideDelay(ticket);
      
      case 'PAYMENT_DOUBLE_CHARGE':
        return await this.handleDoubleCharge(ticket);
      
      case 'REFUND_REQUEST':
        return await this.handleRefundRequest(ticket);
      
      case 'FOOD_LATE_DELIVERY':
        return await this.handleLateDelivery(ticket);

      case 'RIDE_OVERCHARGE':
        return await this.handleOvercharge(ticket);

      default:
        return await this.handleGenericIssue(ticket);
    }
  }

  async handleMissingItem(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    if (!this.config.missingItem.enabled) {
      return {
        resolution: 'ESCALATE_TO_HUMAN',
        action: 'escalated',
        message: 'Your issue has been escalated to our support team.',
      };
    }

    const orderAmount = ticket.amount || 0;

    if (orderAmount > this.config.missingItem.maxItemValue) {
      return {
        resolution: 'ESCALATE_TO_HUMAN',
        action: 'escalated',
        message: 'Due to the order value, your issue requires review by our team.',
      };
    }

    const refundAmount = orderAmount * (this.config.missingItem.autoRefundPercentage / 100);

    if (await this.canProcessRefund(ticket.userId, refundAmount)) {
      await this.processRefund(ticket.userId, refundAmount, 'missing_item', ticket.orderId);

      return {
        resolution: 'AUTO_REFUND',
        action: 'refund_processed',
        amount: refundAmount,
        message: `We apologize for the missing item. A refund of $${refundAmount.toFixed(2)} has been processed.`,
      };
    }

    return {
      resolution: 'ESCALATE_TO_HUMAN',
      action: 'escalated',
      message: 'Your refund request requires additional review.',
    };
  }

  async handleRideDelay(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    if (!this.config.rideDelay.enabled || !ticket.rideId) {
      return {
        resolution: 'ESCALATE_TO_HUMAN',
        action: 'escalated',
        message: 'Your delay compensation request is being reviewed.',
      };
    }

    try {
      const ride = await prisma.ride.findUnique({
        where: { id: ticket.rideId },
      });

      if (!ride) {
        return {
          resolution: 'PENDING_INVESTIGATION',
          action: 'investigating',
          message: 'We are looking into your ride details.',
        };
      }

      const durationMinutes = ride.durationMinutes || 0;
      const estimatedPickupTime = ride.estimatedPickupTime ? new Date(ride.estimatedPickupTime) : null;
      const actualPickupTime = ride.pickupTime ? new Date(ride.pickupTime) : null;
      
      let delayMinutes = 0;
      if (estimatedPickupTime && actualPickupTime) {
        delayMinutes = Math.max(0, (actualPickupTime.getTime() - estimatedPickupTime.getTime()) / (1000 * 60));
      }

      if (delayMinutes < this.config.rideDelay.delayThresholdMinutes) {
        return {
          resolution: 'NO_ACTION_NEEDED',
          action: 'within_threshold',
          message: `Your ride was within our acceptable delay threshold. We apologize for any inconvenience.`,
        };
      }

      const compensation = Math.min(
        delayMinutes * this.config.rideDelay.compensationPerMinute,
        this.config.rideDelay.maxCompensation
      );

      if (await this.canProcessRefund(ticket.userId, compensation)) {
        await this.processRefund(ticket.userId, compensation, 'ride_delay', ticket.rideId);

        return {
          resolution: 'CREDIT_ISSUED',
          action: 'credit_issued',
          amount: compensation,
          message: `We apologize for the ${delayMinutes} minute delay. A $${compensation.toFixed(2)} credit has been added to your account.`,
        };
      }

    } catch (error) {
      console.error('[AISupport] Ride delay analysis error:', error);
    }

    return {
      resolution: 'ESCALATE_TO_HUMAN',
      action: 'escalated',
      message: 'Your compensation request is being reviewed by our team.',
    };
  }

  async handleDoubleCharge(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    return {
      resolution: 'ESCALATE_TO_HUMAN',
      action: 'escalated',
      message: 'Double charge issues require verification from our payments team. Your case has been prioritized.',
    };
  }

  async handleRefundRequest(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    const decision = await this.evaluateRefund(ticket);

    if (decision.approved && !decision.requiresReview) {
      await this.processRefund(ticket.userId, decision.amount, 'refund_request', ticket.orderId || ticket.rideId);

      return {
        resolution: 'AUTO_REFUND',
        action: 'refund_processed',
        amount: decision.amount,
        message: `Your refund of $${decision.amount.toFixed(2)} has been processed. ${decision.reason}`,
      };
    }

    return {
      resolution: decision.requiresReview ? 'ESCALATE_TO_HUMAN' : 'NO_ACTION_NEEDED',
      action: decision.requiresReview ? 'escalated' : 'denied',
      message: decision.reason,
    };
  }

  async handleLateDelivery(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    const compensation = 5;

    if (await this.canProcessRefund(ticket.userId, compensation)) {
      await this.processRefund(ticket.userId, compensation, 'late_delivery', ticket.orderId);

      return {
        resolution: 'CREDIT_ISSUED',
        action: 'credit_issued',
        amount: compensation,
        message: `We apologize for the late delivery. A $${compensation.toFixed(2)} credit has been added to your account.`,
      };
    }

    return {
      resolution: 'ESCALATE_TO_HUMAN',
      action: 'escalated',
      message: 'Your compensation request is being reviewed.',
    };
  }

  async handleOvercharge(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    amount?: number;
    message: string;
  }> {
    return {
      resolution: 'PENDING_INVESTIGATION',
      action: 'investigating',
      message: 'We are reviewing your fare details and will get back to you within 24 hours.',
    };
  }

  async handleGenericIssue(ticket: SupportTicket): Promise<{
    resolution: ResolutionType;
    action: string;
    message: string;
  }> {
    if (ticket.priority === 'urgent' || ticket.priority === 'high') {
      return {
        resolution: 'ESCALATE_TO_HUMAN',
        action: 'escalated',
        message: 'Your issue has been prioritized and escalated to our support team.',
      };
    }

    return {
      resolution: 'RESOLVED_WITH_INFO',
      action: 'info_provided',
      message: 'Thank you for contacting us. A support agent will review your issue shortly.',
    };
  }

  async evaluateRefund(ticket: SupportTicket): Promise<RefundDecision> {
    const amount = ticket.amount || 0;

    if (amount > this.config.autoRefund.maxAutoRefundAmount) {
      return {
        approved: false,
        amount: 0,
        reason: 'Amount exceeds auto-refund limit. Requires manual review.',
        confidence: 1,
        requiresReview: true,
      };
    }

    if (!await this.canProcessRefund(ticket.userId, amount)) {
      return {
        approved: false,
        amount: 0,
        reason: 'Refund limit reached. Please contact support.',
        confidence: 1,
        requiresReview: true,
      };
    }

    return {
      approved: true,
      amount,
      reason: 'Refund approved based on our policy.',
      confidence: 0.9,
      requiresReview: false,
    };
  }

  async processOpenTickets(): Promise<void> {
    console.log('[AISupport] Processing open tickets...');
  }

  async getStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'AI_SUPPORT',
        createdAt: { gte: startDate },
      },
    });

    const stats: Record<string, any> = {
      totalProcessed: logs.length,
      autoResolved: 0,
      escalated: 0,
      refundsIssued: 0,
      totalRefundAmount: 0,
      byCategory: {},
      byResolution: {},
    };

    logs.forEach(log => {
      const details = log.details as Record<string, any>;
      
      if (details?.action === 'refund_processed' || details?.action === 'credit_issued') {
        stats.autoResolved++;
        stats.refundsIssued++;
        stats.totalRefundAmount += details?.amount || 0;
      }

      if (details?.action === 'escalated') {
        stats.escalated++;
      }

      const category = details?.category;
      if (category) {
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      }

      const resolution = details?.resolution;
      if (resolution) {
        stats.byResolution[resolution] = (stats.byResolution[resolution] || 0) + 1;
      }
    });

    return stats;
  }

  private determinePriority(category: IssueCategory, confidence: number): 'low' | 'medium' | 'high' | 'urgent' {
    const urgentCategories: IssueCategory[] = ['PAYMENT_DOUBLE_CHARGE', 'DRIVER_BEHAVIOR'];
    const highCategories: IssueCategory[] = ['RIDE_OVERCHARGE', 'FOOD_MISSING_ITEM', 'PAYMENT_FAILED'];

    if (urgentCategories.includes(category)) return 'urgent';
    if (highCategories.includes(category)) return 'high';
    if (confidence < 0.5) return 'medium';
    return 'low';
  }

  private async canProcessRefund(userId: string, amount: number): Promise<boolean> {
    if (!this.config.autoRefund.enabled) return false;
    if (amount > this.config.autoRefund.maxAutoRefundAmount) return false;

    const history = this.userRefundHistory.get(userId);
    if (history) {
      const hoursSinceLastRefund = (Date.now() - history.lastRefund.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastRefund < this.config.autoRefund.cooldownHours) {
        return false;
      }

      if (history.count >= this.config.autoRefund.maxRefundsPerUser) {
        return false;
      }
    }

    return true;
  }

  private async processRefund(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<void> {
    const history = this.userRefundHistory.get(userId) || { count: 0, lastRefund: new Date(0) };
    history.count++;
    history.lastRefund = new Date();
    this.userRefundHistory.set(userId, history);

    await this.logAutomation('AI_SUPPORT', userId, 'refund_processed', {
      amount,
      reason,
      referenceId,
      refundCount: history.count,
    });

    console.log(`[AISupport] Refund processed: $${amount} for user ${userId} (${reason})`);
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
          entityType: 'support',
          entityId,
          status,
          details,
        },
      });
    } catch (error) {
      console.error('[AISupport] Log error:', error);
    }
  }
}

export const aiCustomerSupportAutomation = new AICustomerSupportAutomation();
