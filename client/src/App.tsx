import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationSoundProvider } from "@/contexts/NotificationSoundContext";
import { EatsCartProvider } from "@/contexts/EatsCartContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";

// Auth pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import CustomerRegister from "@/pages/customer-register";

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
import FoodRestaurants from "@/pages/customer/food-restaurants";
import FoodRestaurantDetails from "@/pages/customer/food-restaurant-details";
import FoodCheckout from "@/pages/customer/food-checkout";
import EatsHome from "@/pages/customer/eats-home";
import EatsRestaurant from "@/pages/customer/eats-restaurant";
import FoodOrderTracking from "@/pages/customer/food-order-tracking";
import FoodOrderReceipt from "@/pages/customer/food-order-receipt";
import FoodOrdersHistory from "@/pages/customer/food-orders-history";
import CustomerMyReviews from "@/pages/customer/my-reviews";
import ParcelRequest from "@/pages/customer/parcel-request";
import UnifiedBooking from "@/pages/customer/unified-booking";
import CustomerSupport from "@/pages/customer/support";
import MySupportTickets from "@/pages/customer/my-support-tickets";
import CreateSupportTicket from "@/pages/customer/create-support-ticket";
import SupportTicketDetail from "@/pages/customer/support-ticket-detail";
import CustomerWallet from "@/pages/customer/wallet";
import CustomerNotifications from "@/pages/customer/notifications";
import TripReceipt from "@/pages/customer/trip-receipt";
import CustomerProfileSettings from "@/pages/customer/profile-settings";
import CustomerPaymentMethods from "@/pages/customer/payment-methods";
import CustomerDeliveryAddresses from "@/pages/customer/delivery-addresses";
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
import DriverMap from "@/pages/driver/map";

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
import StaffManagement from "@/pages/restaurant/staff";
import StaffActivity from "@/pages/restaurant/staff-activity";

// Admin pages
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

// Test pages
import TestDriverPublicCard from "@/pages/test/driver-public-card";

import NotFound from "@/pages/not-found";

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  if (user) {
    const roleRoutes: Record<string, string> = {
      customer: "/customer",
      driver: "/driver",
      restaurant: "/restaurant",
      admin: "/admin",
    };
    return <Redirect to={roleRoutes[user.role] || "/customer"} />;
  }

  return <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/customer-register" component={CustomerRegister} />

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
      <Route path="/customer/food/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <FoodRestaurantDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/food">
        <ProtectedRoute allowedRoles={["customer"]}>
          <FoodRestaurants />
        </ProtectedRoute>
      </Route>
      {/* New DoorDash-style Eats routes */}
      <Route path="/customer/eats/:id">
        <EatsRestaurant />
      </Route>
      <Route path="/customer/eats">
        <EatsHome />
      </Route>
      <Route path="/customer/parcel">
        <ProtectedRoute allowedRoles={["customer"]}>
          <ParcelRequest />
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
      {/* Main driver route redirects to dashboard with unified layout */}
      <Route path="/driver">
        <ProtectedRoute allowedRoles={["driver"]}>
          <Redirect to="/driver/dashboard" />
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
      <Route path="/driver/map">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Map">
            <DriverMap />
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
          <AdminHome />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminUsers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/kyc">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminKYC />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/documents">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDocumentCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDrivers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDriverDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminCustomers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminCustomerDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/restaurants">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminRestaurants />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/restaurants/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminRestaurantDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/restaurants/:id/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminRestaurantSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/complaints">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminComplaints />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/complaints/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminComplaintDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settlement">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSettlement />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/parcels/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminParcelDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/parcels">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminParcels />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/activity-log">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminActivityLog />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notifications">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminNotifications />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/referral-settings/:id/edit">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminReferralSettingsEdit />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/referral-settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminReferralSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/opportunity-bonuses/:id/edit">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminOpportunityBonusesEdit />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/opportunity-bonuses">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminOpportunityBonuses />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/driver-promotions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDriverPromotions />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ride-promotions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminRidePromotions />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reviews">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminReviews />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/media">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminMedia />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-chat">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportChat />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support/:ticketId">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportTicketDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/wallets/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminWalletDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/wallets">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminWallets />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/requests">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPayoutsRequests />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/schedule">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPayoutsSchedule />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/manual">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPayoutsManual />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/reports">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPayoutsReports />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts/restaurants">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminRestaurantPayouts />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payouts">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPayouts />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/earnings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminEarnings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminAnalytics />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/performance">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminPerformance />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/monitoring">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminMonitoring />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/security-center">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSecurityCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/driver-support">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDriverSupportCenter />
        </ProtectedRoute>
      </Route>
      {/* Admin Support Center Routes */}
      <Route path="/admin/support-portal/tickets/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportTicketDetail2 />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/tickets">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportTickets />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/live-chat">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportLiveChat />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/phone">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportPhone />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/articles/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportArticle />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/help">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportHelp />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/contact">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportContact />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal/status">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportStatus />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support-portal">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportHub />
        </ProtectedRoute>
      </Route>

      {/* Test routes - Development only */}
      <Route path="/test/driver-public-card">
        <TestDriverPublicCard />
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
              </TooltipProvider>
            </EatsCartProvider>
          </AuthProvider>
        </NotificationSoundProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
