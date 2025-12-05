import { Router } from 'express';
import { AuthenticatedRequest, authenticateToken, requireAdmin } from '../middleware/authz';
import { safePilotService } from '../services/safePilotService';
import { prisma } from '../db';
import { z } from 'zod';

const router = Router();

const contextQuerySchema = z.object({
  pageKey: z.string(),
  countryCode: z.string().optional(),
  driverId: z.string().optional(),
  customerId: z.string().optional(),
  restaurantId: z.string().optional(),
  rideId: z.string().optional(),
  orderId: z.string().optional(),
  deliveryId: z.string().optional(),
});

const queryRequestSchema = z.object({
  pageKey: z.string(),
  question: z.string().min(1).max(500),
  countryCode: z.string().optional(),
  context: z.record(z.string()).optional(),
});

const suggestActionsSchema = z.object({
  entityType: z.enum(['driver', 'customer', 'restaurant', 'ride', 'order', 'payout', 'delivery']),
  entityId: z.string(),
  countryCode: z.string().optional(),
});

const runActionSchema = z.object({
  actionKey: z.string(),
  actionType: z.enum(['NAVIGATE', 'FILTER', 'OPEN_PANEL', 'RUN_REPORT']),
  payload: z.record(z.any()),
  interactionId: z.string().optional(),
});

/**
 * Check if SafePilot feature is enabled
 */
router.get(
  '/status',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const isEnabled = await safePilotService.isEnabled();
      
      res.json({
        enabled: isEnabled,
        version: '1.0.0',
        adminId: req.user?.id,
        permissions: {
          canUse: req.user?.permissions?.includes('USE_SAFEPILOT'),
          canManageConfig: req.user?.permissions?.includes('MANAGE_SAFEPILOT_CONFIG'),
          canViewAnalytics: req.user?.permissions?.includes('VIEW_SAFEPILOT_ANALYTICS'),
        },
      });
    } catch (error) {
      console.error('[SafePilot] Status check error:', error);
      res.status(500).json({ error: 'Failed to check SafePilot status' });
    }
  }
);

/**
 * GET /api/admin/safepilot/context
 * Get page-aware context and summary
 */
router.get(
  '/context',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = contextQuerySchema.parse(req.query);
      
      const entityContext = {
        driverId: query.driverId,
        customerId: query.customerId,
        restaurantId: query.restaurantId,
        rideId: query.rideId,
        orderId: query.orderId,
      };

      const context = await safePilotService.getContext(
        query.pageKey,
        query.countryCode,
        entityContext
      );

      res.json(context);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
        return;
      }
      console.error('[SafePilot] Context error:', error);
      res.status(500).json({ error: 'Failed to get context' });
    }
  }
);

/**
 * POST /api/admin/safepilot/query
 * Process natural language query from admin
 */
router.post(
  '/query',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = queryRequestSchema.parse(req.body);
      
      if (!req.user?.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const response = await safePilotService.processQuery(
        req.user.id,
        body.pageKey,
        body.question,
        body.countryCode,
        body.context
      );

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request body', details: error.errors });
        return;
      }
      console.error('[SafePilot] Query error:', error);
      res.status(500).json({ error: 'Failed to process query' });
    }
  }
);

/**
 * POST /api/admin/safepilot/suggest-actions
 * Get suggested actions for a specific entity
 */
router.post(
  '/suggest-actions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = suggestActionsSchema.parse(req.body);

      const suggestions = await safePilotService.getSuggestedActions(
        body.entityType,
        body.entityId,
        body.countryCode
      );

      res.json({ suggestions });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request body', details: error.errors });
        return;
      }
      console.error('[SafePilot] Suggest actions error:', error);
      res.status(500).json({ error: 'Failed to get suggestions' });
    }
  }
);

/**
 * POST /api/admin/safepilot/run-action
 * Run a safe, reversible action (navigation, filtering, reports only)
 */
router.post(
  '/run-action',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = runActionSchema.parse(req.body);

      // Record the action selection if interactionId provided
      if (body.interactionId) {
        await safePilotService.recordActionSelection(body.interactionId, body.actionKey);
      }

      // For safe actions, just return the payload for frontend to execute
      // We don't execute anything destructive server-side
      switch (body.actionType) {
        case 'NAVIGATE':
          res.json({
            success: true,
            actionType: 'NAVIGATE',
            route: body.payload.route,
          });
          break;

        case 'FILTER':
          res.json({
            success: true,
            actionType: 'FILTER',
            filter: body.payload.filter,
          });
          break;

        case 'OPEN_PANEL':
          res.json({
            success: true,
            actionType: 'OPEN_PANEL',
            panel: body.payload.panel,
            data: body.payload,
          });
          break;

        case 'RUN_REPORT':
          // For reports, we could generate them here
          res.json({
            success: true,
            actionType: 'RUN_REPORT',
            reportType: body.payload.reportType,
            message: 'Report generation initiated',
          });
          break;

        default:
          res.status(400).json({ error: 'Unknown action type' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request body', details: error.errors });
        return;
      }
      console.error('[SafePilot] Run action error:', error);
      res.status(500).json({ error: 'Failed to run action' });
    }
  }
);

/**
 * GET /api/admin/safepilot/analytics
 * Get SafePilot usage analytics (requires VIEW_SAFEPILOT_ANALYTICS permission)
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin('VIEW_SAFEPILOT_ANALYTICS'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const adminId = req.query.adminId as string | undefined;

      const analytics = await safePilotService.getAnalytics(adminId, days);

      res.json(analytics);
    } catch (error) {
      console.error('[SafePilot] Analytics error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  }
);

/**
 * GET /api/admin/safepilot/history
 * Get interaction history for the current admin
 */
router.get(
  '/history',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const pageKey = req.query.pageKey as string | undefined;

      const interactions = await prisma.safePilotInteraction.findMany({
        where: {
          adminId: req.user?.id,
          ...(pageKey ? { pageKey } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          pageKey: true,
          question: true,
          responseSummary: true,
          riskLevel: true,
          timestamp: true,
          selectedActionKey: true,
        },
      });

      res.json({ interactions });
    } catch (error) {
      console.error('[SafePilot] History error:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  }
);

/**
 * GET /api/admin/safepilot/config
 * Get SafePilot configuration (requires MANAGE_SAFEPILOT_CONFIG permission)
 */
router.get(
  '/config',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const category = req.query.category as string | undefined;
      const countryCode = req.query.countryCode as string | undefined;

      const configs = await prisma.safePilotConfig.findMany({
        where: {
          ...(category ? { category } : {}),
          ...(countryCode ? { countryCode } : {}),
        },
        orderBy: { key: 'asc' },
      });

      res.json({ configs });
    } catch (error) {
      console.error('[SafePilot] Config get error:', error);
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  }
);

/**
 * PUT /api/admin/safepilot/config/:key
 * Update SafePilot configuration
 */
router.put(
  '/config/:key',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { key } = req.params;
      const { valueJson, description, isEnabled, category, subcategory, countryCode } = req.body;

      const config = await prisma.safePilotConfig.upsert({
        where: { key },
        create: {
          key,
          valueJson: valueJson || {},
          description,
          isEnabled: isEnabled !== false,
          category,
          subcategory,
          countryCode,
          updatedByAdminId: req.user?.id,
        },
        update: {
          valueJson: valueJson !== undefined ? valueJson : undefined,
          description: description !== undefined ? description : undefined,
          isEnabled: isEnabled !== undefined ? isEnabled : undefined,
          category: category !== undefined ? category : undefined,
          subcategory: subcategory !== undefined ? subcategory : undefined,
          countryCode: countryCode !== undefined ? countryCode : undefined,
          updatedByAdminId: req.user?.id,
        },
      });

      res.json({ config });
    } catch (error) {
      console.error('[SafePilot] Config update error:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }
);

/**
 * GET /api/admin/safepilot/insights
 * Get active insights
 */
router.get(
  '/insights',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const insights = await prisma.safePilotInsight.findMany({
        where: {
          isActive: true,
          isDismissed: false,
          ...(countryCode ? { countryCode } : {}),
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      });

      res.json({ insights });
    } catch (error) {
      console.error('[SafePilot] Insights error:', error);
      res.status(500).json({ error: 'Failed to get insights' });
    }
  }
);

/**
 * POST /api/admin/safepilot/insights/:id/dismiss
 * Dismiss an insight
 */
router.post(
  '/insights/:id/dismiss',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      const insight = await prisma.safePilotInsight.update({
        where: { id },
        data: {
          isDismissed: true,
          dismissedBy: req.user?.id,
          dismissedAt: new Date(),
        },
      });

      res.json({ insight });
    } catch (error) {
      console.error('[SafePilot] Dismiss insight error:', error);
      res.status(500).json({ error: 'Failed to dismiss insight' });
    }
  }
);

export default router;
