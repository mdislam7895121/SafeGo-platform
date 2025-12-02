import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Redirect } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TicketOperatorGuardProps {
  children: React.ReactNode;
  allowSetup?: boolean;
}

export function TicketOperatorGuard({ children, allowSetup = false }: TicketOperatorGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();

  const { data: profileData, isLoading: profileLoading, error } = useQuery<{ operator: any }>({
    queryKey: ["/api/ticket-operator/profile"],
    enabled: !!user && user.countryCode === "BD" && user.role === "customer",
    retry: false,
  });

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-operator" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.countryCode !== "BD") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2" data-testid="text-access-denied">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              Ticket & Rental Operator is only available in Bangladesh.
            </p>
            <Button onClick={() => window.history.back()} data-testid="button-go-back">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "customer") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2" data-testid="text-access-denied-role">অ্যাক্সেস অস্বীকৃত</h2>
            <p className="text-muted-foreground mb-4">
              আপনি টিকিট ও রেন্টাল অপারেটর হিসাবে নিবন্ধিত নন।
            </p>
            <Button onClick={() => window.history.back()} data-testid="button-go-back">
              ফিরে যান
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const operator = profileData?.operator;
  const hasProfile = !!operator;
  const isApproved = operator?.verificationStatus === "approved";
  const isPending = operator?.verificationStatus === "pending" || operator?.verificationStatus === "under_review";
  const isRejected = operator?.verificationStatus === "rejected";
  const isSetupRoute = location.startsWith("/ticket-operator/onboarding") || 
                       location.startsWith("/ticket-operator/setup");

  if (!hasProfile && allowSetup) {
    return <>{children}</>;
  }

  if (!hasProfile && !isSetupRoute) {
    return <Redirect to="/ticket-operator/onboarding" />;
  }

  if (hasProfile && isRejected && !isSetupRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2" data-testid="text-rejected">আবেদন প্রত্যাখ্যাত</h2>
            <p className="text-muted-foreground mb-4">
              {operator?.rejectionReason || "আপনার অপারেটর আবেদন প্রত্যাখ্যান করা হয়েছে।"}
            </p>
            <Button asChild data-testid="button-resubmit">
              <a href="/ticket-operator/onboarding">পুনরায় আবেদন করুন</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasProfile && isPending && !isSetupRoute) {
    return <Redirect to="/ticket-operator/setup" />;
  }

  if (hasProfile && !isApproved && !isPending && !isRejected && !isSetupRoute) {
    return <Redirect to="/ticket-operator/onboarding" />;
  }

  return <>{children}</>;
}

export function useBDTicketOperatorAccess() {
  const { user } = useAuth();
  
  const { data: profileData, isLoading } = useQuery<{ operator: any }>({
    queryKey: ["/api/ticket-operator/profile"],
    enabled: !!user && user.countryCode === "BD",
  });

  const isBD = user?.countryCode === "BD";
  const hasOperator = !!profileData?.operator;
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
    isLoading,
    operator: profileData?.operator,
    canAccessTicketOperator: isBD && user?.role === "customer",
    canAccessFullDashboard: isBD && hasOperator && isApproved,
    shouldRedirectToSetup: isBD && hasOperator && isPending,
  };
}
