import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Phone,
  Calendar,
  FileText,
  CreditCard,
  MapPin,
  AlertCircle,
  Shield,
  GraduationCap,
  CheckCircle2,
  ChevronRight,
  Camera,
  Lock,
  Building,
  Clock,
  UserCheck,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";

type ChecklistStatus = "completed" | "pending" | "incomplete";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: ChecklistStatus;
  actionLabel: string;
  actionLink: string;
  isMasked?: boolean;
  maskedValue?: string;
  nycOnly?: boolean;
}

const TRAINING_STORAGE_KEY = "safego-driver-training-completed";
const REQUIRED_TRAINING_IDS = [
  "accepting-first-ride",
  "going-online-offline",
  "earnings-payouts-overview",
  "safety-basics-sos",
];

function getCompletedTrainingModules(): string[] {
  try {
    const stored = localStorage.getItem(TRAINING_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function DriverGettingStarted() {
  const { user } = useAuth();
  const [showSSN, setShowSSN] = useState(false);
  const [completedTraining, setCompletedTraining] = useState<string[]>([]);

  useEffect(() => {
    setCompletedTraining(getCompletedTrainingModules());
  }, []);

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const isNYC = profile?.usaCity === "New York" || profile?.usaCity === "NYC";
  const countryCode = profile?.countryCode || "US";

  const requiredTrainingCount = REQUIRED_TRAINING_IDS.length;
  const completedRequiredTraining = REQUIRED_TRAINING_IDS.filter(id => 
    completedTraining.includes(id)
  ).length;
  const trainingComplete = completedRequiredTraining >= requiredTrainingCount;

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const items: ChecklistItem[] = [
      {
        id: "profile-picture",
        title: "Profile Picture",
        description: "Upload a clear photo of yourself for passengers to identify you.",
        icon: Camera,
        status: profile?.profilePhotoUrl ? "completed" : "pending",
        actionLabel: profile?.profilePhotoUrl ? "Update" : "Upload",
        actionLink: "/driver/profile",
      },
      {
        id: "full-name",
        title: "Full Name & Basic Info",
        description: "Provide your legal name and basic personal information.",
        icon: User,
        status: profile?.fullName || (profile?.firstName && profile?.lastName) ? "completed" : "pending",
        actionLabel: profile?.fullName || profile?.firstName ? "Update" : "Continue",
        actionLink: "/driver/profile",
      },
      {
        id: "phone-verification",
        title: "Phone Number Verification",
        description: "Verify your phone number for secure communication.",
        icon: Phone,
        status: profile?.phoneVerified ? "completed" : "pending",
        actionLabel: profile?.phoneVerified ? "Verified" : "Verify",
        actionLink: "/driver/profile",
      },
      {
        id: "date-of-birth",
        title: "Date of Birth",
        description: "Confirm your date of birth for age verification.",
        icon: Calendar,
        status: profile?.dateOfBirth ? "completed" : "pending",
        actionLabel: profile?.dateOfBirth ? "Update" : "Continue",
        actionLink: "/driver/profile",
      },
      {
        id: "driver-license",
        title: "Driver License",
        description: "Upload your valid driver license with state, number, and expiry.",
        icon: FileText,
        status: profile?.licenseNumber && profile?.licenseExpiry ? "completed" : "pending",
        actionLabel: profile?.licenseNumber ? "Update" : "Upload",
        actionLink: "/driver/documents",
      },
    ];

    if (isNYC || countryCode === "US") {
      items.push({
        id: "tlc-license",
        title: "TLC License",
        description: "Upload your NYC TLC license (required for NYC drivers).",
        icon: Building,
        status: profile?.tlcLicenseNumber ? "completed" : "pending",
        actionLabel: profile?.tlcLicenseNumber ? "Update" : "Upload",
        actionLink: "/driver/documents",
        nycOnly: true,
      });
    }

    if (countryCode === "US") {
      items.push({
        id: "ssn",
        title: "Social Security Number",
        description: "Provide your SSN for background check and tax purposes.",
        icon: Lock,
        status: profile?.ssnLast4 ? "completed" : "pending",
        actionLabel: profile?.ssnLast4 ? "Update" : "Continue",
        actionLink: "/driver/profile",
        isMasked: true,
        maskedValue: profile?.ssnLast4 ? `***-**-${profile.ssnLast4}` : undefined,
      });
    }

    items.push(
      {
        id: "residential-address",
        title: "Residential Address",
        description: "Provide your current residential address.",
        icon: MapPin,
        status: profile?.address || profile?.residentialAddress ? "completed" : "pending",
        actionLabel: profile?.address || profile?.residentialAddress ? "Update" : "Continue",
        actionLink: "/driver/account/address",
      },
      {
        id: "emergency-contact",
        title: "Emergency Contact",
        description: "Add an emergency contact for safety purposes.",
        icon: AlertCircle,
        status: profile?.emergencyContactName && profile?.emergencyContactPhone ? "completed" : "pending",
        actionLabel: profile?.emergencyContactName ? "Update" : "Add",
        actionLink: "/driver/profile",
      },
      {
        id: "background-check",
        title: "Background Check Status",
        description: "Complete the background verification process.",
        icon: Shield,
        status: profile?.backgroundCheckStatus === "APPROVED" ? "completed" : 
               profile?.backgroundCheckStatus === "PENDING" ? "pending" : "incomplete",
        actionLabel: profile?.backgroundCheckStatus === "APPROVED" ? "Approved" :
                    profile?.backgroundCheckStatus === "PENDING" ? "In Progress" : "Start",
        actionLink: "/driver/documents",
      },
      {
        id: "bank-info",
        title: "Bank Information",
        description: "Add your bank account details for receiving payouts.",
        icon: CreditCard,
        status: profile?.bankAccountLast4 || profile?.hasBankAccount ? "completed" : "pending",
        actionLabel: profile?.bankAccountLast4 || profile?.hasBankAccount ? "Update" : "Add",
        actionLink: "/driver/payouts",
      },
      {
        id: "training-modules",
        title: "Required Training Modules",
        description: `Complete ${requiredTrainingCount} required training videos to start driving.`,
        icon: GraduationCap,
        status: trainingComplete ? "completed" : "pending",
        actionLabel: trainingComplete ? "View All" : "Continue",
        actionLink: "/driver/tutorials",
      }
    );

    return items;
  }, [profile, isNYC, countryCode, trainingComplete, requiredTrainingCount]);

  const completedCount = checklistItems.filter(item => item.status === "completed").length;
  const totalCount = checklistItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getStatusBadge = (status: ChecklistStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "incomplete":
        return (
          <Badge variant="secondary" className="bg-red-500/20 text-red-700 dark:text-red-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Required
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-getting-started-title">
                  Getting Started
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Complete these steps to begin driving with SafeGo
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Your Progress</span>
                  <span className="text-sm font-semibold text-primary">
                    {completedCount} of {totalCount} steps completed
                  </span>
                </div>
                <Progress value={progressPercent} className="h-3" data-testid="progress-onboarding" />
                <p className="text-xs text-muted-foreground mt-2">
                  {progressPercent}% complete
                </p>
              </div>
              {progressPercent === 100 && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 self-start">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Ready to Drive
                </Badge>
              )}
            </div>

            {progressPercent < 100 && (
              <>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground">
                  Complete all required steps to activate your driver account and start accepting rides.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold px-1" data-testid="text-checklist-header">
            Onboarding Checklist
          </h2>
          
          <div className="space-y-3">
            {checklistItems.map((item, index) => {
              const Icon = item.icon;
              const isCompleted = item.status === "completed";
              
              return (
                <Card 
                  key={item.id}
                  className={`overflow-hidden transition-all ${
                    isCompleted ? "opacity-80" : "hover-elevate"
                  }`}
                  data-testid={`card-checklist-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted 
                          ? "bg-green-500/20" 
                          : "bg-primary/10"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Icon className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-medium">{item.title}</h3>
                          {item.nycOnly && (
                            <Badge variant="outline" className="text-xs">NYC Only</Badge>
                          )}
                          {item.id === "training-modules" && (
                            <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
                              Required for Activation
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {item.description}
                        </p>
                        
                        {item.id === "training-modules" && (
                          <div className="flex items-center gap-2 mb-3">
                            <Progress 
                              value={(completedRequiredTraining / requiredTrainingCount) * 100} 
                              className="h-2 flex-1 max-w-[200px]" 
                            />
                            <span className="text-xs text-muted-foreground">
                              {completedRequiredTraining}/{requiredTrainingCount} modules
                            </span>
                          </div>
                        )}
                        
                        {item.isMasked && item.maskedValue && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {showSSN ? "***-**-" + (profile?.ssnLast4 || "****") : item.maskedValue}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSSN(!showSSN);
                              }}
                              data-testid="button-toggle-ssn"
                            >
                              {showSSN ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {getStatusBadge(item.status)}
                          
                          <Link href={item.actionLink}>
                            <Button 
                              variant={isCompleted ? "outline" : "default"}
                              size="sm"
                              className="gap-1"
                              data-testid={`button-action-${item.id}`}
                            >
                              {item.actionLabel}
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {progressPercent === 100 && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">You're Ready to Drive!</h3>
              <p className="text-muted-foreground mb-4">
                Congratulations! You've completed all onboarding steps. You can now go online and start accepting ride requests.
              </p>
              <Link href="/driver/dashboard">
                <Button size="lg" data-testid="button-go-to-dashboard">
                  Go to Dashboard
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Need help? Visit our{" "}
            <Link href="/driver/support-help-center" className="text-primary hover:underline">
              Help Center
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
