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
  | "SAFEGO_X" 
  | "SAFEGO_COMFORT" 
  | "SAFEGO_COMFORT_XL" 
  | "SAFEGO_XL" 
  | "SAFEGO_BLACK" 
  | "SAFEGO_BLACK_SUV" 
  | "SAFEGO_WAV";

// Legacy short-form category IDs for backwards compatibility
export type LegacyVehicleCategoryId = 
  | "X" 
  | "COMFORT" 
  | "COMFORT_XL" 
  | "XL" 
  | "BLACK" 
  | "BLACK_SUV" 
  | "WAV";

// Vehicle body types for category suggestion
export type VehicleBodyType = 
  | "SEDAN"
  | "SUV"
  | "MINIVAN"
  | "HATCHBACK"
  | "WAGON"
  | "CROSSOVER"
  | "VAN";

// Vehicle verification status
export type VehicleVerificationStatus = 
  | "PENDING_VERIFICATION"
  | "APPROVED"
  | "REJECTED"
  | "REQUEST_CHANGES";

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
  SAFEGO_X: {
    id: "SAFEGO_X",
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
  SAFEGO_COMFORT: {
    id: "SAFEGO_COMFORT",
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
  SAFEGO_COMFORT_XL: {
    id: "SAFEGO_COMFORT_XL",
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
  SAFEGO_XL: {
    id: "SAFEGO_XL",
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
  SAFEGO_BLACK: {
    id: "SAFEGO_BLACK",
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
  SAFEGO_BLACK_SUV: {
    id: "SAFEGO_BLACK_SUV",
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
  SAFEGO_WAV: {
    id: "SAFEGO_WAV",
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

// Legacy category ID mapping (for backwards compatibility)
export const LEGACY_TO_SAFEGO_CATEGORY_MAP: Record<LegacyVehicleCategoryId, VehicleCategoryId> = {
  X: "SAFEGO_X",
  COMFORT: "SAFEGO_COMFORT",
  COMFORT_XL: "SAFEGO_COMFORT_XL",
  XL: "SAFEGO_XL",
  BLACK: "SAFEGO_BLACK",
  BLACK_SUV: "SAFEGO_BLACK_SUV",
  WAV: "SAFEGO_WAV",
};

export function normalizeCategoryId(id: string): VehicleCategoryId | null {
  if (id in VEHICLE_CATEGORIES) {
    return id as VehicleCategoryId;
  }
  if (id in LEGACY_TO_SAFEGO_CATEGORY_MAP) {
    return LEGACY_TO_SAFEGO_CATEGORY_MAP[id as LegacyVehicleCategoryId];
  }
  return null;
}

export const VEHICLE_CATEGORY_ORDER: VehicleCategoryId[] = [
  "SAFEGO_X",
  "SAFEGO_COMFORT",
  "SAFEGO_COMFORT_XL",
  "SAFEGO_XL",
  "SAFEGO_BLACK",
  "SAFEGO_BLACK_SUV",
  "SAFEGO_WAV",
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
  SAVER: "SAFEGO_X",
  STANDARD: "SAFEGO_X",
  COMFORT: "SAFEGO_COMFORT",
  XL: "SAFEGO_XL",
  PREMIUM: "SAFEGO_BLACK",
};

export function mapLegacyRideTypeToCategory(legacyCode: LegacyRideTypeCode): VehicleCategoryId {
  return LEGACY_TO_NEW_CATEGORY_MAP[legacyCode] || "SAFEGO_X";
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
  SAFEGO_X: ["SAFEGO_X"],
  SAFEGO_COMFORT: ["SAFEGO_COMFORT", "SAFEGO_X"],
  SAFEGO_COMFORT_XL: ["SAFEGO_COMFORT_XL", "SAFEGO_COMFORT", "SAFEGO_X"],
  SAFEGO_XL: ["SAFEGO_XL", "SAFEGO_COMFORT_XL", "SAFEGO_COMFORT", "SAFEGO_X"],
  SAFEGO_BLACK: ["SAFEGO_BLACK", "SAFEGO_COMFORT", "SAFEGO_X"],
  SAFEGO_BLACK_SUV: ["SAFEGO_BLACK_SUV", "SAFEGO_BLACK", "SAFEGO_COMFORT", "SAFEGO_X"],
  SAFEGO_WAV: ["SAFEGO_WAV"],
};

export const REVERSE_DISPATCH_ELIGIBILITY: Record<VehicleCategoryId, VehicleCategoryId[]> = {
  SAFEGO_X: ["SAFEGO_X", "SAFEGO_COMFORT", "SAFEGO_COMFORT_XL", "SAFEGO_XL", "SAFEGO_BLACK", "SAFEGO_BLACK_SUV"],
  SAFEGO_COMFORT: ["SAFEGO_COMFORT", "SAFEGO_COMFORT_XL", "SAFEGO_XL", "SAFEGO_BLACK", "SAFEGO_BLACK_SUV"],
  SAFEGO_COMFORT_XL: ["SAFEGO_COMFORT_XL", "SAFEGO_XL"],
  SAFEGO_XL: ["SAFEGO_XL"],
  SAFEGO_BLACK: ["SAFEGO_BLACK", "SAFEGO_BLACK_SUV"],
  SAFEGO_BLACK_SUV: ["SAFEGO_BLACK_SUV"],
  SAFEGO_WAV: ["SAFEGO_WAV"],
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
    if (requestedCategory === "SAFEGO_WAV" && vehicleCategory !== "SAFEGO_WAV") {
      reason = "WAV rides require wheelchair-accessible vehicles only";
    } else if (["SAFEGO_BLACK", "SAFEGO_BLACK_SUV"].includes(requestedCategory) && !["SAFEGO_BLACK", "SAFEGO_BLACK_SUV"].includes(vehicleCategory)) {
      reason = "Luxury rides require premium black vehicles";
    } else if (requestedCategory === "SAFEGO_XL" && vehicleCategory === "SAFEGO_BLACK") {
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
  const categoryPriority: VehicleCategoryId[] = [
    "SAFEGO_BLACK_SUV", 
    "SAFEGO_BLACK", 
    "SAFEGO_XL", 
    "SAFEGO_COMFORT_XL", 
    "SAFEGO_COMFORT", 
    "SAFEGO_X"
  ];
  
  // WAV is special - only if wheelchair accessible
  if (vehicle.wheelchairAccessible) {
    return "SAFEGO_WAV";
  }
  
  for (const categoryId of categoryPriority) {
    const validation = validateVehicleForCategory(vehicle, categoryId);
    if (validation.isValid) {
      return categoryId;
    }
  }
  
  // Default to X if nothing else matches
  return "SAFEGO_X";
}

// ========================================
// STEP 3: AUTO-SUGGEST CATEGORY
// ========================================
// Suggests a category based on vehicle properties (internal, non-authoritative)
// Admin must verify and approve the final category

export interface SuggestedCategoryResult {
  suggestedCategory: VehicleCategoryId;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

export function suggestVehicleCategory(
  vehicle: {
    bodyType?: VehicleBodyType | string | null;
    seats?: number | null;
    year?: number | null;
    make?: string | null;
    luxury?: boolean | null;
    wheelchairAccessible?: boolean | null;
    exteriorColor?: string | null;
    interiorColor?: string | null;
  }
): SuggestedCategoryResult {
  const reasons: string[] = [];
  let suggestedCategory: VehicleCategoryId = "SAFEGO_X";
  let confidence: "high" | "medium" | "low" = "low";

  // WAV takes priority if wheelchair accessible
  if (vehicle.wheelchairAccessible) {
    suggestedCategory = "SAFEGO_WAV";
    confidence = "high";
    reasons.push("Vehicle is wheelchair accessible");
    return { suggestedCategory, confidence, reasons };
  }

  const isBlackExterior = vehicle.exteriorColor?.toLowerCase() === "black";
  const isBlackInterior = vehicle.interiorColor?.toLowerCase() === "black";
  const isSuv = ["SUV", "CROSSOVER"].includes(vehicle.bodyType || "");
  const isLargeVehicle = ["SUV", "MINIVAN", "VAN"].includes(vehicle.bodyType || "");
  const hasLuxurySeats = (vehicle.seats || 4) >= 6;
  const isLuxuryBrand = ["BMW", "Mercedes-Benz", "Audi", "Lexus", "Cadillac", "Lincoln", "Genesis"].includes(vehicle.make || "");
  const isNewEnough = (vehicle.year || 0) >= 2018;
  const isComfortYear = (vehicle.year || 0) >= 2016;

  // Black SUV: SUV + Luxury + Black + 6+ seats
  if (isSuv && hasLuxurySeats && vehicle.luxury && isBlackExterior && isBlackInterior) {
    suggestedCategory = "SAFEGO_BLACK_SUV";
    confidence = "high";
    reasons.push("SUV body type with 6+ seats", "Luxury vehicle", "Black exterior and interior");
  }
  // Black: Sedan + Luxury + Black
  else if (!isSuv && vehicle.luxury && isBlackExterior && isBlackInterior) {
    suggestedCategory = "SAFEGO_BLACK";
    confidence = "high";
    reasons.push("Luxury sedan", "Black exterior and interior");
  }
  // XL: Large vehicle (SUV/Minivan) with 6+ seats
  else if (isLargeVehicle && hasLuxurySeats) {
    suggestedCategory = "SAFEGO_XL";
    confidence = "high";
    reasons.push("Large vehicle body type", "6+ seat capacity");
  }
  // Comfort XL: Large vehicle + comfort-level year
  else if (isLargeVehicle && isComfortYear && (vehicle.seats || 4) >= 5) {
    suggestedCategory = "SAFEGO_COMFORT_XL";
    confidence = "medium";
    reasons.push("Larger vehicle", "Newer model year (2016+)");
  }
  // Comfort: Newer sedan with luxury brand or newer year
  else if ((isLuxuryBrand || isComfortYear) && !isLargeVehicle) {
    suggestedCategory = "SAFEGO_COMFORT";
    confidence = isLuxuryBrand ? "high" : "medium";
    reasons.push(isLuxuryBrand ? "Premium brand" : "Newer model year (2016+)");
  }
  // Default to X
  else {
    suggestedCategory = "SAFEGO_X";
    confidence = "low";
    reasons.push("Standard vehicle - meets SafeGo X requirements");
  }

  return { suggestedCategory, confidence, reasons };
}

// ========================================
// DISPATCH COMPATIBILITY FUNCTION
// ========================================
// Pure function for dispatch matching - exact category matching per spec

export function isCategoryCompatible(
  requestedCategory: VehicleCategoryId,
  driverCategory: VehicleCategoryId
): boolean {
  // Strict matching as per spec:
  // - SAFEGO_X → drivers with SAFEGO_X only
  // - SAFEGO_COMFORT → drivers with SAFEGO_COMFORT only
  // - SAFEGO_COMFORT_XL → drivers with SAFEGO_COMFORT_XL only
  // - SAFEGO_XL → drivers with SAFEGO_XL only
  // - SAFEGO_BLACK → drivers with SAFEGO_BLACK only
  // - SAFEGO_BLACK_SUV → drivers with SAFEGO_BLACK_SUV only
  // - SAFEGO_WAV → drivers with SAFEGO_WAV only
  return requestedCategory === driverCategory;
}
