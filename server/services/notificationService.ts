import { prisma } from "../lib/prisma";
import { NotificationType, NotificationStatus, DeliveryServiceType, DevicePlatform } from "@prisma/client";

interface SendNotificationParams {
  userId: string;
  role: "customer" | "driver" | "restaurant" | "admin";
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  serviceType?: DeliveryServiceType;
  entityId?: string;
  priority?: "normal" | "high";
  ttlSeconds?: number;
  collapseKey?: string;
}

interface SendNotificationResult {
  success: boolean;
  notificationLogId?: string;
  devicesSent?: number;
  devicesFailed?: number;
  error?: string;
}

interface FCMMessage {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: "normal" | "high";
    ttl?: string;
    collapseKey?: string;
  };
  apns?: {
    headers?: {
      "apns-priority"?: string;
      "apns-collapse-id"?: string;
    };
    payload?: {
      aps?: {
        sound?: string;
        badge?: number;
      };
    };
  };
  webpush?: {
    headers?: Record<string, string>;
  };
}

interface FCMResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

const FCM_API_URL = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send";

class NotificationService {
  private fcmProjectId: string | null;
  private fcmServiceAccount: Record<string, any> | null;
  private fcmAccessToken: string | null;
  private fcmTokenExpiry: Date | null;
  private useMockMode: boolean;

  constructor() {
    this.fcmProjectId = process.env.FCM_PROJECT_ID || null;
    this.fcmServiceAccount = this.parseServiceAccount();
    this.fcmAccessToken = null;
    this.fcmTokenExpiry = null;
    this.useMockMode = !this.fcmProjectId || !this.fcmServiceAccount;

    if (this.useMockMode) {
      console.log("[NotificationService] FCM not configured, using mock mode");
    } else {
      console.log("[NotificationService] FCM configured for project:", this.fcmProjectId);
    }
  }

  private parseServiceAccount(): Record<string, any> | null {
    const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) return null;

    try {
      return JSON.parse(serviceAccountJson);
    } catch {
      console.error("[NotificationService] Failed to parse FCM service account JSON");
      return null;
    }
  }

  isConfigured(): boolean {
    return !this.useMockMode;
  }

  async sendToUser(params: SendNotificationParams): Promise<SendNotificationResult> {
    try {
      const devices = await prisma.userDevice.findMany({
        where: {
          userId: params.userId,
          role: params.role,
          isActive: true,
          revokedAt: null,
        },
      });

      if (devices.length === 0) {
        console.log(`[NotificationService] No active devices for user ${params.userId}`);
        
        const log = await this.createNotificationLog({
          ...params,
          status: NotificationStatus.failed,
          errorMessage: "No active devices",
        });

        return {
          success: false,
          notificationLogId: log.id,
          devicesSent: 0,
          devicesFailed: 0,
          error: "No active devices for user",
        };
      }

      let sentCount = 0;
      let failedCount = 0;
      const logIds: string[] = [];

      for (const device of devices) {
        const result = await this.sendToDevice({
          ...params,
          deviceId: device.id,
          fcmToken: device.fcmToken,
          platform: device.platform,
        });

        const log = await this.createNotificationLog({
          ...params,
          deviceId: device.id,
          status: result.success ? NotificationStatus.sent : NotificationStatus.failed,
          fcmMessageId: result.messageId,
          errorCode: result.errorCode,
          errorMessage: result.error,
        });

        logIds.push(log.id);

        if (result.success) {
          sentCount++;
          await prisma.userDevice.update({
            where: { id: device.id },
            data: {
              notificationCount: { increment: 1 },
              lastSeenAt: new Date(),
            },
          });
        } else {
          failedCount++;
          await prisma.userDevice.update({
            where: { id: device.id },
            data: {
              failureCount: { increment: 1 },
            },
          });

          if (result.errorCode === "UNREGISTERED" || result.errorCode === "INVALID_ARGUMENT") {
            await prisma.userDevice.update({
              where: { id: device.id },
              data: {
                isActive: false,
                revokedAt: new Date(),
                revokeReason: `FCM error: ${result.errorCode}`,
              },
            });
          }
        }
      }

      return {
        success: sentCount > 0,
        notificationLogId: logIds[0],
        devicesSent: sentCount,
        devicesFailed: failedCount,
      };
    } catch (error: any) {
      console.error("[NotificationService] Error sending notification:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendToMany(params: Omit<SendNotificationParams, "userId"> & { userIds: string[] }): Promise<{
    success: boolean;
    usersSent: number;
    usersFailed: number;
    errors?: string[];
  }> {
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const userId of params.userIds) {
      const result = await this.sendToUser({
        ...params,
        userId,
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        if (result.error) {
          errors.push(`${userId}: ${result.error}`);
        }
      }
    }

    return {
      success: sentCount > 0,
      usersSent: sentCount,
      usersFailed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async sendToDevice(params: SendNotificationParams & {
    deviceId: string;
    fcmToken: string;
    platform: DevicePlatform;
  }): Promise<FCMResponse> {
    if (this.useMockMode) {
      return this.sendMockNotification(params);
    }

    return this.sendFCMNotification(params);
  }

  private async sendMockNotification(params: {
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    fcmToken: string;
    data?: Record<string, any>;
  }): Promise<FCMResponse> {
    console.log(`[NotificationService] [MOCK] Sending notification to ${params.userId}:`);
    console.log(`  Title: ${params.title}`);
    console.log(`  Body: ${params.body}`);
    console.log(`  Type: ${params.type}`);
    if (params.data) {
      console.log(`  Data: ${JSON.stringify(params.data)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    };
  }

  private async sendFCMNotification(params: {
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    fcmToken: string;
    platform: DevicePlatform;
    data?: Record<string, any>;
    priority?: "normal" | "high";
    ttlSeconds?: number;
    collapseKey?: string;
  }): Promise<FCMResponse> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: "Failed to get FCM access token",
          errorCode: "AUTH_ERROR",
        };
      }

      const message: FCMMessage = {
        token: params.fcmToken,
        notification: {
          title: params.title,
          body: params.body,
        },
      };

      if (params.data) {
        message.data = {};
        for (const [key, value] of Object.entries(params.data)) {
          message.data[key] = typeof value === "string" ? value : JSON.stringify(value);
        }
        message.data.type = params.type;
      }

      if (params.platform === DevicePlatform.android) {
        message.android = {
          priority: params.priority || "normal",
        };
        if (params.ttlSeconds) {
          message.android.ttl = `${params.ttlSeconds}s`;
        }
        if (params.collapseKey) {
          message.android.collapseKey = params.collapseKey;
        }
      }

      if (params.platform === DevicePlatform.ios) {
        message.apns = {
          headers: {
            "apns-priority": params.priority === "high" ? "10" : "5",
          },
          payload: {
            aps: {
              sound: "default",
            },
          },
        };
        if (params.collapseKey) {
          message.apns.headers!["apns-collapse-id"] = params.collapseKey;
        }
      }

      const url = FCM_API_URL.replace("{project_id}", this.fcmProjectId!);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorCode = "UNKNOWN";
        let errorMessage = errorBody;

        try {
          const errorJson = JSON.parse(errorBody);
          errorCode = errorJson.error?.details?.[0]?.errorCode || errorJson.error?.status || "UNKNOWN";
          errorMessage = errorJson.error?.message || errorBody;
        } catch {}

        console.error(`[NotificationService] FCM error: ${errorCode} - ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
          errorCode,
        };
      }

      const responseData = await response.json();

      return {
        success: true,
        messageId: responseData.name,
      };
    } catch (error: any) {
      console.error("[NotificationService] FCM request error:", error);
      return {
        success: false,
        error: error.message,
        errorCode: "REQUEST_ERROR",
      };
    }
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.fcmAccessToken && this.fcmTokenExpiry && new Date() < this.fcmTokenExpiry) {
      return this.fcmAccessToken;
    }

    if (!this.fcmServiceAccount) {
      return null;
    }

    try {
      console.log("[NotificationService] FCM access token refresh would happen here");
      console.log("[NotificationService] Full OAuth2 implementation requires google-auth-library");
      return null;
    } catch (error) {
      console.error("[NotificationService] Failed to get access token:", error);
      return null;
    }
  }

  private async createNotificationLog(params: {
    userId: string;
    role: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    serviceType?: DeliveryServiceType;
    entityId?: string;
    deviceId?: string;
    status: NotificationStatus;
    fcmMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
    priority?: string;
    ttlSeconds?: number;
    collapseKey?: string;
  }) {
    return prisma.notificationLog.create({
      data: {
        userId: params.userId,
        role: params.role,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? undefined,
        serviceType: params.serviceType,
        entityId: params.entityId,
        deviceId: params.deviceId,
        status: params.status,
        sentAt: params.status === NotificationStatus.sent ? new Date() : null,
        fcmMessageId: params.fcmMessageId,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        priority: params.priority || "normal",
        ttlSeconds: params.ttlSeconds,
        collapseKey: params.collapseKey,
      },
    });
  }

  async getNotificationLogs(userId: string, role?: string, limit = 50) {
    return prisma.notificationLog.findMany({
      where: {
        userId,
        ...(role ? { role } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getNotificationStats(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, sent, failed, byType] = await Promise.all([
      prisma.notificationLog.count({ where }),
      prisma.notificationLog.count({ where: { ...where, status: NotificationStatus.sent } }),
      prisma.notificationLog.count({ where: { ...where, status: NotificationStatus.failed } }),
      prisma.notificationLog.groupBy({
        by: ["type"],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      sent,
      failed,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(2) : "0.00",
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export const notificationService = new NotificationService();
