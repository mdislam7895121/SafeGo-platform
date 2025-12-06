import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SafePilotButton } from "@/components/safepilot/SafePilotButton";
import { NotificationSoundProvider } from "@/contexts/NotificationSoundContext";
import { EatsCartProvider } from "@/contexts/EatsCartContext";
// SignupProvider removed - new customer signup flow is single-step and doesn't need context
// import { SignupProvider } from "@/contexts/SignupContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";

// Auth pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
// Legacy imports kept for reference but routes now redirect to /signup
// import SignupRoleSelection from "@/pages/signup-role-selection";
// import CustomerRegister from "@/pages/customer-register";

// Customer pages
// NOTE: CustomerHome and RideRequest are LEGACY - now using UnifiedBooking
import CustomerProfile from "@/pages/customer/profile";
import BlockedRestaurants from "@/pages/customer/blocked-restaurants";
import CustomerKYC from "@/pages/customer/kyc";
import CustomerActivity from "@/pages/customer/activity";
import RideDetails from "@/pages/customer/ride-details";
import RideAssigned from "@/pages/customer/ride-assigned";
import OrderConfirmation from "@/pages/customer/order-confirmation";
import CustomerDriverProfile from "@/pages/customer/driver-public-profile";
// OLD FOOD UI - Kept for reference but disconnected from routes
// import FoodRestaurants from "@/pages/customer/food-restaurants";
// import FoodRestaurantDetails from "@/pages/customer/food-restaurant-details";
import FoodCheckout from "@/pages/customer/food-checkout";
// NEW DoorDash-style Eats UI - Now the primary customer food experience
import EatsHome from "@/pages/customer/eats-home";
import EatsRestaurant from "@/pages/customer/eats-restaurant";
import FoodOrderTracking from "@/pages/customer/food-order-tracking";
import FoodOrderReceipt from "@/pages/customer/food-order-receipt";
import FoodOrdersHistory from "@/pages/customer/food-orders-history";
import CustomerMyReviews from "@/pages/customer/my-reviews";
import ParcelRequest from "@/pages/customer/parcel-request";
import BDRideBooking from "@/pages/customer/bd-ride-booking";
import RideRequestPage from "@/pages/customer/ride-request-page";
import RideTrackingPage from "@/pages/customer/ride-tracking-page";
import ParcelTracking from "@/pages/customer/parcel-tracking";
import UnifiedBooking from "@/pages/customer/unified-booking";
import CustomerSupport from "@/pages/customer/support";
import MySupportTickets from "@/pages/customer/my-support-tickets";
import CreateSupportTicket from "@/pages/customer/create-support-ticket";
import SupportTicketDetail from "@/pages/customer/support-ticket-detail";
import CustomerWallet from "@/pages/customer/wallet";
import CustomerNotifications from "@/pages/customer/notifications";
import CustomerNotificationSettings from "@/pages/customer/notification-settings";
import TripReceipt from "@/pages/customer/trip-receipt";
import CustomerProfileSettings from "@/pages/customer/profile-settings";
import CustomerPaymentMethods from "@/pages/customer/payment-methods";
import CustomerDeliveryAddresses from "@/pages/customer/delivery-addresses";
import CustomerSavedPlaces from "@/pages/customer/saved-places";
import CustomerRidePreferences from "@/pages/customer/ride-preferences";
import CustomerPrivacyPolicy from "@/pages/customer/privacy-policy";
import CustomerDataPrivacy from "@/pages/customer/data-privacy";
import CustomerSafetyCenter from "@/pages/customer/safety-center";
import CustomerSupportHub from "@/pages/customer-app/support-hub";
import CustomerSupportHelp from "@/pages/customer-app/support-help";
import CustomerSupportArticle from "@/pages/customer-app/support-article";
import CustomerSupportContact from "@/pages/customer-app/support-contact";
import CustomerSupportStatus from "@/pages/customer-app/support-status";
import CustomerSupportLiveChat from "@/pages/customer-app/support-live-chat";
import CustomerSupportPhone from "@/pages/customer-app/support-phone";
import CustomerSupportTickets from "@/pages/customer-app/support-tickets";
import CustomerSupportTicketDetail from "@/pages/customer-app/support-ticket-detail";

// Rider pages (new customer-facing web shell)
import { RiderRoutes } from "@/components/rider/RiderRoutes";

// Driver pages
import { DriverLayout } from "@/layouts/DriverLayout";
import DriverDashboard from "@/pages/driver/dashboard";
import DriverProfile from "@/pages/driver/profile";
import DriverPublicProfile from "@/pages/driver/profile-public";
import DriverVehicle from "@/pages/driver/vehicle";
import DriverWallet from "@/pages/driver/wallet";
import DriverWalletBalance from "@/pages/driver/wallet-balance";
import DriverWalletMethods from "@/pages/driver/wallet-methods";
import DriverWalletHistory from "@/pages/driver/wallet-history";
import DriverTrips from "@/pages/driver/trips";
import DriverTripDetail from "@/pages/driver/trip-detail";
import BDRideDetail from "@/pages/driver/bd-ride-detail";
import DriverTripEarnings from "@/pages/driver/trip-earnings";
import DriverPerformance from "@/pages/driver/performance";
import DriverKYCDocuments from "@/pages/driver/kyc-documents";
import DriverSupport from "@/pages/driver/support";
import DriverRefer from "@/pages/driver/refer";
import DriverSupportHub from "@/pages/driver/support-hub";
import DriverSupportHelp from "@/pages/driver/support-help";
import DriverSupportArticle from "@/pages/driver/support-article";
import DriverSupportContact from "@/pages/driver/support-contact";
import DriverSupportStatus from "@/pages/driver/support-status";
import DriverSupportLiveChat from "@/pages/driver/support-live-chat";
import DriverSupportPhone from "@/pages/driver/support-phone";
import DriverSupportTickets from "@/pages/driver/support-tickets";
import DriverSupportTicketDetail from "@/pages/driver/support-ticket-detail";
import DriverSupportHelpCenter from "@/pages/driver/support-help-center";
import DriverSupportTicketsList from "@/pages/driver/support-tickets-list";
import DriverSupportTicketView from "@/pages/driver/support-ticket-view";
import DriverPoints from "@/pages/driver/points";
import DriverPromotions from "@/pages/driver/promotions";
import DriverHelp from "@/pages/driver/help";
import DriverHome from "@/pages/driver/home";
import DriverAccount from "@/pages/driver/account";
import DriverAccountVehicles from "@/pages/driver/account/vehicles";
import DriverAccountWorkHub from "@/pages/driver/account/work-hub";
import DriverAccountPayment from "@/pages/driver/account/payment";
import DriverAccountPayoutMethods from "@/pages/driver/account/payout-methods";
import DriverAccountTaxInfo from "@/pages/driver/account/tax-info";
import DriverAccountTaxInfoEdit from "@/pages/driver/account/tax-info-edit";
import DriverAccountManage from "@/pages/driver/account/manage";
import DriverAccountAddress from "@/pages/driver/account/address";
import DriverAccountNotifications from "@/pages/driver/account/notifications";
import DriverAccountPrivacy from "@/pages/driver/account/privacy";
import DriverAccountLanguage from "@/pages/driver/account/language";
import DriverAccountDarkMode from "@/pages/driver/account/dark-mode";
import DriverAccountMapTheme from "@/pages/driver/account/map-theme";
import DriverAccountMapSettings from "@/pages/driver/account/map-settings";
import DriverAccountNavigation from "@/pages/driver/account/navigation";
import DriverAccountBlockedUsers from "@/pages/driver/account/blocked-users";
import DriverAccountPermissions from "@/pages/driver/account/permissions";
import DriverAccountAbout from "@/pages/driver/account/about";
import DriverEarnings from "@/pages/driver/earnings";
import DriverPayouts from "@/pages/driver/payouts";
import DriverDocuments from "@/pages/driver/documents";
import DriverOnboarding from "@/pages/driver/onboarding";
import DriverGettingStarted from "@/pages/driver/getting-started";
import DriverTutorials from "@/pages/driver/tutorials";
import DriverSettings from "@/pages/driver/settings";
import DriverRidePreferences from "@/pages/driver/ride-preferences";
import DriverIncentives from "@/pages/driver/incentives";
import DriverIncentivesAchievements from "@/pages/driver/incentives-achievements";
import DriverIncentivesRewards from "@/pages/driver/incentives-rewards";
import DriverSafety from "@/pages/driver/safety";
import DriverSafetyReport from "@/pages/driver/safety-report";
import DriverSafetyHistory from "@/pages/driver/safety-history";
import DriverSafetyDetail from "@/pages/driver/safety-detail";
import DriverSafetyEmergency from "@/pages/driver/safety-emergency";
import DriverTrustScore from "@/pages/driver/trust-score";
import DriverTripActive from "@/pages/driver/trip-active";
import DriverTripRequests from "@/pages/driver/trip-requests";
import DriverRideRequestDetail from "@/pages/driver/ride-request-detail";
import DriverTripSummary from "@/pages/driver/trip-summary";
import DriverMap from "@/pages/driver/map";
import DriverFoodDeliveries from "@/pages/driver/food-deliveries";
import DriverFoodDeliveryActive from "@/pages/driver/food-delivery-active";
import DriverFoodDeliveryHistory from "@/pages/driver/food-delivery-history";
import DriverPrivacyPolicy from "@/pages/driver/privacy-policy";

// Restaurant pages
import { RestaurantLayout } from "@/components/restaurant/RestaurantLayout";
import RestaurantHome from "@/pages/restaurant/home";
import LiveOrders from "@/pages/restaurant/orders-live";
import OrdersOverview from "@/pages/restaurant/orders-overview";
import OrdersCancellations from "@/pages/restaurant/orders-cancellations";
import ScheduledOrders from "@/pages/restaurant/orders-scheduled";
import RestaurantOrders from "@/pages/restaurant/orders";
import RestaurantOrderDetails from "@/pages/restaurant/order-details";
import RestaurantMenu from "@/pages/restaurant/menu";
import MenuCategories from "@/pages/restaurant/menu-categories";
import AddMenuItem from "@/pages/restaurant/menu-new";
import EditMenuItem from "@/pages/restaurant/menu-edit";
import MenuItemOptions from "@/pages/restaurant/menu-item-options";
import MenuBulkActions from "@/pages/restaurant/menu-bulk";
import PromotionsCampaigns from "@/pages/restaurant/promotions-campaigns";
import PromotionsCoupons from "@/pages/restaurant/promotions-coupons";
import PromotionsFeatured from "@/pages/restaurant/promotions-featured";
import RestaurantPayouts from "@/pages/restaurant/payouts";
import RestaurantPayoutMethods from "@/pages/restaurant/payout-methods";
import RestaurantPayoutsHistory from "@/pages/restaurant/payouts-history";
import RestaurantPaymentOptions from "@/pages/restaurant/payment-options";
import AdminRestaurantPayouts from "@/pages/admin/restaurant-payouts";
import AdminRestaurantSettings from "@/pages/admin/restaurant-settings";
import AnalyticsOverview from "@/pages/restaurant/analytics-overview";
import AnalyticsItems from "@/pages/restaurant/analytics-items";
import AnalyticsCustomers from "@/pages/restaurant/analytics-customers";
import AnalyticsDrivers from "@/pages/restaurant/analytics-drivers";
import Reviews from "@/pages/restaurant/reviews";
import ReviewsComplaints from "@/pages/restaurant/reviews-complaints";
import RestaurantBranding from "@/pages/restaurant/branding";
import RestaurantGallery from "@/pages/restaurant/gallery";
import SettingsProfile from "@/pages/restaurant/settings-profile";
import SettingsHours from "@/pages/restaurant/settings-hours";
import SettingsDelivery from "@/pages/restaurant/settings-delivery";
import SettingsZones from "@/pages/restaurant/settings/zones";
import SettingsSurge from "@/pages/restaurant/settings/surge";
import SettingsStaff from "@/pages/restaurant/settings-staff";
import SettingsDevices from "@/pages/restaurant/settings-devices";
import DocumentsBusiness from "@/pages/restaurant/documents-business";
import DocumentsHealth from "@/pages/restaurant/documents-health";
import DocumentsKYC from "@/pages/restaurant/documents-kyc";
import SupportHub from "@/pages/restaurant/support-hub";
import SupportHelp from "@/pages/restaurant/support-help";
import SupportArticle from "@/pages/restaurant/support-article";
import SupportContact from "@/pages/restaurant/support-contact";
import SupportStatus from "@/pages/restaurant/support-status";
import SupportLiveChat from "@/pages/restaurant/support-live-chat";
import SupportPhone from "@/pages/restaurant/support-phone";
import RestaurantProfile from "@/pages/restaurant/profile";
import RestaurantSupport from "@/pages/restaurant/support";
import RestaurantSupportTickets from "@/pages/restaurant/support-tickets";
import RestaurantSupportTicketDetail from "@/pages/restaurant/support-ticket-detail";
import RestaurantWallet from "@/pages/restaurant/wallet";
import RestaurantPrivacyPolicy from "@/pages/restaurant/privacy-policy";
import StaffManagement from "@/pages/restaurant/staff";
import StaffActivity from "@/pages/restaurant/staff-activity";
import RestaurantKitchen from "@/pages/restaurant/kitchen";

// Admin pages
import { AdminLayout } from "@/layouts/AdminLayout";
import AdminHome from "@/pages/admin/home";
import AdminKYC from "@/pages/admin/kyc";
import AdminDocumentCenter from "@/pages/admin/documents";
import AdminSettlement from "@/pages/admin/settlement";
import AdminDrivers from "@/pages/admin/drivers";
import AdminDriverDetails from "@/pages/admin/driver-details";
import AdminCustomers from "@/pages/admin/customers";
import AdminCustomerDetails from "@/pages/admin/customer-details";
import AdminRestaurants from "@/pages/admin/restaurants";
import AdminRestaurantDetails from "@/pages/admin/restaurant-details";
import AdminComplaints from "@/pages/admin/complaints";
import AdminComplaintDetails from "@/pages/admin/complaint-details";
import AdminUsers from "@/pages/admin/users";
import AdminParcels from "@/pages/admin/parcels";
import AdminParcelDetails from "@/pages/admin/parcel-details";
import AdminActivityLog from "@/pages/admin/activity-log";
import AdminNotifications from "@/pages/admin/notifications";
import AdminSettings from "@/pages/admin/settings";
import AdminReferralSettings from "@/pages/admin/referral-settings";
import AdminReferralSettingsEdit from "@/pages/admin/referral-settings-edit";
import AdminOpportunityBonuses from "@/pages/admin/opportunity-bonuses";
import AdminOpportunityBonusesEdit from "@/pages/admin/opportunity-bonuses-edit";
import AdminDriverPromotions from "@/pages/admin/driver-promotions";
import AdminRidePromotions from "@/pages/admin/ride-promotions";
import AdminPromotions from "@/pages/admin/promotions";
import AdminReviews from "@/pages/admin/reviews";
import AdminMedia from "@/pages/admin/media";
import AdminSupportChat from "@/pages/admin/support-chat";
import AdminWallets from "@/pages/admin/wallets";
import AdminWalletDetails from "@/pages/admin/wallet-details";
import AdminPayouts from "@/pages/admin/payouts";
import AdminPayoutsRequests from "@/pages/admin/payouts-requests";
import AdminPayoutsSchedule from "@/pages/admin/payouts-schedule";
import AdminPayoutsManual from "@/pages/admin/payouts-manual";
import AdminPayoutsReports from "@/pages/admin/payouts-reports";
import AdminEarnings from "@/pages/admin/earnings";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminPerformance from "@/pages/admin/performance";
import AdminMonitoring from "@/pages/admin/monitoring";
import AdminSecurityCenter from "@/pages/admin/security-center";
import AdminSupportCenter from "@/pages/admin/support-center";
import AdminSupportTicketDetail from "@/pages/admin/support-ticket-detail";
import AdminOperationsDashboard from "@/pages/admin/operations-dashboard";
import AdminRevenueAnalytics from "@/pages/admin/revenue-analytics";
import AdminFraudAlerts from "@/pages/admin/fraud-alerts";
import AdminOnboardingOverview from "@/pages/admin/onboarding-overview";
import AdminShopPartners from "@/pages/admin/shop-partners";
import AdminShopPartnerDetails from "@/pages/admin/shop-partner-details";
import AdminTicketOperators from "@/pages/admin/ticket-operators";
import AdminTicketOperatorDetails from "@/pages/admin/ticket-operator-details";
import AdminSupportHub from "@/pages/admin-portal/support-hub";
import AdminSupportHelp from "@/pages/admin-portal/support-help";
import AdminSupportArticle from "@/pages/admin-portal/support-article";
import AdminSupportContact from "@/pages/admin-portal/support-contact";
import AdminSupportStatus from "@/pages/admin-portal/support-status";
import AdminSupportLiveChat from "@/pages/admin-portal/support-live-chat";
import AdminSupportPhone from "@/pages/admin-portal/support-phone";
import AdminSupportTickets from "@/pages/admin-portal/support-tickets";
import AdminSupportTicketDetail2 from "@/pages/admin-portal/support-ticket-detail";
import AdminDriverSupportCenter from "@/pages/admin/driver-support";
import AdminMobileWalletConfig from "@/pages/admin/mobile-wallet-config";
import AdminRidePricingConfig from "@/pages/admin/ride-pricing-config";
import AdminRideRequests from "@/pages/admin/ride-requests";
import AdminBdTaxSettings from "@/pages/admin/bd-tax-settings";
import AdminPrivacyConsentSettings from "@/pages/admin/privacy-consent-settings";
import AdminPrivacyPolicyPreview from "@/pages/admin/privacy-policy-preview";
import AdminPrivacyPolicy from "@/pages/admin/privacy-policy";
import AdminKycVerification from "@/pages/admin/kyc-verification";
import AdminBackgroundChecks from "@/pages/admin/background-checks";
import AdminPhase5Dashboard from "@/pages/admin/phase5-dashboard";
import AdminSystemHealth from "@/pages/admin/system-health";
import AdminBDExpansionDashboard from "@/pages/admin/bd-expansion-dashboard";
import AdminPeopleKycCenter from "@/pages/admin/people-kyc";
import AdminSafetyCenterNew from "@/pages/admin/safety-center";
import AdminFeatureFlags from "@/pages/admin/feature-flags";
import AdminGlobalSettings from "@/pages/admin/global-settings";
import AdminAccessGovernance from "@/pages/admin/access-governance";
import ComplianceExportCenter from "@/pages/admin/compliance-export-center";
import OperationsConsole from "@/pages/admin/operations-console";
import BackupsDRPage from "@/pages/admin/backups-dr";
import AccessReviewsPage from "@/pages/admin/access-reviews";
import ReleasesPublishPage from "@/pages/admin/releases-publish";

// Phase 3A: Enterprise Admin Features
import EnterpriseSearch from "@/pages/admin/enterprise-search";
import ExportCenter from "@/pages/admin/export-center";
import FraudDetection from "@/pages/admin/fraud-detection";
import SessionSecurity from "@/pages/admin/session-security";
import EmergencyControls from "@/pages/admin/emergency-controls";
import IncidentResponse from "@/pages/admin/incident-response";
import CustomerSupportPanel from "@/pages/admin/customer-support-panel";
import ComplianceCenter from "@/pages/admin/compliance-center";
import HealthMonitor from "@/pages/admin/health-monitor";
import PushNotifications from "@/pages/admin/push-notifications";
import PaymentVerification from "@/pages/admin/payment-verification";
import PolicyManager from "@/pages/admin/policy-manager";
import PolicySafetyHub from "@/pages/admin/policy-safety-hub";
import ReportsManagement from "@/pages/admin/reports-management";
import FraudPreventionCenter from "@/pages/admin/fraud-prevention-center";
import FinanceCenter from "@/pages/admin/finance-center";
import PayoutCenter from "@/pages/admin/payout-center";
import FinanceLogs from "@/pages/admin/finance-logs";
import SecurityCenter from "@/pages/admin/SecurityCenter";
import ReputationCenter from "@/pages/admin/ReputationCenter";
import DataGovernanceCenter from "@/pages/admin/DataGovernanceCenter";
import SystemHealthCenter from "@/pages/admin/SystemHealthCenter";
import LaunchReadinessCenter from "@/pages/admin/LaunchReadinessCenter";
import BackupRecovery from "@/pages/admin/backup-recovery";
import AuditConsole from "@/pages/admin/audit-console";

// Phase 3C: Enterprise Admin Intelligence Layer
import IntelligenceDashboard from "@/pages/admin/intelligence-dashboard";
import OperationsCenter from "@/pages/admin/operations-center";
import SafePilotIntelligence from "@/pages/admin/safepilot-intelligence";
import SafePilotPage from "@/pages/admin/safepilot";

// Phase 5A: Admin Observability Center
import ObservabilityCenter from "@/pages/admin/observability-center";

// Phase 4: Enterprise Admin Features
import ComplaintResolution from "@/pages/admin/complaint-resolution";
import RefundCenter from "@/pages/admin/refund-center";
import LegalRequestsDashboard from "@/pages/admin/legal-requests";
import CommunicationHub from "@/pages/admin/communication-hub";
import DocumentManager from "@/pages/admin/document-manager";
import SafetyReplay from "@/pages/admin/safety-replay";
import MapControl from "@/pages/admin/map-control";
import EmailTemplates from "@/pages/admin/email-templates";
import SMSTemplates from "@/pages/admin/sms-templates";
import AdminChat from "@/pages/admin/admin-chat";
import DriverViolations from "@/pages/admin/driver-violations";
import TrustSafety from "@/pages/admin/trust-safety";
import PolicyEngine from "@/pages/admin/policy-engine";
import ActivityMonitor from "@/pages/admin/activity-monitor";
import RatingsCenter from "@/pages/admin/ratings-center";
import EarningsDisputes from "@/pages/admin/earnings-disputes";
import RideTimeline from "@/pages/admin/ride-timeline";
import NotificationRules from "@/pages/admin/notification-rules";
import PaymentIntegrity from "@/pages/admin/payment-integrity";
import GlobalSearch from "@/pages/admin/global-search";

// Test pages
import TestDriverPublicCard from "@/pages/test/driver-public-card";

// Shop Partner pages (BD only)
import { ShopPartnerLayout } from "@/layouts/ShopPartnerLayout";
import { ShopPartnerGuard } from "@/components/ShopPartnerGuard";
import ShopPartnerDashboard from "@/pages/shop-partner/dashboard";
import ShopPartnerOnboarding from "@/pages/shop-partner/onboarding";
import ShopPartnerStagedOnboarding from "@/pages/shop-partner/staged-onboarding";
import ShopPartnerSetup from "@/pages/shop-partner/setup";
import ShopPartnerProducts from "@/pages/shop-partner/products";
import ShopPartnerProductForm from "@/pages/shop-partner/product-form";
import ShopPartnerOrders from "@/pages/shop-partner/orders";
import ShopPartnerWallet from "@/pages/shop-partner/wallet";
import ShopPartnerSettings from "@/pages/shop-partner/settings";
import ShopPartnerProfile from "@/pages/shop-partner/profile";
import ShopPartnerReviews from "@/pages/shop-partner/reviews";
import ShopPartnerNotifications from "@/pages/shop-partner/notifications";
import ShopPartnerPrivacyPolicy from "@/pages/shop-partner/privacy-policy";

// Customer BD Shop pages
import BDShops from "@/pages/customer/bd-shops";
import BDShopDetails from "@/pages/customer/bd-shop-details";
import BDShopOrders from "@/pages/customer/bd-shop-orders";
import BDProductDetails from "@/pages/customer/bd-product-details";

// Ticket Operator pages (BD only)
import { TicketOperatorGuard } from "@/components/TicketOperatorGuard";
import { TicketOperatorLayout } from "@/layouts/TicketOperatorLayout";
import TicketOperatorDashboard from "@/pages/ticket-operator/dashboard";
import TicketOperatorOnboarding from "@/pages/ticket-operator/onboarding";
import TicketOperatorStagedOnboarding from "@/pages/ticket-operator/staged-onboarding";
import TicketOperatorSetup from "@/pages/ticket-operator/setup";
import TicketOperatorTickets from "@/pages/ticket-operator/tickets";
import TicketOperatorRentals from "@/pages/ticket-operator/rentals";
import TicketOperatorBookings from "@/pages/ticket-operator/bookings";
import TicketOperatorWallet from "@/pages/ticket-operator/wallet";
import TicketOperatorProfile from "@/pages/ticket-operator/profile";
import TicketOperatorPrivacyPolicy from "@/pages/ticket-operator/privacy-policy";

// Customer BD Tickets & Rentals
import BDTickets from "@/pages/customer/bd-tickets";
import BDRentals from "@/pages/customer/bd-rentals";
import BDTicketSearch from "@/pages/bd/ticket-search";
import BDSeatSelect from "@/pages/bd/seat-select";
import BDTicketCheckout from "@/pages/bd/ticket-checkout";
import BDTicketBooking from "@/pages/bd/ticket-booking";
import BDBookingSuccess from "@/pages/bd/booking-success";

// Partner Onboarding Start Pages
import RideDriverStart from "@/pages/partner/ride-start";
import DeliveryDriverStart from "@/pages/partner/delivery-start";
import RestaurantStart from "@/pages/partner/restaurant-start";
import DriverRegistration from "@/pages/partner/driver-registration";
import RestaurantRegistration from "@/pages/partner/restaurant-registration";
import ShopPartnerStart from "@/pages/partner/shop-start";
import TicketOperatorStart from "@/pages/partner/ticket-start";

import NotFound from "@/pages/not-found";

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  if (user) {
    // Use centralized role-based routing helper
    return <Redirect to={getPostLoginPath(user)} />;
  }

  return <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/auth/login" component={Login} />
      <Route path="/signup" component={Signup} />
      {/* Legacy role selection route - redirect to main signup (role selection removed) */}
      <Route path="/signup/choose-role">
        <Redirect to="/signup" />
      </Route>
      {/* Legacy customer register route - redirect to main signup */}
      <Route path="/customer-register">
        <Redirect to="/signup" />
      </Route>

      {/* Customer routes - NEW UNIFIED BOOKING DESIGN */}
      <Route path="/customer">
        <ProtectedRoute allowedRoles={["customer"]}>
          <UnifiedBooking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/profile">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerProfile />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/activity">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerActivity />
        </ProtectedRoute>
      </Route>
      {/* LEGACY ROUTES - Redirected to use NEW unified booking design */}
      <Route path="/customer/ride">
        <ProtectedRoute allowedRoles={["customer"]}>
          <UnifiedBooking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride-request">
        <ProtectedRoute allowedRoles={["customer"]}>
          <UnifiedBooking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/food/orders">
        <ProtectedRoute allowedRoles={["customer"]}>
          <FoodOrdersHistory />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/food/checkout">
        <ProtectedRoute allowedRoles={["customer"]}>
          <FoodCheckout />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/food/tracking/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <FoodOrderTracking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/food-orders/:id/receipt">
        <ProtectedRoute allowedRoles={["customer"]}>
          <FoodOrderReceipt />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/my-reviews">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerMyReviews />
        </ProtectedRoute>
      </Route>
      {/* NEW DoorDash-style Eats UI - Primary customer food experience */}
      <Route path="/customer/food/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <EatsRestaurant />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/food">
        <ProtectedRoute allowedRoles={["customer"]}>
          <EatsHome />
        </ProtectedRoute>
      </Route>
      {/* Legacy /customer/eats routes - redirect to primary /customer/food
          Auth is enforced at destination (/customer/food is protected) */}
      <Route path="/customer/eats/:id">
        {(params) => <Redirect to={`/customer/food/${(params as Record<string, string>).id || ''}`} />}
      </Route>
      <Route path="/customer/eats">
        <Redirect to="/customer/food" />
      </Route>
      <Route path="/customer/parcel">
        <ProtectedRoute allowedRoles={["customer"]}>
          <ParcelRequest />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/parcel-tracking/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <ParcelTracking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride/bd">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BDRideBooking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride-booking">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideRequestPage />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride-tracking/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideTrackingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/unified-booking">
        <ProtectedRoute allowedRoles={["customer"]}>
          <UnifiedBooking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/book">
        <ProtectedRoute allowedRoles={["customer"]}>
          <UnifiedBooking />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupport />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/my-support-tickets">
        <ProtectedRoute allowedRoles={["customer"]}>
          <MySupportTickets />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/create-support-ticket">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CreateSupportTicket />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-tickets/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <SupportTicketDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/profile/kyc">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerKYC />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/profile/settings">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerProfileSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/blocked-restaurants">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BlockedRestaurants />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/payment-methods">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerPaymentMethods />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/delivery-addresses">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerDeliveryAddresses />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/saved-places">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSavedPlaces />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride-preferences">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerRidePreferences />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/privacy-policy">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerPrivacyPolicy />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/data-privacy">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerDataPrivacy />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/safety-center">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSafetyCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/rides/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride-assigned/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideAssigned />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/order-confirmation/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <OrderConfirmation />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/driver/:driver_profile_id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerDriverProfile />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/wallet">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerWallet />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/notifications">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerNotifications />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/notification-settings">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerNotificationSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/trip-receipt/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <TripReceipt />
        </ProtectedRoute>
      </Route>
      {/* Customer Support Center Routes */}
      <Route path="/customer/support-center/tickets/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportTicketDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/tickets">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportTickets />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/live-chat">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportLiveChat />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/phone">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportPhone />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/articles/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportArticle />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/help">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportHelp />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/contact">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportContact />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center/status">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportStatus />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support-center">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupportHub />
        </ProtectedRoute>
      </Route>

      {/* Rider routes - new customer-facing web shell with unified RideBookingProvider */}
      <Route path="/rider/:rest*">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RiderRoutes />
        </ProtectedRoute>
      </Route>

      {/* Driver routes */}
      {/* Drivers land on the live map screen by default (Uber-style experience) */}
      <Route path="/driver">
        <ProtectedRoute allowedRoles={["driver"]}>
          <Redirect to="/driver/map" />
        </ProtectedRoute>
      </Route>
      {/* Driver home route - alias for dashboard */}
      <Route path="/driver/home">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Home">
            <DriverHome />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      {/* All driver routes wrapped with unified DriverLayout */}
      <Route path="/driver/dashboard">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Dashboard">
            <DriverDashboard />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/vehicle">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Vehicles">
            <DriverVehicle />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/settings">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Settings">
            <DriverSettings />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/ride-preferences">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Ride Preferences">
            <DriverRidePreferences />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/profile/public">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Public Profile">
            <DriverPublicProfile />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/profile">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Profile">
            <DriverProfile />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/kyc-documents">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Documents">
            <DriverKYCDocuments />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/documents">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Document Center">
            <DriverDocuments />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Support">
            <DriverSupportHub />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support/help">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Help Center">
            <DriverSupportHelp />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support/contact">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Contact Support">
            <DriverSupportContact />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support/live-chat">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Live Chat">
            <DriverSupportLiveChat />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support/phone">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Phone Support">
            <DriverSupportPhone />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support/status">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="System Status">
            <DriverSupportStatus />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-help-center">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Help Center">
            <DriverSupportHelpCenter />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-tickets">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Support Tickets">
            <DriverSupportTicketsList />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-ticket/:id">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Ticket Details">
            <DriverSupportTicketView />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/wallet">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Wallet">
            <DriverWallet />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/wallet/balance">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Balance">
            <DriverWalletBalance />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/wallet/methods">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Payout Methods">
            <DriverWalletMethods />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/wallet/history">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Payout History">
            <DriverWalletHistory />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trips">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Trip History">
            <DriverTrips />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trip/active">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Active Trip">
            <DriverTripActive />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trip-requests">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverTripRequests />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/ride-request/:id">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverRideRequestDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/map">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Map">
            <DriverMap />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/food-deliveries">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Food Deliveries">
            <DriverFoodDeliveries />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/food-delivery/history">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Delivery History">
            <DriverFoodDeliveryHistory />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/food-delivery/:deliveryId">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Active Delivery">
            <DriverFoodDeliveryActive />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trips/:tripId">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Trip Details">
            <DriverTripDetail />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trips/:tripId/earnings">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Earnings Breakdown">
            <DriverTripEarnings />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trip-summary/:tripId">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverTripSummary />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/ride/bd/:rideId">
        <ProtectedRoute allowedRoles={["driver"]}>
          <BDRideDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/performance">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Performance">
            <DriverPerformance />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/incentives">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Incentives & Milestones">
            <DriverIncentives />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/incentives/achievements">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Achievements">
            <DriverIncentivesAchievements />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/incentives/rewards">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Rewards & Tiers">
            <DriverIncentivesRewards />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Safety Center">
            <DriverSafety />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety/report">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Report Incident">
            <DriverSafetyReport />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety-report">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Report Incident">
            <DriverSafetyReport />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety/history">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Incident History">
            <DriverSafetyHistory />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety/history/:id">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Incident Details">
            <DriverSafetyDetail />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety/emergency">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Emergency Toolkit">
            <DriverSafetyEmergency />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/safety-emergency">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Emergency Toolkit">
            <DriverSafetyEmergency />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trust-score">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Trust Score">
            <DriverTrustScore />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/earnings">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Earnings">
            <DriverEarnings />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/payouts">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Payouts">
            <DriverPayouts />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/refer">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Refer & Earn">
            <DriverRefer />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/points">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="SafeGo Points">
            <DriverPoints />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      {/* Legacy redirect from old premium page */}
      <Route path="/driver/premium">
        <ProtectedRoute allowedRoles={["driver"]}>
          <Redirect to="/driver/points" />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/promotions">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Opportunity">
            <DriverPromotions />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/help">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Help Center">
            <DriverHelp />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/getting-started">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Getting Started">
            <DriverGettingStarted />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/onboarding">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Onboarding Wizard">
            <DriverOnboarding />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/tutorials">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Training Videos">
            <DriverTutorials />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/vehicles">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="My Vehicles">
            <DriverAccountVehicles />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/work-hub">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Work Hub">
            <DriverAccountWorkHub />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/payment">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Payment Methods">
            <DriverAccountPayment />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/payout-methods">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Payout Methods">
            <DriverAccountPayoutMethods />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/tax-info">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Tax Info">
            <DriverAccountTaxInfo />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/tax-info/edit">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Edit Tax Information">
            <DriverAccountTaxInfoEdit />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/manage">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Manage Account">
            <DriverAccountManage />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/address">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Edit Address">
            <DriverAccountAddress />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/notifications">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Notifications">
            <DriverAccountNotifications />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/privacy">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Privacy">
            <DriverAccountPrivacy />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/language">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Language">
            <DriverAccountLanguage />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/dark-mode">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Appearance">
            <DriverAccountDarkMode />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/map-settings">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Map Settings">
            <DriverAccountMapSettings />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/map-theme">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Map Settings">
            <DriverAccountMapSettings />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/navigation">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Navigation">
            <DriverAccountNavigation />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/blocked-users">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Blocked Users">
            <DriverAccountBlockedUsers />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/permissions">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="App Permissions">
            <DriverAccountPermissions />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/about">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="About">
            <DriverAccountAbout />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/privacy-policy">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverPrivacyPolicy />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Account Settings">
            <DriverAccount />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      {/* Driver Support Center Routes */}
      <Route path="/driver/support-center/tickets/:id">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Support Ticket">
            <DriverSupportTicketDetail />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/tickets">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="My Tickets">
            <DriverSupportTickets />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/live-chat">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Live Chat">
            <DriverSupportLiveChat />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/phone">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Phone Support">
            <DriverSupportPhone />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/articles/:id">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Help Article">
            <DriverSupportArticle />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/help">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Help Center">
            <DriverSupportHelp />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/contact">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Contact Support">
            <DriverSupportContact />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center/status">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="System Status">
            <DriverSupportStatus />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support-center">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Support Center">
            <DriverSupportHub />
          </DriverLayout>
        </ProtectedRoute>
      </Route>

      {/* Restaurant routes - All wrapped with RestaurantLayout */}
      {/* Dashboard - Home */}
      <Route path="/restaurant/dashboard">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantHome />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/home">
        <Redirect to="/restaurant/dashboard" />
      </Route>
      <Route path="/restaurant">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantHome />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Orders */}
      <Route path="/restaurant/orders/overview">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <OrdersOverview />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/orders/live">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <LiveOrders />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/orders/cancellations">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <OrdersCancellations />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/orders/scheduled">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <ScheduledOrders />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/orders/history">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantOrders />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/orders/:orderId">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantOrderDetails />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/orders">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantOrders />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Kitchen Display */}
      <Route path="/restaurant/kitchen">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantKitchen />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Menu Management */}
      <Route path="/restaurant/menu/items">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantMenu />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/menu/categories">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <MenuCategories />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/menu/new">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <AddMenuItem />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/menu-edit/:id">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <EditMenuItem />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/menu-item-options/:itemId">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <MenuItemOptions />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/menu/bulk">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <MenuBulkActions />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/menu">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantMenu />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Promotions - OWNER ONLY */}
      <Route path="/restaurant/promotions/campaigns">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <PromotionsCampaigns />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/promotions/coupons">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <PromotionsCoupons />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/promotions/featured">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <PromotionsFeatured />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Analytics - Phase 4 */}
      <Route path="/restaurant/analytics/overview">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <AnalyticsOverview />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/analytics/items">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <AnalyticsItems />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/analytics/customers">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <AnalyticsCustomers />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/analytics/drivers">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <AnalyticsDrivers />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Payouts - Phase 5 */}
      <Route path="/restaurant/payouts/overview">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <RestaurantPayouts />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/payouts">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <RestaurantPayouts />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Payout Methods - Payment & Payout Configuration (OWNER only) */}
      <Route path="/restaurant/payout-methods">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <RestaurantPayoutMethods />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/payouts-history">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <RestaurantPayoutsHistory />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Customer Payment Options - Payment & Payout Configuration */}
      <Route path="/restaurant/payment-options">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantPaymentOptions />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Staff Management - Phase 6 (OWNER only) */}
      <Route path="/restaurant/staff/activity">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <StaffActivity />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/staff">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <StaffManagement />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Reviews */}
      <Route path="/restaurant/reviews/complaints">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <ReviewsComplaints />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/reviews">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <Reviews />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Branding - Phase 9 (OWNER only) */}
      <Route path="/restaurant/branding">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <RestaurantBranding />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Gallery - Phase 9 */}
      <Route path="/restaurant/gallery">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantGallery />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Settings */}
      <Route path="/restaurant/settings/profile">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SettingsProfile />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/settings/hours">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SettingsHours />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/settings/delivery">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SettingsDelivery />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/settings/zones">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SettingsZones />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/settings/surge">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SettingsSurge />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/settings/staff">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <SettingsStaff />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/settings/devices">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SettingsDevices />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Documents & Compliance (Owner only) */}
      <Route path="/restaurant/documents/business">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <DocumentsBusiness />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/documents/health">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <DocumentsHealth />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/documents/kyc">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout userRole="OWNER">
            <DocumentsKYC />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Support */}
      {/* Phase 12: Support Tickets */}
      <Route path="/restaurant/support-tickets/:id">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantSupportTicketDetail />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support-tickets">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantSupportTickets />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      {/* Phase 12.5: Support Center - Multi-channel support hub */}
      <Route path="/restaurant/support/live-chat">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportLiveChat />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support/phone">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportPhone />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support/articles/:id">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportArticle />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support/help">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportHelp />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support/contact">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportContact />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support/status">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportStatus />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <SupportHub />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Legacy routes - keep for backward compatibility */}
      <Route path="/restaurant/profile">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantProfile />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/privacy-policy">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantPrivacyPolicy />
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/wallet">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantLayout>
            <RestaurantWallet />
          </RestaurantLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Dashboard">
            <AdminHome />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Dashboard">
            <AdminHome />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Users">
            <AdminUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/kyc">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="KYC Approvals">
            <AdminKYC />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/documents">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Document Center">
            <AdminDocumentCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Drivers">
            <AdminDrivers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Driver Details">
            <AdminDriverDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Customers">
            <AdminCustomers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Customer Details">
            <AdminCustomerDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/restaurants">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Restaurants">
            <AdminRestaurants />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/restaurants/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Restaurant Details">
            <AdminRestaurantDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/restaurants/:id/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Restaurant Settings">
            <AdminRestaurantSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/complaints">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Complaints">
            <AdminComplaints />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/complaints/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Complaint Details">
            <AdminComplaintDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settlement">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Settlement">
            <AdminSettlement />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/parcels/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Parcel Details">
            <AdminParcelDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/parcels">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Parcels">
            <AdminParcels />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/activity-log">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Activity Log">
            <AdminActivityLog />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notifications">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Notifications">
            <AdminNotifications />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Settings">
            <AdminSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/mobile-wallets">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Mobile Wallet Config">
            <AdminMobileWalletConfig />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ride-pricing">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ride Pricing Config">
            <AdminRidePricingConfig />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ride-requests">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ride Requests">
            <AdminRideRequests />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/bd-tax-settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Bangladesh Tax Settings">
            <AdminBdTaxSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/privacy-consent">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Privacy & Consent Settings">
            <AdminPrivacyConsentSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/privacy-policy-preview">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPrivacyPolicyPreview />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/privacy-policy">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPrivacyPolicy />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/kyc-verification">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="KYC Verification">
            <AdminKycVerification />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/background-checks">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Background Checks">
            <AdminBackgroundChecks />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/phase5">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Phase 5: Experience Intelligence">
            <AdminPhase5Dashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/system-health">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="System Health">
            <AdminSystemHealth />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/referral-settings/:id/edit">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Edit Referral Settings">
            <AdminReferralSettingsEdit />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/referral-settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Referral Settings">
            <AdminReferralSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/opportunity-bonuses/:id/edit">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Edit Opportunity Bonus">
            <AdminOpportunityBonusesEdit />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/opportunity-bonuses">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Opportunity Bonuses">
            <AdminOpportunityBonuses />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/promotions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Promotions Center">
            <AdminPromotions />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/driver-promotions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Driver Promotions">
            <AdminDriverPromotions />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ride-promotions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ride Promotions">
            <AdminRidePromotions />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reviews">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Reviews">
            <AdminReviews />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/media">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Media">
            <AdminMedia />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-chat">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Support Chat">
            <AdminSupportChat />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support/:ticketId">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Support Ticket">
            <AdminSupportTicketDetail />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Support Center">
            <AdminSupportCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/wallets/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Wallet Details">
            <AdminWalletDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/wallets">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Wallets">
            <AdminWallets />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/requests">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payout Requests">
            <AdminPayoutsRequests />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/schedule">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payout Schedule">
            <AdminPayoutsSchedule />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/manual">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Manual Payouts">
            <AdminPayoutsManual />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/reports">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payout Reports">
            <AdminPayoutsReports />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/restaurants">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Restaurant Payouts">
            <AdminRestaurantPayouts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payouts">
            <AdminPayouts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/earnings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Earnings">
            <AdminEarnings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Analytics">
            <AdminAnalytics />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/performance">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Performance">
            <AdminPerformance />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/monitoring">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Monitoring">
            <AdminMonitoring />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/security-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Security Center">
            <AdminSecurityCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/operations">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Operations Dashboard">
            <AdminOperationsDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/revenue-analytics">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Revenue Analytics">
            <AdminRevenueAnalytics />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/fraud-alerts">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Fraud Alerts">
            <AdminFraudAlerts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/onboarding-overview">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Onboarding Overview">
            <AdminOnboardingOverview />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/shop-partners/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Shop Partner Details">
            <AdminShopPartnerDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/shop-partners">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Shop Partners">
            <AdminShopPartners />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ticket-operators/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ticket Operator Details">
            <AdminTicketOperatorDetails />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ticket-operators">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ticket Operators">
            <AdminTicketOperators />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/bd-expansion">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="BD Expansion">
            <AdminBDExpansionDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/people-kyc">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPeopleKycCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/safety">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSafetyCenterNew />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/feature-flags">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminFeatureFlags />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/global-settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminGlobalSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/access-governance">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminAccessGovernance />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/compliance-exports">
        <ProtectedRoute allowedRoles={["admin"]}>
          <ComplianceExportCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/operations-console">
        <ProtectedRoute allowedRoles={["admin"]}>
          <OperationsConsole />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/backups-dr">
        <ProtectedRoute allowedRoles={["admin"]}>
          <BackupsDRPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/access-reviews">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AccessReviewsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/releases">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Releases & Publish">
            <ReleasesPublishPage />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Phase 3A: Enterprise Admin Features */}
      <Route path="/admin/enterprise-search">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Enterprise Search">
            <EnterpriseSearch />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/export-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Export Center">
            <ExportCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/fraud-detection">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Fraud Detection">
            <FraudDetection />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/session-security">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Session Security">
            <SessionSecurity />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/emergency-controls">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Emergency Controls">
            <EmergencyControls />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/incident-response">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Incident Response">
            <IncidentResponse />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customer-support-panel">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Customer Support Panel">
            <CustomerSupportPanel />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/compliance-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Compliance Center">
            <ComplianceCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/health-monitor">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Health Monitor">
            <HealthMonitor />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/push-notifications">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Push Notifications">
            <PushNotifications />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payment-verification">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payment Verification">
            <PaymentVerification />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/policy-manager">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Policy Manager">
            <PolicyManager />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/policy-safety-hub">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Policy & Safety Hub">
            <PolicySafetyHub />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reports-management">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Reports Management">
            <ReportsManagement />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/fraud-prevention">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Fraud Prevention Center">
            <FraudPreventionCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/finance-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Finance Center">
            <FinanceCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payout-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payout Center">
            <PayoutCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/finance-logs">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Finance Audit Logs">
            <FinanceLogs />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/security-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Security Center">
            <SecurityCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reputation-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Reputation Center">
            <ReputationCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/data-governance">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Data Governance Center">
            <DataGovernanceCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/backup-recovery">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Backup & Recovery">
            <BackupRecovery />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/audit-console">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Audit Console">
            <AuditConsole />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/system-health-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="System Health Center">
            <SystemHealthCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/launch-readiness">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Launch Readiness Center">
            <LaunchReadinessCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Phase 3C: Enterprise Admin Intelligence Layer */}
      <Route path="/admin/intelligence">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Intelligence Dashboard">
            <IntelligenceDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/safepilot">
        <ProtectedRoute allowedRoles={["admin"]}>
          <SafePilotPage />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/safepilot-intelligence">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="SafePilot Analytics">
            <SafePilotIntelligence />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/safepilot/analytics">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="SafePilot Analytics">
            <SafePilotIntelligence />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/operations-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Operations Center">
            <OperationsCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Observability Center - Backend enforces SUPER_ADMIN/INFRA_ADMIN role check */}
      <Route path="/admin/observability">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Observability Center">
            <ObservabilityCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/driver-support">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Driver Support">
            <AdminDriverSupportCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      {/* Admin Support Center Routes */}
      <Route path="/admin/support-portal/tickets/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Support Ticket">
            <AdminSupportTicketDetail2 />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/tickets">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Support Tickets">
            <AdminSupportTickets />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/live-chat">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Live Chat">
            <AdminSupportLiveChat />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/phone">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Phone Support">
            <AdminSupportPhone />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/articles/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Article">
            <AdminSupportArticle />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/help">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Help Center">
            <AdminSupportHelp />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/contact">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Contact Support">
            <AdminSupportContact />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/status">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="System Status">
            <AdminSupportStatus />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Support Portal">
            <AdminSupportHub />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Phase 4: Enterprise Admin Features */}
      <Route path="/admin/complaint-resolution">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Complaint Resolution System">
            <ComplaintResolution />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/refund-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Refund & Adjustment Center">
            <RefundCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/legal-requests">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Legal Requests Dashboard">
            <LegalRequestsDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/communication-hub">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Admin Communication Hub">
            <CommunicationHub />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/document-manager">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Document Manager">
            <DocumentManager />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/driver-violations">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Driver Violations">
            <DriverViolations />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/trust-safety">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Trust & Safety Review Board">
            <TrustSafety />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/policy-engine">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Policy Enforcement Engine">
            <PolicyEngine />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/activity-monitor">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Admin Activity Monitor">
            <ActivityMonitor />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ratings-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ratings & Review Center">
            <RatingsCenter />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/earnings-disputes">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Earnings Dispute Resolution">
            <EarningsDisputes />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ride-timeline">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ride Timeline Viewer">
            <RideTimeline />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ride-timeline/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Ride Timeline Viewer">
            <RideTimeline />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notification-rules">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Notification Rules Engine">
            <NotificationRules />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payment-integrity">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Payment Integrity Dashboard">
            <PaymentIntegrity />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/global-search">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Global Search">
            <GlobalSearch />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/safety-replay">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Safety Incident Replay">
            <SafetyReplay />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/map-control">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Real-time Admin Map Control">
            <MapControl />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/email-templates">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Email Template Editor">
            <EmailTemplates />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/sms-templates">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="SMS Template & Automation">
            <SMSTemplates />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/admin-chat">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout pageTitle="Internal Admin Chat">
            <AdminChat />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Test routes - Development only */}
      <Route path="/test/driver-public-card">
        <TestDriverPublicCard />
      </Route>

      {/* Shop Partner Routes (BD only) */}
      <Route path="/shop-partner/staged-onboarding">
        <ShopPartnerGuard allowSetup>
          <ShopPartnerStagedOnboarding />
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/onboarding">
        <ShopPartnerGuard allowSetup>
          <ShopPartnerOnboarding />
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/setup">
        <ShopPartnerGuard allowSetup>
          <ShopPartnerSetup />
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/products/new">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerProductForm />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/products/:id">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerProductForm />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/products">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerProducts />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/orders">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerOrders />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/wallet">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerWallet />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/reviews">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerReviews />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/notifications">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerNotifications />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/settings">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerSettings />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/profile">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerProfile />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/privacy-policy">
        <ShopPartnerGuard>
          <ShopPartnerPrivacyPolicy />
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/dashboard">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerDashboard />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner">
        <ShopPartnerGuard>
          <ShopPartnerLayout>
            <ShopPartnerDashboard />
          </ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>

      {/* Customer BD Shop Routes */}
      <Route path="/customer/bd-product/:id">
        <BDProductDetails />
      </Route>
      <Route path="/customer/bd-shop/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BDShopDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/bd-shops">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BDShops />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/bd-shop-orders">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BDShopOrders />
        </ProtectedRoute>
      </Route>

      {/* Customer BD Tickets & Rentals Routes */}
      <Route path="/customer/bd-tickets">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BDTickets />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/bd-rentals">
        <ProtectedRoute allowedRoles={["customer"]}>
          <BDRentals />
        </ProtectedRoute>
      </Route>
      
      {/* BD Ticket Search & Booking (Public) */}
      <Route path="/bd/ticket-search">
        <BDTicketSearch />
      </Route>
      
      <Route path="/bd/seat-select">
        <BDSeatSelect />
      </Route>
      
      <Route path="/tickets/bd/checkout">
        <BDTicketCheckout />
      </Route>
      
      <Route path="/bd/ticket-booking">
        <BDTicketBooking />
      </Route>
      
      <Route path="/bd/booking-success">
        <BDBookingSuccess />
      </Route>

      {/* Ticket Operator Routes (BD only) */}
      <Route path="/ticket-operator/staged-onboarding">
        <TicketOperatorGuard allowSetup>
          <TicketOperatorStagedOnboarding />
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/onboarding">
        <TicketOperatorGuard allowSetup>
          <TicketOperatorOnboarding />
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/setup">
        <TicketOperatorGuard allowSetup>
          <TicketOperatorSetup />
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/tickets">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorTickets />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/rentals">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorRentals />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/bookings">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorBookings />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/wallet">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorWallet />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/profile">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorProfile />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/privacy-policy">
        <TicketOperatorGuard>
          <TicketOperatorPrivacyPolicy />
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/dashboard">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorDashboard />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator">
        <TicketOperatorGuard>
          <TicketOperatorLayout>
            <TicketOperatorDashboard />
          </TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>

      {/* Partner Registration Flows */}
      <Route path="/partner/driver/register">
        <ProtectedRoute allowedRoles={["customer"]}>
          <DriverRegistration />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/driver-registration">
        <ProtectedRoute allowedRoles={["customer"]}>
          <DriverRegistration />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/restaurant/register">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RestaurantRegistration />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/restaurant-registration">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RestaurantRegistration />
        </ProtectedRoute>
      </Route>

      {/* Partner Onboarding Start Pages */}
      <Route path="/partner/ride/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideDriverStart />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/delivery/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <DeliveryDriverStart />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/restaurant/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RestaurantStart />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/shop/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <ShopPartnerStart />
        </ProtectedRoute>
      </Route>
      <Route path="/partner/ticket/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <TicketOperatorStart />
        </ProtectedRoute>
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AccountLockedHandler() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const handleAccountLocked = (event: CustomEvent<{ message: string }>) => {
      toast({
        title: "Account Locked",
        description: event.detail.message || "Your account is locked. Please go to your profile to unlock it.",
        variant: "destructive",
      });
      
      if (user?.role === "customer") {
        setLocation("/customer/profile");
      }
    };

    window.addEventListener("safego:account-locked", handleAccountLocked as EventListener);
    return () => {
      window.removeEventListener("safego:account-locked", handleAccountLocked as EventListener);
    };
  }, [toast, setLocation, user]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationSoundProvider>
          <AuthProvider>
            <EatsCartProvider>
              <TooltipProvider>
                <Toaster />
                <AccountLockedHandler />
                <Router />
                <SafePilotButton />
              </TooltipProvider>
            </EatsCartProvider>
          </AuthProvider>
        </NotificationSoundProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
