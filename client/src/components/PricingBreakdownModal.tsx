import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Clock, MapPin, AlertCircle, Info, Tag, Percent } from "lucide-react";

interface PricingData {
  basePriceMultiplier: number;
  surgeMultiplier: number;
  surgeReason: string | null;
  discountPercent: number;
  activePromotions: Array<{
    id: string;
    title: string;
    description: string | null;
    promoType: string;
    discountPercentage: number | null;
    discountValue: number | null;
    minOrderAmount: number | null;
    maxDiscountCap: number | null;
    timeWindowStart: string | null;
    timeWindowEnd: string | null;
  }>;
  couponEligibility: Array<{
    code: string;
    discountType: string;
    discountPercentage: number | null;
    discountValue: number | null;
    minOrderAmount: number | null;
    maxDiscountCap: number | null;
  }>;
  prepTimeMinutes: number | null;
  realTimeOpenStatus: boolean;
  deliveryZoneEligible: boolean;
  throttlingLimitReached: boolean;
  dynamicPricingBreakdown: {
    basePrice: number;
    surgeMultiplier: number;
    surgeAmount: number;
    subtotalAfterSurge: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
    appliedPromotions: string[];
    appliedCoupons: string[];
  };
}

interface PricingBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricingData: PricingData | null;
  restaurantName: string;
}

export function PricingBreakdownModal({
  open,
  onOpenChange,
  pricingData,
  restaurantName,
}: PricingBreakdownModalProps) {
  if (!pricingData) return null;

  const { surgeMultiplier, surgeReason, discountPercent, activePromotions, couponEligibility, dynamicPricingBreakdown } = pricingData;

  // Determine surge indicator color
  const getSurgeIndicator = () => {
    if (surgeMultiplier <= 1.0) {
      return { color: "green", label: "Normal Pricing", variant: "default" as const, icon: TrendingDown };
    } else if (surgeMultiplier <= 1.2) {
      return { color: "yellow", label: "Mild Surge", variant: "secondary" as const, icon: TrendingUp };
    } else {
      return { color: "red", label: "Heavy Surge", variant: "destructive" as const, icon: TrendingUp };
    }
  };

  const surgeIndicator = getSurgeIndicator();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-pricing-breakdown">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-modal-title">
            <Info className="h-5 w-5" />
            Pricing Breakdown - {restaurantName}
          </DialogTitle>
          <DialogDescription data-testid="text-modal-description">
            See how your order price is calculated with real-time surge pricing and available discounts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Surge Pricing Indicator */}
          <Card data-testid="card-surge-indicator">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <surgeIndicator.icon
                    className={`h-6 w-6 ${
                      surgeIndicator.color === "green"
                        ? "text-green-600"
                        : surgeIndicator.color === "yellow"
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                    data-testid="icon-surge-indicator"
                  />
                  <div>
                    <h3 className="font-semibold" data-testid="text-surge-label">
                      {surgeIndicator.label}
                    </h3>
                    {surgeReason && (
                      <p className="text-sm text-muted-foreground" data-testid="text-surge-reason">
                        Reason: {surgeReason === "peak_hours" ? "Peak Hours" : surgeReason === "weekend" ? "Weekend" : surgeReason}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={surgeIndicator.variant} className="text-lg px-4 py-1" data-testid="badge-surge-multiplier">
                  {surgeMultiplier}x
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Active Promotions */}
          {activePromotions.length > 0 && (
            <Card data-testid="card-active-promotions">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold" data-testid="text-promotions-heading">
                    Active Promotions
                  </h3>
                </div>
                <div className="space-y-2">
                  {activePromotions.map((promo, idx) => (
                    <div
                      key={promo.id}
                      className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                      data-testid={`promo-${idx}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-green-900 dark:text-green-200" data-testid={`text-promo-title-${idx}`}>
                            {promo.title}
                          </h4>
                          {promo.description && (
                            <p className="text-sm text-green-800 dark:text-green-300 mt-1" data-testid={`text-promo-description-${idx}`}>
                              {promo.description}
                            </p>
                          )}
                          {promo.timeWindowStart && promo.timeWindowEnd && (
                            <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 mt-1" data-testid={`text-promo-time-${idx}`}>
                              <Clock className="h-3 w-3" />
                              Valid: {promo.timeWindowStart} - {promo.timeWindowEnd}
                            </div>
                          )}
                        </div>
                        {promo.discountPercentage && (
                          <Badge variant="secondary" className="ml-2" data-testid={`badge-promo-discount-${idx}`}>
                            {promo.discountPercentage}% OFF
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Coupons */}
          {couponEligibility.length > 0 && (
            <Card data-testid="card-available-coupons">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Percent className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold" data-testid="text-coupons-heading">
                    Available Coupon Codes
                  </h3>
                </div>
                <div className="space-y-2">
                  {couponEligibility.map((coupon, idx) => (
                    <div
                      key={coupon.code}
                      className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
                      data-testid={`coupon-${idx}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <code className="text-sm font-mono font-bold text-blue-900 dark:text-blue-200" data-testid={`text-coupon-code-${idx}`}>
                            {coupon.code}
                          </code>
                          {coupon.minOrderAmount && (
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1" data-testid={`text-coupon-min-${idx}`}>
                              Min. order: ${Number(coupon.minOrderAmount).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900" data-testid={`badge-coupon-discount-${idx}`}>
                          {coupon.discountType === "percentage"
                            ? `${coupon.discountPercentage}% OFF`
                            : `$${Number(coupon.discountValue).toFixed(2)} OFF`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Breakdown Example */}
          <Card data-testid="card-pricing-calculation">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4" data-testid="text-calculation-heading">
                How Your Price is Calculated
              </h3>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-calculation-description">
                Example calculation for a ${dynamicPricingBreakdown.basePrice.toFixed(2)} order:
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between" data-testid="row-base-price">
                  <span className="text-sm">Base Price</span>
                  <span className="font-medium">${dynamicPricingBreakdown.basePrice.toFixed(2)}</span>
                </div>

                {surgeMultiplier > 1.0 && (
                  <>
                    <div className="flex justify-between text-orange-700 dark:text-orange-400" data-testid="row-surge-amount">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Surge ({surgeMultiplier}x)
                      </span>
                      <span className="font-medium">+${dynamicPricingBreakdown.surgeAmount.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium" data-testid="row-subtotal-after-surge">
                      <span className="text-sm">Subtotal After Surge</span>
                      <span>${dynamicPricingBreakdown.subtotalAfterSurge.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {discountPercent > 0 && (
                  <>
                    <div className="flex justify-between text-green-700 dark:text-green-400" data-testid="row-discount-amount">
                      <span className="text-sm flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Discount ({discountPercent}%)
                      </span>
                      <span className="font-medium">-${dynamicPricingBreakdown.discountAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <Separator />
                
                <div className="flex justify-between text-lg font-bold" data-testid="row-final-price">
                  <span>Estimated Final Price</span>
                  <span className="text-primary">${dynamicPricingBreakdown.finalPrice.toFixed(2)}</span>
                </div>
              </div>

              {dynamicPricingBreakdown.appliedPromotions.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg" data-testid="card-applied-promotions">
                  <p className="text-xs text-muted-foreground">
                    Applied: {dynamicPricingBreakdown.appliedPromotions.join(", ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card data-testid="card-additional-info">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p data-testid="text-info-1">
                    • Surge pricing helps balance supply and demand during busy times
                  </p>
                  <p data-testid="text-info-2">
                    • Discounts are applied after surge pricing calculation
                  </p>
                  <p data-testid="text-info-3">
                    • Final prices may vary based on your actual order items
                  </p>
                  <p data-testid="text-info-4">
                    • Coupon codes can be applied at checkout for additional savings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
