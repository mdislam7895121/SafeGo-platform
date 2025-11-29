import { ChevronDown, DollarSign, Clock, MapPin, Receipt, Percent, User, Building2, TrendingUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export interface FareBreakdownDetails {
  baseFare: number;
  timeCost: number;
  distanceCost: number;
  bookingFee: number;
  taxesAndSurcharges: number;
  minimumFareAdjustment?: number;
  subtotal: number;
  safegoCommission: number;
  driverEarnings: number;
  totalFare: number;
  distanceMiles: number;
  durationMinutes: number;
  perMileRate: number;
  perMinuteRate: number;
}

interface FareDetailsAccordionProps {
  breakdown: FareBreakdownDetails;
  className?: string;
}

export function FareDetailsAccordion({ breakdown, className = "" }: FareDetailsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger 
        className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-fare-details-toggle"
      >
        <span className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5" />
          Fare details
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-2 space-y-3" data-testid="fare-details-content">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between" data-testid="fare-base">
            <span className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              Base fare
            </span>
            <span className="font-medium">{formatCurrency(breakdown.baseFare)}</span>
          </div>

          <div className="flex items-center justify-between" data-testid="fare-time">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Time ({breakdown.durationMinutes} min × {formatCurrency(breakdown.perMinuteRate)})
            </span>
            <span className="font-medium">{formatCurrency(breakdown.timeCost)}</span>
          </div>

          <div className="flex items-center justify-between" data-testid="fare-distance">
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Distance ({breakdown.distanceMiles.toFixed(1)} mi × {formatCurrency(breakdown.perMileRate)})
            </span>
            <span className="font-medium">{formatCurrency(breakdown.distanceCost)}</span>
          </div>

          <div className="flex items-center justify-between" data-testid="fare-booking-fee">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              Booking fee
            </span>
            <span className="font-medium">{formatCurrency(breakdown.bookingFee)}</span>
          </div>

          <div className="flex items-center justify-between" data-testid="fare-taxes">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              Taxes & surcharges
            </span>
            <span className="font-medium">{formatCurrency(breakdown.taxesAndSurcharges)}</span>
          </div>

          {breakdown.minimumFareAdjustment && breakdown.minimumFareAdjustment > 0 && (
            <div className="flex items-center justify-between" data-testid="fare-minimum-adjustment">
              <span className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Minimum fare adjustment
              </span>
              <span className="font-medium">{formatCurrency(breakdown.minimumFareAdjustment)}</span>
            </div>
          )}

          <div className="h-px bg-border my-2" />

          <div className="flex items-center justify-between font-semibold" data-testid="fare-subtotal">
            <span>Subtotal</span>
            <span>{formatCurrency(breakdown.subtotal)}</span>
          </div>

          <div className="h-px bg-border my-2" />

          <div className="pt-1 space-y-2 text-xs">
            <p className="text-muted-foreground font-medium uppercase tracking-wide">Earnings breakdown</p>
            
            <div className="flex items-center justify-between" data-testid="fare-commission">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Percent className="h-3 w-3" />
                SafeGo commission (15%)
              </span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                -{formatCurrency(breakdown.safegoCommission)}
              </span>
            </div>

            <div className="flex items-center justify-between" data-testid="fare-driver-earnings">
              <span className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3 w-3" />
                Driver earnings
              </span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(breakdown.driverEarnings)}
              </span>
            </div>
          </div>

          <div className="h-px bg-border my-2" />

          <div className="flex items-center justify-between text-base font-bold pt-1" data-testid="fare-total">
            <span>Total fare</span>
            <span className="text-primary">{formatCurrency(breakdown.totalFare)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
