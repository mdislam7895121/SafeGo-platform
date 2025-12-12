/**
 * SafeGo USA Vehicle Types Configuration
 * 
 * Global Vehicle Master for United States market
 * Covers: Ride-hailing, Food Delivery, Parcel Delivery
 * 
 * Rules:
 * - All vehicles are country-scoped (US only)
 * - Vehicles without pricing config are hidden from customers
 * - Premium vehicles (Executive, Executive SUV) require stricter driver eligibility
 * - City Taxi respects city/state-specific enable rules
 * - No Bike/Scooter/Bicycle vehicles in US market
 */

export type USAServiceType = "ride" | "food" | "parcel";

export type USAVehicleKey =
  | "SAFEGO_STANDARD"
  | "SAFEGO_COMFORT"
  | "SAFEGO_ECO"
  | "SAFEGO_FAMILY"
  | "SAFEGO_EXECUTIVE"
  | "SAFEGO_EXECUTIVE_SUV"
  | "SAFEGO_SCHEDULE"
  | "SAFEGO_HOURLY"
  | "SAFEGO_CITY_TAXI"
  | "SAFEGO_CAR_DELIVERY"
  | "SAFEGO_VAN_DELIVERY"
  | "SAFEGO_CONNECT";

export interface USAVehicleConfig {
  vehicle_key: USAVehicleKey;
  display_name: string;
  description: string;
  short_description: string;
  country: "US";
  service_type: USAServiceType;
  capacity: number;
  is_premium: boolean;
  is_time_based: boolean;
  is_enabled: boolean;
  icon_type: "economy" | "comfort" | "eco" | "family" | "premium" | "suv" | "taxi" | "delivery" | "van" | "express";
  eta_minutes_offset: number;
  sort_order: number;
  requirements?: {
    min_model_year?: number;
    preferred_brands?: string[];
    exterior_color?: string;
    interior_color?: string;
    is_hybrid_or_electric?: boolean;
    min_seats?: number;
    requires_premium_driver?: boolean;
    requires_city_license?: boolean;
    city_codes?: string[];
  };
  fare_multipliers?: {
    base: number;
    per_mile: number;
    per_minute: number;
    minimum_fare: number;
  };
}

export const USA_VEHICLE_TYPES: Record<USAVehicleKey, USAVehicleConfig> = {
  SAFEGO_STANDARD: {
    vehicle_key: "SAFEGO_STANDARD",
    display_name: "SafeGo Standard",
    description: "Reliable everyday rides at affordable prices",
    short_description: "Affordable everyday rides",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "economy",
    eta_minutes_offset: 0,
    sort_order: 1,
    requirements: {
      min_model_year: 2012,
    },
    fare_multipliers: {
      base: 1.0,
      per_mile: 1.0,
      per_minute: 1.0,
      minimum_fare: 7.0,
    },
  },

  SAFEGO_COMFORT: {
    vehicle_key: "SAFEGO_COMFORT",
    display_name: "SafeGo Comfort",
    description: "Newer vehicles with extra legroom and comfort features",
    short_description: "Newer cars with extra comfort",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "comfort",
    eta_minutes_offset: 2,
    sort_order: 2,
    requirements: {
      min_model_year: 2018,
    },
    fare_multipliers: {
      base: 1.2,
      per_mile: 1.2,
      per_minute: 1.2,
      minimum_fare: 10.0,
    },
  },

  SAFEGO_ECO: {
    vehicle_key: "SAFEGO_ECO",
    display_name: "SafeGo Eco",
    description: "Hybrid or electric vehicles for eco-conscious riders",
    short_description: "Hybrid & electric rides",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "eco",
    eta_minutes_offset: 3,
    sort_order: 3,
    requirements: {
      min_model_year: 2018,
      is_hybrid_or_electric: true,
    },
    fare_multipliers: {
      base: 1.1,
      per_mile: 1.1,
      per_minute: 1.1,
      minimum_fare: 8.0,
    },
  },

  SAFEGO_FAMILY: {
    vehicle_key: "SAFEGO_FAMILY",
    display_name: "SafeGo Family",
    description: "Spacious 6-7 seater vehicles for groups and families",
    short_description: "6-7 seater for groups",
    country: "US",
    service_type: "ride",
    capacity: 7,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "family",
    eta_minutes_offset: 5,
    sort_order: 4,
    requirements: {
      min_model_year: 2015,
      min_seats: 6,
    },
    fare_multipliers: {
      base: 1.5,
      per_mile: 1.5,
      per_minute: 1.5,
      minimum_fare: 12.0,
    },
  },

  SAFEGO_EXECUTIVE: {
    vehicle_key: "SAFEGO_EXECUTIVE",
    display_name: "SafeGo Executive",
    description: "Premium black cars with professional drivers for business travel",
    short_description: "Premium black cars",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: true,
    is_time_based: false,
    is_enabled: true,
    icon_type: "premium",
    eta_minutes_offset: 7,
    sort_order: 5,
    requirements: {
      min_model_year: 2020,
      preferred_brands: ["BMW", "Mercedes-Benz", "Audi", "Lexus", "Genesis"],
      exterior_color: "Black",
      interior_color: "Black",
      requires_premium_driver: true,
    },
    fare_multipliers: {
      base: 2.5,
      per_mile: 2.5,
      per_minute: 2.5,
      minimum_fare: 20.0,
    },
  },

  SAFEGO_EXECUTIVE_SUV: {
    vehicle_key: "SAFEGO_EXECUTIVE_SUV",
    display_name: "SafeGo Executive SUV",
    description: "Luxury SUVs for VIP groups and corporate travel",
    short_description: "Luxury SUVs for groups",
    country: "US",
    service_type: "ride",
    capacity: 6,
    is_premium: true,
    is_time_based: false,
    is_enabled: true,
    icon_type: "suv",
    eta_minutes_offset: 10,
    sort_order: 6,
    requirements: {
      min_model_year: 2020,
      preferred_brands: ["Cadillac", "Lincoln", "Mercedes-Benz", "BMW", "Audi"],
      exterior_color: "Black",
      interior_color: "Black",
      min_seats: 6,
      requires_premium_driver: true,
    },
    fare_multipliers: {
      base: 3.2,
      per_mile: 3.2,
      per_minute: 3.2,
      minimum_fare: 25.0,
    },
  },

  SAFEGO_SCHEDULE: {
    vehicle_key: "SAFEGO_SCHEDULE",
    display_name: "SafeGo Schedule",
    description: "Book rides in advance for guaranteed pickup times",
    short_description: "Advance booking rides",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "economy",
    eta_minutes_offset: 0,
    sort_order: 7,
    requirements: {
      min_model_year: 2015,
    },
    fare_multipliers: {
      base: 1.15,
      per_mile: 1.0,
      per_minute: 1.0,
      minimum_fare: 10.0,
    },
  },

  SAFEGO_HOURLY: {
    vehicle_key: "SAFEGO_HOURLY",
    display_name: "SafeGo Hourly",
    description: "Hire a driver by the hour for flexible travel needs",
    short_description: "Time-based driver hire",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: true,
    is_enabled: true,
    icon_type: "comfort",
    eta_minutes_offset: 5,
    sort_order: 8,
    requirements: {
      min_model_year: 2016,
    },
    fare_multipliers: {
      base: 25.0,
      per_mile: 0.5,
      per_minute: 0.0,
      minimum_fare: 50.0,
    },
  },

  SAFEGO_CITY_TAXI: {
    vehicle_key: "SAFEGO_CITY_TAXI",
    display_name: "SafeGo City Taxi",
    description: "City-regulated taxi service with metered fares",
    short_description: "City-regulated taxis",
    country: "US",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_enabled: false,
    icon_type: "taxi",
    eta_minutes_offset: 3,
    sort_order: 9,
    requirements: {
      requires_city_license: true,
      city_codes: ["NYC", "CHI", "LAX", "SFO"],
    },
    fare_multipliers: {
      base: 3.5,
      per_mile: 2.5,
      per_minute: 0.5,
      minimum_fare: 8.0,
    },
  },

  SAFEGO_CAR_DELIVERY: {
    vehicle_key: "SAFEGO_CAR_DELIVERY",
    display_name: "SafeGo Car Delivery",
    description: "Standard car delivery for food and small packages",
    short_description: "Car delivery service",
    country: "US",
    service_type: "food",
    capacity: 3,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "delivery",
    eta_minutes_offset: 0,
    sort_order: 10,
    requirements: {
      min_model_year: 2010,
    },
    fare_multipliers: {
      base: 2.5,
      per_mile: 1.2,
      per_minute: 0.15,
      minimum_fare: 5.0,
    },
  },

  SAFEGO_VAN_DELIVERY: {
    vehicle_key: "SAFEGO_VAN_DELIVERY",
    display_name: "SafeGo Van Delivery",
    description: "Larger van for bulk food orders and catering",
    short_description: "Van for large orders",
    country: "US",
    service_type: "food",
    capacity: 10,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "van",
    eta_minutes_offset: 5,
    sort_order: 11,
    requirements: {
      min_model_year: 2012,
    },
    fare_multipliers: {
      base: 5.0,
      per_mile: 2.0,
      per_minute: 0.25,
      minimum_fare: 10.0,
    },
  },

  SAFEGO_CONNECT: {
    vehicle_key: "SAFEGO_CONNECT",
    display_name: "SafeGo Connect",
    description: "Same-day parcel delivery with real-time tracking",
    short_description: "Same-day parcel delivery",
    country: "US",
    service_type: "parcel",
    capacity: 5,
    is_premium: false,
    is_time_based: false,
    is_enabled: true,
    icon_type: "express",
    eta_minutes_offset: 2,
    sort_order: 12,
    requirements: {
      min_model_year: 2012,
    },
    fare_multipliers: {
      base: 5.0,
      per_mile: 1.5,
      per_minute: 0.0,
      minimum_fare: 8.0,
    },
  },
};

export const USA_VEHICLE_TYPE_ORDER: USAVehicleKey[] = [
  "SAFEGO_STANDARD",
  "SAFEGO_COMFORT",
  "SAFEGO_ECO",
  "SAFEGO_FAMILY",
  "SAFEGO_EXECUTIVE",
  "SAFEGO_EXECUTIVE_SUV",
  "SAFEGO_SCHEDULE",
  "SAFEGO_HOURLY",
  "SAFEGO_CITY_TAXI",
  "SAFEGO_CAR_DELIVERY",
  "SAFEGO_VAN_DELIVERY",
  "SAFEGO_CONNECT",
];

export function getUSAVehicleType(key: USAVehicleKey): USAVehicleConfig {
  return USA_VEHICLE_TYPES[key];
}

export function getUSAVehiclesByService(serviceType: USAServiceType): USAVehicleConfig[] {
  return USA_VEHICLE_TYPE_ORDER
    .map(key => USA_VEHICLE_TYPES[key])
    .filter(v => v.service_type === serviceType && v.is_enabled);
}

export function getEnabledUSARideVehicles(): USAVehicleConfig[] {
  return getUSAVehiclesByService("ride");
}

export function getEnabledUSAFoodVehicles(): USAVehicleConfig[] {
  return getUSAVehiclesByService("food");
}

export function getEnabledUSAParcelVehicles(): USAVehicleConfig[] {
  return getUSAVehiclesByService("parcel");
}

export function getAllUSAVehicles(): USAVehicleConfig[] {
  return USA_VEHICLE_TYPE_ORDER.map(key => USA_VEHICLE_TYPES[key]);
}

export function isValidUSAVehicleKey(key: string): key is USAVehicleKey {
  return key in USA_VEHICLE_TYPES;
}

export function isPremiumVehicle(key: USAVehicleKey): boolean {
  return USA_VEHICLE_TYPES[key]?.is_premium ?? false;
}

export function requiresPremiumDriver(key: USAVehicleKey): boolean {
  return USA_VEHICLE_TYPES[key]?.requirements?.requires_premium_driver ?? false;
}

export function requiresCityLicense(key: USAVehicleKey): boolean {
  return USA_VEHICLE_TYPES[key]?.requirements?.requires_city_license ?? false;
}

export function getVehicleCityCodes(key: USAVehicleKey): string[] {
  return USA_VEHICLE_TYPES[key]?.requirements?.city_codes ?? [];
}

export interface USAVehicleVisibilityResult {
  isVisible: boolean;
  reason?: string;
}

export function checkVehicleVisibility(
  vehicleKey: USAVehicleKey,
  hasPricingConfigured: boolean,
  userCityCode?: string
): USAVehicleVisibilityResult {
  const vehicle = USA_VEHICLE_TYPES[vehicleKey];
  
  if (!vehicle) {
    return { isVisible: false, reason: "Vehicle type not found" };
  }
  
  if (!vehicle.is_enabled) {
    return { isVisible: false, reason: "Vehicle type is disabled" };
  }
  
  if (!hasPricingConfigured) {
    return { isVisible: false, reason: "Pricing not configured for this vehicle" };
  }
  
  if (vehicle.requirements?.requires_city_license && vehicle.requirements?.city_codes) {
    if (!userCityCode || !vehicle.requirements.city_codes.includes(userCityCode)) {
      return { isVisible: false, reason: "Vehicle not available in your city" };
    }
  }
  
  return { isVisible: true };
}

export interface DriverEligibilityResult {
  isEligible: boolean;
  errors: string[];
  warnings: string[];
}

export function checkDriverEligibility(
  vehicleKey: USAVehicleKey,
  driverProfile: {
    isPremiumCertified?: boolean;
    hasCityTaxiLicense?: boolean;
    cityLicenseCode?: string;
    vehicleYear?: number;
    vehicleMake?: string;
    vehicleExteriorColor?: string;
    vehicleInteriorColor?: string;
    vehicleSeatCount?: number;
    isHybridOrElectric?: boolean;
  }
): DriverEligibilityResult {
  const vehicle = USA_VEHICLE_TYPES[vehicleKey];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!vehicle) {
    return { isEligible: false, errors: ["Vehicle type not found"], warnings: [] };
  }
  
  const reqs = vehicle.requirements;
  
  if (reqs?.requires_premium_driver && !driverProfile.isPremiumCertified) {
    errors.push(`${vehicle.display_name} requires premium driver certification`);
  }
  
  if (reqs?.requires_city_license) {
    if (!driverProfile.hasCityTaxiLicense) {
      errors.push(`${vehicle.display_name} requires a city taxi license`);
    } else if (reqs.city_codes && driverProfile.cityLicenseCode) {
      if (!reqs.city_codes.includes(driverProfile.cityLicenseCode)) {
        errors.push(`Your city license is not valid for ${vehicle.display_name} in this area`);
      }
    }
  }
  
  if (reqs?.min_model_year && driverProfile.vehicleYear) {
    if (driverProfile.vehicleYear < reqs.min_model_year) {
      errors.push(`${vehicle.display_name} requires vehicles from ${reqs.min_model_year} or newer`);
    }
  }
  
  if (reqs?.preferred_brands && reqs.preferred_brands.length > 0 && driverProfile.vehicleMake) {
    if (!reqs.preferred_brands.includes(driverProfile.vehicleMake)) {
      warnings.push(`${vehicle.display_name} typically requires ${reqs.preferred_brands.join(", ")} vehicles`);
    }
  }
  
  if (reqs?.exterior_color && driverProfile.vehicleExteriorColor) {
    if (driverProfile.vehicleExteriorColor.toLowerCase() !== reqs.exterior_color.toLowerCase()) {
      errors.push(`${vehicle.display_name} requires ${reqs.exterior_color} exterior`);
    }
  }
  
  if (reqs?.interior_color && driverProfile.vehicleInteriorColor) {
    if (driverProfile.vehicleInteriorColor.toLowerCase() !== reqs.interior_color.toLowerCase()) {
      errors.push(`${vehicle.display_name} requires ${reqs.interior_color} interior`);
    }
  }
  
  if (reqs?.min_seats && driverProfile.vehicleSeatCount) {
    if (driverProfile.vehicleSeatCount < reqs.min_seats) {
      errors.push(`${vehicle.display_name} requires at least ${reqs.min_seats} seats`);
    }
  }
  
  if (reqs?.is_hybrid_or_electric && !driverProfile.isHybridOrElectric) {
    errors.push(`${vehicle.display_name} requires a hybrid or electric vehicle`);
  }
  
  return {
    isEligible: errors.length === 0,
    errors,
    warnings,
  };
}

export const EMPTY_STATE_MESSAGE_USA = "No vehicles available in your area right now.";
