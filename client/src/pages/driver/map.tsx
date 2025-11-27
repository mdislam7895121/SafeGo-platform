import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  Crosshair,
  Layers,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { SafeGoMap, type ActiveLeg, type MapLocation } from "@/components/maps/SafeGoMap";
import { useDriverNavigation } from "@/hooks/useDriverNavigation";
import {
  NavigationProvider,
  NAVIGATION_PROVIDERS,
  isExternalProvider,
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

export default function DriverMapPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const tripIdFromUrl = new URLSearchParams(searchParams).get("tripId");
  
  const [driverPosition, setDriverPosition] = useState<MapLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [liveEta, setLiveEta] = useState<number | null>(null);
  const [showTripPanel, setShowTripPanel] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [autoFollowEnabled, setAutoFollowEnabled] = useState(true);

  const { data: activeTripData, isLoading, error } = useQuery<{
    activeTrip: ActiveTrip | null;
    hasActiveTrip: boolean;
  }>({
    queryKey: ["/api/driver/trips/active"],
    refetchInterval: 5000,
  });

  const activeTrip = activeTripData?.activeTrip;

  const {
    preferences,
    providers,
    currentProvider,
    showTraffic,
    autoRecalculate,
    setPreference,
    openInExternalMap,
    toggleTrafficLayer,
    logNavigationEvent,
    isHeadingToPickup,
    targetCoordinates,
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
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setDriverPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading ?? undefined,
        });
        setGpsError(null);
      },
      (err) => {
        console.warn("GPS error:", err.message);
        setGpsError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
    (provider: NavigationProvider) => {
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

      openInExternalMap(provider);
    },
    [activeTrip, setPreference, openInExternalMap, toast]
  );

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

        {gpsError && (
          <div
            className="absolute top-20 left-3 right-3 z-[1000]"
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

        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
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

        {!activeTrip && (
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]"
            data-testid="no-active-trip-banner"
          >
            <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
              <CardContent className="p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Signal className="h-5 w-5 text-green-500 animate-pulse" />
                  <span className="font-semibold">You're Online</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Waiting for trip requests...
                </p>
              </CardContent>
            </Card>
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
    </div>
  );
}
