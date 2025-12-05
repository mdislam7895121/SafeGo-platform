import { prisma } from '../db';
import { ReleaseEnvironment, ReleaseDeploymentStatus, ReleaseChecklistStatus, ReleaseApprovalStatus } from '@prisma/client';

export interface CreateReleaseInput {
  versionTag: string;
  description?: string;
  releaseNotes?: string;
  includedPhases?: string[];
  createdByAdminId: string;
  createdByAdminName?: string;
}

export interface UpdateReleaseInput {
  description?: string;
  releaseNotes?: string;
  includedPhases?: string[];
}

export interface UpdateEnvironmentStatusInput {
  releaseId: string;
  environment: ReleaseEnvironment;
  deploymentStatus?: ReleaseDeploymentStatus;
  adminId: string;
  adminName?: string;
  comment?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ProposePromotionInput {
  releaseId: string;
  environment: ReleaseEnvironment;
  adminId: string;
  adminName?: string;
  comment?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApprovePromotionInput {
  releaseId: string;
  environment: ReleaseEnvironment;
  adminId: string;
  adminName?: string;
  approved: boolean;
  rejectionReason?: string;
  comment?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateChecklistItemInput {
  releaseId: string;
  environment: ReleaseEnvironment;
  itemKey: string;
  isCompleted: boolean;
  adminId: string;
  adminName?: string;
  notes?: string;
  evidenceUrl?: string;
}

export interface ListReleasesParams {
  environment?: ReleaseEnvironment;
  deploymentStatus?: ReleaseDeploymentStatus;
  limit?: number;
  offset?: number;
}

const DEFAULT_CHECKLIST_ITEMS = [
  { itemKey: 'automated_tests', itemLabel: 'Automated Tests Passed', description: 'All unit, integration, and E2E tests must pass', sortOrder: 1 },
  { itemKey: 'security_audit', itemLabel: 'Security Audit Completed', description: 'Security review and vulnerability scan completed', sortOrder: 2 },
  { itemKey: 'kyc_compliance_bd', itemLabel: 'KYC & Compliance Verified (BD)', description: 'Bangladesh KYC and compliance configurations verified', sortOrder: 3 },
  { itemKey: 'kyc_compliance_us', itemLabel: 'KYC & Compliance Verified (US)', description: 'US KYC and compliance configurations verified', sortOrder: 4 },
  { itemKey: 'backup_snapshot', itemLabel: 'Backup Snapshot Taken', description: 'Database and system backup taken before deployment', sortOrder: 5 },
  { itemKey: 'rollback_plan', itemLabel: 'Rollback Plan Documented', description: 'Rollback procedure documented and tested', sortOrder: 6 },
  { itemKey: 'performance_review', itemLabel: 'Performance Review', description: 'Load testing and performance benchmarks reviewed', sortOrder: 7 },
  { itemKey: 'documentation_updated', itemLabel: 'Documentation Updated', description: 'API docs, release notes, and user guides updated', sortOrder: 8 },
];

const PROD_ADDITIONAL_CHECKLIST = [
  { itemKey: 'staging_verified', itemLabel: 'Staging Verified', description: 'Release successfully verified in staging environment', sortOrder: 9 },
  { itemKey: 'stakeholder_approval', itemLabel: 'Stakeholder Approval', description: 'Business and product stakeholders have approved release', sortOrder: 10 },
  { itemKey: 'monitoring_alerts', itemLabel: 'Monitoring & Alerts Configured', description: 'Production monitoring and alerting configured', sortOrder: 11 },
  { itemKey: 'communication_plan', itemLabel: 'Communication Plan Ready', description: 'User communication and support plan prepared', sortOrder: 12 },
];

export const releaseService = {
  async createRelease(input: CreateReleaseInput) {
    const release = await prisma.releaseVersion.create({
      data: {
        versionTag: input.versionTag,
        description: input.description,
        releaseNotes: input.releaseNotes,
        includedPhases: input.includedPhases || [],
        createdByAdminId: input.createdByAdminId,
        createdByAdminName: input.createdByAdminName,
      },
    });

    const environments: ReleaseEnvironment[] = ['DEV', 'STAGING', 'PROD'];
    for (const env of environments) {
      await prisma.releaseEnvironmentStatus.create({
        data: {
          releaseId: release.id,
          environment: env,
          deploymentStatus: 'NOT_DEPLOYED',
          checklistStatus: 'PENDING',
          approvalStatus: env === 'PROD' ? 'NOT_REQUIRED' : 'NOT_REQUIRED',
        },
      });

      const checklistItems = env === 'PROD' 
        ? [...DEFAULT_CHECKLIST_ITEMS, ...PROD_ADDITIONAL_CHECKLIST]
        : DEFAULT_CHECKLIST_ITEMS;

      for (const item of checklistItems) {
        await prisma.releaseChecklistItem.create({
          data: {
            releaseId: release.id,
            environment: env,
            itemKey: item.itemKey,
            itemLabel: item.itemLabel,
            description: item.description,
            sortOrder: item.sortOrder,
            isRequired: true,
          },
        });
      }
    }

    await this.createAuditLog({
      releaseId: release.id,
      action: 'RELEASE_CREATED',
      newValue: JSON.stringify({ versionTag: input.versionTag, description: input.description }),
      adminId: input.createdByAdminId,
      adminName: input.createdByAdminName,
    });

    return this.getRelease(release.id);
  },

  async getRelease(id: string) {
    return prisma.releaseVersion.findUnique({
      where: { id },
      include: {
        environmentStatuses: {
          orderBy: { environment: 'asc' },
        },
        checklistItems: {
          orderBy: [{ environment: 'asc' }, { sortOrder: 'asc' }],
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
  },

  async getReleaseByVersion(versionTag: string) {
    return prisma.releaseVersion.findUnique({
      where: { versionTag },
      include: {
        environmentStatuses: true,
        checklistItems: {
          orderBy: [{ environment: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });
  },

  async listReleases(params: ListReleasesParams) {
    const where: any = {};

    if (params.environment || params.deploymentStatus) {
      where.environmentStatuses = {
        some: {
          ...(params.environment && { environment: params.environment }),
          ...(params.deploymentStatus && { deploymentStatus: params.deploymentStatus }),
        },
      };
    }

    const [releases, total] = await Promise.all([
      prisma.releaseVersion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
        include: {
          environmentStatuses: {
            orderBy: { environment: 'asc' },
          },
          _count: {
            select: { checklistItems: true, auditLogs: true },
          },
        },
      }),
      prisma.releaseVersion.count({ where }),
    ]);

    return { releases, total };
  },

  async updateRelease(id: string, input: UpdateReleaseInput, adminId: string, adminName?: string) {
    const oldRelease = await prisma.releaseVersion.findUnique({ where: { id } });
    
    const release = await prisma.releaseVersion.update({
      where: { id },
      data: {
        description: input.description,
        releaseNotes: input.releaseNotes,
        includedPhases: input.includedPhases,
      },
    });

    await this.createAuditLog({
      releaseId: id,
      action: 'RELEASE_UPDATED',
      oldValue: JSON.stringify({ description: oldRelease?.description, releaseNotes: oldRelease?.releaseNotes }),
      newValue: JSON.stringify({ description: input.description, releaseNotes: input.releaseNotes }),
      adminId,
      adminName,
    });

    return release;
  },

  async updateEnvironmentStatus(input: UpdateEnvironmentStatusInput) {
    const currentStatus = await prisma.releaseEnvironmentStatus.findUnique({
      where: {
        releaseId_environment: {
          releaseId: input.releaseId,
          environment: input.environment,
        },
      },
    });

    if (!currentStatus) {
      throw new Error('Environment status not found');
    }

    if (input.environment === 'PROD' && currentStatus.approvalStatus === 'PENDING_APPROVAL') {
      throw new Error('Production promotion requires approval before status can be updated');
    }

    const oldStatus = currentStatus.deploymentStatus;
    const now = new Date();

    const updateData: any = {
      deploymentStatus: input.deploymentStatus,
      lastUpdatedByAdminId: input.adminId,
      lastUpdatedByAdminName: input.adminName,
      lastUpdatedAt: now,
    };

    if (input.deploymentStatus === 'DEPLOYED') {
      updateData.deployedAt = now;
    } else if (input.deploymentStatus === 'VERIFIED') {
      updateData.verifiedAt = now;
    } else if (input.deploymentStatus === 'ROLLED_BACK') {
      updateData.rolledBackAt = now;
    }

    const updated = await prisma.releaseEnvironmentStatus.update({
      where: {
        releaseId_environment: {
          releaseId: input.releaseId,
          environment: input.environment,
        },
      },
      data: updateData,
    });

    await this.createAuditLog({
      releaseId: input.releaseId,
      environment: input.environment,
      action: 'STATUS_CHANGED',
      oldValue: oldStatus,
      newValue: input.deploymentStatus,
      adminId: input.adminId,
      adminName: input.adminName,
      comment: input.comment,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return updated;
  },

  async proposePromotion(input: ProposePromotionInput) {
    const currentStatus = await prisma.releaseEnvironmentStatus.findUnique({
      where: {
        releaseId_environment: {
          releaseId: input.releaseId,
          environment: input.environment,
        },
      },
    });

    if (!currentStatus) {
      throw new Error('Environment status not found');
    }

    const blockingIssues = await this.checkBlockingIssues(input.releaseId, input.environment);
    
    const updated = await prisma.releaseEnvironmentStatus.update({
      where: {
        releaseId_environment: {
          releaseId: input.releaseId,
          environment: input.environment,
        },
      },
      data: {
        approvalStatus: 'PENDING_APPROVAL',
        proposedByAdminId: input.adminId,
        proposedByAdminName: input.adminName,
        proposedAt: new Date(),
        hasBlockingIssues: blockingIssues.length > 0,
        blockingIssues: blockingIssues,
      },
    });

    await this.createAuditLog({
      releaseId: input.releaseId,
      environment: input.environment,
      action: 'PROMOTION_PROPOSED',
      newValue: JSON.stringify({ proposedBy: input.adminName, blockingIssues }),
      adminId: input.adminId,
      adminName: input.adminName,
      comment: input.comment,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return updated;
  },

  async approvePromotion(input: ApprovePromotionInput) {
    const currentStatus = await prisma.releaseEnvironmentStatus.findUnique({
      where: {
        releaseId_environment: {
          releaseId: input.releaseId,
          environment: input.environment,
        },
      },
    });

    if (!currentStatus) {
      throw new Error('Environment status not found');
    }

    if (currentStatus.approvalStatus !== 'PENDING_APPROVAL') {
      throw new Error('No pending approval to process');
    }

    if (currentStatus.proposedByAdminId === input.adminId) {
      throw new Error('Cannot approve your own promotion proposal');
    }

    const now = new Date();
    
    const updated = await prisma.releaseEnvironmentStatus.update({
      where: {
        releaseId_environment: {
          releaseId: input.releaseId,
          environment: input.environment,
        },
      },
      data: {
        approvalStatus: input.approved ? 'APPROVED' : 'REJECTED',
        approvedByAdminId: input.adminId,
        approvedByAdminName: input.adminName,
        approvedAt: now,
        rejectionReason: input.approved ? null : input.rejectionReason,
      },
    });

    await this.createAuditLog({
      releaseId: input.releaseId,
      environment: input.environment,
      action: input.approved ? 'PROMOTION_APPROVED' : 'PROMOTION_REJECTED',
      oldValue: 'PENDING_APPROVAL',
      newValue: input.approved ? 'APPROVED' : 'REJECTED',
      adminId: input.adminId,
      adminName: input.adminName,
      comment: input.approved ? input.comment : input.rejectionReason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return updated;
  },

  async updateChecklistItem(input: UpdateChecklistItemInput) {
    const currentItem = await prisma.releaseChecklistItem.findUnique({
      where: {
        releaseId_environment_itemKey: {
          releaseId: input.releaseId,
          environment: input.environment,
          itemKey: input.itemKey,
        },
      },
    });

    if (!currentItem) {
      throw new Error('Checklist item not found');
    }

    const updated = await prisma.releaseChecklistItem.update({
      where: {
        releaseId_environment_itemKey: {
          releaseId: input.releaseId,
          environment: input.environment,
          itemKey: input.itemKey,
        },
      },
      data: {
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? new Date() : null,
        completedByAdminId: input.isCompleted ? input.adminId : null,
        completedByAdminName: input.isCompleted ? input.adminName : null,
        notes: input.notes,
        evidenceUrl: input.evidenceUrl,
      },
    });

    await this.updateChecklistStatus(input.releaseId, input.environment);

    await this.createAuditLog({
      releaseId: input.releaseId,
      environment: input.environment,
      action: 'CHECKLIST_UPDATED',
      oldValue: JSON.stringify({ isCompleted: currentItem.isCompleted }),
      newValue: JSON.stringify({ isCompleted: input.isCompleted, itemKey: input.itemKey }),
      adminId: input.adminId,
      adminName: input.adminName,
    });

    return updated;
  },

  async updateChecklistStatus(releaseId: string, environment: ReleaseEnvironment) {
    const items = await prisma.releaseChecklistItem.findMany({
      where: {
        releaseId,
        environment,
        isRequired: true,
      },
    });

    const allCompleted = items.every(item => item.isCompleted);
    const anyFailed = items.some(item => !item.isCompleted && item.notes?.toLowerCase().includes('failed'));

    const checklistStatus: ReleaseChecklistStatus = anyFailed 
      ? 'FAILED' 
      : allCompleted 
        ? 'PASSED' 
        : 'PENDING';

    await prisma.releaseEnvironmentStatus.update({
      where: {
        releaseId_environment: { releaseId, environment },
      },
      data: { checklistStatus },
    });
  },

  async checkBlockingIssues(releaseId: string, environment: ReleaseEnvironment): Promise<string[]> {
    const issues: string[] = [];

    const checklistItems = await prisma.releaseChecklistItem.findMany({
      where: { releaseId, environment, isRequired: true },
    });
    
    const incompleteRequired = checklistItems.filter(item => !item.isCompleted);
    if (incompleteRequired.length > 0) {
      issues.push(`${incompleteRequired.length} required checklist items incomplete`);
    }

    if (environment === 'PROD') {
      const stagingStatus = await prisma.releaseEnvironmentStatus.findUnique({
        where: {
          releaseId_environment: { releaseId, environment: 'STAGING' },
        },
      });
      
      if (stagingStatus?.deploymentStatus !== 'VERIFIED') {
        issues.push('Staging environment not verified');
      }
    }

    return issues;
  },

  async getAuditHistory(releaseId: string, environment?: ReleaseEnvironment) {
    const where: any = { releaseId };
    if (environment) {
      where.environment = environment;
    }

    return prisma.releaseAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async createAuditLog(data: {
    releaseId: string;
    environment?: ReleaseEnvironment;
    action: string;
    oldValue?: string;
    newValue?: string;
    adminId: string;
    adminName?: string;
    comment?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.releaseAuditLog.create({
      data: {
        releaseId: data.releaseId,
        environment: data.environment,
        action: data.action,
        oldValue: data.oldValue,
        newValue: data.newValue,
        adminId: data.adminId,
        adminName: data.adminName,
        comment: data.comment,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  },

  async getEnvironmentSummary() {
    const releases = await prisma.releaseVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        environmentStatuses: true,
      },
    });

    const summary = {
      DEV: { deployed: 0, verified: 0, pendingApproval: 0 },
      STAGING: { deployed: 0, verified: 0, pendingApproval: 0 },
      PROD: { deployed: 0, verified: 0, pendingApproval: 0 },
    };

    for (const release of releases) {
      for (const status of release.environmentStatuses) {
        if (status.deploymentStatus === 'DEPLOYED') {
          summary[status.environment].deployed++;
        }
        if (status.deploymentStatus === 'VERIFIED') {
          summary[status.environment].verified++;
        }
        if (status.approvalStatus === 'PENDING_APPROVAL') {
          summary[status.environment].pendingApproval++;
        }
      }
    }

    return {
      summary,
      recentReleases: releases,
    };
  },

  async deleteRelease(id: string, adminId: string, adminName?: string) {
    const release = await prisma.releaseVersion.findUnique({ where: { id } });
    
    if (!release) {
      throw new Error('Release not found');
    }

    const hasDeployments = await prisma.releaseEnvironmentStatus.findFirst({
      where: {
        releaseId: id,
        deploymentStatus: { in: ['DEPLOYED', 'VERIFIED'] },
      },
    });

    if (hasDeployments) {
      throw new Error('Cannot delete a release that has been deployed');
    }

    await prisma.releaseAuditLog.deleteMany({ where: { releaseId: id } });
    await prisma.releaseChecklistItem.deleteMany({ where: { releaseId: id } });
    await prisma.releaseEnvironmentStatus.deleteMany({ where: { releaseId: id } });
    await prisma.releaseVersion.delete({ where: { id } });

    return { success: true, versionTag: release.versionTag };
  },
};
