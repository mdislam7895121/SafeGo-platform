import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  CheckCircle2, 
  Store, 
  Phone, 
  FileText,
  ArrowRight 
} from "lucide-react";

interface ShopPartnerProfile {
  id: string;
  shopName: string;
  verificationStatus: "pending" | "approved" | "rejected";
  submittedAt?: string;
}

export default function ShopPartnerSetup() {
  const { data: profileData, isLoading, isError, error } = useQuery<{ profile: ShopPartnerProfile | null }>({
    queryKey: ["/api/shop-partner/profile"],
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 auth errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000,
  });

  const profile = profileData?.profile;

  // Handle loading state - but don't stay stuck on error
  if (isLoading && !isError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle auth errors - redirect to login
  if (isError) {
    const errorStatus = (error as any)?.status;
    if (errorStatus === 401 || errorStatus === 403) {
      console.warn("[ShopPartnerSetup] Auth error, redirecting to login");
      return <Redirect to="/login" />;
    }
    // For other errors, redirect to onboarding to start fresh
    console.warn("[ShopPartnerSetup] API error, redirecting to onboarding:", error);
    return <Redirect to="/shop-partner/onboarding" />;
  }

  // No profile found - redirect to onboarding
  if (!profile) {
    return <Redirect to="/shop-partner/onboarding" />;
  }

  if (profile.verificationStatus === "approved") {
    return <Redirect to="/shop-partner" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">অপেক্ষা করুন</CardTitle>
          <p className="text-muted-foreground mt-2">
            আপনার দোকান আবেদন পর্যালোচনা করা হচ্ছে
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Store className="h-5 w-5 text-primary" />
              <span className="font-semibold">{profile.shopName}</span>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              যাচাইকরণ অপেক্ষমান
            </Badge>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              যাচাইকরণ প্রক্রিয়া
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm">আবেদন জমা দেওয়া হয়েছে</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span className="text-sm">নথি পর্যালোচনা চলছে</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">চূড়ান্ত অনুমোদন</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  সাহায্য প্রয়োজন?
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন: 16789
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>সাধারণত ১-২ কার্যদিবসের মধ্যে যাচাইকরণ সম্পন্ন হয়</p>
          </div>

          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => window.location.reload()}
            data-testid="button-refresh-status"
          >
            স্ট্যাটাস রিফ্রেশ করুন
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
