/**
 * SafeGo Loyalty Engine Tests
 * 
 * Comprehensive test coverage for:
 * - Rider Loyalty Engine
 * - Driver Loyalty Engine
 * - Loyalty Scheduler
 */

import {
  getRiderLoyaltyState,
  createRiderLoyaltyState,
  calculateRidePoints,
  checkWeeklyGoals,
  checkMonthlyGoals,
  calculateOffPeakDiscount,
  applyCredits,
  checkTierProgression,
  checkBirthdayReward,
  processRideCompletion,
  processReferralBonus,
  runDailyRiderProcessing,
  getRiderLoyaltyMetrics,
} from '../riderLoyaltyEngine';

import {
  getDriverLoyaltyState,
  createDriverLoyaltyState,
  checkDriverTierProgression,
  calculateAcceptanceRateBonus,
  calculateCancellationRateBonus,
  checkWeeklyGuarantee,
  calculateLongDistancePickupBonus,
  calculateWeatherProtectionBonus,
  updateStreak,
  calculateTierEarningsBonus,
  processDriverRideCompletion,
  runDailyDriverProcessing,
  getDriverLoyaltyMetrics,
} from '../driverLoyaltyEngine';

import {
  runDailyLoyaltyProcessing,
  getSchedulerStatus,
} from '../loyaltyScheduler';

import {
  RiderLoyaltyState,
  RiderLoyaltyContext,
  DriverLoyaltyState,
  DriverLoyaltyContext,
  isOffPeakTime,
  getRiderTierConfig,
  getDriverTierConfig,
  calculateRiderTier,
  calculateDriverTier,
  getWeekStartDate,
  getMonthStartDate,
  RIDER_TIER_CONFIGS,
  DRIVER_TIER_CONFIGS,
  DEFAULT_RIDER_POINTS_CONFIG,
  DEFAULT_RIDER_WEEKLY_GOALS,
  DEFAULT_RIDER_MONTHLY_GOALS,
} from '@shared/loyalty';

// ========================================
// RIDER LOYALTY ENGINE TESTS
// ========================================

describe('Rider Loyalty Engine', () => {
  describe('State Management', () => {
    it('should create new rider loyalty state', () => {
      const state = createRiderLoyaltyState('rider_test_1');
      
      expect(state.riderId).toBe('rider_test_1');
      expect(state.currentTier).toBe('bronze');
      expect(state.lifetimePoints).toBe(0);
      expect(state.currentPoints).toBe(0);
      expect(state.availableCredits).toBe(0);
      expect(state.weeklyRideCount).toBe(0);
      expect(state.monthlyRideCount).toBe(0);
    });

    it('should create state with birthday info', () => {
      const state = createRiderLoyaltyState('rider_test_2', 6, 15);
      
      expect(state.birthdayMonth).toBe(6);
      expect(state.birthdayDay).toBe(15);
      expect(state.birthdayRewardClaimedThisYear).toBe(false);
    });

    it('should retrieve existing rider state', () => {
      createRiderLoyaltyState('rider_test_3');
      const state = getRiderLoyaltyState('rider_test_3');
      
      expect(state).not.toBeNull();
      expect(state?.riderId).toBe('rider_test_3');
    });
  });

  describe('Points Calculation', () => {
    it('should calculate base points from fare', () => {
      const state = createRiderLoyaltyState('rider_points_1');
      const context: RiderLoyaltyContext = {
        riderId: 'rider_points_1',
        riderState: state,
        rideId: 'ride_1',
        fareAmount: 25,
        distanceMiles: 5,
        durationMinutes: 15,
        pickupLocation: { lat: 40.7128, lng: -74.0060 },
        dropoffLocation: { lat: 40.7589, lng: -73.9851 },
        pickupDistanceMiles: 0.5,
        rideTime: new Date(),
        isOffPeak: false,
        isAirport: false,
        surgeMultiplier: 1.0,
        rideType: 'STANDARD',
        isFirstRide: false,
        wasReferred: false,
        isBirthday: false,
        useCredits: false,
      };

      const points = calculateRidePoints(context);
      
      expect(points.basePoints).toBe(25);
      expect(points.tierMultiplierPoints).toBe(0);
      expect(points.totalPoints).toBeGreaterThanOrEqual(25);
    });

    it('should apply tier multiplier for Gold tier', () => {
      const state = createRiderLoyaltyState('rider_points_2');
      state.currentTier = 'gold';
      state.lifetimePoints = 2500;
      
      const context: RiderLoyaltyContext = {
        riderId: 'rider_points_2',
        riderState: state,
        rideId: 'ride_2',
        fareAmount: 20,
        distanceMiles: 4,
        durationMinutes: 12,
        pickupLocation: { lat: 40.7128, lng: -74.0060 },
        dropoffLocation: { lat: 40.7589, lng: -73.9851 },
        pickupDistanceMiles: 0.3,
        rideTime: new Date(),
        isOffPeak: false,
        isAirport: false,
        surgeMultiplier: 1.0,
        rideType: 'STANDARD',
        isFirstRide: false,
        wasReferred: false,
        isBirthday: false,
        useCredits: false,
      };

      const points = calculateRidePoints(context);
      
      expect(points.basePoints).toBe(20);
      expect(points.tierMultiplierPoints).toBe(10);
    });

    it('should add off-peak bonus', () => {
      const state = createRiderLoyaltyState('rider_points_3');
      
      const context: RiderLoyaltyContext = {
        riderId: 'rider_points_3',
        riderState: state,
        rideId: 'ride_3',
        fareAmount: 15,
        distanceMiles: 3,
        durationMinutes: 10,
        pickupLocation: { lat: 40.7128, lng: -74.0060 },
        dropoffLocation: { lat: 40.7589, lng: -73.9851 },
        pickupDistanceMiles: 0.2,
        rideTime: new Date(),
        isOffPeak: true,
        isAirport: false,
        surgeMultiplier: 1.0,
        rideType: 'STANDARD',
        isFirstRide: false,
        wasReferred: false,
        isBirthday: false,
        useCredits: false,
      };

      const points = calculateRidePoints(context);
      
      expect(points.timeBonusPoints).toBe(10);
    });

    it('should add airport bonus', () => {
      const state = createRiderLoyaltyState('rider_points_4');
      
      const context: RiderLoyaltyContext = {
        riderId: 'rider_points_4',
        riderState: state,
        rideId: 'ride_4',
        fareAmount: 50,
        distanceMiles: 15,
        durationMinutes: 30,
        pickupLocation: { lat: 40.6413, lng: -73.7781 },
        dropoffLocation: { lat: 40.7589, lng: -73.9851 },
        pickupDistanceMiles: 0.5,
        rideTime: new Date(),
        isOffPeak: false,
        isAirport: true,
        surgeMultiplier: 1.0,
        rideType: 'STANDARD',
        isFirstRide: false,
        wasReferred: false,
        isBirthday: false,
        useCredits: false,
      };

      const points = calculateRidePoints(context);
      
      expect(points.locationBonusPoints).toBe(15);
    });

    it('should add long distance bonus', () => {
      const state = createRiderLoyaltyState('rider_points_5');
      
      const context: RiderLoyaltyContext = {
        riderId: 'rider_points_5',
        riderState: state,
        rideId: 'ride_5',
        fareAmount: 75,
        distanceMiles: 25,
        durationMinutes: 45,
        pickupLocation: { lat: 40.7128, lng: -74.0060 },
        dropoffLocation: { lat: 41.0534, lng: -74.1310 },
        pickupDistanceMiles: 0.3,
        rideTime: new Date(),
        isOffPeak: false,
        isAirport: false,
        surgeMultiplier: 1.0,
        rideType: 'STANDARD',
        isFirstRide: false,
        wasReferred: false,
        isBirthday: false,
        useCredits: false,
      };

      const points = calculateRidePoints(context);
      
      expect(points.distanceBonusPoints).toBe(20);
    });
  });

  describe('Tier Progression', () => {
    it('should calculate Bronze tier for new riders', () => {
      const tier = calculateRiderTier(0);
      expect(tier).toBe('bronze');
    });

    it('should progress to Silver at 500 points', () => {
      const tier = calculateRiderTier(500);
      expect(tier).toBe('silver');
    });

    it('should progress to Gold at 2000 points', () => {
      const tier = calculateRiderTier(2000);
      expect(tier).toBe('gold');
    });

    it('should progress to Platinum at 5000 points', () => {
      const tier = calculateRiderTier(5000);
      expect(tier).toBe('platinum');
    });

    it('should detect tier upgrade', () => {
      const result = checkTierProgression('bronze', 600);
      
      expect(result.upgraded).toBe(true);
      expect(result.newTier).toBe('silver');
    });

    it('should calculate progress to next tier', () => {
      const result = checkTierProgression('silver', 1000);
      
      expect(result.progressToNext).toBeGreaterThan(0);
      expect(result.progressToNext).toBeLessThan(100);
      expect(result.pointsToNext).toBe(1000);
    });
  });

  describe('Off-Peak Discount', () => {
    it('should apply 0% discount for Bronze tier off-peak', () => {
      const { discountAmount, discountPercent } = calculateOffPeakDiscount(30, 'bronze', true);
      
      expect(discountPercent).toBe(0);
      expect(discountAmount).toBe(0);
    });

    it('should apply 5% discount for Silver tier off-peak', () => {
      const { discountAmount, discountPercent } = calculateOffPeakDiscount(30, 'silver', true);
      
      expect(discountPercent).toBe(5);
      expect(discountAmount).toBe(1.5);
    });

    it('should apply 10% discount for Gold tier off-peak', () => {
      const { discountAmount, discountPercent } = calculateOffPeakDiscount(30, 'gold', true);
      
      expect(discountPercent).toBe(10);
      expect(discountAmount).toBe(3);
    });

    it('should apply 15% discount for Platinum tier off-peak', () => {
      const { discountAmount, discountPercent } = calculateOffPeakDiscount(30, 'platinum', true);
      
      expect(discountPercent).toBe(15);
      expect(discountAmount).toBe(4.5);
    });

    it('should not apply discount during peak times', () => {
      const { discountAmount, discountPercent } = calculateOffPeakDiscount(30, 'platinum', false);
      
      expect(discountPercent).toBe(0);
      expect(discountAmount).toBe(0);
    });
  });

  describe('Credits System', () => {
    it('should apply available credits to fare', () => {
      const { creditsApplied, remainingFare, remainingCredits } = applyCredits(30, 15, true);
      
      expect(creditsApplied).toBe(15);
      expect(remainingFare).toBe(15);
      expect(remainingCredits).toBe(0);
    });

    it('should not exceed fare amount', () => {
      const { creditsApplied, remainingFare, remainingCredits } = applyCredits(20, 50, true);
      
      expect(creditsApplied).toBe(20);
      expect(remainingFare).toBe(0);
      expect(remainingCredits).toBe(30);
    });

    it('should not apply credits when disabled', () => {
      const { creditsApplied, remainingFare, remainingCredits } = applyCredits(30, 15, false);
      
      expect(creditsApplied).toBe(0);
      expect(remainingFare).toBe(30);
      expect(remainingCredits).toBe(15);
    });
  });

  describe('Weekly Goals', () => {
    it('should complete weekly goal at 3 rides', () => {
      const state = createRiderLoyaltyState('rider_goal_1');
      state.weeklyRideCount = 3;
      
      const { completedGoal, newProgress } = checkWeeklyGoals(state);
      
      expect(completedGoal).not.toBeNull();
      expect(completedGoal?.ridesRequired).toBe(3);
      expect(newProgress.find(p => p.goalId === 'weekly_3')?.completed).toBe(true);
    });

    it('should complete multiple goals at 5 rides', () => {
      const state = createRiderLoyaltyState('rider_goal_2');
      state.weeklyRideCount = 5;
      
      const { completedGoal, newProgress } = checkWeeklyGoals(state);
      
      expect(completedGoal?.ridesRequired).toBe(5);
      expect(newProgress.filter(p => p.completed).length).toBe(2);
    });
  });

  describe('Referral System', () => {
    it('should process referral bonus only once', () => {
      createRiderLoyaltyState('referrer_1');
      createRiderLoyaltyState('referred_1');
      
      const firstResult = processReferralBonus('referrer_1', 'referred_1');
      expect(firstResult.success).toBe(true);
      expect(firstResult.bonusPoints).toBe(100);
      expect(firstResult.alreadyProcessed).toBe(false);
      
      const secondResult = processReferralBonus('referrer_1', 'referred_1');
      expect(secondResult.success).toBe(false);
      expect(secondResult.bonusPoints).toBe(0);
      expect(secondResult.alreadyProcessed).toBe(true);
    });

    it('should increment referrer credits and points', () => {
      createRiderLoyaltyState('referrer_2');
      
      processReferralBonus('referrer_2', 'new_rider_1');
      const state = getRiderLoyaltyState('referrer_2');
      
      expect(state?.referralCount).toBe(1);
      expect(state?.lifetimePoints).toBe(100);
      expect(state?.availableCredits).toBe(10);
    });
  });

  describe('Birthday Rewards', () => {
    it('should detect birthday reward available', () => {
      const state = createRiderLoyaltyState('rider_birthday_1');
      const today = new Date();
      state.birthdayMonth = today.getMonth() + 1;
      state.birthdayDay = today.getDate();
      
      const { available, credits } = checkBirthdayReward(state, today);
      
      expect(available).toBe(true);
      expect(credits).toBe(5);
    });

    it('should not offer reward if already claimed', () => {
      const state = createRiderLoyaltyState('rider_birthday_2');
      const today = new Date();
      state.birthdayMonth = today.getMonth() + 1;
      state.birthdayDay = today.getDate();
      state.birthdayRewardClaimedThisYear = true;
      
      const { available } = checkBirthdayReward(state, today);
      
      expect(available).toBe(false);
    });

    it('should give higher reward for higher tiers', () => {
      const state = createRiderLoyaltyState('rider_birthday_3');
      const today = new Date();
      state.birthdayMonth = today.getMonth() + 1;
      state.birthdayDay = today.getDate();
      state.currentTier = 'platinum';
      
      const { credits } = checkBirthdayReward(state, today);
      
      expect(credits).toBe(50);
    });
  });
});

// ========================================
// DRIVER LOYALTY ENGINE TESTS
// ========================================

describe('Driver Loyalty Engine', () => {
  describe('State Management', () => {
    it('should create new driver loyalty state', () => {
      const state = createDriverLoyaltyState('driver_test_1');
      
      expect(state.driverId).toBe('driver_test_1');
      expect(state.currentTier).toBe('silver');
      expect(state.lifetimeRides).toBe(0);
      expect(state.currentStreak).toBe(0);
      expect(state.acceptanceRate).toBe(100);
      expect(state.cancellationRate).toBe(0);
    });

    it('should retrieve existing driver state', () => {
      createDriverLoyaltyState('driver_test_2');
      const state = getDriverLoyaltyState('driver_test_2');
      
      expect(state).not.toBeNull();
      expect(state?.driverId).toBe('driver_test_2');
    });
  });

  describe('Tier Progression', () => {
    it('should calculate Silver tier for new drivers', () => {
      const tier = calculateDriverTier(0, 100, 0);
      expect(tier).toBe('silver');
    });

    it('should progress to Gold with 100 rides and good stats', () => {
      const tier = calculateDriverTier(100, 90, 3);
      expect(tier).toBe('gold');
    });

    it('should progress to Platinum with 500 rides and excellent stats', () => {
      const tier = calculateDriverTier(500, 92, 2);
      expect(tier).toBe('platinum');
    });

    it('should progress to Diamond with 2000 rides and perfect stats', () => {
      const tier = calculateDriverTier(2000, 96, 1);
      expect(tier).toBe('diamond');
    });

    it('should not upgrade with poor acceptance rate', () => {
      const tier = calculateDriverTier(500, 75, 1);
      expect(tier).toBe('silver');
    });

    it('should not upgrade with high cancellation rate', () => {
      const tier = calculateDriverTier(500, 95, 10);
      expect(tier).toBe('silver');
    });
  });

  describe('Acceptance Rate Bonus', () => {
    it('should give 5% bonus at 95% acceptance', () => {
      const { bonusPercent, bonusAmount } = calculateAcceptanceRateBonus(100, 95);
      
      expect(bonusPercent).toBe(5);
      expect(bonusAmount).toBe(5);
    });

    it('should give 10% bonus at 98% acceptance', () => {
      const { bonusPercent, bonusAmount } = calculateAcceptanceRateBonus(100, 98);
      
      expect(bonusPercent).toBe(10);
      expect(bonusAmount).toBe(10);
    });

    it('should give 15% bonus at 100% acceptance', () => {
      const { bonusPercent, bonusAmount } = calculateAcceptanceRateBonus(100, 100);
      
      expect(bonusPercent).toBe(15);
      expect(bonusAmount).toBe(15);
    });

    it('should give no bonus below 95% acceptance', () => {
      const { bonusPercent, bonusAmount } = calculateAcceptanceRateBonus(100, 90);
      
      expect(bonusPercent).toBe(0);
      expect(bonusAmount).toBe(0);
    });
  });

  describe('Cancellation Rate Bonus', () => {
    it('should give 5% bonus at 3% cancellation', () => {
      const { bonusPercent, bonusAmount } = calculateCancellationRateBonus(100, 3);
      
      expect(bonusPercent).toBe(5);
      expect(bonusAmount).toBe(5);
    });

    it('should give 10% bonus at 1% cancellation', () => {
      const { bonusPercent, bonusAmount } = calculateCancellationRateBonus(100, 1);
      
      expect(bonusPercent).toBe(10);
      expect(bonusAmount).toBe(10);
    });

    it('should give 15% bonus at 0% cancellation', () => {
      const { bonusPercent, bonusAmount } = calculateCancellationRateBonus(100, 0);
      
      expect(bonusPercent).toBe(15);
      expect(bonusAmount).toBe(15);
    });

    it('should give no bonus above 3% cancellation', () => {
      const { bonusPercent, bonusAmount } = calculateCancellationRateBonus(100, 5);
      
      expect(bonusPercent).toBe(0);
      expect(bonusAmount).toBe(0);
    });
  });

  describe('Long Distance Pickup Bonus', () => {
    it('should give bonus for 10+ mile pickup', () => {
      const { isLongDistance, bonusAmount } = calculateLongDistancePickupBonus(12, 'silver');
      
      expect(isLongDistance).toBe(true);
      expect(bonusAmount).toBeGreaterThan(5);
    });

    it('should give no bonus for short pickup', () => {
      const { isLongDistance, bonusAmount } = calculateLongDistancePickupBonus(5, 'silver');
      
      expect(isLongDistance).toBe(false);
      expect(bonusAmount).toBe(0);
    });

    it('should give higher bonus for higher tiers', () => {
      const silverResult = calculateLongDistancePickupBonus(15, 'silver');
      const diamondResult = calculateLongDistancePickupBonus(15, 'diamond');
      
      expect(diamondResult.bonusAmount).toBeGreaterThan(silverResult.bonusAmount);
    });

    it('should cap bonus at maximum', () => {
      const { bonusAmount } = calculateLongDistancePickupBonus(100, 'silver');
      
      expect(bonusAmount).toBeLessThanOrEqual(25);
    });
  });

  describe('Weather Protection Bonus', () => {
    it('should give bonus for heavy rain', () => {
      const { hasProtection, bonusAmount } = calculateWeatherProtectionBonus(100, 'heavy_rain', 'gold');
      
      expect(hasProtection).toBe(true);
      expect(bonusAmount).toBeGreaterThan(0);
    });

    it('should give bonus for snow', () => {
      const { hasProtection, bonusAmount } = calculateWeatherProtectionBonus(100, 'snow', 'gold');
      
      expect(hasProtection).toBe(true);
      expect(bonusAmount).toBeGreaterThan(0);
    });

    it('should give no bonus for clear weather', () => {
      const { hasProtection, bonusAmount } = calculateWeatherProtectionBonus(100, 'clear', 'gold');
      
      expect(hasProtection).toBe(false);
      expect(bonusAmount).toBe(0);
    });

    it('should give higher bonus for Diamond tier', () => {
      const goldResult = calculateWeatherProtectionBonus(100, 'storm', 'gold');
      const diamondResult = calculateWeatherProtectionBonus(100, 'storm', 'diamond');
      
      expect(diamondResult.bonusAmount).toBeGreaterThan(goldResult.bonusAmount);
    });
  });

  describe('Tier Earnings Multiplier', () => {
    it('should give 0% bonus for Silver tier', () => {
      const bonus = calculateTierEarningsBonus(100, 'silver');
      expect(bonus).toBe(0);
    });

    it('should give 5% bonus for Gold tier', () => {
      const bonus = calculateTierEarningsBonus(100, 'gold');
      expect(bonus).toBe(5);
    });

    it('should give 10% bonus for Platinum tier', () => {
      const bonus = calculateTierEarningsBonus(100, 'platinum');
      expect(bonus).toBe(10);
    });

    it('should give 15% bonus for Diamond tier', () => {
      const bonus = calculateTierEarningsBonus(100, 'diamond');
      expect(bonus).toBe(15);
    });
  });

  describe('Weekly Guarantee', () => {
    it('should be eligible with sufficient hours and rides', () => {
      const state = createDriverLoyaltyState('driver_guarantee_1');
      state.weeklyHoursOnline = 25;
      state.weeklyRides = 35;
      state.weeklyPeakHours = 6;
      state.weeklyEarnings = 400;
      
      const { eligible, topUpAmount } = checkWeeklyGuarantee(state);
      
      expect(eligible).toBe(true);
      expect(topUpAmount).toBe(100);
    });

    it('should not be eligible without enough hours', () => {
      const state = createDriverLoyaltyState('driver_guarantee_2');
      state.weeklyHoursOnline = 15;
      state.weeklyRides = 35;
      state.weeklyPeakHours = 6;
      
      const { eligible } = checkWeeklyGuarantee(state);
      
      expect(eligible).toBe(false);
    });

    it('should not be eligible without enough rides', () => {
      const state = createDriverLoyaltyState('driver_guarantee_3');
      state.weeklyHoursOnline = 25;
      state.weeklyRides = 20;
      state.weeklyPeakHours = 6;
      
      const { eligible } = checkWeeklyGuarantee(state);
      
      expect(eligible).toBe(false);
    });

    it('should give higher guarantee for higher tiers', () => {
      const silverState = createDriverLoyaltyState('driver_guarantee_4');
      silverState.weeklyHoursOnline = 25;
      silverState.weeklyRides = 35;
      silverState.weeklyPeakHours = 6;
      silverState.weeklyEarnings = 400;
      silverState.currentTier = 'silver';
      
      const goldState = createDriverLoyaltyState('driver_guarantee_5');
      goldState.weeklyHoursOnline = 25;
      goldState.weeklyRides = 35;
      goldState.weeklyPeakHours = 6;
      goldState.weeklyEarnings = 400;
      goldState.currentTier = 'gold';
      
      const silverResult = checkWeeklyGuarantee(silverState);
      const goldResult = checkWeeklyGuarantee(goldState);
      
      expect(goldResult.topUpAmount).toBeGreaterThan(silverResult.topUpAmount);
    });
  });

  describe('Streak Tracking', () => {
    it('should start streak on first qualifying day', () => {
      const state = createDriverLoyaltyState('driver_streak_1');
      state.dailyRideCounts.push({ date: new Date().toISOString().split('T')[0], count: 5 });
      
      const result = updateStreak(state, new Date());
      
      expect(result.newStreak).toBeGreaterThanOrEqual(1);
    });

    it('should reach 7-day milestone', () => {
      const state = createDriverLoyaltyState('driver_streak_2');
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        state.dailyRideCounts.push({ date: date.toISOString().split('T')[0], count: 6 });
      }
      state.currentStreak = 6;
      
      const result = updateStreak(state, today);
      
      expect(result.milestoneReached).toBe(7);
      expect(result.bonusAmount).toBe(25);
    });
  });
});

// ========================================
// LOYALTY SCHEDULER TESTS
// ========================================

describe('Loyalty Scheduler', () => {
  describe('Daily Processing', () => {
    it('should run combined daily processing', () => {
      createRiderLoyaltyState('scheduler_rider_1');
      createDriverLoyaltyState('scheduler_driver_1');
      
      const result = runDailyLoyaltyProcessing();
      
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.totalProcessed).toBeGreaterThanOrEqual(2);
    });

    it('should track tier changes', () => {
      const result = runDailyLoyaltyProcessing();
      
      expect(result.tierChanges).toHaveProperty('riderUpgrades');
      expect(result.tierChanges).toHaveProperty('driverUpgrades');
    });
  });

  describe('Scheduler Status', () => {
    it('should return scheduler status', () => {
      const status = getSchedulerStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('lastDailyRun');
      expect(status).toHaveProperty('runCount');
    });
  });
});

// ========================================
// SHARED UTILITY TESTS
// ========================================

describe('Shared Loyalty Utilities', () => {
  describe('Off-Peak Detection', () => {
    it('should detect weekday off-peak (10 AM - 4 PM)', () => {
      const monday10AM = new Date('2024-01-15T10:00:00');
      expect(isOffPeakTime(monday10AM)).toBe(true);
    });

    it('should detect weekday evening off-peak (8 PM - 11 PM)', () => {
      const monday9PM = new Date('2024-01-15T21:00:00');
      expect(isOffPeakTime(monday9PM)).toBe(true);
    });

    it('should detect peak time (7 AM)', () => {
      const monday7AM = new Date('2024-01-15T07:00:00');
      expect(isOffPeakTime(monday7AM)).toBe(false);
    });

    it('should detect weekend morning off-peak', () => {
      const saturday8AM = new Date('2024-01-13T08:00:00');
      expect(isOffPeakTime(saturday8AM)).toBe(true);
    });
  });

  describe('Date Utilities', () => {
    it('should get week start date (Monday)', () => {
      const wednesday = new Date('2024-01-17T15:00:00');
      const weekStart = getWeekStartDate(wednesday);
      
      expect(weekStart.getDay()).toBe(1);
      expect(weekStart.getHours()).toBe(0);
    });

    it('should get month start date', () => {
      const midMonth = new Date('2024-01-17T15:00:00');
      const monthStart = getMonthStartDate(midMonth);
      
      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(0);
    });
  });

  describe('Tier Configs', () => {
    it('should have 4 rider tiers', () => {
      expect(RIDER_TIER_CONFIGS).toHaveLength(4);
    });

    it('should have 4 driver tiers', () => {
      expect(DRIVER_TIER_CONFIGS).toHaveLength(4);
    });

    it('should get rider tier config', () => {
      const goldConfig = getRiderTierConfig('gold');
      
      expect(goldConfig.tier).toBe('gold');
      expect(goldConfig.pointsMultiplier).toBe(1.5);
      expect(goldConfig.offPeakDiscountPercent).toBe(10);
    });

    it('should get driver tier config', () => {
      const platinumConfig = getDriverTierConfig('platinum');
      
      expect(platinumConfig.tier).toBe('platinum');
      expect(platinumConfig.earningsMultiplier).toBe(1.10);
      expect(platinumConfig.priorityDispatch).toBe(true);
    });
  });
});

// ========================================
// ADMIN METRICS TESTS
// ========================================

describe('Admin Metrics', () => {
  describe('Rider Metrics', () => {
    it('should return rider loyalty metrics', () => {
      createRiderLoyaltyState('metrics_rider_1');
      createRiderLoyaltyState('metrics_rider_2');
      
      const metrics = getRiderLoyaltyMetrics();
      
      expect(metrics.totalRiders).toBeGreaterThanOrEqual(2);
      expect(metrics.ridersByTier).toHaveProperty('bronze');
      expect(metrics.ridersByTier).toHaveProperty('silver');
      expect(metrics.ridersByTier).toHaveProperty('gold');
      expect(metrics.ridersByTier).toHaveProperty('platinum');
    });
  });

  describe('Driver Metrics', () => {
    it('should return driver loyalty metrics', () => {
      createDriverLoyaltyState('metrics_driver_1');
      createDriverLoyaltyState('metrics_driver_2');
      
      const metrics = getDriverLoyaltyMetrics();
      
      expect(metrics.totalDrivers).toBeGreaterThanOrEqual(2);
      expect(metrics.driversByTier).toHaveProperty('silver');
      expect(metrics.driversByTier).toHaveProperty('gold');
      expect(metrics.driversByTier).toHaveProperty('platinum');
      expect(metrics.driversByTier).toHaveProperty('diamond');
      expect(metrics.streakMilestonesReached).toHaveProperty('7');
      expect(metrics.streakMilestonesReached).toHaveProperty('14');
      expect(metrics.streakMilestonesReached).toHaveProperty('30');
    });
  });
});
