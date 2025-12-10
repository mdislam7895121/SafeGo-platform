import { useState, useEffect, useMemo, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clearTimerInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    
    const updateTimer = () => {
      const now = new Date();
      const end = new Date(endAt);
      
      if (isPast(end)) {
        setTimeLeft("Ended");
        setIsUrgent(false);
        clearTimerInterval();
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

    clearTimerInterval();
    updateTimer();
    
    if (!isPast(new Date(endAt))) {
      intervalRef.current = setInterval(updateTimer, 1000);
    }
    
    return clearTimerInterval;
  }, [endAt]);

  return (
    <span className={`${isUrgent ? "text-red-500 dark:text-red-400 font-medium animate-pulse" : ""}`}>
      {timeLeft}
    </span>
  );
}

function UberStylePromotionCard({ 
  promotion, 
  countryCode, 
  variant = "active" 
}: { 
  promotion: DriverPromotion; 
  countryCode?: string;
  variant?: "active" | "completed" | "expired";
}) {
  const ServiceIcon = serviceIcons[promotion.serviceType] || Zap;
  
  const progress = promotion.progress;
  const isQuest = promotion.type === "QUEST_TRIPS";
  const isEarningsGoal = promotion.type === "EARNINGS_THRESHOLD";
  const isPerTrip = promotion.type === "PER_TRIP_BONUS";
  
  let progressPercent = 0;
  let progressText = "";
  let rewardText = "";
  
  if (isQuest && promotion.targetTrips) {
    const current = progress?.currentTrips || 0;
    progressPercent = Math.min((current / promotion.targetTrips) * 100, 100);
    progressText = `${current} of ${promotion.targetTrips} trips`;
    rewardText = `Earn ${formatCurrency(promotion.rewardPerUnit, countryCode)} extra`;
  } else if (isEarningsGoal && promotion.targetEarnings) {
    const current = progress?.currentEarnings || 0;
    progressPercent = Math.min((current / promotion.targetEarnings) * 100, 100);
    progressText = `${formatCurrency(current, countryCode)} of ${formatCurrency(promotion.targetEarnings, countryCode)}`;
    rewardText = `Up to ${formatCurrency(promotion.rewardPerUnit, countryCode)} extra`;
  } else if (isPerTrip) {
    rewardText = `${formatCurrency(promotion.rewardPerUnit, countryCode)} extra per trip`;
    if (promotion.maxRewardPerDriver) {
      rewardText = `Up to ${formatCurrency(promotion.maxRewardPerDriver, countryCode)} extra`;
    }
  }

  const isCompleted = progressPercent >= 100;
  const showProgress = (isQuest || isEarningsGoal) && variant !== "expired" && (progress?.currentTrips || 0) > 0;

  const badgeConfig = {
    QUEST_TRIPS: { label: "Quest", bg: "bg-purple-600" },
    EARNINGS_THRESHOLD: { label: "Goal", bg: "bg-blue-600" },
    PER_TRIP_BONUS: { label: "Bonus", bg: "bg-green-600" },
  };
  const badge = badgeConfig[promotion.type] || { label: "Promo", bg: "bg-primary" };

  const timeText = `${format(new Date(promotion.startAt), "h:mm a")} - ${format(new Date(promotion.endAt), "h:mm a")}`;
  const locationText = promotion.countryCode ? (promotion.countryCode === "BD" ? "Bangladesh" : "United States") : "All Regions";

  const cardBg = variant === "completed" || isCompleted 
    ? "bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
    : variant === "expired" 
      ? "bg-muted/30 opacity-70" 
      : "bg-card hover-elevate";

  return (
    <div 
      className={`rounded-xl border p-4 shadow-sm transition-all ${cardBg}`}
      data-testid={`card-promotion-${promotion.id}`}
    >
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-tight line-clamp-2">{promotion.name}</h3>
            <Badge className={`${badge.bg} text-white shrink-0 text-xs px-2`}>
              {badge.label}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeText}</span>
            <span className="mx-1">·</span>
            <ServiceIcon className="h-3 w-3" />
            <span>{serviceLabels[promotion.serviceType]}</span>
            {promotion.countryCode && (
              <>
                <span className="mx-1">·</span>
                <span>{locationText}</span>
              </>
            )}
          </div>
          
          {promotion.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {promotion.description}
            </p>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm ${isCompleted ? "text-green-600 dark:text-green-400" : "text-primary"}`}>
                {rewardText}
              </span>
              {(variant === "completed" || isCompleted) && (
                <Badge variant="outline" className="border-green-500 dark:border-green-400 text-green-600 dark:text-green-400 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
              {variant === "expired" && !isCompleted && (
                <Badge variant="secondary" className="text-xs">
                  Expired
                </Badge>
              )}
            </div>
            
            {showProgress && (
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${isCompleted ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{progressText}</span>
              </div>
            )}
          </div>
          
          {variant === "active" && !isCompleted && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
              <Timer className="h-3 w-3" />
              <CountdownTimer endAt={promotion.endAt} />
            </div>
          )}
        </div>
        
        <div className="hidden sm:flex shrink-0 items-center">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
            {isQuest ? (
              <Target className="h-8 w-8 text-purple-500 dark:text-purple-400" />
            ) : isEarningsGoal ? (
              <TrendingUp className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            ) : (
              <DollarSign className="h-8 w-8 text-green-500 dark:text-green-400" />
            )}
          </div>
        </div>
      </div>
    </div>
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

  const { data: promotionData, isLoading: loadingPromotions, refetch: refetchPromotions } = useQuery<{ date: string; promotions: DriverPromotion[] }>({
    queryKey: ["/api/driver/promotions/active", selectedDate],
    queryFn: () => apiRequest(`/api/driver/promotions/active?date=${selectedDate}`),
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
      queryClient.invalidateQueries({ queryKey: ["/api/driver/promotions/active", selectedDate] }),
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

  const filteredBonuses = useMemo(() =>
    bonuses.filter(b => isBonusActiveOnDate(b, selectedDate)),
    [bonuses, selectedDate]
  );

  const activeQuests = promotions.filter(p => p.type !== "PER_TRIP_BONUS");
  const perTripBonuses = promotions.filter(p => p.type === "PER_TRIP_BONUS");
  
  const formattedSelectedDate = useMemo(() => {
    try {
      const date = parseISO(selectedDate);
      return format(date, "EEEE, MMM d");
    } catch {
      return format(new Date(), "EEEE, MMM d");
    }
  }, [selectedDate]);

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
            <div 
              className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg border"
              data-testid="date-header"
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{formattedSelectedDate}</span>
              {promotions.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {promotions.length} {promotions.length === 1 ? 'promotion' : 'promotions'}
                </Badge>
              )}
            </div>
            
            {loadingPromotions ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : activeQuests.length === 0 && perTripBonuses.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2" data-testid="text-empty-quests">
                  No promotions for this day
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Try selecting another date or check back later for new opportunities
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeQuests.map(promo => (
                  <UberStylePromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="active" />
                ))}
                {perTripBonuses.map(promo => (
                  <UberStylePromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="active" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bonuses" className="mt-4 space-y-4">
            <div 
              className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg border"
              data-testid="date-header-bonuses"
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{formattedSelectedDate}</span>
              {filteredBonuses.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {filteredBonuses.length} {filteredBonuses.length === 1 ? 'bonus' : 'bonuses'}
                </Badge>
              )}
            </div>
            
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
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Gift className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2" data-testid="text-empty-bonuses">
                  No bonuses for this day
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Check other dates or check back later for new opportunities
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-4">
            {loadingCompleted ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
              </div>
            ) : completedPromotions.length === 0 && expiredPromotions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No completed promotions yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Complete quests and earn bonuses to see them here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedPromotions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-green-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Completed ({completedPromotions.length})
                    </h3>
                    {completedPromotions.map(promo => (
                      <UberStylePromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="completed" />
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
                      <UberStylePromotionCard key={promo.id} promotion={promo} countryCode={countryCode} variant="expired" />
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
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No bonus history</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Complete trips and promotions to earn bonuses
                </p>
              </div>
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
