import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { accessReviewService } from '../services/accessReviewService';
import { Permission, canPerform, AdminUser } from '../utils/permissions';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

const checkAccessReviewPermission = (permission: Permission) => {
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
      console.error('[AccessReview] Access check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

const createCycleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  period: z.string().min(1).max(100),
  countryScope: z.string().optional(),
  roleScope: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  requiresTwoPersonRule: z.boolean().optional(),
  notifyOnComplete: z.boolean().optional(),
});

router.post('/cycles', checkAccessReviewPermission(Permission.CREATE_ACCESS_REVIEW), async (req: Request, res: Response) => {
  try {
    const parsed = createCycleSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;

    const cycle = await accessReviewService.createCycle({
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      createdByAdminId: user.id,
      createdByAdminName: user.email || user.name || 'Unknown Admin',
    });

    res.status(201).json({
      message: 'Access review cycle created successfully',
      cycle,
    });
  } catch (error: any) {
    console.error('[AccessReview] Create cycle error:', error);
    res.status(500).json({ error: error.message || 'Failed to create access review cycle' });
  }
});

const listCyclesSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  countryScope: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

router.get('/cycles', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const parsed = listCyclesSchema.safeParse(req.query);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }

    const result = await accessReviewService.listCycles(parsed.data as any);
    res.json(result);
  } catch (error) {
    console.error('[AccessReview] List cycles error:', error);
    res.status(500).json({ error: 'Failed to list access review cycles' });
  }
});

router.get('/cycles/:id', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const cycle = await accessReviewService.getCycle(req.params.id);
    
    if (!cycle) {
      return res.status(404).json({ error: 'Access review cycle not found' });
    }

    res.json(cycle);
  } catch (error) {
    console.error('[AccessReview] Get cycle error:', error);
    res.status(500).json({ error: 'Failed to get access review cycle' });
  }
});

const updateCycleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  period: z.string().min(1).max(100).optional(),
  countryScope: z.string().optional(),
  roleScope: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  requiresTwoPersonRule: z.boolean().optional(),
  notifyOnComplete: z.boolean().optional(),
});

router.patch('/cycles/:id', checkAccessReviewPermission(Permission.MANAGE_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const parsed = updateCycleSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const cycle = await accessReviewService.updateCycle(req.params.id, {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    });

    res.json({
      message: 'Access review cycle updated successfully',
      cycle,
    });
  } catch (error: any) {
    console.error('[AccessReview] Update cycle error:', error);
    res.status(500).json({ error: error.message || 'Failed to update access review cycle' });
  }
});

router.post('/cycles/:id/start', checkAccessReviewPermission(Permission.MANAGE_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const cycle = await accessReviewService.startCycle(req.params.id);
    res.json({
      message: 'Access review cycle started',
      cycle,
    });
  } catch (error: any) {
    console.error('[AccessReview] Start cycle error:', error);
    res.status(400).json({ error: error.message || 'Failed to start access review cycle' });
  }
});

router.post('/cycles/:id/complete', checkAccessReviewPermission(Permission.ENFORCE_ACCESS_DECISIONS), async (req: Request, res: Response) => {
  try {
    const cycle = await accessReviewService.completeCycle(req.params.id);
    res.json({
      message: 'Access review cycle completed and decisions enforced',
      cycle,
    });
  } catch (error: any) {
    console.error('[AccessReview] Complete cycle error:', error);
    res.status(400).json({ error: error.message || 'Failed to complete access review cycle' });
  }
});

router.post('/cycles/:id/cancel', checkAccessReviewPermission(Permission.MANAGE_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const cycle = await accessReviewService.cancelCycle(req.params.id);
    res.json({
      message: 'Access review cycle cancelled',
      cycle,
    });
  } catch (error: any) {
    console.error('[AccessReview] Cancel cycle error:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel access review cycle' });
  }
});

const listItemsSchema = z.object({
  decision: z.enum(['PENDING', 'KEEP', 'REVOKE', 'CHANGE_ROLE']).optional(),
  team: z.string().optional(),
  country: z.string().optional(),
  isEnforced: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
});

router.get('/cycles/:id/items', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const parsed = listItemsSchema.safeParse(req.query);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }

    const result = await accessReviewService.listItems({
      reviewCycleId: req.params.id,
      ...parsed.data,
    } as any);

    res.json(result);
  } catch (error) {
    console.error('[AccessReview] List items error:', error);
    res.status(500).json({ error: 'Failed to list review items' });
  }
});

router.get('/items/:id', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const item = await accessReviewService.getItem(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Review item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('[AccessReview] Get item error:', error);
    res.status(500).json({ error: 'Failed to get review item' });
  }
});

const decisionSchema = z.object({
  decision: z.enum(['KEEP', 'REVOKE', 'CHANGE_ROLE']),
  justificationText: z.string().optional(),
  newRole: z.string().optional(),
});

router.post('/items/:id/decision', checkAccessReviewPermission(Permission.REVIEW_ACCESS_ITEMS), async (req: Request, res: Response) => {
  try {
    const parsed = decisionSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;

    const item = await accessReviewService.makeDecision({
      itemId: req.params.id,
      decision: parsed.data.decision,
      justificationText: parsed.data.justificationText,
      newRole: parsed.data.newRole,
      decidedByAdminId: user.id,
      decidedByAdminName: user.email || user.name || 'Unknown Admin',
    });

    res.json({
      message: 'Decision recorded successfully',
      item,
    });
  } catch (error: any) {
    console.error('[AccessReview] Make decision error:', error);
    res.status(400).json({ error: error.message || 'Failed to record decision' });
  }
});

const secondApprovalSchema = z.object({
  decision: z.enum(['KEEP', 'REVOKE', 'CHANGE_ROLE']),
});

router.post('/items/:id/second-approval', checkAccessReviewPermission(Permission.APPROVE_ACCESS_DECISIONS), async (req: Request, res: Response) => {
  try {
    const parsed = secondApprovalSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const user = (req as any).user;

    const item = await accessReviewService.provideSecondApproval({
      itemId: req.params.id,
      decision: parsed.data.decision,
      approvedByAdminId: user.id,
      approvedByAdminName: user.email || user.name || 'Unknown Admin',
    });

    res.json({
      message: 'Second approval recorded successfully',
      item,
    });
  } catch (error: any) {
    console.error('[AccessReview] Second approval error:', error);
    res.status(400).json({ error: error.message || 'Failed to record second approval' });
  }
});

router.get('/stats', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const stats = await accessReviewService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[AccessReview] Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/cycles/:id/stats', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const stats = await accessReviewService.getStats(req.params.id);
    res.json(stats);
  } catch (error: any) {
    console.error('[AccessReview] Get cycle stats error:', error);
    res.status(400).json({ error: error.message || 'Failed to get cycle stats' });
  }
});

router.get('/cycles/:id/summary', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const summary = await accessReviewService.getSummary(req.params.id);
    
    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json(summary);
  } catch (error) {
    console.error('[AccessReview] Get summary error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

router.get('/cycles/:id/export', checkAccessReviewPermission(Permission.EXPORT_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const exportData = await accessReviewService.exportCycleData(req.params.id);
    
    res.setHeader('Content-Type', exportData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.send(exportData.content);
  } catch (error: any) {
    console.error('[AccessReview] Export error:', error);
    res.status(400).json({ error: error.message || 'Failed to export cycle data' });
  }
});

router.get('/filters/teams', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const teams = await accessReviewService.getTeams();
    res.json({ teams });
  } catch (error) {
    console.error('[AccessReview] Get teams error:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

router.get('/filters/countries', checkAccessReviewPermission(Permission.VIEW_ACCESS_REVIEWS), async (req: Request, res: Response) => {
  try {
    const countries = await accessReviewService.getCountries();
    res.json({ countries });
  } catch (error) {
    console.error('[AccessReview] Get countries error:', error);
    res.status(500).json({ error: 'Failed to get countries' });
  }
});

export default router;
