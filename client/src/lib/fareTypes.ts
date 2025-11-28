/**
 * Fare Calculation Types for Client
 * Mirrors server/services/fareCalculationService.ts types
 */

export type RideTypeCode = "SAVER" | "STANDARD" | "COMFORT" | "XL" | "PREMIUM";

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
  
  driverPayout: number;
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

export const RIDE_TYPE_DISPLAY_INFO: Record<RideTypeCode, { iconType: string; etaMinutes: number }> = {
  SAVER: { iconType: "economy", etaMinutes: 8 },
  STANDARD: { iconType: "economy", etaMinutes: 5 },
  COMFORT: { iconType: "comfort", etaMinutes: 7 },
  XL: { iconType: "xl", etaMinutes: 10 },
  PREMIUM: { iconType: "premium", etaMinutes: 12 },
};
