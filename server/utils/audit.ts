import { prisma } from "../lib/prisma";

/**
 * PRODUCTION SAFETY: Check if audit logging is disabled via environment variable.
 * Set DISABLE_AUDIT=true to skip all audit writes (emergency bypass for DB issues).
 */
const isAuditDisabled = (): boolean => {
  return process.env.DISABLE_AUDIT === "true";
};

/**
 * Safe wrapper for direct prisma.auditLog operations.
 * Use this when you need to call prisma.auditLog directly outside the helper.
 * Catches all errors and logs warnings instead of crashing.
 */
export async function safeAuditLogCreate(data: Parameters<typeof prisma.auditLog.create>[0]): Promise<void> {
  if (isAuditDisabled()) {
    return;
  }
  try {
    await prisma.auditLog.create(data);
  } catch (error: any) {
    console.warn("[AuditLog] Write failed (non-fatal):", error?.message || error);
  }
}

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
  
  // Staff Management (Phase 6)
  BLOCK_STAFF: "BLOCK_STAFF",
  UNBLOCK_STAFF: "UNBLOCK_STAFF",
  CREATE_STAFF: "CREATE_STAFF",
  UPDATE_STAFF_PERMISSIONS: "UPDATE_STAFF_PERMISSIONS",
  
  // Promotion & Coupon Management (Phase 7)
  CREATE_PROMOTION: "CREATE_PROMOTION",
  UPDATE_PROMOTION: "UPDATE_PROMOTION",
  DELETE_PROMOTION: "DELETE_PROMOTION",
  FLAG_PROMOTION: "FLAG_PROMOTION",
  DISABLE_PROMOTION: "DISABLE_PROMOTION",
  CREATE_COUPON: "CREATE_COUPON",
  UPDATE_COUPON: "UPDATE_COUPON",
  DELETE_COUPON: "DELETE_COUPON",
  FLAG_COUPON: "FLAG_COUPON",
  
  // Review Management (Phase 8)
  HIDE_REVIEW: "HIDE_REVIEW",
  RESTORE_REVIEW: "RESTORE_REVIEW",
  FLAG_REVIEW: "FLAG_REVIEW",
  
  // Document Management
  DOCUMENT_REVIEW_APPROVED: "DOCUMENT_REVIEW_APPROVED",
  DOCUMENT_REVIEW_REJECTED: "DOCUMENT_REVIEW_REJECTED",
  
  // Wallet & Settlements
  WALLET_SETTLEMENT_PROCESSED: "WALLET_SETTLEMENT_PROCESSED",
  WALLET_TRANSACTION_CREATED: "WALLET_TRANSACTION_CREATED",
  VIEW_WALLET_SUMMARY: "VIEW_WALLET_SUMMARY",
  VIEW_WALLET_DETAILS: "VIEW_WALLET_DETAILS",
  UPDATE_WALLET: "UPDATE_WALLET",
  
  // User Management (sensitive operations)
  UPDATE_USER: "UPDATE_USER",
  SUSPEND_USER: "SUSPEND_USER",
  BLOCK_USER: "BLOCK_USER",
  
  // Parcel Management
  PARCEL_STATUS_UPDATED: "PARCEL_STATUS_UPDATED",
  
  // Settings
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  
  // Payout Management
  PAYOUT_ACCOUNT_CREATED: "PAYOUT_ACCOUNT_CREATED",
  PAYOUT_ACCOUNT_UPDATED: "PAYOUT_ACCOUNT_UPDATED",
  PAYOUT_ACCOUNT_SET_DEFAULT: "PAYOUT_ACCOUNT_SET_DEFAULT",
  PAYOUT_STATUS_CHANGED: "PAYOUT_STATUS_CHANGED",
  PAYOUT_BATCH_CREATED: "PAYOUT_BATCH_CREATED",
  PAYOUT_BATCH_PROCESSED: "PAYOUT_BATCH_PROCESSED",
  APPROVE_PAYOUT: "APPROVE_PAYOUT",
  REJECT_PAYOUT: "REJECT_PAYOUT",
  COMPLETE_PAYOUT: "COMPLETE_PAYOUT",
  ADJUST_WALLET_BALANCE: "ADJUST_WALLET_BALANCE",
  VIEW_PAYOUT_REQUESTS: "VIEW_PAYOUT_REQUESTS",
  
  // Step 47: Payout Scheduling & Reconciliation
  PAYOUT_SCHEDULED: "PAYOUT_SCHEDULED",
  PAYOUT_MANUAL_INITIATED: "PAYOUT_MANUAL_INITIATED",
  RECONCILIATION_INITIATED: "RECONCILIATION_INITIATED",
  RECONCILIATION_COMPLETED: "RECONCILIATION_COMPLETED",
  RECONCILIATION_MISMATCH_FOUND: "RECONCILIATION_MISMATCH_FOUND",
  
  // Support Chat
  SUPPORT_CONVERSATION_CREATED: "SUPPORT_CONVERSATION_CREATED",
  SUPPORT_CONVERSATION_ASSIGNED: "SUPPORT_CONVERSATION_ASSIGNED",
  SUPPORT_CONVERSATION_STATUS_CHANGED: "SUPPORT_CONVERSATION_STATUS_CHANGED",
  SUPPORT_CONVERSATION_UPDATED: "SUPPORT_CONVERSATION_UPDATED",
  SUPPORT_MESSAGE_SENT: "SUPPORT_MESSAGE_SENT",
  
  // Analytics
  VIEW_EARNINGS_DASHBOARD: "VIEW_EARNINGS_DASHBOARD",
  VIEW_ANALYTICS_DASHBOARD: "VIEW_ANALYTICS_DASHBOARD",
  
  // Performance & Telemetry
  VIEW_PERFORMANCE_DASHBOARD: "VIEW_PERFORMANCE_DASHBOARD",
  STABILITY_ALERT_TRIGGERED: "STABILITY_ALERT_TRIGGERED",
  
  // Admin Activity Log & Settings
  VIEW_ACTIVITY_LOG: "VIEW_ACTIVITY_LOG",
  VIEW_SETTINGS: "VIEW_SETTINGS",
  
  // RBAC v2: Risk & Safety Center actions
  RISK_EVENT_ACKNOWLEDGED: "RISK_EVENT_ACKNOWLEDGED",
  RISK_CASE_CREATED: "RISK_CASE_CREATED",
  RISK_CASE_UPDATED: "RISK_CASE_UPDATED",
  RISK_CASE_RESOLVED: "RISK_CASE_RESOLVED",
  RISK_CASE_ESCALATED: "RISK_CASE_ESCALATED",
  RISK_CASE_NOTE_ADDED: "RISK_CASE_NOTE_ADDED",
  SAFETY_ALERT_CREATED: "SAFETY_ALERT_CREATED",
  SAFETY_ALERT_RESOLVED: "SAFETY_ALERT_RESOLVED",
  
  // Phase 3A: Enterprise Admin Actions
  DATA_EXPORTED: "DATA_EXPORTED",
  SESSION_TERMINATED: "SESSION_TERMINATED",
  IP_BLOCKED: "IP_BLOCKED",
  EMERGENCY_PAUSE: "EMERGENCY_PAUSE",
  PAYMENT_FREEZE: "PAYMENT_FREEZE",
  EMERGENCY_RESUME: "EMERGENCY_RESUME",
  INCIDENT_CREATED: "INCIDENT_CREATED",
  INCIDENT_UPDATED: "INCIDENT_UPDATED",
  IMPERSONATION_STARTED: "IMPERSONATION_STARTED",
  IMPERSONATION_ENDED: "IMPERSONATION_ENDED",
  KYC_REVALIDATION_REQUESTED: "KYC_REVALIDATION_REQUESTED",
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  POLICY_PUBLISHED: "POLICY_PUBLISHED",
  BACKUP_CREATED: "BACKUP_CREATED",
  BACKUP_RESTORED: "BACKUP_RESTORED",
  AUDIT_EXPORTED: "AUDIT_EXPORTED",
  USER_BLOCKED_SAFETY: "USER_BLOCKED_SAFETY",
  
  // RBAC v2: Feature Flag actions
  FEATURE_FLAG_CREATED: "FEATURE_FLAG_CREATED",
  FEATURE_FLAG_UPDATED: "FEATURE_FLAG_UPDATED",
  FEATURE_FLAG_DELETED: "FEATURE_FLAG_DELETED",
  FEATURE_FLAG_ENABLED: "FEATURE_FLAG_ENABLED",
  FEATURE_FLAG_DISABLED: "FEATURE_FLAG_DISABLED",
  
  // Generic CRUD
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

// Entity type constants
export const EntityType = {
  DRIVER: "driver",
  CUSTOMER: "customer",
  RESTAURANT: "restaurant",
  PARCEL: "parcel",
  WALLET: "wallet",
  PAYOUT: "payout",
  PAYOUT_ACCOUNT: "payout_account",
  KYC: "kyc",
  DOCUMENT: "document",
  SETTINGS: "settings",
  AUTH: "auth",
  SUPPORT_CONVERSATION: "support_conversation",
  ANALYTICS: "analytics",
  REFERRAL_SETTING: "referral_setting",
  PERFORMANCE: "performance",
  TAX_RULE: "tax_rule",
  MENU_CATEGORY: "menu_category",
  MENU_ITEM: "menu_item",
  MENU_OPTION_GROUP: "menu_option_group",
  MENU_OPTION: "menu_option",
  PROMOTION: "promotion",
  COUPON: "coupon",
  REVIEW: "review",
  // RBAC v2: New entity types for safety & feature management
  RISK_EVENT: "risk_event",
  RISK_CASE: "risk_case",
  SAFETY_ALERT: "safety_alert",
  FEATURE_FLAG: "feature_flag",
  ADMIN_RBAC: "admin_rbac",
  // Vehicle type management
  VEHICLE_TYPE: "vehicle_type",
} as const;

interface AuditLogParams {
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  countryCode?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, any> | null;
  success?: boolean;
  environment?: string;
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
  // PRODUCTION SAFETY: Skip audit logging if disabled via env var
  if (isAuditDisabled()) {
    return;
  }
  
  try {
    const {
      actorId = null,
      actorEmail,
      actorRole,
      ipAddress = null,
      userAgent = null,
      countryCode = null,
      actionType,
      entityType,
      entityId = null,
      description,
      metadata = null,
      success = true,
      environment = process.env.NODE_ENV || "development",
    } = params;

    // Sanitize metadata to remove sensitive information
    const safeMetadata = sanitizeMetadata(metadata);

    // Create audit log entry with enhanced fields for multi-admin tracking and region scoping
    await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail,
        actorRole,
        ipAddress,
        userAgent,
        countryCode,
        actionType,
        entityType,
        entityId,
        description,
        metadata: safeMetadata || undefined,
        success,
        environment,
      },
    });
  } catch (error: any) {
    // Log error but don't throw - audit logging should never break the main flow
    // PRODUCTION SAFETY: This catch prevents audit DB issues from crashing requests
    console.warn("[AuditLog] Write failed (non-fatal):", error?.message || error);
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

/**
 * Helper to extract User-Agent from Express request
 */
export function getUserAgent(req: any): string | null {
  return req.headers?.["user-agent"] || null;
}

/**
 * Enhanced audit logging helper with request metadata extraction
 * Automatically captures IP, User-Agent, and country code from request
 */
export async function logAuditEventFromRequest(
  req: any,
  params: Omit<AuditLogParams, "ipAddress" | "userAgent">
): Promise<void> {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  
  await logAuditEvent({
    ...params,
    ipAddress,
    userAgent,
  });
}

/**
 * Menu-specific audit logging helper
 * Logs menu CRUD operations (create/update/delete) for categories, items, and options
 */
interface MenuAuditParams {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  ipAddress?: string | null;
  actionType: "create" | "update" | "delete";
  entityType: "menu_category" | "menu_item" | "menu_option_group" | "menu_option";
  entityId: string;
  restaurantId: string;
  description: string;
  metadata?: Record<string, any> | null;
}

export async function auditMenuAction(params: MenuAuditParams): Promise<void> {
  const {
    actorId,
    actorEmail,
    actorRole,
    ipAddress = null,
    actionType,
    entityType,
    entityId,
    restaurantId,
    description,
    metadata = null,
  } = params;

  // Add restaurant_id to metadata for filtering
  const enrichedMetadata = {
    ...metadata,
    restaurant_id: restaurantId,
  };

  await logAuditEvent({
    actorId,
    actorEmail,
    actorRole,
    ipAddress,
    actionType: actionType.toUpperCase(),
    entityType,
    entityId,
    description,
    metadata: enrichedMetadata,
    success: true,
  });
}
