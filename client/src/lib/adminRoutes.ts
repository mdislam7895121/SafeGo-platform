/**
 * Centralized Admin Routes Configuration
 * Single source of truth for all admin route paths
 */

export const ADMIN_ROUTES = {
  // Core
  DASHBOARD: "/admin",
  HOME: "/admin/home",
  SETTINGS: "/admin/settings",
  GLOBAL_SETTINGS: "/admin/global-settings",

  // Overview
  PEOPLE_KYC: "/admin/people-kyc",
  USERS: "/admin/users",
  DRIVERS: "/admin/drivers",
  DRIVER_DETAILS: "/admin/drivers/:id",
  CUSTOMERS: "/admin/customers",
  CUSTOMER_DETAILS: "/admin/customers/:id",
  RESTAURANTS: "/admin/restaurants",
  RESTAURANT_DETAILS: "/admin/restaurants/:id",
  PARCELS: "/admin/parcels",

  // Management
  KYC: "/admin/kyc",
  WALLETS: "/admin/wallets",
  WALLET_DETAILS: "/admin/wallets/:id",
  PAYOUTS: "/admin/payouts",
  PAYOUT_CENTER: "/admin/payout-center",
  EARNINGS: "/admin/earnings",

  // Security
  SAFETY_CENTER: "/admin/safety-center",
  FRAUD_ALERTS: "/admin/fraud-alerts",
  SECURITY_CENTER: "/admin/security-center",
  ACTIVITY_LOG: "/admin/activity-log",
  ACCESS_REVIEWS: "/admin/access-reviews",
  FRAUD_DETECTION: "/admin/fraud-detection",
  SESSION_SECURITY: "/admin/session-security",
  EMERGENCY_CONTROLS: "/admin/emergency-controls",
  INCIDENT_RESPONSE: "/admin/incident-response",

  // Config
  FEATURE_FLAGS: "/admin/feature-flags",
  CMS_PAGES: "/admin/cms-pages",
  LANDING_CMS: "/admin/landing-cms",
  RELEASES: "/admin/releases",
  POLICY_MANAGER: "/admin/policy-manager",
  BACKUP_RECOVERY: "/admin/backup-recovery",
  
  // Regional
  BD_EXPANSION: "/admin/bd-expansion",

  // Phase 3a
  ENTERPRISE_SEARCH: "/admin/enterprise-search",
  EXPORT_CENTER: "/admin/export-center",
  CUSTOMER_SUPPORT_PANEL: "/admin/customer-support-panel",
  CONTACT_CENTER: "/admin/contact-center",
  ONBOARDING_DRIVERS: "/admin/onboarding/drivers",
  ONBOARDING_RESTAURANTS: "/admin/onboarding/restaurants",
  ONBOARDING_SHOPS: "/admin/onboarding/shops",
  ONBOARDING_TICKETS: "/admin/onboarding/tickets",
  ONBOARDING_CENTER: "/admin/onboarding-center",
  ONBOARDING_OVERVIEW: "/admin/onboarding-overview",
  COMPLIANCE_CENTER: "/admin/compliance-center",
  DATA_GOVERNANCE: "/admin/data-governance",
  HEALTH_MONITOR: "/admin/health-monitor",
  PUSH_NOTIFICATIONS: "/admin/push-notifications",
  PAYMENT_VERIFICATION: "/admin/payment-verification",
  AUDIT_CONSOLE: "/admin/audit-console",
  SYSTEM_HEALTH_CENTER: "/admin/system-health-center",
  SYSTEM_HEALTH: "/admin/system-health",
  LAUNCH_READINESS: "/admin/launch-readiness",

  // Phase 3c
  OPERATIONS_CENTER: "/admin/operations-center",
  OBSERVABILITY: "/admin/observability",
  INTELLIGENCE: "/admin/intelligence",

  // Finance
  FINANCE: "/admin/finance",
  FINANCE_OVERVIEW: "/admin/finance/overview",
  FINANCE_GATEWAY_REPORTS: "/admin/finance/gateway-reports",
  FINANCE_DRIVER_BALANCES: "/admin/finance/driver-balances",
  FINANCE_RESTAURANT_BALANCES: "/admin/finance/restaurant-balances",
  FINANCE_SETTLEMENTS: "/admin/finance/settlements",
  SETTLEMENT: "/admin/settlement",

  // SafePilot & Intelligence
  SAFEPILOT: "/admin/safepilot",
  RATINGS_CENTER: "/admin/ratings-center",
  
  // Operations
  DRIVER_VIOLATIONS: "/admin/driver-violations",
  EARNINGS_DISPUTES: "/admin/earnings-disputes",
  RIDE_TIMELINE: "/admin/ride-timeline",
  NOTIFICATION_RULES: "/admin/notification-rules",
  PAYMENT_INTEGRITY: "/admin/payment-integrity",
  GLOBAL_SEARCH: "/admin/global-search",
  RIDE_PROMOTIONS: "/admin/ride-promotions",
  PROMOTIONS: "/admin/promotions",
  TRUST_SAFETY: "/admin/trust-safety",
  PERFORMANCE: "/admin/performance",
  DRIVER_PROMOTIONS: "/admin/driver-promotions",
  MONITORING: "/admin/monitoring",
  OPERATIONS: "/admin/operations",
  OPPORTUNITY_BONUSES: "/admin/opportunity-bonuses",
  REFERRAL_SETTINGS: "/admin/referral-settings",
  REVENUE_ANALYTICS: "/admin/revenue-analytics",
  SAFETY: "/admin/safety",
  SUPPORT_CENTER: "/admin/support-chat",

  // Shop & Tickets
  SHOP_ORDERS: "/admin/shop-orders",
  SHOP_PARTNERS: "/admin/shop-partners",
  SHOP_PARTNER_DETAILS: "/admin/shop-partners/:id",
  TICKET_BOOKINGS: "/admin/ticket-bookings",
  TICKET_OPERATORS: "/admin/ticket-operators",
  TICKET_OPERATOR_DETAILS: "/admin/ticket-operators/:id",

  // Support
  COMPLAINTS: "/admin/complaints",
  COMPLAINT_DETAILS: "/admin/complaints/:id",
  SUPPORT_TICKET_DETAIL: "/admin/support/:id",
  SUPPORT_CHAT: "/admin/support-chat/:conversationId",
  SMS_TEMPLATES: "/admin/sms-templates",

  // Other
  DOCUMENTS: "/admin/documents",
  DELIVERY_DRIVER_VERIFICATION: "/admin/delivery-driver-verification",
  ANALYTICS: "/admin/analytics",
  NOTIFICATIONS: "/admin/notifications",

  // Health & Verification
  ROUTES_HEALTH: "/admin/routes-health",
} as const;

export type AdminRoute = (typeof ADMIN_ROUTES)[keyof typeof ADMIN_ROUTES];

/**
 * All admin route paths as a flat array for validation
 */
export const ALL_ADMIN_ROUTES: string[] = Object.values(ADMIN_ROUTES);

/**
 * Routes that require dynamic parameters (excluded from static validation)
 */
export const DYNAMIC_ROUTES = [
  ADMIN_ROUTES.DRIVER_DETAILS,
  ADMIN_ROUTES.CUSTOMER_DETAILS,
  ADMIN_ROUTES.RESTAURANT_DETAILS,
  ADMIN_ROUTES.WALLET_DETAILS,
  ADMIN_ROUTES.SHOP_PARTNER_DETAILS,
  ADMIN_ROUTES.TICKET_OPERATOR_DETAILS,
  ADMIN_ROUTES.COMPLAINT_DETAILS,
  ADMIN_ROUTES.SUPPORT_TICKET_DETAIL,
  ADMIN_ROUTES.SUPPORT_CHAT,
];

/**
 * Static routes for validation (no dynamic parameters)
 */
export const STATIC_ADMIN_ROUTES = ALL_ADMIN_ROUTES.filter(
  route => !DYNAMIC_ROUTES.includes(route)
);

/**
 * Helper to navigate to an admin route
 */
export function getAdminRoute(route: AdminRoute, params?: Record<string, string>): string {
  let path: string = route;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value);
    });
  }
  return path;
}
