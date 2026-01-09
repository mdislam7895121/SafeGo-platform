import { prisma } from "../lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import { safeAuditLogCreate } from "../utils/audit";

export enum ComplianceExportStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  READY = "READY",
  DOWNLOADED = "DOWNLOADED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum ComplianceExportCategory {
  USER_REQUEST = "USER_REQUEST",
  REGULATOR_COURT = "REGULATOR_COURT",
  BULK_ANALYTICS = "BULK_ANALYTICS",
}

export enum ComplianceExportScope {
  SINGLE_USER = "SINGLE_USER",
  CASE_CENTRIC = "CASE_CENTRIC",
  TIME_WINDOW = "TIME_WINDOW",
  CUSTOM = "CUSTOM",
}

export enum AnonymizationLevel {
  NONE = "NONE",
  PARTIAL = "PARTIAL",
  FULL = "FULL",
}

const AVAILABLE_ENTITIES = [
  "profile",
  "kyc",
  "rides",
  "deliveries",
  "wallet",
  "complaints",
  "safetyIncidents",
  "payments",
  "disputes",
  "auditLogs",
] as const;

const createExportSchema = z.object({
  category: z.nativeEnum(ComplianceExportCategory),
  scope: z.nativeEnum(ComplianceExportScope),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  reason: z.string().min(10, "A detailed reason is required (min 10 characters)"),
  countryCode: z.string().optional(),
  anonymizationLevel: z.nativeEnum(AnonymizationLevel).default(AnonymizationLevel.NONE),
  targetUserId: z.string().optional(),
  targetUserEmail: z.string().email().optional().or(z.literal("")),
  targetUserPhone: z.string().optional(),
  caseId: z.string().optional(),
  caseType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includedEntities: z.array(z.string()).default([]),
  excludedFields: z.array(z.string()).default([]),
});

export type CreateExportInput = z.infer<typeof createExportSchema>;

export function validateCreateExportInput(input: unknown): { valid: boolean; data?: CreateExportInput; error?: string } {
  const result = createExportSchema.safeParse(input);
  if (!result.success) {
    return { valid: false, error: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") };
  }
  return { valid: true, data: result.data };
}

export async function createExport(
  input: CreateExportInput,
  requestedBy: string,
  requestedByEmail: string,
  requestedByRole: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; export?: any; error?: string }> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const complianceExport = await prisma.complianceDataExport.create({
      data: {
        category: input.category,
        scope: input.scope,
        title: input.title,
        description: input.description || null,
        reason: input.reason,
        countryCode: input.countryCode || null,
        anonymizationLevel: input.anonymizationLevel,
        targetUserId: input.targetUserId || null,
        targetUserEmail: input.targetUserEmail || null,
        targetUserPhone: input.targetUserPhone || null,
        caseId: input.caseId || null,
        caseType: input.caseType || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        includedEntities: input.includedEntities,
        excludedFields: input.excludedFields,
        requestedBy,
        requestedByEmail,
        requestedByRole,
        expiresAt,
        status: ComplianceExportStatus.QUEUED,
      },
    });

    await safeAuditLogCreate({
      data: {
        actorId: requestedBy,
        actorEmail: requestedByEmail,
        actorRole: requestedByRole,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        actionType: "CREATE_COMPLIANCE_EXPORT",
        entityType: "ComplianceDataExport",
        entityId: complianceExport.id,
        description: `Created compliance export: ${input.title} (${input.category}/${input.scope})`,
        metadata: {
          category: input.category,
          scope: input.scope,
          reason: input.reason,
          countryCode: input.countryCode,
          anonymizationLevel: input.anonymizationLevel,
        },
        success: true,
      },
    });

    processExportAsync(complianceExport.id).catch((err) => {
      console.error(`[ComplianceExport] Background processing failed for ${complianceExport.id}:`, err);
    });

    return { success: true, export: complianceExport };
  } catch (error: any) {
    console.error("[ComplianceExport] Failed to create export:", error);
    return { success: false, error: error.message || "Failed to create export" };
  }
}

async function processExportAsync(exportId: string): Promise<void> {
  try {
    await prisma.complianceDataExport.update({
      where: { id: exportId },
      data: {
        status: ComplianceExportStatus.PROCESSING,
        processedAt: new Date(),
      },
    });

    const exportRecord = await prisma.complianceDataExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new Error("Export not found");
    }

    const exportData = await collectExportData(exportRecord);
    const manifest = generateManifest(exportRecord, exportData);

    const jsonContent = JSON.stringify({ manifest, data: exportData }, null, 2);
    const fileSize = Buffer.byteLength(jsonContent, "utf8");
    const fileHash = crypto.createHash("sha256").update(jsonContent).digest("hex");

    const fileUrl = `/api/admin/compliance-exports/${exportId}/download`;

    await prisma.complianceDataExport.update({
      where: { id: exportId },
      data: {
        status: ComplianceExportStatus.READY,
        completedAt: new Date(),
        fileUrl,
        fileSize,
        fileHash,
        manifest,
        recordCount: countRecords(exportData),
      },
    });
  } catch (error: any) {
    console.error(`[ComplianceExport] Processing failed for ${exportId}:`, error);
    await prisma.complianceDataExport.update({
      where: { id: exportId },
      data: {
        status: ComplianceExportStatus.FAILED,
        errorMessage: error.message || "Processing failed",
        retryCount: { increment: 1 },
      },
    });
  }
}

async function collectExportData(exportRecord: any): Promise<any> {
  const data: any = {};
  const entities = exportRecord.includedEntities.length > 0 
    ? exportRecord.includedEntities 
    : AVAILABLE_ENTITIES;

  for (const entity of entities) {
    switch (entity) {
      case "profile":
        data.profile = await collectProfileData(exportRecord);
        break;
      case "kyc":
        data.kyc = await collectKycData(exportRecord);
        break;
      case "rides":
        data.rides = await collectRidesData(exportRecord);
        break;
      case "deliveries":
        data.deliveries = await collectDeliveriesData(exportRecord);
        break;
      case "wallet":
        data.wallet = await collectWalletData(exportRecord);
        break;
      case "complaints":
        data.complaints = await collectComplaintsData(exportRecord);
        break;
      case "payments":
        data.payments = await collectPaymentsData(exportRecord);
        break;
      case "auditLogs":
        data.auditLogs = await collectAuditLogsData(exportRecord);
        break;
    }
  }

  if (exportRecord.anonymizationLevel !== AnonymizationLevel.NONE) {
    return anonymizeData(data, exportRecord.anonymizationLevel, exportRecord.excludedFields);
  }

  return data;
}

async function collectProfileData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    const user = await prisma.user.findUnique({
      where: { id: exportRecord.targetUserId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        countryCode: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        is2FAEnabled: true,
      },
    });
    return user ? [user] : [];
  }

  if (exportRecord.scope === ComplianceExportScope.TIME_WINDOW) {
    return prisma.user.findMany({
      where: {
        createdAt: {
          gte: exportRecord.startDate,
          lte: exportRecord.endDate,
        },
        ...(exportRecord.countryCode && { countryCode: exportRecord.countryCode }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        countryCode: true,
      },
      take: 1000,
    });
  }

  return [];
}

async function collectKycData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    return prisma.kYCDocument.findMany({
      where: { userId: exportRecord.targetUserId },
      select: {
        id: true,
        documentType: true,
        status: true,
        expiryDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  return [];
}

async function collectRidesData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    return prisma.ride.findMany({
      where: {
        OR: [
          { customerId: exportRecord.targetUserId },
          { driverId: exportRecord.targetUserId },
        ],
      },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        fare: true,
        createdAt: true,
        completedAt: true,
      },
      take: 500,
    });
  }

  if (exportRecord.scope === ComplianceExportScope.TIME_WINDOW) {
    return prisma.ride.findMany({
      where: {
        createdAt: {
          gte: exportRecord.startDate,
          lte: exportRecord.endDate,
        },
      },
      select: {
        id: true,
        status: true,
        fare: true,
        createdAt: true,
      },
      take: 1000,
    });
  }

  return [];
}

async function collectDeliveriesData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    return prisma.parcel.findMany({
      where: {
        OR: [
          { senderId: exportRecord.targetUserId },
          { recipientId: exportRecord.targetUserId },
        ],
      },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        deliveryAddress: true,
        estimatedPrice: true,
        createdAt: true,
      },
      take: 500,
    });
  }
  return [];
}

async function collectWalletData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: exportRecord.targetUserId },
      select: {
        id: true,
        balance: true,
        currency: true,
        lastTransactionAt: true,
      },
    });

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet?.id },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
      },
      take: 500,
    });

    return { wallet, transactions };
  }
  return { wallet: null, transactions: [] };
}

async function collectComplaintsData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    return prisma.complaint.findMany({
      where: {
        OR: [
          { complainantId: exportRecord.targetUserId },
          { respondentId: exportRecord.targetUserId },
        ],
      },
      select: {
        id: true,
        category: true,
        status: true,
        priority: true,
        description: true,
        createdAt: true,
        resolvedAt: true,
      },
      take: 200,
    });
  }

  if (exportRecord.scope === ComplianceExportScope.CASE_CENTRIC && exportRecord.caseId) {
    return prisma.complaint.findMany({
      where: { id: exportRecord.caseId },
    });
  }

  return [];
}

async function collectPaymentsData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    return prisma.payment.findMany({
      where: { userId: exportRecord.targetUserId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
      },
      take: 500,
    });
  }
  return [];
}

async function collectAuditLogsData(exportRecord: any): Promise<any> {
  if (exportRecord.scope === ComplianceExportScope.SINGLE_USER && exportRecord.targetUserId) {
    return prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: exportRecord.targetUserId },
          { entityId: exportRecord.targetUserId },
        ],
      },
      select: {
        id: true,
        actionType: true,
        description: true,
        createdAt: true,
      },
      take: 500,
    });
  }
  return [];
}

function anonymizeData(data: any, level: AnonymizationLevel, excludedFields: string[]): any {
  const anonymized = JSON.parse(JSON.stringify(data));

  const piiFields = new Set([
    "email", "phone", "firstName", "lastName", "fullName", "name",
    "pickupAddress", "dropoffAddress", "deliveryAddress", "address",
    "streetAddress", "city", "zipCode", "postalCode", "origin", "destination",
    "nationalId", "passportNumber", "licenseNumber", "ssn", "taxId", "nid",
    "bankAccount", "bankAccountNumber", "routingNumber", "iban", "bkashNumber", "nagadNumber",
    "cardNumber", "cardLast4", "accountNumber", "last4", "fingerprint",
    "dateOfBirth", "dob", "birthDate",
    "ipAddress", "deviceId", "userAgent", "deviceFingerprint",
    "emergencyContactName", "emergencyContactPhone",
    "recipientName", "recipientPhone", "recipientEmail",
    "senderName", "senderPhone", "senderEmail",
    "actorEmail", "requestedByEmail", "changedByEmail", "verifiedByEmail",
    "driverName", "customerName", "restaurantName", "ownerName",
    "vehiclePlate", "plateNumber", "licensePlate", "vehicleRegistration",
    "contactPhone", "contactEmail", "alternatePhone",
    "homeAddress", "workAddress", "billingAddress", "shippingAddress",
    "description", "notes", "comments", "feedback", "reviewText",
    "documents", "documentUrl", "photoUrl", "profilePicture", "avatar",
  ]);

  const locationFields = new Set([
    "pickupLat", "pickupLng", "dropoffLat", "dropoffLng",
    "latitude", "longitude", "lat", "lng", "currentLat", "currentLng",
    "startLat", "startLng", "endLat", "endLng",
    "originLat", "originLng", "destLat", "destLng",
    "coordinates", "waypoints", "route", "routePolyline",
  ]);
  
  const metadataFields = new Set(["metadata", "evidence", "evidencePacket", "auditMetadata"]);

  function anonymizeValue(value: string, field: string, fieldType: "pii" | "location"): string {
    if (level === AnonymizationLevel.FULL) {
      return crypto.createHash("sha256").update(String(value)).digest("hex").substring(0, 16);
    }
    
    if (fieldType === "location") {
      const num = parseFloat(String(value));
      if (!isNaN(num)) {
        return String(Math.round(num * 10) / 10);
      }
      return "[REDACTED]";
    }

    if (field.toLowerCase().includes("email") && String(value).includes("@")) {
      const [local, domain] = String(value).split("@");
      if (local && domain) {
        return `${local.substring(0, 2)}***@${domain}`;
      }
    }
    if (field.toLowerCase().includes("phone")) {
      const str = String(value);
      if (str.length > 6) {
        return str.substring(0, 4) + "****" + str.substring(str.length - 2);
      }
    }
    const str = String(value);
    if (str.length > 2) {
      return str.substring(0, 2) + "***";
    }
    return "[REDACTED]";
  }

  function processObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => processObject(item));
    }
    if (obj && typeof obj === "object" && !(obj instanceof Date)) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (excludedFields.includes(key)) {
          continue;
        }
        
        const lowerKey = key.toLowerCase();
        
        if (metadataFields.has(key) && value && typeof value === "object") {
          if (level === AnonymizationLevel.FULL) {
            result[key] = "[REDACTED_METADATA]";
          } else {
            result[key] = processObject(value);
          }
        } else if (piiFields.has(key) || piiFields.has(lowerKey) || 
                   lowerKey.includes("email") || lowerKey.includes("phone") ||
                   lowerKey.includes("address") || lowerKey.includes("name") && !lowerKey.includes("typename")) {
          if (value !== null && value !== undefined) {
            result[key] = anonymizeValue(String(value), key, "pii");
          } else {
            result[key] = null;
          }
        } else if (locationFields.has(key) || locationFields.has(lowerKey) ||
                   lowerKey.includes("lat") || lowerKey.includes("lng") ||
                   lowerKey.includes("coord") || lowerKey.includes("location")) {
          if (value !== null && value !== undefined) {
            if (typeof value === "number") {
              result[key] = level === AnonymizationLevel.FULL 
                ? 0 
                : Math.round(value * 10) / 10;
            } else {
              result[key] = anonymizeValue(String(value), key, "location");
            }
          } else {
            result[key] = null;
          }
        } else {
          result[key] = processObject(value);
        }
      }
      return result;
    }
    return obj;
  }

  return processObject(anonymized);
}

function generateManifest(exportRecord: any, data: any): any {
  return {
    exportId: exportRecord.id,
    generatedAt: new Date().toISOString(),
    category: exportRecord.category,
    scope: exportRecord.scope,
    countryCode: exportRecord.countryCode,
    anonymizationLevel: exportRecord.anonymizationLevel,
    requestedBy: exportRecord.requestedByEmail,
    reason: exportRecord.reason,
    dateRange: {
      start: exportRecord.startDate?.toISOString() || null,
      end: exportRecord.endDate?.toISOString() || null,
    },
    includedEntities: Object.keys(data),
    recordCounts: Object.entries(data).reduce((acc: any, [key, value]) => {
      acc[key] = Array.isArray(value) ? value.length : (value && typeof value === "object" ? 1 : 0);
      return acc;
    }, {}),
  };
}

function countRecords(data: any): number {
  let count = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      count += value.length;
    } else if (value && typeof value === "object") {
      count += 1;
    }
  }
  return count;
}

export async function getExports(filters?: {
  category?: ComplianceExportCategory;
  status?: ComplianceExportStatus;
  countryCode?: string;
  requestedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ exports: any[]; total: number }> {
  const where: any = {};

  if (filters?.category) where.category = filters.category;
  if (filters?.status) where.status = filters.status;
  if (filters?.countryCode) where.countryCode = filters.countryCode;
  if (filters?.requestedBy) where.requestedBy = filters.requestedBy;
  if (filters?.startDate || filters?.endDate) {
    where.requestedAt = {};
    if (filters.startDate) where.requestedAt.gte = filters.startDate;
    if (filters.endDate) where.requestedAt.lte = filters.endDate;
  }

  const [exports, total] = await Promise.all([
    prisma.complianceDataExport.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    prisma.complianceDataExport.count({ where }),
  ]);

  return { exports, total };
}

export async function getExportById(id: string): Promise<any | null> {
  return prisma.complianceDataExport.findUnique({
    where: { id },
    include: {
      accessLogs: {
        orderBy: { accessedAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function downloadExport(
  exportId: string,
  downloadedBy: string,
  downloadedByEmail: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const exportRecord = await prisma.complianceDataExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      return { success: false, error: "Export not found" };
    }

    if (exportRecord.status !== ComplianceExportStatus.READY && 
        exportRecord.status !== ComplianceExportStatus.DOWNLOADED) {
      return { success: false, error: `Export is not ready (status: ${exportRecord.status})` };
    }

    if (exportRecord.expiresAt && new Date() > exportRecord.expiresAt) {
      await prisma.complianceDataExport.update({
        where: { id: exportId },
        data: { status: ComplianceExportStatus.EXPIRED },
      });
      return { success: false, error: "Export has expired" };
    }

    const exportData = await collectExportData(exportRecord);
    const manifest = generateManifest(exportRecord, exportData);

    await prisma.$transaction([
      prisma.complianceDataExport.update({
        where: { id: exportId },
        data: {
          status: ComplianceExportStatus.DOWNLOADED,
          downloadCount: { increment: 1 },
          lastDownloadedAt: new Date(),
          lastDownloadedBy: downloadedBy,
        },
      }),
      prisma.complianceExportAccessLog.create({
        data: {
          exportId,
          action: "DOWNLOAD",
          accessedBy: downloadedBy,
          accessedByEmail: downloadedByEmail,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      }),
    ]);

    await safeAuditLogCreate({
      data: {
        actorId: downloadedBy,
        actorEmail: downloadedByEmail,
        actorRole: "ADMIN",
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        actionType: "DOWNLOAD_COMPLIANCE_EXPORT",
        entityType: "ComplianceDataExport",
        entityId: exportId,
        description: `Downloaded compliance export: ${exportRecord.title}`,
        metadata: {
          category: exportRecord.category,
          scope: exportRecord.scope,
          fileSize: exportRecord.fileSize,
        },
        success: true,
      },
    });

    return { success: true, data: { manifest, data: exportData } };
  } catch (error: any) {
    console.error("[ComplianceExport] Download failed:", error);
    return { success: false, error: error.message || "Download failed" };
  }
}

export async function cancelExport(
  exportId: string,
  cancelledBy: string,
  cancelledByEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const exportRecord = await prisma.complianceDataExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      return { success: false, error: "Export not found" };
    }

    if (exportRecord.status !== ComplianceExportStatus.QUEUED) {
      return { success: false, error: "Only queued exports can be cancelled" };
    }

    await prisma.complianceDataExport.update({
      where: { id: exportId },
      data: { status: ComplianceExportStatus.CANCELLED },
    });

    await safeAuditLogCreate({
      data: {
        actorId: cancelledBy,
        actorEmail: cancelledByEmail,
        actorRole: "ADMIN",
        actionType: "CANCEL_COMPLIANCE_EXPORT",
        entityType: "ComplianceDataExport",
        entityId: exportId,
        description: `Cancelled compliance export: ${exportRecord.title}`,
        success: true,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to cancel export" };
  }
}

export async function getRetentionPolicies(): Promise<any[]> {
  return prisma.dataRetentionPolicy.findMany({
    orderBy: { countryCode: "asc" },
  });
}

export async function upsertRetentionPolicy(
  countryCode: string,
  data: {
    dataRetentionDays?: number;
    exportRetentionDays?: number;
    piiRetentionDays?: number;
    auditLogRetentionDays?: number;
    autoAnonymizeAfterDays?: number | null;
    requiresApproval?: boolean;
    maxExportsPerDay?: number;
  },
  updatedBy: string,
  updatedByEmail?: string,
  updatedByRole?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const existingPolicy = await prisma.dataRetentionPolicy.findUnique({
    where: { countryCode },
  });

  const mappedData = {
    rideDataRetentionDays: data.dataRetentionDays,
    paymentDataRetentionDays: data.dataRetentionDays,
    kycDataRetentionDays: data.piiRetentionDays,
    auditLogRetentionDays: data.auditLogRetentionDays,
    complaintRetentionDays: data.dataRetentionDays,
    allowUserDeletionRequest: true,
    softDeleteOnly: true,
    archivedDataAccessible: false,
  };

  const policy = await prisma.dataRetentionPolicy.upsert({
    where: { countryCode },
    create: {
      countryCode,
      ...mappedData,
      updatedBy,
    },
    update: {
      ...mappedData,
      updatedBy,
      lastUpdated: new Date(),
    },
  });

  const changedFields: Record<string, { before: any; after: any }> = {};
  if (existingPolicy) {
    if (existingPolicy.rideDataRetentionDays !== mappedData.rideDataRetentionDays) {
      changedFields.rideDataRetentionDays = { 
        before: existingPolicy.rideDataRetentionDays, 
        after: mappedData.rideDataRetentionDays 
      };
    }
    if (existingPolicy.paymentDataRetentionDays !== mappedData.paymentDataRetentionDays) {
      changedFields.paymentDataRetentionDays = { 
        before: existingPolicy.paymentDataRetentionDays, 
        after: mappedData.paymentDataRetentionDays 
      };
    }
    if (existingPolicy.kycDataRetentionDays !== mappedData.kycDataRetentionDays) {
      changedFields.kycDataRetentionDays = { 
        before: existingPolicy.kycDataRetentionDays, 
        after: mappedData.kycDataRetentionDays 
      };
    }
    if (existingPolicy.auditLogRetentionDays !== mappedData.auditLogRetentionDays) {
      changedFields.auditLogRetentionDays = { 
        before: existingPolicy.auditLogRetentionDays, 
        after: mappedData.auditLogRetentionDays 
      };
    }
    if (existingPolicy.complaintRetentionDays !== mappedData.complaintRetentionDays) {
      changedFields.complaintRetentionDays = { 
        before: existingPolicy.complaintRetentionDays, 
        after: mappedData.complaintRetentionDays 
      };
    }
  }

  await safeAuditLogCreate({
    data: {
      actorId: updatedBy,
      actorEmail: updatedByEmail || "unknown",
      actorRole: updatedByRole || "ADMIN",
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      actionType: existingPolicy ? "UPDATE_RETENTION_POLICY" : "CREATE_RETENTION_POLICY",
      entityType: "DataRetentionPolicy",
      entityId: countryCode,
      description: `${existingPolicy ? "Updated" : "Created"} retention policy for ${countryCode}`,
      metadata: {
        countryCode,
        isUpdate: !!existingPolicy,
        changedFields: Object.keys(changedFields).length > 0 ? changedFields : null,
        previousValues: existingPolicy ? {
          rideDataRetentionDays: existingPolicy.rideDataRetentionDays,
          paymentDataRetentionDays: existingPolicy.paymentDataRetentionDays,
          kycDataRetentionDays: existingPolicy.kycDataRetentionDays,
          auditLogRetentionDays: existingPolicy.auditLogRetentionDays,
          complaintRetentionDays: existingPolicy.complaintRetentionDays,
          allowUserDeletionRequest: existingPolicy.allowUserDeletionRequest,
          softDeleteOnly: existingPolicy.softDeleteOnly,
          updatedBy: existingPolicy.updatedBy,
          lastUpdated: existingPolicy.lastUpdated,
        } : null,
        newValues: mappedData,
        inputData: data,
        timestamp: new Date().toISOString(),
      },
      success: true,
    },
  });

  return policy;
}

export const ComplianceExportService = {
  validateCreateExportInput,
  createExport,
  getExports,
  getExportById,
  downloadExport,
  cancelExport,
  getRetentionPolicies,
  upsertRetentionPolicy,
  AVAILABLE_ENTITIES,
};
