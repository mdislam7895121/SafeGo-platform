/**
 * FareCalculationService - Multi-Route Fare Engine (USA)
 * 
 * Implements Uber-level commercial fare logic with:
 * - Per-route fare calculation for all route alternatives
 * - Regulatory fee detection (BCF, Airport, Congestion, Local Tax)
 * - Toll segment detection and pricing
 * - Traffic and surge adjustments
 * - Driver payout calculation
 * - Full fare breakdown for transparency
 */

import { PrismaClient } from "@prisma/client";

// Create dedicated Prisma client for fare calculation
const prisma = new PrismaClient();

// Type definitions for fare engine models
export type RideTypeCode = "SAVER" | "STANDARD" | "COMFORT" | "XL" | "PREMIUM";

interface RideType {
  id: string;
  code: RideTypeCode;
  name: string;
  description: string | null;
  iconType: string;
  capacity: number;
  isActive: boolean;
  sortOrder: number;
}

interface RideFareConfig {
  id: string;
  rideTypeId: string;
  countryCode: string;
  cityCode: string | null;
  baseFare: any; // Decimal
  perMileRate: any;
  perMinuteRate: any;
  minimumFare: any;
  driverPerMileRate: any;
  driverPerMinuteRate: any;
  serviceFeePercent: any;
  serviceFeeMinimum: any;
  serviceFeeMaximum: any;
  maxSurgeMultiplier: any;
  surgeEnabled: boolean;
  trafficMultiplierLight: any;
  trafficMultiplierModerate: any;
  trafficMultiplierHeavy: any;
  isActive: boolean;
  version: number;
  // Extended fare config (with defaults if not in DB)
  nightSurchargePercent?: any;
  peakHourSurchargePercent?: any;
  longDistanceThresholdMiles?: any;
  longDistanceFeePerMile?: any;
  crossCitySurcharge?: any;
  crossStateSurcharge?: any;
  maximumFare?: any;
  driverMinimumPayout?: any;
  companyMinMarginPercent?: any;
}

interface RegulatoryZone {
  id: string;
  name: string;
  zoneType: string;
  countryCode: string;
  stateCode: string | null;
  cityCode: string | null;
  polygonCoordinates: any;
  boundingBoxMinLat: number | null;
  boundingBoxMaxLat: number | null;
  boundingBoxMinLng: number | null;
  boundingBoxMaxLng: number | null;
  isActive: boolean;
}

interface RegulatoryFeeConfig {
  id: string;
  zoneId: string;
  feeType: string;
  flatFeeAmount: any | null;
  percentFeeRate: any | null;
  appliesToPickup: boolean;
  appliesToDropoff: boolean;
  displayName: string;
  description: string | null;
  isActive: boolean;
  version: number;
}

interface TollConfig {
  id: string;
  name: string;
  countryCode: string;
  stateCode: string | null;
  segmentIdentifier: string;
  alternateIdentifiers: string[];
  tollRateSaver: any;
  tollRateStandard: any;
  tollRateComfort: any;
  tollRateXL: any;
  tollRatePremium: any;
  tollPaidToDriver: boolean;
  isActive: boolean;
}

interface FeeRule {
  id: string;
  feeType: string;
  countryCode: string;
  cityCode: string | null;
  flatAmount: any | null;
  perUnitAmount: any | null;
  unitType: string | null;
  freeUnits: number | null;
  minimumFee: any | null;
  maximumFee: any | null;
  requiresDriverAssigned: boolean;
  minimumMinutesAfterAccept: number | null;
  displayName: string;
  description: string | null;
  isActive: boolean;
  version: number;
}

// ============================================
// Type Definitions
// ============================================

export interface RouteInfo {
  routeId: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  polyline?: string;
  summary?: string;
  avoidsHighways?: boolean;
  avoidsTolls?: boolean;
  tollSegments?: string[]; // Names of toll roads detected on route
}

export interface FareCalculationRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  rideTypeCode: RideTypeCode;
  routes: RouteInfo[];
  countryCode?: string;
  cityCode?: string;
  surgeMultiplier?: number;
  promoCode?: string;
  customerId?: string;
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
  congestionFeeApplied: boolean;
  tlcAirportFeeApplied: boolean;
  tlcAVFFeeApplied: boolean;
  tlcBCFFeeApplied: boolean;
  tlcHVRFFeeApplied: boolean;
  tlcStateSurchargeApplied: boolean;
  tlcLongTripFeeApplied: boolean;
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

export interface RouteFareBreakdown {
  routeId: string;
  routeSummary?: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  
  // Core fare components
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  
  // Adjustments
  trafficAdjustment: number;
  trafficMultiplier: number;
  surgeAmount: number;
  surgeMultiplier: number;
  
  // Time-based surcharges (mutually exclusive)
  nightSurcharge: number;
  peakHourSurcharge: number;
  
  // Distance-based fees
  shortTripAdjustment: number;
  longDistanceFee: number;
  crossCitySurcharge: number;
  crossStateSurcharge: number;
  returnDeadheadFee: number;
  excessReturnMiles: number;
  
  // Location-based fees
  congestionFee: number;
  tlcAirportFee: number;
  tlcAirportName?: string;
  tlcAirportCode?: string;
  tlcAVFFee: number;
  tlcBCFFee: number;
  tlcBCFFeeRate: number;
  tlcHVRFFee: number;
  tlcStateSurcharge: number;
  tlcLongTripFee: number;
  airportFee: number;
  airportCode?: string;
  borderZoneFee: number;
  
  // State regulatory fees
  stateRegulatoryFee: number;
  stateRegulatoryFeeBreakdown: FeeBreakdownItem[];
  
  // Fees
  tollsTotal: number;
  tollsBreakdown: FeeBreakdownItem[];
  regulatoryFeesTotal: number;
  regulatoryFeesBreakdown: FeeBreakdownItem[];
  additionalFeesTotal: number;
  additionalFeesBreakdown: FeeBreakdownItem[];
  serviceFee: number;
  
  // Discounts
  discountAmount: number;
  promoCode?: string;
  effectiveDiscountPct: number;
  
  // Totals
  subtotal: number;
  totalFare: number;
  
  // Fare protection
  minimumFareApplied: boolean;
  maximumFareApplied: boolean;
  originalCalculatedFare: number;
  stateMinimumFare?: number;
  absoluteMinimumFare: number;
  
  // Driver payout
  driverPayout: number;
  driverMinimumPayoutApplied: boolean;
  safegoCommission: number;
  companyMarginPercent: number;
  
  // Margin protection
  marginProtectionApplied: boolean;
  marginProtectionCapped: boolean;
  marginShortfall: number;
  
  // Consolidated flags object (as per spec)
  flags: FareFlags;
  
  // Legacy individual flags (for backward compatibility)
  crossCityApplied: boolean;
  crossStateApplied: boolean;
  regulatoryFeeApplied: boolean;
  congestionFeeApplied: boolean;
  tlcAirportFeeApplied: boolean;
  tlcAVFFeeApplied: boolean;
  tlcBCFFeeApplied: boolean;
  tlcHVRFFeeApplied: boolean;
  tlcStateSurchargeApplied: boolean;
  tlcLongTripFeeApplied: boolean;
  airportFeeApplied: boolean;
  borderZoneFeeApplied: boolean;
  returnDeadheadApplied: boolean;
  stateMinimumFareApplied: boolean;
  
  // Matched zones for logging
  matchedZoneIds: string[];
  
  // Fee suppression log for audit
  feeSuppressionLog: FeeSuppressionLog;
  
  // TLC Base Fare tracking (NYC TLC Time-Distance Formula)
  tlcBaseFare: number;
  tlcTimeFare: number;
  tlcDistanceFare: number;
  tlcRawTotal: number;
  tlcEnforcedTotal: number;
  tlcCalculatedFare: number;
  tlcMinimumTripFare: number;
  tlcMaximumTripFare: number;
  tlcBaseFareApplied: boolean;
  tlcTimeRateApplied: boolean;
  tlcDistanceRateApplied: boolean;
  tlcMinimumFareApplied: boolean;
  tlcMaximumFareApplied: boolean;
  
  // Pipeline subtotal (enforced TLC or raw base+distance+time)
  baseSubtotalForPipeline: number;
  
  // Display helpers
  isCheapest?: boolean;
  isFastest?: boolean;
}

export interface FareCalculationResult {
  success: boolean;
  rideType: {
    code: RideTypeCode;
    name: string;
    description?: string;
    capacity: number;
  };
  routeFares: RouteFareBreakdown[];
  cheapestRouteId?: string;
  fastestRouteId?: string;
  currency: string;
  calculatedAt: Date;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Point-in-polygon detection using ray casting algorithm
 */
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

/**
 * Quick bounding box check before polygon detection
 */
function isInBoundingBox(
  point: { lat: number; lng: number },
  zone: RegulatoryZone
): boolean {
  if (
    zone.boundingBoxMinLat === null ||
    zone.boundingBoxMaxLat === null ||
    zone.boundingBoxMinLng === null ||
    zone.boundingBoxMaxLng === null
  ) {
    return true; // No bounding box, need full polygon check
  }
  
  return (
    point.lat >= zone.boundingBoxMinLat &&
    point.lat <= zone.boundingBoxMaxLat &&
    point.lng >= zone.boundingBoxMinLng &&
    point.lng <= zone.boundingBoxMaxLng
  );
}

/**
 * Determine traffic level based on ratio of traffic duration to normal duration
 */
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

/**
 * Round to 2 decimal places for currency
 */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Check if current time is during night hours (8PM - 6AM)
 */
function isNightTime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 20 || hour < 6;
}

/**
 * Check if current time is during peak hours (7-9AM or 4-7PM weekdays)
 */
function isPeakHour(date: Date = new Date()): boolean {
  const hour = date.getHours();
  const dayOfWeek = date.getDay();
  
  // Weekend - no peak hours
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  
  // Morning peak: 7-9AM
  if (hour >= 7 && hour < 9) return true;
  
  // Evening peak: 4-7PM
  if (hour >= 16 && hour < 19) return true;
  
  return false;
}

/**
 * Calculate Haversine distance between two points in miles
 */
function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Default fare rule values (used when not configured in DB)
const DEFAULT_FARE_RULES = {
  NIGHT_SURCHARGE_PERCENT: 10,      // 10% night surcharge (8PM-6AM)
  PEAK_HOUR_SURCHARGE_PERCENT: 15,  // 15% peak hour surcharge
  SHORT_TRIP_THRESHOLD_MILES: 2.0,  // Short trip threshold
  SHORT_TRIP_MINIMUM_FARE: 8.00,    // Minimum fare for short trips
  LONG_DISTANCE_THRESHOLD_MILES: 25, // Long distance threshold
  LONG_DISTANCE_FEE_PER_MILE: 0.50, // Extra fee per mile after threshold
  CROSS_CITY_SURCHARGE: 5.00,       // Flat fee for cross-city trips
  CROSS_STATE_SURCHARGE: 10.00,     // Flat fee for cross-state trips
  RETURN_DEADHEAD_PER_MILE: 0.25,   // Return deadhead fee per mile
  BORDER_ZONE_FEE: 3.00,            // Border zone fee
  MAXIMUM_FARE: 500.00,             // Maximum fare cap
  DRIVER_MINIMUM_PAYOUT: 5.00,      // Minimum driver payout guarantee
  COMPANY_MIN_MARGIN_PERCENT: 15,   // Minimum company margin
  AIRPORT_OVERRIDES_CROSS_CITY: true, // Airport fee overrides cross-city surcharge
  RETURN_DEADHEAD_THRESHOLD_MILES: 25, // Miles before deadhead fee kicks in
};

// State-specific regulatory fees (US states)
const STATE_REGULATORY_FEES: Record<string, { name: string; type: 'percent' | 'flat'; amount: number }[]> = {
  'NY': [{ name: 'Black Car Fund Fee', type: 'percent', amount: 2.5 }],
  'NJ': [{ name: 'Transportation Fee', type: 'flat', amount: 0.50 }],
  'CT': [{ name: 'Ride-share Fee', type: 'flat', amount: 0.40 }],
  'MA': [{ name: 'Transportation Network Surcharge', type: 'flat', amount: 0.20 }],
  'IL': [{ name: 'Ground Transportation Tax', type: 'flat', amount: 0.65 }],
  'CA': [{ name: 'Access for All Surcharge', type: 'flat', amount: 0.10 }],
};

// State-specific minimum fares (US states)
const STATE_MINIMUM_FARES: Record<string, number> = {
  'NY': 8.00,
  'NJ': 7.00,
  'CT': 6.00,
  'MA': 6.50,
  'IL': 5.50,
  'CA': 7.00,
};

// Major US airports with their geo-coordinates and fees
const AIRPORT_ZONES: {
  code: string;
  name: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  pickupFee: number;
  dropoffFee: number;
  state: string;
}[] = [
  // New York Area
  { code: 'JFK', name: 'John F. Kennedy International', lat: 40.6413, lng: -73.7781, radiusMiles: 2, pickupFee: 5.50, dropoffFee: 0, state: 'NY' },
  { code: 'LGA', name: 'LaGuardia Airport', lat: 40.7769, lng: -73.8740, radiusMiles: 1.5, pickupFee: 3.00, dropoffFee: 0, state: 'NY' },
  { code: 'EWR', name: 'Newark Liberty International', lat: 40.6895, lng: -74.1745, radiusMiles: 2, pickupFee: 4.50, dropoffFee: 0, state: 'NJ' },
  // California
  { code: 'LAX', name: 'Los Angeles International', lat: 33.9416, lng: -118.4085, radiusMiles: 2, pickupFee: 4.00, dropoffFee: 0, state: 'CA' },
  { code: 'SFO', name: 'San Francisco International', lat: 37.6213, lng: -122.3790, radiusMiles: 2, pickupFee: 5.00, dropoffFee: 0, state: 'CA' },
  { code: 'SAN', name: 'San Diego International', lat: 32.7338, lng: -117.1933, radiusMiles: 1.5, pickupFee: 3.50, dropoffFee: 0, state: 'CA' },
  // Illinois
  { code: 'ORD', name: "O'Hare International", lat: 41.9742, lng: -87.9073, radiusMiles: 2.5, pickupFee: 5.00, dropoffFee: 0, state: 'IL' },
  { code: 'MDW', name: 'Chicago Midway', lat: 41.7868, lng: -87.7522, radiusMiles: 1.5, pickupFee: 3.00, dropoffFee: 0, state: 'IL' },
  // Texas
  { code: 'DFW', name: 'Dallas/Fort Worth International', lat: 32.8998, lng: -97.0403, radiusMiles: 3, pickupFee: 4.00, dropoffFee: 0, state: 'TX' },
  { code: 'IAH', name: 'George Bush Intercontinental', lat: 29.9902, lng: -95.3368, radiusMiles: 2, pickupFee: 3.50, dropoffFee: 0, state: 'TX' },
  // Florida
  { code: 'MIA', name: 'Miami International', lat: 25.7959, lng: -80.2870, radiusMiles: 2, pickupFee: 3.50, dropoffFee: 0, state: 'FL' },
  { code: 'MCO', name: 'Orlando International', lat: 28.4312, lng: -81.3081, radiusMiles: 2, pickupFee: 3.00, dropoffFee: 0, state: 'FL' },
  // Massachusetts
  { code: 'BOS', name: 'Boston Logan International', lat: 42.3656, lng: -71.0096, radiusMiles: 1.5, pickupFee: 4.25, dropoffFee: 0, state: 'MA' },
  // Georgia
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta', lat: 33.6407, lng: -84.4277, radiusMiles: 2.5, pickupFee: 4.00, dropoffFee: 0, state: 'GA' },
  // Washington
  { code: 'SEA', name: 'Seattle-Tacoma International', lat: 47.4502, lng: -122.3088, radiusMiles: 2, pickupFee: 3.50, dropoffFee: 0, state: 'WA' },
  // DC Area
  { code: 'DCA', name: 'Reagan National', lat: 38.8512, lng: -77.0402, radiusMiles: 1.5, pickupFee: 3.00, dropoffFee: 0, state: 'VA' },
  { code: 'IAD', name: 'Washington Dulles', lat: 38.9531, lng: -77.4565, radiusMiles: 2, pickupFee: 4.00, dropoffFee: 0, state: 'VA' },
];

// Border zones (areas near state borders that have special pricing)
const BORDER_ZONES: {
  id: string;
  name: string;
  states: string[];
  polygon: { lat: number; lng: number }[];
}[] = [
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
  {
    id: 'ny-ct-border',
    name: 'NY-CT Border Zone',
    states: ['NY', 'CT'],
    polygon: [
      { lat: 41.15, lng: -73.75 },
      { lat: 41.15, lng: -73.50 },
      { lat: 40.95, lng: -73.50 },
      { lat: 40.95, lng: -73.75 },
    ],
  },
  {
    id: 'dc-md-va-border',
    name: 'DC-MD-VA Border Zone',
    states: ['DC', 'MD', 'VA'],
    polygon: [
      { lat: 39.00, lng: -77.15 },
      { lat: 39.00, lng: -76.90 },
      { lat: 38.80, lng: -76.90 },
      { lat: 38.80, lng: -77.15 },
    ],
  },
];

/**
 * Detect if a point is within an airport zone
 */
function detectAirportZone(
  point: { lat: number; lng: number }
): typeof AIRPORT_ZONES[number] | null {
  for (const airport of AIRPORT_ZONES) {
    const distance = haversineDistanceMiles(point.lat, point.lng, airport.lat, airport.lng);
    if (distance <= airport.radiusMiles) {
      return airport;
    }
  }
  return null;
}

/**
 * Detect if a point is within a border zone
 */
function detectBorderZone(
  point: { lat: number; lng: number }
): typeof BORDER_ZONES[number] | null {
  for (const zone of BORDER_ZONES) {
    if (isPointInPolygon(point, zone.polygon)) {
      return zone;
    }
  }
  return null;
}

/**
 * NYC TLC Congestion Pricing Zone Configuration
 * Manhattan below 96th Street (both East and West sides)
 * Effective for HVFHV (High-Volume For-Hire Vehicle) trips
 */
/**
 * Manhattan Congestion Zone Polygon
 * Precise boundaries for TLC congestion pricing zone (Manhattan below 96th Street)
 * Northern boundary: 96th Street (latitude 40.7849 - the actual street alignment)
 * Western boundary: Hudson River waterfront
 * Eastern boundary: East River / FDR Drive
 * Southern tip: Battery Park
 * 
 * Polygon points trace Manhattan's actual shoreline to exclude Brooklyn, 
 * Jersey City, and other areas across the rivers.
 * 
 * Reference: NYC TLC defines congestion zone as Manhattan south of and including
 * 96th Street on both East and West sides.
 */
const MANHATTAN_CONGESTION_ZONE = {
  fee: 2.75,
  name: 'Manhattan Congestion Zone',
  description: 'TLC Congestion Fee - Manhattan below 96th Street',
  polygon: [
    // Northern boundary - 96th Street (lat 40.7849 is actual 96th Street)
    // Start at 96th Street & Riverside Drive (West Side)
    { lat: 40.7849, lng: -73.9750 },
    // 96th Street at Central Park West
    { lat: 40.7849, lng: -73.9651 },
    // 96th Street at 5th Avenue (Central Park)
    { lat: 40.7849, lng: -73.9592 },
    // 96th Street East Side at FDR Drive
    { lat: 40.7849, lng: -73.9430 },
    
    // Eastern boundary - East River / FDR Drive (south along waterfront)
    // Upper East Side (90th to 80th)
    { lat: 40.7770, lng: -73.9430 },
    // Yorkville / East 70s
    { lat: 40.7680, lng: -73.9530 },
    // Upper East Side to Midtown East
    { lat: 40.7550, lng: -73.9600 },
    // UN area (42nd to 34th)
    { lat: 40.7470, lng: -73.9680 },
    // Murray Hill / Kips Bay
    { lat: 40.7380, lng: -73.9720 },
    // Stuyvesant / Gramercy
    { lat: 40.7280, lng: -73.9740 },
    // East Village
    { lat: 40.7200, lng: -73.9750 },
    // Lower East Side
    { lat: 40.7120, lng: -73.9780 },
    // Two Bridges / Seaport
    { lat: 40.7070, lng: -73.9960 },
    
    // Southern tip - Battery Park
    { lat: 40.7008, lng: -74.0180 },
    
    // Western boundary - Hudson River waterfront (north along waterfront)
    // Battery Park City
    { lat: 40.7120, lng: -74.0170 },
    // Tribeca
    { lat: 40.7200, lng: -74.0140 },
    // West Village / Meatpacking
    { lat: 40.7350, lng: -74.0100 },
    // Chelsea Piers
    { lat: 40.7480, lng: -74.0050 },
    // Hell's Kitchen / Hudson Yards
    { lat: 40.7600, lng: -74.0010 },
    // Upper West Side (72nd St)
    { lat: 40.7750, lng: -73.9880 },
    // 96th Street & Riverside Drive (closing the polygon)
    { lat: 40.7849, lng: -73.9750 },
  ],
};

/**
 * NYC TLC Airport Access Fee Configurations
 * Polygon-based geo-detection for accurate airport boundary matching
 * 
 * Fee amounts per NYC TLC HVFHV regulations:
 * - JFK Airport: $2.50
 * - LaGuardia Airport: $1.25
 * - Newark Airport: $2.00
 * - Westchester HPN: $1.00
 * 
 * Fee applies if pickup OR dropoff is inside the airport polygon boundary.
 */
interface TLCAirportConfig {
  code: string;
  name: string;
  fee: number;
  polygon: { lat: number; lng: number }[];
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

const TLC_AIRPORT_ZONES: TLCAirportConfig[] = [
  {
    code: 'JFK',
    name: 'John F. Kennedy International Airport',
    fee: 2.50,
    polygon: [
      // JFK Airport boundary polygon (Queens, NY)
      // Northwest corner (near Howard Beach)
      { lat: 40.6598, lng: -73.8143 },
      // Northeast corner (near Rosedale)
      { lat: 40.6598, lng: -73.7501 },
      // East side (Runway 31L area)
      { lat: 40.6480, lng: -73.7501 },
      // Southeast (Terminal area)
      { lat: 40.6350, lng: -73.7620 },
      // South side (Jamaica Bay)
      { lat: 40.6220, lng: -73.7750 },
      // Southwest (near Broad Channel)
      { lat: 40.6220, lng: -73.8143 },
      // West side (Jamaica Bay shoreline)
      { lat: 40.6420, lng: -73.8143 },
      // Close polygon
      { lat: 40.6598, lng: -73.8143 },
    ],
    boundingBox: {
      minLat: 40.6220,
      maxLat: 40.6598,
      minLng: -73.8143,
      maxLng: -73.7501,
    },
  },
  {
    code: 'LGA',
    name: 'LaGuardia Airport',
    fee: 1.25,
    polygon: [
      // LaGuardia Airport boundary polygon (Queens, NY)
      // Northwest (near Flushing Bay)
      { lat: 40.7850, lng: -73.8890 },
      // North (Marine Air Terminal area)
      { lat: 40.7850, lng: -73.8680 },
      // Northeast (Runway 4 end)
      { lat: 40.7810, lng: -73.8600 },
      // East side (Flushing Bay)
      { lat: 40.7730, lng: -73.8600 },
      // Southeast (Terminal B area)
      { lat: 40.7680, lng: -73.8650 },
      // South (Bowery Bay)
      { lat: 40.7680, lng: -73.8810 },
      // Southwest (Grand Central Parkway)
      { lat: 40.7730, lng: -73.8890 },
      // Close polygon
      { lat: 40.7850, lng: -73.8890 },
    ],
    boundingBox: {
      minLat: 40.7680,
      maxLat: 40.7850,
      minLng: -73.8890,
      maxLng: -73.8600,
    },
  },
  {
    code: 'EWR',
    name: 'Newark Liberty International Airport',
    fee: 2.00,
    polygon: [
      // Newark Airport boundary polygon (Newark, NJ)
      // Northwest corner
      { lat: 40.7050, lng: -74.1900 },
      // North (Terminal C area)
      { lat: 40.7050, lng: -74.1600 },
      // Northeast (I-95/NJ Turnpike)
      { lat: 40.6950, lng: -74.1600 },
      // East side
      { lat: 40.6800, lng: -74.1650 },
      // Southeast (Runway area)
      { lat: 40.6700, lng: -74.1750 },
      // South (Elizabeth area)
      { lat: 40.6700, lng: -74.1900 },
      // Southwest
      { lat: 40.6850, lng: -74.1900 },
      // Close polygon
      { lat: 40.7050, lng: -74.1900 },
    ],
    boundingBox: {
      minLat: 40.6700,
      maxLat: 40.7050,
      minLng: -74.1900,
      maxLng: -74.1600,
    },
  },
  {
    code: 'HPN',
    name: 'Westchester County Airport',
    fee: 1.00,
    polygon: [
      // Westchester HPN Airport boundary polygon (White Plains, NY)
      // Northwest corner
      { lat: 41.0750, lng: -73.7150 },
      // North
      { lat: 41.0750, lng: -73.6950 },
      // Northeast
      { lat: 41.0680, lng: -73.6950 },
      // East
      { lat: 41.0600, lng: -73.6980 },
      // Southeast
      { lat: 41.0550, lng: -73.7050 },
      // South
      { lat: 41.0550, lng: -73.7150 },
      // Southwest
      { lat: 41.0620, lng: -73.7150 },
      // Close polygon
      { lat: 41.0750, lng: -73.7150 },
    ],
    boundingBox: {
      minLat: 41.0550,
      maxLat: 41.0750,
      minLng: -73.7150,
      maxLng: -73.6950,
    },
  },
];

// ============================================
// TLC Accessible Vehicle Fund (AVF) Fee
// $0.30 flat fee for all NYC HVFHV trips
// Applies to non-wheelchair trips, excludes out-of-state and paratransit
// ============================================
const TLC_AVF_FEE = 0.30;

// ============================================
// TLC Black Car Fund (BCF) Contribution
// 2.75% mandatory contribution on rider fare
// Applies to all NYC trips, excludes out-of-state and zero-fare promo rides
// Formula: bcfFee = subtotalBeforeCommission * 0.0275
// ============================================
const TLC_BCF_RATE = 0.0275; // 2.75%

// ============================================
// TLC HVRF (High Volume For-Hire Vehicle) Workers' Compensation Fee
// $0.75 flat fee for all NYC HVFHV trips
// Funds workers' compensation insurance for HVFHV drivers
// Applies to NYC-to-NYC trips only
// Excluded for: out-of-state trips, airport-to-airport outside NYC, zero subtotal
// ============================================
const TLC_HVRF_FEE = 0.75;

// ============================================
// NYC FHV State Surcharge
// $0.50 flat fee for all NYC-to-NYC FHV trips
// Mandated by NY State for rideshare/FHV services
// Applies to NYC-to-NYC trips only
// Excluded for: cross-state trips, trips outside NYC, zero subtotal
// ============================================
const TLC_STATE_SURCHARGE = 0.50;

// ============================================
// NYC TLC Long Trip Surcharge (LTS)
// $20.00 flat fee for trips exceeding 60 minutes
// Applies to NYC-to-NYC trips only (both pickup AND dropoff in NYC)
// Duration threshold: > 60 minutes (not >=)
// Excluded for: cross-state trips, trips with pickup/dropoff outside NYC
// Non-commissionable, excluded from driver earnings
// ============================================
const TLC_LONG_TRIP_FEE = 20.00;
const TLC_LONG_TRIP_DURATION_THRESHOLD = 60; // minutes

// NYC Borough codes for AVF eligibility detection
const NYC_BOROUGH_CODES = ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten_island'];
const NYC_STATE_CODE = 'NY';

/**
 * Check if a trip is eligible for TLC AVF fee
 * AVF applies to all NYC trips except:
 * - Out-of-state trips (cross-state trips are NOT eligible)
 * - Pre-scheduled paratransit services
 * 
 * The AVF fee only applies when BOTH pickup AND dropoff are within NYC.
 * A trip from NYC to another state (e.g., Manhattan → Newark) is NOT eligible.
 */
function isEligibleForTLCAVFFee(
  pickupStateCode: string | undefined,
  dropoffStateCode: string | undefined,
  pickupBoroughCode: string | undefined,
  dropoffBoroughCode: string | undefined,
  isParatransit: boolean = false
): boolean {
  // AVF does NOT apply to paratransit services
  if (isParatransit) {
    return false;
  }
  
  // AVF does NOT apply to cross-state trips
  // If both state codes are defined and they differ, this is a cross-state trip
  if (pickupStateCode && dropoffStateCode && 
      pickupStateCode.toUpperCase() !== dropoffStateCode.toUpperCase()) {
    return false;
  }
  
  // Check if trip is entirely within NYC (both pickup AND dropoff must be in NYC)
  const pickupInNYC = pickupStateCode?.toUpperCase() === NYC_STATE_CODE && 
    (pickupBoroughCode ? NYC_BOROUGH_CODES.includes(pickupBoroughCode.toLowerCase()) : false);
  const dropoffInNYC = dropoffStateCode?.toUpperCase() === NYC_STATE_CODE && 
    (dropoffBoroughCode ? NYC_BOROUGH_CODES.includes(dropoffBoroughCode.toLowerCase()) : false);
  
  // AVF applies only if BOTH pickup AND dropoff are in NYC
  // A trip entirely within NYC is eligible
  if (!pickupInNYC || !dropoffInNYC) {
    return false;
  }
  
  return true;
}

/**
 * Detect if a point is within any TLC-regulated airport zone
 * Uses precise polygon-based geo-detection for accurate boundary matching
 * Returns the airport config if found, null otherwise
 */
function detectTLCAirportZone(
  point: { lat: number; lng: number }
): TLCAirportConfig | null {
  const lat = point.lat;
  const lng = point.lng;
  
  for (const airport of TLC_AIRPORT_ZONES) {
    // Quick bounding box pre-check for performance
    const bb = airport.boundingBox;
    if (lat < bb.minLat || lat > bb.maxLat || lng < bb.minLng || lng > bb.maxLng) {
      continue;
    }
    
    // Use precise polygon check for points within bounding box
    if (isPointInPolygon(point, airport.polygon)) {
      return airport;
    }
  }
  
  return null;
}

/**
 * Detect if a point is within the Manhattan Congestion Zone (below 96th Street)
 * Uses precise polygon-based geo-detection for accurate zone boundary matching
 * 
 * Bounding box derived from polygon extremes:
 * - minLat: 40.7008 (Battery Park - southern tip)
 * - maxLat: 40.7849 (96th Street - northern boundary)
 * - minLng: -74.0180 (Battery Park / Hudson waterfront)
 * - maxLng: -73.9430 (FDR Drive at 96th Street)
 */
function isInManhattanCongestionZone(
  point: { lat: number; lng: number }
): boolean {
  // Quick bounding box pre-check for performance (derived from polygon)
  const lat = point.lat;
  const lng = point.lng;
  const minLat = 40.7008;  // Battery Park
  const maxLat = 40.7849;  // 96th Street (exact cutoff)
  const minLng = -74.0180; // Battery Park / Hudson waterfront
  const maxLng = -73.9430; // FDR Drive at 96th Street
  
  // If outside bounding box, definitely not in zone
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
    return false;
  }
  
  // Use precise polygon check for points within bounding box
  return isPointInPolygon(point, MANHATTAN_CONGESTION_ZONE.polygon);
}

/**
 * Get state regulatory fees for a given state
 */
function getStateRegulatoryFees(stateCode: string): typeof STATE_REGULATORY_FEES[string] {
  return STATE_REGULATORY_FEES[stateCode] || [];
}

/**
 * Get state minimum fare for a given state
 */
function getStateMinimumFare(stateCode: string): number | null {
  return STATE_MINIMUM_FARES[stateCode] || null;
}

// ============================================
// Main Service Class
// ============================================

export class FareCalculationService {
  private static instance: FareCalculationService;
  
  // Cache for ride types and configs (refresh every 5 minutes)
  private rideTypesCache: Map<RideTypeCode, RideType> = new Map();
  private fareConfigsCache: Map<string, RideFareConfig> = new Map();
  private zonesCache: RegulatoryZone[] = [];
  private feeRulesCache: FeeRule[] = [];
  private tollConfigsCache: TollConfig[] = [];
  private cacheExpiry: Date = new Date(0);
  
  public static getInstance(): FareCalculationService {
    if (!FareCalculationService.instance) {
      FareCalculationService.instance = new FareCalculationService();
    }
    return FareCalculationService.instance;
  }
  
  /**
   * Refresh configuration cache from database
   */
  private async refreshCache(): Promise<void> {
    const now = new Date();
    if (now < this.cacheExpiry) return;
    
    console.log("[FareCalculation] Refreshing configuration cache...");
    
    // Use type assertions for new Prisma models (LSP may not have refreshed types yet)
    const db = prisma as any;
    
    // Load ride types
    const rideTypes: RideType[] = await db.rideType.findMany({
      where: { isActive: true },
    });
    this.rideTypesCache.clear();
    rideTypes.forEach((rt: RideType) => this.rideTypesCache.set(rt.code, rt));
    
    // Load fare configs
    const fareConfigs: RideFareConfig[] = await db.rideFareConfig.findMany({
      where: { isActive: true, effectiveTo: null },
    });
    this.fareConfigsCache.clear();
    fareConfigs.forEach((fc: RideFareConfig) => {
      const key = `${fc.rideTypeId}:${fc.countryCode}:${fc.cityCode || "default"}`;
      this.fareConfigsCache.set(key, fc);
    });
    
    // Load regulatory zones with their fee configs
    this.zonesCache = await db.regulatoryZone.findMany({
      where: { isActive: true },
      include: { feeConfigs: { where: { isActive: true, effectiveTo: null } } },
    });
    
    // Load fee rules
    this.feeRulesCache = await db.feeRule.findMany({
      where: { isActive: true, effectiveTo: null },
    });
    
    // Load toll configs
    this.tollConfigsCache = await db.tollConfig.findMany({
      where: { isActive: true },
    });
    
    // Set cache expiry to 5 minutes from now
    this.cacheExpiry = new Date(now.getTime() + 5 * 60 * 1000);
    console.log(`[FareCalculation] Cache refreshed: ${rideTypes.length} ride types, ${fareConfigs.length} fare configs, ${this.zonesCache.length} zones`);
  }
  
  /**
   * Get fare config for a ride type and location
   */
  private async getFareConfig(
    rideTypeId: string,
    countryCode: string,
    cityCode?: string
  ): Promise<RideFareConfig | null> {
    await this.refreshCache();
    
    // Try city-specific first
    if (cityCode) {
      const cityKey = `${rideTypeId}:${countryCode}:${cityCode}`;
      const cityConfig = this.fareConfigsCache.get(cityKey);
      if (cityConfig) return cityConfig;
    }
    
    // Fall back to country default
    const countryKey = `${rideTypeId}:${countryCode}:default`;
    return this.fareConfigsCache.get(countryKey) || null;
  }
  
  /**
   * Detect which regulatory zones a point falls into
   */
  private async detectZones(
    point: { lat: number; lng: number },
    isPickup: boolean
  ): Promise<Array<{ zone: RegulatoryZone; fees: RegulatoryFeeConfig[] }>> {
    await this.refreshCache();
    
    const matchedZones: Array<{ zone: RegulatoryZone; fees: RegulatoryFeeConfig[] }> = [];
    
    for (const zone of this.zonesCache) {
      // Quick bounding box check
      if (!isInBoundingBox(point, zone)) continue;
      
      // Full polygon check
      const polygon = zone.polygonCoordinates as { lat: number; lng: number }[];
      if (!isPointInPolygon(point, polygon)) continue;
      
      // Get applicable fees
      const fees = (zone as any).feeConfigs?.filter((fc: RegulatoryFeeConfig) => 
        isPickup ? fc.appliesToPickup : fc.appliesToDropoff
      ) || [];
      
      if (fees.length > 0) {
        matchedZones.push({ zone, fees });
      }
    }
    
    return matchedZones;
  }
  
  /**
   * Detect tolls on a route based on toll segment names
   */
  private async detectTolls(
    tollSegments: string[],
    rideTypeCode: RideTypeCode
  ): Promise<FeeBreakdownItem[]> {
    await this.refreshCache();
    
    const tolls: FeeBreakdownItem[] = [];
    
    for (const segmentName of tollSegments) {
      const normalizedName = segmentName.toLowerCase();
      
      // Find matching toll config
      const tollConfig = this.tollConfigsCache.find(tc => {
        if (tc.segmentIdentifier.toLowerCase().includes(normalizedName)) return true;
        if (normalizedName.includes(tc.segmentIdentifier.toLowerCase())) return true;
        // Check alternate identifiers
        return tc.alternateIdentifiers.some(alt => 
          alt.toLowerCase().includes(normalizedName) || 
          normalizedName.includes(alt.toLowerCase())
        );
      });
      
      if (tollConfig) {
        // Get rate for ride type
        let rate = 0;
        switch (rideTypeCode) {
          case "SAVER": rate = Number(tollConfig.tollRateSaver); break;
          case "STANDARD": rate = Number(tollConfig.tollRateStandard); break;
          case "COMFORT": rate = Number(tollConfig.tollRateComfort); break;
          case "XL": rate = Number(tollConfig.tollRateXL); break;
          case "PREMIUM": rate = Number(tollConfig.tollRatePremium); break;
        }
        
        if (rate > 0) {
          tolls.push({
            id: tollConfig.id,
            name: tollConfig.name,
            amount: rate,
            type: "flat",
            description: `Toll for ${tollConfig.name}`,
            paidToDriver: tollConfig.tollPaidToDriver,
          });
        }
      }
    }
    
    return tolls;
  }
  
  /**
   * Get additional fees (booking, safety, eco) for a location
   */
  private async getAdditionalFees(
    countryCode: string,
    cityCode?: string
  ): Promise<FeeRule[]> {
    await this.refreshCache();
    
    return this.feeRulesCache.filter(fr => {
      if (fr.countryCode !== countryCode) return false;
      // City-specific or default
      if (fr.cityCode && cityCode && fr.cityCode !== cityCode) return false;
      // Only include base fees, not cancellation/waiting
      return ["BOOKING_FEE", "SAFETY_FEE", "CLEAN_AIR_FEE", "ECO_FEE", "INSURANCE_SURCHARGE"].includes(fr.feeType);
    });
  }
  
  /**
   * Calculate fare for a single route
   * Implements complete US ride-share pricing with all fee components
   */
  private async calculateRouteFare(
    route: RouteInfo,
    fareConfig: RideFareConfig,
    rideType: RideType,
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
    surgeMultiplier: number,
    countryCode: string,
    cityCode?: string,
    pickupCityCode?: string,
    dropoffCityCode?: string,
    pickupStateCode?: string,
    dropoffStateCode?: string
  ): Promise<RouteFareBreakdown> {
    const now = new Date();
    
    // Initialize fee suppression log for audit trail
    const feeSuppressionLog: FeeSuppressionLog = {
      entries: [],
      timestamp: now,
    };
    
    // Helper to add suppression entry
    const addSuppression = (fee: string, suppressedBy: string, reason: string, wouldHaveBeenAmount?: number) => {
      feeSuppressionLog.entries.push({ fee, suppressedBy, reason, wouldHaveBeenAmount });
    };
    
    // ============================================
    // DETERMINISTIC PIPELINE ORDER (Per Spec):
    // 1. base → 2. traffic → 3. surge → 4. time-based → 
    // 5. long-distance → 6. tolls → 7. airport → 
    // 8. cross-state → 9. cross-city → 10. border-zone → 
    // 11. regulatory → 12. deadhead → 13. service → 
    // 14. promo → 15. max-fare → 16. driver-min → 
    // 17. margin-protection → 18. final
    // ============================================
    
    // ============================================
    // 1. BASE FARE COMPONENTS (with NYC TLC Time-Distance Formula)
    // ============================================
    const TLC_BASE_FARE = 2.50;
    const TLC_PER_MINUTE = 0.56;
    const TLC_PER_MILE = 1.31;
    const TLC_MIN_FARE = 8.00;
    const TLC_MAX_FARE = 500.00;
    
    const NYC_BOROUGHS = ['NYC', 'MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN_ISLAND', 
                          'manhattan', 'brooklyn', 'queens', 'bronx', 'staten_island',
                          'MN', 'BK', 'QN', 'BX', 'SI'];
    const isNYCCity = (code?: string) => code && NYC_BOROUGHS.includes(code.toUpperCase());
    const isNYState = (code?: string) => code && code.toUpperCase() === 'NY';
    
    const useTLCBaseFare = isNYState(pickupStateCode) || isNYState(dropoffStateCode) || 
                           isNYCCity(cityCode) || isNYCCity(pickupCityCode) || isNYCCity(dropoffCityCode);
    
    let baseFare: number;
    let distanceFare: number;
    let timeFare: number;
    let tlcBaseFare = 0;
    let tlcTimeFare = 0;
    let tlcDistanceFare = 0;
    let tlcCalculatedFare = 0;
    let tlcMinimumTripFare = TLC_MIN_FARE;
    let tlcMaximumTripFare = TLC_MAX_FARE;
    let tlcBaseFareApplied = false;
    let tlcTimeRateApplied = false;
    let tlcDistanceRateApplied = false;
    let tlcMinimumFareApplied = false;
    let tlcMaximumFareApplied = false;
    
    let tlcRawTotal = 0;
    let tlcEnforcedTotal = 0;
    
    if (useTLCBaseFare) {
      tlcBaseFare = TLC_BASE_FARE;
      tlcTimeFare = roundCurrency(route.durationMinutes * TLC_PER_MINUTE);
      tlcDistanceFare = roundCurrency(route.distanceMiles * TLC_PER_MILE);
      tlcRawTotal = roundCurrency(tlcBaseFare + tlcTimeFare + tlcDistanceFare);
      
      tlcBaseFareApplied = true;
      tlcTimeRateApplied = tlcTimeFare > 0;
      tlcDistanceRateApplied = tlcDistanceFare > 0;
      
      if (tlcRawTotal < TLC_MIN_FARE) {
        tlcMinimumFareApplied = true;
        tlcEnforcedTotal = TLC_MIN_FARE;
      } else if (tlcRawTotal > TLC_MAX_FARE) {
        tlcMaximumFareApplied = true;
        tlcEnforcedTotal = TLC_MAX_FARE;
      } else {
        tlcEnforcedTotal = tlcRawTotal;
      }
      
      tlcCalculatedFare = tlcEnforcedTotal;
      
      baseFare = tlcBaseFare;
      distanceFare = tlcDistanceFare;
      timeFare = tlcTimeFare;
    } else {
      baseFare = Number(fareConfig.baseFare);
      distanceFare = roundCurrency(route.distanceMiles * Number(fareConfig.perMileRate));
      timeFare = roundCurrency(route.durationMinutes * Number(fareConfig.perMinuteRate));
    }
    
    const baseSubtotalForPipeline = useTLCBaseFare 
      ? tlcEnforcedTotal 
      : (baseFare + distanceFare + timeFare);
    
    // ============================================
    // 2. SHORT-TRIP ADJUSTMENT (if configured)
    // ============================================
    const shortTripThreshold = DEFAULT_FARE_RULES.SHORT_TRIP_THRESHOLD_MILES;
    const shortTripMinimumFare = DEFAULT_FARE_RULES.SHORT_TRIP_MINIMUM_FARE;
    let shortTripAdjustment = 0;
    let shortTripAdjustmentApplied = false;
    
    if (route.distanceMiles < shortTripThreshold && baseSubtotalForPipeline < shortTripMinimumFare) {
      shortTripAdjustment = roundCurrency(shortTripMinimumFare - baseSubtotalForPipeline);
      shortTripAdjustmentApplied = true;
    }
    
    // ============================================
    // 3. TRAFFIC ADJUSTMENT
    // Applied AFTER short-trip adjustment per spec
    // ============================================
    const trafficLevel = getTrafficLevel(route.durationMinutes, route.trafficDurationMinutes);
    let trafficMultiplier = 1;
    switch (trafficLevel) {
      case "light": trafficMultiplier = Number(fareConfig.trafficMultiplierLight); break;
      case "moderate": trafficMultiplier = Number(fareConfig.trafficMultiplierModerate); break;
      case "heavy": trafficMultiplier = Number(fareConfig.trafficMultiplierHeavy); break;
    }
    
    // Include short-trip adjustment in trip cost (step 2 in pipeline)
    // Uses baseSubtotalForPipeline which contains tlcEnforcedTotal for TLC trips
    const tripCost = baseSubtotalForPipeline + shortTripAdjustment;
    const trafficAdjusted = roundCurrency(tripCost * trafficMultiplier);
    const trafficAdjustment = roundCurrency(trafficAdjusted - tripCost);
    
    // Track if traffic adjustment was applied (multiplier != 1 OR adjustment > 0)
    const trafficApplied = trafficMultiplier !== 1 || trafficAdjustment > 0;
    
    // ============================================
    // 4. SURGE MULTIPLIER (Dynamic High-Demand)
    // ============================================
    const effectiveSurge = Math.min(surgeMultiplier, Number(fareConfig.maxSurgeMultiplier));
    const surgeAdjusted = roundCurrency(trafficAdjusted * effectiveSurge);
    const surgeAmount = roundCurrency(surgeAdjusted - trafficAdjusted);
    
    // ============================================
    // 4. NIGHT SURCHARGE (8PM - 6AM)
    // ============================================
    const nightSurchargePercent = fareConfig.nightSurchargePercent 
      ? Number(fareConfig.nightSurchargePercent) 
      : DEFAULT_FARE_RULES.NIGHT_SURCHARGE_PERCENT;
    let nightSurcharge = 0;
    if (isNightTime(now)) {
      nightSurcharge = roundCurrency(surgeAdjusted * nightSurchargePercent / 100);
    }
    
    // ============================================
    // 5. PEAK HOUR SURCHARGE (7-9AM, 4-7PM weekdays)
    // ============================================
    const peakHourSurchargePercent = fareConfig.peakHourSurchargePercent
      ? Number(fareConfig.peakHourSurchargePercent)
      : DEFAULT_FARE_RULES.PEAK_HOUR_SURCHARGE_PERCENT;
    let peakHourSurcharge = 0;
    if (isPeakHour(now) && !isNightTime(now)) {
      // Don't apply both night and peak surcharge
      peakHourSurcharge = roundCurrency(surgeAdjusted * peakHourSurchargePercent / 100);
    }
    
    // ============================================
    // 6. LONG-DISTANCE FEE (trips > threshold miles)
    // ============================================
    const longDistanceThreshold = fareConfig.longDistanceThresholdMiles
      ? Number(fareConfig.longDistanceThresholdMiles)
      : DEFAULT_FARE_RULES.LONG_DISTANCE_THRESHOLD_MILES;
    const longDistanceFeePerMile = fareConfig.longDistanceFeePerMile
      ? Number(fareConfig.longDistanceFeePerMile)
      : DEFAULT_FARE_RULES.LONG_DISTANCE_FEE_PER_MILE;
    let longDistanceFee = 0;
    if (route.distanceMiles > longDistanceThreshold) {
      const extraMiles = route.distanceMiles - longDistanceThreshold;
      longDistanceFee = roundCurrency(extraMiles * longDistanceFeePerMile);
    }
    
    // ============================================
    // PRE-TLC: DETECT REGULATORY ZONES EARLY FOR TLC FEE ELIGIBILITY
    // Zone detection is needed before AVF/BCF for borough-level eligibility checks
    // The results are also reused later for general regulatory fee processing
    // ============================================
    const pickupZones = await this.detectZones(pickup, true);
    const dropoffZones = await this.detectZones(dropoff, false);
    
    // Extract borough codes for TLC fee eligibility (AVF, BCF)
    // Zone format: { zone: RegulatoryZone, fees: RegulatoryFeeConfig[] }
    const matchedPickupZones = pickupZones.map(z => ({
      zoneId: z.zone.id,
      zoneType: z.zone.zoneType,
      stateCode: z.zone.stateCode,
    }));
    const matchedDropoffZones = dropoffZones.map(z => ({
      zoneId: z.zone.id,
      zoneType: z.zone.zoneType,
      stateCode: z.zone.stateCode,
    }));
    
    // ============================================
    // 6A. NYC TLC CONGESTION PRICING (Post-Surge)
    // $2.75 flat fee for trips in Manhattan below 96th Street
    // FLAT regulatory fee - does NOT participate in surge
    // Full amount is pass-through (remitted to government)
    // ============================================
    let congestionFee = 0;
    let congestionFeeApplied = false;
    
    const pickupInCongestionZone = isInManhattanCongestionZone(pickup);
    const dropoffInCongestionZone = isInManhattanCongestionZone(dropoff);
    
    if (pickupInCongestionZone || dropoffInCongestionZone) {
      congestionFee = MANHATTAN_CONGESTION_ZONE.fee;
      congestionFeeApplied = true;
    }
    
    // ============================================
    // 6B. NYC TLC AIRPORT ACCESS FEE (Post-Surge)
    // Flat fees for TLC-regulated airports (JFK, LGA, EWR, HPN)
    // FLAT regulatory fee - does NOT participate in surge
    // Full amount is pass-through (remitted to government)
    // Fee applies if pickup OR dropoff is inside airport polygon
    // ============================================
    let tlcAirportFee = 0;
    let tlcAirportFeeApplied = false;
    let tlcAirportName: string | undefined;
    let tlcAirportCode: string | undefined;
    
    const pickupTLCAirport = detectTLCAirportZone(pickup);
    const dropoffTLCAirport = detectTLCAirportZone(dropoff);
    
    // Fee applies for pickup OR dropoff in airport zone (not cumulative)
    if (pickupTLCAirport) {
      tlcAirportFee = pickupTLCAirport.fee;
      tlcAirportName = pickupTLCAirport.name;
      tlcAirportCode = pickupTLCAirport.code;
      tlcAirportFeeApplied = true;
    } else if (dropoffTLCAirport) {
      tlcAirportFee = dropoffTLCAirport.fee;
      tlcAirportName = dropoffTLCAirport.name;
      tlcAirportCode = dropoffTLCAirport.code;
      tlcAirportFeeApplied = true;
    }
    
    // ============================================
    // STEP 6C. TLC ACCESSIBLE VEHICLE FUND (AVF) FEE
    // $0.30 flat regulatory fee for all NYC HVFHV trips
    // FLAT regulatory fee - does NOT participate in surge
    // Full amount is pass-through (remitted to government)
    // Excludes out-of-state trips and paratransit services
    // ============================================
    let tlcAVFFee = 0;
    let tlcAVFFeeApplied = false;
    
    // Determine borough codes for AVF eligibility from matched zones
    const avfPickupBoroughCode = matchedPickupZones.find(z => z.zoneType === 'borough')?.zoneId;
    const avfDropoffBoroughCode = matchedDropoffZones.find(z => z.zoneType === 'borough')?.zoneId;
    
    // Check if this is a NYC airport (JFK, LGA, HPN) - NOT Newark (EWR)
    // Newark Airport (EWR) is in New Jersey, so trips to/from EWR are cross-state
    const NYC_AIRPORT_CODES = ['JFK', 'LGA', 'HPN'];
    const isNYCAirportTrip = tlcAirportCode && NYC_AIRPORT_CODES.includes(tlcAirportCode);
    
    // Strict state check: Both pickup and dropoff must be confirmed as NY state
    // This ensures fallback logic doesn't apply AVF when state metadata is missing
    const bothStatesAreNY = pickupStateCode?.toUpperCase() === NYC_STATE_CODE && 
      dropoffStateCode?.toUpperCase() === NYC_STATE_CODE;
    
    // AVF applies to NYC trips ONLY (never cross-state, never missing state data)
    // Primary check: isEligibleForTLCAVFFee validates borough codes AND state codes
    const avfPrimaryEligible = isEligibleForTLCAVFFee(
      pickupStateCode,
      dropoffStateCode,
      avfPickupBoroughCode,
      avfDropoffBoroughCode,
      false // isParatransit - would be passed from request in production
    );
    
    // Fallback eligibility requires BOTH state codes to be NY (strict guard)
    // This prevents AVF from being applied when state metadata is missing or cross-state
    // Fallback conditions:
    // - congestionFeeApplied indicates a Manhattan trip (within NYC)
    // - isNYCAirportTrip indicates a trip to/from a NYC airport (not Newark)
    const avfFallbackEligible = bothStatesAreNY && (congestionFeeApplied || isNYCAirportTrip);
    
    const avfEligible = avfPrimaryEligible || avfFallbackEligible;
    
    if (avfEligible) {
      tlcAVFFee = TLC_AVF_FEE;
      tlcAVFFeeApplied = true;
    }
    
    // ============================================
    // STEP 6D. TLC BLACK CAR FUND (BCF) CONTRIBUTION
    // 2.75% mandatory contribution on rider fare
    // PERCENTAGE-based regulatory fee calculated on fare before service fee
    // Applied to all NYC trips, excludes out-of-state and zero-fare promo rides
    // Formula: bcfFee = fareBase * 0.0275
    // Full amount is pass-through (remitted to Black Car Fund, not SafeGo revenue)
    // ============================================
    let tlcBCFFee = 0;
    let tlcBCFFeeApplied = false;
    const tlcBCFFeeRate = TLC_BCF_RATE; // 2.75%
    
    // BCF applies to NYC trips only (same eligibility as AVF, but also checks for zero-fare)
    // BCF eligibility uses the same state check as AVF: both endpoints must be in NY
    // Also requires a non-zero fare base (excludes fully discounted promo rides)
    const bcfFareBase = surgeAdjusted + nightSurcharge + peakHourSurcharge + longDistanceFee + 
      congestionFee + tlcAirportFee + tlcAVFFee;
    
    // BCF applies if:
    // 1. Both pickup and dropoff are in NY state (not cross-state)
    // 2. The fare base is greater than zero (not a fully discounted ride)
    const bcfEligible = bothStatesAreNY && bcfFareBase > 0;
    
    if (bcfEligible) {
      tlcBCFFee = roundCurrency(bcfFareBase * TLC_BCF_RATE);
      tlcBCFFeeApplied = true;
    }
    
    // ============================================
    // STEP 6E. TLC HVRF (HIGH VOLUME FOR-HIRE VEHICLE) WORKERS' COMPENSATION FEE
    // $0.75 flat fee for all NYC HVFHV trips
    // Funds workers' compensation insurance for HVFHV drivers
    // FLAT regulatory fee - does NOT participate in surge multiplier
    // Full amount is pass-through (remitted to HVRF fund, not SafeGo revenue)
    // Applies to NYC-to-NYC trips only
    // Excluded for: out-of-state trips, airport-to-airport outside NYC, zero subtotal
    // ============================================
    let tlcHVRFFee = 0;
    let tlcHVRFFeeApplied = false;
    
    // HVRF eligibility: NYC-to-NYC trips only (both states must be NY)
    // Also requires non-zero subtotal (excludes fully discounted trips)
    // Check for airport-to-airport trips outside NYC (excluded)
    const isAirportToAirportOutsideNYC = pickupTLCAirport && dropoffTLCAirport && 
      !NYC_AIRPORT_CODES.includes(pickupTLCAirport.code) && 
      !NYC_AIRPORT_CODES.includes(dropoffTLCAirport.code);
    
    // Calculate subtotal for eligibility check (before HVRF itself)
    const hvrfSubtotalCheck = surgeAdjusted + nightSurcharge + peakHourSurcharge + 
      longDistanceFee + congestionFee + tlcAirportFee + tlcAVFFee + tlcBCFFee;
    
    // HVRF applies if:
    // 1. Both pickup and dropoff are in NY state (not cross-state)
    // 2. The subtotal is greater than zero (not a fully discounted ride)
    // 3. NOT an airport-to-airport trip outside NYC
    const hvrfEligible = bothStatesAreNY && hvrfSubtotalCheck > 0 && !isAirportToAirportOutsideNYC;
    
    if (hvrfEligible) {
      tlcHVRFFee = TLC_HVRF_FEE;
      tlcHVRFFeeApplied = true;
    }
    
    // ============================================
    // STEP 6F. NYC FHV STATE SURCHARGE
    // $0.50 flat fee for all NYC-to-NYC FHV trips
    // Mandated by NY State for rideshare/FHV services
    // FLAT regulatory fee - does NOT participate in surge multiplier
    // Full amount is pass-through (remitted to NY State, not SafeGo revenue)
    // Applies to NYC-to-NYC trips only
    // Excluded for: cross-state trips, trips outside NYC, zero subtotal
    // ============================================
    let tlcStateSurcharge = 0;
    let tlcStateSurchargeApplied = false;
    
    // State Surcharge eligibility: NYC-to-NYC trips only
    // BOTH pickup AND dropoff must be in NYC boroughs (not just NY state)
    // More restrictive than HVRF which only requires NY state
    const stateSurchargeSubtotalCheck = surgeAdjusted + nightSurcharge + peakHourSurcharge + 
      longDistanceFee + congestionFee + tlcAirportFee + tlcAVFFee + tlcBCFFee + tlcHVRFFee;
    
    // State Surcharge applies if:
    // 1. BOTH pickup AND dropoff are in NYC boroughs (not just NY state)
    // 2. The subtotal is greater than zero (not a fully discounted ride)
    // 3. Does NOT apply to: cross-state trips, trips leaving NYC, trips entering NYC from outside
    const pickupInNYCBorough = matchedPickupZones.some(z => NYC_BOROUGH_CODES.includes(z.zoneId.toLowerCase()));
    const dropoffInNYCBorough = matchedDropoffZones.some(z => NYC_BOROUGH_CODES.includes(z.zoneId.toLowerCase()));
    const bothInNYCBoroughs = pickupInNYCBorough && dropoffInNYCBorough;
    
    const stateSurchargeEligible = bothInNYCBoroughs && stateSurchargeSubtotalCheck > 0;
    
    if (stateSurchargeEligible) {
      tlcStateSurcharge = TLC_STATE_SURCHARGE;
      tlcStateSurchargeApplied = true;
    }
    
    // ============================================
    // STEP 6G. NYC TLC LONG TRIP SURCHARGE (LTS)
    // $20.00 flat fee for trips exceeding 60 minutes
    // Applies to NYC-to-NYC trips only (both pickup AND dropoff in NYC boroughs)
    // Duration threshold: > 60 minutes (not >=)
    // FLAT regulatory fee - does NOT participate in surge multiplier
    // Non-commissionable, excluded from driver earnings
    // Excluded for: cross-state trips, trips with pickup/dropoff outside NYC
    // ============================================
    let tlcLongTripFee = 0;
    let tlcLongTripFeeApplied = false;
    
    // Long Trip Surcharge eligibility:
    // 1. Trip duration exceeds 60 minutes (> 60, not >=)
    // 2. BOTH pickup AND dropoff are in NYC boroughs
    // 3. NOT a cross-state trip
    const tripDurationMinutes = route.durationMinutes;
    const exceedsLongTripThreshold = tripDurationMinutes > TLC_LONG_TRIP_DURATION_THRESHOLD;
    
    // Reuse bothInNYCBoroughs from State Surcharge eligibility check
    const longTripSurchargeEligible = exceedsLongTripThreshold && bothInNYCBoroughs;
    
    if (longTripSurchargeEligible) {
      tlcLongTripFee = TLC_LONG_TRIP_FEE;
      tlcLongTripFeeApplied = true;
    }
    
    // ============================================
    // 7. CROSS-CITY AND CROSS-STATE SURCHARGES
    // ============================================
    const crossCitySurchargeAmount = fareConfig.crossCitySurcharge
      ? Number(fareConfig.crossCitySurcharge)
      : DEFAULT_FARE_RULES.CROSS_CITY_SURCHARGE;
    const crossStateSurchargeAmount = fareConfig.crossStateSurcharge
      ? Number(fareConfig.crossStateSurcharge)
      : DEFAULT_FARE_RULES.CROSS_STATE_SURCHARGE;
    
    // ============================================
    // 7A. AIRPORT ZONE DETECTION
    // Airport fee overrides cross-city surcharge
    // ============================================
    const pickupAirport = detectAirportZone(pickup);
    const dropoffAirport = detectAirportZone(dropoff);
    let airportFee = 0;
    let airportCode: string | undefined;
    let airportFeeApplied = false;
    
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
    // 7B. BORDER ZONE DETECTION
    // ============================================
    const pickupBorderZone = detectBorderZone(pickup);
    const dropoffBorderZone = detectBorderZone(dropoff);
    let borderZoneFee = 0;
    let borderZoneFeeApplied = false;
    
    // Apply border zone fee if either pickup or dropoff is in a border zone
    if (pickupBorderZone || dropoffBorderZone) {
      borderZoneFee = DEFAULT_FARE_RULES.BORDER_ZONE_FEE;
      borderZoneFeeApplied = true;
    }
    
    // ============================================
    // 8-10. GEO-BASED FEES WITH CONFLICT RULES
    // Pipeline order: airport → cross-state → cross-city → border-zone
    // Conflict rules:
    // - airportFeeApplied does NOT override crossStateApplied
    // - crossStateApplied ALWAYS suppresses crossCityApplied
    // - airportFeeApplied suppresses crossCityApplied (if AIRPORT_OVERRIDES_CROSS_CITY)
    // - borderZoneFeeApplied works unless crossStateApplied suppresses it
    // ============================================
    let crossCitySurcharge = 0;
    let crossStateSurcharge = 0;
    let crossCityApplied = false;
    let crossStateApplied = false;
    
    // Check configurable airport override behavior
    const airportOverridesCrossCity = DEFAULT_FARE_RULES.AIRPORT_OVERRIDES_CROSS_CITY;
    
    // Detect if cross-city or cross-state trip
    const isCrossCityTrip = pickupCityCode && dropoffCityCode && pickupCityCode !== dropoffCityCode;
    const isCrossStateTrip = pickupStateCode && dropoffStateCode && pickupStateCode !== dropoffStateCode;
    
    // Step 1: Apply cross-state fee (highest priority for geo-based conflicts)
    if (isCrossStateTrip) {
      crossStateSurcharge = crossStateSurchargeAmount;
      crossStateApplied = true;
      
      // Cross-state suppresses cross-city
      if (isCrossCityTrip) {
        addSuppression('crossCitySurcharge', 'crossStateSurcharge', 
          'Cross-state trip supersedes cross-city surcharge', crossCitySurchargeAmount);
      }
    } 
    // Step 2: Apply cross-city fee (if not suppressed)
    else if (isCrossCityTrip) {
      // Check if airport fee should suppress cross-city
      const airportSuppressesCrossCity = airportFeeApplied && airportOverridesCrossCity;
      
      if (airportSuppressesCrossCity) {
        addSuppression('crossCitySurcharge', 'airportFee', 
          'Airport fee overrides cross-city surcharge (AIRPORT_OVERRIDES_CROSS_CITY=true)', 
          crossCitySurchargeAmount);
      } else {
        crossCitySurcharge = crossCitySurchargeAmount;
        crossCityApplied = true;
      }
    }
    
    // Step 3: Border zone suppression by cross-state
    if (borderZoneFeeApplied && crossStateApplied) {
      // Cross-state trips suppress border zone fees
      borderZoneFee = 0;
      borderZoneFeeApplied = false;
      addSuppression('borderZoneFee', 'crossStateSurcharge', 
        'Cross-state trip supersedes border zone fee', DEFAULT_FARE_RULES.BORDER_ZONE_FEE);
    }
    
    // ============================================
    // 12. RETURN DEADHEAD CHARGE (Uber-style)
    // ONLY applies when crossStateApplied is true
    // ============================================
    let returnDeadheadFee = 0;
    let returnDeadheadApplied = false;
    let excessReturnMiles = 0;
    
    // Protection: Return deadhead fee ONLY when cross-state is applied
    if (crossStateApplied) {
      // Estimate return distance as the straight-line distance from dropoff to pickup
      const returnDistance = haversineDistanceMiles(
        dropoff.lat, dropoff.lng,
        pickup.lat, pickup.lng
      );
      // Only charge for portion beyond typical service area threshold
      const deadheadThreshold = DEFAULT_FARE_RULES.RETURN_DEADHEAD_THRESHOLD_MILES;
      excessReturnMiles = Math.max(0, returnDistance - deadheadThreshold);
      if (excessReturnMiles > 0) {
        returnDeadheadFee = roundCurrency(excessReturnMiles * DEFAULT_FARE_RULES.RETURN_DEADHEAD_PER_MILE);
        returnDeadheadApplied = true;
      }
    }
    
    // ============================================
    // 7E. STATE REGULATORY FEES
    // Based on pickup state rules
    // ============================================
    const stateRegulatoryFees = pickupStateCode ? getStateRegulatoryFees(pickupStateCode) : [];
    const stateRegulatoryFeeBreakdown: FeeBreakdownItem[] = [];
    let stateRegulatoryFee = 0;
    let regulatoryFeeApplied = false;
    
    for (const fee of stateRegulatoryFees) {
      let amount = 0;
      if (fee.type === 'percent') {
        // Apply percent fee to the surge-adjusted fare
        amount = roundCurrency(surgeAdjusted * fee.amount / 100);
      } else {
        amount = fee.amount;
      }
      
      if (amount > 0) {
        stateRegulatoryFeeBreakdown.push({
          id: `state-${pickupStateCode}-${fee.name.replace(/\s+/g, '-').toLowerCase()}`,
          name: fee.name,
          amount,
          type: fee.type,
          description: `${pickupStateCode} state regulatory fee`,
          isRegulatory: true,
        });
        stateRegulatoryFee += amount;
        regulatoryFeeApplied = true;
      }
    }
    stateRegulatoryFee = roundCurrency(stateRegulatoryFee);
    
    // ============================================
    // 8. DETECT TOLLS
    // ============================================
    const tollsBreakdown = await this.detectTolls(route.tollSegments || [], rideType.code);
    const tollsTotal = roundCurrency(tollsBreakdown.reduce((sum, t) => sum + t.amount, 0));
    
    // ============================================
    // 9. PROCESS REGULATORY ZONE FEES (NYC RTA, BCF, Airport)
    // Zone detection was already done earlier for TLC fee eligibility (AVF, BCF)
    // Here we just process the fees from those pre-detected zones
    // ============================================
    const allZoneIds = new Set<string>();
    const matchedZoneIds: string[] = [];
    const regulatoryFeesBreakdown: FeeBreakdownItem[] = [];
    
    const processZoneFees = (zones: Array<{ zone: RegulatoryZone; fees: RegulatoryFeeConfig[] }>) => {
      for (const { zone, fees } of zones) {
        if (allZoneIds.has(zone.id)) continue;
        allZoneIds.add(zone.id);
        matchedZoneIds.push(zone.id);
        
        for (const fee of fees) {
          let amount = 0;
          if (fee.flatFeeAmount) {
            amount = Number(fee.flatFeeAmount);
          } else if (fee.percentFeeRate) {
            amount = roundCurrency(surgeAdjusted * Number(fee.percentFeeRate) / 100);
          }
          
          if (amount > 0) {
            regulatoryFeesBreakdown.push({
              id: fee.id,
              name: fee.displayName,
              amount,
              type: fee.flatFeeAmount ? "flat" : "percent",
              description: fee.description || undefined,
              isRegulatory: true,
            });
          }
        }
      }
    };
    
    processZoneFees(pickupZones);
    processZoneFees(dropoffZones);
    
    const regulatoryFeesTotal = roundCurrency(
      regulatoryFeesBreakdown.reduce((sum, f) => sum + f.amount, 0)
    );
    
    // ============================================
    // 10. ADDITIONAL FEES (Booking, Safety, Eco)
    // ============================================
    const additionalFeeRules = await this.getAdditionalFees(countryCode, cityCode);
    const additionalFeesBreakdown: FeeBreakdownItem[] = additionalFeeRules.map(rule => ({
      id: rule.id,
      name: rule.displayName,
      amount: Number(rule.flatAmount) || 0,
      type: "flat" as const,
      description: rule.description || undefined,
    }));
    const additionalFeesTotal = roundCurrency(
      additionalFeesBreakdown.reduce((sum, f) => sum + f.amount, 0)
    );
    
    // ============================================
    // 11. SUBTOTAL (Before service fee and discounts)
    // Promo discounts apply AFTER fees, BEFORE service fee
    // ============================================
    // TLC fees (congestion + airport + AVF + BCF + HVRF + State Surcharge) are regulatory fees applied post-surge
    // They do NOT participate in surge - full amounts are pass-through to government
    // BCF (2.75%) is calculated on the pre-commission fare base
    // HVRF ($0.75) is a flat fee for workers' compensation
    // State Surcharge ($0.50) is a flat NY State FHV surcharge
    const subtotalBeforeDiscount = roundCurrency(
      surgeAdjusted + 
      nightSurcharge + 
      peakHourSurcharge + 
      longDistanceFee +
      congestionFee +
      tlcAirportFee +
      tlcAVFFee +
      tlcBCFFee +
      tlcHVRFFee +
      tlcStateSurcharge +
      tlcLongTripFee +
      crossCitySurcharge +
      crossStateSurcharge +
      returnDeadheadFee +
      airportFee +
      borderZoneFee +
      stateRegulatoryFee +
      tollsTotal + 
      regulatoryFeesTotal + 
      additionalFeesTotal
    );
    
    // Discount placeholder (promo codes applied at API layer)
    const discountAmount = 0;
    const subtotal = roundCurrency(subtotalBeforeDiscount - discountAmount);
    
    // ============================================
    // 12. SERVICE FEE (After discounts)
    // ============================================
    let serviceFee = roundCurrency(subtotal * Number(fareConfig.serviceFeePercent) / 100);
    serviceFee = Math.max(serviceFee, Number(fareConfig.serviceFeeMinimum));
    serviceFee = Math.min(serviceFee, Number(fareConfig.serviceFeeMaximum));
    
    // ============================================
    // 13. GROSS FARE CALCULATION (Before Guards)
    // This is the calculated fare before min/max enforcement
    // ============================================
    const grossFare = roundCurrency(subtotal + serviceFee);
    
    // ============================================
    // 14. DRIVER BASE PAYOUT CALCULATION
    // Calculate from gross fare to establish baseline
    // ============================================
    const driverDistanceEarnings = roundCurrency(route.distanceMiles * Number(fareConfig.driverPerMileRate));
    const driverTimeEarnings = roundCurrency(route.durationMinutes * Number(fareConfig.driverPerMinuteRate));
    const driverTolls = tollsBreakdown
      .filter(t => t.paidToDriver)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const driverBasePayoutCalculated = roundCurrency(driverDistanceEarnings + driverTimeEarnings + driverTolls);
    const driverMinimumPayout = fareConfig.driverMinimumPayout
      ? Number(fareConfig.driverMinimumPayout)
      : DEFAULT_FARE_RULES.DRIVER_MINIMUM_PAYOUT;
    
    // ============================================
    // 15. FARE GUARDS (Minimum and Maximum)
    // Applied to gross fare
    // State-specific minimums override global minimum
    // ============================================
    const globalMinimumFare = Number(fareConfig.minimumFare);
    const stateMinimumFare = pickupStateCode ? getStateMinimumFare(pickupStateCode) : null;
    
    // Use state minimum if it exists and is higher than global minimum
    const effectiveMinimumFare = stateMinimumFare && stateMinimumFare > globalMinimumFare
      ? stateMinimumFare
      : globalMinimumFare;
    const stateMinimumFareApplied = stateMinimumFare !== null && stateMinimumFare > globalMinimumFare;
    
    const maximumFare = fareConfig.maximumFare
      ? Number(fareConfig.maximumFare)
      : DEFAULT_FARE_RULES.MAXIMUM_FARE;
    
    let fareAfterGuards = grossFare;
    let minimumFareApplied = false;
    let maximumFareApplied = false;
    
    // Apply minimum fare first (state or global)
    if (fareAfterGuards < effectiveMinimumFare) {
      fareAfterGuards = effectiveMinimumFare;
      minimumFareApplied = true;
    }
    
    // Apply maximum fare cap (regular config cap)
    if (fareAfterGuards > maximumFare) {
      fareAfterGuards = maximumFare;
      maximumFareApplied = true;
    }
    
    // Apply TLC fare guards for NYC trips (regulatory compliance)
    // This ensures the rider total respects TLC bounds after surge/traffic
    if (useTLCBaseFare) {
      if (fareAfterGuards < tlcMinimumTripFare) {
        fareAfterGuards = tlcMinimumTripFare;
        tlcMinimumFareApplied = true;
      }
      if (fareAfterGuards > tlcMaximumTripFare) {
        fareAfterGuards = tlcMaximumTripFare;
        tlcMaximumFareApplied = true;
      }
    }
    
    // ============================================
    // 16. DRIVER PAYOUT WITH MINIMUM PROTECTION
    // Ensure driver gets at least minimum payout
    // ============================================
    let driverPayout = Math.max(driverBasePayoutCalculated, driverMinimumPayout);
    const driverMinimumPayoutApplied = driverBasePayoutCalculated < driverMinimumPayout;
    
    // ============================================
    // 17. COMPANY MARGIN PROTECTION
    // Runs AFTER fare guards, ensures minimum margin
    // while respecting driver minimum and fare caps
    // Commission = TotalFare - AllPassThroughCosts
    // PassThroughCosts = DriverPayout + RegulatoryFees (driver payout already includes driver tolls)
    // Margin% = Commission / TotalFare * 100
    // ============================================
    const companyMinMarginPercent = fareConfig.companyMinMarginPercent
      ? Number(fareConfig.companyMinMarginPercent)
      : DEFAULT_FARE_RULES.COMPANY_MIN_MARGIN_PERCENT;
    
    // All costs that are passed through (not retained by SafeGo):
    // - Driver payout (includes distance, time, and driver-paid tolls)
    // - Regulatory fees (goes to government, not SafeGo)
    // - State regulatory fees (state-specific fees remitted to government)
    // - TLC congestion fee (NYC congestion zone fee remitted to government)
    // - TLC airport fee (airport access fee remitted to government)
    // - TLC AVF fee (Accessible Vehicle Fund fee remitted to government)
    // - TLC BCF fee (Black Car Fund contribution remitted to BCF, not SafeGo revenue)
    // - TLC HVRF fee (Workers' Compensation fee remitted to HVRF fund, not SafeGo revenue)
    // - TLC State Surcharge (NY State FHV surcharge remitted to NY State, not SafeGo revenue)
    // Note: Additional fees (booking, safety, eco) and service fee are SafeGo revenue
    // Note: TLC fees are included in pre-surge base but surged portion is SafeGo revenue;
    //       only original amounts are pass-through
    const allRegulatoryFees = roundCurrency(
      regulatoryFeesTotal + stateRegulatoryFee + congestionFee + tlcAirportFee + tlcAVFFee + tlcBCFFee + tlcHVRFFee + tlcStateSurcharge + tlcLongTripFee
    );
    const calcPassThroughCosts = (payout: number) => 
      roundCurrency(payout + allRegulatoryFees);
    
    // Calculate commission: fare minus all pass-through costs
    const calcCommission = (fare: number, payout: number) => 
      roundCurrency(fare - calcPassThroughCosts(payout));
    
    // Calculate margin percentage from commission and fare
    const calcMarginPercent = (fare: number, commission: number) => 
      fare > 0 ? roundCurrency((commission / fare) * 100) : 0;
    
    // Calculate the minimum fare needed to achieve target margin with given costs
    // Algebra: margin% = (fare - passThroughCosts) / fare * 100
    //          margin% * fare = fare - passThroughCosts
    //          fare - margin% * fare = passThroughCosts
    //          fare * (1 - margin%) = passThroughCosts
    //          fare = passThroughCosts / (1 - margin%)
    const calcMinFareForMargin = (payout: number) => {
      const marginDecimal = companyMinMarginPercent / 100;
      if (marginDecimal >= 1) return Infinity; // Can't achieve 100%+ margin
      const passThroughCosts = calcPassThroughCosts(payout);
      return roundCurrency(passThroughCosts / (1 - marginDecimal));
    };
    
    let safegoCommission = calcCommission(fareAfterGuards, driverPayout);
    let marginProtectionApplied = false;
    let marginProtectionCapped = false;
    let marginShortfall = 0;
    
    // Check if we need margin protection
    const targetMarginAmount = roundCurrency(fareAfterGuards * companyMinMarginPercent / 100);
    
    if (safegoCommission < targetMarginAmount) {
      marginProtectionApplied = true;
      
      // Step 1: If commission is negative, reduce driver payout to minimum first
      if (safegoCommission < 0 && driverPayout > driverMinimumPayout) {
        driverPayout = driverMinimumPayout;
        safegoCommission = calcCommission(fareAfterGuards, driverPayout);
      }
      
      // Step 2: Try to increase fare to meet margin requirement
      if (calcMarginPercent(fareAfterGuards, safegoCommission) < companyMinMarginPercent) {
        const neededFare = calcMinFareForMargin(driverPayout);
        
        if (neededFare <= maximumFare) {
          // Can increase fare to meet margin
          fareAfterGuards = Math.max(fareAfterGuards, neededFare);
          safegoCommission = calcCommission(fareAfterGuards, driverPayout);
        } else {
          // Hit maximum cap - can only increase fare up to cap
          if (!maximumFareApplied) {
            fareAfterGuards = maximumFare;
            maximumFareApplied = true;
            safegoCommission = calcCommission(fareAfterGuards, driverPayout);
          }
          
          // Step 3: Try reducing driver payout to increase margin (but not below minimum)
          if (calcMarginPercent(fareAfterGuards, safegoCommission) < companyMinMarginPercent) {
            if (driverPayout > driverMinimumPayout) {
              // Calculate payout that yields target margin at capped fare
              // targetMargin = (fare - payout - regFees) / fare
              // payout = fare - regFees - (targetMargin * fare)
              // payout = fare * (1 - targetMargin) - regFees
              const targetPayout = roundCurrency(
                fareAfterGuards * (1 - companyMinMarginPercent / 100) - allRegulatoryFees
              );
              
              if (targetPayout >= driverMinimumPayout) {
                driverPayout = targetPayout;
                safegoCommission = calcCommission(fareAfterGuards, driverPayout);
              } else {
                // Can't meet margin - reduce to minimum and accept lower margin
                driverPayout = driverMinimumPayout;
                safegoCommission = calcCommission(fareAfterGuards, driverPayout);
                marginProtectionCapped = true;
              }
            } else {
              marginProtectionCapped = true;
            }
          }
        }
      }
      
      // Final check if margin target was met
      const finalMarginPercent = calcMarginPercent(fareAfterGuards, safegoCommission);
      if (finalMarginPercent < companyMinMarginPercent) {
        marginProtectionCapped = true;
        marginShortfall = roundCurrency(companyMinMarginPercent - finalMarginPercent);
      }
    }
    
    // Final safety: Ensure commission is never negative
    safegoCommission = Math.max(0, safegoCommission);
    
    // ============================================
    // 18. FINAL FARE CALCULATION
    // After all guards and protections
    // ============================================
    
    // Final TLC enforcement - absolute cap after ALL adjustments including margin protection
    // This is the regulatory compliance checkpoint for NYC trips
    if (useTLCBaseFare) {
      if (fareAfterGuards < tlcMinimumTripFare) {
        fareAfterGuards = tlcMinimumTripFare;
        tlcMinimumFareApplied = true;
      }
      if (fareAfterGuards > tlcMaximumTripFare) {
        fareAfterGuards = tlcMaximumTripFare;
        tlcMaximumFareApplied = true;
        // Recalculate commission after cap
        safegoCommission = calcCommission(fareAfterGuards, driverPayout);
        safegoCommission = Math.max(0, safegoCommission);
      }
    }
    
    const finalFare = fareAfterGuards;
    
    // Calculate ACTUAL margin percentage from final values
    const companyMarginPercent = calcMarginPercent(finalFare, safegoCommission);
    
    // Build the consolidated flags object
    const flags: FareFlags = {
      trafficApplied,
      surgeApplied: effectiveSurge > 1,
      nightApplied: nightSurcharge > 0,
      peakApplied: peakHourSurcharge > 0,
      longDistanceApplied: longDistanceFee > 0,
      crossCityApplied,
      crossStateApplied,
      congestionFeeApplied,
      tlcAirportFeeApplied,
      tlcAVFFeeApplied,
      tlcBCFFeeApplied,
      tlcHVRFFeeApplied,
      tlcStateSurchargeApplied,
      tlcLongTripFeeApplied,
      airportFeeApplied,
      borderZoneApplied: borderZoneFeeApplied,
      regulatoryFeeApplied,
      returnDeadheadApplied,
      promoApplied: false, // Will be set by promo engine
      stateMinimumFareApplied,
      shortTripAdjustmentApplied,
      maximumFareApplied,
      minimumFareApplied,
      driverMinimumPayoutApplied,
      marginProtectionApplied,
    };
    
    // Calculate effective discount percentage
    const effectiveDiscountPct = discountAmount > 0 && subtotal > 0
      ? roundCurrency((discountAmount / subtotal) * 100)
      : 0;
    
    // Calculate absolute minimum fare (max of global and state minimums)
    const absoluteMinimumFare = stateMinimumFare && stateMinimumFare > globalMinimumFare
      ? stateMinimumFare
      : globalMinimumFare;

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
      
      // Location-based fees
      congestionFee,
      tlcAirportFee,
      tlcAirportName,
      tlcAirportCode,
      tlcAVFFee,
      tlcBCFFee,
      tlcBCFFeeRate,
      tlcHVRFFee,
      tlcStateSurcharge,
      tlcLongTripFee,
      airportFee,
      airportCode,
      borderZoneFee,
      
      // State regulatory fees
      stateRegulatoryFee,
      stateRegulatoryFeeBreakdown,
      
      tollsTotal,
      tollsBreakdown,
      regulatoryFeesTotal,
      regulatoryFeesBreakdown,
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
      stateMinimumFare: stateMinimumFare || undefined,
      absoluteMinimumFare,
      
      driverPayout,
      driverMinimumPayoutApplied,
      safegoCommission,
      companyMarginPercent,
      
      marginProtectionApplied,
      marginProtectionCapped,
      marginShortfall,
      
      // Consolidated flags object (as per spec)
      flags,
      
      // Legacy individual flags (for backward compatibility)
      crossCityApplied,
      crossStateApplied,
      regulatoryFeeApplied,
      congestionFeeApplied,
      tlcAirportFeeApplied,
      tlcAVFFeeApplied,
      tlcBCFFeeApplied,
      tlcHVRFFeeApplied,
      tlcStateSurchargeApplied,
      tlcLongTripFeeApplied,
      airportFeeApplied,
      borderZoneFeeApplied,
      returnDeadheadApplied,
      stateMinimumFareApplied,
      
      matchedZoneIds,
      
      // Fee suppression log for audit
      feeSuppressionLog,
      
      // TLC Base Fare tracking (NYC TLC Time-Distance Formula)
      tlcBaseFare,
      tlcTimeFare,
      tlcDistanceFare,
      tlcRawTotal,
      tlcEnforcedTotal,
      tlcCalculatedFare,
      tlcMinimumTripFare,
      tlcMaximumTripFare,
      tlcBaseFareApplied,
      tlcTimeRateApplied,
      tlcDistanceRateApplied,
      tlcMinimumFareApplied,
      tlcMaximumFareApplied,
      
      // Pipeline subtotal (enforced TLC or raw base+distance+time)
      baseSubtotalForPipeline,
    };
  }
  
  /**
   * Calculate fares for all route alternatives
   */
  async calculateFares(request: FareCalculationRequest): Promise<FareCalculationResult> {
    const startTime = Date.now();
    
    try {
      await this.refreshCache();
      
      // Get ride type
      const rideType = this.rideTypesCache.get(request.rideTypeCode);
      if (!rideType) {
        throw new Error(`Invalid ride type: ${request.rideTypeCode}`);
      }
      
      // Get fare config
      const fareConfig = await this.getFareConfig(
        rideType.id,
        request.countryCode || "US",
        request.cityCode
      );
      if (!fareConfig) {
        throw new Error(`No fare configuration found for ${request.rideTypeCode} in ${request.countryCode}`);
      }
      
      const pickup = { lat: request.pickupLat, lng: request.pickupLng };
      const dropoff = { lat: request.dropoffLat, lng: request.dropoffLng };
      const surgeMultiplier = request.surgeMultiplier || 1;
      
      // Calculate fare for each route
      const routeFares: RouteFareBreakdown[] = [];
      
      for (const route of request.routes) {
        const fare = await this.calculateRouteFare(
          route,
          fareConfig,
          rideType,
          pickup,
          dropoff,
          surgeMultiplier,
          request.countryCode || "US",
          request.cityCode
        );
        routeFares.push(fare);
      }
      
      // Determine cheapest and fastest
      let cheapestRouteId: string | undefined;
      let fastestRouteId: string | undefined;
      let minFare = Infinity;
      let minDuration = Infinity;
      
      for (const fare of routeFares) {
        if (fare.totalFare < minFare) {
          minFare = fare.totalFare;
          cheapestRouteId = fare.routeId;
        }
        if (fare.durationMinutes < minDuration) {
          minDuration = fare.durationMinutes;
          fastestRouteId = fare.routeId;
        }
      }
      
      // Mark cheapest and fastest
      for (const fare of routeFares) {
        fare.isCheapest = fare.routeId === cheapestRouteId;
        fare.isFastest = fare.routeId === fastestRouteId;
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[FareCalculation] Calculated ${routeFares.length} route fares in ${elapsed}ms`);
      
      return {
        success: true,
        rideType: {
          code: rideType.code,
          name: rideType.name,
          description: rideType.description || undefined,
          capacity: rideType.capacity,
        },
        routeFares,
        cheapestRouteId,
        fastestRouteId,
        currency: "USD",
        calculatedAt: new Date(),
      };
    } catch (error) {
      console.error("[FareCalculation] Error calculating fares:", error);
      throw error;
    }
  }
  
  /**
   * Calculate fares for all ride types and all routes
   * Returns a comprehensive fare matrix
   */
  async calculateAllFares(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    routes: RouteInfo[],
    surgeMultiplier?: number,
    countryCode?: string,
    cityCode?: string
  ): Promise<Map<RideTypeCode, FareCalculationResult>> {
    await this.refreshCache();
    
    const results = new Map<RideTypeCode, FareCalculationResult>();
    const rideTypeCodes: RideTypeCode[] = ["SAVER", "STANDARD", "COMFORT", "XL", "PREMIUM"];
    
    for (const code of rideTypeCodes) {
      if (!this.rideTypesCache.has(code)) continue;
      
      try {
        const result = await this.calculateFares({
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          rideTypeCode: code,
          routes,
          countryCode,
          cityCode,
          surgeMultiplier,
        });
        results.set(code, result);
      } catch (error) {
        console.error(`[FareCalculation] Error calculating fares for ${code}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Log fare calculation for audit trail
   */
  async logFareCalculation(
    result: FareCalculationResult,
    request: FareCalculationRequest,
    selectedRouteId?: string,
    customerId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const selectedFare = result.routeFares.find(f => f.routeId === selectedRouteId) || result.routeFares[0];
    
    // Use type assertion for new Prisma model
    const db = prisma as any;
    const log = await db.fareCalculationLog.create({
      data: {
        customerId,
        pickupLat: request.pickupLat,
        pickupLng: request.pickupLng,
        dropoffLat: request.dropoffLat,
        dropoffLng: request.dropoffLng,
        routeId: selectedRouteId,
        distanceMiles: selectedFare.distanceMiles,
        durationMinutes: selectedFare.durationMinutes,
        trafficDurationMinutes: selectedFare.trafficDurationMinutes,
        rideTypeCode: request.rideTypeCode,
        selectedRouteType: selectedRouteId,
        fareBreakdown: selectedFare as any,
        baseFare: selectedFare.baseFare,
        distanceFare: selectedFare.distanceFare,
        timeFare: selectedFare.timeFare,
        trafficAdjustment: selectedFare.trafficAdjustment,
        surgeAmount: selectedFare.surgeAmount,
        surgeMultiplier: selectedFare.surgeMultiplier,
        tollsTotal: selectedFare.tollsTotal,
        regulatoryFeesTotal: selectedFare.regulatoryFeesTotal,
        serviceFee: selectedFare.serviceFee,
        discountAmount: selectedFare.discountAmount,
        totalFare: selectedFare.totalFare,
        driverPayout: selectedFare.driverPayout,
        safegoCommission: selectedFare.safegoCommission,
        matchedZones: selectedFare.matchedZoneIds,
        appliedFees: {
          tolls: selectedFare.tollsBreakdown,
          regulatory: selectedFare.regulatoryFeesBreakdown,
          additional: selectedFare.additionalFeesBreakdown,
        },
        routeAlternatives: result.routeFares,
        ipAddress,
        userAgent,
      },
    });
    
    return log.id;
  }
  
  // ============================================
  // REFUND AND CANCELLATION FEE RULES
  // ============================================
  
  /**
   * Calculate refund amount based on ride status and timing
   * Implements standard US ride-share refund policies
   */
  calculateRefund(
    originalFare: number,
    rideStatus: string,
    minutesSinceBooking: number,
    minutesSinceDriverAccept: number,
    distanceTraveled: number,
    totalDistance: number,
    cancellationReason?: string
  ): {
    refundAmount: number;
    refundPercent: number;
    cancellationFee: number;
    reason: string;
  } {
    // Free cancellation window: 2 minutes after booking, before driver accepts
    const FREE_CANCEL_WINDOW_MINUTES = 2;
    // Grace period after driver accepts
    const DRIVER_ACCEPT_GRACE_MINUTES = 5;
    // No-show threshold (driver waited)
    const NO_SHOW_THRESHOLD_MINUTES = 5;
    // Cancellation fee rates
    const CANCELLATION_FEE_BASE = 5.00;
    const CANCELLATION_FEE_AFTER_WAIT = 7.50;
    
    let refundAmount = 0;
    let cancellationFee = 0;
    let reason = "";
    
    // Full refund scenarios
    if (rideStatus === "SEARCHING" && minutesSinceBooking <= FREE_CANCEL_WINDOW_MINUTES) {
      refundAmount = originalFare;
      reason = "Free cancellation within 2-minute window";
    }
    else if (rideStatus === "SEARCHING") {
      // After 2 minutes but no driver found yet
      refundAmount = originalFare;
      reason = "Full refund - no driver assigned";
    }
    else if (rideStatus === "DRIVER_ASSIGNED" && minutesSinceDriverAccept <= DRIVER_ACCEPT_GRACE_MINUTES) {
      // Within grace period after driver accepts
      refundAmount = originalFare;
      reason = "Free cancellation within 5-minute grace period";
    }
    else if (cancellationReason === "DRIVER_CANCELLED" || cancellationReason === "DRIVER_NO_SHOW") {
      // Driver cancelled or didn't show
      refundAmount = originalFare;
      reason = "Full refund - driver cancelled or no-show";
    }
    // Partial refund scenarios
    else if (rideStatus === "DRIVER_ASSIGNED") {
      // After grace period, before pickup
      cancellationFee = CANCELLATION_FEE_BASE;
      refundAmount = Math.max(0, originalFare - cancellationFee);
      reason = `Cancellation fee of $${CANCELLATION_FEE_BASE.toFixed(2)} applied`;
    }
    else if (rideStatus === "DRIVER_ARRIVED" || rideStatus === "WAITING") {
      // Driver arrived and waiting
      cancellationFee = CANCELLATION_FEE_AFTER_WAIT;
      refundAmount = Math.max(0, originalFare - cancellationFee);
      reason = `Driver wait time cancellation fee of $${CANCELLATION_FEE_AFTER_WAIT.toFixed(2)} applied`;
    }
    else if (rideStatus === "IN_PROGRESS") {
      // Partial trip completed
      if (distanceTraveled > 0 && totalDistance > 0) {
        const completedPercent = Math.min(100, (distanceTraveled / totalDistance) * 100);
        const completedFare = roundCurrency(originalFare * (completedPercent / 100));
        refundAmount = roundCurrency(originalFare - completedFare);
        reason = `Partial refund - ${completedPercent.toFixed(0)}% of trip completed`;
      } else {
        refundAmount = 0;
        reason = "No refund - trip in progress";
      }
    }
    else if (rideStatus === "COMPLETED") {
      // Trip completed - no automatic refund
      refundAmount = 0;
      reason = "Trip completed - contact support for refund requests";
    }
    // No-show by rider
    else if (rideStatus === "RIDER_NO_SHOW") {
      cancellationFee = CANCELLATION_FEE_AFTER_WAIT;
      refundAmount = Math.max(0, originalFare - cancellationFee);
      reason = `No-show fee of $${CANCELLATION_FEE_AFTER_WAIT.toFixed(2)} applied`;
    }
    else {
      // Default: no refund
      refundAmount = 0;
      reason = "Refund not applicable";
    }
    
    const refundPercent = originalFare > 0 
      ? roundCurrency((refundAmount / originalFare) * 100) 
      : 0;
    
    return {
      refundAmount: roundCurrency(refundAmount),
      refundPercent,
      cancellationFee: roundCurrency(cancellationFee),
      reason,
    };
  }
  
  /**
   * Calculate no-show fee for rider who didn't show up
   */
  calculateNoShowFee(
    waitTimeMinutes: number,
    fareConfig: RideFareConfig,
    countryCode: string
  ): {
    noShowFee: number;
    waitTimeFee: number;
    totalFee: number;
    driverCompensation: number;
  } {
    const BASE_NO_SHOW_FEE = 5.00;
    const WAIT_FEE_PER_MINUTE = 0.50;
    const WAIT_FREE_MINUTES = 2;
    const MAX_WAIT_FEE = 10.00;
    
    // Calculate wait time fee (after free period)
    let waitTimeFee = 0;
    if (waitTimeMinutes > WAIT_FREE_MINUTES) {
      const chargeableMinutes = waitTimeMinutes - WAIT_FREE_MINUTES;
      waitTimeFee = roundCurrency(chargeableMinutes * WAIT_FEE_PER_MINUTE);
      waitTimeFee = Math.min(waitTimeFee, MAX_WAIT_FEE);
    }
    
    const noShowFee = BASE_NO_SHOW_FEE;
    const totalFee = roundCurrency(noShowFee + waitTimeFee);
    
    // Driver gets 80% of the no-show fee as compensation
    const driverCompensation = roundCurrency(totalFee * 0.80);
    
    return {
      noShowFee: roundCurrency(noShowFee),
      waitTimeFee: roundCurrency(waitTimeFee),
      totalFee,
      driverCompensation,
    };
  }
  
  /**
   * Get waiting time fee for rider delays
   */
  calculateWaitingTimeFee(
    waitTimeMinutes: number,
    countryCode: string,
    cityCode?: string
  ): {
    fee: number;
    freeMinutes: number;
    chargeableMinutes: number;
    ratePerMinute: number;
  } {
    const WAIT_FREE_MINUTES = 2;
    const WAIT_FEE_PER_MINUTE = 0.50;
    
    const chargeableMinutes = Math.max(0, waitTimeMinutes - WAIT_FREE_MINUTES);
    const fee = roundCurrency(chargeableMinutes * WAIT_FEE_PER_MINUTE);
    
    return {
      fee,
      freeMinutes: WAIT_FREE_MINUTES,
      chargeableMinutes,
      ratePerMinute: WAIT_FEE_PER_MINUTE,
    };
  }
}

// Export singleton instance
export const fareCalculationService = FareCalculationService.getInstance();
