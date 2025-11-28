import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Car, 
  Clock, 
  Route, 
  Building2, 
  Percent,
  Receipt,
  Tag,
  Moon,
  TrendingUp,
  MapPin,
  Navigation,
  Shield,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FareBreakdownData {
  tripFare: number;
  trafficAdjustment: number;
  tolls: number;
  cityFees: number;
  serviceFee: number;
  promoDiscount: number;
  totalFare: number;
  nightSurcharge?: number;
  peakHourSurcharge?: number;
  longDistanceFee?: number;
  crossCitySurcharge?: number;
  crossStateSurcharge?: number;
  surgeAmount?: number;
  surgeMultiplier?: number;
  minimumFareApplied?: boolean;
  maximumFareApplied?: boolean;
  originalFare?: number;
  driverMinimumPayoutApplied?: boolean;
}

export interface FareBreakdownProps {
  breakdown: FareBreakdownData;
  currency?: string;
  className?: string;
  alwaysExpanded?: boolean;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface BreakdownLineProps {
  icon: typeof Car;
  label: string;
  amount: number;
  currency: string;
  isDiscount?: boolean;
  isTotal?: boolean;
}

function BreakdownLine({ 
  icon: Icon, 
  label, 
  amount, 
  currency, 
  isDiscount = false,
  isTotal = false,
}: BreakdownLineProps) {
  if (amount === 0 && !isTotal) return null;

  return (
    <div 
      className={`flex items-center justify-between py-2 ${
        isTotal ? "border-t border-border pt-3 mt-1" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isDiscount ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
        <span className={`text-sm ${isTotal ? "font-semibold" : ""}`}>{label}</span>
      </div>
      <span 
        className={`text-sm ${
          isDiscount 
            ? "text-green-600 dark:text-green-400 font-medium" 
            : isTotal 
              ? "font-bold text-base" 
              : ""
        }`}
      >
        {isDiscount ? `-${formatCurrency(amount, currency)}` : formatCurrency(amount, currency)}
      </span>
    </div>
  );
}

function BreakdownContent({ breakdown, currency }: { breakdown: FareBreakdownData; currency: string }) {
  return (
    <div className="space-y-0.5">
      <BreakdownLine 
        icon={Car} 
        label="Trip fare" 
        amount={breakdown.tripFare} 
        currency={currency} 
      />
      <BreakdownLine 
        icon={Clock} 
        label="Traffic adjustment" 
        amount={breakdown.trafficAdjustment} 
        currency={currency} 
      />
      {(breakdown.surgeAmount ?? 0) > 0 && (
        <BreakdownLine 
          icon={TrendingUp} 
          label={`High demand (${breakdown.surgeMultiplier?.toFixed(1) || '1.0'}x)`}
          amount={breakdown.surgeAmount ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.nightSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={Moon} 
          label="Night surcharge (8PM-6AM)" 
          amount={breakdown.nightSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.peakHourSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={Clock} 
          label="Peak hour (rush hour)" 
          amount={breakdown.peakHourSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.longDistanceFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Navigation} 
          label="Long distance fee" 
          amount={breakdown.longDistanceFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.crossCitySurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={MapPin} 
          label="Cross-city surcharge" 
          amount={breakdown.crossCitySurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.crossStateSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={MapPin} 
          label="Cross-state surcharge" 
          amount={breakdown.crossStateSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      <BreakdownLine 
        icon={Route} 
        label="Tolls" 
        amount={breakdown.tolls} 
        currency={currency} 
      />
      <BreakdownLine 
        icon={Building2} 
        label="City & airport fees" 
        amount={breakdown.cityFees} 
        currency={currency} 
      />
      <BreakdownLine 
        icon={Percent} 
        label="SafeGo service fee" 
        amount={breakdown.serviceFee} 
        currency={currency} 
      />
      {breakdown.promoDiscount > 0 && (
        <BreakdownLine 
          icon={Tag} 
          label="Promo discount" 
          amount={breakdown.promoDiscount} 
          currency={currency} 
          isDiscount={true}
        />
      )}
      <BreakdownLine 
        icon={Receipt} 
        label="Total" 
        amount={breakdown.totalFare} 
        currency={currency} 
        isTotal={true}
      />
      {breakdown.minimumFareApplied && (
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Minimum fare applied</span>
        </div>
      )}
      {breakdown.maximumFareApplied && (
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          <span>Fare capped at maximum</span>
        </div>
      )}
    </div>
  );
}

export function FareBreakdown({
  breakdown,
  currency = "USD",
  className = "",
  alwaysExpanded = false,
}: FareBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (alwaysExpanded) {
    return (
      <Card className={className} data-testid="fare-breakdown-card">
        <CardContent className="p-4 sm:p-5">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Fare Details
          </h4>
          <BreakdownContent breakdown={breakdown} currency={currency} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card data-testid="fare-breakdown-accordion">
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
            data-testid="button-toggle-breakdown"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Receipt className="h-4 w-4" />
              View fare details
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
            <BreakdownContent breakdown={breakdown} currency={currency} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default FareBreakdown;
