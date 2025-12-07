import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Bike, ArrowLeft, CheckCircle2, Clock, FileText, 
  ShieldCheck, Loader2, ArrowRight, Package, CircleCheck,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type VehicleType = "bicycle" | "motorbike";

interface PartnerProfile {
  id: string;
  role: string;
  country: string;
  partnerStatus: string;
  trustLevel: string;
  onboardingStep?: number;
  vehicleType?: string;
}

export default function DeliveryDriverBikeStart() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  
  const { data: partnerData, isLoading } = useQuery<{ profile: PartnerProfile | null }>({
    queryKey: ["/api/partner/profile", "delivery_driver"],
    enabled: !!user,
  });

  const initDeliveryMutation = useMutation({
    mutationFn: async (vehicleType: VehicleType) => {
      const response = await apiRequest("/api/partner/delivery-driver/init", {
        method: "POST",
        body: JSON.stringify({ 
          vehicleType,
          services: ["food_delivery", "parcel_delivery"],
          canRide: false,
          canFoodDelivery: true,
          canParcelDelivery: true,
        }),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/profile"] });
      if (data.nextUrl) {
        setLocation(data.nextUrl);
      } else {
        setLocation(`/partner/delivery-driver/register?vehicle=${selectedVehicle}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to initialize. Please try again.",
        variant: "destructive",
      });
    },
  });

  const profile = partnerData?.profile;
  const hasExistingProfile = profile && profile.role === "delivery_driver";
  const isApproved = profile?.partnerStatus === "approved";
  const currentStep = profile?.onboardingStep || 0;
  
  const getStepsForVehicle = (vehicle: VehicleType | null) => {
    if (vehicle === "bicycle") {
      return [
        { id: 1, title: "Basic Information", description: "Personal details and contact", icon: FileText },
        { id: 2, title: "Government ID", description: "ID verification (no license needed)", icon: ShieldCheck },
        { id: 3, title: "Emergency Contact", description: "Safety contact information", icon: FileText },
      ];
    }
    return [
      { id: 1, title: "Basic Information", description: "Personal details and contact", icon: FileText },
      { id: 2, title: "Driver's License", description: "License verification required", icon: ShieldCheck },
      { id: 3, title: "Government ID", description: "ID verification", icon: FileText },
      { id: 4, title: "Emergency Contact", description: "Safety contact information", icon: FileText },
    ];
  };

  const steps = getStepsForVehicle(selectedVehicle);
  const totalSteps = steps.length;
  const progressPercent = (currentStep / totalSteps) * 100;

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

  const handleStartApplication = () => {
    if (!selectedVehicle) {
      toast({
        title: "Select Vehicle Type",
        description: "Please select your preferred vehicle type to continue.",
        variant: "destructive",
      });
      return;
    }
    initDeliveryMutation.mutate(selectedVehicle);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/customer">
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="text-center mb-8">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Bike className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            Delivery Driver (Bike & Bicycle)
          </h1>
          <p className="text-muted-foreground">
            Start earning with SafeGo using a bike or bicycle. Fast approval. Simple requirements.
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
                You've already started your delivery driver application.
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

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Your Vehicle Type</CardTitle>
            <CardDescription>
              Choose the vehicle you'll use for deliveries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedVehicle || ""}
              onValueChange={(value) => setSelectedVehicle(value as VehicleType)}
              className="space-y-4"
            >
              <div 
                className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedVehicle === "bicycle" 
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                    : "border-muted hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelectedVehicle("bicycle")}
                data-testid="vehicle-option-bicycle"
              >
                <RadioGroupItem value="bicycle" id="bicycle" />
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Bike className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="bicycle" className="text-base font-semibold cursor-pointer">
                    Bicycle
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    No driver's license required. Fastest approval.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <CircleCheck className="h-3 w-3 mr-1" />
                      No License Needed
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Fast Approval
                    </Badge>
                  </div>
                </div>
              </div>

              <div 
                className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedVehicle === "motorbike" 
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                    : "border-muted hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelectedVehicle("motorbike")}
                data-testid="vehicle-option-motorbike"
              >
                <RadioGroupItem value="motorbike" id="motorbike" />
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Bike className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="motorbike" className="text-base font-semibold cursor-pointer">
                    Motorbike / Scooter
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Driver's license required. Higher earning potential.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      License Required
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      More Deliveries
                    </Badge>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {selectedVehicle && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Onboarding Steps</CardTitle>
              <CardDescription>
                {selectedVehicle === "bicycle" 
                  ? "Simplified process - complete in minutes!" 
                  : "Complete these steps to become a verified delivery driver"}
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
                    data-testid={`step-${step.id}`}
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
        )}

        <div className="mt-8 text-center">
          <Button 
            size="lg" 
            className="w-full sm:w-auto px-12"
            onClick={handleStartApplication}
            disabled={!selectedVehicle || initDeliveryMutation.isPending}
            data-testid="button-start-onboarding"
          >
            {initDeliveryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {hasExistingProfile && currentStep > 0 ? "Continue Application" : "Start Application"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            {selectedVehicle === "bicycle" 
              ? "Typical approval time: Same day after document submission"
              : "Typical approval time: 24-48 hours after document submission"}
          </p>
        </div>
      </div>
    </div>
  );
}
