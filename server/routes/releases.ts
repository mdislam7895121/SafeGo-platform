import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { releaseService } from '../services/releaseService';
import { Permission, requirePermission, canPerform } from '../utils/permissions';
import { ReleaseEnvironment, ReleaseDeploymentStatus } from '@prisma/client';

const router = Router();

const createReleaseSchema = z.object({
  versionTag: z.string().min(1).max(50).regex(/^v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9]+)?$/, 'Invalid version format (e.g., v1.0.0 or 1.0.0-beta)'),
  description: z.string().max(500).optional(),
  releaseNotes: z.string().max(5000).optional(),
  includedPhases: z.array(z.string()).optional(),
});

const updateReleaseSchema = z.object({
  description: z.string().max(500).optional(),
  releaseNotes: z.string().max(5000).optional(),
  includedPhases: z.array(z.string()).optional(),
});

const updateStatusSchema = z.object({
  environment: z.enum(['DEV', 'STAGING', 'PROD']),
  deploymentStatus: z.enum(['NOT_DEPLOYED', 'DEPLOYED', 'VERIFIED', 'ROLLED_BACK']),
  comment: z.string().max(500).optional(),
});

const proposePromotionSchema = z.object({
  environment: z.enum(['DEV', 'STAGING', 'PROD']),
  comment: z.string().max(500).optional(),
});

const approvePromotionSchema = z.object({
  environment: z.enum(['DEV', 'STAGING', 'PROD']),
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional(),
  comment: z.string().max(500).optional(),
});

const updateChecklistSchema = z.object({
  environment: z.enum(['DEV', 'STAGING', 'PROD']),
  itemKey: z.string().min(1).max(100),
  isCompleted: z.boolean(),
  notes: z.string().max(1000).optional(),
  evidenceUrl: z.string().url().optional().or(z.literal('')),
});

const listReleasesSchema = z.object({
  environment: z.enum(['DEV', 'STAGING', 'PROD']).optional(),
  deploymentStatus: z.enum(['NOT_DEPLOYED', 'DEPLOYED', 'VERIFIED', 'ROLLED_BACK']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
         req.socket?.remoteAddress || 
         'unknown';
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.VIEW_RELEASES);

    const query = listReleasesSchema.parse(req.query);
    const result = await releaseService.listReleases({
      environment: query.environment as ReleaseEnvironment | undefined,
      deploymentStatus: query.deploymentStatus as ReleaseDeploymentStatus | undefined,
      limit: query.limit,
      offset: query.offset,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error listing releases:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to list releases' 
    });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.VIEW_RELEASES);

    const summary = await releaseService.getEnvironmentSummary();
    res.json(summary);
  } catch (error: any) {
    console.error('Error getting release summary:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to get release summary' 
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.VIEW_RELEASES);

    const release = await releaseService.getRelease(req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    res.json(release);
  } catch (error: any) {
    console.error('Error getting release:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to get release' 
    });
  }
});

router.get('/:id/audit-history', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.VIEW_RELEASE_AUDIT);

    const environment = req.query.environment as ReleaseEnvironment | undefined;
    const history = await releaseService.getAuditHistory(req.params.id, environment);
    
    res.json(history);
  } catch (error: any) {
    console.error('Error getting audit history:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to get audit history' 
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.CREATE_RELEASE);

    const data = createReleaseSchema.parse(req.body);
    
    const release = await releaseService.createRelease({
      ...data,
      createdByAdminId: user.id,
      createdByAdminName: user.name || user.email,
    });

    res.status(201).json(release);
  } catch (error: any) {
    console.error('Error creating release:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A release with this version tag already exists' });
    }
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to create release' 
    });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.MANAGE_RELEASES);

    const data = updateReleaseSchema.parse(req.body);
    
    const release = await releaseService.updateRelease(
      req.params.id,
      data,
      user.id,
      user.name || user.email
    );

    res.json(release);
  } catch (error: any) {
    console.error('Error updating release:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to update release' 
    });
  }
});

router.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.UPDATE_RELEASE_STATUS);

    const data = updateStatusSchema.parse(req.body);
    
    const result = await releaseService.updateEnvironmentStatus({
      releaseId: req.params.id,
      environment: data.environment as ReleaseEnvironment,
      deploymentStatus: data.deploymentStatus as ReleaseDeploymentStatus,
      adminId: user.id,
      adminName: user.name || user.email,
      comment: data.comment,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error updating release status:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to update release status' 
    });
  }
});

router.post('/:id/propose-promotion', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.PROPOSE_PROMOTION);

    const data = proposePromotionSchema.parse(req.body);
    
    const result = await releaseService.proposePromotion({
      releaseId: req.params.id,
      environment: data.environment as ReleaseEnvironment,
      adminId: user.id,
      adminName: user.name || user.email,
      comment: data.comment,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error proposing promotion:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to propose promotion' 
    });
  }
});

router.post('/:id/approve-promotion', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.APPROVE_PROMOTION);

    const data = approvePromotionSchema.parse(req.body);
    
    const result = await releaseService.approvePromotion({
      releaseId: req.params.id,
      environment: data.environment as ReleaseEnvironment,
      adminId: user.id,
      adminName: user.name || user.email,
      approved: data.approved,
      rejectionReason: data.rejectionReason,
      comment: data.comment,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error approving/rejecting promotion:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to process promotion approval' 
    });
  }
});

router.post('/:id/checklist', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.UPDATE_CHECKLIST);

    const data = updateChecklistSchema.parse(req.body);
    
    const result = await releaseService.updateChecklistItem({
      releaseId: req.params.id,
      environment: data.environment as ReleaseEnvironment,
      itemKey: data.itemKey,
      isCompleted: data.isCompleted,
      adminId: user.id,
      adminName: user.name || user.email,
      notes: data.notes,
      evidenceUrl: data.evidenceUrl || undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error updating checklist item:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to update checklist item' 
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    requirePermission(user, Permission.DELETE_RELEASE);

    const result = await releaseService.deleteRelease(
      req.params.id,
      user.id,
      user.name || user.email
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error deleting release:', error);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to delete release' 
    });
  }
});

export default router;
