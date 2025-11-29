/**
 * VehicleCategoryCard Component
 * 
 * C7 - SafeGo Ride Card Full Redesign (Branding + Image System + UI Polish)
 * Professional Uber-quality ride cards with SafeGo branding, high-quality
 * vehicle images, and refined price presentation.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Clock, 
  Check, 
  Tag, 
  Zap,
  Accessibility,
  AlertCircle,
} from "lucide-react";
import { 
  type VehicleCategoryId, 
  type VehicleCategoryConfig,
} from "@shared/vehicleCategories";
import { getVehicleCategoryImage } from "@/lib/vehicleMedia";

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
  const isUnavailable = availability === "unavailable";
  const isLimited = availability === "limited";
  const hasPromo = promoDiscount > 0;
  const vehicleImage = getVehicleCategoryImage(categoryId);
  
  const displayFare = fare;
  const finalFare = (hasPromo && isSelected && fare !== null) 
    ? Math.max(0, fare - promoDiscount) 
    : fare;
  const showStrikethrough = hasPromo && isSelected && fare !== null && fare > (finalFare ?? 0);
  const savingsAmount = (hasPromo && isSelected && fare !== null && finalFare !== null) 
    ? fare - finalFare 
    : 0;
  const isWAV = categoryId === "SAFEGO_WAV";

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
          flex-shrink-0 snap-start flex flex-col items-center 
          rounded-[14px] border min-w-[100px] max-w-[110px] transition-all overflow-hidden
          ${isSelected 
            ? "ring-2 ring-primary border-primary bg-background" 
            : isUnavailable 
              ? "bg-muted/50 border-border opacity-50 cursor-not-allowed"
              : "bg-background border-border hover-elevate cursor-pointer"
          }
        `}
        style={{ boxShadow: isSelected ? "0px 4px 14px rgba(0,0,0,0.12)" : "0px 2px 8px rgba(0,0,0,0.06)" }}
        data-testid={`category-pill-${categoryId}`}
      >
        <div 
          className="relative w-full pt-2 px-2"
          style={{
            background: "linear-gradient(180deg, #FFFFFF 40%, #F8F8F8 100%)",
          }}
        >
          <img 
            src={vehicleImage} 
            alt={config.displayName}
            className="w-full h-[48px] object-contain drop-shadow-md"
            style={{ filter: isUnavailable ? "grayscale(1)" : "none" }}
          />
          {isSelected && (
            <div className="absolute top-1 right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
          {isLimited && !isSelected && (
            <Badge 
              className="absolute top-1 left-1 text-[8px] px-1 py-0 h-4 bg-amber-400 text-amber-950 border-0"
            >
              LIMITED
            </Badge>
          )}
        </div>
        
        <div className="w-full px-2 py-2 flex flex-col items-center gap-0.5">
          <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">
            {config.displayName}
          </span>
          
          {isLoading ? (
            <Skeleton className="h-4 w-12" />
          ) : fare !== null ? (
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-foreground">
                {formatCurrency(finalFare ?? 0, currency)}
              </span>
              {showStrikethrough && fare && (
                <span className="text-[9px] text-muted-foreground line-through">
                  {formatCurrency(fare, currency)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">--</span>
          )}
          
          {hasPromo && isSelected && savingsAmount > 0 && !isLoading && (
            <span className="text-[9px] font-medium text-[#16A34A]">
              Save {formatCurrency(savingsAmount, currency)}
            </span>
          )}
          
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
            <Clock className="h-2.5 w-2.5" />
            <span>{etaMinutes} min</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <Card
      className={`
        transition-all rounded-[14px] overflow-hidden
        ${isSelected 
          ? "ring-2 ring-primary border-primary" 
          : isUnavailable 
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover-elevate"
        }
      `}
      style={{ 
        boxShadow: isSelected 
          ? "0px 4px 14px rgba(0,0,0,0.15)" 
          : "0px 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #E5E7EB",
      }}
      onClick={handleClick}
      data-testid={`category-card-${categoryId}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div 
            className="relative w-[100px] h-[70px] rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(180deg, #FFFFFF 40%, #F8F8F8 100%)",
              boxShadow: "0px 4px 14px rgba(0,0,0,0.08)",
            }}
          >
            <img 
              src={vehicleImage} 
              alt={config.displayName}
              className="w-[92%] h-[90%] object-contain"
              style={{ 
                filter: isUnavailable ? "grayscale(1)" : "drop-shadow(0px 4px 8px rgba(0,0,0,0.15))",
              }}
            />
            {isWAV && (
              <div className="absolute bottom-0 right-0 h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center">
                <Accessibility className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-base ${isUnavailable ? "text-muted-foreground" : "text-foreground"}`}>
                {config.displayName}
              </h3>
              {config.isPopular && !isUnavailable && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">
                  Popular
                </Badge>
              )}
              {isLimited && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-400 text-amber-950 border-0">
                  LIMITED
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {isUnavailable 
                ? unavailableReason || "Currently unavailable" 
                : config.shortDescription
              }
            </p>
            
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {etaMinutes} min
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {config.seatCount} seats
              </span>
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end gap-0.5 flex-shrink-0">
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : fare !== null ? (
              <>
                <p className={`text-lg font-bold ${
                  isUnavailable 
                    ? "text-muted-foreground" 
                    : "text-foreground"
                }`}>
                  {formatCurrency(finalFare ?? 0, currency)}
                </p>
                {showStrikethrough && fare && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatCurrency(fare, currency)}
                  </span>
                )}
                {hasPromo && savingsAmount > 0 && (
                  <span className="text-[10px] font-medium text-[#16A34A] flex items-center gap-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    You save {formatCurrency(savingsAmount, currency)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-lg">--</span>
            )}
            
            {hasPromo && promoCode && isSelected && (
              <Badge 
                variant="outline" 
                className="text-[9px] mt-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                data-testid={`promo-badge-${categoryId}`}
              >
                <Tag className="h-2.5 w-2.5 mr-0.5" />
                {promoCode}
              </Badge>
            )}
          </div>
          
          {isSelected && !isUnavailable && (
            <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VehicleCategoryCardSkeleton({ variant = "card" }: { variant?: "card" | "pill" }) {
  if (variant === "pill") {
    return (
      <div 
        className="flex-shrink-0 snap-start flex flex-col items-center rounded-[14px] border min-w-[100px] max-w-[110px] bg-background overflow-hidden"
        style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
      >
        <div className="w-full pt-2 px-2 bg-gradient-to-b from-white to-gray-50">
          <Skeleton className="w-full h-[48px] rounded" />
        </div>
        <div className="w-full px-2 py-2 flex flex-col items-center gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-2 w-10" />
        </div>
      </div>
    );
  }

  return (
    <Card 
      className="rounded-[14px] overflow-hidden"
      style={{ 
        boxShadow: "0px 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #E5E7EB",
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-[100px] h-[70px] rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
