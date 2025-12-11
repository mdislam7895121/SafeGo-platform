/**
 * SafeGo Automation Admin API Routes
 * Admin visibility and control for all automation systems
 * Protected with authentication and admin role verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  autoAssignmentEngine,
  surgePricingAutomation,
  autoSettlementService,
  recommendationEngine,
  dynamicPricingService,
  performanceScoringService,
  autoCancellationService,
  autoPayoutService,
  getAutomationSystemsStatus,
  fraudDetectionAutomation,
  loginSecurityAutomation,
  autoNegativeBalanceControl,
  inventoryMenuErrorAutomation,
  systemMonitoringAutomation,
  aiCustomerSupportAutomation,
  highRiskActivityAutomation,
} from '../services/automation';

import automationRiskRoutes from './automation-risk';
import automationExperienceRoutes from './automation-experience';
import automationOpsRoutes from './automation-ops';

const router = Router();

const ADMIN_ROLES = ['admin', 'super_admin', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE_ADMIN'];

/**
 * Security: Get authenticated admin ID or throw error
 * NEVER falls back to 'system' - ensures complete audit trail integrity
 */
function getRequiredAdminId(req: AuthRequest): string {
  const adminId = req.user?.userId;
  if (!adminId) {
    throw new Error('SECURITY_VIOLATION: Admin ID missing after authentication');
  }
  return adminId;
}

const requireAdminRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

router.use(authenticateToken);
router.use(requireAdminRole);

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = getAutomationSystemsStatus();
    res.json({ success: true, systems: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get automation status' });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { automationType, entityType, status, limit = 100 } = req.query;

    const logs = await prisma.automationLog.findMany({
      where: {
        ...(automationType ? { automationType: String(automationType) } : {}),
        ...(entityType ? { entityType: String(entityType) } : {}),
        ...(status ? { status: String(status) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

router.post('/assignment/find-partner', async (req: Request, res: Response) => {
  try {
    const result = await autoAssignmentEngine.findBestPartner(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Assignment failed' });
  }
});

router.get('/assignment/history/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const history = await autoAssignmentEngine.getAssignmentHistory(entityType, entityId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

router.put('/assignment/weights', async (req: Request, res: Response) => {
  try {
    await autoAssignmentEngine.updateWeights(req.body);
    res.json({ success: true, weights: autoAssignmentEngine.getWeights() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update weights' });
  }
});

router.get('/surge/active', async (req: Request, res: Response) => {
  try {
    const activeSurges = await surgePricingAutomation.getActiveSurges();
    res.json({ success: true, surges: activeSurges });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch surges' });
  }
});

router.get('/surge/all', async (req: Request, res: Response) => {
  try {
    const allData = await surgePricingAutomation.getAllSurgeData();
    res.json({ success: true, data: allData });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch surge data' });
  }
});

router.post('/surge/override', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { zoneId, multiplier, reason } = req.body;
    await surgePricingAutomation.adminOverride(zoneId, multiplier, adminId, reason);
    res.json({ success: true, message: 'Override applied' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to apply override' });
  }
});

router.put('/surge/config', async (req: Request, res: Response) => {
  try {
    surgePricingAutomation.updateConfig(req.body);
    res.json({ success: true, config: surgePricingAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.post('/surge/start', async (req: Request, res: Response) => {
  try {
    await surgePricingAutomation.start();
    res.json({ success: true, message: 'Surge pricing started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/surge/stop', async (req: Request, res: Response) => {
  try {
    surgePricingAutomation.stop();
    res.json({ success: true, message: 'Surge pricing stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.post('/settlement/run', async (req: Request, res: Response) => {
  try {
    const result = await autoSettlementService.runWeeklySettlement();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Settlement failed' });
  }
});

router.post('/settlement/manual/:walletId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { walletId } = req.params;
    const { amount } = req.body;
    const result = await autoSettlementService.manualSettle(walletId, adminId, amount);
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Manual settlement failed' });
  }
});

router.get('/settlement/pending', async (req: Request, res: Response) => {
  try {
    const pending = await autoSettlementService.getPendingSettlements();
    res.json({ success: true, wallets: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pending' });
  }
});

router.get('/settlement/history', async (req: Request, res: Response) => {
  try {
    const { ownerType, limit = 100 } = req.query;
    const history = await autoSettlementService.getSettlementHistory(
      ownerType ? String(ownerType) : undefined,
      Number(limit)
    );
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

router.put('/settlement/config', async (req: Request, res: Response) => {
  try {
    autoSettlementService.updateConfig(req.body);
    res.json({ success: true, config: autoSettlementService.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/recommendations/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { types, limit = 10 } = req.query;
    
    const typeArray = types ? String(types).split(',') : ['ride', 'food', 'restaurant'];
    const result = await recommendationEngine.getRecommendations(
      { customerId },
      typeArray as any,
      Number(limit)
    );
    res.json({ success: true, recommendations: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get recommendations' });
  }
});

router.post('/recommendations/track-click', async (req: Request, res: Response) => {
  try {
    const { customerId, recommendationId, type } = req.body;
    await recommendationEngine.trackRecommendationClick(customerId, recommendationId, type);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to track click' });
  }
});

router.post('/pricing/calculate', async (req: Request, res: Response) => {
  try {
    const result = await dynamicPricingService.calculateOptimizedPrice(req.body);
    res.json({ success: true, pricing: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Pricing calculation failed' });
  }
});

router.get('/pricing/time-slots', async (req: Request, res: Response) => {
  try {
    const slots = dynamicPricingService.getTimeSlots();
    res.json({ success: true, timeSlots: slots });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get time slots' });
  }
});

router.put('/pricing/time-slots', async (req: Request, res: Response) => {
  try {
    dynamicPricingService.updateTimeSlots(req.body.slots);
    res.json({ success: true, timeSlots: dynamicPricingService.getTimeSlots() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update time slots' });
  }
});

router.post('/pricing/festival', async (req: Request, res: Response) => {
  try {
    await dynamicPricingService.addFestival(req.body);
    res.json({ success: true, festivals: dynamicPricingService.getFestivals() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add festival' });
  }
});

router.delete('/pricing/festival/:name', async (req: Request, res: Response) => {
  try {
    await dynamicPricingService.removeFestival(req.params.name);
    res.json({ success: true, festivals: dynamicPricingService.getFestivals() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove festival' });
  }
});

router.get('/pricing/analytics', async (req: Request, res: Response) => {
  try {
    const { countryCode, startDate, endDate } = req.query;
    const analytics = await dynamicPricingService.getPricingAnalytics(
      String(countryCode || 'US'),
      new Date(String(startDate || Date.now() - 7 * 24 * 60 * 60 * 1000)),
      new Date(String(endDate || Date.now()))
    );
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
});

router.post('/performance/calculate/:partnerType/:partnerId', async (req: Request, res: Response) => {
  try {
    const { partnerType, partnerId } = req.params;
    let score;
    
    switch (partnerType) {
      case 'driver':
        score = await performanceScoringService.calculateDriverScore(partnerId);
        break;
      case 'restaurant':
        score = await performanceScoringService.calculateRestaurantScore(partnerId);
        break;
      case 'shop':
        score = await performanceScoringService.calculateShopScore(partnerId);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid partner type' });
    }
    
    res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Score calculation failed' });
  }
});

router.get('/performance/score/:partnerType/:partnerId', async (req: Request, res: Response) => {
  try {
    const { partnerType, partnerId } = req.params;
    const score = await performanceScoringService.getPartnerScore(partnerId, partnerType);
    res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get score' });
  }
});

router.get('/performance/leaderboard/:partnerType', async (req: Request, res: Response) => {
  try {
    const { partnerType } = req.params;
    const { limit = 50 } = req.query;
    const leaderboard = await performanceScoringService.getLeaderboard(partnerType, Number(limit));
    res.json({ success: true, leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

router.put('/performance/weights', async (req: Request, res: Response) => {
  try {
    performanceScoringService.updateWeights(req.body);
    res.json({ success: true, weights: performanceScoringService.getWeights() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update weights' });
  }
});

router.post('/performance/run-daily', async (req: Request, res: Response) => {
  try {
    await performanceScoringService.runDailyScoring();
    res.json({ success: true, message: 'Daily scoring completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Daily scoring failed' });
  }
});

router.post('/cancellation/process', async (req: Request, res: Response) => {
  try {
    const result = await autoCancellationService.processCancellation(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Cancellation processing failed' });
  }
});

router.get('/cancellation/cooldown/:actorType/:actorId', async (req: Request, res: Response) => {
  try {
    const { actorType, actorId } = req.params;
    const status = await autoCancellationService.checkCooldown(actorType, actorId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check cooldown' });
  }
});

router.post('/cancellation/clear-cooldown/:actorType/:actorId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { actorType, actorId } = req.params;
    await autoCancellationService.adminClearCooldown(actorId, actorType, adminId);
    res.json({ success: true, message: 'Cooldown cleared' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to clear cooldown' });
  }
});

router.get('/cancellation/stats/:actorType/:actorId', async (req: Request, res: Response) => {
  try {
    const { actorType, actorId } = req.params;
    const { days = 30 } = req.query;
    const stats = await autoCancellationService.getCancellationStats(actorId, actorType, Number(days));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.put('/cancellation/config', async (req: Request, res: Response) => {
  try {
    autoCancellationService.updateConfig(req.body);
    res.json({ success: true, config: autoCancellationService.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.post('/payout/process', async (req: Request, res: Response) => {
  try {
    const decision = await autoPayoutService.processPayoutRequest(req.body);
    res.json({ success: true, decision });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Payout processing failed' });
  }
});

router.get('/payout/pending', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const pending = await autoPayoutService.getPendingPayouts(Number(limit));
    res.json({ success: true, payouts: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get pending payouts' });
  }
});

router.get('/payout/flagged', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const flagged = await autoPayoutService.getFlaggedPayouts(Number(limit));
    res.json({ success: true, payouts: flagged });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get flagged payouts' });
  }
});

router.post('/payout/approve/:payoutId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { payoutId } = req.params;
    const { notes } = req.body;
    await autoPayoutService.adminApprove(payoutId, adminId, notes);
    res.json({ success: true, message: 'Payout approved' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Approval failed' });
  }
});

router.post('/payout/reject/:payoutId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { payoutId } = req.params;
    const { reason } = req.body;
    await autoPayoutService.adminReject(payoutId, adminId, reason);
    res.json({ success: true, message: 'Payout rejected' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Rejection failed' });
  }
});

router.put('/payout/config', async (req: Request, res: Response) => {
  try {
    autoPayoutService.updateConfig(req.body);
    res.json({ success: true, config: autoPayoutService.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/fraud/status', async (req: Request, res: Response) => {
  try {
    const status = fraudDetectionAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get fraud detection status' });
  }
});

router.put('/fraud/config', async (req: Request, res: Response) => {
  try {
    fraudDetectionAutomation.updateConfig(req.body);
    res.json({ success: true, config: fraudDetectionAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update fraud config' });
  }
});

router.get('/fraud/alerts', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = await fraudDetectionAutomation.getActiveAlerts(Number(limit));
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get fraud alerts' });
  }
});

router.post('/fraud/resolve/:alertId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { alertId } = req.params;
    const { resolution } = req.body;
    await fraudDetectionAutomation.resolveAlert(alertId, adminId, resolution);
    res.json({ success: true, message: 'Alert resolved' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

router.get('/fraud/stats', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const stats = await fraudDetectionAutomation.getFraudStats(Number(days));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get fraud stats' });
  }
});

router.post('/fraud/start', async (req: Request, res: Response) => {
  try {
    await fraudDetectionAutomation.start();
    res.json({ success: true, message: 'Fraud detection started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start fraud detection' });
  }
});

router.post('/fraud/stop', async (req: Request, res: Response) => {
  try {
    fraudDetectionAutomation.stop();
    res.json({ success: true, message: 'Fraud detection stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop fraud detection' });
  }
});

router.get('/login-security/status', async (req: Request, res: Response) => {
  try {
    const status = loginSecurityAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get login security status' });
  }
});

router.put('/login-security/config', async (req: Request, res: Response) => {
  try {
    loginSecurityAutomation.updateConfig(req.body);
    res.json({ success: true, config: loginSecurityAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update login security config' });
  }
});

router.get('/login-security/locked-accounts', async (req: Request, res: Response) => {
  try {
    const locked = await loginSecurityAutomation.getLockedAccounts();
    res.json({ success: true, lockedAccounts: locked });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get locked accounts' });
  }
});

router.post('/login-security/unlock/:email', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { email } = req.params;
    await loginSecurityAutomation.unlockAccount(email, adminId);
    res.json({ success: true, message: 'Account unlocked' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to unlock account' });
  }
});

router.post('/login-security/trust-device', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { userId, deviceId } = req.body;
    await loginSecurityAutomation.trustDevice(userId, deviceId, adminId);
    res.json({ success: true, message: 'Device trusted' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to trust device' });
  }
});

router.get('/login-security/stats', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const stats = await loginSecurityAutomation.getSecurityStats(Number(days));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get security stats' });
  }
});

router.post('/login-security/start', async (req: Request, res: Response) => {
  try {
    await loginSecurityAutomation.start();
    res.json({ success: true, message: 'Login security started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start login security' });
  }
});

router.post('/login-security/stop', async (req: Request, res: Response) => {
  try {
    loginSecurityAutomation.stop();
    res.json({ success: true, message: 'Login security stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop login security' });
  }
});

router.get('/negative-balance/status', async (req: Request, res: Response) => {
  try {
    const status = autoNegativeBalanceControl.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get negative balance status' });
  }
});

router.put('/negative-balance/config', async (req: Request, res: Response) => {
  try {
    autoNegativeBalanceControl.updateConfig(req.body);
    res.json({ success: true, config: autoNegativeBalanceControl.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/negative-balance/wallets', async (req: Request, res: Response) => {
  try {
    const wallets = await autoNegativeBalanceControl.getNegativeBalanceWallets();
    res.json({ success: true, wallets });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get negative balance wallets' });
  }
});

router.get('/negative-balance/overdue', async (req: Request, res: Response) => {
  try {
    const overdue = await autoNegativeBalanceControl.getOverdueWallets();
    res.json({ success: true, wallets: overdue });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get overdue wallets' });
  }
});

router.post('/negative-balance/run-check', async (req: Request, res: Response) => {
  try {
    const result = await autoNegativeBalanceControl.runDailyCheck();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run daily check' });
  }
});

router.get('/negative-balance/stats', async (req: Request, res: Response) => {
  try {
    const stats = await autoNegativeBalanceControl.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.post('/negative-balance/start', async (req: Request, res: Response) => {
  try {
    await autoNegativeBalanceControl.start();
    res.json({ success: true, message: 'Negative balance control started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/negative-balance/stop', async (req: Request, res: Response) => {
  try {
    autoNegativeBalanceControl.stop();
    res.json({ success: true, message: 'Negative balance control stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/inventory-menu/status', async (req: Request, res: Response) => {
  try {
    const status = inventoryMenuErrorAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.put('/inventory-menu/config', async (req: Request, res: Response) => {
  try {
    inventoryMenuErrorAutomation.updateConfig(req.body);
    res.json({ success: true, config: inventoryMenuErrorAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.post('/inventory-menu/scan', async (req: Request, res: Response) => {
  try {
    const result = await inventoryMenuErrorAutomation.runFullScan();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run scan' });
  }
});

router.get('/inventory-menu/errors', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const errors = await inventoryMenuErrorAutomation.getActiveErrors(Number(limit));
    res.json({ success: true, errors });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get errors' });
  }
});

router.post('/inventory-menu/resolve/:errorId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { errorId } = req.params;
    const { resolution } = req.body;
    await inventoryMenuErrorAutomation.resolveError(errorId, adminId, resolution);
    res.json({ success: true, message: 'Error resolved' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to resolve error' });
  }
});

router.get('/inventory-menu/stats', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const stats = await inventoryMenuErrorAutomation.getStats(Number(days));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.post('/inventory-menu/start', async (req: Request, res: Response) => {
  try {
    await inventoryMenuErrorAutomation.start();
    res.json({ success: true, message: 'Inventory menu error detection started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/inventory-menu/stop', async (req: Request, res: Response) => {
  try {
    inventoryMenuErrorAutomation.stop();
    res.json({ success: true, message: 'Inventory menu error detection stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/system-monitoring/status', async (req: Request, res: Response) => {
  try {
    const status = systemMonitoringAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get system monitoring status' });
  }
});

router.put('/system-monitoring/config', async (req: Request, res: Response) => {
  try {
    systemMonitoringAutomation.updateConfig(req.body);
    res.json({ success: true, config: systemMonitoringAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/system-monitoring/health', async (req: Request, res: Response) => {
  try {
    const health = systemMonitoringAutomation.getHealthSummary();
    res.json({ success: true, health });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get health summary' });
  }
});

router.get('/system-monitoring/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = systemMonitoringAutomation.getMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get metrics' });
  }
});

router.get('/system-monitoring/stats', async (req: Request, res: Response) => {
  try {
    const { hours = 24 } = req.query;
    const stats = await systemMonitoringAutomation.getStats(Number(hours));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.post('/system-monitoring/check', async (req: Request, res: Response) => {
  try {
    await systemMonitoringAutomation.runHealthChecks();
    res.json({ success: true, message: 'Health checks completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run health checks' });
  }
});

router.post('/system-monitoring/start', async (req: Request, res: Response) => {
  try {
    await systemMonitoringAutomation.start();
    res.json({ success: true, message: 'System monitoring started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/system-monitoring/stop', async (req: Request, res: Response) => {
  try {
    systemMonitoringAutomation.stop();
    res.json({ success: true, message: 'System monitoring stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/ai-support/status', async (req: Request, res: Response) => {
  try {
    const status = aiCustomerSupportAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get AI support status' });
  }
});

router.put('/ai-support/config', async (req: Request, res: Response) => {
  try {
    aiCustomerSupportAutomation.updateConfig(req.body);
    res.json({ success: true, config: aiCustomerSupportAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.post('/ai-support/classify', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    const classification = await aiCustomerSupportAutomation.classifyIssue(description);
    res.json({ success: true, classification });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to classify issue' });
  }
});

router.get('/ai-support/stats', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const stats = await aiCustomerSupportAutomation.getStats(Number(days));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.post('/ai-support/start', async (req: Request, res: Response) => {
  try {
    await aiCustomerSupportAutomation.start();
    res.json({ success: true, message: 'AI customer support started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/ai-support/stop', async (req: Request, res: Response) => {
  try {
    aiCustomerSupportAutomation.stop();
    res.json({ success: true, message: 'AI customer support stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/high-risk/status', async (req: Request, res: Response) => {
  try {
    const status = highRiskActivityAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get high-risk status' });
  }
});

router.put('/high-risk/config', async (req: Request, res: Response) => {
  try {
    highRiskActivityAutomation.updateConfig(req.body);
    res.json({ success: true, config: highRiskActivityAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/high-risk/alerts', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = await highRiskActivityAutomation.getActiveAlerts(Number(limit));
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get high-risk alerts' });
  }
});

router.post('/high-risk/review/:alertId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { alertId } = req.params;
    const { decision, notes } = req.body;
    await highRiskActivityAutomation.reviewAlert(alertId, adminId, decision, notes);
    res.json({ success: true, message: 'Alert reviewed' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to review alert' });
  }
});

router.post('/high-risk/unfreeze/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { userId } = req.params;
    await highRiskActivityAutomation.unfreezeAccount(userId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'HIGH_RISK',
        entityType: 'user',
        entityId: userId,
        status: 'admin_unfreeze',
        metadata: { adminId, unfrozenAt: new Date().toISOString() },
      },
    });
    
    res.json({ success: true, message: 'Account unfrozen' });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Failed to unfreeze account' });
  }
});

router.get('/high-risk/stats', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const stats = await highRiskActivityAutomation.getStats(Number(days));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/high-risk/user-risk/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const riskScore = highRiskActivityAutomation.getUserRiskScore(userId);
    res.json({ success: true, userId, riskScore });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user risk score' });
  }
});

router.post('/high-risk/start', async (req: Request, res: Response) => {
  try {
    await highRiskActivityAutomation.start();
    res.json({ success: true, message: 'High-risk detection started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/high-risk/stop', async (req: Request, res: Response) => {
  try {
    highRiskActivityAutomation.stop();
    res.json({ success: true, message: 'High-risk detection stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.use('/risk', automationRiskRoutes);
router.use('/experience', automationExperienceRoutes);
router.use('/ops', automationOpsRoutes);

export default router;
