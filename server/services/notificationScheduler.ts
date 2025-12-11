import { prisma } from '../db';
import type { NotificationSchedule, NotificationPreference } from '@prisma/client';
import { notificationService } from './notificationService';

interface ScheduleNotificationData {
  userId: string;
  userType: 'customer' | 'driver' | 'restaurant';
  notificationType: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledFor?: Date;
  expiresAt?: Date;
  groupKey?: string;
  throttleKey?: string;
}

interface NotificationThrottle {
  key: string;
  minIntervalMinutes: number;
}

const DEFAULT_THROTTLES: Record<string, NotificationThrottle> = {
  ride_request: { key: 'ride_request', minIntervalMinutes: 0 },
  driver_arriving: { key: 'driver_arriving', minIntervalMinutes: 2 },
  order_status: { key: 'order_status', minIntervalMinutes: 1 },
  promotion: { key: 'promotion', minIntervalMinutes: 60 },
  earnings_summary: { key: 'earnings_summary', minIntervalMinutes: 1440 },
};

class NotificationScheduler {
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  async scheduleNotification(data: ScheduleNotificationData): Promise<NotificationSchedule | null> {
    const preferences = await this.getUserPreferences(data.userId, data.userType);
    
    if (!this.shouldSendNotification(data.notificationType, preferences)) {
      console.log(`[NotificationScheduler] Notification blocked by user preferences: ${data.notificationType}`);
      return null;
    }

    if (preferences?.quietHoursEnabled && this.isQuietHours(preferences)) {
      const nextAvailableTime = this.getNextAvailableTime(preferences);
      data.scheduledFor = nextAvailableTime;
    }

    if (data.throttleKey) {
      const isThrottled = await this.checkThrottle(data.userId, data.userType, data.throttleKey, data.notificationType);
      if (isThrottled) {
        console.log(`[NotificationScheduler] Notification throttled: ${data.throttleKey}`);
        return null;
      }
    }

    if (data.groupKey) {
      const grouped = await this.groupWithExisting(data);
      if (grouped) {
        return grouped;
      }
    }

    return prisma.notificationSchedule.create({
      data: {
        userId: data.userId,
        userType: data.userType,
        notificationType: data.notificationType,
        title: data.title,
        body: data.body,
        data: data.data || {},
        priority: data.priority || 'normal',
        scheduledFor: data.scheduledFor || new Date(),
        expiresAt: data.expiresAt,
        groupKey: data.groupKey,
        throttleKey: data.throttleKey,
      },
    });
  }

  async scheduleDriverNotification(
    driverId: string,
    type: 'ride_request' | 'food_ready' | 'parcel_pickup' | 'earnings_summary',
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<NotificationSchedule | null> {
    const priority = type === 'ride_request' ? 'high' : 'normal';
    const throttleKey = type === 'earnings_summary' ? `earnings_${driverId}` : undefined;

    return this.scheduleNotification({
      userId: driverId,
      userType: 'driver',
      notificationType: type,
      title,
      body,
      data,
      priority: priority as any,
      throttleKey,
    });
  }

  async scheduleCustomerNotification(
    customerId: string,
    type: 'driver_arriving' | 'order_status' | 'parcel_delivered' | 'food_preparation',
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<NotificationSchedule | null> {
    const priority = type === 'driver_arriving' ? 'high' : 'normal';
    const groupKey = type === 'order_status' ? `order_${data?.orderId}` : undefined;

    return this.scheduleNotification({
      userId: customerId,
      userType: 'customer',
      notificationType: type,
      title,
      body,
      data,
      priority: priority as any,
      groupKey,
    });
  }

  async processScheduledNotifications(): Promise<number> {
    if (this.isProcessing) {
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;

    try {
      const now = new Date();
      
      const pendingNotifications = await prisma.notificationSchedule.findMany({
        where: {
          sent: false,
          cancelled: false,
          scheduledFor: { lte: now },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { scheduledFor: 'asc' },
        ],
        take: 100,
      });

      for (const notification of pendingNotifications) {
        try {
          if (notification.expiresAt && notification.expiresAt < now) {
            await prisma.notificationSchedule.update({
              where: { id: notification.id },
              data: { cancelled: true },
            });
            continue;
          }

          await this.sendNotification(notification);
          
          await prisma.notificationSchedule.update({
            where: { id: notification.id },
            data: {
              sent: true,
              sentAt: new Date(),
            },
          });

          processedCount++;
        } catch (error) {
          console.error(`[NotificationScheduler] Failed to send notification ${notification.id}:`, error);
          
          await prisma.notificationSchedule.update({
            where: { id: notification.id },
            data: {
              failed: true,
              failureReason: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  async cancelNotification(notificationId: string): Promise<boolean> {
    try {
      await prisma.notificationSchedule.update({
        where: { id: notificationId },
        data: { cancelled: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  async cancelByGroup(groupKey: string): Promise<number> {
    const result = await prisma.notificationSchedule.updateMany({
      where: {
        groupKey,
        sent: false,
        cancelled: false,
      },
      data: { cancelled: true },
    });
    return result.count;
  }

  async getScheduledNotifications(
    userId: string,
    userType: string,
    options: { limit?: number; includeProcessed?: boolean } = {}
  ): Promise<NotificationSchedule[]> {
    const where: any = { userId, userType };
    
    if (!options.includeProcessed) {
      where.sent = false;
      where.cancelled = false;
    }

    return prisma.notificationSchedule.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      take: options.limit || 50,
    });
  }

  async updateUserPreferences(
    userId: string,
    userType: string,
    preferences: Partial<NotificationPreference>
  ): Promise<NotificationPreference> {
    return prisma.notificationPreference.upsert({
      where: {
        userId_userType: { userId, userType },
      },
      create: {
        userId,
        userType,
        ...preferences,
      },
      update: preferences,
    });
  }

  async getUserPreferences(userId: string, userType: string): Promise<NotificationPreference | null> {
    return prisma.notificationPreference.findUnique({
      where: {
        userId_userType: { userId, userType },
      },
    });
  }

  startProcessor(intervalMs: number = 5000): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      try {
        const count = await this.processScheduledNotifications();
        if (count > 0) {
          console.log(`[NotificationScheduler] Processed ${count} notifications`);
        }
      } catch (error) {
        console.error('[NotificationScheduler] Error processing notifications:', error);
      }
    }, intervalMs);

    console.log('[NotificationScheduler] Processor started');
  }

  stopProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('[NotificationScheduler] Processor stopped');
    }
  }

  private shouldSendNotification(type: string, preferences: NotificationPreference | null): boolean {
    if (!preferences) {
      return true;
    }

    if (!preferences.pushEnabled) {
      return false;
    }

    if (type.includes('ride') && !preferences.rideUpdatesEnabled) return false;
    if (type.includes('food') && !preferences.foodUpdatesEnabled) return false;
    if (type.includes('parcel') && !preferences.parcelUpdatesEnabled) return false;
    if (type.includes('promotion') && !preferences.promotionsEnabled) return false;
    if (type.includes('earning') && !preferences.earningsEnabled) return false;
    if (type.includes('safety') && !preferences.safetyAlertsEnabled) return false;

    return true;
  }

  private isQuietHours(preferences: NotificationPreference): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const start = preferences.quietHoursStart;
    const end = preferences.quietHoursEnd;

    if (start < end) {
      return currentTime >= start && currentTime < end;
    } else {
      return currentTime >= start || currentTime < end;
    }
  }

  private getNextAvailableTime(preferences: NotificationPreference): Date {
    if (!preferences.quietHoursEnd) {
      return new Date();
    }

    const [hours, minutes] = preferences.quietHoursEnd.split(':').map(Number);
    const nextTime = new Date();
    nextTime.setHours(hours, minutes, 0, 0);

    if (nextTime <= new Date()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }

    return nextTime;
  }

  private async checkThrottle(
    userId: string,
    userType: string,
    throttleKey: string,
    notificationType: string
  ): Promise<boolean> {
    const throttleConfig = DEFAULT_THROTTLES[notificationType] || { minIntervalMinutes: 1 };
    
    const preferences = await this.getUserPreferences(userId, userType);
    const minInterval = preferences?.minIntervalMinutes || throttleConfig.minIntervalMinutes;

    if (minInterval <= 0) {
      return false;
    }

    const cutoffTime = new Date(Date.now() - minInterval * 60 * 1000);
    
    const recentNotification = await prisma.notificationSchedule.findFirst({
      where: {
        userId,
        userType,
        throttleKey,
        createdAt: { gte: cutoffTime },
        cancelled: false,
      },
    });

    return !!recentNotification;
  }

  private async groupWithExisting(data: ScheduleNotificationData): Promise<NotificationSchedule | null> {
    const existing = await prisma.notificationSchedule.findFirst({
      where: {
        userId: data.userId,
        userType: data.userType,
        groupKey: data.groupKey,
        sent: false,
        cancelled: false,
      },
    });

    if (existing) {
      return prisma.notificationSchedule.update({
        where: { id: existing.id },
        data: {
          body: data.body,
          data: data.data || {},
          scheduledFor: data.scheduledFor || new Date(),
        },
      });
    }

    return null;
  }

  private async sendNotification(notification: NotificationSchedule): Promise<void> {
    const { userId, userType, title, body, data } = notification;

    if (userType === 'driver') {
      await notificationService.notifyDriver(
        userId,
        'RIDE_ASSIGNED' as any,
        title,
        body,
        data as Record<string, any>
      );
    } else if (userType === 'customer') {
      await notificationService.notifyCustomer(
        userId,
        'DRIVER_ARRIVING' as any,
        title,
        body,
        data as Record<string, any>
      );
    }
  }
}

export const notificationScheduler = new NotificationScheduler();
