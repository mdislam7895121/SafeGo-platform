/**
 * NYC TLC HVFHV Minimum Pay Enforcement Engine Tests
 * 
 * Comprehensive test coverage for:
 * - Per-ride minimum pay calculation
 * - Hourly utilization guarantee
 * - Weekly guaranteed pay
 * - Multi-trip scenarios
 * - Low utilization correction
 */

import {
  calculatePerRideMinimumPay,
  calculateHourlyGuarantee,
  calculateWeeklyGuarantee,
  enforceTLCMinimumOnFare,
  getOrCreateDriverSession,
  recordDriverRide,
  updateDriverOnlineTime,
  getDriverSession,
  processWeeklySettlement,
  getDriverWeeklySettlements,
  getDriverTLCComplianceStatus,
  resetDriverSession,
  getTLCRateInfo,
  NYC_TLC_CONFIG,
} from '../tlcMinimumPayEngine';

describe('NYC TLC Minimum Pay Engine', () => {
  beforeEach(() => {
    resetDriverSession('test-driver-1');
    resetDriverSession('test-driver-2');
    resetDriverSession('test-driver-3');
  });

  describe('Per-Ride Minimum Pay Formula', () => {
    it('should calculate time+distance minimum correctly', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 20,
        tripDistanceMiles: 5,
        actualDriverPayout: 10.00,
      });

      const expectedTimeDistance = (20 * 0.56) + (5 * 1.31);
      expect(result.timeBasedMinimum).toBe(17.75);
      expect(result.tlcMinimumPay).toBeGreaterThanOrEqual(expectedTimeDistance);
    });

    it('should use hourly equivalent when higher', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 60,
        tripDistanceMiles: 2,
        actualDriverPayout: 20.00,
      });

      const hourlyEquiv = (60 / 60) * 27.86;
      expect(result.hourlyEquivalentMinimum).toBe(27.86);
      expect(result.tlcMinimumPay).toBe(27.86);
    });

    it('should require adjustment when payout below TLC minimum', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 30,
        tripDistanceMiles: 8,
        actualDriverPayout: 15.00,
      });

      const tlcMinimum = Math.max(
        (30 * 0.56) + (8 * 1.31),
        (30 / 60) * 27.86
      );

      expect(result.tlcMinimumApplied).toBe(true);
      expect(result.adjustmentRequired).toBe(Math.round((tlcMinimum - 15.00) * 100) / 100);
    });

    it('should not require adjustment when payout meets TLC minimum', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 15,
        tripDistanceMiles: 3,
        actualDriverPayout: 25.00,
      });

      expect(result.tlcMinimumApplied).toBe(false);
      expect(result.adjustmentRequired).toBe(0);
    });

    it('should handle short trips correctly', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 5,
        tripDistanceMiles: 1,
        actualDriverPayout: 3.00,
      });

      const expectedMin = Math.max(
        (5 * 0.56) + (1 * 1.31),
        (5 / 60) * 27.86
      );

      expect(result.tlcMinimumPay).toBeCloseTo(expectedMin, 2);
      expect(result.tlcMinimumApplied).toBe(true);
    });

    it('should handle long trips correctly', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 90,
        tripDistanceMiles: 25,
        actualDriverPayout: 40.00,
      });

      const timeDistance = (90 * 0.56) + (25 * 1.31);
      const hourlyEquiv = (90 / 60) * 27.86;

      expect(result.timeBasedMinimum).toBeCloseTo(timeDistance, 2);
      expect(result.hourlyEquivalentMinimum).toBeCloseTo(hourlyEquiv, 2);
    });

    it('should provide correct formula explanation', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 20,
        tripDistanceMiles: 5,
        actualDriverPayout: 10.00,
      });

      expect(result.formula).toContain('time_distance');
      expect(result.formula).toContain('$0.56');
      expect(result.formula).toContain('$1.31');
    });
  });

  describe('Hourly Utilization Guarantee', () => {
    it('should calculate utilization rate correctly', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 60,
        engagedMinutes: 45,
        totalEarnings: 20.00,
        ridesCompleted: 3,
      });

      expect(result.utilizationRate).toBe(0.75);
      expect(result.hourlyBreakdown.utilizationPercent).toBe(75);
    });

    it('should require adjustment when earnings below hourly minimum', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 60,
        engagedMinutes: 30,
        totalEarnings: 15.00,
        ridesCompleted: 2,
      });

      const guarantee = 27.86;
      expect(result.guaranteedAmount).toBe(guarantee);
      expect(result.tlcHourlyGuaranteeApplied).toBe(true);
      expect(result.adjustmentRequired).toBeCloseTo(guarantee - 15.00, 2);
    });

    it('should not require adjustment when earnings meet hourly minimum', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 60,
        engagedMinutes: 50,
        totalEarnings: 35.00,
        ridesCompleted: 4,
      });

      expect(result.tlcHourlyGuaranteeApplied).toBe(false);
      expect(result.adjustmentRequired).toBe(0);
    });

    it('should handle multiple hours correctly', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 180,
        engagedMinutes: 120,
        totalEarnings: 60.00,
        ridesCompleted: 8,
      });

      const guarantee = 3 * 27.86;
      expect(result.guaranteedAmount).toBeCloseTo(guarantee, 2);
      expect(result.tlcHourlyGuaranteeApplied).toBe(true);
    });

    it('should track waiting time in breakdown', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 60,
        engagedMinutes: 40,
        totalEarnings: 25.00,
        ridesCompleted: 3,
      });

      expect(result.hourlyBreakdown.waitingTime).toBeCloseTo(20 / 60, 2);
      expect(result.hourlyBreakdown.engagedTime).toBeCloseTo(40 / 60, 2);
    });

    it('should handle zero online time gracefully', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 0,
        engagedMinutes: 0,
        totalEarnings: 0,
        ridesCompleted: 0,
      });

      expect(result.utilizationRate).toBe(0);
      expect(result.guaranteedAmount).toBe(0);
    });
  });

  describe('Weekly Guaranteed Pay', () => {
    it('should calculate weekly guarantee correctly', () => {
      const weekStart = new Date('2024-01-01');
      const weekEnd = new Date('2024-01-07');

      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart,
        weekEnd,
        totalOnlineHours: 40,
        totalEngagedHours: 30,
        totalRides: 50,
        totalEarnings: 800.00,
        perRideAdjustments: 50.00,
        hourlyAdjustments: 30.00,
      });

      const weeklyMin = 40 * 27.86;
      expect(result.weeklyMinimumGuarantee).toBeCloseTo(weeklyMin, 2);
      expect(result.isEligible).toBe(true);
    });

    it('should require adjustment when below weekly minimum', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 40,
        totalEngagedHours: 25,
        totalRides: 30,
        totalEarnings: 600.00,
        perRideAdjustments: 20.00,
        hourlyAdjustments: 10.00,
      });

      const weeklyMin = 40 * 27.86;
      const totalWithAdjustments = 600 + 20 + 10;

      expect(result.tlcWeeklyAdjustmentApplied).toBe(true);
      expect(result.weeklyAdjustmentRequired).toBeCloseTo(weeklyMin - totalWithAdjustments, 2);
    });

    it('should not apply adjustment when earnings exceed minimum', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 40,
        totalEngagedHours: 35,
        totalRides: 60,
        totalEarnings: 1200.00,
        perRideAdjustments: 0,
        hourlyAdjustments: 0,
      });

      expect(result.tlcWeeklyAdjustmentApplied).toBe(false);
      expect(result.weeklyAdjustmentRequired).toBe(0);
    });

    it('should require minimum rides for eligibility', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 40,
        totalEngagedHours: 30,
        totalRides: 0,
        totalEarnings: 0,
        perRideAdjustments: 0,
        hourlyAdjustments: 0,
      });

      expect(result.isEligible).toBe(false);
      expect(result.eligibilityReason).toContain('ride');
    });

    it('should require minimum online hours for eligibility', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 0,
        totalEngagedHours: 0,
        totalRides: 5,
        totalEarnings: 100.00,
        perRideAdjustments: 0,
        hourlyAdjustments: 0,
      });

      expect(result.isEligible).toBe(false);
      expect(result.eligibilityReason).toContain('hour');
    });

    it('should calculate utilization rate for weekly period', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 50,
        totalEngagedHours: 35,
        totalRides: 40,
        totalEarnings: 900.00,
        perRideAdjustments: 30.00,
        hourlyAdjustments: 20.00,
      });

      expect(result.utilizationRate).toBe(0.7);
    });

    it('should include all adjustment types in final payout', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 30,
        totalEngagedHours: 20,
        totalRides: 25,
        totalEarnings: 500.00,
        perRideAdjustments: 40.00,
        hourlyAdjustments: 25.00,
      });

      expect(result.breakdown.baseEarnings).toBe(500.00);
      expect(result.breakdown.perRideAdjustments).toBe(40.00);
      expect(result.breakdown.hourlyAdjustments).toBe(25.00);
      expect(result.breakdown.finalPayout).toBeGreaterThanOrEqual(
        result.breakdown.baseEarnings + 
        result.breakdown.perRideAdjustments + 
        result.breakdown.hourlyAdjustments
      );
    });
  });

  describe('Driver Session Management', () => {
    it('should create and retrieve driver session', () => {
      const session = getOrCreateDriverSession('test-driver-1');
      
      expect(session.driverId).toBe('test-driver-1');
      expect(session.ridesCompleted).toBe(0);
      expect(session.totalEarnings).toBe(0);
    });

    it('should record rides and track TLC adjustments', () => {
      getOrCreateDriverSession('test-driver-1');
      
      const rideRecord = recordDriverRide(
        'test-driver-1',
        'ride-001',
        25,
        6,
        12.00
      );

      expect(rideRecord.rideId).toBe('ride-001');
      expect(rideRecord.basePayout).toBe(12.00);
      expect(rideRecord.finalPayout).toBeGreaterThanOrEqual(rideRecord.basePayout);
    });

    it('should accumulate online time', () => {
      getOrCreateDriverSession('test-driver-1');
      
      updateDriverOnlineTime('test-driver-1', 30, 10);
      updateDriverOnlineTime('test-driver-1', 30, 5);
      
      const session = getDriverSession('test-driver-1');
      expect(session?.totalOnlineMinutes).toBe(60);
      expect(session?.totalWaitingMinutes).toBe(15);
    });

    it('should process weekly settlement correctly', () => {
      getOrCreateDriverSession('test-driver-1');
      
      recordDriverRide('test-driver-1', 'ride-001', 20, 5, 15.00);
      recordDriverRide('test-driver-1', 'ride-002', 30, 8, 20.00);
      recordDriverRide('test-driver-1', 'ride-003', 25, 6, 18.00);
      
      updateDriverOnlineTime('test-driver-1', 120, 30);
      
      const weekStart = new Date('2024-01-01');
      const weekEnd = new Date('2024-01-07');
      
      const settlement = processWeeklySettlement('test-driver-1', weekStart, weekEnd);
      
      expect(settlement.totalRides).toBe(3);
      expect(settlement.baseEarnings).toBe(53.00);
      expect(settlement.isCompliant).toBe(true);
    });

    it('should clear session after weekly settlement', () => {
      getOrCreateDriverSession('test-driver-1');
      recordDriverRide('test-driver-1', 'ride-001', 20, 5, 15.00);
      
      processWeeklySettlement('test-driver-1', new Date(), new Date());
      
      const session = getDriverSession('test-driver-1');
      expect(session).toBeUndefined();
    });

    it('should store settlement history', () => {
      getOrCreateDriverSession('test-driver-1');
      recordDriverRide('test-driver-1', 'ride-001', 20, 5, 15.00);
      
      processWeeklySettlement('test-driver-1', new Date(), new Date());
      
      const settlements = getDriverWeeklySettlements('test-driver-1');
      expect(settlements.length).toBe(1);
    });
  });

  describe('TLC Compliance Status', () => {
    it('should return compliant status for new driver', () => {
      const status = getDriverTLCComplianceStatus('new-driver');
      
      expect(status.isCompliant).toBe(true);
      expect(status.pendingAdjustments).toBe(0);
    });

    it('should track pending adjustments', () => {
      getOrCreateDriverSession('test-driver-1');
      
      recordDriverRide('test-driver-1', 'ride-001', 30, 8, 10.00);
      
      const status = getDriverTLCComplianceStatus('test-driver-1');
      expect(status.pendingAdjustments).toBeGreaterThan(0);
    });
  });

  describe('Fare Integration', () => {
    it('should enforce TLC minimum on fare calculation', () => {
      const result = enforceTLCMinimumOnFare(25, 6, 12.00);

      expect(result.tlcDetails).toBeDefined();
      expect(result.finalDriverPayout).toBeGreaterThanOrEqual(12.00);
      
      if (result.tlcMinimumApplied) {
        expect(result.tlcAdjustment).toBeGreaterThan(0);
      }
    });

    it('should not adjust when payout meets TLC minimum', () => {
      const result = enforceTLCMinimumOnFare(15, 4, 30.00);

      expect(result.tlcMinimumApplied).toBe(false);
      expect(result.finalDriverPayout).toBe(30.00);
    });
  });

  describe('Multi-Trip Scenarios', () => {
    it('should handle multiple trips in a session', () => {
      getOrCreateDriverSession('test-driver-1');
      
      const trips = [
        { time: 20, distance: 5, payout: 12.00 },
        { time: 15, distance: 3, payout: 8.00 },
        { time: 30, distance: 10, payout: 22.00 },
        { time: 10, distance: 2, payout: 6.00 },
        { time: 25, distance: 7, payout: 18.00 },
      ];

      let totalAdjustments = 0;
      
      trips.forEach((trip, index) => {
        const record = recordDriverRide(
          'test-driver-1',
          `ride-${index}`,
          trip.time,
          trip.distance,
          trip.payout
        );
        totalAdjustments += record.tlcAdjustment;
      });

      const session = getDriverSession('test-driver-1');
      expect(session?.ridesCompleted).toBe(5);
      expect(session?.totalTLCAdjustments).toBe(totalAdjustments);
    });

    it('should accumulate earnings across trips', () => {
      getOrCreateDriverSession('test-driver-1');
      
      recordDriverRide('test-driver-1', 'ride-1', 20, 5, 15.00);
      recordDriverRide('test-driver-1', 'ride-2', 25, 6, 18.00);
      recordDriverRide('test-driver-1', 'ride-3', 15, 4, 12.00);
      
      const session = getDriverSession('test-driver-1');
      expect(session?.totalEarnings).toBe(45.00);
    });
  });

  describe('Low Utilization Correction', () => {
    it('should correct low utilization scenarios', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 120,
        engagedMinutes: 30,
        totalEarnings: 20.00,
        ridesCompleted: 2,
      });

      expect(result.utilizationRate).toBe(0.25);
      expect(result.tlcHourlyGuaranteeApplied).toBe(true);
      expect(result.adjustmentRequired).toBeGreaterThan(0);
    });

    it('should guarantee hourly minimum regardless of utilization', () => {
      const result = calculateHourlyGuarantee({
        driverId: 'test-driver',
        hourStart: new Date(),
        hourEnd: new Date(),
        totalOnlineMinutes: 60,
        engagedMinutes: 10,
        totalEarnings: 5.00,
        ridesCompleted: 1,
      });

      const finalEarnings = result.actualEarnings + result.adjustmentRequired;
      expect(finalEarnings).toBeCloseTo(27.86, 2);
    });

    it('should apply weekly adjustment for consistently low utilization', () => {
      const result = calculateWeeklyGuarantee({
        driverId: 'test-driver',
        weekStart: new Date(),
        weekEnd: new Date(),
        totalOnlineHours: 40,
        totalEngagedHours: 15,
        totalRides: 20,
        totalEarnings: 400.00,
        perRideAdjustments: 50.00,
        hourlyAdjustments: 100.00,
      });

      expect(result.utilizationRate).toBeCloseTo(0.375, 2);
      expect(result.tlcWeeklyAdjustmentApplied).toBe(true);
    });
  });

  describe('TLC Rate Configuration', () => {
    it('should return correct rate information', () => {
      const rateInfo = getTLCRateInfo();
      
      expect(rateInfo.perMinuteRate).toBe('$0.56/minute');
      expect(rateInfo.perMileRate).toBe('$1.31/mile');
      expect(rateInfo.hourlyMinimumRate).toBe('$27.86/hour');
    });

    it('should have correct default configuration', () => {
      expect(NYC_TLC_CONFIG.perMinuteRate).toBe(0.56);
      expect(NYC_TLC_CONFIG.perMileRate).toBe(1.31);
      expect(NYC_TLC_CONFIG.hourlyMinimumRate).toBe(27.86);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-distance trips', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 5,
        tripDistanceMiles: 0,
        actualDriverPayout: 2.00,
      });

      expect(result.tlcMinimumPay).toBeGreaterThan(0);
    });

    it('should handle very short trips', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 2,
        tripDistanceMiles: 0.5,
        actualDriverPayout: 3.00,
      });

      const expected = Math.max(
        (2 * 0.56) + (0.5 * 1.31),
        (2 / 60) * 27.86
      );

      expect(result.tlcMinimumPay).toBeCloseTo(expected, 2);
    });

    it('should handle very long trips', () => {
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 180,
        tripDistanceMiles: 50,
        actualDriverPayout: 80.00,
      });

      expect(result.tlcMinimumPay).toBeGreaterThan(0);
      expect(result.formula).toBeDefined();
    });

    it('should handle exact minimum payout', () => {
      const tlcMin = (20 * 0.56) + (5 * 1.31);
      const result = calculatePerRideMinimumPay({
        tripTimeMinutes: 20,
        tripDistanceMiles: 5,
        actualDriverPayout: tlcMin,
      });

      expect(result.tlcMinimumApplied).toBe(false);
      expect(result.adjustmentRequired).toBe(0);
    });
  });
});
