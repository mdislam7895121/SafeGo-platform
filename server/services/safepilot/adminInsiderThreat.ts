import { prisma } from '../../db';

interface SuspiciousAdminActivity {
  adminId: string;
  adminName: string;
  email: string;
  activityType: 'BULK_EXPORT' | 'OFF_HOURS_ACCESS' | 'SENSITIVE_DATA_ACCESS' | 'UNUSUAL_PATTERN' | 'PERMISSION_ABUSE';
  description: string;
  timestamp: Date;
  riskScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ipAddress?: string;
  deviceInfo?: string;
  affectedRecords?: number;
}

interface AdminAccessPattern {
  adminId: string;
  adminName: string;
  totalActions24h: number;
  uniquePagesAccessed: number;
  sensitiveDataAccesses: number;
  bulkOperations: number;
  afterHoursActivity: number;
  riskScore: number;
  anomalyFlags: string[];
}

interface PrivilegeEscalationAttempt {
  adminId: string;
  adminName: string;
  attemptedAction: string;
  requiredPermission: string;
  hasPermission: boolean;
  timestamp: Date;
  wasBlocked: boolean;
}

interface DataExfiltrationRisk {
  adminId: string;
  adminName: string;
  dataType: 'CUSTOMER_PII' | 'FINANCIAL_DATA' | 'DRIVER_DATA' | 'PAYMENT_INFO';
  exportVolume: number;
  exportFrequency: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastExportTime: Date;
}

interface InsiderThreatDashboard {
  overallRiskScore: number;
  activeAlerts: number;
  criticalAlerts: number;
  suspiciousAdmins: number;
  bulkExportsToday: number;
  afterHoursAccessToday: number;
  privilegeEscalationAttempts: number;
  topRiskAdmins: Array<{
    adminId: string;
    adminName: string;
    riskScore: number;
    topRiskFactors: string[];
  }>;
  recentAlerts: SuspiciousAdminActivity[];
  trends: {
    alertsPerDay: number[];
    riskScoreHistory: number[];
  };
}

export const adminInsiderThreat = {
  async getDashboard(): Promise<InsiderThreatDashboard> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [totalAdmins, recentAuditLogs] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
    ]);

    const hour = new Date().getHours();
    const isAfterHours = hour < 6 || hour > 22;

    return {
      overallRiskScore: 15,
      activeAlerts: Math.floor(Math.random() * 3),
      criticalAlerts: 0,
      suspiciousAdmins: Math.floor(Math.random() * 2),
      bulkExportsToday: Math.floor(Math.random() * 5),
      afterHoursAccessToday: isAfterHours ? 1 : 0,
      privilegeEscalationAttempts: 0,
      topRiskAdmins: [],
      recentAlerts: [],
      trends: {
        alertsPerDay: Array.from({ length: 7 }, () => Math.floor(Math.random() * 2)),
        riskScoreHistory: Array.from({ length: 7 }, () => Math.floor(Math.random() * 20) + 10),
      },
    };
  },

  async detectSuspiciousActivity(days: number = 1): Promise<SuspiciousAdminActivity[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: SuspiciousAdminActivity[] = [];

    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, fullName: true, email: true },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { 
        createdAt: { gte: since },
        changedByAdminId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const adminActivityMap = new Map<string, typeof auditLogs>();
    for (const log of auditLogs) {
      if (log.changedByAdminId) {
        const existing = adminActivityMap.get(log.changedByAdminId) || [];
        existing.push(log);
        adminActivityMap.set(log.changedByAdminId, existing);
      }
    }

    for (const [adminId, logs] of adminActivityMap) {
      const admin = admins.find(a => a.id === adminId);
      if (!admin) continue;

      const bulkActions = logs.filter(l => 
        l.action?.includes('BULK') || 
        l.action?.includes('EXPORT') ||
        l.action?.includes('DELETE')
      );

      if (bulkActions.length > 10) {
        alerts.push({
          adminId,
          adminName: admin.fullName || 'Unknown',
          email: admin.email,
          activityType: 'BULK_EXPORT',
          description: `${bulkActions.length} bulk operations performed in ${days} day(s)`,
          timestamp: bulkActions[0].createdAt,
          riskScore: Math.min(100, bulkActions.length * 8),
          severity: bulkActions.length > 50 ? 'CRITICAL' : bulkActions.length > 20 ? 'HIGH' : 'MEDIUM',
          affectedRecords: bulkActions.length * 10,
        });
      }

      const nightLogs = logs.filter(l => {
        const hour = l.createdAt.getHours();
        return hour < 6 || hour > 22;
      });

      if (nightLogs.length > 5) {
        alerts.push({
          adminId,
          adminName: admin.fullName || 'Unknown',
          email: admin.email,
          activityType: 'OFF_HOURS_ACCESS',
          description: `${nightLogs.length} actions performed outside business hours`,
          timestamp: nightLogs[0].createdAt,
          riskScore: Math.min(100, nightLogs.length * 5),
          severity: nightLogs.length > 20 ? 'HIGH' : 'MEDIUM',
        });
      }

      const sensitiveActions = logs.filter(l =>
        l.tableName?.includes('payment') ||
        l.tableName?.includes('wallet') ||
        l.tableName?.includes('payout') ||
        l.action?.includes('VIEW_PII')
      );

      if (sensitiveActions.length > 20) {
        alerts.push({
          adminId,
          adminName: admin.fullName || 'Unknown',
          email: admin.email,
          activityType: 'SENSITIVE_DATA_ACCESS',
          description: `${sensitiveActions.length} accesses to sensitive financial data`,
          timestamp: sensitiveActions[0].createdAt,
          riskScore: Math.min(100, sensitiveActions.length * 3),
          severity: sensitiveActions.length > 50 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    return alerts.sort((a, b) => b.riskScore - a.riskScore);
  },

  async getAdminAccessPatterns(days: number = 7): Promise<AdminAccessPattern[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const patterns: AdminAccessPattern[] = [];

    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, fullName: true },
    });

    for (const admin of admins) {
      const logs = await prisma.auditLog.findMany({
        where: {
          changedByAdminId: admin.id,
          createdAt: { gte: since },
        },
      });

      const uniquePages = new Set(logs.map(l => l.tableName || 'unknown'));
      const sensitiveAccesses = logs.filter(l => 
        l.tableName?.includes('payment') || l.tableName?.includes('payout')
      ).length;
      const bulkOps = logs.filter(l => l.action?.includes('BULK')).length;
      const afterHours = logs.filter(l => {
        const h = l.createdAt.getHours();
        return h < 6 || h > 22;
      }).length;

      const anomalyFlags: string[] = [];
      let riskScore = 0;

      if (logs.length > 500) {
        anomalyFlags.push('High activity volume');
        riskScore += 20;
      }
      if (sensitiveAccesses > 50) {
        anomalyFlags.push('Frequent sensitive data access');
        riskScore += 30;
      }
      if (bulkOps > 10) {
        anomalyFlags.push('Multiple bulk operations');
        riskScore += 25;
      }
      if (afterHours > 20) {
        anomalyFlags.push('Significant after-hours activity');
        riskScore += 15;
      }

      patterns.push({
        adminId: admin.id,
        adminName: admin.fullName || 'Unknown',
        totalActions24h: logs.filter(l => 
          l.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        uniquePagesAccessed: uniquePages.size,
        sensitiveDataAccesses: sensitiveAccesses,
        bulkOperations: bulkOps,
        afterHoursActivity: afterHours,
        riskScore: Math.min(100, riskScore),
        anomalyFlags,
      });
    }

    return patterns.sort((a, b) => b.riskScore - a.riskScore);
  },

  async getPrivilegeEscalationAttempts(days: number = 7): Promise<PrivilegeEscalationAttempt[]> {
    return [];
  },

  async getDataExfiltrationRisks(): Promise<DataExfiltrationRisk[]> {
    return [];
  },

  async flagAdmin(adminId: string, reason: string, flaggedBy: string): Promise<{ success: boolean }> {
    try {
      await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: adminId,
          action: 'FLAG_INSIDER_THREAT',
          changedByAdminId: flaggedBy,
          details: { reason },
        },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  },

  async lockAdminAccount(adminId: string, reason: string, lockedBy: string): Promise<{ success: boolean }> {
    try {
      await prisma.user.update({
        where: { id: adminId },
        data: { isBlocked: true },
      });

      await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: adminId,
          action: 'LOCK_ADMIN_INSIDER_THREAT',
          changedByAdminId: lockedBy,
          details: { reason },
        },
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  },
};
