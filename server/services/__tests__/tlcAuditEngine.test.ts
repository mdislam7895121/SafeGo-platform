/**
 * TLC Audit & Reconciliation Engine Test Suite
 * 
 * Comprehensive test coverage (70+ test cases) for NYC TLC HVFHV audit compliance:
 * - Fare mismatch detection
 * - Driver pay mismatch detection
 * - Wrong toll direction
 * - Airport wrong fee application
 * - AVF/BCF/HVRF errors
 * - Long-trip surcharge timing/eligibility
 * - Out-of-town return fee validation
 * - Combined complex scenarios
 * 
 * Uses deterministic mock data for reliable test execution.
 */

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
  applyAutoFixes,
  reconcileTrip,
  autoReconcile,
  exportAuditResults,
  generateAuditLogEntry,
  haversineDistance,
  isInBorough,
  detectBorough,
  isInCongestionZone,
  isAtAirport,
  calculateDurationMinutes,
  roundCurrency,
  TLC_FEES,
  AUDIT_TOLERANCES,
  NYC_BOROUGHS,
  AIRPORT_ZONES,
  MANHATTAN_CONGESTION_ZONE,
  AuditSeverity,
  AuditCategory,
  FixStatus,
  AuditFilters,
} from '../tlcAuditEngine';

import { TripRecordReport, BoroughCode, TripCategory, AirportCode } from '../tlcReportGenerator';
import { NYC_TLC_CONFIG } from '../tlcMinimumPayEngine';

// ============================================
// Mock Trip Factory
// ============================================

const createMockTrip = (overrides: Partial<TripRecordReport> = {}): TripRecordReport => ({
  tripId: `TRP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
  driverId: 'driver-1',
  vehicleId: 'VEH-001',
  pickupTime: new Date('2025-11-15T10:00:00Z'),
  dropoffTime: new Date('2025-11-15T10:30:00Z'),
  pickupLocation: { lat: 40.7484, lng: -73.9857, borough: 'MANHATTAN' as BoroughCode },
  dropoffLocation: { lat: 40.6892, lng: -73.9442, borough: 'BROOKLYN' as BoroughCode },
  tripDistanceMiles: 5.2,
  tripDurationMinutes: 30,
  fareSubtotal: 28.50,
  tolls: 6.55,
  congestionFee: 2.75,
  airportFee: 0,
  avfFee: 0.125,
  bcfFee: 0.625,
  hvrfFee: 0.05,
  stateSurcharge: 2.50,
  longTripSurcharge: 0,
  outOfTownReturnFee: 0,
  promoUsed: false,
  discountAmount: 0,
  finalFare: 41.10,
  driverPayout: 22.68,
  commissionAmount: 7.13,
  tripCategory: 'INTER_BOROUGH' as TripCategory,
  tlcMinimumApplied: false,
  tlcAdjustment: 0,
  isAccessibleVehicle: false,
  isWheelchairTrip: false,
  reportGeneratedAt: new Date(),
  ...overrides,
});

// ============================================
// Utility Function Tests
// ============================================

describe('TLC Audit Engine - Utility Functions', () => {
  describe('haversineDistance', () => {
    it('should calculate distance between two NYC points correctly', () => {
      const distance = haversineDistance(40.7484, -73.9857, 40.6892, -73.9442);
      expect(distance).toBeGreaterThan(4);
      expect(distance).toBeLessThan(6);
    });

    it('should return 0 for same coordinates', () => {
      const distance = haversineDistance(40.7484, -73.9857, 40.7484, -73.9857);
      expect(distance).toBe(0);
    });

    it('should calculate JFK to Manhattan distance', () => {
      const distance = haversineDistance(40.6413, -73.7781, 40.7580, -73.9855);
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(15);
    });
  });

  describe('roundCurrency', () => {
    it('should round to 2 decimal places', () => {
      expect(roundCurrency(10.125)).toBe(10.13);
      expect(roundCurrency(10.124)).toBe(10.12);
      expect(roundCurrency(10.1)).toBe(10.1);
    });
  });

  describe('detectBorough', () => {
    it('should detect Manhattan correctly', () => {
      expect(detectBorough(40.7580, -73.9855)).toBe('MANHATTAN');
    });

    it('should detect Brooklyn correctly', () => {
      expect(detectBorough(40.6782, -73.9442)).toBe('BROOKLYN');
    });

    it('should detect Queens correctly', () => {
      expect(detectBorough(40.7282, -73.7949)).toBe('QUEENS');
    });

    it('should detect out-of-NYC for distant coordinates', () => {
      expect(detectBorough(40.0, -74.5)).toBe('OUT_OF_NYC');
    });
  });

  describe('isInCongestionZone', () => {
    it('should detect Manhattan congestion zone correctly', () => {
      expect(isInCongestionZone(40.7505, -73.9934)).toBe(true);
      expect(isInCongestionZone(40.7128, -74.0060)).toBe(true);
    });

    it('should return false for areas outside congestion zone', () => {
      expect(isInCongestionZone(40.8000, -73.9500)).toBe(false);
      expect(isInCongestionZone(40.6892, -73.9442)).toBe(false);
    });
  });

  describe('isAtAirport', () => {
    it('should detect JFK airport correctly', () => {
      expect(isAtAirport(40.6413, -73.7781)).toBe('JFK');
    });

    it('should detect LGA airport correctly', () => {
      expect(isAtAirport(40.7769, -73.8740)).toBe('LGA');
    });

    it('should return null for non-airport locations', () => {
      expect(isAtAirport(40.7580, -73.9855)).toBeNull();
    });
  });

  describe('calculateDurationMinutes', () => {
    it('should calculate duration correctly', () => {
      const pickup = new Date('2025-11-15T10:00:00Z');
      const dropoff = new Date('2025-11-15T10:30:00Z');
      expect(calculateDurationMinutes(pickup, dropoff)).toBe(30);
    });

    it('should handle negative duration', () => {
      const pickup = new Date('2025-11-15T10:30:00Z');
      const dropoff = new Date('2025-11-15T10:00:00Z');
      expect(calculateDurationMinutes(pickup, dropoff)).toBe(-30);
    });
  });
});

// ============================================
// Fare Consistency Tests
// ============================================

describe('TLC Audit Engine - Fare Consistency', () => {
  it('should validate correct fare calculation', () => {
    const trip = createMockTrip({
      fareSubtotal: 25.00,
      tolls: 5.00,
      congestionFee: 2.75,
      airportFee: 0,
      avfFee: 0.125,
      bcfFee: 0.625,
      hvrfFee: 0.05,
      stateSurcharge: 2.50,
      longTripSurcharge: 0,
      outOfTownReturnFee: 0,
      discountAmount: 0,
      finalFare: 36.05,
    });
    
    const result = auditFareConsistency(trip);
    expect(result.isValid).toBe(true);
    expect(result.variance).toBe(0);
  });

  it('should detect fare mismatch', () => {
    const trip = createMockTrip({
      fareSubtotal: 25.00,
      tolls: 5.00,
      congestionFee: 2.75,
      avfFee: 0.125,
      bcfFee: 0.625,
      hvrfFee: 0.05,
      stateSurcharge: 2.50,
      finalFare: 40.00, // Wrong: should be 36.05
    });
    
    const result = auditFareConsistency(trip);
    expect(result.isValid).toBe(false);
    expect(result.variance).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect zero or negative duration', () => {
    const trip = createMockTrip({ tripDurationMinutes: 0 });
    const result = auditFareConsistency(trip);
    expect(result.errors).toContain('Invalid trip duration: zero or negative');
  });

  it('should detect negative distance', () => {
    const trip = createMockTrip({ tripDistanceMiles: -5 });
    const result = auditFareConsistency(trip);
    expect(result.errors).toContain('Invalid trip distance: negative value');
  });

  it('should validate component breakdown matches', () => {
    const trip = createMockTrip();
    const result = auditFareConsistency(trip);
    expect(result.componentBreakdown).toBeDefined();
    expect(result.componentBreakdown.fareSubtotal).toBe(trip.fareSubtotal);
  });

  it('should detect discount not applied correctly', () => {
    const trip = createMockTrip({
      fareSubtotal: 30.00,
      tolls: 0,
      congestionFee: 0,
      avfFee: 0.125,
      bcfFee: 0.625,
      hvrfFee: 0.05,
      stateSurcharge: 2.50,
      discountAmount: 5.00,
      finalFare: 33.30, // Should be 28.30 after discount
    });
    
    const result = auditFareConsistency(trip);
    expect(result.isValid).toBe(false);
  });

  it('should handle all-zero fees correctly', () => {
    const trip = createMockTrip({
      fareSubtotal: 20.00,
      tolls: 0,
      congestionFee: 0,
      airportFee: 0,
      avfFee: 0,
      bcfFee: 0,
      hvrfFee: 0,
      stateSurcharge: 0,
      longTripSurcharge: 0,
      outOfTownReturnFee: 0,
      discountAmount: 0,
      finalFare: 20.00,
    });
    
    const result = auditFareConsistency(trip);
    expect(result.isValid).toBe(true);
  });
});

// ============================================
// Driver Pay Consistency Tests
// ============================================

describe('TLC Audit Engine - Driver Pay Consistency', () => {
  it('should validate driver pay meets TLC minimum', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 30,
      tripDistanceMiles: 8,
      driverPayout: 30.00, // Above minimum
    });
    
    const result = auditDriverPayConsistency(trip);
    expect(result.tlcMinimumCheck.meetsMinimum).toBe(true);
  });

  it('should detect underpaid driver', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 30,
      tripDistanceMiles: 8,
      driverPayout: 15.00, // Below minimum
    });
    
    const result = auditDriverPayConsistency(trip);
    expect(result.tlcMinimumCheck.meetsMinimum).toBe(false);
    expect(result.tlcMinimumCheck.adjustmentRequired).toBeGreaterThan(0);
  });

  it('should calculate correct TLC time-based minimum', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 30,
      tripDistanceMiles: 5,
      driverPayout: 25.00,
    });
    
    const result = auditDriverPayConsistency(trip);
    const expectedTimeMin = 30 * NYC_TLC_CONFIG.perMinuteRate + 5 * NYC_TLC_CONFIG.perMileRate;
    expect(result.tlcMinimumCheck.timeBasedMinimum).toBeCloseTo(expectedTimeMin, 2);
  });

  it('should calculate correct hourly equivalent minimum', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 60,
      tripDistanceMiles: 5,
      driverPayout: 30.00,
    });
    
    const result = auditDriverPayConsistency(trip);
    const expectedHourlyMin = NYC_TLC_CONFIG.hourlyMinimumRate;
    expect(result.tlcMinimumCheck.hourlyEquivalentMinimum).toBeCloseTo(expectedHourlyMin, 2);
  });

  it('should detect TLC adjustment mismatch', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 30,
      tripDistanceMiles: 5,
      driverPayout: 20.00,
      tlcMinimumApplied: true,
      tlcAdjustment: 1.00, // Wrong adjustment
    });
    
    const result = auditDriverPayConsistency(trip);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate driver payout with bonuses', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 25,
      tripDistanceMiles: 6,
      driverPayout: 35.00,
    });
    
    const result = auditDriverPayConsistency(trip);
    expect(result.bonusesValid).toBe(true);
  });
});

// ============================================
// Location & Zone Accuracy Tests
// ============================================

describe('TLC Audit Engine - Location & Zone Accuracy', () => {
  it('should validate correct borough assignment', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7580, lng: -73.9855, borough: 'MANHATTAN' as BoroughCode },
      dropoffLocation: { lat: 40.6782, lng: -73.9442, borough: 'BROOKLYN' as BoroughCode },
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.pickupBoroughValid).toBe(true);
    expect(result.dropoffBoroughValid).toBe(true);
  });

  it('should detect incorrect pickup borough', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7580, lng: -73.9855, borough: 'BROOKLYN' as BoroughCode },
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.pickupBoroughValid).toBe(false);
    expect(result.computedPickupBorough).toBe('MANHATTAN');
  });

  it('should detect incorrect dropoff borough', () => {
    const trip = createMockTrip({
      dropoffLocation: { lat: 40.6782, lng: -73.9442, borough: 'QUEENS' as BoroughCode },
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.dropoffBoroughValid).toBe(false);
    expect(result.computedDropoffBorough).toBe('BROOKLYN');
  });

  it('should validate Manhattan congestion zone detection', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7505, lng: -73.9934, borough: 'MANHATTAN' as BoroughCode },
      congestionFee: 2.75,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.congestionZoneValid).toBe(true);
  });

  it('should detect missing congestion fee for Manhattan trip', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7505, lng: -73.9934, borough: 'MANHATTAN' as BoroughCode },
      congestionFee: 0,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.errors).toContain('Missing congestion fee for Manhattan congestion zone trip');
  });

  it('should validate airport zone detection for JFK', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      airportFee: 5.00,
      airportCode: 'JFK' as AirportCode,
      tripCategory: 'AIRPORT_PICKUP' as TripCategory,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.airportZoneValid).toBe(true);
  });

  it('should detect missing airport fee for airport trip', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      airportFee: 0,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.errors.some(e => e.includes('Missing airport fee for JFK'))).toBe(true);
  });

  it('should detect incorrect congestion fee rate', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7505, lng: -73.9934, borough: 'MANHATTAN' as BoroughCode },
      congestionFee: 1.50, // Wrong rate, should be $2.75
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.congestionZoneValid).toBe(false);
    expect(result.errors.some(e => e.includes('Congestion fee mismatch'))).toBe(true);
  });

  it('should detect incorrect airport fee rate', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      airportFee: 3.00, // Wrong rate, should be $5.00
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.airportZoneValid).toBe(false);
    expect(result.errors.some(e => e.includes('Airport fee mismatch'))).toBe(true);
  });

  it('should detect congestion fee applied to non-congestion zone trip', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6782, lng: -73.9442, borough: 'BROOKLYN' as BoroughCode },
      dropoffLocation: { lat: 40.7282, lng: -73.7949, borough: 'QUEENS' as BoroughCode },
      congestionFee: 2.75, // Applied but not in congestion zone
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.congestionZoneValid).toBe(false);
    expect(result.errors.some(e => e.includes('not in Manhattan congestion zone'))).toBe(true);
  });

  it('should detect missing long trip surcharge for >20mi trip', () => {
    const trip = createMockTrip({
      tripDistanceMiles: 25,
      longTripSurcharge: 0,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.errors.some(e => e.includes('Missing long trip surcharge'))).toBe(true);
  });

  it('should detect incorrect long trip surcharge rate', () => {
    const trip = createMockTrip({
      tripDistanceMiles: 25,
      longTripSurcharge: 1.50, // Wrong rate, should be $2.50
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.errors.some(e => e.includes('Long trip surcharge mismatch'))).toBe(true);
  });

  it('should validate out-of-town trip detection', () => {
    const trip = createMockTrip({
      dropoffLocation: { lat: 40.0, lng: -74.5, borough: 'OUT_OF_NYC' as BoroughCode },
      outOfTownReturnFee: 17.50,
      tripCategory: 'NYC_TO_OOS' as TripCategory,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.outOfTownValid).toBe(true);
  });

  it('should detect incorrect out-of-town fee rate', () => {
    const trip = createMockTrip({
      dropoffLocation: { lat: 40.0, lng: -74.5, borough: 'OUT_OF_NYC' as BoroughCode },
      outOfTownReturnFee: 10.00, // Wrong rate, should be $17.50
      tripCategory: 'NYC_TO_OOS' as TripCategory,
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.outOfTownValid).toBe(false);
    expect(result.errors.some(e => e.includes('Out-of-town return fee mismatch'))).toBe(true);
  });

  it('should detect out-of-town fee applied to non-out-of-town trip', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7580, lng: -73.9855, borough: 'MANHATTAN' as BoroughCode },
      dropoffLocation: { lat: 40.6782, lng: -73.9442, borough: 'BROOKLYN' as BoroughCode },
      outOfTownReturnFee: 17.50, // Applied but trip is within NYC
    });
    
    const result = auditLocationAccuracy(trip);
    expect(result.outOfTownValid).toBe(false);
    expect(result.errors.some(e => e.includes('not NYC to out-of-state'))).toBe(true);
  });
});

// ============================================
// Time & Distance Integrity Tests
// ============================================

describe('TLC Audit Engine - Time & Distance Integrity', () => {
  it('should validate realistic trip metrics', () => {
    const trip = createMockTrip({
      pickupTime: new Date('2025-11-15T10:00:00Z'),
      dropoffTime: new Date('2025-11-15T10:30:00Z'),
      tripDurationMinutes: 30,
      tripDistanceMiles: 5,
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.isRealisticSpeed).toBe(true);
  });

  it('should detect unrealistic speed (too fast)', () => {
    const trip = createMockTrip({
      pickupTime: new Date('2025-11-15T10:00:00Z'),
      dropoffTime: new Date('2025-11-15T10:01:00Z'),
      tripDurationMinutes: 1,
      tripDistanceMiles: 50, // 3000 mph would be unrealistic
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.isRealisticSpeed).toBe(false);
    expect(result.speedMph).toBeGreaterThan(AUDIT_TOLERANCES.MAX_SPEED_MPH);
  });

  it('should compute distance using haversine correctly', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7484, lng: -73.9857, borough: 'MANHATTAN' as BoroughCode },
      dropoffLocation: { lat: 40.6892, lng: -73.9442, borough: 'BROOKLYN' as BoroughCode },
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.computedDistance).toBeGreaterThan(0);
  });

  it('should detect large distance variance', () => {
    const trip = createMockTrip({
      tripDistanceMiles: 50, // Much larger than computed
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.distanceVariancePercent).toBeGreaterThan(AUDIT_TOLERANCES.DISTANCE_VARIANCE_PERCENT);
  });

  it('should detect dropoff before pickup', () => {
    const trip = createMockTrip({
      pickupTime: new Date('2025-11-15T10:30:00Z'),
      dropoffTime: new Date('2025-11-15T10:00:00Z'),
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.errors).toContain('Dropoff time is before pickup time');
  });

  it('should detect zero duration with positive distance', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 0,
      tripDistanceMiles: 5,
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.errors).toContain('Zero duration with positive distance is suspicious');
  });

  it('should calculate correct speed in mph', () => {
    const trip = createMockTrip({
      pickupTime: new Date('2025-11-15T10:00:00Z'),
      dropoffTime: new Date('2025-11-15T11:00:00Z'),
      tripDurationMinutes: 60,
      tripDistanceMiles: 30,
    });
    
    const result = auditTimeDistanceIntegrity(trip);
    expect(result.speedMph).toBeCloseTo(30, 0);
  });
});

// ============================================
// TLC Fee Validation Tests
// ============================================

describe('TLC Audit Engine - TLC Fee Validation', () => {
  it('should detect incorrect AVF fee', () => {
    const trip = createMockTrip({ avfFee: 0.20 });
    const findings = auditTLCFees(trip);
    
    const avfFinding = findings.find(f => f.field === 'avfFee');
    expect(avfFinding).toBeDefined();
    expect(avfFinding?.expectedValue).toBe(TLC_FEES.AVF_FEE);
  });

  it('should detect incorrect BCF fee', () => {
    const trip = createMockTrip({ bcfFee: 0.80 });
    const findings = auditTLCFees(trip);
    
    const bcfFinding = findings.find(f => f.field === 'bcfFee');
    expect(bcfFinding).toBeDefined();
    expect(bcfFinding?.expectedValue).toBe(TLC_FEES.BCF_FEE);
  });

  it('should detect incorrect HVRF fee', () => {
    const trip = createMockTrip({ hvrfFee: 0.10 });
    const findings = auditTLCFees(trip);
    
    const hvrfFinding = findings.find(f => f.field === 'hvrfFee');
    expect(hvrfFinding).toBeDefined();
    expect(hvrfFinding?.expectedValue).toBe(TLC_FEES.HVRF_FEE);
  });

  it('should detect incorrect state surcharge', () => {
    const trip = createMockTrip({ stateSurcharge: 3.00 });
    const findings = auditTLCFees(trip);
    
    const surchargeFinding = findings.find(f => f.field === 'stateSurcharge');
    expect(surchargeFinding).toBeDefined();
    expect(surchargeFinding?.expectedValue).toBe(TLC_FEES.STATE_SURCHARGE);
  });

  it('should detect missing long trip surcharge', () => {
    const trip = createMockTrip({
      tripDistanceMiles: 25,
      longTripSurcharge: 0,
    });
    const findings = auditTLCFees(trip);
    
    const longTripFinding = findings.find(f => f.field === 'longTripSurcharge');
    expect(longTripFinding).toBeDefined();
    expect(longTripFinding?.description).toContain('Long trip surcharge missing');
  });

  it('should not flag correct TLC fees', () => {
    const trip = createMockTrip({
      avfFee: 0.125,
      bcfFee: 0.625,
      hvrfFee: 0.05,
      stateSurcharge: 2.50,
    });
    const findings = auditTLCFees(trip);
    expect(findings.length).toBe(0);
  });

  it('should allow zero fees when appropriate', () => {
    const trip = createMockTrip({
      avfFee: 0,
      bcfFee: 0,
      hvrfFee: 0,
      stateSurcharge: 0,
    });
    const findings = auditTLCFees(trip);
    expect(findings.length).toBe(0);
  });
});

// ============================================
// Airport Fee Validation Tests
// ============================================

describe('TLC Audit Engine - Airport Fee Validation', () => {
  it('should detect missing airport fee for JFK pickup', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      airportFee: 0,
    });
    
    const findings = auditAirportFee(trip);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('AIRPORT_FEE_ERROR');
  });

  it('should detect missing airport fee for LGA dropoff', () => {
    const trip = createMockTrip({
      dropoffLocation: { lat: 40.7769, lng: -73.8740, borough: 'QUEENS' as BoroughCode },
      airportFee: 0,
    });
    
    const findings = auditAirportFee(trip);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('should not flag correct airport fee', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      airportFee: 5.00,
      airportCode: 'JFK' as AirportCode,
    });
    
    const findings = auditAirportFee(trip);
    const missingFeeFindings = findings.filter(f => f.description.includes('Missing'));
    expect(missingFeeFindings.length).toBe(0);
  });

  it('should flag airport fee for non-airport trip', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7580, lng: -73.9855, borough: 'MANHATTAN' as BoroughCode },
      dropoffLocation: { lat: 40.6782, lng: -73.9442, borough: 'BROOKLYN' as BoroughCode },
      airportFee: 5.00,
    });
    
    const findings = auditAirportFee(trip);
    expect(findings.some(f => f.description.includes('not at an airport'))).toBe(true);
  });

  it('should suggest auto-fix for missing airport fee', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      airportFee: 0,
    });
    
    const findings = auditAirportFee(trip);
    const missingFinding = findings.find(f => f.description.includes('Missing'));
    expect(missingFinding?.fixStatus).toBe('AUTO_FIXED');
    expect(missingFinding?.fixedValue).toBe(TLC_FEES.AIRPORT_ACCESS_FEE);
  });
});

// ============================================
// Toll Validation Tests
// ============================================

describe('TLC Audit Engine - Toll Validation', () => {
  it('should flag negative toll amount', () => {
    const trip = createMockTrip({ tolls: -5.00 });
    const findings = auditTolls(trip);
    
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].description).toContain('Negative toll amount');
  });

  it('should flag unusually high toll amount', () => {
    const trip = createMockTrip({ tolls: 75.00 });
    const findings = auditTolls(trip);
    
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('WARNING');
    expect(findings[0].description).toContain('Unusually high toll amount');
  });

  it('should not flag normal toll amount', () => {
    const trip = createMockTrip({ tolls: 15.00 });
    const findings = auditTolls(trip);
    expect(findings.length).toBe(0);
  });

  it('should not flag zero toll', () => {
    const trip = createMockTrip({ tolls: 0 });
    const findings = auditTolls(trip);
    expect(findings.length).toBe(0);
  });
});

// ============================================
// Full Trip Audit Tests
// ============================================

describe('TLC Audit Engine - Full Trip Audit', () => {
  it('should audit valid trip with no findings', () => {
    const trip = createMockTrip({
      fareSubtotal: 25.00,
      tolls: 0,
      congestionFee: 0,
      avfFee: 0.125,
      bcfFee: 0.625,
      hvrfFee: 0.05,
      stateSurcharge: 2.50,
      finalFare: 28.30,
      driverPayout: 25.00,
      tripDurationMinutes: 30,
      tripDistanceMiles: 5,
    });
    
    const result = auditTrip(trip);
    expect(result.overallStatus).toBe('VALID');
  });

  it('should identify critical severity for major issues', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 30,
      tripDistanceMiles: 8,
      driverPayout: 10.00, // Way below minimum
    });
    
    const result = auditTrip(trip);
    expect(result.overallStatus).toBe('CRITICAL');
    expect(result.findings.some(f => f.category === 'UNDERPAID_DRIVER')).toBe(true);
  });

  it('should apply auto-fixes for minor mismatches', () => {
    const trip = createMockTrip({
      avfFee: 0.13, // Slightly off
      bcfFee: 0.63, // Slightly off
    });
    
    const result = auditTrip(trip);
    expect(result.autoFixApplied).toBe(true);
    expect(result.fixedTrip).toBeDefined();
  });

  it('should include all audit components in result', () => {
    const trip = createMockTrip();
    const result = auditTrip(trip);
    
    expect(result.fareConsistency).toBeDefined();
    expect(result.driverPayConsistency).toBeDefined();
    expect(result.locationAccuracy).toBeDefined();
    expect(result.timeDistanceIntegrity).toBeDefined();
  });

  it('should generate unique audit IDs', () => {
    const trip = createMockTrip({ avfFee: 0.20 });
    const result1 = auditTrip(trip);
    const result2 = auditTrip(trip);
    
    expect(result1.findings[0].id).not.toBe(result2.findings[0].id);
  });
});

// ============================================
// Automatic Fix Engine Tests
// ============================================

describe('TLC Audit Engine - Automatic Fix Engine', () => {
  it('should fix incorrect AVF fee', () => {
    const trip = createMockTrip({ avfFee: 0.20 });
    const findings = auditTLCFees(trip);
    const fixed = applyAutoFixes(trip, findings);
    
    expect(fixed.avfFee).toBe(TLC_FEES.AVF_FEE);
  });

  it('should fix underpaid driver', () => {
    const trip = createMockTrip({
      tripDurationMinutes: 30,
      tripDistanceMiles: 8,
      driverPayout: 15.00,
    });
    
    const result = auditTrip(trip);
    expect(result.fixedTrip?.driverPayout).toBeGreaterThan(15.00);
    expect(result.fixedTrip?.tlcMinimumApplied).toBe(true);
  });

  it('should recalculate final fare after fixes', () => {
    const trip = createMockTrip({
      fareSubtotal: 25.00,
      avfFee: 0.20, // Wrong
      bcfFee: 0.80, // Wrong
      finalFare: 30.00,
    });
    
    const result = auditTrip(trip);
    expect(result.fixedTrip?.finalFare).toBeDefined();
  });

  it('should preserve unfixed fields', () => {
    const trip = createMockTrip({ avfFee: 0.20 });
    const findings = auditTLCFees(trip);
    const fixed = applyAutoFixes(trip, findings);
    
    expect(fixed.tripId).toBe(trip.tripId);
    expect(fixed.driverId).toBe(trip.driverId);
  });
});

// ============================================
// Reconciliation Tests
// ============================================

describe('TLC Audit Engine - Reconciliation', () => {
  it('should generate reconciliation record', () => {
    const trip = createMockTrip({ avfFee: 0.20 });
    const auditResult = auditTrip(trip);
    const reconciliation = reconcileTrip(trip, auditResult);
    
    expect(reconciliation.tripId).toBe(trip.tripId);
    expect(reconciliation.changesApplied.length).toBeGreaterThan(0);
  });

  it('should mark successful reconciliation', () => {
    const trip = createMockTrip({ avfFee: 0.20 });
    const auditResult = auditTrip(trip);
    const reconciliation = reconcileTrip(trip, auditResult);
    
    expect(reconciliation.success).toBe(true);
  });

  it('should flag trips requiring manual review', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7580, lng: -73.9855, borough: 'BROOKLYN' as BoroughCode }, // Wrong
    });
    const auditResult = auditTrip(trip);
    const reconciliation = reconcileTrip(trip, auditResult);
    
    expect(reconciliation.requiresManualReview).toBe(true);
  });

  it('should include review notes for manual review items', () => {
    const trip = createMockTrip({
      tolls: -10.00, // Requires review
    });
    const auditResult = auditTrip(trip);
    const reconciliation = reconcileTrip(trip, auditResult);
    
    expect(reconciliation.reviewNotes).toBeDefined();
    expect(reconciliation.reviewNotes!.length).toBeGreaterThan(0);
  });
});

// ============================================
// Batch Audit Tests
// ============================================

describe('TLC Audit Engine - Batch Audit', () => {
  it('should audit multiple trips', async () => {
    const trips = [
      createMockTrip({ tripId: 'TRP-001' }),
      createMockTrip({ tripId: 'TRP-002' }),
      createMockTrip({ tripId: 'TRP-003' }),
    ];
    
    const { results, summary } = await auditTrips(trips);
    
    expect(results.length).toBe(3);
    expect(summary.totalTripsAudited).toBe(3);
  });

  it('should calculate audit summary correctly', async () => {
    const trips = [
      createMockTrip({ avfFee: 0.20 }), // Warning
      createMockTrip({ driverPayout: 10.00, tripDurationMinutes: 30, tripDistanceMiles: 8 }), // Critical
      createMockTrip(), // Valid
    ];
    
    const { summary } = await auditTrips(trips);
    
    expect(summary.criticalCount).toBeGreaterThan(0);
    expect(summary.warningCount).toBeGreaterThan(0);
  });

  it('should filter by driver ID', async () => {
    const trips = [
      createMockTrip({ driverId: 'driver-1' }),
      createMockTrip({ driverId: 'driver-2' }),
    ];
    
    const filters: AuditFilters = {
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-30'),
      driverId: 'driver-1',
    };
    
    const { results } = await auditTrips(trips, filters);
    
    expect(results.length).toBe(1);
    expect(results[0].driverId).toBe('driver-1');
  });

  it('should filter by severity', async () => {
    const trips = [
      createMockTrip({ avfFee: 0.20 }), // Warning
      createMockTrip({ driverPayout: 10.00, tripDurationMinutes: 30, tripDistanceMiles: 8 }), // Critical
    ];
    
    const filters: AuditFilters = {
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-30'),
      severity: 'CRITICAL' as AuditSeverity,
    };
    
    const { results } = await auditTrips(trips, filters);
    
    expect(results.every(r => r.findings.some(f => f.severity === 'CRITICAL'))).toBe(true);
  });

  it('should calculate audit score', async () => {
    const trips = [createMockTrip()];
    const { summary } = await auditTrips(trips);
    
    expect(summary.auditScore).toBeGreaterThanOrEqual(0);
    expect(summary.auditScore).toBeLessThanOrEqual(100);
  });

  it('should count findings by category', async () => {
    const trips = [createMockTrip({ avfFee: 0.20 })];
    const { summary } = await auditTrips(trips);
    
    expect(summary.findingsByCategory).toBeDefined();
    expect(summary.findingsByCategory.TLC_FEE_ERROR).toBeGreaterThan(0);
  });
});

// ============================================
// Auto Reconcile Tests
// ============================================

describe('TLC Audit Engine - Auto Reconcile', () => {
  it('should auto-reconcile multiple trips', async () => {
    const trips = [
      createMockTrip({ avfFee: 0.20 }),
      createMockTrip({ bcfFee: 0.80 }),
    ];
    
    const { reconciliations, summary } = await autoReconcile(trips);
    
    expect(reconciliations.length).toBe(2);
    expect(summary.autoFixedCount).toBeGreaterThan(0);
  });
});

// ============================================
// Export Tests
// ============================================

describe('TLC Audit Engine - Export', () => {
  it('should export audit results as JSON', async () => {
    const trips = [createMockTrip()];
    const { results, summary } = await auditTrips(trips);
    const { reconciliations } = await autoReconcile(trips);
    
    const filters: AuditFilters = {
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-30'),
    };
    
    const exportData = exportAuditResults(results, summary, reconciliations, 'json', 'FULL_AUDIT', filters);
    
    expect(exportData.format).toBe('json');
    expect(exportData.filename).toContain('.json');
    expect(typeof exportData.data).toBe('object');
  });

  it('should export audit results as CSV', async () => {
    const trips = [createMockTrip({ avfFee: 0.20 })];
    const { results, summary } = await auditTrips(trips);
    const { reconciliations } = await autoReconcile(trips);
    
    const filters: AuditFilters = {
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-30'),
    };
    
    const exportData = exportAuditResults(results, summary, reconciliations, 'csv', 'FINDINGS_ONLY', filters);
    
    expect(exportData.format).toBe('csv');
    expect(exportData.filename).toContain('.csv');
    expect(typeof exportData.data).toBe('string');
  });

  it('should export summary only', async () => {
    const trips = [createMockTrip()];
    const { results, summary } = await auditTrips(trips);
    
    const filters: AuditFilters = {
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-30'),
    };
    
    const exportData = exportAuditResults(results, summary, [], 'json', 'SUMMARY', filters);
    
    expect(exportData.reportType).toBe('SUMMARY');
  });
});

// ============================================
// Audit Log Tests
// ============================================

describe('TLC Audit Engine - Audit Log', () => {
  it('should generate audit log entry', () => {
    const entry = generateAuditLogEntry(
      'RECONCILE',
      'TRP-001',
      { oldValue: 0.20, newValue: 0.125 },
      'admin-user'
    );
    
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('action');
    expect(entry).toHaveProperty('tripId');
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('hash');
  });
});

// ============================================
// Complex Scenario Tests
// ============================================

describe('TLC Audit Engine - Complex Scenarios', () => {
  it('should handle airport trip with congestion and long distance', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7505, lng: -73.9934, borough: 'MANHATTAN' as BoroughCode },
      dropoffLocation: { lat: 40.6413, lng: -73.7781, borough: 'QUEENS' as BoroughCode },
      tripDistanceMiles: 22,
      congestionFee: 2.75,
      airportFee: 5.00,
      longTripSurcharge: 2.50,
      airportCode: 'JFK' as AirportCode,
      tripCategory: 'AIRPORT_DROPOFF' as TripCategory,
    });
    
    const result = auditTrip(trip);
    expect(result.locationAccuracy.congestionZoneValid).toBe(true);
    expect(result.locationAccuracy.airportZoneValid).toBe(true);
  });

  it('should handle out-of-town trip with all surcharges', () => {
    const trip = createMockTrip({
      pickupLocation: { lat: 40.7580, lng: -73.9855, borough: 'MANHATTAN' as BoroughCode },
      dropoffLocation: { lat: 40.0, lng: -74.5, borough: 'OUT_OF_NYC' as BoroughCode },
      tripDistanceMiles: 45,
      congestionFee: 2.75,
      outOfTownReturnFee: 17.50,
      longTripSurcharge: 2.50,
      tripCategory: 'NYC_TO_OOS' as TripCategory,
    });
    
    const result = auditTrip(trip);
    expect(result.locationAccuracy.outOfTownValid).toBe(true);
  });

  it('should handle accessible vehicle trip', () => {
    const trip = createMockTrip({
      isAccessibleVehicle: true,
      isWheelchairTrip: true,
      avfFee: 0.125,
    });
    
    const result = auditTrip(trip);
    expect(result).toBeDefined();
  });

  it('should handle promo code trip', () => {
    const trip = createMockTrip({
      promoUsed: true,
      promoCode: 'SAVE10',
      discountAmount: 4.00,
      fareSubtotal: 25.00,
      finalFare: 24.30, // Adjusted for discount
    });
    
    const result = auditTrip(trip);
    expect(result.fareConsistency).toBeDefined();
  });
});
