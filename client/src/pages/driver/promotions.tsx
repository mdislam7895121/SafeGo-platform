import { Gift, TrendingUp, Clock, MapPin, Target, Zap, DollarSign, Trophy, CheckCircle, Car, UtensilsCrossed, Package, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface OpportunityBonus {
  bonusType: "trip_boost" | "surge_boost" | "peak_hour_boost" | "per_ride_bonus";
  baseAmount: string;
  effectiveBonus: string;
  currency: string;
  currencySymbol: string;
  isPromoActive: boolean;
  zoneId?: string;
  startAt?: string;
  endAt?: string;
}

interface DriverPromotion {
  id: string;
  name: string;
  description?: string;
  type: "PER_TRIP_BONUS" | "QUEST_TRIPS" | "EARNINGS_THRESHOLD";
  serviceType: "RIDES" | "FOOD" | "PARCEL" | "ANY";
  countryCode?: string;
  startAt: string;
  endAt: string;
  rewardPerUnit: number;
  targetTrips?: number;
  targetEarnings?: number;
  maxRewardPerDriver?: number;
  progress?: {
    currentTrips: number;
    currentEarnings: number;
    totalBonusEarned: number;
    lastUpdatedAt: string;
  };
}

interface PromotionStats {
  totalBonusEarned: number;
  totalBonusCount: number;
  monthlyBonusEarned: number;
  monthlyBonusCount: number;
  activePromotions: number;
  inProgressQuests: number;
}

interface BonusHistory {
  id: string;
  promotionId: string;
  promotionName: string;
  promotionType: string;
  serviceType: string;
  amount: number;
  tripType?: string;
  tripId?: string;
  createdAt: string;
}

const bonusTypeLabels: Record<string, string> = {
  trip_boost: "Trip Boost",
  surge_boost: "Surge Boost",
  peak_hour_boost: "Peak Hour Boost",
  per_ride_bonus: "Per-Ride Bonus",
};

const bonusTypeDescriptions: Record<string, string> = {
  trip_boost: "General ride incentive for completing trips",
  surge_boost: "Higher payouts during high-demand periods",
  peak_hour_boost: "Bonuses for driving during peak hours",
  per_ride_bonus: "Fixed amount added to each completed ride",
};

const bonusTypeIcons: Record<string, any> = {
  trip_boost: Target,
  surge_boost: TrendingUp,
  peak_hour_boost: Clock,
  per_ride_bonus: DollarSign,
};

const promotionTypeLabels: Record<string, string> = {
  PER_TRIP_BONUS: "Per-Trip Bonus",
  QUEST_TRIPS: "Complete Trips Quest",
  EARNINGS_THRESHOLD: "Earnings Goal",
};

const promotionTypeIcons: Record<string, any> = {
  PER_TRIP_BONUS: DollarSign,
  QUEST_TRIPS: Target,
  EARNINGS_THRESHOLD: TrendingUp,
};

const serviceIcons: Record<string, any> = {
  RIDES: Car,
  FOOD: UtensilsCrossed,
  PARCEL: Package,
  ANY: Zap,
};

function formatCurrency(amount: number, country?: string): string {
  if (country === "BD") return `৳${amount.toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

function getTimeRemaining(endAt: string): string {
  const now = new Date();
  const end = new Date(endAt);
  const days = differenceInDays(end, now);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} left`;
  const hours = differenceInHours(end, now);
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} left`;
  return "Ending soon";
}

function PromotionCard({ promotion, countryCode }: { promotion: DriverPromotion; countryCode?: string }) {
  const TypeIcon = promotionTypeIcons[promotion.type] || Gift;
  const ServiceIcon = serviceIcons[promotion.serviceType] || Zap;
  
  const progress = promotion.progress;
  const isQuest = promotion.type === "QUEST_TRIPS";
  const isEarningsGoal = promotion.type === "EARNINGS_THRESHOLD";
  
  let progressPercent = 0;
  let progressText = "";
  
  if (isQuest && promotion.targetTrips) {
    const current = progress?.currentTrips || 0;
    progressPercent = Math.min((current / promotion.targetTrips) * 100, 100);
    progressText = `${current} / ${promotion.targetTrips} trips`;
  } else if (isEarningsGoal && promotion.targetEarnings) {
    const current = progress?.currentEarnings || 0;
    progressPercent = Math.min((current / promotion.targetEarnings) * 100, 100);
    progressText = `${formatCurrency(current, countryCode)} / ${formatCurrency(promotion.targetEarnings, countryCode)}`;
  }

  const isCompleted = progressPercent >= 100;
  const timeRemaining = getTimeRemaining(promotion.endAt);

  return (
    <Card 
      className={`hover-elevate transition-all ${isCompleted ? "border-green-500/50 bg-green-50/10" : ""}`}
      data-testid={`card-promotion-${promotion.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCompleted ? "bg-green-500/20" : "bg-primary/10"}`}>
              <TypeIcon className={`h-5 w-5 ${isCompleted ? "text-green-600" : "text-primary"}`} />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">{promotion.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <ServiceIcon className="h-3 w-3 mr-1" />
                  {promotion.serviceType === "ANY" ? "All Services" : promotion.serviceType}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeRemaining}
                </span>
              </div>
            </div>
          </div>
          {isCompleted && (
            <Badge className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Done
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {promotion.description && (
          <p className="text-sm text-muted-foreground mb-3">{promotion.description}</p>
        )}
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-green-600">
              {promotion.type === "PER_TRIP_BONUS" 
                ? `${formatCurrency(promotion.rewardPerUnit, countryCode)} per trip`
                : `${formatCurrency(promotion.rewardPerUnit, countryCode)} bonus`
              }
            </span>
            {progress && progress.totalBonusEarned > 0 && (
              <span className="text-muted-foreground">
                Earned: {formatCurrency(progress.totalBonusEarned, countryCode)}
              </span>
            )}
          </div>

          {(isQuest || isEarningsGoal) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progressText}</span>
              </div>
              <Progress 
                value={progressPercent} 
                className={`h-2 ${isCompleted ? "[&>div]:bg-green-500" : ""}`} 
              />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        Ends {format(new Date(promotion.endAt), "MMM d, yyyy 'at' h:mm a")}
      </CardFooter>
    </Card>
  );
}

export default function DriverPromotions() {
  const { user } = useAuth();
  const countryCode = user?.countryCode || "US";

  const { data: bonusData, isLoading: loadingBonuses } = useQuery<{ bonuses: OpportunityBonus[] }>({
    queryKey: ["/api/driver/opportunity-bonuses"],
  });

  const { data: promotionData, isLoading: loadingPromotions } = useQuery<{ promotions: DriverPromotion[] }>({
    queryKey: ["/api/driver/promotions/active"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery<PromotionStats>({
    queryKey: ["/api/driver/promotions/stats"],
  });

  const { data: history, isLoading: loadingHistory } = useQuery<{ 
    payouts: BonusHistory[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ["/api/driver/promotions/history"],
  });

  const bonuses = bonusData?.bonuses || [];
  const promotions = promotionData?.promotions || [];
  const bonusHistory = history?.payouts || [];

  return (
    <div className="bg-background min-h-screen pb-20">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/driver">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Gift className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Promotions</h1>
        </div>
        <p className="text-sm opacity-90">Active bonuses, quests, and special offers</p>
      </div>

      <div className="p-4 space-y-4">
        {loadingStats ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Earned</p>
                    <p className="text-lg font-bold" data-testid="text-total-earned">
                      {formatCurrency(stats.totalBonusEarned, countryCode)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Trophy className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">This Month</p>
                    <p className="text-lg font-bold" data-testid="text-monthly-earned">
                      {formatCurrency(stats.monthlyBonusEarned, countryCode)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-lg font-bold" data-testid="text-active-count">
                      {stats.activePromotions}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Target className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                    <p className="text-lg font-bold" data-testid="text-in-progress">
                      {stats.inProgressQuests}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="quests" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="quests" data-testid="tab-quests">Quests</TabsTrigger>
            <TabsTrigger value="bonuses" data-testid="tab-bonuses">Bonuses</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="quests" className="mt-4 space-y-4">
            {loadingPromotions ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
              </div>
            ) : promotions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Active Quests</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check back later for new earning opportunities
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {promotions.map(promo => (
                  <PromotionCard key={promo.id} promotion={promo} countryCode={countryCode} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bonuses" className="mt-4 space-y-4">
            {loadingBonuses ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : bonuses.length > 0 ? (
              bonuses.map((bonus, index) => {
                const BonusIcon = bonusTypeIcons[bonus.bonusType] || Gift;
                return (
                  <Card key={index} className="border-l-4 border-l-purple-500" data-testid={`card-bonus-${index}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
                            <BonusIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{bonusTypeLabels[bonus.bonusType]}</CardTitle>
                            <CardDescription className="mt-1">
                              {bonusTypeDescriptions[bonus.bonusType]}
                              {bonus.zoneId && (
                                <Badge variant="secondary" className="ml-2">
                                  {bonus.zoneId}
                                </Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0 ml-2">
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Bonus</p>
                          <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                            {bonus.currencySymbol}{bonus.effectiveBonus}
                            {bonus.isPromoActive && (
                              <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                                Promo
                              </Badge>
                            )}
                          </p>
                          {bonus.isPromoActive && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Base: {bonus.currencySymbol}{bonus.baseAmount}
                            </p>
                          )}
                        </div>
                        {bonus.endAt && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {bonus.isPromoActive ? "Promo Ends" : "Ends"}
                            </p>
                            <p className="text-sm font-medium">
                              {new Date(bonus.endAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Active Bonuses</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check back later for new bonus opportunities
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : bonusHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Bonus History</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete trips and promotions to earn bonuses
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {bonusHistory.map((bonus) => {
                  const ServiceIcon = serviceIcons[bonus.serviceType] || Zap;
                  return (
                    <Card key={bonus.id} data-testid={`card-history-${bonus.id}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{bonus.promotionName}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <ServiceIcon className="h-3 w-3" />
                                {promotionTypeLabels[bonus.promotionType] || bonus.promotionType}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
                              +{formatCurrency(bonus.amount, countryCode)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(bonus.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
