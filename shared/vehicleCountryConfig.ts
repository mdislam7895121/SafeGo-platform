/**
 * SafeGo Vehicle Country Configuration
 * 
 * Centralized country-based vehicle filtering and visibility rules.
 * Ensures vehicles are only shown to users in their respective countries.
 */

import { USA_VEHICLE_TYPES, USAVehicleKey, USAVehicleConfig, getUSAVehiclesByService, getAllUSAVehicles, EMPTY_STATE_MESSAGE_USA } from "./vehicleTypesUSA";
import { VEHICLE_CATEGORIES, VehicleCategoryId, VehicleCategoryConfig, getActiveVehicleCategories } from "./vehicleCategories";

export type SupportedCountry = "US" | "BD";
export type ServiceType = "ride" | "food" | "parcel";

export interface VehicleDisplayItem {
  vehicle_key: string;
  display_name: string;
  short_description: string;
  capacity: number;
  is_premium: boolean;
  icon_type: string;
  eta_minutes_offset: number;
  sort_order: number;
  country: SupportedCountry;
  service_type: ServiceType;
  minimum_fare?: number;
}

export interface CountryVehicleListResult {
  vehicles: VehicleDisplayItem[];
  country: SupportedCountry;
  service_type: ServiceType;
  empty_state_message: string;
}

function mapUSAVehicleToDisplay(v: USAVehicleConfig): VehicleDisplayItem {
  return {
    vehicle_key: v.vehicle_key,
    display_name: v.display_name,
    short_description: v.short_description,
    capacity: v.capacity,
    is_premium: v.is_premium,
    icon_type: v.icon_type,
    eta_minutes_offset: v.eta_minutes_offset,
    sort_order: v.sort_order,
    country: "US",
    service_type: v.service_type,
    minimum_fare: v.fare_multipliers?.minimum_fare,
  };
}

function mapBDVehicleCategoryToDisplay(v: VehicleCategoryConfig): VehicleDisplayItem {
  return {
    vehicle_key: v.id,
    display_name: v.displayName,
    short_description: v.shortDescription,
    capacity: v.seatCount,
    is_premium: ["SAFEGO_BLACK", "SAFEGO_BLACK_SUV"].includes(v.id),
    icon_type: v.iconType,
    eta_minutes_offset: v.etaMinutesOffset,
    sort_order: v.sortOrder,
    country: "BD",
    service_type: "ride",
    minimum_fare: v.minimumFare,
  };
}

export function getVehiclesForCountry(
  countryCode: SupportedCountry,
  serviceType: ServiceType,
  pricingConfiguredKeys?: Set<string>,
  userCityCode?: string
): CountryVehicleListResult {
  let vehicles: VehicleDisplayItem[] = [];
  let emptyStateMessage = "No vehicles available in your area right now.";

  if (countryCode === "US") {
    const usaVehicles = getUSAVehiclesByService(serviceType);
    vehicles = usaVehicles
      .filter(v => {
        if (!v.is_enabled) return false;
        if (pricingConfiguredKeys && !pricingConfiguredKeys.has(v.vehicle_key)) return false;
        if (v.requirements?.requires_city_license && v.requirements?.city_codes) {
          if (!userCityCode || !v.requirements.city_codes.includes(userCityCode)) return false;
        }
        return true;
      })
      .map(mapUSAVehicleToDisplay);
    emptyStateMessage = EMPTY_STATE_MESSAGE_USA;
  } else if (countryCode === "BD") {
    if (serviceType === "ride") {
      const bdCategories = getActiveVehicleCategories();
      vehicles = bdCategories
        .filter(v => {
          if (pricingConfiguredKeys && !pricingConfiguredKeys.has(v.id)) return false;
          return true;
        })
        .map(mapBDVehicleCategoryToDisplay);
    }
    emptyStateMessage = "No vehicles available in your area right now.";
  }

  return {
    vehicles,
    country: countryCode,
    service_type: serviceType,
    empty_state_message: emptyStateMessage,
  };
}

export function getVehicleKeysByCountry(countryCode: SupportedCountry): string[] {
  if (countryCode === "US") {
    return Object.keys(USA_VEHICLE_TYPES);
  } else if (countryCode === "BD") {
    return Object.keys(VEHICLE_CATEGORIES);
  }
  return [];
}

export function isValidVehicleKeyForCountry(vehicleKey: string, countryCode: SupportedCountry): boolean {
  if (countryCode === "US") {
    return vehicleKey in USA_VEHICLE_TYPES;
  } else if (countryCode === "BD") {
    return vehicleKey in VEHICLE_CATEGORIES;
  }
  return false;
}

export function getVehicleDisplayName(vehicleKey: string, countryCode: SupportedCountry): string | null {
  if (countryCode === "US" && vehicleKey in USA_VEHICLE_TYPES) {
    return USA_VEHICLE_TYPES[vehicleKey as USAVehicleKey].display_name;
  }
  if (countryCode === "BD" && vehicleKey in VEHICLE_CATEGORIES) {
    return VEHICLE_CATEGORIES[vehicleKey as VehicleCategoryId].displayName;
  }
  return null;
}

export const EXCLUDED_VEHICLE_TYPES_BY_COUNTRY: Record<SupportedCountry, string[]> = {
  US: ["CNG", "RICKSHAW"],
  BD: [],
};

const ALLOWED_DELIVERY_VEHICLES = ["SAFEGO_DELIVERY_BIKE", "SAFEGO_DELIVERY_MOTORBIKE"];

export function isExcludedVehicleType(vehicleType: string, countryCode: SupportedCountry): boolean {
  if (ALLOWED_DELIVERY_VEHICLES.includes(vehicleType.toUpperCase())) {
    return false;
  }
  const excluded = EXCLUDED_VEHICLE_TYPES_BY_COUNTRY[countryCode] || [];
  return excluded.some(e => vehicleType.toUpperCase().includes(e));
}
