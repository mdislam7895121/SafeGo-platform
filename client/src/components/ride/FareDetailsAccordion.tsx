import { ChevronDown, DollarSign, Clock, MapPin, Receipt, Percent, User, Building2, TrendingUp, Zap, Tag } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

/**
 * Fare breakdown details for display
 * NOTE: safegoCommission and driverEarnings are DRIVER-ONLY fields
 * They should only be populated when showDriverEarnings=true (driver context)
 */
export interface FareBreakdownDetails {
  baseFare: number;
  timeCost: number;
  distanceCost: number;
  bookingFee: number;
  taxesAndSurcharges: number;
  minimumFareAdjustment?: number;
  subtotal: number;
  discountAmount?: number;
  totalFare: number;
  distanceMiles: number;
  durationMinutes: number;
  perMileRate: number;
  perMinuteRate: number;
  promoCode?: string | null;
}

/**
 * Extended breakdown with driver-only fields
 * Use this interface ONLY in driver-facing components
 */
export interface DriverFareBreakdownDetails extends FareBreakdownDetails {
  safegoCommission: number;
  driverEarnings: number;
}

interface FareDetailsAccordionProps {
  breakdown: FareBreakdownDetails | DriverFareBreakdownDetails;
  className?: string;
  /**
   * Show driver earnings (commission and payout)
   * SECURITY: Must be false for customer-facing UI
   * Only set to true in driver-facing components
   */
  showDriverEarnings?: boolean;
}

export function FareDetailsAccordion({ breakdown, className = "", showDriverEarnings = false }: FareDetailsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const hasDiscount = (breakdown.discountAmount ?? 0) > 0;

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

          {/* Discount/Promo Section */}
          {hasDiscount && (
            <>
              <div className="flex items-center justify-between text-green-600 dark:text-green-400" data-testid="fare-discount">
                <span className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  {breakdown.promoCode ? `Promo (${breakdown.promoCode})` : "Discount applied"}
                </span>
                <span className="font-semibold">-{formatCurrency(breakdown.discountAmount ?? 0)}</span>
              </div>
            </>
          )}

          {/* Driver Earnings Section - ONLY shown for drivers, NEVER for customers */}
          {showDriverEarnings && 'safegoCommission' in breakdown && 'driverEarnings' in breakdown && (
            <>
              <div className="h-px bg-border my-2" />

              <div className="pt-1 space-y-2 text-xs">
                <p className="text-muted-foreground font-medium uppercase tracking-wide">Earnings breakdown</p>
                
                <div className="flex items-center justify-between" data-testid="fare-commission">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Percent className="h-3 w-3" />
                    SafeGo commission (15%)
                  </span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    -{formatCurrency((breakdown as DriverFareBreakdownDetails).safegoCommission)}
                  </span>
                </div>

                <div className="flex items-center justify-between" data-testid="fare-driver-earnings">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3 w-3" />
                    Driver earnings
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency((breakdown as DriverFareBreakdownDetails).driverEarnings)}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="h-px bg-border my-2" />

          <div className="flex items-center justify-between text-base font-bold pt-1" data-testid="fare-total">
            <span>Total {hasDiscount ? "after discount" : "fare"}</span>
            <span className="text-primary">{formatCurrency(breakdown.totalFare)}</span>
          </div>

          {/* You Save Summary */}
          {hasDiscount && (
            <div className="flex items-center justify-center gap-1.5 mt-2 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg" data-testid="fare-savings-summary">
              <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                You save {formatCurrency(breakdown.discountAmount ?? 0)}
              </span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
