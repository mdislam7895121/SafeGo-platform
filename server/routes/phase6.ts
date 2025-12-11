import express from 'express';
import { prisma } from '../db';
import { requireAdmin, requireRole, authenticateToken } from '../middleware/authz';
import { runSecurityAudit, getSecurityAuditSummary } from '../services/appSecurityAudit';
import { getSystemHealthSummary, getRecentAttacks, getSlowQueries, getSecurityFindings } from '../services/monitoringService';
import { runDeploymentChecks, getHealthCheckResponse, getDetailedHealthCheck } from '../services/productionPrepService';
import { getRateLimitStats } from '../middleware/safegoRateLimiter';
import { getKycAccessAuditTrail } from '../services/kycSecurityService';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json(getHealthCheckResponse());
});

router.get('/health/detailed', async (req, res) => {
  try {
    const health = await getDetailedHealthCheck();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

const requireAnyAdmin = [authenticateToken, requireRole('admin')];

router.get('/admin/system-health', requireAnyAdmin, async (req, res) => {
  try {
    const health = await getSystemHealthSummary();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/security-audit', requireAnyAdmin, async (req, res) => {
  try {
    const summary = await getSecurityAuditSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/security-audit/run', requireAnyAdmin, async (req, res) => {
  try {
    const result = await runSecurityAudit();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/security-findings', requireAnyAdmin, async (req, res) => {
  try {
    const { status, severity, limit } = req.query;
    const findings = await getSecurityFindings({
      status: status as string,
      severity: severity as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json({ findings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/admin/security-findings/:id', requireAnyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;
    const user = (req as any).user;
    
    const finding = await prisma.securityAuditFinding.update({
      where: { id },
      data: {
        status,
        resolution,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
        resolvedBy: status === 'resolved' ? user.id : undefined
      }
    });
    
    res.json({ finding });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/attack-logs', requireAnyAdmin, async (req, res) => {
  try {
    const { type, limit = '50' } = req.query;
    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    const attacks = await prisma.attackLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    res.json({ attacks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/rate-limit-stats', requireAnyAdmin, async (req, res) => {
  try {
    const stats = getRateLimitStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/slow-queries', requireAnyAdmin, async (req, res) => {
  try {
    const { limit = '50' } = req.query;
    const queries = await getSlowQueries(parseInt(limit as string));
    res.json({ queries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/deployment-checks', requireAnyAdmin, async (req, res) => {
  try {
    const result = await runDeploymentChecks();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/kyc-access-logs/:userId', requireAnyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, offset } = req.query;
    
    const result = await getKycAccessAuditTrail(userId, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/fraud-alerts', requireAnyAdmin, async (req, res) => {
  try {
    const { limit = '50' } = req.query;
    
    const alerts = await prisma.attackLog.findMany({
      where: {
        type: { in: ['gps_spoofing', 'device_anomaly', 'suspicious_pattern'] }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/metrics', requireAnyAdmin, async (req, res) => {
  try {
    const { type, name, hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string);
    const cutoff = new Date(Date.now() - hoursNum * 60 * 60 * 1000);
    
    const where: any = {
      timestamp: { gte: cutoff }
    };
    
    if (type) where.metricType = type;
    if (name) where.metricName = name;
    
    const metrics = await prisma.systemHealthMetric.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 1000
    });
    
    res.json({ metrics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
