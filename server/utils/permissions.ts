export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPLIANCE_ADMIN = 'COMPLIANCE_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  READONLY_ADMIN = 'READONLY_ADMIN',
}

export enum Permission {
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_ACTIVITY_LOG = 'VIEW_ACTIVITY_LOG',
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
  VIEW_USER = 'VIEW_USER',
  MANAGE_USER_STATUS = 'MANAGE_USER_STATUS',
  MANAGE_DRIVERS = 'MANAGE_DRIVERS',
  MANAGE_CUSTOMERS = 'MANAGE_CUSTOMERS',
  MANAGE_RESTAURANTS = 'MANAGE_RESTAURANTS',
  MANAGE_DRIVER_KYC = 'MANAGE_DRIVER_KYC',
  MANAGE_CUSTOMER_KYC = 'MANAGE_CUSTOMER_KYC',
  MANAGE_RESTAURANT_KYC = 'MANAGE_RESTAURANT_KYC',
  MANAGE_KYC = 'MANAGE_KYC',
  MANAGE_DOCUMENT_REVIEW = 'MANAGE_DOCUMENT_REVIEW',
  VIEW_WALLET_SUMMARY = 'VIEW_WALLET_SUMMARY',
  PROCESS_WALLET_SETTLEMENT = 'PROCESS_WALLET_SETTLEMENT',
  EDIT_COMMISSION_SETTINGS = 'EDIT_COMMISSION_SETTINGS',
  MANAGE_COMMISSIONS = 'MANAGE_COMMISSIONS',
  VIEW_COMMISSION_ANALYTICS = 'VIEW_COMMISSION_ANALYTICS',
  VIEW_PARCELS = 'VIEW_PARCELS',
  MANAGE_PARCELS = 'MANAGE_PARCELS',
  MANAGE_PARCELS_STATUS = 'MANAGE_PARCELS_STATUS',
  MANAGE_PAYOUTS = 'MANAGE_PAYOUTS',
  VIEW_PAYOUTS = 'VIEW_PAYOUTS',
  PROCESS_PAYOUTS = 'PROCESS_PAYOUTS',
  CREATE_MANUAL_PAYOUT = 'CREATE_MANUAL_PAYOUT',
  VIEW_PAYOUT_BATCHES = 'VIEW_PAYOUT_BATCHES',
  VIEW_SETTINGS = 'VIEW_SETTINGS',
  EDIT_SETTINGS = 'EDIT_SETTINGS',
  VIEW_SECURITY_SETTINGS = 'VIEW_SECURITY_SETTINGS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  CREATE_ADMIN = 'CREATE_ADMIN',
  EDIT_ADMIN = 'EDIT_ADMIN',
  VIEW_ADMIN_LIST = 'VIEW_ADMIN_LIST',
  VIEW_SUPPORT_CONVERSATIONS = 'VIEW_SUPPORT_CONVERSATIONS',
  REPLY_SUPPORT_CONVERSATIONS = 'REPLY_SUPPORT_CONVERSATIONS',
  ASSIGN_SUPPORT_CONVERSATIONS = 'ASSIGN_SUPPORT_CONVERSATIONS',
  MANAGE_SUPPORT_SETTINGS = 'MANAGE_SUPPORT_SETTINGS',
  VIEW_EARNINGS_DASHBOARD = 'VIEW_EARNINGS_DASHBOARD',
  VIEW_ANALYTICS_DASHBOARD = 'VIEW_ANALYTICS_DASHBOARD',
  VIEW_PERFORMANCE_DASHBOARD = 'VIEW_PERFORMANCE_DASHBOARD',
  MODERATE_PROMOTIONS = 'MODERATE_PROMOTIONS',
  MANAGE_RESTAURANT_PROFILES = 'MANAGE_RESTAURANT_PROFILES',
  
  // Phase 4: Admin Monitoring & Analytics
  VIEW_REALTIME_MONITORING = 'VIEW_REALTIME_MONITORING',
  VIEW_LIVE_MAP = 'VIEW_LIVE_MAP',
  VIEW_REVENUE_ANALYTICS = 'VIEW_REVENUE_ANALYTICS',
  EXPORT_ANALYTICS = 'EXPORT_ANALYTICS',
  
  // Phase 4: Fraud Detection
  VIEW_FRAUD_ALERTS = 'VIEW_FRAUD_ALERTS',
  MANAGE_FRAUD_ALERTS = 'MANAGE_FRAUD_ALERTS',
  RESOLVE_FRAUD_ALERTS = 'RESOLVE_FRAUD_ALERTS',
}

type RolePermissions = {
  [key in AdminRole]: Set<Permission>;
};

const rolePermissions: RolePermissions = {
  [AdminRole.SUPER_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_AUDIT_LOG,
    Permission.VIEW_USER,
    Permission.MANAGE_USER_STATUS,
    Permission.MANAGE_DRIVERS,
    Permission.MANAGE_CUSTOMERS,
    Permission.MANAGE_RESTAURANTS,
    Permission.MANAGE_DRIVER_KYC,
    Permission.MANAGE_CUSTOMER_KYC,
    Permission.MANAGE_RESTAURANT_KYC,
    Permission.MANAGE_KYC,
    Permission.MANAGE_DOCUMENT_REVIEW,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.PROCESS_WALLET_SETTLEMENT,
    Permission.EDIT_COMMISSION_SETTINGS,
    Permission.MANAGE_COMMISSIONS,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_PARCELS,
    Permission.MANAGE_PARCELS,
    Permission.MANAGE_PARCELS_STATUS,
    Permission.MANAGE_PAYOUTS,
    Permission.VIEW_PAYOUTS,
    Permission.PROCESS_PAYOUTS,
    Permission.CREATE_MANUAL_PAYOUT,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_SETTINGS,
    Permission.VIEW_SECURITY_SETTINGS,
    Permission.MANAGE_ROLES,
    Permission.CREATE_ADMIN,
    Permission.EDIT_ADMIN,
    Permission.VIEW_ADMIN_LIST,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.REPLY_SUPPORT_CONVERSATIONS,
    Permission.ASSIGN_SUPPORT_CONVERSATIONS,
    Permission.MANAGE_SUPPORT_SETTINGS,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    Permission.VIEW_PERFORMANCE_DASHBOARD,
    Permission.MODERATE_PROMOTIONS,
    Permission.MANAGE_RESTAURANT_PROFILES,
    // Phase 4 permissions
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_LIVE_MAP,
    Permission.VIEW_REVENUE_ANALYTICS,
    Permission.EXPORT_ANALYTICS,
    Permission.VIEW_FRAUD_ALERTS,
    Permission.MANAGE_FRAUD_ALERTS,
    Permission.RESOLVE_FRAUD_ALERTS,
  ]),

  [AdminRole.COMPLIANCE_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_USER,
    Permission.MANAGE_DRIVERS,
    Permission.MANAGE_CUSTOMERS,
    Permission.MANAGE_RESTAURANTS,
    Permission.MANAGE_DRIVER_KYC,
    Permission.MANAGE_CUSTOMER_KYC,
    Permission.MANAGE_RESTAURANT_KYC,
    Permission.MANAGE_KYC,
    Permission.MANAGE_DOCUMENT_REVIEW,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_AUDIT_LOG,
    Permission.VIEW_PARCELS,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_PAYOUTS,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    Permission.VIEW_PERFORMANCE_DASHBOARD,
    Permission.MODERATE_PROMOTIONS,
    Permission.MANAGE_RESTAURANT_PROFILES,
    // Phase 4 permissions (Compliance can view alerts)
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_FRAUD_ALERTS,
    Permission.MANAGE_FRAUD_ALERTS,
    Permission.RESOLVE_FRAUD_ALERTS,
  ]),

  [AdminRole.SUPPORT_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_USER,
    Permission.MANAGE_USER_STATUS,
    Permission.VIEW_PARCELS,
    Permission.MANAGE_PARCELS,
    Permission.MANAGE_PARCELS_STATUS,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.REPLY_SUPPORT_CONVERSATIONS,
    Permission.ASSIGN_SUPPORT_CONVERSATIONS,
  ]),

  [AdminRole.FINANCE_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.PROCESS_WALLET_SETTLEMENT,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.EDIT_COMMISSION_SETTINGS,
    Permission.MANAGE_COMMISSIONS,
    Permission.MANAGE_PAYOUTS,
    Permission.VIEW_PAYOUTS,
    Permission.PROCESS_PAYOUTS,
    Permission.CREATE_MANUAL_PAYOUT,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_PARCELS,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_AUDIT_LOG,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    // Phase 4 permissions (Finance sees revenue analytics)
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_REVENUE_ANALYTICS,
    Permission.EXPORT_ANALYTICS,
  ]),

  [AdminRole.READONLY_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_USER,
    Permission.VIEW_PARCELS,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_PAYOUTS,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_AUDIT_LOG,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    // Phase 4 permissions (read-only view)
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_REVENUE_ANALYTICS,
    Permission.VIEW_FRAUD_ALERTS,
  ]),
};

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  adminProfile?: {
    adminRole: AdminRole;
    isActive: boolean;
  } | null;
}

export function canPerform(
  adminUser: AdminUser | null | undefined,
  permission: Permission
): boolean {
  if (!adminUser) {
    return false;
  }

  if (!adminUser.adminProfile) {
    return false;
  }

  if (!adminUser.adminProfile.isActive) {
    return false;
  }

  const adminRole = adminUser.adminProfile.adminRole;
  const permissions = rolePermissions[adminRole];

  if (!permissions) {
    return false;
  }

  return permissions.has(permission);
}

export function requirePermission(
  adminUser: AdminUser | null | undefined,
  permission: Permission
): void {
  if (!canPerform(adminUser, permission)) {
    const error = new Error('You do not have permission to perform this action.');
    (error as any).statusCode = 403;
    throw error;
  }
}

export function getAdminCapabilities(adminUser: AdminUser | null | undefined): string[] {
  if (!adminUser?.adminProfile?.isActive) {
    return [];
  }

  const adminRole = adminUser.adminProfile.adminRole;
  const permissions = rolePermissions[adminRole];

  if (!permissions) {
    return [];
  }

  return Array.from(permissions);
}
