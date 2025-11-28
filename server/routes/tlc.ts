/**
 * NYC TLC HVFHV Minimum Pay API Routes
 * 
 * Provides endpoints for:
 * - Per-ride minimum pay calculation
 * - Hourly utilization guarantee tracking
 * - Weekly settlement processing
 * - TLC compliance status
 */

import { Router, Response } from 'express';
import { authenticateToken, requireRole, loadAdminProfile, AuthRequest } from '../middleware/auth';
import {
  calculatePerRideMinimumPay,
  calculateHourlyGuarantee,
  calculateWeeklyGuarantee,
  getOrCreateDriverSession,
  recordDriverRide,
  updateDriverOnlineTime,
  getDriverSession,
  processWeeklySettlement,
  getDriverWeeklySettlements,
  getDriverTLCComplianceStatus,
  resetDriverSession,
  getAllDriverSessions,
  getTLCRateInfo,
  NYC_TLC_CONFIG,
  TLCPerRideInput,
  TLCHourlyInput,
  TLCWeeklyInput,
} from '../services/tlcMinimumPayEngine';

const router = Router();

router.get('/rates', (req, res) => {
  try {
    const rateInfo = getTLCRateInfo();
    res.json({
      success: true,
      data: {
        ...rateInfo,
        config: {
          perMinuteRate: NYC_TLC_CONFIG.perMinuteRate,
          perMileRate: NYC_TLC_CONFIG.perMileRate,
          hourlyMinimumRate: NYC_TLC_CONFIG.hourlyMinimumRate,
          weeklyMinRides: NYC_TLC_CONFIG.weeklyMinRides,
          weeklyMinOnlineHours: NYC_TLC_CONFIG.weeklyMinOnlineHours,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get TLC rate info' });
  }
});

router.post('/calculate/per-ride', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const input: TLCPerRideInput = {
      tripTimeMinutes: Number(req.body.tripTimeMinutes),
      tripDistanceMiles: Number(req.body.tripDistanceMiles),
      actualDriverPayout: Number(req.body.actualDriverPayout),
    };
    
    if (isNaN(input.tripTimeMinutes) || isNaN(input.tripDistanceMiles) || isNaN(input.actualDriverPayout)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input: tripTimeMinutes, tripDistanceMiles, and actualDriverPayout are required' 
      });
    }
    
    const result = calculatePerRideMinimumPay(input);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate per-ride minimum' });
  }
});

router.post('/calculate/hourly', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const input: TLCHourlyInput = {
      driverId: req.body.driverId,
      hourStart: new Date(req.body.hourStart),
      hourEnd: new Date(req.body.hourEnd),
      totalOnlineMinutes: Number(req.body.totalOnlineMinutes),
      engagedMinutes: Number(req.body.engagedMinutes),
      totalEarnings: Number(req.body.totalEarnings),
      ridesCompleted: Number(req.body.ridesCompleted),
    };
    
    if (!input.driverId || isNaN(input.totalOnlineMinutes) || isNaN(input.engagedMinutes)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input: driverId, totalOnlineMinutes, and engagedMinutes are required' 
      });
    }
    
    const result = calculateHourlyGuarantee(input);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate hourly guarantee' });
  }
});

router.post('/calculate/weekly', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const input: TLCWeeklyInput = {
      driverId: req.body.driverId,
      weekStart: new Date(req.body.weekStart),
      weekEnd: new Date(req.body.weekEnd),
      totalOnlineHours: Number(req.body.totalOnlineHours),
      totalEngagedHours: Number(req.body.totalEngagedHours),
      totalRides: Number(req.body.totalRides),
      totalEarnings: Number(req.body.totalEarnings),
      perRideAdjustments: Number(req.body.perRideAdjustments) || 0,
      hourlyAdjustments: Number(req.body.hourlyAdjustments) || 0,
    };
    
    if (!input.driverId || isNaN(input.totalOnlineHours) || isNaN(input.totalRides)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input: driverId, totalOnlineHours, and totalRides are required' 
      });
    }
    
    const result = calculateWeeklyGuarantee(input);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate weekly guarantee' });
  }
});

router.get('/driver/current/session', authenticateToken, requireRole(['driver']), (req: AuthRequest, res: Response) => {
  try {
    const driverId = req.user!.userId;
    const session = getDriverSession(driverId);
    
    if (!session) {
      return res.json({ 
        success: true, 
        data: {
          baseEarnings: 0,
          incentives: 0,
          perRideAdjustments: 0,
          hourlyAdjustments: 0,
          weeklyAdjustment: 0,
          finalPayout: 0,
          utilizationRate: 0,
          totalOnlineHours: 0,
          totalEngagedHours: 0,
          isCompliant: true,
        },
        message: 'No active session found for driver' 
      });
    }
    
    const utilizationRate = session.totalOnlineMinutes > 0 
      ? (session.totalOnlineMinutes - session.totalWaitingMinutes) / session.totalOnlineMinutes 
      : 0;
    
    res.json({ 
      success: true, 
      data: {
        baseEarnings: session.totalEarnings,
        incentives: 0,
        perRideAdjustments: session.totalTLCAdjustments,
        hourlyAdjustments: 0,
        weeklyAdjustment: 0,
        finalPayout: session.totalEarnings + session.totalTLCAdjustments,
        utilizationRate,
        totalOnlineHours: session.totalOnlineMinutes / 60,
        totalEngagedHours: (session.totalOnlineMinutes - session.totalWaitingMinutes) / 60,
        isCompliant: true,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get driver session' });
  }
});

router.get('/driver/current/compliance', authenticateToken, requireRole(['driver']), (req: AuthRequest, res: Response) => {
  try {
    const driverId = req.user!.userId;
    const status = getDriverTLCComplianceStatus(driverId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get compliance status' });
  }
});

router.get('/driver/:driverId/session', authenticateToken, requireRole(['driver', 'admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user!.role === 'driver' && req.user!.userId !== driverId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const session = getDriverSession(driverId);
    
    if (!session) {
      return res.json({ 
        success: true, 
        data: null,
        message: 'No active session found for driver' 
      });
    }
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get driver session' });
  }
});

router.post('/driver/:driverId/session/start', authenticateToken, requireRole(['driver', 'admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user!.role === 'driver' && req.user!.userId !== driverId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const session = getOrCreateDriverSession(driverId);
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start driver session' });
  }
});

router.post('/driver/:driverId/ride', authenticateToken, requireRole(['driver', 'admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user!.role === 'driver' && req.user!.userId !== driverId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const { rideId, tripTimeMinutes, tripDistanceMiles, basePayout } = req.body;
    
    if (!rideId || isNaN(tripTimeMinutes) || isNaN(tripDistanceMiles) || isNaN(basePayout)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input: rideId, tripTimeMinutes, tripDistanceMiles, and basePayout are required' 
      });
    }
    
    const rideRecord = recordDriverRide(
      driverId,
      rideId,
      Number(tripTimeMinutes),
      Number(tripDistanceMiles),
      Number(basePayout)
    );
    
    res.json({ success: true, data: rideRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record driver ride' });
  }
});

router.post('/driver/:driverId/online-time', authenticateToken, requireRole(['driver', 'admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user!.role === 'driver' && req.user!.userId !== driverId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const { additionalOnlineMinutes, additionalWaitingMinutes } = req.body;
    
    if (isNaN(additionalOnlineMinutes)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input: additionalOnlineMinutes is required' 
      });
    }
    
    updateDriverOnlineTime(
      driverId,
      Number(additionalOnlineMinutes),
      Number(additionalWaitingMinutes) || 0
    );
    
    const session = getDriverSession(driverId);
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update online time' });
  }
});

router.post('/driver/:driverId/weekly-settlement', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const { weekStart, weekEnd } = req.body;
    
    const startDate = weekStart ? new Date(weekStart) : getWeekStart();
    const endDate = weekEnd ? new Date(weekEnd) : getWeekEnd();
    
    const settlement = processWeeklySettlement(driverId, startDate, endDate);
    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process weekly settlement' });
  }
});

router.get('/driver/:driverId/settlements', authenticateToken, requireRole(['driver', 'admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user!.role === 'driver' && req.user!.userId !== driverId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const settlements = getDriverWeeklySettlements(driverId);
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get driver settlements' });
  }
});

router.get('/driver/:driverId/compliance', authenticateToken, requireRole(['driver', 'admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user!.role === 'driver' && req.user!.userId !== driverId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const status = getDriverTLCComplianceStatus(driverId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get compliance status' });
  }
});

router.delete('/driver/:driverId/session', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    resetDriverSession(driverId);
    res.json({ success: true, message: 'Driver session reset' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset driver session' });
  }
});

router.get('/admin/sessions', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  try {
    const sessions = getAllDriverSessions();
    const sessionArray = Array.from(sessions.entries()).map(([id, session]) => ({
      sessionDriverId: id,
      ...session,
    }));
    res.json({ success: true, data: sessionArray });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get all sessions' });
  }
});

router.get('/admin/compliance-summary', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  try {
    const sessions = getAllDriverSessions();
    const summary = {
      totalActiveSessions: sessions.size,
      totalRidesTracked: 0,
      totalTLCAdjustments: 0,
      driversWithAdjustments: 0,
    };
    
    const entries = Array.from(sessions.entries());
    for (const [, session] of entries) {
      summary.totalRidesTracked += session.ridesCompleted;
      summary.totalTLCAdjustments += session.totalTLCAdjustments;
      if (session.totalTLCAdjustments > 0) {
        summary.driversWithAdjustments += 1;
      }
    }
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get compliance summary' });
  }
});

function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getWeekEnd(): Date {
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

export default router;
