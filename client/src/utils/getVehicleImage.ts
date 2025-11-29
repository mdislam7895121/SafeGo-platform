/**
 * Vehicle Image Mapping Utility
 * 
 * C7 - Re-exports the vehicle image mapping from the centralized source.
 * This utility provides a consistent API for getting vehicle images by ride type code.
 */

import { 
  getVehicleCategoryImage, 
  VEHICLE_CATEGORY_IMAGES 
} from "@/lib/vehicleMedia";
import type { VehicleCategoryId } from "@shared/vehicleCategories";

export type RideTypeCode = VehicleCategoryId;

/**
 * Get the vehicle image URL for a given ride type code.
 * 
 * @param rideTypeCode - The vehicle category identifier (e.g., "SAFEGO_X", "SAFEGO_COMFORT")
 * @returns The image URL for the corresponding vehicle
 * 
 * @example
 * const imageUrl = getVehicleImage("SAFEGO_X");
 */
export function getVehicleImage(rideTypeCode: RideTypeCode): string {
  return getVehicleCategoryImage(rideTypeCode);
}

export { VEHICLE_CATEGORY_IMAGES };
export default getVehicleImage;
