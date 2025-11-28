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

// ========================================
// STEP 2: DISPATCH ELIGIBILITY MATRIX
// ========================================
// Defines which ride types each vehicle category can serve
// Key rules:
// - X drivers → X only
// - Comfort → Comfort + X
// - Comfort XL → Comfort XL + Comfort + X
// - XL → XL + Comfort XL + Comfort + X
// - Black → Black + Comfort + X (NOT XL, WAV)
// - Black SUV → Black SUV + Black + Comfort + X
// - WAV → WAV only (isolated category)

export const DISPATCH_ELIGIBILITY_MATRIX: Record<VehicleCategoryId, VehicleCategoryId[]> = {
  X: ["X"],
  COMFORT: ["COMFORT", "X"],
  COMFORT_XL: ["COMFORT_XL", "COMFORT", "X"],
  XL: ["XL", "COMFORT_XL", "COMFORT", "X"],
  BLACK: ["BLACK", "COMFORT", "X"],
  BLACK_SUV: ["BLACK_SUV", "BLACK", "COMFORT", "X"],
  WAV: ["WAV"],
};

export const REVERSE_DISPATCH_ELIGIBILITY: Record<VehicleCategoryId, VehicleCategoryId[]> = {
  X: ["X", "COMFORT", "COMFORT_XL", "XL", "BLACK", "BLACK_SUV"],
  COMFORT: ["COMFORT", "COMFORT_XL", "XL", "BLACK", "BLACK_SUV"],
  COMFORT_XL: ["COMFORT_XL", "XL"],
  XL: ["XL"],
  BLACK: ["BLACK", "BLACK_SUV"],
  BLACK_SUV: ["BLACK_SUV"],
  WAV: ["WAV"],
};

export interface DispatchEligibilityResult {
  isEligible: boolean;
  reason?: string;
  vehicleCategory: VehicleCategoryId;
  requestedCategory: VehicleCategoryId;
  eligibleCategories: VehicleCategoryId[];
}

export function canVehicleServeCategory(
  vehicleCategory: VehicleCategoryId,
  requestedCategory: VehicleCategoryId
): DispatchEligibilityResult {
  const eligibleCategories = DISPATCH_ELIGIBILITY_MATRIX[vehicleCategory] || [];
  const isEligible = eligibleCategories.includes(requestedCategory);
  
  let reason: string | undefined;
  if (!isEligible) {
    if (requestedCategory === "WAV" && vehicleCategory !== "WAV") {
      reason = "WAV rides require wheelchair-accessible vehicles only";
    } else if (["BLACK", "BLACK_SUV"].includes(requestedCategory) && !["BLACK", "BLACK_SUV"].includes(vehicleCategory)) {
      reason = "Luxury rides require premium black vehicles";
    } else if (requestedCategory === "XL" && vehicleCategory === "BLACK") {
      reason = "Black cars cannot serve XL rides (insufficient capacity)";
    } else {
      reason = `${VEHICLE_CATEGORIES[vehicleCategory].displayName} cannot serve ${VEHICLE_CATEGORIES[requestedCategory].displayName} rides`;
    }
  }
  
  return {
    isEligible,
    reason,
    vehicleCategory,
    requestedCategory,
    eligibleCategories,
  };
}

export function getEligibleDriverCategories(
  requestedCategory: VehicleCategoryId
): VehicleCategoryId[] {
  return REVERSE_DISPATCH_ELIGIBILITY[requestedCategory] || [];
}

export function filterEligibleDrivers<T extends { vehicleCategory: VehicleCategoryId | null | undefined }>(
  drivers: T[],
  requestedCategory: VehicleCategoryId
): T[] {
  const eligibleCategories = getEligibleDriverCategories(requestedCategory);
  return drivers.filter(driver => 
    driver.vehicleCategory && eligibleCategories.includes(driver.vehicleCategory as VehicleCategoryId)
  );
}

export interface VehicleCategoryValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateVehicleForCategory(
  vehicle: {
    make?: string | null;
    year?: number | null;
    color?: string | null;
    exteriorColor?: string | null;
    interiorColor?: string | null;
    wheelchairAccessible?: boolean | null;
    seatCapacity?: number | null;
  },
  targetCategory: VehicleCategoryId
): VehicleCategoryValidation {
  const category = VEHICLE_CATEGORIES[targetCategory];
  const errors: string[] = [];
  const warnings: string[] = [];
  const currentYear = new Date().getFullYear();
  
  // Model year requirements
  if (category.requirements?.minModelYear) {
    if (!vehicle.year) {
      errors.push(`Vehicle year is required for ${category.displayName}`);
    } else if (vehicle.year < category.requirements.minModelYear) {
      errors.push(`${category.displayName} requires vehicles from ${category.requirements.minModelYear} or newer (vehicle is ${vehicle.year})`);
    }
  }
  
  // Preferred brands for luxury
  if (category.requirements?.preferredBrands && category.requirements.preferredBrands.length > 0) {
    if (!vehicle.make) {
      warnings.push(`Vehicle make is recommended for ${category.displayName}`);
    } else if (!category.requirements.preferredBrands.includes(vehicle.make)) {
      warnings.push(`${category.displayName} typically includes ${category.requirements.preferredBrands.join(", ")} vehicles`);
    }
  }
  
  // Exterior color for BLACK/BLACK_SUV
  if (category.requirements?.exteriorColor) {
    const vehicleExtColor = vehicle.exteriorColor || vehicle.color;
    if (!vehicleExtColor) {
      errors.push(`Exterior color is required for ${category.displayName}`);
    } else if (vehicleExtColor.toLowerCase() !== category.requirements.exteriorColor.toLowerCase()) {
      errors.push(`${category.displayName} requires ${category.requirements.exteriorColor} exterior color`);
    }
  }
  
  // Interior color for BLACK/BLACK_SUV  
  if (category.requirements?.interiorColor) {
    if (!vehicle.interiorColor) {
      errors.push(`Interior color is required for ${category.displayName}`);
    } else if (vehicle.interiorColor.toLowerCase() !== category.requirements.interiorColor.toLowerCase()) {
      errors.push(`${category.displayName} requires ${category.requirements.interiorColor} interior color`);
    }
  }
  
  // WAV accessibility requirement
  if (category.requirements?.isAccessible) {
    if (!vehicle.wheelchairAccessible) {
      errors.push(`${category.displayName} requires wheelchair-accessible certification`);
    }
  }
  
  // Seat capacity check
  if (vehicle.seatCapacity && vehicle.seatCapacity < category.seatCount) {
    errors.push(`${category.displayName} requires at least ${category.seatCount} seats (vehicle has ${vehicle.seatCapacity})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getHighestEligibleCategory(
  vehicle: {
    make?: string | null;
    year?: number | null;
    color?: string | null;
    exteriorColor?: string | null;
    interiorColor?: string | null;
    wheelchairAccessible?: boolean | null;
    seatCapacity?: number | null;
  }
): VehicleCategoryId {
  // Check categories from highest tier to lowest
  const categoryPriority: VehicleCategoryId[] = ["BLACK_SUV", "BLACK", "XL", "COMFORT_XL", "COMFORT", "X"];
  
  // WAV is special - only if wheelchair accessible
  if (vehicle.wheelchairAccessible) {
    return "WAV";
  }
  
  for (const categoryId of categoryPriority) {
    const validation = validateVehicleForCategory(vehicle, categoryId);
    if (validation.isValid) {
      return categoryId;
    }
  }
  
  // Default to X if nothing else matches
  return "X";
}
