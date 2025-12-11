import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ArrowLeft, CheckCircle2, Loader2, ArrowRight, Package, Globe,
  MapPin, FileText, IdCard, Truck, ClipboardCheck, User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CountryCode = "BD" | "US";

interface OnboardingDraft {
  id: string;
  userId: string;
  countryCode: string;
  currentStep: number;
  isSubmitted: boolean;
  fullName?: string;
  deliveryMethod?: string;
}

interface PartnerProfile {
  id: string;
  role: string;
  country: string;
  partnerStatus: string;
  trustLevel: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  verificationStatus?: string;
}

const WIZARD_STEPS = [
  { id: 1, title: "Select Country", description: "Choose your operating country", icon: Globe },
  { id: 2, title: "Personal Info", description: "Your personal details", icon: User },
  { id: 3, title: "Address Info", description: "Your address information", icon: MapPin },
  { id: 4, title: "Government ID", description: "Identity verification", icon: IdCard },
  { id: 5, title: "Delivery Method", description: "How you'll deliver (US only)", icon: Truck },
  { id: 6, title: "Vehicle Documents", description: "License & vehicle docs (if applicable)", icon: FileText },
  { id: 7, title: "Review & Submit", description: "Final review and submission", icon: ClipboardCheck },
];

export default function DeliveryDriverStart() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(null);
  
  const { data: partnerData, isLoading: isLoadingProfile } = useQuery<{ profile: PartnerProfile | null }>({
    queryKey: ["/api/partner/profile", "delivery_driver"],
    enabled: !!user,
  });

  const { data: draftData, isLoading: isLoadingDraft } = useQuery<{ exists: boolean; draft: OnboardingDraft | null }>({
    queryKey: ["/api/partner/delivery-driver/onboarding/draft"],
    enabled: !!user,
  });

  const initOnboardingMutation = useMutation({
    mutationFn: async (countryCode: CountryCode) => {
      const response = await apiRequest("/api/partner/delivery-driver/onboarding/init", {
        method: "POST",
        body: JSON.stringify({ countryCode }),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery-driver/onboarding/draft"] });
      setLocation(`/partner/delivery-driver/wizard?step=${data.currentStep}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to initialize onboarding. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = isLoadingProfile || isLoadingDraft;
  const profile = partnerData?.profile;
  const draft = draftData?.draft;
  const hasExistingDraft = draftData?.exists && draft && !draft.isSubmitted;
  const isApproved = profile?.partnerStatus === "approved" || profile?.verificationStatus === "approved";
  const isPendingVerification = profile?.verificationStatus === "pending" || profile?.partnerStatus === "pending_verification";
  const currentStep = draft?.currentStep || 1;
  const progressPercent = ((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100;

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
          <Link href="/customer">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2" data-testid="text-approved-title">You're Already a Delivery Driver!</h1>
              <p className="text-muted-foreground mb-6">
                Your delivery driver account is active. Start accepting deliveries.
              </p>
              <Button onClick={() => setLocation("/driver/food-deliveries")} data-testid="button-go-dashboard">
                Go to Delivery Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isPendingVerification) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/customer">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="h-8 w-8 text-yellow-600 dark:text-yellow-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold mb-2" data-testid="text-pending-title">Application Pending Verification</h1>
              <p className="text-muted-foreground mb-6">
                Your delivery driver application is being reviewed by our team. This usually takes 1-2 business days.
              </p>
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                Pending Verification
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleContinueApplication = () => {
    if (hasExistingDraft && draft) {
      setLocation(`/partner/delivery-driver/wizard?step=${draft.currentStep}`);
    }
  };

  const handleStartApplication = () => {
    if (!selectedCountry) {
      toast({
        title: "Select Country",
        description: "Please select your operating country to continue.",
        variant: "destructive",
      });
      return;
    }
    initOnboardingMutation.mutate(selectedCountry);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/customer">
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="text-center mb-8">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Package className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            Become a Delivery Driver
          </h1>
          <p className="text-muted-foreground">
            Complete the 7-step onboarding process to start earning with SafeGo
          </p>
        </div>

        {hasExistingDraft && (
          <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resume Your Application
              </CardTitle>
              <CardDescription>
                You have an in-progress application. Continue where you left off.
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
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  Step {currentStep} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep - 1]?.title}
                </Badge>
                <Button onClick={handleContinueApplication} data-testid="button-continue">
                  Continue Application
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Step 1: Select Your Country
            </CardTitle>
            <CardDescription>
              Choose the country where you'll be operating as a delivery driver
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedCountry || ""}
              onValueChange={(value) => setSelectedCountry(value as CountryCode)}
              className="space-y-4"
            >
              <div 
                className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedCountry === "BD" 
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                    : "border-muted hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelectedCountry("BD")}
                data-testid="country-option-bd"
              >
                <RadioGroupItem value="BD" id="country-bd" />
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-2xl">
                  🇧🇩
                </div>
                <div className="flex-1">
                  <Label htmlFor="country-bd" className="text-base font-semibold cursor-pointer">
                    Bangladesh
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    National ID (NID) verification required. Driving license for motorized vehicles.
                  </p>
                </div>
              </div>

              <div 
                className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedCountry === "US" 
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                    : "border-muted hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelectedCountry("US")}
                data-testid="country-option-us"
              >
                <RadioGroupItem value="US" id="country-us" />
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-2xl">
                  🇺🇸
                </div>
                <div className="flex-1">
                  <Label htmlFor="country-us" className="text-base font-semibold cursor-pointer">
                    United States
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Government ID and background check consent required. Choose from car, bike, or walking.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7-Step Onboarding Process</CardTitle>
            <CardDescription>
              Complete all steps to become a verified SafeGo delivery driver
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {WIZARD_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === 0;
                const isConditional = step.id === 5 || step.id === 6;
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      isActive ? "bg-primary/10" : "bg-muted/30"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.title}</span>
                        {isConditional && (
                          <Badge variant="outline" className="text-xs">
                            Conditional
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                      Step {step.id}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            size="lg" 
            onClick={handleStartApplication}
            disabled={!selectedCountry || initOnboardingMutation.isPending}
            data-testid="button-start-application"
          >
            {initOnboardingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Application
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
