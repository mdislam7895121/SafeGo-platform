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
    safego_comfort: boolean;
    safego_xl: boolean;
    safego_comfort_xl: boolean;
    safego_black: boolean;
    safego_black_suv: boolean;
    safego_premium: boolean;
    safego_bike: boolean;
    safego_cng: boolean;
    safego_moto: boolean;
    safego_pet: boolean;
  };
  foodEnabled: boolean;
  parcelEnabled: boolean;
}

type CountryCode = "US" | "BD";

interface ServiceCard {
  id: string;
  name: string;
  icon: any;
  category: "ride" | "food" | "parcel";
  preferenceKey: keyof ServicePreferences["rideTypes"] | "foodEnabled" | "parcelEnabled";
  enabledCountries: CountryCode[];
}

const SAFEGO_SERVICES: ServiceCard[] = [
  // US Standard Ride Types (SafeGo Go NOT included for US drivers per spec)
  { id: "safego_x", name: "SafeGo X", icon: Car, category: "ride", preferenceKey: "safego_x", enabledCountries: ["US"] },
  { id: "safego_comfort", name: "SafeGo Comfort", icon: Car, category: "ride", preferenceKey: "safego_comfort", enabledCountries: ["US"] },
  { id: "safego_xl", name: "SafeGo XL", icon: Truck, category: "ride", preferenceKey: "safego_xl", enabledCountries: ["US"] },
  { id: "safego_comfort_xl", name: "Comfort XL", icon: Truck, category: "ride", preferenceKey: "safego_comfort_xl", enabledCountries: ["US"] },
  { id: "safego_black", name: "SafeGo Black", icon: Crown, category: "ride", preferenceKey: "safego_black", enabledCountries: ["US"] },
  { id: "safego_black_suv", name: "Black SUV", icon: Crown, category: "ride", preferenceKey: "safego_black_suv", enabledCountries: ["US"] },
  { id: "safego_premium", name: "SafeGo Premium", icon: Crown, category: "ride", preferenceKey: "safego_premium", enabledCountries: ["US"] },
  { id: "safego_pet", name: "SafeGo Pet", icon: PawPrint, category: "ride", preferenceKey: "safego_pet", enabledCountries: ["US"] },
  // BD-Specific Ride Types (SafeGo Go included for BD drivers)
  { id: "safego_go", name: "SafeGo Go", icon: Car, category: "ride", preferenceKey: "safego_go", enabledCountries: ["BD"] },
  { id: "safego_bike", name: "SafeGo Bike", icon: Bike, category: "ride", preferenceKey: "safego_bike", enabledCountries: ["BD"] },
  { id: "safego_cng", name: "SafeGo CNG", icon: Zap, category: "ride", preferenceKey: "safego_cng", enabledCountries: ["BD"] },
  { id: "safego_moto", name: "SafeGo Moto", icon: Bike, category: "ride", preferenceKey: "safego_moto", enabledCountries: ["BD"] },
  // Common Services (available for both US and BD)
  { id: "safego_eats", name: "SafeGo Eats", icon: UtensilsCrossed, category: "food", preferenceKey: "foodEnabled", enabledCountries: ["US", "BD"] },
  { id: "safego_parcel", name: "SafeGo Parcel", icon: Package, category: "parcel", preferenceKey: "parcelEnabled", enabledCountries: ["US", "BD"] },
];

const defaultServicePreferences: ServicePreferences = {
  rideTypes: {
    safego_go: true,
    safego_x: true,
    safego_comfort: true,
    safego_xl: true,
    safego_comfort_xl: true,
    safego_black: true,
    safego_black_suv: true,
    safego_premium: true,
    safego_bike: true,
    safego_cng: true,
    safego_moto: true,
    safego_pet: true,
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

// Demo mode types and data
interface DemoTrip {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  status: string;
  tripCode: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
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

const DEMO_RIDE_REQUEST: TripRequest = {
  id: "demo-ride-001",
  serviceType: "RIDE",
  customerName: "Sarah Johnson",
  customerRating: 4.8,
  pickupAddress: "350 5th Ave, New York, NY 10118",
  pickupLat: 40.7484,
  pickupLng: -73.9857,
  dropoffAddress: "30 Rockefeller Plaza, New York, NY 10112",
  dropoffLat: 40.7587,
  dropoffLng: -73.9787,
  estimatedFare: 18.50,
  distanceToPickup: 1.2,
  etaMinutes: 5,
  surgeMultiplier: 1.2,
  boostAmount: 2.00,
  requestedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 15000).toISOString(),
};

const DEMO_FOOD_REQUEST: TripRequest = {
  id: "demo-food-001",
  serviceType: "FOOD",
  customerName: "Mike Chen",
  customerRating: 4.9,
  pickupAddress: "Joe's Pizza - 233 Bleecker St, New York, NY",
  pickupLat: 40.7318,
  pickupLng: -74.0033,
  dropoffAddress: "85 Washington Place, New York, NY 10011",
  dropoffLat: 40.7328,
  dropoffLng: -73.9990,
  estimatedFare: 12.75,
  distanceToPickup: 0.8,
  etaMinutes: 3,
  surgeMultiplier: null,
  boostAmount: 1.50,
  requestedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 15000).toISOString(),
};

const createDemoTrip = (request: TripRequest): DemoTrip => ({
  id: request.id,
  serviceType: request.serviceType,
  status: "accepted",
  tripCode: request.serviceType === "RIDE" ? "SGR-DEMO1" : "SGE-DEMO1",
  pickupAddress: request.pickupAddress,
  pickupLat: request.pickupLat || 40.7484,
  pickupLng: request.pickupLng || -73.9857,
  dropoffAddress: request.dropoffAddress,
  dropoffLat: request.dropoffLat || 40.7587,
  dropoffLng: request.dropoffLng || -73.9787,
  estimatedArrivalMinutes: request.etaMinutes || 5,
  estimatedTripMinutes: 12,
  distanceKm: 3.5,
  fare: request.estimatedFare,
  customer: {
    firstName: request.customerName.split(" ")[0],
    lastName: request.customerName.split(" ")[1] || "",
    phone: "+1 (555) 123-4567",
    rating: request.customerRating || 4.5,
  },
  restaurantName: request.serviceType === "FOOD" ? "Joe's Pizza" : undefined,
  rideType: request.serviceType === "RIDE" ? "SafeGo X" : undefined,
});

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
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [incomingRequest, setIncomingRequest] = useState<TripRequest | null>(null);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [showQuickActionsSheet, setShowQuickActionsSheet] = useState(false);
  const [showSosSheet, setShowSosSheet] = useState(false);
  const [servicePreferences, setServicePreferences] = useState<ServicePreferences>(defaultServicePreferences);
  
  // Demo mode state
  const [demoMode, setDemoMode] = useState(false);
  const [demoTrip, setDemoTrip] = useState<DemoTrip | null>(null);
  const [demoPhase, setDemoPhase] = useState<"idle" | "ride_request" | "ride_active" | "ride_complete" | "food_request" | "food_active" | "food_complete" | "finished">("idle");
  const [demoIsOnline, setDemoIsOnline] = useState(false);

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
      return await apiRequest("/api/driver/preferences/services", {
        method: "PATCH",
        body: JSON.stringify(newPrefs),
        headers: { "Content-Type": "application/json" },
      });
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

  // Toggle a service preference with validation
  const toggleServicePreference = useCallback((service: ServiceCard) => {
    const currentValue = service.category === "ride" 
      ? servicePreferences.rideTypes[service.preferenceKey as keyof ServicePreferences["rideTypes"]]
      : servicePreferences[service.preferenceKey as "foodEnabled" | "parcelEnabled"];
    
    const newValue = !currentValue;
    
    // Validate: At least one trip type must remain enabled
    if (currentValue && !newValue) {
      // Count currently enabled services
      const enabledRideTypes = Object.values(servicePreferences.rideTypes).filter(Boolean).length;
      const totalEnabled = enabledRideTypes + 
        (servicePreferences.foodEnabled ? 1 : 0) + 
        (servicePreferences.parcelEnabled ? 1 : 0);
      
      if (totalEnabled <= 1) {
        toast({
          title: "Cannot disable",
          description: "You must keep at least one trip type on to receive rides.",
          variant: "destructive",
        });
        triggerHapticFeedback("heavy");
        return;
      }
    }
    
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
  }, [servicePreferences, updateServicePrefsMutation, toast]);

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

  // Get driver's country and filter services accordingly
  const driverCountry = (profile?.countryCode as CountryCode) || "US";
  const filteredServices = useMemo(() => {
    return SAFEGO_SERVICES.filter(service => 
      service.enabledCountries.includes(driverCountry)
    );
  }, [driverCountry]);

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
    setRecenterTrigger(prev => prev + 1);
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

  // Demo mode handlers
  const startDemo = useCallback(() => {
    setDemoMode(true);
    setDemoIsOnline(true);
    setDemoPhase("ride_request");
    // Show ride request after a short delay
    setTimeout(() => {
      setIncomingRequest({
        ...DEMO_RIDE_REQUEST,
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15000).toISOString(),
      });
    }, 500);
    toast({ 
      title: "Demo Mode Started", 
      description: "Simulating a ride request..." 
    });
    triggerHapticFeedback("medium");
  }, [toast]);

  const handleDemoAccept = useCallback((tripId: string, serviceType: string) => {
    setIncomingRequest(null);
    const request = serviceType === "FOOD" ? DEMO_FOOD_REQUEST : DEMO_RIDE_REQUEST;
    const trip = createDemoTrip(request);
    setDemoTrip(trip);
    
    if (serviceType === "RIDE") {
      setDemoPhase("ride_active");
      toast({ 
        title: "Ride Accepted!", 
        description: "Demo: Navigate to pickup location" 
      });
    } else {
      setDemoPhase("food_active");
      toast({ 
        title: "Delivery Accepted!", 
        description: "Demo: Navigate to restaurant" 
      });
    }
    triggerHapticFeedback("heavy");
  }, [toast]);

  const handleDemoDecline = useCallback((tripId: string, serviceType: string, reason?: string) => {
    setIncomingRequest(null);
    toast({ title: "Request Declined" });
    // Move to next phase or reset
    if (demoPhase === "ride_request") {
      setDemoPhase("food_request");
      setTimeout(() => {
        setIncomingRequest({
          ...DEMO_FOOD_REQUEST,
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15000).toISOString(),
        });
      }, 500);
    } else {
      setDemoPhase("finished");
      setDemoMode(false);
      setDemoIsOnline(false);
    }
  }, [demoPhase, toast]);

  const handleDemoExpire = useCallback((tripId: string) => {
    setIncomingRequest(null);
    // Move to next phase
    if (demoPhase === "ride_request") {
      setDemoPhase("food_request");
      setTimeout(() => {
        setIncomingRequest({
          ...DEMO_FOOD_REQUEST,
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15000).toISOString(),
        });
      }, 500);
    } else {
      setDemoPhase("finished");
      setDemoMode(false);
      setDemoIsOnline(false);
    }
  }, [demoPhase]);

  const advanceDemoTrip = useCallback(() => {
    if (!demoTrip) return;
    
    const statusProgression: Record<string, Record<string, string>> = {
      RIDE: {
        accepted: "arrived",
        arrived: "started",
        started: "completed",
      },
      FOOD: {
        accepted: "at_restaurant",
        at_restaurant: "picked_up",
        picked_up: "completed",
      },
    };
    
    const nextStatus = statusProgression[demoTrip.serviceType]?.[demoTrip.status];
    
    if (nextStatus === "completed") {
      setDemoTrip(null);
      
      if (demoPhase === "ride_active") {
        setDemoPhase("ride_complete");
        toast({ 
          title: "Ride Completed!", 
          description: `Demo earnings: $${DEMO_RIDE_REQUEST.estimatedFare.toFixed(2)}` 
        });
        // After showing completion, trigger food delivery
        setTimeout(() => {
          setDemoPhase("food_request");
          setIncomingRequest({
            ...DEMO_FOOD_REQUEST,
            requestedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15000).toISOString(),
          });
          toast({ 
            title: "New Delivery Request!", 
            description: "A food delivery is waiting..." 
          });
        }, 2000);
      } else if (demoPhase === "food_active") {
        setDemoPhase("food_complete");
        toast({ 
          title: "Delivery Completed!", 
          description: `Demo earnings: $${DEMO_FOOD_REQUEST.estimatedFare.toFixed(2)}` 
        });
        // End demo after food delivery
        setTimeout(() => {
          setDemoPhase("finished");
          setDemoMode(false);
          setDemoIsOnline(false);
          toast({ 
            title: "Demo Complete!", 
            description: `Total demo earnings: $${(DEMO_RIDE_REQUEST.estimatedFare + DEMO_FOOD_REQUEST.estimatedFare).toFixed(2)}` 
          });
        }, 2000);
      }
      return;
    }
    
    if (nextStatus) {
      setDemoTrip({ ...demoTrip, status: nextStatus });
      const statusLabels: Record<string, string> = {
        arrived: "You've arrived at pickup!",
        started: "Trip started - driving to destination",
        at_restaurant: "Arrived at restaurant",
        picked_up: "Order picked up - heading to customer",
      };
      toast({ title: statusLabels[nextStatus] || `Status: ${nextStatus}` });
      triggerHapticFeedback("medium");
    }
  }, [demoTrip, demoPhase, toast]);

  const stopDemo = useCallback(() => {
    setDemoMode(false);
    setDemoPhase("idle");
    setDemoTrip(null);
    setDemoIsOnline(false);
    setIncomingRequest(null);
    toast({ title: "Demo Mode Ended" });
  }, [toast]);

  // Get current status label for demo trip
  const getDemoStatusLabel = (): string => {
    if (!demoTrip) return "";
    const labels: Record<string, Record<string, string>> = {
      RIDE: {
        accepted: "Navigate to Pickup",
        arrived: "Waiting for Rider",
        started: "On Trip",
      },
      FOOD: {
        accepted: "Navigate to Restaurant",
        at_restaurant: "Waiting for Order",
        picked_up: "Delivering to Customer",
      },
    };
    return labels[demoTrip.serviceType]?.[demoTrip.status] || demoTrip.status;
  };

  const getDemoActionLabel = (): string => {
    if (!demoTrip) return "";
    const labels: Record<string, Record<string, string>> = {
      RIDE: {
        accepted: "I've Arrived",
        arrived: "Start Trip",
        started: "Complete Trip",
      },
      FOOD: {
        accepted: "At Restaurant",
        at_restaurant: "Picked Up Order",
        picked_up: "Delivered",
      },
    };
    return labels[demoTrip.serviceType]?.[demoTrip.status] || "Next";
  };

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
          recenterTrigger={recenterTrigger}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  {filteredServices.map((service) => {
                    const ServiceIcon = service.icon;
                    const isEnabled = isServiceEnabled(service);
                    const isUpdating = updateServicePrefsMutation.isPending;
                    
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleServicePreference(service)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleServicePreference(service);
                          }
                        }}
                        disabled={isUpdating}
                        aria-pressed={isEnabled}
                        aria-label={`${service.name} - ${isEnabled ? 'enabled' : 'disabled'}`}
                        className={`trip-preference-card relative flex flex-col items-center justify-center gap-1.5 h-[85px] sm:h-[85px] rounded-[14px] transition-all duration-[250ms] ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3E8BF7] focus:ring-offset-2 focus:ring-offset-black ${
                          isEnabled 
                            ? "bg-[rgba(62,139,247,0.18)] border-2 border-[#3E8BF7] shadow-[0_0_6px_rgba(62,139,247,0.55)]" 
                            : "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)] hover:-translate-y-[1px]"
                        } ${isUpdating ? "opacity-60" : ""}`}
                        style={{ padding: '12px 10px' }}
                        data-testid={`service-card-${service.id}`}
                      >
                        <div 
                          className={`absolute top-2 right-2 w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors ${
                            isEnabled 
                              ? "bg-[#3E8BF7]" 
                              : "border border-[rgba(255,255,255,0.3)]"
                          }`}
                        >
                          {isEnabled && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        
                        <ServiceIcon className={`h-[22px] w-[22px] ${isEnabled ? "text-[#3E8BF7]" : "text-[rgba(255,255,255,0.75)]"}`} />
                        
                        <span className={`text-[13.5px] text-center leading-tight ${
                          isEnabled ? "font-semibold text-white" : "font-medium text-white"
                        }`}>
                          {service.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                <div className="mt-5 px-1">
                  <p className="text-[rgba(255,255,255,0.4)] text-xs text-center">
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
          <SheetContent side="bottom" className="rounded-t-2xl z-[1010] bg-black border-t-0">
            <SheetHeader className="pb-3">
              <SheetTitle className="text-white text-xl font-semibold">Trip Preferences</SheetTitle>
            </SheetHeader>
            <div className="pb-6">
              <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {filteredServices.map((service) => {
                  const ServiceIcon = service.icon;
                  const isEnabled = isServiceEnabled(service);
                  const isUpdating = updateServicePrefsMutation.isPending;
                  
                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleServicePreference(service)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleServicePreference(service);
                        }
                      }}
                      disabled={isUpdating}
                      aria-pressed={isEnabled}
                      aria-label={`${service.name} - ${isEnabled ? 'enabled' : 'disabled'}`}
                      className={`trip-preference-card relative flex flex-col items-center justify-center gap-1.5 h-[75px] sm:h-[85px] rounded-[14px] transition-all duration-[250ms] ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3E8BF7] focus:ring-offset-2 focus:ring-offset-black ${
                        isEnabled 
                          ? "bg-[rgba(62,139,247,0.18)] border-2 border-[#3E8BF7] shadow-[0_0_6px_rgba(62,139,247,0.55)]" 
                          : "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)] hover:-translate-y-[1px]"
                      } ${isUpdating ? "opacity-60" : ""}`}
                      style={{ padding: '12px 10px' }}
                      data-testid={`quick-service-card-${service.id}`}
                    >
                      <div 
                        className={`absolute top-2 right-2 w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors ${
                          isEnabled 
                            ? "bg-[#3E8BF7]" 
                            : "border border-[rgba(255,255,255,0.3)]"
                        }`}
                      >
                        {isEnabled && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      
                      <ServiceIcon className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${isEnabled ? "text-[#3E8BF7]" : "text-[rgba(255,255,255,0.75)]"}`} />
                      
                      <span className={`text-xs sm:text-[13.5px] text-center leading-tight ${
                        isEnabled ? "font-semibold text-white" : "font-medium text-white"
                      }`}>
                        {service.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              <p className="text-[rgba(255,255,255,0.4)] text-xs text-center mb-4">
                Toggle services to control which trip types you receive.
              </p>
              
              <button
                onClick={() => {
                  setLocation("/driver/trips");
                  setShowQuickActionsSheet(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-[14px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)] transition-all duration-[250ms]"
                data-testid="quick-action-history"
              >
                <History className="h-5 w-5 text-[rgba(255,255,255,0.75)]" />
                <span className="font-medium text-white">Trip History</span>
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
          className="go-online-button"
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
          onAccept={demoMode ? handleDemoAccept : handleAcceptTrip}
          onDecline={demoMode ? handleDemoDecline : handleDeclineTrip}
          onExpire={demoMode ? handleDemoExpire : handleExpireTrip}
          countdownSeconds={15}
        />
      )}

      {/* Demo Mode Trip Panel */}
      <AnimatePresence>
        {demoMode && demoTrip && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-[1002]"
            data-testid="demo-trip-panel"
          >
            <div className="bg-background border-t shadow-lg rounded-t-2xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-full ${demoTrip.serviceType === "RIDE" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                  {demoTrip.serviceType === "RIDE" ? (
                    <Car className={`h-5 w-5 text-blue-600 dark:text-blue-400`} />
                  ) : (
                    <UtensilsCrossed className={`h-5 w-5 text-orange-600 dark:text-orange-400`} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{demoTrip.serviceType === "RIDE" ? "Demo Ride" : "Demo Delivery"}</p>
                  <p className="text-sm text-muted-foreground">{getDemoStatusLabel()}</p>
                </div>
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  DEMO
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500 mt-1" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm font-medium">{demoTrip.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500 mt-1" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-sm font-medium">{demoTrip.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={stopDemo}
                  data-testid="button-stop-demo"
                >
                  End Demo
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={advanceDemoTrip}
                  data-testid="button-demo-advance"
                >
                  {getDemoActionLabel()}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo Mode Button - Shows when offline and no active trip */}
      {!isOnline && !activeTrip && !demoMode && !incomingRequest && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000]"
        >
          <Button
            variant="outline"
            onClick={startDemo}
            className="bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 shadow-lg"
            data-testid="button-start-demo"
          >
            <Zap className="h-4 w-4 mr-2" />
            Start Demo
          </Button>
        </motion.div>
      )}

      {/* Demo Mode Status Badge */}
      {demoMode && !demoTrip && !incomingRequest && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-24 left-1/2 -translate-x-1/2 z-[999]"
        >
          <Badge variant="secondary" className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-md">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Demo: Waiting for trip...
          </Badge>
        </motion.div>
      )}
    </div>
  );
}
