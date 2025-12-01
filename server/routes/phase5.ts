import { Router, type Request, type Response } from 'express';
import { prisma } from '../db';
import { navigationService } from '../services/navigationService';
import { safetyService } from '../services/safetyService';
import { notificationScheduler } from '../services/notificationScheduler';
import { incentiveEngine } from '../services/incentiveEngine';
import { routingOptimizationEngine } from '../services/routingOptimizationEngine';
import { etaRefinementService } from '../services/etaRefinementService';
import { z } from 'zod';

const router = Router();

const StartNavigationSchema = z.object({
  tripType: z.enum(['ride', 'food', 'parcel']),
  tripId: z.string().uuid(),
  originLat: z.number(),
  originLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
  provider: z.enum(['openrouteservice', 'mapbox', 'google_maps', 'internal']).optional(),
});

const UpdatePositionSchema = z.object({
  currentLat: z.number(),
  currentLng: z.number(),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

const SOSTriggerSchema = z.object({
  tripType: z.string(),
  tripId: z.string().uuid(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
});

const ResolveEventSchema = z.object({
  resolutionNotes: z.string(),
  isFalseAlarm: z.boolean().optional(),
});

const NotificationPrefsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  rideUpdatesEnabled: z.boolean().optional(),
  foodUpdatesEnabled: z.boolean().optional(),
  parcelUpdatesEnabled: z.boolean().optional(),
  promotionsEnabled: z.boolean().optional(),
  earningsEnabled: z.boolean().optional(),
  safetyAlertsEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  minIntervalMinutes: z.number().optional(),
});

const RoutingConfigSchema = z.object({
  provider: z.enum(['openrouteservice', 'mapbox', 'google_maps', 'internal']).optional(),
  distanceWeight: z.number().min(0).max(100).optional(),
  timeWeight: z.number().min(0).max(100).optional(),
  trafficWeight: z.number().min(0).max(100).optional(),
  safetyWeight: z.number().min(0).max(100).optional(),
  maxRerouteAttempts: z.number().optional(),
  rerouteTriggerMeters: z.number().optional(),
  updateIntervalSeconds: z.number().optional(),
  tollAvoidance: z.boolean().optional(),
  highwayPreference: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.post('/driver/navigation/start', async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user?.driverProfileId;
    if (!driverId) {
      res.status(401).json({ message: 'Driver authentication required' });
      return;
    }

    const parsed = StartNavigationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      return;
    }

    const { tripType, tripId, originLat, originLng, destLat, destLng, provider } = parsed.data;

    const session = await navigationService.startNavigation(
      driverId,
      tripType,
      tripId,
      originLat,
      originLng,
      destLat,
      destLng,
      provider
    );

    res.json(session);
  } catch (error) {
    console.error('[Phase5] Start navigation error:', error);
    res.status(500).json({ message: 'Failed to start navigation' });
  }
});

router.get('/driver/navigation/active', async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user?.driverProfileId;
    if (!driverId) {
      res.status(401).json({ message: 'Driver authentication required' });
      return;
    }

    const session = await navigationService.getActiveSession(driverId);
    res.json(session);
  } catch (error) {
    console.error('[Phase5] Get active navigation error:', error);
    res.status(500).json({ message: 'Failed to get active navigation' });
  }
});

router.post('/driver/navigation/:sessionId/update', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const parsed = UpdatePositionSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      return;
    }

    const session = await navigationService.updateDriverPosition(sessionId, parsed.data);
    if (!session) {
      res.status(404).json({ message: 'Navigation session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('[Phase5] Update navigation error:', error);
    res.status(500).json({ message: 'Failed to update navigation' });
  }
});

router.post('/driver/navigation/:sessionId/reroute', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await navigationService.reroute(sessionId);
    
    if (!session) {
      res.status(404).json({ message: 'Navigation session not found or not active' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('[Phase5] Reroute error:', error);
    res.status(500).json({ message: 'Failed to reroute' });
  }
});

router.post('/driver/navigation/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await navigationService.completeNavigation(sessionId);
    
    if (!session) {
      res.status(404).json({ message: 'Navigation session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('[Phase5] Complete navigation error:', error);
    res.status(500).json({ message: 'Failed to complete navigation' });
  }
});

router.post('/customer/safety/sos', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.customerProfileId;
    if (!customerId) {
      res.status(401).json({ message: 'Customer authentication required' });
      return;
    }

    const parsed = SOSTriggerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      return;
    }

    const event = await safetyService.triggerSOS({
      ...parsed.data,
      customerId,
    });

    res.json(event);
  } catch (error) {
    console.error('[Phase5] SOS trigger error:', error);
    res.status(500).json({ message: 'Failed to trigger SOS' });
  }
});

router.post('/customer/safety/check-in', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.customerProfileId;
    if (!customerId) {
      res.status(401).json({ message: 'Customer authentication required' });
      return;
    }

    const { tripType, tripId, status } = req.body;
    if (!['ok', 'need_help'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const event = await safetyService.safetyCheckIn(customerId, tripType, tripId, status);
    res.json(event);
  } catch (error) {
    console.error('[Phase5] Safety check-in error:', error);
    res.status(500).json({ message: 'Failed to process check-in' });
  }
});

router.get('/customer/safety/events', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.customerProfileId;
    if (!customerId) {
      res.status(401).json({ message: 'Customer authentication required' });
      return;
    }

    const events = await safetyService.getActiveEvents({ customerId });
    res.json(events);
  } catch (error) {
    console.error('[Phase5] Get safety events error:', error);
    res.status(500).json({ message: 'Failed to get safety events' });
  }
});

router.get('/admin/safety/events', async (req: Request, res: Response) => {
  try {
    const { status, eventType, limit, offset } = req.query;
    
    const events = await safetyService.getActiveEvents({
      status: status as any,
      eventType: eventType as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(events);
  } catch (error) {
    console.error('[Phase5] Admin get safety events error:', error);
    res.status(500).json({ message: 'Failed to get safety events' });
  }
});

router.post('/admin/safety/events/:eventId/acknowledge', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.adminId || 'system';
    const { eventId } = req.params;

    const event = await safetyService.acknowledgeEvent(eventId, adminId);
    if (!event) {
      res.status(404).json({ message: 'Event not found or not active' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('[Phase5] Acknowledge event error:', error);
    res.status(500).json({ message: 'Failed to acknowledge event' });
  }
});

router.post('/admin/safety/events/:eventId/resolve', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.adminId || 'system';
    const { eventId } = req.params;
    
    const parsed = ResolveEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      return;
    }

    const event = await safetyService.resolveEvent(
      eventId,
      adminId,
      parsed.data.resolutionNotes,
      parsed.data.isFalseAlarm
    );

    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('[Phase5] Resolve event error:', error);
    res.status(500).json({ message: 'Failed to resolve event' });
  }
});

router.post('/admin/safety/events/:eventId/escalate', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await safetyService.escalateEvent(eventId);

    if (!event) {
      res.status(404).json({ message: 'Event not found or already resolved' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('[Phase5] Escalate event error:', error);
    res.status(500).json({ message: 'Failed to escalate event' });
  }
});

router.get('/admin/safety/stats', async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate } = req.query;
    const from = fromDate ? new Date(fromDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate as string) : new Date();

    const stats = await safetyService.getSafetyStats(from, to);
    res.json(stats);
  } catch (error) {
    console.error('[Phase5] Get safety stats error:', error);
    res.status(500).json({ message: 'Failed to get safety stats' });
  }
});

router.get('/notifications/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.customerProfileId || (req as any).user?.driverProfileId;
    const userType = (req as any).user?.customerProfileId ? 'customer' : 'driver';

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const prefs = await notificationScheduler.getUserPreferences(userId, userType);
    res.json(prefs || { userId, userType });
  } catch (error) {
    console.error('[Phase5] Get notification preferences error:', error);
    res.status(500).json({ message: 'Failed to get notification preferences' });
  }
});

router.put('/notifications/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.customerProfileId || (req as any).user?.driverProfileId;
    const userType = (req as any).user?.customerProfileId ? 'customer' : 'driver';

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const parsed = NotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      return;
    }

    const prefs = await notificationScheduler.updateUserPreferences(userId, userType, parsed.data);
    res.json(prefs);
  } catch (error) {
    console.error('[Phase5] Update notification preferences error:', error);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
});

router.get('/admin/routing/config/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const { cityCode } = req.query;

    const config = await routingOptimizationEngine.getOrCreateConfig(countryCode, cityCode as string);
    res.json(config);
  } catch (error) {
    console.error('[Phase5] Get routing config error:', error);
    res.status(500).json({ message: 'Failed to get routing config' });
  }
});

router.put('/admin/routing/config/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const { cityCode } = req.query;

    const parsed = RoutingConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      return;
    }

    const config = await routingOptimizationEngine.updateConfig(
      countryCode,
      (cityCode as string) || null,
      parsed.data
    );
    res.json(config);
  } catch (error) {
    console.error('[Phase5] Update routing config error:', error);
    res.status(500).json({ message: 'Failed to update routing config' });
  }
});

router.post('/routing/optimize', async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user?.driverProfileId;
    if (!driverId) {
      res.status(401).json({ message: 'Driver authentication required' });
      return;
    }

    const { tripType, tripId, originLat, originLng, destLat, destLng, trafficLevel, weatherCondition } = req.body;

    const result = await routingOptimizationEngine.optimizeRoute(
      tripType,
      tripId,
      driverId,
      originLat,
      originLng,
      destLat,
      destLng,
      { trafficLevel, weatherCondition }
    );

    res.json(result);
  } catch (error) {
    console.error('[Phase5] Route optimization error:', error);
    res.status(500).json({ message: 'Failed to optimize route' });
  }
});

router.get('/eta/refined', async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user?.driverProfileId;
    if (!driverId) {
      res.status(401).json({ message: 'Driver authentication required' });
      return;
    }

    const { currentLat, currentLng, destLat, destLng, trafficLevel } = req.query;

    const eta = await etaRefinementService.getRefinedETA(
      driverId,
      parseFloat(currentLat as string),
      parseFloat(currentLng as string),
      parseFloat(destLat as string),
      parseFloat(destLng as string),
      trafficLevel ? parseInt(trafficLevel as string) : undefined
    );

    res.json(eta);
  } catch (error) {
    console.error('[Phase5] Get refined ETA error:', error);
    res.status(500).json({ message: 'Failed to get refined ETA' });
  }
});

router.get('/driver/eta/stats', async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user?.driverProfileId;
    if (!driverId) {
      res.status(401).json({ message: 'Driver authentication required' });
      return;
    }

    const stats = await etaRefinementService.getDriverStats(driverId);
    res.json(stats || { message: 'No ETA profile found' });
  } catch (error) {
    console.error('[Phase5] Get driver ETA stats error:', error);
    res.status(500).json({ message: 'Failed to get ETA stats' });
  }
});

router.get('/admin/incentives/recommendations', async (req: Request, res: Response) => {
  try {
    const { countryCode, limit } = req.query;

    const recommendations = await incentiveEngine.getPendingRecommendations(
      countryCode as string,
      limit ? parseInt(limit as string) : undefined
    );

    res.json(recommendations);
  } catch (error) {
    console.error('[Phase5] Get recommendations error:', error);
    res.status(500).json({ message: 'Failed to get recommendations' });
  }
});

router.post('/admin/incentives/generate', async (req: Request, res: Response) => {
  try {
    const { countryCode, cityCode } = req.body;
    if (!countryCode) {
      res.status(400).json({ message: 'countryCode is required' });
      return;
    }

    const recommendations = await incentiveEngine.generateRecommendations(countryCode, cityCode);
    res.json(recommendations);
  } catch (error) {
    console.error('[Phase5] Generate recommendations error:', error);
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
});

router.post('/admin/incentives/:recommendationId/approve', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.adminId || 'system';
    const { recommendationId } = req.params;
    const { notes } = req.body;

    const recommendation = await incentiveEngine.approveRecommendation(recommendationId, adminId, notes);
    if (!recommendation) {
      res.status(404).json({ message: 'Recommendation not found or not pending' });
      return;
    }

    res.json(recommendation);
  } catch (error) {
    console.error('[Phase5] Approve recommendation error:', error);
    res.status(500).json({ message: 'Failed to approve recommendation' });
  }
});

router.post('/admin/incentives/:recommendationId/activate', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.adminId || 'system';
    const { recommendationId } = req.params;

    const recommendation = await incentiveEngine.activateRecommendation(recommendationId, adminId);
    if (!recommendation) {
      res.status(404).json({ message: 'Recommendation not found or not in valid state' });
      return;
    }

    res.json(recommendation);
  } catch (error) {
    console.error('[Phase5] Activate recommendation error:', error);
    res.status(500).json({ message: 'Failed to activate recommendation' });
  }
});

router.post('/admin/incentives/:recommendationId/reject', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.adminId || 'system';
    const { recommendationId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ message: 'Rejection reason is required' });
      return;
    }

    const recommendation = await incentiveEngine.rejectRecommendation(recommendationId, adminId, reason);
    res.json(recommendation);
  } catch (error) {
    console.error('[Phase5] Reject recommendation error:', error);
    res.status(500).json({ message: 'Failed to reject recommendation' });
  }
});

router.get('/admin/incentives/stats/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const { days } = req.query;

    const stats = await incentiveEngine.getRecommendationStats(
      countryCode,
      days ? parseInt(days as string) : undefined
    );

    res.json(stats);
  } catch (error) {
    console.error('[Phase5] Get incentive stats error:', error);
    res.status(500).json({ message: 'Failed to get incentive stats' });
  }
});

router.get('/admin/drivers/top-performers/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const { limit, days } = req.query;

    const drivers = await incentiveEngine.getTopPerformingDrivers(
      countryCode,
      limit ? parseInt(limit as string) : undefined,
      days ? parseInt(days as string) : undefined
    );

    res.json(drivers);
  } catch (error) {
    console.error('[Phase5] Get top performers error:', error);
    res.status(500).json({ message: 'Failed to get top performers' });
  }
});

router.get('/driver/performance', async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user?.driverProfileId;
    if (!driverId) {
      res.status(401).json({ message: 'Driver authentication required' });
      return;
    }

    const { days } = req.query;
    const performance = await incentiveEngine.analyzeDriverPerformance(
      driverId,
      days ? parseInt(days as string) : undefined
    );

    res.json(performance || { message: 'No performance data found' });
  } catch (error) {
    console.error('[Phase5] Get driver performance error:', error);
    res.status(500).json({ message: 'Failed to get driver performance' });
  }
});

export default router;
