/**
 * Fare Calculation Types for Client
 * Mirrors server/services/fareCalculationService.ts types
 * 
 * VISIBILITY RULES - DO NOT VIOLATE:
 * - Fields marked as DRIVER-ONLY must NEVER be exposed to customers
 * - Customer UI should use CustomerFareView or strip driver-only fields
 * - See shared/visibilityRules.ts for enforcement utilities
 */

import { type VehicleCategoryId as SafeGoVehicleCategoryId } from "@shared/vehicleCategories";

export type LegacyRideTypeCode = "SAVER" | "STANDARD" | "COMFORT" | "XL" | "PREMIUM";

// Re-export the SAFEGO_ prefixed category IDs from shared module
export type VehicleCategoryId = SafeGoVehicleCategoryId;

// Combined type for backwards compatibility
export type RideTypeCode = LegacyRideTypeCode | VehicleCategoryId;

export interface FeeBreakdownItem {
  id: string;
  name: string;
  amount: number;
  type: "flat" | "percent" | "per_unit";
  description?: string;
  isRegulatory?: boolean;
  paidToDriver?: boolean;
}

export interface RouteFareBreakdown {
  routeId: string;
  routeSummary?: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  
  vehicleCategoryId?: VehicleCategoryId;
  vehicleCategoryDisplayName?: string;
  vehicleCategoryMultiplierApplied?: boolean;
  vehicleCategoryMinimumApplied?: boolean;
  preMultiplierBaseFare?: number;
  preMultiplierDistanceFare?: number;
  preMultiplierTimeFare?: number;
  vehicleCategoryMinimumFare?: number;
  
  crossStateFareApplied?: boolean;
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
  
  trafficAdjustment: number;
  surgeAmount: number;
  surgeMultiplier: number;
  
  tollsTotal: number;
  tollsBreakdown: FeeBreakdownItem[];
  regulatoryFeesTotal: number;
  regulatoryFeesBreakdown: FeeBreakdownItem[];
  additionalFeesTotal: number;
  additionalFeesBreakdown: FeeBreakdownItem[];
  serviceFee: number;
  
  discountAmount: number;
  promoCode?: string;
  
  subtotal: number;
  totalFare: number;
  
  /**
   * DRIVER-ONLY: Amount paid to driver after commission
   * Must NEVER be exposed to customer UI
   */
  driverPayout: number;
  /**
   * DRIVER-ONLY: Platform commission amount
   * Must NEVER be exposed to customer UI
   */
  safegoCommission: number;
  
  matchedZoneIds: string[];
  
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
  calculatedAt: string;
}

export interface AllFaresResponse {
  success: boolean;
  fareMatrix: Record<RideTypeCode, FareCalculationResult>;
  rideTypeCount: number;
  routeCount: number;
  currency: string;
  calculatedAt: string;
}

export interface RouteInfoRequest {
  routeId: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  polyline?: string;
  summary?: string;
  avoidsHighways?: boolean;
  avoidsTolls?: boolean;
  tollSegments?: string[];
}

export interface CalculateAllFaresRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  routes: RouteInfoRequest[];
  countryCode?: string;
  cityCode?: string;
  surgeMultiplier?: number;
}

export const RIDE_TYPE_DISPLAY_INFO: Record<string, { iconType: string; etaMinutes: number }> = {
  // Legacy ride types
  SAVER: { iconType: "economy", etaMinutes: 8 },
  STANDARD: { iconType: "economy", etaMinutes: 5 },
  COMFORT: { iconType: "comfort", etaMinutes: 7 },
  XL: { iconType: "xl", etaMinutes: 10 },
  PREMIUM: { iconType: "premium", etaMinutes: 12 },
  // SAFEGO_ prefixed vehicle categories
  SAFEGO_X: { iconType: "economy", etaMinutes: 5 },
  SAFEGO_COMFORT: { iconType: "comfort", etaMinutes: 7 },
  SAFEGO_COMFORT_XL: { iconType: "xl", etaMinutes: 9 },
  SAFEGO_XL: { iconType: "xl", etaMinutes: 10 },
  SAFEGO_BLACK: { iconType: "premium", etaMinutes: 12 },
  SAFEGO_BLACK_SUV: { iconType: "suv", etaMinutes: 15 },
  SAFEGO_WAV: { iconType: "accessible", etaMinutes: 13 },
};
