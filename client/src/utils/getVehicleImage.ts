/**
 * Vehicle Image Mapping Utility
 * 
 * C7 - Maps ride type codes to their corresponding 3D vehicle images.
 * All images use Uber-style front-left ¾ angle renders with white backgrounds.
 */

import safegoXSedan from "@assets/generated_images/safego_x_standard_sedan.png";
import safegoComfortSedan from "@assets/generated_images/safego_comfort_premium_sedan.png";
import safegoComfortXLSuv from "@assets/generated_images/safego_comfort_xl_suv.png";
import safegoXLMinivan from "@assets/generated_images/safego_xl_minivan.png";
import safegoBlackSedan from "@assets/generated_images/safego_black_luxury_sedan.png";
import safegoBlackSuv from "@assets/generated_images/safego_black_suv_luxury.png";
import safegoWavVan from "@assets/generated_images/safego_wav_accessible_van.png";

export type RideTypeCode = 
  | "SAFEGO_X"
  | "SAFEGO_COMFORT"
  | "SAFEGO_COMFORT_XL"
  | "SAFEGO_XL"
  | "SAFEGO_BLACK"
  | "SAFEGO_BLACK_SUV"
  | "SAFEGO_WAV";

const VEHICLE_IMAGE_MAP: Record<RideTypeCode, string> = {
  SAFEGO_X: safegoXSedan,
  SAFEGO_COMFORT: safegoComfortSedan,
  SAFEGO_COMFORT_XL: safegoComfortXLSuv,
  SAFEGO_XL: safegoXLMinivan,
  SAFEGO_BLACK: safegoBlackSedan,
  SAFEGO_BLACK_SUV: safegoBlackSuv,
  SAFEGO_WAV: safegoWavVan,
};

/**
 * Get the vehicle image URL for a given ride type code.
 * 
 * @param rideTypeCode - The vehicle category identifier (e.g., "SAFEGO_X", "SAFEGO_COMFORT")
 * @returns The image URL for the corresponding vehicle
 * 
 * @example
 * const imageUrl = getVehicleImage("SAFEGO_X");
 * // Returns: path to safego-x-sedan.png
 */
export function getVehicleImage(rideTypeCode: RideTypeCode): string {
  return VEHICLE_IMAGE_MAP[rideTypeCode];
}

export default getVehicleImage;
