import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import {
  orderSuccessPredictionAutomation,
  inventoryForecastingAutomation,
  repeatPurchaseTriggerAutomation,
  negativeReviewRecoveryAutomation,
  seasonalIntelligenceAutomation,
  marketingBudgetAutomation,
} from '../services/automation';

const router = Router();

function getRequiredAdminId(req: AuthRequest): string {
  const adminId = req.user?.userId;
  if (!adminId) {
    throw new Error('SECURITY_VIOLATION: Admin ID missing after authentication');
  }
  return adminId;
}

router.get('/order-prediction/status', async (req: Request, res: Response) => {
  try {
    const status = orderSuccessPredictionAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/order-prediction/config', async (req: Request, res: Response) => {
  try {
    const config = orderSuccessPredictionAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/order-prediction/config', async (req: Request, res: Response) => {
  try {
    orderSuccessPredictionAutomation.updateConfig(req.body);
    res.json({ success: true, config: orderSuccessPredictionAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.post('/order-prediction/predict', async (req: Request, res: Response) => {
  try {
    const { customerId, orderType, orderId, amount, paymentMethod = 'cod' } = req.body;
    const prediction = await orderSuccessPredictionAutomation.predictOrderRisk(
      orderType,
      orderId || `temp-${Date.now()}`,
      customerId,
      amount,
      paymentMethod
    );
    res.json({ success: true, prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Prediction failed' });
  }
});

router.get('/order-prediction/high-risk', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const highRisk = await prisma.orderRiskPrediction.findMany({
      where: { riskLevel: { in: ['high', 'critical'] } },
      orderBy: { predictedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, highRisk });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get high-risk predictions' });
  }
});

router.post('/order-prediction/start', async (req: Request, res: Response) => {
  try {
    await orderSuccessPredictionAutomation.start();
    res.json({ success: true, message: 'Order prediction started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/order-prediction/stop', async (req: Request, res: Response) => {
  try {
    orderSuccessPredictionAutomation.stop();
    res.json({ success: true, message: 'Order prediction stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/inventory/status', async (req: Request, res: Response) => {
  try {
    const status = inventoryForecastingAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/inventory/config', async (req: Request, res: Response) => {
  try {
    const config = inventoryForecastingAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/inventory/config', async (req: Request, res: Response) => {
  try {
    inventoryForecastingAutomation.updateConfig(req.body);
    res.json({ success: true, config: inventoryForecastingAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/inventory/forecasts', async (req: Request, res: Response) => {
  try {
    const { partnerId, urgency, limit = 50 } = req.query;
    const forecasts = await prisma.inventoryForecast.findMany({
      where: {
        ...(partnerId ? { partnerId: String(partnerId) } : {}),
        ...(urgency ? { urgency: String(urgency) } : {}),
      },
      orderBy: { forecastDate: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, forecasts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get forecasts' });
  }
});

router.post('/inventory/forecast/:partnerType/:partnerId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { partnerType, partnerId } = req.params;
    const result = partnerType === 'shop' 
      ? await inventoryForecastingAutomation.forecastShopInventory(partnerId)
      : await inventoryForecastingAutomation.forecastRestaurantInventory(partnerId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'INVENTORY_FORECAST',
        entityType: partnerType,
        entityId: partnerId,
        status: 'manual_forecast',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Forecast failed' });
  }
});

router.post('/inventory/start', async (req: Request, res: Response) => {
  try {
    await inventoryForecastingAutomation.start();
    res.json({ success: true, message: 'Inventory forecasting started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/inventory/stop', async (req: Request, res: Response) => {
  try {
    inventoryForecastingAutomation.stop();
    res.json({ success: true, message: 'Inventory forecasting stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/repeat-purchase/status', async (req: Request, res: Response) => {
  try {
    const status = repeatPurchaseTriggerAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/repeat-purchase/config', async (req: Request, res: Response) => {
  try {
    const config = repeatPurchaseTriggerAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/repeat-purchase/config', async (req: Request, res: Response) => {
  try {
    repeatPurchaseTriggerAutomation.updateConfig(req.body);
    res.json({ success: true, config: repeatPurchaseTriggerAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/repeat-purchase/triggers', async (req: Request, res: Response) => {
  try {
    const { customerId, status, limit = 50 } = req.query;
    const triggers = await prisma.repeatPurchaseTrigger.findMany({
      where: {
        ...(customerId ? { customerId: String(customerId) } : {}),
        ...(status ? { status: String(status) } : {}),
      },
      orderBy: { triggerDate: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, triggers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get triggers' });
  }
});

router.post('/repeat-purchase/start', async (req: Request, res: Response) => {
  try {
    await repeatPurchaseTriggerAutomation.start();
    res.json({ success: true, message: 'Repeat purchase triggers started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/repeat-purchase/stop', async (req: Request, res: Response) => {
  try {
    repeatPurchaseTriggerAutomation.stop();
    res.json({ success: true, message: 'Repeat purchase triggers stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/review-recovery/status', async (req: Request, res: Response) => {
  try {
    const status = negativeReviewRecoveryAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/review-recovery/config', async (req: Request, res: Response) => {
  try {
    const config = negativeReviewRecoveryAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/review-recovery/config', async (req: Request, res: Response) => {
  try {
    negativeReviewRecoveryAutomation.updateConfig(req.body);
    res.json({ success: true, config: negativeReviewRecoveryAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/review-recovery/plans', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query;
    const plans = await prisma.reviewRecoveryPlan.findMany({
      where: status ? { status: String(status) } : {},
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get recovery plans' });
  }
});

router.post('/review-recovery/execute/:planId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { planId } = req.params;
    
    const plan = await prisma.reviewRecoveryPlan.update({
      where: { id: planId },
      data: { 
        status: 'action_taken',
        notificationSent: true,
        notificationSentAt: new Date(),
      },
    });
    
    await prisma.automationLog.create({
      data: {
        automationType: 'REVIEW_RECOVERY',
        entityType: 'plan',
        entityId: planId,
        status: 'manual_execute',
        metadata: { adminId, planStatus: plan.status },
      },
    });
    
    res.json({ success: true, result: plan });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Execution failed' });
  }
});

router.post('/review-recovery/start', async (req: Request, res: Response) => {
  try {
    await negativeReviewRecoveryAutomation.start();
    res.json({ success: true, message: 'Review recovery started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/review-recovery/stop', async (req: Request, res: Response) => {
  try {
    negativeReviewRecoveryAutomation.stop();
    res.json({ success: true, message: 'Review recovery stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/seasonal/status', async (req: Request, res: Response) => {
  try {
    const status = seasonalIntelligenceAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/seasonal/config', async (req: Request, res: Response) => {
  try {
    const config = seasonalIntelligenceAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/seasonal/config', async (req: Request, res: Response) => {
  try {
    seasonalIntelligenceAutomation.updateConfig(req.body);
    res.json({ success: true, config: seasonalIntelligenceAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/seasonal/insights', async (req: Request, res: Response) => {
  try {
    const { countryCode, season, limit = 50 } = req.query;
    const insights = await prisma.seasonalInsight.findMany({
      where: {
        ...(countryCode ? { countryCode: String(countryCode) } : {}),
        ...(season ? { season: String(season) } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, insights });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get insights' });
  }
});

router.get('/seasonal/current', async (req: Request, res: Response) => {
  try {
    const { countryCode = 'BD' } = req.query;
    const current = await seasonalIntelligenceAutomation.getActiveSeasons(String(countryCode));
    res.json({ success: true, current });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get current seasons' });
  }
});

router.post('/seasonal/start', async (req: Request, res: Response) => {
  try {
    await seasonalIntelligenceAutomation.start();
    res.json({ success: true, message: 'Seasonal intelligence started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/seasonal/stop', async (req: Request, res: Response) => {
  try {
    seasonalIntelligenceAutomation.stop();
    res.json({ success: true, message: 'Seasonal intelligence stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/marketing/status', async (req: Request, res: Response) => {
  try {
    const status = marketingBudgetAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/marketing/config', async (req: Request, res: Response) => {
  try {
    const config = marketingBudgetAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/marketing/config', async (req: Request, res: Response) => {
  try {
    marketingBudgetAutomation.updateConfig(req.body);
    res.json({ success: true, config: marketingBudgetAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/marketing/plans', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query;
    const plans = await prisma.marketingBudgetPlan.findMany({
      where: status ? { status: String(status) } : {},
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get marketing plans' });
  }
});

router.post('/marketing/optimize', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    await marketingBudgetAutomation.runBudgetOptimizationScan();
    
    await prisma.automationLog.create({
      data: {
        automationType: 'MARKETING_BUDGET',
        entityType: 'optimization',
        entityId: 'manual',
        status: 'manual_run',
        metadata: { adminId },
      },
    });
    
    res.json({ success: true, message: 'Budget optimization scan completed' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Optimization failed' });
  }
});

router.post('/marketing/start', async (req: Request, res: Response) => {
  try {
    await marketingBudgetAutomation.start();
    res.json({ success: true, message: 'Marketing budget optimization started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/marketing/stop', async (req: Request, res: Response) => {
  try {
    marketingBudgetAutomation.stop();
    res.json({ success: true, message: 'Marketing budget optimization stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

export default router;
