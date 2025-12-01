import { Router, Response } from 'express';
import { sosSafetyService } from '../services/sosSafetyService';
import { routeAnomalyService } from '../services/routeAnomalyService';
import { admin2FAService } from '../services/admin2FAService';
import { adminIpWhitelistService } from '../services/adminIpWhitelistService';
import { adminActivityMonitor } from '../services/adminActivityMonitor';
import { developerAccessControl } from '../services/developerAccessControl';
import { payoutAuditService } from '../services/payoutAuditService';
import { botDefenseService } from '../services/botDefenseService';
import { apiFirewallService } from '../services/apiFirewallService';
import { contentModerationService } from '../services/contentModerationService';
import { privacyComplianceService } from '../services/privacyComplianceService';
import { breachResponseService } from '../services/breachResponseService';
import { deviceTrustService } from '../services/deviceTrustService';
import { AuthenticatedRequest, getClientIp } from '../middleware/securityMiddleware';

const router = Router();

router.post('/2fa/setup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;
    const email = req.user?.email;

    if (!adminId || !email) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    const result = await admin2FAService.initiate2FASetup(adminId, email);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Admin2FA] Setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to setup 2FA' });
  }
});

router.post('/2fa/verify-setup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;
    const { token } = req.body;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const success = await admin2FAService.verify2FASetup(adminId, token);
    res.json({ success });
  } catch (error) {
    console.error('[Admin2FA] Verify setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify 2FA setup' });
  }
});

router.post('/2fa/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;
    const { token } = req.body;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const result = await admin2FAService.verifyTOTP(adminId, token);
    res.json({ success: result.valid, data: result });
  } catch (error) {
    console.error('[Admin2FA] Verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify TOTP' });
  }
});

router.post('/2fa/backup-verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;
    const { code } = req.body;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    const success = await admin2FAService.verifyBackupCode(adminId, code);
    res.json({ success });
  } catch (error) {
    console.error('[Admin2FA] Backup verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify backup code' });
  }
});

router.post('/2fa/regenerate-backup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    const codes = await admin2FAService.regenerateBackupCodes(adminId);
    res.json({ success: true, data: { backupCodes: codes } });
  } catch (error) {
    console.error('[Admin2FA] Regenerate backup error:', error);
    res.status(500).json({ success: false, error: 'Failed to regenerate backup codes' });
  }
});

router.get('/2fa/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    const status = await admin2FAService.get2FAStatus(adminId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[Admin2FA] Status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get 2FA status' });
  }
});

router.post('/2fa/disable', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.adminId;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    await admin2FAService.disable2FA(adminId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin2FA] Disable error:', error);
    res.status(500).json({ success: false, error: 'Failed to disable 2FA' });
  }
});

router.get('/ip-whitelist', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entries = await adminIpWhitelistService.getWhitelist();
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('[IpWhitelist] Get error:', error);
    res.status(500).json({ success: false, error: 'Failed to get whitelist' });
  }
});

router.post('/ip-whitelist', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ipAddress, ipRange, description, allowedRoles } = req.body;
    const createdBy = req.user?.id || 'system';

    if (!ipAddress && !ipRange) {
      return res.status(400).json({ success: false, error: 'ipAddress or ipRange required' });
    }

    const id = await adminIpWhitelistService.addToWhitelist({
      ipAddress,
      ipRange,
      description,
      allowedRoles,
      createdBy
    });

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[IpWhitelist] Add error:', error);
    res.status(500).json({ success: false, error: 'Failed to add to whitelist' });
  }
});

router.patch('/ip-whitelist/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await adminIpWhitelistService.updateWhitelistEntry(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('[IpWhitelist] Update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update entry' });
  }
});

router.delete('/ip-whitelist/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await adminIpWhitelistService.removeFromWhitelist(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[IpWhitelist] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove from whitelist' });
  }
});

router.get('/ip-whitelist/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await adminIpWhitelistService.getWhitelistStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[IpWhitelist] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/activity-anomalies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { adminId, type, severity, status, limit } = req.query;

    const anomalies = await adminActivityMonitor.getActiveAnomalies({
      adminId: adminId as string,
      type: type as any,
      severity: severity as string,
      status: status as any,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({ success: true, data: anomalies });
  } catch (error) {
    console.error('[ActivityMonitor] Get anomalies error:', error);
    res.status(500).json({ success: false, error: 'Failed to get anomalies' });
  }
});

router.patch('/activity-anomalies/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const investigatedBy = req.user?.id;

    await adminActivityMonitor.updateAnomalyStatus(id, status, investigatedBy, notes);
    res.json({ success: true });
  } catch (error) {
    console.error('[ActivityMonitor] Update anomaly error:', error);
    res.status(500).json({ success: false, error: 'Failed to update anomaly' });
  }
});

router.get('/activity-anomalies/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await adminActivityMonitor.getAnomalyStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[ActivityMonitor] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/developer-policies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const policies = await developerAccessControl.getPolicies();
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('[DeveloperAccess] Get policies error:', error);
    res.status(500).json({ success: false, error: 'Failed to get policies' });
  }
});

router.post('/developer-policies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const createdBy = req.user?.id || 'system';
    const id = await developerAccessControl.addPolicy({ ...req.body, createdBy });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DeveloperAccess] Add policy error:', error);
    res.status(500).json({ success: false, error: 'Failed to add policy' });
  }
});

router.patch('/developer-policies/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await developerAccessControl.updatePolicy(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('[DeveloperAccess] Update policy error:', error);
    res.status(500).json({ success: false, error: 'Failed to update policy' });
  }
});

router.delete('/developer-policies/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await developerAccessControl.removePolicy(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[DeveloperAccess] Delete policy error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete policy' });
  }
});

router.post('/developer-policies/initialize-defaults', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await developerAccessControl.initializeDefaultPolicies();
    res.json({ success: true });
  } catch (error) {
    console.error('[DeveloperAccess] Initialize defaults error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize defaults' });
  }
});

router.get('/payout-audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { adminId, targetUserId, targetUserType, actionType, startDate, endDate, minAmount, maxAmount, limit, offset } = req.query;

    const result = await payoutAuditService.getPayoutHistory({
      adminId: adminId as string,
      targetUserId: targetUserId as string,
      targetUserType: targetUserType as 'driver' | 'restaurant',
      actionType: actionType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[PayoutAudit] Get history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payout history' });
  }
});

router.get('/payout-audit/verify-chain', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await payoutAuditService.verifyChainIntegrity(limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[PayoutAudit] Verify chain error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify chain' });
  }
});

router.get('/payout-audit/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await payoutAuditService.getPayoutStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[PayoutAudit] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/payout-audit/large-payouts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const threshold = parseFloat(req.query.threshold as string) || 10000;
    const limit = parseInt(req.query.limit as string) || 20;

    const payouts = await payoutAuditService.getLargePayouts(threshold, limit);
    res.json({ success: true, data: payouts });
  } catch (error) {
    console.error('[PayoutAudit] Large payouts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get large payouts' });
  }
});

router.get('/sos-alerts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { escalationLevel, highRiskZone, limit } = req.query;

    const alerts = await sosSafetyService.getActiveAlerts({
      escalationLevel: escalationLevel as any,
      highRiskZone: highRiskZone === 'true',
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('[SOS] Get alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get SOS alerts' });
  }
});

router.post('/sos-alerts/:alertId/escalate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { alertId } = req.params;
    const { toLevel, reason } = req.body;
    const escalatedBy = req.user?.id || 'admin';

    await sosSafetyService.escalateSOS(alertId, toLevel, escalatedBy, reason);
    res.json({ success: true });
  } catch (error) {
    console.error('[SOS] Escalate error:', error);
    res.status(500).json({ success: false, error: 'Failed to escalate SOS' });
  }
});

router.post('/sos-alerts/:alertId/resolve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { alertId } = req.params;
    const { responseNotes, status } = req.body;
    const respondedBy = req.user?.id || 'admin';

    await sosSafetyService.resolveSOS(alertId, respondedBy, responseNotes, status);
    res.json({ success: true });
  } catch (error) {
    console.error('[SOS] Resolve error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve SOS' });
  }
});

router.post('/high-risk-zones', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const createdBy = req.user?.id || 'admin';
    const id = await sosSafetyService.createHighRiskZone({ ...req.body, createdBy });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[HighRiskZone] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create high-risk zone' });
  }
});

router.get('/route-monitoring/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId, hasDeviations, limit } = req.query;

    const sessions = await routeAnomalyService.getActiveMonitoringSessions({
      driverId: driverId as string,
      hasDeviations: hasDeviations === 'true',
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[RouteMonitoring] Get sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

router.get('/route-monitoring/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await routeAnomalyService.getDeviationStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[RouteMonitoring] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/rate-limit-rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await apiFirewallService.getRateLimitRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('[ApiFirewall] Get rules error:', error);
    res.status(500).json({ success: false, error: 'Failed to get rules' });
  }
});

router.post('/rate-limit-rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const createdBy = req.user?.id || 'admin';
    const id = await apiFirewallService.addRateLimitRule({ ...req.body, createdBy });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[ApiFirewall] Add rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to add rule' });
  }
});

router.patch('/rate-limit-rules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await apiFirewallService.updateRateLimitRule(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('[ApiFirewall] Update rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to update rule' });
  }
});

router.delete('/rate-limit-rules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await apiFirewallService.removeRateLimitRule(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[ApiFirewall] Delete rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete rule' });
  }
});

router.get('/firewall/blocked-ips', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ips = await apiFirewallService.getBlockedIps();
    res.json({ success: true, data: ips });
  } catch (error) {
    console.error('[ApiFirewall] Get blocked IPs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get blocked IPs' });
  }
});

router.post('/firewall/block-ip', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ipAddress, reason } = req.body;
    await apiFirewallService.blockIp(ipAddress, reason);
    res.json({ success: true });
  } catch (error) {
    console.error('[ApiFirewall] Block IP error:', error);
    res.status(500).json({ success: false, error: 'Failed to block IP' });
  }
});

router.post('/firewall/unblock-ip', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ipAddress } = req.body;
    await apiFirewallService.unblockIp(ipAddress);
    res.json({ success: true });
  } catch (error) {
    console.error('[ApiFirewall] Unblock IP error:', error);
    res.status(500).json({ success: false, error: 'Failed to unblock IP' });
  }
});

router.get('/firewall/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await apiFirewallService.getFirewallStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[ApiFirewall] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/bot-defense/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await botDefenseService.getChallengeStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[BotDefense] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/content-moderation/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contentType, flagType, severity, limit } = req.query;

    const flags = await contentModerationService.getPendingModerations({
      contentType: contentType as string,
      flagType: flagType as any,
      severity: severity as string,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({ success: true, data: flags });
  } catch (error) {
    console.error('[ContentModeration] Get pending error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending moderations' });
  }
});

router.post('/content-moderation/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body;
    const reviewedBy = req.user?.id || 'admin';

    await contentModerationService.reviewModeration(id, reviewedBy, decision, notes);
    res.json({ success: true });
  } catch (error) {
    console.error('[ContentModeration] Review error:', error);
    res.status(500).json({ success: false, error: 'Failed to review moderation' });
  }
});

router.get('/content-moderation/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await contentModerationService.getModerationStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[ContentModeration] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/privacy/pending-requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await privacyComplianceService.getPendingRequests();
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('[Privacy] Get pending requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending requests' });
  }
});

router.post('/privacy/process-export/:requestId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const result = await privacyComplianceService.processDataExport(requestId);
    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('[Privacy] Process export error:', error);
    res.status(500).json({ success: false, error: 'Failed to process export' });
  }
});

router.post('/privacy/process-deletion/:requestId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const result = await privacyComplianceService.processDeletionRequest(requestId);
    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('[Privacy] Process deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to process deletion' });
  }
});

router.get('/privacy/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await privacyComplianceService.getComplianceStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Privacy] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/breach-incidents', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const incidents = await breachResponseService.getActiveIncidents();
    res.json({ success: true, data: incidents });
  } catch (error) {
    console.error('[Breach] Get incidents error:', error);
    res.status(500).json({ success: false, error: 'Failed to get incidents' });
  }
});

router.get('/breach-incidents/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const incident = await breachResponseService.getIncidentDetails(id);
    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('[Breach] Get incident error:', error);
    res.status(500).json({ success: false, error: 'Failed to get incident' });
  }
});

router.post('/breach-incidents/:id/contain', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, affectedResources } = req.body;
    const appliedBy = req.user?.id || 'admin';

    const result = await breachResponseService.applyContainment(id, action, appliedBy, affectedResources);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Breach] Apply containment error:', error);
    res.status(500).json({ success: false, error: 'Failed to apply containment' });
  }
});

router.patch('/breach-incidents/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const updatedBy = req.user?.id || 'admin';

    await breachResponseService.updateIncidentStatus(id, status, updatedBy, notes);
    res.json({ success: true });
  } catch (error) {
    console.error('[Breach] Update status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

router.get('/breach-incidents/:id/report', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = await breachResponseService.generateIncidentReport(id);
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('[Breach] Generate report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.post('/breach-incidents/:incidentId/containments/:containmentId/rollback', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { containmentId } = req.params;
    const rolledBackBy = req.user?.id || 'admin';

    await breachResponseService.rollbackContainment(containmentId, rolledBackBy);
    res.json({ success: true });
  } catch (error) {
    console.error('[Breach] Rollback containment error:', error);
    res.status(500).json({ success: false, error: 'Failed to rollback containment' });
  }
});

router.get('/breach/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = new Date(req.query.endDate as string || Date.now());

    const stats = await breachResponseService.getBreachStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Breach] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/high-risk-devices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const devices = await deviceTrustService.getHighRiskDevices(limit);
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('[DeviceTrust] High risk devices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get high-risk devices' });
  }
});

export default router;
