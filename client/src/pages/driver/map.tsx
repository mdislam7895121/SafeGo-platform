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
  Truck,
  Crown,
  PawPrint,
  Zap,
  Grid3X3,
  CheckSquare,
  Square,
  User,
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

// SafeGo Service Types Configuration
interface ServicePreferences {
  rideTypes: {
    safego_go: boolean;
    safego_x: boolean;
    safego_xl: boolean;
    safego_premium: boolean;
    safego_bike: boolean;
    safego_cng: boolean;
    safego_moto: boolean;
    safego_pet: boolean;
  };
  foodEnabled: boolean;
  parcelEnabled: boolean;
}

interface ServiceCard {
  id: string;
  name: string;
  icon: any;
  category: "ride" | "food" | "parcel";
  preferenceKey: keyof ServicePreferences["rideTypes"] | "foodEnabled" | "parcelEnabled";
}

const SAFEGO_SERVICES: ServiceCard[] = [
  { id: "safego_go", name: "SafeGo Go", icon: Car, category: "ride", preferenceKey: "safego_go" },
  { id: "safego_x", name: "SafeGo X", icon: Car, category: "ride", preferenceKey: "safego_x" },
  { id: "safego_xl", name: "SafeGo XL", icon: Truck, category: "ride", preferenceKey: "safego_xl" },
  { id: "safego_premium", name: "SafeGo Premium", icon: Crown, category: "ride", preferenceKey: "safego_premium" },
  { id: "safego_bike", name: "SafeGo Bike", icon: Bike, category: "ride", preferenceKey: "safego_bike" },
  { id: "safego_cng", name: "SafeGo CNG", icon: Zap, category: "ride", preferenceKey: "safego_cng" },
  { id: "safego_moto", name: "SafeGo Moto", icon: Bike, category: "ride", preferenceKey: "safego_moto" },
  { id: "safego_pet", name: "SafeGo Pet", icon: PawPrint, category: "ride", preferenceKey: "safego_pet" },
  { id: "safego_eats", name: "SafeGo Eats", icon: UtensilsCrossed, category: "food", preferenceKey: "foodEnabled" },
  { id: "safego_parcel", name: "SafeGo Parcel", icon: Package, category: "parcel", preferenceKey: "parcelEnabled" },
];

const defaultServicePreferences: ServicePreferences = {
  rideTypes: {
    safego_go: true,
    safego_x: true,
    safego_xl: false,
    safego_premium: false,
    safego_bike: false,
    safego_cng: false,
    safego_moto: false,
    safego_pet: false,
  },
  foodEnabled: true,
  parcelEnabled: true,
};

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
  
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [liveEta, setLiveEta] = useState<number | null>(null);
  const [showTripPanel, setShowTripPanel] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [autoFollowEnabled, setAutoFollowEnabled] = useState(true);
  const [incomingRequest, setIncomingRequest] = useState<TripRequest | null>(null);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [showQuickActionsSheet, setShowQuickActionsSheet] = useState(false);
  const [showSosSheet, setShowSosSheet] = useState(false);
  const [servicePreferences, setServicePreferences] = useState<ServicePreferences>(defaultServicePreferences);

  // Fetch service preferences from API
  const { data: preferencesData, isLoading: isLoadingPrefs } = useQuery<{
    preferences: ServicePreferences;
    lockedPreferences: any;
  }>({
    queryKey: ["/api/driver/preferences/services"],
    enabled: true,
  });

  // Update local state when API data loads
  useEffect(() => {
    if (preferencesData?.preferences) {
      setServicePreferences(preferencesData.preferences);
    }
  }, [preferencesData]);

  // Mutation to update service preferences
  const updateServicePrefsMutation = useMutation({
    mutationFn: async (newPrefs: Partial<ServicePreferences>) => {
      const response = await apiRequest("/api/driver/preferences/services", {
        method: "PATCH",
        body: JSON.stringify(newPrefs),
        headers: { "Content-Type": "application/json" },
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.preferences) {
        setServicePreferences(data.preferences);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences/services"] });
      toast({ title: "Preferences updated" });
      if (data.warning) {
        toast({ 
          title: "Warning", 
          description: data.warning,
          variant: "destructive" 
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Failed to update preferences", 
        variant: "destructive" 
      });
    },
  });

  // Toggle a service preference
  const toggleServicePreference = useCallback((service: ServiceCard) => {
    const currentValue = service.category === "ride" 
      ? servicePreferences.rideTypes[service.preferenceKey as keyof ServicePreferences["rideTypes"]]
      : servicePreferences[service.preferenceKey as "foodEnabled" | "parcelEnabled"];
    
    const newValue = !currentValue;
    
    if (service.category === "ride") {
      updateServicePrefsMutation.mutate({
        rideTypes: {
          ...servicePreferences.rideTypes,
          [service.preferenceKey]: newValue,
        },
      });
    } else {
      updateServicePrefsMutation.mutate({
        [service.preferenceKey]: newValue,
      });
    }
    
    triggerHapticFeedback("light");
  }, [servicePreferences, updateServicePrefsMutation]);

  // Check if a service is enabled
  const isServiceEnabled = useCallback((service: ServiceCard): boolean => {
    if (service.category === "ride") {
      return servicePreferences.rideTypes[service.preferenceKey as keyof ServicePreferences["rideTypes"]] ?? false;
    }
    return servicePreferences[service.preferenceKey as "foodEnabled" | "parcelEnabled"] ?? false;
  }, [servicePreferences]);

  // Check if any service is enabled (for blocking toast when going online)
  const hasAnyServiceEnabled = useMemo(() => {
    const hasRideEnabled = Object.values(servicePreferences.rideTypes).some(v => v);
    return hasRideEnabled || servicePreferences.foodEnabled || servicePreferences.parcelEnabled;
  }, [servicePreferences]);

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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative" data-testid="driver-map-view">
      <div className="flex-1 relative">
        <SafeGoMap
          center={mapCenter}
          zoom={17}
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
            className="absolute top-4 left-4 right-4 z-[1000]"
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

        {/* Right side control buttons - Safety and Recenter */}
        <div className="absolute right-6 bottom-[120px] z-[1000] flex flex-col gap-2">
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
            <SheetContent side="bottom" className="rounded-t-2xl z-[1010]">
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

        {/* Floating footer buttons - absolute positioning within map container */}
        <Sheet open={showServiceSheet} onOpenChange={setShowServiceSheet}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-6 left-6 h-12 w-12 rounded-full border-2 shadow-lg bg-background z-[1000]"
              data-testid="button-service-select"
            >
              <Grid3X3 className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="w-[320px] sm:w-[380px] bg-black border-r-0 p-0 z-[1010]"
            data-testid="service-selection-drawer"
          >
            <div className="flex flex-col h-full">
              <SheetHeader className="px-5 pt-6 pb-4">
                <SheetTitle className="text-white text-xl font-semibold">Trip Preferences</SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <div className="grid grid-cols-2 gap-3">
                  {SAFEGO_SERVICES.map((service) => {
                    const ServiceIcon = service.icon;
                    const isEnabled = isServiceEnabled(service);
                    const isUpdating = updateServicePrefsMutation.isPending;
                    
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleServicePreference(service)}
                        disabled={isUpdating}
                        className={`relative flex flex-col items-center justify-center p-4 h-[140px] rounded-[20px] transition-all duration-200 ${
                          isEnabled 
                            ? "bg-[#181818] border-2 border-white" 
                            : "bg-[#101010] border border-[#333] hover:border-[#555]"
                        } ${isUpdating ? "opacity-60" : ""}`}
                        data-testid={`service-card-${service.id}`}
                      >
                        <div 
                          className={`absolute top-3 right-3 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            isEnabled 
                              ? "bg-white" 
                              : "border border-[#555]"
                          }`}
                        >
                          {isEnabled && <Check className="h-3.5 w-3.5 text-black" />}
                        </div>
                        
                        <div className="flex-1 flex items-center justify-center">
                          <ServiceIcon className={`h-10 w-10 ${isEnabled ? "text-white" : "text-gray-500"}`} />
                        </div>
                        
                        <span className={`text-sm font-medium text-center mt-2 ${
                          isEnabled ? "text-white" : "text-gray-500"
                        }`}>
                          {service.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                <div className="mt-6 px-1">
                  <p className="text-[#666] text-xs text-center">
                    Toggle services to control which trip types you receive. 
                    Changes are saved automatically.
                  </p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Right Footer Button - Quick Actions (mirror of left button) */}
        <Sheet open={showQuickActionsSheet} onOpenChange={setShowQuickActionsSheet}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-6 right-6 h-12 w-12 rounded-full border-2 shadow-lg bg-background z-[1000]"
              data-testid="button-quick-actions"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl z-[1010]">
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
                  setLocation("/driver/profile");
                  setShowQuickActionsSheet(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-colors"
                data-testid="quick-action-profile"
              >
                <User className="h-5 w-5" />
                <span className="font-medium">Profile</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Go Online/Offline Button - Uber-style pure black pill */}
        <button
          onClick={() => {
            if (!isVerified) {
              toast({ 
                title: "Account not verified",
                description: "Please complete verification to go online",
                variant: "destructive"
              });
              return;
            }
            if (!hasVehicle) {
              toast({ 
                title: "No vehicle assigned",
                description: "Please add a vehicle to go online",
                variant: "destructive"
              });
              return;
            }
            if (!isOnline && !hasAnyServiceEnabled) {
              toast({ 
                title: "No trip types enabled",
                description: "Turn on at least one service to receive requests",
                variant: "destructive"
              });
              setShowServiceSheet(true);
              return;
            }
            toggleOnlineStatus();
          }}
          disabled={isUpdatingStatus}
          style={{
            position: "absolute",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            height: "56px",
            paddingLeft: "32px",
            paddingRight: "32px",
            borderRadius: "9999px",
            backgroundColor: "#000000",
            border: "none",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.28)",
            zIndex: 1000,
            cursor: isUpdatingStatus || !isVerified || !hasVehicle ? "not-allowed" : "pointer",
            opacity: isUpdatingStatus || !isVerified || !hasVehicle ? 0.7 : 1,
          }}
          data-testid="button-online-toggle"
        >
          <Power 
            style={{ 
              width: "20px", 
              height: "20px", 
              color: isOnline ? "#FF3B30" : "#00E676",
              flexShrink: 0,
            }}
          />
          <span 
            style={{ 
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {isUpdatingStatus 
              ? "Updating..." 
              : isOnline 
                ? "Go Offline" 
                : "Go Online"
            }
          </span>
        </button>
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
