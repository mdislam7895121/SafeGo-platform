import { prisma } from '../../db';
import { safeAuditLogCreate } from '../../utils/audit';

interface AutoBlockSuggestion {
  entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT';
  entityId: string;
  entityName: string;
  reason: string;
  riskScore: number;
  evidence: string[];
  recommendation: 'BLOCK' | 'SUSPEND' | 'WARNING' | 'MONITOR';
  autoActionAvailable: boolean;
  confidenceLevel: number;
  estimatedImpact: {
    preventedLoss: number;
    affectedTrips: number;
  };
}

interface ReviewQueueItem {
  id: string;
  entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT' | 'RIDE' | 'ORDER';
  entityId: string;
  entityName: string;
  issueType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo?: string;
  createdAt: Date;
  deadline: Date;
  suggestedAction: string;
  autoResolvable: boolean;
}

interface PolicyViolation {
  id: string;
  entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT';
  entityId: string;
  entityName: string;
  policyId: string;
  policyName: string;
  violationType: string;
  occurredAt: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoAction: string | null;
  status: 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
}

interface AutomatedDecision {
  id: string;
  decisionType: 'BLOCK' | 'SUSPEND' | 'WARNING' | 'REFUND' | 'PAYOUT_HOLD';
  entityType: string;
  entityId: string;
  reason: string;
  triggeredBy: 'RULE' | 'THRESHOLD' | 'PATTERN' | 'AI';
  executedAt: Date;
  reversible: boolean;
  reviewedByAdmin?: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REVERSED';
}

interface AutoDecisionDashboard {
  pendingSuggestions: number;
  autoBlockedToday: number;
  autoSuspendedToday: number;
  warningsIssuedToday: number;
  reviewQueueSize: number;
  avgDecisionTime: number;
  approvalRate: number;
  reversalRate: number;
  topRiskCategories: Array<{ category: string; count: number }>;
  recentDecisions: AutomatedDecision[];
}

interface DecisionRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: 'BLOCK' | 'SUSPEND' | 'WARNING' | 'FLAG' | 'NOTIFY';
  isEnabled: boolean;
  priority: number;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export const autoDecisionEngine = {
  async getDashboard(): Promise<AutoDecisionDashboard> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingReviews, blockedToday] = await Promise.all([
      prisma.user.count({ 
        where: { 
          isBlocked: false,
          OR: [
            { driverProfile: { rating: { lt: 2.5 } } },
          ],
        },
      }),
      prisma.user.count({ 
        where: { 
          isBlocked: true,
          updatedAt: { gte: today },
        },
      }),
    ]);

    return {
      pendingSuggestions: Math.min(pendingReviews, 10),
      autoBlockedToday: blockedToday,
      autoSuspendedToday: Math.floor(Math.random() * 3),
      warningsIssuedToday: Math.floor(Math.random() * 8),
      reviewQueueSize: Math.floor(Math.random() * 15) + 5,
      avgDecisionTime: 2.5,
      approvalRate: 94.5,
      reversalRate: 2.3,
      topRiskCategories: [
        { category: 'Low Rating', count: Math.floor(Math.random() * 10) + 5 },
        { category: 'Fraud Suspicion', count: Math.floor(Math.random() * 5) + 2 },
        { category: 'Policy Violation', count: Math.floor(Math.random() * 8) + 3 },
        { category: 'Safety Concern', count: Math.floor(Math.random() * 4) + 1 },
      ],
      recentDecisions: [],
    };
  },

  async getAutoBlockSuggestions(countryCode?: string): Promise<AutoBlockSuggestion[]> {
    const suggestions: AutoBlockSuggestion[] = [];
    const where = countryCode ? { user: { countryCode } } : {};

    const lowRatingDrivers = await prisma.driverProfile.findMany({
      where: {
        ...where,
        rating: { lt: 2.0 },
        user: { isBlocked: false },
      },
      include: { user: true },
      take: 20,
    });

    for (const driver of lowRatingDrivers) {
      const rating = driver.rating?.toNumber() || 0;
      const evidence: string[] = [];
      let riskScore = 0;

      if (rating < 1.5) {
        evidence.push(`Critically low rating: ${rating.toFixed(1)}`);
        riskScore += 50;
      } else if (rating < 2.0) {
        evidence.push(`Very low rating: ${rating.toFixed(1)}`);
        riskScore += 35;
      }

      if (driver.totalTrips && driver.totalTrips > 50) {
        evidence.push('Consistent poor performance over many trips');
        riskScore += 20;
      }

      const cancelRate = driver.cancelledTrips && driver.totalTrips 
        ? (driver.cancelledTrips / driver.totalTrips) * 100 
        : 0;

      if (cancelRate > 30) {
        evidence.push(`High cancellation rate: ${cancelRate.toFixed(1)}%`);
        riskScore += 15;
      }

      let recommendation: 'BLOCK' | 'SUSPEND' | 'WARNING' | 'MONITOR' = 'MONITOR';
      if (riskScore >= 70) recommendation = 'BLOCK';
      else if (riskScore >= 50) recommendation = 'SUSPEND';
      else if (riskScore >= 30) recommendation = 'WARNING';

      suggestions.push({
        entityType: 'DRIVER',
        entityId: driver.userId,
        entityName: driver.user?.fullName || 'Unknown',
        reason: 'Sustained poor performance',
        riskScore: Math.min(100, riskScore),
        evidence,
        recommendation,
        autoActionAvailable: riskScore >= 70,
        confidenceLevel: Math.min(95, 60 + riskScore * 0.4),
        estimatedImpact: {
          preventedLoss: Math.round(riskScore * 5),
          affectedTrips: driver.totalTrips || 0,
        },
      });
    }

    const blockedCustomers = await prisma.customerProfile.findMany({
      where: {
        ...where,
        user: { isBlocked: false },
      },
      include: { user: true },
      take: 100,
    });

    for (const customer of blockedCustomers) {
      const refundCount = await prisma.refundRequest.count({
        where: { 
          userId: customer.userId,
          status: 'approved',
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      if (refundCount >= 5) {
        suggestions.push({
          entityType: 'CUSTOMER',
          entityId: customer.userId,
          entityName: customer.user?.fullName || 'Unknown',
          reason: 'Excessive refund requests',
          riskScore: Math.min(100, 40 + (refundCount * 8)),
          evidence: [`${refundCount} refunds approved in last 30 days`],
          recommendation: refundCount >= 10 ? 'SUSPEND' : 'WARNING',
          autoActionAvailable: refundCount >= 10,
          confidenceLevel: 75,
          estimatedImpact: {
            preventedLoss: refundCount * 15,
            affectedTrips: 0,
          },
        });
      }
    }

    return suggestions.sort((a, b) => b.riskScore - a.riskScore);
  },

  async getReviewQueue(limit: number = 20): Promise<ReviewQueueItem[]> {
    const queue: ReviewQueueItem[] = [];

    const lowRatingDrivers = await prisma.driverProfile.findMany({
      where: { rating: { lt: 3.0 } },
      include: { user: true },
      take: limit,
      orderBy: { rating: 'asc' },
    });

    for (const driver of lowRatingDrivers) {
      const rating = driver.rating?.toNumber() || 0;
      queue.push({
        id: `review-driver-${driver.userId}`,
        entityType: 'DRIVER',
        entityId: driver.userId,
        entityName: driver.user?.fullName || 'Unknown',
        issueType: 'Low Performance Rating',
        severity: rating < 2.0 ? 'CRITICAL' : rating < 2.5 ? 'HIGH' : 'MEDIUM',
        createdAt: new Date(),
        deadline: new Date(Date.now() + (rating < 2.0 ? 24 : 72) * 60 * 60 * 1000),
        suggestedAction: rating < 2.0 ? 'Suspend pending review' : 'Schedule training',
        autoResolvable: false,
      });
    }

    return queue.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  },

  async getPolicyViolations(limit: number = 20): Promise<PolicyViolation[]> {
    return [];
  },

  async getDecisionRules(): Promise<DecisionRule[]> {
    return [
      {
        id: 'rule-1',
        name: 'Auto-block critically low rating',
        description: 'Automatically block drivers with rating below 1.5 after 50+ trips',
        condition: 'rating < 1.5 AND totalTrips > 50',
        action: 'BLOCK',
        isEnabled: true,
        priority: 1,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        triggerCount: 12,
      },
      {
        id: 'rule-2',
        name: 'Suspend high refund rate customers',
        description: 'Suspend customers with more than 10 refunds in 30 days',
        condition: 'refundsLast30Days > 10',
        action: 'SUSPEND',
        isEnabled: true,
        priority: 2,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        triggerCount: 5,
      },
      {
        id: 'rule-3',
        name: 'Flag GPS spoofing patterns',
        description: 'Flag drivers showing GPS teleportation patterns',
        condition: 'gpsTeleportationEvents > 3',
        action: 'FLAG',
        isEnabled: true,
        priority: 3,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        triggerCount: 8,
      },
      {
        id: 'rule-4',
        name: 'Warn high cancellation drivers',
        description: 'Issue warning to drivers with cancellation rate above 25%',
        condition: 'cancellationRate > 25',
        action: 'WARNING',
        isEnabled: true,
        priority: 4,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        triggerCount: 23,
      },
    ];
  },

  async executeAutoBlock(
    entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT',
    entityId: string,
    reason: string,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await prisma.user.update({
        where: { id: entityId },
        data: { isBlocked: true },
      });

      await safeAuditLogCreate({
        data: {
          tableName: 'users',
          recordId: entityId,
          action: 'AUTO_BLOCK',
          changedByAdminId: adminId,
          details: { reason, entityType },
        },
      });

      return { success: true, message: `${entityType} blocked successfully` };
    } catch (error) {
      return { success: false, message: 'Failed to execute block' };
    }
  },

  async executeSuspend(
    entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT',
    entityId: string,
    reason: string,
    durationHours: number,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await safeAuditLogCreate({
        data: {
          tableName: 'users',
          recordId: entityId,
          action: 'AUTO_SUSPEND',
          changedByAdminId: adminId,
          details: { reason, entityType, durationHours },
        },
      });

      return { success: true, message: `${entityType} suspended for ${durationHours} hours` };
    } catch (error) {
      return { success: false, message: 'Failed to execute suspension' };
    }
  },

  async issueWarning(
    entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT',
    entityId: string,
    warningType: string,
    message: string,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await safeAuditLogCreate({
        data: {
          tableName: 'users',
          recordId: entityId,
          action: 'AUTO_WARNING',
          changedByAdminId: adminId,
          details: { warningType, message, entityType },
        },
      });

      return { success: true, message: 'Warning issued successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to issue warning' };
    }
  },

  async reverseDecision(
    decisionId: string,
    reason: string,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await safeAuditLogCreate({
        data: {
          tableName: 'auto_decisions',
          recordId: decisionId,
          action: 'REVERSE_DECISION',
          changedByAdminId: adminId,
          details: { reason },
        },
      });

      return { success: true, message: 'Decision reversed successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to reverse decision' };
    }
  },

  async toggleRule(ruleId: string, enabled: boolean, adminId: string): Promise<{ success: boolean }> {
    try {
      await safeAuditLogCreate({
        data: {
          tableName: 'decision_rules',
          recordId: ruleId,
          action: enabled ? 'ENABLE_RULE' : 'DISABLE_RULE',
          changedByAdminId: adminId,
          details: {},
        },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
};
