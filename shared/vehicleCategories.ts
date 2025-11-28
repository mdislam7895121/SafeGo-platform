/**
 * SafeGo Vehicle Categories Configuration
 * 
 * Defines the 7 vehicle categories with per-category fare multipliers.
 * These multipliers are applied AFTER TLC base distance/time calculation
 * but BEFORE TLC surcharges and regulatory fees.
 * 
 * Vehicle Categories:
 * 1. SafeGo X - Standard everyday rides
 * 2. SafeGo Comfort - Newer cars with extra legroom
 * 3. SafeGo Comfort XL - Larger vehicles with Comfort-level quality
 * 4. SafeGo XL - Bigger vehicles for groups
 * 5. SafeGo Black - Premium black cars
 * 6. SafeGo Black SUV - Large luxury SUVs
 * 7. SafeGo WAV - Wheelchair accessible vehicles
 */

export type VehicleCategoryId = 
  | "X" 
  | "COMFORT" 
  | "COMFORT_XL" 
  | "XL" 
  | "BLACK" 
  | "BLACK_SUV" 
  | "WAV";

export interface VehicleCategoryConfig {
  id: VehicleCategoryId;
  displayName: string;
  description: string;
  shortDescription: string;
  seatCount: number;
  baseMultiplier: number;
  perMileMultiplier: number;
  perMinuteMultiplier: number;
  minimumFare: number;
  isActive: boolean;
  iconType: "economy" | "comfort" | "xl" | "premium" | "suv" | "accessible";
  etaMinutesOffset: number;
  sortOrder: number;
  isPopular?: boolean;
  requirements?: {
    minModelYear?: number;
    preferredBrands?: string[];
    exteriorColor?: string;
    interiorColor?: string;
    isAccessible?: boolean;
  };
}

export const VEHICLE_CATEGORIES: Record<VehicleCategoryId, VehicleCategoryConfig> = {
  X: {
    id: "X",
    displayName: "SafeGo X",
    description: "Standard everyday rides with reliable service",
    shortDescription: "Most affordable everyday rides",
    seatCount: 4,
    baseMultiplier: 1.00,
    perMileMultiplier: 1.00,
    perMinuteMultiplier: 1.00,
    minimumFare: 7.00,
    isActive: true,
    iconType: "economy",
    etaMinutesOffset: 0,
    sortOrder: 1,
    isPopular: true,
    requirements: {
      minModelYear: 2012,
    },
  },
  COMFORT: {
    id: "COMFORT",
    displayName: "SafeGo Comfort",
    description: "Newer, more comfortable cars with extra legroom",
    shortDescription: "Newer cars with extra comfort",
    seatCount: 4,
    baseMultiplier: 1.20,
    perMileMultiplier: 1.20,
    perMinuteMultiplier: 1.20,
    minimumFare: 9.00,
    isActive: true,
    iconType: "comfort",
    etaMinutesOffset: 2,
    sortOrder: 2,
    requirements: {
      minModelYear: 2016,
    },
  },
  COMFORT_XL: {
    id: "COMFORT_XL",
    displayName: "SafeGo Comfort XL",
    description: "Larger vehicles with Comfort-level ride quality",
    shortDescription: "Comfort ride for bigger groups",
    seatCount: 6,
    baseMultiplier: 1.50,
    perMileMultiplier: 1.50,
    perMinuteMultiplier: 1.50,
    minimumFare: 11.00,
    isActive: true,
    iconType: "xl",
    etaMinutesOffset: 4,
    sortOrder: 3,
    requirements: {
      minModelYear: 2016,
    },
  },
  XL: {
    id: "XL",
    displayName: "SafeGo XL",
    description: "Bigger vehicles for groups and luggage",
    shortDescription: "Spacious rides for groups",
    seatCount: 6,
    baseMultiplier: 1.70,
    perMileMultiplier: 1.70,
    perMinuteMultiplier: 1.70,
    minimumFare: 12.00,
    isActive: true,
    iconType: "xl",
    etaMinutesOffset: 5,
    sortOrder: 4,
    requirements: {
      minModelYear: 2012,
    },
  },
  BLACK: {
    id: "BLACK",
    displayName: "SafeGo Black",
    description: "Premium black cars with professional drivers",
    shortDescription: "Premium black cars",
    seatCount: 4,
    baseMultiplier: 2.50,
    perMileMultiplier: 2.50,
    perMinuteMultiplier: 2.50,
    minimumFare: 15.00,
    isActive: true,
    iconType: "premium",
    etaMinutesOffset: 7,
    sortOrder: 5,
    requirements: {
      minModelYear: 2018,
      preferredBrands: ["BMW", "Mercedes-Benz", "Audi", "Lexus"],
      exteriorColor: "Black",
      interiorColor: "Black",
    },
  },
  BLACK_SUV: {
    id: "BLACK_SUV",
    displayName: "SafeGo Black SUV",
    description: "Large luxury SUVs for VIP groups",
    shortDescription: "Luxury SUVs for groups",
    seatCount: 6,
    baseMultiplier: 3.20,
    perMileMultiplier: 3.20,
    perMinuteMultiplier: 3.20,
    minimumFare: 18.00,
    isActive: true,
    iconType: "suv",
    etaMinutesOffset: 10,
    sortOrder: 6,
    requirements: {
      minModelYear: 2018,
      preferredBrands: ["Cadillac", "Lincoln", "Mercedes-Benz", "BMW"],
      exteriorColor: "Black",
      interiorColor: "Black",
    },
  },
  WAV: {
    id: "WAV",
    displayName: "SafeGo WAV",
    description: "Wheelchair accessible vehicles with trained drivers",
    shortDescription: "Wheelchair accessible vehicles",
    seatCount: 4,
    baseMultiplier: 1.00,
    perMileMultiplier: 1.00,
    perMinuteMultiplier: 1.00,
    minimumFare: 7.00,
    isActive: true,
    iconType: "accessible",
    etaMinutesOffset: 8,
    sortOrder: 7,
    requirements: {
      isAccessible: true,
    },
  },
};

export const VEHICLE_CATEGORY_ORDER: VehicleCategoryId[] = [
  "X",
  "COMFORT",
  "COMFORT_XL",
  "XL",
  "BLACK",
  "BLACK_SUV",
  "WAV",
];

export function getVehicleCategory(id: VehicleCategoryId): VehicleCategoryConfig {
  return VEHICLE_CATEGORIES[id];
}

export function getActiveVehicleCategories(): VehicleCategoryConfig[] {
  return VEHICLE_CATEGORY_ORDER
    .map(id => VEHICLE_CATEGORIES[id])
    .filter(cat => cat.isActive);
}

export function getAllVehicleCategories(): VehicleCategoryConfig[] {
  return VEHICLE_CATEGORY_ORDER.map(id => VEHICLE_CATEGORIES[id]);
}

export function isValidVehicleCategoryId(id: string): id is VehicleCategoryId {
  return id in VEHICLE_CATEGORIES;
}

export type LegacyRideTypeCode = "SAVER" | "STANDARD" | "COMFORT" | "XL" | "PREMIUM";

export const LEGACY_TO_NEW_CATEGORY_MAP: Record<LegacyRideTypeCode, VehicleCategoryId> = {
  SAVER: "X",
  STANDARD: "X",
  COMFORT: "COMFORT",
  XL: "XL",
  PREMIUM: "BLACK",
};

export function mapLegacyRideTypeToCategory(legacyCode: LegacyRideTypeCode): VehicleCategoryId {
  return LEGACY_TO_NEW_CATEGORY_MAP[legacyCode] || "X";
}

export function applyVehicleMultipliers(
  baseFare: number,
  distanceFare: number,
  timeFare: number,
  categoryId: VehicleCategoryId
): {
  adjustedBaseFare: number;
  adjustedDistanceFare: number;
  adjustedTimeFare: number;
  subtotal: number;
  categoryMinimumFare: number;
  multiplierApplied: boolean;
} {
  const category = VEHICLE_CATEGORIES[categoryId];
  
  const adjustedBaseFare = roundCurrency(baseFare * category.baseMultiplier);
  const adjustedDistanceFare = roundCurrency(distanceFare * category.perMileMultiplier);
  const adjustedTimeFare = roundCurrency(timeFare * category.perMinuteMultiplier);
  
  let subtotal = adjustedBaseFare + adjustedDistanceFare + adjustedTimeFare;
  
  if (subtotal < category.minimumFare) {
    subtotal = category.minimumFare;
  }
  
  const multiplierApplied = 
    category.baseMultiplier !== 1.0 || 
    category.perMileMultiplier !== 1.0 || 
    category.perMinuteMultiplier !== 1.0;
  
  return {
    adjustedBaseFare,
    adjustedDistanceFare,
    adjustedTimeFare,
    subtotal,
    categoryMinimumFare: category.minimumFare,
    multiplierApplied,
  };
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateCategoryFareEstimate(
  baseTripFare: number,
  categoryId: VehicleCategoryId
): number {
  const category = VEHICLE_CATEGORIES[categoryId];
  const averageMultiplier = (
    category.baseMultiplier + 
    category.perMileMultiplier + 
    category.perMinuteMultiplier
  ) / 3;
  
  const estimatedFare = roundCurrency(baseTripFare * averageMultiplier);
  return Math.max(estimatedFare, category.minimumFare);
}

export function getCategoryETA(
  baseETAMinutes: number,
  categoryId: VehicleCategoryId
): number {
  const category = VEHICLE_CATEGORIES[categoryId];
  return baseETAMinutes + category.etaMinutesOffset;
}
