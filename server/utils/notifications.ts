import { PrismaClient } from "@prisma/client";
import { prisma } from "../db";

// Notification type constants
export const NotificationType = {
  // KYC
  KYC_PENDING: "KYC_PENDING",
  KYC_APPROVED: "KYC_APPROVED",
  KYC_REJECTED: "KYC_REJECTED",
  KYC_NEED_MORE_INFO: "KYC_NEED_MORE_INFO",
  
  // Document Expiry
  DOCUMENT_EXPIRING: "DOCUMENT_EXPIRING",
  DOCUMENT_EXPIRED: "DOCUMENT_EXPIRED",
  
  // Driver Status
  DRIVER_STATUS_CHANGED: "DRIVER_STATUS_CHANGED",
  
  // Restaurant
  RESTAURANT_STATUS_CHANGED: "RESTAURANT_STATUS_CHANGED",
  RESTAURANT_COMMISSION_CHANGED: "RESTAURANT_COMMISSION_CHANGED",
  
  // Parcel
  PARCEL_STATUS_ISSUE: "PARCEL_STATUS_ISSUE",
  
  // Food Orders
  FOOD_ORDER_STATUS: "FOOD_ORDER_STATUS",
  RESTAURANT_ISSUE_ESCALATED: "RESTAURANT_ISSUE_ESCALATED",
  
  // Wallet
  WALLET_SETTLEMENT_PENDING: "WALLET_SETTLEMENT_PENDING",
  WALLET_SETTLEMENT_PROCESSED: "WALLET_SETTLEMENT_PROCESSED",
  
  // System
  SYSTEM_ERROR: "SYSTEM_ERROR",
} as const;

// Severity constants
export const NotificationSeverity = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

// Entity type constants (reuse from audit.ts pattern)
export const NotificationEntityType = {
  DRIVER: "driver",
  CUSTOMER: "customer",
  RESTAURANT: "restaurant",
  PARCEL: "parcel",
  WALLET: "wallet",
  DOCUMENT: "document",
  KYC: "kyc",
  SETTINGS: "settings",
  SYSTEM: "system",
} as const;

interface NotificationParams {
  type: string;
  severity: string;
  actorId?: string | null;
  actorEmail?: string | null;
  entityType: string;
  entityId?: string | null;
  countryCode?: string | null;
  title: string;
  message: string;
  metadata?: Record<string, any> | null;
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
    "documentUrl",
    "imageUrl",
  ];

  sensitiveFields.forEach(field => {
    delete sanitized[field];
  });

  // If there are masked versions, keep those
  // e.g., ssnLast4, nidLast4, maskedSSN, maskedNID are safe to log

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Validate notification type and severity
 */
function validateNotification(type: string, severity: string): boolean {
  const validTypes = Object.values(NotificationType);
  const validSeverities = Object.values(NotificationSeverity);
  
  return validTypes.includes(type as any) && validSeverities.includes(severity as any);
}

/**
 * Check for duplicate notifications to avoid spam
 * Returns true if a similar unread notification already exists
 * For document expiry notifications, also checks documentType to allow multiple alerts per driver
 */
async function isDuplicate(
  type: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, any> | null
): Promise<boolean> {
  try {
    const whereClause: any = {
      type,
      entityType,
      entityId: entityId || undefined,
      isRead: false,
    };

    // For document expiry notifications, include documentType in uniqueness check
    // This allows multiple document expiry alerts for the same driver (TLC, DMV, registration, insurance, etc.)
    if (
      (type === NotificationType.DOCUMENT_EXPIRING || type === NotificationType.DOCUMENT_EXPIRED) &&
      metadata?.documentType
    ) {
      // Check if the exact same document type was already notified
      whereClause.metadata = {
        path: ["documentType"],
        equals: metadata.documentType,
      };
    }

    const existing = await prisma.adminNotification.findFirst({
      where: whereClause,
    });
    return !!existing;
  } catch (error) {
    console.error("Error checking for duplicate notification:", error);
    return false;
  }
}

/**
 * Log a notification to the database
 * This function is designed to be non-blocking and fail gracefully
 * @param params - Notification parameters
 */
export async function logNotification(params: NotificationParams): Promise<void> {
  try {
    const {
      type,
      severity,
      actorId = null,
      actorEmail = null,
      entityType,
      entityId = null,
      countryCode = null,
      title,
      message,
      metadata = null,
    } = params;

    // Validate type and severity
    if (!validateNotification(type, severity)) {
      console.error(`Invalid notification type or severity: ${type}, ${severity}`);
      return;
    }

    // Check for duplicates (avoid spamming the same notification)
    // Pass metadata to allow document-type-specific de-duplication
    if (await isDuplicate(type, entityType, entityId, metadata)) {
      // Silently skip duplicate notifications
      return;
    }

    // Sanitize metadata to remove sensitive information
    const safeMetadata = sanitizeMetadata(metadata);

    // Create notification entry
    await prisma.adminNotification.create({
      data: {
        type,
        severity,
        actorId,
        actorEmail,
        entityType,
        entityId,
        countryCode,
        title,
        message,
        metadata: safeMetadata,
        isRead: false,
      },
    });
  } catch (error) {
    // Log error but don't throw - notification logging should never break the main flow
    console.error("Failed to log notification:", error);
  }
}

/**
 * Helper to create KYC pending notification
 */
export async function notifyKYCPending(params: {
  entityType: "driver" | "customer" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
}) {
  await logNotification({
    type: NotificationType.KYC_PENDING,
    severity: NotificationSeverity.WARNING,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `New ${params.entityType} KYC pending`,
    message: `KYC submission from ${params.email} (${params.countryCode}) is pending review.`,
    metadata: { email: params.email },
  });
}

/**
 * Helper to create KYC approved notification
 */
export async function notifyKYCApproved(params: {
  entityType: "driver" | "customer" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  actorId: string;
  actorEmail: string;
}) {
  await logNotification({
    type: NotificationType.KYC_APPROVED,
    severity: NotificationSeverity.INFO,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `${params.entityType} KYC approved`,
    message: `KYC for ${params.email} (${params.countryCode}) has been approved.`,
    metadata: { email: params.email },
  });
}

/**
 * Helper to create KYC rejected notification
 */
export async function notifyKYCRejected(params: {
  entityType: "driver" | "customer" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  actorId: string;
  actorEmail: string;
  reason: string;
}) {
  await logNotification({
    type: NotificationType.KYC_REJECTED,
    severity: NotificationSeverity.INFO,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `${params.entityType} KYC rejected`,
    message: `KYC for ${params.email} (${params.countryCode}) has been rejected.`,
    metadata: { email: params.email, reason: params.reason },
  });
}

/**
 * Helper to create KYC need more info notification
 */
export async function notifyKYCNeedMoreInfo(params: {
  entityType: "driver" | "customer" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  actorId: string;
  actorEmail: string;
  missingFields: string[];
  message?: string;
}) {
  await logNotification({
    type: NotificationType.KYC_NEED_MORE_INFO,
    severity: NotificationSeverity.WARNING,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `${params.entityType} KYC requires additional information`,
    message: params.message || `Additional information required for ${params.email} (${params.countryCode}).`,
    metadata: { email: params.email, missingFields: params.missingFields },
  });
}

/**
 * Helper to create document expiring notification
 */
export async function notifyDocumentExpiring(params: {
  entityType: "driver" | "customer" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  documentType: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}) {
  await logNotification({
    type: NotificationType.DOCUMENT_EXPIRING,
    severity: NotificationSeverity.WARNING,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `${params.documentType} expiring soon`,
    message: `${params.documentType} for ${params.email} (${params.countryCode}) expires in ${params.daysUntilExpiry} days.`,
    metadata: {
      email: params.email,
      documentType: params.documentType,
      expiryDate: params.expiryDate.toISOString(),
      daysUntilExpiry: params.daysUntilExpiry,
    },
  });
}

/**
 * Helper to create document expired notification
 */
export async function notifyDocumentExpired(params: {
  entityType: "driver" | "customer" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  documentType: string;
  expiryDate: Date;
}) {
  await logNotification({
    type: NotificationType.DOCUMENT_EXPIRED,
    severity: NotificationSeverity.CRITICAL,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `${params.documentType} expired`,
    message: `${params.documentType} for ${params.email} (${params.countryCode}) has expired.`,
    metadata: {
      email: params.email,
      documentType: params.documentType,
      expiryDate: params.expiryDate.toISOString(),
    },
  });
}

/**
 * Helper to create driver status changed notification
 */
export async function notifyDriverStatusChanged(params: {
  driverId: string;
  countryCode: string;
  email: string;
  action: string;
  actorId: string;
  actorEmail: string;
}) {
  const severity = 
    params.action === "suspended" || params.action === "blocked" 
      ? NotificationSeverity.WARNING 
      : NotificationSeverity.INFO;

  await logNotification({
    type: NotificationType.DRIVER_STATUS_CHANGED,
    severity,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: NotificationEntityType.DRIVER,
    entityId: params.driverId,
    countryCode: params.countryCode,
    title: `Driver ${params.action}`,
    message: `Driver ${params.email} (${params.countryCode}) has been ${params.action}.`,
    metadata: { email: params.email, action: params.action },
  });
}

/**
 * Helper to create restaurant status changed notification
 */
export async function notifyRestaurantStatusChanged(params: {
  restaurantId: string;
  countryCode: string;
  email: string;
  action: string;
  actorId: string;
  actorEmail: string;
}) {
  const severity = params.action === "suspended" ? NotificationSeverity.WARNING : NotificationSeverity.INFO;

  await logNotification({
    type: NotificationType.RESTAURANT_STATUS_CHANGED,
    severity,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: NotificationEntityType.RESTAURANT,
    entityId: params.restaurantId,
    countryCode: params.countryCode,
    title: `Restaurant ${params.action}`,
    message: `Restaurant ${params.email} (${params.countryCode}) has been ${params.action}.`,
    metadata: { email: params.email, action: params.action },
  });
}

/**
 * Helper to create restaurant commission changed notification
 */
export async function notifyRestaurantCommissionChanged(params: {
  restaurantId?: string;
  countryCode: string;
  actorId: string;
  actorEmail: string;
  oldRate: number;
  newRate: number;
  scope: "restaurant" | "country";
}) {
  await logNotification({
    type: NotificationType.RESTAURANT_COMMISSION_CHANGED,
    severity: NotificationSeverity.INFO,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: NotificationEntityType.RESTAURANT,
    entityId: params.restaurantId || null,
    countryCode: params.countryCode,
    title: `Commission rate updated`,
    message: `Commission rate for ${params.scope === "restaurant" ? "restaurant" : params.countryCode} changed from ${params.oldRate}% to ${params.newRate}%.`,
    metadata: {
      oldRate: params.oldRate,
      newRate: params.newRate,
      scope: params.scope,
    },
  });
}

/**
 * Helper to create wallet settlement pending notification
 */
export async function notifyWalletSettlementPending(params: {
  entityType: "driver" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  amount: number;
  currency: string;
}) {
  await logNotification({
    type: NotificationType.WALLET_SETTLEMENT_PENDING,
    severity: NotificationSeverity.WARNING,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `Settlement pending`,
    message: `Pending settlement of ${params.currency}${params.amount} for ${params.email} (${params.countryCode}).`,
    metadata: {
      email: params.email,
      amount: params.amount,
      currency: params.currency,
    },
  });
}

/**
 * Helper to create wallet settlement processed notification
 */
export async function notifyWalletSettlementProcessed(params: {
  entityType: "driver" | "restaurant";
  entityId: string;
  countryCode: string;
  email: string;
  amount: number;
  currency: string;
  actorId: string;
  actorEmail: string;
}) {
  await logNotification({
    type: NotificationType.WALLET_SETTLEMENT_PROCESSED,
    severity: NotificationSeverity.INFO,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    entityType: params.entityType,
    entityId: params.entityId,
    countryCode: params.countryCode,
    title: `Settlement processed`,
    message: `Settlement of ${params.currency}${params.amount} processed for ${params.email} (${params.countryCode}).`,
    metadata: {
      email: params.email,
      amount: params.amount,
      currency: params.currency,
    },
  });
}

/**
 * Helper to create parcel status issue notification
 */
export async function notifyParcelStatusIssue(params: {
  parcelId: string;
  countryCode: string;
  customerId: string;
  issue: string;
}) {
  await logNotification({
    type: NotificationType.PARCEL_STATUS_ISSUE,
    severity: NotificationSeverity.CRITICAL,
    entityType: NotificationEntityType.PARCEL,
    entityId: params.parcelId,
    countryCode: params.countryCode,
    title: `Parcel delivery issue`,
    message: `Parcel #${params.parcelId.substring(0, 8)} encountered an issue: ${params.issue}`,
    metadata: {
      parcelId: params.parcelId,
      customerId: params.customerId,
      issue: params.issue,
    },
  });
}

/**
 * Helper function to determine notification severity based on order status
 */
function getSeverityForOrderStatus(status: string): string {
  const highSeverity = ["cancelled", "cancelled_restaurant", "cancelled_customer", "cancelled_driver"];
  const mediumSeverity = ["placed", "accepted", "ready_for_pickup"];
  
  if (highSeverity.includes(status)) return NotificationSeverity.CRITICAL;
  if (mediumSeverity.includes(status)) return NotificationSeverity.WARNING;
  return NotificationSeverity.INFO;
}

/**
 * Create notifications for all parties when food order status changes
 * Notifies: restaurant, customer, and driver (if assigned)
 */
export async function notifyFoodOrderStatusChange(params: {
  orderId: string;
  orderCode?: string;
  restaurantId: string;
  customerId: string;
  driverId?: string | null;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  countryCode?: string;
}) {
  const { orderId, orderCode, restaurantId, customerId, driverId, oldStatus, newStatus, updatedBy, countryCode } = params;
  const orderRef = orderCode || orderId.substring(0, 8);
  const severity = getSeverityForOrderStatus(newStatus);

  const notifications = [];

  // Notification for restaurant
  notifications.push(
    logNotification({
      type: NotificationType.FOOD_ORDER_STATUS,
      severity,
      actorId: updatedBy,
      entityType: NotificationEntityType.RESTAURANT,
      entityId: restaurantId,
      countryCode: countryCode || null,
      title: `Order ${orderRef} - Status Updated`,
      message: `Order status changed from ${oldStatus} to ${newStatus}`,
      metadata: { orderId, orderCode, oldStatus, newStatus },
    })
  );

  // Notification for customer
  notifications.push(
    logNotification({
      type: NotificationType.FOOD_ORDER_STATUS,
      severity,
      actorId: updatedBy,
      entityType: NotificationEntityType.CUSTOMER,
      entityId: customerId,
      countryCode: countryCode || null,
      title: `Order ${orderRef} - Status Updated`,
      message: `Your order status changed to ${newStatus}`,
      metadata: { orderId, orderCode, oldStatus, newStatus },
    })
  );

  // Notification for driver (if assigned)
  if (driverId) {
    notifications.push(
      logNotification({
        type: NotificationType.FOOD_ORDER_STATUS,
        severity,
        actorId: updatedBy,
        entityType: NotificationEntityType.DRIVER,
        entityId: driverId,
        countryCode: countryCode || null,
        title: `Delivery Order ${orderRef} - Status Updated`,
        message: `Order status changed to ${newStatus}`,
        metadata: { orderId, orderCode, oldStatus, newStatus },
      })
    );
  }

  // Execute all notification creations in parallel
  await Promise.all(notifications);
}

/**
 * Create admin notification when restaurant issue is escalated
 */
export async function notifyRestaurantIssueEscalated(params: {
  restaurantId: string;
  orderId: string;
  orderCode?: string;
  issueType: string;
  issueDescription: string;
  reportedBy: string;
  countryCode?: string;
}) {
  const { restaurantId, orderId, orderCode, issueType, issueDescription, reportedBy, countryCode } = params;

  await logNotification({
    type: NotificationType.RESTAURANT_ISSUE_ESCALATED,
    severity: NotificationSeverity.CRITICAL,
    actorId: reportedBy,
    entityType: NotificationEntityType.RESTAURANT,
    entityId: restaurantId,
    countryCode: countryCode || null,
    title: `Restaurant Issue Escalated - ${issueType}`,
    message: issueDescription,
    metadata: {
      restaurantId,
      orderId,
      orderCode: orderCode || orderId.substring(0, 8),
      issueType,
      reportedBy,
    },
  });
}
