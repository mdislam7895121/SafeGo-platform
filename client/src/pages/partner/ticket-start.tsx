import { useLocation, Link, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Bus, ArrowLeft, CheckCircle2, Clock, FileText, 
  ShieldCheck, Loader2, ArrowRight, Train, Ship, CreditCard
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

export default function TicketOperatorStart() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  if (user?.countryCode !== "BD") {
    return <Redirect to="/customer/profile" />;
  }

  const { data: partnerData, isLoading } = useQuery<{ profile: PartnerProfile | null }>({
    queryKey: ["/api/partner/profile", "ticket_operator"],
    enabled: !!user,
  });

  const profile = partnerData?.profile;
  const hasExistingProfile = profile && profile.role === "ticket_operator";
  const isApproved = profile?.partnerStatus === "approved";
  const currentStep = profile?.onboardingStep || 0;
  const totalSteps = 5;
  const progressPercent = (currentStep / totalSteps) * 100;

  const steps = [
    { id: 1, title: "Operator Information", description: "Company name and type", icon: Bus },
    { id: 2, title: "Routes & Schedules", description: "Set up your service routes", icon: Train },
    { id: 3, title: "Fleet/Vehicles", description: "Add buses, ferries, or rentals", icon: Ship },
    { id: 4, title: "Business Documents", description: "Trade license and permits", icon: FileText },
    { id: 5, title: "KYC & Payout", description: "Verify identity and set payouts", icon: CreditCard },
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
              <h1 className="text-2xl font-bold mb-2">আপনার অপারেটর একাউন্ট সক্রিয়!</h1>
              <p className="text-muted-foreground mb-6">
                Your operator account is live. Manage tickets, rentals, and bookings.
              </p>
              <Button onClick={() => setLocation("/ticket-operator/dashboard")} data-testid="button-go-dashboard">
                Go to Operator Dashboard
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-4">
            🇧🇩 Bangladesh Only
          </div>
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <Bus className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            টিকিট ও রেন্টাল অপারেটর
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            Become a Ticket & Rental Operator
          </p>
          <p className="text-muted-foreground">
            Manage bus routes, ferry schedules, train tickets, and vehicle rentals on SafeGo.
          </p>
        </div>

        {hasExistingProfile && currentStep > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                আপনার আবেদন চলমান
              </CardTitle>
              <CardDescription>
                Continue your operator registration from where you left off.
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
            <CardTitle>Operator Types Supported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Bus className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Bus Company</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Ship className="h-5 w-5 text-cyan-600" />
                <span className="text-sm font-medium">Ferry Operator</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Train className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium">Train Operator</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Bus className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Rental Service</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>অনবোর্ডিং ধাপসমূহ</CardTitle>
            <CardDescription>
              Complete these steps to become a verified operator
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
            onClick={() => setLocation("/ticket-operator/onboarding")}
            data-testid="button-start-onboarding"
          >
            {hasExistingProfile && currentStep > 0 ? "আবেদন চালিয়ে যান" : "আবেদন শুরু করুন"}
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
