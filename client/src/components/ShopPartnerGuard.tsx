import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Redirect } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPostLoginPath } from "@/lib/roleRedirect";

interface ShopPartnerGuardProps {
  children: React.ReactNode;
  allowSetup?: boolean;
}

export function ShopPartnerGuard({ children, allowSetup = false }: ShopPartnerGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();

  const { data: profileData, isLoading: profileLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
    enabled: !!user && user.countryCode === "BD" && user.role === "shop_partner",
  });

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-shop-partner" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.countryCode !== "BD") {
    console.warn("[ShopPartnerGuard] Non-BD user accessing shop_partner route, redirecting");
    return <Redirect to={getPostLoginPath(user)} />;
  }

  if (user.role !== "shop_partner") {
    console.warn("[ShopPartnerGuard] Wrong role accessing shop_partner route, redirecting");
    return <Redirect to={getPostLoginPath(user)} />;
  }

  const profile = profileData?.profile;
  const hasProfile = !!profile;
  const isApproved = profile?.verificationStatus === "approved";
  const isPending = profile?.verificationStatus === "pending";
  const isRejected = profile?.verificationStatus === "rejected";
  const isSetupRoute = location.startsWith("/shop-partner/onboarding") || 
                       location.startsWith("/shop-partner/setup");

  // Approved users should go to dashboard, not onboarding/setup
  if (hasProfile && isApproved && isSetupRoute) {
    return <Redirect to="/shop-partner/dashboard" />;
  }

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
    enabled: !!user && user.countryCode === "BD" && user.role === "shop_partner",
  });

  const isBD = user?.countryCode === "BD";
  const isShopPartner = user?.role === "shop_partner";
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
    canAccessShopPartner: isBD && isShopPartner,
    canAccessFullDashboard: isBD && isShopPartner && hasShopPartner && isApproved,
    shouldRedirectToSetup: isBD && isShopPartner && hasShopPartner && isPending,
  };
}
