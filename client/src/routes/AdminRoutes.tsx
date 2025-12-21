import { lazy, Suspense } from "react";
import { Route } from "wouter";

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

export function AdminRoutes() {
  return (
    <>
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
      <Route path="/admin/finance">
        <AdminGuard>
          <AdminLayout>
            <AdminFinanceOverview />
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
      <Route path="/admin/shop-orders">
        <AdminGuard>
          <AdminLayout>
            <AdminShopOrders />
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
    </>
  );
}
