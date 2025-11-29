/**
 * Vehicle Media Mapping
 * 
 * C7 - Maps vehicle category IDs to their corresponding high-quality images.
 * Uses Uber-style clean white background vehicle photography.
 */

import safegoXImage from "@assets/generated_images/safego_x_standard_sedan.png";
import safegoComfortImage from "@assets/generated_images/safego_comfort_premium_sedan.png";
import safegoComfortXLImage from "@assets/generated_images/safego_comfort_xl_suv.png";
import safegoXLImage from "@assets/generated_images/safego_xl_minivan.png";
import safegoBlackImage from "@assets/generated_images/safego_black_luxury_sedan.png";
import safegoBlackSUVImage from "@assets/generated_images/safego_black_suv_luxury.png";
import safegoWAVImage from "@assets/generated_images/safego_wav_accessible_van.png";

import type { VehicleCategoryId } from "@shared/vehicleCategories";

/**
 * Mapping of vehicle category IDs to their image paths
 * 
 * SAFEGO_X → Standard everyday sedan
 * SAFEGO_COMFORT → Premium comfort sedan  
 * SAFEGO_COMFORT_XL → Midsize SUV crossover
 * SAFEGO_XL → Spacious minivan
 * SAFEGO_BLACK → Luxury executive black sedan
 * SAFEGO_BLACK_SUV → Luxury black SUV
 * SAFEGO_WAV → Wheelchair accessible vehicle
 */
export const VEHICLE_CATEGORY_IMAGES: Record<VehicleCategoryId, string> = {
  SAFEGO_X: safegoXImage,
  SAFEGO_COMFORT: safegoComfortImage,
  SAFEGO_COMFORT_XL: safegoComfortXLImage,
  SAFEGO_XL: safegoXLImage,
  SAFEGO_BLACK: safegoBlackImage,
  SAFEGO_BLACK_SUV: safegoBlackSUVImage,
  SAFEGO_WAV: safegoWAVImage,
};

/**
 * Get the vehicle image URL for a given category ID
 * @param categoryId - The vehicle category identifier
 * @returns The image URL for the vehicle category
 */
export function getVehicleCategoryImage(categoryId: VehicleCategoryId): string {
  return VEHICLE_CATEGORY_IMAGES[categoryId];
}
