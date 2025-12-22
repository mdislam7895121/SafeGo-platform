export type Role = "CUSTOMER" | "DRIVER" | "RESTAURANT" | "ADMIN";
export type Country = "BD" | "US" | "GLOBAL";
export type ServiceScope = "RIDE" | "FOOD" | "PARCEL" | "ALL";

export interface SafePilotUser {
  id: string;
  role: Role;
  country: Country;
}

export function canUseAdminKB(role: Role): boolean {
  return role === "ADMIN";
}

export function canAccessDocument(
  userRole: Role,
  userCountry: Country,
  docRoleScope: Role | "ALL",
  docCountryScope: Country | "GLOBAL",
  docServiceScope: ServiceScope,
  requestedService: ServiceScope
): boolean {
  const roleMatch = docRoleScope === "ALL" || docRoleScope === userRole;
  const countryMatch = docCountryScope === "GLOBAL" || docCountryScope === userCountry;
  const serviceMatch = docServiceScope === "ALL" || docServiceScope === requestedService || requestedService === "ALL";
  
  return roleMatch && countryMatch && serviceMatch;
}

export function sanitizeSourcesForRole(
  role: Role,
  sources: Array<{ id: string; title: string; chunkText?: string }>
): Array<{ id: string; title: string }> {
  return sources.map((s) => ({ id: s.id, title: s.title }));
}

export function getToolPermissions(role: Role): {
  canReadOwnData: boolean;
  canReadAllData: boolean;
  canManageKB: boolean;
  canViewDocuments: boolean;
  restrictedFields: string[];
  allowedTools: string[];
} {
  switch (role) {
    case "ADMIN":
      return {
        canReadOwnData: true,
        canReadAllData: true,
        canManageKB: true,
        canViewDocuments: true,
        restrictedFields: [],
        allowedTools: [
          "read_ride_status",
          "read_order_status",
          "read_delivery_status",
          "read_verification_status",
          "read_wallet",
          "read_all_users",
          "read_platform_metrics",
        ],
      };
    case "CUSTOMER":
      return {
        canReadOwnData: true,
        canReadAllData: false,
        canManageKB: false,
        canViewDocuments: false,
        restrictedFields: ["driverNid", "driverLicense", "restaurantDocuments"],
        allowedTools: [
          "read_ride_status",
          "read_order_status",
          "read_delivery_status",
          "read_verification_status",
        ],
      };
    case "DRIVER":
      return {
        canReadOwnData: true,
        canReadAllData: false,
        canManageKB: false,
        canViewDocuments: false,
        restrictedFields: ["customerNid", "customerGovernmentId", "restaurantDocuments"],
        allowedTools: [
          "read_ride_status",
          "read_order_status",
          "read_delivery_status",
          "read_verification_status",
          "read_wallet",
        ],
      };
    case "RESTAURANT":
      return {
        canReadOwnData: true,
        canReadAllData: false,
        canManageKB: false,
        canViewDocuments: false,
        restrictedFields: ["customerNid", "driverNid", "otherRestaurantData"],
        allowedTools: [
          "read_order_status",
          "read_verification_status",
          "read_wallet",
        ],
      };
    default:
      return {
        canReadOwnData: false,
        canReadAllData: false,
        canManageKB: false,
        canViewDocuments: false,
        restrictedFields: ["*"],
        allowedTools: [],
      };
  }
}

export function getCountryRules(country: Country): {
  kycFields: string[];
  paymentMethods: string[];
  currency: string;
  regulations: string[];
} {
  switch (country) {
    case "BD":
      return {
        kycFields: [
          "father_name",
          "date_of_birth",
          "present_address",
          "permanent_address",
          "nid_number",
          "nid_front_image",
          "nid_back_image",
          "emergency_contact",
        ],
        paymentMethods: ["cash", "bkash", "nagad", "sslcommerz"],
        currency: "BDT",
        regulations: [
          "NID verification required for all users",
          "Maximum cash transaction limits apply",
          "bKash/Nagad integration available",
        ],
      };
    case "US":
      return {
        kycFields: [
          "date_of_birth",
          "home_address",
          "emergency_contact",
          "government_id_type",
          "government_id_last4",
          "driver_license",
          "ssn_last4",
        ],
        paymentMethods: ["card", "stripe", "paypal"],
        currency: "USD",
        regulations: [
          "State-specific driver licensing requirements",
          "Background check required for drivers",
          "Facial recognition verification available",
        ],
      };
    default:
      return {
        kycFields: ["date_of_birth", "government_id", "emergency_contact"],
        paymentMethods: ["card", "cash"],
        currency: "USD",
        regulations: ["Standard KYC requirements apply"],
      };
  }
}

export function validatePrivacyRequest(
  requesterRole: Role,
  targetRole: Role,
  requestedData: string[]
): { allowed: boolean; blockedFields: string[] } {
  const permissions = getToolPermissions(requesterRole);
  const blockedFields = requestedData.filter((field) =>
    permissions.restrictedFields.some(
      (restricted) => restricted === "*" || field.toLowerCase().includes(restricted.toLowerCase())
    )
  );

  return {
    allowed: blockedFields.length === 0,
    blockedFields,
  };
}
