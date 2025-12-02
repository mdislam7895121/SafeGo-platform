import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { getPostLoginPath } from "@/lib/roleRedirect";

interface TicketOperatorGuardProps {
  children: React.ReactNode;
  allowSetup?: boolean;
}

export function TicketOperatorGuard({ children, allowSetup = false }: TicketOperatorGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();

  const isTicketOperatorRole = user?.role === "ticket_operator" || user?.role === "pending_ticket_operator";

  const { data: profileData, isLoading: profileLoading, isError, error } = useQuery<{ operator: any }>({
    queryKey: ["/api/ticket-operator/profile"],
    enabled: !!user && user.countryCode === "BD" && isTicketOperatorRole,
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 auth errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000,
  });

  // Handle auth loading only
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-operator" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // Show loading only if actually loading and not in error state
  if (profileLoading && !isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-operator" />
      </div>
    );
  }

  // Handle API errors - 401/403 redirects to login, other errors treat as no profile
  if (isError) {
    const errorStatus = (error as any)?.status;
    if (errorStatus === 401 || errorStatus === 403) {
      console.warn("[TicketOperatorGuard] Auth error, redirecting to login");
      return <Redirect to="/login" />;
    }
    console.warn("[TicketOperatorGuard] API error, treating as no profile:", error);
  }

  if (user.countryCode !== "BD") {
    console.warn("[TicketOperatorGuard] Non-BD user accessing ticket_operator route, redirecting");
    return <Redirect to={getPostLoginPath(user)} />;
  }

  if (!isTicketOperatorRole) {
    console.warn("[TicketOperatorGuard] Wrong role accessing ticket_operator route, redirecting");
    return <Redirect to={getPostLoginPath(user)} />;
  }

  const operator = profileData?.operator;
  const hasProfile = !!operator;
  const isApproved = operator?.verificationStatus === "approved";
  const isPending = operator?.verificationStatus === "pending" || operator?.verificationStatus === "under_review";
  const isRejected = operator?.verificationStatus === "rejected";
  const isOnboardingRoute = location.startsWith("/ticket-operator/onboarding");
  const isSetupRoute = location.startsWith("/ticket-operator/setup");
  const isSetupOrOnboardingRoute = isOnboardingRoute || isSetupRoute;

  if (hasProfile && isApproved) {
    if (isSetupOrOnboardingRoute) {
      return <Redirect to="/ticket-operator/dashboard" />;
    }
    return <>{children}</>;
  }

  if (hasProfile && (isPending || isRejected)) {
    if (isSetupOrOnboardingRoute) {
      return <>{children}</>;
    }
    return <Redirect to="/ticket-operator/setup" />;
  }

  if (allowSetup) {
    return <>{children}</>;
  }

  if (!hasProfile) {
    if (isOnboardingRoute) {
      return <>{children}</>;
    }
    return <Redirect to="/ticket-operator/onboarding" />;
  }

  return <>{children}</>;
}

export function useBDTicketOperatorAccess() {
  const { user } = useAuth();
  
  const isTicketOperatorRole = user?.role === "ticket_operator" || user?.role === "pending_ticket_operator";

  const { data: profileData, isLoading, isError } = useQuery<{ operator: any }>({
    queryKey: ["/api/ticket-operator/profile"],
    enabled: !!user && user.countryCode === "BD" && isTicketOperatorRole,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000,
  });

  const isBD = user?.countryCode === "BD";
  // If there's an error, treat as no profile
  const hasOperator = !isError && !!profileData?.operator;
  const isApproved = profileData?.operator?.verificationStatus === "approved";
  const isPending = profileData?.operator?.verificationStatus === "pending" || 
                    profileData?.operator?.verificationStatus === "under_review";
  const isRejected = profileData?.operator?.verificationStatus === "rejected";

  return {
    isBD,
    hasOperator,
    isApproved,
    isPending,
    isRejected,
    isLoading: isLoading && !isError,
    isError,
    operator: profileData?.operator,
    canAccessTicketOperator: isBD && isTicketOperatorRole,
    canAccessFullDashboard: isBD && isTicketOperatorRole && hasOperator && isApproved,
    shouldRedirectToSetup: isBD && isTicketOperatorRole && hasOperator && isPending,
  };
}
