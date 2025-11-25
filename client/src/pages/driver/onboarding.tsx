import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  DollarSign, 
  Wallet, 
  Shield, 
  HelpCircle, 
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  PartyPopper,
  Loader2,
  SkipForward,
  RotateCcw,
  Car,
  MapPin,
  Clock,
  Star,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Phone,
  MessageSquare,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface OnboardingStep {
  id: string;
  name: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
}

interface OnboardingStatus {
  isOnboardingComplete: boolean;
  completionPercentage: number;
  steps: OnboardingStep[];
  currentStep: string;
  lastStepViewed: string | null;
  tutorialsViewed: string[];
  startedAt: string;
  completedAt: string | null;
}

const STEP_CONTENT = {
  welcome: {
    icon: Sparkles,
    title: "Welcome to SafeGo",
    subtitle: "Your journey starts here",
    description: "Get ready to earn on your own schedule. This quick guide will show you everything you need to know to start driving with SafeGo.",
    features: [
      { icon: Car, text: "Earn money on your terms" },
      { icon: Clock, text: "Flexible hours, you decide when to drive" },
      { icon: MapPin, text: "Work in your city and neighborhood" },
      { icon: Star, text: "Build your reputation with great service" },
    ],
  },
  earnings: {
    icon: DollarSign,
    title: "How Earnings Work",
    subtitle: "Understand your income",
    description: "Learn how you get paid for each trip, including base fares, time, distance, tips, and promotions.",
    features: [
      { icon: DollarSign, text: "Base fare + time + distance for every trip" },
      { icon: TrendingUp, text: "Surge pricing during high demand" },
      { icon: Star, text: "100% of customer tips go to you" },
      { icon: Sparkles, text: "Bonus promotions and incentives" },
    ],
  },
  payouts: {
    icon: Wallet,
    title: "Getting Paid",
    subtitle: "Your money, your way",
    description: "Choose how and when you want to receive your earnings. Multiple payout options available based on your country.",
    features: [
      { icon: CreditCard, text: "Direct deposit to your bank" },
      { icon: Clock, text: "Weekly automatic payouts" },
      { icon: Wallet, text: "On-demand instant transfers" },
      { icon: DollarSign, text: "Track all earnings in your wallet" },
    ],
  },
  safety: {
    icon: Shield,
    title: "Safety Guidelines",
    subtitle: "Your safety matters",
    description: "We're committed to keeping you safe on the road. Learn about safety features and best practices.",
    features: [
      { icon: Shield, text: "24/7 safety support line" },
      { icon: Phone, text: "Emergency button in app" },
      { icon: AlertTriangle, text: "Share ride status with trusted contacts" },
      { icon: Star, text: "Two-way rating system" },
    ],
  },
  helpCenter: {
    icon: HelpCircle,
    title: "Help Center",
    subtitle: "We're here for you",
    description: "Need help? Our support team is available around the clock. Learn how to get assistance when you need it.",
    features: [
      { icon: MessageSquare, text: "In-app chat support" },
      { icon: Phone, text: "Phone support for urgent issues" },
      { icon: BookOpen, text: "Tutorial videos and guides" },
      { icon: HelpCircle, text: "FAQ and knowledge base" },
    ],
  },
  completion: {
    icon: PartyPopper,
    title: "You're Ready!",
    subtitle: "Time to start earning",
    description: "Congratulations! You've completed the onboarding. You now have all the knowledge you need to start driving.",
    features: [
      { icon: Car, text: "Go online and start accepting trips" },
      { icon: DollarSign, text: "Earn money on your schedule" },
      { icon: Star, text: "Provide great service for better ratings" },
      { icon: TrendingUp, text: "Grow your earnings with promotions" },
    ],
  },
};

export default function DriverOnboarding() {
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/driver/onboarding/status"],
  });

  const completeStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      return await apiRequest("/api/driver/onboarding/complete-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/onboarding/status"] });
      if (data.isOnboardingComplete) {
        toast({
          title: "Onboarding Complete!",
          description: "You're now ready to start driving with SafeGo.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete step. Please try again.",
        variant: "destructive",
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/driver/onboarding/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/onboarding/status"] });
      toast({
        title: "Onboarding Skipped",
        description: "You can revisit the tutorials anytime.",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/driver/onboarding/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/onboarding/status"] });
      setActiveStep("welcome");
      toast({
        title: "Onboarding Reset",
        description: "Starting fresh!",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Unable to load onboarding status</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepId = activeStep || status.currentStep;
  const currentStepIndex = status.steps.findIndex(s => s.id === currentStepId);
  const currentStepData = STEP_CONTENT[currentStepId as keyof typeof STEP_CONTENT];
  const isCurrentStepCompleted = status.steps.find(s => s.id === currentStepId)?.completed;

  const goToNextStep = () => {
    if (currentStepIndex < status.steps.length - 1) {
      const nextStepId = status.steps[currentStepIndex + 1].id;
      setActiveStep(nextStepId);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      const prevStepId = status.steps[currentStepIndex - 1].id;
      setActiveStep(prevStepId);
    }
  };

  const handleCompleteStep = () => {
    completeStepMutation.mutate(currentStepId);
    if (currentStepIndex < status.steps.length - 1) {
      goToNextStep();
    }
  };

  if (status.isOnboardingComplete) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">Training Complete</h1>
            <p className="text-muted-foreground">You've completed all onboarding steps</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            data-testid="button-reset-onboarding"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restart Tutorial
          </Button>
        </div>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800">
          <CardContent className="p-8 text-center">
            <PartyPopper className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-6">
              You've completed your onboarding training. You're ready to start earning with SafeGo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/driver/dashboard">
                <Button size="lg" data-testid="button-go-dashboard">
                  <Car className="h-5 w-5 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
              <Link href="/driver/tutorials">
                <Button variant="outline" size="lg" data-testid="button-view-tutorials">
                  <BookOpen className="h-5 w-5 mr-2" />
                  View Tutorials
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completed Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status.steps.map((step) => {
              const stepContent = STEP_CONTENT[step.id as keyof typeof STEP_CONTENT];
              const Icon = stepContent.icon;
              return (
                <div 
                  key={step.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                  data-testid={`step-completed-${step.id}`}
                >
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{stepContent.title}</p>
                    <p className="text-sm text-muted-foreground">{stepContent.subtitle}</p>
                  </div>
                  <Badge variant="secondary">Completed</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">Getting Started</h1>
          <p className="text-muted-foreground">Complete these steps to start driving</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skipMutation.mutate()}
          disabled={skipMutation.isPending}
          data-testid="button-skip-onboarding"
        >
          <SkipForward className="h-4 w-4 mr-2" />
          Skip All
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Your Progress</span>
            <span className="text-sm text-muted-foreground">{status.completionPercentage}%</span>
          </div>
          <Progress value={status.completionPercentage} className="h-2" data-testid="progress-onboarding" />
          <p className="text-xs text-muted-foreground mt-2">
            {status.steps.filter(s => s.completed).length} of {status.steps.length} steps completed
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {status.steps.map((step, index) => {
          const stepContent = STEP_CONTENT[step.id as keyof typeof STEP_CONTENT];
          const Icon = stepContent.icon;
          const isActive = step.id === currentStepId;
          const isCompleted = step.completed;
          
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`
                flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all
                ${isActive 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : isCompleted 
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" 
                    : "bg-muted/50 border-transparent hover-elevate"
                }
              `}
              data-testid={`button-step-${step.id}`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="text-sm font-medium whitespace-nowrap">{stepContent.title}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10 pb-8">
              <div className="flex items-start justify-between">
                <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                  <currentStepData.icon className="h-7 w-7 text-primary" />
                </div>
                {isCurrentStepCompleted && (
                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
              <CardDescription className="text-base">{currentStepData.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-muted-foreground">{currentStepData.description}</p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {currentStepData.features.map((feature, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-4 rounded-lg bg-muted/50"
                    data-testid={`feature-${currentStepId}-${index}`}
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium pt-2">{feature.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goToPrevStep}
          disabled={currentStepIndex === 0}
          data-testid="button-prev-step"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          {!isCurrentStepCompleted && (
            <Button
              onClick={handleCompleteStep}
              disabled={completeStepMutation.isPending}
              data-testid="button-complete-step"
            >
              {completeStepMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Mark Complete
            </Button>
          )}
          
          {currentStepIndex < status.steps.length - 1 && (
            <Button
              variant={isCurrentStepCompleted ? "default" : "outline"}
              onClick={goToNextStep}
              data-testid="button-next-step"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
