import { Router } from 'express';
import { AuthenticatedRequest, authenticateToken, requireAdmin } from '../middleware/authz';
import { safePilotService } from '../services/safePilotService';
import { prisma } from '../db';
import { z } from 'zod';
import {
  growthEngine,
  costReductionEngine,
  fraudShield,
  partnerSuccessCoach,
  customerRetentionAI,
  marketingAI,
  financialIntelligence,
  complianceGuard,
} from '../services/safepilot';

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

// ============================================================================
// GROWTH ENGINE ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/growth/summary
 * Get growth engine summary
 */
router.get(
  '/growth/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await growthEngine.getGrowthSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Growth summary error:', error);
      res.status(500).json({ error: 'Failed to get growth summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/growth/demand-zones
 * Detect demand zones by area
 */
router.get(
  '/growth/demand-zones',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 7;
      const zones = await growthEngine.detectDemandZones(countryCode, days);
      res.json({ zones });
    } catch (error) {
      console.error('[SafePilot] Demand zones error:', error);
      res.status(500).json({ error: 'Failed to detect demand zones' });
    }
  }
);

/**
 * GET /api/admin/safepilot/growth/supply-gaps
 * Detect supply gaps (driver/restaurant shortages)
 */
router.get(
  '/growth/supply-gaps',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const gaps = await growthEngine.detectSupplyGaps(countryCode);
      res.json({ gaps });
    } catch (error) {
      console.error('[SafePilot] Supply gaps error:', error);
      res.status(500).json({ error: 'Failed to detect supply gaps' });
    }
  }
);

/**
 * GET /api/admin/safepilot/growth/onboarding-recommendations
 * Get partner onboarding recommendations
 */
router.get(
  '/growth/onboarding-recommendations',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const recommendations = await growthEngine.recommendOnboardingAreas(countryCode);
      res.json({ recommendations });
    } catch (error) {
      console.error('[SafePilot] Onboarding recommendations error:', error);
      res.status(500).json({ error: 'Failed to get onboarding recommendations' });
    }
  }
);

/**
 * GET /api/admin/safepilot/growth/forecast
 * Get growth forecast
 */
router.get(
  '/growth/forecast',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const period = (req.query.period as '7_DAYS' | '30_DAYS') || '7_DAYS';
      const forecast = await growthEngine.forecastGrowth(period, countryCode);
      res.json(forecast);
    } catch (error) {
      console.error('[SafePilot] Forecast error:', error);
      res.status(500).json({ error: 'Failed to get forecast' });
    }
  }
);

/**
 * GET /api/admin/safepilot/growth/surge-pricing
 * Get surge pricing recommendations
 */
router.get(
  '/growth/surge-pricing',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const recommendations = await growthEngine.recommendSurgePricing(countryCode);
      res.json({ recommendations });
    } catch (error) {
      console.error('[SafePilot] Surge pricing error:', error);
      res.status(500).json({ error: 'Failed to get surge pricing recommendations' });
    }
  }
);

// ============================================================================
// COST REDUCTION ENGINE ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/cost/summary
 * Get cost reduction summary
 */
router.get(
  '/cost/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await costReductionEngine.getCostSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Cost summary error:', error);
      res.status(500).json({ error: 'Failed to get cost summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/cost/refund-abuse
 * Detect refund abuse patterns
 */
router.get(
  '/cost/refund-abuse',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const abusers = await costReductionEngine.detectRefundAbuse(countryCode, days);
      res.json({ abusers });
    } catch (error) {
      console.error('[SafePilot] Refund abuse error:', error);
      res.status(500).json({ error: 'Failed to detect refund abuse' });
    }
  }
);

/**
 * GET /api/admin/safepilot/cost/discount-abuse
 * Detect discount abuse patterns
 */
router.get(
  '/cost/discount-abuse',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const abuses = await costReductionEngine.detectDiscountAbuse(countryCode, days);
      res.json({ abuses });
    } catch (error) {
      console.error('[SafePilot] Discount abuse error:', error);
      res.status(500).json({ error: 'Failed to detect discount abuse' });
    }
  }
);

/**
 * GET /api/admin/safepilot/cost/incentive-overspend
 * Detect incentive overspend
 */
router.get(
  '/cost/incentive-overspend',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const overspends = await costReductionEngine.detectIncentiveOverspend(countryCode);
      res.json({ overspends });
    } catch (error) {
      console.error('[SafePilot] Incentive overspend error:', error);
      res.status(500).json({ error: 'Failed to detect incentive overspend' });
    }
  }
);

/**
 * GET /api/admin/safepilot/cost/payout-leakage
 * Detect payout leakage
 */
router.get(
  '/cost/payout-leakage',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const leakages = await costReductionEngine.detectPayoutLeakage(countryCode, days);
      res.json({ leakages });
    } catch (error) {
      console.error('[SafePilot] Payout leakage error:', error);
      res.status(500).json({ error: 'Failed to detect payout leakage' });
    }
  }
);

/**
 * GET /api/admin/safepilot/cost/loss-predictions
 * Predict potential losses
 */
router.get(
  '/cost/loss-predictions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const predictions = await costReductionEngine.predictLosses(countryCode);
      res.json({ predictions });
    } catch (error) {
      console.error('[SafePilot] Loss predictions error:', error);
      res.status(500).json({ error: 'Failed to predict losses' });
    }
  }
);

/**
 * GET /api/admin/safepilot/cost/saving-actions
 * Get cost saving actions
 */
router.get(
  '/cost/saving-actions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const actions = await costReductionEngine.generateCostSavingActions(countryCode);
      res.json({ actions });
    } catch (error) {
      console.error('[SafePilot] Saving actions error:', error);
      res.status(500).json({ error: 'Failed to get saving actions' });
    }
  }
);

// ============================================================================
// FRAUD SHIELD ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/fraud/summary
 * Get fraud shield summary
 */
router.get(
  '/fraud/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await fraudShield.getFraudSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Fraud summary error:', error);
      res.status(500).json({ error: 'Failed to get fraud summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/alerts
 * Get all fraud alerts
 */
router.get(
  '/fraud/alerts',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const alerts = await fraudShield.generateFraudAlerts(countryCode);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Fraud alerts error:', error);
      res.status(500).json({ error: 'Failed to get fraud alerts' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/ghost-trips
 * Detect ghost trips
 */
router.get(
  '/fraud/ghost-trips',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 7;
      const alerts = await fraudShield.detectGhostTrips(countryCode, days);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Ghost trips error:', error);
      res.status(500).json({ error: 'Failed to detect ghost trips' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/ghost-deliveries
 * Detect ghost deliveries
 */
router.get(
  '/fraud/ghost-deliveries',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 7;
      const alerts = await fraudShield.detectGhostDeliveries(countryCode, days);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Ghost deliveries error:', error);
      res.status(500).json({ error: 'Failed to detect ghost deliveries' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/coupon-fraud
 * Detect coupon fraud
 */
router.get(
  '/fraud/coupon-fraud',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const alerts = await fraudShield.detectCouponFraud(countryCode, days);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Coupon fraud error:', error);
      res.status(500).json({ error: 'Failed to detect coupon fraud' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/collusion
 * Detect collusion patterns
 */
router.get(
  '/fraud/collusion',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const alerts = await fraudShield.detectCollusion(countryCode, days);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Collusion error:', error);
      res.status(500).json({ error: 'Failed to detect collusion' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/safety-incidents
 * Detect safety incidents
 */
router.get(
  '/fraud/safety-incidents',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const incidents = await fraudShield.detectSafetyIncidents(countryCode, days);
      res.json({ incidents });
    } catch (error) {
      console.error('[SafePilot] Safety incidents error:', error);
      res.status(500).json({ error: 'Failed to detect safety incidents' });
    }
  }
);

/**
 * GET /api/admin/safepilot/fraud/kyc-fraud
 * Detect KYC fraud patterns
 */
router.get(
  '/fraud/kyc-fraud',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const patterns = await fraudShield.detectKYCFraud(countryCode);
      res.json({ patterns });
    } catch (error) {
      console.error('[SafePilot] KYC fraud error:', error);
      res.status(500).json({ error: 'Failed to detect KYC fraud' });
    }
  }
);

// ============================================================================
// PARTNER SUCCESS COACH ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/partner/summary
 * Get partner success summary
 */
router.get(
  '/partner/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await partnerSuccessCoach.getPartnerSuccessSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Partner summary error:', error);
      res.status(500).json({ error: 'Failed to get partner summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/partner/low-performers
 * Get low-performing partners
 */
router.get(
  '/partner/low-performers',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const performers = await partnerSuccessCoach.detectLowPerformers(countryCode);
      res.json({ performers });
    } catch (error) {
      console.error('[SafePilot] Low performers error:', error);
      res.status(500).json({ error: 'Failed to detect low performers' });
    }
  }
);

/**
 * GET /api/admin/safepilot/partner/training-plan/:driverId
 * Generate driver training plan
 */
router.get(
  '/partner/training-plan/:driverId',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { driverId } = req.params;
      const plan = await partnerSuccessCoach.generateDriverTrainingPlan(driverId);
      if (!plan) {
        res.status(404).json({ error: 'Driver not found' });
        return;
      }
      res.json(plan);
    } catch (error) {
      console.error('[SafePilot] Training plan error:', error);
      res.status(500).json({ error: 'Failed to generate training plan' });
    }
  }
);

/**
 * GET /api/admin/safepilot/partner/improvement-plan/:restaurantId
 * Generate restaurant improvement plan
 */
router.get(
  '/partner/improvement-plan/:restaurantId',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { restaurantId } = req.params;
      const plan = await partnerSuccessCoach.generateRestaurantImprovementPlan(restaurantId);
      if (!plan) {
        res.status(404).json({ error: 'Restaurant not found' });
        return;
      }
      res.json(plan);
    } catch (error) {
      console.error('[SafePilot] Improvement plan error:', error);
      res.status(500).json({ error: 'Failed to generate improvement plan' });
    }
  }
);

/**
 * GET /api/admin/safepilot/partner/actions
 * Get personalized partner actions
 */
router.get(
  '/partner/actions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const actions = await partnerSuccessCoach.generatePersonalizedActions(countryCode);
      res.json({ actions });
    } catch (error) {
      console.error('[SafePilot] Partner actions error:', error);
      res.status(500).json({ error: 'Failed to get partner actions' });
    }
  }
);

// ============================================================================
// CUSTOMER RETENTION AI ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/retention/summary
 * Get customer retention summary
 */
router.get(
  '/retention/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await customerRetentionAI.getRetentionSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Retention summary error:', error);
      res.status(500).json({ error: 'Failed to get retention summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/retention/unhappy-customers
 * Detect unhappy customers
 */
router.get(
  '/retention/unhappy-customers',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const customers = await customerRetentionAI.detectUnhappyCustomers(countryCode, days);
      res.json({ customers });
    } catch (error) {
      console.error('[SafePilot] Unhappy customers error:', error);
      res.status(500).json({ error: 'Failed to detect unhappy customers' });
    }
  }
);

/**
 * GET /api/admin/safepilot/retention/apology-messages
 * Generate apology messages
 */
router.get(
  '/retention/apology-messages',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const messages = await customerRetentionAI.generateApologyMessages(countryCode);
      res.json({ messages });
    } catch (error) {
      console.error('[SafePilot] Apology messages error:', error);
      res.status(500).json({ error: 'Failed to generate apology messages' });
    }
  }
);

/**
 * GET /api/admin/safepilot/retention/win-back
 * Get win-back strategies
 */
router.get(
  '/retention/win-back',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const strategies = await customerRetentionAI.generateWinBackStrategies(countryCode);
      res.json({ strategies });
    } catch (error) {
      console.error('[SafePilot] Win-back error:', error);
      res.status(500).json({ error: 'Failed to generate win-back strategies' });
    }
  }
);

/**
 * GET /api/admin/safepilot/retention/churn-predictions
 * Predict customer churn
 */
router.get(
  '/retention/churn-predictions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const predictions = await customerRetentionAI.predictChurn(countryCode);
      res.json({ predictions });
    } catch (error) {
      console.error('[SafePilot] Churn predictions error:', error);
      res.status(500).json({ error: 'Failed to predict churn' });
    }
  }
);

// ============================================================================
// MARKETING AI ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/marketing/summary
 * Get marketing AI summary
 */
router.get(
  '/marketing/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await marketingAI.getMarketingSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Marketing summary error:', error);
      res.status(500).json({ error: 'Failed to get marketing summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/marketing/social-captions
 * Generate social media captions
 */
router.get(
  '/marketing/social-captions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const captions = await marketingAI.generateSocialCaptions(countryCode);
      res.json({ captions });
    } catch (error) {
      console.error('[SafePilot] Social captions error:', error);
      res.status(500).json({ error: 'Failed to generate social captions' });
    }
  }
);

/**
 * GET /api/admin/safepilot/marketing/notification-templates
 * Generate notification templates
 */
router.get(
  '/marketing/notification-templates',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const templates = await marketingAI.generateNotificationTemplates(countryCode);
      res.json({ templates });
    } catch (error) {
      console.error('[SafePilot] Notification templates error:', error);
      res.status(500).json({ error: 'Failed to generate notification templates' });
    }
  }
);

/**
 * GET /api/admin/safepilot/marketing/local-ideas
 * Generate local marketing ideas
 */
router.get(
  '/marketing/local-ideas',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const ideas = await marketingAI.generateLocalMarketingIdeas(countryCode);
      res.json({ ideas });
    } catch (error) {
      console.error('[SafePilot] Local ideas error:', error);
      res.status(500).json({ error: 'Failed to generate local ideas' });
    }
  }
);

/**
 * GET /api/admin/safepilot/marketing/seasonal-campaigns
 * Generate seasonal campaign suggestions
 */
router.get(
  '/marketing/seasonal-campaigns',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const campaigns = await marketingAI.generateSeasonalCampaigns(countryCode);
      res.json({ campaigns });
    } catch (error) {
      console.error('[SafePilot] Seasonal campaigns error:', error);
      res.status(500).json({ error: 'Failed to generate seasonal campaigns' });
    }
  }
);

// ============================================================================
// FINANCIAL INTELLIGENCE ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/financial/summary
 * Get financial intelligence summary
 */
router.get(
  '/financial/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await financialIntelligence.getFinancialSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Financial summary error:', error);
      res.status(500).json({ error: 'Failed to get financial summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/financial/earnings-prediction
 * Predict earnings
 */
router.get(
  '/financial/earnings-prediction',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const period = (req.query.period as 'WEEKLY' | 'MONTHLY') || 'WEEKLY';
      const prediction = await financialIntelligence.predictEarnings(period, countryCode);
      res.json(prediction);
    } catch (error) {
      console.error('[SafePilot] Earnings prediction error:', error);
      res.status(500).json({ error: 'Failed to predict earnings' });
    }
  }
);

/**
 * GET /api/admin/safepilot/financial/negative-balance-risks
 * Detect negative balance risks
 */
router.get(
  '/financial/negative-balance-risks',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const risks = await financialIntelligence.detectNegativeBalanceRisks(countryCode);
      res.json({ risks });
    } catch (error) {
      console.error('[SafePilot] Negative balance risks error:', error);
      res.status(500).json({ error: 'Failed to detect negative balance risks' });
    }
  }
);

/**
 * GET /api/admin/safepilot/financial/settlement-risks
 * Detect settlement risks
 */
router.get(
  '/financial/settlement-risks',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const risks = await financialIntelligence.detectSettlementRisks(countryCode);
      res.json({ risks });
    } catch (error) {
      console.error('[SafePilot] Settlement risks error:', error);
      res.status(500).json({ error: 'Failed to detect settlement risks' });
    }
  }
);

/**
 * GET /api/admin/safepilot/financial/payout-optimizations
 * Get payout optimization suggestions
 */
router.get(
  '/financial/payout-optimizations',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const optimizations = await financialIntelligence.suggestPayoutOptimizations(countryCode);
      res.json({ optimizations });
    } catch (error) {
      console.error('[SafePilot] Payout optimizations error:', error);
      res.status(500).json({ error: 'Failed to get payout optimizations' });
    }
  }
);

/**
 * GET /api/admin/safepilot/financial/revenue-insights
 * Get revenue insights by category
 */
router.get(
  '/financial/revenue-insights',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const insights = await financialIntelligence.getRevenueInsights(countryCode);
      res.json({ insights });
    } catch (error) {
      console.error('[SafePilot] Revenue insights error:', error);
      res.status(500).json({ error: 'Failed to get revenue insights' });
    }
  }
);

// ============================================================================
// COMPLIANCE GUARD ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/compliance/summary
 * Get compliance summary
 */
router.get(
  '/compliance/summary',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const summary = await complianceGuard.getComplianceSummary(countryCode);
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Compliance summary error:', error);
      res.status(500).json({ error: 'Failed to get compliance summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/compliance/bd-violations
 * Detect Bangladesh compliance violations
 */
router.get(
  '/compliance/bd-violations',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const violations = await complianceGuard.detectBDViolations();
      res.json({ violations });
    } catch (error) {
      console.error('[SafePilot] BD violations error:', error);
      res.status(500).json({ error: 'Failed to detect BD violations' });
    }
  }
);

/**
 * GET /api/admin/safepilot/compliance/us-violations
 * Detect US compliance violations
 */
router.get(
  '/compliance/us-violations',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const violations = await complianceGuard.detectUSViolations();
      res.json({ violations });
    } catch (error) {
      console.error('[SafePilot] US violations error:', error);
      res.status(500).json({ error: 'Failed to detect US violations' });
    }
  }
);

/**
 * GET /api/admin/safepilot/compliance/investigation/:entityType/:entityId
 * Generate investigation summary
 */
router.get(
  '/compliance/investigation/:entityType/:entityId',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityType, entityId } = req.params;
      const summary = await complianceGuard.generateInvestigationSummary(entityType, entityId);
      if (!summary) {
        res.status(404).json({ error: 'Entity not found' });
        return;
      }
      res.json(summary);
    } catch (error) {
      console.error('[SafePilot] Investigation error:', error);
      res.status(500).json({ error: 'Failed to generate investigation summary' });
    }
  }
);

/**
 * GET /api/admin/safepilot/compliance/actions
 * Get compliance actions
 */
router.get(
  '/compliance/actions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const actions = await complianceGuard.generateComplianceActions(countryCode);
      res.json({ actions });
    } catch (error) {
      console.error('[SafePilot] Compliance actions error:', error);
      res.status(500).json({ error: 'Failed to get compliance actions' });
    }
  }
);

// ============================================================================
// COMBINED DASHBOARD ROUTE
// ============================================================================

/**
 * GET /api/admin/safepilot/dashboard
 * Get combined SafePilot intelligence dashboard
 */
router.get(
  '/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;

      const [
        growthSummary,
        costSummary,
        fraudSummary,
        partnerSummary,
        retentionSummary,
        marketingSummary,
        financialSummary,
        complianceSummary,
      ] = await Promise.all([
        growthEngine.getGrowthSummary(countryCode),
        costReductionEngine.getCostSummary(countryCode),
        fraudShield.getFraudSummary(countryCode),
        partnerSuccessCoach.getPartnerSuccessSummary(countryCode),
        customerRetentionAI.getRetentionSummary(countryCode),
        marketingAI.getMarketingSummary(countryCode),
        financialIntelligence.getFinancialSummary(countryCode),
        complianceGuard.getComplianceSummary(countryCode),
      ]);

      res.json({
        growth: growthSummary,
        cost: costSummary,
        fraud: fraudSummary,
        partner: partnerSummary,
        retention: retentionSummary,
        marketing: marketingSummary,
        financial: financialSummary,
        compliance: complianceSummary,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SafePilot] Dashboard error:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }
);

export default router;
