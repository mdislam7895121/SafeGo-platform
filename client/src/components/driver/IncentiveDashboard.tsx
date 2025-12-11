import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  Award,
  DollarSign,
  Clock,
  MapPin,
  Zap,
  Star,
  ChevronRight,
  Gift,
  Calendar,
  CheckCircle,
  Circle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IncentiveRecommendation {
  id: string;
  type: "surge_zone" | "quest" | "boost" | "streak" | "referral";
  title: string;
  description: string;
  potentialEarnings: number;
  expiresAt: string;
  priority: "high" | "medium" | "low";
  actionRequired?: string;
  progress?: {
    current: number;
    target: number;
  };
  location?: {
    name: string;
    lat: number;
    lng: number;
  };
}

interface DriverEngagement {
  weeklyTrips: number;
  weeklyEarnings: number;
  acceptanceRate: number;
  completionRate: number;
  averageRating: number;
  streakDays: number;
  currentTier: "bronze" | "silver" | "gold" | "platinum";
  pointsToNextTier: number;
}

interface IncentiveDashboardData {
  recommendations: IncentiveRecommendation[];
  engagement: DriverEngagement;
  activeIncentives: number;
  potentialBonus: number;
}

function getIncentiveIcon(type: IncentiveRecommendation["type"]) {
  switch (type) {
    case "surge_zone":
      return Zap;
    case "quest":
      return Target;
    case "boost":
      return TrendingUp;
    case "streak":
      return Award;
    case "referral":
      return Gift;
    default:
      return DollarSign;
  }
}

function getIncentiveColor(type: IncentiveRecommendation["type"]) {
  switch (type) {
    case "surge_zone":
      return "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400";
    case "quest":
      return "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400";
    case "boost":
      return "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400";
    case "streak":
      return "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
    case "referral":
      return "bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400";
  }
}

function getPriorityBadge(priority: IncentiveRecommendation["priority"]) {
  switch (priority) {
    case "high":
      return <Badge variant="destructive" className="text-xs">Hot</Badge>;
    case "medium":
      return <Badge variant="secondary" className="text-xs">Recommended</Badge>;
    default:
      return null;
  }
}

function getTierColor(tier: DriverEngagement["currentTier"]) {
  switch (tier) {
    case "platinum":
      return "text-purple-600 dark:text-purple-400";
    case "gold":
      return "text-yellow-600 dark:text-yellow-400";
    case "silver":
      return "text-gray-500 dark:text-gray-400";
    default:
      return "text-orange-600 dark:text-orange-400";
  }
}

export function IncentiveDashboard() {
  const { data, isLoading, error } = useQuery<{ data: IncentiveDashboardData }>({
    queryKey: ["/api/phase5/incentives/recommendations"],
    refetchInterval: 60000,
  });

  const dashboardData = data?.data;

  const sortedRecommendations = useMemo(() => {
    if (!dashboardData?.recommendations) return [];
    return [...dashboardData.recommendations].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [dashboardData?.recommendations]);

  const timeUntilExpiry = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff < 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Unable to load incentive data</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { engagement, activeIncentives, potentialBonus } = dashboardData;

  return (
    <div className="space-y-6" data-testid="incentive-dashboard">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Potential Bonus</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-potential-bonus">
                  ${potentialBonus.toFixed(2)}
                </p>
              </div>
              <div className="p-2 rounded-full bg-green-200 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Incentives</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-active-incentives">
                  {activeIncentives}
                </p>
              </div>
              <div className="p-2 rounded-full bg-blue-200 dark:bg-blue-900/30">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className={cn("h-5 w-5", getTierColor(engagement.currentTier))} />
                {engagement.currentTier.charAt(0).toUpperCase() + engagement.currentTier.slice(1)} Driver
              </CardTitle>
              <CardDescription>
                {engagement.pointsToNextTier} points to next tier
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="font-bold" data-testid="text-rating">{engagement.averageRating.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{engagement.streakDays} day streak</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Weekly Trips</p>
              <p className="text-lg font-bold" data-testid="text-weekly-trips">{engagement.weeklyTrips}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Weekly Earnings</p>
              <p className="text-lg font-bold" data-testid="text-weekly-earnings">${engagement.weeklyEarnings.toFixed(0)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Acceptance Rate</p>
              <p className="text-lg font-bold">{engagement.acceptanceRate}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Completion Rate</p>
              <p className="text-lg font-bold">{engagement.completionRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">Recommended For You</h3>
        <div className="space-y-3">
          {sortedRecommendations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium">You're all caught up!</p>
                <p className="text-sm text-muted-foreground">Check back later for new opportunities</p>
              </CardContent>
            </Card>
          ) : (
            sortedRecommendations.map((rec, index) => {
              const Icon = getIncentiveIcon(rec.type);
              const colorClass = getIncentiveColor(rec.type);
              
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover-elevate cursor-pointer" data-testid={`incentive-card-${rec.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{rec.title}</h4>
                            {getPriorityBadge(rec.priority)}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">
                            {rec.description}
                          </p>
                          
                          {rec.progress && (
                            <div className="mb-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>{rec.progress.current} / {rec.progress.target}</span>
                                <span>{Math.round((rec.progress.current / rec.progress.target) * 100)}%</span>
                              </div>
                              <Progress 
                                value={(rec.progress.current / rec.progress.target) * 100} 
                                className="h-1.5" 
                              />
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {timeUntilExpiry(rec.expiresAt)}
                              </span>
                              {rec.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {rec.location.name}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              +${rec.potentialEarnings.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function IncentiveMiniWidget({
  potentialBonus,
  activeCount,
  onClick,
}: {
  potentialBonus: number;
  activeCount: number;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full p-3 rounded-xl bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border hover-elevate text-left"
      data-testid="incentive-mini-widget"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-200 dark:bg-green-900/30">
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Earn up to ${potentialBonus.toFixed(2)} more</p>
            <p className="text-xs text-muted-foreground">{activeCount} active incentives</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    </motion.button>
  );
}

export default IncentiveDashboard;
