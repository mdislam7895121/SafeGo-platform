import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { 
  UtensilsCrossed, ArrowLeft, CheckCircle2, Clock, FileText, 
  ShieldCheck, Loader2, ArrowRight, Store, Camera
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface PartnerProfile {
  id: string;
  role: string;
  country: string;
  partnerStatus: string;
  trustLevel: string;
  onboardingStep?: number;
}

export default function RestaurantStart() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: partnerData, isLoading } = useQuery<{ profile: PartnerProfile | null }>({
    queryKey: ["/api/partner/profile", "restaurant"],
    enabled: !!user,
  });

  const profile = partnerData?.profile;
  const hasExistingProfile = profile && profile.role === "restaurant";
  const isApproved = profile?.partnerStatus === "approved";
  const currentStep = profile?.onboardingStep || 0;
  const totalSteps = user?.countryCode === "BD" ? 6 : 5;
  const progressPercent = (currentStep / totalSteps) * 100;

  const steps = [
    { id: 1, title: "Restaurant Information", description: "Name, cuisine type, address", icon: Store },
    { id: 2, title: "Menu Setup", description: "Add your menu items and prices", icon: UtensilsCrossed },
    { id: 3, title: "Photos & Branding", description: "Upload restaurant photos", icon: Camera },
    { id: 4, title: "Business Documents", description: "Licenses and permits", icon: FileText },
    { id: 5, title: "Bank/Payout Setup", description: "Configure payment receiving", icon: FileText },
    ...(user?.countryCode === "BD" ? [
      { id: 6, title: "KYC Verification", description: "Owner identity verification", icon: ShieldCheck }
    ] : []),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-partner" />
      </div>
    );
  }

  if (isApproved) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/customer/profile">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Profile
            </Button>
          </Link>

          <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Your Restaurant is Live!</h1>
              <p className="text-muted-foreground mb-6">
                Your restaurant is active on SafeGo Eats. Manage your orders and menu.
              </p>
              <Button onClick={() => setLocation("/restaurant")} data-testid="button-go-dashboard">
                Go to Restaurant Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/customer/profile">
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </Link>

        <div className="text-center mb-8">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            Join SafeGo Eats
          </h1>
          <p className="text-muted-foreground">
            List your restaurant and reach more customers with SafeGo's food delivery platform.
          </p>
        </div>

        {hasExistingProfile && currentStep > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Resume Your Application
              </CardTitle>
              <CardDescription>
                You've already started your restaurant registration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              <Badge variant="secondary">
                Step {currentStep} of {totalSteps}
              </Badge>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Restaurant Onboarding Steps</CardTitle>
            <CardDescription>
              Complete these steps to list your restaurant on SafeGo Eats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = currentStep > index;
              const isCurrent = currentStep === index;
              
              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    isCompleted 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' 
                      : isCurrent
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-muted/30'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : isCurrent
                        ? 'bg-primary/20'
                        : 'bg-muted'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <StepIcon className={`h-5 w-5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {isCompleted && (
                    <Badge variant="default" className="bg-green-600">Complete</Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button 
            size="lg" 
            className="w-full sm:w-auto px-12"
            onClick={() => setLocation("/restaurant/onboarding")}
            data-testid="button-start-onboarding"
          >
            {hasExistingProfile && currentStep > 0 ? "Continue Application" : "Start Application"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Typical approval time: 3-5 business days after document submission
          </p>
        </div>
      </div>
    </div>
  );
}
