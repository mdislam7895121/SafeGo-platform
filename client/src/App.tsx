import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import QaDebugPanel from "@/components/qa/QaDebugPanel";
const SafePilotButton = lazy(() => import("@/components/safepilot/SafePilotButton").then(m => ({ default: m.SafePilotButton })));
const SafePilotChat = lazy(() => import("@/components/safepilot/SafePilotChat").then(m => ({ default: m.SafePilotChat })));
const CustomerSafePilotWrapper = lazy(() => import("@/components/safepilot/CustomerSafePilotWrapper").then(m => ({ default: m.CustomerSafePilotWrapper })));
import { NotificationSoundProvider } from "@/contexts/NotificationSoundContext";
import { EatsCartProvider } from "@/contexts/EatsCartContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Core auth pages (non-lazy for fast initial load)
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

// Lazy-loaded landing pages
const LandingPage = lazy(() => import("@/pages/landing/LandingPage"));
const ShopsPage = lazy(() => import("@/pages/landing/ShopsPage"));
const FoodPage = lazy(() => import("@/pages/landing/FoodPage"));
const RidePage = lazy(() => import("@/pages/landing/RidePage"));
const ParcelPage = lazy(() => import("@/pages/landing/ParcelPage"));
const TicketsPage = lazy(() => import("@/pages/landing/TicketsPage"));

// Lazy-loaded legal pages
const TermsPage = lazy(() => import("@/pages/landing/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/landing/PrivacyPage"));
const CookiesPage = lazy(() => import("@/pages/landing/CookiesPage"));
const SafetyPolicyPage = lazy(() => import("@/pages/landing/SafetyPolicyPage"));
const DataDeletionPage = lazy(() => import("@/pages/landing/DataDeletionPage"));
const PartnerTermsPage = lazy(() => import("@/pages/landing/PartnerTermsPage"));
const SafetyPage = lazy(() => import("@/pages/landing/SafetyPage"));
const ContactPage = lazy(() => import("@/pages/landing/ContactPage"));
const HelpPage = lazy(() => import("@/pages/landing/HelpPage"));
const HelpCenterPage = lazy(() => import("@/pages/landing/HelpCenterPage"));
const SupportPage = lazy(() => import("@/pages/landing/SupportPage"));
const AccessibilityPage = lazy(() => import("@/pages/landing/AccessibilityPage"));
const CommunityGuidelinesPage = lazy(() => import("@/pages/landing/CommunityGuidelinesPage"));

// Lazy-loaded company pages
const AboutPage = lazy(() => import("@/pages/landing/AboutPage"));
const CareersPage = lazy(() => import("@/pages/landing/CareersPage"));
const PressPage = lazy(() => import("@/pages/landing/PressPage"));
const BlogPage = lazy(() => import("@/pages/landing/BlogPage"));

// Dynamic CMS page
const DynamicPage = lazy(() => import("@/pages/landing/DynamicPage"));

// Lazy-loaded route modules for major sections
const AdminRoutes = lazy(() => import("@/routes/AdminRoutes").then(m => ({ default: m.AdminRoutes })));
const DriverRoutes = lazy(() => import("@/routes/DriverRoutes").then(m => ({ default: m.DriverRoutes })));
const RestaurantRoutes = lazy(() => import("@/routes/RestaurantRoutes").then(m => ({ default: m.RestaurantRoutes })));

// Lazy-loaded customer pages
const CustomerProfile = lazy(() => import("@/pages/customer/profile"));
const CustomerKYC = lazy(() => import("@/pages/customer/kyc"));
const CustomerActivity = lazy(() => import("@/pages/customer/activity"));
const UnifiedBooking = lazy(() => import("@/pages/customer/unified-booking"));
const EatsHome = lazy(() => import("@/pages/customer/eats-home"));
const EatsRestaurant = lazy(() => import("@/pages/customer/eats-restaurant"));
const FoodCheckout = lazy(() => import("@/pages/customer/food-checkout"));
const FoodOrderTracking = lazy(() => import("@/pages/customer/food-order-tracking"));
const FoodOrderReceipt = lazy(() => import("@/pages/customer/food-order-receipt"));
const FoodOrdersHistory = lazy(() => import("@/pages/customer/food-orders-history"));
const ParcelRequest = lazy(() => import("@/pages/customer/parcel-request"));
const ParcelTracking = lazy(() => import("@/pages/customer/parcel-tracking"));
const CustomerWallet = lazy(() => import("@/pages/customer/wallet"));
const CustomerNotifications = lazy(() => import("@/pages/customer/notifications"));
const CustomerSupport = lazy(() => import("@/pages/customer/support"));
const RideRequestPage = lazy(() => import("@/pages/customer/ride-request-page"));
const RideTrackingPage = lazy(() => import("@/pages/customer/ride-tracking-page"));
const RideDetails = lazy(() => import("@/pages/customer/ride-details"));
const RideAssigned = lazy(() => import("@/pages/customer/ride-assigned"));
const TripReceipt = lazy(() => import("@/pages/customer/trip-receipt"));
const CustomerProfileSettings = lazy(() => import("@/pages/customer/profile-settings"));
const CustomerPaymentMethods = lazy(() => import("@/pages/customer/payment-methods"));
const CustomerDeliveryAddresses = lazy(() => import("@/pages/customer/delivery-addresses"));
const CustomerSavedPlaces = lazy(() => import("@/pages/customer/saved-places"));
const CustomerPrivacyPolicy = lazy(() => import("@/pages/customer/privacy-policy"));
const CustomerDataPrivacy = lazy(() => import("@/pages/customer/data-privacy"));
const CustomerSafetyCenter = lazy(() => import("@/pages/customer/safety-center"));
const BDShops = lazy(() => import("@/pages/customer/bd-shops"));
const BDShopDetails = lazy(() => import("@/pages/customer/bd-shop-details"));
const BDProductDetails = lazy(() => import("@/pages/customer/bd-product-details"));
const BDShopOrders = lazy(() => import("@/pages/customer/bd-shop-orders"));
const BDTickets = lazy(() => import("@/pages/customer/bd-tickets"));
const BDMyTickets = lazy(() => import("@/pages/customer/bd-my-tickets"));

// Lazy-loaded shop partner pages
const ShopPartnerLayout = lazy(() => import("@/layouts/ShopPartnerLayout").then(m => ({ default: m.ShopPartnerLayout })));
const ShopPartnerDashboard = lazy(() => import("@/pages/shop-partner/dashboard"));
const ShopPartnerProducts = lazy(() => import("@/pages/shop-partner/products"));
const ShopPartnerOrders = lazy(() => import("@/pages/shop-partner/orders"));
const ShopPartnerWallet = lazy(() => import("@/pages/shop-partner/wallet"));
const ShopPartnerProfile = lazy(() => import("@/pages/shop-partner/profile"));
const ShopPartnerOnboarding = lazy(() => import("@/pages/shop-partner/onboarding"));
const ShopPartnerPrivacyPolicy = lazy(() => import("@/pages/shop-partner/privacy-policy"));

// Lazy-loaded ticket operator pages
const TicketOperatorLayout = lazy(() => import("@/layouts/TicketOperatorLayout").then(m => ({ default: m.TicketOperatorLayout })));
const TicketOperatorDashboard = lazy(() => import("@/pages/ticket-operator/dashboard"));
const TicketOperatorTickets = lazy(() => import("@/pages/ticket-operator/tickets"));
const TicketOperatorBookings = lazy(() => import("@/pages/ticket-operator/bookings"));
const TicketOperatorWallet = lazy(() => import("@/pages/ticket-operator/wallet"));
const TicketOperatorProfile = lazy(() => import("@/pages/ticket-operator/profile"));
const TicketOperatorOnboarding = lazy(() => import("@/pages/ticket-operator/onboarding"));
const TicketOperatorPrivacyPolicy = lazy(() => import("@/pages/ticket-operator/privacy-policy"));

// Lazy-loaded partner registration pages
const DriverRegistration = lazy(() => import("@/pages/partner/driver-registration"));
const RestaurantRegistration = lazy(() => import("@/pages/partner/restaurant-registration"));
const DriverStatus = lazy(() => import("@/pages/partner/driver-status"));
const RideDriverStart = lazy(() => import("@/pages/partner/ride-start"));
const DeliveryDriverStart = lazy(() => import("@/pages/partner/delivery-start"));
const DeliveryDriverBikeStart = lazy(() => import("@/pages/partner/delivery-driver-start"));
const DeliveryDriverWizard = lazy(() => import("@/pages/partner/delivery-driver-wizard"));
const RestaurantStart = lazy(() => import("@/pages/partner/restaurant-start"));
const ShopPartnerStart = lazy(() => import("@/pages/partner/shop-start"));
const TicketOperatorStart = lazy(() => import("@/pages/partner/ticket-start"));

function LoadingSpinner() {
  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}
      data-testid="loading-spinner"
    >
      <div style={{ textAlign: 'center' }}>
        <div 
          style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }}
        />
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function CustomerGuard({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["customer"]}>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

function ShopPartnerGuard({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["shop_partner"]}>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

function TicketOperatorGuard({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["ticket_operator"]}>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to role-appropriate page when logged in and accessing root
  if (user && location === "/") {
    const redirectPath = getPostLoginPath(user);
    return <Redirect to={redirectPath} />;
  }

  return (
      <Switch>
        {/* Major route modules - use wouter v3 wildcard for matching */}
        <Route path="/admin/*?">
          <Suspense fallback={<LoadingSpinner />}>
            <AdminRoutes />
          </Suspense>
        </Route>
        <Route path="/driver/*?">
          <Suspense fallback={<LoadingSpinner />}>
            <DriverRoutes />
          </Suspense>
        </Route>
        <Route path="/restaurant/*?">
          <Suspense fallback={<LoadingSpinner />}>
            <RestaurantRoutes />
          </Suspense>
        </Route>

        {/* Public Routes */}
        <Route path="/">
          <Suspense fallback={<LoadingSpinner />}>
            <LandingPage />
          </Suspense>
        </Route>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/signup">
          <Signup />
        </Route>
        <Route path="/shops">
          <Suspense fallback={<LoadingSpinner />}>
            <ShopsPage />
          </Suspense>
        </Route>
        <Route path="/food">
          <Suspense fallback={<LoadingSpinner />}>
            <FoodPage />
          </Suspense>
        </Route>
        <Route path="/ride">
          <Suspense fallback={<LoadingSpinner />}>
            <RidePage />
          </Suspense>
        </Route>
        <Route path="/parcel">
          <Suspense fallback={<LoadingSpinner />}>
            <ParcelPage />
          </Suspense>
        </Route>
        <Route path="/tickets">
          <Suspense fallback={<LoadingSpinner />}>
            <TicketsPage />
          </Suspense>
        </Route>

        {/* Legal & Support Pages */}
        <Route path="/terms">
          <Suspense fallback={<LoadingSpinner />}>
            <TermsPage />
          </Suspense>
        </Route>
        <Route path="/privacy">
          <Suspense fallback={<LoadingSpinner />}>
            <PrivacyPage />
          </Suspense>
        </Route>
        <Route path="/cookies">
          <Suspense fallback={<LoadingSpinner />}>
            <CookiesPage />
          </Suspense>
        </Route>
        <Route path="/safety-policy">
          <Suspense fallback={<LoadingSpinner />}>
            <SafetyPolicyPage />
          </Suspense>
        </Route>
        <Route path="/data-deletion">
          <Suspense fallback={<LoadingSpinner />}>
            <DataDeletionPage />
          </Suspense>
        </Route>
        <Route path="/partner-terms">
          <Suspense fallback={<LoadingSpinner />}>
            <PartnerTermsPage />
          </Suspense>
        </Route>
        <Route path="/safety">
          <Suspense fallback={<LoadingSpinner />}>
            <SafetyPage />
          </Suspense>
        </Route>
        <Route path="/contact">
          <Suspense fallback={<LoadingSpinner />}>
            <ContactPage />
          </Suspense>
        </Route>
        <Route path="/help">
          <Suspense fallback={<LoadingSpinner />}>
            <HelpPage />
          </Suspense>
        </Route>
        <Route path="/help-center">
          <Suspense fallback={<LoadingSpinner />}>
            <HelpCenterPage />
          </Suspense>
        </Route>
        <Route path="/support">
          <Suspense fallback={<LoadingSpinner />}>
            <SupportPage />
          </Suspense>
        </Route>
        <Route path="/accessibility">
          <Suspense fallback={<LoadingSpinner />}>
            <AccessibilityPage />
          </Suspense>
        </Route>
        <Route path="/community-guidelines">
          <Suspense fallback={<LoadingSpinner />}>
            <CommunityGuidelinesPage />
          </Suspense>
        </Route>

        {/* Company Pages */}
        <Route path="/about">
          <Suspense fallback={<LoadingSpinner />}>
            <AboutPage />
          </Suspense>
        </Route>
        <Route path="/careers">
          <Suspense fallback={<LoadingSpinner />}>
            <CareersPage />
          </Suspense>
        </Route>
        <Route path="/press">
          <Suspense fallback={<LoadingSpinner />}>
            <PressPage />
          </Suspense>
        </Route>
        <Route path="/blog">
          <Suspense fallback={<LoadingSpinner />}>
            <BlogPage />
          </Suspense>
        </Route>

        {/* Dynamic CMS Pages */}
        <Route path="/p/:slug">
          <Suspense fallback={<LoadingSpinner />}>
            <DynamicPage />
          </Suspense>
        </Route>

        {/* Become Partner redirect */}
        <Route path="/become-partner">
          <Redirect to="/partner/driver/register" />
        </Route>

        {/* Customer Routes */}
      <Route path="/customer">
        <CustomerGuard><UnifiedBooking /></CustomerGuard>
      </Route>
      <Route path="/customer/home">
        <CustomerGuard><UnifiedBooking /></CustomerGuard>
      </Route>
      <Route path="/customer/profile">
        <CustomerGuard><CustomerProfile /></CustomerGuard>
      </Route>
      <Route path="/customer/kyc">
        <CustomerGuard><CustomerKYC /></CustomerGuard>
      </Route>
      <Route path="/customer/activity">
        <CustomerGuard><CustomerActivity /></CustomerGuard>
      </Route>
      <Route path="/customer/eats">
        <CustomerGuard><EatsHome /></CustomerGuard>
      </Route>
      <Route path="/customer/eats/restaurant/:id">
        <CustomerGuard><EatsRestaurant /></CustomerGuard>
      </Route>
      <Route path="/customer/food-checkout">
        <CustomerGuard><FoodCheckout /></CustomerGuard>
      </Route>
      <Route path="/customer/food-order/:id/tracking">
        <CustomerGuard><FoodOrderTracking /></CustomerGuard>
      </Route>
      <Route path="/customer/food-order/:id/receipt">
        <CustomerGuard><FoodOrderReceipt /></CustomerGuard>
      </Route>
      <Route path="/customer/food-orders">
        <CustomerGuard><FoodOrdersHistory /></CustomerGuard>
      </Route>
      <Route path="/customer/parcel">
        <CustomerGuard><ParcelRequest /></CustomerGuard>
      </Route>
      <Route path="/customer/parcel/:id">
        <CustomerGuard><ParcelTracking /></CustomerGuard>
      </Route>
      <Route path="/customer/wallet">
        <CustomerGuard><CustomerWallet /></CustomerGuard>
      </Route>
      <Route path="/customer/notifications">
        <CustomerGuard><CustomerNotifications /></CustomerGuard>
      </Route>
      <Route path="/customer/support">
        <CustomerGuard><CustomerSupport /></CustomerGuard>
      </Route>
      <Route path="/customer/ride">
        <CustomerGuard><UnifiedBooking /></CustomerGuard>
      </Route>
      <Route path="/customer/ride-request">
        <CustomerGuard><RideRequestPage /></CustomerGuard>
      </Route>
      <Route path="/customer/ride/:id/tracking">
        <CustomerGuard><RideTrackingPage /></CustomerGuard>
      </Route>
      <Route path="/customer/ride/:id">
        <CustomerGuard><RideDetails /></CustomerGuard>
      </Route>
      <Route path="/customer/ride/:id/assigned">
        <CustomerGuard><RideAssigned /></CustomerGuard>
      </Route>
      <Route path="/customer/trip/:id/receipt">
        <CustomerGuard><TripReceipt /></CustomerGuard>
      </Route>
      <Route path="/customer/settings">
        <CustomerGuard><CustomerProfileSettings /></CustomerGuard>
      </Route>
      <Route path="/customer/payment-methods">
        <CustomerGuard><CustomerPaymentMethods /></CustomerGuard>
      </Route>
      <Route path="/customer/delivery-addresses">
        <CustomerGuard><CustomerDeliveryAddresses /></CustomerGuard>
      </Route>
      <Route path="/customer/saved-places">
        <CustomerGuard><CustomerSavedPlaces /></CustomerGuard>
      </Route>
      <Route path="/customer/privacy-policy">
        <CustomerGuard><CustomerPrivacyPolicy /></CustomerGuard>
      </Route>
      <Route path="/customer/data-privacy">
        <CustomerGuard><CustomerDataPrivacy /></CustomerGuard>
      </Route>
      <Route path="/customer/safety">
        <CustomerGuard><CustomerSafetyCenter /></CustomerGuard>
      </Route>
      <Route path="/customer/bd-shops">
        <CustomerGuard><BDShops /></CustomerGuard>
      </Route>
      <Route path="/customer/bd-shop/:id">
        <CustomerGuard><BDShopDetails /></CustomerGuard>
      </Route>
      <Route path="/customer/bd-product/:id">
        <CustomerGuard><BDProductDetails /></CustomerGuard>
      </Route>
      <Route path="/customer/bd-shop-orders">
        <CustomerGuard><BDShopOrders /></CustomerGuard>
      </Route>
      <Route path="/customer/bd-tickets">
        <CustomerGuard><BDTickets /></CustomerGuard>
      </Route>
      <Route path="/customer/bd-my-tickets">
        <CustomerGuard><BDMyTickets /></CustomerGuard>
      </Route>

      {/* Shop Partner Routes */}
      <Route path="/shop-partner">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerDashboard /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/dashboard">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerDashboard /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/products">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerProducts /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/orders">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerOrders /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/wallet">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerWallet /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/profile">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerProfile /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/onboarding">
        <ShopPartnerGuard>
          <ShopPartnerLayout><ShopPartnerOnboarding /></ShopPartnerLayout>
        </ShopPartnerGuard>
      </Route>
      <Route path="/shop-partner/privacy-policy">
        <ShopPartnerGuard><ShopPartnerPrivacyPolicy /></ShopPartnerGuard>
      </Route>

      {/* Ticket Operator Routes */}
      <Route path="/ticket-operator">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorDashboard /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/dashboard">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorDashboard /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/tickets">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorTickets /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/bookings">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorBookings /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/wallet">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorWallet /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/profile">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorProfile /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/onboarding">
        <TicketOperatorGuard>
          <TicketOperatorLayout><TicketOperatorOnboarding /></TicketOperatorLayout>
        </TicketOperatorGuard>
      </Route>
      <Route path="/ticket-operator/privacy-policy">
        <TicketOperatorGuard><TicketOperatorPrivacyPolicy /></TicketOperatorGuard>
      </Route>

      {/* Partner Registration Routes */}
      <Route path="/partner/register">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><DriverRegistration /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/driver/register">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><DriverRegistration /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/restaurant/register">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><RestaurantRegistration /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/driver/status">
        <ProtectedRoute allowedRoles={["pending_driver", "driver"]}>
          <Suspense fallback={<LoadingSpinner />}><DriverStatus /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/ride/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><RideDriverStart /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/delivery/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><DeliveryDriverStart /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/delivery-driver/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><DeliveryDriverBikeStart /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/delivery-driver/wizard">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><DeliveryDriverWizard /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/restaurant/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><RestaurantStart /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/shop/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><ShopPartnerStart /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/partner/ticket/start">
        <ProtectedRoute allowedRoles={["customer"]}>
          <Suspense fallback={<LoadingSpinner />}><TicketOperatorStart /></Suspense>
        </ProtectedRoute>
      </Route>

      {/* Partner Signup Redirects (for footer links) */}
      <Route path="/driver/signup">
        <Redirect to="/partner/driver/register" />
      </Route>
      <Route path="/restaurant/signup">
        <Redirect to="/partner/restaurant/register" />
      </Route>
      <Route path="/partner/shop">
        <Redirect to="/partner/shop/start" />
      </Route>
      <Route path="/partner/ticket">
        <Redirect to="/partner/ticket/start" />
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NotificationSoundProvider>
            <AuthProvider>
              <EatsCartProvider>
                <TooltipProvider>
                  <Toaster />
                  <AccountLockedHandler />
                  <ErrorBoundary>
                    <Router />
                  </ErrorBoundary>
                  <QaDebugPanel />
                  <Suspense fallback={null}>
                    <SafePilotButton />
                  </Suspense>
                  <Suspense fallback={null}>
                    <SafePilotChat />
                  </Suspense>
                  <Suspense fallback={null}>
                    <CustomerSafePilotWrapper />
                  </Suspense>
                </TooltipProvider>
              </EatsCartProvider>
            </AuthProvider>
          </NotificationSoundProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
