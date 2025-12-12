/**
 * SafeGo Bangladesh (BD) Vehicle Types Configuration
 * 
 * Global Vehicle Master for Bangladesh market
 * Covers: Ride-hailing, Food Delivery, Parcel Delivery
 * 
 * Rules:
 * - All vehicles are country-scoped (BD only)
 * - Vehicles without pricing config are hidden from customers
 * - Premium vehicles (Executive, Executive SUV) require stricter driver eligibility
 * - City Taxi respects city-specific enable rules (Dhaka, Chittagong, etc.)
 * - BD-specific vehicles: CNG, Rickshaw, Bike, Motorbike, Pickup, Mini Truck
 * - Delivery Bike and Motorbike available for food/parcel delivery
 */

export type BDServiceType = "ride" | "food" | "parcel";

export type BDVehicleKey =
  | "SAFEGO_STANDARD_BD"
  | "SAFEGO_COMFORT_BD"
  | "SAFEGO_ECO_BD"
  | "SAFEGO_FAMILY_BD"
  | "SAFEGO_EXECUTIVE_BD"
  | "SAFEGO_EXECUTIVE_SUV_BD"
  | "SAFEGO_SCHEDULE_BD"
  | "SAFEGO_HOURLY_BD"
  | "SAFEGO_CITY_TAXI_BD"
  | "SAFEGO_CNG"
  | "SAFEGO_RICKSHAW"
  | "SAFEGO_BIKE_RIDE"
  | "SAFEGO_MOTORBIKE_RIDE"
  | "SAFEGO_DELIVERY_BIKE_BD"
  | "SAFEGO_DELIVERY_MOTORBIKE_BD"
  | "SAFEGO_CAR_DELIVERY_BD"
  | "SAFEGO_VAN_DELIVERY_BD"
  | "SAFEGO_PICKUP_DELIVERY"
  | "SAFEGO_MINI_TRUCK"
  | "SAFEGO_CONNECT_BD";

export interface BDVehicleConfig {
  vehicle_key: BDVehicleKey;
  display_name: string;
  description: string;
  short_description: string;
  country: "BD";
  service_type: BDServiceType;
  additional_services?: BDServiceType[];
  capacity: number;
  is_premium: boolean;
  is_time_based: boolean;
  is_scheduled: boolean;
  is_enabled: boolean;
  icon_type: "economy" | "comfort" | "eco" | "family" | "premium" | "suv" | "taxi" | "delivery" | "van" | "express" | "bike" | "motorbike" | "cng" | "rickshaw" | "pickup" | "truck";
  eta_minutes_offset: number;
  sort_order: number;
  vehicle_class: "sedan" | "suv" | "xl" | "taxi" | "eco" | "van" | "car_delivery" | "bike" | "motorbike" | "cng" | "rickshaw" | "pickup" | "mini_truck";
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
  fare_config?: {
    base_fare_bdt: number;
    per_km_bdt: number;
    per_minute_bdt: number;
    minimum_fare_bdt: number;
    waiting_charge_per_min_bdt?: number;
  };
}

export const BD_VEHICLE_TYPES: Record<BDVehicleKey, BDVehicleConfig> = {
  SAFEGO_STANDARD_BD: {
    vehicle_key: "SAFEGO_STANDARD_BD",
    display_name: "SafeGo Standard",
    description: "Reliable everyday rides at affordable prices",
    short_description: "Affordable everyday rides",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "economy",
    eta_minutes_offset: 0,
    sort_order: 1,
    vehicle_class: "sedan",
    requirements: {
      min_model_year: 2010,
    },
    fare_config: {
      base_fare_bdt: 50,
      per_km_bdt: 12,
      per_minute_bdt: 2,
      minimum_fare_bdt: 80,
      waiting_charge_per_min_bdt: 2,
    },
  },

  SAFEGO_COMFORT_BD: {
    vehicle_key: "SAFEGO_COMFORT_BD",
    display_name: "SafeGo Comfort",
    description: "Newer vehicles with AC and extra comfort features",
    short_description: "AC cars with extra comfort",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "comfort",
    eta_minutes_offset: 2,
    sort_order: 2,
    vehicle_class: "sedan",
    requirements: {
      min_model_year: 2015,
    },
    fare_config: {
      base_fare_bdt: 70,
      per_km_bdt: 15,
      per_minute_bdt: 2.5,
      minimum_fare_bdt: 100,
      waiting_charge_per_min_bdt: 2.5,
    },
  },

  SAFEGO_ECO_BD: {
    vehicle_key: "SAFEGO_ECO_BD",
    display_name: "SafeGo Eco",
    description: "Hybrid or electric vehicles for eco-conscious riders",
    short_description: "Hybrid & electric rides",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "eco",
    eta_minutes_offset: 3,
    sort_order: 3,
    vehicle_class: "eco",
    requirements: {
      min_model_year: 2018,
      is_hybrid_or_electric: true,
    },
    fare_config: {
      base_fare_bdt: 60,
      per_km_bdt: 14,
      per_minute_bdt: 2,
      minimum_fare_bdt: 90,
      waiting_charge_per_min_bdt: 2,
    },
  },

  SAFEGO_FAMILY_BD: {
    vehicle_key: "SAFEGO_FAMILY_BD",
    display_name: "SafeGo Family",
    description: "Spacious 6-7 seater vehicles for groups and families",
    short_description: "6-7 seater for groups",
    country: "BD",
    service_type: "ride",
    capacity: 7,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "family",
    eta_minutes_offset: 5,
    sort_order: 4,
    vehicle_class: "xl",
    requirements: {
      min_model_year: 2012,
      min_seats: 6,
    },
    fare_config: {
      base_fare_bdt: 100,
      per_km_bdt: 18,
      per_minute_bdt: 3,
      minimum_fare_bdt: 150,
      waiting_charge_per_min_bdt: 3,
    },
  },

  SAFEGO_EXECUTIVE_BD: {
    vehicle_key: "SAFEGO_EXECUTIVE_BD",
    display_name: "SafeGo Executive",
    description: "Premium cars with professional drivers for business travel",
    short_description: "Premium cars for business",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: true,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "premium",
    eta_minutes_offset: 7,
    sort_order: 5,
    vehicle_class: "sedan",
    requirements: {
      min_model_year: 2018,
      preferred_brands: ["Toyota", "Honda", "Nissan", "BMW", "Mercedes-Benz"],
      requires_premium_driver: true,
    },
    fare_config: {
      base_fare_bdt: 150,
      per_km_bdt: 25,
      per_minute_bdt: 4,
      minimum_fare_bdt: 250,
      waiting_charge_per_min_bdt: 4,
    },
  },

  SAFEGO_EXECUTIVE_SUV_BD: {
    vehicle_key: "SAFEGO_EXECUTIVE_SUV_BD",
    display_name: "SafeGo Executive SUV",
    description: "Luxury SUVs for VIP groups and corporate travel",
    short_description: "Luxury SUVs for groups",
    country: "BD",
    service_type: "ride",
    capacity: 6,
    is_premium: true,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "suv",
    eta_minutes_offset: 10,
    sort_order: 6,
    vehicle_class: "suv",
    requirements: {
      min_model_year: 2018,
      preferred_brands: ["Toyota", "Mitsubishi", "Nissan", "BMW", "Mercedes-Benz"],
      min_seats: 6,
      requires_premium_driver: true,
    },
    fare_config: {
      base_fare_bdt: 200,
      per_km_bdt: 30,
      per_minute_bdt: 5,
      minimum_fare_bdt: 350,
      waiting_charge_per_min_bdt: 5,
    },
  },

  SAFEGO_SCHEDULE_BD: {
    vehicle_key: "SAFEGO_SCHEDULE_BD",
    display_name: "SafeGo Schedule",
    description: "Book rides in advance for guaranteed pickup times",
    short_description: "Advance booking rides",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_scheduled: true,
    is_enabled: true,
    icon_type: "economy",
    eta_minutes_offset: 0,
    sort_order: 7,
    vehicle_class: "sedan",
    requirements: {
      min_model_year: 2012,
    },
    fare_config: {
      base_fare_bdt: 60,
      per_km_bdt: 13,
      per_minute_bdt: 2,
      minimum_fare_bdt: 100,
      waiting_charge_per_min_bdt: 2,
    },
  },

  SAFEGO_HOURLY_BD: {
    vehicle_key: "SAFEGO_HOURLY_BD",
    display_name: "SafeGo Hourly",
    description: "Hire a driver by the hour for flexible travel needs",
    short_description: "Time-based driver hire",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: true,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "comfort",
    eta_minutes_offset: 5,
    sort_order: 8,
    vehicle_class: "sedan",
    requirements: {
      min_model_year: 2012,
    },
    fare_config: {
      base_fare_bdt: 500,
      per_km_bdt: 10,
      per_minute_bdt: 0,
      minimum_fare_bdt: 1000,
      waiting_charge_per_min_bdt: 0,
    },
  },

  SAFEGO_CITY_TAXI_BD: {
    vehicle_key: "SAFEGO_CITY_TAXI_BD",
    display_name: "SafeGo City Taxi",
    description: "City-regulated taxi service with metered fares",
    short_description: "City-regulated taxis",
    country: "BD",
    service_type: "ride",
    capacity: 4,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: false,
    icon_type: "taxi",
    eta_minutes_offset: 3,
    sort_order: 9,
    vehicle_class: "taxi",
    requirements: {
      requires_city_license: true,
      city_codes: ["DAC", "CGP", "SYL", "RAJ"],
    },
    fare_config: {
      base_fare_bdt: 40,
      per_km_bdt: 10,
      per_minute_bdt: 1.5,
      minimum_fare_bdt: 60,
      waiting_charge_per_min_bdt: 1.5,
    },
  },

  SAFEGO_CNG: {
    vehicle_key: "SAFEGO_CNG",
    display_name: "SafeGo CNG",
    description: "Three-wheeler CNG auto-rickshaw for quick city rides",
    short_description: "CNG auto-rickshaw",
    country: "BD",
    service_type: "ride",
    capacity: 3,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "cng",
    eta_minutes_offset: 0,
    sort_order: 10,
    vehicle_class: "cng",
    fare_config: {
      base_fare_bdt: 25,
      per_km_bdt: 8,
      per_minute_bdt: 1,
      minimum_fare_bdt: 40,
      waiting_charge_per_min_bdt: 1,
    },
  },

  SAFEGO_RICKSHAW: {
    vehicle_key: "SAFEGO_RICKSHAW",
    display_name: "SafeGo Rickshaw",
    description: "Traditional cycle rickshaw for short distances",
    short_description: "Cycle rickshaw",
    country: "BD",
    service_type: "ride",
    capacity: 2,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "rickshaw",
    eta_minutes_offset: 0,
    sort_order: 11,
    vehicle_class: "rickshaw",
    fare_config: {
      base_fare_bdt: 15,
      per_km_bdt: 5,
      per_minute_bdt: 0.5,
      minimum_fare_bdt: 20,
      waiting_charge_per_min_bdt: 0.5,
    },
  },

  SAFEGO_BIKE_RIDE: {
    vehicle_key: "SAFEGO_BIKE_RIDE",
    display_name: "SafeGo Bike Ride",
    description: "Quick motorbike ride for single passengers",
    short_description: "Motorbike taxi",
    country: "BD",
    service_type: "ride",
    capacity: 1,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "motorbike",
    eta_minutes_offset: 0,
    sort_order: 12,
    vehicle_class: "motorbike",
    fare_config: {
      base_fare_bdt: 20,
      per_km_bdt: 6,
      per_minute_bdt: 1,
      minimum_fare_bdt: 30,
      waiting_charge_per_min_bdt: 1,
    },
  },

  SAFEGO_MOTORBIKE_RIDE: {
    vehicle_key: "SAFEGO_MOTORBIKE_RIDE",
    display_name: "SafeGo Motorbike",
    description: "Premium motorbike with better comfort",
    short_description: "Premium motorbike ride",
    country: "BD",
    service_type: "ride",
    capacity: 1,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "motorbike",
    eta_minutes_offset: 0,
    sort_order: 13,
    vehicle_class: "motorbike",
    requirements: {
      min_model_year: 2018,
    },
    fare_config: {
      base_fare_bdt: 25,
      per_km_bdt: 7,
      per_minute_bdt: 1,
      minimum_fare_bdt: 40,
      waiting_charge_per_min_bdt: 1,
    },
  },

  SAFEGO_DELIVERY_BIKE_BD: {
    vehicle_key: "SAFEGO_DELIVERY_BIKE_BD",
    display_name: "SafeGo Delivery Bike",
    description: "Bicycle delivery for small food orders",
    short_description: "Bicycle delivery",
    country: "BD",
    service_type: "food",
    additional_services: ["parcel"],
    capacity: 1,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "bike",
    eta_minutes_offset: 0,
    sort_order: 14,
    vehicle_class: "bike",
    fare_config: {
      base_fare_bdt: 20,
      per_km_bdt: 5,
      per_minute_bdt: 0.5,
      minimum_fare_bdt: 30,
    },
  },

  SAFEGO_DELIVERY_MOTORBIKE_BD: {
    vehicle_key: "SAFEGO_DELIVERY_MOTORBIKE_BD",
    display_name: "SafeGo Delivery Motorbike",
    description: "Fast motorbike delivery for food and parcels",
    short_description: "Motorbike delivery",
    country: "BD",
    service_type: "food",
    additional_services: ["parcel"],
    capacity: 2,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "motorbike",
    eta_minutes_offset: 0,
    sort_order: 15,
    vehicle_class: "motorbike",
    requirements: {
      min_model_year: 2015,
    },
    fare_config: {
      base_fare_bdt: 30,
      per_km_bdt: 8,
      per_minute_bdt: 1,
      minimum_fare_bdt: 50,
    },
  },

  SAFEGO_CAR_DELIVERY_BD: {
    vehicle_key: "SAFEGO_CAR_DELIVERY_BD",
    display_name: "SafeGo Car Delivery",
    description: "Standard car delivery for food and small packages",
    short_description: "Car delivery service",
    country: "BD",
    service_type: "food",
    additional_services: ["parcel"],
    capacity: 3,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "delivery",
    eta_minutes_offset: 0,
    sort_order: 16,
    vehicle_class: "car_delivery",
    requirements: {
      min_model_year: 2008,
    },
    fare_config: {
      base_fare_bdt: 50,
      per_km_bdt: 12,
      per_minute_bdt: 1.5,
      minimum_fare_bdt: 80,
    },
  },

  SAFEGO_VAN_DELIVERY_BD: {
    vehicle_key: "SAFEGO_VAN_DELIVERY_BD",
    display_name: "SafeGo Van Delivery",
    description: "Larger van for bulk food orders and catering",
    short_description: "Van for large orders",
    country: "BD",
    service_type: "food",
    additional_services: ["parcel"],
    capacity: 10,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "van",
    eta_minutes_offset: 5,
    sort_order: 17,
    vehicle_class: "van",
    requirements: {
      min_model_year: 2010,
    },
    fare_config: {
      base_fare_bdt: 100,
      per_km_bdt: 20,
      per_minute_bdt: 2,
      minimum_fare_bdt: 150,
    },
  },

  SAFEGO_PICKUP_DELIVERY: {
    vehicle_key: "SAFEGO_PICKUP_DELIVERY",
    display_name: "SafeGo Pickup",
    description: "Pickup truck for medium-sized parcels and goods",
    short_description: "Pickup truck delivery",
    country: "BD",
    service_type: "parcel",
    capacity: 8,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "pickup",
    eta_minutes_offset: 5,
    sort_order: 18,
    vehicle_class: "pickup",
    requirements: {
      min_model_year: 2008,
    },
    fare_config: {
      base_fare_bdt: 150,
      per_km_bdt: 25,
      per_minute_bdt: 2,
      minimum_fare_bdt: 200,
    },
  },

  SAFEGO_MINI_TRUCK: {
    vehicle_key: "SAFEGO_MINI_TRUCK",
    display_name: "SafeGo Mini Truck",
    description: "Mini truck for large parcels and moving services",
    short_description: "Mini truck for large items",
    country: "BD",
    service_type: "parcel",
    capacity: 15,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "truck",
    eta_minutes_offset: 10,
    sort_order: 19,
    vehicle_class: "mini_truck",
    requirements: {
      min_model_year: 2005,
    },
    fare_config: {
      base_fare_bdt: 300,
      per_km_bdt: 40,
      per_minute_bdt: 3,
      minimum_fare_bdt: 500,
    },
  },

  SAFEGO_CONNECT_BD: {
    vehicle_key: "SAFEGO_CONNECT_BD",
    display_name: "SafeGo Connect",
    description: "Same-day parcel delivery with real-time tracking",
    short_description: "Same-day parcel delivery",
    country: "BD",
    service_type: "parcel",
    capacity: 5,
    is_premium: false,
    is_time_based: false,
    is_scheduled: false,
    is_enabled: true,
    icon_type: "express",
    eta_minutes_offset: 2,
    sort_order: 20,
    vehicle_class: "car_delivery",
    requirements: {
      min_model_year: 2010,
    },
    fare_config: {
      base_fare_bdt: 80,
      per_km_bdt: 15,
      per_minute_bdt: 0,
      minimum_fare_bdt: 100,
    },
  },
};

export const BD_VEHICLE_TYPE_ORDER: BDVehicleKey[] = [
  "SAFEGO_STANDARD_BD",
  "SAFEGO_COMFORT_BD",
  "SAFEGO_ECO_BD",
  "SAFEGO_FAMILY_BD",
  "SAFEGO_EXECUTIVE_BD",
  "SAFEGO_EXECUTIVE_SUV_BD",
  "SAFEGO_SCHEDULE_BD",
  "SAFEGO_HOURLY_BD",
  "SAFEGO_CITY_TAXI_BD",
  "SAFEGO_CNG",
  "SAFEGO_RICKSHAW",
  "SAFEGO_BIKE_RIDE",
  "SAFEGO_MOTORBIKE_RIDE",
  "SAFEGO_DELIVERY_BIKE_BD",
  "SAFEGO_DELIVERY_MOTORBIKE_BD",
  "SAFEGO_CAR_DELIVERY_BD",
  "SAFEGO_VAN_DELIVERY_BD",
  "SAFEGO_PICKUP_DELIVERY",
  "SAFEGO_MINI_TRUCK",
  "SAFEGO_CONNECT_BD",
];

export function getBDVehicleType(key: BDVehicleKey): BDVehicleConfig {
  return BD_VEHICLE_TYPES[key];
}

export function getBDVehiclesByService(serviceType: BDServiceType): BDVehicleConfig[] {
  return BD_VEHICLE_TYPE_ORDER
    .map(key => BD_VEHICLE_TYPES[key])
    .filter(v => {
      if (!v.is_enabled) return false;
      if (v.service_type === serviceType) return true;
      if (v.additional_services?.includes(serviceType)) return true;
      return false;
    });
}

export function getEnabledBDRideVehicles(): BDVehicleConfig[] {
  return getBDVehiclesByService("ride");
}

export function getEnabledBDFoodVehicles(): BDVehicleConfig[] {
  return getBDVehiclesByService("food");
}

export function getEnabledBDParcelVehicles(): BDVehicleConfig[] {
  return getBDVehiclesByService("parcel");
}

export function getAllBDVehicles(): BDVehicleConfig[] {
  return BD_VEHICLE_TYPE_ORDER.map(key => BD_VEHICLE_TYPES[key]);
}

export function isValidBDVehicleKey(key: string): key is BDVehicleKey {
  return key in BD_VEHICLE_TYPES;
}

export function isPremiumBDVehicle(key: BDVehicleKey): boolean {
  return BD_VEHICLE_TYPES[key]?.is_premium ?? false;
}

export function requiresPremiumBDDriver(key: BDVehicleKey): boolean {
  return BD_VEHICLE_TYPES[key]?.requirements?.requires_premium_driver ?? false;
}

export function requiresBDCityLicense(key: BDVehicleKey): boolean {
  return BD_VEHICLE_TYPES[key]?.requirements?.requires_city_license ?? false;
}

export function getBDVehicleCityCodes(key: BDVehicleKey): string[] {
  return BD_VEHICLE_TYPES[key]?.requirements?.city_codes ?? [];
}

export interface BDVehicleVisibilityResult {
  isVisible: boolean;
  reason?: string;
}

export function checkBDVehicleVisibility(
  vehicleKey: BDVehicleKey,
  hasPricingConfigured: boolean,
  userCityCode?: string
): BDVehicleVisibilityResult {
  const vehicle = BD_VEHICLE_TYPES[vehicleKey];
  
  if (!vehicle) {
    return { isVisible: false, reason: "Vehicle type not found" };
  }
  
  if (!vehicle.is_enabled) {
    return { isVisible: false, reason: "Vehicle type is disabled" };
  }
  
  if (!hasPricingConfigured && !vehicle.fare_config) {
    return { isVisible: false, reason: "Pricing not configured for this vehicle" };
  }
  
  if (vehicle.requirements?.requires_city_license && vehicle.requirements?.city_codes) {
    if (!userCityCode || !vehicle.requirements.city_codes.includes(userCityCode)) {
      return { isVisible: false, reason: "Vehicle not available in your city" };
    }
  }
  
  return { isVisible: true };
}

export interface BDDriverEligibilityResult {
  isEligible: boolean;
  errors: string[];
  warnings: string[];
}

export function checkBDDriverEligibility(
  vehicleKey: BDVehicleKey,
  driverProfile: {
    isPremiumCertified?: boolean;
    hasCityTaxiLicense?: boolean;
    cityLicenseCode?: string;
    vehicleYear?: number;
    vehicleMake?: string;
    vehicleSeatCount?: number;
    isHybridOrElectric?: boolean;
  }
): BDDriverEligibilityResult {
  const vehicle = BD_VEHICLE_TYPES[vehicleKey];
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

export const EMPTY_STATE_MESSAGE_BD_RIDE = "No ride options available right now.";
export const EMPTY_STATE_MESSAGE_BD_FOOD = "Delivery is not available in your area right now.";
export const EMPTY_STATE_MESSAGE_BD_PARCEL = "Parcel delivery is not available in your area right now.";
