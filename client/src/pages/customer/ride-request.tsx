/**
 * LEGACY RIDE REQUEST PAGE
 * 
 * This component is NO LONGER RENDERED in customer-facing routes.
 * All customer booking now uses UnifiedBooking (/customer/unified-booking.tsx).
 * 
 * DO NOT DELETE - keeping for reference and potential rollback.
 * 
 * Routes that previously used this:
 * - /customer/ride (now uses UnifiedBooking)
 * - /customer/ride-request (now uses UnifiedBooking)
 * - /customer via CustomerHome on desktop (now uses UnifiedBooking)
 * 
 * @deprecated Use UnifiedBooking instead
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation, Crosshair, Loader2, Clock, Home, Briefcase, Star, ChevronRight, CreditCard, Wallet, AlertCircle, Car, Route as RouteIcon, Users, Crown, Sparkles, Zap, Accessibility, ChevronUp, ChevronDown } from "lucide-react";
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
import { RideAddressHeader } from "@/components/rider/RideAddressHeader";
import { MobileAddressCapsule } from "@/components/rider/MobileAddressCapsule";
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
  
  // Address panel expanded state - unified for all devices
  const [isAddressPanelExpanded, setIsAddressPanelExpanded] = useState(true);

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

  // Swap pickup and dropoff addresses
  const handleSwapAddresses = useCallback(() => {
    if (!pickup || !dropoff) return;
    
    // Swap the location data
    const tempPickup = pickup;
    const tempDropoff = dropoff;
    const tempPickupQuery = pickupQuery;
    const tempDropoffQuery = dropoffQuery;
    
    setPickup(tempDropoff);
    setDropoff(tempPickup);
    setPickupQuery(tempDropoffQuery);
    setDropoffQuery(tempPickupQuery);
    
    toast({
      title: "Addresses swapped",
      description: "Pickup and dropoff locations have been swapped",
    });
  }, [pickup, dropoff, pickupQuery, dropoffQuery, toast]);

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
    /* UNIFIED RESPONSIVE LAYOUT - Same components on all devices
     * Desktop (>=1024px): 2-column layout - Left: content, Right: map
     * Mobile (<1024px): Stacked layout - address → promo → rides → map → routes → button
     */
    <div className="h-screen flex flex-col bg-muted/30" data-testid="plan-your-ride-page">
      {/* Header */}
      <header className="flex-shrink-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Plan your ride</h1>
        </div>
      </header>

      {/* Main Content - Responsive 2-column on desktop, stacked on mobile */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        
        {/* LEFT COLUMN: Address + Promo + Ride Cards */}
        <div className="lg:w-[480px] lg:flex-shrink-0 lg:overflow-y-auto lg:border-r flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-0 lg:pb-4">
            
            {/* Collapsible Address Panel - unified for all devices */}
            <Card 
              className="bg-white dark:bg-card shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E5E7EB] dark:border-border overflow-hidden"
              style={{ borderRadius: "16px" }}
              data-testid="unified-address-panel"
            >
              <CardContent className="p-0">
                {/* Panel Header - click to expand/collapse */}
                <div 
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setIsAddressPanelExpanded(!isAddressPanelExpanded)}
                  data-testid="address-panel-header"
                >
                  <p className="text-[0.9rem] font-semibold text-[#111827] dark:text-foreground">
                    Plan your ride
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsAddressPanelExpanded(!isAddressPanelExpanded); }}
                    className="h-8 w-8 rounded-full flex items-center justify-center bg-[#F3F4F6] dark:bg-muted hover:bg-[#E5E7EB] dark:hover:bg-muted/80 transition-colors"
                    aria-label={isAddressPanelExpanded ? "Collapse panel" : "Expand panel"}
                    data-testid="button-toggle-panel"
                  >
                    {isAddressPanelExpanded ? <ChevronUp className="h-4 w-4 text-[#6B7280]" /> : <ChevronDown className="h-4 w-4 text-[#6B7280]" />}
                  </button>
                </div>

                {/* Collapsed view - compact summary */}
                {!isAddressPanelExpanded && (
                  <div className="px-4 pb-3 border-t border-[#F3F4F6] dark:border-border/50">
                    <div className="flex items-center gap-3 pt-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#3B82F6" }} />
                          <span className="text-sm font-medium text-[#111827] dark:text-foreground truncate">
                            {pickup ? (pickup.name || pickup.address.split(",")[0]) : "Set pickup"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#EF4444" }} />
                          <span className="text-sm font-medium text-[#111827] dark:text-foreground truncate">
                            {dropoff ? (dropoff.name || dropoff.address.split(",")[0]) : "Set dropoff"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expanded view - full address inputs */}
                {isAddressPanelExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[#F3F4F6] dark:border-border/50">
                    {/* Pickup Row */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all mt-3 ${
                        focusedField === "pickup" 
                          ? "bg-[#EFF6FF] dark:bg-blue-900/20 border border-[#2563EB]" 
                          : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                      }`}
                      data-testid="address-row-pickup"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EFF6FF" }}>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#2563EB" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.7rem] font-medium text-[#6B7280] dark:text-muted-foreground uppercase tracking-wide mb-0.5">Pickup</p>
                        <GooglePlacesInput
                          value={pickupQuery}
                          onChange={setPickupQuery}
                          onLocationSelect={handlePickupSelect}
                          onCurrentLocation={handleGetCurrentLocation}
                          isLoadingCurrentLocation={isLocating}
                          placeholder={isLocating ? "Getting location..." : "Enter pickup location"}
                          variant="pickup"
                          showCurrentLocation={true}
                          hideIcon={true}
                          onFocus={() => setFocusedField("pickup")}
                          onBlur={() => setFocusedField(null)}
                          className="w-full"
                          inputClassName="border-0 bg-transparent p-0 h-auto text-[0.9rem] font-medium text-[#111827] dark:text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                        />
                      </div>
                      <button
                        onClick={handleSwapAddresses}
                        disabled={!pickup || !dropoff}
                        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          pickup && dropoff
                            ? "bg-[#F3F4F6] dark:bg-muted hover:bg-[#E5E7EB] dark:hover:bg-muted/80 cursor-pointer" 
                            : "bg-[#F3F4F6] dark:bg-muted/50 opacity-50 cursor-not-allowed"
                        }`}
                        title="Swap pickup and dropoff"
                        data-testid="button-swap-addresses"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6B7280]"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
                      </button>
                    </div>

                    {/* Dropoff Row */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        focusedField === "dropoff" 
                          ? "bg-[#FEF2F2] dark:bg-red-900/20 border border-[#DC2626]" 
                          : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                      }`}
                      data-testid="address-row-dropoff"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FEF2F2" }}>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#DC2626" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.7rem] font-medium text-[#6B7280] dark:text-muted-foreground uppercase tracking-wide mb-0.5">Dropoff</p>
                        <GooglePlacesInput
                          value={dropoffQuery}
                          onChange={setDropoffQuery}
                          onLocationSelect={handleDropoffSelect}
                          placeholder="Where to?"
                          variant="dropoff"
                          showCurrentLocation={false}
                          hideIcon={true}
                          onFocus={() => setFocusedField("dropoff")}
                          onBlur={() => setFocusedField(null)}
                          className="w-full"
                          inputClassName="border-0 bg-transparent p-0 h-auto text-[0.9rem] font-medium text-[#111827] dark:text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                        />
                      </div>
                      <div className="h-8 w-8 flex-shrink-0" />
                    </div>

                    {/* Location error */}
                    {locationError && (
                      <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                        {locationError}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved/Recent places when focusing on address fields */}
            {showSuggestions && (
              <Card className="shadow-lg rounded-xl overflow-hidden" data-testid="suggestions-panel">
                <CardContent className="p-3 max-h-[200px] overflow-y-auto">
                  {validSavedPlaces.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">Saved Places</p>
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
                      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">Recent</p>
                      {recentLocations.slice(0, 3).map((recent) => (
                        <SuggestionItem
                          key={recent.id}
                          icon={Clock}
                          iconBg="bg-muted text-muted-foreground"
                          title={recent.address.split(",")[0]}
                          subtitle={recent.address.split(",").slice(1, 2).join(",").trim()}
                          onClick={() => handleSuggestionClick(recent)}
                          testId={`recent-${recent.id}`}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Promo & Payment Card - shown when route is available */}
            {activeRoute && (
              <Card 
                className="shadow-[0_4px_16px_rgba(0,0,0,0.06)] bg-white dark:bg-card border border-[#E5E7EB] dark:border-border overflow-hidden"
                style={{ borderRadius: "16px" }}
                data-testid="promo-payment-card"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Applied Promo Banner */}
                  {appliedPromo && (
                    <div 
                      className="px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer hover-elevate"
                      style={{ background: "#E7FCE5" }}
                      onClick={() => {
                        setAppliedPromo(null);
                        toast({ title: "Promo removed", description: "Viewing regular prices" });
                      }}
                      data-testid="promo-banner"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-800">{appliedPromo.label}</p>
                          <p className="text-xs text-green-600">
                            {appliedPromo.discountType === "PERCENT" 
                              ? `${appliedPromo.discountPercent}% off` 
                              : `$${appliedPromo.discountFlat} off`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Apply Promo Button */}
                  {!appliedPromo && availablePromos.length > 0 && !isLoadingPromos && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-10 text-sm gap-2 border-dashed border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
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
                        toast({ title: "Promo applied!", description: `${promo.name}` });
                      }}
                      data-testid="button-apply-promo"
                    >
                      <Zap className="h-4 w-4" />
                      Apply Promo Code
                    </Button>
                  )}

                  {/* Payment method */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Payment</span>
                      </div>
                      <span className="text-sm font-medium">Card/Wallet</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Route Selection Pills - Horizontal scroll, always visible when multiple routes */}
            {routes.length > 1 && (
              <div className="py-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Choose route</p>
                <div className="flex gap-2 flex-wrap">
                  {routes.map((route, index) => {
                    const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                    const isActive = route.id === activeRouteId;
                    return (
                      <Button
                        key={route.id}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className={`text-xs h-9 flex-shrink-0 ${isActive ? "" : "bg-background"}`}
                        onClick={() => setActiveRouteId(route.id)}
                        data-testid={`route-pill-${route.id}`}
                      >
                        <RouteIcon className="h-3.5 w-3.5 mr-1.5" />
                        {index === 0 ? "Fastest" : route.summary || `Route ${index + 1}`}
                        <span className="ml-1.5 opacity-75">({formatDurationMinutes(etaMin)})</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ride Cards - Vertical list */}
            {activeRoute && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-foreground" />
                  <h3 className="font-semibold">Choose your ride</h3>
                </div>
                
                <div className="space-y-2" data-testid="ride-list">
                  {ACTIVE_VEHICLE_CATEGORIES.map((categoryId) => {
                    const catConfig = VEHICLE_CATEGORIES[categoryId];
                    const isSelected = categoryId === selectedVehicleCategory;
                    const fareData = calculateFareForCategory(activeRoute, categoryId);
                    const vehicleImage = getVehicleCategoryImage(categoryId);
                    const isUnavailable = checkUnavailable(categoryId);
                    const isLimited = checkLimited(categoryId);
                    const categoryETA = getETA(categoryId);
                    const etaMinutes = categoryETA?.etaMinutes ?? (catConfig.etaMinutesOffset + 5);
                    const hasDiscount = fareData.discountAmount > 0;
                    
                    return (
                      <div
                        key={categoryId}
                        role="button"
                        tabIndex={isUnavailable ? -1 : 0}
                        onClick={() => !isUnavailable && setSelectedVehicleCategory(categoryId)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !isUnavailable) {
                            e.preventDefault();
                            setSelectedVehicleCategory(categoryId);
                          }
                        }}
                        data-testid={`ride-card-${categoryId}`}
                        className={`
                          flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                          ${isSelected 
                            ? "border-2 border-primary bg-blue-50 dark:bg-blue-950/30" 
                            : isUnavailable
                              ? "border border-[#E5E7EB] dark:border-border bg-muted/30 opacity-50 cursor-not-allowed"
                              : "border border-[#E5E7EB] dark:border-border bg-background hover:shadow-md"
                          }
                        `}
                      >
                        {/* Vehicle image */}
                        <div 
                          className="h-14 w-20 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ background: "linear-gradient(180deg, #FFFFFF 40%, #F2F2F2 100%)" }}
                        >
                          <img 
                            src={vehicleImage} 
                            alt={catConfig.displayName}
                            className="w-full h-full object-contain"
                            style={{ filter: isUnavailable ? "grayscale(1)" : "drop-shadow(0px 4px 10px rgba(0,0,0,0.12))" }}
                          />
                        </div>
                        
                        {/* Text info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{catConfig.displayName}</p>
                            {catConfig.isPopular && !isUnavailable && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                                Popular
                              </Badge>
                            )}
                            {isLimited && !isUnavailable && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0">
                                Limited
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{catConfig.shortDescription}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {catConfig.seatCount}
                            </span>
                            <span>•</span>
                            <span>{isUnavailable ? "No drivers" : `${etaMinutes} min`}</span>
                          </div>
                          {hasDiscount && !isUnavailable && (
                            <p className="text-xs font-medium mt-0.5" style={{ color: "#16A34A" }}>
                              Save ${fareData.discountAmount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        
                        {/* Price */}
                        <div className="flex-shrink-0 text-right">
                          {isUnavailable ? (
                            <p className="text-xs text-muted-foreground">N/A</p>
                          ) : (
                            <>
                              <p className="text-base font-bold">${fareData.finalFare.toFixed(2)}</p>
                              {hasDiscount && (
                                <p className="text-xs text-muted-foreground line-through">
                                  ${fareData.originalFare.toFixed(2)}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fare Summary Accordion - shown when route and fare are available */}
            {fareEstimate && (
              <Card className="rounded-xl border border-[#E5E7EB] dark:border-border" data-testid="fare-summary">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Trip estimate</p>
                        <p className="text-sm">{fareEstimate.distanceMiles} mi • ~{formatDurationMinutes(fareEstimate.etaWithTrafficMinutes)}</p>
                      </div>
                      <Badge variant="secondary" className={`text-xs ${
                        fareEstimate.trafficLevel === "heavy" 
                          ? "bg-red-100 text-red-700" 
                          : fareEstimate.trafficLevel === "moderate"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {fareEstimate.trafficLabel}
                      </Badge>
                    </div>
                    
                    {/* Fare breakdown accordion */}
                    <div className="mt-3 pt-3 border-t">
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

                  </CardContent>
                </Card>
              )}

            {/* Empty state when no addresses entered */}
            {!activeRoute && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground py-8">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Enter pickup and dropoff</p>
                  <p className="text-sm mt-1">Set your locations to see ride options</p>
                </div>
              </div>
            )}
          </div>
          {/* End of scrollable left column content */}
          
          {/* Sticky Request Ride Button - visible on mobile when content exists */}
          <div className="lg:hidden flex-shrink-0 p-4 bg-background/95 backdrop-blur-sm border-t sticky bottom-0">
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
        {/* End of LEFT COLUMN */}

        {/* RIGHT COLUMN: Map - visible on desktop, shown below content on mobile */}
        <div className="flex-1 min-h-[250px] lg:min-h-0 relative lg:rounded-xl overflow-hidden lg:border lg:border-[#E5E7EB] dark:lg:border-border">
          {isClient && (
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={14}
              className="h-full w-full"
              zoomControl={true}
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

          {/* Current location button */}
          {!pickup && (
            <button
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="absolute bottom-4 right-4 z-20 bg-background p-3 rounded-full shadow-lg border hover-elevate"
              data-testid="button-recenter-map"
            >
              {isLocating ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <Crosshair className="h-5 w-5 text-blue-600" />
              )}
            </button>
          )}
        </div>
        {/* End of map column */}

        {/* Desktop Request Ride Button - Hidden on mobile (mobile has sticky bottom button in left column) */}
        <div className="hidden lg:flex lg:absolute lg:bottom-4 lg:left-4 lg:right-4 lg:justify-center">
          <Button
            onClick={handleRequestRide}
            disabled={!canRequestRide}
            className="w-full max-w-[400px] h-14 text-lg font-semibold rounded-xl shadow-lg"
            data-testid="button-request-ride-desktop"
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
        </div>
      </div>
      {/* End of main content area */}
    </div>
  );
}
