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
}

export { DemandLevel, DemandInput, DemandResult, CommissionBands, DEFAULT_COMMISSION_BANDS };

export const DEFAULT_COMMISSION_CONFIG = {
  customerServiceFee: 1.99,
  platformCommissionPercent: 15,
  driverEarningsPercent: 85,
  driverMinimumEarnings: 5.00,
};

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
  
  marginProtectionApplied: boolean;
  marginProtectionCapped: boolean;
  marginShortfall: number;
  
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
  // ============================================
  const baseFare = fareConfig.baseFare;
  const distanceFare = roundCurrency(route.distanceMiles * fareConfig.perMileRate);
  const timeFare = roundCurrency(route.durationMinutes * fareConfig.perMinuteRate);
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
  // STEP 4: SURGE MULTIPLIER
  // ============================================
  const effectiveSurge = Math.min(surgeMultiplier, fareConfig.maxSurgeMultiplier);
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
  const isCrossStateTrip = pickup.stateCode && dropoff.stateCode && pickup.stateCode !== dropoff.stateCode;
  
  // Step 8: Apply cross-state fee (highest priority)
  if (isCrossStateTrip) {
    crossStateSurcharge = fareConfig.crossStateSurcharge;
    crossStateApplied = true;
    
    if (isCrossCityTrip) {
      addSuppression('crossCitySurcharge', 'crossStateSurcharge', 
        'Cross-state trip supersedes cross-city surcharge', fareConfig.crossCitySurcharge);
    }
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
  // STEP 15: SUBTOTAL & SERVICE FEE
  // ============================================
  const subtotalBeforeDiscount = roundCurrency(
    fareAfterSurge + 
    nightSurcharge + 
    peakHourSurcharge + 
    longDistanceFee +
    crossCitySurcharge +
    crossStateSurcharge +
    returnDeadheadFee +
    airportFee +
    borderZoneFee +
    stateRegulatoryFee +
    tollsTotal + 
    additionalFeesTotal
  );
  
  const discountAmount = 0;
  const subtotal = roundCurrency(subtotalBeforeDiscount - discountAmount);
  
  let serviceFee = roundCurrency(subtotal * fareConfig.serviceFeePercent / 100);
  serviceFee = Math.max(serviceFee, fareConfig.serviceFeeMinimum);
  serviceFee = Math.min(serviceFee, fareConfig.serviceFeeMaximum);

  // ============================================
  // STEP 16: GROSS FARE & GUARDS
  // ============================================
  const grossFare = roundCurrency(subtotal + serviceFee);
  
  const globalMinimumFare = fareConfig.minimumFare;
  const stateMinimumFare: number | undefined = undefined; // Would come from state config
  const effectiveMinimumFare = stateMinimumFare && stateMinimumFare > globalMinimumFare
    ? stateMinimumFare
    : globalMinimumFare;
  const stateMinimumFareApplied = stateMinimumFare !== undefined && stateMinimumFare > globalMinimumFare;
  
  let fareAfterGuards = grossFare;
  let minimumFareApplied = false;
  let maximumFareApplied = false;
  
  if (fareAfterGuards < effectiveMinimumFare) {
    fareAfterGuards = effectiveMinimumFare;
    minimumFareApplied = true;
  }
  
  if (fareAfterGuards > fareConfig.maximumFare) {
    fareAfterGuards = fareConfig.maximumFare;
    maximumFareApplied = true;
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
  
  if (platformCommission < targetMarginAmount) {
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
  const safegoCommission = platformCommission;
  const finalFare = fareAfterGuards;
  const companyMarginPercent = calcCommissionPercent(finalFare, platformCommission);
  const absoluteMinimumFare = effectiveMinimumFare;
  const effectiveDiscountPct = 0;

  const flags: FareFlags = {
    trafficApplied,
    surgeApplied: effectiveSurge > 1,
    nightApplied: nightSurcharge > 0,
    peakApplied: peakHourSurcharge > 0,
    longDistanceApplied: longDistanceFee > 0,
    crossCityApplied,
    crossStateApplied,
    airportFeeApplied,
    borderZoneApplied: borderZoneFeeApplied,
    regulatoryFeeApplied,
    returnDeadheadApplied,
    promoApplied: false,
    stateMinimumFareApplied,
    shortTripAdjustmentApplied,
    maximumFareApplied,
    minimumFareApplied,
    driverMinimumPayoutApplied,
    marginProtectionApplied,
    dynamicCommissionApplied,
    commissionCapped,
    commissionFloored,
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
    
    baseFare,
    distanceFare,
    timeFare,
    
    trafficAdjustment,
    trafficMultiplier,
    surgeAmount,
    surgeMultiplier: effectiveSurge,
    
    nightSurcharge,
    peakHourSurcharge,
    
    shortTripAdjustment,
    longDistanceFee,
    crossCitySurcharge,
    crossStateSurcharge,
    returnDeadheadFee,
    excessReturnMiles,
    
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
    
    minimumFareApplied,
    maximumFareApplied,
    originalCalculatedFare: grossFare,
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
    
    marginProtectionApplied,
    marginProtectionCapped,
    marginShortfall,
    
    flags,
    feeSuppressionLog,
  };
}
