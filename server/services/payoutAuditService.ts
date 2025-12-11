import { prisma } from '../db';
import crypto from 'crypto';

export interface PayoutAuditEntry {
  adminId: string;
  targetUserId: string;
  targetUserType: 'driver' | 'restaurant';
  actionType: 'payout_initiated' | 'payout_approved' | 'payout_cancelled' | 'balance_adjustment';
  amount: number;
  currency: string;
  beforeBalance: number;
  afterBalance: number;
  payoutMethod?: string;
  payoutReference?: string;
  reason?: string;
  notes?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export class PayoutAuditService {
  private static instance: PayoutAuditService;

  static getInstance(): PayoutAuditService {
    if (!this.instance) {
      this.instance = new PayoutAuditService();
    }
    return this.instance;
  }

  async recordPayoutAction(entry: PayoutAuditEntry): Promise<string> {
    const previousLog = await prisma.payoutAuditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, logHash: true }
    });

    const logHash = this.calculateHash(entry, previousLog?.logHash || 'genesis');

    const auditLog = await prisma.payoutAuditLog.create({
      data: {
        adminId: entry.adminId,
        targetUserId: entry.targetUserId,
        targetUserType: entry.targetUserType,
        actionType: entry.actionType,
        amount: entry.amount,
        currency: entry.currency,
        beforeBalance: entry.beforeBalance,
        afterBalance: entry.afterBalance,
        payoutMethod: entry.payoutMethod,
        payoutReference: entry.payoutReference,
        reason: entry.reason,
        notes: entry.notes,
        ipAddress: entry.ipAddress,
        deviceInfo: entry.deviceInfo,
        previousLogId: previousLog?.id,
        logHash
      }
    });

    return auditLog.id;
  }

  async getPayoutHistory(filters: {
    adminId?: string;
    targetUserId?: string;
    targetUserType?: 'driver' | 'restaurant';
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const where: any = {};

    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.targetUserId) where.targetUserId = filters.targetUserId;
    if (filters.targetUserType) where.targetUserType = filters.targetUserType;
    if (filters.actionType) where.actionType = filters.actionType;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    const [logs, total] = await Promise.all([
      prisma.payoutAuditLog.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              adminRole: true,
              user: { select: { email: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      prisma.payoutAuditLog.count({ where })
    ]);

    return { logs, total };
  }

  async verifyChainIntegrity(limit: number = 100): Promise<{
    valid: boolean;
    checkedCount: number;
    invalidLogs: string[];
    details?: string;
  }> {
    const logs = await prisma.payoutAuditLog.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        adminId: true,
        targetUserId: true,
        targetUserType: true,
        actionType: true,
        amount: true,
        currency: true,
        beforeBalance: true,
        afterBalance: true,
        payoutMethod: true,
        payoutReference: true,
        reason: true,
        notes: true,
        ipAddress: true,
        deviceInfo: true,
        previousLogId: true,
        logHash: true,
        createdAt: true
      }
    });

    const invalidLogs: string[] = [];
    let previousHash = 'genesis';

    for (const log of logs) {
      const entry: PayoutAuditEntry = {
        adminId: log.adminId,
        targetUserId: log.targetUserId,
        targetUserType: log.targetUserType as 'driver' | 'restaurant',
        actionType: log.actionType as PayoutAuditEntry['actionType'],
        amount: Number(log.amount),
        currency: log.currency,
        beforeBalance: Number(log.beforeBalance),
        afterBalance: Number(log.afterBalance),
        payoutMethod: log.payoutMethod || undefined,
        payoutReference: log.payoutReference || undefined,
        reason: log.reason || undefined,
        notes: log.notes || undefined,
        ipAddress: log.ipAddress || undefined,
        deviceInfo: log.deviceInfo || undefined
      };

      const expectedHash = this.calculateHash(entry, previousHash);

      if (log.logHash !== expectedHash) {
        invalidLogs.push(log.id);
      }

      previousHash = log.logHash;
    }

    return {
      valid: invalidLogs.length === 0,
      checkedCount: logs.length,
      invalidLogs,
      details: invalidLogs.length > 0 
        ? `Found ${invalidLogs.length} logs with invalid chain hashes`
        : 'All logs verified successfully'
    };
  }

  async getPayoutStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalPayouts: number;
    totalAmount: number;
    byActionType: Record<string, { count: number; totalAmount: number }>;
    byTargetType: Record<string, { count: number; totalAmount: number }>;
    byAdmin: Array<{ adminId: string; email: string; count: number; totalAmount: number }>;
  }> {
    const logs = await prisma.payoutAuditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        admin: {
          select: {
            id: true,
            user: { select: { email: true } }
          }
        }
      }
    });

    const byActionType: Record<string, { count: number; totalAmount: number }> = {};
    const byTargetType: Record<string, { count: number; totalAmount: number }> = {};
    const adminStats: Map<string, { adminId: string; email: string; count: number; totalAmount: number }> = new Map();

    let totalAmount = 0;

    for (const log of logs) {
      const amount = Number(log.amount);
      totalAmount += amount;

      if (!byActionType[log.actionType]) {
        byActionType[log.actionType] = { count: 0, totalAmount: 0 };
      }
      byActionType[log.actionType].count++;
      byActionType[log.actionType].totalAmount += amount;

      if (!byTargetType[log.targetUserType]) {
        byTargetType[log.targetUserType] = { count: 0, totalAmount: 0 };
      }
      byTargetType[log.targetUserType].count++;
      byTargetType[log.targetUserType].totalAmount += amount;

      const adminKey = log.adminId;
      if (!adminStats.has(adminKey)) {
        adminStats.set(adminKey, {
          adminId: log.adminId,
          email: log.admin.user.email,
          count: 0,
          totalAmount: 0
        });
      }
      const adminStat = adminStats.get(adminKey)!;
      adminStat.count++;
      adminStat.totalAmount += amount;
    }

    return {
      totalPayouts: logs.length,
      totalAmount,
      byActionType,
      byTargetType,
      byAdmin: Array.from(adminStats.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    };
  }

  async getLargePayouts(
    threshold: number,
    limit: number = 20
  ): Promise<any[]> {
    return prisma.payoutAuditLog.findMany({
      where: {
        amount: { gte: threshold }
      },
      include: {
        admin: {
          select: {
            id: true,
            adminRole: true,
            user: { select: { email: true } }
          }
        }
      },
      orderBy: { amount: 'desc' },
      take: limit
    });
  }

  async getAdminPayoutActivity(
    adminId: string,
    days: number = 30
  ): Promise<{
    totalActions: number;
    totalAmount: number;
    recentActions: any[];
    dailyBreakdown: Array<{ date: string; count: number; amount: number }>;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.payoutAuditLog.findMany({
      where: {
        adminId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' }
    });

    const dailyBreakdown: Map<string, { count: number; amount: number }> = new Map();
    let totalAmount = 0;

    for (const log of logs) {
      const date = log.createdAt.toISOString().split('T')[0];
      const amount = Number(log.amount);
      totalAmount += amount;

      if (!dailyBreakdown.has(date)) {
        dailyBreakdown.set(date, { count: 0, amount: 0 });
      }
      const day = dailyBreakdown.get(date)!;
      day.count++;
      day.amount += amount;
    }

    return {
      totalActions: logs.length,
      totalAmount,
      recentActions: logs.slice(0, 10),
      dailyBreakdown: Array.from(dailyBreakdown.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date))
    };
  }

  private calculateHash(entry: PayoutAuditEntry, previousHash: string): string {
    const data = JSON.stringify({
      adminId: entry.adminId,
      targetUserId: entry.targetUserId,
      targetUserType: entry.targetUserType,
      actionType: entry.actionType,
      amount: entry.amount,
      currency: entry.currency,
      beforeBalance: entry.beforeBalance,
      afterBalance: entry.afterBalance,
      payoutMethod: entry.payoutMethod,
      payoutReference: entry.payoutReference,
      reason: entry.reason,
      previousHash
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const payoutAuditService = PayoutAuditService.getInstance();
