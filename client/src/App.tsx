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
import DriverHome from "@/pages/driver/home";
import DriverVehicle from "@/pages/driver/vehicle";
import DriverProfile from "@/pages/driver/profile";
import DriverKYCDocuments from "@/pages/driver/kyc-documents";
import DriverSupport from "@/pages/driver/support";
import DriverWallet from "@/pages/driver/wallet";

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
      <Route path="/driver">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverHome />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/vehicle">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverVehicle />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/profile">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverProfile />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/kyc-documents">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverKYCDocuments />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/support">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverSupport />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/wallet">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverWallet />
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
