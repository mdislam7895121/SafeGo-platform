import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Auth pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import CustomerRegister from "@/pages/customer-register";

// Customer pages
import CustomerHome from "@/pages/customer/home";
import CustomerProfile from "@/pages/customer/profile";
import CustomerKYC from "@/pages/customer/kyc";
import CustomerActivity from "@/pages/customer/activity";
import RideRequest from "@/pages/customer/ride-request";
import RideDetails from "@/pages/customer/ride-details";
import FoodRestaurants from "@/pages/customer/food-restaurants";
import FoodRestaurantDetails from "@/pages/customer/food-restaurant-details";
import ParcelRequest from "@/pages/customer/parcel-request";
import CustomerSupport from "@/pages/customer/support";
import CustomerWallet from "@/pages/customer/wallet";
import CustomerNotifications from "@/pages/customer/notifications";

// Driver pages
import { DriverLayout } from "@/layouts/DriverLayout";
import DriverHome from "@/pages/driver/home";
import DriverDashboard from "@/pages/driver/dashboard";
import DriverProfile from "@/pages/driver/profile";
import DriverVehicle from "@/pages/driver/vehicle";
import DriverWallet from "@/pages/driver/wallet";
import DriverKYCDocuments from "@/pages/driver/kyc-documents";
import DriverSupport from "@/pages/driver/support";
import DriverRefer from "@/pages/driver/refer";
import DriverPremium from "@/pages/driver/premium";
import DriverPromotions from "@/pages/driver/promotions";
import DriverHelp from "@/pages/driver/help";
import DriverAccount from "@/pages/driver/account";
import DriverAccountVehicles from "@/pages/driver/account/vehicles";
import DriverAccountWorkHub from "@/pages/driver/account/work-hub";
import DriverAccountPayment from "@/pages/driver/account/payment";
import DriverAccountTaxInfo from "@/pages/driver/account/tax-info";
import DriverAccountManage from "@/pages/driver/account/manage";
import DriverAccountAddress from "@/pages/driver/account/address";
import DriverAccountNotifications from "@/pages/driver/account/notifications";
import DriverAccountPrivacy from "@/pages/driver/account/privacy";
import DriverAccountLanguage from "@/pages/driver/account/language";
import DriverAccountDarkMode from "@/pages/driver/account/dark-mode";
import DriverAccountMapTheme from "@/pages/driver/account/map-theme";
import DriverAccountNavigation from "@/pages/driver/account/navigation";
import DriverAccountBlockedUsers from "@/pages/driver/account/blocked-users";
import DriverAccountPermissions from "@/pages/driver/account/permissions";
import DriverAccountAbout from "@/pages/driver/account/about";

// Restaurant pages
import RestaurantHome from "@/pages/restaurant/home";
import RestaurantProfile from "@/pages/restaurant/profile";
import RestaurantSupport from "@/pages/restaurant/support";
import RestaurantWallet from "@/pages/restaurant/wallet";

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

      {/* Customer routes */}
      <Route path="/customer">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerHome />
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
      <Route path="/customer/ride">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideRequest />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/ride-request">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideRequest />
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
      <Route path="/customer/parcel">
        <ProtectedRoute allowedRoles={["customer"]}>
          <ParcelRequest />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/support">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerSupport />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/profile/kyc">
        <ProtectedRoute allowedRoles={["customer"]}>
          <CustomerKYC />
        </ProtectedRoute>
      </Route>
      <Route path="/customer/rides/:id">
        <ProtectedRoute allowedRoles={["customer"]}>
          <RideDetails />
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

      {/* Driver routes */}
      {/* Legacy /driver route uses standalone DriverHome layout */}
      <Route path="/driver">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverHome />
        </ProtectedRoute>
      </Route>
      {/* New driver routes wrapped with unified DriverLayout */}
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
      <Route path="/driver/support">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Support">
            <DriverSupport />
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
      <Route path="/driver/refer">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Refer & Earn">
            <DriverRefer />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/premium">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="SafeGo Premium">
            <DriverPremium />
          </DriverLayout>
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
      <Route path="/driver/account/tax-info">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Tax Info">
            <DriverAccountTaxInfo />
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
          <DriverLayout pageTitle="Dark Mode">
            <DriverAccountDarkMode />
          </DriverLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/driver/account/map-theme">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverLayout pageTitle="Map Theme">
            <DriverAccountMapTheme />
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

      {/* Restaurant routes */}
      <Route path="/restaurant">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantHome />
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/profile">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantProfile />
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/support">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantSupport />
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/wallet">
        <ProtectedRoute allowedRoles={["restaurant"]}>
          <RestaurantWallet />
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
      <Route path="/admin/support-chat">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSupportChat />
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

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
