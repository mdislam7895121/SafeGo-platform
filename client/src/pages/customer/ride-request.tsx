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
import { RideAddressHeader } from "@/components/rider/RideAddressHeader";
import { AddressSummaryCapsule } from "@/components/rider/AddressSummaryCapsule";
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
  
  // Mobile-only UI state for Route Explorer - allows riders to see full map and choose route
  // This state is ONLY used for mobile-specific layout changes and does NOT affect business logic
  const [isRouteExplorerOpen, setIsRouteExplorerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile-only UI state for address editing - forces return to Screen 1 (Plan Your Ride)
  // When true, shows full address inputs; when false, shows compact summary on Screens 2/3
  const [isEditingAddresses, setIsEditingAddresses] = useState(false);
  
  // Mobile detection effect - only trigger mobile-specific layout changes
  // Also resets Route Explorer when switching to desktop viewport
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Reset Route Explorer when switching to desktop to ensure desktop layout remains unchanged
      if (!mobile && isRouteExplorerOpen) {
        setIsRouteExplorerOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [isRouteExplorerOpen]);

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
  
  /**
   * Mobile Screen Logic (UI-only, no business logic changes):
   * Screen 1 (Plan Your Ride): Show full address inputs - when no routes yet OR user is editing
   * Screen 2 (Choose Your Ride): Show compact summary - when routes exist, not editing, not in Route Explorer
   * Screen 3 (Choose Your Route): Show compact summary - when Route Explorer is open
   * 
   * Full address inputs appear ONLY on Screen 1
   * Compact AddressSummaryCapsule appears on Screens 2 and 3
   */
  const mobileScreen: 1 | 2 | 3 = useMemo(() => {
    if (!isMobile) return 1; // Desktop always uses full inputs
    if (isRouteExplorerOpen) return 3; // Route Explorer open = Screen 3
    if (routes.length > 0 && !isEditingAddresses) return 2; // Has routes, not editing = Screen 2
    return 1; // Default to Screen 1 (Plan Your Ride)
  }, [isMobile, isRouteExplorerOpen, routes.length, isEditingAddresses]);
  
  // When user selects new addresses, exit edit mode and close Route Explorer
  const handleEditComplete = useCallback(() => {
    setIsEditingAddresses(false);
    setIsRouteExplorerOpen(false);
  }, []);
  
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
    /* UBER-STYLE RESPONSIVE LAYOUT
     * Desktop (>=1024px): 3-column grid - Left sidebar, Center ride list, Right map
     * Mobile (<1024px): Stacked layout - Map with overlay, bottom sheet with carousel
     */
    <div className="h-screen flex flex-col bg-muted/30" data-testid="plan-your-ride-page">
      {/* Header - visible on both layouts */}
      <div className="flex-shrink-0 z-30 bg-background/95 backdrop-blur-sm border-b p-4">
        <div className="flex items-center gap-3">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Plan your ride</h1>
        </div>
      </div>

      {/* ========== DESKTOP LAYOUT (>= 1024px): 3-COLUMN GRID ========== */}
      <div className="hidden lg:grid lg:grid-cols-[340px_440px_1fr] lg:gap-4 flex-1 overflow-hidden p-4">
        
        {/* LEFT COLUMN: Plan your ride sidebar */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Professional Address Header for Desktop */}
          <RideAddressHeader
            pickupQuery={pickupQuery}
            dropoffQuery={dropoffQuery}
            onPickupQueryChange={setPickupQuery}
            onDropoffQueryChange={setDropoffQuery}
            onPickupSelect={handlePickupSelect}
            onDropoffSelect={handleDropoffSelect}
            onSwapAddresses={handleSwapAddresses}
            onCurrentLocation={handleGetCurrentLocation}
            isLocatingCurrentLocation={isLocating}
            locationError={locationError}
            focusedField={focusedField}
            onPickupFocus={() => setFocusedField("pickup")}
            onPickupBlur={() => setFocusedField(null)}
            onDropoffFocus={() => setFocusedField("dropoff")}
            onDropoffBlur={() => setFocusedField(null)}
            pickup={pickup}
            dropoff={dropoff}
          />

          {/* Promo & Payment Card */}
          <Card className="shadow-[0_6px_18px_rgba(0,0,0,0.06)] bg-white dark:bg-card rounded-xl border border-[#E5E7EB] dark:border-border" style={{ borderRadius: "16px" }} data-testid="desktop-promo-card">
            <CardContent className="p-4 space-y-3">
              {/* Promo Banner in sidebar for desktop */}
              {activeRoute && appliedPromo && (
                <div 
                  className="px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer hover-elevate"
                  style={{ background: "#E7FCE5" }}
                  onClick={() => {
                    setAppliedPromo(null);
                    toast({ title: "Promo removed", description: "Viewing regular prices" });
                  }}
                  data-testid="desktop-promo-banner"
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

              {activeRoute && !appliedPromo && availablePromos.length > 0 && !isLoadingPromos && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10 text-sm gap-2 border-dashed border-green-300 text-green-700 hover:bg-green-50"
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
                  data-testid="desktop-apply-promo"
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

          {/* Saved/Recent places */}
          {showSuggestions && (
            <Card className="shadow-lg rounded-xl overflow-hidden" data-testid="desktop-suggestions">
              <CardContent className="p-3 max-h-[300px] overflow-y-auto">
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
                        testId={`desktop-suggestion-${place.id}`}
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
                        testId={`desktop-recent-${recent.id}`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* CENTER COLUMN: Vertical ride list + Request button */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {activeRoute ? (
            <>
              <div className="flex items-center gap-2 px-1">
                <Car className="h-5 w-5" />
                <h3 className="font-semibold">Choose your ride</h3>
              </div>
              
              {/* Vertical ride list - Uber style rows */}
              <div className="space-y-3" data-testid="desktop-ride-list">
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
                      data-testid={`desktop-ride-row-${categoryId}`}
                      className={`
                        flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all
                        ${isSelected 
                          ? "border-2 border-primary bg-blue-50 dark:bg-blue-950/30" 
                          : isUnavailable
                            ? "border border-[#E5E7EB] bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border border-[#E5E7EB] bg-background hover:shadow-md"
                        }
                      `}
                    >
                      {/* Vehicle image */}
                      <div 
                        className="h-16 w-24 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden"
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
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base">{catConfig.displayName}</p>
                          {catConfig.isPopular && !isUnavailable && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-0">
                              Popular
                            </Badge>
                          )}
                          {isLimited && !isUnavailable && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-0">
                              Limited
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{catConfig.shortDescription}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {catConfig.seatCount}
                          </span>
                          <span>•</span>
                          <span>{isUnavailable ? "No drivers nearby" : `${etaMinutes} min away`}</span>
                        </div>
                        {hasDiscount && !isUnavailable && (
                          <p className="text-xs font-medium mt-1" style={{ color: "#16A34A" }}>
                            You save ${fareData.discountAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                      
                      {/* Price */}
                      <div className="flex-shrink-0 text-right">
                        {isUnavailable ? (
                          <p className="text-sm text-muted-foreground">Unavailable</p>
                        ) : (
                          <>
                            <p className="text-lg font-bold">${fareData.finalFare.toFixed(2)}</p>
                            {hasDiscount && (
                              <p className="text-sm text-muted-foreground line-through">
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

              {/* Fare summary for selected */}
              {fareEstimate && (
                <Card className="rounded-xl border border-[#E5E7EB]">
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

                    {/* Route selection */}
                    {routes.length > 1 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Choose route:</p>
                        <div className="flex flex-wrap gap-2">
                          {routes.map((route, index) => {
                            const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                            const isActive = route.id === activeRouteId;
                            return (
                              <Button
                                key={route.id}
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => setActiveRouteId(route.id)}
                                data-testid={`desktop-route-${route.id}`}
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

              {/* Request ride button - desktop */}
              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleRequestRide}
                  disabled={!canRequestRide}
                  className="w-full max-w-[360px] h-14 text-lg font-semibold rounded-xl"
                  data-testid="desktop-request-ride"
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Enter pickup and dropoff</p>
                <p className="text-sm mt-1">Set your locations to see ride options</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Full-height map */}
        <div className="relative rounded-xl overflow-hidden border border-[#E5E7EB] min-h-[400px]">
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
        </div>
      </div>

      {/* ========== MOBILE LAYOUT (< 1024px): UBER-STYLE VERTICAL LIST ==========
       * MOBILE LAYOUT STRUCTURE:
       * 1. Fixed-height map section (h-56 / 224px) with location card overlay
       *    - When Route Explorer is open: map expands to take most of screen (flex-1)
       * 2. Scrollable content: promo banner → ride list (vertical rows) → fare summary
       *    - When Route Explorer is open: ride list is hidden, only route chips shown
       * 3. Sticky request button at bottom (always visible)
       * 
       * isRouteExplorerOpen is a mobile-only UI state for layout orchestration
       * DESKTOP: Uses the 3-column grid layout above (hidden on mobile via lg:hidden)
       */}
      <div className="lg:hidden flex flex-col h-full overflow-hidden">
        {/* MAP SECTION - Expands when Route Explorer is open (mobile only) */}
        <div className={`relative flex-shrink-0 z-[1] transition-all duration-300 ${isMobile && isRouteExplorerOpen ? 'flex-1 min-h-[60vh]' : 'h-56'}`}>
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

          {/* Mobile Address UI - Conditional based on screen
              Screen 1: Full RideAddressHeader with inputs
              Screen 2/3: Compact AddressSummaryCapsule */}
          <div className="absolute top-3 left-3 right-3 z-20">
            {mobileScreen === 1 ? (
              /* Screen 1: Full Address Inputs (Plan Your Ride) */
              <RideAddressHeader
                pickupQuery={pickupQuery}
                dropoffQuery={dropoffQuery}
                onPickupQueryChange={setPickupQuery}
                onDropoffQueryChange={setDropoffQuery}
                onPickupSelect={(loc) => {
                  handlePickupSelect(loc);
                  handleEditComplete();
                }}
                onDropoffSelect={(loc) => {
                  handleDropoffSelect(loc);
                  handleEditComplete();
                }}
                onSwapAddresses={handleSwapAddresses}
                onCurrentLocation={handleGetCurrentLocation}
                isLocatingCurrentLocation={isLocating}
                locationError={locationError}
                focusedField={focusedField}
                onPickupFocus={() => setFocusedField("pickup")}
                onPickupBlur={() => setFocusedField(null)}
                onDropoffFocus={() => setFocusedField("dropoff")}
                onDropoffBlur={() => setFocusedField(null)}
                pickup={pickup}
                dropoff={dropoff}
              />
            ) : (
              /* Screen 2/3: Compact Address Summary Capsule */
              <AddressSummaryCapsule
                pickup={pickup}
                dropoff={dropoff}
                onEdit={() => setIsEditingAddresses(true)}
              />
            )}

            {mobileScreen === 1 && showSuggestions && (
              <Card className="mt-2 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#E5E7EB] dark:border-border max-h-[30vh] overflow-y-auto" style={{ borderRadius: "16px" }} data-testid="suggestions-card">
                <CardContent className="p-2">
                  {validSavedPlaces.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
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

          {/* Route Chips Overlay - Only shown when Route Explorer is open (mobile only) */}
          {isMobile && isRouteExplorerOpen && routes.length > 1 && (
            <div 
              className="absolute bottom-4 left-4 right-4 z-30 bg-white dark:bg-card rounded-2xl px-4 py-3"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
              data-testid="route-chips-overlay"
            >
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {routes.map((route, index) => {
                  const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                  const distMi = route.distanceMiles.toFixed(1);
                  const isActive = route.id === activeRouteId;
                  const label = index === 0 ? "Fastest" : route.summary || `Route ${index + 1}`;
                  
                  return (
                    <button
                      key={route.id}
                      onClick={() => setActiveRouteId(route.id)}
                      aria-pressed={isActive}
                      tabIndex={0}
                      className={`
                        flex-shrink-0 px-4 py-2 rounded-full transition-all
                        ${isActive 
                          ? "bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-600" 
                          : "bg-[#F9FAFB] dark:bg-muted border border-transparent hover:border-gray-300"
                        }
                      `}
                      data-testid={`route-chip-${route.id}`}
                    >
                      <p className={`text-sm font-medium whitespace-nowrap ${isActive ? "text-blue-600" : "text-foreground"}`}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {etaMin} min • {distMi} mi
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        {/* End of map section */}
        </div>

        {/* SCROLLABLE CONTENT AREA - Hidden when Route Explorer is open (mobile only) */}
        <div className={`flex-1 overflow-y-auto bg-background pb-24 ${isMobile && isRouteExplorerOpen ? 'hidden' : ''}`}>
          
          {/* Promo Banner - under map */}
          {activeRoute && appliedPromo && (
            <div className="px-4 pt-4 pb-2">
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
                <span className="text-[10px] text-green-600 font-medium">Tap to remove</span>
              </div>
            </div>
          )}

          {/* Apply Promo button */}
          {activeRoute && !appliedPromo && availablePromos.length > 0 && !isLoadingPromos && (
            <div className="px-4 pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 text-sm gap-2 border-dashed border-green-300 text-green-700 hover:bg-green-50"
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

          {/* Section title - Choose your ride */}
          {activeRoute && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-base font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" />
                Choose your ride
              </p>
            </div>
          )}

          {/* VERTICAL RIDE LIST - Uber-style full-width rows */}
          {activeRoute && (
            <div className="px-4 space-y-2" data-testid="mobile-ride-list">
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
                    data-testid={`mobile-ride-row-${categoryId}`}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                      ${isSelected 
                        ? "bg-blue-50 dark:bg-blue-950/30 border-2 border-primary" 
                        : isUnavailable
                          ? "bg-muted/30 border border-[#E5E7EB] opacity-50 cursor-not-allowed"
                          : "bg-background border border-[#E5E7EB] active:bg-muted/50"
                      }
                    `}
                  >
                    {/* Vehicle image - left */}
                    <div 
                      className="h-14 w-20 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden"
                      style={{ background: "linear-gradient(180deg, #FFFFFF 40%, #F2F2F2 100%)" }}
                    >
                      <img 
                        src={vehicleImage} 
                        alt={catConfig.displayName}
                        className="w-full h-full object-contain"
                        style={{ filter: isUnavailable ? "grayscale(1)" : "drop-shadow(0px 3px 8px rgba(0,0,0,0.12))" }}
                      />
                    </div>
                    
                    {/* Text info - middle */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm">{catConfig.displayName}</p>
                        {catConfig.isPopular && !isUnavailable && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-0">
                            Popular
                          </Badge>
                        )}
                        {isLimited && !isUnavailable && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 border-0">
                            Limited
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {catConfig.seatCount}
                        </span>
                        <span>•</span>
                        <span>{isUnavailable ? "No drivers" : `${etaMinutes} min`}</span>
                      </div>
                      {hasDiscount && !isUnavailable && (
                        <p className="text-[11px] font-medium mt-0.5" style={{ color: "#16A34A" }}>
                          You save ${fareData.discountAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                    
                    {/* Price - right */}
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
          )}

          {/* Fare summary card */}
          {fareEstimate && (
            <div className="px-4 mt-3">
              <Card 
                className="rounded-[14px] overflow-hidden" 
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
          </div>
          )}

          {isCalculatingFare && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Calculating fare...</span>
          </div>
        )}
        </div>

        {/* [D] MOBILE BOTTOM BAR - 2-step control for Route Explorer
          * isRouteExplorerOpen is a mobile-only UI state
          * No business logic is implemented here; only orchestrates layout and route selection based on existing state
          */}
        <div className="flex-shrink-0 px-4 py-4 bg-background border-t">
          {/* Step 1: Show "Choose your route" when NOT in Route Explorer and has multiple routes (mobile only) */}
          {isMobile && !isRouteExplorerOpen && activeRoute && routes.length > 1 && (
            <Button
              onClick={() => setIsRouteExplorerOpen(true)}
              disabled={!canRequestRide}
              className="w-full h-14 text-base font-semibold rounded-xl"
              data-testid="button-choose-route"
            >
              <RouteIcon className="h-5 w-5 mr-2" />
              Choose your route
            </Button>
          )}

          {/* Show Request Ride directly when: 
              - Route Explorer is closed AND (no routes yet OR single route)
              - This covers: desktop always shows "Request ride", mobile shows it for single/no routes
          */}
          {!(isMobile && isRouteExplorerOpen) && !(isMobile && activeRoute && routes.length > 1) && (
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
          )}

          {/* Step 2: Route Explorer open - show back + Request ride (mobile only) */}
          {isMobile && isRouteExplorerOpen && (
            <>
              {/* Top row: instruction + back link */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Choose your favorite route on the map</p>
                <button
                  onClick={() => setIsRouteExplorerOpen(false)}
                  className="text-sm font-medium text-primary hover:underline"
                  data-testid="button-back-to-details"
                >
                  Back to ride details
                </button>
              </div>
              {/* Request ride button */}
              <Button
                onClick={handleRequestRide}
                disabled={!canRequestRide}
                className="w-full h-14 text-base font-semibold rounded-xl"
                data-testid="button-request-ride-explorer"
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
            </>
          )}

          {!pickup && !dropoff && !isRouteExplorerOpen && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Set pickup and dropoff to continue
            </p>
          )}
        </div>
        {/* End of scrollable content + sticky button */}
      </div>
      {/* End of mobile layout wrapper */}
    </div>
  );
}
