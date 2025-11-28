import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronUp,
  Gift,
  Target,
  Zap,
  Plane,
  CloudRain,
  Moon,
  DollarSign,
  TrendingUp,
  MapPin,
  Thermometer,
  CloudSnow,
  CloudLightning,
} from "lucide-react";

export type QuestTier = 1 | 2 | 3;
export type BoostLevel = "normal" | "busy" | "very_busy";
export type WeatherConditionType = "clear" | "rain" | "heavy_rain" | "snow" | "storm" | "fog" | "low_visibility";

export interface IncentiveBreakdown {
  questBonus: number;
  boostZoneBonus: number;
  airportBonus: number;
  weatherBonus: number;
  lateNightBonus: number;
  totalIncentivePayout: number;
}

export interface QuestProgress {
  questActive: boolean;
  questTier: QuestTier | null;
  ridesCompletedInCycle: number;
  questBonusEarned: number;
  progressPercent: number;
  nextTierRides: number | null;
  nextTierBonus: number | null;
}

export interface IncentiveFlags {
  questActive: boolean;
  questTier: QuestTier | null;
  ridesCompletedInCycle: number;
  questBonusEarned: number;
  boostActive: boolean;
  boostPercent: number;
  boostZoneId: string | null;
  boostZoneName?: string | null;
  boostLevel?: BoostLevel | null;
  airportBonusApplied: boolean;
  airportCode?: string | null;
  weatherBonusActive: boolean;
  weatherConditionType: WeatherConditionType | null;
  temperatureFahrenheit?: number;
  lateNightBonusApplied: boolean;
}

export interface DriverBonusesProps {
  breakdown: IncentiveBreakdown;
  flags: IncentiveFlags;
  questProgress?: QuestProgress;
  driverEarningsBase?: number;
  totalDriverPayout?: number;
  currency?: string;
  className?: string;
  alwaysExpanded?: boolean;
  showQuestProgress?: boolean;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getQuestTierLabel(tier: QuestTier): string {
  const labels: Record<QuestTier, string> = {
    1: "Bronze",
    2: "Silver",
    3: "Gold",
  };
  return labels[tier];
}

function getQuestTierColor(tier: QuestTier | null): string {
  if (!tier) return "bg-muted text-muted-foreground";
  const colors: Record<QuestTier, string> = {
    1: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    2: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
    3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  };
  return colors[tier];
}

function getBoostLevelLabel(level: BoostLevel): string {
  const labels: Record<BoostLevel, string> = {
    normal: "Busy",
    busy: "Very Busy",
    very_busy: "Super Busy",
  };
  return labels[level];
}

function getBoostLevelColor(level: BoostLevel | null): string {
  if (!level) return "";
  const colors: Record<BoostLevel, string> = {
    normal: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    busy: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    very_busy: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return colors[level];
}

function getWeatherIcon(type: WeatherConditionType | null): typeof CloudRain {
  if (!type) return CloudRain;
  const icons: Record<WeatherConditionType, typeof CloudRain> = {
    clear: CloudRain,
    rain: CloudRain,
    heavy_rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
    fog: CloudRain,
    low_visibility: CloudRain,
  };
  return icons[type];
}

function getWeatherLabel(type: WeatherConditionType | null, temp?: number): string {
  if (!type) return "Weather";
  if (temp !== undefined && temp < 30) return "Extreme cold";
  const labels: Record<WeatherConditionType, string> = {
    clear: "Clear",
    rain: "Rain",
    heavy_rain: "Heavy rain",
    snow: "Snow",
    storm: "Storm",
    fog: "Fog",
    low_visibility: "Low visibility",
  };
  return labels[type];
}

interface BonusLineProps {
  icon: typeof Gift;
  label: string;
  amount: number;
  currency: string;
  badge?: string;
  badgeColor?: string;
  isActive?: boolean;
}

function BonusLine({
  icon: Icon,
  label,
  amount,
  currency,
  badge,
  badgeColor,
  isActive = true,
}: BonusLineProps) {
  if (amount === 0 && !isActive) return null;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon className={`h-4 w-4 ${isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
        <span className="text-sm">{label}</span>
        {badge && (
          <Badge className={`text-xs ${badgeColor || ""}`} data-testid={`badge-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            {badge}
          </Badge>
        )}
      </div>
      <span
        className={`text-sm font-medium ${isActive && amount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
        data-testid={`text-bonus-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        +{formatCurrency(amount, currency)}
      </span>
    </div>
  );
}

function QuestProgressDisplay({
  progress,
  currency,
}: {
  progress: QuestProgress;
  currency: string;
}) {
  const tierRides = [20, 40, 60];
  const tierBonuses = [15, 40, 75];

  return (
    <div className="space-y-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Weekly Quest</span>
          {progress.questTier && (
            <Badge className={getQuestTierColor(progress.questTier)} data-testid="badge-quest-tier">
              {getQuestTierLabel(progress.questTier)} Tier
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground" data-testid="text-rides-completed">
          {progress.ridesCompletedInCycle}/60 rides
        </span>
      </div>

      <div className="space-y-2">
        <Progress value={progress.progressPercent} className="h-2" data-testid="progress-quest" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress: {progress.progressPercent}%</span>
          {progress.questBonusEarned > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium" data-testid="text-quest-earned">
              Earned: {formatCurrency(progress.questBonusEarned, currency)}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-between">
        {tierRides.map((rides, index) => {
          const tier = (index + 1) as QuestTier;
          const isCompleted = progress.ridesCompletedInCycle >= rides;
          const isCurrent = progress.questTier === tier;

          return (
            <div
              key={tier}
              className={`flex-1 text-center p-2 rounded-lg border ${
                isCompleted
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
              data-testid={`quest-tier-${tier}`}
            >
              <div className={`text-xs font-medium ${isCompleted ? "text-green-600 dark:text-green-400" : ""}`}>
                {getQuestTierLabel(tier)}
              </div>
              <div className={`text-sm ${isCompleted ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                {rides} rides
              </div>
              <div className={`text-xs font-semibold ${isCompleted ? "text-green-600 dark:text-green-400" : ""}`}>
                +{formatCurrency(tierBonuses[index], currency)}
              </div>
            </div>
          );
        })}
      </div>

      {progress.nextTierRides && progress.nextTierBonus && (
        <div className="text-center text-xs text-muted-foreground" data-testid="text-next-tier">
          {progress.nextTierRides - progress.ridesCompletedInCycle} more rides to earn{" "}
          <span className="font-medium text-primary">
            +{formatCurrency(progress.nextTierBonus - progress.questBonusEarned, currency)}
          </span>
        </div>
      )}
    </div>
  );
}

function BonusesContent({
  breakdown,
  flags,
  questProgress,
  driverEarningsBase,
  totalDriverPayout,
  currency,
  showQuestProgress,
}: {
  breakdown: IncentiveBreakdown;
  flags: IncentiveFlags;
  questProgress?: QuestProgress;
  driverEarningsBase?: number;
  totalDriverPayout?: number;
  currency: string;
  showQuestProgress: boolean;
}) {
  const WeatherIcon = getWeatherIcon(flags.weatherConditionType);
  const hasAnyBonus = breakdown.totalIncentivePayout > 0;

  return (
    <div className="space-y-0.5">
      {showQuestProgress && questProgress && flags.questActive && (
        <QuestProgressDisplay progress={questProgress} currency={currency} />
      )}

      {flags.boostActive && (
        <BonusLine
          icon={Zap}
          label={flags.boostZoneName || "Boost Zone"}
          amount={breakdown.boostZoneBonus}
          currency={currency}
          badge={flags.boostLevel ? `+${flags.boostPercent}%` : undefined}
          badgeColor={getBoostLevelColor(flags.boostLevel || null)}
          isActive={true}
        />
      )}

      {flags.airportBonusApplied && (
        <BonusLine
          icon={Plane}
          label={`Airport Pickup${flags.airportCode ? ` (${flags.airportCode})` : ""}`}
          amount={breakdown.airportBonus}
          currency={currency}
          isActive={true}
        />
      )}

      {flags.weatherBonusActive && (
        <BonusLine
          icon={WeatherIcon}
          label={getWeatherLabel(flags.weatherConditionType, flags.temperatureFahrenheit)}
          amount={breakdown.weatherBonus}
          currency={currency}
          badge={flags.temperatureFahrenheit !== undefined && flags.temperatureFahrenheit < 30 
            ? `${flags.temperatureFahrenheit}°F` 
            : undefined}
          isActive={true}
        />
      )}

      {flags.lateNightBonusApplied && (
        <BonusLine
          icon={Moon}
          label="Late Night (12-3 AM)"
          amount={breakdown.lateNightBonus}
          currency={currency}
          isActive={true}
        />
      )}

      {!hasAnyBonus && !showQuestProgress && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          No active bonuses for this ride
        </div>
      )}

      {hasAnyBonus && (
        <div className="border-t border-border mt-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">Total Bonuses</span>
            </div>
            <span
              className="text-sm font-bold text-green-600 dark:text-green-400"
              data-testid="text-total-bonuses"
            >
              +{formatCurrency(breakdown.totalIncentivePayout, currency)}
            </span>
          </div>
        </div>
      )}

      {driverEarningsBase !== undefined && totalDriverPayout !== undefined && (
        <div className="border-t border-border mt-3 pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Base Earnings</span>
            <span data-testid="text-base-earnings">{formatCurrency(driverEarningsBase, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold">Total Payout</span>
            </div>
            <span
              className="text-base font-bold text-green-600 dark:text-green-400"
              data-testid="text-total-payout"
            >
              {formatCurrency(totalDriverPayout, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function DriverBonuses({
  breakdown,
  flags,
  questProgress,
  driverEarningsBase,
  totalDriverPayout,
  currency = "USD",
  className = "",
  alwaysExpanded = false,
  showQuestProgress = true,
}: DriverBonusesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasAnyBonus = breakdown.totalIncentivePayout > 0;

  if (alwaysExpanded) {
    return (
      <Card className={className} data-testid="driver-bonuses-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
            Driver Bonuses
            {hasAnyBonus && (
              <Badge variant="secondary" className="ml-auto" data-testid="badge-bonus-count">
                +{formatCurrency(breakdown.totalIncentivePayout, currency)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BonusesContent
            breakdown={breakdown}
            flags={flags}
            questProgress={questProgress}
            driverEarningsBase={driverEarningsBase}
            totalDriverPayout={totalDriverPayout}
            currency={currency}
            showQuestProgress={showQuestProgress}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card data-testid="driver-bonuses-accordion">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover-elevate"
            data-testid="button-toggle-bonuses"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Gift className={`h-4 w-4 ${hasAnyBonus ? "text-green-600 dark:text-green-400" : ""}`} />
              Driver Bonuses
              {hasAnyBonus && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-quick-total">
                  +{formatCurrency(breakdown.totalIncentivePayout, currency)}
                </Badge>
              )}
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <BonusesContent
              breakdown={breakdown}
              flags={flags}
              questProgress={questProgress}
              driverEarningsBase={driverEarningsBase}
              totalDriverPayout={totalDriverPayout}
              currency={currency}
              showQuestProgress={showQuestProgress}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function DriverBonusesSummary({
  breakdown,
  flags,
  currency = "USD",
  className = "",
}: {
  breakdown: IncentiveBreakdown;
  flags: IncentiveFlags;
  currency?: string;
  className?: string;
}) {
  const activeBonuses: { icon: typeof Gift; label: string; amount: number }[] = [];

  if (flags.boostActive && breakdown.boostZoneBonus > 0) {
    activeBonuses.push({ icon: Zap, label: "Boost", amount: breakdown.boostZoneBonus });
  }
  if (flags.airportBonusApplied && breakdown.airportBonus > 0) {
    activeBonuses.push({ icon: Plane, label: "Airport", amount: breakdown.airportBonus });
  }
  if (flags.weatherBonusActive && breakdown.weatherBonus > 0) {
    activeBonuses.push({ icon: CloudRain, label: "Weather", amount: breakdown.weatherBonus });
  }
  if (flags.lateNightBonusApplied && breakdown.lateNightBonus > 0) {
    activeBonuses.push({ icon: Moon, label: "Late Night", amount: breakdown.lateNightBonus });
  }

  if (activeBonuses.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} data-testid="driver-bonuses-summary">
      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
      {activeBonuses.map((bonus, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="gap-1 text-xs"
          data-testid={`badge-summary-${bonus.label.toLowerCase()}`}
        >
          <bonus.icon className="h-3 w-3" />
          +{formatCurrency(bonus.amount, currency)}
        </Badge>
      ))}
    </div>
  );
}

export default DriverBonuses;
