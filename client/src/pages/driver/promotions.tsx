import { useState, useEffect, useMemo } from "react";
import { Gift, TrendingUp, Clock, Target, Zap, DollarSign, Trophy, CheckCircle, Car, UtensilsCrossed, Package, ArrowLeft, AlertCircle, Timer, RefreshCw, Star, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isPast, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { PromotionsDateStrip } from "@/components/driver/PromotionsDateStrip";

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
  QUEST_TRIPS: "Trip Quest",
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

const serviceLabels: Record<string, string> = {
  RIDES: "Rides",
  FOOD: "Food Delivery",
  PARCEL: "Parcels",
  ANY: "All Services",
};

function formatCurrency(amount: number, country?: string): string {
  if (country === "BD") return `৳${amount.toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

function CountdownTimer({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const end = new Date(endAt);
      
      if (isPast(end)) {
        setTimeLeft("Ended");
        return;
      }

      const days = differenceInDays(end, now);
      const hours = differenceInHours(end, now) % 24;
      const minutes = differenceInMinutes(end, now) % 60;
      const seconds = differenceInSeconds(end, now) % 60;

      setIsUrgent(days === 0 && hours < 6);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s left`);
      } else {
        setTimeLeft(`${seconds}s left`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endAt]);

  return (
    <span className={`flex items-center gap-1 ${isUrgent ? "text-red-500 font-medium animate-pulse" : ""}`}>
      <Timer className="h-3 w-3" />
      {timeLeft}
    </span>
  );
}

function PromotionCard({ 
  promotion, 
  countryCode, 
  variant = "active" 
}: { 
  promotion: DriverPromotion; 
  countryCode?: string;
  variant?: "active" | "completed" | "expired";
}) {
  const TypeIcon = promotionTypeIcons[promotion.type] || Gift;
  const ServiceIcon = serviceIcons[promotion.serviceType] || Zap;
  
  const progress = promotion.progress;
  const isQuest = promotion.type === "QUEST_TRIPS";
  const isEarningsGoal = promotion.type === "EARNINGS_THRESHOLD";
  const isPerTrip = promotion.type === "PER_TRIP_BONUS";
  
  let progressPercent = 0;
  let progressText = "";
  let requirementText = "";
  
  if (isQuest && promotion.targetTrips) {
    const current = progress?.currentTrips || 0;
    progressPercent = Math.min((current / promotion.targetTrips) * 100, 100);
    progressText = `${current} / ${promotion.targetTrips} trips`;
    requirementText = `Complete ${promotion.targetTrips} ${promotion.serviceType === "ANY" ? "" : serviceLabels[promotion.serviceType]?.toLowerCase()} trips`;
  } else if (isEarningsGoal && promotion.targetEarnings) {
    const current = progress?.currentEarnings || 0;
    progressPercent = Math.min((current / promotion.targetEarnings) * 100, 100);
    progressText = `${formatCurrency(current, countryCode)} / ${formatCurrency(promotion.targetEarnings, countryCode)}`;
    requirementText = `Earn ${formatCurrency(promotion.targetEarnings, countryCode)} in ${serviceLabels[promotion.serviceType]?.toLowerCase() || "any"} service`;
  } else if (isPerTrip) {
    requirementText = `Earn bonus on each ${serviceLabels[promotion.serviceType]?.toLowerCase() || ""} trip`;
  }

  const isCompleted = progressPercent >= 100;
  const isExpired = variant === "expired";
  const showProgress = (isQuest || isEarningsGoal) && variant !== "expired";

  const cardStyles = {
    active: isCompleted ? "border-green-500/50 bg-green-50/10 dark:bg-green-950/20" : "",
    completed: "border-green-500/50 bg-green-50/10 dark:bg-green-950/20",
    expired: "opacity-75 border-muted"
  };

  return (
    <Card 
      className={`transition-all ${cardStyles[variant]} ${variant === "active" && !isCompleted ? "hover-elevate" : ""}`}
      data-testid={`card-promotion-${promotion.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              variant === "completed" || isCompleted 
                ? "bg-green-500/20" 
                : variant === "expired" 
                  ? "bg-muted" 
                  : "bg-primary/10"
            }`}>
              <TypeIcon className={`h-5 w-5 ${
                variant === "completed" || isCompleted 
                  ? "text-green-600" 
                  : variant === "expired"
                    ? "text-muted-foreground"
                    : "text-primary"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight truncate">{promotion.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant="outline" className="text-xs shrink-0">
                  <ServiceIcon className="h-3 w-3 mr-1" />
                  {serviceLabels[promotion.serviceType]}
                </Badge>
                {variant === "active" && !isCompleted && (
                  <span className="text-xs text-muted-foreground">
                    <CountdownTimer endAt={promotion.endAt} />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            {(variant === "completed" || isCompleted) && (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Done
              </Badge>
            )}
            {variant === "expired" && !isCompleted && (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Expired
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        {promotion.description && (
          <p className="text-sm text-muted-foreground">{promotion.description}</p>
        )}

        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Requirement:</span>
            <span className="font-medium">{requirementText}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Reward:</span>
            <span className="font-semibold text-green-600">
              {isPerTrip 
                ? `${formatCurrency(promotion.rewardPerUnit, countryCode)} per trip`
                : formatCurrency(promotion.rewardPerUnit, countryCode)
              }
            </span>
          </div>
        </div>

        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Progress</span>
              <span className="font-medium">{progressText}</span>
            </div>
            <Progress 
              value={progressPercent} 
              className={`h-3 ${isCompleted ? "[&>div]:bg-green-500" : ""}`} 
            />
            {progressPercent > 0 && progressPercent < 100 && (
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(100 - progressPercent)}% more to complete
              </p>
            )}
          </div>
        )}

        {progress && progress.totalBonusEarned > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Total Earned</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(progress.totalBonusEarned, countryCode)}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {variant === "expired" ? "Ended" : "Ends"} {format(new Date(promotion.endAt), "MMM d, yyyy 'at' h:mm a")}
      </CardFooter>
    </Card>
  );
}

function OpportunityBonusCard({ bonus, index }: { bonus: OpportunityBonus; index: number }) {
  const BonusIcon = bonusTypeIcons[bonus.bonusType] || Gift;
  
  return (
    <Card className="border-l-4 border-l-purple-500 hover-elevate" data-testid={`card-bonus-${index}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
              <BonusIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{bonusTypeLabels[bonus.bonusType]}</CardTitle>
              <CardDescription className="mt-1">
                {bonusTypeDescriptions[bonus.bonusType]}
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0 ml-2">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bonus per Trip</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {bonus.currencySymbol}{bonus.effectiveBonus}
              </p>
              {bonus.isPromoActive && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                    <Star className="h-3 w-3 mr-1" />
                    Promo Active
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Base: {bonus.currencySymbol}{bonus.baseAmount}
                  </span>
                </div>
              )}
            </div>
            {bonus.zoneId && (
              <Badge variant="outline" className="text-sm">
                Zone: {bonus.zoneId}
              </Badge>
            )}
          </div>
        </div>
        {bonus.endAt && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {bonus.isPromoActive ? "Promo ends" : "Available until"}
            </span>
            <span className="font-medium">
              {format(new Date(bonus.endAt), "MMM d, h:mm a")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CalendarEntry {
  count: number;
  types: string[];
}

interface CalendarResponse {
  calendar: Record<string, CalendarEntry>;
  range: { startDate: string; endDate: string };
}

export default function DriverPromotions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const countryCode = user?.countryCode || "US";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

  const { data: bonusData, isLoading: loadingBonuses } = useQuery<{ bonuses: OpportunityBonus[] }>({
    queryKey: ["/api/driver/opportunity-bonuses"],
    refetchInterval: 60000,
  });

  const { data: promotionData, isLoading: loadingPromotions, refetch: refetchPromotions } = useQuery<{ promotions: DriverPromotion[] }>({
    queryKey: ["/api/driver/promotions/active"],
    refetchInterval: 30000,
  });

  const { data: completedData, isLoading: loadingCompleted } = useQuery<{ completed: DriverPromotion[]; expired: DriverPromotion[] }>({
    queryKey: ["/api/driver/promotions/completed"],
    refetchInterval: 60000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery<PromotionStats>({
    queryKey: ["/api/driver/promotions/stats"],
    refetchInterval: 30000,
  });

  const { data: history, isLoading: loadingHistory } = useQuery<{ 
    payouts: BonusHistory[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ["/api/driver/promotions/history"],
  });

  const { data: calendarData } = useQuery<CalendarResponse>({
    queryKey: ["/api/driver/promotions/calendar"],
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/driver/promotions/active"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/driver/promotions/completed"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/driver/promotions/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/driver/promotions/history"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/driver/opportunity-bonuses"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/driver/promotions/calendar"] }),
    ]);
    setIsRefreshing(false);
  };

  const bonuses = bonusData?.bonuses || [];
  const promotions = promotionData?.promotions || [];
  const completedPromotions = completedData?.completed || [];
  const expiredPromotions = completedData?.expired || [];
  const bonusHistory = history?.payouts || [];

  const isPromotionActiveOnDate = (promo: DriverPromotion, dateStr: string): boolean => {
    try {
      const checkDate = parseISO(dateStr);
      const start = startOfDay(parseISO(promo.startAt));
      const end = endOfDay(parseISO(promo.endAt));
      return isWithinInterval(checkDate, { start, end });
    } catch {
      return false;
    }
  };

  const isBonusActiveOnDate = (bonus: OpportunityBonus, dateStr: string): boolean => {
    if (!bonus.startAt || !bonus.endAt) return true;
    try {
      const checkDate = parseISO(dateStr);
      const start = startOfDay(parseISO(bonus.startAt));
      const end = endOfDay(parseISO(bonus.endAt));
      return isWithinInterval(checkDate, { start, end });
    } catch {
      return false;
    }
  };

  const filteredPromotions = useMemo(() => 
    promotions.filter(p => isPromotionActiveOnDate(p, selectedDate)),
    [promotions, selectedDate]
  );

  const filteredBonuses = useMemo(() =>
    bonuses.filter(b => isBonusActiveOnDate(b, selectedDate)),
    [bonuses, selectedDate]
  );

  const activeQuests = filteredPromotions.filter(p => p.type !== "PER_TRIP_BONUS");
  const perTripBonuses = filteredPromotions.filter(p => p.type === "PER_TRIP_BONUS");

  return (
    <div className="bg-background min-h-screen pb-20">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link href="/driver">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <Gift className="h-6 w-6" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Promotions & Bonuses</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm opacity-90 mb-4">Active bonuses, quests, and earning opportunities</p>
        
        <PromotionsDateStrip
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          days={14}
          calendar={calendarData?.calendar}
        />
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
                      {formatCurrency(stats.totalBonusEarned || 0, countryCode)}
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
                      {formatCurrency(stats.monthlyBonusEarned || 0, countryCode)}
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
                      {stats.activePromotions || 0}
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
                      {stats.inProgressQuests || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="quests" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="quests" data-testid="tab-quests">
              Quests
              {activeQuests.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0">{activeQuests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bonuses" data-testid="tab-bonuses">Bonuses</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Done
              {completedPromotions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0">{completedPromotions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="quests" className="mt-4 space-y-4">
            {loadingPromotions ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : activeQuests.length === 0 && perTripBonuses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Quests for {format(parseISO(selectedDate), "MMM d")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try selecting a different date or check back later for new opportunities
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeQuests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Trip Quests
                    </h3>
                    {activeQuests.map(promo => (
                      <PromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="active" />
                    ))}
                  </div>
                )}

                {perTripBonuses.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Per-Trip Bonuses
                    </h3>
                    {perTripBonuses.map(promo => (
                      <PromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="active" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bonuses" className="mt-4 space-y-4">
            {loadingBonuses ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : filteredBonuses.length > 0 ? (
              <div className="space-y-4">
                {filteredBonuses.map((bonus, index) => (
                  <OpportunityBonusCard key={index} bonus={bonus} index={index} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Bonuses for {format(parseISO(selectedDate), "MMM d")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check other dates or check back later for new opportunities
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-4">
            {loadingCompleted ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
              </div>
            ) : completedPromotions.length === 0 && expiredPromotions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-medium">No Completed Promotions Yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete quests and earn bonuses to see them here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {completedPromotions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-green-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Completed ({completedPromotions.length})
                    </h3>
                    {completedPromotions.map(promo => (
                      <PromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="completed" />
                    ))}
                  </div>
                )}

                {expiredPromotions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Expired ({expiredPromotions.length})
                    </h3>
                    {expiredPromotions.map(promo => (
                      <PromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="expired" />
                    ))}
                  </div>
                )}
              </div>
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
                    <Card key={bonus.id} className="hover-elevate" data-testid={`card-history-${bonus.id}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{bonus.promotionName}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ServiceIcon className="h-3 w-3" />
                                <span>{promotionTypeLabels[bonus.promotionType] || bonus.promotionType}</span>
                                {bonus.tripType && (
                                  <>
                                    <span>•</span>
                                    <span className="capitalize">{bonus.tripType}</span>
                                  </>
                                )}
                              </div>
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
