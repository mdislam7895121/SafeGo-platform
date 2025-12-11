import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Car,
  UtensilsCrossed,
  Package,
  CheckCircle2,
  MapPin,
  Route,
  Clock,
  DollarSign,
  CreditCard,
  Banknote,
  Star,
  ChevronRight,
  Home,
  Receipt,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface TripSummary {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  tripCode: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  durationMinutes: number;
  actualDurationMinutes: number | null;
  totalFare: number;
  platformCommission: number;
  driverEarnings: number;
  tipAmount: number;
  paymentMethod: "cash" | "card" | "wallet";
  rideType?: string;
  restaurantName?: string;
  customerFirstName: string;
  customerRating?: number | null;
  driverRating?: number | null;
  completedAt: string | null;
  startedAt: string | null;
  createdAt: string;
}

function getServiceIcon(serviceType: string) {
  switch (serviceType) {
    case "RIDE": return Car;
    case "FOOD": return UtensilsCrossed;
    case "PARCEL": return Package;
    default: return Car;
  }
}

function getServiceLabel(serviceType: string, rideType?: string) {
  if (rideType) return rideType;
  switch (serviceType) {
    case "RIDE": return "Ride";
    case "FOOD": return "Food Delivery";
    case "PARCEL": return "Parcel Delivery";
    default: return "Trip";
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function PaymentMethodBadge({ method }: { method: string }) {
  if (method === "cash") {
    return (
      <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200" data-testid="badge-payment-cash">
        <Banknote className="h-3 w-3" />
        Cash
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200" data-testid="badge-payment-card">
      <CreditCard className="h-3 w-3" />
      {method === "wallet" ? "Wallet" : "Card"}
    </Badge>
  );
}

function TripSummaryLoading() {
  return (
    <div className="min-h-screen bg-background p-4" data-testid="loading-trip-summary">
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function TripSummaryPage() {
  const [, params] = useRoute<{ tripId: string }>("/driver/trip-summary/:tripId");
  const tripId = params?.tripId || "";

  const { data, isLoading, error } = useQuery<{ summary: TripSummary }>({
    queryKey: ["/api/driver/trips", tripId, "summary"],
    enabled: !!tripId,
  });

  const summary = data?.summary;

  useEffect(() => {
    if (summary?.status === "completed" || summary?.status === "delivered") {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  }, [summary?.status]);

  if (isLoading) {
    return <TripSummaryLoading />;
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="error-trip-summary">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
              <Receipt className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold">Trip Not Found</h2>
            <p className="text-muted-foreground">
              We couldn't find the summary for this trip.
            </p>
            <Link href="/driver/dashboard">
              <Button className="w-full" data-testid="button-back-dashboard">
                <Home className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ServiceIcon = getServiceIcon(summary.serviceType);
  const isCompleted = summary.status === "completed" || summary.status === "delivered";
  const commissionPercent = summary.totalFare > 0 
    ? ((summary.platformCommission / summary.totalFare) * 100).toFixed(0)
    : "0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-background"
      data-testid="trip-summary-screen"
    >
      <div className="bg-emerald-500 text-white px-4 py-6" data-testid="header-success">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="flex items-center justify-center mb-4"
          >
            <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-bold text-center mb-1" data-testid="text-title">
            Trip Completed!
          </h1>
          <p className="text-emerald-100 text-center text-sm" data-testid="text-subtitle">
            Great job! Your earnings have been added to your wallet.
          </p>
        </div>
      </div>

      <div className="p-4 -mt-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Card className="border-none shadow-lg" data-testid="card-earnings">
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-1">Your Earnings</p>
                <div className="flex items-center justify-center gap-2">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl font-bold text-emerald-600"
                    data-testid="text-driver-earnings"
                  >
                    ${summary.driverEarnings.toFixed(2)}
                  </motion.span>
                  {summary.tipAmount > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700" data-testid="badge-tip">
                      +${summary.tipAmount.toFixed(2)} tip
                    </Badge>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Customer Fare</span>
                  <span className="font-medium" data-testid="text-total-fare">${summary.totalFare.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee ({commissionPercent}%)</span>
                  <span className="font-medium text-red-500" data-testid="text-platform-fee">
                    -${summary.platformCommission.toFixed(2)}
                  </span>
                </div>
                {summary.tipAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tip</span>
                    <span className="font-medium text-emerald-600" data-testid="text-tip">
                      +${summary.tipAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Net Earnings</span>
                  <span className="text-lg font-bold text-emerald-600" data-testid="text-net-earnings">
                    ${(summary.driverEarnings + summary.tipAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-trip-details">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <ServiceIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold" data-testid="text-service-type">
                      {getServiceLabel(summary.serviceType, summary.rideType)}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid="text-trip-code">
                      {summary.tripCode}
                    </p>
                  </div>
                </div>
                <PaymentMethodBadge method={summary.paymentMethod} />
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">A</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm font-medium truncate" data-testid="text-pickup-address">
                      {summary.pickupAddress}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">B</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-sm font-medium truncate" data-testid="text-dropoff-address">
                      {summary.dropoffAddress}
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div data-testid="metric-distance">
                  <Route className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold" data-testid="text-distance">{summary.distanceKm.toFixed(1)} km</p>
                  <p className="text-xs text-muted-foreground">Distance</p>
                </div>
                <div data-testid="metric-duration">
                  <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold" data-testid="text-duration">
                    {formatDuration(summary.actualDurationMinutes || summary.durationMinutes)}
                  </p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <div data-testid="metric-completed">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                  <p className="text-lg font-bold" data-testid="text-completed-time">
                    {summary.completedAt ? formatDateTime(summary.completedAt).split(",")[1]?.trim() || "—" : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>

              {summary.restaurantName && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-restaurant-name">
                      {summary.restaurantName}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {summary.customerRating && (
            <Card data-testid="card-rating">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium">Customer Rating</p>
                      <p className="text-xs text-muted-foreground">{summary.customerFirstName} rated you</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= summary.customerRating!
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-gray-200"
                        }`}
                        data-testid={`star-rating-${star}`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 pt-2 pb-8">
            <Link href="/driver/trip-active">
              <Button size="lg" className="w-full" data-testid="button-find-rides">
                Find More Rides
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <div className="flex gap-3">
              <Link href="/driver/earnings" className="flex-1">
                <Button variant="outline" size="lg" className="w-full" data-testid="button-view-earnings">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Earnings
                </Button>
              </Link>
              <Link href="/driver/dashboard" className="flex-1">
                <Button variant="outline" size="lg" className="w-full" data-testid="button-dashboard">
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
