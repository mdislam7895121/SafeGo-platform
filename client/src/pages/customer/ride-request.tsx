import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation, Crosshair, Loader2, Clock, Home, Briefcase, Star, ChevronRight, CreditCard, Wallet, AlertCircle, Car, Route as RouteIcon, Users, Crown, Sparkles, Zap, Accessibility } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  VEHICLE_CATEGORIES, 
  VEHICLE_CATEGORY_ORDER, 
  type VehicleCategoryId,
  type VehicleCategoryConfig 
} from "@shared/vehicleCategories";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { 
  reverseGeocode, 
  getSavedPlaces, 
  getRecentLocations,
  addRecentLocation,
  type SavedPlace,
  type RecentLocation
} from "@/lib/locationService";
import { 
  formatDurationMinutes, 
  getTrafficLevel, 
  getTrafficLevelLabel, 
  decodePolyline 
} from "@/lib/formatters";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getVehicleCategoryImage } from "@/lib/vehicleMedia";
import { FareDetailsAccordion, type FareBreakdownDetails } from "@/components/ride/FareDetailsAccordion";
import { useCategoryAvailability } from "@/hooks/useCategoryAvailability";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

interface RouteData {
  id: number;
  summary: string;
  polyline: string;
  distanceMeters: number;
  distanceMiles: number;
  distanceText: string;
  durationSeconds: number;
  durationInTrafficSeconds: number;
  durationText: string;
  durationInTrafficText: string;
  startAddress: string;
  endAddress: string;
}

interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  taxesAndSurcharges: number;
  minimumFareAdjustment: number;
  subtotal: number;
  totalFare: number;
  originalFare: number;
  discountAmount: number;
  finalFare: number;
  promoCode: string | null;
  promoLabel: string | null;
  currency: string;
  etaMinutes: number;
  etaWithTrafficMinutes: number;
  distanceKm: number;
  distanceMiles: number;
  perMileRate: number;
  perMinuteRate: number;
  trafficLevel: "light" | "moderate" | "heavy";
  trafficLabel: string;
}

interface AppliedPromo {
  id: string;
  code: string;
  discountPercent: number;
  discountFlat?: number;
  discountType: "PERCENT" | "FLAT";
  maxDiscountAmount: number | null;
  label: string;
  description: string | null;
  isDefault: boolean;
}

interface BackendPromo {
  id: string;
  name: string;
  description: string | null;
  discountType: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount: number | null;
  appliesTo: string;
  targetCities: string[];
  targetCategories: string[];
  userRule: string;
  maxSurgeAllowed: number | null;
  isDefault: boolean;
  priority: number;
}

function getVehicleCategoryIcon(iconType: VehicleCategoryConfig["iconType"]) {
  switch (iconType) {
    case "comfort":
      return Sparkles;
    case "xl":
      return Users;
    case "premium":
      return Crown;
    case "suv":
      return Users;
    case "accessible":
      return Accessibility;
    case "economy":
    default:
      return Car;
  }
}

const ACTIVE_VEHICLE_CATEGORIES = VEHICLE_CATEGORY_ORDER.filter(
  (id) => VEHICLE_CATEGORIES[id].isActive
);

function createPickupIcon() {
  if (typeof window === "undefined") return null;
  return L.divIcon({
    className: "safego-pickup-icon",
    html: `<div style="
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="color: white; font-weight: bold; font-size: 14px;">A</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createDropoffIcon() {
  if (typeof window === "undefined") return null;
  return L.divIcon({
    className: "safego-dropoff-icon",
    html: `<div style="
      background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="color: white; font-weight: bold; font-size: 14px;">B</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function MapBoundsHandler({ 
  pickupLocation, 
  dropoffLocation 
}: { 
  pickupLocation: LocationData | null;
  dropoffLocation: LocationData | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    if (pickupLocation && dropoffLocation) {
      const bounds = L.latLngBounds(
        [pickupLocation.lat, pickupLocation.lng],
        [dropoffLocation.lat, dropoffLocation.lng]
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (pickupLocation) {
      map.setView([pickupLocation.lat, pickupLocation.lng], 15);
    } else if (dropoffLocation) {
      map.setView([dropoffLocation.lat, dropoffLocation.lng], 15);
    }
  }, [map, pickupLocation, dropoffLocation]);

  return null;
}

function SuggestionItem({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  onClick,
  testId,
  disabled = false,
}: {
  icon: typeof Home;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 p-3 rounded-lg hover-elevate text-left ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      <div className={`h-10 w-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

export default function RideRequest() {
  const [, setRouterLocation] = useLocation();
  const { toast } = useToast();
  
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [focusedField, setFocusedField] = useState<"pickup" | "dropoff" | null>(null);
  
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [isClient, setIsClient] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [pickupIcon, setPickupIcon] = useState<any>(null);
  const [dropoffIcon, setDropoffIcon] = useState<any>(null);
  
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<number>(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeFetchCompleted, setRouteFetchCompleted] = useState(false);
  const [selectedVehicleCategory, setSelectedVehicleCategory] = useState<VehicleCategoryId>("SAFEGO_X");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [availablePromos, setAvailablePromos] = useState<BackendPromo[]>([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);
  const [isMapsReady, setIsMapsReady] = useState(false);

  const { 
    getAvailability, 
    getETA, 
    isUnavailable: checkUnavailable, 
    isLimited: checkLimited,
    isLoading: isLoadingAvailability 
  } = useCategoryAvailability({
    pickupLat: pickup?.lat ?? null,
    pickupLng: pickup?.lng ?? null,
    enabled: !!pickup,
    refreshIntervalMs: 30000,
  });

  const activeRoute = useMemo(() => routes.find(r => r.id === activeRouteId), [routes, activeRouteId]);
  
  const routePolylines = useMemo(() => {
    if (typeof window === "undefined" || !routes.length) return [];
    return routes.map(route => ({
      id: route.id,
      points: decodePolyline(route.polyline),
    }));
  }, [routes]);

  // Read pickup/destination from sessionStorage (passed from home page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsClient(true);
    setSavedPlaces(getSavedPlaces());
    setRecentLocations(getRecentLocations());
    
    setPickupIcon(createPickupIcon());
    setDropoffIcon(createDropoffIcon());
    
    // Restore pickup and destination from sessionStorage if available
    try {
      const storedPickup = sessionStorage.getItem("safego_ride_pickup");
      const storedDestination = sessionStorage.getItem("safego_ride_destination");
      
      if (storedPickup) {
        const pickupData = JSON.parse(storedPickup);
        console.log("[RideRequest] Restored pickup from sessionStorage:", pickupData);
        setPickup(pickupData);
        setPickupQuery(pickupData.address || pickupData.name || "");
        setMapCenter({ lat: pickupData.lat, lng: pickupData.lng });
      }
      
      if (storedDestination) {
        const destData = JSON.parse(storedDestination);
        console.log("[RideRequest] Restored destination from sessionStorage:", destData);
        setDropoff(destData);
        setDropoffQuery(destData.address || destData.name || "");
        
        // If we have both, center map on midpoint
        if (storedPickup) {
          const pickupData = JSON.parse(storedPickup);
          setMapCenter({
            lat: (pickupData.lat + destData.lat) / 2,
            lng: (pickupData.lng + destData.lng) / 2,
          });
        }
      }
      
      // Clear sessionStorage after reading to avoid stale data on refresh
      // Only clear if we successfully restored both locations
      if (storedPickup && storedDestination) {
        // Don't clear immediately - the route info might still be needed
        // sessionStorage.removeItem("safego_ride_pickup");
        // sessionStorage.removeItem("safego_ride_destination");
        // sessionStorage.removeItem("safego_ride_route");
      }
    } catch (e) {
      console.warn("[RideRequest] Failed to restore locations from sessionStorage:", e);
    }
    
    // Mark that we've checked storage so we can auto-detect location if needed
    setHasCheckedStorage(true);
  }, []);

  // Check when Google Maps SDK becomes ready and set state
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if already loaded
    if (typeof google !== "undefined" && google.maps && google.maps.DirectionsService) {
      setIsMapsReady(true);
      return;
    }
    
    // Poll for SDK availability
    const checkMapsReady = setInterval(() => {
      if (typeof google !== "undefined" && google.maps && google.maps.DirectionsService) {
        console.log("[RideRequest] Google Maps SDK is now ready");
        setIsMapsReady(true);
        clearInterval(checkMapsReady);
      }
    }, 100);
    
    // Cleanup after 10 seconds max
    const timeout = setTimeout(() => {
      clearInterval(checkMapsReady);
    }, 10000);
    
    return () => {
      clearInterval(checkMapsReady);
      clearTimeout(timeout);
    };
  }, []);

  // Fetch active promotions from backend
  useEffect(() => {
    const fetchPromotions = async () => {
      setIsLoadingPromos(true);
      try {
        const data = await apiRequest("/api/customer/active-promotions", {
          method: "GET"
        });
        
        if (data.promotions && data.promotions.length > 0) {
          setAvailablePromos(data.promotions);
          
          // Auto-apply the default promo if one exists
          const defaultPromo = data.promotions.find((p: BackendPromo) => p.isDefault);
          if (defaultPromo) {
            setAppliedPromo({
              id: defaultPromo.id,
              code: defaultPromo.name.replace(/\s+/g, "").toUpperCase().substring(0, 10),
              discountPercent: defaultPromo.discountType === "PERCENT" ? defaultPromo.value : 0,
              discountFlat: defaultPromo.discountType === "FLAT" ? defaultPromo.value : 0,
              discountType: defaultPromo.discountType,
              maxDiscountAmount: defaultPromo.maxDiscountAmount,
              label: defaultPromo.name,
              description: defaultPromo.description,
              isDefault: defaultPromo.isDefault
            });
            console.log("[RideRequest] Auto-applied default promo:", defaultPromo.name);
          }
        }
      } catch (error) {
        console.error("[RideRequest] Failed to fetch promotions:", error);
      } finally {
        setIsLoadingPromos(false);
      }
    };

    fetchPromotions();
  }, []);

  const handleGetCurrentLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter({ lat: latitude, lng: longitude });
        
        try {
          const address = await reverseGeocode(latitude, longitude);
          const shortAddress = address.split(",")[0];
          setPickup({ address, lat: latitude, lng: longitude });
          setPickupQuery(`Current location • ${shortAddress}`);
        } catch (err) {
          setPickup({ address: "Current location", lat: latitude, lng: longitude });
          setPickupQuery("Current location");
        }
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable location access or enter your pickup manually.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("Unable to get your location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Only auto-detect current location if no pickup was provided from sessionStorage
  useEffect(() => {
    if (isClient && hasCheckedStorage && !pickup) {
      handleGetCurrentLocation();
    }
  }, [isClient, hasCheckedStorage, pickup, handleGetCurrentLocation]);

  // Fetch routes using Google Maps DirectionsService (client-side)
  const fetchRoutes = useCallback(async () => {
    if (!pickup || !dropoff) {
      setRoutes([]);
      setRouteFetchCompleted(false);
      return;
    }
    
    // Check if Google Maps SDK is loaded
    if (typeof google === "undefined" || !google.maps) {
      console.error("[RideRequest] Google Maps SDK not loaded");
      setRoutes([]);
      setRouteError("Maps not available. Please refresh the page.");
      setRouteFetchCompleted(true);
      return;
    }
    
    setIsLoadingRoutes(true);
    setRouteError(null);
    setRouteFetchCompleted(false);
    
    try {
      const directionsService = new google.maps.DirectionsService();
      
      const request: google.maps.DirectionsRequest = {
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      };
      
      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && result.routes.length > 0) {
          console.log("[RideRequest] Google Directions success:", result.routes.length, "routes");
          
          const parsedRoutes: RouteData[] = result.routes.map((route, index) => {
            const leg = route.legs[0];
            const distanceMeters = leg.distance?.value ?? 0;
            const durationSeconds = leg.duration?.value ?? 0;
            const durationInTrafficSeconds = leg.duration_in_traffic?.value ?? durationSeconds;
            
            const overviewPolyline = route.overview_polyline;
            const polylineStr = typeof overviewPolyline === "string" 
              ? overviewPolyline 
              : (overviewPolyline as any)?.points ?? "";
            
            return {
              id: index,
              summary: route.summary || `Route ${index + 1}`,
              polyline: polylineStr,
              distanceMeters,
              distanceMiles: Math.round((distanceMeters / 1609.34) * 10) / 10,
              distanceText: leg.distance?.text ?? "",
              durationSeconds,
              durationInTrafficSeconds,
              durationText: leg.duration?.text ?? "",
              durationInTrafficText: leg.duration_in_traffic?.text ?? leg.duration?.text ?? "",
              startAddress: leg.start_address ?? "",
              endAddress: leg.end_address ?? "",
            };
          });
          
          // Sort by traffic-aware duration (fastest first)
          parsedRoutes.sort((a, b) => a.durationInTrafficSeconds - b.durationInTrafficSeconds);
          parsedRoutes.forEach((r, i) => r.id = i);
          
          setRoutes(parsedRoutes);
          setActiveRouteId(0);
          setRouteFetchCompleted(true);
          setIsLoadingRoutes(false);
        } else {
          console.error("[RideRequest] Google Directions failed:", status);
          setRoutes([]);
          setRouteError(`Could not find driving routes (${status}). Please try different locations.`);
          setRouteFetchCompleted(true);
          setIsLoadingRoutes(false);
        }
      });
    } catch (error) {
      console.error("[RideRequest] Route fetch error:", error);
      setRoutes([]);
      setRouteError("Could not load routes. Please try again.");
      setRouteFetchCompleted(true);
      setIsLoadingRoutes(false);
    }
  }, [pickup, dropoff]);

  const computeFareBreakdown = useCallback((route: RouteData, categoryId: VehicleCategoryId, promo?: AppliedPromo | null) => {
    const categoryConfig = VEHICLE_CATEGORIES[categoryId];
    const distanceKm = route.distanceMeters / 1000;
    const distanceMiles = route.distanceMeters / 1609.34;
    const etaMinutes = Math.ceil(route.durationSeconds / 60);
    const etaWithTrafficMinutes = Math.ceil(route.durationInTrafficSeconds / 60);
    
    const baseFare = Math.round(2.50 * categoryConfig.baseMultiplier * 100) / 100;
    const perMileRate = Math.round(2.00 * categoryConfig.perMileMultiplier * 100) / 100;
    const perMinuteRate = Math.round(0.30 * categoryConfig.perMinuteMultiplier * 100) / 100;
    
    const distanceFare = Math.round(distanceMiles * perMileRate * 100) / 100;
    const timeFare = Math.round(etaWithTrafficMinutes * perMinuteRate * 100) / 100;
    
    const bookingFee = 2.00;
    const taxRate = 0.08875;
    const rideCost = baseFare + distanceFare + timeFare;
    const taxesAndSurcharges = Math.round(rideCost * taxRate * 100) / 100;
    
    const calculatedSubtotal = rideCost + bookingFee + taxesAndSurcharges;
    const minimumFareAdjustment = Math.round(Math.max(0, categoryConfig.minimumFare - calculatedSubtotal) * 100) / 100;
    const subtotal = Math.round(Math.max(calculatedSubtotal, categoryConfig.minimumFare) * 100) / 100;
    
    const originalFare = subtotal;
    
    // Calculate discount based on promo type (PERCENT or FLAT)
    let discountAmount = 0;
    if (promo) {
      if (promo.discountType === "PERCENT" && promo.discountPercent > 0) {
        discountAmount = Math.round(originalFare * (promo.discountPercent / 100) * 100) / 100;
        // Apply max discount cap if set
        if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
          discountAmount = promo.maxDiscountAmount;
        }
      } else if (promo.discountType === "FLAT" && promo.discountFlat && promo.discountFlat > 0) {
        discountAmount = Math.min(promo.discountFlat, originalFare);
      }
    }
    
    const finalFare = Math.round((originalFare - discountAmount) * 100) / 100;
    const promoCode = promo?.code ?? null;
    const promoLabel = promo?.label ?? null;
    
    return {
      baseFare,
      distanceFare,
      timeFare,
      bookingFee,
      taxesAndSurcharges,
      minimumFareAdjustment,
      subtotal,
      totalFare: finalFare,
      originalFare,
      discountAmount,
      finalFare,
      promoCode,
      promoLabel,
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      perMileRate,
      perMinuteRate,
      etaMinutes,
      etaWithTrafficMinutes,
    };
  }, []);

  const calculateFareForCategory = useCallback((route: RouteData, categoryId: VehicleCategoryId) => {
    const breakdown = computeFareBreakdown(route, categoryId, appliedPromo);
    return {
      finalFare: breakdown.finalFare,
      originalFare: breakdown.originalFare,
      discountAmount: breakdown.discountAmount,
      promoCode: breakdown.promoCode,
      promoLabel: breakdown.promoLabel,
    };
  }, [computeFareBreakdown, appliedPromo]);

  const calculateFareFromRoute = useCallback((route: RouteData) => {
    setIsCalculatingFare(true);
    
    const trafficLevel = getTrafficLevel(route.durationInTrafficSeconds, route.durationSeconds);
    const trafficLabel = getTrafficLevelLabel(trafficLevel);
    const breakdown = computeFareBreakdown(route, selectedVehicleCategory, appliedPromo);
    
    setFareEstimate({
      ...breakdown,
      currency: "USD",
      trafficLevel,
      trafficLabel,
    });
    
    setIsCalculatingFare(false);
  }, [selectedVehicleCategory, computeFareBreakdown, appliedPromo]);

  useEffect(() => {
    if (pickup && dropoff && isMapsReady) {
      fetchRoutes();
    } else if (!pickup || !dropoff) {
      setRoutes([]);
      setFareEstimate(null);
    }
  }, [pickup, dropoff, fetchRoutes, isMapsReady]);

  // Calculate fare when active route, vehicle category, or promo changes
  useEffect(() => {
    if (activeRoute) {
      calculateFareFromRoute(activeRoute);
    }
  }, [activeRoute, calculateFareFromRoute, selectedVehicleCategory, appliedPromo]);

  const handlePickupSelect = useCallback((location: { address: string; lat: number; lng: number }) => {
    setPickup(location);
    setPickupQuery(location.address.split(",")[0]);
    setMapCenter({ lat: location.lat, lng: location.lng });
    setFocusedField(null);
  }, []);

  const handleDropoffSelect = useCallback((location: { address: string; lat: number; lng: number }) => {
    setDropoff(location);
    setDropoffQuery(location.address.split(",")[0]);
    setMapCenter({ lat: location.lat, lng: location.lng });
    setFocusedField(null);
  }, []);

  const handleSuggestionClick = useCallback((place: SavedPlace | RecentLocation) => {
    const isValidPlace = 'lat' in place && place.lat !== 0 && place.lng !== 0;
    if (!isValidPlace) return;
    
    const location = {
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      name: 'name' in place ? place.name : undefined,
    };
    
    if (!pickup) {
      setPickup(location);
      setPickupQuery(location.name || location.address.split(",")[0]);
    } else if (!dropoff) {
      setDropoff(location);
      setDropoffQuery(location.name || location.address.split(",")[0]);
    } else {
      setDropoff(location);
      setDropoffQuery(location.name || location.address.split(",")[0]);
    }
    
    setMapCenter({ lat: place.lat, lng: place.lng });
  }, [pickup, dropoff]);

  const handleRequestRide = async () => {
    if (!pickup || !dropoff) {
      toast({
        title: "Missing information",
        description: "Please set both pickup and dropoff locations.",
        variant: "destructive",
      });
      return;
    }

    setIsRequestingRide(true);

    try {
      const requestBody = {
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        serviceFare: fareEstimate?.totalFare || 0,
        paymentMethod: "online",
        rideTypeCode: selectedVehicleCategory,
      };

      await apiRequest("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      addRecentLocation({
        address: dropoff.address,
        lat: dropoff.lat,
        lng: dropoff.lng,
      });

      toast({
        title: "Ride requested!",
        description: "Finding an available driver in your area...",
      });
      
      setRouterLocation("/customer");
    } catch (error: any) {
      toast({
        title: "Couldn't request a ride",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingRide(false);
    }
  };

  const canRequestRide = pickup && dropoff && !isRequestingRide && !isCalculatingFare;
  
  const validSavedPlaces = savedPlaces.filter(p => p.lat !== 0 && p.lng !== 0);
  const showSuggestions = focusedField !== null || (!pickup && !dropoff);

  const getPlaceIcon = (icon: string) => {
    switch (icon) {
      case "home": return Home;
      case "work": return Briefcase;
      default: return Star;
    }
  };

  const getPlaceIconBg = (icon: string) => {
    switch (icon) {
      case "home": return "bg-green-100 dark:bg-green-900 text-green-600";
      case "work": return "bg-purple-100 dark:bg-purple-900 text-purple-600";
      default: return "bg-amber-100 dark:bg-amber-900 text-amber-600";
    }
  };

  return (
    /* C10-FIX: Uber-style layout with proper section spacing
     * Mobile: map takes 40% viewport, bottom content scrolls
     * Desktop: map takes 60vh, content is compact
     * z-index: map(1) < cards(10) < address-box(20) < header(30)
     */
    <div className="h-screen grid grid-rows-[auto_minmax(40vh,1fr)_auto] md:grid-rows-[auto_60vh_auto] relative overflow-hidden bg-muted/30" data-testid="plan-your-ride-page">
      {/* Header - z-30 */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b p-4">
        <div className="flex items-center gap-3">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Plan your ride</h1>
        </div>
      </div>

      {/* C10-FIX: Map section - fixed height 40vh mobile, 60vh desktop */}
      <div className="relative overflow-hidden z-[1]">
        {isClient && (
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={14}
            className="h-full w-full z-0"
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <MapBoundsHandler pickupLocation={pickup} dropoffLocation={dropoff} />
            
            {pickup && pickupIcon && (
              <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
            )}
            {dropoff && dropoffIcon && (
              <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />
            )}
            
            {/* Render all routes - inactive routes first (dimmed), active route on top */}
            {routePolylines.map(({ id, points }) => (
              <Polyline
                key={id}
                positions={points}
                pathOptions={{
                  color: id === activeRouteId ? "#3B82F6" : "#94A3B8",
                  weight: id === activeRouteId ? 5 : 3,
                  opacity: id === activeRouteId ? 0.9 : 0.4,
                }}
                eventHandlers={{
                  click: () => setActiveRouteId(id),
                }}
              />
            ))}
          </MapContainer>
        )}

        {!pickup && (
          <button
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
            className="absolute bottom-32 right-4 z-20 bg-background p-3 rounded-full shadow-lg border hover-elevate"
            data-testid="button-recenter-map"
          >
            {isLocating ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            ) : (
              <Crosshair className="h-6 w-6 text-blue-600" />
            )}
          </button>
        )}

        {/* C10-FIX: Pickup/dropoff box with solid white background - z-20 (above map) */}
        <div className="absolute top-4 left-4 right-4 z-20">
          <Card className="shadow-lg bg-background" data-testid="location-card">
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                  <div className="w-px h-8 bg-border" />
                  <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-white shadow" />
                </div>
                
                <div className="pl-10 space-y-2">
                  <GooglePlacesInput
                    value={pickupQuery}
                    onChange={setPickupQuery}
                    onLocationSelect={handlePickupSelect}
                    onCurrentLocation={handleGetCurrentLocation}
                    isLoadingCurrentLocation={isLocating}
                    placeholder={isLocating ? "Getting location..." : "Pickup location"}
                    variant="pickup"
                    showCurrentLocation={true}
                    className="w-full"
                  />
                  
                  <GooglePlacesInput
                    value={dropoffQuery}
                    onChange={setDropoffQuery}
                    onLocationSelect={handleDropoffSelect}
                    placeholder="Where to?"
                    variant="dropoff"
                    showCurrentLocation={false}
                    className="w-full"
                  />
                </div>
              </div>

              {locationError && (
                <Alert variant="destructive" className="mt-2" data-testid="location-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{locationError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {showSuggestions && (
            <Card className="mt-3 shadow-lg max-h-[40vh] overflow-y-auto" data-testid="suggestions-card">
              <CardContent className="p-2">
                {validSavedPlaces.length > 0 && (
                  <div className="mb-2">
                    <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Saved Places
                    </p>
                    {savedPlaces.map((place) => (
                      <SuggestionItem
                        key={place.id}
                        icon={getPlaceIcon(place.icon)}
                        iconBg={getPlaceIconBg(place.icon)}
                        title={place.name}
                        subtitle={place.address}
                        onClick={() => handleSuggestionClick(place)}
                        testId={`suggestion-${place.id}`}
                        disabled={place.lat === 0 && place.lng === 0}
                      />
                    ))}
                  </div>
                )}

                {recentLocations.length > 0 && (
                  <div>
                    <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Recent Places
                    </p>
                    {recentLocations.slice(0, 5).map((recent) => (
                      <SuggestionItem
                        key={recent.id}
                        icon={Clock}
                        iconBg="bg-muted text-muted-foreground"
                        title={recent.address.split(",")[0]}
                        subtitle={recent.address.split(",").slice(1, 3).join(",").trim() || "Recent destination"}
                        onClick={() => handleSuggestionClick(recent)}
                        testId={`suggestion-recent-${recent.id}`}
                      />
                    ))}
                  </div>
                )}

                {validSavedPlaces.length === 0 && recentLocations.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No saved or recent places yet</p>
                    <p className="text-xs mt-1">Your frequent destinations will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* BOTTOM SHEET: Clean Uber-style vertical structure
       * Structure: [A] Promo Banner -> [B] Heading -> [C] Cards (scrollable) -> [D] Request Button
       * Max height: 58vh on mobile, 55vh desktop. Cards + fare area scrolls, button stays fixed.
       */}
      <div className="sticky bottom-0 z-20 bg-background border-t shadow-[0_-8px_24px_rgba(0,0,0,0.12)] flex flex-col max-h-[58vh] md:max-h-[55vh]">
        
        {/* [A] PROMO BANNER - Fixed at top of sheet */}
        {activeRoute && appliedPromo && (
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
            <div 
              className="px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer hover-elevate"
              style={{ background: "#E7FCE5" }}
              onClick={() => {
                setAppliedPromo(null);
                toast({ title: "Promo removed", description: "Viewing regular prices" });
              }}
              data-testid="promo-banner"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">{appliedPromo.label}</p>
                  <p className="text-xs text-green-600">
                    {appliedPromo.discountType === "PERCENT" 
                      ? `${appliedPromo.discountPercent}% off your ride` 
                      : `$${appliedPromo.discountFlat} off your ride`}
                  </p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-medium">Tap to remove</span>
            </div>
          </div>
        )}

        {/* Apply Promo button when no promo active */}
        {activeRoute && !appliedPromo && availablePromos.length > 0 && !isLoadingPromos && (
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-11 text-sm gap-2 border-dashed border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => {
                const promo = availablePromos[0];
                setAppliedPromo({
                  id: promo.id,
                  code: promo.name.replace(/\s+/g, "").toUpperCase().substring(0, 10),
                  discountPercent: promo.discountType === "PERCENT" ? promo.value : 0,
                  discountFlat: promo.discountType === "FLAT" ? promo.value : 0,
                  discountType: promo.discountType,
                  maxDiscountAmount: promo.maxDiscountAmount,
                  label: promo.name,
                  description: promo.description,
                  isDefault: promo.isDefault
                });
                toast({ title: "Promo applied!", description: `${promo.name} - ${promo.discountType === "PERCENT" ? `${promo.value}% off` : `$${promo.value} off`}` });
              }}
              data-testid="button-apply-promo"
            >
              <Zap className="h-4 w-4" />
              Apply Promo Code
            </Button>
          </div>
        )}

        {/* [B] SECTION TITLE - Fixed below promo */}
        {activeRoute && (
          <div className="flex-shrink-0 px-4 pt-2 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Choose your ride
              </p>
              {isLoadingPromos && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* [C] SCROLLABLE CONTENT - Cards + Fare summary scroll together */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {/* Ride cards carousel */}
          {activeRoute && (
            <div 
              className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4" 
              role="group" 
              aria-label="Vehicle category options"
            >
              {ACTIVE_VEHICLE_CATEGORIES.map((categoryId) => {
                const catConfig = VEHICLE_CATEGORIES[categoryId];
                const isSelected = categoryId === selectedVehicleCategory;
                const fareData = calculateFareForCategory(activeRoute, categoryId);
                const vehicleImage = getVehicleCategoryImage(categoryId);
                const isUnavailable = checkUnavailable(categoryId);
                const isLimited = checkLimited(categoryId);
                const categoryETA = getETA(categoryId);
                const etaText = categoryETA?.etaText ?? `${catConfig.etaMinutesOffset + 5} min`;
                const etaMinutes = categoryETA?.etaMinutes ?? (catConfig.etaMinutesOffset + 5);
                const hasDiscount = fareData.discountAmount > 0;
                
                return (
                  <Tooltip key={categoryId}>
                    <TooltipTrigger asChild>
                      <div
                        role="button"
                        tabIndex={isUnavailable ? -1 : 0}
                        onClick={() => !isUnavailable && setSelectedVehicleCategory(categoryId)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !isUnavailable) {
                            e.preventDefault();
                            setSelectedVehicleCategory(categoryId);
                          }
                        }}
                        aria-pressed={isSelected}
                        aria-disabled={isUnavailable}
                        aria-label={`${catConfig.displayName}, ${isUnavailable ? "No drivers nearby" : `$${fareData.finalFare.toFixed(2)}, ${catConfig.seatCount} seats, ${etaText}`}${isSelected ? ", selected" : ""}`}
                        data-testid={`ride-pill-${categoryId}`}
                        className={`
                          w-[130px] rounded-[14px] p-3 flex-shrink-0 snap-start cursor-pointer
                          transition-all duration-150 ease-out
                          ${isSelected 
                            ? "bg-white border-l-[4px] border-l-primary border-t border-r border-b border-[#E5E7EB] scale-[1.02]" 
                            : isUnavailable
                              ? "bg-muted/30 border border-[#E5E7EB] opacity-50 cursor-not-allowed"
                              : "bg-white border border-[#E5E7EB] hover-elevate"
                          }
                        `}
                        style={{
                          boxShadow: isSelected 
                            ? "0px 6px 16px rgba(0,0,0,0.12)" 
                            : "0px 4px 14px rgba(0,0,0,0.08)",
                        }}
                      >
                        {/* C10-FIX: Fixed height container prevents jumping on selection */}
                        <div className="flex flex-col items-center gap-1.5 h-full">
                          {/* 3D Vehicle Image - fixed height for consistency */}
                          <div 
                            className={`h-14 w-20 flex items-center justify-center overflow-hidden rounded-lg ${isUnavailable ? "opacity-40" : ""}`}
                            style={{
                              background: "linear-gradient(180deg, #FFFFFF 40%, #F2F2F2 100%)",
                            }}
                          >
                            <img 
                              src={vehicleImage} 
                              alt={catConfig.displayName}
                              className={`w-[92%] h-[92%] object-contain transition-transform duration-200 ${isSelected ? "scale-105" : ""}`}
                              style={{
                                filter: isUnavailable 
                                  ? "grayscale(1)" 
                                  : "drop-shadow(0px 4px 14px rgba(0,0,0,0.15))",
                              }}
                              data-testid={`img-vehicle-${categoryId}`}
                            />
                          </div>
                          
                          {/* Category Name - Full SafeGo branding, font-weight 600 */}
                          <span 
                            className={`text-xs text-center leading-tight whitespace-nowrap ${
                              isUnavailable ? "text-muted-foreground" : "text-foreground"
                            }`}
                            style={{ fontWeight: 600 }}
                          >
                            {catConfig.displayName}
                          </span>
                          
                          {isUnavailable ? (
                            <span className="text-[10px] text-center" style={{ fontWeight: 400, color: "#6B7280" }}>
                              No drivers nearby
                            </span>
                          ) : (
                            <>
                              {/* Price Display - Uber Style */}
                              <div className="flex flex-col items-center gap-0.5">
                                <span 
                                  className="text-lg tracking-tight" 
                                  style={{ fontWeight: 700, color: "#000000" }}
                                  data-testid={`price-${categoryId}`}
                                >
                                  ${fareData.finalFare.toFixed(2)}
                                </span>
                                {hasDiscount && (
                                  <span 
                                    className="text-xs line-through" 
                                    style={{ color: "#9CA3AF" }}
                                    data-testid={`original-price-${categoryId}`}
                                  >
                                    ${fareData.originalFare.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              
                              {/* You Save Badge - Green with lightning icon */}
                              {hasDiscount && (
                                <div 
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30" 
                                  style={{ color: "#16A34A" }}
                                  data-testid={`savings-${categoryId}`}
                                >
                                  <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                                  <span className="text-[10px]" style={{ fontWeight: 500 }}>
                                    You save ${fareData.discountAmount.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              
                              {/* Seats & ETA */}
                              <div className="flex items-center gap-1.5 text-[10px]" style={{ fontWeight: 400, color: "#6B7280" }}>
                                <Users className="h-3 w-3" aria-hidden="true" />
                                <span>{catConfig.seatCount}</span>
                                <span className="opacity-50">|</span>
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                <span data-testid={`eta-${categoryId}`}>{etaMinutes} min</span>
                              </div>
                            </>
                          )}
                          
                          {/* Promo Badge - Green with lightning */}
                          {hasDiscount && fareData.promoLabel && !isUnavailable && (
                            <Badge 
                              variant="secondary" 
                              className="text-[8px] px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 rounded-full"
                            >
                              <Zap className="h-2 w-2 mr-0.5" />
                              {fareData.promoLabel}
                            </Badge>
                          )}
                          
                          {/* Limited Badge - Yellow */}
                          {isLimited && !isUnavailable && !hasDiscount && (
                            <Badge 
                              className="text-[8px] px-2 py-0.5 bg-amber-400 text-amber-950 border-0 rounded-full"
                            >
                              Limited
                            </Badge>
                          )}
                          
                          {/* Popular Badge - Blue */}
                          {catConfig.isPopular && !isUnavailable && !isLimited && !hasDiscount && (
                            <Badge 
                              variant="secondary" 
                              className="text-[8px] px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 rounded-full"
                            >
                              Popular
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[220px] p-3">
                      <p className="font-bold text-sm">{catConfig.displayName}</p>
                      <p className="text-muted-foreground mt-1">
                        {isUnavailable 
                          ? "No drivers available in your area right now" 
                          : catConfig.shortDescription
                        }
                      </p>
                      {!isUnavailable && (
                        <>
                          <p className="text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pickup in ~{etaMinutes} min
                          </p>
                          {hasDiscount && (
                            <p className="text-green-600 dark:text-green-400 mt-1 font-medium">
                              Promo applied - Save ${fareData.discountAmount.toFixed(2)}
                            </p>
                          )}
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Fare summary card */}
        {fareEstimate && (
          <Card 
            className="rounded-[14px] overflow-hidden mt-4" 
            style={{ 
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0px 4px 14px rgba(0,0,0,0.08)",
            }}
            data-testid="fare-estimate-card"
          >
            <CardContent className="p-4">
              {/* Promo Banner - if discount applied */}
              {fareEstimate.discountAmount > 0 && fareEstimate.promoCode && (
                <div className="mb-3 -mt-1 -mx-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-800/40 flex items-center justify-center">
                        <Zap className="h-3.5 w-3.5" style={{ color: "#16A34A" }} />
                      </div>
                      <span className="text-sm" style={{ fontWeight: 600, color: "#16A34A" }}>
                        {fareEstimate.promoLabel || `${fareEstimate.promoCode} applied`}
                      </span>
                    </div>
                    <span className="text-sm" style={{ fontWeight: 700, color: "#16A34A" }} data-testid="text-savings-amount">
                      -${fareEstimate.discountAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* 3D Vehicle Image - Uber Style */}
                  <div 
                    className="h-20 w-28 rounded-[12px] flex items-center justify-center overflow-hidden p-3"
                    style={{
                      background: "linear-gradient(180deg, #FFFFFF 40%, #F2F2F2 100%)",
                    }}
                  >
                    <img 
                      src={getVehicleCategoryImage(selectedVehicleCategory)} 
                      alt={VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                      className="w-[92%] h-[92%] object-contain scale-105"
                      style={{
                        filter: "drop-shadow(0px 4px 14px rgba(0,0,0,0.15))",
                      }}
                      data-testid="img-selected-vehicle"
                    />
                  </div>
                  <div>
                    <p 
                      className="text-sm text-foreground whitespace-nowrap"
                      style={{ fontWeight: 600 }}
                    >
                      {VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                    </p>
                    {/* Price Display - Uber Style */}
                    <div className="flex items-baseline gap-2 mt-1">
                      <p 
                        className="text-2xl tracking-tight" 
                        style={{ fontWeight: 700, color: "#000000" }}
                        data-testid="text-fare-estimate"
                      >
                        ${fareEstimate.finalFare.toFixed(2)}
                      </p>
                      {fareEstimate.discountAmount > 0 && (
                        <p 
                          className="text-sm line-through" 
                          style={{ color: "#9CA3AF" }}
                          data-testid="text-original-fare"
                        >
                          ${fareEstimate.originalFare.toFixed(2)}
                        </p>
                      )}
                    </div>
                    {/* You Save Badge - SafeGo Green #16A34A */}
                    {fareEstimate.discountAmount > 0 && (
                      <div 
                        className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 w-fit" 
                        style={{ color: "#16A34A" }}
                        data-testid="text-you-save"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span className="text-sm" style={{ fontWeight: 500 }}>You save ${fareEstimate.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p style={{ fontWeight: 500, color: "#6B7280" }} data-testid="text-distance">{fareEstimate.distanceMiles} mi</p>
                  <p style={{ fontWeight: 600 }} data-testid="text-trip-eta">
                    ~{formatDurationMinutes(fareEstimate.etaWithTrafficMinutes)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ fontWeight: 400, color: "#6B7280" }} data-testid="text-pickup-eta">
                    Pickup in ~{getETA(selectedVehicleCategory)?.etaMinutes ?? 5} min
                  </p>
                </div>
              </div>
              
              {/* Status Badges */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-medium ${
                    fareEstimate.trafficLevel === "heavy" 
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                      : fareEstimate.trafficLevel === "moderate"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  }`}
                >
                  <Car className="h-3 w-3 mr-1" />
                  {fareEstimate.trafficLabel}
                </Badge>
                <Badge variant="secondary" className="text-xs font-medium">
                  <Wallet className="h-3 w-3 mr-1" />
                  Card/Wallet only
                </Badge>
              </div>
              
              {/* Fare Breakdown Accordion - Customer view (driver earnings hidden by default) */}
              <div className="mt-4 pt-3 border-t">
                <FareDetailsAccordion 
                  breakdown={{
                    baseFare: fareEstimate.baseFare,
                    timeCost: fareEstimate.timeFare,
                    distanceCost: fareEstimate.distanceFare,
                    bookingFee: fareEstimate.bookingFee,
                    taxesAndSurcharges: fareEstimate.taxesAndSurcharges,
                    minimumFareAdjustment: fareEstimate.minimumFareAdjustment,
                    subtotal: fareEstimate.originalFare,
                    discountAmount: fareEstimate.discountAmount,
                    totalFare: fareEstimate.finalFare,
                    distanceMiles: fareEstimate.distanceMiles,
                    durationMinutes: fareEstimate.etaWithTrafficMinutes,
                    perMileRate: fareEstimate.perMileRate,
                    perMinuteRate: fareEstimate.perMinuteRate,
                    promoCode: fareEstimate.promoCode,
                  }}
                />
              </div>
              
              {/* Route Selection */}
              {routes.length > 1 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Choose route:</p>
                  <div className="flex flex-wrap gap-2">
                    {routes.map((route, index) => {
                      const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                      const isActive = route.id === activeRouteId;
                      return (
                        <Button
                          key={route.id}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          className={`text-xs h-8 ${isActive ? "" : "opacity-70"}`}
                          onClick={() => setActiveRouteId(route.id)}
                          data-testid={`button-route-${route.id}`}
                        >
                          <RouteIcon className="h-3 w-3 mr-1" />
                          {index === 0 ? "Fastest" : route.summary || `Route ${index + 1}`}
                          <span className="ml-1 opacity-75">({formatDurationMinutes(etaMin)})</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isCalculatingFare && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Calculating fare...</span>
          </div>
        )}
        </div>

        {/* [D] REQUEST RIDE BUTTON - Always visible, fixed at bottom, 52-56px height */}
        <div className="flex-shrink-0 px-4 py-4 bg-background border-t">
          <Button
            onClick={handleRequestRide}
            disabled={!canRequestRide}
            className="w-full h-14 text-base font-semibold rounded-xl"
            data-testid="button-request-ride"
          >
            {isRequestingRide ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Requesting...
              </>
            ) : (
              "Request ride"
            )}
          </Button>

          {!pickup && !dropoff && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Set pickup and dropoff to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
