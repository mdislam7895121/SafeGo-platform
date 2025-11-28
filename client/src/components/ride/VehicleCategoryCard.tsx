/**
 * VehicleCategoryCard Component
 * 
 * C3 - Rider Vehicle Category UI
 * Displays a single vehicle category option with pricing, availability status,
 * and selection state. Follows Uber-style design patterns.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Car, 
  Users, 
  Clock, 
  Check, 
  Tag, 
  Accessibility, 
  Crown, 
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { 
  type VehicleCategoryId, 
  type VehicleCategoryConfig,
} from "@shared/vehicleCategories";

export type CategoryAvailability = "available" | "limited" | "unavailable";

export interface VehicleCategoryCardProps {
  categoryId: VehicleCategoryId;
  config: VehicleCategoryConfig;
  fare: number | null;
  originalFare?: number;
  currency: string;
  isSelected: boolean;
  isLoading: boolean;
  availability: CategoryAvailability;
  unavailableReason?: string;
  promoCode?: string;
  promoDiscount?: number;
  etaMinutes: number;
  onSelect: (categoryId: VehicleCategoryId) => void;
  variant?: "card" | "pill";
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCategoryIcon(iconType: VehicleCategoryConfig["iconType"]) {
  switch (iconType) {
    case "economy":
      return Car;
    case "comfort":
      return Sparkles;
    case "xl":
      return Users;
    case "premium":
      return Crown;
    case "suv":
      return Car;
    case "accessible":
      return Accessibility;
    default:
      return Car;
  }
}

export function VehicleCategoryCard({
  categoryId,
  config,
  fare,
  originalFare,
  currency,
  isSelected,
  isLoading,
  availability,
  unavailableReason,
  promoCode,
  promoDiscount = 0,
  etaMinutes,
  onSelect,
  variant = "card",
}: VehicleCategoryCardProps) {
  const Icon = getCategoryIcon(config.iconType);
  const isUnavailable = availability === "unavailable";
  const isLimited = availability === "limited";
  const hasPromo = promoDiscount > 0 && promoCode;
  
  const finalFare = fare !== null ? Math.max(0, fare - promoDiscount) : null;
  const showStrikethrough = hasPromo && originalFare && originalFare > (finalFare ?? 0);

  const handleClick = () => {
    if (!isUnavailable && !isLoading) {
      onSelect(categoryId);
    }
  };

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isUnavailable || isLoading}
        className={`
          flex-shrink-0 snap-start flex flex-col items-center gap-1 
          rounded-xl border px-3 py-2.5 min-w-[80px] transition-all
          ${isSelected 
            ? "bg-primary text-primary-foreground border-primary" 
            : isUnavailable 
              ? "bg-muted/50 border-border text-muted-foreground opacity-50 cursor-not-allowed"
              : "bg-background border-border hover-elevate cursor-pointer"
          }
        `}
        data-testid={`category-pill-${categoryId}`}
      >
        <div className="relative">
          <Icon className="h-5 w-5" />
          {isSelected && hasPromo && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
          )}
          {isUnavailable && (
            <div className="absolute -top-1 -right-1">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="text-[10px] sm:text-xs font-medium whitespace-nowrap">
          {config.displayName.replace("SafeGo ", "")}
        </span>
        {isLoading ? (
          <Skeleton className="h-3 w-10" />
        ) : fare !== null ? (
          <span className={`text-[10px] font-bold ${hasPromo ? "text-green-600 dark:text-green-400" : ""}`}>
            {formatCurrency(finalFare ?? 0, currency)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">--</span>
        )}
        {isUnavailable && (
          <span className="text-[8px] text-muted-foreground">Unavailable</span>
        )}
      </button>
    );
  }

  return (
    <Card
      className={`
        transition-all
        ${isSelected 
          ? "ring-2 ring-primary border-primary" 
          : isUnavailable 
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover-elevate"
        }
      `}
      onClick={handleClick}
      data-testid={`category-card-${categoryId}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
            isSelected 
              ? "bg-primary text-primary-foreground" 
              : isUnavailable 
                ? "bg-muted/50 text-muted-foreground"
                : "bg-muted"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-sm ${isUnavailable ? "text-muted-foreground" : ""}`}>
                {config.displayName}
              </h3>
              {config.isPopular && !isUnavailable && (
                <Badge variant="secondary" className="text-[9px]">Popular</Badge>
              )}
              {isLimited && (
                <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600 dark:text-amber-400">
                  Limited
                </Badge>
              )}
              {isSelected && hasPromo && (
                <Badge 
                  variant="outline" 
                  className="text-[9px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                  data-testid={`promo-badge-${categoryId}`}
                >
                  <Tag className="h-2.5 w-2.5 mr-1" />
                  {promoCode}
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {isUnavailable 
                ? unavailableReason || "Currently unavailable" 
                : config.shortDescription
              }
            </p>
            
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {etaMinutes} min
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {config.seatCount}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            {isLoading ? (
              <Skeleton className="h-5 w-14" />
            ) : fare !== null ? (
              <>
                {showStrikethrough && originalFare && (
                  <span className="text-[10px] text-muted-foreground line-through block">
                    {formatCurrency(originalFare, currency)}
                  </span>
                )}
                <p className={`font-bold ${
                  isUnavailable 
                    ? "text-muted-foreground" 
                    : hasPromo 
                      ? "text-green-600 dark:text-green-400" 
                      : ""
                }`}>
                  {formatCurrency(finalFare ?? 0, currency)}
                </p>
              </>
            ) : (
              <span className="text-muted-foreground">--</span>
            )}
          </div>
          
          {isSelected && !isUnavailable && (
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VehicleCategoryCardSkeleton({ variant = "card" }: { variant?: "card" | "pill" }) {
  if (variant === "pill") {
    return (
      <div className="flex-shrink-0 snap-start flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 min-w-[80px] bg-muted/30">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-10" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      </CardContent>
    </Card>
  );
}
