import { RestaurantProfile } from "@prisma/client";

export interface KYCValidationResult {
  isComplete: boolean;
  missingFields: string[];
  countryCode: string | null;
}

/**
 * Validates restaurant KYC completion based on country-specific requirements
 * BD (Bangladesh): fatherName, nidNumber, presentAddress
 * US (United States): governmentIdType, homeAddress
 */
export function validateRestaurantKYC(profile: RestaurantProfile): KYCValidationResult {
  const countryCode = profile.countryCode;
  const missingFields: string[] = [];

  if (!countryCode) {
    return {
      isComplete: false,
      missingFields: ["countryCode"],
      countryCode: null,
    };
  }

  if (countryCode === "BD") {
    // Bangladesh requirements
    if (!profile.fatherName) missingFields.push("fatherName");
    if (!profile.nidNumber) missingFields.push("nidNumber");
    if (!profile.presentAddress) missingFields.push("presentAddress");
  } else if (countryCode === "US") {
    // United States requirements
    if (!profile.governmentIdType) missingFields.push("governmentIdType");
    if (!profile.homeAddress) missingFields.push("homeAddress");
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    countryCode,
  };
}

/**
 * Gets human-readable field names for KYC requirements
 */
export function getKYCFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    fatherName: "Father's Name",
    nidNumber: "National ID Number",
    presentAddress: "Present Address",
    governmentIdType: "Government ID Type",
    homeAddress: "Home Address",
    countryCode: "Country Code",
  };
  return labels[field] || field;
}

/**
 * Gets KYC requirements by country
 */
export function getKYCRequirements(countryCode: string): string[] {
  if (countryCode === "BD") {
    return ["fatherName", "nidNumber", "presentAddress"];
  } else if (countryCode === "US") {
    return ["governmentIdType", "homeAddress"];
  }
  return [];
}
