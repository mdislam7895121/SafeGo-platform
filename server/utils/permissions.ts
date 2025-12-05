export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  COUNTRY_ADMIN = 'COUNTRY_ADMIN',
  CITY_ADMIN = 'CITY_ADMIN',
  COMPLIANCE_ADMIN = 'COMPLIANCE_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  RISK_ADMIN = 'RISK_ADMIN',
  READONLY_ADMIN = 'READONLY_ADMIN',
}

export enum Permission {
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_ACTIVITY_LOG = 'VIEW_ACTIVITY_LOG',
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
  VIEW_USER = 'VIEW_USER',
  MANAGE_USER_STATUS = 'MANAGE_USER_STATUS',
  MANAGE_DRIVERS = 'MANAGE_DRIVERS',
  VIEW_ALL_DRIVERS = 'VIEW_ALL_DRIVERS',
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
  
  // RBAC v2: Risk & Safety Center
  VIEW_RISK_CENTER = 'VIEW_RISK_CENTER',
  MANAGE_RISK_CASES = 'MANAGE_RISK_CASES',
  RESOLVE_RISK_CASES = 'RESOLVE_RISK_CASES',
  VIEW_SAFETY_EVENTS = 'VIEW_SAFETY_EVENTS',
  MANAGE_SAFETY_ALERTS = 'MANAGE_SAFETY_ALERTS',
  BLOCK_USER_SAFETY = 'BLOCK_USER_SAFETY',
  
  // RBAC v2: Feature Flags & Config
  VIEW_FEATURE_FLAGS = 'VIEW_FEATURE_FLAGS',
  MANAGE_FEATURE_FLAGS = 'MANAGE_FEATURE_FLAGS',
  VIEW_SYSTEM_CONFIG = 'VIEW_SYSTEM_CONFIG',
  MANAGE_SYSTEM_CONFIG = 'MANAGE_SYSTEM_CONFIG',
  
  // RBAC v2: People & KYC Center
  VIEW_PEOPLE_CENTER = 'VIEW_PEOPLE_CENTER',
  MANAGE_PEOPLE_CENTER = 'MANAGE_PEOPLE_CENTER',
  BULK_KYC_OPERATIONS = 'BULK_KYC_OPERATIONS',
  
  // RBAC v2: Disputes & Refunds
  VIEW_DISPUTES = 'VIEW_DISPUTES',
  MANAGE_DISPUTES = 'MANAGE_DISPUTES',
  PROCESS_REFUNDS = 'PROCESS_REFUNDS',
  ESCALATE_DISPUTES = 'ESCALATE_DISPUTES',
  
  // RBAC v2: Broadcasting
  SEND_BROADCAST = 'SEND_BROADCAST',
  MANAGE_NOTIFICATIONS = 'MANAGE_NOTIFICATIONS',
  
  // RBAC v3: Enterprise Admin Framework
  MANAGE_PERMISSION_BUNDLES = 'MANAGE_PERMISSION_BUNDLES',
  VIEW_PERMISSION_BUNDLES = 'VIEW_PERMISSION_BUNDLES',
  ASSIGN_PERMISSION_BUNDLES = 'ASSIGN_PERMISSION_BUNDLES',
  
  // RBAC v3: Emergency Lockdown
  ACTIVATE_EMERGENCY_LOCKDOWN = 'ACTIVATE_EMERGENCY_LOCKDOWN',
  DEACTIVATE_EMERGENCY_LOCKDOWN = 'DEACTIVATE_EMERGENCY_LOCKDOWN',
  VIEW_EMERGENCY_STATUS = 'VIEW_EMERGENCY_STATUS',
  
  // RBAC v3: Admin Impersonation
  IMPERSONATE_ADMIN = 'IMPERSONATE_ADMIN',
  VIEW_IMPERSONATION_LOGS = 'VIEW_IMPERSONATION_LOGS',
  REVOKE_IMPERSONATION = 'REVOKE_IMPERSONATION',
  
  // RBAC v3: Secure Messaging
  SEND_ADMIN_MESSAGE = 'SEND_ADMIN_MESSAGE',
  VIEW_ADMIN_MESSAGES = 'VIEW_ADMIN_MESSAGES',
  BROADCAST_ADMIN_MESSAGE = 'BROADCAST_ADMIN_MESSAGE',
  
  // Global Audit v2
  VIEW_AUDIT_CHAIN = 'VIEW_AUDIT_CHAIN',
  VERIFY_AUDIT_INTEGRITY = 'VERIFY_AUDIT_INTEGRITY',
  GENERATE_EVIDENCE_PACKET = 'GENERATE_EVIDENCE_PACKET',
  VIEW_EVIDENCE_PACKETS = 'VIEW_EVIDENCE_PACKETS',
  EXPORT_REGULATOR_REPORT = 'EXPORT_REGULATOR_REPORT',
  MANAGE_REGULATOR_EXPORTS = 'MANAGE_REGULATOR_EXPORTS',
  
  // People & KYC Center v2
  VIEW_IDENTITY_RISK_SCORES = 'VIEW_IDENTITY_RISK_SCORES',
  MANAGE_IDENTITY_RISK_SIGNALS = 'MANAGE_IDENTITY_RISK_SIGNALS',
  VIEW_DUPLICATE_ACCOUNTS = 'VIEW_DUPLICATE_ACCOUNTS',
  MANAGE_DUPLICATE_ACCOUNTS = 'MANAGE_DUPLICATE_ACCOUNTS',
  VIEW_SUSPICIOUS_ACTIVITY = 'VIEW_SUSPICIOUS_ACTIVITY',
  MANAGE_SUSPICIOUS_ACTIVITY = 'MANAGE_SUSPICIOUS_ACTIVITY',
  MANAGE_KYC_ENFORCEMENT_RULES = 'MANAGE_KYC_ENFORCEMENT_RULES',
  VIEW_KYC_REVIEW_QUEUE = 'VIEW_KYC_REVIEW_QUEUE',
  PROCESS_KYC_QUEUE = 'PROCESS_KYC_QUEUE',
  
  // Phase 3A: Enterprise Admin Features
  EXPORT_DATA = 'EXPORT_DATA',
  MANAGE_ADMIN_SESSIONS = 'MANAGE_ADMIN_SESSIONS',
  MANAGE_EMERGENCY_CONTROLS = 'MANAGE_EMERGENCY_CONTROLS',
  VIEW_INCIDENTS = 'VIEW_INCIDENTS',
  MANAGE_INCIDENTS = 'MANAGE_INCIDENTS',
  IMPERSONATE_USER = 'IMPERSONATE_USER',
  VIEW_COMPLIANCE = 'VIEW_COMPLIANCE',
  MANAGE_COMPLIANCE = 'MANAGE_COMPLIANCE',
  VIEW_SYSTEM_HEALTH = 'VIEW_SYSTEM_HEALTH',
  SEND_NOTIFICATIONS = 'SEND_NOTIFICATIONS',
  VIEW_PAYMENT_ISSUES = 'VIEW_PAYMENT_ISSUES',
  MANAGE_PAYMENT_ISSUES = 'MANAGE_PAYMENT_ISSUES',
  VIEW_POLICIES = 'VIEW_POLICIES',
  MANAGE_POLICIES = 'MANAGE_POLICIES',
  MANAGE_BACKUPS = 'MANAGE_BACKUPS',
  VIEW_FULL_AUDIT = 'VIEW_FULL_AUDIT',
  
  // Phase 4: Enterprise Admin Features
  VIEW_COMPLAINTS = 'VIEW_COMPLAINTS',
  MANAGE_COMPLAINTS = 'MANAGE_COMPLAINTS',
  MANAGE_BILLING = 'MANAGE_BILLING',
  VIEW_LEGAL_REQUESTS = 'VIEW_LEGAL_REQUESTS',
  MANAGE_LEGAL_REQUESTS = 'MANAGE_LEGAL_REQUESTS',
  VIEW_ANNOUNCEMENTS = 'VIEW_ANNOUNCEMENTS',
  MANAGE_ANNOUNCEMENTS = 'MANAGE_ANNOUNCEMENTS',
  MANAGE_TEMPLATES = 'MANAGE_TEMPLATES',
  VIEW_SAFETY_INCIDENTS = 'VIEW_SAFETY_INCIDENTS',
  MANAGE_SAFETY_INCIDENTS = 'MANAGE_SAFETY_INCIDENTS',
  MANAGE_GEOFENCES = 'MANAGE_GEOFENCES',
  VIEW_DOCUMENTS = 'VIEW_DOCUMENTS',
  MANAGE_DOCUMENTS = 'MANAGE_DOCUMENTS',
  
  // Global Admin Settings & Safety Locks
  VIEW_GLOBAL_SETTINGS = 'VIEW_GLOBAL_SETTINGS',
  MANAGE_GLOBAL_SETTINGS = 'MANAGE_GLOBAL_SETTINGS',
  MANAGE_SENSITIVE_SETTINGS = 'MANAGE_SENSITIVE_SETTINGS',
  VIEW_SETTING_HISTORY = 'VIEW_SETTING_HISTORY',
  
  // Legal & Compliance Data Export Center
  VIEW_COMPLIANCE_EXPORTS = 'VIEW_COMPLIANCE_EXPORTS',
  CREATE_COMPLIANCE_EXPORT = 'CREATE_COMPLIANCE_EXPORT',
  APPROVE_COMPLIANCE_EXPORT = 'APPROVE_COMPLIANCE_EXPORT',
  DOWNLOAD_COMPLIANCE_EXPORT = 'DOWNLOAD_COMPLIANCE_EXPORT',
  MANAGE_RETENTION_POLICIES = 'MANAGE_RETENTION_POLICIES',
  VIEW_EXPORT_AUDIT_LOGS = 'VIEW_EXPORT_AUDIT_LOGS',
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
    Permission.VIEW_ALL_DRIVERS,
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
    // RBAC v2: All new permissions for SUPER_ADMIN
    Permission.VIEW_RISK_CENTER,
    Permission.MANAGE_RISK_CASES,
    Permission.RESOLVE_RISK_CASES,
    Permission.VIEW_SAFETY_EVENTS,
    Permission.MANAGE_SAFETY_ALERTS,
    Permission.BLOCK_USER_SAFETY,
    Permission.VIEW_FEATURE_FLAGS,
    Permission.MANAGE_FEATURE_FLAGS,
    Permission.VIEW_SYSTEM_CONFIG,
    Permission.MANAGE_SYSTEM_CONFIG,
    Permission.VIEW_PEOPLE_CENTER,
    Permission.MANAGE_PEOPLE_CENTER,
    Permission.BULK_KYC_OPERATIONS,
    Permission.VIEW_DISPUTES,
    Permission.MANAGE_DISPUTES,
    Permission.PROCESS_REFUNDS,
    Permission.ESCALATE_DISPUTES,
    Permission.SEND_BROADCAST,
    Permission.MANAGE_NOTIFICATIONS,
    // RBAC v3: Enterprise Admin Framework
    Permission.MANAGE_PERMISSION_BUNDLES,
    Permission.VIEW_PERMISSION_BUNDLES,
    Permission.ASSIGN_PERMISSION_BUNDLES,
    Permission.ACTIVATE_EMERGENCY_LOCKDOWN,
    Permission.DEACTIVATE_EMERGENCY_LOCKDOWN,
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.IMPERSONATE_ADMIN,
    Permission.VIEW_IMPERSONATION_LOGS,
    Permission.REVOKE_IMPERSONATION,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    Permission.BROADCAST_ADMIN_MESSAGE,
    // Global Audit v2
    Permission.VIEW_AUDIT_CHAIN,
    Permission.VERIFY_AUDIT_INTEGRITY,
    Permission.GENERATE_EVIDENCE_PACKET,
    Permission.VIEW_EVIDENCE_PACKETS,
    Permission.EXPORT_REGULATOR_REPORT,
    Permission.MANAGE_REGULATOR_EXPORTS,
    // People & KYC Center v2
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.MANAGE_IDENTITY_RISK_SIGNALS,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.MANAGE_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.MANAGE_SUSPICIOUS_ACTIVITY,
    Permission.MANAGE_KYC_ENFORCEMENT_RULES,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    Permission.PROCESS_KYC_QUEUE,
    // Phase 3A: Enterprise Admin Features
    Permission.EXPORT_DATA,
    Permission.MANAGE_ADMIN_SESSIONS,
    Permission.MANAGE_EMERGENCY_CONTROLS,
    Permission.VIEW_INCIDENTS,
    Permission.MANAGE_INCIDENTS,
    Permission.IMPERSONATE_USER,
    Permission.VIEW_COMPLIANCE,
    Permission.MANAGE_COMPLIANCE,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.SEND_NOTIFICATIONS,
    Permission.VIEW_PAYMENT_ISSUES,
    Permission.MANAGE_PAYMENT_ISSUES,
    Permission.VIEW_POLICIES,
    Permission.MANAGE_POLICIES,
    Permission.MANAGE_BACKUPS,
    Permission.VIEW_FULL_AUDIT,
    // Phase 4: Enterprise Admin Features
    Permission.VIEW_COMPLAINTS,
    Permission.MANAGE_COMPLAINTS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_LEGAL_REQUESTS,
    Permission.MANAGE_LEGAL_REQUESTS,
    Permission.VIEW_ANNOUNCEMENTS,
    Permission.MANAGE_ANNOUNCEMENTS,
    Permission.MANAGE_TEMPLATES,
    Permission.VIEW_SAFETY_INCIDENTS,
    Permission.MANAGE_SAFETY_INCIDENTS,
    Permission.MANAGE_GEOFENCES,
    Permission.VIEW_DOCUMENTS,
    Permission.MANAGE_DOCUMENTS,
    // Global Admin Settings & Safety Locks
    Permission.VIEW_GLOBAL_SETTINGS,
    Permission.MANAGE_GLOBAL_SETTINGS,
    Permission.MANAGE_SENSITIVE_SETTINGS,
    Permission.VIEW_SETTING_HISTORY,
    // Legal & Compliance Data Export Center
    Permission.VIEW_COMPLIANCE_EXPORTS,
    Permission.CREATE_COMPLIANCE_EXPORT,
    Permission.APPROVE_COMPLIANCE_EXPORT,
    Permission.DOWNLOAD_COMPLIANCE_EXPORT,
    Permission.MANAGE_RETENTION_POLICIES,
    Permission.VIEW_EXPORT_AUDIT_LOGS,
  ]),

  // ADMIN: General management (non-sensitive)
  [AdminRole.ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_USER,
    Permission.MANAGE_USER_STATUS,
    Permission.VIEW_ALL_DRIVERS,
    Permission.VIEW_PARCELS,
    Permission.MANAGE_PARCELS,
    Permission.MANAGE_PARCELS_STATUS,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_PAYOUTS,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.REPLY_SUPPORT_CONVERSATIONS,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    Permission.VIEW_PERFORMANCE_DASHBOARD,
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_LIVE_MAP,
    Permission.VIEW_FRAUD_ALERTS,
    Permission.VIEW_RISK_CENTER,
    Permission.VIEW_SAFETY_EVENTS,
    Permission.VIEW_PEOPLE_CENTER,
    Permission.VIEW_DISPUTES,
    // RBAC v3: Limited admin framework access
    Permission.VIEW_PERMISSION_BUNDLES,
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: View only
    Permission.VIEW_AUDIT_CHAIN,
    Permission.VIEW_EVIDENCE_PACKETS,
    // People v2: View only
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    // Phase 3A: Enterprise Admin Features (View-only for general ADMIN)
    Permission.EXPORT_DATA,
    Permission.VIEW_INCIDENTS,
    Permission.VIEW_COMPLIANCE,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.VIEW_PAYMENT_ISSUES,
    Permission.VIEW_POLICIES,
    Permission.VIEW_FULL_AUDIT,
  ]),

  // COUNTRY_ADMIN: Regional management
  [AdminRole.COUNTRY_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_AUDIT_LOG,
    Permission.VIEW_USER,
    Permission.MANAGE_USER_STATUS,
    Permission.MANAGE_DRIVERS,
    Permission.VIEW_ALL_DRIVERS,
    Permission.MANAGE_CUSTOMERS,
    Permission.MANAGE_RESTAURANTS,
    Permission.MANAGE_KYC,
    Permission.MANAGE_DOCUMENT_REVIEW,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.PROCESS_WALLET_SETTLEMENT,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_PARCELS,
    Permission.MANAGE_PARCELS,
    Permission.MANAGE_PARCELS_STATUS,
    Permission.VIEW_PAYOUTS,
    Permission.PROCESS_PAYOUTS,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.REPLY_SUPPORT_CONVERSATIONS,
    Permission.ASSIGN_SUPPORT_CONVERSATIONS,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    Permission.VIEW_PERFORMANCE_DASHBOARD,
    Permission.MODERATE_PROMOTIONS,
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_LIVE_MAP,
    Permission.VIEW_REVENUE_ANALYTICS,
    Permission.VIEW_FRAUD_ALERTS,
    Permission.MANAGE_FRAUD_ALERTS,
    Permission.VIEW_RISK_CENTER,
    Permission.MANAGE_RISK_CASES,
    Permission.VIEW_SAFETY_EVENTS,
    Permission.VIEW_PEOPLE_CENTER,
    Permission.MANAGE_PEOPLE_CENTER,
    Permission.VIEW_DISPUTES,
    Permission.MANAGE_DISPUTES,
    // RBAC v3: Country admin has enhanced access
    Permission.VIEW_PERMISSION_BUNDLES,
    Permission.ACTIVATE_EMERGENCY_LOCKDOWN,
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: Can generate reports
    Permission.VIEW_AUDIT_CHAIN,
    Permission.GENERATE_EVIDENCE_PACKET,
    Permission.VIEW_EVIDENCE_PACKETS,
    Permission.EXPORT_REGULATOR_REPORT,
    // People v2: Full access
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.MANAGE_IDENTITY_RISK_SIGNALS,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.MANAGE_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.MANAGE_SUSPICIOUS_ACTIVITY,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    Permission.PROCESS_KYC_QUEUE,
    // Phase 3A: Country Admin has enhanced enterprise access
    Permission.EXPORT_DATA,
    Permission.MANAGE_ADMIN_SESSIONS,
    Permission.MANAGE_EMERGENCY_CONTROLS,
    Permission.VIEW_INCIDENTS,
    Permission.MANAGE_INCIDENTS,
    Permission.IMPERSONATE_USER,
    Permission.VIEW_COMPLIANCE,
    Permission.MANAGE_COMPLIANCE,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.SEND_NOTIFICATIONS,
    Permission.VIEW_PAYMENT_ISSUES,
    Permission.MANAGE_PAYMENT_ISSUES,
    Permission.VIEW_POLICIES,
    Permission.MANAGE_POLICIES,
    Permission.VIEW_FULL_AUDIT,
  ]),

  // CITY_ADMIN: City-level management
  [AdminRole.CITY_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_USER,
    Permission.MANAGE_USER_STATUS,
    Permission.VIEW_ALL_DRIVERS,
    Permission.VIEW_PARCELS,
    Permission.MANAGE_PARCELS,
    Permission.MANAGE_PARCELS_STATUS,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.VIEW_COMMISSION_ANALYTICS,
    Permission.VIEW_PAYOUTS,
    Permission.VIEW_PAYOUT_BATCHES,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.REPLY_SUPPORT_CONVERSATIONS,
    Permission.VIEW_EARNINGS_DASHBOARD,
    Permission.VIEW_ANALYTICS_DASHBOARD,
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_LIVE_MAP,
    Permission.VIEW_FRAUD_ALERTS,
    Permission.VIEW_RISK_CENTER,
    Permission.VIEW_SAFETY_EVENTS,
    Permission.VIEW_PEOPLE_CENTER,
    Permission.VIEW_DISPUTES,
    // RBAC v3: City admin limited access
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: View only
    Permission.VIEW_AUDIT_CHAIN,
    Permission.VIEW_EVIDENCE_PACKETS,
    // People v2: View only
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.VIEW_KYC_REVIEW_QUEUE,
  ]),

  [AdminRole.COMPLIANCE_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_USER,
    Permission.MANAGE_DRIVERS,
    Permission.VIEW_ALL_DRIVERS,
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
    // RBAC v2: Compliance gets full KYC/People center access
    Permission.VIEW_PEOPLE_CENTER,
    Permission.MANAGE_PEOPLE_CENTER,
    Permission.BULK_KYC_OPERATIONS,
    Permission.VIEW_RISK_CENTER,
    Permission.VIEW_SAFETY_EVENTS,
    // RBAC v3: Compliance has audit and KYC enforcement
    Permission.VIEW_PERMISSION_BUNDLES,
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: Full compliance audit access
    Permission.VIEW_AUDIT_CHAIN,
    Permission.VERIFY_AUDIT_INTEGRITY,
    Permission.GENERATE_EVIDENCE_PACKET,
    Permission.VIEW_EVIDENCE_PACKETS,
    Permission.EXPORT_REGULATOR_REPORT,
    Permission.MANAGE_REGULATOR_EXPORTS,
    // People v2: Full compliance access
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.MANAGE_IDENTITY_RISK_SIGNALS,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.MANAGE_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.MANAGE_SUSPICIOUS_ACTIVITY,
    Permission.MANAGE_KYC_ENFORCEMENT_RULES,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    Permission.PROCESS_KYC_QUEUE,
    // Phase 3A: Compliance Admin has full compliance access
    Permission.EXPORT_DATA,
    Permission.VIEW_INCIDENTS,
    Permission.MANAGE_INCIDENTS,
    Permission.VIEW_COMPLIANCE,
    Permission.MANAGE_COMPLIANCE,
    Permission.VIEW_POLICIES,
    Permission.MANAGE_POLICIES,
    Permission.VIEW_FULL_AUDIT,
    // Legal & Compliance Data Export Center
    Permission.VIEW_COMPLIANCE_EXPORTS,
    Permission.CREATE_COMPLIANCE_EXPORT,
    Permission.APPROVE_COMPLIANCE_EXPORT,
    Permission.DOWNLOAD_COMPLIANCE_EXPORT,
    Permission.MANAGE_RETENTION_POLICIES,
    Permission.VIEW_EXPORT_AUDIT_LOGS,
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
    // RBAC v2: Support gets dispute handling
    Permission.VIEW_DISPUTES,
    Permission.MANAGE_DISPUTES,
    Permission.PROCESS_REFUNDS,
    Permission.ESCALATE_DISPUTES,
    Permission.VIEW_PEOPLE_CENTER,
    // RBAC v3: Support messaging
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // People v2: View only for support context
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    // Phase 3A: Support Admin has impersonation and incident view access
    Permission.IMPERSONATE_USER,
    Permission.VIEW_INCIDENTS,
    Permission.VIEW_SUPPORT_CONVERSATIONS,
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
    // RBAC v3: Finance messaging
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: Financial audit access
    Permission.VIEW_AUDIT_CHAIN,
    Permission.GENERATE_EVIDENCE_PACKET,
    Permission.VIEW_EVIDENCE_PACKETS,
    Permission.EXPORT_REGULATOR_REPORT,
    // Phase 3A: Finance Admin has payment and export access
    Permission.EXPORT_DATA,
    Permission.VIEW_PAYMENT_ISSUES,
    Permission.MANAGE_PAYMENT_ISSUES,
    Permission.VIEW_FULL_AUDIT,
    // Global Admin Settings (read-only)
    Permission.VIEW_GLOBAL_SETTINGS,
    Permission.VIEW_SETTING_HISTORY,
  ]),

  // RISK_ADMIN: Safety & Risk Center focused
  [AdminRole.RISK_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.VIEW_AUDIT_LOG,
    Permission.VIEW_USER,
    Permission.MANAGE_USER_STATUS,
    Permission.VIEW_ALL_DRIVERS,
    Permission.VIEW_PARCELS,
    Permission.VIEW_WALLET_SUMMARY,
    Permission.VIEW_SETTINGS,
    // Risk & Safety permissions (full access)
    Permission.VIEW_RISK_CENTER,
    Permission.MANAGE_RISK_CASES,
    Permission.RESOLVE_RISK_CASES,
    Permission.VIEW_SAFETY_EVENTS,
    Permission.MANAGE_SAFETY_ALERTS,
    Permission.BLOCK_USER_SAFETY,
    // Fraud permissions (full access)
    Permission.VIEW_FRAUD_ALERTS,
    Permission.MANAGE_FRAUD_ALERTS,
    Permission.RESOLVE_FRAUD_ALERTS,
    // Monitoring permissions
    Permission.VIEW_REALTIME_MONITORING,
    Permission.VIEW_LIVE_MAP,
    Permission.VIEW_PERFORMANCE_DASHBOARD,
    // Read-only access to other areas
    Permission.VIEW_SUPPORT_CONVERSATIONS,
    Permission.VIEW_PEOPLE_CENTER,
    Permission.VIEW_DISPUTES,
    // RBAC v3: Risk admin gets enhanced access
    Permission.VIEW_PERMISSION_BUNDLES,
    Permission.ACTIVATE_EMERGENCY_LOCKDOWN,
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.SEND_ADMIN_MESSAGE,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: Full risk audit access
    Permission.VIEW_AUDIT_CHAIN,
    Permission.VERIFY_AUDIT_INTEGRITY,
    Permission.GENERATE_EVIDENCE_PACKET,
    Permission.VIEW_EVIDENCE_PACKETS,
    Permission.EXPORT_REGULATOR_REPORT,
    // People v2: Full risk access
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.MANAGE_IDENTITY_RISK_SIGNALS,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.MANAGE_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.MANAGE_SUSPICIOUS_ACTIVITY,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    // Phase 3A: Risk Admin has security and fraud access
    Permission.MANAGE_ADMIN_SESSIONS,
    Permission.MANAGE_EMERGENCY_CONTROLS,
    Permission.VIEW_INCIDENTS,
    Permission.MANAGE_INCIDENTS,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.VIEW_FULL_AUDIT,
    // Global Admin Settings (read-only)
    Permission.VIEW_GLOBAL_SETTINGS,
    Permission.VIEW_SETTING_HISTORY,
  ]),

  [AdminRole.READONLY_ADMIN]: new Set([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_USER,
    Permission.VIEW_ALL_DRIVERS,
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
    // RBAC v2: Read-only access to new features
    Permission.VIEW_RISK_CENTER,
    Permission.VIEW_SAFETY_EVENTS,
    Permission.VIEW_PEOPLE_CENTER,
    Permission.VIEW_DISPUTES,
    Permission.VIEW_FEATURE_FLAGS,
    // RBAC v3: Read-only view
    Permission.VIEW_PERMISSION_BUNDLES,
    Permission.VIEW_EMERGENCY_STATUS,
    Permission.VIEW_ADMIN_MESSAGES,
    // Audit v2: Read-only
    Permission.VIEW_AUDIT_CHAIN,
    Permission.VIEW_EVIDENCE_PACKETS,
    // People v2: Read-only
    Permission.VIEW_IDENTITY_RISK_SCORES,
    Permission.VIEW_DUPLICATE_ACCOUNTS,
    Permission.VIEW_SUSPICIOUS_ACTIVITY,
    Permission.VIEW_KYC_REVIEW_QUEUE,
    // Phase 3A: Limited read-only view access (excludes sensitive audit data)
    Permission.VIEW_INCIDENTS,
    Permission.VIEW_COMPLIANCE,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.VIEW_PAYMENT_ISSUES,
    Permission.VIEW_POLICIES,
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

export const roleHierarchy: Record<AdminRole, { level: number; canManage: AdminRole[]; scope: 'global' | 'country' | 'regional' }> = {
  [AdminRole.SUPER_ADMIN]: { level: 1, canManage: [AdminRole.ADMIN, AdminRole.COUNTRY_ADMIN, AdminRole.CITY_ADMIN, AdminRole.COMPLIANCE_ADMIN, AdminRole.SUPPORT_ADMIN, AdminRole.FINANCE_ADMIN, AdminRole.RISK_ADMIN, AdminRole.READONLY_ADMIN], scope: 'global' },
  [AdminRole.ADMIN]: { level: 2, canManage: [AdminRole.COUNTRY_ADMIN, AdminRole.CITY_ADMIN, AdminRole.SUPPORT_ADMIN, AdminRole.READONLY_ADMIN], scope: 'global' },
  [AdminRole.COUNTRY_ADMIN]: { level: 3, canManage: [AdminRole.CITY_ADMIN, AdminRole.SUPPORT_ADMIN, AdminRole.READONLY_ADMIN], scope: 'country' },
  [AdminRole.CITY_ADMIN]: { level: 4, canManage: [AdminRole.SUPPORT_ADMIN, AdminRole.READONLY_ADMIN], scope: 'regional' },
  [AdminRole.COMPLIANCE_ADMIN]: { level: 3, canManage: [], scope: 'global' },
  [AdminRole.SUPPORT_ADMIN]: { level: 5, canManage: [AdminRole.READONLY_ADMIN], scope: 'country' },
  [AdminRole.FINANCE_ADMIN]: { level: 4, canManage: [], scope: 'global' },
  [AdminRole.RISK_ADMIN]: { level: 4, canManage: [], scope: 'global' },
  [AdminRole.READONLY_ADMIN]: { level: 6, canManage: [], scope: 'regional' },
};

export function getRoleDescription(role: AdminRole): string {
  const descriptions: Record<AdminRole, string> = {
    [AdminRole.SUPER_ADMIN]: 'Full system access with all permissions across all countries and services',
    [AdminRole.ADMIN]: 'Platform administration with extensive permissions for general management',
    [AdminRole.COUNTRY_ADMIN]: 'Country-level administration and oversight for a specific region',
    [AdminRole.CITY_ADMIN]: 'City-level management with local operations focus',
    [AdminRole.COMPLIANCE_ADMIN]: 'KYC verification, document review, and regulatory compliance',
    [AdminRole.SUPPORT_ADMIN]: 'Customer and driver support, ticket management, and escalations',
    [AdminRole.FINANCE_ADMIN]: 'Financial operations, payouts, commissions, and settlements',
    [AdminRole.RISK_ADMIN]: 'Fraud detection, risk assessment, and safety monitoring',
    [AdminRole.READONLY_ADMIN]: 'View-only access for monitoring and reporting purposes',
  };
  return descriptions[role] || `${role} role`;
}

export function getRolePermissions(role: AdminRole): Set<Permission> {
  return rolePermissions[role] || new Set();
}
