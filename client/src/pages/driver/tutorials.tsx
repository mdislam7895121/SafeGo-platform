import { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, 
  Play, 
  CheckCircle2, 
  Clock, 
  Car,
  DollarSign,
  Shield,
  Loader2,
  Video,
  GraduationCap,
  Sparkles,
  HeadphonesIcon,
  Zap,
  AlertTriangle,
  ChevronRight,
  Lock,
  Star,
  Target,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type ModuleCategory = "getting_started" | "rides" | "earnings" | "safety" | "support" | "advanced";
type ModuleStatus = "available" | "coming_soon" | "locked";
type ModuleDifficulty = "Beginner" | "Intermediate" | "Advanced";

interface TrainingModule {
  id: string;
  title: string;
  shortDescription: string;
  category: ModuleCategory;
  estimatedDurationMinutes: number;
  difficulty: ModuleDifficulty;
  status: ModuleStatus;
  isRequiredForActivation: boolean;
  videoUrl: string | null;
  lastUpdated: string;
  keyTakeaways: string[];
}

const TRAINING_MODULES: TrainingModule[] = [
  {
    id: "accepting-first-ride",
    title: "Accepting Your First Ride",
    shortDescription: "Learn how to accept ride requests, navigate to pickup locations, and start trips confidently.",
    category: "getting_started",
    estimatedDurationMinutes: 3,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: true,
    videoUrl: null,
    lastUpdated: "2024-11-01",
    keyTakeaways: [
      "How to receive and accept ride requests",
      "Understanding the ride request screen",
      "Navigating to the pickup location efficiently",
      "Greeting passengers and starting the trip",
      "What to do if you can't find the passenger"
    ]
  },
  {
    id: "going-online-offline",
    title: "Going Online & Offline Properly",
    shortDescription: "Master the driver mode controls and learn best practices for managing your availability.",
    category: "getting_started",
    estimatedDurationMinutes: 4,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: true,
    videoUrl: null,
    lastUpdated: "2024-11-01",
    keyTakeaways: [
      "How to go online and start receiving requests",
      "Managing your availability during breaks",
      "Best times to be online for maximum earnings",
      "How driver status affects your SafeGo Points",
      "Proper offline procedures"
    ]
  },
  {
    id: "completing-trips-rating",
    title: "Completing Trips & Rating Riders",
    shortDescription: "Learn how to complete trips smoothly and understand the two-way rating system.",
    category: "rides",
    estimatedDurationMinutes: 5,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-10-28",
    keyTakeaways: [
      "How to end a trip correctly",
      "The rating system explained",
      "Why ratings matter for your account",
      "Tips for maintaining a high rating",
      "Handling difficult situations professionally"
    ]
  },
  {
    id: "navigation-pickup-practices",
    title: "Navigation & Pick-up Best Practices",
    shortDescription: "Advanced navigation tips and strategies for efficient pickups in busy areas.",
    category: "rides",
    estimatedDurationMinutes: 6,
    difficulty: "Intermediate",
    status: "coming_soon",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-11-15",
    keyTakeaways: [
      "Using in-app navigation effectively",
      "Airport and venue pickup protocols",
      "Communicating with passengers about location",
      "Handling multi-stop trips",
      "Peak hour navigation strategies"
    ]
  },
  {
    id: "handling-cancellations",
    title: "Handling Cancellations & No-shows",
    shortDescription: "Understand cancellation policies, fees, and how to handle passenger no-shows.",
    category: "rides",
    estimatedDurationMinutes: 5,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-10-20",
    keyTakeaways: [
      "When and how to cancel a ride",
      "Understanding cancellation fees",
      "No-show timer and procedures",
      "Protecting your cancellation rate",
      "Documenting issues properly"
    ]
  },
  {
    id: "earnings-payouts-overview",
    title: "Earnings & Payouts Overview",
    shortDescription: "Understand how your earnings are calculated and when you get paid.",
    category: "earnings",
    estimatedDurationMinutes: 4,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: true,
    videoUrl: null,
    lastUpdated: "2024-11-10",
    keyTakeaways: [
      "Base fare, time, and distance breakdown",
      "Understanding your earnings summary",
      "Weekly payout schedule",
      "Instant payout options",
      "Setting up payout methods"
    ]
  },
  {
    id: "incentives-promotions",
    title: "Incentives, Promotions & Bonuses",
    shortDescription: "Maximize your earnings with SafeGo promotions, quests, and bonus opportunities.",
    category: "earnings",
    estimatedDurationMinutes: 4,
    difficulty: "Intermediate",
    status: "coming_soon",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-11-20",
    keyTakeaways: [
      "Types of promotions available",
      "Quest bonuses and how to qualify",
      "Surge pricing explained",
      "Referral bonuses",
      "Seasonal earning opportunities"
    ]
  },
  {
    id: "safety-basics-sos",
    title: "Safety Basics & In-App SOS",
    shortDescription: "Learn essential safety features and how to use emergency assistance.",
    category: "safety",
    estimatedDurationMinutes: 6,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: true,
    videoUrl: null,
    lastUpdated: "2024-11-05",
    keyTakeaways: [
      "Using the in-app SOS button",
      "Share your trip with trusted contacts",
      "Recognizing and avoiding dangerous situations",
      "24/7 safety support access",
      "Vehicle safety checklist"
    ]
  },
  {
    id: "incident-emergency-reporting",
    title: "Incident & Emergency Reporting",
    shortDescription: "How to report incidents, accidents, and emergencies through the app.",
    category: "safety",
    estimatedDurationMinutes: 7,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-10-25",
    keyTakeaways: [
      "Steps to report an incident",
      "What information to collect",
      "Insurance and liability coverage",
      "Following up on reports",
      "Legal considerations"
    ]
  },
  {
    id: "getting-help-support",
    title: "Getting Help from SafeGo Support",
    shortDescription: "Navigate the Help Center and learn how to get quick support when needed.",
    category: "support",
    estimatedDurationMinutes: 4,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-11-01",
    keyTakeaways: [
      "Accessing the Help Center",
      "Creating support tickets",
      "Live chat and phone support",
      "Common issues and solutions",
      "Escalation procedures"
    ]
  },
  {
    id: "food-delivery-basics",
    title: "Food Delivery Fundamentals",
    shortDescription: "Learn the essentials of SafeGo food delivery including pickup and drop-off procedures.",
    category: "rides",
    estimatedDurationMinutes: 5,
    difficulty: "Beginner",
    status: "available",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-10-30",
    keyTakeaways: [
      "Accepting food delivery requests",
      "Restaurant pickup protocol",
      "Handling food safely",
      "Customer delivery etiquette",
      "Managing multiple orders"
    ]
  },
  {
    id: "maximizing-earnings",
    title: "Maximizing Your Weekly Earnings",
    shortDescription: "Advanced strategies to increase your earnings and work smarter, not harder.",
    category: "advanced",
    estimatedDurationMinutes: 8,
    difficulty: "Advanced",
    status: "available",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-11-12",
    keyTakeaways: [
      "Peak hour strategies",
      "Hot spot positioning",
      "Combining ride types efficiently",
      "Fuel cost optimization",
      "Tax deductions for drivers"
    ]
  },
  {
    id: "professional-driving",
    title: "Professional Driving Standards",
    shortDescription: "Elevate your service with professional driving techniques and customer service excellence.",
    category: "advanced",
    estimatedDurationMinutes: 6,
    difficulty: "Advanced",
    status: "coming_soon",
    isRequiredForActivation: false,
    videoUrl: null,
    lastUpdated: "2024-11-25",
    keyTakeaways: [
      "Creating a 5-star experience",
      "Vehicle presentation standards",
      "Professional communication",
      "Handling VIP passengers",
      "Building a loyal customer base"
    ]
  }
];

const CATEGORY_CONFIG: Record<ModuleCategory | "all", { label: string; icon: any }> = {
  all: { label: "All", icon: BookOpen },
  getting_started: { label: "Getting Started", icon: Sparkles },
  rides: { label: "Rides", icon: Car },
  earnings: { label: "Earnings", icon: DollarSign },
  safety: { label: "Safety", icon: Shield },
  support: { label: "Support", icon: HeadphonesIcon },
  advanced: { label: "Advanced", icon: Zap },
};

const DIFFICULTY_COLORS: Record<ModuleDifficulty, string> = {
  Beginner: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  Intermediate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  Advanced: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
};

const STORAGE_KEY = "safego-driver-training-completed";

function getCompletedModules(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCompletedModules(moduleIds: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(moduleIds));
  } catch {
    // localStorage not available
  }
}

export default function DriverTutorials() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory | "all">("all");
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [completedModules, setCompletedModules] = useState<string[]>([]);

  useEffect(() => {
    setCompletedModules(getCompletedModules());
  }, []);

  const filteredModules = useMemo(() => {
    if (selectedCategory === "all") {
      return TRAINING_MODULES;
    }
    return TRAINING_MODULES.filter(m => m.category === selectedCategory);
  }, [selectedCategory]);

  const totalModules = TRAINING_MODULES.length;
  const completedCount = completedModules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const requiredModules = TRAINING_MODULES.filter(m => m.isRequiredForActivation);
  const completedRequiredCount = requiredModules.filter(m => completedModules.includes(m.id)).length;

  const handleMarkComplete = (moduleId: string) => {
    if (!completedModules.includes(moduleId)) {
      const updated = [...completedModules, moduleId];
      setCompletedModules(updated);
      saveCompletedModules(updated);
      toast({
        title: "Module Completed",
        description: "Great job! Keep learning to unlock your full potential.",
      });
    }
    setSelectedModule(null);
  };

  const isModuleCompleted = (moduleId: string) => completedModules.includes(moduleId);

  const categories = Object.keys(CATEGORY_CONFIG) as (ModuleCategory | "all")[];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-tutorials-title">
          <GraduationCap className="h-7 w-7 text-primary" />
          Training Videos
        </h1>
        <p className="text-muted-foreground">Learn everything you need to succeed as a SafeGo driver</p>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Your Progress</span>
                <span className="text-sm text-muted-foreground">
                  {completedCount} of {totalModules} modules completed
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" data-testid="progress-tutorials" />
              <p className="text-xs text-muted-foreground mt-2">
                {progressPercent}% complete
              </p>
            </div>
            {progressPercent === 100 && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 self-start">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Complete
              </Badge>
            )}
          </div>

          {requiredModules.length > 0 && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Onboarding Progress</p>
                  <p className="text-xs text-muted-foreground">
                    {completedRequiredCount} of {requiredModules.length} required modules completed
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Modules marked as "Required" are part of your SafeGo onboarding.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ModuleCategory | "all")} className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto p-1 bg-muted/50">
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            return (
              <TabsTrigger 
                key={cat}
                value={cat}
                className="data-[state=active]:bg-background text-xs sm:text-sm"
                data-testid={`tab-${cat}`}
              >
                <Icon className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{config.label}</span>
                <span className="sm:hidden">{config.label.split(" ")[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {filteredModules.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No modules found in this category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModules.map((module) => {
            const CategoryIcon = CATEGORY_CONFIG[module.category].icon;
            const completed = isModuleCompleted(module.id);
            const isComingSoon = module.status === "coming_soon";
            const isLocked = module.status === "locked";
            
            return (
              <Card 
                key={module.id} 
                className={`overflow-hidden cursor-pointer group transition-all ${
                  isLocked ? "opacity-60" : "hover-elevate"
                }`}
                onClick={() => !isLocked && setSelectedModule(module)}
                data-testid={`card-module-${module.id}`}
              >
                <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  {isLocked ? (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  ) : isComingSoon ? (
                    <div className="h-14 w-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-primary ml-1" />
                    </div>
                  )}

                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {completed && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                    {isComingSoon && (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Coming Soon
                      </Badge>
                    )}
                    {module.isRequiredForActivation && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">
                        <Star className="h-3 w-3 mr-1" />
                        Required
                      </Badge>
                    )}
                  </div>

                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <Badge variant="secondary">
                      <CategoryIcon className="h-3 w-3 mr-1" />
                      {CATEGORY_CONFIG[module.category].label}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold mb-1 line-clamp-1">{module.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {module.shortDescription}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{module.estimatedDurationMinutes} min</span>
                    </div>
                    <Badge variant="outline" className={DIFFICULTY_COLORS[module.difficulty]}>
                      {module.difficulty}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedModule} onOpenChange={(open) => !open && setSelectedModule(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          {selectedModule && (
            <>
              <DialogHeader className="p-4 sm:p-6 pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-xl sm:text-2xl mb-2">{selectedModule.title}</DialogTitle>
                    <p className="text-muted-foreground text-sm sm:text-base">{selectedModule.shortDescription}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedModule.estimatedDurationMinutes} min
                  </Badge>
                  <Badge variant="secondary">
                    {CATEGORY_CONFIG[selectedModule.category].label}
                  </Badge>
                  <Badge variant="outline" className={DIFFICULTY_COLORS[selectedModule.difficulty]}>
                    {selectedModule.difficulty}
                  </Badge>
                  {selectedModule.isRequiredForActivation && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      <Star className="h-3 w-3 mr-1" />
                      Required for Onboarding
                    </Badge>
                  )}
                  {isModuleCompleted(selectedModule.id) && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[50vh]">
                <div className="p-4 sm:p-6 space-y-6">
                  {selectedModule.status === "coming_soon" ? (
                    <div className="aspect-video bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-lg flex flex-col items-center justify-center border border-yellow-500/20">
                      <Clock className="h-16 w-16 text-yellow-600 dark:text-yellow-400 mb-4" />
                      <p className="text-yellow-700 dark:text-yellow-400 font-medium text-center mb-2">Video Coming Soon</p>
                      <p className="text-sm text-muted-foreground text-center max-w-md px-4">
                        This training module is being prepared by our team. Check back soon for the full content.
                      </p>
                    </div>
                  ) : selectedModule.videoUrl ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <video 
                        controls 
                        className="w-full h-full"
                        poster=""
                      >
                        <source src={selectedModule.videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 rounded-lg flex flex-col items-center justify-center border border-border">
                      <Video className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground font-medium text-center mb-2">Video Placeholder</p>
                      <p className="text-sm text-muted-foreground text-center max-w-md px-4">
                        The training video will be attached here. For now, review the key takeaways below.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Key Takeaways
                    </h4>
                    <ul className="space-y-2">
                      {selectedModule.keyTakeaways.map((takeaway, index) => (
                        <li 
                          key={index}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                          data-testid={`takeaway-${index}`}
                        >
                          <ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(selectedModule.lastUpdated).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </div>
                </div>
              </ScrollArea>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 p-4 sm:p-6 pt-0 border-t bg-muted/30">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedModule(null)} 
                  data-testid="button-close-module"
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
                
                {selectedModule.status !== "coming_soon" && (
                  <Button 
                    onClick={() => handleMarkComplete(selectedModule.id)}
                    disabled={isModuleCompleted(selectedModule.id)}
                    data-testid="button-mark-complete"
                    className="w-full sm:w-auto"
                  >
                    {isModuleCompleted(selectedModule.id) ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Already Completed
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as Completed
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
