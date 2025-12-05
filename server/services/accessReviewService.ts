import { prisma } from '../db';
import { ReviewCycleStatus, ReviewDecision } from '@prisma/client';

export interface CreateCycleInput {
  name: string;
  description?: string;
  period: string;
  countryScope?: string;
  roleScope?: string[];
  startDate?: Date;
  dueDate?: Date;
  requiresTwoPersonRule?: boolean;
  notifyOnComplete?: boolean;
  createdByAdminId: string;
  createdByAdminName?: string;
}

export interface UpdateCycleInput {
  name?: string;
  description?: string;
  period?: string;
  countryScope?: string;
  roleScope?: string[];
  startDate?: Date;
  dueDate?: Date;
  requiresTwoPersonRule?: boolean;
  notifyOnComplete?: boolean;
}

export interface ReviewItemDecisionInput {
  itemId: string;
  decision: 'KEEP' | 'REVOKE' | 'CHANGE_ROLE';
  justificationText?: string;
  newRole?: string;
  decidedByAdminId: string;
  decidedByAdminName?: string;
}

export interface SecondApprovalInput {
  itemId: string;
  decision: 'KEEP' | 'REVOKE' | 'CHANGE_ROLE';
  approvedByAdminId: string;
  approvedByAdminName?: string;
}

export interface ListCyclesParams {
  status?: ReviewCycleStatus;
  countryScope?: string;
  limit?: number;
  offset?: number;
}

export interface ListItemsParams {
  reviewCycleId: string;
  decision?: ReviewDecision;
  team?: string;
  country?: string;
  isEnforced?: boolean;
  limit?: number;
  offset?: number;
}

function getTeamFromRole(role: string): string {
  const roleTeamMap: Record<string, string> = {
    'SUPER_ADMIN': 'Executive',
    'ADMIN': 'General',
    'COUNTRY_ADMIN': 'Regional',
    'CITY_ADMIN': 'Regional',
    'COMPLIANCE_ADMIN': 'Compliance',
    'SUPPORT_ADMIN': 'Support',
    'FINANCE_ADMIN': 'Finance',
    'RISK_ADMIN': 'Risk',
    'READONLY_ADMIN': 'General',
  };
  return roleTeamMap[role] || 'Other';
}

export const accessReviewService = {
  async createCycle(input: CreateCycleInput) {
    const cycle = await prisma.accessReviewCycle.create({
      data: {
        name: input.name,
        description: input.description,
        period: input.period,
        countryScope: input.countryScope,
        roleScope: input.roleScope || [],
        startDate: input.startDate,
        dueDate: input.dueDate,
        requiresTwoPersonRule: input.requiresTwoPersonRule || false,
        notifyOnComplete: input.notifyOnComplete ?? true,
        createdByAdminId: input.createdByAdminId,
        createdByAdminName: input.createdByAdminName,
        status: 'OPEN',
      },
    });

    await this.populateCycleItems(cycle.id, input.countryScope, input.roleScope);

    const updatedCycle = await prisma.accessReviewCycle.findUnique({
      where: { id: cycle.id },
      include: { reviewItems: true },
    });

    return updatedCycle;
  },

  async populateCycleItems(cycleId: string, countryScope?: string, roleScope?: string[]) {
    const where: any = {
      role: 'admin',
      adminProfile: { isNot: null },
    };

    const adminUsers = await prisma.user.findMany({
      where,
      include: {
        adminProfile: true,
      },
    });

    const itemsToCreate = [];

    for (const user of adminUsers) {
      if (!user.adminProfile) continue;

      const adminRole = user.adminProfile.adminRole;
      const adminCountry = user.adminProfile.countryCode;

      if (countryScope && adminCountry !== countryScope) continue;
      if (roleScope && roleScope.length > 0 && !roleScope.includes(adminRole)) continue;

      const cycle = await prisma.accessReviewCycle.findUnique({
        where: { id: cycleId },
      });

      itemsToCreate.push({
        reviewCycleId: cycleId,
        adminId: user.id,
        adminEmail: user.email,
        adminName: user.name,
        currentRole: adminRole,
        team: getTeamFromRole(adminRole),
        country: adminCountry,
        requiresSecondApproval: cycle?.requiresTwoPersonRule || false,
        previousRoles: [adminRole],
      });
    }

    if (itemsToCreate.length > 0) {
      await prisma.accessReviewItem.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
      });

      await prisma.accessReviewCycle.update({
        where: { id: cycleId },
        data: { totalItems: itemsToCreate.length },
      });
    }

    return itemsToCreate.length;
  },

  async getCycle(id: string) {
    return prisma.accessReviewCycle.findUnique({
      where: { id },
      include: {
        reviewItems: {
          orderBy: [
            { team: 'asc' },
            { adminEmail: 'asc' },
          ],
        },
      },
    });
  },

  async listCycles(params: ListCyclesParams) {
    const where: any = {};
    
    if (params.status) {
      where.status = params.status;
    }
    if (params.countryScope) {
      where.countryScope = params.countryScope;
    }

    const [cycles, total] = await Promise.all([
      prisma.accessReviewCycle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
        include: {
          _count: {
            select: { reviewItems: true },
          },
        },
      }),
      prisma.accessReviewCycle.count({ where }),
    ]);

    return { cycles, total };
  },

  async updateCycle(id: string, input: UpdateCycleInput) {
    return prisma.accessReviewCycle.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        period: input.period,
        countryScope: input.countryScope,
        roleScope: input.roleScope,
        startDate: input.startDate,
        dueDate: input.dueDate,
        requiresTwoPersonRule: input.requiresTwoPersonRule,
        notifyOnComplete: input.notifyOnComplete,
      },
    });
  },

  async startCycle(id: string) {
    return prisma.accessReviewCycle.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startDate: new Date(),
      },
    });
  },

  async completeCycle(id: string) {
    const cycle = await prisma.accessReviewCycle.findUnique({
      where: { id },
      include: { reviewItems: true },
    });

    if (!cycle) {
      throw new Error('Review cycle not found');
    }

    const pendingItems = cycle.reviewItems.filter(item => item.decision === 'PENDING');
    if (pendingItems.length > 0) {
      throw new Error(`Cannot complete cycle: ${pendingItems.length} items still pending review`);
    }

    const keptCount = cycle.reviewItems.filter(item => item.decision === 'KEEP').length;
    const revokedCount = cycle.reviewItems.filter(item => item.decision === 'REVOKE').length;
    const changedRoleCount = cycle.reviewItems.filter(item => item.decision === 'CHANGE_ROLE').length;

    const updatedCycle = await prisma.accessReviewCycle.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        reviewedItems: cycle.reviewItems.length,
        keptCount,
        revokedCount,
        changedRoleCount,
      },
    });

    const reviewerIds = [...new Set(cycle.reviewItems.map(item => item.decidedByAdminId).filter(Boolean))] as string[];
    const reviewerNames = [...new Set(cycle.reviewItems.map(item => item.decidedByAdminName).filter(Boolean))] as string[];

    await prisma.accessReviewSummary.create({
      data: {
        reviewCycleId: id,
        cycleName: cycle.name,
        period: cycle.period,
        totalAdminsReviewed: [...new Set(cycle.reviewItems.map(item => item.adminId))].length,
        totalRolesReviewed: cycle.reviewItems.length,
        keptCount,
        revokedCount,
        changedRoleCount,
        reviewerIds,
        reviewerNames,
        cycleStartedAt: cycle.startDate || cycle.createdAt,
        cycleCompletedAt: new Date(),
        durationDays: Math.ceil(
          (new Date().getTime() - (cycle.startDate || cycle.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
    });

    await this.enforceDecisions(id);

    return updatedCycle;
  },

  async cancelCycle(id: string) {
    return prisma.accessReviewCycle.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  },

  async listItems(params: ListItemsParams) {
    const where: any = {
      reviewCycleId: params.reviewCycleId,
    };

    if (params.decision) {
      where.decision = params.decision;
    }
    if (params.team) {
      where.team = params.team;
    }
    if (params.country) {
      where.country = params.country;
    }
    if (params.isEnforced !== undefined) {
      where.isEnforced = params.isEnforced;
    }

    const [items, total] = await Promise.all([
      prisma.accessReviewItem.findMany({
        where,
        orderBy: [
          { team: 'asc' },
          { adminEmail: 'asc' },
        ],
        take: params.limit || 100,
        skip: params.offset || 0,
      }),
      prisma.accessReviewItem.count({ where }),
    ]);

    return { items, total };
  },

  async getItem(id: string) {
    return prisma.accessReviewItem.findUnique({
      where: { id },
      include: { reviewCycle: true },
    });
  },

  async makeDecision(input: ReviewItemDecisionInput) {
    const item = await prisma.accessReviewItem.findUnique({
      where: { id: input.itemId },
      include: { reviewCycle: true },
    });

    if (!item) {
      throw new Error('Review item not found');
    }

    if (item.reviewCycle.status !== 'IN_PROGRESS') {
      throw new Error('Review cycle is not in progress');
    }

    if (input.decision === 'CHANGE_ROLE' && !input.newRole) {
      throw new Error('New role is required for CHANGE_ROLE decision');
    }

    const updatedItem = await prisma.accessReviewItem.update({
      where: { id: input.itemId },
      data: {
        decision: input.decision as ReviewDecision,
        justificationText: input.justificationText,
        newRole: input.newRole,
        decidedByAdminId: input.decidedByAdminId,
        decidedByAdminName: input.decidedByAdminName,
        decidedAt: new Date(),
      },
    });

    const allItems = await prisma.accessReviewItem.count({
      where: { reviewCycleId: item.reviewCycleId },
    });
    const reviewedItems = await prisma.accessReviewItem.count({
      where: { 
        reviewCycleId: item.reviewCycleId,
        decision: { not: 'PENDING' },
      },
    });

    await prisma.accessReviewCycle.update({
      where: { id: item.reviewCycleId },
      data: { reviewedItems },
    });

    return updatedItem;
  },

  async provideSecondApproval(input: SecondApprovalInput) {
    const item = await prisma.accessReviewItem.findUnique({
      where: { id: input.itemId },
      include: { reviewCycle: true },
    });

    if (!item) {
      throw new Error('Review item not found');
    }

    if (!item.requiresSecondApproval) {
      throw new Error('This item does not require second approval');
    }

    if (item.decision === 'PENDING') {
      throw new Error('First decision must be made before second approval');
    }

    if (item.decidedByAdminId === input.approvedByAdminId) {
      throw new Error('Second approver must be different from first reviewer');
    }

    return prisma.accessReviewItem.update({
      where: { id: input.itemId },
      data: {
        secondApprovalBy: input.approvedByAdminId,
        secondApprovalByName: input.approvedByAdminName,
        secondApprovalAt: new Date(),
        secondApprovalDecision: input.decision as ReviewDecision,
      },
    });
  },

  async enforceDecisions(cycleId: string) {
    const itemsToEnforce = await prisma.accessReviewItem.findMany({
      where: {
        reviewCycleId: cycleId,
        decision: { in: ['REVOKE', 'CHANGE_ROLE'] },
        isEnforced: false,
      },
    });

    const results = [];

    for (const item of itemsToEnforce) {
      try {
        if (item.requiresSecondApproval && !item.secondApprovalAt) {
          results.push({
            itemId: item.id,
            success: false,
            error: 'Requires second approval before enforcement',
          });
          continue;
        }

        if (item.decision === 'REVOKE') {
          await prisma.adminProfile.update({
            where: { userId: item.adminId },
            data: { isActive: false },
          });
        } else if (item.decision === 'CHANGE_ROLE' && item.newRole) {
          await prisma.adminProfile.update({
            where: { userId: item.adminId },
            data: { adminRole: item.newRole as any },
          });
        }

        await prisma.accessReviewItem.update({
          where: { id: item.id },
          data: {
            isEnforced: true,
            enforcedAt: new Date(),
          },
        });

        results.push({
          itemId: item.id,
          success: true,
        });
      } catch (error: any) {
        await prisma.accessReviewItem.update({
          where: { id: item.id },
          data: {
            enforcementError: error.message || 'Unknown error during enforcement',
          },
        });

        results.push({
          itemId: item.id,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  },

  async getStats(cycleId?: string) {
    if (cycleId) {
      const cycle = await prisma.accessReviewCycle.findUnique({
        where: { id: cycleId },
        include: { reviewItems: true },
      });

      if (!cycle) {
        throw new Error('Cycle not found');
      }

      const byTeam: Record<string, number> = {};
      const byDecision: Record<string, number> = {
        PENDING: 0,
        KEEP: 0,
        REVOKE: 0,
        CHANGE_ROLE: 0,
      };

      for (const item of cycle.reviewItems) {
        byTeam[item.team || 'Unknown'] = (byTeam[item.team || 'Unknown'] || 0) + 1;
        byDecision[item.decision] = (byDecision[item.decision] || 0) + 1;
      }

      return {
        cycleId,
        totalItems: cycle.totalItems,
        reviewedItems: cycle.reviewedItems,
        pendingItems: byDecision.PENDING,
        keptCount: byDecision.KEEP,
        revokedCount: byDecision.REVOKE,
        changedRoleCount: byDecision.CHANGE_ROLE,
        byTeam,
        byDecision,
        completionRate: cycle.totalItems > 0 
          ? Math.round((cycle.reviewedItems / cycle.totalItems) * 100) 
          : 0,
      };
    }

    const [totalCycles, openCycles, completedCycles, totalItems, enforcedItems] = await Promise.all([
      prisma.accessReviewCycle.count(),
      prisma.accessReviewCycle.count({ where: { status: 'OPEN' } }),
      prisma.accessReviewCycle.count({ where: { status: 'COMPLETED' } }),
      prisma.accessReviewItem.count(),
      prisma.accessReviewItem.count({ where: { isEnforced: true } }),
    ]);

    return {
      totalCycles,
      openCycles,
      completedCycles,
      inProgressCycles: await prisma.accessReviewCycle.count({ where: { status: 'IN_PROGRESS' } }),
      totalItems,
      enforcedItems,
    };
  },

  async getSummary(cycleId: string) {
    return prisma.accessReviewSummary.findUnique({
      where: { reviewCycleId: cycleId },
    });
  },

  async exportCycleData(cycleId: string) {
    const cycle = await prisma.accessReviewCycle.findUnique({
      where: { id: cycleId },
      include: { reviewItems: true },
    });

    if (!cycle) {
      throw new Error('Cycle not found');
    }

    const csvRows = [
      ['Admin Email', 'Admin Name', 'Current Role', 'Team', 'Country', 'Decision', 'New Role', 'Justification', 'Reviewed By', 'Reviewed At', 'Second Approval By', 'Second Approval At', 'Enforced', 'Enforced At'].join(','),
    ];

    for (const item of cycle.reviewItems) {
      csvRows.push([
        item.adminEmail,
        item.adminName || '',
        item.currentRole,
        item.team || '',
        item.country || '',
        item.decision,
        item.newRole || '',
        `"${(item.justificationText || '').replace(/"/g, '""')}"`,
        item.decidedByAdminName || '',
        item.decidedAt?.toISOString() || '',
        item.secondApprovalByName || '',
        item.secondApprovalAt?.toISOString() || '',
        item.isEnforced ? 'Yes' : 'No',
        item.enforcedAt?.toISOString() || '',
      ].join(','));
    }

    await prisma.accessReviewSummary.upsert({
      where: { reviewCycleId: cycleId },
      update: {
        exportedAt: new Date(),
        exportType: 'CSV',
      },
      create: {
        reviewCycleId: cycleId,
        cycleName: cycle.name,
        period: cycle.period,
        totalAdminsReviewed: [...new Set(cycle.reviewItems.map(item => item.adminId))].length,
        totalRolesReviewed: cycle.reviewItems.length,
        keptCount: cycle.keptCount,
        revokedCount: cycle.revokedCount,
        changedRoleCount: cycle.changedRoleCount,
        reviewerIds: [],
        reviewerNames: [],
        cycleStartedAt: cycle.startDate || cycle.createdAt,
        cycleCompletedAt: cycle.completedAt || new Date(),
        durationDays: 0,
        exportedAt: new Date(),
        exportType: 'CSV',
      },
    });

    return {
      filename: `access-review-${cycle.period.replace(/\s+/g, '-')}-${Date.now()}.csv`,
      content: csvRows.join('\n'),
      mimeType: 'text/csv',
    };
  },

  async getTeams() {
    const items = await prisma.accessReviewItem.findMany({
      select: { team: true },
      distinct: ['team'],
    });
    return items.map(i => i.team).filter(Boolean);
  },

  async getCountries() {
    const items = await prisma.accessReviewItem.findMany({
      select: { country: true },
      distinct: ['country'],
    });
    return items.map(i => i.country).filter(Boolean);
  },
};
