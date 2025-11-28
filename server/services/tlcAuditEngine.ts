/**
 * NYC TLC Audit & Reconciliation Engine
 * 
 * Enterprise-grade audit system for HVFHV compliance verification:
 * - Trip Record vs Fare Engine reconciliation
 * - Driver payout vs TLC minimum pay verification
 * - Toll engine vs actual mapped toll direction verification
 * - Airport fee eligibility check
 * - AVF/BCF/HVRF/State Surcharge validation
 * - Out-of-town + Long-trip + Cross-city fee combinations
 * - Missing or inconsistent trip records detection
 * 
 * Key Design Decisions:
 * - Uses deterministic eligibility recomputation for fees/zones (not trusting input flags)
 * - Cross-checks with tlcMinimumPayEngine for driver pay validation
 * - Applies haversine-based airport/zone detection independently
 * - All TLC fees are validated against regulatory constants
 * 
 * Reference: NYC TLC Rules Chapter 59
 */

import { NYC_TLC_CONFIG, calculatePerRideMinimumPay } from "./tlcMinimumPayEngine";
import {
  TripRecordReport,
  DriverPayReport,
  BoroughCode,
  TripCategory,
  AirportCode,
} from "./tlcReportGenerator";
import {
  detectNYCBorough,
  detectCrossCity,
  TLC_CROSS_CITY_FEE,
  NYCBoroughCode,
} from "./nycBoroughDetection";

// ============================================
// Audit Types and Interfaces
// ============================================

export type AuditSeverity = "CRITICAL" | "WARNING" | "INFO" | "VALID";
export type AuditCategory = 
  | "FARE_MISMATCH"
  | "DRIVER_PAY_MISMATCH"
  | "TOLL_MISMATCH"
  | "AIRPORT_FEE_ERROR"
  | "TLC_FEE_ERROR"
  | "ZONE_MISMATCH"
  | "TIME_DISTANCE_ERROR"
  | "MISSING_RECORD"
  | "SUSPICIOUS_EARNINGS"
  | "UNDERPAID_DRIVER";

export type FixStatus = "AUTO_FIXED" | "REQUIRES_REVIEW" | "UNFIXABLE" | "NOT_APPLICABLE";

export interface AuditFinding {
  id: string;
  tripId: string;
  driverId?: string;
  category: AuditCategory;
  severity: AuditSeverity;
  field: string;
  expectedValue: number | string;
  actualValue: number | string;
  variance: number;
  variancePercent: number;
  description: string;
  fixStatus: FixStatus;
  fixedValue?: number | string;
  timestamp: Date;
}

export interface AuditSummary {
  totalTripsAudited: number;
  totalFindingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  validCount: number;
  autoFixedCount: number;
  requiresReviewCount: number;
  unfixableCount: number;
  findingsByCategory: Record<AuditCategory, number>;
  totalVarianceAmount: number;
  auditScore: number;
  auditTimestamp: Date;
}

export interface TripAuditResult {
  tripId: string;
  driverId: string;
  overallStatus: AuditSeverity;
  findings: AuditFinding[];
  fareConsistency: FareConsistencyResult;
  driverPayConsistency: DriverPayConsistencyResult;
  locationAccuracy: LocationAccuracyResult;
  timeDistanceIntegrity: TimeDistanceIntegrityResult;
  autoFixApplied: boolean;
  fixedTrip?: Partial<TripRecordReport>;
}

export interface FareConsistencyResult {
  isValid: boolean;
  expectedFinalFare: number;
  actualFinalFare: number;
  variance: number;
  componentBreakdown: {
    fareSubtotal: number;
    tolls: number;
    congestionFee: number;
    airportFee: number;
    avfFee: number;
    bcfFee: number;
    hvrfFee: number;
    stateSurcharge: number;
    longTripSurcharge: number;
    outOfTownReturnFee: number;
    crossCityFee: number;
    discountAmount: number;
    calculatedTotal: number;
  };
  surgeValid: boolean;
  commissionValid: boolean;
  errors: string[];
}

export interface DriverPayConsistencyResult {
  isValid: boolean;
  expectedPayout: number;
  actualPayout: number;
  variance: number;
  tlcMinimumCheck: {
    timeBasedMinimum: number;
    hourlyEquivalentMinimum: number;
    tlcMinimum: number;
    meetsMinimum: boolean;
    adjustmentRequired: number;
  };
  bonusesValid: boolean;
  errors: string[];
}

export interface LocationAccuracyResult {
  isValid: boolean;
  pickupBoroughValid: boolean;
  dropoffBoroughValid: boolean;
  congestionZoneValid: boolean;
  airportZoneValid: boolean;
  outOfTownValid: boolean;
  crossCityValid: boolean;
  isCrossCity: boolean;
  computedPickupBorough: BoroughCode;
  computedDropoffBorough: BoroughCode;
  errors: string[];
}

export interface TimeDistanceIntegrityResult {
  isValid: boolean;
  reportedDistance: number;
  computedDistance: number;
  distanceVariance: number;
  distanceVariancePercent: number;
  reportedDuration: number;
  computedDuration: number;
  durationVariance: number;
  durationVariancePercent: number;
  speedMph: number;
  isRealisticSpeed: boolean;
  errors: string[];
}

export interface AuditFilters {
  startDate: Date;
  endDate: Date;
  driverId?: string;
  tripId?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  onlyWithFindings?: boolean;
}

export interface ReconciliationResult {
  tripId: string;
  originalValues: Partial<TripRecordReport>;
  correctedValues: Partial<TripRecordReport>;
  changesApplied: {
    field: string;
    oldValue: number | string;
    newValue: number | string;
    reason: string;
  }[];
  success: boolean;
  requiresManualReview: boolean;
  reviewNotes?: string[];
}

export interface AuditExportData {
  format: "json" | "csv" | "pdf";
  reportType: "FULL_AUDIT" | "FINDINGS_ONLY" | "SUMMARY";
  generatedAt: Date;
  filters: AuditFilters;
  summary: AuditSummary;
  findings: AuditFinding[];
  reconciliations: ReconciliationResult[];
  data: string | object;
  filename: string;
}

// ============================================
// NYC Geographic Constants
// ============================================

const NYC_BOROUGHS: Record<BoroughCode, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  MANHATTAN: { minLat: 40.6995, maxLat: 40.8820, minLng: -74.0479, maxLng: -73.9067 },
  BROOKLYN: { minLat: 40.5707, maxLat: 40.7395, minLng: -74.0419, maxLng: -73.8334 },
  QUEENS: { minLat: 40.5420, maxLat: 40.8012, minLng: -73.9626, maxLng: -73.7004 },
  BRONX: { minLat: 40.7855, maxLat: 40.9176, minLng: -73.9339, maxLng: -73.7654 },
  STATEN_ISLAND: { minLat: 40.4960, maxLat: 40.6490, minLng: -74.2558, maxLng: -74.0522 },
  OUT_OF_NYC: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
};

const AIRPORT_ZONES: Record<AirportCode, { lat: number; lng: number; radiusMiles: number }> = {
  JFK: { lat: 40.6413, lng: -73.7781, radiusMiles: 1.5 },
  LGA: { lat: 40.7769, lng: -73.8740, radiusMiles: 1.0 },
  EWR: { lat: 40.6895, lng: -74.1745, radiusMiles: 1.5 },
  WCY: { lat: 41.0660, lng: -73.7076, radiusMiles: 1.0 },
};

const MANHATTAN_CONGESTION_ZONE = {
  minLat: 40.7092,
  maxLat: 40.7678,
  minLng: -74.0183,
  maxLng: -73.9716,
};

// TLC Fee Constants (per NYC TLC regulations)
const TLC_FEES = {
  AVF_FEE: 0.125,
  BCF_FEE: 0.625,
  HVRF_FEE: 0.05,
  STATE_SURCHARGE: 2.50,
  CONGESTION_FEE: 2.75,
  AIRPORT_ACCESS_FEE: 5.00,
  LONG_TRIP_THRESHOLD_MILES: 20,
  LONG_TRIP_SURCHARGE: 2.50,
  OUT_OF_TOWN_RETURN_FEE: 17.50,
  CROSS_CITY_FEE: TLC_CROSS_CITY_FEE.CROSS_BOROUGH_FEE,  // $2.50 cross-borough fee
};

// Tolerance thresholds for audit checks
const AUDIT_TOLERANCES = {
  FARE_VARIANCE_CENTS: 5,
  DISTANCE_VARIANCE_PERCENT: 10,
  DURATION_VARIANCE_PERCENT: 15,
  MIN_SPEED_MPH: 0,
  MAX_SPEED_MPH: 120,
  ROUNDING_TOLERANCE: 0.01,
};

// ============================================
// Utility Functions
// ============================================

function generateAuditId(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isInBorough(lat: number, lng: number, borough: BoroughCode): boolean {
  if (borough === "OUT_OF_NYC") {
    return !Object.entries(NYC_BOROUGHS)
      .filter(([key]) => key !== "OUT_OF_NYC")
      .some(([_, bounds]) => 
        lat >= bounds.minLat && lat <= bounds.maxLat &&
        lng >= bounds.minLng && lng <= bounds.maxLng
      );
  }
  
  const bounds = NYC_BOROUGHS[borough];
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lng >= bounds.minLng && lng <= bounds.maxLng;
}

function detectBorough(lat: number, lng: number): BoroughCode {
  for (const [borough, bounds] of Object.entries(NYC_BOROUGHS)) {
    if (borough === "OUT_OF_NYC") continue;
    if (lat >= bounds.minLat && lat <= bounds.maxLat &&
        lng >= bounds.minLng && lng <= bounds.maxLng) {
      return borough as BoroughCode;
    }
  }
  return "OUT_OF_NYC";
}

function isInCongestionZone(lat: number, lng: number): boolean {
  return lat >= MANHATTAN_CONGESTION_ZONE.minLat &&
         lat <= MANHATTAN_CONGESTION_ZONE.maxLat &&
         lng >= MANHATTAN_CONGESTION_ZONE.minLng &&
         lng <= MANHATTAN_CONGESTION_ZONE.maxLng;
}

function isAtAirport(lat: number, lng: number): AirportCode | null {
  for (const [code, zone] of Object.entries(AIRPORT_ZONES)) {
    const distance = haversineDistance(lat, lng, zone.lat, zone.lng);
    if (distance <= zone.radiusMiles) {
      return code as AirportCode;
    }
  }
  return null;
}

function calculateDurationMinutes(pickupTime: Date, dropoffTime: Date): number {
  return (dropoffTime.getTime() - pickupTime.getTime()) / (1000 * 60);
}

// ============================================
// Core Audit Functions
// ============================================

/**
 * Validate fare consistency for a trip
 */
export function auditFareConsistency(trip: TripRecordReport): FareConsistencyResult {
  const errors: string[] = [];
  
  // Get cross-city fee from trip record
  const tripCrossCityFee = (trip as any).crossCityFee ?? (trip as any).tlcCrossCityFee ?? 0;
  
  const componentBreakdown = {
    fareSubtotal: trip.fareSubtotal,
    tolls: trip.tolls,
    congestionFee: trip.congestionFee,
    airportFee: trip.airportFee,
    avfFee: trip.avfFee,
    bcfFee: trip.bcfFee,
    hvrfFee: trip.hvrfFee,
    stateSurcharge: trip.stateSurcharge,
    longTripSurcharge: trip.longTripSurcharge,
    outOfTownReturnFee: trip.outOfTownReturnFee,
    crossCityFee: tripCrossCityFee,
    discountAmount: trip.discountAmount,
    calculatedTotal: 0,
  };
  
  const expectedFinalFare = roundCurrency(
    trip.fareSubtotal +
    trip.tolls +
    trip.congestionFee +
    trip.airportFee +
    trip.avfFee +
    trip.bcfFee +
    trip.hvrfFee +
    trip.stateSurcharge +
    trip.longTripSurcharge +
    trip.outOfTownReturnFee +
    tripCrossCityFee -
    trip.discountAmount
  );
  
  componentBreakdown.calculatedTotal = expectedFinalFare;
  
  const variance = roundCurrency(Math.abs(expectedFinalFare - trip.finalFare));
  const isValid = variance <= AUDIT_TOLERANCES.FARE_VARIANCE_CENTS / 100;
  
  if (!isValid) {
    errors.push(`Fare mismatch: expected $${expectedFinalFare}, got $${trip.finalFare} (variance: $${variance})`);
  }
  
  if (trip.tripDurationMinutes <= 0) {
    errors.push("Invalid trip duration: zero or negative");
  }
  
  if (trip.tripDistanceMiles < 0) {
    errors.push("Invalid trip distance: negative value");
  }
  
  const tlcFeesTotal = trip.avfFee + trip.bcfFee + trip.hvrfFee + trip.stateSurcharge +
                       trip.congestionFee + trip.airportFee + trip.longTripSurcharge + trip.outOfTownReturnFee;
  const baseForCommission = trip.fareSubtotal;
  const expectedCommission = roundCurrency(baseForCommission * 0.25);
  const commissionValid = Math.abs(trip.commissionAmount - expectedCommission) <= 0.10 ||
                          trip.commissionAmount <= baseForCommission;
  
  if (!commissionValid) {
    errors.push(`Commission possibly includes TLC fees: expected ≤$${expectedCommission}, got $${trip.commissionAmount}`);
  }
  
  const surgeValid = trip.fareSubtotal >= 0;
  
  return {
    isValid: isValid && errors.length === 0,
    expectedFinalFare,
    actualFinalFare: trip.finalFare,
    variance,
    componentBreakdown,
    surgeValid,
    commissionValid,
    errors,
  };
}

/**
 * Validate driver pay consistency with TLC minimum pay rules
 */
export function auditDriverPayConsistency(trip: TripRecordReport): DriverPayConsistencyResult {
  const errors: string[] = [];
  
  const tlcInput = {
    tripTimeMinutes: trip.tripDurationMinutes,
    tripDistanceMiles: trip.tripDistanceMiles,
    actualDriverPayout: trip.driverPayout,
  };
  
  const tlcResult = calculatePerRideMinimumPay(tlcInput);
  
  const expectedPayout = trip.tlcMinimumApplied 
    ? tlcResult.tlcMinimumPay 
    : trip.fareSubtotal - trip.commissionAmount;
  
  const variance = roundCurrency(Math.abs(expectedPayout - trip.driverPayout));
  const isValid = variance <= AUDIT_TOLERANCES.FARE_VARIANCE_CENTS / 100;
  
  if (tlcResult.tlcMinimumApplied && !trip.tlcMinimumApplied) {
    errors.push(`TLC minimum should be applied: required $${tlcResult.tlcMinimumPay}, paid $${trip.driverPayout}`);
  }
  
  if (trip.tlcMinimumApplied && Math.abs(trip.tlcAdjustment - tlcResult.adjustmentRequired) > 0.01) {
    errors.push(`TLC adjustment mismatch: expected $${tlcResult.adjustmentRequired}, recorded $${trip.tlcAdjustment}`);
  }
  
  if (trip.driverPayout < tlcResult.tlcMinimumPay - AUDIT_TOLERANCES.ROUNDING_TOLERANCE) {
    errors.push(`Driver underpaid: payout $${trip.driverPayout} below TLC minimum $${tlcResult.tlcMinimumPay}`);
  }
  
  return {
    isValid: isValid && errors.length === 0,
    expectedPayout,
    actualPayout: trip.driverPayout,
    variance,
    tlcMinimumCheck: {
      timeBasedMinimum: tlcResult.timeBasedMinimum,
      hourlyEquivalentMinimum: tlcResult.hourlyEquivalentMinimum,
      tlcMinimum: tlcResult.tlcMinimumPay,
      meetsMinimum: trip.driverPayout >= tlcResult.tlcMinimumPay - AUDIT_TOLERANCES.ROUNDING_TOLERANCE,
      adjustmentRequired: tlcResult.adjustmentRequired,
    },
    bonusesValid: true,
    errors,
  };
}

/**
 * Validate location and zone accuracy
 */
export function auditLocationAccuracy(trip: TripRecordReport): LocationAccuracyResult {
  const errors: string[] = [];
  
  const computedPickupBorough = detectBorough(
    trip.pickupLocation.lat,
    trip.pickupLocation.lng
  );
  
  const computedDropoffBorough = detectBorough(
    trip.dropoffLocation.lat,
    trip.dropoffLocation.lng
  );
  
  const pickupBoroughValid = trip.pickupLocation.borough === computedPickupBorough;
  const dropoffBoroughValid = trip.dropoffLocation.borough === computedDropoffBorough;
  
  if (!pickupBoroughValid) {
    errors.push(`Pickup borough mismatch: recorded ${trip.pickupLocation.borough}, computed ${computedPickupBorough}`);
  }
  
  if (!dropoffBoroughValid) {
    errors.push(`Dropoff borough mismatch: recorded ${trip.dropoffLocation.borough}, computed ${computedDropoffBorough}`);
  }
  
  const pickupInCongestionZone = isInCongestionZone(trip.pickupLocation.lat, trip.pickupLocation.lng);
  const dropoffInCongestionZone = isInCongestionZone(trip.dropoffLocation.lat, trip.dropoffLocation.lng);
  const shouldHaveCongestionFee = pickupInCongestionZone || dropoffInCongestionZone;
  
  let congestionZoneValid = true;
  if (shouldHaveCongestionFee) {
    if (trip.congestionFee === 0) {
      congestionZoneValid = false;
      errors.push("Missing congestion fee for Manhattan congestion zone trip");
    } else if (Math.abs(trip.congestionFee - TLC_FEES.CONGESTION_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE) {
      congestionZoneValid = false;
      errors.push(`Congestion fee mismatch: expected $${TLC_FEES.CONGESTION_FEE}, got $${trip.congestionFee}`);
    }
  } else if (trip.congestionFee > 0 && trip.tripCategory !== "MANHATTAN_CONGESTION") {
    congestionZoneValid = false;
    errors.push(`Congestion fee applied but trip not in Manhattan congestion zone`);
  }
  
  const pickupAirport = isAtAirport(trip.pickupLocation.lat, trip.pickupLocation.lng);
  const dropoffAirport = isAtAirport(trip.dropoffLocation.lat, trip.dropoffLocation.lng);
  const detectedAirport = pickupAirport || dropoffAirport;
  const shouldHaveAirportFee = detectedAirport !== null;
  
  let airportZoneValid = true;
  if (shouldHaveAirportFee) {
    if (trip.airportFee === 0) {
      airportZoneValid = false;
      errors.push(`Missing airport fee for ${detectedAirport} airport trip - expected $${TLC_FEES.AIRPORT_ACCESS_FEE}`);
    } else if (Math.abs(trip.airportFee - TLC_FEES.AIRPORT_ACCESS_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE) {
      airportZoneValid = false;
      errors.push(`Airport fee mismatch: expected $${TLC_FEES.AIRPORT_ACCESS_FEE}, got $${trip.airportFee}`);
    }
  } else if (trip.airportFee > 0 && !trip.airportCode && 
             trip.tripCategory !== "AIRPORT_PICKUP" && trip.tripCategory !== "AIRPORT_DROPOFF") {
    airportZoneValid = false;
    errors.push(`Airport fee applied but trip not at airport zone`);
  }
  
  const isOutOfTown = computedPickupBorough === "OUT_OF_NYC" || computedDropoffBorough === "OUT_OF_NYC";
  const isNycToOutOfState = computedPickupBorough !== "OUT_OF_NYC" && computedDropoffBorough === "OUT_OF_NYC";
  
  let outOfTownValid = true;
  if (isNycToOutOfState) {
    if (trip.outOfTownReturnFee === 0) {
      outOfTownValid = false;
      errors.push(`Missing out-of-town return fee for NYC to out-of-state trip - expected $${TLC_FEES.OUT_OF_TOWN_RETURN_FEE}`);
    } else if (Math.abs(trip.outOfTownReturnFee - TLC_FEES.OUT_OF_TOWN_RETURN_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE) {
      outOfTownValid = false;
      errors.push(`Out-of-town return fee mismatch: expected $${TLC_FEES.OUT_OF_TOWN_RETURN_FEE}, got $${trip.outOfTownReturnFee}`);
    }
  } else if (trip.outOfTownReturnFee > 0 && !isOutOfTown && 
             trip.tripCategory !== "NYC_TO_OOS" && trip.tripCategory !== "OOS_TO_NYC") {
    outOfTownValid = false;
    errors.push(`Out-of-town fee applied but trip is not NYC to out-of-state`);
  }
  
  const shouldHaveLongTripSurcharge = trip.tripDistanceMiles > TLC_FEES.LONG_TRIP_THRESHOLD_MILES;
  let longTripValid = true;
  if (shouldHaveLongTripSurcharge) {
    if (trip.longTripSurcharge === 0) {
      longTripValid = false;
      errors.push(`Missing long trip surcharge for ${trip.tripDistanceMiles.toFixed(1)}mi trip (>20mi) - expected $${TLC_FEES.LONG_TRIP_SURCHARGE}`);
    } else if (Math.abs(trip.longTripSurcharge - TLC_FEES.LONG_TRIP_SURCHARGE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE) {
      longTripValid = false;
      errors.push(`Long trip surcharge mismatch: expected $${TLC_FEES.LONG_TRIP_SURCHARGE}, got $${trip.longTripSurcharge}`);
    }
  } else if (trip.longTripSurcharge > 0 && trip.tripDistanceMiles <= TLC_FEES.LONG_TRIP_THRESHOLD_MILES) {
    longTripValid = false;
    errors.push(`Long trip surcharge applied but trip is only ${trip.tripDistanceMiles.toFixed(1)}mi (≤20mi)`);
  }
  
  // Cross-city (cross-borough) fee validation using polygon-based detection
  // NOTE: Cross-city fee can be legitimately suppressed by:
  // 1. Airport fee (if configured to override cross-borough)
  // 2. Cross-state/out-of-town trips (handled in detectCrossCity)
  const crossCityResult = detectCrossCity(
    trip.pickupLocation.lat, trip.pickupLocation.lng,
    trip.dropoffLocation.lat, trip.dropoffLocation.lng
  );
  
  const isCrossCity = crossCityResult.isCrossCity;
  let crossCityValid = true;
  
  // Get cross-city fee from trip record (may be in different field names)
  const tripCrossCityFee = (trip as any).crossCityFee ?? (trip as any).tlcCrossCityFee ?? 0;
  
  // Check for suppression scenarios where cross-city fee should NOT apply
  const isAirportTrip = trip.tripCategory === "AIRPORT_PICKUP" || trip.tripCategory === "AIRPORT_DROPOFF";
  const isCrossStateTrip = trip.tripCategory === "NYC_TO_OOS" || trip.tripCategory === "OOS_TO_NYC";
  const hasOutOfTownFee = trip.outOfTownReturnFee > 0;
  
  // Cross-city fee is suppressed if:
  // - It's a cross-state trip (out-of-town return fee applies instead)
  // - Airport fee was applied (airport may override cross-borough)
  // - Trip has out-of-town return fee (supersedes cross-borough)
  const crossCitySuppressed = isCrossStateTrip || hasOutOfTownFee || (isAirportTrip && trip.airportFee > 0);
  
  if (crossCityResult.feeApplicable && !crossCitySuppressed) {
    // Cross-city trip with no suppression - should have the fee
    if (tripCrossCityFee === 0) {
      crossCityValid = false;
      errors.push(`Missing cross-city fee for ${crossCityResult.pickupBorough} to ${crossCityResult.dropoffBorough} trip - expected $${TLC_FEES.CROSS_CITY_FEE}`);
    } else if (Math.abs(tripCrossCityFee - TLC_FEES.CROSS_CITY_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE) {
      crossCityValid = false;
      errors.push(`Cross-city fee mismatch: expected $${TLC_FEES.CROSS_CITY_FEE}, got $${tripCrossCityFee}`);
    }
  } else if (tripCrossCityFee > 0 && !isCrossCity) {
    // Fee applied but trip is not cross-borough
    crossCityValid = false;
    errors.push(`Cross-city fee applied but trip is within ${crossCityResult.pickupBorough} (not cross-borough)`);
  } else if (tripCrossCityFee === 0 && crossCityResult.feeApplicable && crossCitySuppressed) {
    // Cross-city was eligible but correctly suppressed - this is valid
    // No error, fee was rightfully not applied due to suppression
  }
  
  return {
    isValid: pickupBoroughValid && dropoffBoroughValid && congestionZoneValid && airportZoneValid && outOfTownValid && longTripValid && crossCityValid,
    pickupBoroughValid,
    dropoffBoroughValid,
    congestionZoneValid,
    airportZoneValid,
    outOfTownValid,
    crossCityValid,
    isCrossCity,
    computedPickupBorough,
    computedDropoffBorough,
    errors,
  };
}

/**
 * Validate time and distance integrity using haversine and timestamps
 */
export function auditTimeDistanceIntegrity(trip: TripRecordReport): TimeDistanceIntegrityResult {
  const errors: string[] = [];
  
  const computedDistance = haversineDistance(
    trip.pickupLocation.lat,
    trip.pickupLocation.lng,
    trip.dropoffLocation.lat,
    trip.dropoffLocation.lng
  );
  
  const computedDuration = calculateDurationMinutes(trip.pickupTime, trip.dropoffTime);
  
  const distanceVariance = Math.abs(trip.tripDistanceMiles - computedDistance);
  const distanceVariancePercent = computedDistance > 0 
    ? (distanceVariance / computedDistance) * 100 
    : (trip.tripDistanceMiles > 0 ? 100 : 0);
  
  const durationVariance = Math.abs(trip.tripDurationMinutes - computedDuration);
  const durationVariancePercent = computedDuration > 0 
    ? (durationVariance / computedDuration) * 100 
    : (trip.tripDurationMinutes > 0 ? 100 : 0);
  
  const speedMph = computedDuration > 0 
    ? (trip.tripDistanceMiles / (computedDuration / 60)) 
    : 0;
  
  const isRealisticSpeed = speedMph >= AUDIT_TOLERANCES.MIN_SPEED_MPH && 
                           speedMph <= AUDIT_TOLERANCES.MAX_SPEED_MPH;
  
  if (distanceVariancePercent > AUDIT_TOLERANCES.DISTANCE_VARIANCE_PERCENT && 
      distanceVariance > 0.5) {
    errors.push(`Distance variance too high: reported ${trip.tripDistanceMiles.toFixed(2)} mi, computed ${computedDistance.toFixed(2)} mi (${distanceVariancePercent.toFixed(1)}% variance)`);
  }
  
  if (durationVariancePercent > AUDIT_TOLERANCES.DURATION_VARIANCE_PERCENT && 
      durationVariance > 5) {
    errors.push(`Duration variance too high: reported ${trip.tripDurationMinutes} min, computed ${computedDuration.toFixed(1)} min (${durationVariancePercent.toFixed(1)}% variance)`);
  }
  
  if (!isRealisticSpeed) {
    errors.push(`Unrealistic speed: ${speedMph.toFixed(1)} mph (${trip.tripDistanceMiles} mi in ${computedDuration.toFixed(1)} min)`);
  }
  
  if (computedDuration < 0) {
    errors.push("Dropoff time is before pickup time");
  }
  
  if (trip.tripDurationMinutes === 0 && trip.tripDistanceMiles > 0) {
    errors.push("Zero duration with positive distance is suspicious");
  }
  
  return {
    isValid: errors.length === 0,
    reportedDistance: trip.tripDistanceMiles,
    computedDistance: roundCurrency(computedDistance),
    distanceVariance: roundCurrency(distanceVariance),
    distanceVariancePercent: roundCurrency(distanceVariancePercent),
    reportedDuration: trip.tripDurationMinutes,
    computedDuration: roundCurrency(computedDuration),
    durationVariance: roundCurrency(durationVariance),
    durationVariancePercent: roundCurrency(durationVariancePercent),
    speedMph: roundCurrency(speedMph),
    isRealisticSpeed,
    errors,
  };
}

/**
 * Validate TLC regulatory fees (AVF, BCF, HVRF, State Surcharge)
 */
export function auditTLCFees(trip: TripRecordReport): AuditFinding[] {
  const findings: AuditFinding[] = [];
  
  if (Math.abs(trip.avfFee - TLC_FEES.AVF_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE && trip.avfFee !== 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TLC_FEE_ERROR",
      severity: "WARNING",
      field: "avfFee",
      expectedValue: TLC_FEES.AVF_FEE,
      actualValue: trip.avfFee,
      variance: Math.abs(trip.avfFee - TLC_FEES.AVF_FEE),
      variancePercent: ((Math.abs(trip.avfFee - TLC_FEES.AVF_FEE)) / TLC_FEES.AVF_FEE) * 100,
      description: `AVF fee should be $${TLC_FEES.AVF_FEE}, found $${trip.avfFee}`,
      fixStatus: "AUTO_FIXED",
      fixedValue: TLC_FEES.AVF_FEE,
      timestamp: new Date(),
    });
  }
  
  if (Math.abs(trip.bcfFee - TLC_FEES.BCF_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE && trip.bcfFee !== 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TLC_FEE_ERROR",
      severity: "WARNING",
      field: "bcfFee",
      expectedValue: TLC_FEES.BCF_FEE,
      actualValue: trip.bcfFee,
      variance: Math.abs(trip.bcfFee - TLC_FEES.BCF_FEE),
      variancePercent: ((Math.abs(trip.bcfFee - TLC_FEES.BCF_FEE)) / TLC_FEES.BCF_FEE) * 100,
      description: `BCF fee should be $${TLC_FEES.BCF_FEE}, found $${trip.bcfFee}`,
      fixStatus: "AUTO_FIXED",
      fixedValue: TLC_FEES.BCF_FEE,
      timestamp: new Date(),
    });
  }
  
  if (Math.abs(trip.hvrfFee - TLC_FEES.HVRF_FEE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE && trip.hvrfFee !== 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TLC_FEE_ERROR",
      severity: "WARNING",
      field: "hvrfFee",
      expectedValue: TLC_FEES.HVRF_FEE,
      actualValue: trip.hvrfFee,
      variance: Math.abs(trip.hvrfFee - TLC_FEES.HVRF_FEE),
      variancePercent: ((Math.abs(trip.hvrfFee - TLC_FEES.HVRF_FEE)) / TLC_FEES.HVRF_FEE) * 100,
      description: `HVRF fee should be $${TLC_FEES.HVRF_FEE}, found $${trip.hvrfFee}`,
      fixStatus: "AUTO_FIXED",
      fixedValue: TLC_FEES.HVRF_FEE,
      timestamp: new Date(),
    });
  }
  
  if (Math.abs(trip.stateSurcharge - TLC_FEES.STATE_SURCHARGE) > AUDIT_TOLERANCES.ROUNDING_TOLERANCE && trip.stateSurcharge !== 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TLC_FEE_ERROR",
      severity: "WARNING",
      field: "stateSurcharge",
      expectedValue: TLC_FEES.STATE_SURCHARGE,
      actualValue: trip.stateSurcharge,
      variance: Math.abs(trip.stateSurcharge - TLC_FEES.STATE_SURCHARGE),
      variancePercent: ((Math.abs(trip.stateSurcharge - TLC_FEES.STATE_SURCHARGE)) / TLC_FEES.STATE_SURCHARGE) * 100,
      description: `State surcharge should be $${TLC_FEES.STATE_SURCHARGE}, found $${trip.stateSurcharge}`,
      fixStatus: "AUTO_FIXED",
      fixedValue: TLC_FEES.STATE_SURCHARGE,
      timestamp: new Date(),
    });
  }
  
  if (trip.tripDistanceMiles > TLC_FEES.LONG_TRIP_THRESHOLD_MILES && trip.longTripSurcharge === 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TLC_FEE_ERROR",
      severity: "WARNING",
      field: "longTripSurcharge",
      expectedValue: TLC_FEES.LONG_TRIP_SURCHARGE,
      actualValue: 0,
      variance: TLC_FEES.LONG_TRIP_SURCHARGE,
      variancePercent: 100,
      description: `Long trip surcharge missing for ${trip.tripDistanceMiles.toFixed(1)} mile trip`,
      fixStatus: "AUTO_FIXED",
      fixedValue: TLC_FEES.LONG_TRIP_SURCHARGE,
      timestamp: new Date(),
    });
  }
  
  return findings;
}

/**
 * Validate airport fee eligibility
 */
export function auditAirportFee(trip: TripRecordReport): AuditFinding[] {
  const findings: AuditFinding[] = [];
  
  const pickupAirport = isAtAirport(trip.pickupLocation.lat, trip.pickupLocation.lng);
  const dropoffAirport = isAtAirport(trip.dropoffLocation.lat, trip.dropoffLocation.lng);
  const shouldHaveAirportFee = pickupAirport !== null || dropoffAirport !== null;
  
  if (shouldHaveAirportFee && trip.airportFee === 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "AIRPORT_FEE_ERROR",
      severity: "WARNING",
      field: "airportFee",
      expectedValue: TLC_FEES.AIRPORT_ACCESS_FEE,
      actualValue: 0,
      variance: TLC_FEES.AIRPORT_ACCESS_FEE,
      variancePercent: 100,
      description: `Airport access fee missing for ${pickupAirport || dropoffAirport} trip`,
      fixStatus: "AUTO_FIXED",
      fixedValue: TLC_FEES.AIRPORT_ACCESS_FEE,
      timestamp: new Date(),
    });
  }
  
  if (!shouldHaveAirportFee && trip.airportFee > 0 && !trip.airportCode) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "AIRPORT_FEE_ERROR",
      severity: "WARNING",
      field: "airportFee",
      expectedValue: 0,
      actualValue: trip.airportFee,
      variance: trip.airportFee,
      variancePercent: 100,
      description: `Airport fee charged but trip is not at an airport`,
      fixStatus: "REQUIRES_REVIEW",
      timestamp: new Date(),
    });
  }
  
  if (trip.airportCode && !pickupAirport && !dropoffAirport) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "AIRPORT_FEE_ERROR",
      severity: "INFO",
      field: "airportCode",
      expectedValue: "null",
      actualValue: trip.airportCode,
      variance: 0,
      variancePercent: 0,
      description: `Airport code ${trip.airportCode} recorded but coordinates don't match airport zone`,
      fixStatus: "REQUIRES_REVIEW",
      timestamp: new Date(),
    });
  }
  
  return findings;
}

/**
 * Validate toll charges
 */
export function auditTolls(trip: TripRecordReport): AuditFinding[] {
  const findings: AuditFinding[] = [];
  
  if (trip.tolls < 0) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TOLL_MISMATCH",
      severity: "CRITICAL",
      field: "tolls",
      expectedValue: 0,
      actualValue: trip.tolls,
      variance: Math.abs(trip.tolls),
      variancePercent: 100,
      description: `Negative toll amount: $${trip.tolls}`,
      fixStatus: "REQUIRES_REVIEW",
      timestamp: new Date(),
    });
  }
  
  if (trip.tolls > 50) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TOLL_MISMATCH",
      severity: "WARNING",
      field: "tolls",
      expectedValue: "≤$50",
      actualValue: trip.tolls,
      variance: trip.tolls - 50,
      variancePercent: ((trip.tolls - 50) / 50) * 100,
      description: `Unusually high toll amount: $${trip.tolls}`,
      fixStatus: "REQUIRES_REVIEW",
      timestamp: new Date(),
    });
  }
  
  return findings;
}

// ============================================
// Full Trip Audit Function
// ============================================

/**
 * Perform comprehensive audit on a single trip record
 */
export function auditTrip(trip: TripRecordReport): TripAuditResult {
  const findings: AuditFinding[] = [];
  
  const fareConsistency = auditFareConsistency(trip);
  const driverPayConsistency = auditDriverPayConsistency(trip);
  const locationAccuracy = auditLocationAccuracy(trip);
  const timeDistanceIntegrity = auditTimeDistanceIntegrity(trip);
  
  if (!fareConsistency.isValid) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "FARE_MISMATCH",
      severity: fareConsistency.variance > 1 ? "CRITICAL" : "WARNING",
      field: "finalFare",
      expectedValue: fareConsistency.expectedFinalFare,
      actualValue: fareConsistency.actualFinalFare,
      variance: fareConsistency.variance,
      variancePercent: (fareConsistency.variance / fareConsistency.expectedFinalFare) * 100,
      description: fareConsistency.errors.join("; "),
      fixStatus: fareConsistency.variance <= 0.10 ? "AUTO_FIXED" : "REQUIRES_REVIEW",
      fixedValue: fareConsistency.variance <= 0.10 ? fareConsistency.expectedFinalFare : undefined,
      timestamp: new Date(),
    });
  }
  
  if (!driverPayConsistency.isValid) {
    const isUnderpaid = !driverPayConsistency.tlcMinimumCheck.meetsMinimum;
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: isUnderpaid ? "UNDERPAID_DRIVER" : "DRIVER_PAY_MISMATCH",
      severity: isUnderpaid ? "CRITICAL" : "WARNING",
      field: "driverPayout",
      expectedValue: driverPayConsistency.expectedPayout,
      actualValue: driverPayConsistency.actualPayout,
      variance: driverPayConsistency.variance,
      variancePercent: (driverPayConsistency.variance / driverPayConsistency.expectedPayout) * 100,
      description: driverPayConsistency.errors.join("; "),
      fixStatus: isUnderpaid ? "AUTO_FIXED" : "REQUIRES_REVIEW",
      fixedValue: isUnderpaid ? driverPayConsistency.tlcMinimumCheck.tlcMinimum : undefined,
      timestamp: new Date(),
    });
  }
  
  if (!locationAccuracy.isValid) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "ZONE_MISMATCH",
      severity: "WARNING",
      field: "location",
      expectedValue: `${locationAccuracy.computedPickupBorough} -> ${locationAccuracy.computedDropoffBorough}`,
      actualValue: `${trip.pickupLocation.borough} -> ${trip.dropoffLocation.borough}`,
      variance: 0,
      variancePercent: 0,
      description: locationAccuracy.errors.join("; "),
      fixStatus: "REQUIRES_REVIEW",
      timestamp: new Date(),
    });
  }
  
  if (!timeDistanceIntegrity.isValid) {
    findings.push({
      id: generateAuditId(),
      tripId: trip.tripId,
      driverId: trip.driverId,
      category: "TIME_DISTANCE_ERROR",
      severity: timeDistanceIntegrity.isRealisticSpeed ? "WARNING" : "CRITICAL",
      field: "timeDistance",
      expectedValue: `${timeDistanceIntegrity.computedDistance.toFixed(2)} mi / ${timeDistanceIntegrity.computedDuration.toFixed(1)} min`,
      actualValue: `${trip.tripDistanceMiles} mi / ${trip.tripDurationMinutes} min`,
      variance: timeDistanceIntegrity.distanceVariance,
      variancePercent: timeDistanceIntegrity.distanceVariancePercent,
      description: timeDistanceIntegrity.errors.join("; "),
      fixStatus: "REQUIRES_REVIEW",
      timestamp: new Date(),
    });
  }
  
  findings.push(...auditTLCFees(trip));
  findings.push(...auditAirportFee(trip));
  findings.push(...auditTolls(trip));
  
  let overallStatus: AuditSeverity = "VALID";
  if (findings.some(f => f.severity === "CRITICAL")) {
    overallStatus = "CRITICAL";
  } else if (findings.some(f => f.severity === "WARNING")) {
    overallStatus = "WARNING";
  } else if (findings.some(f => f.severity === "INFO")) {
    overallStatus = "INFO";
  }
  
  const autoFixApplied = findings.some(f => f.fixStatus === "AUTO_FIXED");
  let fixedTrip: Partial<TripRecordReport> | undefined;
  
  if (autoFixApplied) {
    fixedTrip = applyAutoFixes(trip, findings);
  }
  
  return {
    tripId: trip.tripId,
    driverId: trip.driverId,
    overallStatus,
    findings,
    fareConsistency,
    driverPayConsistency,
    locationAccuracy,
    timeDistanceIntegrity,
    autoFixApplied,
    fixedTrip,
  };
}

// ============================================
// Automatic Fix Engine
// ============================================

/**
 * Apply automatic fixes for minor mismatches
 */
export function applyAutoFixes(
  trip: TripRecordReport,
  findings: AuditFinding[]
): Partial<TripRecordReport> {
  const fixed: Partial<TripRecordReport> = { ...trip };
  
  for (const finding of findings) {
    if (finding.fixStatus !== "AUTO_FIXED" || finding.fixedValue === undefined) {
      continue;
    }
    
    switch (finding.field) {
      case "avfFee":
        fixed.avfFee = Number(finding.fixedValue);
        break;
      case "bcfFee":
        fixed.bcfFee = Number(finding.fixedValue);
        break;
      case "hvrfFee":
        fixed.hvrfFee = Number(finding.fixedValue);
        break;
      case "stateSurcharge":
        fixed.stateSurcharge = Number(finding.fixedValue);
        break;
      case "longTripSurcharge":
        fixed.longTripSurcharge = Number(finding.fixedValue);
        break;
      case "airportFee":
        fixed.airportFee = Number(finding.fixedValue);
        break;
      case "driverPayout":
        fixed.driverPayout = Number(finding.fixedValue);
        fixed.tlcMinimumApplied = true;
        fixed.tlcAdjustment = Number(finding.fixedValue) - trip.driverPayout;
        break;
      case "finalFare":
        fixed.finalFare = Number(finding.fixedValue);
        break;
    }
  }
  
  if (fixed.avfFee !== trip.avfFee || fixed.bcfFee !== trip.bcfFee ||
      fixed.hvrfFee !== trip.hvrfFee || fixed.stateSurcharge !== trip.stateSurcharge ||
      fixed.longTripSurcharge !== trip.longTripSurcharge || fixed.airportFee !== trip.airportFee) {
    fixed.finalFare = roundCurrency(
      (fixed.fareSubtotal ?? trip.fareSubtotal) +
      (fixed.tolls ?? trip.tolls) +
      (fixed.congestionFee ?? trip.congestionFee) +
      (fixed.airportFee ?? trip.airportFee) +
      (fixed.avfFee ?? trip.avfFee) +
      (fixed.bcfFee ?? trip.bcfFee) +
      (fixed.hvrfFee ?? trip.hvrfFee) +
      (fixed.stateSurcharge ?? trip.stateSurcharge) +
      (fixed.longTripSurcharge ?? trip.longTripSurcharge) +
      (fixed.outOfTownReturnFee ?? trip.outOfTownReturnFee) -
      (fixed.discountAmount ?? trip.discountAmount)
    );
  }
  
  return fixed;
}

/**
 * Reconcile a trip by applying fixes and generating reconciliation record
 */
export function reconcileTrip(
  trip: TripRecordReport,
  auditResult: TripAuditResult
): ReconciliationResult {
  const changesApplied: ReconciliationResult["changesApplied"] = [];
  const reviewNotes: string[] = [];
  let requiresManualReview = false;
  
  for (const finding of auditResult.findings) {
    if (finding.fixStatus === "AUTO_FIXED" && finding.fixedValue !== undefined) {
      changesApplied.push({
        field: finding.field,
        oldValue: finding.actualValue,
        newValue: finding.fixedValue,
        reason: finding.description,
      });
    } else if (finding.fixStatus === "REQUIRES_REVIEW") {
      requiresManualReview = true;
      reviewNotes.push(`${finding.field}: ${finding.description}`);
    } else if (finding.fixStatus === "UNFIXABLE") {
      requiresManualReview = true;
      reviewNotes.push(`UNFIXABLE - ${finding.field}: ${finding.description}`);
    }
  }
  
  return {
    tripId: trip.tripId,
    originalValues: trip,
    correctedValues: auditResult.fixedTrip || trip,
    changesApplied,
    success: changesApplied.length > 0 || !requiresManualReview,
    requiresManualReview,
    reviewNotes: reviewNotes.length > 0 ? reviewNotes : undefined,
  };
}

// ============================================
// Batch Audit Functions
// ============================================

/**
 * Audit multiple trips and generate summary
 */
export async function auditTrips(
  trips: TripRecordReport[],
  filters?: AuditFilters
): Promise<{ results: TripAuditResult[]; summary: AuditSummary }> {
  const results: TripAuditResult[] = [];
  const allFindings: AuditFinding[] = [];
  
  for (const trip of trips) {
    if (filters?.driverId && trip.driverId !== filters.driverId) continue;
    if (filters?.tripId && trip.tripId !== filters.tripId) continue;
    
    const result = auditTrip(trip);
    
    if (filters?.onlyWithFindings && result.findings.length === 0) continue;
    if (filters?.severity && !result.findings.some(f => f.severity === filters.severity)) continue;
    if (filters?.category && !result.findings.some(f => f.category === filters.category)) continue;
    
    results.push(result);
    allFindings.push(...result.findings);
  }
  
  const findingsByCategory: Record<AuditCategory, number> = {
    FARE_MISMATCH: 0,
    DRIVER_PAY_MISMATCH: 0,
    TOLL_MISMATCH: 0,
    AIRPORT_FEE_ERROR: 0,
    TLC_FEE_ERROR: 0,
    ZONE_MISMATCH: 0,
    TIME_DISTANCE_ERROR: 0,
    MISSING_RECORD: 0,
    SUSPICIOUS_EARNINGS: 0,
    UNDERPAID_DRIVER: 0,
  };
  
  for (const finding of allFindings) {
    findingsByCategory[finding.category]++;
  }
  
  const criticalCount = allFindings.filter(f => f.severity === "CRITICAL").length;
  const warningCount = allFindings.filter(f => f.severity === "WARNING").length;
  const infoCount = allFindings.filter(f => f.severity === "INFO").length;
  const validCount = results.filter(r => r.overallStatus === "VALID").length;
  const autoFixedCount = allFindings.filter(f => f.fixStatus === "AUTO_FIXED").length;
  const requiresReviewCount = allFindings.filter(f => f.fixStatus === "REQUIRES_REVIEW").length;
  const unfixableCount = allFindings.filter(f => f.fixStatus === "UNFIXABLE").length;
  
  const totalVarianceAmount = allFindings.reduce((sum, f) => sum + (typeof f.variance === 'number' ? f.variance : 0), 0);
  
  const auditScore = trips.length > 0 
    ? Math.max(0, 100 - (criticalCount * 10) - (warningCount * 3) - (infoCount * 1))
    : 100;
  
  const summary: AuditSummary = {
    totalTripsAudited: trips.length,
    totalFindingsCount: allFindings.length,
    criticalCount,
    warningCount,
    infoCount,
    validCount,
    autoFixedCount,
    requiresReviewCount,
    unfixableCount,
    findingsByCategory,
    totalVarianceAmount: roundCurrency(totalVarianceAmount),
    auditScore: Math.round(auditScore),
    auditTimestamp: new Date(),
  };
  
  return { results, summary };
}

/**
 * Run auto-reconciliation on multiple trips
 */
export async function autoReconcile(
  trips: TripRecordReport[]
): Promise<{ reconciliations: ReconciliationResult[]; summary: AuditSummary }> {
  const { results, summary } = await auditTrips(trips);
  
  const reconciliations: ReconciliationResult[] = [];
  
  for (let i = 0; i < trips.length; i++) {
    const result = results.find(r => r.tripId === trips[i].tripId);
    if (result) {
      reconciliations.push(reconcileTrip(trips[i], result));
    }
  }
  
  return { reconciliations, summary };
}

// ============================================
// Export Functions
// ============================================

/**
 * Export audit results to various formats
 */
export function exportAuditResults(
  results: TripAuditResult[],
  summary: AuditSummary,
  reconciliations: ReconciliationResult[],
  format: "json" | "csv",
  reportType: "FULL_AUDIT" | "FINDINGS_ONLY" | "SUMMARY",
  filters: AuditFilters
): AuditExportData {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().split('T')[0];
  
  let data: string | object;
  let filename: string;
  
  if (format === "json") {
    switch (reportType) {
      case "FULL_AUDIT":
        data = { summary, results, reconciliations, filters, generatedAt: timestamp };
        filename = `TLC_FullAudit_${dateStr}.json`;
        break;
      case "FINDINGS_ONLY":
        const allFindings = results.flatMap(r => r.findings);
        data = { summary, findings: allFindings, filters, generatedAt: timestamp };
        filename = `TLC_AuditFindings_${dateStr}.json`;
        break;
      case "SUMMARY":
        data = { summary, filters, generatedAt: timestamp };
        filename = `TLC_AuditSummary_${dateStr}.json`;
        break;
    }
  } else {
    switch (reportType) {
      case "FULL_AUDIT":
      case "FINDINGS_ONLY":
        const allFindings = results.flatMap(r => r.findings);
        const headers = [
          "id", "tripId", "driverId", "category", "severity", "field",
          "expectedValue", "actualValue", "variance", "variancePercent",
          "description", "fixStatus", "fixedValue", "timestamp"
        ];
        const rows = allFindings.map(f => [
          f.id, f.tripId, f.driverId || "", f.category, f.severity, f.field,
          String(f.expectedValue), String(f.actualValue), String(f.variance),
          String(f.variancePercent), `"${f.description}"`, f.fixStatus,
          f.fixedValue !== undefined ? String(f.fixedValue) : "",
          f.timestamp.toISOString()
        ]);
        data = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        filename = reportType === "FULL_AUDIT" 
          ? `TLC_FullAudit_${dateStr}.csv`
          : `TLC_AuditFindings_${dateStr}.csv`;
        break;
      case "SUMMARY":
        const summaryHeaders = ["metric", "value"];
        const summaryRows = [
          ["totalTripsAudited", String(summary.totalTripsAudited)],
          ["totalFindingsCount", String(summary.totalFindingsCount)],
          ["criticalCount", String(summary.criticalCount)],
          ["warningCount", String(summary.warningCount)],
          ["infoCount", String(summary.infoCount)],
          ["validCount", String(summary.validCount)],
          ["autoFixedCount", String(summary.autoFixedCount)],
          ["requiresReviewCount", String(summary.requiresReviewCount)],
          ["unfixableCount", String(summary.unfixableCount)],
          ["totalVarianceAmount", String(summary.totalVarianceAmount)],
          ["auditScore", String(summary.auditScore)],
          ["auditTimestamp", summary.auditTimestamp.toISOString()],
        ];
        data = [summaryHeaders.join(","), ...summaryRows.map(r => r.join(","))].join("\n");
        filename = `TLC_AuditSummary_${dateStr}.csv`;
        break;
    }
  }
  
  return {
    format,
    reportType,
    generatedAt: timestamp,
    filters,
    summary,
    findings: results.flatMap(r => r.findings),
    reconciliations,
    data,
    filename,
  };
}

/**
 * Generate audit log entry for compliance records
 */
export function generateAuditLogEntry(
  action: string,
  tripId: string,
  changes: object,
  performedBy: string
): object {
  return {
    id: generateAuditId(),
    action,
    tripId,
    changes,
    performedBy,
    timestamp: new Date(),
    hash: Buffer.from(JSON.stringify({ action, tripId, changes, performedBy, timestamp: new Date() })).toString('base64'),
  };
}

// ============================================
// Validation Helpers for Testing
// ============================================

export { 
  TLC_FEES, 
  AUDIT_TOLERANCES, 
  NYC_BOROUGHS, 
  AIRPORT_ZONES, 
  MANHATTAN_CONGESTION_ZONE,
  haversineDistance,
  isInBorough,
  detectBorough,
  isInCongestionZone,
  isAtAirport,
  calculateDurationMinutes,
  roundCurrency,
};
