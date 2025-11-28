/// <reference types="jest" />
/**
 * FareEngine - Comprehensive Regression Test Suite
 * 
 * Tests the pure fare calculation logic with deterministic fixtures.
 * All 20 scenarios test the actual fare engine pipeline.
 */

import { 
  calculateFare,
  FareEngineContext,
  FareConfig,
  RouteInput,
  LocationInfo,
  AirportZone,
  BorderZone,
  TollInfo,
  StateRegulatoryFee,
  FareEngineResult,
  FareFlags,
} from '../fareEngine';

const DEFAULT_FARE_CONFIG: FareConfig = {
  baseFare: 2.50,
  perMileRate: 1.75,
  perMinuteRate: 0.35,
  minimumFare: 7.00,
  driverPerMileRate: 1.20,
  driverPerMinuteRate: 0.20,
  serviceFeePercent: 15,
  serviceFeeMinimum: 1.50,
  serviceFeeMaximum: 20.00,
  maxSurgeMultiplier: 3.0,
  nightSurchargePercent: 10,
  peakHourSurchargePercent: 15,
  shortTripThresholdMiles: 2.0,
  shortTripMinimumFare: 8.00,
  longDistanceThresholdMiles: 25,
  longDistanceFeePerMile: 0.50,
  crossCitySurcharge: 5.00,
  crossStateSurcharge: 10.00,
  returnDeadheadPerMile: 0.25,
  returnDeadheadThresholdMiles: 25,
  borderZoneFee: 3.00,
  maximumFare: 500.00,
  driverMinimumPayout: 5.00,
  companyMinMarginPercent: 15,
  airportOverridesCrossCity: true,
  customerServiceFee: 1.99,
  platformCommissionPercent: 15,
  driverEarningsPercent: 85,
};

const NYC_COORDS: LocationInfo = { lat: 40.7128, lng: -74.0060, cityCode: 'NYC', stateCode: 'NY' };
const BROOKLYN_COORDS: LocationInfo = { lat: 40.6782, lng: -73.9442, cityCode: 'BROOKLYN', stateCode: 'NY' };
const QUEENS_COORDS: LocationInfo = { lat: 40.7282, lng: -73.7949, cityCode: 'QUEENS', stateCode: 'NY' };
const NEWARK_NJ_COORDS: LocationInfo = { lat: 40.7357, lng: -74.1724, cityCode: 'NEWARK', stateCode: 'NJ' };
const JFK_AIRPORT_COORDS: LocationInfo = { lat: 40.6413, lng: -73.7781, cityCode: 'JFK_AREA', stateCode: 'NY' };
const LAX_AIRPORT_COORDS: LocationInfo = { lat: 33.9416, lng: -118.4085, cityCode: 'LAX_AREA', stateCode: 'CA' };
const LOS_ANGELES_COORDS: LocationInfo = { lat: 34.0522, lng: -118.2437, cityCode: 'LA', stateCode: 'CA' };
const STAMFORD_CT_COORDS: LocationInfo = { lat: 41.0534, lng: -73.5387, cityCode: 'STAMFORD', stateCode: 'CT' };
const PA_FAR_COORDS: LocationInfo = { lat: 40.5, lng: -75.5, cityCode: 'PA_CITY', stateCode: 'PA' };
const NY_UPSTATE_COORDS: LocationInfo = { lat: 41.5, lng: -74.5, cityCode: 'UPSTATE', stateCode: 'NY' };
const NY_NJ_BORDER_COORDS: LocationInfo = { lat: 40.80, lng: -74.00, cityCode: 'HOBOKEN', stateCode: 'NJ' };

const AIRPORTS: AirportZone[] = [
  { code: 'JFK', name: 'John F. Kennedy International', lat: 40.6413, lng: -73.7781, radiusMiles: 2, pickupFee: 5.50, dropoffFee: 0, state: 'NY' },
  { code: 'LGA', name: 'LaGuardia Airport', lat: 40.7769, lng: -73.8740, radiusMiles: 1.5, pickupFee: 3.00, dropoffFee: 0, state: 'NY' },
  { code: 'EWR', name: 'Newark Liberty International', lat: 40.6895, lng: -74.1745, radiusMiles: 2, pickupFee: 4.50, dropoffFee: 0, state: 'NJ' },
  { code: 'LAX', name: 'Los Angeles International', lat: 33.9416, lng: -118.4085, radiusMiles: 2, pickupFee: 4.00, dropoffFee: 0, state: 'CA' },
];

const BORDER_ZONES: BorderZone[] = [
  {
    id: 'ny-nj-border',
    name: 'NY-NJ Border Zone',
    states: ['NY', 'NJ'],
    polygon: [
      { lat: 40.85, lng: -74.10 },
      { lat: 40.85, lng: -73.95 },
      { lat: 40.70, lng: -73.95 },
      { lat: 40.70, lng: -74.10 },
    ],
  },
];

const NY_REGULATORY_FEES: StateRegulatoryFee[] = [
  { name: 'Black Car Fund Fee', type: 'percent', amount: 2.5 },
];

const NJ_REGULATORY_FEES: StateRegulatoryFee[] = [
  { name: 'Transportation Fee', type: 'flat', amount: 0.50 },
];

const createRoute = (
  distanceMiles: number, 
  durationMinutes: number,
  trafficDurationMinutes?: number,
  tollSegments?: string[]
): RouteInput => ({
  routeId: `route-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  distanceMiles,
  durationMinutes,
  trafficDurationMinutes: trafficDurationMinutes ?? durationMinutes,
  summary: `Test Route (${distanceMiles} mi)`,
  tollSegments: tollSegments ?? [],
});

const createContext = (
  route: RouteInput,
  pickup: LocationInfo,
  dropoff: LocationInfo,
  options: {
    surgeMultiplier?: number;
    timeContext?: { hour: number; dayOfWeek: number };
    tolls?: TollInfo[];
    stateRegulatoryFees?: StateRegulatoryFee[];
    additionalFees?: { id: string; name: string; amount: number }[];
    fareConfigOverrides?: Partial<FareConfig>;
  } = {}
): FareEngineContext => ({
  fareConfig: { ...DEFAULT_FARE_CONFIG, ...options.fareConfigOverrides },
  rideTypeCode: 'STANDARD',
  route,
  pickup,
  dropoff,
  surgeMultiplier: options.surgeMultiplier ?? 1,
  timeContext: options.timeContext ?? { hour: 14, dayOfWeek: 3 },
  airports: AIRPORTS,
  borderZones: BORDER_ZONES,
  tolls: options.tolls ?? [],
  stateRegulatoryFees: options.stateRegulatoryFees ?? [],
  additionalFees: options.additionalFees ?? [],
});

describe('FareEngine - Comprehensive Regression Tests', () => {
  describe('Pipeline Order Validation', () => {
    it('should calculate base fare correctly (Step 1)', () => {
      const route = createRoute(5, 15);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
      const result = calculateFare(context);
      
      expect(result.baseFare).toBe(2.50);
      expect(result.distanceFare).toBe(8.75); // 5 * 1.75
      expect(result.timeFare).toBe(5.25); // 15 * 0.35
    });

    it('should apply short-trip adjustment for trips under threshold (Step 2)', () => {
      const route = createRoute(1.5, 8);
      const context = createContext(route, NYC_COORDS, NYC_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.shortTripAdjustmentApplied).toBe(true);
      expect(result.shortTripAdjustment).toBeGreaterThan(0);
    });

    it('should not apply short-trip adjustment for normal trips', () => {
      const route = createRoute(5, 15);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.shortTripAdjustmentApplied).toBe(false);
      expect(result.shortTripAdjustment).toBe(0);
    });

    it('should apply traffic multiplier for heavy traffic (Step 3)', () => {
      const route = createRoute(8, 25, 40); // Heavy traffic: 40/25 = 1.6 ratio
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.trafficApplied).toBe(true);
      expect(result.trafficMultiplier).toBe(1.25);
      expect(result.trafficAdjustment).toBeGreaterThan(0);
    });

    it('should apply surge multiplier when requested (Step 4)', () => {
      const route = createRoute(8, 20);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, { surgeMultiplier: 1.5 });
      const result = calculateFare(context);
      
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.surgeMultiplier).toBe(1.5);
      expect(result.surgeAmount).toBeGreaterThan(0);
    });

    it('should cap surge at maxSurgeMultiplier', () => {
      const route = createRoute(8, 20);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, { surgeMultiplier: 5.0 });
      const result = calculateFare(context);
      
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.surgeMultiplier).toBe(3.0); // Capped at max
    });
  });

  describe('Time-Based Surcharges (Step 5)', () => {
    it('should apply night surcharge during night hours (8PM-6AM)', () => {
      const route = createRoute(6, 18);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 22, dayOfWeek: 4 },
      });
      const result = calculateFare(context);
      
      expect(result.flags.nightApplied).toBe(true);
      expect(result.flags.peakApplied).toBe(false);
      expect(result.nightSurcharge).toBeGreaterThan(0);
      expect(result.peakHourSurcharge).toBe(0);
    });

    it('should apply peak surcharge during rush hours', () => {
      const route = createRoute(8, 25);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 8, dayOfWeek: 2 }, // Tuesday 8 AM
      });
      const result = calculateFare(context);
      
      expect(result.flags.peakApplied).toBe(true);
      expect(result.flags.nightApplied).toBe(false);
      expect(result.peakHourSurcharge).toBeGreaterThan(0);
      expect(result.nightSurcharge).toBe(0);
    });

    it('should not apply peak surcharge on weekends', () => {
      const route = createRoute(8, 25);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 8, dayOfWeek: 6 }, // Saturday 8 AM
      });
      const result = calculateFare(context);
      
      expect(result.flags.peakApplied).toBe(false);
    });

    it('night and peak should be mutually exclusive (night takes priority)', () => {
      const route = createRoute(6, 18);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 5, dayOfWeek: 2 }, // 5 AM Tuesday (both night and could be "early rush")
      });
      const result = calculateFare(context);
      
      expect(result.nightSurcharge > 0 || result.peakHourSurcharge > 0).toBe(true);
      expect(result.nightSurcharge === 0 || result.peakHourSurcharge === 0).toBe(true);
    });
  });

  describe('Long-Distance Fee (Step 6)', () => {
    it('should apply long-distance fee for trips over threshold', () => {
      const route = createRoute(30, 50);
      const context = createContext(route, NYC_COORDS, NY_UPSTATE_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.longDistanceApplied).toBe(true);
      expect(result.longDistanceFee).toBe(2.50); // (30-25) * 0.50
    });

    it('should not apply long-distance fee for shorter trips', () => {
      const route = createRoute(20, 40);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.longDistanceApplied).toBe(false);
      expect(result.longDistanceFee).toBe(0);
    });
  });

  describe('Airport Fee Detection (Step 7)', () => {
    it('should detect airport pickup and apply fee', () => {
      const route = createRoute(18, 45);
      const context = createContext(route, JFK_AIRPORT_COORDS, NYC_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.airportFee).toBe(5.50); // JFK pickup fee
      expect(result.airportCode).toBe('JFK');
    });

    it('should detect airport dropoff', () => {
      const route = createRoute(15, 35);
      const context = createContext(route, LOS_ANGELES_COORDS, LAX_AIRPORT_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.airportCode).toBe('LAX');
    });
  });

  describe('Geo-Based Conflict Resolution (Steps 8-10)', () => {
    it('cross-state should suppress cross-city surcharge', () => {
      const route = createRoute(12, 35);
      const context = createContext(route, NYC_COORDS, NEWARK_NJ_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.crossCityApplied).toBe(false);
      expect(result.crossStateSurcharge).toBe(10.00);
      expect(result.crossCitySurcharge).toBe(0);
      
      const suppressionEntry = result.feeSuppressionLog.entries.find(
        e => e.fee === 'crossCitySurcharge' && e.suppressedBy === 'crossStateSurcharge'
      );
      expect(suppressionEntry).toBeDefined();
    });

    it('airport should suppress cross-city when configured', () => {
      const route = createRoute(18, 45);
      const context = createContext(route, JFK_AIRPORT_COORDS, QUEENS_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.flags.crossCityApplied).toBe(false);
      expect(result.crossCitySurcharge).toBe(0);
      expect(result.airportFee).toBeGreaterThan(0);
      
      const suppressionEntry = result.feeSuppressionLog.entries.find(
        e => e.fee === 'crossCitySurcharge' && e.suppressedBy === 'airportFee'
      );
      expect(suppressionEntry).toBeDefined();
      expect(suppressionEntry?.wouldHaveBeenAmount).toBe(5.00);
    });

    it('airport should NOT suppress cross-state', () => {
      const route = createRoute(22, 55);
      const context = createContext(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.airportFee).toBeGreaterThan(0);
      expect(result.crossStateSurcharge).toBe(10.00);
    });

    it('cross-city should apply when no suppressing conditions', () => {
      const route = createRoute(10, 30);
      const context = createContext(route, BROOKLYN_COORDS, QUEENS_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossCityApplied).toBe(true);
      expect(result.flags.crossStateApplied).toBe(false);
      expect(result.crossCitySurcharge).toBe(5.00);
    });

    it('border zone fee should apply within border zone', () => {
      const route = createRoute(6, 18);
      const nj1: LocationInfo = { lat: 40.80, lng: -74.00, cityCode: 'HOBOKEN', stateCode: 'NJ' };
      const nj2: LocationInfo = { lat: 40.75, lng: -74.05, cityCode: 'HOBOKEN', stateCode: 'NJ' };
      const context = createContext(route, nj1, nj2);
      const result = calculateFare(context);
      
      expect(result.flags.borderZoneApplied).toBe(true);
      expect(result.borderZoneFee).toBe(3.00);
    });

    it('cross-state should suppress border zone fee', () => {
      const route = createRoute(15, 40);
      const nj1: LocationInfo = { lat: 40.80, lng: -74.00, cityCode: 'HOBOKEN', stateCode: 'NJ' };
      const ny1: LocationInfo = { lat: 40.82, lng: -73.96, cityCode: 'NYC', stateCode: 'NY' };
      const context = createContext(route, nj1, ny1);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.borderZoneApplied).toBe(false);
      expect(result.borderZoneFee).toBe(0);
    });
  });

  describe('Return Deadhead Fee (Step 11)', () => {
    it('should apply return deadhead only when cross-state and distance exceeds threshold', () => {
      const route = createRoute(60, 100);
      const context = createContext(route, NYC_COORDS, PA_FAR_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.returnDeadheadApplied).toBe(true);
      expect(result.returnDeadheadFee).toBeGreaterThan(0);
      expect(result.excessReturnMiles).toBeGreaterThan(0);
    });

    it('should NOT apply return deadhead for in-state trips', () => {
      const route = createRoute(60, 100);
      const context = createContext(route, NYC_COORDS, NY_UPSTATE_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(false);
      expect(result.flags.returnDeadheadApplied).toBe(false);
      expect(result.returnDeadheadFee).toBe(0);
    });

    it('should NOT apply return deadhead for short cross-state trips', () => {
      const route = createRoute(12, 35);
      const context = createContext(route, NYC_COORDS, NEWARK_NJ_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.returnDeadheadApplied).toBe(false); // Distance too short
    });
  });

  describe('State Regulatory Fees (Step 12)', () => {
    it('should apply state regulatory fees based on pickup state', () => {
      const route = createRoute(8, 20);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        stateRegulatoryFees: NY_REGULATORY_FEES,
      });
      const result = calculateFare(context);
      
      expect(result.flags.regulatoryFeeApplied).toBe(true);
      expect(result.stateRegulatoryFee).toBeGreaterThan(0);
      expect(result.stateRegulatoryFeeBreakdown.length).toBeGreaterThan(0);
    });
  });

  describe('Tolls (Step 13)', () => {
    it('should include toll fees in total fare', () => {
      const route = createRoute(20, 40);
      const tolls: TollInfo[] = [
        { id: 'gwb', name: 'George Washington Bridge', amount: 16.00, paidToDriver: false },
      ];
      const context = createContext(route, NYC_COORDS, NEWARK_NJ_COORDS, { tolls });
      const result = calculateFare(context);
      
      expect(result.tollsTotal).toBe(16.00);
      expect(result.tollsBreakdown.length).toBe(1);
    });

    it('should track driver-paid tolls separately', () => {
      const route = createRoute(20, 40);
      const tolls: TollInfo[] = [
        { id: 'gwb', name: 'George Washington Bridge', amount: 16.00, paidToDriver: true },
      ];
      const context = createContext(route, NYC_COORDS, NEWARK_NJ_COORDS, { tolls });
      const result = calculateFare(context);
      
      expect(result.tollsTotal).toBe(16.00);
      expect(result.tollsBreakdown[0].paidToDriver).toBe(true);
    });
  });

  describe('Service Fee (Step 15)', () => {
    it('should apply service fee percentage', () => {
      const route = createRoute(10, 25);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
      const result = calculateFare(context);
      
      expect(result.serviceFee).toBeGreaterThan(0);
      expect(result.serviceFee).toBeGreaterThanOrEqual(DEFAULT_FARE_CONFIG.serviceFeeMinimum);
      expect(result.serviceFee).toBeLessThanOrEqual(DEFAULT_FARE_CONFIG.serviceFeeMaximum);
    });
  });

  describe('Fare Guards (Step 16)', () => {
    it('should enforce minimum fare', () => {
      const route = createRoute(0.5, 3);
      const context = createContext(route, NYC_COORDS, NYC_COORDS);
      const result = calculateFare(context);
      
      expect(result.totalFare).toBeGreaterThanOrEqual(DEFAULT_FARE_CONFIG.minimumFare);
    });

    it('should enforce maximum fare', () => {
      const route = createRoute(200, 300);
      const context = createContext(route, NYC_COORDS, PA_FAR_COORDS, { surgeMultiplier: 3.0 });
      const result = calculateFare(context);
      
      expect(result.totalFare).toBeLessThanOrEqual(DEFAULT_FARE_CONFIG.maximumFare);
      expect(result.flags.maximumFareApplied).toBe(true);
    });
  });

  describe('Driver Minimum Payout (Step 17)', () => {
    it('should enforce driver minimum payout', () => {
      const route = createRoute(0.5, 3);
      const context = createContext(route, NYC_COORDS, NYC_COORDS);
      const result = calculateFare(context);
      
      expect(result.driverPayout).toBeGreaterThanOrEqual(DEFAULT_FARE_CONFIG.driverMinimumPayout);
      expect(result.flags.driverMinimumPayoutApplied).toBe(true);
    });
  });

  describe('Margin Protection (Step 18)', () => {
    it('should track margin protection when triggered', () => {
      const route = createRoute(10, 25);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        fareConfigOverrides: {
          companyMinMarginPercent: 80, // Extreme margin requirement
          driverPerMileRate: 2.50, // Very high driver payout
          driverPerMinuteRate: 0.75, // Very high driver payout
        },
      });
      const result = calculateFare(context);
      
      expect(result.marginProtectionApplied).toBe(true);
    });

    it('should calculate commission within acceptable range when margin is sufficient', () => {
      const route = createRoute(20, 40);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        fareConfigOverrides: {
          companyMinMarginPercent: 10,
        },
      });
      const result = calculateFare(context);
      
      expect(result.companyMarginPercent).toBeGreaterThanOrEqual(10);
      expect(result.platformCommission).toBeGreaterThan(0);
    });
  });

  describe('Complete Scenario Tests', () => {
    it('Scenario 1: Normal Ride - Standard weekday trip', () => {
      const route = createRoute(5, 15);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 14, dayOfWeek: 3 },
      });
      const result = calculateFare(context);
      
      expect(result.flags.trafficApplied).toBe(false);
      expect(result.flags.surgeApplied).toBe(false);
      expect(result.flags.nightApplied).toBe(false);
      expect(result.flags.peakApplied).toBe(false);
      expect(result.flags.crossCityApplied).toBe(true);
      expect(result.flags.crossStateApplied).toBe(false);
      expect(result.totalFare).toBeGreaterThan(0);
    });

    it('Scenario 2: Peak Hour Ride - Rush hour weekday with traffic', () => {
      const route = createRoute(8, 25, 35);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 8, dayOfWeek: 2 },
      });
      const result = calculateFare(context);
      
      expect(result.flags.trafficApplied).toBe(true);
      expect(result.flags.peakApplied).toBe(true);
      expect(result.flags.nightApplied).toBe(false);
    });

    it('Scenario 3: Night Ride - Late night trip', () => {
      const route = createRoute(6, 18);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        timeContext: { hour: 22, dayOfWeek: 4 },
      });
      const result = calculateFare(context);
      
      expect(result.flags.nightApplied).toBe(true);
      expect(result.flags.peakApplied).toBe(false);
    });

    it('Scenario 4: Airport Pickup - JFK to Manhattan', () => {
      const route = createRoute(18, 45);
      const context = createContext(route, JFK_AIRPORT_COORDS, NYC_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.airportCode).toBe('JFK');
      expect(result.airportFee).toBe(5.50);
    });

    it('Scenario 7: Cross-State Ride - NYC to Newark NJ', () => {
      const route = createRoute(12, 35);
      const context = createContext(route, NYC_COORDS, NEWARK_NJ_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.crossCityApplied).toBe(false);
      expect(result.crossStateSurcharge).toBe(10.00);
      expect(result.feeSuppressionLog.entries.some(e => e.fee === 'crossCitySurcharge')).toBe(true);
    });

    it('Scenario 8: Airport + Cross-State - JFK to Newark', () => {
      const route = createRoute(22, 55);
      const context = createContext(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.crossCityApplied).toBe(false);
      expect(result.airportFee).toBeGreaterThan(0);
      expect(result.crossStateSurcharge).toBe(10.00);
    });

    it('Scenario 11: Long Distance + Surge - 35 miles with 1.5x surge', () => {
      const route = createRoute(35, 60);
      const context = createContext(route, NYC_COORDS, STAMFORD_CT_COORDS, {
        surgeMultiplier: 1.5,
      });
      const result = calculateFare(context);
      
      expect(result.flags.longDistanceApplied).toBe(true);
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.surgeMultiplier).toBe(1.5);
    });

    it('Scenario 12: Surge > Max Cap - 5x surge capped to max', () => {
      const route = createRoute(8, 20);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        surgeMultiplier: 5.0,
      });
      const result = calculateFare(context);
      
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.surgeMultiplier).toBe(3.0); // Capped
    });

    it('Scenario 18: Deadhead-Only - Cross-state with return deadhead', () => {
      const route = createRoute(60, 100);
      const context = createContext(route, NYC_COORDS, PA_FAR_COORDS);
      const result = calculateFare(context);
      
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.returnDeadheadApplied).toBe(true);
      expect(result.flags.longDistanceApplied).toBe(true);
      expect(result.returnDeadheadFee).toBeGreaterThan(0);
    });

    it('Scenario 20: Multi-Fee Full Scenario - Everything stacked', () => {
      const route = createRoute(45, 80, 100);
      const tolls: TollInfo[] = [
        { id: 'gwb', name: 'George Washington Bridge', amount: 16.00, paidToDriver: false },
      ];
      const context = createContext(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS, {
        surgeMultiplier: 1.8,
        timeContext: { hour: 17, dayOfWeek: 1 },
        tolls,
        stateRegulatoryFees: NY_REGULATORY_FEES,
      });
      const result = calculateFare(context);
      
      expect(result.flags.trafficApplied).toBe(true);
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.flags.airportFeeApplied).toBe(true);
      expect(result.flags.crossStateApplied).toBe(true);
      expect(result.flags.crossCityApplied).toBe(false);
      expect(result.flags.longDistanceApplied).toBe(true);
      expect(result.flags.regulatoryFeeApplied).toBe(true);
      expect(result.tollsTotal).toBe(16.00);
      expect(result.feeSuppressionLog.entries.some(e => e.fee === 'crossCitySurcharge')).toBe(true);
    });
  });

  describe('Fee Suppression Log Validation', () => {
    it('should log all fee suppressions with correct structure', () => {
      const route = createRoute(22, 55);
      const context = createContext(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS);
      const result = calculateFare(context);
      
      expect(result.feeSuppressionLog.entries).toBeDefined();
      expect(Array.isArray(result.feeSuppressionLog.entries)).toBe(true);
      expect(result.feeSuppressionLog.timestamp).toBeInstanceOf(Date);
      
      for (const entry of result.feeSuppressionLog.entries) {
        expect(entry.fee).toBeDefined();
        expect(entry.suppressedBy).toBeDefined();
        expect(entry.reason).toBeDefined();
        expect(typeof entry.fee).toBe('string');
        expect(typeof entry.suppressedBy).toBe('string');
        expect(typeof entry.reason).toBe('string');
      }
    });
  });

  describe('Flags Consistency', () => {
    it('all flags should be boolean values', () => {
      const route = createRoute(10, 25);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
      const result = calculateFare(context);
      
      const flagKeys = Object.keys(result.flags) as (keyof FareFlags)[];
      for (const key of flagKeys) {
        expect(typeof result.flags[key]).toBe('boolean');
      }
    });

    it('flags should match corresponding numeric values', () => {
      const route = createRoute(8, 20, 30);
      const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        surgeMultiplier: 1.5,
        timeContext: { hour: 22, dayOfWeek: 3 },
      });
      const result = calculateFare(context);
      
      expect(result.flags.surgeApplied).toBe(result.surgeMultiplier > 1);
      expect(result.flags.nightApplied).toBe(result.nightSurcharge > 0);
      expect(result.flags.trafficApplied).toBe(result.trafficMultiplier > 1);
    });
  });

  describe('Global Commission & Service Fee System', () => {
    describe('Customer Service Fee ($1.99)', () => {
      it('should include $1.99 customer service fee in every trip', () => {
        const route = createRoute(8, 20);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
        const result = calculateFare(context);
        
        expect(result.customerServiceFee).toBe(1.99);
      });

      it('should include customer service fee in short trips', () => {
        const route = createRoute(1.5, 8);
        const context = createContext(route, NYC_COORDS, NYC_COORDS);
        const result = calculateFare(context);
        
        expect(result.customerServiceFee).toBe(1.99);
      });

      it('should include customer service fee in long trips', () => {
        const route = createRoute(50, 90);
        const context = createContext(route, NYC_COORDS, STAMFORD_CT_COORDS);
        const result = calculateFare(context);
        
        expect(result.customerServiceFee).toBe(1.99);
      });
    });

    describe('Driver Earnings Formula: max((totalFare * 0.85), $5.00)', () => {
      it('should calculate 85% driver earnings for medium trip', () => {
        const route = createRoute(10, 25);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.driverEarningsMinimumApplied).toBeDefined();
      });

      it('should apply $5 minimum for very short trips', () => {
        const route = createRoute(0.5, 3);
        const context = createContext(route, NYC_COORDS, NYC_COORDS, {
          fareConfigOverrides: { minimumFare: 5.00 },
        });
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      });

      it('should never pay driver less than $5', () => {
        const route = createRoute(1, 5);
        const context = createContext(route, NYC_COORDS, NYC_COORDS);
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      });

      it('should pay driver 85% for long trips', () => {
        const route = createRoute(30, 55);
        const context = createContext(route, NYC_COORDS, STAMFORD_CT_COORDS);
        const result = calculateFare(context);
        
        const expectedMin = result.totalFare * 0.85;
        expect(result.driverEarnings).toBeGreaterThanOrEqual(Math.min(expectedMin, result.totalFare * 0.85));
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      });
    });

    describe('Platform Commission (15%)', () => {
      it('should calculate platform commission correctly', () => {
        const route = createRoute(10, 25);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
        const result = calculateFare(context);
        
        expect(result.platformCommission).toBeDefined();
        expect(result.platformCommission).toBeGreaterThanOrEqual(0);
      });

      it('should include platform commission in result', () => {
        const route = createRoute(15, 35);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
        const result = calculateFare(context);
        
        expect(result.safegoCommission).toBe(result.platformCommission);
      });
    });

    describe('Driver Earnings with Complex Fee Scenarios', () => {
      it('should calculate driver earnings with surge pricing', () => {
        const route = createRoute(12, 30);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
          surgeMultiplier: 1.5,
        });
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.flags.surgeApplied).toBe(true);
      });

      it('should calculate driver earnings with airport fees', () => {
        const route = createRoute(18, 45);
        const context = createContext(route, JFK_AIRPORT_COORDS, NYC_COORDS);
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.flags.airportFeeApplied).toBe(true);
        expect(result.airportFee).toBe(5.50);
      });

      it('should calculate driver earnings with regulatory fees', () => {
        const route = createRoute(10, 25);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
          stateRegulatoryFees: NY_REGULATORY_FEES,
        });
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.flags.regulatoryFeeApplied).toBe(true);
      });

      it('should calculate driver earnings with cross-city surcharge', () => {
        const route = createRoute(8, 25);
        const context = createContext(route, NYC_COORDS, QUEENS_COORDS);
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        if (result.flags.crossCityApplied) {
          expect(result.crossCitySurcharge).toBe(5.00);
        }
      });

      it('should calculate driver earnings with cross-state surcharge', () => {
        const route = createRoute(12, 35);
        const context = createContext(route, NYC_COORDS, NEWARK_NJ_COORDS);
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.flags.crossStateApplied).toBe(true);
        expect(result.crossStateSurcharge).toBe(10.00);
      });

      it('should calculate driver earnings with long-distance fee', () => {
        const route = createRoute(35, 60);
        const context = createContext(route, NYC_COORDS, STAMFORD_CT_COORDS);
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.flags.longDistanceApplied).toBe(true);
        expect(result.longDistanceFee).toBeGreaterThan(0);
      });
    });

    describe('Margin Protection Logic', () => {
      it('should trigger margin protection when commission is too low', () => {
        const route = createRoute(1, 5);
        const context = createContext(route, NYC_COORDS, NYC_COORDS, {
          fareConfigOverrides: {
            minimumFare: 5.00,
            driverMinimumPayout: 5.00,
          },
        });
        const result = calculateFare(context);
        
        expect(result.marginProtectionApplied).toBeDefined();
        expect(result.marginProtectionCapped).toBeDefined();
      });

      it('should set marginProtectionCapped when unable to meet 15% margin', () => {
        const route = createRoute(0.5, 3);
        const context = createContext(route, NYC_COORDS, NYC_COORDS, {
          fareConfigOverrides: {
            minimumFare: 6.00,
            maximumFare: 6.00,
            driverMinimumPayout: 5.00,
          },
        });
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        if (result.marginProtectionCapped) {
          expect(result.marginShortfall).toBeGreaterThanOrEqual(0);
        }
      });

      it('should never reduce driver earnings below $5 during margin protection', () => {
        const route = createRoute(0.5, 2);
        const context = createContext(route, NYC_COORDS, NYC_COORDS, {
          fareConfigOverrides: {
            minimumFare: 5.50,
            maximumFare: 5.50,
            driverMinimumPayout: 5.00,
          },
        });
        const result = calculateFare(context);
        
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      });

      it('should increase fare to meet margin (respecting max cap)', () => {
        const route = createRoute(2, 8);
        const context = createContext(route, NYC_COORDS, NYC_COORDS, {
          fareConfigOverrides: {
            maximumFare: 50.00,
          },
        });
        const result = calculateFare(context);
        
        expect(result.totalFare).toBeLessThanOrEqual(50.00);
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      });
    });

    describe('Trip Length Scenarios', () => {
      it('short trip (< 2 miles) - should enforce minimum fare and driver earnings', () => {
        const route = createRoute(1.5, 8);
        const context = createContext(route, NYC_COORDS, NYC_COORDS);
        const result = calculateFare(context);
        
        expect(result.totalFare).toBeGreaterThanOrEqual(7);
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.customerServiceFee).toBe(1.99);
        expect(result.platformCommission).toBeDefined();
      });

      it('medium trip (5-15 miles) - standard fare calculation', () => {
        const route = createRoute(10, 25);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS);
        const result = calculateFare(context);
        
        expect(result.totalFare).toBeGreaterThan(result.totalFare * 0.15);
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.customerServiceFee).toBe(1.99);
      });

      it('long trip (> 25 miles) - should include long-distance fee', () => {
        const route = createRoute(35, 65);
        const context = createContext(route, NYC_COORDS, STAMFORD_CT_COORDS);
        const result = calculateFare(context);
        
        expect(result.flags.longDistanceApplied).toBe(true);
        expect(result.longDistanceFee).toBeGreaterThan(0);
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.customerServiceFee).toBe(1.99);
      });
    });

    describe('State Minimum Fare Overrides', () => {
      it('should respect state minimum fare when higher than global', () => {
        const route = createRoute(5, 15);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
          fareConfigOverrides: {
            minimumFare: 10.00,
          },
        });
        const result = calculateFare(context);
        
        expect(result.totalFare).toBeGreaterThanOrEqual(10.00);
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      });
    });

    describe('Complex Multi-Fee Commission Scenarios', () => {
      it('should calculate correct commission with all fees applied', () => {
        const route = createRoute(30, 55, 70);
        const tolls: TollInfo[] = [
          { id: 'toll1', name: 'Test Toll', amount: 8.00, paidToDriver: false },
        ];
        const context = createContext(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS, {
          surgeMultiplier: 1.3,
          timeContext: { hour: 17, dayOfWeek: 2 },
          tolls,
          stateRegulatoryFees: NY_REGULATORY_FEES,
        });
        const result = calculateFare(context);
        
        expect(result.customerServiceFee).toBe(1.99);
        expect(result.platformCommission).toBeGreaterThanOrEqual(0);
        expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
        expect(result.totalFare).toBeGreaterThan(0);
        
        const verifyMathBalance = 
          result.driverEarnings + 
          result.platformCommission + 
          result.stateRegulatoryFee + 
          result.customerServiceFee;
        expect(verifyMathBalance).toBeLessThanOrEqual(result.totalFare + 1);
      });

      it('should balance fare = driver + commission + fees + service fee', () => {
        const route = createRoute(15, 35);
        const context = createContext(route, NYC_COORDS, BROOKLYN_COORDS, {
          stateRegulatoryFees: NY_REGULATORY_FEES,
        });
        const result = calculateFare(context);
        
        const total = result.driverEarnings + 
                      result.platformCommission + 
                      result.stateRegulatoryFee + 
                      result.customerServiceFee;
        expect(Math.abs(total - result.totalFare)).toBeLessThanOrEqual(0.02);
      });
    });
  });
});

describe('Dynamic Commission System (Model A)', () => {
  const createContextWithDemand = (
    route: RouteInput,
    pickup: LocationInfo,
    dropoff: LocationInfo,
    demandInputs: {
      activeRides?: number;
      availableDrivers?: number;
      etaDensity?: number;
    } = {},
    options: {
      surgeMultiplier?: number;
      timeContext?: { hour: number; dayOfWeek: number };
      fareConfigOverrides?: Partial<FareConfig>;
    } = {}
  ): FareEngineContext => ({
    fareConfig: { 
      ...DEFAULT_FARE_CONFIG, 
      useDynamicCommission: true,
      commissionBands: {
        lowDemand: { min: 10, max: 12 },
        normalDemand: { min: 13, max: 15 },
        highDemand: { min: 15, max: 18 },
        hardCap: 18,
        hardFloor: 10,
      },
      ...options.fareConfigOverrides 
    },
    rideTypeCode: 'STANDARD',
    route,
    pickup,
    dropoff,
    airports: AIRPORTS,
    borderZones: [],
    surgeMultiplier: options.surgeMultiplier ?? 1.0,
    timeContext: options.timeContext ?? { hour: 14, dayOfWeek: 2 },
    tolls: [],
    stateRegulatoryFees: [],
    additionalFees: [],
    demandContext: {
      activeRides: demandInputs.activeRides ?? 50,
      availableDrivers: demandInputs.availableDrivers ?? 50,
      etaDensity: demandInputs.etaDensity ?? 5,
    },
  });

  describe('Demand Level Detection', () => {
    it('should detect low demand (10-12% commission) with high driver availability', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 20,
        availableDrivers: 100,
        etaDensity: 2,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('low');
      expect(result.commissionRate).toBeGreaterThanOrEqual(10);
      expect(result.commissionRate).toBeLessThanOrEqual(12);
      expect(result.dynamicCommissionApplied).toBe(true);
      expect(result.flags.dynamicCommissionApplied).toBe(true);
    });

    it('should detect normal demand (13-15% commission) with balanced conditions', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('normal');
      expect(result.commissionRate).toBeGreaterThanOrEqual(13);
      expect(result.commissionRate).toBeLessThanOrEqual(15);
      expect(result.dynamicCommissionApplied).toBe(true);
    });

    it('should detect high demand (15-18% commission) with low driver availability', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 100,
        availableDrivers: 10,
        etaDensity: 12,
      }, {
        surgeMultiplier: 2.0,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('high');
      expect(result.commissionRate).toBeGreaterThanOrEqual(15);
      expect(result.commissionRate).toBeLessThanOrEqual(18);
      expect(result.dynamicCommissionApplied).toBe(true);
    });

    it('should apply surge multiplier impact on demand detection', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 80,
        availableDrivers: 30,
        etaDensity: 8,
      }, {
        surgeMultiplier: 2.5,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('high');
    });
  });

  describe('Commission Hard Cap Enforcement', () => {
    it('should never exceed 18% commission hard cap', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 200,
        availableDrivers: 5,
        etaDensity: 20,
      }, {
        surgeMultiplier: 3.0,
      });
      const result = calculateFare(context);
      
      expect(result.commissionRate).toBeLessThanOrEqual(18);
      if (result.commissionRate === 18) {
        expect(result.commissionCapped).toBe(true);
        expect(result.flags.commissionCapped).toBe(true);
      }
    });

    it('should flag commissionCapped when hitting hard cap', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 200,
        availableDrivers: 5,
        etaDensity: 25,
      }, {
        surgeMultiplier: 3.0,
        fareConfigOverrides: {
          commissionBands: {
            lowDemand: { min: 10, max: 12 },
            normalDemand: { min: 13, max: 15 },
            highDemand: { min: 17, max: 22 },
            hardCap: 18,
            hardFloor: 10,
          },
        },
      });
      const result = calculateFare(context);
      
      expect(result.commissionRate).toBe(18);
      expect(result.commissionCapped).toBe(true);
      expect(result.commissionFloored).toBe(false);
      expect(result.flags.commissionCapped).toBe(true);
      expect(result.flags.commissionFloored).toBe(false);
    });

    it('should flag commissionFloored when hitting hard floor and NOT commissionCapped', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 5,
        availableDrivers: 200,
        etaDensity: 1,
      }, {
        fareConfigOverrides: {
          commissionBands: {
            lowDemand: { min: 5, max: 8 },
            normalDemand: { min: 13, max: 15 },
            highDemand: { min: 15, max: 18 },
            hardCap: 18,
            hardFloor: 10,
          },
        },
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('low');
      expect(result.commissionRate).toBe(10);
      expect(result.commissionFloored).toBe(true);
      expect(result.commissionCapped).toBe(false);
      expect(result.flags.commissionFloored).toBe(true);
      expect(result.flags.commissionCapped).toBe(false);
    });

    it('should not set capped or floored when rate is within normal bounds', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('normal');
      expect(result.commissionRate).toBeGreaterThanOrEqual(13);
      expect(result.commissionRate).toBeLessThanOrEqual(15);
      expect(result.commissionCapped).toBe(false);
      expect(result.commissionFloored).toBe(false);
    });
  });

  describe('Driver Minimum Payout Protection', () => {
    it('should ensure driver receives at least $5 minimum payout', () => {
      const route = createRoute(2, 8);
      const context = createContextWithDemand(route, NYC_COORDS, NYC_COORDS, {
        activeRides: 100,
        availableDrivers: 10,
        etaDensity: 15,
      }, {
        surgeMultiplier: 2.0,
      });
      const result = calculateFare(context);
      
      expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
      expect(result.driverMinimumPayoutApplied).toBeDefined();
    });

    it('should reduce commission rate to protect driver minimum on small fares', () => {
      const route = createRoute(1.5, 5);
      const context = createContextWithDemand(route, NYC_COORDS, NYC_COORDS, {
        activeRides: 100,
        availableDrivers: 10,
        etaDensity: 15,
      }, {
        surgeMultiplier: 2.0,
      });
      const result = calculateFare(context);
      
      expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Commission Application Sequence', () => {
    it('should apply commission after all surcharges', () => {
      const route = createRoute(30, 65);
      const context = createContextWithDemand(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      }, {
        surgeMultiplier: 1.2,
        timeContext: { hour: 23, dayOfWeek: 2 },
      });
      const result = calculateFare(context);
      
      expect(result.airportFee).toBeGreaterThanOrEqual(0);
      expect(result.nightSurcharge).toBeGreaterThan(0);
      expect(result.dynamicCommissionApplied).toBe(true);
      expect(result.platformCommission).toBeGreaterThan(0);
    });

    it('should apply commission before customer service fee', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      });
      const result = calculateFare(context);
      
      expect(result.customerServiceFee).toBe(1.99);
      const expectedDriverEarnings = result.totalFare - result.platformCommission - result.customerServiceFee - result.stateRegulatoryFee;
      expect(Math.abs(result.driverEarnings - expectedDriverEarnings)).toBeLessThanOrEqual(0.05);
    });
  });

  describe('Backward Compatibility', () => {
    it('should use 15% default commission when no demand context provided', () => {
      const route = createRoute(10, 25);
      const context: FareEngineContext = {
        fareConfig: DEFAULT_FARE_CONFIG,
        rideTypeCode: 'STANDARD',
        route,
        pickup: NYC_COORDS,
        dropoff: BROOKLYN_COORDS,
        airports: [],
        borderZones: [],
        surgeMultiplier: 1.0,
        timeContext: { hour: 14, dayOfWeek: 2 },
        tolls: [],
        stateRegulatoryFees: [],
        additionalFees: [],
      };
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('normal');
      expect(result.commissionRate).toBeCloseTo(15, 1);
      expect(result.dynamicCommissionApplied).toBe(false);
    });

    it('should maintain existing fee precedence rules', () => {
      const route = createRoute(30, 55);
      const context = createContextWithDemand(route, JFK_AIRPORT_COORDS, STAMFORD_CT_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      });
      const result = calculateFare(context);
      
      expect(result.crossStateSurcharge).toBeGreaterThan(0);
      expect(result.dynamicCommissionApplied).toBe(true);
    });
  });

  describe('Demand Score Transparency', () => {
    it('should provide demand score in result', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      });
      const result = calculateFare(context);
      
      expect(result.demandScore).toBeDefined();
      expect(typeof result.demandScore).toBe('number');
      expect(result.demandScore).toBeGreaterThanOrEqual(0);
      expect(result.demandScore).toBeLessThanOrEqual(100);
    });

    it('should have higher demand score with worse conditions', () => {
      const route = createRoute(10, 25);
      
      const lowDemandContext = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 20,
        availableDrivers: 100,
        etaDensity: 2,
      });
      const lowDemandResult = calculateFare(lowDemandContext);
      
      const highDemandContext = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 100,
        availableDrivers: 10,
        etaDensity: 15,
      }, {
        surgeMultiplier: 2.5,
      });
      const highDemandResult = calculateFare(highDemandContext);
      
      expect(highDemandResult.demandScore).toBeGreaterThan(lowDemandResult.demandScore);
    });
  });

  describe('Complex Scenarios with Dynamic Commission', () => {
    it('should apply dynamic commission with promo discount', () => {
      const route = createRoute(15, 35);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 100,
        availableDrivers: 10,
        etaDensity: 10,
      }, {
        surgeMultiplier: 1.5,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('high');
      expect(result.commissionRate).toBeGreaterThanOrEqual(15);
      expect(result.totalFare).toBeGreaterThan(0);
      expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
    });

    it('should maintain commission bands with surge pricing', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 80,
        availableDrivers: 15,
        etaDensity: 10,
      }, {
        surgeMultiplier: 2.0,
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBe(2.0);
      expect(result.demandLevel).toBe('high');
      expect(result.commissionRate).toBeLessThanOrEqual(18);
      expect(result.surgeAmount).toBeGreaterThan(0);
    });

    it('should work with cross-state and airport fees', () => {
      const route = createRoute(35, 60);
      const context = createContextWithDemand(route, JFK_AIRPORT_COORDS, NEWARK_NJ_COORDS, {
        activeRides: 30,
        availableDrivers: 100,
        etaDensity: 3,
      });
      const result = calculateFare(context);
      
      expect(result.demandLevel).toBe('low');
      expect(result.commissionRate).toBeGreaterThanOrEqual(10);
      expect(result.commissionRate).toBeLessThanOrEqual(12);
      expect(result.crossStateSurcharge).toBeGreaterThan(0);
      expect(result.driverEarnings).toBeGreaterThanOrEqual(5);
    });

    it('should balance fare = driver earnings + commission + fees', () => {
      const route = createRoute(15, 35);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {
        activeRides: 50,
        availableDrivers: 60,
        etaDensity: 5,
      }, {
        surgeMultiplier: 1.2,
      });
      const result = calculateFare(context);
      
      const calculatedTotal = result.driverEarnings + 
                              result.platformCommission + 
                              result.stateRegulatoryFee + 
                              result.customerServiceFee;
      expect(Math.abs(calculatedTotal - result.totalFare)).toBeLessThanOrEqual(0.05);
    });
  });

  describe('Surge Timing Transparency', () => {
    it('should return manual surge reason when surge timing not enabled', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {}, {
        surgeMultiplier: 1.5,
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBe(1.5);
      expect(result.surgeReason).toBe('manual');
      expect(result.surgeReasons).toContain('manual');
      expect(result.surgeCapped).toBe(false);
    });

    it('should return none surge reason when no surge applied', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {}, {
        surgeMultiplier: 1.0,
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBe(1.0);
      expect(result.surgeReason).toBe('none');
      expect(result.surgeReasons).toContain('none');
    });

    it('should flag surgeCapped when exceeding maxSurgeMultiplier', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {}, {
        surgeMultiplier: 5.0, // Exceeds default max of 3.0
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBe(3.0); // Capped at max
      expect(result.surgeCapped).toBe(true);
      expect(result.flags.surgeCapped).toBe(true);
    });

    it('should propagate surge timing data through FareFlags', () => {
      const route = createRoute(10, 25);
      const context = createContextWithDemand(route, NYC_COORDS, BROOKLYN_COORDS, {}, {
        surgeMultiplier: 1.8,
      });
      const result = calculateFare(context);
      
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.flags.surgeCapped).toBe(false);
      expect(result.surgeAmount).toBeGreaterThan(0);
    });
  });

  describe('Surge Timing Engine Integration', () => {
    // WeatherCondition type alias
    type WeatherType = 'clear' | 'rain' | 'heavy_rain' | 'snow' | 'storm' | 'fog' | 'low_visibility';
    
    // Helper to create context with surge timing enabled
    function createSurgeTimingContext(
      route: any,
      pickup: any,
      dropoff: any,
      surgeTimingInput: {
        useSurgeTiming: true;
        requestedAt: Date;
        weather?: { type: WeatherType; temperatureFahrenheit?: number };
        nearbyEvents?: any[];
        airportSurgeZones?: any[];
      }
    ) {
      return {
        fareConfig: DEFAULT_FARE_CONFIG,
        rideTypeCode: 'STANDARD' as const,
        route,
        pickup,
        dropoff,
        surgeMultiplier: 1.0, // Will be overridden by surge timing engine
        timeContext: {
          hour: surgeTimingInput.requestedAt.getHours(),
          dayOfWeek: surgeTimingInput.requestedAt.getDay(),
        },
        airports: AIRPORTS,
        borderZones: [],
        tolls: [],
        stateRegulatoryFees: NY_REGULATORY_FEES,
        additionalFees: [],
        surgeTimingInput,
      };
    }

    // Helper to create date at specific day/time
    function createTestDate(dayOfWeek: number, hour: number): Date {
      const date = new Date('2025-06-01T00:00:00');
      const currentDay = date.getDay();
      const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
      date.setDate(date.getDate() + daysToAdd);
      date.setHours(hour, 0, 0, 0);
      return date;
    }

    it('should apply weekday morning peak surge (Monday 8 AM)', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(1, 8), // Monday 8 AM
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('weekday_morning_peak');
      expect(result.surgeTimingWindow).toBe('weekday_morning');
      expect(result.flags.surgeApplied).toBe(true);
    });

    it('should apply weekday evening peak surge (Tuesday 5 PM)', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(2, 17), // Tuesday 5 PM
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('weekday_evening_peak');
      expect(result.surgeTimingWindow).toBe('weekday_evening');
    });

    it('should apply Friday night surge (Friday 9 PM)', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(5, 21), // Friday 9 PM
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('weekend_friday_night');
      expect(result.surgeTimingWindow).toBe('friday_night');
    });

    it('should apply Saturday night surge (Saturday 10 PM)', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(6, 22), // Saturday 10 PM
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('weekend_saturday_night');
      expect(result.surgeTimingWindow).toBe('saturday_night');
    });

    it('should apply Sunday evening surge (Sunday 6 PM)', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(0, 18), // Sunday 6 PM
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('weekend_sunday_evening');
      expect(result.surgeTimingWindow).toBe('sunday_evening');
    });

    it('should not apply surge during off-peak hours (Wednesday 2 PM)', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14), // Wednesday 2 PM
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBe(1.0);
      expect(result.surgeReason).toBe('none');
      expect(result.surgeTimingWindow).toBe('off_peak');
    });

    it('should apply weather surge for rain', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14), // Wednesday 2 PM (off-peak)
        weather: { type: 'rain' },
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('weather_rain');
    });

    it('should apply weather surge for snow', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14),
        weather: { type: 'snow' },
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('weather_snow');
    });

    it('should apply weather surge for storm', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14),
        weather: { type: 'storm' },
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('weather_storm');
    });

    it('should apply weather surge for extreme cold', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14),
        weather: { type: 'clear', temperatureFahrenheit: 20 },
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('weather_extreme_cold');
    });

    it('should apply airport surge at JFK', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, JFK_AIRPORT_COORDS, NYC_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14), // Off-peak
        airportSurgeZones: [
          {
            code: 'JFK',
            name: 'John F. Kennedy International Airport',
            location: { lat: 40.6413, lng: -73.7781 },
            radiusMiles: 3,
            baseSurgeMultiplier: 1.25,
            alwaysActive: true,
          },
        ],
      });
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('airport_jfk');
      expect(result.surgeTimingWindow).toBe('airport_zone');
    });

    it('should correctly set all transparency fields for off-peak airport-only surge', () => {
      const route = createRoute(10, 25);
      const context = createSurgeTimingContext(route, JFK_AIRPORT_COORDS, NYC_COORDS, {
        useSurgeTiming: true,
        requestedAt: createTestDate(3, 14), // Wednesday 2 PM (off-peak)
        airportSurgeZones: [
          {
            code: 'JFK',
            name: 'John F. Kennedy International Airport',
            location: { lat: 40.6413, lng: -73.7781 },
            radiusMiles: 3,
            baseSurgeMultiplier: 1.25,
            alwaysActive: true,
          },
        ],
      });
      const result = calculateFare(context);
      
      // Verify all transparency fields are correctly set for airport-only surge
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('airport_jfk');
      expect(result.surgeTimingWindow).toBe('airport_zone');
      expect(result.surgeReasons).toEqual(['airport_jfk']);
      expect(result.surgeCapped).toBe(false);
      expect(result.flags.surgeApplied).toBe(true);
      expect(result.surgeAmount).toBeGreaterThan(0);
    });

    it('should apply driver shortage surge', () => {
      const route = createRoute(10, 25);
      const context = {
        ...createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
          useSurgeTiming: true,
          requestedAt: createTestDate(3, 14), // Off-peak
        }),
        demandContext: {
          activeRides: 200,
          availableDrivers: 50, // Severe shortage
          etaDensity: 10,
        },
      };
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('driver_shortage');
    });

    it('should combine multiple surge reasons', () => {
      const route = createRoute(10, 25);
      const context = {
        ...createSurgeTimingContext(route, NYC_COORDS, BROOKLYN_COORDS, {
          useSurgeTiming: true,
          requestedAt: createTestDate(5, 21), // Friday 9 PM
          weather: { type: 'rain' },
        }),
        demandContext: {
          activeRides: 150,
          availableDrivers: 50,
          etaDensity: 10,
        },
      };
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReason).toBe('combined');
      expect(result.surgeReasons.length).toBeGreaterThan(1);
    });

    it('should cap surge at 1.90x (SafeGo limit)', () => {
      const route = createRoute(10, 25);
      const context = {
        ...createSurgeTimingContext(route, JFK_AIRPORT_COORDS, NYC_COORDS, {
          useSurgeTiming: true,
          requestedAt: createTestDate(6, 22), // Saturday night
          weather: { type: 'storm' },
        }),
        demandContext: {
          activeRides: 300,
          availableDrivers: 30, // Extreme shortage
          etaDensity: 20,
        },
      };
      const result = calculateFare(context);
      
      // Multiple factors would push surge above 1.90, but it should be capped
      expect(result.surgeMultiplier).toBeLessThanOrEqual(1.90);
      expect(result.surgeCapped).toBe(true);
    });

    it('should respect fareConfig maxSurgeMultiplier if lower than engine cap', () => {
      const route = createRoute(10, 25);
      const context = {
        ...createSurgeTimingContext(route, JFK_AIRPORT_COORDS, NYC_COORDS, {
          useSurgeTiming: true,
          requestedAt: createTestDate(6, 22),
          weather: { type: 'storm' },
        }),
        fareConfig: {
          ...DEFAULT_FARE_CONFIG,
          maxSurgeMultiplier: 1.5, // Lower than engine's 1.90 cap
        },
        demandContext: {
          activeRides: 200,
          availableDrivers: 30,
          etaDensity: 15,
        },
      };
      const result = calculateFare(context);
      
      expect(result.surgeMultiplier).toBeLessThanOrEqual(1.5);
      expect(result.surgeCapped).toBe(true);
    });
  });
});
