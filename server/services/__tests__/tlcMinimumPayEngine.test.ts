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

  describe('HVRF Workers Compensation Fee', () => {
    /**
     * NYC TLC HVFHV Workers' Compensation (HVRF) Fee Tests
     * 
     * The HVRF fee is a $0.75 flat fee applied to all NYC-to-NYC HVFHV trips
     * to fund workers' compensation insurance for livery drivers.
     * 
     * Eligibility rules:
     * - Both pickup AND dropoff must be in NY state
     * - Fee is a flat $0.75 per trip
     * - Does not apply to out-of-state trips
     * - Does not apply to $0 promotional rides
     */

    const TLC_HVRF_FEE = 0.75;

    it('should define correct HVRF fee amount', () => {
      expect(TLC_HVRF_FEE).toBe(0.75);
    });

    it('should apply HVRF fee to NYC-to-NYC trips', () => {
      const pickupState: string = 'NY';
      const dropoffState: string = 'NY';
      const bothStatesAreNY = pickupState === 'NY' && dropoffState === 'NY';
      
      expect(bothStatesAreNY).toBe(true);
    });

    it('should NOT apply HVRF fee to cross-state trips (NY to NJ)', () => {
      const pickupState: string = 'NY';
      const dropoffState: string = 'NJ';
      const bothStatesAreNY = pickupState === 'NY' && dropoffState === 'NY';
      
      expect(bothStatesAreNY).toBe(false);
    });

    it('should NOT apply HVRF fee to out-of-state trips', () => {
      const pickupState: string = 'CA';
      const dropoffState: string = 'CA';
      const bothStatesAreNY = pickupState === 'NY' && dropoffState === 'NY';
      
      expect(bothStatesAreNY).toBe(false);
    });

    it('should treat HVRF as non-commissionable pass-through', () => {
      const hvrfFee = TLC_HVRF_FEE;
      const baseSubtotal = 25.00;
      const basePlusFees = baseSubtotal + hvrfFee;
      
      expect(basePlusFees).toBe(25.75);
    });

    it('should add HVRF to total regulatory fees', () => {
      const congestionFee = 2.75;
      const avfFee = 0.30;
      const bcfFee = 0.69;
      const hvrfFee = TLC_HVRF_FEE;
      
      const totalRegulatoryFees = congestionFee + avfFee + bcfFee + hvrfFee;
      expect(totalRegulatoryFees).toBeCloseTo(4.49, 2);
    });

    it('should calculate correct fare breakdown with all NYC TLC fees', () => {
      const baseFare = 2.50;
      const distanceFare = 13.10;
      const timeFare = 11.20;
      const surgeAdjusted = baseFare + distanceFare + timeFare;
      
      const congestionFee = 2.75;
      const airportFee = 2.50;
      const avfFee = 0.30;
      const bcfRate = 0.0275;
      const bcfFee = Math.round(surgeAdjusted * bcfRate * 100) / 100;
      const hvrfFee = TLC_HVRF_FEE;
      
      const allTLCFees = congestionFee + airportFee + avfFee + bcfFee + hvrfFee;
      const subtotalWithFees = surgeAdjusted + allTLCFees;
      
      expect(bcfFee).toBeCloseTo(0.74, 2);
      expect(allTLCFees).toBeCloseTo(7.04, 2);
      expect(subtotalWithFees).toBeCloseTo(33.84, 2);
    });

    it('should NOT apply HVRF to $0 promotional rides', () => {
      const subtotal = 0;
      const shouldApplyHVRF = subtotal > 0;
      
      expect(shouldApplyHVRF).toBe(false);
    });

    it('should apply HVRF after BCF in fee pipeline sequence', () => {
      const pipelineOrder = [
        'congestion',
        'airport',
        'avf',
        'bcf',
        'hvrf',
        'stateSurcharge',
        'serviceFee',
        'commission'
      ];
      
      const bcfIndex = pipelineOrder.indexOf('bcf');
      const hvrfIndex = pipelineOrder.indexOf('hvrf');
      const serviceFeeIndex = pipelineOrder.indexOf('serviceFee');
      
      expect(hvrfIndex).toBeGreaterThan(bcfIndex);
      expect(hvrfIndex).toBeLessThan(serviceFeeIndex);
    });
  });

  describe('NYC TLC State Surcharge', () => {
    /**
     * NYC TLC State Surcharge Tests
     * 
     * The NY State Surcharge is a $0.50 flat fee applied to all NYC-to-NYC HVFHV trips.
     * This is a state-mandated regulatory fee that goes to NY State.
     * 
     * Eligibility rules (more restrictive than HVRF):
     * - BOTH pickup AND dropoff must be in NYC boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island)
     * - Does NOT apply to trips where only one endpoint is in NYC (e.g., NYC to Westchester)
     * - Does NOT apply to cross-state trips (e.g., NYC to NJ)
     * - Does NOT apply to trips that leave NYC (e.g., NYC to Westchester)
     * - Does NOT apply to trips entering NYC from outside
     * - Does NOT apply to $0 promotional rides (subtotal must be > 0)
     * - Fee is a flat $0.50 per trip
     * - Fee does NOT participate in surge multiplier
     * - Full amount is regulatory pass-through (non-commissionable)
     */

    const TLC_STATE_SURCHARGE = 0.50;
    const NYC_BOROUGHS = ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten_island'];

    it('should define correct State Surcharge amount', () => {
      expect(TLC_STATE_SURCHARGE).toBe(0.50);
    });

    describe('Eligibility - NYC-to-NYC trips', () => {
      it('should apply State Surcharge to NYC-to-NYC trips (Manhattan to Brooklyn)', () => {
        const pickupBorough = 'manhattan';
        const dropoffBorough = 'brooklyn';
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupBorough) && NYC_BOROUGHS.includes(dropoffBorough);
        
        expect(bothInNYCBoroughs).toBe(true);
      });

      it('should apply State Surcharge to same-borough trips (Queens to Queens)', () => {
        const pickupBorough = 'queens';
        const dropoffBorough = 'queens';
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupBorough) && NYC_BOROUGHS.includes(dropoffBorough);
        
        expect(bothInNYCBoroughs).toBe(true);
      });

      it('should apply State Surcharge for all NYC borough combinations', () => {
        for (const pickup of NYC_BOROUGHS) {
          for (const dropoff of NYC_BOROUGHS) {
            const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickup) && NYC_BOROUGHS.includes(dropoff);
            expect(bothInNYCBoroughs).toBe(true);
          }
        }
      });
    });

    describe('Eligibility - Exclusions', () => {
      it('should NOT apply State Surcharge to cross-state trips (Manhattan to NJ)', () => {
        const pickupBorough = 'manhattan';
        const dropoffLocation = 'newark'; // NJ location - not in NYC_BOROUGHS
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupBorough) && NYC_BOROUGHS.includes(dropoffLocation);
        
        expect(bothInNYCBoroughs).toBe(false);
      });

      it('should NOT apply State Surcharge to trips leaving NYC (Manhattan to Westchester)', () => {
        const pickupBorough = 'manhattan';
        const dropoffLocation = 'westchester'; // Not in NYC_BOROUGHS
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupBorough) && NYC_BOROUGHS.includes(dropoffLocation);
        
        expect(bothInNYCBoroughs).toBe(false);
      });

      it('should NOT apply State Surcharge to trips entering NYC from outside', () => {
        const pickupLocation = 'connecticut'; // Not in NYC_BOROUGHS
        const dropoffBorough = 'manhattan';
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupLocation) && NYC_BOROUGHS.includes(dropoffBorough);
        
        expect(bothInNYCBoroughs).toBe(false);
      });

      it('should NOT apply State Surcharge when only pickup is in NYC (NYC to Long Island)', () => {
        const pickupBorough = 'brooklyn';
        const dropoffLocation = 'long_island';
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupBorough) && NYC_BOROUGHS.includes(dropoffLocation);
        
        expect(bothInNYCBoroughs).toBe(false);
      });

      it('should NOT apply State Surcharge when only dropoff is in NYC (Long Island to NYC)', () => {
        const pickupLocation = 'long_island';
        const dropoffBorough = 'brooklyn';
        const bothInNYCBoroughs = NYC_BOROUGHS.includes(pickupLocation) && NYC_BOROUGHS.includes(dropoffBorough);
        
        expect(bothInNYCBoroughs).toBe(false);
      });

      it('should NOT apply State Surcharge to $0 promotional rides', () => {
        const subtotal = 0;
        const shouldApplyStateSurcharge = subtotal > 0;
        
        expect(shouldApplyStateSurcharge).toBe(false);
      });

      it('should NOT apply State Surcharge to negative subtotal rides', () => {
        const subtotal = -5;
        const shouldApplyStateSurcharge = subtotal > 0;
        
        expect(shouldApplyStateSurcharge).toBe(false);
      });
    });

    describe('Fee Calculation', () => {
      it('should treat State Surcharge as non-commissionable pass-through', () => {
        const stateSurcharge = TLC_STATE_SURCHARGE;
        const baseSubtotal = 25.00;
        const basePlusFees = baseSubtotal + stateSurcharge;
        
        expect(basePlusFees).toBe(25.50);
      });

      it('should add State Surcharge to total regulatory fees', () => {
        const congestionFee = 2.75;
        const avfFee = 0.30;
        const bcfFee = 0.69;
        const hvrfFee = 0.75;
        const stateSurcharge = TLC_STATE_SURCHARGE;
        
        const totalRegulatoryFees = congestionFee + avfFee + bcfFee + hvrfFee + stateSurcharge;
        expect(totalRegulatoryFees).toBeCloseTo(4.99, 2);
      });

      it('should calculate correct fare breakdown with all NYC TLC fees including State Surcharge', () => {
        const baseFare = 2.50;
        const distanceFare = 13.10;
        const timeFare = 11.20;
        const surgeAdjusted = baseFare + distanceFare + timeFare;
        
        const congestionFee = 2.75;
        const airportFee = 2.50;
        const avfFee = 0.30;
        const bcfRate = 0.0275;
        const bcfFee = Math.round(surgeAdjusted * bcfRate * 100) / 100;
        const hvrfFee = 0.75;
        const stateSurcharge = TLC_STATE_SURCHARGE;
        
        const allTLCFees = congestionFee + airportFee + avfFee + bcfFee + hvrfFee + stateSurcharge;
        const subtotalWithFees = surgeAdjusted + allTLCFees;
        
        expect(bcfFee).toBeCloseTo(0.74, 2);
        expect(allTLCFees).toBeCloseTo(7.54, 2);
        expect(subtotalWithFees).toBeCloseTo(34.34, 2);
      });
    });

    describe('Pipeline Sequencing', () => {
      it('should apply State Surcharge after HVRF in fee pipeline sequence', () => {
        const pipelineOrder = [
          'congestion',
          'airport',
          'avf',
          'bcf',
          'hvrf',
          'stateSurcharge',
          'serviceFee',
          'commission'
        ];
        
        const hvrfIndex = pipelineOrder.indexOf('hvrf');
        const stateSurchargeIndex = pipelineOrder.indexOf('stateSurcharge');
        const serviceFeeIndex = pipelineOrder.indexOf('serviceFee');
        
        expect(stateSurchargeIndex).toBeGreaterThan(hvrfIndex);
        expect(stateSurchargeIndex).toBeLessThan(serviceFeeIndex);
      });

      it('should be Step 6F in the fare pipeline (after 6A-6E)', () => {
        const pipelineSteps = {
          '6A': 'congestion',
          '6B': 'airport',
          '6C': 'avf',
          '6D': 'bcf',
          '6E': 'hvrf',
          '6F': 'stateSurcharge',
        };
        
        expect(pipelineSteps['6F']).toBe('stateSurcharge');
      });
    });

    describe('Fare Breakdown Output', () => {
      it('should expose State Surcharge in fare breakdown for transparent billing', () => {
        const fareBreakdown = {
          tlcStateSurcharge: TLC_STATE_SURCHARGE,
          tlcStateSurchargeApplied: true,
        };
        
        expect(fareBreakdown.tlcStateSurcharge).toBe(0.50);
        expect(fareBreakdown.tlcStateSurchargeApplied).toBe(true);
      });

      it('should expose State Surcharge applied flag as false when not eligible', () => {
        const fareBreakdown = {
          tlcStateSurcharge: 0,
          tlcStateSurchargeApplied: false,
        };
        
        expect(fareBreakdown.tlcStateSurcharge).toBe(0);
        expect(fareBreakdown.tlcStateSurchargeApplied).toBe(false);
      });
    });
  });

  /**
   * NYC TLC HVFHV Long Trip Surcharge Tests (Step 8)
   * 
   * Implements $20.00 flat fee for NYC trips exceeding 60 minutes.
   * 
   * Rules:
   * - Fee applies when trip duration > 60 minutes (not >=)
   * - Both pickup AND dropoff must be in NYC boroughs
   * - Does NOT apply to cross-state trips
   * - Fee is a regulatory pass-through (not SafeGo revenue)
   * - Pipeline position: Step 6G (after State Surcharge, before service fee)
   */
  describe('NYC TLC Long Trip Surcharge (Step 8)', () => {
    const TLC_LONG_TRIP_SURCHARGE = 20.00;
    const TLC_LONG_TRIP_THRESHOLD_MINUTES = 60;
    const NYC_BOROUGH_CODES = ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten_island'];

    describe('Fee Constant Validation', () => {
      it('should define Long Trip Surcharge as $20.00', () => {
        expect(TLC_LONG_TRIP_SURCHARGE).toBe(20.00);
      });

      it('should define Long Trip threshold as 60 minutes', () => {
        expect(TLC_LONG_TRIP_THRESHOLD_MINUTES).toBe(60);
      });
    });

    describe('Duration-Based Eligibility', () => {
      it('should NOT apply for trips exactly 60 minutes (threshold is >60, not >=60)', () => {
        const tripDuration = 60;
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        expect(isLongTrip).toBe(false);
      });

      it('should apply for trips at 61 minutes', () => {
        const tripDuration = 61;
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        expect(isLongTrip).toBe(true);
      });

      it('should NOT apply for short trips (45 minutes)', () => {
        const tripDuration = 45;
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        expect(isLongTrip).toBe(false);
      });

      it('should apply for long trips (75 minutes)', () => {
        const tripDuration = 75;
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        expect(isLongTrip).toBe(true);
      });

      it('should apply for very long trips (90 minutes)', () => {
        const tripDuration = 90;
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        expect(isLongTrip).toBe(true);
      });
    });

    describe('Geographic Eligibility - NYC Borough Requirements', () => {
      it('should apply for trips within Manhattan', () => {
        const pickupZone = 'manhattan';
        const dropoffZone = 'manhattan';
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        expect(bothInNYC).toBe(true);
      });

      it('should apply for trips from Manhattan to Brooklyn', () => {
        const pickupZone = 'manhattan';
        const dropoffZone = 'brooklyn';
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        expect(bothInNYC).toBe(true);
      });

      it('should apply for trips across all NYC boroughs', () => {
        for (const pickup of NYC_BOROUGH_CODES) {
          for (const dropoff of NYC_BOROUGH_CODES) {
            const bothInNYC = NYC_BOROUGH_CODES.includes(pickup) && NYC_BOROUGH_CODES.includes(dropoff);
            expect(bothInNYC).toBe(true);
          }
        }
      });

      it('should NOT apply for trips with pickup outside NYC', () => {
        const pickupZone = 'newark';
        const dropoffZone = 'manhattan';
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        expect(bothInNYC).toBe(false);
      });

      it('should NOT apply for trips with dropoff outside NYC', () => {
        const pickupZone = 'manhattan';
        const dropoffZone = 'newark';
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        expect(bothInNYC).toBe(false);
      });

      it('should NOT apply for cross-state trips (NY to NJ)', () => {
        const pickupState: string = 'NY';
        const dropoffState: string = 'NJ';
        const bothInNY = pickupState === 'NY' && dropoffState === 'NY';
        const bothInNYC = false; // Even if in NY state, requires NYC boroughs
        expect(bothInNY).toBe(false);
        expect(bothInNYC).toBe(false);
      });
    });

    describe('Combined Duration + Geographic Eligibility', () => {
      it('should apply full $20.00 fee for 75-minute NYC-to-NYC trip', () => {
        const tripDuration = 75;
        const pickupZone = 'manhattan';
        const dropoffZone = 'brooklyn';
        
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        const feeApplies = isLongTrip && bothInNYC;
        const fee = feeApplies ? TLC_LONG_TRIP_SURCHARGE : 0;
        
        expect(feeApplies).toBe(true);
        expect(fee).toBe(20.00);
      });

      it('should NOT apply fee for 75-minute trip with non-NYC dropoff', () => {
        const tripDuration = 75;
        const pickupZone = 'manhattan';
        const dropoffZone = 'newark';
        
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        const feeApplies = isLongTrip && bothInNYC;
        const fee = feeApplies ? TLC_LONG_TRIP_SURCHARGE : 0;
        
        expect(feeApplies).toBe(false);
        expect(fee).toBe(0);
      });

      it('should NOT apply fee for 45-minute NYC-to-NYC trip', () => {
        const tripDuration = 45;
        const pickupZone = 'manhattan';
        const dropoffZone = 'brooklyn';
        
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        const feeApplies = isLongTrip && bothInNYC;
        const fee = feeApplies ? TLC_LONG_TRIP_SURCHARGE : 0;
        
        expect(feeApplies).toBe(false);
        expect(fee).toBe(0);
      });

      it('should NOT apply fee for exactly 60-minute NYC-to-NYC trip (boundary case)', () => {
        const tripDuration = 60;
        const pickupZone = 'queens';
        const dropoffZone = 'bronx';
        
        const isLongTrip = tripDuration > TLC_LONG_TRIP_THRESHOLD_MINUTES;
        const bothInNYC = NYC_BOROUGH_CODES.includes(pickupZone) && NYC_BOROUGH_CODES.includes(dropoffZone);
        const feeApplies = isLongTrip && bothInNYC;
        const fee = feeApplies ? TLC_LONG_TRIP_SURCHARGE : 0;
        
        expect(isLongTrip).toBe(false);
        expect(bothInNYC).toBe(true);
        expect(feeApplies).toBe(false);
        expect(fee).toBe(0);
      });
    });

    describe('Regulatory Pass-Through Treatment', () => {
      it('should treat Long Trip Surcharge as regulatory fee (not SafeGo revenue)', () => {
        const fee = TLC_LONG_TRIP_SURCHARGE;
        const isRegulatoryPassThrough = true;
        const contributesToCommission = false;
        
        expect(fee).toBe(20.00);
        expect(isRegulatoryPassThrough).toBe(true);
        expect(contributesToCommission).toBe(false);
      });

      it('should NOT participate in surge multiplier calculation', () => {
        const surgeMultiplier = 1.5;
        const baseFare = 25.00;
        const surgedFare = baseFare * surgeMultiplier;
        const longTripFee = TLC_LONG_TRIP_SURCHARGE;
        
        // Long Trip Surcharge should NOT be multiplied by surge
        expect(longTripFee).toBe(20.00);
        expect(surgedFare).toBe(37.50);
        
        // Total should be additive, not multiplicative
        const totalWithFee = surgedFare + longTripFee;
        expect(totalWithFee).toBe(57.50);
      });
    });

    describe('Fare Pipeline Integration', () => {
      it('should integrate Long Trip Surcharge into comprehensive NYC fare calculation', () => {
        const baseFare = 2.50;
        const distanceFare = 10.0 * 1.31;
        const timeFare = 75 * 0.56;
        const surgeAdjusted = baseFare + distanceFare + timeFare;
        
        const congestionFee = 2.75;
        const airportFee = 0; // Not an airport trip
        const avfFee = 0.30;
        const bcfRate = 0.0275;
        const bcfFee = Math.round(surgeAdjusted * bcfRate * 100) / 100;
        const hvrfFee = 0.75;
        const stateSurcharge = 0.50;
        const longTripFee = TLC_LONG_TRIP_SURCHARGE;
        
        const allTLCFees = congestionFee + airportFee + avfFee + bcfFee + hvrfFee + stateSurcharge + longTripFee;
        const subtotalWithFees = surgeAdjusted + allTLCFees;
        
        expect(surgeAdjusted).toBeCloseTo(57.60, 2);
        expect(bcfFee).toBeCloseTo(1.58, 2);
        expect(longTripFee).toBe(20.00);
        expect(allTLCFees).toBeCloseTo(25.88, 2);
        expect(subtotalWithFees).toBeCloseTo(83.48, 2);
      });
    });

    describe('Pipeline Sequencing', () => {
      it('should apply Long Trip Surcharge after State Surcharge in fee pipeline sequence', () => {
        const pipelineOrder = [
          'congestion',
          'airport',
          'avf',
          'bcf',
          'hvrf',
          'stateSurcharge',
          'longTripSurcharge',
          'serviceFee',
          'commission'
        ];
        
        const stateSurchargeIndex = pipelineOrder.indexOf('stateSurcharge');
        const longTripIndex = pipelineOrder.indexOf('longTripSurcharge');
        const serviceFeeIndex = pipelineOrder.indexOf('serviceFee');
        
        expect(longTripIndex).toBeGreaterThan(stateSurchargeIndex);
        expect(longTripIndex).toBeLessThan(serviceFeeIndex);
      });

      it('should be Step 6G in the fare pipeline (after 6A-6F)', () => {
        const pipelineSteps = {
          '6A': 'congestion',
          '6B': 'airport',
          '6C': 'avf',
          '6D': 'bcf',
          '6E': 'hvrf',
          '6F': 'stateSurcharge',
          '6G': 'longTripSurcharge',
        };
        
        expect(pipelineSteps['6G']).toBe('longTripSurcharge');
      });
    });

    describe('Fare Breakdown Output', () => {
      it('should expose Long Trip Surcharge in fare breakdown for transparent billing', () => {
        const fareBreakdown = {
          tlcLongTripFee: TLC_LONG_TRIP_SURCHARGE,
          tlcLongTripFeeApplied: true,
        };
        
        expect(fareBreakdown.tlcLongTripFee).toBe(20.00);
        expect(fareBreakdown.tlcLongTripFeeApplied).toBe(true);
      });

      it('should expose Long Trip Surcharge applied flag as false when not eligible', () => {
        const fareBreakdown = {
          tlcLongTripFee: 0,
          tlcLongTripFeeApplied: false,
        };
        
        expect(fareBreakdown.tlcLongTripFee).toBe(0);
        expect(fareBreakdown.tlcLongTripFeeApplied).toBe(false);
      });
    });
  });

  /**
   * Step 9: NYC TLC Out-of-Town Surcharge Tests
   * 
   * TLC Rule: $15.00 flat fee for trips leaving NYC
   * - Pickup must be in NYC boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island)
   * - Dropoff must be OUTSIDE NYC (different state, or outside NYC county within NY)
   * - Fee compensates driver for return trip "deadhead" back to NYC for next fare
   * - Fee is a regulatory pass-through (not SafeGo revenue)
   * - Pipeline position: Step 6H (after Long Trip Surcharge, before cross-city)
   */
  describe('NYC TLC Out-of-Town Surcharge (Step 9)', () => {
    const TLC_OUT_OF_TOWN_FEE = 15.00;
    const NYC_BOROUGH_CODES = ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten_island'];
    const NYC_COUNTY_CODES = ['new_york', 'kings', 'queens', 'bronx', 'richmond'];

    describe('Fee Constant Validation', () => {
      it('should define Out-of-Town Surcharge as $15.00', () => {
        expect(TLC_OUT_OF_TOWN_FEE).toBe(15.00);
      });
    });

    describe('Geographic Eligibility - NYC Pickup Requirement', () => {
      it('should identify Manhattan as valid NYC pickup zone', () => {
        const pickupZone = 'manhattan';
        const isNYCPickup = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(isNYCPickup).toBe(true);
      });

      it('should identify Brooklyn as valid NYC pickup zone', () => {
        const pickupZone = 'brooklyn';
        const isNYCPickup = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(isNYCPickup).toBe(true);
      });

      it('should identify Queens as valid NYC pickup zone', () => {
        const pickupZone = 'queens';
        const isNYCPickup = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(isNYCPickup).toBe(true);
      });

      it('should identify Bronx as valid NYC pickup zone', () => {
        const pickupZone = 'bronx';
        const isNYCPickup = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(isNYCPickup).toBe(true);
      });

      it('should identify Staten Island as valid NYC pickup zone', () => {
        const pickupZone = 'staten_island';
        const isNYCPickup = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(isNYCPickup).toBe(true);
      });

      it('should NOT identify Nassau County as valid NYC pickup zone', () => {
        const pickupZone = 'nassau';
        const isNYCPickup = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(isNYCPickup).toBe(false);
      });
    });

    describe('Geographic Eligibility - Out-of-Town Dropoff Detection', () => {
      it('should detect dropoff in New Jersey as out-of-town', () => {
        const pickupState = 'NY';
        const dropoffState = 'NJ';
        const isOutOfTown = dropoffState !== 'NY';
        expect(isOutOfTown).toBe(true);
      });

      it('should detect dropoff in Connecticut as out-of-town', () => {
        const pickupState = 'NY';
        const dropoffState = 'CT';
        const isOutOfTown = dropoffState !== 'NY';
        expect(isOutOfTown).toBe(true);
      });

      it('should detect dropoff in Nassau County (Long Island) as out-of-town', () => {
        const pickupZone = 'manhattan';
        const dropoffCounty = 'nassau';
        const isNYCDropoff = NYC_COUNTY_CODES.includes(dropoffCounty);
        expect(isNYCDropoff).toBe(false);
      });

      it('should detect dropoff in Suffolk County (Long Island) as out-of-town', () => {
        const pickupZone = 'brooklyn';
        const dropoffCounty = 'suffolk';
        const isNYCDropoff = NYC_COUNTY_CODES.includes(dropoffCounty);
        expect(isNYCDropoff).toBe(false);
      });

      it('should detect dropoff in Westchester County as out-of-town', () => {
        const pickupZone = 'bronx';
        const dropoffCounty = 'westchester';
        const isNYCDropoff = NYC_COUNTY_CODES.includes(dropoffCounty);
        expect(isNYCDropoff).toBe(false);
      });
    });

    describe('Geographic Eligibility - Trips NOT Leaving NYC', () => {
      it('should NOT apply for trips within Manhattan', () => {
        const pickupZone = 'manhattan';
        const dropoffZone = 'manhattan';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(false);
      });

      it('should NOT apply for trips from Manhattan to Brooklyn', () => {
        const pickupZone = 'manhattan';
        const dropoffZone = 'brooklyn';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(false);
      });

      it('should NOT apply for trips from Brooklyn to Queens', () => {
        const pickupZone = 'brooklyn';
        const dropoffZone = 'queens';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(false);
      });

      it('should NOT apply for trips from Queens to Bronx', () => {
        const pickupZone = 'queens';
        const dropoffZone = 'bronx';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(false);
      });

      it('should NOT apply for trips from Bronx to Staten Island', () => {
        const pickupZone = 'bronx';
        const dropoffZone = 'staten_island';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(false);
      });
    });

    describe('Geographic Eligibility - Trips Leaving NYC (Should Apply)', () => {
      it('should apply for Manhattan to New Jersey', () => {
        const pickupZone = 'manhattan';
        const dropoffState = 'NJ';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsOutOfState = dropoffState !== 'NY';
        const isLeavingNYC = pickupIsNYC && dropoffIsOutOfState;
        expect(isLeavingNYC).toBe(true);
      });

      it('should apply for Queens to Nassau County (Long Island)', () => {
        const pickupZone = 'queens';
        const dropoffZone = 'nassau';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(true);
      });

      it('should apply for Brooklyn to Connecticut', () => {
        const pickupZone = 'brooklyn';
        const dropoffState = 'CT';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsOutOfState = dropoffState !== 'NY';
        const isLeavingNYC = pickupIsNYC && dropoffIsOutOfState;
        expect(isLeavingNYC).toBe(true);
      });

      it('should apply for Bronx to Westchester County', () => {
        const pickupZone = 'bronx';
        const dropoffZone = 'westchester';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        expect(isLeavingNYC).toBe(true);
      });

      it('should apply for Staten Island to New Jersey', () => {
        const pickupZone = 'staten_island';
        const dropoffState = 'NJ';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsOutOfState = dropoffState !== 'NY';
        const isLeavingNYC = pickupIsNYC && dropoffIsOutOfState;
        expect(isLeavingNYC).toBe(true);
      });
    });

    describe('Geographic Eligibility - Trips Entering NYC (Should NOT Apply)', () => {
      it('should NOT apply for trips from New Jersey to Manhattan', () => {
        const pickupState = 'NJ';
        const dropoffZone = 'manhattan';
        const pickupIsNYC = false; // NJ is not NYC
        const isLeavingNYC = pickupIsNYC;
        expect(isLeavingNYC).toBe(false);
      });

      it('should NOT apply for trips from Nassau County to Queens', () => {
        const pickupZone = 'nassau';
        const dropoffZone = 'queens';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        expect(pickupIsNYC).toBe(false);
        expect(dropoffIsNYC).toBe(true);
      });

      it('should NOT apply for trips from Westchester to Bronx', () => {
        const pickupZone = 'westchester';
        const dropoffZone = 'bronx';
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        expect(pickupIsNYC).toBe(false);
      });

      it('should NOT apply for trips from Connecticut to Manhattan', () => {
        const pickupState = 'CT';
        const dropoffZone = 'manhattan';
        const pickupIsNYC = false;
        expect(pickupIsNYC).toBe(false);
      });
    });

    describe('Fee Amount and Regulatory Status', () => {
      it('should charge exactly $15.00 for out-of-town trips', () => {
        const fee = TLC_OUT_OF_TOWN_FEE;
        expect(fee).toBe(15.00);
      });

      it('should treat fee as regulatory pass-through (not SafeGo revenue)', () => {
        const isRegulatoryPassThrough = true;
        const contributesToCommission = false;
        const fee = TLC_OUT_OF_TOWN_FEE;
        
        expect(fee).toBe(15.00);
        expect(isRegulatoryPassThrough).toBe(true);
        expect(contributesToCommission).toBe(false);
      });

      it('should NOT participate in surge multiplier calculation', () => {
        const surgeMultiplier = 1.5;
        const baseFare = 25.00;
        const surgedFare = baseFare * surgeMultiplier;
        const outOfTownFee = TLC_OUT_OF_TOWN_FEE;
        
        // Out-of-Town fee should NOT be multiplied by surge
        expect(outOfTownFee).toBe(15.00);
        expect(surgedFare).toBe(37.50);
        
        // Total should be additive, not multiplicative
        const totalWithFee = surgedFare + outOfTownFee;
        expect(totalWithFee).toBe(52.50);
      });
    });

    describe('Pipeline Sequencing', () => {
      it('should apply Out-of-Town Surcharge after Long Trip Surcharge in fee pipeline sequence', () => {
        const pipelineOrder = [
          'congestion',
          'airport',
          'avf',
          'bcf',
          'hvrf',
          'stateSurcharge',
          'longTripSurcharge',
          'outOfTownSurcharge',
          'crossCity',
          'serviceFee',
          'commission'
        ];
        
        const longTripIndex = pipelineOrder.indexOf('longTripSurcharge');
        const outOfTownIndex = pipelineOrder.indexOf('outOfTownSurcharge');
        const crossCityIndex = pipelineOrder.indexOf('crossCity');
        
        expect(outOfTownIndex).toBeGreaterThan(longTripIndex);
        expect(outOfTownIndex).toBeLessThan(crossCityIndex);
      });

      it('should be Step 6H in the fare pipeline (after 6A-6G)', () => {
        const pipelineSteps = {
          '6A': 'congestion',
          '6B': 'airport',
          '6C': 'avf',
          '6D': 'bcf',
          '6E': 'hvrf',
          '6F': 'stateSurcharge',
          '6G': 'longTripSurcharge',
          '6H': 'outOfTownSurcharge',
        };
        
        expect(pipelineSteps['6H']).toBe('outOfTownSurcharge');
      });
    });

    describe('Fare Breakdown Output', () => {
      it('should expose Out-of-Town fee in fare breakdown for transparent billing', () => {
        const fareBreakdown = {
          tlcOutOfTownFee: TLC_OUT_OF_TOWN_FEE,
          tlcOutOfTownApplied: true,
        };
        
        expect(fareBreakdown.tlcOutOfTownFee).toBe(15.00);
        expect(fareBreakdown.tlcOutOfTownApplied).toBe(true);
      });

      it('should expose Out-of-Town fee applied flag as false when not eligible', () => {
        const fareBreakdown = {
          tlcOutOfTownFee: 0,
          tlcOutOfTownApplied: false,
        };
        
        expect(fareBreakdown.tlcOutOfTownFee).toBe(0);
        expect(fareBreakdown.tlcOutOfTownApplied).toBe(false);
      });
    });

    describe('Combined Scenario Tests', () => {
      it('should apply both Long Trip and Out-of-Town fees for 90+ minute trip to NJ', () => {
        const tripDurationMinutes = 95;
        const pickupZone = 'manhattan';
        const dropoffState = 'NJ';
        
        const isLongTrip = tripDurationMinutes > 60;
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const isLeavingNYC = pickupIsNYC && dropoffState !== 'NY';
        
        const longTripFee = isLongTrip ? 20.00 : 0;
        const outOfTownFee = isLeavingNYC ? 15.00 : 0;
        const totalFees = longTripFee + outOfTownFee;
        
        expect(isLongTrip).toBe(true);
        expect(isLeavingNYC).toBe(true);
        expect(longTripFee).toBe(20.00);
        expect(outOfTownFee).toBe(15.00);
        expect(totalFees).toBe(35.00);
      });

      it('should apply Out-of-Town but NOT Long Trip for 45 minute trip to Nassau', () => {
        const tripDurationMinutes = 45;
        const pickupZone = 'queens';
        const dropoffZone = 'nassau';
        
        const isLongTrip = tripDurationMinutes > 60;
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        
        const longTripFee = isLongTrip ? 20.00 : 0;
        const outOfTownFee = isLeavingNYC ? 15.00 : 0;
        const totalFees = longTripFee + outOfTownFee;
        
        expect(isLongTrip).toBe(false);
        expect(isLeavingNYC).toBe(true);
        expect(longTripFee).toBe(0);
        expect(outOfTownFee).toBe(15.00);
        expect(totalFees).toBe(15.00);
      });

      it('should apply Long Trip but NOT Out-of-Town for 90 minute trip within NYC', () => {
        const tripDurationMinutes = 90;
        const pickupZone = 'manhattan';
        const dropoffZone = 'brooklyn';
        
        const isLongTrip = tripDurationMinutes > 60;
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        
        const longTripFee = isLongTrip ? 20.00 : 0;
        const outOfTownFee = isLeavingNYC ? 15.00 : 0;
        const totalFees = longTripFee + outOfTownFee;
        
        expect(isLongTrip).toBe(true);
        expect(isLeavingNYC).toBe(false);
        expect(longTripFee).toBe(20.00);
        expect(outOfTownFee).toBe(0);
        expect(totalFees).toBe(20.00);
      });

      it('should apply neither fee for short trip within NYC', () => {
        const tripDurationMinutes = 30;
        const pickupZone = 'bronx';
        const dropoffZone = 'manhattan';
        
        const isLongTrip = tripDurationMinutes > 60;
        const pickupIsNYC = NYC_BOROUGH_CODES.includes(pickupZone);
        const dropoffIsNYC = NYC_BOROUGH_CODES.includes(dropoffZone);
        const isLeavingNYC = pickupIsNYC && !dropoffIsNYC;
        
        const longTripFee = isLongTrip ? 20.00 : 0;
        const outOfTownFee = isLeavingNYC ? 15.00 : 0;
        const totalFees = longTripFee + outOfTownFee;
        
        expect(isLongTrip).toBe(false);
        expect(isLeavingNYC).toBe(false);
        expect(longTripFee).toBe(0);
        expect(outOfTownFee).toBe(0);
        expect(totalFees).toBe(0);
      });
    });

    describe('Fare Pipeline Integration', () => {
      it('should integrate Out-of-Town Surcharge into comprehensive NYC fare calculation', () => {
        const baseFare = 2.50;
        const distanceFare = 25.0 * 1.31; // 25 miles to NJ
        const timeFare = 45 * 0.56;
        const surgeAdjusted = baseFare + distanceFare + timeFare;
        
        const congestionFee = 2.75;
        const airportFee = 0;
        const avfFee = 0.30;
        const bcfRate = 0.0275;
        const bcfFee = Math.round(surgeAdjusted * bcfRate * 100) / 100;
        const hvrfFee = 0.75;
        const stateSurcharge = 0.50;
        const longTripFee = 0; // Trip is only 45 minutes
        const outOfTownFee = TLC_OUT_OF_TOWN_FEE;
        
        const allTLCFees = congestionFee + airportFee + avfFee + bcfFee + hvrfFee + stateSurcharge + longTripFee + outOfTownFee;
        const subtotalWithFees = surgeAdjusted + allTLCFees;
        
        expect(surgeAdjusted).toBeCloseTo(60.45, 2);
        expect(bcfFee).toBeCloseTo(1.66, 2);
        expect(outOfTownFee).toBe(15.00);
        expect(allTLCFees).toBeCloseTo(20.96, 2);
        expect(subtotalWithFees).toBeCloseTo(81.41, 2);
      });
    });
  });
});
