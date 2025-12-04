/**
 * SafeGo Repeat Purchase Trigger Automation Service (Module 8)
 * Tracks customer purchase behavior and auto-triggers reminder notifications
 * - Customer behavior tracking (food, grocery, accessories)
 * - Auto-trigger reminder push notifications
 * - Track customer segments and purchase patterns
 */

import { prisma } from '../../db';

interface CustomerSegment {
  key: string;
  name: string;
  category: string;
  avgFrequencyDays: number;
  minOrdersForPattern: number;
}

interface PurchasePattern {
  customerId: string;
  segmentKey: string;
  orderCount: number;
  avgFrequencyDays: number;
  lastOrderAt: Date;
  predictedNextDate: Date;
}

interface RepeatPurchaseConfig {
  enabled: boolean;
  scanIntervalMs: number;
  segments: CustomerSegment[];
  notification: {
    enabled: boolean;
    advanceDays: number;
    maxRemindersPerCustomer: number;
    cooldownHours: number;
  };
  triggers: {
    reminderEnabled: boolean;
    suggestionEnabled: boolean;
    promotionEnabled: boolean;
  };
  thresholds: {
    minOrdersForPattern: number;
    patternConfidenceThreshold: number;
    inactivityDaysWarning: number;
    inactivityDaysCritical: number;
  };
}

class RepeatPurchaseTriggerAutomation {
  private static instance: RepeatPurchaseTriggerAutomation;
  private config: RepeatPurchaseConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 3600000, // 1 hour
      segments: [
        { key: 'food_regular', name: 'Regular Food Orders', category: 'food', avgFrequencyDays: 3, minOrdersForPattern: 5 },
        { key: 'food_weekly', name: 'Weekly Food Orders', category: 'food', avgFrequencyDays: 7, minOrdersForPattern: 4 },
        { key: 'grocery_weekly', name: 'Weekly Grocery', category: 'grocery', avgFrequencyDays: 7, minOrdersForPattern: 3 },
        { key: 'grocery_biweekly', name: 'Bi-Weekly Grocery', category: 'grocery', avgFrequencyDays: 14, minOrdersForPattern: 3 },
        { key: 'grocery_monthly', name: 'Monthly Grocery', category: 'grocery', avgFrequencyDays: 30, minOrdersForPattern: 2 },
        { key: 'accessories_monthly', name: 'Monthly Accessories', category: 'accessories', avgFrequencyDays: 30, minOrdersForPattern: 2 },
        { key: 'ride_regular', name: 'Regular Rider', category: 'ride', avgFrequencyDays: 2, minOrdersForPattern: 10 },
        { key: 'ride_weekly', name: 'Weekly Rider', category: 'ride', avgFrequencyDays: 7, minOrdersForPattern: 4 },
      ],
      notification: {
        enabled: true,
        advanceDays: 1,
        maxRemindersPerCustomer: 3,
        cooldownHours: 24,
      },
      triggers: {
        reminderEnabled: true,
        suggestionEnabled: true,
        promotionEnabled: true,
      },
      thresholds: {
        minOrdersForPattern: 3,
        patternConfidenceThreshold: 0.7,
        inactivityDaysWarning: 14,
        inactivityDaysCritical: 30,
      },
    };
  }

  static getInstance(): RepeatPurchaseTriggerAutomation {
    if (!RepeatPurchaseTriggerAutomation.instance) {
      RepeatPurchaseTriggerAutomation.instance = new RepeatPurchaseTriggerAutomation();
    }
    return RepeatPurchaseTriggerAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runPurchasePatternScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('REPEAT_PURCHASE', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[RepeatPurchase] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[RepeatPurchase] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: RepeatPurchaseConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<RepeatPurchaseConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): RepeatPurchaseConfig {
    return this.config;
  }

  async runPurchasePatternScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const patterns = await this.detectPurchasePatterns();

      for (const pattern of patterns) {
        await this.createOrUpdateTrigger(pattern);
      }

      await this.processPendingTriggers();

      await this.logAutomation('REPEAT_PURCHASE', 'SYSTEM', 'scan_completed', {
        patternsDetected: patterns.length,
      });
    } catch (error) {
      console.error('[RepeatPurchase] Scan error:', error);
      await this.logAutomation('REPEAT_PURCHASE', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private async detectPurchasePatterns(): Promise<PurchasePattern[]> {
    const patterns: PurchasePattern[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const segment of this.config.segments) {
      let customerOrders: { customerId: string; orders: { createdAt: Date }[] }[] = [];

      if (segment.category === 'food') {
        const results = await prisma.foodOrder.groupBy({
          by: ['customerId'],
          where: {
            createdAt: { gte: thirtyDaysAgo },
            status: 'delivered',
          },
          _count: { id: true },
          having: {
            id: { _count: { gte: segment.minOrdersForPattern } },
          },
        });

        for (const result of results) {
          const orders = await prisma.foodOrder.findMany({
            where: {
              customerId: result.customerId,
              status: 'delivered',
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { createdAt: true },
          });
          customerOrders.push({ customerId: result.customerId, orders });
        }
      } else if (segment.category === 'ride') {
        const results = await prisma.ride.groupBy({
          by: ['customerId'],
          where: {
            createdAt: { gte: thirtyDaysAgo },
            status: 'completed',
          },
          _count: { id: true },
          having: {
            id: { _count: { gte: segment.minOrdersForPattern } },
          },
        });

        for (const result of results) {
          const orders = await prisma.ride.findMany({
            where: {
              customerId: result.customerId,
              status: 'completed',
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { createdAt: true },
          });
          customerOrders.push({ customerId: result.customerId, orders });
        }
      } else if (segment.category === 'grocery' || segment.category === 'accessories') {
        const results = await prisma.shopOrder.groupBy({
          by: ['customerId'],
          where: {
            createdAt: { gte: thirtyDaysAgo },
            status: 'delivered',
          },
          _count: { id: true },
          having: {
            id: { _count: { gte: segment.minOrdersForPattern } },
          },
        });

        for (const result of results) {
          const orders = await prisma.shopOrder.findMany({
            where: {
              customerId: result.customerId,
              status: 'delivered',
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { createdAt: true },
          });
          customerOrders.push({ customerId: result.customerId, orders });
        }
      }

      for (const { customerId, orders } of customerOrders) {
        if (orders.length < 2) continue;

        const intervals: number[] = [];
        for (let i = 0; i < orders.length - 1; i++) {
          const diff = orders[i].createdAt.getTime() - orders[i + 1].createdAt.getTime();
          intervals.push(diff / (24 * 60 * 60 * 1000));
        }

        const avgDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        if (Math.abs(avgDays - segment.avgFrequencyDays) / segment.avgFrequencyDays < 0.5) {
          const lastOrder = orders[0];
          const predictedNext = new Date(lastOrder.createdAt.getTime() + avgDays * 24 * 60 * 60 * 1000);

          patterns.push({
            customerId,
            segmentKey: segment.key,
            orderCount: orders.length,
            avgFrequencyDays: avgDays,
            lastOrderAt: lastOrder.createdAt,
            predictedNextDate: predictedNext,
          });
        }
      }
    }

    return patterns;
  }

  private async createOrUpdateTrigger(pattern: PurchasePattern): Promise<void> {
    const existing = await prisma.repeatPurchaseTrigger.findFirst({
      where: {
        customerId: pattern.customerId,
        segmentKey: pattern.segmentKey,
        status: { in: ['pending', 'triggered'] },
      },
    });

    const segment = this.config.segments.find(s => s.key === pattern.segmentKey);
    const nextBestAction = this.determineNextBestAction(pattern);

    if (existing) {
      await prisma.repeatPurchaseTrigger.update({
        where: { id: existing.id },
        data: {
          avgOrderFrequencyDays: pattern.avgFrequencyDays,
          predictedNextOrderDate: pattern.predictedNextDate,
          nextBestAction,
          triggerScheduledAt: new Date(pattern.predictedNextDate.getTime() - this.config.notification.advanceDays * 24 * 60 * 60 * 1000),
          lastOrderAt: pattern.lastOrderAt,
        },
      });
    } else {
      await prisma.repeatPurchaseTrigger.create({
        data: {
          customerId: pattern.customerId,
          segmentKey: pattern.segmentKey,
          category: segment?.category || 'other',
          avgOrderFrequencyDays: pattern.avgFrequencyDays,
          predictedNextOrderDate: pattern.predictedNextDate,
          nextBestAction,
          triggerType: 'reminder',
          triggerScheduledAt: new Date(pattern.predictedNextDate.getTime() - this.config.notification.advanceDays * 24 * 60 * 60 * 1000),
          lastOrderAt: pattern.lastOrderAt,
          status: 'pending',
        },
      });
    }
  }

  private determineNextBestAction(pattern: PurchasePattern): string {
    const daysSinceLastOrder = (Date.now() - pattern.lastOrderAt.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSinceLastOrder > this.config.thresholds.inactivityDaysCritical) {
      return 'offer_discount';
    } else if (daysSinceLastOrder > this.config.thresholds.inactivityDaysWarning) {
      return 'suggest_similar';
    }
    return 'remind_reorder';
  }

  private async processPendingTriggers(): Promise<void> {
    if (!this.config.notification.enabled) return;

    const now = new Date();
    const pendingTriggers = await prisma.repeatPurchaseTrigger.findMany({
      where: {
        status: 'pending',
        triggerScheduledAt: { lte: now },
        notificationSent: false,
      },
      take: 100,
    });

    for (const trigger of pendingTriggers) {
      const recentNotifications = await prisma.repeatPurchaseTrigger.count({
        where: {
          customerId: trigger.customerId,
          notificationSent: true,
          triggeredAt: {
            gte: new Date(Date.now() - this.config.notification.cooldownHours * 60 * 60 * 1000),
          },
        },
      });

      if (recentNotifications >= this.config.notification.maxRemindersPerCustomer) {
        continue;
      }

      const segment = this.config.segments.find(s => s.key === trigger.segmentKey);
      const message = this.generateNotificationMessage(trigger, segment);

      await prisma.repeatPurchaseTrigger.update({
        where: { id: trigger.id },
        data: {
          status: 'triggered',
          triggeredAt: now,
          notificationSent: true,
        },
      });

      await this.logAutomation('REPEAT_PURCHASE', trigger.customerId, 'trigger_sent', {
        triggerId: trigger.id,
        segmentKey: trigger.segmentKey,
        action: trigger.nextBestAction,
        message,
      });
    }
  }

  private generateNotificationMessage(trigger: any, segment?: CustomerSegment): string {
    const categoryName = segment?.name || trigger.category;

    switch (trigger.nextBestAction) {
      case 'remind_reorder':
        return `Time for your ${categoryName} order! Based on your pattern, you usually order around this time.`;
      case 'suggest_similar':
        return `We miss you! Check out our latest ${categoryName} options.`;
      case 'offer_discount':
        return `Special offer for you! Get 10% off your next ${categoryName} order.`;
      default:
        return `Check out our ${categoryName} options!`;
    }
  }

  async getCustomerSegments(customerId: string): Promise<any[]> {
    return await prisma.repeatPurchaseTrigger.findMany({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSegmentStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const segment of this.config.segments) {
      const count = await prisma.repeatPurchaseTrigger.count({
        where: { segmentKey: segment.key },
      });

      const triggered = await prisma.repeatPurchaseTrigger.count({
        where: { segmentKey: segment.key, status: 'triggered' },
      });

      const completed = await prisma.repeatPurchaseTrigger.count({
        where: { segmentKey: segment.key, status: 'completed' },
      });

      stats[segment.key] = {
        name: segment.name,
        category: segment.category,
        totalCustomers: count,
        triggeredCount: triggered,
        completedCount: completed,
        conversionRate: count > 0 ? (completed / count) * 100 : 0,
      };
    }

    return stats;
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
      console.error('[RepeatPurchase] Failed to log automation:', error);
    }
  }
}

export const repeatPurchaseTriggerAutomation = RepeatPurchaseTriggerAutomation.getInstance();
export { RepeatPurchaseTriggerAutomation };
