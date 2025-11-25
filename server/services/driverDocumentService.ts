import { PrismaClient, DocumentStatus } from "@prisma/client";

const prisma = new PrismaClient();

type DriverWithDocs = any;

export interface DocumentInfo {
  id: string;
  type: string;
  label: string;
  status: DocumentStatus;
  fileUrl: string | null;
  expiresAt: Date | null;
  rejectionReason: string | null;
  required: boolean;
  uploadedAt?: Date;
}

export interface DriverDocumentSummary {
  driverId: string;
  countryCode: string;
  documents: DocumentInfo[];
  overallStatus: "incomplete" | "pending_review" | "approved" | "rejected" | "needs_update";
  completedCount: number;
  requiredCount: number;
  pendingCount: number;
  rejectedCount: number;
}

const DOCUMENT_TYPES = {
  PROFILE_PHOTO: { id: "profile_photo", label: "Profile Photo", allCountries: true },
  DRIVER_LICENSE: { id: "driver_license", label: "Driver License", countries: ["US"] },
  TLC_LICENSE: { id: "tlc_license", label: "TLC License", states: ["NY"] },
  NID: { id: "nid", label: "National ID (NID)", countries: ["BD"] },
  INSURANCE: { id: "insurance", label: "Insurance Document", allCountries: true },
  REGISTRATION: { id: "registration", label: "Vehicle Registration", allCountries: true },
  VEHICLE_INSPECTION: { id: "vehicle_inspection", label: "Vehicle Inspection", countries: ["US"] },
} as const;

export async function getDriverDocumentSummary(
  driverId: string
): Promise<DriverDocumentSummary | null> {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    include: {
      user: { select: { countryCode: true } },
      vehicleDocuments: {
        orderBy: { uploadedAt: "desc" },
      },
      vehicles: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  }) as DriverWithDocs;

  if (!driver) return null;

  const countryCode = driver.user.countryCode;
  const usaState = driver.usaState;
  const isUSA = countryCode === "US";
  const isBD = countryCode === "BD";
  const isNY = usaState === "NY";
  const primaryVehicle = driver.vehicles?.[0];

  const documents: DocumentInfo[] = [];

  documents.push({
    id: "profile_photo",
    type: DOCUMENT_TYPES.PROFILE_PHOTO.id,
    label: DOCUMENT_TYPES.PROFILE_PHOTO.label,
    status: driver.profilePhotoStatus || "PENDING",
    fileUrl: driver.profilePhotoUrl,
    expiresAt: null,
    rejectionReason: driver.profilePhotoRejectionReason || null,
    required: true,
  });

  if (isUSA) {
    documents.push({
      id: "driver_license",
      type: DOCUMENT_TYPES.DRIVER_LICENSE.id,
      label: DOCUMENT_TYPES.DRIVER_LICENSE.label,
      status: driver.driverLicenseStatus || "PENDING",
      fileUrl: driver.dmvLicenseFrontUrl || driver.dmvLicenseImageUrl,
      expiresAt: driver.dmvLicenseExpiry,
      rejectionReason: driver.driverLicenseRejectionReason || null,
      required: true,
    });

    if (isNY) {
      documents.push({
        id: "tlc_license",
        type: DOCUMENT_TYPES.TLC_LICENSE.id,
        label: DOCUMENT_TYPES.TLC_LICENSE.label,
        status: driver.tlcLicenseDocStatus || "PENDING",
        fileUrl: driver.tlcLicenseFrontUrl || driver.tlcLicenseImageUrl,
        expiresAt: driver.tlcLicenseExpiry,
        rejectionReason: driver.tlcLicenseRejectionReason || null,
        required: true,
      });
    }
  }

  if (isBD) {
    documents.push({
      id: "nid",
      type: DOCUMENT_TYPES.NID.id,
      label: DOCUMENT_TYPES.NID.label,
      status: driver.nidStatus || "PENDING",
      fileUrl: driver.nidFrontImageUrl || driver.nidImageUrl,
      expiresAt: null,
      rejectionReason: driver.nidRejectionReason || null,
      required: true,
    });
  }

  if (primaryVehicle) {
    documents.push({
      id: "insurance",
      type: DOCUMENT_TYPES.INSURANCE.id,
      label: DOCUMENT_TYPES.INSURANCE.label,
      status: primaryVehicle.insuranceStatus || "PENDING",
      fileUrl: primaryVehicle.insuranceDocumentUrl,
      expiresAt: primaryVehicle.insuranceExpiry,
      rejectionReason: null,
      required: true,
    });

    documents.push({
      id: "registration",
      type: DOCUMENT_TYPES.REGISTRATION.id,
      label: DOCUMENT_TYPES.REGISTRATION.label,
      status: primaryVehicle.registrationStatus || "PENDING",
      fileUrl: primaryVehicle.registrationDocumentUrl,
      expiresAt: primaryVehicle.registrationExpiry,
      rejectionReason: null,
      required: true,
    });

    if (isUSA) {
      documents.push({
        id: "vehicle_inspection",
        type: DOCUMENT_TYPES.VEHICLE_INSPECTION.id,
        label: DOCUMENT_TYPES.VEHICLE_INSPECTION.label,
        status: primaryVehicle.inspectionStatus || "PENDING",
        fileUrl: primaryVehicle.dmvInspectionImageUrl,
        expiresAt: primaryVehicle.dmvInspectionExpiry,
        rejectionReason: primaryVehicle.dmvInspectionRejectionReason || null,
        required: true,
      });
    }
  }

  for (const doc of driver.vehicleDocuments || []) {
    const existing = documents.find((d: DocumentInfo) => d.type === doc.documentType);
    if (!existing) {
      documents.push({
        id: doc.id,
        type: doc.documentType,
        label: doc.documentType.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        status: doc.status || "PENDING",
        fileUrl: doc.fileUrl,
        expiresAt: doc.expiresAt,
        rejectionReason: doc.rejectionReason || null,
        required: false,
        uploadedAt: doc.uploadedAt,
      });
    }
  }

  const requiredDocs = documents.filter(d => d.required);
  const completedCount = requiredDocs.filter(d => d.status === "APPROVED").length;
  const pendingCount = requiredDocs.filter(d => 
    d.status === "PENDING" || d.status === "UNDER_REVIEW"
  ).length;
  const rejectedCount = requiredDocs.filter(d => d.status === "REJECTED").length;

  let overallStatus: DriverDocumentSummary["overallStatus"];
  if (rejectedCount > 0) {
    overallStatus = "rejected";
  } else if (requiredDocs.some(d => d.status === "NEEDS_UPDATE")) {
    overallStatus = "needs_update";
  } else if (completedCount === requiredDocs.length && requiredDocs.length > 0) {
    overallStatus = "approved";
  } else if (pendingCount > 0) {
    overallStatus = "pending_review";
  } else {
    overallStatus = "incomplete";
  }

  return {
    driverId,
    countryCode,
    documents,
    overallStatus,
    completedCount,
    requiredCount: requiredDocs.length,
    pendingCount,
    rejectedCount,
  };
}

export async function updateDocumentStatus(
  driverId: string,
  documentType: string,
  status: DocumentStatus,
  adminId: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        vehicles: { where: { isPrimary: true }, take: 1 },
      },
    });

    if (!driver) {
      return { success: false, error: "Driver not found" };
    }

    const primaryVehicle = driver.vehicles[0];
    const updateData: any = {};

    switch (documentType) {
      case "profile_photo":
        updateData.profilePhotoStatus = status;
        updateData.profilePhotoRejectionReason = rejectionReason || null;
        await prisma.driverProfile.update({
          where: { id: driverId },
          data: updateData,
        });
        break;

      case "driver_license":
        updateData.driverLicenseStatus = status;
        updateData.driverLicenseRejectionReason = rejectionReason || null;
        await prisma.driverProfile.update({
          where: { id: driverId },
          data: updateData,
        });
        break;

      case "tlc_license":
        updateData.tlcLicenseDocStatus = status;
        updateData.tlcLicenseRejectionReason = rejectionReason || null;
        await prisma.driverProfile.update({
          where: { id: driverId },
          data: updateData,
        });
        break;

      case "nid":
        updateData.nidStatus = status;
        updateData.nidRejectionReason = rejectionReason || null;
        await prisma.driverProfile.update({
          where: { id: driverId },
          data: updateData,
        });
        break;

      case "insurance":
        if (!primaryVehicle) {
          return { success: false, error: "No primary vehicle found" };
        }
        await prisma.vehicle.update({
          where: { id: primaryVehicle.id },
          data: {
            insuranceStatus: status,
            insuranceLastUpdated: new Date(),
          },
        });
        break;

      case "registration":
        if (!primaryVehicle) {
          return { success: false, error: "No primary vehicle found" };
        }
        await prisma.vehicle.update({
          where: { id: primaryVehicle.id },
          data: {
            registrationStatus: status,
            registrationLastUpdated: new Date(),
          },
        });
        break;

      case "vehicle_inspection":
        if (!primaryVehicle) {
          return { success: false, error: "No primary vehicle found" };
        }
        await prisma.vehicle.update({
          where: { id: primaryVehicle.id },
          data: {
            inspectionStatus: status,
            inspectionLastUpdated: new Date(),
            dmvInspectionRejectionReason: rejectionReason || null,
          },
        });
        break;

      default:
        await prisma.vehicleDocument.updateMany({
          where: {
            driverId,
            documentType,
          },
          data: {
            status: status as any,
            rejectionReason: rejectionReason || null,
            reviewedAt: new Date(),
            reviewedBy: adminId,
          } as any,
        });
    }

    await checkAndUpdateDriverVerificationStatus(driverId);

    return { success: true };
  } catch (error) {
    console.error("Error updating document status:", error);
    return { success: false, error: "Failed to update document status" };
  }
}

async function checkAndUpdateDriverVerificationStatus(driverId: string): Promise<void> {
  const summary = await getDriverDocumentSummary(driverId);
  if (!summary) return;

  let verificationStatus: string;
  let isVerified = false;

  if (summary.overallStatus === "approved") {
    verificationStatus = "approved";
    isVerified = true;
  } else if (summary.overallStatus === "rejected") {
    verificationStatus = "rejected";
  } else if (summary.overallStatus === "pending_review") {
    verificationStatus = "pending";
  } else {
    verificationStatus = "incomplete";
  }

  await prisma.driverProfile.update({
    where: { id: driverId },
    data: {
      verificationStatus,
      isVerified,
    },
  });
}

export async function getPendingDocumentsForAdmin(
  filters: {
    countryCode?: string;
    status?: string;
    search?: string;
  },
  page: number = 1,
  limit: number = 20
): Promise<{
  drivers: any[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  const where: any = {};

  if (filters.countryCode) {
    where.user = { countryCode: filters.countryCode };
  }

  if (filters.status) {
    if (filters.status === "pending") {
      where.OR = [
        { profilePhotoStatus: "PENDING" },
        { driverLicenseStatus: "PENDING" },
        { tlcLicenseDocStatus: "PENDING" },
        { nidStatus: "PENDING" },
      ];
    } else if (filters.status === "under_review") {
      where.OR = [
        { profilePhotoStatus: "UNDER_REVIEW" },
        { driverLicenseStatus: "UNDER_REVIEW" },
        { tlcLicenseDocStatus: "UNDER_REVIEW" },
        { nidStatus: "UNDER_REVIEW" },
      ];
    } else if (filters.status === "rejected") {
      where.OR = [
        { profilePhotoStatus: "REJECTED" },
        { driverLicenseStatus: "REJECTED" },
        { tlcLicenseDocStatus: "REJECTED" },
        { nidStatus: "REJECTED" },
      ];
    }
  }

  if (filters.search) {
    where.user = {
      ...where.user,
      email: { contains: filters.search, mode: "insensitive" },
    };
  }

  const total = await prisma.driverProfile.count({ where });
  const totalPages = Math.ceil(total / limit);

  const drivers = await prisma.driverProfile.findMany({
    where,
    include: {
      user: { select: { email: true, countryCode: true } },
      vehicles: { where: { isPrimary: true }, take: 1 },
      vehicleDocuments: true,
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const formattedDrivers = await Promise.all(
    drivers.map(async (driver) => {
      const summary = await getDriverDocumentSummary(driver.id);
      return {
        id: driver.id,
        userId: driver.userId,
        email: driver.user.email,
        countryCode: driver.user.countryCode,
        usaState: driver.usaState,
        verificationStatus: driver.verificationStatus,
        isVerified: driver.isVerified,
        documents: summary?.documents || [],
        overallStatus: summary?.overallStatus || "incomplete",
        completedCount: summary?.completedCount || 0,
        requiredCount: summary?.requiredCount || 0,
        pendingCount: summary?.pendingCount || 0,
        rejectedCount: summary?.rejectedCount || 0,
        lastUpdated: driver.updatedAt,
      };
    })
  );

  return {
    drivers: formattedDrivers,
    pagination: { total, page, limit, totalPages },
  };
}

export async function approveAllDocuments(
  driverId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const summary = await getDriverDocumentSummary(driverId);
    if (!summary) {
      return { success: false, error: "Driver not found" };
    }

    for (const doc of summary.documents) {
      if (doc.fileUrl && doc.status !== "APPROVED") {
        await updateDocumentStatus(driverId, doc.type, "APPROVED", adminId);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error approving all documents:", error);
    return { success: false, error: "Failed to approve documents" };
  }
}

export async function rejectDocument(
  driverId: string,
  documentType: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!reason || reason.trim() === "") {
    return { success: false, error: "Rejection reason is required" };
  }

  return updateDocumentStatus(driverId, documentType, "REJECTED", adminId, reason);
}
