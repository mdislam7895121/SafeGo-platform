import { prisma } from '../db';
import { AdminAnomalyType, AdminAnomalyStatus } from '@prisma/client';

export interface ActivityPattern {
  adminId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

export interface AnomalyResult {
  detected: boolean;
  anomalyId?: string;
  type?: AdminAnomalyType;
  severity?: string;
  description?: string;
}

export class AdminActivityMonitor {
  private static instance: AdminActivityMonitor;

  private readonly THRESHOLDS = {
    kyc_access_per_hour: 50,
    payout_changes_per_hour: 20,
    block_unblock_per_hour: 30,
    pricing_changes_per_hour: 10,
    bulk_export_per_day: 5
  };

  static getInstance(): AdminActivityMonitor {
    if (!this.instance) {
      this.instance = new AdminActivityMonitor();
    }
    return this.instance;
  }

  async recordAndAnalyze(activity: ActivityPattern): Promise<AnomalyResult> {
    const anomalyChecks = await Promise.all([
      this.checkUnusualKycAccess(activity),
      this.checkPayoutTampering(activity),
      this.checkMassBlockUnblock(activity),
      this.checkRapidPricingChanges(activity),
      this.checkBulkDataExport(activity),
      this.checkUnusualLoginPattern(activity)
    ]);

    for (const result of anomalyChecks) {
      if (result.detected) {
        return result;
      }
    }

    return { detected: false };
  }

  async checkUnusualKycAccess(activity: ActivityPattern): Promise<AnomalyResult> {
    if (!activity.action.includes('kyc') && activity.resourceType !== 'kyc') {
      return { detected: false };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentAccess = await prisma.auditLog.count({
      where: {
        userId: activity.adminId,
        action: { contains: 'kyc' },
        createdAt: { gte: oneHourAgo }
      }
    });

    if (recentAccess >= this.THRESHOLDS.kyc_access_per_hour) {
      return this.createAnomaly(
        activity.adminId,
        'unusual_kyc_access',
        'high',
        `Admin accessed ${recentAccess} KYC records in the last hour (threshold: ${this.THRESHOLDS.kyc_access_per_hour})`,
        { accessCount: recentAccess, threshold: this.THRESHOLDS.kyc_access_per_hour }
      );
    }

    return { detected: false };
  }

  async checkPayoutTampering(activity: ActivityPattern): Promise<AnomalyResult> {
    if (!activity.action.includes('payout') && activity.resourceType !== 'payout') {
      return { detected: false };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentPayoutChanges = await prisma.payoutAuditLog.count({
      where: {
        adminId: activity.adminId,
        createdAt: { gte: oneHourAgo }
      }
    });

    if (recentPayoutChanges >= this.THRESHOLDS.payout_changes_per_hour) {
      return this.createAnomaly(
        activity.adminId,
        'payout_tampering',
        'critical',
        `Admin made ${recentPayoutChanges} payout changes in the last hour (threshold: ${this.THRESHOLDS.payout_changes_per_hour})`,
        { changeCount: recentPayoutChanges, threshold: this.THRESHOLDS.payout_changes_per_hour }
      );
    }

    if (activity.metadata?.amount && Number(activity.metadata.amount) > 10000) {
      return this.createAnomaly(
        activity.adminId,
        'payout_tampering',
        'high',
        `Large payout of ${activity.metadata.amount} initiated`,
        { amount: activity.metadata.amount }
      );
    }

    return { detected: false };
  }

  async checkMassBlockUnblock(activity: ActivityPattern): Promise<AnomalyResult> {
    if (!activity.action.includes('block') && !activity.action.includes('unblock')) {
      return { detected: false };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentBlockActions = await prisma.auditLog.count({
      where: {
        userId: activity.adminId,
        action: { in: ['block_user', 'unblock_user', 'block_driver', 'unblock_driver'] },
        createdAt: { gte: oneHourAgo }
      }
    });

    if (recentBlockActions >= this.THRESHOLDS.block_unblock_per_hour) {
      return this.createAnomaly(
        activity.adminId,
        'mass_block_unblock',
        'high',
        `Admin performed ${recentBlockActions} block/unblock actions in the last hour (threshold: ${this.THRESHOLDS.block_unblock_per_hour})`,
        { actionCount: recentBlockActions, threshold: this.THRESHOLDS.block_unblock_per_hour }
      );
    }

    return { detected: false };
  }

  async checkRapidPricingChanges(activity: ActivityPattern): Promise<AnomalyResult> {
    if (!activity.action.includes('pricing') && activity.resourceType !== 'pricing') {
      return { detected: false };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentPricingChanges = await prisma.auditLog.count({
      where: {
        userId: activity.adminId,
        action: { contains: 'pricing' },
        createdAt: { gte: oneHourAgo }
      }
    });

    if (recentPricingChanges >= this.THRESHOLDS.pricing_changes_per_hour) {
      return this.createAnomaly(
        activity.adminId,
        'rapid_pricing_changes',
        'medium',
        `Admin made ${recentPricingChanges} pricing changes in the last hour (threshold: ${this.THRESHOLDS.pricing_changes_per_hour})`,
        { changeCount: recentPricingChanges, threshold: this.THRESHOLDS.pricing_changes_per_hour }
      );
    }

    return { detected: false };
  }

  async checkBulkDataExport(activity: ActivityPattern): Promise<AnomalyResult> {
    if (!activity.action.includes('export')) {
      return { detected: false };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentExports = await prisma.auditLog.count({
      where: {
        userId: activity.adminId,
        action: { contains: 'export' },
        createdAt: { gte: oneDayAgo }
      }
    });

    if (recentExports >= this.THRESHOLDS.bulk_export_per_day) {
      return this.createAnomaly(
        activity.adminId,
        'bulk_data_export',
        'high',
        `Admin performed ${recentExports} data exports in the last 24 hours (threshold: ${this.THRESHOLDS.bulk_export_per_day})`,
        { exportCount: recentExports, threshold: this.THRESHOLDS.bulk_export_per_day }
      );
    }

    return { detected: false };
  }

  async checkUnusualLoginPattern(activity: ActivityPattern): Promise<AnomalyResult> {
    if (activity.action !== 'admin_login') {
      return { detected: false };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentLogins = await prisma.auditLog.findMany({
      where: {
        userId: activity.adminId,
        action: 'admin_login',
        createdAt: { gte: oneDayAgo }
      },
      select: { metadata: true }
    });

    const uniqueIps = new Set(
      recentLogins
        .map(l => (l.metadata as any)?.ipAddress)
        .filter(Boolean)
    );

    if (uniqueIps.size > 5) {
      return this.createAnomaly(
        activity.adminId,
        'unusual_login_pattern',
        'medium',
        `Admin logged in from ${uniqueIps.size} different IPs in the last 24 hours`,
        { uniqueIpCount: uniqueIps.size, ips: Array.from(uniqueIps) }
      );
    }

    return { detected: false };
  }

  async getActiveAnomalies(filters?: {
    adminId?: string;
    type?: AdminAnomalyType;
    severity?: string;
    status?: AdminAnomalyStatus;
    limit?: number;
  }): Promise<any[]> {
    return prisma.adminActivityAnomaly.findMany({
      where: {
        ...(filters?.adminId && { adminId: filters.adminId }),
        ...(filters?.type && { anomalyType: filters.type }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.status && { status: filters.status })
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
      orderBy: [
        { severity: 'desc' },
        { detectedAt: 'desc' }
      ],
      take: filters?.limit || 50
    });
  }

  async updateAnomalyStatus(
    anomalyId: string,
    status: AdminAnomalyStatus,
    investigatedBy?: string,
    notes?: string
  ): Promise<void> {
    await prisma.adminActivityAnomaly.update({
      where: { id: anomalyId },
      data: {
        status,
        investigatedBy,
        investigationNotes: notes,
        resolvedAt: status === 'resolved' || status === 'false_positive' ? new Date() : undefined
      }
    });
  }

  async getAnomalyStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const anomalies = await prisma.adminActivityAnomaly.findMany({
      where: {
        detectedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        anomalyType: true,
        severity: true,
        status: true
      }
    });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const a of anomalies) {
      byType[a.anomalyType] = (byType[a.anomalyType] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    }

    return {
      total: anomalies.length,
      byType,
      bySeverity,
      byStatus
    };
  }

  private async createAnomaly(
    adminId: string,
    type: AdminAnomalyType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    details: Record<string, any>
  ): Promise<AnomalyResult> {
    const anomaly = await prisma.adminActivityAnomaly.create({
      data: {
        adminId,
        anomalyType: type,
        severity,
        description,
        details,
        status: 'detected'
      }
    });

    if (severity === 'critical' || severity === 'high') {
      await this.notifySecurityTeam(anomaly.id, type, severity, description);
    }

    return {
      detected: true,
      anomalyId: anomaly.id,
      type,
      severity,
      description
    };
  }

  private async notifySecurityTeam(
    anomalyId: string,
    type: AdminAnomalyType,
    severity: string,
    description: string
  ): Promise<void> {
    console.log(`[AdminActivityMonitor] SECURITY ALERT: ${severity} ${type} anomaly detected - ${description}`);
  }
}

export const adminActivityMonitor = AdminActivityMonitor.getInstance();
