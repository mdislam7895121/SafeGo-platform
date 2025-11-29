import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Car,
  UtensilsCrossed,
  Package,
  MapPin,
  Clock,
  Navigation,
  DollarSign,
  Percent,
  Tag,
  Building2,
  Info,
  CheckCircle2,
  Wallet,
  AlertCircle,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DriverTripEarningsView } from "@shared/driverEarningsTypes";

interface EarningsResponse {
  earnings: DriverTripEarningsView;
  kycStatus: string;
  kycApproved: boolean;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function EarningsRow({ 
  label, 
  amount, 
  isNegative = false,
  isHighlight = false,
  isBold = false,
  note,
}: { 
  label: string; 
  amount: number | null | undefined;
  isNegative?: boolean;
  isHighlight?: boolean;
  isBold?: boolean;
  note?: string;
}) {
  const displayAmount = amount || 0;
  const formattedAmount = formatCurrency(Math.abs(displayAmount));
  
  return (
    <div className="flex items-start justify-between py-2">
      <div className="flex-1">
        <span className={`text-sm ${isBold ? "font-semibold" : ""} ${isHighlight ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        {note && (
          <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
        )}
      </div>
      <span className={`text-sm font-medium ${
        isNegative ? "text-red-600 dark:text-red-400" : 
        isHighlight ? "text-green-600 dark:text-green-400 font-bold" : 
        "text-foreground"
      }`}>
        {isNegative && displayAmount > 0 ? "-" : ""}{formattedAmount}
      </span>
    </div>
  );
}

function SectionHeader({ 
  title, 
  icon: Icon,
  subtitle,
}: { 
  title: string; 
  icon?: typeof DollarSign;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mt-3 p-2 bg-muted/50 rounded-md">
      <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

export default function DriverTripEarnings() {
  const { tripId } = useParams<{ tripId: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const serviceType = searchParams.get("serviceType");

  const { data, isLoading, error } = useQuery<EarningsResponse>({
    queryKey: ["/api/driver/trips", tripId, "earnings"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (serviceType) {
        params.set("serviceType", serviceType);
      }
      const response = await fetch(`/api/driver/trips/${tripId}/earnings?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch earnings");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !data?.earnings) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">Unable to Load Earnings</h3>
              <p className="text-muted-foreground mb-6">
                {error instanceof Error ? error.message : "We couldn't load the earnings breakdown for this trip."}
              </p>
              <Link href="/driver/trips">
                <Button data-testid="button-back-to-trips">Back to Trip History</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const e = data.earnings;
  
  const serviceIcons = {
    RIDE: Car,
    FOOD: UtensilsCrossed,
    PARCEL: Package,
  };
  const ServiceIcon = serviceIcons[e.serviceType] || Car;

  const hasRegulatory = e.hasRegulatoryFees === true || e.regulatoryFeesTotal > 0;
  const hasPromo = e.promoDiscountAmount > 0;
  const hasTip = (e.tipAmount || 0) > 0;
  const hasTolls = (e.tollsAmount || 0) > 0;
  const hasDeliveryFee = (e.deliveryFee || 0) > 0;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/driver/trips/${tripId}${serviceType ? `?serviceType=${serviceType}` : ""}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Earnings Breakdown</h1>
          <div className="w-10" />
        </div>

        <Card data-testid="card-trip-header">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ServiceIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-base">{e.categoryLabel}</h2>
                <p className="text-sm text-muted-foreground">
                  {e.borough ? `${e.borough}, ` : ""}{e.city}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {e.tripCode}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5" />
                {e.tripDistance.toFixed(1)} {e.tripDistanceUnit}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {e.tripDurationMinutes} min
              </span>
              {e.customerRating && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {e.customerRating}
                </span>
              )}
            </div>

            <div className="mt-4 pt-4 border-t space-y-1">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <p className="text-sm line-clamp-1">{e.pickupAddress}</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <p className="text-sm line-clamp-1">{e.dropoffAddress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-rider-paid">
          <CardContent className="p-4">
            <SectionHeader title="Rider paid" icon={DollarSign} />
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-foreground" data-testid="text-rider-paid-total">
                {formatCurrency(e.riderPaidTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This is the total amount charged to the rider for this trip.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-fare-details">
          <CardContent className="p-4">
            <SectionHeader 
              title="Fare details" 
              subtitle="Before promotions and fees"
            />
            <div className="divide-y">
              <EarningsRow label="Base fare" amount={e.baseFare} />
              <EarningsRow label="Distance fare" amount={e.distanceFare} />
              <EarningsRow label="Time fare" amount={e.timeFare} />
              {e.surgeAmount > 0 && (
                <EarningsRow label="Surge pricing" amount={e.surgeAmount} />
              )}
              {e.bookingFee > 0 && (
                <EarningsRow label="Booking fee" amount={e.bookingFee} />
              )}
              {hasDeliveryFee && (
                <EarningsRow label="Delivery fee" amount={e.deliveryFee} />
              )}
              {e.otherServiceFees > 0 && (
                <EarningsRow label="Other service fees" amount={e.otherServiceFees} />
              )}
              {hasTolls && (
                <EarningsRow label="Tolls" amount={e.tollsAmount} />
              )}
              {hasTip && (
                <EarningsRow label="Tip" amount={e.tipAmount} isHighlight />
              )}
            </div>
          </CardContent>
        </Card>

        {hasRegulatory && (
          <Card data-testid="card-regulatory-fees">
            <CardContent className="p-4">
              <SectionHeader 
                title="Regulatory & TLC fees" 
                icon={Building2}
                subtitle="Pass-through fees"
              />
              <div className="divide-y">
                {e.regulatoryBreakdown.congestion !== undefined && e.regulatoryBreakdown.congestion > 0 && (
                  <EarningsRow label="Congestion fee" amount={e.regulatoryBreakdown.congestion} />
                )}
                {e.regulatoryBreakdown.airportFee !== undefined && e.regulatoryBreakdown.airportFee > 0 && (
                  <EarningsRow label="Airport fee" amount={e.regulatoryBreakdown.airportFee} />
                )}
                {e.regulatoryBreakdown.stateSurcharge !== undefined && e.regulatoryBreakdown.stateSurcharge > 0 && (
                  <EarningsRow label="State surcharge" amount={e.regulatoryBreakdown.stateSurcharge} />
                )}
                {e.regulatoryBreakdown.hvfSurcharge !== undefined && e.regulatoryBreakdown.hvfSurcharge > 0 && (
                  <EarningsRow label="HVF surcharge" amount={e.regulatoryBreakdown.hvfSurcharge} />
                )}
                {e.regulatoryBreakdown.blackCarFund !== undefined && e.regulatoryBreakdown.blackCarFund > 0 && (
                  <EarningsRow label="Black Car Fund" amount={e.regulatoryBreakdown.blackCarFund} />
                )}
                {e.regulatoryBreakdown.tolls !== undefined && e.regulatoryBreakdown.tolls > 0 && (
                  <EarningsRow label="Tolls" amount={e.regulatoryBreakdown.tolls} />
                )}
                {e.regulatoryBreakdown.longTripFee !== undefined && e.regulatoryBreakdown.longTripFee > 0 && (
                  <EarningsRow label="Long trip fee" amount={e.regulatoryBreakdown.longTripFee} />
                )}
                {e.regulatoryBreakdown.outOfTownFee !== undefined && e.regulatoryBreakdown.outOfTownFee > 0 && (
                  <EarningsRow label="Out-of-town fee" amount={e.regulatoryBreakdown.outOfTownFee} />
                )}
                {e.regulatoryBreakdown.crossBoroughFee !== undefined && e.regulatoryBreakdown.crossBoroughFee > 0 && (
                  <EarningsRow label="Cross-borough fee" amount={e.regulatoryBreakdown.crossBoroughFee} />
                )}
                {e.regulatoryBreakdown.other !== undefined && e.regulatoryBreakdown.other > 0 && (
                  <EarningsRow label="Other regulatory" amount={e.regulatoryBreakdown.other} />
                )}
                <div className="pt-2 mt-2 border-t">
                  <EarningsRow label="Total regulatory fees" amount={e.regulatoryFeesTotal} isBold />
                </div>
              </div>
              <SectionNote>
                These amounts go to the government or regulators, not to SafeGo or the driver.
              </SectionNote>
            </CardContent>
          </Card>
        )}

        {hasPromo && (
          <Card data-testid="card-promo">
            <CardContent className="p-4">
              <SectionHeader title="Promotion" icon={Tag} />
              <div className="divide-y">
                {e.promoCode && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Promo code</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                      {e.promoCode}
                    </Badge>
                  </div>
                )}
                <EarningsRow 
                  label="Rider discount" 
                  amount={e.promoDiscountAmount} 
                  isNegative 
                />
              </div>
              <SectionNote>
                This is the discount the rider received. SafeGo covers this cost.
              </SectionNote>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-safego-fee">
          <CardContent className="p-4">
            <SectionHeader title="SafeGo fee" icon={Percent} />
            <div className="divide-y">
              <EarningsRow 
                label={`Platform commission (${e.platformCommissionPercent}%)`}
                amount={e.platformCommissionAmount}
                isNegative
              />
            </div>
            <SectionNote>
              This is SafeGo's commission for providing the platform, insurance, support, and operations.
            </SectionNote>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800" data-testid="card-your-earnings">
          <CardContent className="p-4">
            <SectionHeader title="Your earnings" icon={Wallet} />
            
            <div className="text-center py-4 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
              <p className="text-xs text-muted-foreground mb-1">Your net earnings</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-driver-earnings">
                {formatCurrency(e.driverEarningsNet)}
              </p>
            </div>

            {e.driverIncentivesAmount > 0 && (
              <div className="divide-y mb-4">
                <EarningsRow 
                  label="Incentives / Bonuses" 
                  amount={e.driverIncentivesAmount} 
                  isHighlight
                />
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Final payout</span>
                <span className="font-bold text-lg text-green-600 dark:text-green-400" data-testid="text-final-payout">
                  {formatCurrency(e.driverEarningsNet + e.driverIncentivesAmount)}
                </span>
              </div>
            </div>

            <Alert className="mt-4 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-xs text-muted-foreground">
                You earn this amount after regulatory fees and SafeGo's commission are applied. 
                This is the amount that will be added to your payout balance.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Trip started: {format(new Date(e.tripStartTime), "MMM d, yyyy h:mm a")}</span>
          {e.tripEndTime && (
            <span>Completed: {format(new Date(e.tripEndTime), "h:mm a")}</span>
          )}
        </div>

        <div className="pt-4">
          <Link href="/driver/trips">
            <Button variant="outline" className="w-full" data-testid="button-back-to-history">
              Back to Trip History
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
