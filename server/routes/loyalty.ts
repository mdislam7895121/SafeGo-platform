/**
 * SafeGo Loyalty API Routes
 * 
 * Endpoints for:
 * - Rider loyalty data (tier, points, credits, goals, rewards)
 * - Driver loyalty data (tier, earnings, streaks, bonuses)
 * - Admin dashboard metrics
 * - Daily processing controls
 */

import { Router, Request, Response } from 'express';
import {
  getRiderLoyaltyState,
  createRiderLoyaltyState,
  processRideCompletion,
  claimBirthdayReward,
  processReferralBonus,
  getRiderLoyaltyMetrics,
  getRiderRewardHistory,
} from '../services/riderLoyaltyEngine';
import {
  getDriverLoyaltyState,
  createDriverLoyaltyState,
  processDriverRideCompletion,
  getDriverLoyaltyMetrics,
  getDriverRewardHistory,
} from '../services/driverLoyaltyEngine';
import {
  getSchedulerStatus,
  triggerManualDailyProcessing,
  startLoyaltyScheduler,
  stopLoyaltyScheduler,
} from '../services/loyaltyScheduler';
import {
  RiderLoyaltyContext,
  DriverLoyaltyContext,
  isOffPeakTime,
  getRiderTierConfig,
  getDriverTierConfig,
  RIDER_TIER_CONFIGS,
  DRIVER_TIER_CONFIGS,
  DRIVER_STREAK_CONFIGS,
  DEFAULT_RIDER_WEEKLY_GOALS,
  DEFAULT_RIDER_MONTHLY_GOALS,
} from '@shared/loyalty';

const router = Router();

// ========================================
// RIDER LOYALTY ENDPOINTS
// ========================================

router.get('/rider/:riderId', (req: Request, res: Response) => {
  const { riderId } = req.params;
  
  let state = getRiderLoyaltyState(riderId);
  if (!state) {
    state = createRiderLoyaltyState(riderId);
  }
  
  const tierConfig = getRiderTierConfig(state.currentTier);
  
  res.json({
    success: true,
    data: {
      ...state,
      tierConfig,
      isOffPeakNow: isOffPeakTime(new Date()),
    },
  });
});

router.post('/rider/:riderId/create', (req: Request, res: Response) => {
  const { riderId } = req.params;
  const { birthdayMonth, birthdayDay } = req.body;
  
  const existing = getRiderLoyaltyState(riderId);
  if (existing) {
    return res.status(400).json({
      success: false,
      error: 'Rider loyalty state already exists',
    });
  }
  
  const state = createRiderLoyaltyState(riderId, birthdayMonth, birthdayDay);
  
  res.json({
    success: true,
    data: state,
  });
});

router.post('/rider/:riderId/ride-complete', (req: Request, res: Response) => {
  const { riderId } = req.params;
  const {
    rideId,
    fareAmount,
    distanceMiles,
    durationMinutes,
    pickupLocation,
    dropoffLocation,
    pickupDistanceMiles = 0,
    rideTime,
    isAirport = false,
    surgeMultiplier = 1.0,
    weatherCondition,
    rideType = 'STANDARD',
    isFirstRide = false,
    wasReferred = false,
    referrerId,
    useCredits = true,
  } = req.body;
  
  let state = getRiderLoyaltyState(riderId);
  if (!state) {
    state = createRiderLoyaltyState(riderId);
  }
  
  const rideDate = rideTime ? new Date(rideTime) : new Date();
  const isOffPeak = isOffPeakTime(rideDate);
  const isBirthday = state.birthdayMonth !== null && 
    state.birthdayDay !== null &&
    (rideDate.getMonth() + 1) === state.birthdayMonth &&
    rideDate.getDate() === state.birthdayDay;
  
  const context: RiderLoyaltyContext = {
    riderId,
    riderState: state,
    rideId,
    fareAmount,
    distanceMiles,
    durationMinutes,
    pickupLocation,
    dropoffLocation,
    pickupDistanceMiles,
    rideTime: rideDate,
    isOffPeak,
    isAirport,
    surgeMultiplier,
    weatherCondition,
    rideType,
    isFirstRide,
    wasReferred,
    referrerId,
    isBirthday,
    useCredits,
  };
  
  const result = processRideCompletion(context);
  
  if (wasReferred && referrerId) {
    processReferralBonus(referrerId, riderId);
  }
  
  const updatedState = getRiderLoyaltyState(riderId);
  
  res.json({
    success: true,
    data: {
      loyaltyResult: result,
      updatedState,
    },
  });
});

router.post('/rider/:riderId/claim-birthday', (req: Request, res: Response) => {
  const { riderId } = req.params;
  
  const result = claimBirthdayReward(riderId);
  
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Birthday reward not available',
    });
  }
  
  res.json({
    success: true,
    data: {
      creditsEarned: result.credits,
    },
  });
});

router.get('/rider/:riderId/history', (req: Request, res: Response) => {
  const { riderId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  const history = getRiderRewardHistory(riderId, limit);
  
  res.json({
    success: true,
    data: history,
  });
});

router.get('/rider/config/tiers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: RIDER_TIER_CONFIGS,
  });
});

router.get('/rider/config/goals', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      weekly: DEFAULT_RIDER_WEEKLY_GOALS,
      monthly: DEFAULT_RIDER_MONTHLY_GOALS,
    },
  });
});

// ========================================
// DRIVER LOYALTY ENDPOINTS
// ========================================

router.get('/driver/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  
  let state = getDriverLoyaltyState(driverId);
  if (!state) {
    state = createDriverLoyaltyState(driverId);
  }
  
  const tierConfig = getDriverTierConfig(state.currentTier);
  
  res.json({
    success: true,
    data: {
      ...state,
      tierConfig,
    },
  });
});

router.post('/driver/:driverId/create', (req: Request, res: Response) => {
  const { driverId } = req.params;
  
  const existing = getDriverLoyaltyState(driverId);
  if (existing) {
    return res.status(400).json({
      success: false,
      error: 'Driver loyalty state already exists',
    });
  }
  
  const state = createDriverLoyaltyState(driverId);
  
  res.json({
    success: true,
    data: state,
  });
});

router.post('/driver/:driverId/ride-complete', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const {
    rideId,
    fareAmount,
    distanceMiles,
    durationMinutes,
    pickupLocation,
    dropoffLocation,
    pickupDistanceMiles = 0,
    rideTime,
    isAirport = false,
    surgeMultiplier = 1.0,
    weatherCondition,
    rideType = 'STANDARD',
    baseDriverEarnings,
    acceptanceRateCurrent = 100,
    cancellationRateCurrent = 0,
    hoursOnlineToday = 0,
    hoursOnlineThisWeek = 0,
    peakHoursThisWeek = 0,
  } = req.body;
  
  let state = getDriverLoyaltyState(driverId);
  if (!state) {
    state = createDriverLoyaltyState(driverId);
  }
  
  const rideDate = rideTime ? new Date(rideTime) : new Date();
  const isOffPeak = isOffPeakTime(rideDate);
  
  const context: DriverLoyaltyContext = {
    driverId,
    driverState: state,
    rideId,
    fareAmount,
    distanceMiles,
    durationMinutes,
    pickupLocation,
    dropoffLocation,
    pickupDistanceMiles,
    rideTime: rideDate,
    isOffPeak,
    isAirport,
    surgeMultiplier,
    weatherCondition,
    rideType,
    baseDriverEarnings,
    acceptanceRateCurrent,
    cancellationRateCurrent,
    hoursOnlineToday,
    hoursOnlineThisWeek,
    peakHoursThisWeek,
  };
  
  const result = processDriverRideCompletion(context);
  
  const updatedState = getDriverLoyaltyState(driverId);
  
  res.json({
    success: true,
    data: {
      loyaltyResult: result,
      updatedState,
    },
  });
});

router.get('/driver/:driverId/history', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  const history = getDriverRewardHistory(driverId, limit);
  
  res.json({
    success: true,
    data: history,
  });
});

router.get('/driver/config/tiers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: DRIVER_TIER_CONFIGS,
  });
});

router.get('/driver/config/streaks', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: DRIVER_STREAK_CONFIGS,
  });
});

// ========================================
// ADMIN ENDPOINTS
// ========================================

router.get('/admin/metrics', (_req: Request, res: Response) => {
  const riderMetrics = getRiderLoyaltyMetrics();
  const driverMetrics = getDriverLoyaltyMetrics();
  
  res.json({
    success: true,
    data: {
      rider: riderMetrics,
      driver: driverMetrics,
      combined: {
        totalUsers: riderMetrics.totalRiders + driverMetrics.totalDrivers,
        totalPointsIssued: riderMetrics.totalPointsIssued,
        totalCreditsIssued: riderMetrics.totalCreditsIssued,
        totalBonusesPaid: driverMetrics.totalLoyaltyBonusesPaid + driverMetrics.totalWeeklyGuaranteesPaid,
      },
    },
  });
});

router.get('/admin/scheduler/status', (_req: Request, res: Response) => {
  const status = getSchedulerStatus();
  
  res.json({
    success: true,
    data: status,
  });
});

router.post('/admin/scheduler/start', (_req: Request, res: Response) => {
  startLoyaltyScheduler();
  
  res.json({
    success: true,
    message: 'Loyalty scheduler started',
    data: getSchedulerStatus(),
  });
});

router.post('/admin/scheduler/stop', (_req: Request, res: Response) => {
  stopLoyaltyScheduler();
  
  res.json({
    success: true,
    message: 'Loyalty scheduler stopped',
    data: getSchedulerStatus(),
  });
});

router.post('/admin/scheduler/run-now', (_req: Request, res: Response) => {
  const result = triggerManualDailyProcessing();
  
  res.json({
    success: true,
    message: 'Daily loyalty processing completed',
    data: result,
  });
});

router.get('/admin/rider/metrics', (_req: Request, res: Response) => {
  const metrics = getRiderLoyaltyMetrics();
  
  res.json({
    success: true,
    data: metrics,
  });
});

router.get('/admin/driver/metrics', (_req: Request, res: Response) => {
  const metrics = getDriverLoyaltyMetrics();
  
  res.json({
    success: true,
    data: metrics,
  });
});

// ========================================
// FARE INTEGRATION HELPERS
// ========================================

router.get('/rider/:riderId/fare-adjustments', (req: Request, res: Response) => {
  const { riderId } = req.params;
  const { fareAmount, isOffPeak } = req.query;
  
  const state = getRiderLoyaltyState(riderId);
  if (!state) {
    return res.json({
      success: true,
      data: {
        offPeakDiscountPercent: 0,
        offPeakDiscountAmount: 0,
        availableCredits: 0,
        pointsMultiplier: 1.0,
      },
    });
  }
  
  const tierConfig = getRiderTierConfig(state.currentTier);
  const fare = parseFloat(fareAmount as string) || 0;
  const isOff = isOffPeak === 'true';
  
  const offPeakDiscountPercent = isOff ? tierConfig.offPeakDiscountPercent : 0;
  const offPeakDiscountAmount = Math.round((fare * offPeakDiscountPercent / 100) * 100) / 100;
  
  res.json({
    success: true,
    data: {
      offPeakDiscountPercent,
      offPeakDiscountAmount,
      availableCredits: state.availableCredits,
      pointsMultiplier: tierConfig.pointsMultiplier,
      tier: state.currentTier,
      tierDisplayName: tierConfig.displayName,
    },
  });
});

router.get('/driver/:driverId/earnings-adjustments', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const { baseEarnings, weatherCondition, pickupDistanceMiles } = req.query;
  
  const state = getDriverLoyaltyState(driverId);
  if (!state) {
    return res.json({
      success: true,
      data: {
        tierEarningsMultiplier: 1.0,
        estimatedTierBonus: 0,
        weatherProtectionMultiplier: 1.0,
        estimatedWeatherBonus: 0,
        longDistancePickupEligible: false,
        estimatedLongDistanceBonus: 0,
        priorityDispatch: false,
      },
    });
  }
  
  const tierConfig = getDriverTierConfig(state.currentTier);
  const earnings = parseFloat(baseEarnings as string) || 0;
  const pickupDist = parseFloat(pickupDistanceMiles as string) || 0;
  
  const tierEarningsBonus = Math.round((earnings * (tierConfig.earningsMultiplier - 1)) * 100) / 100;
  
  const severeWeather = ['heavy_rain', 'snow', 'storm', 'fog', 'low_visibility'];
  const hasWeather = weatherCondition && severeWeather.includes(weatherCondition as string);
  const weatherBonus = hasWeather 
    ? Math.round((earnings * (tierConfig.weatherProtectionMultiplier - 1)) * 100) / 100 
    : 0;
  
  const longDistanceThreshold = 10;
  const isLongDistance = pickupDist >= longDistanceThreshold;
  const longDistanceBonus = isLongDistance
    ? Math.min(25, 5 + (pickupDist - longDistanceThreshold) * 0.5) * (1 + tierConfig.longDistancePickupBonusPercent / 100)
    : 0;
  
  res.json({
    success: true,
    data: {
      tier: state.currentTier,
      tierDisplayName: tierConfig.displayName,
      tierEarningsMultiplier: tierConfig.earningsMultiplier,
      estimatedTierBonus: tierEarningsBonus,
      weatherProtectionMultiplier: tierConfig.weatherProtectionMultiplier,
      estimatedWeatherBonus: Math.round(weatherBonus * 100) / 100,
      longDistancePickupEligible: isLongDistance,
      estimatedLongDistanceBonus: Math.round(longDistanceBonus * 100) / 100,
      priorityDispatch: tierConfig.priorityDispatch,
      currentStreak: state.currentStreak,
      acceptanceRate: state.acceptanceRate,
      cancellationRate: state.cancellationRate,
    },
  });
});

export default router;
