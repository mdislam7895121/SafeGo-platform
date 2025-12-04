import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import {
  customerAbuseAutomation,
  partnerFraudAutomation,
  customerPaymentScoringAutomation,
  partnerRiskMonitoringAutomation,
} from '../services/automation';

const router = Router();

function getRequiredAdminId(req: AuthRequest): string {
  const adminId = req.user?.userId;
  if (!adminId) {
    throw new Error('SECURITY_VIOLATION: Admin ID missing after authentication');
  }
  return adminId;
}

router.get('/customer-abuse/status', async (req: Request, res: Response) => {
  try {
    const status = customerAbuseAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/customer-abuse/config', async (req: Request, res: Response) => {
  try {
    const config = customerAbuseAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/customer-abuse/config', async (req: Request, res: Response) => {
  try {
    customerAbuseAutomation.updateConfig(req.body);
    res.json({ success: true, config: customerAbuseAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/customer-abuse/flagged', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const flagged = await prisma.riskScore.findMany({
      where: { scoreType: 'customer_abuse', riskLevel: { in: ['high', 'critical'] } },
      orderBy: { calculatedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, flagged });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get flagged customers' });
  }
});

router.post('/customer-abuse/scan/:customerId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { customerId } = req.params;
    const result = await customerAbuseAutomation.analyzeCustomer(customerId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'CUSTOMER_ABUSE',
        entityType: 'customer',
        entityId: customerId,
        status: 'manual_scan',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Scan failed' });
  }
});

router.post('/customer-abuse/start', async (req: Request, res: Response) => {
  try {
    await customerAbuseAutomation.start();
    res.json({ success: true, message: 'Customer abuse detection started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/customer-abuse/stop', async (req: Request, res: Response) => {
  try {
    customerAbuseAutomation.stop();
    res.json({ success: true, message: 'Customer abuse detection stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/partner-fraud/status', async (req: Request, res: Response) => {
  try {
    const status = partnerFraudAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/partner-fraud/config', async (req: Request, res: Response) => {
  try {
    const config = partnerFraudAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/partner-fraud/config', async (req: Request, res: Response) => {
  try {
    partnerFraudAutomation.updateConfig(req.body);
    res.json({ success: true, config: partnerFraudAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/partner-fraud/flagged', async (req: Request, res: Response) => {
  try {
    const { partnerType, limit = 50 } = req.query;
    const flagged = await prisma.riskScore.findMany({
      where: {
        scoreType: 'partner_fraud',
        riskLevel: { in: ['high', 'critical'] },
        ...(partnerType ? { entityType: String(partnerType) } : {}),
      },
      orderBy: { calculatedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, flagged });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get flagged partners' });
  }
});

router.post('/partner-fraud/scan/:partnerType/:partnerId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { partnerType, partnerId } = req.params;
    const result = partnerType === 'restaurant' 
      ? await partnerFraudAutomation.analyzeRestaurant(partnerId)
      : await partnerFraudAutomation.analyzeShop(partnerId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'PARTNER_FRAUD',
        entityType: partnerType,
        entityId: partnerId,
        status: 'manual_scan',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Scan failed' });
  }
});

router.post('/partner-fraud/start', async (req: Request, res: Response) => {
  try {
    await partnerFraudAutomation.start();
    res.json({ success: true, message: 'Partner fraud detection started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/partner-fraud/stop', async (req: Request, res: Response) => {
  try {
    partnerFraudAutomation.stop();
    res.json({ success: true, message: 'Partner fraud detection stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/payment-scoring/status', async (req: Request, res: Response) => {
  try {
    const status = customerPaymentScoringAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/payment-scoring/config', async (req: Request, res: Response) => {
  try {
    const config = customerPaymentScoringAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/payment-scoring/config', async (req: Request, res: Response) => {
  try {
    customerPaymentScoringAutomation.updateConfig(req.body);
    res.json({ success: true, config: customerPaymentScoringAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/payment-scoring/high-risk', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const highRisk = await prisma.riskScore.findMany({
      where: { scoreType: 'payment_risk', riskLevel: { in: ['high', 'critical'] } },
      orderBy: { calculatedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, highRisk });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get high-risk customers' });
  }
});

router.post('/payment-scoring/score/:customerId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { customerId } = req.params;
    const result = await customerPaymentScoringAutomation.scoreCustomer(customerId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'PAYMENT_SCORING',
        entityType: 'customer',
        entityId: customerId,
        status: 'manual_score',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Scoring failed' });
  }
});

router.post('/payment-scoring/start', async (req: Request, res: Response) => {
  try {
    await customerPaymentScoringAutomation.start();
    res.json({ success: true, message: 'Payment scoring started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/payment-scoring/stop', async (req: Request, res: Response) => {
  try {
    customerPaymentScoringAutomation.stop();
    res.json({ success: true, message: 'Payment scoring stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/partner-risk/status', async (req: Request, res: Response) => {
  try {
    const status = partnerRiskMonitoringAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/partner-risk/config', async (req: Request, res: Response) => {
  try {
    const config = partnerRiskMonitoringAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/partner-risk/config', async (req: Request, res: Response) => {
  try {
    partnerRiskMonitoringAutomation.updateConfig(req.body);
    res.json({ success: true, config: partnerRiskMonitoringAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/partner-risk/at-risk', async (req: Request, res: Response) => {
  try {
    const { partnerType, limit = 50 } = req.query;
    const atRisk = await prisma.riskScore.findMany({
      where: {
        scoreType: 'partner_risk_monitor',
        riskLevel: { in: ['medium', 'high', 'critical'] },
        ...(partnerType ? { entityType: String(partnerType) } : {}),
      },
      orderBy: { score: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, atRisk });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get at-risk partners' });
  }
});

router.post('/partner-risk/monitor/:partnerType/:partnerId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { partnerType, partnerId } = req.params;
    const result = partnerType === 'driver' 
      ? await partnerRiskMonitoringAutomation.monitorDriver(partnerId)
      : await partnerRiskMonitoringAutomation.monitorRestaurant(partnerId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'PARTNER_RISK_MONITOR',
        entityType: partnerType,
        entityId: partnerId,
        status: 'manual_monitor',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Monitoring failed' });
  }
});

router.post('/partner-risk/start', async (req: Request, res: Response) => {
  try {
    await partnerRiskMonitoringAutomation.start();
    res.json({ success: true, message: 'Partner risk monitoring started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/partner-risk/stop', async (req: Request, res: Response) => {
  try {
    partnerRiskMonitoringAutomation.stop();
    res.json({ success: true, message: 'Partner risk monitoring stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

export default router;
