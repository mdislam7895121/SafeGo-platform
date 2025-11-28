import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Ruler, Tag, Sparkles, Wallet, Star, Check, Zap, DollarSign, Navigation } from "lucide-react";
import type { PromoType } from "./PromoFareCard";

export interface RouteOption {
  id: string;
  label: string;
  etaMinutes: number;
  distanceMiles: number;
  finalFare: number;
  promoType: PromoType;
  isSelected: boolean;
}

export interface RouteOptionCardProps {
  route: RouteOption;
  onSelect: (route: RouteOption) => void;
  currency?: string;
  variant?: "compact" | "full";
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const ROUTE_ICON_MAP: Record<string, typeof Zap> = {
  Fastest: Zap,
  Cheapest: DollarSign,
  "Less traffic": Navigation,
  Recommended: Star,
};

const PROMO_BADGE_MINI: Record<PromoType, { label: string; className: string } | null> = {
  PROMO_APPLIED: {
    label: "Promo",
    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  SAVER: {
    label: "Saver",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  FIRST_RIDE: {
    label: "Welcome",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  WALLET: {
    label: "Wallet",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  NONE: null,
};

export function RouteOptionCard({
  route,
  onSelect,
  currency = "USD",
  variant = "compact",
}: RouteOptionCardProps) {
  const RouteIcon = ROUTE_ICON_MAP[route.label] || Navigation;
  const promoBadge = PROMO_BADGE_MINI[route.promoType];

  if (variant === "compact") {
    return (
      <Card
        className={`cursor-pointer transition-all snap-start flex-shrink-0 w-[140px] sm:w-[160px] ${
          route.isSelected
            ? "ring-2 ring-primary border-primary bg-primary/5"
            : "hover-elevate"
        }`}
        onClick={() => onSelect(route)}
        data-testid={`route-card-${route.id}`}
      >
        <div className="p-3">
          {/* Label with Icon */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className={`h-6 w-6 rounded-md flex items-center justify-center ${
              route.isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}>
              <RouteIcon className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium text-xs sm:text-sm truncate">{route.label}</span>
            {route.isSelected && (
              <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />
            )}
          </div>

          {/* ETA and Distance */}
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {route.etaMinutes} min
            </span>
            <span className="flex items-center gap-0.5">
              <Ruler className="h-3 w-3" />
              {route.distanceMiles} mi
            </span>
          </div>

          {/* Price */}
          <p className={`font-bold text-sm sm:text-base ${route.isSelected ? "text-primary" : ""}`}>
            {formatCurrency(route.finalFare, currency)}
          </p>

          {/* Mini Promo Badge */}
          {promoBadge && (
            <Badge 
              variant="secondary" 
              className={`text-[9px] mt-1.5 ${promoBadge.className}`}
            >
              <Tag className="h-2 w-2 mr-0.5" />
              {promoBadge.label}
            </Badge>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`cursor-pointer transition-all ${
        route.isSelected
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "hover-elevate"
      }`}
      onClick={() => onSelect(route)}
      data-testid={`route-card-full-${route.id}`}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            route.isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}>
            <RouteIcon className="h-5 w-5" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm sm:text-base">{route.label}</span>
              {promoBadge && (
                <Badge 
                  variant="secondary" 
                  className={`text-[9px] sm:text-[10px] ${promoBadge.className}`}
                >
                  {promoBadge.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {route.etaMinutes} min
              </span>
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                {route.distanceMiles} mi
              </span>
            </div>
          </div>

          {/* Price + Selected Check */}
          <div className="text-right flex items-center gap-2">
            <p className={`font-bold text-base sm:text-lg ${route.isSelected ? "text-primary" : ""}`}>
              {formatCurrency(route.finalFare, currency)}
            </p>
            {route.isSelected && (
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export interface RouteOptionsBarProps {
  routes: RouteOption[];
  onSelectRoute: (route: RouteOption) => void;
  currency?: string;
  className?: string;
}

export function RouteOptionsBar({
  routes,
  onSelectRoute,
  currency = "USD",
  className = "",
}: RouteOptionsBarProps) {
  return (
    <div className={className}>
      {/* Mobile: Horizontal Scroll */}
      <div className="lg:hidden">
        <p className="text-sm font-medium mb-2 px-1">Route Options</p>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {routes.map((route) => (
            <RouteOptionCard
              key={route.id}
              route={route}
              onSelect={onSelectRoute}
              currency={currency}
              variant="compact"
            />
          ))}
        </div>
      </div>

      {/* Desktop: Vertical List */}
      <div className="hidden lg:block space-y-2">
        <p className="text-sm font-medium mb-3">Route Options</p>
        {routes.map((route) => (
          <RouteOptionCard
            key={route.id}
            route={route}
            onSelect={onSelectRoute}
            currency={currency}
            variant="full"
          />
        ))}
      </div>
    </div>
  );
}

export default RouteOptionCard;
