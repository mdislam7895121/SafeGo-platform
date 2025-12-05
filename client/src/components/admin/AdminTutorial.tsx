import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, CheckCircle, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  action?: string;
}

interface TutorialSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: TutorialStep[];
  completed?: boolean;
}

const TUTORIALS: TutorialSection[] = [
  {
    id: "dashboard-overview",
    title: "Dashboard Overview",
    description: "Learn how to navigate the admin dashboard and understand key metrics",
    icon: <Sparkles className="h-5 w-5" />,
    steps: [
      {
        id: "step-1",
        title: "Welcome to SafeGo Admin",
        description: "This is your command center for managing the entire SafeGo platform. Here you can monitor operations, manage users, and ensure platform safety.",
        position: "center",
      },
      {
        id: "step-2",
        title: "Navigation Sidebar",
        description: "Use the sidebar to navigate between different admin sections. Groups are organized by function: Overview, Management, Security, and more.",
        targetSelector: "[data-testid='nav-dashboard']",
        position: "right",
      },
      {
        id: "step-3",
        title: "Quick Stats",
        description: "The dashboard displays real-time metrics including total users, active drivers, pending KYC approvals, and revenue data.",
        position: "center",
      },
    ],
  },
  {
    id: "user-management",
    title: "User Management",
    description: "Learn how to manage customers, drivers, and restaurant partners",
    icon: <HelpCircle className="h-5 w-5" />,
    steps: [
      {
        id: "step-1",
        title: "User Types",
        description: "SafeGo has three main user types: Customers (riders), Drivers (service providers), and Restaurant Partners (food merchants).",
        position: "center",
      },
      {
        id: "step-2",
        title: "Filtering & Search",
        description: "Use the search bar and filters to quickly find users by name, email, phone, or status.",
        position: "center",
      },
      {
        id: "step-3",
        title: "User Actions",
        description: "From each user profile, you can view details, manage status, review documents, and handle support requests.",
        position: "center",
      },
    ],
  },
  {
    id: "kyc-approvals",
    title: "KYC Approvals",
    description: "Master the document verification and approval workflow",
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      {
        id: "step-1",
        title: "Document Review Queue",
        description: "The KYC queue shows all pending document submissions requiring your review.",
        position: "center",
      },
      {
        id: "step-2",
        title: "Verification Process",
        description: "Review each document carefully. Verify identity documents match the applicant's information and meet quality standards.",
        position: "center",
      },
      {
        id: "step-3",
        title: "Approval Actions",
        description: "You can approve, reject (with reason), or request additional information for each submission.",
        position: "center",
      },
    ],
  },
  {
    id: "safety-center",
    title: "Safety & Security",
    description: "Learn about safety monitoring, fraud detection, and incident response",
    icon: <HelpCircle className="h-5 w-5" />,
    steps: [
      {
        id: "step-1",
        title: "Real-Time Monitoring",
        description: "The Safety Center provides live monitoring of all active trips and delivery activities.",
        position: "center",
      },
      {
        id: "step-2",
        title: "SOS Alerts",
        description: "Emergency SOS alerts appear immediately and require urgent attention. Follow the incident response protocol.",
        position: "center",
      },
      {
        id: "step-3",
        title: "Fraud Detection",
        description: "AI-powered fraud detection flags suspicious activities. Review flagged items in the Fraud Alerts section.",
        position: "center",
      },
    ],
  },
  {
    id: "ratings-reviews",
    title: "Ratings & Reviews",
    description: "Understand how to manage ratings, reviews, and disputes",
    icon: <HelpCircle className="h-5 w-5" />,
    steps: [
      {
        id: "step-1",
        title: "Ratings Overview",
        description: "View aggregate ratings for drivers and restaurants. Monitor rating trends over time.",
        position: "center",
      },
      {
        id: "step-2",
        title: "Review Disputes",
        description: "Handle rating disputes fairly by reviewing evidence from both parties.",
        position: "center",
      },
      {
        id: "step-3",
        title: "Fraud Detection",
        description: "The system automatically flags suspicious rating patterns that may indicate fraud.",
        position: "center",
      },
    ],
  },
];

interface AdminTutorialProps {
  onComplete?: () => void;
}

export function AdminTutorial({ onComplete }: AdminTutorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<TutorialSection | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("admin-tutorial-completed");
    if (stored) {
      setCompletedSections(JSON.parse(stored));
    }
    const dismissed = localStorage.getItem("admin-tutorial-dismissed");
    if (!dismissed) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleStartSection = (section: TutorialSection) => {
    setActiveSection(section);
    setCurrentStep(0);
  };

  const handleNextStep = () => {
    if (!activeSection) return;
    if (currentStep < activeSection.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleCompleteSection();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCompleteSection = useCallback(() => {
    if (activeSection) {
      const newCompleted = [...completedSections, activeSection.id];
      setCompletedSections(newCompleted);
      localStorage.setItem("admin-tutorial-completed", JSON.stringify(newCompleted));
    }
    setActiveSection(null);
    setCurrentStep(0);
  }, [activeSection, completedSections]);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem("admin-tutorial-dismissed", "true");
  };

  const handleReset = () => {
    setCompletedSections([]);
    localStorage.removeItem("admin-tutorial-completed");
    localStorage.removeItem("admin-tutorial-dismissed");
  };

  const totalProgress = (completedSections.length / TUTORIALS.length) * 100;

  if (activeSection) {
    const step = activeSection.steps[currentStep];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="max-w-md w-full mx-4"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  Step {currentStep + 1} of {activeSection.steps.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setActiveSection(null);
                    setCurrentStep(0);
                  }}
                  data-testid="button-close-tutorial-step"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="mt-2">{step.title}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress
                value={((currentStep + 1) / activeSection.steps.length) * 100}
                className="h-2"
              />
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                data-testid="button-tutorial-prev"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button onClick={handleNextStep} data-testid="button-tutorial-next">
                {currentStep === activeSection.steps.length - 1 ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 gap-2"
        data-testid="button-open-tutorials"
      >
        <HelpCircle className="h-4 w-4" />
        Tutorials
        {completedSections.length < TUTORIALS.length && (
          <Badge variant="secondary" className="ml-1">
            {TUTORIALS.length - completedSections.length}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Admin Tutorials
            </DialogTitle>
            <DialogDescription>
              Learn how to use the SafeGo Admin Console effectively
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Your Progress</p>
                <p className="text-xs text-muted-foreground">
                  {completedSections.length} of {TUTORIALS.length} sections completed
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-reset-tutorials">
                Reset Progress
              </Button>
            </div>
            <Progress value={totalProgress} className="h-2" />

            <div className="grid gap-3 mt-4">
              {TUTORIALS.map((section) => {
                const isCompleted = completedSections.includes(section.id);
                return (
                  <Card
                    key={section.id}
                    className={`hover-elevate cursor-pointer ${isCompleted ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""}`}
                    onClick={() => !isCompleted && handleStartSection(section)}
                    data-testid={`card-tutorial-${section.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${isCompleted ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}
                        >
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            section.icon
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{section.title}</h3>
                            <Badge variant={isCompleted ? "default" : "secondary"}>
                              {isCompleted ? "Completed" : `${section.steps.length} steps`}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between mt-4">
            <Button variant="ghost" onClick={handleDismiss} data-testid="button-dismiss-tutorials">
              Don't show again
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)} data-testid="button-close-tutorials">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TutorialButton() {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("admin-tutorial-completed");
    if (stored) {
      setCompletedCount(JSON.parse(stored).length);
    }
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      data-testid="button-tutorials"
    >
      <HelpCircle className="h-4 w-4" />
      Help
      {completedCount < TUTORIALS.length && (
        <Badge variant="secondary">
          {TUTORIALS.length - completedCount}
        </Badge>
      )}
    </Button>
  );
}
