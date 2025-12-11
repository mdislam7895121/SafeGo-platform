import { lazy, Suspense } from "react";
import { Route } from "wouter";

const DriverLayout = lazy(() => import("@/layouts/DriverLayout").then(m => ({ default: m.DriverLayout })));

const DriverDashboard = lazy(() => import("@/pages/driver/dashboard"));
const DriverHome = lazy(() => import("@/pages/driver/home"));
const DriverProfile = lazy(() => import("@/pages/driver/profile"));
const DriverVehicle = lazy(() => import("@/pages/driver/vehicle"));
const DriverWallet = lazy(() => import("@/pages/driver/wallet"));
const DriverTrips = lazy(() => import("@/pages/driver/trips"));
const DriverTripDetail = lazy(() => import("@/pages/driver/trip-detail"));
const DriverPerformance = lazy(() => import("@/pages/driver/performance"));
const DriverKYCDocuments = lazy(() => import("@/pages/driver/kyc-documents"));
const DriverSupport = lazy(() => import("@/pages/driver/support"));
const DriverEarnings = lazy(() => import("@/pages/driver/earnings"));
const DriverPayouts = lazy(() => import("@/pages/driver/payouts"));
const DriverDocuments = lazy(() => import("@/pages/driver/documents"));
const DriverSettings = lazy(() => import("@/pages/driver/settings"));
const DriverAccount = lazy(() => import("@/pages/driver/account"));
const DeliveryDriverDashboard = lazy(() => import("@/pages/driver/delivery-dashboard"));
const DriverLiveAssignment = lazy(() => import("@/pages/driver/live-assignment"));
const DriverPoints = lazy(() => import("@/pages/driver/points"));
const DriverPromotions = lazy(() => import("@/pages/driver/promotions"));
const DriverHelp = lazy(() => import("@/pages/driver/help"));
const DriverSafety = lazy(() => import("@/pages/driver/safety"));
const DriverTripActive = lazy(() => import("@/pages/driver/trip-active"));
const DriverTripRequests = lazy(() => import("@/pages/driver/trip-requests"));
const DriverMap = lazy(() => import("@/pages/driver/map"));
const DriverPrivacyPolicy = lazy(() => import("@/pages/driver/privacy-policy"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="loading-driver">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function DriverGuard({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

export function DriverRoutes() {
  return (
    <>
      <Route path="/driver">
        <DriverGuard>
          <DriverLayout>
            <DriverDashboard />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/dashboard">
        <DriverGuard>
          <DriverLayout>
            <DriverDashboard />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/home">
        <DriverGuard>
          <DriverLayout>
            <DriverHome />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/profile">
        <DriverGuard>
          <DriverLayout>
            <DriverProfile />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/vehicle">
        <DriverGuard>
          <DriverLayout>
            <DriverVehicle />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/wallet">
        <DriverGuard>
          <DriverLayout>
            <DriverWallet />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/trips">
        <DriverGuard>
          <DriverLayout>
            <DriverTrips />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/trips/:id">
        <DriverGuard>
          <DriverLayout>
            <DriverTripDetail />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/performance">
        <DriverGuard>
          <DriverLayout>
            <DriverPerformance />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/kyc">
        <DriverGuard>
          <DriverLayout>
            <DriverKYCDocuments />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/support">
        <DriverGuard>
          <DriverLayout>
            <DriverSupport />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/earnings">
        <DriverGuard>
          <DriverLayout>
            <DriverEarnings />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/payouts">
        <DriverGuard>
          <DriverLayout>
            <DriverPayouts />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/documents">
        <DriverGuard>
          <DriverLayout>
            <DriverDocuments />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/settings">
        <DriverGuard>
          <DriverLayout>
            <DriverSettings />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/account">
        <DriverGuard>
          <DriverLayout>
            <DriverAccount />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/delivery-dashboard">
        <DriverGuard>
          <DriverLayout>
            <DeliveryDriverDashboard />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/live-assignment">
        <DriverGuard>
          <DriverLayout>
            <DriverLiveAssignment />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/points">
        <DriverGuard>
          <DriverLayout>
            <DriverPoints />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/promotions">
        <DriverGuard>
          <DriverLayout>
            <DriverPromotions />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/help">
        <DriverGuard>
          <DriverLayout>
            <DriverHelp />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/safety">
        <DriverGuard>
          <DriverLayout>
            <DriverSafety />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/trip-active">
        <DriverGuard>
          <DriverLayout>
            <DriverTripActive />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/trip-requests">
        <DriverGuard>
          <DriverLayout>
            <DriverTripRequests />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/map">
        <DriverGuard>
          <DriverLayout>
            <DriverMap />
          </DriverLayout>
        </DriverGuard>
      </Route>
      <Route path="/driver/privacy-policy">
        <DriverGuard>
          <DriverPrivacyPolicy />
        </DriverGuard>
      </Route>
    </>
  );
}
