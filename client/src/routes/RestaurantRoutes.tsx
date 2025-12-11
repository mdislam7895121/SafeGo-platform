import { lazy, Suspense } from "react";
import { Route } from "wouter";

const RestaurantLayout = lazy(() => import("@/components/restaurant/RestaurantLayout").then(m => ({ default: m.RestaurantLayout })));

const RestaurantHome = lazy(() => import("@/pages/restaurant/home"));
const LiveOrders = lazy(() => import("@/pages/restaurant/orders-live"));
const OrdersOverview = lazy(() => import("@/pages/restaurant/orders-overview"));
const RestaurantOrders = lazy(() => import("@/pages/restaurant/orders"));
const RestaurantOrderDetails = lazy(() => import("@/pages/restaurant/order-details"));
const RestaurantMenu = lazy(() => import("@/pages/restaurant/menu"));
const MenuCategories = lazy(() => import("@/pages/restaurant/menu-categories"));
const AddMenuItem = lazy(() => import("@/pages/restaurant/menu-new"));
const EditMenuItem = lazy(() => import("@/pages/restaurant/menu-edit"));
const RestaurantPayouts = lazy(() => import("@/pages/restaurant/payouts"));
const RestaurantPayoutsHistory = lazy(() => import("@/pages/restaurant/payouts-history"));
const AnalyticsOverview = lazy(() => import("@/pages/restaurant/analytics-overview"));
const Reviews = lazy(() => import("@/pages/restaurant/reviews"));
const RestaurantBranding = lazy(() => import("@/pages/restaurant/branding"));
const SettingsProfile = lazy(() => import("@/pages/restaurant/settings-profile"));
const SettingsHours = lazy(() => import("@/pages/restaurant/settings-hours"));
const SettingsDelivery = lazy(() => import("@/pages/restaurant/settings-delivery"));
const DocumentsBusiness = lazy(() => import("@/pages/restaurant/documents-business"));
const DocumentsHealth = lazy(() => import("@/pages/restaurant/documents-health"));
const DocumentsKYC = lazy(() => import("@/pages/restaurant/documents-kyc"));
const RestaurantProfile = lazy(() => import("@/pages/restaurant/profile"));
const RestaurantSupport = lazy(() => import("@/pages/restaurant/support"));
const RestaurantWallet = lazy(() => import("@/pages/restaurant/wallet"));
const RestaurantPrivacyPolicy = lazy(() => import("@/pages/restaurant/privacy-policy"));
const RestaurantKitchen = lazy(() => import("@/pages/restaurant/kitchen"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="loading-restaurant">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function RestaurantGuard({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

export function RestaurantRoutes() {
  return (
    <>
      <Route path="/restaurant">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantHome />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/home">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantHome />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/orders-live">
        <RestaurantGuard>
          <RestaurantLayout>
            <LiveOrders />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/orders">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantOrders />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/orders-overview">
        <RestaurantGuard>
          <RestaurantLayout>
            <OrdersOverview />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/orders/:id">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantOrderDetails />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/menu">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantMenu />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/menu-categories">
        <RestaurantGuard>
          <RestaurantLayout>
            <MenuCategories />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/menu/new">
        <RestaurantGuard>
          <RestaurantLayout>
            <AddMenuItem />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/menu/:id/edit">
        <RestaurantGuard>
          <RestaurantLayout>
            <EditMenuItem />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/payouts">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantPayouts />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/payouts-history">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantPayoutsHistory />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/analytics">
        <RestaurantGuard>
          <RestaurantLayout>
            <AnalyticsOverview />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/reviews">
        <RestaurantGuard>
          <RestaurantLayout>
            <Reviews />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/branding">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantBranding />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/settings">
        <RestaurantGuard>
          <RestaurantLayout>
            <SettingsProfile />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/settings-profile">
        <RestaurantGuard>
          <RestaurantLayout>
            <SettingsProfile />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/settings-hours">
        <RestaurantGuard>
          <RestaurantLayout>
            <SettingsHours />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/settings-delivery">
        <RestaurantGuard>
          <RestaurantLayout>
            <SettingsDelivery />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/documents-business">
        <RestaurantGuard>
          <RestaurantLayout>
            <DocumentsBusiness />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/documents-health">
        <RestaurantGuard>
          <RestaurantLayout>
            <DocumentsHealth />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/documents-kyc">
        <RestaurantGuard>
          <RestaurantLayout>
            <DocumentsKYC />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/profile">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantProfile />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/support">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantSupport />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/wallet">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantWallet />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/privacy-policy">
        <RestaurantGuard>
          <RestaurantPrivacyPolicy />
        </RestaurantGuard>
      </Route>
      <Route path="/restaurant/kitchen">
        <RestaurantGuard>
          <RestaurantLayout>
            <RestaurantKitchen />
          </RestaurantLayout>
        </RestaurantGuard>
      </Route>
    </>
  );
}
