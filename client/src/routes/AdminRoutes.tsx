import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import { Link } from "wouter";
import { AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminLayout = lazy(() => import("@/layouts/AdminLayout").then(m => ({ default: m.AdminLayout })));

const AdminHome = lazy(() => import("@/pages/admin/home"));
const AdminKYC = lazy(() => import("@/pages/admin/kyc"));
const AdminDocumentCenter = lazy(() => import("@/pages/admin/documents"));
const AdminSettlement = lazy(() => import("@/pages/admin/settlement"));
const AdminDrivers = lazy(() => import("@/pages/admin/drivers"));
const AdminDriverDetails = lazy(() => import("@/pages/admin/driver-details"));
const AdminDeliveryDriverVerification = lazy(() => import("@/pages/admin/delivery-driver-verification"));
const AdminCustomers = lazy(() => import("@/pages/admin/customers"));
const AdminCustomerDetails = lazy(() => import("@/pages/admin/customer-details"));
const AdminRestaurants = lazy(() => import("@/pages/admin/restaurants"));
const AdminRestaurantDetails = lazy(() => import("@/pages/admin/restaurant-details"));
const AdminComplaints = lazy(() => import("@/pages/admin/complaints"));
const AdminContactCenter = lazy(() => import("@/pages/admin/contact-center"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminWallets = lazy(() => import("@/pages/admin/wallets"));
const AdminPayouts = lazy(() => import("@/pages/admin/payouts"));
const AdminEarnings = lazy(() => import("@/pages/admin/earnings"));
const AdminAnalytics = lazy(() => import("@/pages/admin/analytics"));
const AdminNotifications = lazy(() => import("@/pages/admin/notifications"));
const AdminParcels = lazy(() => import("@/pages/admin/parcels"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminFeatureFlags = lazy(() => import("@/pages/admin/feature-flags"));
const AdminFinanceOverview = lazy(() => import("@/pages/admin/finance-overview"));
const AdminSecurityCenter = lazy(() => import("@/pages/admin/security-center"));
const AdminShopOrders = lazy(() => import("@/pages/admin/shop-orders"));
const AdminTicketBookings = lazy(() => import("@/pages/admin/ticket-bookings"));
const AdminCmsPages = lazy(() => import("@/pages/admin/cms-pages"));
const AdminLandingCms = lazy(() => import("@/pages/admin/landing-cms"));
const AdminPeopleKyc = lazy(() => import("@/pages/admin/people-kyc"));
const AdminSafetyCenter = lazy(() => import("@/pages/admin/safety-center"));
const AdminFraudAlerts = lazy(() => import("@/pages/admin/fraud-alerts"));
const AdminActivityLog = lazy(() => import("@/pages/admin/activity-log"));
const AdminAccessReviews = lazy(() => import("@/pages/admin/access-reviews"));
const AdminGlobalSettings = lazy(() => import("@/pages/admin/global-settings"));
const AdminReleasesPublish = lazy(() => import("@/pages/admin/releases-publish"));
const AdminBdExpansion = lazy(() => import("@/pages/admin/bd-expansion-dashboard"));
const AdminEnterpriseSearch = lazy(() => import("@/pages/admin/enterprise-search"));
const AdminExportCenter = lazy(() => import("@/pages/admin/export-center"));
const AdminFraudDetection = lazy(() => import("@/pages/admin/fraud-detection"));
const AdminSessionSecurity = lazy(() => import("@/pages/admin/session-security"));
const AdminEmergencyControls = lazy(() => import("@/pages/admin/emergency-controls"));
const AdminIncidentResponse = lazy(() => import("@/pages/admin/incident-response"));
const AdminCustomerSupportPanel = lazy(() => import("@/pages/admin/customer-support-panel"));
const AdminOnboardingDrivers = lazy(() => import("@/pages/admin/onboarding-drivers"));
const AdminOnboardingRestaurants = lazy(() => import("@/pages/admin/onboarding-restaurants"));
const AdminOnboardingShops = lazy(() => import("@/pages/admin/onboarding-shops"));
const AdminOnboardingTickets = lazy(() => import("@/pages/admin/onboarding-tickets"));
const AdminComplianceCenter = lazy(() => import("@/pages/admin/compliance-center"));
const AdminDataGovernance = lazy(() => import("@/pages/admin/DataGovernanceCenter"));
const AdminHealthMonitor = lazy(() => import("@/pages/admin/health-monitor"));
const AdminPushNotifications = lazy(() => import("@/pages/admin/push-notifications"));
const AdminPaymentVerification = lazy(() => import("@/pages/admin/payment-verification"));
const AdminPolicyManager = lazy(() => import("@/pages/admin/policy-manager"));
const AdminBackupRecovery = lazy(() => import("@/pages/admin/backup-recovery"));
const AdminAuditConsole = lazy(() => import("@/pages/admin/audit-console"));
const AdminSystemHealthCenter = lazy(() => import("@/pages/admin/SystemHealthCenter"));
const AdminLaunchReadiness = lazy(() => import("@/pages/admin/LaunchReadinessCenter"));
const AdminOperationsCenter = lazy(() => import("@/pages/admin/operations-center"));
const AdminObservability = lazy(() => import("@/pages/admin/observability-center"));
const AdminIntelligence = lazy(() => import("@/pages/admin/intelligence-dashboard"));
const AdminFinanceGatewayReports = lazy(() => import("@/pages/admin/finance-gateway-reports"));
const AdminFinanceDriverBalances = lazy(() => import("@/pages/admin/finance-driver-balances"));
const AdminFinanceRestaurantBalances = lazy(() => import("@/pages/admin/finance-restaurant-balances"));
const AdminFinanceSettlements = lazy(() => import("@/pages/admin/finance-settlements-history"));
const AdminSafePilot = lazy(() => import("@/pages/admin/safepilot"));
const AdminRatingsCenter = lazy(() => import("@/pages/admin/ratings-center"));
const AdminDriverViolations = lazy(() => import("@/pages/admin/driver-violations"));
const AdminEarningsDisputes = lazy(() => import("@/pages/admin/earnings-disputes"));
const AdminRideTimeline = lazy(() => import("@/pages/admin/ride-timeline"));
const AdminNotificationRules = lazy(() => import("@/pages/admin/notification-rules"));
const AdminPaymentIntegrity = lazy(() => import("@/pages/admin/payment-integrity"));
const AdminGlobalSearch = lazy(() => import("@/pages/admin/global-search"));
const AdminRidePromotions = lazy(() => import("@/pages/admin/ride-promotions"));
const AdminTrustSafety = lazy(() => import("@/pages/admin/trust-safety"));
const AdminPerformance = lazy(() => import("@/pages/admin/performance"));
const AdminSystemHealth = lazy(() => import("@/pages/admin/system-health"));
const AdminShopPartners = lazy(() => import("@/pages/admin/shop-partners"));
const AdminShopPartnerDetails = lazy(() => import("@/pages/admin/shop-partner-details"));
const AdminTicketOperators = lazy(() => import("@/pages/admin/ticket-operators"));
const AdminTicketOperatorDetails = lazy(() => import("@/pages/admin/ticket-operator-details"));
const AdminOnboardingCenter = lazy(() => import("@/pages/admin/onboarding-center"));
const AdminOnboardingDetail = lazy(() => import("@/pages/admin/onboarding-detail"));
const AdminOnboardingOverview = lazy(() => import("@/pages/admin/onboarding-overview"));
const AdminPayoutCenter = lazy(() => import("@/pages/admin/payout-center"));
const AdminWalletDetails = lazy(() => import("@/pages/admin/wallet-details"));
const AdminComplaintDetails = lazy(() => import("@/pages/admin/complaint-details"));
const AdminSupportTicketDetail = lazy(() => import("@/pages/admin/support-ticket-detail"));
const AdminSupportChat = lazy(() => import("@/pages/admin/support-chat"));
const AdminSmsTemplates = lazy(() => import("@/pages/admin/sms-templates"));
const AdminPromotions = lazy(() => import("@/pages/admin/promotions"));
const AdminRoutesHealth = lazy(() => import("@/pages/admin/routes-health"));
const AdminDriverPromotions = lazy(() => import("@/pages/admin/driver-promotions"));
const AdminMonitoring = lazy(() => import("@/pages/admin/monitoring"));
const AdminOperations = lazy(() => import("@/pages/admin/operations"));
const AdminOpportunityBonuses = lazy(() => import("@/pages/admin/opportunity-bonuses"));
const AdminReferralSettings = lazy(() => import("@/pages/admin/referral-settings"));
const AdminRevenueAnalytics = lazy(() => import("@/pages/admin/revenue-analytics"));
const AdminSafety = lazy(() => import("@/pages/admin/safety"));
const AdminSupportCenter = lazy(() => import("@/pages/admin/support-center"));
const AdminSupportConsole = lazy(() => import("@/pages/admin/support-console"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="loading-admin">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

function AdminNotFound() {
  const [location] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
        <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Page Not Found
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-2 text-center max-w-md">
        The admin page you're looking for doesn't exist or has been moved.
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500 mb-6 font-mono">
        {location}
      </p>
      <Link href="/admin">
        <Button className="gap-2">
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}

export function AdminRoutes() {
  return (
    <Switch>
      <Route path="/admin">
        <AdminGuard>
          <AdminLayout>
            <AdminHome />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/home">
        <AdminGuard>
          <AdminLayout>
            <AdminHome />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/people-kyc">
        <AdminGuard>
          <AdminLayout>
            <AdminPeopleKyc />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/kyc">
        <AdminGuard>
          <AdminLayout>
            <AdminKYC />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/documents">
        <AdminGuard>
          <AdminLayout>
            <AdminDocumentCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/settlement">
        <AdminGuard>
          <AdminLayout>
            <AdminSettlement />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/drivers">
        <AdminGuard>
          <AdminLayout>
            <AdminDrivers />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/drivers/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminDriverDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/delivery-driver-verification">
        <AdminGuard>
          <AdminLayout>
            <AdminDeliveryDriverVerification />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/customers">
        <AdminGuard>
          <AdminLayout>
            <AdminCustomers />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/customers/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminCustomerDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/restaurants">
        <AdminGuard>
          <AdminLayout>
            <AdminRestaurants />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/restaurants/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminRestaurantDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/complaints">
        <AdminGuard>
          <AdminLayout>
            <AdminComplaints />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/complaints/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminComplaintDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/contact-center">
        <AdminGuard>
          <AdminLayout>
            <AdminContactCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/settings">
        <AdminGuard>
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/wallets">
        <AdminGuard>
          <AdminLayout>
            <AdminWallets />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/wallets/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminWalletDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/payouts">
        <AdminGuard>
          <AdminLayout>
            <AdminPayouts />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/earnings">
        <AdminGuard>
          <AdminLayout>
            <AdminEarnings />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/analytics">
        <AdminGuard>
          <AdminLayout>
            <AdminAnalytics />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/notifications">
        <AdminGuard>
          <AdminLayout>
            <AdminNotifications />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/parcels">
        <AdminGuard>
          <AdminLayout>
            <AdminParcels />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/users">
        <AdminGuard>
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/feature-flags">
        <AdminGuard>
          <AdminLayout>
            <AdminFeatureFlags />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/cms-pages">
        <AdminGuard>
          <AdminLayout>
            <AdminCmsPages />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/cms">
        <AdminGuard>
          <AdminLayout>
            <AdminCmsPages />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/landing-cms">
        <AdminGuard>
          <AdminLayout>
            <AdminLandingCms />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/global-settings">
        <AdminGuard>
          <AdminLayout>
            <AdminGlobalSettings />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/releases">
        <AdminGuard>
          <AdminLayout>
            <AdminReleasesPublish />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/safety-center">
        <AdminGuard>
          <AdminLayout>
            <AdminSafetyCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/fraud-alerts">
        <AdminGuard>
          <AdminLayout>
            <AdminFraudAlerts />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/security-center">
        <AdminGuard>
          <AdminLayout>
            <AdminSecurityCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/security">
        <AdminGuard>
          <AdminLayout>
            <AdminSecurityCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/activity-log">
        <AdminGuard>
          <AdminLayout>
            <AdminActivityLog />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/access-reviews">
        <AdminGuard>
          <AdminLayout>
            <AdminAccessReviews />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/bd-expansion">
        <AdminGuard>
          <AdminLayout>
            <AdminBdExpansion />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/enterprise-search">
        <AdminGuard>
          <AdminLayout>
            <AdminEnterpriseSearch />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/export-center">
        <AdminGuard>
          <AdminLayout>
            <AdminExportCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/fraud-detection">
        <AdminGuard>
          <AdminLayout>
            <AdminFraudDetection />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/session-security">
        <AdminGuard>
          <AdminLayout>
            <AdminSessionSecurity />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/emergency-controls">
        <AdminGuard>
          <AdminLayout>
            <AdminEmergencyControls />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/incident-response">
        <AdminGuard>
          <AdminLayout>
            <AdminIncidentResponse />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/customer-support-panel">
        <AdminGuard>
          <AdminLayout>
            <AdminCustomerSupportPanel />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding/drivers">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingDrivers />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding/restaurants">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingRestaurants />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding/shops">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingShops />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding/tickets">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingTickets />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding-center">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding/:type/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingDetail />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/compliance-center">
        <AdminGuard>
          <AdminLayout>
            <AdminComplianceCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/data-governance">
        <AdminGuard>
          <AdminLayout>
            <AdminDataGovernance />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/health-monitor">
        <AdminGuard>
          <AdminLayout>
            <AdminHealthMonitor />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/push-notifications">
        <AdminGuard>
          <AdminLayout>
            <AdminPushNotifications />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/payment-verification">
        <AdminGuard>
          <AdminLayout>
            <AdminPaymentVerification />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/policy-manager">
        <AdminGuard>
          <AdminLayout>
            <AdminPolicyManager />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/backup-recovery">
        <AdminGuard>
          <AdminLayout>
            <AdminBackupRecovery />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/audit-console">
        <AdminGuard>
          <AdminLayout>
            <AdminAuditConsole />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/system-health-center">
        <AdminGuard>
          <AdminLayout>
            <AdminSystemHealthCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/system-health">
        <AdminGuard>
          <AdminLayout>
            <AdminSystemHealth />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/launch-readiness">
        <AdminGuard>
          <AdminLayout>
            <AdminLaunchReadiness />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/operations-center">
        <AdminGuard>
          <AdminLayout>
            <AdminOperationsCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/observability">
        <AdminGuard>
          <AdminLayout>
            <AdminObservability />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/intelligence">
        <AdminGuard>
          <AdminLayout>
            <AdminIntelligence />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/finance">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceOverview />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/finance/overview">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceOverview />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/finance/gateway-reports">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceGatewayReports />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/finance/driver-balances">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceDriverBalances />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/finance/restaurant-balances">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceRestaurantBalances />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/finance/settlements">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceSettlements />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/safepilot">
        <AdminGuard>
          <AdminLayout>
            <AdminSafePilot />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/ratings-center">
        <AdminGuard>
          <AdminLayout>
            <AdminRatingsCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/driver-violations">
        <AdminGuard>
          <AdminLayout>
            <AdminDriverViolations />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/earnings-disputes">
        <AdminGuard>
          <AdminLayout>
            <AdminEarningsDisputes />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/ride-timeline">
        <AdminGuard>
          <AdminLayout>
            <AdminRideTimeline />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/notification-rules">
        <AdminGuard>
          <AdminLayout>
            <AdminNotificationRules />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/payment-integrity">
        <AdminGuard>
          <AdminLayout>
            <AdminPaymentIntegrity />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/global-search">
        <AdminGuard>
          <AdminLayout>
            <AdminGlobalSearch />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/ride-promotions">
        <AdminGuard>
          <AdminLayout>
            <AdminRidePromotions />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/trust-safety">
        <AdminGuard>
          <AdminLayout>
            <AdminTrustSafety />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/performance">
        <AdminGuard>
          <AdminLayout>
            <AdminPerformance />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/shop-orders">
        <AdminGuard>
          <AdminLayout>
            <AdminShopOrders />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/shop-partners">
        <AdminGuard>
          <AdminLayout>
            <AdminShopPartners />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/shop-partners/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminShopPartnerDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/ticket-bookings">
        <AdminGuard>
          <AdminLayout>
            <AdminTicketBookings />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/ticket-operators">
        <AdminGuard>
          <AdminLayout>
            <AdminTicketOperators />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/ticket-operators/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminTicketOperatorDetails />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/payout-center">
        <AdminGuard>
          <AdminLayout>
            <AdminPayoutCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/support/:id">
        <AdminGuard>
          <AdminLayout>
            <AdminSupportTicketDetail />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/support-chat/:conversationId">
        <AdminGuard>
          <AdminLayout>
            <AdminSupportChat />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/support-chat">
        <AdminGuard>
          <AdminLayout>
            <AdminSupportCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/sms-templates">
        <AdminGuard>
          <AdminLayout>
            <AdminSmsTemplates />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/dashboard">
        <AdminGuard>
          <AdminLayout>
            <AdminHome />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingCenter />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/onboarding-overview">
        <AdminGuard>
          <AdminLayout>
            <AdminOnboardingOverview />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/promotions">
        <AdminGuard>
          <AdminLayout>
            <AdminPromotions />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/routes-health">
        <AdminGuard>
          <AdminLayout>
            <AdminRoutesHealth />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/driver-promotions">
        <AdminGuard>
          <AdminLayout>
            <AdminDriverPromotions />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/monitoring">
        <AdminGuard>
          <AdminLayout>
            <AdminMonitoring />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/operations">
        <AdminGuard>
          <AdminLayout>
            <AdminOperations />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/opportunity-bonuses">
        <AdminGuard>
          <AdminLayout>
            <AdminOpportunityBonuses />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/referral-settings">
        <AdminGuard>
          <AdminLayout>
            <AdminReferralSettings />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/revenue-analytics">
        <AdminGuard>
          <AdminLayout>
            <AdminRevenueAnalytics />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/safety">
        <AdminGuard>
          <AdminLayout>
            <AdminSafety />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/support-console">
        <AdminGuard>
          <AdminLayout>
            <AdminSupportConsole />
          </AdminLayout>
        </AdminGuard>
      </Route>
      <Route path="/admin/:rest*">
        <AdminGuard>
          <AdminLayout>
            <AdminNotFound />
          </AdminLayout>
        </AdminGuard>
      </Route>
    </Switch>
  );
}
