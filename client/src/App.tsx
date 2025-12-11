import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationSoundProvider } from "@/contexts/NotificationSoundContext";
import { EatsCartProvider } from "@/contexts/EatsCartContext";
import { useToast } from "@/hooks/use-toast";

// Static imports for public pages - these must load reliably
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";
import SimpleLanding from "@/pages/SimpleLanding";

// Single lazy import for all authenticated routes
const AuthenticatedApp = lazy(() => import("@/routes/AuthenticatedApp"));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/">
        <SimpleLanding />
      </Route>
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/signup">
        <Signup />
      </Route>
      <Route path="/bd/ride">
        <SimpleLanding />
      </Route>
      <Route path="/bd/food">
        <SimpleLanding />
      </Route>
      <Route path="/bd/parcel">
        <SimpleLanding />
      </Route>
      <Route>
        <Suspense fallback={<LoadingSpinner />}>
          <AuthenticatedApp />
        </Suspense>
      </Route>
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
                <PublicRouter />
              </TooltipProvider>
            </EatsCartProvider>
          </AuthProvider>
        </NotificationSoundProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
