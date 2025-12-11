import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import {
  driverFatigueAutomation,
  demandSensingAutomation,
  trafficETACorrectionAutomation,
  serverScalingAutomation,
  devOpsDeploymentAutomation,
  employeeProductivityAutomation,
  refundOptimizationAutomation,
} from '../services/automation';

const router = Router();

function getRequiredAdminId(req: AuthRequest): string {
  const adminId = req.user?.userId;
  if (!adminId) {
    throw new Error('SECURITY_VIOLATION: Admin ID missing after authentication');
  }
  return adminId;
}

router.get('/driver-fatigue/status', async (req: Request, res: Response) => {
  try {
    const status = driverFatigueAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/driver-fatigue/config', async (req: Request, res: Response) => {
  try {
    const config = driverFatigueAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/driver-fatigue/config', async (req: Request, res: Response) => {
  try {
    driverFatigueAutomation.updateConfig(req.body);
    res.json({ success: true, config: driverFatigueAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/driver-fatigue/logs', async (req: Request, res: Response) => {
  try {
    const { driverId, fatigueLevel, limit = 50 } = req.query;
    const logs = await prisma.driverFatigueLog.findMany({
      where: {
        ...(driverId ? { driverId: String(driverId) } : {}),
        ...(fatigueLevel ? { fatigueLevel: String(fatigueLevel) } : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get fatigue logs' });
  }
});

router.get('/driver-fatigue/critical', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const critical = await prisma.driverFatigueLog.findMany({
      where: { fatigueLevel: { in: ['severe', 'critical'] } },
      orderBy: { detectedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, critical });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get critical fatigue logs' });
  }
});

router.post('/driver-fatigue/check/:driverId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { driverId } = req.params;
    const result = await driverFatigueAutomation.assessDriverFatigue(driverId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'DRIVER_FATIGUE',
        entityType: 'driver',
        entityId: driverId,
        status: 'manual_check',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Check failed' });
  }
});

router.post('/driver-fatigue/start', async (req: Request, res: Response) => {
  try {
    await driverFatigueAutomation.start();
    res.json({ success: true, message: 'Driver fatigue detection started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/driver-fatigue/stop', async (req: Request, res: Response) => {
  try {
    driverFatigueAutomation.stop();
    res.json({ success: true, message: 'Driver fatigue detection stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/demand-sensing/status', async (req: Request, res: Response) => {
  try {
    const status = demandSensingAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/demand-sensing/config', async (req: Request, res: Response) => {
  try {
    const config = demandSensingAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/demand-sensing/config', async (req: Request, res: Response) => {
  try {
    demandSensingAutomation.updateConfig(req.body);
    res.json({ success: true, config: demandSensingAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/demand-sensing/signals', async (req: Request, res: Response) => {
  try {
    const { zoneId, signalType, limit = 50 } = req.query;
    const signals = await prisma.demandSignal.findMany({
      where: {
        ...(zoneId ? { zoneId: String(zoneId) } : {}),
        ...(signalType ? { signalType: String(signalType) } : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, signals });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get demand signals' });
  }
});

router.get('/demand-sensing/hot-zones', async (req: Request, res: Response) => {
  try {
    const hotZones = await demandSensingAutomation.getHotZones();
    res.json({ success: true, hotZones });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get hot zones' });
  }
});

router.post('/demand-sensing/start', async (req: Request, res: Response) => {
  try {
    await demandSensingAutomation.start();
    res.json({ success: true, message: 'Demand sensing started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/demand-sensing/stop', async (req: Request, res: Response) => {
  try {
    demandSensingAutomation.stop();
    res.json({ success: true, message: 'Demand sensing stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/traffic-eta/status', async (req: Request, res: Response) => {
  try {
    const status = trafficETACorrectionAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/traffic-eta/config', async (req: Request, res: Response) => {
  try {
    const config = trafficETACorrectionAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/traffic-eta/config', async (req: Request, res: Response) => {
  try {
    trafficETACorrectionAutomation.updateConfig(req.body);
    res.json({ success: true, config: trafficETACorrectionAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/traffic-eta/snapshots', async (req: Request, res: Response) => {
  try {
    const { zoneId, congestionLevel, limit = 50 } = req.query;
    const snapshots = await prisma.trafficSnapshot.findMany({
      where: {
        ...(zoneId ? { zoneId: String(zoneId) } : {}),
        ...(congestionLevel ? { congestionLevel: String(congestionLevel) } : {}),
      },
      orderBy: { snapshotTime: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, snapshots });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get traffic snapshots' });
  }
});

router.post('/traffic-eta/calculate', async (req: Request, res: Response) => {
  try {
    const { areaId, baseEtaMinutes, pickupLat, pickupLng } = req.body;
    const correction = await trafficETACorrectionAutomation.calculateCorrectedETA(
      areaId,
      baseEtaMinutes,
      pickupLat,
      pickupLng
    );
    res.json({ success: true, correction });
  } catch (error) {
    res.status(500).json({ success: false, error: 'ETA calculation failed' });
  }
});

router.post('/traffic-eta/start', async (req: Request, res: Response) => {
  try {
    await trafficETACorrectionAutomation.start();
    res.json({ success: true, message: 'Traffic ETA correction started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/traffic-eta/stop', async (req: Request, res: Response) => {
  try {
    trafficETACorrectionAutomation.stop();
    res.json({ success: true, message: 'Traffic ETA correction stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/server-scaling/status', async (req: Request, res: Response) => {
  try {
    const status = serverScalingAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/server-scaling/config', async (req: Request, res: Response) => {
  try {
    const config = serverScalingAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/server-scaling/config', async (req: Request, res: Response) => {
  try {
    serverScalingAutomation.updateConfig(req.body);
    res.json({ success: true, config: serverScalingAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/server-scaling/policies', async (req: Request, res: Response) => {
  try {
    const { isActive, limit = 50 } = req.query;
    const policies = await prisma.scalingPolicy.findMany({
      where: isActive !== undefined ? { isActive: isActive === 'true' } : {},
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, policies });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get scaling policies' });
  }
});

router.post('/server-scaling/start', async (req: Request, res: Response) => {
  try {
    await serverScalingAutomation.start();
    res.json({ success: true, message: 'Server scaling started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/server-scaling/stop', async (req: Request, res: Response) => {
  try {
    serverScalingAutomation.stop();
    res.json({ success: true, message: 'Server scaling stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/devops/status', async (req: Request, res: Response) => {
  try {
    const status = devOpsDeploymentAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/devops/config', async (req: Request, res: Response) => {
  try {
    const config = devOpsDeploymentAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/devops/config', async (req: Request, res: Response) => {
  try {
    devOpsDeploymentAutomation.updateConfig(req.body);
    res.json({ success: true, config: devOpsDeploymentAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/devops/deployments', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query;
    const deployments = await prisma.deploymentRun.findMany({
      where: status ? { status: String(status) } : {},
      orderBy: { startedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, deployments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get deployments' });
  }
});

router.post('/devops/deploy', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { version, environment } = req.body;
    const result = await devOpsDeploymentAutomation.triggerDeployment({
      version,
      environment,
      triggeredBy: adminId,
    });
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Deployment failed' });
  }
});

router.post('/devops/rollback/:deploymentId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { deploymentId } = req.params;
    const result = await devOpsDeploymentAutomation.executeRollback(deploymentId);
    
    await prisma.automationLog.create({
      data: {
        automationType: 'DEVOPS_DEPLOYMENT',
        entityType: 'deployment',
        entityId: deploymentId,
        status: 'rollback_initiated',
        metadata: { adminId, result },
      },
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Rollback failed' });
  }
});

router.post('/devops/start', async (req: Request, res: Response) => {
  try {
    await devOpsDeploymentAutomation.start();
    res.json({ success: true, message: 'DevOps automation started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/devops/stop', async (req: Request, res: Response) => {
  try {
    devOpsDeploymentAutomation.stop();
    res.json({ success: true, message: 'DevOps automation stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/employee-productivity/status', async (req: Request, res: Response) => {
  try {
    const status = employeeProductivityAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/employee-productivity/config', async (req: Request, res: Response) => {
  try {
    const config = employeeProductivityAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/employee-productivity/config', async (req: Request, res: Response) => {
  try {
    employeeProductivityAutomation.updateConfig(req.body);
    res.json({ success: true, config: employeeProductivityAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/employee-productivity/metrics', async (req: Request, res: Response) => {
  try {
    const { employeeId, period, limit = 50 } = req.query;
    const metrics = await prisma.employeeProductivityMetric.findMany({
      where: {
        ...(employeeId ? { employeeId: String(employeeId) } : {}),
        ...(period ? { period: String(period) } : {}),
      },
      orderBy: { measuredAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get metrics' });
  }
});

router.get('/employee-productivity/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const teamMetrics = await employeeProductivityAutomation.getTeamMetrics();
    const leaderboard = teamMetrics
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, Number(limit));
    res.json({ success: true, leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

router.post('/employee-productivity/start', async (req: Request, res: Response) => {
  try {
    await employeeProductivityAutomation.start();
    res.json({ success: true, message: 'Employee productivity tracking started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/employee-productivity/stop', async (req: Request, res: Response) => {
  try {
    employeeProductivityAutomation.stop();
    res.json({ success: true, message: 'Employee productivity tracking stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

router.get('/refund/status', async (req: Request, res: Response) => {
  try {
    const status = refundOptimizationAutomation.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

router.get('/refund/config', async (req: Request, res: Response) => {
  try {
    const config = refundOptimizationAutomation.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get config' });
  }
});

router.put('/refund/config', async (req: Request, res: Response) => {
  try {
    refundOptimizationAutomation.updateConfig(req.body);
    res.json({ success: true, config: refundOptimizationAutomation.getConfig() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.get('/refund/decisions', async (req: Request, res: Response) => {
  try {
    const { status, decisionType, limit = 50 } = req.query;
    const decisions = await prisma.refundDecision.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(decisionType ? { decisionType: String(decisionType) as any } : {}),
      },
      orderBy: { decidedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, decisions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get refund decisions' });
  }
});

router.get('/refund/pending', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const pending = await prisma.refundDecision.findMany({
      where: { status: 'pending_review' },
      orderBy: { decidedAt: 'desc' },
      take: Number(limit),
    });
    res.json({ success: true, pending });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get pending refunds' });
  }
});

router.post('/refund/analyze', async (req: Request, res: Response) => {
  try {
    const { orderId, orderType, amount, reason } = req.body;
    const decision = await refundOptimizationAutomation.analyzeRefundRequest({
      orderId,
      orderType,
      amount,
      reason,
    });
    res.json({ success: true, decision });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

router.post('/refund/approve/:decisionId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { decisionId } = req.params;
    const { notes } = req.body;
    const result = await refundOptimizationAutomation.approveRefund(decisionId, adminId, notes);
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Approval failed' });
  }
});

router.post('/refund/reject/:decisionId', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = getRequiredAdminId(req);
    const { decisionId } = req.params;
    const { reason } = req.body;
    const result = await refundOptimizationAutomation.rejectRefund(decisionId, adminId, reason);
    res.json({ success: true, result });
  } catch (error: any) {
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    res.status(500).json({ success: false, error: 'Rejection failed' });
  }
});

router.post('/refund/start', async (req: Request, res: Response) => {
  try {
    await refundOptimizationAutomation.start();
    res.json({ success: true, message: 'Refund optimization started' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

router.post('/refund/stop', async (req: Request, res: Response) => {
  try {
    refundOptimizationAutomation.stop();
    res.json({ success: true, message: 'Refund optimization stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

export default router;
