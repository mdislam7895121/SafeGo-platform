import { DocumentStatus, Vehicle, DriverProfile } from "@prisma/client";

/**
 * Document Status Service
 * Centralizes logic for calculating document statuses based on:
 * - Document presence (URL exists)
 * - Expiry dates (check if expiring soon or expired)
 * - Admin approval status
 */

const EXPIRY_WARNING_DAYS = 30; // Warn if document expires within 30 days

interface DocumentInfo {
  documentUrl: string | null;
  expiryDate: Date | null;
  verificationStatus?: string | null;
}

/**
 * Calculate document status based on canonical signals
 */
export function calculateDocumentStatus(doc: DocumentInfo): DocumentStatus {
  // No document uploaded -> PENDING
  if (!doc.documentUrl) {
    return DocumentStatus.PENDING;
  }

  // Check verification status from admin review
  if (doc.verificationStatus) {
    if (doc.verificationStatus === "rejected") {
      return DocumentStatus.REJECTED;
    }
    if (doc.verificationStatus === "pending" || doc.verificationStatus === "pending_review") {
      return DocumentStatus.UNDER_REVIEW;
    }
    if (doc.verificationStatus === "needs_update") {
      return DocumentStatus.NEEDS_UPDATE;
    }
  }

  // Check expiry date
  if (doc.expiryDate) {
    const now = new Date();
    const expiry = new Date(doc.expiryDate);
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Document expired
    if (daysUntilExpiry < 0) {
      return DocumentStatus.EXPIRED;
    }

    // Document expiring soon (within warning window)
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      return DocumentStatus.EXPIRING_SOON;
    }
  }

  // Document uploaded and valid
  return DocumentStatus.APPROVED;
}

/**
 * Calculate all vehicle document statuses
 */
export function calculateVehicleDocumentStatuses(vehicle: Vehicle) {
  return {
    registrationStatus: calculateDocumentStatus({
      documentUrl: vehicle.registrationDocumentUrl,
      expiryDate: vehicle.registrationExpiry,
      verificationStatus: vehicle.dmvInspectionVerificationStatus, // Shared with general verification
    }),
    insuranceStatus: calculateDocumentStatus({
      documentUrl: vehicle.insuranceDocumentUrl,
      expiryDate: vehicle.insuranceExpiry,
      verificationStatus: vehicle.dmvInspectionVerificationStatus,
    }),
    inspectionStatus: calculateDocumentStatus({
      documentUrl: vehicle.dmvInspectionImageUrl,
      expiryDate: vehicle.dmvInspectionExpiry,
      verificationStatus: vehicle.dmvInspectionVerificationStatus,
    }),
    plateStatus: calculateDocumentStatus({
      documentUrl: vehicle.licensePlate, // License plate is a text field, not a URL
      expiryDate: null,
      verificationStatus: vehicle.licensePlateVerificationStatus,
    }),
    tlcLicenseStatus: vehicle.tlcLicenseNumber
      ? DocumentStatus.APPROVED
      : DocumentStatus.PENDING,
  };
}

/**
 * Check if driver requires TLC compliance based on location
 */
export function requiresTlcCompliance(driverProfile: DriverProfile): boolean {
  const usaCity = driverProfile.usaCity?.toLowerCase() || "";
  const usaState = driverProfile.usaState?.toLowerCase() || "";

  // NYC/TLC jurisdictions (all 5 boroughs + variations)
  const nycKeywords = [
    "new york",
    "nyc",
    "brooklyn",
    "queens",
    "manhattan",
    "bronx",
    "staten island",
  ];

  // Check if city contains NYC keyword and is in NY state
  const isNYCArea = nycKeywords.some(keyword => usaCity.includes(keyword)) && usaState === "ny";

  return isNYCArea;
}

/**
 * Get structured vehicle documents payload for API responses
 */
export function getVehicleDocumentsPayload(vehicle: Vehicle | null, driverProfile: DriverProfile) {
  if (!vehicle) {
    return {
      requiresTlcCompliance: requiresTlcCompliance(driverProfile),
      registration: {
        status: DocumentStatus.PENDING,
        expiryDate: null,
        lastUpdated: null,
        documentUrl: null,
      },
      insurance: {
        status: DocumentStatus.PENDING,
        expiryDate: null,
        lastUpdated: null,
        documentUrl: null,
      },
      inspection: {
        status: DocumentStatus.PENDING,
        expiryDate: null,
        lastUpdated: null,
        documentUrl: null,
      },
      plate: {
        status: DocumentStatus.PENDING,
        plateNumber: null,
        country: null,
        state: null,
      },
      tlcLicense: {
        status: DocumentStatus.PENDING,
        licenseNumber: null,
      },
    };
  }

  const statuses = calculateVehicleDocumentStatuses(vehicle);

  return {
    requiresTlcCompliance: requiresTlcCompliance(driverProfile),
    registration: {
      status: statuses.registrationStatus,
      expiryDate: vehicle.registrationExpiry,
      lastUpdated: vehicle.registrationLastUpdated,
      documentUrl: vehicle.registrationDocumentUrl,
    },
    insurance: {
      status: statuses.insuranceStatus,
      expiryDate: vehicle.insuranceExpiry,
      lastUpdated: vehicle.insuranceLastUpdated,
      documentUrl: vehicle.insuranceDocumentUrl,
    },
    inspection: {
      status: statuses.inspectionStatus,
      expiryDate: vehicle.dmvInspectionExpiry,
      lastUpdated: vehicle.inspectionLastUpdated,
      documentUrl: vehicle.dmvInspectionImageUrl,
    },
    plate: {
      status: statuses.plateStatus,
      plateNumber: vehicle.licensePlate,
      country: vehicle.plateCountry,
      state: vehicle.plateState,
      lastUpdated: vehicle.licensePlateLastUpdated,
      rejectionReason: vehicle.licensePlateRejectionReason,
    },
    tlcLicense: {
      status: statuses.tlcLicenseStatus,
      licenseNumber: vehicle.tlcLicenseNumber,
    },
  };
}
