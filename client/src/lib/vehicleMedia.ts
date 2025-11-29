import safegoXImage from "@assets/generated_images/safego_x_standard_sedan.png";
import safegoComfortImage from "@assets/generated_images/safego_comfort_sedan.png";
import safegoComfortXLImage from "@assets/generated_images/safego_comfort_xl_suv.png";
import safegoXLImage from "@assets/generated_images/safego_xl_minivan.png";
import safegoBlackImage from "@assets/generated_images/safego_black_executive_sedan.png";
import safegoBlackSUVImage from "@assets/generated_images/safego_black_suv_luxury.png";
import safegoWAVImage from "@assets/generated_images/safego_wav_accessible_vehicle.png";

import type { VehicleCategoryId } from "@shared/vehicleCategories";

export const VEHICLE_CATEGORY_IMAGES: Record<VehicleCategoryId, string> = {
  SAFEGO_X: safegoXImage,
  SAFEGO_COMFORT: safegoComfortImage,
  SAFEGO_COMFORT_XL: safegoComfortXLImage,
  SAFEGO_XL: safegoXLImage,
  SAFEGO_BLACK: safegoBlackImage,
  SAFEGO_BLACK_SUV: safegoBlackSUVImage,
  SAFEGO_WAV: safegoWAVImage,
};

export function getVehicleCategoryImage(categoryId: VehicleCategoryId): string {
  return VEHICLE_CATEGORY_IMAGES[categoryId];
}
