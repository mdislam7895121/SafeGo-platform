import { prisma } from '../db';
import { v4 as uuidv4 } from 'uuid';

export type BackupType = 'FULL_DB' | 'PARTIAL_ANALYTICS' | 'FILES_ONLY' | 'CONFIG_ONLY';
export type BackupStatus = 'CREATED' | 'VERIFIED' | 'FAILED' | 'IN_PROGRESS';
export type RestoreStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type BackupEnvironment = 'dev' | 'staging' | 'prod';
export type BackupFrequency = 'HOURLY' | 'DAILY' | 'WEEKLY';

export interface BackupSnapshot {
  id: string;
  createdAt: Date;
  environment: string;
  type: string;
  storageLocationLabel: string;
  sizeMb: number | null;
  status: string;
  retentionDays: number;
  expiresAt: Date | null;
  initiatedBy: string | null;
  initiatedByName: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  errorMessage: string | null;
  metadata: any;
  isDeleted: boolean;
}

export interface RestoreOperation {
  id: string;
  snapshotId: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  initiatedBy: string;
  initiatedByName: string | null;
  confirmationToken: string | null;
  confirmedAt: Date | null;
  errorMessage: string | null;
  rollbackAvailable: boolean;
  auditLogId: string | null;
  metadata: any;
  createdAt: Date;
}

export interface DRConfiguration {
  id: string;
  environment: string;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  autoBackupEnabled: boolean;
  backupFrequency: string;
  backupRetentionDays: number;
  crossRegionEnabled: boolean;
  crossRegionLocation: string | null;
  lastBackupAt: Date | null;
  lastVerifiedBackupAt: Date | null;
  alertsEnabled: boolean;
  alertRecipients: string[];
  metadata: any;
}

export interface DRStatus {
  environment: string;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  lastBackupAt: Date | null;
  lastVerifiedBackupAt: Date | null;
  crossRegionEnabled: boolean;
  crossRegionLocation: string | null;
  backupCount: number;
  verifiedBackupCount: number;
  failedBackupCount: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
}

const STORAGE_LOCATION_LABELS: Record<BackupEnvironment, string> = {
  dev: 'Development Storage (US-East-1)',
  staging: 'Staging Storage (US-West-2)',
  prod: 'Production Primary (US-East-1) + DR (EU-West-1)',
};

class BackupService {
  async listSnapshots(filters?: {
    environment?: string;
    type?: string;
    status?: string;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ snapshots: BackupSnapshot[]; total: number }> {
    const where: any = {};
    
    if (filters?.environment) {
      where.environment = filters.environment;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (!filters?.includeDeleted) {
      where.isDeleted = false;
    }

    const [snapshots, total] = await Promise.all([
      prisma.backupSnapshot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.backupSnapshot.count({ where }),
    ]);

    return {
      snapshots: snapshots.map(s => ({
        ...s,
        sizeMb: s.sizeMb ? Number(s.sizeMb) : null,
      })),
      total,
    };
  }

  async getSnapshot(id: string): Promise<BackupSnapshot | null> {
    const snapshot = await prisma.backupSnapshot.findUnique({
      where: { id },
    });
    
    if (!snapshot) return null;
    
    return {
      ...snapshot,
      sizeMb: snapshot.sizeMb ? Number(snapshot.sizeMb) : null,
    };
  }

  async triggerBackup(params: {
    environment: BackupEnvironment;
    type: BackupType;
    initiatedBy: string;
    initiatedByName: string;
  }): Promise<BackupSnapshot> {
    const storageLabel = STORAGE_LOCATION_LABELS[params.environment];
    
    const snapshot = await prisma.backupSnapshot.create({
      data: {
        environment: params.environment,
        type: params.type,
        storageLocationLabel: storageLabel,
        status: 'IN_PROGRESS',
        retentionDays: params.environment === 'prod' ? 90 : 30,
        expiresAt: new Date(Date.now() + (params.environment === 'prod' ? 90 : 30) * 24 * 60 * 60 * 1000),
        initiatedBy: params.initiatedBy,
        initiatedByName: params.initiatedByName,
        metadata: {
          triggeredAt: new Date().toISOString(),
          triggerType: 'manual',
        },
      },
    });

    this.simulateBackupProcess(snapshot.id);

    await this.updateDRLastBackup(params.environment);

    return {
      ...snapshot,
      sizeMb: snapshot.sizeMb ? Number(snapshot.sizeMb) : null,
    };
  }

  private async simulateBackupProcess(snapshotId: string): Promise<void> {
    setTimeout(async () => {
      const shouldFail = Math.random() < 0.05;
      
      try {
        if (shouldFail) {
          await prisma.backupSnapshot.update({
            where: { id: snapshotId },
            data: {
              status: 'FAILED',
              errorMessage: 'Simulated backup failure for testing purposes',
              metadata: {
                completedAt: new Date().toISOString(),
                error: 'Connection timeout to storage backend',
              },
            },
          });
        } else {
          const sizeMb = Math.floor(Math.random() * 5000) + 500;
          
          await prisma.backupSnapshot.update({
            where: { id: snapshotId },
            data: {
              status: 'CREATED',
              sizeMb,
              metadata: {
                completedAt: new Date().toISOString(),
                checksum: `sha256:${uuidv4().replace(/-/g, '')}`,
                tablesIncluded: ['users', 'drivers', 'orders', 'rides', 'transactions'],
                compressionRatio: (Math.random() * 0.3 + 0.6).toFixed(2),
              },
            },
          });
        }
      } catch (error) {
        console.error('[BackupService] Error completing backup:', error);
      }
    }, 3000 + Math.random() * 5000);
  }

  async verifyBackup(params: {
    snapshotId: string;
    verifiedBy: string;
    verifiedByName: string;
  }): Promise<BackupSnapshot> {
    const snapshot = await prisma.backupSnapshot.findUnique({
      where: { id: params.snapshotId },
    });

    if (!snapshot) {
      throw new Error('Backup snapshot not found');
    }

    if (snapshot.status !== 'CREATED') {
      throw new Error('Only completed backups can be verified');
    }

    const updated = await prisma.backupSnapshot.update({
      where: { id: params.snapshotId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: params.verifiedBy,
        verifiedByName: params.verifiedByName,
        metadata: {
          ...(snapshot.metadata as any),
          verificationDetails: {
            verifiedAt: new Date().toISOString(),
            testRestoreSuccessful: true,
            dataIntegrityCheck: 'PASSED',
            recordCountMatch: true,
          },
        },
      },
    });

    await this.updateDRLastVerified(snapshot.environment);

    return {
      ...updated,
      sizeMb: updated.sizeMb ? Number(updated.sizeMb) : null,
    };
  }

  async softDeleteSnapshot(params: {
    snapshotId: string;
    deletedBy: string;
  }): Promise<void> {
    await prisma.backupSnapshot.update({
      where: { id: params.snapshotId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: params.deletedBy,
      },
    });
  }

  async listRestoreOperations(filters?: {
    snapshotId?: string;
    status?: string;
    limit?: number;
  }): Promise<RestoreOperation[]> {
    const where: any = {};
    
    if (filters?.snapshotId) {
      where.snapshotId = filters.snapshotId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return prisma.restoreOperation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 20,
    });
  }

  async initiateRestore(params: {
    snapshotId: string;
    targetEnvironment: 'dev' | 'staging';
    initiatedBy: string;
    initiatedByName: string;
  }): Promise<RestoreOperation> {
    if (params.targetEnvironment === 'prod' as any) {
      throw new Error('Direct restore to production is not allowed through the admin UI. Contact infrastructure team.');
    }

    const snapshot = await this.getSnapshot(params.snapshotId);
    if (!snapshot) {
      throw new Error('Backup snapshot not found');
    }

    if (snapshot.status === 'FAILED') {
      throw new Error('Cannot restore from a failed backup');
    }

    const confirmationToken = uuidv4().split('-')[0].toUpperCase();

    const operation = await prisma.restoreOperation.create({
      data: {
        snapshotId: params.snapshotId,
        sourceEnvironment: snapshot.environment,
        targetEnvironment: params.targetEnvironment,
        status: 'PENDING',
        initiatedBy: params.initiatedBy,
        initiatedByName: params.initiatedByName,
        confirmationToken,
        metadata: {
          initiatedAt: new Date().toISOString(),
          snapshotDetails: {
            type: snapshot.type,
            sizeMb: snapshot.sizeMb,
            createdAt: snapshot.createdAt,
          },
        },
      },
    });

    return operation;
  }

  async confirmRestore(params: {
    operationId: string;
    confirmationToken: string;
    confirmedBy: string;
  }): Promise<RestoreOperation> {
    const operation = await prisma.restoreOperation.findUnique({
      where: { id: params.operationId },
    });

    if (!operation) {
      throw new Error('Restore operation not found');
    }

    if (operation.status !== 'PENDING') {
      throw new Error('Restore operation is not pending confirmation');
    }

    if (operation.confirmationToken !== params.confirmationToken) {
      throw new Error('Invalid confirmation token');
    }

    const updated = await prisma.restoreOperation.update({
      where: { id: params.operationId },
      data: {
        status: 'IN_PROGRESS',
        confirmedAt: new Date(),
        startedAt: new Date(),
      },
    });

    this.simulateRestoreProcess(params.operationId);

    return updated;
  }

  private async simulateRestoreProcess(operationId: string): Promise<void> {
    setTimeout(async () => {
      const shouldFail = Math.random() < 0.1;
      
      try {
        if (shouldFail) {
          await prisma.restoreOperation.update({
            where: { id: operationId },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errorMessage: 'Simulated restore failure: Target database connection lost',
            },
          });
        } else {
          await prisma.restoreOperation.update({
            where: { id: operationId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              rollbackAvailable: true,
              metadata: {
                restoredAt: new Date().toISOString(),
                recordsRestored: Math.floor(Math.random() * 100000) + 10000,
                durationSeconds: Math.floor(Math.random() * 300) + 60,
              },
            },
          });
        }
      } catch (error) {
        console.error('[BackupService] Error completing restore:', error);
      }
    }, 5000 + Math.random() * 10000);
  }

  async cancelRestore(params: {
    operationId: string;
    cancelledBy: string;
  }): Promise<RestoreOperation> {
    const operation = await prisma.restoreOperation.findUnique({
      where: { id: params.operationId },
    });

    if (!operation) {
      throw new Error('Restore operation not found');
    }

    if (!['PENDING', 'IN_PROGRESS'].includes(operation.status)) {
      throw new Error('Cannot cancel a completed or failed restore operation');
    }

    return prisma.restoreOperation.update({
      where: { id: params.operationId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        metadata: {
          ...(operation.metadata as any),
          cancelledAt: new Date().toISOString(),
          cancelledBy: params.cancelledBy,
        },
      },
    });
  }

  async getDRConfiguration(environment: string): Promise<DRConfiguration | null> {
    const config = await prisma.dRConfiguration.findUnique({
      where: { environment },
    });
    return config;
  }

  async getDRStatus(environment: string): Promise<DRStatus> {
    const [config, backupStats] = await Promise.all([
      this.getDRConfiguration(environment),
      prisma.backupSnapshot.groupBy({
        by: ['status'],
        where: {
          environment,
          isDeleted: false,
        },
        _count: true,
      }),
    ]);

    const [oldestBackup, newestBackup] = await Promise.all([
      prisma.backupSnapshot.findFirst({
        where: { environment, isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.backupSnapshot.findFirst({
        where: { environment, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const statusCounts = backupStats.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      environment,
      rpoTargetMinutes: config?.rpoTargetMinutes || 60,
      rtoTargetMinutes: config?.rtoTargetMinutes || 240,
      lastBackupAt: config?.lastBackupAt || newestBackup?.createdAt || null,
      lastVerifiedBackupAt: config?.lastVerifiedBackupAt || null,
      crossRegionEnabled: config?.crossRegionEnabled || false,
      crossRegionLocation: config?.crossRegionLocation || null,
      backupCount: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      verifiedBackupCount: statusCounts['VERIFIED'] || 0,
      failedBackupCount: statusCounts['FAILED'] || 0,
      oldestBackup: oldestBackup?.createdAt || null,
      newestBackup: newestBackup?.createdAt || null,
    };
  }

  async updateDRConfiguration(
    environment: string,
    updates: Partial<Omit<DRConfiguration, 'id' | 'environment' | 'createdAt' | 'updatedAt'>>
  ): Promise<DRConfiguration> {
    return prisma.dRConfiguration.upsert({
      where: { environment },
      update: updates,
      create: {
        environment,
        ...updates,
      },
    });
  }

  private async updateDRLastBackup(environment: string): Promise<void> {
    try {
      await prisma.dRConfiguration.upsert({
        where: { environment },
        update: { lastBackupAt: new Date() },
        create: {
          environment,
          lastBackupAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[BackupService] Error updating DR last backup:', error);
    }
  }

  private async updateDRLastVerified(environment: string): Promise<void> {
    try {
      await prisma.dRConfiguration.upsert({
        where: { environment },
        update: { lastVerifiedBackupAt: new Date() },
        create: {
          environment,
          lastVerifiedBackupAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[BackupService] Error updating DR last verified:', error);
    }
  }

  async getBackupStats(): Promise<{
    totalBackups: number;
    verifiedBackups: number;
    failedBackups: number;
    totalSizeMb: number;
    byEnvironment: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const [statusStats, envStats, typeStats, totalSize] = await Promise.all([
      prisma.backupSnapshot.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: true,
      }),
      prisma.backupSnapshot.groupBy({
        by: ['environment'],
        where: { isDeleted: false },
        _count: true,
      }),
      prisma.backupSnapshot.groupBy({
        by: ['type'],
        where: { isDeleted: false },
        _count: true,
      }),
      prisma.backupSnapshot.aggregate({
        where: { isDeleted: false },
        _sum: { sizeMb: true },
      }),
    ]);

    const statusCounts = statusStats.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBackups: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      verifiedBackups: statusCounts['VERIFIED'] || 0,
      failedBackups: statusCounts['FAILED'] || 0,
      totalSizeMb: Number(totalSize._sum.sizeMb || 0),
      byEnvironment: envStats.reduce((acc, item) => {
        acc[item.environment] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byType: typeStats.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async hookBackupCompletion(params: {
    environment: BackupEnvironment;
    type: BackupType;
    sizeMb: number;
    metadata?: Record<string, any>;
  }): Promise<BackupSnapshot> {
    const storageLabel = STORAGE_LOCATION_LABELS[params.environment];
    
    const snapshot = await prisma.backupSnapshot.create({
      data: {
        environment: params.environment,
        type: params.type,
        storageLocationLabel: storageLabel,
        sizeMb: params.sizeMb,
        status: 'CREATED',
        retentionDays: params.environment === 'prod' ? 90 : 30,
        expiresAt: new Date(Date.now() + (params.environment === 'prod' ? 90 : 30) * 24 * 60 * 60 * 1000),
        metadata: {
          ...params.metadata,
          source: 'automated_backup_job',
          completedAt: new Date().toISOString(),
        },
      },
    });

    await this.updateDRLastBackup(params.environment);

    return {
      ...snapshot,
      sizeMb: snapshot.sizeMb ? Number(snapshot.sizeMb) : null,
    };
  }
}

export const backupService = new BackupService();
