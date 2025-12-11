import { Router, Request, Response } from 'express';
import { sosSafetyService } from '../services/sosSafetyService';
import { routeAnomalyService } from '../services/routeAnomalyService';
import { contactMaskingService } from '../services/contactMaskingService';
import { proxyCallService } from '../services/proxyCallService';
import { deviceTrustService } from '../services/deviceTrustService';
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
import { getClientIp, AuthenticatedRequest } from '../middleware/securityMiddleware';

const router = Router();

router.post('/sos/trigger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId, foodOrderId, location, triggerReason, additionalInfo } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!location?.lat || !location?.lng) {
      return res.status(400).json({ success: false, error: 'Location required' });
    }

    const result = await sosSafetyService.triggerSOS({
      userId,
      rideId,
      foodOrderId,
      location,
      triggerReason: triggerReason || 'button_press',
      additionalInfo
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[SOS] Trigger error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger SOS' });
  }
});

router.post('/sos/:alertId/update-location', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { alertId } = req.params;
    const { locations } = req.body;

    if (!Array.isArray(locations)) {
      return res.status(400).json({ success: false, error: 'Locations array required' });
    }

    await sosSafetyService.updateGpsStream(alertId, locations);
    res.json({ success: true });
  } catch (error) {
    console.error('[SOS] Update location error:', error);
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
});

router.get('/sos/:alertId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { alertId } = req.params;
    const gpsStream = await sosSafetyService.getDecryptedGpsStream(alertId);
    res.json({ success: true, data: { gpsStream } });
  } catch (error) {
    console.error('[SOS] Get alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to get SOS alert' });
  }
});

router.get('/high-risk-zone/check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'Valid lat/lng required' });
    }

    const result = await sosSafetyService.getHighRiskZoneWarning(lat, lng);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[HighRiskZone] Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check zone' });
  }
});

router.post('/route-monitoring/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId, driverId, customerId, expectedRoute, expectedDistance, deviationThreshold } = req.body;

    if (!rideId || !expectedRoute) {
      return res.status(400).json({ success: false, error: 'rideId and expectedRoute required' });
    }

    const sessionId = await routeAnomalyService.startRouteMonitoring(
      rideId,
      driverId,
      customerId,
      expectedRoute,
      expectedDistance,
      deviationThreshold
    );

    res.json({ success: true, data: { sessionId } });
  } catch (error) {
    console.error('[RouteMonitoring] Start error:', error);
    res.status(500).json({ success: false, error: 'Failed to start monitoring' });
  }
});

router.post('/route-monitoring/:rideId/check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId } = req.params;
    const { location } = req.body;

    if (!location?.lat || !location?.lng) {
      return res.status(400).json({ success: false, error: 'Location required' });
    }

    const result = await routeAnomalyService.checkDeviation(rideId, location);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[RouteMonitoring] Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check deviation' });
  }
});

router.post('/route-monitoring/:rideId/stop', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId } = req.params;
    await routeAnomalyService.stopRouteMonitoring(rideId);
    res.json({ success: true });
  } catch (error) {
    console.error('[RouteMonitoring] Stop error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop monitoring' });
  }
});

router.get('/masked-contact/ride/:rideId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rideId } = req.params;
    const requesterId = req.user?.id || '';
    const requesterRole = req.user?.role || 'customer';

    const result = await contactMaskingService.getMaskedContactForRide(
      rideId,
      requesterId,
      requesterRole
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ContactMasking] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get masked contact' });
  }
});

router.get('/masked-contact/food-order/:orderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const requesterId = req.user?.id || '';
    const requesterRole = req.user?.role || 'customer';

    const result = await contactMaskingService.getMaskedContactForFoodOrder(
      orderId,
      requesterId,
      requesterRole
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ContactMasking] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get masked contact' });
  }
});

router.post('/proxy-call/session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { receiverId, sessionType, referenceId } = req.body;
    const callerId = req.user?.id;

    if (!callerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!receiverId || !sessionType || !referenceId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await proxyCallService.createProxySession(
      callerId,
      receiverId,
      sessionType,
      referenceId
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ProxyCall] Session error:', error);
    res.status(500).json({ success: false, error: 'Failed to create proxy session' });
  }
});

router.post('/proxy-call/session/:sessionId/end', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    await proxyCallService.endSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[ProxyCall] End session error:', error);
    res.status(500).json({ success: false, error: 'Failed to end session' });
  }
});

router.get('/devices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const devices = await deviceTrustService.getUserDevices(userId);
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('[DeviceTrust] Get devices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
});

router.post('/devices/:fingerprint/trust', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { fingerprint } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    await deviceTrustService.trustDevice(userId, fingerprint);
    res.json({ success: true });
  } catch (error) {
    console.error('[DeviceTrust] Trust device error:', error);
    res.status(500).json({ success: false, error: 'Failed to trust device' });
  }
});

router.post('/devices/:fingerprint/block', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { fingerprint } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    await deviceTrustService.blockDevice(userId, fingerprint, reason || 'User blocked');
    res.json({ success: true });
  } catch (error) {
    console.error('[DeviceTrust] Block device error:', error);
    res.status(500).json({ success: false, error: 'Failed to block device' });
  }
});

router.get('/login-history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const events = await deviceTrustService.getRecentLoginEvents(userId, limit);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('[DeviceTrust] Login history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get login history' });
  }
});

router.post('/privacy/data-export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { categories } = req.body;
    const result = await privacyComplianceService.createDataExportRequest(userId, categories);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Privacy] Export request error:', error);
    res.status(500).json({ success: false, error: 'Failed to create export request' });
  }
});

router.post('/privacy/data-deletion', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { categories } = req.body;
    const result = await privacyComplianceService.createDeletionRequest(userId, categories);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Privacy] Deletion request error:', error);
    res.status(500).json({ success: false, error: 'Failed to create deletion request' });
  }
});

router.get('/privacy/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const requests = await privacyComplianceService.getUserRequests(userId);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('[Privacy] Get requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to get requests' });
  }
});

router.get('/privacy/request/:requestId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const status = await privacyComplianceService.getRequestStatus(requestId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[Privacy] Get request status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get request status' });
  }
});

router.post('/privacy/consent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { consentType, granted, version } = req.body;
    await privacyComplianceService.recordConsent(userId, consentType, granted, version);
    res.json({ success: true });
  } catch (error) {
    console.error('[Privacy] Record consent error:', error);
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

router.post('/bot-challenge/verify', async (req: Request, res: Response) => {
  try {
    const { challengeId, response } = req.body;

    if (!challengeId) {
      return res.status(400).json({ success: false, error: 'challengeId required' });
    }

    const result = await botDefenseService.verifyChallenge(challengeId, response);
    res.json({ success: result.valid, data: result });
  } catch (error) {
    console.error('[BotDefense] Verify challenge error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify challenge' });
  }
});

export default router;
