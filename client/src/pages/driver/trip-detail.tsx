import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Car,
  UtensilsCrossed,
  Package,
  ArrowLeft,
  Calendar,
  Clock,
  Star,
  MapPin,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Receipt,
  Percent,
  Gift,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ServiceType = "RIDE" | "FOOD" | "PARCEL";
type TripStatus = "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | "PENDING" | "ADJUSTED" | "REFUNDED";

interface TripDetailBreakdown {
  id: string;
  serviceType: ServiceType;
  dateTime: string;
  completedAt: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  status: TripStatus;
  baseFare: number;
  deliveryFee: number | null;
  surgeOrBoost: number | null;
  tipAmount: number | null;
  distanceFare: number | null;
  timeFare: number | null;
  promotionBonus: number | null;
  safeGoCommission: number;
  driverEarnings: number;
  paymentMethod: string;
  tripCode: string;
  customerRating: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  restaurantName?: string;
  orderCode?: string;
  adjustments: Array<{
    type: string;
    amount: number;
    reason: string;
    date: string;
  }>;
  supportTicketCount: number;
  lastSupportStatus: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}

interface TripDetailResponse {
  trip: TripDetailBreakdown;
  kycStatus: string;
  kycApproved: boolean;
  kycRequired?: boolean;
  message?: string;
}

const serviceTypeConfig: Record<ServiceType, { icon: typeof Car; label: string; color: string }> = {
  RIDE: { icon: Car, label: "Ride", color: "bg-blue-500" },
  FOOD: { icon: UtensilsCrossed, label: "Food Delivery", color: "bg-orange-500" },
  PARCEL: { icon: Package, label: "Parcel Delivery", color: "bg-purple-500" },
};

const statusConfig: Record<TripStatus, { icon: typeof CheckCircle2; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  COMPLETED: { icon: CheckCircle2, label: "Completed", variant: "default" },
  CANCELLED: { icon: XCircle, label: "Cancelled", variant: "destructive" },
  IN_PROGRESS: { icon: Clock, label: "In Progress", variant: "secondary" },
  PENDING: { icon: Clock, label: "Pending", variant: "outline" },
  ADJUSTED: { icon: AlertCircle, label: "Adjusted", variant: "secondary" },
  REFUNDED: { icon: AlertCircle, label: "Refunded", variant: "destructive" },
};

export default function DriverTripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const [, setLocation] = useLocation();
  
  const searchParams = new URLSearchParams(window.location.search);
  const serviceType = searchParams.get("serviceType");

  const { data, isLoading, refetch, isFetching } = useQuery<TripDetailResponse>({
    queryKey: ["/api/driver/trips", tripId, serviceType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (serviceType) {
        params.set("serviceType", serviceType);
      }
      return apiRequest(`/api/driver/trips/${tripId}?${params.toString()}`);
    },
  });

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || value === 0) return "$0.00";
    return `$${value.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!data?.trip) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">Trip Not Found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find this trip in your history.
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

  const trip = data.trip;
  const isKycApproved = data.kycApproved;
  const ServiceIcon = serviceTypeConfig[trip.serviceType].icon;
  const StatusIcon = statusConfig[trip.status].icon;
  const serviceConfig = serviceTypeConfig[trip.serviceType];
  const statusCfg = statusConfig[trip.status];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/driver/trips")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-trip-code">
                {trip.tripCode}
              </h1>
              <p className="text-sm text-muted-foreground">Trip Details</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {!isKycApproved && (
          <Alert variant="destructive" data-testid="alert-kyc-warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Verification Required</AlertTitle>
            <AlertDescription>
              {data.message || "Complete your verification to view full earnings breakdown."}{" "}
              <Link href="/driver/documents">
                <span className="underline cursor-pointer font-medium">Verify now</span>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Card data-testid="card-trip-summary">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${serviceConfig.color} text-white`}>
                <ServiceIcon className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-lg">{serviceConfig.label}</span>
                    <Badge variant={statusCfg.variant} className="ml-3">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusCfg.label}
                    </Badge>
                  </div>
                  {isKycApproved && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary" data-testid="text-driver-earnings">
                        {formatCurrency(trip.driverEarnings)}
                      </div>
                      <div className="text-xs text-muted-foreground">Your Earnings</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(trip.dateTime), "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {format(new Date(trip.dateTime), "h:mm a")}
                  </span>
                  {trip.customerRating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      {trip.customerRating}/5
                    </span>
                  )}
                </div>

                {trip.restaurantName && (
                  <div className="mt-2 text-sm">
                    <UtensilsCrossed className="h-4 w-4 inline mr-2 text-muted-foreground" />
                    <span className="font-medium">{trip.restaurantName}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-route-info">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Route Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="w-0.5 h-8 bg-border" />
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Pickup</div>
                  <div className="font-medium" data-testid="text-pickup-location">{trip.pickupLocation}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Dropoff</div>
                  <div className="font-medium" data-testid="text-dropoff-location">{trip.dropoffLocation}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-fare-breakdown">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Fare Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isKycApproved ? (
              <>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Base Fare</span>
                  <span className="font-medium" data-testid="text-base-fare">{formatCurrency(trip.baseFare)}</span>
                </div>

                {trip.deliveryFee !== null && trip.deliveryFee > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="font-medium">{formatCurrency(trip.deliveryFee)}</span>
                  </div>
                )}

                {trip.distanceFare !== null && trip.distanceFare > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Distance Fare</span>
                    <span className="font-medium">{formatCurrency(trip.distanceFare)}</span>
                  </div>
                )}

                {trip.timeFare !== null && trip.timeFare > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Time Fare</span>
                    <span className="font-medium">{formatCurrency(trip.timeFare)}</span>
                  </div>
                )}

                {trip.surgeOrBoost !== null && trip.surgeOrBoost > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" />
                      Surge/Boost
                    </span>
                    <span className="font-medium text-green-600">+{formatCurrency(trip.surgeOrBoost)}</span>
                  </div>
                )}

                {trip.promotionBonus !== null && trip.promotionBonus > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5" />
                      Promotion Bonus
                    </span>
                    <span className="font-medium text-green-600">+{formatCurrency(trip.promotionBonus)}</span>
                  </div>
                )}

                {trip.tipAmount !== null && trip.tipAmount > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      Tip
                    </span>
                    <span className="font-medium text-green-600">+{formatCurrency(trip.tipAmount)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">SafeGo Commission</span>
                  <span className="font-medium text-red-600" data-testid="text-commission">
                    -{formatCurrency(trip.safeGoCommission)}
                  </span>
                </div>

                {trip.taxAmount !== null && trip.taxAmount > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(trip.taxAmount)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-center py-3">
                  <span className="font-semibold text-lg">Your Earnings</span>
                  <span className="font-bold text-xl text-primary" data-testid="text-final-earnings">
                    {formatCurrency(trip.driverEarnings)}
                  </span>
                </div>

                <div className="pt-2">
                  <Link href={`/driver/trips/${tripId}/earnings${serviceType ? `?serviceType=${serviceType}` : ""}`}>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      data-testid="button-view-earnings-breakdown"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      View Full Earnings Breakdown
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Complete verification to view earnings breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-payment-info">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Payment Method</span>
              <Badge variant="outline" className="capitalize" data-testid="text-payment-method">
                {trip.paymentMethod}
              </Badge>
            </div>

            {trip.discountAmount !== null && trip.discountAmount > 0 && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Customer Discount Applied</span>
                <span className="font-medium">{formatCurrency(trip.discountAmount)}</span>
              </div>
            )}

            {trip.adjustments && trip.adjustments.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2">
                  <span className="text-sm font-medium">Adjustments</span>
                  {trip.adjustments.map((adj, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">{adj.type}</span>
                        <p className="text-xs text-muted-foreground">{adj.reason}</p>
                      </div>
                      <span className={adj.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {adj.amount >= 0 ? "+" : ""}{formatCurrency(adj.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-support">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={`/driver/support?tripCode=${trip.tripCode}&serviceType=${trip.serviceType}&tripId=${trip.id}`} className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-open-support">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Report an Issue
                </Button>
              </Link>
              <Link href="/driver/support/help" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-help-center">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help Center
                </Button>
              </Link>
            </div>

            {trip.supportTicketCount > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Support tickets for this trip: {trip.supportTicketCount}
                  </span>
                  {trip.lastSupportStatus && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {trip.lastSupportStatus}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center pb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/driver/trips")}
            data-testid="button-back-to-history"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trip History
          </Button>
        </div>
      </div>
    </div>
  );
}
