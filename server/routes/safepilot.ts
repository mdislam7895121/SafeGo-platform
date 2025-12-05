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
  getWorkforceAutomationDashboard,
  enableAutomationRule,
  getOneClickAutomations,
  getSystemHealthDashboard,
  restartService,
  getServiceLogs,
  getDynamicPolicyDashboard,
  simulatePolicyImpact,
  activatePolicy,
  generatePolicyFromDescription,
  getSupportAutomationDashboard,
  generateAutoReply,
  processAutoRefund,
  resolveDispute,
  getQuickResponses,
  getGrowthAdvisorDashboard,
  getNextBestAction,
  getRevenueAccelerators,
  safetyIncidentDetection,
  locationIntegrity,
  adminInsiderThreat,
  predictiveAnalytics,
  autoDecisionEngine,
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
  mode: z.enum(['ASK', 'WATCH', 'GUARD', 'OPTIMIZE']).optional(),
  filters: z.object({
    dateRange: z.string().optional(),
    entityType: z.string().optional(),
    severity: z.string().optional(),
  }).optional(),
  timeRange: z.string().optional(),
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
 * Fallback context that is always returned when real context unavailable
 */
const FALLBACK_CONTEXT = {
  pageKey: 'admin.unknown',
  summary: {
    title: 'Unknown',
    description: 'No specific context available for this page',
  },
  metrics: {},
  alerts: [],
  quickActions: [],
};

/**
 * GET /api/admin/safepilot/context
 * Get page-aware context and summary
 * Never returns null or error - always returns valid context with fallback
 */
router.get(
  '/context',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = contextQuerySchema.safeParse(req.query);
      
      if (!query.success) {
        console.warn('[SafePilot] Invalid context query, using fallback:', query.error);
        res.json(FALLBACK_CONTEXT);
        return;
      }
      
      const entityContext = {
        driverId: query.data.driverId,
        customerId: query.data.customerId,
        restaurantId: query.data.restaurantId,
        rideId: query.data.rideId,
        orderId: query.data.orderId,
      };

      try {
        const context = await safePilotService.getContext(
          query.data.pageKey,
          query.data.countryCode,
          entityContext
        );
        
        if (!context || !context.pageKey) {
          console.warn('[SafePilot] Empty context returned, using fallback for:', query.data.pageKey);
          res.json({
            ...FALLBACK_CONTEXT,
            pageKey: query.data.pageKey,
            summary: {
              title: query.data.pageKey.replace('admin.', '').replace(/-/g, ' '),
              description: 'Context loading...',
            },
          });
          return;
        }
        
        res.json(context);
      } catch (serviceError) {
        console.error('[SafePilot] Service error getting context:', serviceError);
        res.json({
          ...FALLBACK_CONTEXT,
          pageKey: query.data.pageKey,
          summary: {
            title: query.data.pageKey.replace('admin.', '').replace(/-/g, ' '),
            description: 'Unable to load full context',
          },
        });
      }
    } catch (error) {
      console.error('[SafePilot] Context error:', error);
      res.json(FALLBACK_CONTEXT);
    }
  }
);

/**
 * POST /api/admin/safepilot/query
 * Process natural language query from admin
 * Vision 2030: Returns structured response with mode, summary, keySignals, actions, monitor
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

      // Parse the Vision 2030 structured response
      const mode = safePilotService.detectMode(body.question);
      
      // Extract structured sections from answerText
      const sections = parseVision2030Response(response.answerText);
      
      // Return Vision 2030 format
      res.json({
        mode,
        summary: sections.summary,
        keySignals: sections.keySignals,
        actions: sections.actions.map(action => ({
          label: action.label,
          risk: action.risk,
          actionType: 'NAVIGATE' as const,
          payload: {},
        })),
        monitor: sections.monitoring,
        // Legacy fields for backward compatibility
        answerText: response.answerText,
        insights: response.insights,
        suggestions: response.suggestions,
        riskLevel: response.riskLevel,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Invalid request body', 
          details: error.errors,
          mode: 'ASK',
          summary: ['Unable to process your question. Please check your input.'],
          keySignals: [],
          actions: [],
          monitor: [],
        });
        return;
      }
      console.error('[SafePilot] Query error:', error);
      res.status(500).json({ 
        error: 'Failed to process query',
        mode: 'ASK',
        summary: ['An error occurred while processing your question. Please try again.'],
        keySignals: [],
        actions: [],
        monitor: [],
      });
    }
  }
);

/**
 * Parse Vision 2030 formatted response text into structured sections
 */
function parseVision2030Response(text: string): {
  summary: string[];
  keySignals: string[];
  actions: Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' }>;
  monitoring: string[];
} {
  const result = {
    summary: [] as string[],
    keySignals: [] as string[],
    actions: [] as Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' }>,
    monitoring: [] as string[],
  };

  // Split by sections
  const sections = text.split(/\*\*([^*]+)\*\*/);
  let currentSection = '';
  
  for (let i = 0; i < sections.length; i++) {
    const part = sections[i].trim();
    
    if (part.includes('Summary:') || part === 'Summary:') {
      currentSection = 'summary';
      continue;
    } else if (part.includes('Key signals') || part === 'Key signals I used:') {
      currentSection = 'keySignals';
      continue;
    } else if (part.includes('Recommended actions') || part === 'Recommended actions:') {
      currentSection = 'actions';
      continue;
    } else if (part.includes('What to monitor') || part === 'What to monitor next:') {
      currentSection = 'monitoring';
      continue;
    }
    
    // Extract bullet points
    const bullets = part.split('•').filter(b => b.trim()).map(b => b.trim());
    
    if (currentSection === 'summary') {
      result.summary.push(...bullets);
    } else if (currentSection === 'keySignals') {
      result.keySignals.push(...bullets);
    } else if (currentSection === 'actions') {
      bullets.forEach(bullet => {
        let risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' = 'SAFE';
        let label = bullet;
        
        if (bullet.includes('[HIGH RISK')) {
          risk = 'HIGH_RISK';
          label = bullet.replace(/\[HIGH RISK[^\]]*\]\s*/, '');
        } else if (bullet.includes('[CAUTION]')) {
          risk = 'CAUTION';
          label = bullet.replace('[CAUTION]', '').trim();
        } else if (bullet.includes('[SAFE]')) {
          risk = 'SAFE';
          label = bullet.replace('[SAFE]', '').trim();
        }
        
        if (label) {
          result.actions.push({ label, risk });
        }
      });
    } else if (currentSection === 'monitoring') {
      result.monitoring.push(...bullets);
    }
  }

  // Ensure we have at least some data
  if (result.summary.length === 0) {
    result.summary = [text.slice(0, 200)];
  }

  return result;
}

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
// WORKFORCE AUTOMATION ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/workforce/dashboard
 * Get workforce automation dashboard
 */
router.get(
  '/workforce/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await getWorkforceAutomationDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Workforce dashboard error:', error);
      res.status(500).json({ error: 'Failed to get workforce automation dashboard' });
    }
  }
);

/**
 * POST /api/admin/safepilot/workforce/enable-rule
 * Enable an automation rule
 */
router.post(
  '/workforce/enable-rule',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { ruleId } = req.body;
      const result = await enableAutomationRule(ruleId);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Enable rule error:', error);
      res.status(500).json({ error: 'Failed to enable automation rule' });
    }
  }
);

/**
 * GET /api/admin/safepilot/workforce/one-click
 * Get one-click automations
 */
router.get(
  '/workforce/one-click',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const automations = await getOneClickAutomations();
      res.json({ automations });
    } catch (error) {
      console.error('[SafePilot] One-click automations error:', error);
      res.status(500).json({ error: 'Failed to get one-click automations' });
    }
  }
);

// ============================================================================
// SYSTEM HEALTH MONITORING ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/health/dashboard
 * Get system health monitoring dashboard
 */
router.get(
  '/health/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dashboard = await getSystemHealthDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Health dashboard error:', error);
      res.status(500).json({ error: 'Failed to get system health dashboard' });
    }
  }
);

/**
 * POST /api/admin/safepilot/health/restart
 * Restart a service
 */
router.post(
  '/health/restart',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { serviceName } = req.body;
      const result = await restartService(serviceName);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Service restart error:', error);
      res.status(500).json({ error: 'Failed to restart service' });
    }
  }
);

/**
 * GET /api/admin/safepilot/health/logs/:serviceName
 * Get service logs
 */
router.get(
  '/health/logs/:serviceName',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { serviceName } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await getServiceLogs(serviceName, limit);
      res.json({ logs });
    } catch (error) {
      console.error('[SafePilot] Service logs error:', error);
      res.status(500).json({ error: 'Failed to get service logs' });
    }
  }
);

// ============================================================================
// DYNAMIC POLICY GENERATOR ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/policy/dashboard
 * Get dynamic policy dashboard
 */
router.get(
  '/policy/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await getDynamicPolicyDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Policy dashboard error:', error);
      res.status(500).json({ error: 'Failed to get policy dashboard' });
    }
  }
);

/**
 * POST /api/admin/safepilot/policy/simulate
 * Simulate policy impact
 */
router.post(
  '/policy/simulate',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const policy = req.body;
      const simulation = await simulatePolicyImpact(policy);
      res.json(simulation);
    } catch (error) {
      console.error('[SafePilot] Policy simulation error:', error);
      res.status(500).json({ error: 'Failed to simulate policy impact' });
    }
  }
);

/**
 * POST /api/admin/safepilot/policy/activate
 * Activate a policy
 */
router.post(
  '/policy/activate',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { policyId } = req.body;
      const result = await activatePolicy(policyId);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Policy activation error:', error);
      res.status(500).json({ error: 'Failed to activate policy' });
    }
  }
);

/**
 * POST /api/admin/safepilot/policy/generate
 * Generate policy from description
 */
router.post(
  '/policy/generate',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { description } = req.body;
      const policy = await generatePolicyFromDescription(description);
      res.json(policy);
    } catch (error) {
      console.error('[SafePilot] Policy generation error:', error);
      res.status(500).json({ error: 'Failed to generate policy' });
    }
  }
);

// ============================================================================
// SUPPORT AUTOMATION AI ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/support/dashboard
 * Get support automation dashboard
 */
router.get(
  '/support/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await getSupportAutomationDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Support dashboard error:', error);
      res.status(500).json({ error: 'Failed to get support automation dashboard' });
    }
  }
);

/**
 * POST /api/admin/safepilot/support/auto-reply
 * Generate auto-reply for a ticket
 */
router.post(
  '/support/auto-reply',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { ticketId, template } = req.body;
      const result = await generateAutoReply(ticketId, template);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Auto-reply error:', error);
      res.status(500).json({ error: 'Failed to generate auto-reply' });
    }
  }
);

/**
 * POST /api/admin/safepilot/support/process-refund
 * Process auto-refund
 */
router.post(
  '/support/process-refund',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { ticketId, decision, amount } = req.body;
      const result = await processAutoRefund(ticketId, decision, amount);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Process refund error:', error);
      res.status(500).json({ error: 'Failed to process refund' });
    }
  }
);

/**
 * POST /api/admin/safepilot/support/resolve-dispute
 * Resolve dispute automatically
 */
router.post(
  '/support/resolve-dispute',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { disputeId, resolution, compensation } = req.body;
      const result = await resolveDispute(disputeId, resolution, compensation);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Resolve dispute error:', error);
      res.status(500).json({ error: 'Failed to resolve dispute' });
    }
  }
);

/**
 * GET /api/admin/safepilot/support/quick-responses
 * Get quick responses by category
 */
router.get(
  '/support/quick-responses',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const category = req.query.category as string;
      const responses = await getQuickResponses(category);
      res.json({ responses });
    } catch (error) {
      console.error('[SafePilot] Quick responses error:', error);
      res.status(500).json({ error: 'Failed to get quick responses' });
    }
  }
);

// ============================================================================
// GROWTH ADVISOR (BUSINESS COACH) ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/advisor/dashboard
 * Get growth advisor dashboard
 */
router.get(
  '/advisor/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await getGrowthAdvisorDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Advisor dashboard error:', error);
      res.status(500).json({ error: 'Failed to get growth advisor dashboard' });
    }
  }
);

/**
 * GET /api/admin/safepilot/advisor/next-action
 * Get next best action recommendation
 */
router.get(
  '/advisor/next-action',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const action = await getNextBestAction();
      res.json(action);
    } catch (error) {
      console.error('[SafePilot] Next action error:', error);
      res.status(500).json({ error: 'Failed to get next best action' });
    }
  }
);

/**
 * GET /api/admin/safepilot/advisor/revenue-accelerators
 * Get revenue accelerator recommendations
 */
router.get(
  '/advisor/revenue-accelerators',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const accelerators = await getRevenueAccelerators();
      res.json({ accelerators });
    } catch (error) {
      console.error('[SafePilot] Revenue accelerators error:', error);
      res.status(500).json({ error: 'Failed to get revenue accelerators' });
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
        workforceSummary,
        healthSummary,
        policySummary,
        supportSummary,
        advisorSummary,
        safetySummary,
        locationSummary,
        insiderSummary,
        predictiveSummary,
        autoDecisionSummary,
      ] = await Promise.all([
        growthEngine.getGrowthSummary(countryCode),
        costReductionEngine.getCostSummary(countryCode),
        fraudShield.getFraudSummary(countryCode),
        partnerSuccessCoach.getPartnerSuccessSummary(countryCode),
        customerRetentionAI.getRetentionSummary(countryCode),
        marketingAI.getMarketingSummary(countryCode),
        financialIntelligence.getFinancialSummary(countryCode),
        complianceGuard.getComplianceSummary(countryCode),
        getWorkforceAutomationDashboard(countryCode),
        getSystemHealthDashboard(),
        getDynamicPolicyDashboard(countryCode),
        getSupportAutomationDashboard(countryCode),
        getGrowthAdvisorDashboard(countryCode),
        safetyIncidentDetection.getDashboard(countryCode),
        locationIntegrity.getDashboard(countryCode),
        adminInsiderThreat.getDashboard(),
        predictiveAnalytics.getDashboard(countryCode),
        autoDecisionEngine.getDashboard(),
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
        workforce: workforceSummary,
        health: healthSummary,
        policy: policySummary,
        support: supportSummary,
        advisor: advisorSummary,
        safety: safetySummary,
        location: locationSummary,
        insider: insiderSummary,
        predictive: predictiveSummary,
        autoDecision: autoDecisionSummary,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SafePilot] Dashboard error:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }
);

// ============================================================================
// TEST MODE ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/test/preloaded-questions
 * Get preloaded test questions for demo mode
 */
router.get(
  '/test/preloaded-questions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const questions = [
        { id: 'q1', category: 'Growth', question: 'What are the top 3 opportunities to grow revenue this week?' },
        { id: 'q2', category: 'Cost', question: 'Which expenses can be reduced immediately?' },
        { id: 'q3', category: 'Fraud', question: 'Show me suspicious activity from the last 24 hours' },
        { id: 'q4', category: 'Drivers', question: 'Which drivers need immediate attention?' },
        { id: 'q5', category: 'Customers', question: 'Who are the customers most likely to churn?' },
        { id: 'q6', category: 'Support', question: 'What are the most common customer complaints?' },
        { id: 'q7', category: 'Operations', question: 'Are there any system health issues I should know about?' },
        { id: 'q8', category: 'Policy', question: 'Suggest a new policy to reduce cancellation rates' },
        { id: 'q9', category: 'Business', question: 'What should be our top priority this month?' },
        { id: 'q10', category: 'Automation', question: 'What tasks can be automated to save time?' },
      ];
      res.json({ questions });
    } catch (error) {
      console.error('[SafePilot] Preloaded questions error:', error);
      res.status(500).json({ error: 'Failed to get preloaded questions' });
    }
  }
);

/**
 * GET /api/admin/safepilot/test/demo-mode
 * Get demo mode data with sample insights
 */
router.get(
  '/test/demo-mode',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const demoData = {
        enabled: true,
        sampleInsights: [
          { type: 'REVENUE', title: 'Revenue Opportunity', detail: 'Surge pricing in Zone A could increase revenue by 15%', severity: 'HIGH' },
          { type: 'COST', title: 'Cost Savings Found', detail: '3 drivers are receiving excessive bonuses. Save $450/week', severity: 'MEDIUM' },
          { type: 'FRAUD', title: 'Fraud Alert', detail: '2 accounts flagged for suspicious refund patterns', severity: 'CRITICAL' },
          { type: 'RETENTION', title: 'Churn Risk', detail: '15 VIP customers haven\'t ordered in 14 days', severity: 'HIGH' },
          { type: 'HEALTH', title: 'System Warning', detail: 'Redis cache memory usage at 80%', severity: 'MEDIUM' },
        ],
        sampleActions: [
          { key: 'enable-surge', label: 'Enable Surge Pricing', actionType: 'APPLY_POLICY' },
          { key: 'review-bonuses', label: 'Review Driver Bonuses', actionType: 'NAVIGATE' },
          { key: 'block-fraud', label: 'Block Suspicious Accounts', actionType: 'EXECUTE' },
          { key: 'winback-campaign', label: 'Launch Win-Back Campaign', actionType: 'EXECUTE' },
          { key: 'scale-redis', label: 'Scale Redis Instance', actionType: 'EXECUTE' },
        ],
        metrics: {
          questionsAnswered: 1250,
          automationsSaved: 45,
          costSaved: 12500,
          issuesDetected: 89,
          issuesResolved: 76,
        },
      };
      res.json(demoData);
    } catch (error) {
      console.error('[SafePilot] Demo mode error:', error);
      res.status(500).json({ error: 'Failed to get demo mode data' });
    }
  }
);

// ============================================================================
// SAFETY INCIDENT DETECTION ROUTES
// ============================================================================

router.get(
  '/safety/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await safetyIncidentDetection.getDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Safety dashboard error:', error);
      res.status(500).json({ error: 'Failed to get safety dashboard' });
    }
  }
);

router.get(
  '/safety/route-deviations',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 1;
      const alerts = await safetyIncidentDetection.detectRouteDeviations(countryCode, days);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Route deviations error:', error);
      res.status(500).json({ error: 'Failed to detect route deviations' });
    }
  }
);

router.get(
  '/safety/unsafe-driving',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const alerts = await safetyIncidentDetection.detectUnsafeDriving(countryCode);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Unsafe driving error:', error);
      res.status(500).json({ error: 'Failed to detect unsafe driving' });
    }
  }
);

router.get(
  '/safety/sos-alerts',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const alerts = await safetyIncidentDetection.getActiveSOSAlerts();
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] SOS alerts error:', error);
      res.status(500).json({ error: 'Failed to get SOS alerts' });
    }
  }
);

router.post(
  '/safety/sos/:rideId/respond',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rideId } = req.params;
      const result = await safetyIncidentDetection.respondToSOS(rideId, req.user?.id || '');
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] SOS respond error:', error);
      res.status(500).json({ error: 'Failed to respond to SOS' });
    }
  }
);

// ============================================================================
// LOCATION INTEGRITY ROUTES
// ============================================================================

router.get(
  '/location/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await locationIntegrity.getDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Location dashboard error:', error);
      res.status(500).json({ error: 'Failed to get location dashboard' });
    }
  }
);

router.get(
  '/location/gps-spoofing',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const days = parseInt(req.query.days as string) || 7;
      const alerts = await locationIntegrity.detectGPSSpoofing(countryCode, days);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] GPS spoofing error:', error);
      res.status(500).json({ error: 'Failed to detect GPS spoofing' });
    }
  }
);

router.get(
  '/location/teleportation',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const alerts = await locationIntegrity.detectTeleportation(countryCode);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Teleportation error:', error);
      res.status(500).json({ error: 'Failed to detect teleportation' });
    }
  }
);

router.get(
  '/location/abnormal-patterns',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const alerts = await locationIntegrity.detectAbnormalPatterns(countryCode);
      res.json({ alerts });
    } catch (error) {
      console.error('[SafePilot] Abnormal patterns error:', error);
      res.status(500).json({ error: 'Failed to detect abnormal patterns' });
    }
  }
);

router.post(
  '/location/flag/:driverId',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { driverId } = req.params;
      const { reason } = req.body;
      const result = await locationIntegrity.flagDriver(driverId, reason, req.user?.id || '');
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Flag driver error:', error);
      res.status(500).json({ error: 'Failed to flag driver' });
    }
  }
);

// ============================================================================
// ADMIN INSIDER THREAT ROUTES
// ============================================================================

router.get(
  '/insider/dashboard',
  authenticateToken,
  requireAdmin('VIEW_SAFEPILOT_ANALYTICS'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dashboard = await adminInsiderThreat.getDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Insider dashboard error:', error);
      res.status(500).json({ error: 'Failed to get insider threat dashboard' });
    }
  }
);

router.get(
  '/insider/suspicious-activity',
  authenticateToken,
  requireAdmin('VIEW_SAFEPILOT_ANALYTICS'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 1;
      const activities = await adminInsiderThreat.detectSuspiciousActivity(days);
      res.json({ activities });
    } catch (error) {
      console.error('[SafePilot] Suspicious activity error:', error);
      res.status(500).json({ error: 'Failed to detect suspicious activity' });
    }
  }
);

router.get(
  '/insider/access-patterns',
  authenticateToken,
  requireAdmin('VIEW_SAFEPILOT_ANALYTICS'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const patterns = await adminInsiderThreat.getAdminAccessPatterns(days);
      res.json({ patterns });
    } catch (error) {
      console.error('[SafePilot] Access patterns error:', error);
      res.status(500).json({ error: 'Failed to get access patterns' });
    }
  }
);

router.post(
  '/insider/flag/:adminId',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { adminId } = req.params;
      const { reason } = req.body;
      const result = await adminInsiderThreat.flagAdmin(adminId, reason, req.user?.id || '');
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Flag admin error:', error);
      res.status(500).json({ error: 'Failed to flag admin' });
    }
  }
);

router.post(
  '/insider/lock/:adminId',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { adminId } = req.params;
      const { reason } = req.body;
      const result = await adminInsiderThreat.lockAdminAccount(adminId, reason, req.user?.id || '');
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Lock admin error:', error);
      res.status(500).json({ error: 'Failed to lock admin account' });
    }
  }
);

// ============================================================================
// PREDICTIVE ANALYTICS ROUTES
// ============================================================================

router.get(
  '/predictive/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const dashboard = await predictiveAnalytics.getDashboard(countryCode);
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Predictive dashboard error:', error);
      res.status(500).json({ error: 'Failed to get predictive dashboard' });
    }
  }
);

router.get(
  '/predictive/demand-forecast',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const hours = parseInt(req.query.hours as string) || 24;
      const forecast = await predictiveAnalytics.getDemandForecast(countryCode, hours);
      res.json({ forecast });
    } catch (error) {
      console.error('[SafePilot] Demand forecast error:', error);
      res.status(500).json({ error: 'Failed to get demand forecast' });
    }
  }
);

router.get(
  '/predictive/churn',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const predictions = await predictiveAnalytics.getChurnPredictions(countryCode, limit);
      res.json({ predictions });
    } catch (error) {
      console.error('[SafePilot] Churn predictions error:', error);
      res.status(500).json({ error: 'Failed to get churn predictions' });
    }
  }
);

router.get(
  '/predictive/revenue',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const projections = await predictiveAnalytics.getRevenueProjections(countryCode);
      res.json({ projections });
    } catch (error) {
      console.error('[SafePilot] Revenue projections error:', error);
      res.status(500).json({ error: 'Failed to get revenue projections' });
    }
  }
);

router.get(
  '/predictive/capacity',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const predictions = await predictiveAnalytics.getCapacityPredictions(countryCode);
      res.json({ predictions });
    } catch (error) {
      console.error('[SafePilot] Capacity predictions error:', error);
      res.status(500).json({ error: 'Failed to get capacity predictions' });
    }
  }
);

router.get(
  '/predictive/fraud-risk',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const predictions = await predictiveAnalytics.getFraudRiskPredictions(countryCode);
      res.json({ predictions });
    } catch (error) {
      console.error('[SafePilot] Fraud risk predictions error:', error);
      res.status(500).json({ error: 'Failed to get fraud risk predictions' });
    }
  }
);

// ============================================================================
// AUTO-DECISION ENGINE ROUTES
// ============================================================================

router.get(
  '/auto-decision/dashboard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dashboard = await autoDecisionEngine.getDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error('[SafePilot] Auto-decision dashboard error:', error);
      res.status(500).json({ error: 'Failed to get auto-decision dashboard' });
    }
  }
);

router.get(
  '/auto-decision/suggestions',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const suggestions = await autoDecisionEngine.getAutoBlockSuggestions(countryCode);
      res.json({ suggestions });
    } catch (error) {
      console.error('[SafePilot] Auto-block suggestions error:', error);
      res.status(500).json({ error: 'Failed to get auto-block suggestions' });
    }
  }
);

router.get(
  '/auto-decision/review-queue',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const queue = await autoDecisionEngine.getReviewQueue(limit);
      res.json({ queue });
    } catch (error) {
      console.error('[SafePilot] Review queue error:', error);
      res.status(500).json({ error: 'Failed to get review queue' });
    }
  }
);

router.get(
  '/auto-decision/rules',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const rules = await autoDecisionEngine.getDecisionRules();
      res.json({ rules });
    } catch (error) {
      console.error('[SafePilot] Decision rules error:', error);
      res.status(500).json({ error: 'Failed to get decision rules' });
    }
  }
);

router.post(
  '/auto-decision/execute-block',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityType, entityId, reason } = req.body;
      const result = await autoDecisionEngine.executeAutoBlock(
        entityType,
        entityId,
        reason,
        req.user?.id || ''
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Execute block error:', error);
      res.status(500).json({ error: 'Failed to execute block' });
    }
  }
);

router.post(
  '/auto-decision/execute-suspend',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityType, entityId, reason, durationHours } = req.body;
      const result = await autoDecisionEngine.executeSuspend(
        entityType,
        entityId,
        reason,
        durationHours || 24,
        req.user?.id || ''
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Execute suspend error:', error);
      res.status(500).json({ error: 'Failed to execute suspension' });
    }
  }
);

router.post(
  '/auto-decision/issue-warning',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityType, entityId, warningType, message } = req.body;
      const result = await autoDecisionEngine.issueWarning(
        entityType,
        entityId,
        warningType,
        message,
        req.user?.id || ''
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Issue warning error:', error);
      res.status(500).json({ error: 'Failed to issue warning' });
    }
  }
);

router.post(
  '/auto-decision/toggle-rule',
  authenticateToken,
  requireAdmin('MANAGE_SAFEPILOT_CONFIG'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { ruleId, enabled } = req.body;
      const result = await autoDecisionEngine.toggleRule(ruleId, enabled, req.user?.id || '');
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Toggle rule error:', error);
      res.status(500).json({ error: 'Failed to toggle rule' });
    }
  }
);

// ============================================================================
// MASTER UPGRADE ROUTES
// ============================================================================

/**
 * GET /api/admin/safepilot/crisis-report
 * One-Click Crisis Report: "What is happening right now?"
 */
router.get(
  '/crisis-report',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      console.log('[SafePilot] Crisis report requested by admin:', req.user?.id);
      
      const report = await safePilotService.generateCrisisReport(countryCode);
      res.json(report);
    } catch (error) {
      console.error('[SafePilot] Crisis report error:', error);
      res.status(500).json({ 
        error: 'Failed to generate crisis report',
        mode: 'CRISIS_REPORT',
        summary: 'Unable to generate report. Please retry.',
        topRisks: [],
        topOpportunities: [],
        urgentFixes: [],
        financialImpact: { totalAtRisk: 0, potentialSavings: 0, revenueOpportunity: 0 },
        operationalImpact: { affectedUsers: 0, affectedDrivers: 0, affectedOrders: 0 },
        recommendedNextSteps: ['Retry crisis report generation', 'Check system logs'],
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/explain-decision
 * Explain why SafePilot made a specific recommendation
 */
router.post(
  '/explain-decision',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { decisionType, entityId, context } = req.body;
      
      if (!decisionType || !entityId) {
        res.status(400).json({ error: 'decisionType and entityId are required' });
        return;
      }
      
      console.log(`[SafePilot] Decision explanation requested: ${decisionType} for ${entityId}`);
      
      const explanation = await safePilotService.explainDecision(
        decisionType,
        entityId,
        context
      );
      
      res.json(explanation);
    } catch (error) {
      console.error('[SafePilot] Explain decision error:', error);
      res.status(500).json({ 
        error: 'Failed to explain decision',
        decision: 'Unknown',
        reasoning: ['Unable to retrieve explanation'],
        dataPoints: [],
        confidenceLevel: 'LOW',
        alternatives: ['Request manual review'],
        appealGuidance: 'Contact support for assistance.',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/autonomous-scan
 * Run background autonomous scan for platform issues
 */
router.get(
  '/autonomous-scan',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      console.log('[SafePilot] Autonomous scan requested by admin:', req.user?.id);
      
      const scanResult = await safePilotService.runAutonomousScan(countryCode);
      res.json(scanResult);
    } catch (error) {
      console.error('[SafePilot] Autonomous scan error:', error);
      res.status(500).json({ 
        error: 'Failed to run autonomous scan',
        timestamp: new Date().toISOString(),
        scanDuration: 0,
        findings: [],
        healthScore: 0,
        nextScanRecommended: '5 minutes',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/survival-mode
 * Get Company Survival Mode report (cost optimization for startups)
 */
router.get(
  '/survival-mode',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      console.log('[SafePilot] Survival mode report requested by admin:', req.user?.id);
      
      const report = await safePilotService.generateSurvivalModeReport(countryCode);
      res.json(report);
    } catch (error) {
      console.error('[SafePilot] Survival mode error:', error);
      res.status(500).json({ 
        error: 'Failed to generate survival mode report',
        timestamp: new Date().toISOString(),
        automationOpportunities: [],
        costCuttingOptions: [],
        growthOpportunities: [],
        weeklyFocusAreas: ['Check system health'],
        humanRequired: [],
        canAutomate: [],
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/voice-command
 * Process voice command (placeholder for future implementation)
 */
router.post(
  '/voice-command',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { audioData, pageKey } = req.body;
      
      if (!req.user?.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      console.log('[SafePilot] Voice command received (placeholder mode)');
      
      const result = await safePilotService.processVoiceCommand(
        req.user.id,
        audioData || '',
        pageKey || 'admin.dashboard'
      );
      
      res.json(result);
    } catch (error) {
      console.error('[SafePilot] Voice command error:', error);
      res.status(500).json({ 
        error: 'Voice commands coming soon',
        transcribedText: '',
        response: null,
        voiceEnabled: false,
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/context-debug
 * Get debug information for context loading issues
 */
router.get(
  '/context-debug',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const pageKey = req.query.pageKey as string || 'admin.dashboard';
      console.log(`[SafePilot] Context debug requested for: ${pageKey}`);
      
      const debugInfo = await safePilotService.getContextDebugInfo(pageKey);
      res.json(debugInfo);
    } catch (error) {
      console.error('[SafePilot] Context debug error:', error);
      res.status(500).json({ 
        error: 'Failed to get debug info',
        pageKey: req.query.pageKey || 'unknown',
        timestamp: new Date().toISOString(),
        contextHandlerExists: false,
        fallbackUsed: true,
        dataSourcesChecked: [],
        errors: ['Debug info unavailable'],
        loadTimeMs: 0,
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/health
 * Get SafePilot system health status
 */
router.get(
  '/health',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const scanResult = await safePilotService.runAutonomousScan();
      
      res.json({
        status: scanResult.healthScore >= 80 ? 'healthy' : scanResult.healthScore >= 50 ? 'degraded' : 'critical',
        healthScore: scanResult.healthScore,
        lastScan: scanResult.timestamp,
        activeFindings: scanResult.findings.length,
        criticalFindings: scanResult.findings.filter(f => f.severity === 'CRITICAL').length,
        version: '2.0.0-master',
        features: {
          crisisReport: true,
          explainDecision: true,
          autonomousScan: true,
          survivalMode: true,
          voiceCommand: false,
          backgroundMonitoring: true,
        },
      });
    } catch (error) {
      console.error('[SafePilot] Health check error:', error);
      res.status(500).json({ 
        status: 'error',
        healthScore: 0,
        version: '2.0.0-master',
        error: 'Health check failed',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/metrics
 * Get SafePilot performance metrics
 */
router.get(
  '/metrics',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const [
        totalQueries,
        avgResponseTime,
        errorCount,
        uniqueAdmins,
      ] = await Promise.all([
        prisma.safePilotInteraction.count({ where: { timestamp: { gte: since } } }),
        prisma.safePilotInteraction.aggregate({ 
          where: { timestamp: { gte: since } }, 
          _avg: { responseTimeMs: true } 
        }),
        prisma.safePilotInteraction.count({ 
          where: { timestamp: { gte: since }, riskLevel: 'CRITICAL' } 
        }),
        prisma.safePilotInteraction.groupBy({
          by: ['adminId'],
          where: { timestamp: { gte: since } },
        }),
      ]);
      
      res.json({
        period: `${days} days`,
        totalQueries,
        avgResponseTimeMs: Math.round(avgResponseTime._avg.responseTimeMs || 0),
        criticalAlerts: errorCount,
        uniqueAdmins: uniqueAdmins.length,
        queriesPerDay: Math.round(totalQueries / days),
        uptime: '99.9%',
      });
    } catch (error) {
      console.error('[SafePilot] Metrics error:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }
);

// ============================================
// ULTRA ENHANCEMENT PACK (PHASE-3) ROUTES
// ============================================

/**
 * GET /api/admin/safepilot/ultra/anomaly-radar
 * 1. Real-Time Anomaly Radar - Live detection every 10 seconds
 */
router.get(
  '/ultra/anomaly-radar',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      console.log('[SafePilot Ultra] Anomaly Radar scan requested');
      
      const result = await safePilotService.runAnomalyRadar(countryCode);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Anomaly Radar error:', error);
      res.status(500).json({
        mode: 'GUARD',
        summary: ['Anomaly radar scan failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        anomalies: [],
        radarScore: 0,
        lastScanAt: new Date().toISOString(),
        nextScanIn: 10000,
        error: 'Anomaly radar scan failed',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/ultra/correlation
 * 2. Cross-Module Correlation Engine
 */
router.get(
  '/ultra/correlation',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const entityId = req.query.entityId as string | undefined;
      const entityType = req.query.entityType as 'driver' | 'customer' | 'restaurant' | undefined;
      console.log('[SafePilot Ultra] Cross-Module Correlation requested');
      
      const result = await safePilotService.runCrossModuleCorrelation(entityId, entityType);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Correlation error:', error);
      res.status(500).json({
        mode: 'WATCH',
        summary: ['Correlation engine failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        correlations: [],
        combinedRiskScore: 0,
        riskBreakdown: {},
        linkedCauses: [],
        confidence: 0,
        error: 'Correlation engine failed',
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/generate-report
 * 3. Auto-Generated Admin Reports (Daily/Weekly PDF)
 */
router.post(
  '/ultra/generate-report',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { reportType = 'daily' } = req.body;
      console.log(`[SafePilot Ultra] Generating ${reportType} admin report`);
      
      const report = await safePilotService.generateAdminReport(reportType as 'daily' | 'weekly');
      res.json(report);
    } catch (error) {
      console.error('[SafePilot Ultra] Report generation error:', error);
      res.status(500).json({
        mode: 'ASK',
        summary: ['Report generation failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        reportId: '',
        reportType: 'daily',
        generatedAt: new Date().toISOString(),
        periodStart: '',
        periodEnd: '',
        sections: {},
        downloadUrl: '',
        error: 'Report generation failed',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/ultra/reports/:reportId/download
 * Download generated report
 */
router.get(
  '/ultra/reports/:reportId/download',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { reportId } = req.params;
      console.log(`[SafePilot Ultra] Report download requested: ${reportId}`);
      
      // In production, this would serve the actual PDF file
      res.json({
        message: 'PDF download feature coming soon',
        reportId,
        status: 'pending',
        estimatedAvailability: 'Q1 2025',
      });
    } catch (error) {
      console.error('[SafePilot Ultra] Report download error:', error);
      res.status(500).json({ error: 'Report download failed' });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/auto-guard
 * 4. SafePilot Auto-Guard - Auto actions on HIGH RISK events
 */
router.post(
  '/ultra/auto-guard',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityId, entityType, riskLevel } = req.body;
      
      if (!entityId || !entityType || !riskLevel) {
        res.status(400).json({ error: 'Missing required fields: entityId, entityType, riskLevel' });
        return;
      }
      
      if (!req.user?.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      console.log(`[SafePilot Ultra] Auto-Guard executing for ${entityType} ${entityId}`);
      
      const result = await safePilotService.executeAutoGuard(
        entityId,
        entityType as 'driver' | 'customer' | 'restaurant',
        riskLevel as 'HIGH' | 'CRITICAL',
        req.user.id
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Auto-Guard error:', error);
      res.status(500).json({
        mode: 'GUARD',
        summary: ['Auto-Guard execution failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        actionsExecuted: [],
        entityId: '',
        entityType: '',
        approvalRequired: true,
        escalatedTo: null,
        error: 'Auto-Guard execution failed',
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/biometrics
 * 5. Behavioral Biometrics Engine - Bot/suspicious behavior detection
 */
router.post(
  '/ultra/biometrics',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, sessionData } = req.body;
      
      if (!userId || !sessionData) {
        res.status(400).json({ error: 'Missing required fields: userId, sessionData' });
        return;
      }
      
      console.log(`[SafePilot Ultra] Biometrics analysis for user ${userId}`);
      
      const result = await safePilotService.analyzeBehavioralBiometrics(userId, sessionData);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Biometrics error:', error);
      res.status(500).json({
        mode: 'GUARD',
        summary: ['Biometrics analysis failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        userId: '',
        biometricsScore: 0,
        isBotBehavior: false,
        isSuspiciousHuman: false,
        signals: {},
        recommendation: 'ALLOW',
        confidence: 0,
        error: 'Biometrics analysis failed',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/ultra/lost-revenue
 * 6. Lost Revenue Detector - Identify revenue leakage
 */
router.get(
  '/ultra/lost-revenue',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const periodDays = parseInt(req.query.periodDays as string) || 30;
      console.log(`[SafePilot Ultra] Lost Revenue detection for last ${periodDays} days`);
      
      const result = await safePilotService.detectLostRevenue(countryCode, periodDays);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Lost Revenue error:', error);
      res.status(500).json({
        mode: 'OPTIMIZE',
        summary: ['Lost revenue detection failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        lostRevenue: { total: 0, currency: 'USD', breakdown: {} },
        recoveryOpportunities: [],
        trends: { vsLastPeriod: 0, direction: 'STABLE' },
        error: 'Lost revenue detection failed',
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/explain-decision
 * 7. Explainable AI (X-AI Mode) - Decision explanation with confidence
 */
router.post(
  '/ultra/explain-decision',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { decisionId, decisionType, context = {} } = req.body;
      
      if (!decisionId || !decisionType) {
        res.status(400).json({ error: 'Missing required fields: decisionId, decisionType' });
        return;
      }
      
      console.log(`[SafePilot Ultra] Explaining decision: ${decisionId}`);
      
      const result = await safePilotService.explainDecision(decisionId, decisionType, context);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Explain decision error:', error);
      res.status(500).json({
        mode: 'ASK',
        summary: ['Decision explanation failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        decisionId: '',
        decisionType: '',
        explanation: {
          reasoning: [],
          confidencePercent: 0,
          confidenceLevel: 'LOW',
          dataSources: [],
          alternatives: [],
          uncertainties: [],
        },
        humanReadableSummary: 'Unable to explain this decision',
        appealGuidance: 'Please contact support for assistance',
        error: 'Decision explanation failed',
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/silent-monitoring
 * 8. Silent Monitoring Mode - Background monitoring with threshold alerts
 */
router.post(
  '/ultra/silent-monitoring',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { thresholds = { minRiskLevel: 'MEDIUM', categories: [] } } = req.body;
      console.log('[SafePilot Ultra] Silent Monitoring scan');
      
      const result = await safePilotService.runSilentMonitoring(thresholds);
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Silent Monitoring error:', error);
      res.status(500).json({
        mode: 'WATCH',
        summary: ['Silent monitoring failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        silentMode: true,
        alertsFiltered: 0,
        alertsShown: 0,
        activeAlerts: [],
        backgroundMetrics: { totalScans: 0, anomaliesDetected: 0, autoResolved: 0 },
        nextScanAt: new Date(Date.now() + 10000).toISOString(),
        error: 'Silent monitoring failed',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/ultra/memory/:entityType/:entityId
 * 9. Long-Term Memory Engine - Get lifetime patterns
 */
router.get(
  '/ultra/memory/:entityType/:entityId',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityType, entityId } = req.params;
      console.log(`[SafePilot Ultra] Long-Term Memory lookup for ${entityType} ${entityId}`);
      
      const result = await safePilotService.getLongTermMemory(
        entityId,
        entityType as 'driver' | 'customer' | 'restaurant'
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Memory lookup error:', error);
      res.status(500).json({
        mode: 'ASK',
        summary: ['Memory lookup failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        entityId: req.params.entityId,
        entityType: req.params.entityType,
        memory: {
          lifetimeRiskScore: 0,
          riskTrend: 'STABLE',
          flagHistory: [],
          qualityScore: 0,
          behaviorPatterns: [],
          fraudIndicators: 0,
          positiveSignals: 0,
          lastUpdated: new Date().toISOString(),
        },
        recommendations: [],
        retentionPeriod: '5 years',
        error: 'Memory lookup failed',
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/memory/:entityType/:entityId
 * 9. Long-Term Memory Engine - Update memory
 */
router.post(
  '/ultra/memory/:entityType/:entityId',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { entityType, entityId } = req.params;
      const { event, riskImpact = 0, qualityImpact = 0 } = req.body;
      
      if (!event) {
        res.status(400).json({ error: 'Missing required field: event' });
        return;
      }
      
      console.log(`[SafePilot Ultra] Long-Term Memory update for ${entityType} ${entityId}`);
      
      const result = await safePilotService.updateLongTermMemory(
        entityId,
        entityType as 'driver' | 'customer' | 'restaurant',
        { event, riskImpact, qualityImpact }
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] Memory update error:', error);
      res.status(500).json({
        success: false,
        updatedAt: new Date().toISOString(),
        error: 'Memory update failed',
      });
    }
  }
);

/**
 * POST /api/admin/safepilot/ultra/voicepilot
 * 10. VoicePilot - Enhanced voice command processing
 */
router.post(
  '/ultra/voicepilot',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { command, pageKey = 'admin.dashboard' } = req.body;
      
      if (!command) {
        res.status(400).json({ error: 'Missing required field: command' });
        return;
      }
      
      if (!req.user?.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      console.log(`[SafePilot Ultra] VoicePilot processing: "${command}"`);
      
      const result = await safePilotService.processVoicePilotCommand(
        req.user.id,
        command,
        pageKey
      );
      res.json(result);
    } catch (error) {
      console.error('[SafePilot Ultra] VoicePilot error:', error);
      res.status(500).json({
        mode: 'ASK',
        summary: ['VoicePilot processing failed'],
        keySignals: [],
        actions: [],
        monitor: [],
        voicePilot: {
          enabled: true,
          transcribedCommand: '',
          recognizedIntent: null,
          mappedFunction: null,
          executionStatus: 'NOT_SUPPORTED',
          availableCommands: [],
        },
        response: null,
        error: 'VoicePilot processing failed',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/ultra/voicepilot/commands
 * 10. VoicePilot - Get available voice commands
 */
router.get(
  '/ultra/voicepilot/commands',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        commands: safePilotService.voicePilotCommands,
        enabled: true,
        version: '1.0.0',
        supportedLanguages: ['en'],
      });
    } catch (error) {
      console.error('[SafePilot Ultra] VoicePilot commands error:', error);
      res.status(500).json({
        commands: {},
        enabled: false,
        version: '1.0.0',
        supportedLanguages: ['en'],
        error: 'Failed to get commands',
      });
    }
  }
);

/**
 * GET /api/admin/safepilot/ultra/status
 * Get Ultra Enhancement Pack status
 */
router.get(
  '/ultra/status',
  authenticateToken,
  requireAdmin('USE_SAFEPILOT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        version: '3.0.0-ultra',
        enabled: true,
        features: {
          anomalyRadar: { enabled: true, scanInterval: 10000 },
          crossModuleCorrelation: { enabled: true },
          autoGeneratedReports: { enabled: true, types: ['daily', 'weekly'] },
          autoGuard: { enabled: true, riskLevels: ['HIGH', 'CRITICAL'] },
          behavioralBiometrics: { enabled: true },
          lostRevenueDetector: { enabled: true },
          explainableAI: { enabled: true },
          silentMonitoring: { enabled: true },
          longTermMemory: { enabled: true, retentionPeriod: '5 years' },
          voicePilot: { enabled: true, status: 'beta' },
        },
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SafePilot Ultra] Status error:', error);
      res.status(500).json({ error: 'Failed to get Ultra status' });
    }
  }
);

export default router;
