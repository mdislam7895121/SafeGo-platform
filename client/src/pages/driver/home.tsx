import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Car, DollarSign, TrendingUp, Settings, User, Wallet, MessageCircle, Power, MapPin, Navigation, Radio, UtensilsCrossed, ChevronRight, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useCallback } from "react";

export default function DriverHome() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
    refetchInterval: 30000,
  });

  const isOnline = !!(driverData as any)?.vehicle?.isOnline;
  const hasActiveRide = !!(driverData as any)?.activeRide;

  const { data: activeRideData } = useQuery({
    queryKey: ["/api/driver/active-ride"],
    refetchInterval: isOnline ? 15000 : false,
    enabled: isOnline,
  });

  const { data: pendingRequestsData, refetch: refetchPendingRequests } = useQuery({
    queryKey: ["/api/driver/pending-requests"],
    refetchInterval: isOnline && !hasActiveRide ? 10000 : false,
    enabled: isOnline && !hasActiveRide,
  });

  const { data: pendingFoodDeliveries } = useQuery({
    queryKey: ["/api/driver/food-delivery/pending"],
    refetchInterval: isOnline ? 15000 : false,
    enabled: isOnline,
  });

  const { data: activeFoodDeliveries } = useQuery({
    queryKey: ["/api/driver/food-delivery/active"],
    refetchInterval: isOnline ? 15000 : false,
    enabled: isOnline,
  });

  // Toggle online/offline status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (isOnline: boolean) => {
      return apiRequest("/api/driver/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline }),
      });
    },
    onSuccess: (_, isOnline) => {
      toast({
        title: isOnline ? "You are now online" : "You are now offline",
        description: isOnline ? "You can now receive ride requests" : "You will not receive new ride requests",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      setIsUpdatingStatus(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsUpdatingStatus(false);
    },
  });

  // Send location update to server
  const sendLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    try {
      await apiRequest("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
        }),
      });
    } catch (error) {
      console.error("Failed to update location:", error);
    }
  }, []);

  // Start/stop location broadcasting based on online status
  useEffect(() => {
    const vehicle = (driverData as any)?.vehicle;
    const isOnline = vehicle?.isOnline;

    if (isOnline && !locationWatchId) {
      // Start broadcasting location
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          sendLocationUpdate,
          (error) => console.error("Location error:", error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
        setLocationWatchId(watchId);
      }
    } else if (!isOnline && locationWatchId) {
      // Stop broadcasting location
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }

    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [(driverData as any)?.vehicle?.isOnline, locationWatchId, sendLocationUpdate]);

  const handleToggleStatus = () => {
    const vehicle = (driverData as any)?.vehicle;
    const newStatus = !vehicle?.isOnline;
    setIsUpdatingStatus(true);
    toggleStatusMutation.mutate(newStatus);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const vehicle = (driverData as any)?.vehicle;
  const stats = (driverData as any)?.stats;
  const wallet = (driverData as any)?.wallet;

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Driver Dashboard</h1>
            <p className="text-sm opacity-90">{user?.email}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={logout}
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Online/Offline Toggle - Prominent Card */}
        {profile?.isVerified && vehicle && (
          <Card className={`border-2 ${vehicle.isOnline ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-gray-300 dark:border-gray-700"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${vehicle.isOnline ? "bg-green-500" : "bg-gray-400"}`}>
                    <Power className={`h-6 w-6 text-white ${vehicle.isOnline ? "animate-pulse" : ""}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-lg" data-testid="text-online-status">
                      {vehicle.isOnline ? "Online" : "Offline"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.isOnline ? (
                        <span className="flex items-center gap-1">
                          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                          Broadcasting location
                        </span>
                      ) : "Tap to go online and receive rides"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={vehicle.isOnline}
                  onCheckedChange={handleToggleStatus}
                  disabled={isUpdatingStatus}
                  className="scale-125"
                  data-testid="switch-online-status"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Ride Card */}
        {(activeRideData as any)?.activeRide && (
          <Card className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold">Active Ride</span>
                </div>
                <Badge className="bg-blue-500">{(activeRideData as any).activeRide.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>{(activeRideData as any).activeRide.pickupAddress}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                  <span>{(activeRideData as any).activeRide.dropoffAddress}</span>
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-muted-foreground">Payout</span>
                  <span className="font-bold text-green-600">${(activeRideData as any).activeRide.driverPayout.toFixed(2)}</span>
                </div>
              </div>
              <Link href="/driver/trip/active">
                <Button className="w-full mt-3" data-testid="button-view-active-ride">
                  <Navigation className="h-4 w-4 mr-2" />
                  View Active Ride
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Food Deliveries Summary Card */}
        {profile?.isVerified && vehicle?.isOnline && (
          <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                Food Deliveries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Pending</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-pending-food-count">
                    {(pendingFoodDeliveries as any)?.count || 0}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Navigation className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-active-food-count">
                    {(activeFoodDeliveries as any)?.count || 0}
                  </p>
                </div>
              </div>

              {/* Active Food Delivery Quick View */}
              {(activeFoodDeliveries as any)?.deliveries?.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      Active Delivery
                    </span>
                    <Badge className="bg-blue-500">
                      {(activeFoodDeliveries as any).deliveries[0].status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {(activeFoodDeliveries as any).deliveries[0].restaurant?.name || "Restaurant"}
                  </p>
                  <Link href={`/driver/food-delivery/${(activeFoodDeliveries as any).deliveries[0].id}`}>
                    <Button size="sm" className="w-full mt-2" data-testid="button-view-active-food-delivery">
                      View Delivery
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}

              <Link href="/driver/food-deliveries">
                <Button variant="outline" className="w-full" data-testid="button-go-to-food-deliveries">
                  <UtensilsCrossed className="h-4 w-4 mr-2" />
                  Go to Delivery Inbox
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Pending Ride Requests */}
        {vehicle?.isOnline && !(activeRideData as any)?.activeRide && (pendingRequestsData as any)?.requests?.length > 0 && (
          <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="h-5 w-5 text-amber-500" />
                Ride Requests
                <Badge variant="secondary" className="ml-auto">{(pendingRequestsData as any).requests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(pendingRequestsData as any).requests.slice(0, 2).map((request: any) => (
                <div key={request.id} className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{request.customer.fullName}</span>
                    <Badge className="bg-green-500">${request.driverPayout.toFixed(2)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 text-green-500 mt-0.5" />
                      <span className="line-clamp-1">{request.pickupAddress}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 text-red-500 mt-0.5" />
                      <span className="line-clamp-1">{request.dropoffAddress}</span>
                    </div>
                  </div>
                  <Link href={`/driver/ride-request/${request.id}`}>
                    <Button size="sm" className="w-full mt-2" data-testid={`button-view-request-${request.id}`}>
                      View Request
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Waiting for Requests */}
        {vehicle?.isOnline && !(activeRideData as any)?.activeRide && (!(pendingRequestsData as any)?.requests?.length) && (
          <Card className="border-dashed border-2">
            <CardContent className="p-6 text-center">
              <Radio className="h-10 w-10 mx-auto text-green-500 animate-pulse mb-3" />
              <p className="font-medium">Waiting for ride requests...</p>
              <p className="text-sm text-muted-foreground mt-1">Stay in a busy area to get more requests</p>
            </CardContent>
          </Card>
        )}

        {/* Verification Status */}
        {!profile?.isVerified && (
          <Card className="border-orange-500">
            <CardContent className="p-4">
              <p className="text-sm">
                WARNING: Your account is pending verification. You can't go online until approved.
              </p>
            </CardContent>
          </Card>
        )}

        {!vehicle && (
          <Card className="border-orange-500">
            <CardContent className="p-4">
              <p className="text-sm mb-3">
                VEHICLE: You need to register a vehicle before going online
              </p>
              <Link href="/driver/vehicle">
                <Button size="sm" data-testid="button-register-vehicle">Register Vehicle</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-2xl font-bold" data-testid="text-balance">
                    ${wallet?.balance != null ? Number(wallet.balance).toFixed(2) : "0.00"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Owed</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-negative-balance">
                    ${wallet?.negativeBalance != null ? Number(wallet.negativeBalance).toFixed(2) : "0.00"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Trips</p>
                  <p className="text-2xl font-bold" data-testid="text-total-trips">
                    {stats?.totalTrips || 0}
                  </p>
                </div>
                <Car className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="text-2xl font-bold" data-testid="text-rating">
                    {stats?.rating != null ? Number(stats.rating).toFixed(1) : "N/A"}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle Info */}
        {vehicle && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Your Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge>{vehicle.vehicleType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{vehicle.vehicleModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plate</span>
                <span className="font-medium">{vehicle.vehiclePlate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Earnings</span>
                <span className="font-bold">${vehicle.totalEarnings != null ? Number(vehicle.totalEarnings).toFixed(2) : "0.00"}</span>
              </div>
              <Link href="/driver/vehicle">
                <Button variant="outline" className="w-full mt-2" data-testid="button-edit-vehicle">
                  Edit Vehicle
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/driver/profile">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-profile">
              <User className="h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Link href="/driver/vehicle">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-vehicle">
              <Settings className="h-4 w-4" />
              Vehicle
            </Button>
          </Link>
          <Link href="/driver/wallet">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-wallet">
              <Wallet className="h-4 w-4" />
              Wallet
            </Button>
          </Link>
          <Link href="/driver/support">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-support">
              <MessageCircle className="h-4 w-4" />
              Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
