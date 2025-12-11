import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Star, DollarSign, Car, MapPin, Loader2, Navigation, PlayCircle, CheckCircle, XCircle, Phone, MapPinned } from "lucide-react";
import { VerificationBanner } from "@/components/partner/VerificationBanner";
import { getDriverVerificationState, type DriverVerificationData } from "@/lib/driverVerification";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DriverStatus {
  driverId: string;
  isOnline: boolean;
  isAvailable: boolean;
  currentServiceMode: string | null;
  currentAssignmentId: string | null;
  currentAssignmentType: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
}

interface ActiveRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  customerName: string;
  customerPhone: string;
  estimatedFare: number;
  distance: number;
  createdAt: string;
}

export default function DriverDashboard() {
  const { toast } = useToast();
  
  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });
  
  const { data: kycData } = useQuery<{ kycStatus?: DriverVerificationData }>({
    queryKey: ["/api/driver/kyc-status"],
  });

  const { data: statusData, isLoading: statusLoading } = useQuery<DriverStatus>({
    queryKey: ["/api/driver/status/me"],
    refetchInterval: 10000,
  });

  const { data: activeRideData, isLoading: activeRideLoading } = useQuery<{ rides: ActiveRide[] }>({
    queryKey: ["/api/driver/rides/active"],
    refetchInterval: 5000,
    enabled: statusData?.isOnline === true,
  });
  
  const driverVerification = getDriverVerificationState(kycData?.kycStatus);
  const isVerified = driverVerification.isVerifiedForOperations;

  const toggleOnlineMutation = useMutation({
    mutationFn: async (goOnline: boolean) => {
      return apiRequest("PATCH", "/api/driver/status", {
        isOnline: goOnline,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/status/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/rides/active"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const rideActionMutation = useMutation({
    mutationFn: async ({ rideId, action }: { rideId: string; action: string }) => {
      return apiRequest("POST", `/api/driver/ride-actions/${rideId}/${action}`, {});
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/rides/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/status/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      
      const messages: Record<string, string> = {
        arriving: "Customer notified you are arriving",
        start: "Trip started",
        complete: "Trip completed successfully",
        cancel: "Trip cancelled",
      };
      toast({
        title: "Success",
        description: messages[action] || "Action completed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to perform action",
        variant: "destructive",
      });
    },
  });

  const handleToggleOnline = () => {
    if (!isVerified) {
      toast({
        title: "Verification Required",
        description: "Complete your verification to go online",
        variant: "destructive",
      });
      return;
    }
    toggleOnlineMutation.mutate(!statusData?.isOnline);
  };

  const handleRideAction = (rideId: string, action: string) => {
    rideActionMutation.mutate({ rideId, action });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted": return "bg-blue-500";
      case "driver_arriving": return "bg-yellow-500";
      case "arrived": return "bg-orange-500";
      case "in_progress": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "accepted": return "Accepted";
      case "driver_arriving": return "En Route to Pickup";
      case "arrived": return "Arrived at Pickup";
      case "in_progress": return "Trip in Progress";
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const stats = (driverData as any)?.stats;
  const wallet = (driverData as any)?.wallet;

  const rating = stats?.rating ? Number(stats.rating) : 5.0;
  const totalTrips = stats?.totalTrips || 0;
  const dailyEarnings = stats?.todayEarnings ? Number(stats.todayEarnings) : 0;
  const weeklyEarnings = stats?.weekEarnings ? Number(stats.weekEarnings) : 0;

  const activeRides = activeRideData?.rides || [];
  const currentRide = activeRides[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {!driverVerification.isVerifiedForOperations && (
        <VerificationBanner
          verification={{
            canonicalStatus: driverVerification.canonicalStatus,
            bannerType: driverVerification.bannerType,
            bannerMessage: driverVerification.bannerMessage,
            missingFields: driverVerification.missingFields,
            rejectionReason: driverVerification.rejectionReason,
          }}
          kycRoute="/driver/profile"
          partnerType="driver"
        />
      )}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-welcome">
            Welcome back, {profile?.firstName || "Driver"}!
          </h1>
          <p className="text-muted-foreground">
            Here's your performance overview
          </p>
        </div>

        <Card className="w-full md:w-auto">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${statusData?.isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                <div>
                  <p className="font-semibold" data-testid="text-status">
                    {statusData?.isOnline ? "Online" : "Offline"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusData?.isOnline 
                      ? (statusData?.isAvailable ? "Available for rides" : "On a trip")
                      : "Go online to receive rides"}
                  </p>
                </div>
              </div>
              <Switch
                data-testid="switch-online"
                checked={statusData?.isOnline || false}
                onCheckedChange={handleToggleOnline}
                disabled={toggleOnlineMutation.isPending || !isVerified}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {currentRide && (
        <Card className="border-2 border-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Active Trip
              </CardTitle>
              <Badge className={getStatusColor(currentRide.status)} data-testid="badge-trip-status">
                {getStatusLabel(currentRide.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="font-medium" data-testid="text-pickup-address">{currentRide.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPinned className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="font-medium" data-testid="text-dropoff-address">{currentRide.dropoffAddress}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-semibold">{currentRide.customerName?.charAt(0) || "C"}</span>
                  </div>
                  <div>
                    <p className="font-medium" data-testid="text-customer-name">{currentRide.customerName}</p>
                    <a href={`tel:${currentRide.customerPhone}`} className="text-sm text-primary flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {currentRide.customerPhone}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Est. Fare</p>
                    <p className="font-semibold" data-testid="text-fare">${currentRide.estimatedFare?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distance</p>
                    <p className="font-semibold">{currentRide.distance?.toFixed(1) || "0"} km</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {currentRide.status === "accepted" && (
                <Button
                  data-testid="button-arriving"
                  onClick={() => handleRideAction(currentRide.id, "arriving")}
                  disabled={rideActionMutation.isPending}
                >
                  {rideActionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Navigation className="h-4 w-4 mr-2" />
                  )}
                  Arriving
                </Button>
              )}
              {(currentRide.status === "driver_arriving" || currentRide.status === "arrived") && (
                <Button
                  data-testid="button-start"
                  onClick={() => handleRideAction(currentRide.id, "start")}
                  disabled={rideActionMutation.isPending}
                >
                  {rideActionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  Start Trip
                </Button>
              )}
              {currentRide.status === "in_progress" && (
                <Button
                  data-testid="button-complete"
                  onClick={() => handleRideAction(currentRide.id, "complete")}
                  disabled={rideActionMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {rideActionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Complete Trip
                </Button>
              )}
              <Button
                data-testid="button-cancel"
                variant="outline"
                onClick={() => handleRideAction(currentRide.id, "cancel")}
                disabled={rideActionMutation.isPending}
                className="text-destructive border-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-950/30 flex items-center justify-center">
                <Star className="h-6 w-6 fill-yellow-500 text-yellow-500" />
              </div>
              <div>
                <div className="text-3xl font-bold" data-testid="text-rating">
                  {rating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Out of 5.0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trips Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-3xl font-bold" data-testid="text-trips-completed">
                  {totalTrips}
                </div>
                <p className="text-xs text-muted-foreground">Total trips</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Daily Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600" data-testid="text-daily-earnings">
                  ${dailyEarnings.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Weekly Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600" data-testid="text-weekly-earnings">
                  ${weeklyEarnings.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">This week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Bonus Zones
          </CardTitle>
          <CardDescription>
            High-demand areas with surge pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold mb-1">Downtown</h4>
              <p className="text-sm text-muted-foreground mb-2">1.5x surge</p>
              <p className="text-xs text-muted-foreground">Active until 8:00 PM</p>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold mb-1">Airport</h4>
              <p className="text-sm text-muted-foreground mb-2">2.0x surge</p>
              <p className="text-xs text-muted-foreground">Active all day</p>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold mb-1">Business District</h4>
              <p className="text-sm text-muted-foreground mb-2">1.3x surge</p>
              <p className="text-xs text-muted-foreground">Peak hours only</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
