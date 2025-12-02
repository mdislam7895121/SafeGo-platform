import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Redirect } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ShopPartnerGuardProps {
  children: React.ReactNode;
  allowSetup?: boolean;
}

export function ShopPartnerGuard({ children, allowSetup = false }: ShopPartnerGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();

  const { data: profileData, isLoading: profileLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
    enabled: !!user && user.countryCode === "BD",
  });

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              Shop Partner is only available in Bangladesh.
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
            <h2 className="text-xl font-bold mb-2">অ্যাক্সেস অস্বীকৃত</h2>
            <p className="text-muted-foreground mb-4">
              আপনি শপ পার্টনার হিসাবে নিবন্ধিত নন।
            </p>
            <Button onClick={() => window.history.back()} data-testid="button-go-back">
              ফিরে যান
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = profileData?.profile;
  const hasProfile = !!profile;
  const isApproved = profile?.verificationStatus === "approved";
  const isPending = profile?.verificationStatus === "pending";
  const isRejected = profile?.verificationStatus === "rejected";
  const isSetupRoute = location.startsWith("/shop-partner/onboarding") || 
                       location.startsWith("/shop-partner/setup");

  if (!hasProfile && !allowSetup && !isSetupRoute) {
    return <Redirect to="/shop-partner/onboarding" />;
  }

  if (hasProfile && isRejected) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">আবেদন প্রত্যাখ্যাত</h2>
            <p className="text-muted-foreground mb-4">
              {profile?.rejectionReason || "আপনার দোকান আবেদন প্রত্যাখ্যান করা হয়েছে।"}
            </p>
            <Button asChild data-testid="button-resubmit">
              <a href="/shop-partner/onboarding">পুনরায় আবেদন করুন</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasProfile && isPending && !isSetupRoute) {
    return <Redirect to="/shop-partner/setup" />;
  }

  if (hasProfile && !isApproved && !isPending && !isRejected && !isSetupRoute) {
    return <Redirect to="/shop-partner/onboarding" />;
  }

  return <>{children}</>;
}

export function useBDShopPartnerAccess() {
  const { user } = useAuth();
  
  const { data: profileData, isLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
    enabled: !!user && user.countryCode === "BD",
  });

  const isBD = user?.countryCode === "BD";
  const hasShopPartner = !!profileData?.profile;
  const isApproved = profileData?.profile?.verificationStatus === "approved";
  const isPending = profileData?.profile?.verificationStatus === "pending";
  const isRejected = profileData?.profile?.verificationStatus === "rejected";

  return {
    isBD,
    hasShopPartner,
    isApproved,
    isPending,
    isRejected,
    isLoading,
    profile: profileData?.profile,
    canAccessShopPartner: isBD && user?.role === "customer",
    canAccessFullDashboard: isBD && hasShopPartner && isApproved,
    shouldRedirectToSetup: isBD && hasShopPartner && isPending,
  };
}
