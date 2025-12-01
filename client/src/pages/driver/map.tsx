import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  Crosshair,
  MapPin,
  Car,
  UtensilsCrossed,
  Package,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Route,
  Clock,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  SignalZero,
  Power,
  History,
  DollarSign,
  ShieldAlert,
  Plus,
  Minus,
  Menu,
  Bell,
  Bike,
  Check,
  Wallet,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { SafeGoMap, type ActiveLeg, type MapLocation } from "@/components/maps/SafeGoMap";
import { useDriverNavigation } from "@/hooks/useDriverNavigation";
import { useDriverAvailability } from "@/hooks/useDriverAvailability";
import { IncomingTripRequest, type TripRequest } from "@/components/driver/IncomingTripRequest";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  NavigationProvider,
  NAVIGATION_PROVIDERS,
} from "@/lib/navigationProviders";

interface ActiveTrip {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  status: string;
  tripCode: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  estimatedArrivalMinutes: number;
  estimatedTripMinutes: number;
  distanceKm: number;
  fare: number;
  customer: {
    firstName: string;
    lastName?: string;
    phone: string | null;
    rating?: number;
  };
  restaurantName?: string;
  rideType?: string;
}

function getServiceIcon(serviceType: string) {
  switch (serviceType) {
    case "RIDE":
      return Car;
    case "FOOD":
      return UtensilsCrossed;
    case "PARCEL":
      return Package;
    default:
      return Car;
  }
}

function getServiceLabel(serviceType: string, rideType?: string) {
  if (rideType) return rideType;
  switch (serviceType) {
    case "RIDE":
      return "Ride";
    case "FOOD":
      return "Food Delivery";
    case "PARCEL":
      return "Parcel";
    default:
      return "Trip";
  }
}

function triggerHapticFeedback(type: "light" | "medium" | "heavy" = "medium") {
  if (navigator.vibrate) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
}

function GpsSignalIcon({ strength }: { strength: "strong" | "medium" | "weak" | "none" }) {
  switch (strength) {
    case "strong":
      return <SignalHigh className="h-5 w-5 text-green-500" />;
    case "medium":
      return <SignalMedium className="h-5 w-5 text-yellow-500" />;
    case "weak":
      return <SignalLow className="h-5 w-5 text-orange-500" />;
    default:
      return <SignalZero className="h-5 w-5 text-gray-400" />;
  }
}

export default function DriverMapPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const tripIdFromUrl = new URLSearchParams(searchParams).get("tripId");
  
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [liveEta, setLiveEta] = useState<number | null>(null);
  const [showTripPanel, setShowTripPanel] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [autoFollowEnabled, setAutoFollowEnabled] = useState(true);
  const [showSosSheet, setShowSosSheet] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<TripRequest | null>(null);
  const [showVehicleSheet, setShowVehicleSheet] = useState(false);
  const [showQuickActionsSheet, setShowQuickActionsSheet] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("car");

  const vehicleTypes = [
    { id: "car", name: "Car", icon: Car },
    { id: "bike", name: "Bike", icon: Bike },
    { id: "cng", name: "CNG", icon: Car },
    { id: "scooter", name: "Scooter", icon: Bike },
  ];

  const {
    isOnline,
    isUpdatingStatus,
    isLoading: isLoadingAvailability,
    isVerified,
    hasVehicle,
    toggleOnlineStatus,
    driverLocation,
    gpsStatus,
    profile,
  } = useDriverAvailability();

  const { data: activeTripData, isLoading, error } = useQuery<{
    activeTrip: ActiveTrip | null;
    hasActiveTrip: boolean;
  }>({
    queryKey: ["/api/driver/trips/active"],
    refetchInterval: 5000,
  });

  const { data: pendingRequestsData, refetch: refetchPendingRequests } = useQuery<{
    pendingRequests: TripRequest[];
  }>({
    queryKey: ["/api/driver/pending-requests"],
    refetchInterval: 3000,
    enabled: isOnline && !activeTripData?.hasActiveTrip,
  });

  const { data: notificationsData } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/driver/notifications"],
    refetchInterval: 30000,
  });

  const acceptTripMutation = useMutation({
    mutationFn: async ({ tripId, serviceType }: { tripId: string; serviceType: string }) => {
      if (serviceType === "FOOD") {
        return apiRequest("/api/driver/food-delivery/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryId: tripId }),
        });
      }
      return apiRequest(`/api/driver/rides/${tripId}/accept`, { method: "POST" });
    },
    onSuccess: (_, { serviceType }) => {
      toast({ title: "Trip accepted", description: "Navigate to pickup location" });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/pending-requests"] });
      setIncomingRequest(null);
      if (serviceType === "FOOD") {
        setLocation("/driver/food-delivery-active");
      } else {
        setLocation("/driver/trip-active");
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept", description: error.message, variant: "destructive" });
      setIncomingRequest(null);
    },
  });

  const declineTripMutation = useMutation({
    mutationFn: async ({ tripId, serviceType, reason }: { tripId: string; serviceType: string; reason?: string }) => {
      if (serviceType === "FOOD") {
        return apiRequest("/api/driver/food-delivery/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryId: tripId, reason }),
        });
      }
      return apiRequest(`/api/driver/rides/${tripId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Request declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/pending-requests"] });
      setIncomingRequest(null);
    },
    onError: () => {
      setIncomingRequest(null);
    },
  });

  useEffect(() => {
    const requests = pendingRequestsData?.pendingRequests;
    if (requests && requests.length > 0 && !incomingRequest && !activeTripData?.hasActiveTrip) {
      setIncomingRequest(requests[0]);
    }
  }, [pendingRequestsData, incomingRequest, activeTripData?.hasActiveTrip]);

  const activeTrip = activeTripData?.activeTrip;

  const driverPosition: MapLocation | null = driverLocation 
    ? { lat: driverLocation.lat, lng: driverLocation.lng, heading: driverLocation.heading ?? undefined }
    : null;

  const {
    preferences,
    providers,
    currentProvider,
    setPreference,
    openInExternalMap,
  } = useDriverNavigation({
    activeTrip: activeTrip
      ? {
          id: activeTrip.id,
          status: activeTrip.status,
          pickupLat: activeTrip.pickupLat,
          pickupLng: activeTrip.pickupLng,
          dropoffLat: activeTrip.dropoffLat,
          dropoffLng: activeTrip.dropoffLng,
        }
      : null,
    driverPosition: driverPosition
      ? { lat: driverPosition.lat, lng: driverPosition.lng }
      : null,
  });

  useEffect(() => {
    if (gpsStatus.error) {
      setGpsError(gpsStatus.error);
    } else {
      setGpsError(null);
    }
  }, [gpsStatus.error]);

  const handleDistanceCalculated = useCallback(
    (distanceKm: number, etaMinutes: number) => {
      setLiveDistance(distanceKm);
      setLiveEta(etaMinutes);
    },
    []
  );

  const handleRecenter = useCallback(() => {
    setAutoFollowEnabled(true);
    triggerHapticFeedback("light");
    toast({ title: "Recentered on your location" });
  }, [toast]);

  const handleProviderSelect = useCallback(
    async (provider: NavigationProvider) => {
      if (provider === NavigationProvider.SAFEGO) {
        setPreference("primaryProvider", provider);
        toast({ title: "Using SafeGo Map", description: "In-app navigation active" });
        return;
      }

      if (!activeTrip) {
        setPreference("primaryProvider", provider);
        toast({
          title: `${NAVIGATION_PROVIDERS.find((p) => p.id === provider)?.name} selected`,
          description: "Will open when you have an active trip",
        });
        return;
      }

      await openInExternalMap(provider);
    },
    [activeTrip, setPreference, openInExternalMap, toast]
  );

  const handleAcceptTrip = useCallback((tripId: string, serviceType: string) => {
    acceptTripMutation.mutate({ tripId, serviceType });
  }, [acceptTripMutation]);

  const handleDeclineTrip = useCallback((tripId: string, serviceType: string, reason?: string) => {
    declineTripMutation.mutate({ tripId, serviceType, reason });
  }, [declineTripMutation]);

  const handleExpireTrip = useCallback((tripId: string) => {
    setIncomingRequest(null);
    queryClient.invalidateQueries({ queryKey: ["/api/driver/pending-requests"] });
  }, []);

  const getActiveLeg = (): ActiveLeg => {
    if (!activeTrip) return "to_pickup";
    if (["accepted", "arriving"].includes(activeTrip.status)) return "to_pickup";
    if (["arrived", "started", "in_progress", "picked_up"].includes(activeTrip.status))
      return "to_dropoff";
    return "completed";
  };

  const activeLeg = getActiveLeg();
  const ServiceIcon = activeTrip ? getServiceIcon(activeTrip.serviceType) : Car;
  const displayEta =
    liveEta ??
    (activeTrip
      ? activeLeg === "to_pickup"
        ? activeTrip.estimatedArrivalMinutes
        : activeTrip.estimatedTripMinutes
      : null);
  const displayDistance = liveDistance ?? activeTrip?.distanceKm ?? null;

  const pickupLocation = useMemo((): MapLocation | null => {
    if (!activeTrip?.pickupLat || !activeTrip?.pickupLng) return null;
    return {
      lat: activeTrip.pickupLat,
      lng: activeTrip.pickupLng,
      label: activeTrip.pickupAddress,
    };
  }, [activeTrip]);

  const dropoffLocation = useMemo((): MapLocation | null => {
    if (!activeTrip?.dropoffLat || !activeTrip?.dropoffLng) return null;
    return {
      lat: activeTrip.dropoffLat,
      lng: activeTrip.dropoffLng,
      label: activeTrip.dropoffAddress,
    };
  }, [activeTrip]);

  const mapCenter = useMemo((): MapLocation => {
    if (driverPosition) return driverPosition;
    if (pickupLocation) return pickupLocation;
    return { lat: 40.7128, lng: -74.006 };
  }, [driverPosition, pickupLocation]);

  const unreadNotifications = notificationsData?.notifications?.filter((n: any) => !n.isRead).length ?? 0;

  if (isLoading && !activeTripData) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground font-medium">Loading map...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative" data-testid="driver-map-view">
      <div className="flex-1 relative">
        <SafeGoMap
          center={mapCenter}
          zoom={15}
          driverLocation={driverPosition}
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          activeLeg={activeLeg}
          showControls={true}
          autoFollow={autoFollowEnabled}
          showEtaOverlay={!!activeTrip && activeLeg !== "completed"}
          showTrafficToggle={true}
          onMapReady={() => setMapReady(true)}
          onDistanceCalculated={handleDistanceCalculated}
          className="h-full w-full"
        />

        <div
          className="absolute top-4 left-4 right-4 z-[1000]"
          data-testid="driver-status-card"
        >
          <Card className="shadow-lg bg-background/95 backdrop-blur-sm border-2 border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <GpsSignalIcon strength={gpsStatus.signalStrength} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 
                      className="font-semibold text-sm truncate"
                      data-testid="text-driver-status"
                    >
                      {isOnline ? "You're Online" : "You're Offline"}
                    </h3>
                    {isOnline && (
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {isOnline 
                      ? activeTrip 
                        ? "Trip in progress" 
                        : "Waiting for trip requests..."
                      : "Go online to start getting trips"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {gpsError && (
          <div
            className="absolute top-28 left-4 right-4 z-[1000]"
            data-testid="gps-error-banner"
          >
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    GPS Signal Issue
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                    {gpsError}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="absolute top-4 right-4 z-[1001] flex flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full shadow-lg relative"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notificationsData?.notifications?.slice(0, 5).map((notif: any) => (
                <DropdownMenuItem key={notif.id} className="flex flex-col items-start gap-1">
                  <span className="font-medium text-sm">{notif.title}</span>
                  <span className="text-xs text-muted-foreground truncate w-full">{notif.message}</span>
                </DropdownMenuItem>
              )) ?? (
                <DropdownMenuItem disabled>No notifications</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/driver/account/notifications")}>
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="absolute bottom-32 right-4 z-[1000] flex flex-col gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setLocation("/driver/trips")}
            data-testid="button-history"
          >
            <History className="h-5 w-5" />
          </Button>

          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setLocation("/driver/earnings")}
            data-testid="button-earnings"
          >
            <DollarSign className="h-5 w-5" />
          </Button>

          <Sheet open={showSosSheet} onOpenChange={setShowSosSheet}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                className="h-12 w-12 rounded-full shadow-lg"
                data-testid="button-sos"
              >
                <ShieldAlert className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  Emergency SOS
                </SheetTitle>
              </SheetHeader>
              <div className="py-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  If you're in danger, use these emergency options:
                </p>
                <Button 
                  variant="destructive" 
                  className="w-full h-14 text-lg"
                  onClick={() => {
                    window.location.href = "tel:911";
                  }}
                  data-testid="button-call-911"
                >
                  Call 911
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setLocation("/driver/safety-emergency");
                    setShowSosSheet(false);
                  }}
                  data-testid="button-safety-center"
                >
                  Go to Safety Center
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setLocation("/driver/safety-report");
                    setShowSosSheet(false);
                  }}
                  data-testid="button-report-incident"
                >
                  Report Safety Incident
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={handleRecenter}
            data-testid="driver-map-recenter"
          >
            <Crosshair className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full shadow-lg"
                data-testid="driver-map-provider-select"
              >
                <Navigation className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Navigation Provider</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {providers.map((provider) => (
                <DropdownMenuItem
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider.id)}
                  className="flex items-center justify-between"
                  data-testid={`provider-option-${provider.id}`}
                >
                  <div className="flex items-center gap-2">
                    {provider.isExternal ? (
                      <ExternalLink className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    <span>{provider.name}</span>
                  </div>
                  {currentProvider === provider.id && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          className="absolute bottom-4 left-4 z-[1000]"
          data-testid="map-legend"
        >
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-green-200 dark:ring-green-800" />
                  <span className="text-muted-foreground">You</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-800" />
                  <span className="text-muted-foreground">Pickup</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-200 dark:ring-red-800" />
                  <span className="text-muted-foreground">Dropoff</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!activeTrip && isOnline && !incomingRequest && (
          <div
            className="absolute top-28 left-1/2 -translate-x-1/2 z-[999]"
            data-testid="waiting-for-trips-banner"
          >
            <Badge variant="secondary" className="px-4 py-2 text-sm shadow-md">
              <Signal className="h-4 w-4 mr-2 animate-pulse text-green-500" />
              Waiting for trip requests...
            </Badge>
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeTrip && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-[1001]"
            data-testid="trip-info-panel"
          >
            <div className="bg-background border-t shadow-lg rounded-t-2xl">
              <button
                onClick={() => setShowTripPanel(!showTripPanel)}
                className="w-full flex items-center justify-center py-2"
                data-testid="toggle-trip-panel"
              >
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </button>

              <AnimatePresence>
                {showTripPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-primary/10">
                            <ServiceIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold" data-testid="text-trip-type">
                              {getServiceLabel(
                                activeTrip.serviceType,
                                activeTrip.rideType
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              #{activeTrip.tripCode}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className="text-lg font-bold"
                            data-testid="text-trip-fare"
                          >
                            ${activeTrip.fare.toFixed(2)}
                          </p>
                          {displayDistance && (
                            <p className="text-xs text-muted-foreground">
                              {displayDistance.toFixed(1)} km
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-background" />
                            <div className="w-0.5 h-6 bg-border" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Pickup</p>
                            <p
                              className="text-sm font-medium truncate"
                              data-testid="text-pickup-address"
                            >
                              {activeTrip.pickupAddress}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-background" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Dropoff</p>
                            <p
                              className="text-sm font-medium truncate"
                              data-testid="text-dropoff-address"
                            >
                              {activeTrip.dropoffAddress}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => setLocation("/driver/trip-active")}
                          data-testid="driver-trip-navigate-button"
                        >
                          <Route className="h-4 w-4 mr-2" />
                          View Active Trip
                        </Button>
                        {displayEta && (
                          <Badge
                            variant="secondary"
                            className="text-sm px-3 py-2"
                            data-testid="badge-trip-eta"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {displayEta} min
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="fixed bottom-0 left-0 right-0 z-[1002] h-20 md:h-[90px] bg-white dark:bg-zinc-900 shadow-[0_-4px_14px_rgba(0,0,0,0.08)] flex items-center justify-between px-4"
        data-testid="driver-footer-bar"
      >
        <Sheet open={showVehicleSheet} onOpenChange={setShowVehicleSheet}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-2"
              data-testid="button-vehicle-select"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Select Vehicle</SheetTitle>
            </SheetHeader>
            <div className="py-6 space-y-2">
              {vehicleTypes.map((vehicle) => {
                const VehicleIcon = vehicle.icon;
                const isSelected = selectedVehicle === vehicle.id;
                return (
                  <button
                    key={vehicle.id}
                    onClick={() => {
                      setSelectedVehicle(vehicle.id);
                      setShowVehicleSheet(false);
                      toast({ title: `${vehicle.name} selected` });
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`vehicle-option-${vehicle.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <VehicleIcon className="h-6 w-6" />
                      <span className="font-medium">{vehicle.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>

        <button
          onClick={async () => {
            if (isVerified && hasVehicle) {
              const wasOnline = isOnline;
              await toggleOnlineStatus();
              toast({ 
                title: wasOnline ? "You're now offline" : "You're now online",
                description: wasOnline ? "You won't receive new trip requests" : "Ready to receive trip requests"
              });
            }
          }}
          disabled={isUpdatingStatus || !isVerified || !hasVehicle}
          className={`flex items-center gap-2 h-14 md:h-[60px] px-6 rounded-full shadow-md transition-all ${
            isUpdatingStatus ? "opacity-70" : ""
          } bg-black text-white`}
          data-testid="button-online-toggle"
        >
          <Power 
            className={`h-5 w-5 ${isOnline ? "text-red-500" : "text-green-500"}`} 
          />
          <span className="font-semibold text-base whitespace-nowrap">
            {isUpdatingStatus 
              ? "Updating..." 
              : isOnline 
                ? "Go Offline" 
                : "Go Online"
            }
          </span>
        </button>

        <Sheet open={showQuickActionsSheet} onOpenChange={setShowQuickActionsSheet}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-2"
              data-testid="button-quick-actions"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Quick Actions</SheetTitle>
            </SheetHeader>
            <div className="py-6 space-y-2">
              <button
                onClick={() => {
                  setLocation("/driver/earnings");
                  setShowQuickActionsSheet(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-colors"
                data-testid="quick-action-earnings"
              >
                <DollarSign className="h-5 w-5" />
                <span className="font-medium">Earnings</span>
              </button>
              <button
                onClick={() => {
                  setLocation("/driver/trips");
                  setShowQuickActionsSheet(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-colors"
                data-testid="quick-action-history"
              >
                <History className="h-5 w-5" />
                <span className="font-medium">Trip History</span>
              </button>
              <button
                onClick={() => {
                  setLocation("/driver/wallet");
                  setShowQuickActionsSheet(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-colors"
                data-testid="quick-action-wallet"
              >
                <Wallet className="h-5 w-5" />
                <span className="font-medium">Wallet</span>
              </button>
              <button
                onClick={() => {
                  setLocation("/driver/settings");
                  setShowQuickActionsSheet(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-colors"
                data-testid="quick-action-settings"
              >
                <Settings className="h-5 w-5" />
                <span className="font-medium">Settings</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {incomingRequest && (
        <IncomingTripRequest
          request={incomingRequest}
          onAccept={handleAcceptTrip}
          onDecline={handleDeclineTrip}
          onExpire={handleExpireTrip}
          countdownSeconds={15}
        />
      )}
    </div>
  );
}
