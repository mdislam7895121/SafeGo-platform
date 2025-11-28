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
import {
  generateTripRecordReport,
  generateDriverPayReport,
  generateHVFHVSummaryReport,
  generateOutOfTownReport,
  generateAccessibilityReport,
  generateAirportActivityReport,
  exportReport,
  validateTripRecord,
  validateDriverPayReport,
  TLCReportFilters,
  BoroughCode,
  TripCategory,
  AirportCode,
} from '../services/tlcReportGenerator';
import {
  auditTrip,
  auditTrips,
  auditFareConsistency,
  auditDriverPayConsistency,
  auditLocationAccuracy,
  auditTimeDistanceIntegrity,
  auditTLCFees,
  auditAirportFee,
  auditTolls,
  autoReconcile,
  reconcileTrip,
  exportAuditResults,
  generateAuditLogEntry,
  AuditFilters,
  AuditCategory,
  AuditSeverity,
} from '../services/tlcAuditEngine';
import type { TripRecordReport } from '../services/tlcReportGenerator';

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

function parseReportFilters(query: Record<string, unknown>): TLCReportFilters {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    startDate: query.startDate ? new Date(query.startDate as string) : thirtyDaysAgo,
    endDate: query.endDate ? new Date(query.endDate as string) : now,
    driverId: query.driverId as string | undefined,
    borough: query.borough as BoroughCode | undefined,
    tripType: query.tripType as TripCategory | undefined,
    airportCode: query.airportCode as AirportCode | undefined,
    minFare: query.minFare ? Number(query.minFare) : undefined,
    maxFare: query.maxFare ? Number(query.maxFare) : undefined,
  };
}

router.get('/reports/trip-records', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const report = await generateTripRecordReport(filters);
    
    res.json({ 
      success: true, 
      data: report,
      meta: {
        totalRecords: report.length,
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
        generatedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('TLC Trip Record Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip record report' });
  }
});

router.get('/reports/driver-pay', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const report = await generateDriverPayReport(filters);
    
    const validated = report.map(r => ({
      ...r,
      validation: validateDriverPayReport(r),
    }));
    
    res.json({ 
      success: true, 
      data: validated,
      meta: {
        totalDrivers: report.length,
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
        generatedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('TLC Driver Pay Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate driver pay report' });
  }
});

router.get('/reports/hvfhv-summary', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const report = await generateHVFHVSummaryReport(filters);
    
    res.json({ 
      success: true, 
      data: report,
      meta: {
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
        generatedAt: report.reportGeneratedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('TLC HVFHV Summary Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate HVFHV summary report' });
  }
});

router.get('/reports/out-of-town', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const report = await generateOutOfTownReport(filters);
    
    res.json({ 
      success: true, 
      data: report,
      meta: {
        totalTrips: report.trips.length,
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
        generatedAt: report.reportGeneratedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('TLC Out-of-Town Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate out-of-town report' });
  }
});

router.get('/reports/accessibility', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const report = await generateAccessibilityReport(filters);
    
    res.json({ 
      success: true, 
      data: report,
      meta: {
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
        generatedAt: report.reportGeneratedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('TLC Accessibility Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate accessibility report' });
  }
});

router.get('/reports/airport-activity', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const report = await generateAirportActivityReport(filters);
    
    res.json({ 
      success: true, 
      data: report,
      meta: {
        totalAirportTrips: report.summary.totalAirportTrips,
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
        generatedAt: report.reportGeneratedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('TLC Airport Activity Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate airport activity report' });
  }
});

router.get('/reports/export/:reportType', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { reportType } = req.params;
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    
    const validTypes = ['TRR', 'DPR', 'HSR', 'OUT_OF_TOWN', 'ACCESSIBILITY', 'AIRPORT'];
    if (!validTypes.includes(reportType.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid report type. Valid types: ${validTypes.join(', ')}` 
      });
    }
    
    const exportResult = await exportReport(
      reportType.toUpperCase() as 'TRR' | 'DPR' | 'HSR' | 'OUT_OF_TOWN' | 'ACCESSIBILITY' | 'AIRPORT',
      format,
      filters
    );
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.send(exportResult.data);
    } else {
      res.json({ 
        success: true, 
        data: exportResult.data,
        meta: {
          filename: exportResult.filename,
          recordCount: exportResult.recordCount,
          generatedAt: exportResult.generatedAt.toISOString(),
        }
      });
    }
  } catch (error) {
    console.error('TLC Report Export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export report' });
  }
});

router.get('/reports/available', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      reports: [
        {
          id: 'TRR',
          name: 'Trip Record Report',
          description: 'Individual trip records with all TLC-required fields',
          exportFormats: ['json', 'csv'],
        },
        {
          id: 'DPR',
          name: 'Driver Pay Report',
          description: 'Driver earnings with TLC minimum pay adjustments',
          exportFormats: ['json', 'csv'],
        },
        {
          id: 'HSR',
          name: 'HVFHV Summary Report',
          description: 'Aggregated monthly summary for TLC submission',
          exportFormats: ['json', 'csv'],
        },
        {
          id: 'OUT_OF_TOWN',
          name: 'Out-of-Town Trips Report',
          description: 'NYC to Out-of-State and return fee tracking',
          exportFormats: ['json', 'csv'],
        },
        {
          id: 'ACCESSIBILITY',
          name: 'Accessibility Report',
          description: 'AVF collection and accessible vehicle metrics',
          exportFormats: ['json', 'csv'],
        },
        {
          id: 'AIRPORT',
          name: 'Airport Activity Report',
          description: 'Airport pickup/dropoff activity and fees',
          exportFormats: ['json', 'csv'],
        },
      ],
      filters: {
        startDate: 'ISO date string (default: 30 days ago)',
        endDate: 'ISO date string (default: now)',
        driverId: 'Filter by specific driver',
        borough: 'MANHATTAN | BROOKLYN | QUEENS | BRONX | STATEN_ISLAND | OUT_OF_NYC',
        tripType: 'NYC_TO_NYC | NYC_TO_OOS | OOS_TO_NYC | AIRPORT_PICKUP | AIRPORT_DROPOFF | MANHATTAN_CONGESTION | LONG_TRIP',
        airportCode: 'JFK | LGA | EWR | WCY',
        minFare: 'Minimum fare amount',
        maxFare: 'Maximum fare amount',
      },
    },
  });
});

router.post('/reports/validate-trip', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body;
    const validation = validateTripRecord(tripData);
    
    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('TLC Trip Validation error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate trip record' });
  }
});

// ============================================
// TLC Audit & Reconciliation Routes
// ============================================

function parseAuditFilters(query: Record<string, unknown>): AuditFilters {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    startDate: query.startDate ? new Date(query.startDate as string) : thirtyDaysAgo,
    endDate: query.endDate ? new Date(query.endDate as string) : now,
    driverId: query.driverId as string | undefined,
    tripId: query.tripId as string | undefined,
    category: query.category as AuditCategory | undefined,
    severity: query.severity as AuditSeverity | undefined,
    onlyWithFindings: query.onlyWithFindings === 'true',
  };
}

router.post('/audit/trip', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body as TripRecordReport;
    
    if (!tripData.tripId || !tripData.driverId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tripId and driverId are required' 
      });
    }
    
    const auditResult = auditTrip(tripData);
    
    res.json({
      success: true,
      data: auditResult,
      meta: {
        tripId: tripData.tripId,
        overallStatus: auditResult.overallStatus,
        findingsCount: auditResult.findings.length,
        autoFixApplied: auditResult.autoFixApplied,
      },
    });
  } catch (error) {
    console.error('TLC Trip Audit error:', error);
    res.status(500).json({ success: false, error: 'Failed to audit trip' });
  }
});

router.post('/audit/batch', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { trips } = req.body as { trips: TripRecordReport[] };
    const filters = parseAuditFilters(req.query as Record<string, unknown>);
    
    if (!trips || !Array.isArray(trips) || trips.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'trips array is required and must not be empty' 
      });
    }
    
    const { results, summary } = await auditTrips(trips, filters);
    
    res.json({
      success: true,
      data: { results, summary },
      meta: {
        totalTripsAudited: summary.totalTripsAudited,
        totalFindings: summary.totalFindingsCount,
        auditScore: summary.auditScore,
        timestamp: summary.auditTimestamp.toISOString(),
      },
    });
  } catch (error) {
    console.error('TLC Batch Audit error:', error);
    res.status(500).json({ success: false, error: 'Failed to run batch audit' });
  }
});

router.post('/audit/reconcile', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { trips } = req.body as { trips: TripRecordReport[] };
    
    if (!trips || !Array.isArray(trips) || trips.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'trips array is required and must not be empty' 
      });
    }
    
    const { reconciliations, summary } = await autoReconcile(trips);
    
    const successCount = reconciliations.filter(r => r.success).length;
    const reviewCount = reconciliations.filter(r => r.requiresManualReview).length;
    
    const auditLog = generateAuditLogEntry(
      'BATCH_RECONCILE',
      `batch_${Date.now()}`,
      { 
        tripsProcessed: trips.length,
        successCount,
        reviewCount,
        autoFixedCount: summary.autoFixedCount,
      },
      req.user?.userId || 'system'
    );
    
    res.json({
      success: true,
      data: { reconciliations, summary, auditLog },
      meta: {
        tripsProcessed: trips.length,
        successfulReconciliations: successCount,
        requiresReview: reviewCount,
        autoFixesApplied: summary.autoFixedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('TLC Reconciliation error:', error);
    res.status(500).json({ success: false, error: 'Failed to reconcile trips' });
  }
});

router.post('/audit/fare-check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body as TripRecordReport;
    
    if (!tripData.tripId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tripId is required' 
      });
    }
    
    const fareResult = auditFareConsistency(tripData);
    
    res.json({
      success: true,
      data: fareResult,
      meta: {
        tripId: tripData.tripId,
        isValid: fareResult.isValid,
        variance: fareResult.variance,
      },
    });
  } catch (error) {
    console.error('TLC Fare Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check fare consistency' });
  }
});

router.post('/audit/driver-pay-check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body as TripRecordReport;
    
    if (!tripData.tripId || !tripData.driverId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tripId and driverId are required' 
      });
    }
    
    const payResult = auditDriverPayConsistency(tripData);
    
    res.json({
      success: true,
      data: payResult,
      meta: {
        tripId: tripData.tripId,
        driverId: tripData.driverId,
        isValid: payResult.isValid,
        meetsMinimum: payResult.tlcMinimumCheck.meetsMinimum,
        adjustmentRequired: payResult.tlcMinimumCheck.adjustmentRequired,
      },
    });
  } catch (error) {
    console.error('TLC Driver Pay Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check driver pay consistency' });
  }
});

router.post('/audit/location-check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body as TripRecordReport;
    
    if (!tripData.tripId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tripId is required' 
      });
    }
    
    const locationResult = auditLocationAccuracy(tripData);
    
    res.json({
      success: true,
      data: locationResult,
      meta: {
        tripId: tripData.tripId,
        isValid: locationResult.isValid,
        computedPickup: locationResult.computedPickupBorough,
        computedDropoff: locationResult.computedDropoffBorough,
      },
    });
  } catch (error) {
    console.error('TLC Location Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check location accuracy' });
  }
});

router.post('/audit/time-distance-check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body as TripRecordReport;
    
    if (!tripData.tripId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tripId is required' 
      });
    }
    
    const timeDistanceResult = auditTimeDistanceIntegrity(tripData);
    
    res.json({
      success: true,
      data: timeDistanceResult,
      meta: {
        tripId: tripData.tripId,
        isValid: timeDistanceResult.isValid,
        speedMph: timeDistanceResult.speedMph,
        isRealisticSpeed: timeDistanceResult.isRealisticSpeed,
      },
    });
  } catch (error) {
    console.error('TLC Time/Distance Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check time/distance integrity' });
  }
});

router.post('/audit/tlc-fees-check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tripData = req.body as TripRecordReport;
    
    if (!tripData.tripId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tripId is required' 
      });
    }
    
    const feeFindings = auditTLCFees(tripData);
    const airportFindings = auditAirportFee(tripData);
    const tollFindings = auditTolls(tripData);
    
    const allFindings = [...feeFindings, ...airportFindings, ...tollFindings];
    
    res.json({
      success: true,
      data: {
        findings: allFindings,
        feeBreakdown: {
          avf: { expected: 0.125, actual: tripData.avfFee },
          bcf: { expected: 0.625, actual: tripData.bcfFee },
          hvrf: { expected: 0.05, actual: tripData.hvrfFee },
          stateSurcharge: { expected: 2.50, actual: tripData.stateSurcharge },
          congestion: { expected: 2.75, actual: tripData.congestionFee },
          airport: { expected: 5.00, actual: tripData.airportFee },
          longTrip: { expected: 2.50, actual: tripData.longTripSurcharge },
          outOfTown: { expected: 17.50, actual: tripData.outOfTownReturnFee },
        },
      },
      meta: {
        tripId: tripData.tripId,
        totalFindings: allFindings.length,
        hasErrors: allFindings.length > 0,
      },
    });
  } catch (error) {
    console.error('TLC Fees Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check TLC fees' });
  }
});

router.get('/audit/export', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { trips } = req.body as { trips?: TripRecordReport[] };
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const reportType = (req.query.reportType as 'FULL_AUDIT' | 'FINDINGS_ONLY' | 'SUMMARY') || 'FULL_AUDIT';
    const filters = parseAuditFilters(req.query as Record<string, unknown>);
    
    if (!trips || !Array.isArray(trips)) {
      return res.status(400).json({ 
        success: false, 
        error: 'trips array is required in request body' 
      });
    }
    
    const { results, summary } = await auditTrips(trips, filters);
    const { reconciliations } = await autoReconcile(trips);
    
    const exportData = exportAuditResults(results, summary, reconciliations, format, reportType, filters);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.send(exportData.data);
    } else {
      res.json({
        success: true,
        data: exportData.data,
        meta: {
          filename: exportData.filename,
          format: exportData.format,
          reportType: exportData.reportType,
          generatedAt: exportData.generatedAt.toISOString(),
          totalFindings: exportData.findings.length,
        },
      });
    }
  } catch (error) {
    console.error('TLC Audit Export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export audit results' });
  }
});

router.post('/audit/export', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { trips } = req.body as { trips: TripRecordReport[] };
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const reportType = (req.query.reportType as 'FULL_AUDIT' | 'FINDINGS_ONLY' | 'SUMMARY') || 'FULL_AUDIT';
    const filters = parseAuditFilters(req.query as Record<string, unknown>);
    
    if (!trips || !Array.isArray(trips) || trips.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'trips array is required and must not be empty' 
      });
    }
    
    const { results, summary } = await auditTrips(trips, filters);
    const { reconciliations } = await autoReconcile(trips);
    
    const exportData = exportAuditResults(results, summary, reconciliations, format, reportType, filters);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.send(exportData.data);
    } else {
      res.json({
        success: true,
        data: exportData.data,
        meta: {
          filename: exportData.filename,
          format: exportData.format,
          reportType: exportData.reportType,
          generatedAt: exportData.generatedAt.toISOString(),
          totalFindings: exportData.findings.length,
        },
      });
    }
  } catch (error) {
    console.error('TLC Audit Export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export audit results' });
  }
});

router.get('/audit/categories', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      categories: [
        { id: 'FARE_MISMATCH', name: 'Fare Mismatch', description: 'Final fare does not match sum of components' },
        { id: 'DRIVER_PAY_MISMATCH', name: 'Driver Pay Mismatch', description: 'Driver payout calculation errors' },
        { id: 'TOLL_MISMATCH', name: 'Toll Mismatch', description: 'Incorrect or suspicious toll charges' },
        { id: 'AIRPORT_FEE_ERROR', name: 'Airport Fee Error', description: 'Missing or incorrect airport access fees' },
        { id: 'TLC_FEE_ERROR', name: 'TLC Fee Error', description: 'Incorrect AVF/BCF/HVRF/State surcharge' },
        { id: 'ZONE_MISMATCH', name: 'Zone Mismatch', description: 'Borough or zone detection errors' },
        { id: 'TIME_DISTANCE_ERROR', name: 'Time/Distance Error', description: 'Unrealistic trip metrics' },
        { id: 'MISSING_RECORD', name: 'Missing Record', description: 'Required trip data is missing' },
        { id: 'SUSPICIOUS_EARNINGS', name: 'Suspicious Earnings', description: 'Unusually high or low earnings' },
        { id: 'UNDERPAID_DRIVER', name: 'Underpaid Driver', description: 'Driver paid below TLC minimum' },
      ],
      severities: [
        { id: 'CRITICAL', name: 'Critical', description: 'Requires immediate attention', color: 'red' },
        { id: 'WARNING', name: 'Warning', description: 'Should be reviewed', color: 'yellow' },
        { id: 'INFO', name: 'Info', description: 'For informational purposes', color: 'blue' },
        { id: 'VALID', name: 'Valid', description: 'No issues found', color: 'green' },
      ],
      fixStatuses: [
        { id: 'AUTO_FIXED', name: 'Auto-Fixed', description: 'Automatically corrected' },
        { id: 'REQUIRES_REVIEW', name: 'Requires Review', description: 'Needs manual review' },
        { id: 'UNFIXABLE', name: 'Unfixable', description: 'Cannot be automatically fixed' },
        { id: 'NOT_APPLICABLE', name: 'Not Applicable', description: 'No fix needed' },
      ],
    },
  });
});

router.get('/audit/tolerances', authenticateToken, requireRole(['admin']), (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      fareVarianceCents: 5,
      distanceVariancePercent: 10,
      durationVariancePercent: 15,
      minSpeedMph: 0,
      maxSpeedMph: 120,
      roundingTolerance: 0.01,
      tlcFees: {
        avfFee: 0.125,
        bcfFee: 0.625,
        hvrfFee: 0.05,
        stateSurcharge: 2.50,
        congestionFee: 2.75,
        airportAccessFee: 5.00,
        longTripThresholdMiles: 20,
        longTripSurcharge: 2.50,
        outOfTownReturnFee: 17.50,
      },
    },
  });
});

export default router;
