/**
 * FareEngine - Pure Fare Calculation Logic
 * 
 * This module contains the deterministic fare calculation pipeline
 * without any database dependencies. It can be tested in isolation.
 * 
 * Pipeline Order (19 steps):
 * 1. Base fare calculation
 * 2. Short-trip adjustment
 * 3. Traffic multiplier
 * 4. Surge multiplier
 * 5. Time-based surcharges (night/peak - mutually exclusive)
 * 6. Long-distance fee
 * 7. Airport fee detection
 * 8. Cross-state surcharge (suppresses cross-city)
 * 9. Cross-city surcharge (may be suppressed by airport if configured)
 * 10. Border zone fee (suppressed by cross-state)
 * 11. Return deadhead fee (only when cross-state)
 * 12. State regulatory fees
 * 13. Tolls
 * 14. Additional fees
 * 15. Service fee
 * 16. Fare guards (min/max)
 * 17. Dynamic commission calculation (demand-based bands)
 * 18. Driver minimum payout
 * 19. Margin protection
 */

import { 
  detectDemand, 
  calculateDynamicCommissionRate, 
  getDemandLevelFromContext,
  DemandLevel, 
  DemandInput, 
  DemandResult,
  CommissionBands,
  DEFAULT_COMMISSION_BANDS,
} from './demandEngine';

import {
  SurgeTimingContext,
  SurgeTimingResult,
  SurgeReason,
  SurgeTimingWindow,
  calculateSurgeTiming,
  DEFAULT_SURGE_CONFIG,
  WeatherCondition,
  EventInfo,
  AirportSurgeZone,
} from './surgeTimingEngine';

import {
  enforceTLCMinimumOnFare,
  TLCPerRideResult,
  NYC_TLC_CONFIG,
} from './tlcMinimumPayEngine';

import {
  detectCrossCity,
  TLC_CROSS_CITY_FEE,
  NYCBoroughCode,
} from './nycBoroughDetection';

export type RideTypeCode = "SAVER" | "STANDARD" | "COMFORT" | "XL" | "PREMIUM";

export interface FareConfig {
  baseFare: number;
  perMileRate: number;
  perMinuteRate: number;
  minimumFare: number;
  driverPerMileRate: number;
  driverPerMinuteRate: number;
  serviceFeePercent: number;
  serviceFeeMinimum: number;
  serviceFeeMaximum: number;
  maxSurgeMultiplier: number;
  nightSurchargePercent: number;
  peakHourSurchargePercent: number;
  shortTripThresholdMiles: number;
  shortTripMinimumFare: number;
  longDistanceThresholdMiles: number;
  longDistanceFeePerMile: number;
  crossCitySurcharge: number;
  crossStateSurcharge: number;
  returnDeadheadPerMile: number;
  returnDeadheadThresholdMiles: number;
  borderZoneFee: number;
  maximumFare: number;
  driverMinimumPayout: number;
  companyMinMarginPercent: number;
  airportOverridesCrossCity: boolean;
  customerServiceFee: number;
  platformCommissionPercent: number;
  driverEarningsPercent: number;
  useDynamicCommission?: boolean;
  commissionBands?: CommissionBands;
  useTLCBaseFare?: boolean;
  tlcBaseFare?: number;
  tlcPerMinuteRate?: number;
  tlcPerMileRate?: number;
  tlcMinimumTripFare?: number;
  tlcMaximumFare?: number;
}

export { DemandLevel, DemandInput, DemandResult, CommissionBands, DEFAULT_COMMISSION_BANDS };
export { WeatherCondition, EventInfo, AirportSurgeZone, SurgeTimingContext, SurgeTimingResult, SurgeReason, SurgeTimingWindow, DEFAULT_SURGE_CONFIG };

export const DEFAULT_COMMISSION_CONFIG = {
  customerServiceFee: 1.99,
  platformCommissionPercent: 15,
  driverEarningsPercent: 85,
  driverMinimumEarnings: 5.00,
};

export const TLC_BASE_FARE_CONFIG = {
  baseFare: 2.50,
  perMinuteRate: 0.56,
  perMileRate: 1.31,
  minimumTripFare: 8.00,
  maximumFare: 500.00,
};

// ============================================
// CROSS-STATE FARE CONFIGURATION (Uber-style)
// ============================================

/**
 * Cross-State Fare Configuration
 * 
 * When pickup and dropoff are in different states, this dedicated
 * pricing model is applied instead of regular fare calculation.
 * 
 * Formula:
 * fare = (baseFare + distanceCost + timeCost + crossStateSurcharge + tolls) * surgeMultiplier
 */
export interface CrossStateFareConfig {
  baseFare: number;           // Fixed base fare for cross-state trips
  perMileRate: number;        // Rate per mile traveled
  perMinuteRate: number;      // Rate per minute duration
  crossStateSurcharge: number; // Flat surcharge for crossing state lines
  defaultSurgeMultiplier: number; // Default surge (admin can override)
  minimumFare: number;        // Minimum fare for cross-state trips
  maximumFare: number;        // Maximum fare for cross-state trips
}

export const CROSS_STATE_FARE_CONFIG: CrossStateFareConfig = {
  baseFare: 3.00,
  perMileRate: 2.00,
  perMinuteRate: 0.60,
  crossStateSurcharge: 2.00,
  defaultSurgeMultiplier: 1.0,
  minimumFare: 15.00,  // Higher minimum for cross-state
  maximumFare: 1000.00, // Higher max for cross-state
};

/**
 * Cross-State Fare Calculation Result
 */
export interface CrossStateFareResult {
  isCrossState: boolean;
  pickupState: string;
  dropoffState: string;
  
  // Fare components (pre-surge)
  baseFare: number;
  distanceCost: number;
  timeCost: number;
  crossStateSurcharge: number;
  tollsTotal: number;
  
  // Pre-surge subtotal
  preSurgeSubtotal: number;
  
  // Surge application
  surgeMultiplier: number;
  surgeAmount: number;
  surgeApplied: boolean;
  
  // Final fare
  totalFare: number;
  minimumFareApplied: boolean;
  maximumFareApplied: boolean;
  originalCalculatedFare: number;
  
  // Breakdown for UI
  fareBreakdown: {
    baseFare: number;
    distanceCost: number;
    timeCost: number;
    crossStateSurcharge: number;
    tollsTotal: number;
    surgeAmount: number;
    totalFare: number;
  };
}

/**
 * Detect if a trip crosses state boundaries
 */
export function isCrossStateTrip(
  pickupState: string | undefined,
  dropoffState: string | undefined
): boolean {
  if (!pickupState || !dropoffState) {
    return false;
  }
  return pickupState.toUpperCase() !== dropoffState.toUpperCase();
}

/**
 * Calculate Cross-State Fare using Uber-style pricing model
 * 
 * This function is called when pickup_state != dropoff_state.
 * It uses a completely different pricing formula than in-state trips.
 * 
 * @param distanceMiles Trip distance in miles
 * @param durationMinutes Trip duration in minutes
 * @param pickupState Pickup state code (e.g., "NJ", "NY", "PA")
 * @param dropoffState Dropoff state code
 * @param tollsTotal Total tolls for the trip
 * @param surgeMultiplier Admin-configured surge multiplier (default 1.0)
 * @param config Optional custom config (uses default if not provided)
 */
export function calculateCrossStateFare(
  distanceMiles: number,
  durationMinutes: number,
  pickupState: string,
  dropoffState: string,
  tollsTotal: number = 0,
  surgeMultiplier: number = CROSS_STATE_FARE_CONFIG.defaultSurgeMultiplier,
  config: CrossStateFareConfig = CROSS_STATE_FARE_CONFIG
): CrossStateFareResult {
  // Validate cross-state
  const isCrossState = isCrossStateTrip(pickupState, dropoffState);
  
  if (!isCrossState) {
    // Return zero result if not actually cross-state
    console.log(`[CrossStateFare] NOT triggered - same state: ${pickupState}`);
    return {
      isCrossState: false,
      pickupState: pickupState || '',
      dropoffState: dropoffState || '',
      baseFare: 0,
      distanceCost: 0,
      timeCost: 0,
      crossStateSurcharge: 0,
      tollsTotal: 0,
      preSurgeSubtotal: 0,
      surgeMultiplier: 1.0,
      surgeAmount: 0,
      surgeApplied: false,
      totalFare: 0,
      minimumFareApplied: false,
      maximumFareApplied: false,
      originalCalculatedFare: 0,
      fareBreakdown: {
        baseFare: 0,
        distanceCost: 0,
        timeCost: 0,
        crossStateSurcharge: 0,
        tollsTotal: 0,
        surgeAmount: 0,
        totalFare: 0,
      },
    };
  }

  console.log(`[CrossStateFare] TRIGGERED - ${pickupState} → ${dropoffState}`);
  console.log(`[CrossStateFare] Distance: ${distanceMiles.toFixed(2)} mi, Duration: ${durationMinutes.toFixed(1)} min`);
  console.log(`[CrossStateFare] Tolls: $${tollsTotal.toFixed(2)}, Surge: ${surgeMultiplier}x`);

  // Calculate fare components
  const baseFare = roundCurrency(config.baseFare);
  const distanceCost = roundCurrency(distanceMiles * config.perMileRate);
  const timeCost = roundCurrency(durationMinutes * config.perMinuteRate);
  const crossStateSurcharge = roundCurrency(config.crossStateSurcharge);
  const tolls = roundCurrency(tollsTotal);

  // Pre-surge subtotal
  const preSurgeSubtotal = roundCurrency(
    baseFare + distanceCost + timeCost + crossStateSurcharge + tolls
  );

  console.log(`[CrossStateFare] Pre-surge breakdown:`);
  console.log(`  Base fare: $${baseFare.toFixed(2)}`);
  console.log(`  Distance ($${config.perMileRate}/mi × ${distanceMiles.toFixed(2)}mi): $${distanceCost.toFixed(2)}`);
  console.log(`  Time ($${config.perMinuteRate}/min × ${durationMinutes.toFixed(1)}min): $${timeCost.toFixed(2)}`);
  console.log(`  Cross-state surcharge: $${crossStateSurcharge.toFixed(2)}`);
  console.log(`  Tolls: $${tolls.toFixed(2)}`);
  console.log(`  Pre-surge subtotal: $${preSurgeSubtotal.toFixed(2)}`);

  // Apply surge multiplier
  const effectiveSurge = Math.max(1.0, surgeMultiplier);
  const surgeApplied = effectiveSurge > 1.0;
  const fareAfterSurge = roundCurrency(preSurgeSubtotal * effectiveSurge);
  const surgeAmount = surgeApplied ? roundCurrency(fareAfterSurge - preSurgeSubtotal) : 0;

  if (surgeApplied) {
    console.log(`[CrossStateFare] Surge applied: ${effectiveSurge}x = +$${surgeAmount.toFixed(2)}`);
  }

  // Apply minimum/maximum fare guards
  let finalFare = fareAfterSurge;
  let minimumFareApplied = false;
  let maximumFareApplied = false;
  const originalCalculatedFare = fareAfterSurge;

  if (finalFare < config.minimumFare) {
    finalFare = config.minimumFare;
    minimumFareApplied = true;
    console.log(`[CrossStateFare] Minimum fare applied: $${config.minimumFare.toFixed(2)}`);
  }

  if (finalFare > config.maximumFare) {
    finalFare = config.maximumFare;
    maximumFareApplied = true;
    console.log(`[CrossStateFare] Maximum fare applied: $${config.maximumFare.toFixed(2)}`);
  }

  console.log(`[CrossStateFare] Final fare: $${finalFare.toFixed(2)}`);

  return {
    isCrossState: true,
    pickupState: pickupState.toUpperCase(),
    dropoffState: dropoffState.toUpperCase(),
    baseFare,
    distanceCost,
    timeCost,
    crossStateSurcharge,
    tollsTotal: tolls,
    preSurgeSubtotal,
    surgeMultiplier: effectiveSurge,
    surgeAmount,
    surgeApplied,
    totalFare: finalFare,
    minimumFareApplied,
    maximumFareApplied,
    originalCalculatedFare,
    fareBreakdown: {
      baseFare,
      distanceCost,
      timeCost,
      crossStateSurcharge,
      tollsTotal: tolls,
      surgeAmount,
      totalFare: finalFare,
    },
  };
}

export interface RouteInput {
  routeId: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  summary?: string;
  tollSegments?: string[];
}

export interface LocationInfo {
  lat: number;
  lng: number;
  cityCode?: string;
  stateCode?: string;
}

export interface AirportZone {
  code: string;
  name: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  pickupFee: number;
  dropoffFee: number;
  state: string;
}

export interface BorderZone {
  id: string;
  name: string;
  states: string[];
  polygon: { lat: number; lng: number }[];
}

export interface TollInfo {
  id: string;
  name: string;
  amount: number;
  paidToDriver: boolean;
}

export interface StateRegulatoryFee {
  name: string;
  type: 'percent' | 'flat';
  amount: number;
}

export interface TimeContext {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
}

export interface DemandContext {
  activeRides?: number;
  availableDrivers?: number;
  etaDensity?: number;
}

export interface SurgeTimingInput {
  weather?: WeatherCondition;
  nearbyEvents?: EventInfo[];
  airportSurgeZones?: AirportSurgeZone[];
  useSurgeTiming?: boolean;
  requestedAt?: Date; // Explicit timestamp for deterministic testing
}

export interface FareEngineContext {
  fareConfig: FareConfig;
  rideTypeCode: RideTypeCode;
  route: RouteInput;
  pickup: LocationInfo;
  dropoff: LocationInfo;
  surgeMultiplier: number;
  timeContext: TimeContext;
  airports: AirportZone[];
  borderZones: BorderZone[];
  tolls: TollInfo[];
  stateRegulatoryFees: StateRegulatoryFee[];
  additionalFees: { id: string; name: string; amount: number }[];
  demandContext?: DemandContext;
  surgeTimingInput?: SurgeTimingInput;
}

export interface FeeBreakdownItem {
  id: string;
  name: string;
  amount: number;
  type: "flat" | "percent" | "per_unit";
  description?: string;
  isRegulatory?: boolean;
  paidToDriver?: boolean;
}

export interface FareFlags {
  trafficApplied: boolean;
  surgeApplied: boolean;
  surgeCapped: boolean;
  nightApplied: boolean;
  peakApplied: boolean;
  longDistanceApplied: boolean;
  crossCityApplied: boolean;
  crossStateApplied: boolean;
  airportFeeApplied: boolean;
  borderZoneApplied: boolean;
  regulatoryFeeApplied: boolean;
  returnDeadheadApplied: boolean;
  promoApplied: boolean;
  stateMinimumFareApplied: boolean;
  shortTripAdjustmentApplied: boolean;
  maximumFareApplied: boolean;
  minimumFareApplied: boolean;
  driverMinimumPayoutApplied: boolean;
  marginProtectionApplied: boolean;
  dynamicCommissionApplied: boolean;
  commissionCapped: boolean;
  commissionFloored: boolean;
  tlcBaseFareApplied: boolean;
  tlcTimeRateApplied: boolean;
  tlcDistanceRateApplied: boolean;
  tlcMinimumFareApplied: boolean;
  tlcMaximumFareApplied: boolean;
  tlcCrossBoroughApplied: boolean;
}

export interface FeeSuppressionEntry {
  fee: string;
  suppressedBy: string;
  reason: string;
  wouldHaveBeenAmount?: number;
}

export interface FeeSuppressionLog {
  entries: FeeSuppressionEntry[];
  timestamp: Date;
}

export interface FareEngineResult {
  routeId: string;
  routeSummary?: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  
  trafficAdjustment: number;
  trafficMultiplier: number;
  surgeAmount: number;
  surgeMultiplier: number;
  
  nightSurcharge: number;
  peakHourSurcharge: number;
  
  shortTripAdjustment: number;
  longDistanceFee: number;
  crossCitySurcharge: number;
  crossStateSurcharge: number;
  returnDeadheadFee: number;
  excessReturnMiles: number;
  
  // Cross-State Fare Engine (Uber-style)
  crossStateFareApplied: boolean;
  crossStatePickupState?: string;
  crossStateDropoffState?: string;
  crossStateFareBaseFare?: number;
  crossStateFareDistanceCost?: number;
  crossStateFareTimeCost?: number;
  crossStateFareSurcharge?: number;
  crossStateFareTolls?: number;
  crossStateFarePreSurgeSubtotal?: number;
  crossStateFareSurgeMultiplier?: number;
  crossStateFareSurgeAmount?: number;
  crossStateFareSurgeApplied?: boolean;
  crossStateFareTotal?: number;
  crossStateFareMinimumApplied?: boolean;
  crossStateFareMaximumApplied?: boolean;
  crossStateFareOriginal?: number;
  
  tlcCrossBoroughFee: number;
  tlcCrossBoroughApplied: boolean;
  tlcPickupBorough?: NYCBoroughCode;
  tlcDropoffBorough?: NYCBoroughCode;
  
  airportFee: number;
  airportCode?: string;
  borderZoneFee: number;
  
  stateRegulatoryFee: number;
  stateRegulatoryFeeBreakdown: FeeBreakdownItem[];
  
  tollsTotal: number;
  tollsBreakdown: FeeBreakdownItem[];
  additionalFeesTotal: number;
  additionalFeesBreakdown: FeeBreakdownItem[];
  serviceFee: number;
  
  discountAmount: number;
  effectiveDiscountPct: number;
  
  subtotal: number;
  totalFare: number;
  
  minimumFareApplied: boolean;
  maximumFareApplied: boolean;
  originalCalculatedFare: number;
  stateMinimumFare?: number;
  absoluteMinimumFare: number;
  
  driverPayout: number;
  driverMinimumPayoutApplied: boolean;
  safegoCommission: number;
  companyMarginPercent: number;
  
  customerServiceFee: number;
  platformCommission: number;
  driverEarnings: number;
  driverEarningsMinimumApplied: boolean;
  
  demandLevel: DemandLevel;
  demandScore: number;
  commissionRate: number;
  dynamicCommissionApplied: boolean;
  commissionCapped: boolean;
  commissionFloored: boolean;
  
  // Surge timing transparency fields
  surgeReason: string;
  surgeReasons: string[];
  surgeTimingWindow: string;
  surgeCapped: boolean;
  
  marginProtectionApplied: boolean;
  marginProtectionCapped: boolean;
  marginShortfall: number;
  
  tlcMinimumPayApplied: boolean;
  tlcAdjustment: number;
  tlcTimeBasedMinimum: number;
  tlcHourlyEquivalent: number;
  tlcFinalMinimum: number;
  tlcUtilizationRate?: number;
  tlcHourlyGuaranteeApplied?: boolean;
  tlcWeeklyAdjustment?: number;
  tlcDetails?: TLCPerRideResult;
  
  tlcBaseFare: number;
  tlcTimeFare: number;
  tlcDistanceFare: number;
  tlcCalculatedFare: number;
  tlcMinimumTripFare: number;
  tlcMaximumTripFare: number;
  tlcBaseFareApplied: boolean;
  tlcTimeRateApplied: boolean;
  tlcDistanceRateApplied: boolean;
  tlcMinimumFareApplied: boolean;
  tlcMaximumFareApplied: boolean;
  
  flags: FareFlags;
  feeSuppressionLog: FeeSuppressionLog;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function haversineDistanceMiles(
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

function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

function getTrafficLevel(
  normalDuration: number,
  trafficDuration?: number
): "light" | "moderate" | "heavy" {
  if (!trafficDuration || trafficDuration <= normalDuration) {
    return "light";
  }
  
  const ratio = trafficDuration / normalDuration;
  if (ratio < 1.15) return "light";
  if (ratio < 1.35) return "moderate";
  return "heavy";
}

function isNightTime(hour: number): boolean {
  return hour >= 20 || hour < 6;
}

function isPeakHour(hour: number, dayOfWeek: number): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (hour >= 7 && hour < 9) return true;
  if (hour >= 16 && hour < 19) return true;
  return false;
}

function detectAirportZone(
  point: { lat: number; lng: number },
  airports: AirportZone[]
): AirportZone | null {
  for (const airport of airports) {
    const distance = haversineDistanceMiles(point.lat, point.lng, airport.lat, airport.lng);
    if (distance <= airport.radiusMiles) {
      return airport;
    }
  }
  return null;
}

function detectBorderZone(
  point: { lat: number; lng: number },
  borderZones: BorderZone[]
): BorderZone | null {
  for (const zone of borderZones) {
    if (isPointInPolygon(point, zone.polygon)) {
      return zone;
    }
  }
  return null;
}

export function calculateFare(context: FareEngineContext): FareEngineResult {
  const {
    fareConfig,
    route,
    pickup,
    dropoff,
    surgeMultiplier,
    timeContext,
    airports,
    borderZones,
    tolls,
    stateRegulatoryFees,
    additionalFees,
    demandContext,
  } = context;

  const suppressionEntries: FeeSuppressionEntry[] = [];
  const addSuppression = (fee: string, suppressedBy: string, reason: string, amount?: number) => {
    suppressionEntries.push({ fee, suppressedBy, reason, wouldHaveBeenAmount: amount });
  };

  // ============================================
  // STEP 1: BASE FARE CALCULATION
  // Including NYC TLC Time-Distance Base Fare Formula
  // ============================================
  const useTLCBaseFare = fareConfig.useTLCBaseFare ?? false;
  
  let baseFare: number;
  let distanceFare: number;
  let timeFare: number;
  let tlcBaseFare = 0;
  let tlcTimeFare = 0;
  let tlcDistanceFare = 0;
  let tlcCalculatedFare = 0;
  let tlcMinimumTripFare = TLC_BASE_FARE_CONFIG.minimumTripFare;
  let tlcMaximumTripFare = TLC_BASE_FARE_CONFIG.maximumFare;
  let tlcBaseFareApplied = false;
  let tlcTimeRateApplied = false;
  let tlcDistanceRateApplied = false;
  let tlcMinimumFareApplied = false;
  let tlcMaximumFareApplied = false;
  
  if (useTLCBaseFare) {
    const effectiveTLCBaseFare = fareConfig.tlcBaseFare ?? TLC_BASE_FARE_CONFIG.baseFare;
    const effectiveTLCPerMinute = fareConfig.tlcPerMinuteRate ?? TLC_BASE_FARE_CONFIG.perMinuteRate;
    const effectiveTLCPerMile = fareConfig.tlcPerMileRate ?? TLC_BASE_FARE_CONFIG.perMileRate;
    tlcMinimumTripFare = fareConfig.tlcMinimumTripFare ?? TLC_BASE_FARE_CONFIG.minimumTripFare;
    tlcMaximumTripFare = fareConfig.tlcMaximumFare ?? TLC_BASE_FARE_CONFIG.maximumFare;
    
    tlcBaseFare = roundCurrency(effectiveTLCBaseFare);
    tlcTimeFare = roundCurrency(route.durationMinutes * effectiveTLCPerMinute);
    tlcDistanceFare = roundCurrency(route.distanceMiles * effectiveTLCPerMile);
    tlcCalculatedFare = roundCurrency(tlcBaseFare + tlcTimeFare + tlcDistanceFare);
    
    tlcBaseFareApplied = tlcBaseFare > 0;
    tlcTimeRateApplied = tlcTimeFare > 0;
    tlcDistanceRateApplied = tlcDistanceFare > 0;
    
    if (tlcCalculatedFare < tlcMinimumTripFare) {
      tlcMinimumFareApplied = true;
    }
    
    if (tlcCalculatedFare > tlcMaximumTripFare) {
      tlcMaximumFareApplied = true;
    }
    
    const enforcedTLCFare = Math.max(
      Math.min(tlcCalculatedFare, tlcMaximumTripFare),
      tlcMinimumTripFare
    );
    
    baseFare = tlcBaseFare;
    distanceFare = tlcDistanceFare;
    timeFare = tlcTimeFare;
    
    if (enforcedTLCFare !== tlcCalculatedFare) {
      const tlcFareDelta = roundCurrency(enforcedTLCFare - tlcCalculatedFare);
      baseFare = roundCurrency(baseFare + tlcFareDelta);
    }
    tlcCalculatedFare = enforcedTLCFare;
  } else {
    baseFare = fareConfig.baseFare;
    distanceFare = roundCurrency(route.distanceMiles * fareConfig.perMileRate);
    timeFare = roundCurrency(route.durationMinutes * fareConfig.perMinuteRate);
  }
  
  const rawFare = roundCurrency(baseFare + distanceFare + timeFare);

  // ============================================
  // STEP 2: SHORT-TRIP ADJUSTMENT
  // ============================================
  let shortTripAdjustment = 0;
  let shortTripAdjustmentApplied = false;
  
  if (route.distanceMiles < fareConfig.shortTripThresholdMiles) {
    const shortTripDiff = fareConfig.shortTripMinimumFare - rawFare;
    if (shortTripDiff > 0) {
      shortTripAdjustment = roundCurrency(shortTripDiff);
      shortTripAdjustmentApplied = true;
    }
  }
  
  const fareAfterShortTrip = roundCurrency(rawFare + shortTripAdjustment);

  // ============================================
  // STEP 3: TRAFFIC MULTIPLIER
  // ============================================
  const trafficLevel = getTrafficLevel(route.durationMinutes, route.trafficDurationMinutes);
  let trafficMultiplier = 1.0;
  let trafficApplied = false;
  
  if (trafficLevel === "moderate") {
    trafficMultiplier = 1.15;
    trafficApplied = true;
  } else if (trafficLevel === "heavy") {
    trafficMultiplier = 1.25;
    trafficApplied = true;
  }
  
  const trafficAdjustment = roundCurrency(fareAfterShortTrip * (trafficMultiplier - 1));
  const fareAfterTraffic = roundCurrency(fareAfterShortTrip * trafficMultiplier);

  // ============================================
  // STEP 4: SURGE MULTIPLIER (with Surge Timing Engine)
  // ============================================
  const { surgeTimingInput } = context;
  let surgeTimingResult: SurgeTimingResult | null = null;
  let effectiveSurge = surgeMultiplier;
  let surgeReason: string = 'none';
  let surgeReasons: string[] = ['none'];
  let surgeTimingWindow: string = 'off_peak';
  let surgeCappedByEngine = false;
  
  // Use surge timing engine if input is provided and enabled
  if (surgeTimingInput?.useSurgeTiming) {
    const surgeTimingContext: SurgeTimingContext = {
      currentTime: surgeTimingInput.requestedAt ?? new Date(),
      pickupLocation: { lat: pickup.lat, lng: pickup.lng },
      activeRequests: demandContext?.activeRides ?? 100,
      availableDrivers: demandContext?.availableDrivers ?? 100,
      weather: surgeTimingInput.weather,
      nearbyEvents: surgeTimingInput.nearbyEvents,
      airportZones: surgeTimingInput.airportSurgeZones,
    };
    
    surgeTimingResult = calculateSurgeTiming(surgeTimingContext);
    
    // Use surge timing engine result, respecting the fare config max
    effectiveSurge = Math.min(surgeTimingResult.surgeMultiplier, fareConfig.maxSurgeMultiplier);
    surgeReason = surgeTimingResult.surgeReason;
    surgeReasons = surgeTimingResult.surgeReasons;
    surgeTimingWindow = surgeTimingResult.surgeTimingWindow;
    surgeCappedByEngine = surgeTimingResult.surgeCapped || effectiveSurge < surgeTimingResult.surgeMultiplier;
  } else {
    // Use manual surge multiplier (legacy behavior)
    effectiveSurge = Math.min(surgeMultiplier, fareConfig.maxSurgeMultiplier);
    if (effectiveSurge > 1) {
      surgeReason = 'manual';
      surgeReasons = ['manual'];
    }
    surgeCappedByEngine = surgeMultiplier > fareConfig.maxSurgeMultiplier;
  }
  
  const surgeAmount = roundCurrency(fareAfterTraffic * (effectiveSurge - 1));
  const fareAfterSurge = roundCurrency(fareAfterTraffic * effectiveSurge);

  // ============================================
  // STEP 5: TIME-BASED SURCHARGES (mutually exclusive)
  // ============================================
  let nightSurcharge = 0;
  let peakHourSurcharge = 0;
  
  const isNight = isNightTime(timeContext.hour);
  const isPeak = isPeakHour(timeContext.hour, timeContext.dayOfWeek);
  
  if (isNight && fareConfig.nightSurchargePercent > 0) {
    nightSurcharge = roundCurrency(fareAfterSurge * fareConfig.nightSurchargePercent / 100);
  } else if (isPeak && fareConfig.peakHourSurchargePercent > 0) {
    peakHourSurcharge = roundCurrency(fareAfterSurge * fareConfig.peakHourSurchargePercent / 100);
  }

  // ============================================
  // STEP 6: LONG-DISTANCE FEE
  // ============================================
  let longDistanceFee = 0;
  
  if (route.distanceMiles > fareConfig.longDistanceThresholdMiles) {
    const excessMiles = route.distanceMiles - fareConfig.longDistanceThresholdMiles;
    longDistanceFee = roundCurrency(excessMiles * fareConfig.longDistanceFeePerMile);
  }

  // ============================================
  // STEP 7: AIRPORT FEE DETECTION
  // ============================================
  let airportFee = 0;
  let airportFeeApplied = false;
  let airportCode: string | undefined;
  
  const pickupAirport = detectAirportZone(pickup, airports);
  const dropoffAirport = detectAirportZone(dropoff, airports);
  
  if (pickupAirport) {
    airportFee += pickupAirport.pickupFee;
    airportCode = pickupAirport.code;
    airportFeeApplied = true;
  }
  if (dropoffAirport) {
    airportFee += dropoffAirport.dropoffFee;
    if (!airportCode) airportCode = dropoffAirport.code;
    airportFeeApplied = true;
  }
  airportFee = roundCurrency(airportFee);

  // ============================================
  // STEP 8-10: GEO-BASED CONFLICT RESOLUTION
  // Priority: cross-state > airport > cross-city
  // Border zone suppressed by cross-state
  // ============================================
  let crossCitySurcharge = 0;
  let crossStateSurcharge = 0;
  let crossCityApplied = false;
  let crossStateApplied = false;
  let borderZoneFee = 0;
  let borderZoneFeeApplied = false;
  
  const isCrossCityTrip = pickup.cityCode && dropoff.cityCode && pickup.cityCode !== dropoff.cityCode;
  const isCrossStateTripDetected = pickup.stateCode && dropoff.stateCode && pickup.stateCode !== dropoff.stateCode;
  
  // Step 8: Apply cross-state fare (highest priority - Uber-style pricing)
  if (isCrossStateTripDetected) {
    console.log(`[FareEngine] CROSS-STATE TRIP DETECTED: ${pickup.stateCode} → ${dropoff.stateCode}`);
    console.log(`[FareEngine] Cross-State Fare Engine ACTIVATED`);
    console.log(`[FareEngine] Using Uber-style pricing: base=$${CROSS_STATE_FARE_CONFIG.baseFare}, perMile=$${CROSS_STATE_FARE_CONFIG.perMileRate}, perMin=$${CROSS_STATE_FARE_CONFIG.perMinuteRate}`);
    console.log(`[FareEngine] Cross-state surcharge: $${CROSS_STATE_FARE_CONFIG.crossStateSurcharge}`);
    console.log(`[FareEngine] Trip details: ${route.distanceMiles.toFixed(2)} mi, ${route.durationMinutes.toFixed(1)} min`);
    
    crossStateSurcharge = fareConfig.crossStateSurcharge;
    crossStateApplied = true;
    
    if (isCrossCityTrip) {
      addSuppression('crossCitySurcharge', 'crossStateSurcharge', 
        'Cross-state trip supersedes cross-city surcharge', fareConfig.crossCitySurcharge);
    }
  } else if (pickup.stateCode && dropoff.stateCode) {
    console.log(`[FareEngine] In-state trip: ${pickup.stateCode} → ${dropoff.stateCode} (same state - using standard fare)`);
  }
  // Step 9: Apply cross-city fee (if not suppressed)
  else if (isCrossCityTrip) {
    const airportSuppressesCrossCity = airportFeeApplied && fareConfig.airportOverridesCrossCity;
    
    if (airportSuppressesCrossCity) {
      addSuppression('crossCitySurcharge', 'airportFee', 
        'Airport fee overrides cross-city surcharge (airportOverridesCrossCity=true)', 
        fareConfig.crossCitySurcharge);
    } else {
      crossCitySurcharge = fareConfig.crossCitySurcharge;
      crossCityApplied = true;
    }
  }
  
  // Step 10: Border zone detection
  const pickupBorderZone = detectBorderZone(pickup, borderZones);
  const dropoffBorderZone = detectBorderZone(dropoff, borderZones);
  
  if ((pickupBorderZone || dropoffBorderZone) && !crossStateApplied) {
    borderZoneFee = fareConfig.borderZoneFee;
    borderZoneFeeApplied = true;
  } else if ((pickupBorderZone || dropoffBorderZone) && crossStateApplied) {
    addSuppression('borderZoneFee', 'crossStateSurcharge', 
      'Cross-state trip supersedes border zone fee', fareConfig.borderZoneFee);
  }

  // ============================================
  // STEP 11: RETURN DEADHEAD FEE
  // ONLY applies when crossStateApplied is true
  // ============================================
  let returnDeadheadFee = 0;
  let returnDeadheadApplied = false;
  let excessReturnMiles = 0;
  
  if (crossStateApplied) {
    const returnDistance = haversineDistanceMiles(
      dropoff.lat, dropoff.lng,
      pickup.lat, pickup.lng
    );
    excessReturnMiles = Math.max(0, returnDistance - fareConfig.returnDeadheadThresholdMiles);
    if (excessReturnMiles > 0) {
      returnDeadheadFee = roundCurrency(excessReturnMiles * fareConfig.returnDeadheadPerMile);
      returnDeadheadApplied = true;
    }
  }

  // ============================================
  // STEP 11.5: NYC TLC CROSS-BOROUGH FEE
  // Applies when trip crosses NYC borough boundaries
  // Suppression: cross-state > airport (if configured) > cross-borough
  // ============================================
  let tlcCrossBoroughFee = 0;
  let tlcCrossBoroughApplied = false;
  let tlcPickupBorough: NYCBoroughCode | undefined;
  let tlcDropoffBorough: NYCBoroughCode | undefined;
  
  // Only check for NYC cross-borough if not already a cross-state trip
  if (!crossStateApplied) {
    const crossCityResult = detectCrossCity(
      pickup.lat, pickup.lng,
      dropoff.lat, dropoff.lng
    );
    
    tlcPickupBorough = crossCityResult.pickupBorough;
    tlcDropoffBorough = crossCityResult.dropoffBorough;
    
    if (crossCityResult.feeApplicable) {
      // Check if airport fee should suppress cross-borough fee
      const airportSuppressesCrossBorough = airportFeeApplied && fareConfig.airportOverridesCrossCity;
      
      if (airportSuppressesCrossBorough) {
        addSuppression('tlcCrossBoroughFee', 'airportFee', 
          `Airport fee overrides NYC cross-borough fee (${tlcPickupBorough} to ${tlcDropoffBorough})`, 
          TLC_CROSS_CITY_FEE.CROSS_BOROUGH_FEE);
      } else {
        tlcCrossBoroughFee = TLC_CROSS_CITY_FEE.CROSS_BOROUGH_FEE;
        tlcCrossBoroughApplied = true;
      }
    }
  } else if (detectCrossCity(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng).feeApplicable) {
    // Log suppression for cross-state trips that would have had cross-borough fee
    const crossCityResult = detectCrossCity(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    tlcPickupBorough = crossCityResult.pickupBorough;
    tlcDropoffBorough = crossCityResult.dropoffBorough;
    addSuppression('tlcCrossBoroughFee', 'crossStateSurcharge', 
      `Cross-state trip supersedes NYC cross-borough fee (${tlcPickupBorough} to ${tlcDropoffBorough})`, 
      TLC_CROSS_CITY_FEE.CROSS_BOROUGH_FEE);
  }

  // ============================================
  // STEP 12: STATE REGULATORY FEES
  // ============================================
  const stateRegulatoryFeeBreakdown: FeeBreakdownItem[] = [];
  let stateRegulatoryFee = 0;
  let regulatoryFeeApplied = false;
  
  for (const fee of stateRegulatoryFees) {
    let amount = 0;
    if (fee.type === 'percent') {
      amount = roundCurrency(fareAfterSurge * fee.amount / 100);
    } else {
      amount = fee.amount;
    }
    
    if (amount > 0) {
      stateRegulatoryFeeBreakdown.push({
        id: `state-${pickup.stateCode}-${fee.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: fee.name,
        amount,
        type: fee.type,
        description: `${pickup.stateCode} state regulatory fee`,
        isRegulatory: true,
      });
      stateRegulatoryFee += amount;
      regulatoryFeeApplied = true;
    }
  }
  stateRegulatoryFee = roundCurrency(stateRegulatoryFee);

  // ============================================
  // STEP 13: TOLLS
  // ============================================
  const tollsBreakdown: FeeBreakdownItem[] = tolls.map(toll => ({
    id: toll.id,
    name: toll.name,
    amount: toll.amount,
    type: "flat" as const,
    paidToDriver: toll.paidToDriver,
  }));
  const tollsTotal = roundCurrency(tolls.reduce((sum, t) => sum + t.amount, 0));

  // ============================================
  // STEP 14: ADDITIONAL FEES
  // ============================================
  const additionalFeesBreakdown: FeeBreakdownItem[] = additionalFees.map(fee => ({
    id: fee.id,
    name: fee.name,
    amount: fee.amount,
    type: "flat" as const,
  }));
  const additionalFeesTotal = roundCurrency(additionalFees.reduce((sum, f) => sum + f.amount, 0));

  // ============================================
  // STEP 14.5: CROSS-STATE FARE ENGINE
  // If pickup and dropoff are in different states,
  // calculate cross-state fare FIRST and use it to
  // completely override the normal fare pipeline.
  // This must happen BEFORE subtotal/guards calculation.
  // ============================================
  let crossStateFareResult: CrossStateFareResult | null = null;
  let usingCrossStateFare = false;
  
  if (crossStateApplied && pickup.stateCode && dropoff.stateCode) {
    crossStateFareResult = calculateCrossStateFare(
      route.distanceMiles,
      route.durationMinutes,
      pickup.stateCode,
      dropoff.stateCode,
      tollsTotal,
      effectiveSurge,
      CROSS_STATE_FARE_CONFIG
    );
    
    if (crossStateFareResult.isCrossState) {
      usingCrossStateFare = true;
      console.log(`[FareEngine] ========================================`);
      console.log(`[FareEngine] CROSS-STATE FARE ENGINE ACTIVATED`);
      console.log(`[FareEngine] Trip: ${pickup.stateCode} → ${dropoff.stateCode}`);
      console.log(`[FareEngine] Using dedicated Uber-style pricing`);
      console.log(`[FareEngine] ========================================`);
    }
  }

  // ============================================
  // STEP 15: SUBTOTAL & SERVICE FEE
  // For cross-state trips, the subtotal is calculated
  // from the cross-state fare, not the normal pipeline.
  // ============================================
  let subtotalBeforeDiscount: number;
  let discountAmount = 0;
  let subtotal: number;
  let serviceFee: number;
  let grossFare: number;
  
  if (usingCrossStateFare && crossStateFareResult) {
    // Cross-state fare includes all components (base, distance, time, surcharge, tolls, surge)
    // We use the pre-surge subtotal as the base, then apply surge
    subtotalBeforeDiscount = crossStateFareResult.preSurgeSubtotal;
    subtotal = roundCurrency(subtotalBeforeDiscount - discountAmount);
    
    // Service fee for cross-state trips
    serviceFee = roundCurrency(subtotal * fareConfig.serviceFeePercent / 100);
    serviceFee = Math.max(serviceFee, fareConfig.serviceFeeMinimum);
    serviceFee = Math.min(serviceFee, fareConfig.serviceFeeMaximum);
    
    // For cross-state, the gross fare is the cross-state total (which already includes surge)
    grossFare = crossStateFareResult.totalFare;
    
    console.log(`[FareEngine] Cross-state subtotal: $${subtotal.toFixed(2)}`);
    console.log(`[FareEngine] Cross-state service fee: $${serviceFee.toFixed(2)}`);
    console.log(`[FareEngine] Cross-state gross fare (final): $${grossFare.toFixed(2)}`);
  } else {
    // Normal fare calculation
    subtotalBeforeDiscount = roundCurrency(
      fareAfterSurge + 
      nightSurcharge + 
      peakHourSurcharge + 
      longDistanceFee +
      crossCitySurcharge +
      crossStateSurcharge +
      returnDeadheadFee +
      tlcCrossBoroughFee +  // NYC TLC cross-borough fee (after out-of-town, before service fee)
      airportFee +
      borderZoneFee +
      stateRegulatoryFee +
      tollsTotal + 
      additionalFeesTotal
    );
    
    subtotal = roundCurrency(subtotalBeforeDiscount - discountAmount);
    
    serviceFee = roundCurrency(subtotal * fareConfig.serviceFeePercent / 100);
    serviceFee = Math.max(serviceFee, fareConfig.serviceFeeMinimum);
    serviceFee = Math.min(serviceFee, fareConfig.serviceFeeMaximum);
    
    grossFare = roundCurrency(subtotal + serviceFee);
  }

  // ============================================
  // STEP 16: GROSS FARE & GUARDS
  // For cross-state trips, guards are already applied
  // in the calculateCrossStateFare function.
  // ============================================
  const globalMinimumFare = fareConfig.minimumFare;
  const stateMinimumFare: number | undefined = undefined; // Would come from state config
  const effectiveMinimumFare = stateMinimumFare && stateMinimumFare > globalMinimumFare
    ? stateMinimumFare
    : globalMinimumFare;
  const stateMinimumFareApplied = stateMinimumFare !== undefined && stateMinimumFare > globalMinimumFare;
  
  let fareAfterGuards: number;
  let minimumFareApplied = false;
  let maximumFareApplied = false;
  
  if (usingCrossStateFare && crossStateFareResult) {
    // Cross-state fare already has guards applied
    fareAfterGuards = crossStateFareResult.totalFare;
    minimumFareApplied = crossStateFareResult.minimumFareApplied;
    maximumFareApplied = crossStateFareResult.maximumFareApplied;
    
    console.log(`[FareEngine] Cross-state fare after guards: $${fareAfterGuards.toFixed(2)}`);
    if (minimumFareApplied) console.log(`[FareEngine] Cross-state minimum fare applied: $${CROSS_STATE_FARE_CONFIG.minimumFare}`);
    if (maximumFareApplied) console.log(`[FareEngine] Cross-state maximum fare applied: $${CROSS_STATE_FARE_CONFIG.maximumFare}`);
  } else {
    // Normal guards
    fareAfterGuards = grossFare;
    
    if (fareAfterGuards < effectiveMinimumFare) {
      fareAfterGuards = effectiveMinimumFare;
      minimumFareApplied = true;
    }
    
    if (fareAfterGuards > fareConfig.maximumFare) {
      fareAfterGuards = fareConfig.maximumFare;
      maximumFareApplied = true;
    }
  }

  // ============================================
  // STEP 17: DYNAMIC COMMISSION CALCULATION
  // Dynamic Commission System (Model A):
  // - Demand detection based on surge, time, and supply/demand metrics
  // - Commission bands: Low (10-12%), Normal (13-15%), High (15-18%)
  // - Hard cap: 18%, Hard floor: 10%
  // - Applied on final fare BEFORE service fee
  // ============================================
  const customerServiceFee = fareConfig.customerServiceFee ?? DEFAULT_COMMISSION_CONFIG.customerServiceFee;
  const driverEarningsPercent = fareConfig.driverEarningsPercent ?? DEFAULT_COMMISSION_CONFIG.driverEarningsPercent;
  const staticCommissionPercent = fareConfig.platformCommissionPercent ?? DEFAULT_COMMISSION_CONFIG.platformCommissionPercent;
  const driverMinimumEarnings = fareConfig.driverMinimumPayout ?? DEFAULT_COMMISSION_CONFIG.driverMinimumEarnings;
  const commissionBands = fareConfig.commissionBands ?? DEFAULT_COMMISSION_BANDS;
  
  const hasDemandContext = demandContext !== undefined && demandContext !== null;
  const useDynamicCommission = (fareConfig.useDynamicCommission ?? true) && hasDemandContext;
  
  const demandInput: DemandInput = {
    activeRides: demandContext?.activeRides ?? 50,
    availableDrivers: demandContext?.availableDrivers ?? 50,
    surgeMultiplier: effectiveSurge,
    etaDensity: demandContext?.etaDensity ?? 5,
    hour: timeContext.hour,
    dayOfWeek: timeContext.dayOfWeek,
  };
  
  const demandResult = detectDemand(demandInput);
  const demandLevel: DemandLevel = useDynamicCommission ? demandResult.demandLevel : 'normal';
  const demandScore = useDynamicCommission ? demandResult.demandScore : 50;
  
  let dynamicCommissionApplied = false;
  let commissionCapped = false;
  let commissionFloored = false;
  let effectiveCommissionRate: number;
  
  if (useDynamicCommission) {
    const commissionResult = calculateDynamicCommissionRate(demandResult, commissionBands);
    effectiveCommissionRate = commissionResult.rate;
    dynamicCommissionApplied = true;
    commissionCapped = commissionResult.wasCapped;
    commissionFloored = commissionResult.wasBelowFloor;
  } else {
    effectiveCommissionRate = staticCommissionPercent;
  }
  
  const commissionRate = effectiveCommissionRate;
  const platformCommissionPercent = effectiveCommissionRate;
  
  const driverTolls = tolls
    .filter(t => t.paidToDriver)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const driverDistanceEarnings = roundCurrency(route.distanceMiles * fareConfig.driverPerMileRate);
  const driverTimeEarnings = roundCurrency(route.durationMinutes * fareConfig.driverPerMinuteRate);
  const legacyDriverPayout = roundCurrency(driverDistanceEarnings + driverTimeEarnings + driverTolls);
  const driverMinimumPayoutApplied = legacyDriverPayout < fareConfig.driverMinimumPayout;
  
  let driverEarningsCalculated = roundCurrency(fareAfterGuards * driverEarningsPercent / 100);
  let driverEarnings = Math.max(driverEarningsCalculated, driverMinimumEarnings);
  const driverEarningsMinimumApplied = driverEarningsCalculated < driverMinimumEarnings;
  
  let driverPayout = Math.max(legacyDriverPayout, fareConfig.driverMinimumPayout);

  // ============================================
  // STEP 18: DRIVER MINIMUM PAYOUT ENFORCEMENT
  // Ensure driver always receives at least $5.00
  // ============================================
  if (driverEarnings < driverMinimumEarnings) {
    driverEarnings = driverMinimumEarnings;
  }

  // ============================================
  // STEP 19: MARGIN PROTECTION
  // If effective platform commission < target rate:
  // 1. Increase fare (respecting maximum fare cap)
  // 2. If still < target, reduce driver earnings (never below $5)
  // 3. If still < target, accept reduced margin and set marginProtectionCapped: true
  // ============================================
  const allRegulatoryFees = roundCurrency(stateRegulatoryFee);
  
  const calcPlatformCommission = (fare: number, driverPay: number) => 
    roundCurrency(fare - driverPay - allRegulatoryFees - customerServiceFee);
  
  const calcCommissionPercent = (fare: number, commission: number) => 
    fare > 0 ? roundCurrency((commission / fare) * 100) : 0;
  
  const calcMinFareForMargin = (driverPay: number) => {
    const marginDecimal = platformCommissionPercent / 100;
    if (marginDecimal >= 1) return Infinity;
    const passThroughCosts = driverPay + allRegulatoryFees + customerServiceFee;
    return roundCurrency(passThroughCosts / (1 - marginDecimal));
  };
  
  let platformCommission = calcPlatformCommission(fareAfterGuards, driverEarnings);
  let marginProtectionApplied = false;
  let marginProtectionCapped = false;
  let marginShortfall = 0;
  
  const targetMarginAmount = roundCurrency(fareAfterGuards * platformCommissionPercent / 100);
  
  // Skip margin protection fare adjustments for cross-state trips
  // Cross-state fare is already finalized with its own guards
  if (platformCommission < targetMarginAmount && !usingCrossStateFare) {
    marginProtectionApplied = true;
    
    if (platformCommission < 0 && driverEarnings > driverMinimumEarnings) {
      driverEarnings = driverMinimumEarnings;
      platformCommission = calcPlatformCommission(fareAfterGuards, driverEarnings);
    }
    
    const currentMarginPercent = calcCommissionPercent(fareAfterGuards, platformCommission);
    
    if (currentMarginPercent < platformCommissionPercent) {
      const neededFare = calcMinFareForMargin(driverEarnings);
      
      if (neededFare <= fareConfig.maximumFare) {
        fareAfterGuards = Math.max(fareAfterGuards, neededFare);
        driverEarnings = Math.max(
          roundCurrency(fareAfterGuards * driverEarningsPercent / 100),
          driverMinimumEarnings
        );
        platformCommission = calcPlatformCommission(fareAfterGuards, driverEarnings);
      } else {
        if (!maximumFareApplied) {
          fareAfterGuards = fareConfig.maximumFare;
          maximumFareApplied = true;
        }
        
        driverEarnings = Math.max(
          roundCurrency(fareAfterGuards * driverEarningsPercent / 100),
          driverMinimumEarnings
        );
        platformCommission = calcPlatformCommission(fareAfterGuards, driverEarnings);
        
        const afterFareMargin = calcCommissionPercent(fareAfterGuards, platformCommission);
        
        if (afterFareMargin < platformCommissionPercent) {
          if (driverEarnings > driverMinimumEarnings) {
            const targetDriverEarnings = roundCurrency(
              fareAfterGuards * (1 - platformCommissionPercent / 100) - allRegulatoryFees - customerServiceFee
            );
            
            if (targetDriverEarnings >= driverMinimumEarnings) {
              driverEarnings = targetDriverEarnings;
              platformCommission = calcPlatformCommission(fareAfterGuards, driverEarnings);
            } else {
              driverEarnings = driverMinimumEarnings;
              platformCommission = calcPlatformCommission(fareAfterGuards, driverEarnings);
              marginProtectionCapped = true;
            }
          } else {
            marginProtectionCapped = true;
          }
        }
      }
    }
    
    const finalMarginPercent = calcCommissionPercent(fareAfterGuards, platformCommission);
    if (finalMarginPercent < platformCommissionPercent) {
      marginProtectionCapped = true;
      marginShortfall = roundCurrency(platformCommissionPercent - finalMarginPercent);
    }
  }
  
  platformCommission = Math.max(0, platformCommission);
  let safegoCommission = platformCommission;
  
  // Final fare is already set correctly from cross-state or normal pipeline
  const finalFare = fareAfterGuards;
  
  // Log cross-state summary if applicable
  if (usingCrossStateFare && crossStateFareResult) {
    console.log(`[FareEngine] ----------------------------------------`);
    console.log(`[FareEngine] CROSS-STATE FARE SUMMARY`);
    console.log(`[FareEngine] Final fare: $${finalFare.toFixed(2)}`);
    console.log(`[FareEngine] Driver earnings: $${driverEarnings.toFixed(2)}`);
    console.log(`[FareEngine] Platform commission: $${platformCommission.toFixed(2)}`);
    console.log(`[FareEngine] ----------------------------------------`);
  }
  
  const companyMarginPercent = calcCommissionPercent(finalFare, platformCommission);
  const absoluteMinimumFare = effectiveMinimumFare;
  const effectiveDiscountPct = 0;

  const surgeCapped = surgeCappedByEngine;
  
  // ============================================
  // STEP 20: NYC TLC HVFHV MINIMUM PAY ENFORCEMENT
  // Apply TLC minimum pay requirements for NYC trips
  // Formula: max(time*$0.56 + distance*$1.31, hours*$27.86)
  // ============================================
  const tlcEnforcement = enforceTLCMinimumOnFare(
    route.durationMinutes,
    route.distanceMiles,
    driverEarnings
  );
  
  if (tlcEnforcement.tlcMinimumApplied) {
    driverEarnings = tlcEnforcement.finalDriverPayout;
  }
  
  // For cross-state trips, use cross-state flags for minimum/maximum applied
  const finalMinimumFareApplied = usingCrossStateFare 
    ? (crossStateFareResult?.minimumFareApplied ?? false) 
    : minimumFareApplied;
  const finalMaximumFareApplied = usingCrossStateFare 
    ? (crossStateFareResult?.maximumFareApplied ?? false) 
    : maximumFareApplied;
  const finalSurgeApplied = usingCrossStateFare 
    ? (crossStateFareResult?.surgeApplied ?? false) 
    : effectiveSurge > 1;
  
  const flags: FareFlags = {
    trafficApplied: usingCrossStateFare ? false : trafficApplied,
    surgeApplied: finalSurgeApplied,
    surgeCapped: usingCrossStateFare ? false : surgeCapped,
    nightApplied: usingCrossStateFare ? false : nightSurcharge > 0,
    peakApplied: usingCrossStateFare ? false : peakHourSurcharge > 0,
    longDistanceApplied: usingCrossStateFare ? false : longDistanceFee > 0,
    crossCityApplied: usingCrossStateFare ? false : crossCityApplied,
    crossStateApplied,
    airportFeeApplied: usingCrossStateFare ? false : airportFeeApplied,
    borderZoneApplied: usingCrossStateFare ? false : borderZoneFeeApplied,
    regulatoryFeeApplied: usingCrossStateFare ? false : regulatoryFeeApplied,
    returnDeadheadApplied: usingCrossStateFare ? false : returnDeadheadApplied,
    promoApplied: false,
    stateMinimumFareApplied: usingCrossStateFare ? false : stateMinimumFareApplied,
    shortTripAdjustmentApplied: usingCrossStateFare ? false : shortTripAdjustmentApplied,
    maximumFareApplied: finalMaximumFareApplied,
    minimumFareApplied: finalMinimumFareApplied,
    driverMinimumPayoutApplied,
    marginProtectionApplied: usingCrossStateFare ? false : marginProtectionApplied,
    dynamicCommissionApplied,
    commissionCapped,
    commissionFloored,
    tlcBaseFareApplied: usingCrossStateFare ? false : tlcBaseFareApplied,
    tlcTimeRateApplied: usingCrossStateFare ? false : tlcTimeRateApplied,
    tlcDistanceRateApplied: usingCrossStateFare ? false : tlcDistanceRateApplied,
    tlcMinimumFareApplied: usingCrossStateFare ? false : tlcMinimumFareApplied,
    tlcMaximumFareApplied: usingCrossStateFare ? false : tlcMaximumFareApplied,
    tlcCrossBoroughApplied: usingCrossStateFare ? false : tlcCrossBoroughApplied,
  };

  const feeSuppressionLog: FeeSuppressionLog = {
    entries: suppressionEntries,
    timestamp: new Date(),
  };

  return {
    routeId: route.routeId,
    routeSummary: route.summary,
    distanceMiles: route.distanceMiles,
    durationMinutes: route.durationMinutes,
    trafficDurationMinutes: route.trafficDurationMinutes,
    
    baseFare: usingCrossStateFare ? (crossStateFareResult?.baseFare ?? baseFare) : baseFare,
    distanceFare: usingCrossStateFare ? (crossStateFareResult?.distanceCost ?? distanceFare) : distanceFare,
    timeFare: usingCrossStateFare ? (crossStateFareResult?.timeCost ?? timeFare) : timeFare,
    
    trafficAdjustment: usingCrossStateFare ? 0 : trafficAdjustment,
    trafficMultiplier: usingCrossStateFare ? 1 : trafficMultiplier,
    surgeAmount: usingCrossStateFare ? (crossStateFareResult?.surgeAmount ?? 0) : surgeAmount,
    surgeMultiplier: usingCrossStateFare ? (crossStateFareResult?.surgeMultiplier ?? 1) : effectiveSurge,
    
    nightSurcharge,
    peakHourSurcharge,
    
    shortTripAdjustment,
    longDistanceFee,
    crossCitySurcharge,
    crossStateSurcharge,
    returnDeadheadFee,
    excessReturnMiles,
    
    // Cross-State Fare Engine fields (populated from calculateCrossStateFare result)
    crossStateFareApplied: usingCrossStateFare,
    crossStatePickupState: usingCrossStateFare ? crossStateFareResult?.pickupState : pickup.stateCode,
    crossStateDropoffState: usingCrossStateFare ? crossStateFareResult?.dropoffState : dropoff.stateCode,
    crossStateFareBaseFare: usingCrossStateFare ? crossStateFareResult?.baseFare : undefined,
    crossStateFareDistanceCost: usingCrossStateFare ? crossStateFareResult?.distanceCost : undefined,
    crossStateFareTimeCost: usingCrossStateFare ? crossStateFareResult?.timeCost : undefined,
    crossStateFareSurcharge: usingCrossStateFare ? crossStateFareResult?.crossStateSurcharge : undefined,
    crossStateFareTolls: usingCrossStateFare ? crossStateFareResult?.tollsTotal : undefined,
    crossStateFarePreSurgeSubtotal: usingCrossStateFare ? crossStateFareResult?.preSurgeSubtotal : undefined,
    crossStateFareSurgeMultiplier: usingCrossStateFare ? crossStateFareResult?.surgeMultiplier : undefined,
    crossStateFareSurgeAmount: usingCrossStateFare ? crossStateFareResult?.surgeAmount : undefined,
    crossStateFareSurgeApplied: usingCrossStateFare ? (crossStateFareResult?.surgeApplied ?? false) : false,
    crossStateFareTotal: usingCrossStateFare ? crossStateFareResult?.totalFare : undefined,
    crossStateFareMinimumApplied: usingCrossStateFare ? crossStateFareResult?.minimumFareApplied : undefined,
    crossStateFareMaximumApplied: usingCrossStateFare ? crossStateFareResult?.maximumFareApplied : undefined,
    crossStateFareOriginal: usingCrossStateFare ? crossStateFareResult?.originalCalculatedFare : undefined,
    
    tlcCrossBoroughFee,
    tlcCrossBoroughApplied,
    tlcPickupBorough,
    tlcDropoffBorough,
    
    airportFee,
    airportCode,
    borderZoneFee,
    
    stateRegulatoryFee,
    stateRegulatoryFeeBreakdown,
    
    tollsTotal,
    tollsBreakdown,
    additionalFeesTotal,
    additionalFeesBreakdown,
    serviceFee,
    
    discountAmount,
    effectiveDiscountPct,
    
    subtotal,
    totalFare: finalFare,
    
    minimumFareApplied: finalMinimumFareApplied,
    maximumFareApplied: finalMaximumFareApplied,
    originalCalculatedFare: usingCrossStateFare ? (crossStateFareResult?.originalCalculatedFare ?? grossFare) : grossFare,
    stateMinimumFare,
    absoluteMinimumFare,
    
    driverPayout,
    driverMinimumPayoutApplied,
    safegoCommission,
    companyMarginPercent,
    
    customerServiceFee,
    platformCommission,
    driverEarnings,
    driverEarningsMinimumApplied,
    
    demandLevel,
    demandScore,
    commissionRate,
    dynamicCommissionApplied,
    commissionCapped,
    commissionFloored,
    
    // Surge timing transparency
    surgeReason,
    surgeReasons,
    surgeTimingWindow,
    surgeCapped,
    
    marginProtectionApplied,
    marginProtectionCapped,
    marginShortfall,
    
    tlcMinimumPayApplied: tlcEnforcement.tlcMinimumApplied,
    tlcAdjustment: tlcEnforcement.tlcAdjustment,
    tlcTimeBasedMinimum: tlcEnforcement.tlcDetails.timeBasedMinimum,
    tlcHourlyEquivalent: tlcEnforcement.tlcDetails.hourlyEquivalentMinimum,
    tlcFinalMinimum: tlcEnforcement.tlcDetails.tlcMinimumPay,
    tlcDetails: tlcEnforcement.tlcDetails,
    
    tlcBaseFare,
    tlcTimeFare,
    tlcDistanceFare,
    tlcCalculatedFare,
    tlcMinimumTripFare,
    tlcMaximumTripFare,
    tlcBaseFareApplied,
    tlcTimeRateApplied,
    tlcDistanceRateApplied,
    tlcMinimumFareApplied,
    tlcMaximumFareApplied,
    
    flags,
    feeSuppressionLog,
  };
}
