import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Action type constants for type safety and consistency
export const ActionType = {
  // Authentication
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  
  // Driver Management
  DRIVER_STATUS_CHANGE: "DRIVER_STATUS_CHANGE",
  DRIVER_KYC_APPROVED: "DRIVER_KYC_APPROVED",
  DRIVER_KYC_REJECTED: "DRIVER_KYC_REJECTED",
  DRIVER_SUSPENDED: "DRIVER_SUSPENDED",
  DRIVER_UNSUSPENDED: "DRIVER_UNSUSPENDED",
  DRIVER_BLOCKED: "DRIVER_BLOCKED",
  DRIVER_UNBLOCKED: "DRIVER_UNBLOCKED",
  
  // Customer Management
  CUSTOMER_KYC_APPROVED: "CUSTOMER_KYC_APPROVED",
  CUSTOMER_KYC_REJECTED: "CUSTOMER_KYC_REJECTED",
  CUSTOMER_STATUS_CHANGE: "CUSTOMER_STATUS_CHANGE",
  CUSTOMER_BLOCKED: "CUSTOMER_BLOCKED",
  CUSTOMER_UNBLOCKED: "CUSTOMER_UNBLOCKED",
  
  // Restaurant Management
  RESTAURANT_STATUS_CHANGE: "RESTAURANT_STATUS_CHANGE",
  RESTAURANT_KYC_APPROVED: "RESTAURANT_KYC_APPROVED",
  RESTAURANT_KYC_REJECTED: "RESTAURANT_KYC_REJECTED",
  RESTAURANT_SUSPENDED: "RESTAURANT_SUSPENDED",
  RESTAURANT_UNSUSPENDED: "RESTAURANT_UNSUSPENDED",
  RESTAURANT_COMMISSION_UPDATED: "RESTAURANT_COMMISSION_UPDATED",
  
  // Document Management
  DOCUMENT_REVIEW_APPROVED: "DOCUMENT_REVIEW_APPROVED",
  DOCUMENT_REVIEW_REJECTED: "DOCUMENT_REVIEW_REJECTED",
  
  // Wallet & Settlements
  WALLET_SETTLEMENT_PROCESSED: "WALLET_SETTLEMENT_PROCESSED",
  WALLET_TRANSACTION_CREATED: "WALLET_TRANSACTION_CREATED",
  
  // Parcel Management
  PARCEL_STATUS_UPDATED: "PARCEL_STATUS_UPDATED",
  
  // Settings
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
} as const;

// Entity type constants
export const EntityType = {
  DRIVER: "driver",
  CUSTOMER: "customer",
  RESTAURANT: "restaurant",
  PARCEL: "parcel",
  WALLET: "wallet",
  KYC: "kyc",
  DOCUMENT: "document",
  SETTINGS: "settings",
  AUTH: "auth",
} as const;

interface AuditLogParams {
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  ipAddress?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, any> | null;
  success?: boolean;
}

/**
 * Sanitize metadata to remove sensitive information
 * NEVER log: passwords, full SSN, full NID, tokens, secrets, raw document URLs with tokens
 */
function sanitizeMetadata(metadata?: Record<string, any> | null): Record<string, any> | null {
  if (!metadata) return null;

  const sanitized = { ...metadata };

  // Remove sensitive fields
  const sensitiveFields = [
    "password",
    "passwordHash",
    "token",
    "secret",
    "apiKey",
    "nid",
    "nidNumber",
    "nidEncrypted",
    "ssn",
    "ssnEncrypted",
  ];

  sensitiveFields.forEach(field => {
    delete sanitized[field];
  });

  // If there are masked versions, keep those
  // e.g., ssnLast4, nidLast4, maskedSSN, maskedNID are safe to log

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Log an audit event to the database
 * This function is designed to be non-blocking and fail gracefully
 * @param params - Audit log parameters
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const {
      actorId = null,
      actorEmail,
      actorRole,
      ipAddress = null,
      actionType,
      entityType,
      entityId = null,
      description,
      metadata = null,
      success = true,
    } = params;

    // Sanitize metadata to remove sensitive information
    const safeMetadata = sanitizeMetadata(metadata);

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail,
        actorRole,
        ipAddress,
        actionType,
        entityType,
        entityId,
        description,
        metadata: safeMetadata,
        success,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging should never break the main flow
    console.error("Failed to log audit event:", error);
  }
}

/**
 * Helper to extract IP address from Express request
 */
export function getClientIp(req: any): string | null {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}
