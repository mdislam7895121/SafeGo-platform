/**
 * Vehicle Media Mapping
 * 
 * C7-FIX - Maps vehicle category IDs to their corresponding high-quality 3D images.
 * Uses professional 3D left-angle renders with white backgrounds.
 */

import placeholderImage from "@assets/generated_images/placeholder.svg";

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
  SAFEGO_X: placeholderImage,
  SAFEGO_COMFORT: placeholderImage,
  SAFEGO_COMFORT_XL: placeholderImage,
  SAFEGO_XL: placeholderImage,
  SAFEGO_BLACK: placeholderImage,
  SAFEGO_BLACK_SUV: placeholderImage,
  SAFEGO_WAV: placeholderImage,
};

/**
 * Get the vehicle image URL for a given category ID
 * @param categoryId - The vehicle category identifier
 * @returns The image URL for the vehicle category
 */
export function getVehicleCategoryImage(categoryId: VehicleCategoryId): string {
  return VEHICLE_CATEGORY_IMAGES[categoryId];
}
