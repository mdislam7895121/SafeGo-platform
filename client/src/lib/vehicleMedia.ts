/**
 * Vehicle Media Mapping
 * 
 * C7-FIX - Maps vehicle category IDs to their corresponding high-quality 3D images.
 * Uses professional 3D left-angle renders with white backgrounds.
 */

import safegoXImage from "@assets/generated_images/safego_x_sedan_3d_render.png";
import safegoComfortImage from "@assets/generated_images/safego_comfort_sedan_3d_render.png";
import safegoComfortXLImage from "@assets/generated_images/safego_comfort_xl_suv_3d_render.png";
import safegoXLImage from "@assets/generated_images/safego_xl_minivan_3d_render.png";
import safegoBlackImage from "@assets/generated_images/safego_black_luxury_sedan_3d_render.png";
import safegoBlackSUVImage from "@assets/generated_images/safego_black_suv_luxury_3d_render.png";
import safegoWAVImage from "@assets/generated_images/safego_wav_accessible_van_3d_render.png";

import type { VehicleCategoryId } from "@shared/vehicleCategories";

/**
 * Mapping of vehicle category IDs to their image paths
 * 
 * All images feature:
 * - Front-left ¾ angle view (3D perspective)
 * - Slightly elevated camera (roof visible)
 * - Clean white background
 * - Soft shadow under vehicle
 * - Consistent aspect ratio and sizing
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
