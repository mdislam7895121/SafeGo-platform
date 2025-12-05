import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { backupService, BackupType, BackupEnvironment } from '../services/backupService';
import { Permission, canPerform, AdminUser } from '../utils/permissions';
import { prisma } from '../prisma';

const router = Router();

const checkBackupAccess = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const adminUser: AdminUser = {
        id: user.id,
        email: user.email || '',
        role: user.role,
        adminProfile: user.adminProfile,
      };

      if (!canPerform(adminUser, permission)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have permission to perform this action',
        });
      }

      next();
    } catch (error) {
      console.error('[BackupDR] Access check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

const listSnapshotsSchema = z.object({
  environment: z.enum(['dev', 'staging', 'prod']).optional(),
  type: z.enum(['FULL_DB', 'PARTIAL_ANALYTICS', 'FILES_ONLY', 'CONFIG_ONLY']).optional(),
  status: z.enum(['CREATED', 'VERIFIED', 'FAILED', 'IN_PROGRESS']).optional(),
  includeDeleted: z.boolean().optional().default(false),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

router.get('/snapshots', checkBackupAccess(Permission.VIEW_BACKUPS), async (req: Request, res: Response) => {
  try {
    const parsed = listSnapshotsSchema.safeParse({
      ...req.query,
      includeDeleted: req.query.includeDeleted === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }

    const result = await backupService.listSnapshots(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('[BackupDR] List snapshots error:', error);
    res.status(500).json({ error: 'Failed to list backup snapshots' });
  }
});

router.get('/snapshots/:id', checkBackupAccess(Permission.VIEW_BACKUPS), async (req: Request, res: Response) => {
  try {
    const snapshot = await backupService.getSnapshot(req.params.id);
    
    if (!snapshot) {
      return res.status(404).json({ error: 'Backup snapshot not found' });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('[BackupDR] Get snapshot error:', error);
    res.status(500).json({ error: 'Failed to get backup snapshot' });
  }
});

const triggerBackupSchema = z.object({
  environment: z.enum(['dev', 'staging']),
  type: z.enum(['FULL_DB', 'PARTIAL_ANALYTICS', 'FILES_ONLY', 'CONFIG_ONLY']),
});

router.post('/snapshots/trigger', checkBackupAccess(Permission.TRIGGER_BACKUP), async (req: Request, res: Response) => {
  try {
    const parsed = triggerBackupSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;
    
    const snapshot = await backupService.triggerBackup({
      environment: parsed.data.environment as BackupEnvironment,
      type: parsed.data.type as BackupType,
      initiatedBy: user.id,
      initiatedByName: user.email || user.name || 'Unknown Admin',
    });

    res.status(201).json({
      message: 'Backup initiated successfully',
      snapshot,
    });
  } catch (error) {
    console.error('[BackupDR] Trigger backup error:', error);
    res.status(500).json({ error: 'Failed to trigger backup' });
  }
});

const verifyBackupSchema = z.object({
  snapshotId: z.string().uuid(),
});

router.post('/snapshots/verify', checkBackupAccess(Permission.VERIFY_BACKUP), async (req: Request, res: Response) => {
  try {
    const parsed = verifyBackupSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;
    
    const snapshot = await backupService.verifyBackup({
      snapshotId: parsed.data.snapshotId,
      verifiedBy: user.id,
      verifiedByName: user.email || user.name || 'Unknown Admin',
    });

    res.json({
      message: 'Backup verified successfully',
      snapshot,
    });
  } catch (error: any) {
    console.error('[BackupDR] Verify backup error:', error);
    res.status(400).json({ error: error.message || 'Failed to verify backup' });
  }
});

const deleteSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  confirmEnvironment: z.string(),
});

router.post('/snapshots/delete', checkBackupAccess(Permission.DELETE_BACKUP), async (req: Request, res: Response) => {
  try {
    const parsed = deleteSnapshotSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const snapshot = await backupService.getSnapshot(parsed.data.snapshotId);
    
    if (!snapshot) {
      return res.status(404).json({ error: 'Backup snapshot not found' });
    }

    if (snapshot.environment !== parsed.data.confirmEnvironment) {
      return res.status(400).json({ 
        error: 'Confirmation failed', 
        message: 'Environment name does not match. Please type the correct environment name to confirm deletion.',
      });
    }

    const user = (req as any).user;
    
    await backupService.softDeleteSnapshot({
      snapshotId: parsed.data.snapshotId,
      deletedBy: user.id,
    });

    res.json({ message: 'Backup snapshot deleted successfully' });
  } catch (error) {
    console.error('[BackupDR] Delete snapshot error:', error);
    res.status(500).json({ error: 'Failed to delete backup snapshot' });
  }
});

router.get('/restore-operations', checkBackupAccess(Permission.VIEW_RESTORE_OPERATIONS), async (req: Request, res: Response) => {
  try {
    const operations = await backupService.listRestoreOperations({
      snapshotId: req.query.snapshotId as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });

    res.json(operations);
  } catch (error) {
    console.error('[BackupDR] List restore operations error:', error);
    res.status(500).json({ error: 'Failed to list restore operations' });
  }
});

const initiateRestoreSchema = z.object({
  snapshotId: z.string().uuid(),
  targetEnvironment: z.enum(['dev', 'staging']),
});

router.post('/restore/initiate', checkBackupAccess(Permission.INITIATE_RESTORE), async (req: Request, res: Response) => {
  try {
    const parsed = initiateRestoreSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;
    
    const operation = await backupService.initiateRestore({
      snapshotId: parsed.data.snapshotId,
      targetEnvironment: parsed.data.targetEnvironment,
      initiatedBy: user.id,
      initiatedByName: user.email || user.name || 'Unknown Admin',
    });

    res.status(201).json({
      message: 'Restore operation initiated. Confirmation required.',
      operation,
      confirmationRequired: true,
      confirmationToken: operation.confirmationToken,
    });
  } catch (error: any) {
    console.error('[BackupDR] Initiate restore error:', error);
    res.status(400).json({ error: error.message || 'Failed to initiate restore' });
  }
});

const confirmRestoreSchema = z.object({
  operationId: z.string().uuid(),
  confirmationToken: z.string().min(1),
});

router.post('/restore/confirm', checkBackupAccess(Permission.CONFIRM_RESTORE), async (req: Request, res: Response) => {
  try {
    const parsed = confirmRestoreSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;
    
    const operation = await backupService.confirmRestore({
      operationId: parsed.data.operationId,
      confirmationToken: parsed.data.confirmationToken,
      confirmedBy: user.id,
    });

    res.json({
      message: 'Restore operation confirmed and started',
      operation,
    });
  } catch (error: any) {
    console.error('[BackupDR] Confirm restore error:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm restore' });
  }
});

const cancelRestoreSchema = z.object({
  operationId: z.string().uuid(),
});

router.post('/restore/cancel', checkBackupAccess(Permission.CANCEL_RESTORE), async (req: Request, res: Response) => {
  try {
    const parsed = cancelRestoreSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;
    
    const operation = await backupService.cancelRestore({
      operationId: parsed.data.operationId,
      cancelledBy: user.id,
    });

    res.json({
      message: 'Restore operation cancelled',
      operation,
    });
  } catch (error: any) {
    console.error('[BackupDR] Cancel restore error:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel restore' });
  }
});

router.get('/dr-status', checkBackupAccess(Permission.VIEW_DR_CONFIG), async (req: Request, res: Response) => {
  try {
    const environments = ['dev', 'staging', 'prod'];
    const statuses = await Promise.all(
      environments.map(env => backupService.getDRStatus(env))
    );

    res.json({
      environments: statuses,
      summary: {
        totalBackups: statuses.reduce((sum, s) => sum + s.backupCount, 0),
        totalVerified: statuses.reduce((sum, s) => sum + s.verifiedBackupCount, 0),
        totalFailed: statuses.reduce((sum, s) => sum + s.failedBackupCount, 0),
      },
    });
  } catch (error) {
    console.error('[BackupDR] Get DR status error:', error);
    res.status(500).json({ error: 'Failed to get DR status' });
  }
});

router.get('/dr-config/:environment', checkBackupAccess(Permission.VIEW_DR_CONFIG), async (req: Request, res: Response) => {
  try {
    const config = await backupService.getDRConfiguration(req.params.environment);
    
    if (!config) {
      return res.json({
        environment: req.params.environment,
        rpoTargetMinutes: 60,
        rtoTargetMinutes: 240,
        autoBackupEnabled: true,
        backupFrequency: 'DAILY',
        backupRetentionDays: 30,
        crossRegionEnabled: false,
        crossRegionLocation: null,
        lastBackupAt: null,
        lastVerifiedBackupAt: null,
        alertsEnabled: true,
        alertRecipients: [],
      });
    }

    res.json(config);
  } catch (error) {
    console.error('[BackupDR] Get DR config error:', error);
    res.status(500).json({ error: 'Failed to get DR configuration' });
  }
});

const updateDRConfigSchema = z.object({
  rpoTargetMinutes: z.number().min(5).max(1440).optional(),
  rtoTargetMinutes: z.number().min(15).max(2880).optional(),
  autoBackupEnabled: z.boolean().optional(),
  backupFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY']).optional(),
  backupRetentionDays: z.number().min(7).max(365).optional(),
  crossRegionEnabled: z.boolean().optional(),
  crossRegionLocation: z.string().optional().nullable(),
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.array(z.string().email()).optional(),
});

router.patch('/dr-config/:environment', checkBackupAccess(Permission.MANAGE_DR_CONFIG), async (req: Request, res: Response) => {
  try {
    const parsed = updateDRConfigSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const config = await backupService.updateDRConfiguration(
      req.params.environment,
      parsed.data
    );

    res.json({
      message: 'DR configuration updated successfully',
      config,
    });
  } catch (error) {
    console.error('[BackupDR] Update DR config error:', error);
    res.status(500).json({ error: 'Failed to update DR configuration' });
  }
});

router.get('/stats', checkBackupAccess(Permission.VIEW_BACKUPS), async (req: Request, res: Response) => {
  try {
    const stats = await backupService.getBackupStats();
    res.json(stats);
  } catch (error) {
    console.error('[BackupDR] Get backup stats error:', error);
    res.status(500).json({ error: 'Failed to get backup statistics' });
  }
});

export default router;
