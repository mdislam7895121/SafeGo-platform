import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, Tag, Sparkles, Wallet, Star, Gift } from "lucide-react";

export type PromoType = "PROMO_APPLIED" | "SAVER" | "FIRST_RIDE" | "WALLET" | "NONE";

export interface PromoFareCardProps {
  rideType: string;
  etaMinutes: number;
  finalFare: number;
  anchorFare: number;
  savedAmount: number;
  promoType: PromoType;
  currency?: string;
  className?: string;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const PROMO_BADGE_CONFIG: Record<PromoType, { label: string; className: string; icon: typeof Tag } | null> = {
  PROMO_APPLIED: {
    label: "Promo applied",
    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
    icon: Tag,
  },
  SAVER: {
    label: "Saver",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: Sparkles,
  },
  FIRST_RIDE: {
    label: "Welcome ride",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    icon: Star,
  },
  WALLET: {
    label: "Wallet bonus",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    icon: Wallet,
  },
  NONE: null,
};

export function PromoFareCard({
  rideType,
  etaMinutes,
  finalFare,
  anchorFare,
  savedAmount,
  promoType,
  currency = "USD",
  className = "",
}: PromoFareCardProps) {
  const promoBadge = PROMO_BADGE_CONFIG[promoType];
  const hasDiscount = anchorFare > finalFare && savedAmount > 0;
  const PromoIcon = promoBadge?.icon || Tag;

  return (
    <Card className={`overflow-hidden ${className}`} data-testid="promo-fare-card">
      <CardContent className="p-4 sm:p-5 lg:p-6">
        {/* Header Row - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          {/* Left: Ride Type + ETA */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-semibold" data-testid="promo-ride-type">
                {rideType}
              </h3>
              <span className="text-muted-foreground text-sm sm:text-base flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {etaMinutes}-{etaMinutes + 4} min
              </span>
            </div>
            
            {/* Promo Badge - Shown inline on desktop, stacked on mobile */}
            {promoBadge && (
              <div className="mt-2 sm:mt-3">
                <Badge 
                  variant="outline" 
                  className={`text-xs sm:text-sm px-2.5 py-1 ${promoBadge.className}`}
                  data-testid="promo-badge"
                >
                  <PromoIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                  {promoBadge.label}
                </Badge>
              </div>
            )}
          </div>

          {/* Right: Price Section */}
          <div className="flex flex-col items-start sm:items-end">
            {/* Anchor Price (strikethrough) */}
            {hasDiscount && (
              <span 
                className="text-sm text-muted-foreground line-through"
                data-testid="promo-anchor-fare"
              >
                Was {formatCurrency(anchorFare, currency)}
              </span>
            )}
            
            {/* Final Price - Large and Bold */}
            <p 
              className={`text-2xl sm:text-3xl font-bold ${hasDiscount ? "text-green-600 dark:text-green-400" : ""}`}
              data-testid="promo-final-fare"
            >
              {formatCurrency(finalFare, currency)}
            </p>
            
            {/* Savings Message */}
            {hasDiscount && (
              <p 
                className="text-sm font-medium text-green-600 dark:text-green-400 mt-0.5"
                data-testid="promo-saved-amount"
              >
                You saved {formatCurrency(savedAmount, currency)}
              </p>
            )}
          </div>
        </div>

        {/* Reassurance Text */}
        <div className="mt-4 pt-4 border-t border-border/50 space-y-1.5">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
            Includes taxes, tolls, and city fees where applicable.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2">
            <Gift className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            No surprise charges at the end.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default PromoFareCard;
