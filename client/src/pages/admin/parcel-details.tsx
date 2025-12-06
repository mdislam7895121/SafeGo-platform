import { useLocation, useRoute, Link } from "wouter";
import { ArrowLeft, Package, MapPin, DollarSign, Star, User, Clock, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface ParcelDetails {
  id: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  status: string;
  customer: {
    id: string;
    userId: string;
    email: string;
    countryCode: string;
  };
  driver: {
    id: string;
    userId: string;
    email: string;
    countryCode: string;
    isSuspended: boolean;
    isBlocked: boolean;
  } | null;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  serviceFare: number;
  safegoCommission: number;
  driverPayout: number;
  paymentMethod: string;
  customerRating: number | null;
  customerFeedback: string | null;
}

export default function AdminParcelDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/parcels/:id");
  const parcelId = params?.id;

  const { data: parcel, isLoading } = useQuery<ParcelDetails>({
    queryKey: [`/api/admin/parcels/${parcelId}`],
    enabled: !!parcelId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds for memory efficiency
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: string; className?: string }> = {
      requested: { label: "Requested", variant: "secondary" },
      searching_driver: { label: "Searching Driver", variant: "default", className: "bg-yellow-500" },
      accepted: { label: "Accepted", variant: "default", className: "bg-blue-500" },
      picked_up: { label: "Picked Up", variant: "default", className: "bg-indigo-500" },
      on_the_way: { label: "On The Way", variant: "default", className: "bg-purple-500" },
      delivered: { label: "Delivered", variant: "default", className: "bg-green-500" },
      cancelled_by_customer: { label: "Cancelled by Customer", variant: "destructive" },
      cancelled_by_driver: { label: "Cancelled by Driver", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    return (
      <Badge 
        className={statusInfo.className} 
        variant={statusInfo.variant as any}
        data-testid="badge-status"
      >
        {statusInfo.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-6">
        <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent">
          <div className="px-4 sm:px-6 py-3">
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/parcels")}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Parcels</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">Parcel Details</h1>
                <p className="text-[11px] text-muted-foreground">Loading...</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="min-h-screen bg-background pb-6">
        <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent">
          <div className="px-4 sm:px-6 py-3">
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/parcels")}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Parcels</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">Parcel Not Found</h1>
                <p className="text-[11px] text-muted-foreground">The requested parcel could not be found</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/parcels")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Parcels</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">Parcel Details</h1>
                <p className="text-[11px] text-muted-foreground font-mono">{parcel.id}</p>
              </div>
            </div>
            {getStatusBadge(parcel.status)}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Parcel ID</p>
                <p className="font-mono font-semibold" data-testid="text-parcel-id">{parcel.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <Badge variant="outline" data-testid="badge-country">{parcel.customer.countryCode}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created At</p>
                <p data-testid="text-created-at">{format(new Date(parcel.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p data-testid="text-updated-at">{format(new Date(parcel.updatedAt), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              {parcel.deliveredAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivered At</p>
                  <p data-testid="text-delivered-at">{format(new Date(parcel.deliveredAt), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer */}
            <div>
              <p className="text-sm font-semibold mb-2">Customer</p>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium" data-testid="text-customer-email">{parcel.customer.email}</p>
                  <p className="text-sm text-muted-foreground">Country: {parcel.customer.countryCode}</p>
                </div>
                <Link href={`/admin/customers/${parcel.customer.id}`}>
                  <Button size="sm" variant="outline" data-testid="button-view-customer">
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>

            {/* Driver */}
            <div>
              <p className="text-sm font-semibold mb-2">Driver</p>
              {parcel.driver ? (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium" data-testid="text-driver-email">{parcel.driver.email}</p>
                      {parcel.driver.isSuspended && <Badge className="bg-orange-500">Suspended</Badge>}
                      {parcel.driver.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">Country: {parcel.driver.countryCode}</p>
                  </div>
                  <Link href={`/admin/drivers/${parcel.driver.id}`}>
                    <Button size="sm" variant="outline" data-testid="button-view-driver">
                      View Profile
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground" data-testid="text-no-driver">No driver assigned</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold">Pickup Address</p>
              </div>
              <p className="text-sm p-3 bg-muted/50 rounded-lg" data-testid="text-pickup-address">
                {parcel.pickupAddress}
              </p>
              {parcel.pickupLat && parcel.pickupLng && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-pickup-coords">
                  Coordinates: {parcel.pickupLat.toFixed(6)}, {parcel.pickupLng.toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-red-600" />
                <p className="text-sm font-semibold">Dropoff Address</p>
              </div>
              <p className="text-sm p-3 bg-muted/50 rounded-lg" data-testid="text-dropoff-address">
                {parcel.dropoffAddress}
              </p>
              {parcel.dropoffLat && parcel.dropoffLng && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-dropoff-coords">
                  Coordinates: {parcel.dropoffLat.toFixed(6)}, {parcel.dropoffLng.toFixed(6)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Service Fare</p>
                <p className="text-xl font-bold" data-testid="text-service-fare">
                  ${parcel.serviceFare.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SafeGo Commission</p>
                <p className="text-xl font-bold text-primary" data-testid="text-commission">
                  ${parcel.safegoCommission.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Driver Payout</p>
                <p className="text-xl font-bold text-green-600" data-testid="text-driver-payout">
                  ${parcel.driverPayout.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <Badge variant="outline" data-testid="badge-payment-method">
                    {parcel.paymentMethod.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Breakdown:</span>
                <span className="text-muted-foreground">
                  Service ({parcel.serviceFare.toFixed(2)}) = Commission ({parcel.safegoCommission.toFixed(2)}) + Driver Payout ({parcel.driverPayout.toFixed(2)})
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Feedback */}
        {(parcel.customerRating || parcel.customerFeedback) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Customer Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {parcel.customerRating && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Rating</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < parcel.customerRating!
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold" data-testid="text-rating">
                      {parcel.customerRating} / 5
                    </span>
                  </div>
                </div>
              )}
              {parcel.customerFeedback && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Feedback</p>
                  <p className="p-3 bg-muted/50 rounded-lg" data-testid="text-feedback">
                    {parcel.customerFeedback}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Back Button */}
        <Card>
          <CardContent className="p-4">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/parcels")}
              className="w-full"
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Parcels List
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
