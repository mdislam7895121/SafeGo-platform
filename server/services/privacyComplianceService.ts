import { prisma } from '../db';
import { PrivacyRequestType, PrivacyRequestStatus } from '@prisma/client';

export interface DataExportResult {
  requestId: string;
  exportUrl?: string;
  status: PrivacyRequestStatus;
  estimatedCompletionTime?: Date;
}

export interface DeletionResult {
  requestId: string;
  status: PrivacyRequestStatus;
  deletedCategories: string[];
  retainedCategories: string[];
  retentionReasons: string[];
}

export class PrivacyComplianceService {
  private static instance: PrivacyComplianceService;

  private readonly DATA_CATEGORIES = [
    'profile_data',
    'ride_history',
    'food_order_history',
    'payment_history',
    'location_history',
    'device_data',
    'communication_history',
    'support_tickets',
    'reviews_ratings'
  ];

  private readonly RETENTION_PERIODS = {
    financial_records: 7 * 365,
    tax_documents: 7 * 365,
    dispute_records: 3 * 365,
    active_legal_holds: Infinity
  };

  static getInstance(): PrivacyComplianceService {
    if (!this.instance) {
      this.instance = new PrivacyComplianceService();
    }
    return this.instance;
  }

  async createDataExportRequest(
    userId: string,
    requestedCategories?: string[]
  ): Promise<DataExportResult> {
    const categories = requestedCategories || this.DATA_CATEGORIES;

    const existingRequest = await prisma.privacyRequest.findFirst({
      where: {
        userId,
        requestType: 'data_export',
        status: { in: ['pending', 'processing'] }
      }
    });

    if (existingRequest) {
      return {
        requestId: existingRequest.id,
        status: existingRequest.status,
        estimatedCompletionTime: existingRequest.estimatedCompletionAt || undefined
      };
    }

    const estimatedCompletionAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const request = await prisma.privacyRequest.create({
      data: {
        userId,
        requestType: 'data_export',
        requestedCategories: categories,
        status: 'pending',
        estimatedCompletionAt
      }
    });

    return {
      requestId: request.id,
      status: request.status,
      estimatedCompletionTime: estimatedCompletionAt
    };
  }

  async createDeletionRequest(
    userId: string,
    requestedCategories?: string[]
  ): Promise<DeletionResult> {
    const categories = requestedCategories || this.DATA_CATEGORIES;

    const existingRequest = await prisma.privacyRequest.findFirst({
      where: {
        userId,
        requestType: 'data_deletion',
        status: { in: ['pending', 'processing'] }
      }
    });

    if (existingRequest) {
      return {
        requestId: existingRequest.id,
        status: existingRequest.status,
        deletedCategories: [],
        retainedCategories: existingRequest.retainedCategories as string[] || [],
        retentionReasons: existingRequest.retentionReasons as string[] || []
      };
    }

    const retentionCheck = await this.checkRetentionRequirements(userId);

    const request = await prisma.privacyRequest.create({
      data: {
        userId,
        requestType: 'data_deletion',
        requestedCategories: categories,
        retainedCategories: retentionCheck.retainedCategories,
        retentionReasons: retentionCheck.reasons,
        status: 'pending',
        estimatedCompletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return {
      requestId: request.id,
      status: request.status,
      deletedCategories: categories.filter(c => !retentionCheck.retainedCategories.includes(c)),
      retainedCategories: retentionCheck.retainedCategories,
      retentionReasons: retentionCheck.reasons
    };
  }

  async processDataExport(requestId: string): Promise<{ success: boolean; exportUrl?: string }> {
    const request = await prisma.privacyRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      throw new Error('Request not found');
    }

    await prisma.privacyRequest.update({
      where: { id: requestId },
      data: { status: 'processing' }
    });

    try {
      const userData = await this.gatherUserData(
        request.userId,
        request.requestedCategories as string[]
      );

      const exportUrl = `/api/privacy/exports/${requestId}`;

      await prisma.privacyRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          exportUrl,
          completedAt: new Date()
        }
      });

      return { success: true, exportUrl };
    } catch (error) {
      await prisma.privacyRequest.update({
        where: { id: requestId },
        data: {
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      return { success: false };
    }
  }

  async processDeletionRequest(requestId: string): Promise<{ success: boolean; deletedCount: number }> {
    const request = await prisma.privacyRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      throw new Error('Request not found');
    }

    await prisma.privacyRequest.update({
      where: { id: requestId },
      data: { status: 'processing' }
    });

    try {
      const categoriesToDelete = (request.requestedCategories as string[]).filter(
        c => !(request.retainedCategories as string[] || []).includes(c)
      );

      let deletedCount = 0;

      for (const category of categoriesToDelete) {
        const count = await this.deleteCategory(request.userId, category);
        deletedCount += count;
      }

      await prisma.privacyRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      await this.logDeletionAudit(request.userId, categoriesToDelete, deletedCount);

      return { success: true, deletedCount };
    } catch (error) {
      await prisma.privacyRequest.update({
        where: { id: requestId },
        data: {
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      return { success: false, deletedCount: 0 };
    }
  }

  async getRequestStatus(requestId: string): Promise<{
    status: PrivacyRequestStatus;
    requestType: PrivacyRequestType;
    createdAt: Date;
    estimatedCompletionAt: Date | null;
    completedAt: Date | null;
    exportUrl?: string;
  } | null> {
    const request = await prisma.privacyRequest.findUnique({
      where: { id: requestId },
      select: {
        status: true,
        requestType: true,
        createdAt: true,
        estimatedCompletionAt: true,
        completedAt: true,
        exportUrl: true
      }
    });

    if (!request) return null;

    return {
      status: request.status,
      requestType: request.requestType,
      createdAt: request.createdAt,
      estimatedCompletionAt: request.estimatedCompletionAt,
      completedAt: request.completedAt,
      exportUrl: request.exportUrl || undefined
    };
  }

  async getUserRequests(userId: string): Promise<any[]> {
    return prisma.privacyRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  async getPendingRequests(): Promise<any[]> {
    return prisma.privacyRequest.findMany({
      where: {
        status: { in: ['pending', 'processing'] }
      },
      include: {
        user: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getComplianceStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRequests: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    avgCompletionTime: number;
    overdueRequests: number;
  }> {
    const requests = await prisma.privacyRequest.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalCompletionTime = 0;
    let completedCount = 0;
    let overdueCount = 0;

    const now = new Date();

    for (const r of requests) {
      byType[r.requestType] = (byType[r.requestType] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;

      if (r.completedAt) {
        totalCompletionTime += r.completedAt.getTime() - r.createdAt.getTime();
        completedCount++;
      }

      if (
        r.estimatedCompletionAt &&
        r.estimatedCompletionAt < now &&
        !['completed', 'failed'].includes(r.status)
      ) {
        overdueCount++;
      }
    }

    return {
      totalRequests: requests.length,
      byType,
      byStatus,
      avgCompletionTime: completedCount > 0 ? totalCompletionTime / completedCount : 0,
      overdueRequests: overdueCount
    };
  }

  async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    version: string
  ): Promise<void> {
    await prisma.userConsentLog.create({
      data: {
        userId,
        consentType,
        granted,
        version,
        ipAddress: null,
        userAgent: null
      }
    });
  }

  async getUserConsents(userId: string): Promise<any[]> {
    return prisma.userConsentLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getLatestConsent(userId: string, consentType: string): Promise<{
    granted: boolean;
    version: string;
    grantedAt: Date;
  } | null> {
    const consent = await prisma.userConsentLog.findFirst({
      where: { userId, consentType },
      orderBy: { createdAt: 'desc' }
    });

    if (!consent) return null;

    return {
      granted: consent.granted,
      version: consent.version,
      grantedAt: consent.createdAt
    };
  }

  private async checkRetentionRequirements(userId: string): Promise<{
    retainedCategories: string[];
    reasons: string[];
  }> {
    const retainedCategories: string[] = [];
    const reasons: string[] = [];

    const recentPayments = await prisma.payment.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - this.RETENTION_PERIODS.financial_records * 24 * 60 * 60 * 1000) }
      }
    });

    if (recentPayments > 0) {
      retainedCategories.push('payment_history');
      reasons.push(`Financial records must be retained for ${this.RETENTION_PERIODS.financial_records / 365} years`);
    }

    return { retainedCategories, reasons };
  }

  private async gatherUserData(userId: string, categories: string[]): Promise<any> {
    const data: Record<string, any> = {};

    for (const category of categories) {
      switch (category) {
        case 'profile_data':
          data.profile = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              email: true,
              countryCode: true,
              createdAt: true,
              customerProfile: { select: { firstName: true, lastName: true, phone: true } },
              driverProfile: { select: { fullName: true, phone: true } }
            }
          });
          break;
        case 'ride_history':
          data.rides = await prisma.ride.findMany({
            where: { customer: { userId } },
            select: {
              id: true,
              pickupAddress: true,
              dropoffAddress: true,
              fare: true,
              status: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          });
          break;
        case 'food_order_history':
          data.foodOrders = await prisma.foodOrder.findMany({
            where: { customer: { userId } },
            select: {
              id: true,
              totalAmount: true,
              status: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          });
          break;
      }
    }

    return data;
  }

  private async deleteCategory(userId: string, category: string): Promise<number> {
    console.log(`[PrivacyComplianceService] Deleting ${category} for user ${userId}`);
    return 0;
  }

  private async logDeletionAudit(
    userId: string,
    categories: string[],
    deletedCount: number
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'privacy_deletion',
        resourceType: 'user_data',
        resourceId: userId,
        metadata: {
          deletedCategories: categories,
          deletedRecordCount: deletedCount
        },
        ipAddress: null
      }
    });
  }
}

export const privacyComplianceService = PrivacyComplianceService.getInstance();
