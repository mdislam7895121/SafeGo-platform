import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useNotificationSound } from "@/contexts/NotificationSoundContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { useCustomerLocation, createCustomerLocationIcon } from "@/hooks/useCustomerLocation";
import {
  Car,
  UtensilsCrossed,
  Package,
  MapPin,
  Crosshair,
  Loader2,
  ChevronUp,
  ChevronDown,
  Users,
  Zap,
  Wallet,
  Route as RouteIcon,
  Menu,
  User,
  Home,
  Clock,
  HelpCircle,
  X,
  Pencil,
  ArrowRight,
  Sparkles,
  Map,
  Navigation,
  Star,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type RideStatus = 
  | "SELECTING"
  | "CONFIRMING"
  | "SEARCHING_DRIVER"
  | "DRIVER_ASSIGNED"
  | "TRIP_IN_PROGRESS"
  | "TRIP_COMPLETED"
  | "TRIP_CANCELLED";

// Explicit tracking phases for Uber-style live tracking
// EN_ROUTE_TO_PICKUP: Driver is heading to pick up the customer
// EN_ROUTE_TO_DROPOFF: Customer is in the car, heading to destination
type TrackingPhase = "EN_ROUTE_TO_PICKUP" | "EN_ROUTE_TO_DROPOFF" | "COMPLETED" | "CANCELLED" | null;

interface DriverInfo {
  name: string;
  rating: number;
  carModel: string;
  carColor: string;
  plateNumber: string;
  avatarInitials: string;
  pickupEtaMinutes: number;
}
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { FareDetailsAccordion } from "@/components/ride/FareDetailsAccordion";
import { RideStatusPanel, type DriverInfo as StatusDriverInfo } from "@/components/ride/RideStatusPanel";
import { MobileLiveTracking } from "@/components/ride/MobileLiveTracking";
import {
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_ORDER,
  type VehicleCategoryId,
} from "@shared/vehicleCategories";
import { getVehicleCategoryImage } from "@/lib/vehicleMedia";
import { useCategoryAvailability } from "@/hooks/useCategoryAvailability";
import { apiRequest } from "@/lib/queryClient";

type ServiceType = "ride" | "eats" | "parcel";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

interface RouteData {
  id: string;
  summary: string;
  distanceMiles: number;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number;
  polyline: string;
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
  isDefault: boolean;
}

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 24px; height: 24px; background: #3B82F6; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 24px; height: 24px; background: #EF4444; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const driverIcon = L.divIcon({
  className: "driver-marker",
  html: `<div style="
    width: 36px; height: 36px; background: #10B981; 
    border: 4px solid white; border-radius: 50%; 
    box-shadow: 0 3px 12px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="transform: rotate(-45deg);">
      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const driverIconPulsing = L.divIcon({
  className: "driver-marker-pulsing",
  html: `<div style="
    position: relative;
    width: 36px; height: 36px;
  ">
    <div style="
      position: absolute;
      width: 36px; height: 36px; background: #10B981; 
      border: 4px solid white; border-radius: 50%; 
      box-shadow: 0 3px 12px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 2;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="transform: rotate(-45deg);">
        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
      </svg>
    </div>
    <div style="
      position: absolute;
      width: 36px; height: 36px;
      background: rgba(16, 185, 129, 0.3);
      border-radius: 50%;
      animation: pulse 2s ease-out infinite;
      z-index: 1;
    "></div>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function calculateBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lng - from.lng);
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function calculateDistance(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R = 3959;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function interpolatePosition(
  from: { lat: number; lng: number }, 
  to: { lat: number; lng: number }, 
  t: number
): { lat: number; lng: number } {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

function detectTurnDirection(currentHeading: number, nextHeading: number): string {
  let diff = ((nextHeading - currentHeading + 540) % 360) - 180;
  
  if (Math.abs(diff) < 30) return "continue";
  if (diff > 0 && diff < 90) return "slight_right";
  if (diff >= 90 && diff < 135) return "right";
  if (diff >= 135) return "sharp_right";
  if (diff < 0 && diff > -90) return "slight_left";
  if (diff <= -90 && diff > -135) return "left";
  return "sharp_left";
}

function getManeuverText(maneuver: string): string {
  const texts: Record<string, string> = {
    continue: "Continue straight",
    slight_right: "Bear right",
    right: "Turn right",
    sharp_right: "Make a sharp right",
    slight_left: "Bear left",
    left: "Turn left",
    sharp_left: "Make a sharp left",
  };
  return texts[maneuver] || "Continue";
}

// Generate a realistic driver starting position 1-3 miles from pickup
// Uses a random bearing but ensures the position is along a plausible route direction
function generateDriverStartPosition(
  pickupLat: number, 
  pickupLng: number
): { lat: number; lng: number } {
  // Random distance between 1 and 3 miles
  const distanceMiles = 1 + Math.random() * 2;
  
  // Random bearing (0-360 degrees)
  const bearingDeg = Math.random() * 360;
  
  // Convert to radians for calculation
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  // Earth radius in miles
  const R = 3959;
  
  const lat1 = toRad(pickupLat);
  const lng1 = toRad(pickupLng);
  const bearing = toRad(bearingDeg);
  const d = distanceMiles / R;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + 
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    lat: toDeg(lat2),
    lng: toDeg(lng2),
  };
}

function createRotatedDriverIcon(heading: number): L.DivIcon {
  const arrowRotation = heading - 45;
  return L.divIcon({
    className: "driver-marker-pulsing",
    html: `<div style="
      position: relative;
      width: 36px; height: 36px;
    ">
      <div style="
        position: absolute;
        width: 36px; height: 36px; background: #10B981; 
        border: 4px solid white; border-radius: 50%; 
        box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        z-index: 2;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="transform: rotate(${arrowRotation}deg); transition: transform 0.3s ease;">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
        </svg>
      </div>
      <div style="
        position: absolute;
        width: 36px; height: 36px;
        background: rgba(16, 185, 129, 0.3);
        border-radius: 50%;
        animation: pulse 2s ease-out infinite;
        z-index: 1;
      "></div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function MapBoundsHandler({
  pickupLocation,
  dropoffLocation,
  routePoints,
}: {
  pickupLocation: LocationData | null;
  dropoffLocation: LocationData | null;
  routePoints?: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (routePoints && routePoints.length > 0) {
      const bounds = L.latLngBounds(routePoints);
      if (pickupLocation) {
        bounds.extend([pickupLocation.lat, pickupLocation.lng]);
      }
      if (dropoffLocation) {
        bounds.extend([dropoffLocation.lat, dropoffLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (pickupLocation && dropoffLocation) {
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
  }, [map, pickupLocation, dropoffLocation, routePoints]);

  return null;
}

function MapFollowDriver({
  driverPosition,
  isFollowing,
  onUserInteraction,
}: {
  driverPosition: { lat: number; lng: number } | null;
  isFollowing: boolean;
  onUserInteraction?: () => void;
}) {
  const map = useMap();
  const interactionDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!driverPosition || !isFollowing) return;
    
    // Smoothly pan to driver position
    map.panTo([driverPosition.lat, driverPosition.lng], { animate: true, duration: 0.5 });
  }, [map, driverPosition, isFollowing]);

  // Detect user interaction to pause auto-follow (drag, zoom, touch) with debouncing
  useEffect(() => {
    if (!onUserInteraction) return;
    
    const handleInteraction = () => {
      // Debounce: only fire once per 500ms
      if (interactionDebounceRef.current) return;
      
      onUserInteraction();
      
      interactionDebounceRef.current = window.setTimeout(() => {
        interactionDebounceRef.current = null;
      }, 500);
    };
    
    // Listen to all user interaction events
    map.on("dragstart", handleInteraction);
    map.on("zoomstart", handleInteraction);
    map.on("mousedown", handleInteraction);
    map.on("touchstart", handleInteraction);
    
    return () => {
      map.off("dragstart", handleInteraction);
      map.off("zoomstart", handleInteraction);
      map.off("mousedown", handleInteraction);
      map.off("touchstart", handleInteraction);
      if (interactionDebounceRef.current) {
        clearTimeout(interactionDebounceRef.current);
      }
    };
  }, [map, onUserInteraction]);

  return null;
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function formatDurationMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function UnifiedBookingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isReady: isGoogleMapsReady } = useGoogleMaps();
  const { playDriverAssigned, playTripStarted, playTripCompleted } = useNotificationSound();
  const [isClient, setIsClient] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const [isMobileLiveTrackingOpen, setIsMobileLiveTrackingOpen] = useState(false);
  const [isMobileAddressExpanded, setIsMobileAddressExpanded] = useState(false);
  const [isMobileFareExpanded, setIsMobileFareExpanded] = useState(false);
  const [isCancellingRide, setIsCancellingRide] = useState(false);

  const [activeService, setActiveService] = useState<ServiceType>("ride");

  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [focusedField, setFocusedField] = useState<"pickup" | "dropoff" | null>(null);
  const [isAddressPanelExpanded, setIsAddressPanelExpanded] = useState(true);

  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const activeRoute = useMemo(() => routes.find((r) => r.id === activeRouteId) || null, [routes, activeRouteId]);

  const [selectedVehicleCategory, setSelectedVehicleCategory] = useState<VehicleCategoryId>("SAFEGO_X");

  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [availablePromos, setAvailablePromos] = useState<BackendPromo[]>([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);

  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [showChooseRide, setShowChooseRide] = useState(false);

  // Ride flow state machine
  const [rideStatus, setRideStatus] = useState<RideStatus>("SELECTING");
  const rideStatusRef = useRef<RideStatus>("SELECTING");
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [tripStartTime, setTripStartTime] = useState<Date | null>(null);
  const [tripEndTime, setTripEndTime] = useState<Date | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);
  const [remainingMiles, setRemainingMiles] = useState<number>(0);
  
  // Live driver tracking state
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [interpolatedPosition, setInterpolatedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverPositionIndex, setDriverPositionIndex] = useState<number>(0);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [driverSpeedMph, setDriverSpeedMph] = useState<number>(0);
  const [nextTurnInstruction, setNextTurnInstruction] = useState<{
    text: string;
    distanceFeet: number;
    maneuver: string;
  } | null>(null);
  const [isFollowingDriver, setIsFollowingDriver] = useState<boolean>(true);
  const [isDriverPositionLoading, setIsDriverPositionLoading] = useState<boolean>(false);
  const desktopMapRef = useRef<HTMLDivElement | null>(null);
  const driverSimulationRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const prevDriverPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const prevTimestampRef = useRef<number>(Date.now());
  
  // Phase-based tracking state for Uber-style live tracking
  // Separates "going to pickup" from "going to dropoff" with distinct routes
  const [trackingPhase, setTrackingPhase] = useState<TrackingPhase>(null);
  const [driverStartPosition, setDriverStartPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverToPickupRoute, setDriverToPickupRoute] = useState<[number, number][]>([]);
  const [pickupToDropoffRoute, setPickupToDropoffRoute] = useState<[number, number][]>([]);
  const [pickupEtaMinutes, setPickupEtaMinutes] = useState<number>(0);
  const [pickupDistanceMiles, setPickupDistanceMiles] = useState<number>(0);
  
  // Customer live GPS location tracking (Uber-style blue dot)
  const { location: customerLocation, isLoading: isCustomerLocationLoading, isPermissionDenied: isLocationPermissionDenied } = useCustomerLocation();
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  
  // Memoized customer location icon (blue dot with pulse)
  const customerLocationIcon = useMemo(() => {
    if (!isClient) return null;
    return createCustomerLocationIcon();
  }, [isClient]);
  
  // Rating and tip state (UI only, no backend)
  const [userRating, setUserRating] = useState<number>(0);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  
  // Developer debug mode (click logo 5 times to enable)
  const [showDebugControls, setShowDebugControls] = useState(false);
  const [debugClickCount, setDebugClickCount] = useState(0);
  const debugClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleDebugClick = useCallback(() => {
    setDebugClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowDebugControls(current => !current);
        toast({ 
          title: showDebugControls ? "Debug mode disabled" : "Debug mode enabled",
          description: showDebugControls ? "Developer controls hidden" : "Developer controls now visible"
        });
        return 0;
      }
      return newCount;
    });
    
    // Reset count after 2 seconds of no clicks
    if (debugClickTimeoutRef.current) {
      clearTimeout(debugClickTimeoutRef.current);
    }
    debugClickTimeoutRef.current = setTimeout(() => {
      setDebugClickCount(0);
    }, 2000);
  }, [showDebugControls, toast]);
  
  // Ref for search timeout
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { getETA, isUnavailable: checkUnavailable, isLimited: checkLimited } = useCategoryAvailability({
    pickupLat: pickup?.lat ?? null,
    pickupLng: pickup?.lng ?? null,
  });

  const mapCenter = useMemo(() => {
    if (pickup) return { lat: pickup.lat, lng: pickup.lng };
    if (dropoff) return { lat: dropoff.lat, lng: dropoff.lng };
    if (customerLocation && !hasInitialCentered) return { lat: customerLocation.lat, lng: customerLocation.lng };
    return { lat: 40.7128, lng: -74.006 };
  }, [pickup, dropoff, customerLocation, hasInitialCentered]);
  
  // Mark initial centering as done once we have a valid center
  useEffect(() => {
    if (!hasInitialCentered && (pickup || dropoff || customerLocation)) {
      setHasInitialCentered(true);
    }
  }, [hasInitialCentered, pickup, dropoff, customerLocation]);

  const routePolylines = useMemo(() => {
    return routes.map((route) => ({
      id: route.id,
      points: decodePolyline(route.polyline),
    }));
  }, [routes]);

  const activeRoutePoints = useMemo(() => {
    const activePolyline = routePolylines.find(p => p.id === activeRouteId);
    return activePolyline?.points || [];
  }, [routePolylines, activeRouteId]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch active promotions from backend and auto-apply default promo
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
            console.log("[UnifiedBooking] Auto-applied default promo:", defaultPromo.name);
          }
        }
      } catch (error) {
        console.error("[UnifiedBooking] Failed to fetch promotions:", error);
      } finally {
        setIsLoadingPromos(false);
      }
    };

    fetchPromotions();
  }, []);

  useEffect(() => {
    if (!pickup || !dropoff || !isGoogleMapsReady) return;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const parsedRoutes: RouteData[] = result.routes.map((route, index) => {
            const leg = route.legs[0];
            const distanceMeters = leg.distance?.value || 0;
            const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
            const polyline = route.overview_polyline || "";

            return {
              id: `route-${index}`,
              summary: route.summary || `Route ${index + 1}`,
              distanceMiles: distanceMeters / 1609.34,
              distanceMeters,
              durationSeconds: leg.duration?.value || 0,
              durationInTrafficSeconds: durationSeconds,
              polyline: typeof polyline === "string" ? polyline : "",
            };
          });
          
          setRoutes(parsedRoutes);
          if (parsedRoutes.length > 0) {
            setActiveRouteId(parsedRoutes[0].id);
            setShowChooseRide(true);
          }
        }
      }
    );
  }, [pickup, dropoff, isGoogleMapsReady]);

  const handleEditLocations = useCallback(() => {
    setShowChooseRide(false);
    setIsAddressPanelExpanded(true);
  }, []);

  const handlePickupSelect = useCallback((location: { address: string; lat: number; lng: number }) => {
    setPickup(location);
    setPickupQuery(location.address);
    setIsAddressPanelExpanded(false);
    sessionStorage.setItem("ridepickup", JSON.stringify(location));
  }, []);

  const handleDropoffSelect = useCallback((location: { address: string; lat: number; lng: number }) => {
    setDropoff(location);
    setDropoffQuery(location.address);
    setIsAddressPanelExpanded(false);
    sessionStorage.setItem("ridedropoff", JSON.stringify(location));
  }, []);

  const handleSwapAddresses = useCallback(() => {
    if (pickup && dropoff) {
      const tempPickup = pickup;
      const tempPickupQuery = pickupQuery;
      setPickup(dropoff);
      setPickupQuery(dropoffQuery);
      setDropoff(tempPickup);
      setDropoffQuery(tempPickupQuery);
      toast({ title: "Addresses swapped" });
    }
  }, [pickup, dropoff, pickupQuery, dropoffQuery, toast]);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `/api/maps/geocode?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            const location: LocationData = {
              address: data.address || "Current Location",
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            handlePickupSelect(location);
          }
        } catch {
          setLocationError("Could not get address");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setLocationError("Location access denied");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [handlePickupSelect]);

  const computeFareBreakdown = useCallback((route: RouteData, categoryId: VehicleCategoryId, promo?: AppliedPromo | null) => {
    const categoryConfig = VEHICLE_CATEGORIES[categoryId];
    const distanceMiles = route.distanceMiles;
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
    
    let discountAmount = 0;
    if (promo) {
      if (promo.discountType === "PERCENT" && promo.discountPercent > 0) {
        discountAmount = Math.round(originalFare * (promo.discountPercent / 100) * 100) / 100;
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
      originalFare,
      discountAmount,
      finalFare,
      promoCode,
      promoLabel,
      perMileRate,
      perMinuteRate,
      distanceMiles,
      etaWithTrafficMinutes,
    };
  }, []);

  const calculateFareForCategory = useCallback(
    (route: RouteData, categoryId: VehicleCategoryId) => {
      const breakdown = computeFareBreakdown(route, categoryId, appliedPromo);
      return {
        finalFare: breakdown.finalFare,
        originalFare: breakdown.originalFare,
        discountAmount: breakdown.discountAmount,
        promoCode: breakdown.promoCode,
        promoLabel: breakdown.promoLabel,
      };
    },
    [computeFareBreakdown, appliedPromo]
  );

  const fareEstimate = useMemo(() => {
    if (!activeRoute) return null;
    const breakdown = computeFareBreakdown(activeRoute, selectedVehicleCategory, appliedPromo);
    
    const durationHours = activeRoute.durationInTrafficSeconds / 3600;
    const avgSpeedMph = durationHours > 0 ? activeRoute.distanceMiles / durationHours : 0;
    
    let trafficLevel: "light" | "moderate" | "heavy";
    let trafficLabel: string;
    
    if (avgSpeedMph >= 35) {
      trafficLevel = "light";
      trafficLabel = "Light traffic on this route";
    } else if (avgSpeedMph >= 20) {
      trafficLevel = "moderate";
      trafficLabel = "Moderate traffic";
    } else if (avgSpeedMph > 0) {
      trafficLevel = "heavy";
      trafficLabel = "Heavy traffic";
    } else {
      trafficLevel = "light";
      trafficLabel = "Traffic info unavailable";
    }
    
    return {
      ...breakdown,
      distanceMiles: activeRoute.distanceMiles.toFixed(1),
      etaWithTrafficMinutes: Math.ceil(activeRoute.durationInTrafficSeconds / 60),
      trafficLevel,
      trafficLabel,
      promoCode: appliedPromo?.code,
      promoLabel: appliedPromo?.label,
    };
  }, [activeRoute, selectedVehicleCategory, computeFareBreakdown, appliedPromo]);

  const canRequestRide = pickup && dropoff && activeRoute && selectedVehicleCategory;

  // Mock driver data for simulation
  const mockDrivers: DriverInfo[] = [
    { name: "John D.", rating: 4.9, carModel: "Toyota Camry", carColor: "Gray", plateNumber: "ABC-1234", avatarInitials: "JD", pickupEtaMinutes: 4 },
    { name: "Sarah M.", rating: 4.8, carModel: "Honda Accord", carColor: "Black", plateNumber: "XYZ-5678", avatarInitials: "SM", pickupEtaMinutes: 5 },
    { name: "Mike R.", rating: 4.7, carModel: "Nissan Altima", carColor: "White", plateNumber: "DEF-9012", avatarInitials: "MR", pickupEtaMinutes: 3 },
  ];

  const handleRequestRide = useCallback(async () => {
    if (!canRequestRide || !pickup) return;
    
    // Move to CONFIRMING briefly, then to SEARCHING_DRIVER
    setRideStatus("CONFIRMING");
    setIsRequestingRide(true);
    
    // Store the pickup → dropoff route polyline for EN_ROUTE_TO_DROPOFF phase
    if (activeRoutePoints.length > 0) {
      setPickupToDropoffRoute(activeRoutePoints);
    }
    
    // Immediately transition to SEARCHING_DRIVER
    setTimeout(() => {
      setRideStatus("SEARCHING_DRIVER");
      setIsRequestingRide(false);
      
      // Simulate driver search (3-5 seconds)
      const searchDuration = 3000 + Math.random() * 2000;
      searchTimeoutRef.current = setTimeout(async () => {
        // Assign a random driver
        const driver = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
        
        // Generate driver starting position 1-3 miles from pickup (not 20+ miles away)
        const driverStart = generateDriverStartPosition(pickup.lat, pickup.lng);
        setDriverStartPosition(driverStart);
        
        // Fetch the driver → pickup route using Google Directions API
        // This creates a separate polyline for the EN_ROUTE_TO_PICKUP phase
        if (isGoogleMapsReady) {
          try {
            const directionsService = new google.maps.DirectionsService();
            const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
              directionsService.route(
                {
                  origin: { lat: driverStart.lat, lng: driverStart.lng },
                  destination: { lat: pickup.lat, lng: pickup.lng },
                  travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                  if (status === google.maps.DirectionsStatus.OK && result) {
                    resolve(result);
                  } else {
                    resolve(null);
                  }
                }
              );
            });
            
            if (result && result.routes[0]) {
              const route = result.routes[0];
              const polyline = route.overview_polyline;
              const polylineStr = typeof polyline === "string" ? polyline : "";
              const driverToPickupPoints = decodePolyline(polylineStr);
              setDriverToPickupRoute(driverToPickupPoints);
              
              // Calculate initial pickup ETA and distance from the route
              const leg = route.legs[0];
              const etaMinutes = Math.ceil((leg.duration?.value || 300) / 60);
              const distMiles = (leg.distance?.value || 1600) / 1609.34;
              setPickupEtaMinutes(etaMinutes);
              setPickupDistanceMiles(distMiles);
              setRemainingMinutes(etaMinutes);
              setRemainingMiles(distMiles);
            } else {
              // Fallback: generate a simple straight-line route if API fails
              setDriverToPickupRoute([[driverStart.lat, driverStart.lng], [pickup.lat, pickup.lng]]);
              const straightLineDistance = calculateDistance(driverStart, pickup);
              setPickupEtaMinutes(Math.ceil(straightLineDistance * 2)); // ~30 mph estimate
              setPickupDistanceMiles(straightLineDistance);
              setRemainingMinutes(Math.ceil(straightLineDistance * 2));
              setRemainingMiles(straightLineDistance);
            }
          } catch (error) {
            console.error("[UnifiedBooking] Failed to fetch driver-to-pickup route:", error);
            // Fallback route
            setDriverToPickupRoute([[driverStart.lat, driverStart.lng], [pickup.lat, pickup.lng]]);
            const straightLineDistance = calculateDistance(driverStart, pickup);
            setPickupEtaMinutes(Math.ceil(straightLineDistance * 2));
            setPickupDistanceMiles(straightLineDistance);
            setRemainingMinutes(Math.ceil(straightLineDistance * 2));
            setRemainingMiles(straightLineDistance);
          }
        }
        
        setDriverInfo(driver);
        setRideStatus("DRIVER_ASSIGNED");
        // Set tracking phase to EN_ROUTE_TO_PICKUP (driver heading toward customer)
        setTrackingPhase("EN_ROUTE_TO_PICKUP");
        
        // Play driver assigned notification sound
        playDriverAssigned();
        
        toast({ 
          title: "Driver found!", 
          description: `${driver.name} is on the way in a ${driver.carColor} ${driver.carModel}` 
        });
      }, searchDuration);
    }, 500);
  }, [canRequestRide, pickup, activeRoutePoints, isGoogleMapsReady, toast, mockDrivers, playDriverAssigned]);

  // Handle ride cancellation
  const handleCancelRide = useCallback(() => {
    // Clear any pending timeouts
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    if (rideStatus === "SEARCHING_DRIVER") {
      // Cancel before driver assigned - go back to selecting
      setRideStatus("SELECTING");
      setTrackingPhase(null);
      toast({ title: "Ride cancelled", description: "Your ride request has been cancelled" });
    } else if (rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") {
      // Cancel after driver assigned - show cancelled state
      setRideStatus("TRIP_CANCELLED");
      setTrackingPhase("CANCELLED");
      toast({ title: "Ride cancelled", description: "Your ride has been cancelled" });
    }
    
    setDriverInfo(null);
    setIsRequestingRide(false);
  }, [rideStatus, toast]);

  // Handle starting the trip (debug control)
  // This transitions from EN_ROUTE_TO_PICKUP to EN_ROUTE_TO_DROPOFF phase
  const handleStartTrip = useCallback(() => {
    if (rideStatus !== "DRIVER_ASSIGNED") return;
    
    setTripStartTime(new Date());
    setRemainingMinutes(activeRoute ? Math.ceil(activeRoute.durationInTrafficSeconds / 60) : 90);
    setRemainingMiles(activeRoute?.distanceMiles || 90);
    setRideStatus("TRIP_IN_PROGRESS");
    
    // Switch tracking phase to EN_ROUTE_TO_DROPOFF (customer in car, heading to destination)
    setTrackingPhase("EN_ROUTE_TO_DROPOFF");
    
    // Reset driver position to start of the pickup → dropoff route
    setDriverPositionIndex(0);
    if (pickupToDropoffRoute.length > 0) {
      const startPos = {
        lat: pickupToDropoffRoute[0][0],
        lng: pickupToDropoffRoute[0][1],
      };
      setDriverPosition(startPos);
      setInterpolatedPosition(startPos);
      prevDriverPositionRef.current = startPos;
    }
    
    // Play trip started notification sound
    playTripStarted();
    
    toast({ title: "Trip started", description: "You're on your way to your destination" });
  }, [rideStatus, activeRoute, pickupToDropoffRoute, toast, playTripStarted]);

  // Handle completing the trip (debug control)
  const handleCompleteTrip = useCallback(() => {
    if (rideStatus !== "TRIP_IN_PROGRESS") return;
    
    setTripEndTime(new Date());
    setRemainingMinutes(0);
    setRemainingMiles(0);
    setRideStatus("TRIP_COMPLETED");
    // Set tracking phase to COMPLETED
    setTrackingPhase("COMPLETED");
    
    // Play trip completed notification sound
    playTripCompleted();
    
    toast({ title: "Trip completed", description: "Hope you had a safe ride!" });
  }, [rideStatus, toast, playTripCompleted]);

  // Handle finishing the trip completion flow
  const handleFinishTripFlow = useCallback(() => {
    // Reset all ride state
    setRideStatus("SELECTING");
    setDriverInfo(null);
    setTripStartTime(null);
    setTripEndTime(null);
    setUserRating(0);
    setSelectedTip(null);
    setRemainingMinutes(0);
    setRemainingMiles(0);
    // Reset driver tracking state
    setDriverPosition(null);
    setInterpolatedPosition(null);
    setDriverPositionIndex(0);
    setDriverHeading(0);
    setDriverSpeedMph(0);
    setNextTurnInstruction(null);
    setIsFollowingDriver(true);
    prevDriverPositionRef.current = null;
    // Reset phase-based tracking state
    setTrackingPhase(null);
    setDriverStartPosition(null);
    setDriverToPickupRoute([]);
    setPickupToDropoffRoute([]);
    setPickupEtaMinutes(0);
    setPickupDistanceMiles(0);
    
    toast({ title: "Thank you!", description: "We hope to see you again soon" });
  }, [toast]);

  // Handle going back from cancelled state
  const handleBackFromCancelled = useCallback(() => {
    setRideStatus("SELECTING");
    setDriverInfo(null);
    // Reset driver tracking state
    setDriverPosition(null);
    setInterpolatedPosition(null);
    setDriverPositionIndex(0);
    setDriverHeading(0);
    setDriverSpeedMph(0);
    setNextTurnInstruction(null);
    setIsFollowingDriver(true);
    prevDriverPositionRef.current = null;
    // Reset phase-based tracking state
    setTrackingPhase(null);
    setDriverStartPosition(null);
    setDriverToPickupRoute([]);
    setPickupToDropoffRoute([]);
    setPickupEtaMinutes(0);
    setPickupDistanceMiles(0);
  }, []);

  // Convert driverInfo to StatusDriverInfo for RideStatusPanel
  const statusDriverInfo: StatusDriverInfo | null = useMemo(() => {
    if (!driverInfo) return null;
    return {
      id: `driver-${driverInfo.name.replace(/\s/g, "-").toLowerCase()}`,
      name: driverInfo.name,
      initials: driverInfo.avatarInitials,
      rating: driverInfo.rating,
      vehicleModel: driverInfo.carModel,
      vehicleColor: driverInfo.carColor,
      plate: driverInfo.plateNumber,
    };
  }, [driverInfo]);

  // Handle opening mobile live tracking overlay
  const handleOpenMobileLiveTracking = useCallback(() => {
    setIsMobileLiveTrackingOpen(true);
  }, []);

  // Handle closing mobile live tracking overlay
  const handleCloseMobileLiveTracking = useCallback(() => {
    setIsMobileLiveTrackingOpen(false);
  }, []);

  // Reference for cancel timeout cleanup
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep rideStatusRef in sync with rideStatus state
  useEffect(() => {
    rideStatusRef.current = rideStatus;
  }, [rideStatus]);

  // Handle cancel ride with confirmation
  const handleCancelRideWithConfirm = useCallback(() => {
    // Prevent double-cancel
    if (isCancellingRide) return;
    
    setIsCancellingRide(true);
    
    // Clear any existing cancel timeout
    if (cancelTimeoutRef.current) {
      clearTimeout(cancelTimeoutRef.current);
    }
    
    // Simulate API call delay
    cancelTimeoutRef.current = setTimeout(() => {
      // Check LIVE status via ref - only cancel if still DRIVER_ASSIGNED
      if (rideStatusRef.current === "DRIVER_ASSIGNED") {
        handleCancelRide();
      }
      setIsCancellingRide(false);
      setIsMobileLiveTrackingOpen(false);
      cancelTimeoutRef.current = null;
    }, 1000);
  }, [handleCancelRide, isCancellingRide]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (driverSimulationRef.current) {
        clearInterval(driverSimulationRef.current);
      }
      if (cancelTimeoutRef.current) {
        clearTimeout(cancelTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Get the active route points based on the current tracking phase
  // EN_ROUTE_TO_PICKUP uses driverToPickupRoute (driver → pickup)
  // EN_ROUTE_TO_DROPOFF uses pickupToDropoffRoute (pickup → dropoff)
  const phaseRoutePoints = useMemo(() => {
    if (trackingPhase === "EN_ROUTE_TO_PICKUP" && driverToPickupRoute.length > 0) {
      return driverToPickupRoute;
    } else if (trackingPhase === "EN_ROUTE_TO_DROPOFF" && pickupToDropoffRoute.length > 0) {
      return pickupToDropoffRoute;
    }
    return [];
  }, [trackingPhase, driverToPickupRoute, pickupToDropoffRoute]);

  // Detect next turn in route (uses phase-specific route)
  const detectNextTurn = useCallback((fromIndex: number): { text: string; distanceFeet: number; maneuver: string } | null => {
    if (phaseRoutePoints.length < 3 || fromIndex >= phaseRoutePoints.length - 2) return null;
    
    const lookAhead = Math.min(20, phaseRoutePoints.length - fromIndex - 1);
    let cumulativeDistance = 0;
    
    for (let i = fromIndex; i < fromIndex + lookAhead - 1; i++) {
      const p1 = { lat: phaseRoutePoints[i][0], lng: phaseRoutePoints[i][1] };
      const p2 = { lat: phaseRoutePoints[i + 1][0], lng: phaseRoutePoints[i + 1][1] };
      const p3 = { lat: phaseRoutePoints[i + 2][0], lng: phaseRoutePoints[i + 2][1] };
      
      const heading1 = calculateBearing(p1, p2);
      const heading2 = calculateBearing(p2, p3);
      const maneuver = detectTurnDirection(heading1, heading2);
      
      if (maneuver !== "continue") {
        const distanceToTurn = cumulativeDistance + calculateDistance(p1, p2);
        const distanceFeet = Math.round(distanceToTurn * 5280);
        
        return {
          text: getManeuverText(maneuver),
          distanceFeet,
          maneuver,
        };
      }
      
      cumulativeDistance += calculateDistance(p1, p2);
    }
    
    return null;
  }, [phaseRoutePoints]);

  // Calculate remaining distance from index to end of current phase route
  const calculateRemainingDistance = useCallback((fromIndex: number): number => {
    if (phaseRoutePoints.length < 2 || fromIndex >= phaseRoutePoints.length - 1) return 0;
    
    let distance = 0;
    for (let i = fromIndex; i < phaseRoutePoints.length - 1; i++) {
      const from = { lat: phaseRoutePoints[i][0], lng: phaseRoutePoints[i][1] };
      const to = { lat: phaseRoutePoints[i + 1][0], lng: phaseRoutePoints[i + 1][1] };
      distance += calculateDistance(from, to);
    }
    return distance;
  }, [phaseRoutePoints]);

  // Memoize a unique key for the phase route to detect route changes
  const phaseRouteKey = useMemo(() => {
    if (phaseRoutePoints.length === 0) return '';
    const first = phaseRoutePoints[0];
    const middle = phaseRoutePoints[Math.floor(phaseRoutePoints.length / 2)];
    const last = phaseRoutePoints[phaseRoutePoints.length - 1];
    return `${trackingPhase}:${phaseRoutePoints.length}:${first[0].toFixed(4)},${first[1].toFixed(4)}:${middle[0].toFixed(4)},${middle[1].toFixed(4)}:${last[0].toFixed(4)},${last[1].toFixed(4)}`;
  }, [trackingPhase, phaseRoutePoints]);
  
  // Track if simulation has been initialized for current phase route
  const simulationInitializedRef = useRef<string>('');

  // Phase-based driver simulation - moves driver along the correct route per phase
  // EN_ROUTE_TO_PICKUP: Driver moves from starting position TOWARD pickup
  // EN_ROUTE_TO_DROPOFF: Driver moves from pickup TOWARD dropoff
  useEffect(() => {
    const isTrackingDriver = trackingPhase === "EN_ROUTE_TO_PICKUP" || trackingPhase === "EN_ROUTE_TO_DROPOFF";
    
    if (!isTrackingDriver) {
      // Not in active tracking phase - clear simulation
      if (driverSimulationRef.current) {
        clearInterval(driverSimulationRef.current);
        driverSimulationRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Only reset position if not in a tracked state at all
      if (!trackingPhase) {
        setDriverPosition(null);
        setInterpolatedPosition(null);
        setDriverPositionIndex(0);
        setDriverHeading(0);
        setDriverSpeedMph(0);
        setNextTurnInstruction(null);
        prevDriverPositionRef.current = null;
        prevTimestampRef.current = Date.now();
        simulationInitializedRef.current = '';
      }
      return;
    }

    // Need route points to simulate
    if (phaseRoutePoints.length === 0) return;

    // Skip if already initialized for this exact phase route
    if (driverSimulationRef.current && simulationInitializedRef.current === phaseRouteKey) {
      return;
    }

    // Clear any existing simulation
    if (driverSimulationRef.current) {
      clearInterval(driverSimulationRef.current);
      driverSimulationRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Start at beginning of the current phase route
    // For EN_ROUTE_TO_PICKUP: index 0 = driver's starting position
    // For EN_ROUTE_TO_DROPOFF: index 0 = pickup location
    let currentIndex = 0;
    
    // Initialize driver position at start of phase route
    if (simulationInitializedRef.current !== phaseRouteKey) {
      const initialPosition = {
        lat: phaseRoutePoints[0][0],
        lng: phaseRoutePoints[0][1]
      };
      
      setDriverPositionIndex(0);
      setDriverPosition(initialPosition);
      setInterpolatedPosition(initialPosition);
      prevDriverPositionRef.current = initialPosition;
      prevTimestampRef.current = Date.now();
      
      // Calculate initial heading toward the next point on the route
      let initialHeading = 0;
      for (let i = 1; i < phaseRoutePoints.length; i++) {
        const candidatePoint = { lat: phaseRoutePoints[i][0], lng: phaseRoutePoints[i][1] };
        if (candidatePoint.lat !== initialPosition.lat || candidatePoint.lng !== initialPosition.lng) {
          const bearing = calculateBearing(initialPosition, candidatePoint);
          if (!isNaN(bearing) && isFinite(bearing)) {
            initialHeading = bearing;
            break;
          }
        }
      }
      setDriverHeading(initialHeading);
      
      // Detect first turn instruction
      const turn = detectNextTurn(0);
      setNextTurnInstruction(turn);
      
      // Calculate initial remaining distance to end of phase route
      const remainingDist = calculateRemainingDistance(0);
      setRemainingMiles(remainingDist);
      setRemainingMinutes(Math.max(1, Math.ceil(remainingDist * 2))); // ~30 mph estimate
      
      simulationInitializedRef.current = phaseRouteKey;
    }

    const capturedPhase = trackingPhase;
    const GPS_UPDATE_INTERVAL = 3000;

    // Simulation loop - advances driver along current phase route
    driverSimulationRef.current = setInterval(() => {
      const maxIndex = phaseRoutePoints.length - 1;
      // Step size varies by phase (slower approach to pickup)
      const step = capturedPhase === "EN_ROUTE_TO_PICKUP" ? 2 : 3;
      let newIndex = currentIndex + step;
      
      // Clamp to end of route
      if (newIndex > maxIndex) newIndex = maxIndex;
      
      if (phaseRoutePoints[newIndex]) {
        const newPosition = {
          lat: phaseRoutePoints[newIndex][0],
          lng: phaseRoutePoints[newIndex][1]
        };
        
        const now = Date.now();
        const timeDeltaHours = (now - prevTimestampRef.current) / 3600000;
        
        // Calculate speed from movement
        if (prevDriverPositionRef.current && timeDeltaHours > 0) {
          const distance = calculateDistance(prevDriverPositionRef.current, newPosition);
          const speed = Math.round(distance / timeDeltaHours);
          setDriverSpeedMph(Math.min(speed, 65));
          
          // Update heading to point in direction of travel
          const bearing = calculateBearing(prevDriverPositionRef.current, newPosition);
          if (!isNaN(bearing) && isFinite(bearing)) {
            setDriverHeading(bearing);
          }
        }
        
        // Smooth position interpolation animation
        const startPos = prevDriverPositionRef.current || newPosition;
        const startHeading = driverHeading;
        const targetHeading = calculateBearing(startPos, newPosition);
        let animationStart: number | null = null;
        
        const animateMove = (timestamp: number) => {
          if (animationStart === null) animationStart = timestamp;
          const elapsed = timestamp - animationStart;
          const progress = Math.min(elapsed / GPS_UPDATE_INTERVAL, 1);
          
          // Ease-in-out interpolation
          const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
          const interpolated = interpolatePosition(startPos, newPosition, easeProgress);
          setInterpolatedPosition(interpolated);
          
          // Smooth heading rotation
          if (!isNaN(targetHeading) && isFinite(targetHeading)) {
            let diff = ((targetHeading - startHeading + 540) % 360) - 180;
            const smoothHeading = (startHeading + diff * easeProgress + 360) % 360;
            setDriverHeading(smoothHeading);
          }
          
          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animateMove);
          }
        };
        
        animationFrameRef.current = requestAnimationFrame(animateMove);
        
        prevDriverPositionRef.current = newPosition;
        prevTimestampRef.current = now;
        currentIndex = newIndex;
        setDriverPositionIndex(newIndex);
        setDriverPosition(newPosition);
        
        // Update turn-by-turn instruction
        const turn = detectNextTurn(newIndex);
        setNextTurnInstruction(turn);
        
        // Update remaining distance and ETA to end of current phase route
        const remainingDist = calculateRemainingDistance(newIndex);
        setRemainingMiles(remainingDist);
        
        const avgSpeed = driverSpeedMph > 0 ? driverSpeedMph : 25;
        setRemainingMinutes(Math.max(1, Math.ceil((remainingDist / avgSpeed) * 60)));
      }
    }, GPS_UPDATE_INTERVAL);

    return () => {
      if (driverSimulationRef.current) {
        clearInterval(driverSimulationRef.current);
        driverSimulationRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [trackingPhase, phaseRoutePoints, phaseRouteKey, detectNextTurn, calculateRemainingDistance, driverHeading, driverSpeedMph]);

  // Handle scroll to map and highlight driver (desktop)
  const handleViewLiveMapDesktop = useCallback(() => {
    // Scroll to map section
    if (desktopMapRef.current) {
      desktopMapRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Reset follow mode
    setIsFollowingDriver(true);
  }, []);

  // Handle re-center on driver
  const handleRecenterOnDriver = useCallback(() => {
    setIsFollowingDriver(true);
  }, []);

  const services = [
    {
      id: "ride" as ServiceType,
      title: "SafeGo Ride",
      subtitle: "Point-to-point rides",
      icon: Car,
    },
    {
      id: "eats" as ServiceType,
      title: "SafeGo Eats",
      subtitle: "Order from nearby restaurants",
      icon: UtensilsCrossed,
    },
    {
      id: "parcel" as ServiceType,
      title: "SafeGo Parcel",
      subtitle: "Send packages and documents",
      icon: Package,
    },
  ];

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || "SG";

  // Cached rotated driver icon - updates on every heading change
  const cachedDriverIconRef = useRef<L.DivIcon | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  
  const rotatedDriverIcon = useMemo(() => {
    // Always update icon when heading changes to keep arrow direction accurate
    if (lastHeadingRef.current === null || lastHeadingRef.current !== driverHeading) {
      lastHeadingRef.current = driverHeading;
      cachedDriverIconRef.current = createRotatedDriverIcon(driverHeading);
    }
    return cachedDriverIconRef.current!;
  }, [driverHeading]);

  // Calculate remaining route polyline based on driver position and tracking phase
  // Uses phase-specific routes: driverToPickupRoute or pickupToDropoffRoute
  const remainingRoutePoints = useMemo(() => {
    if (!driverPosition || phaseRoutePoints.length < 2) return null;
    
    // Clamp driver index to valid range within the phase route
    const maxIdx = phaseRoutePoints.length - 1;
    const driverIdx = Math.min(Math.max(0, driverPositionIndex), maxIdx);
    
    if (trackingPhase === "EN_ROUTE_TO_PICKUP") {
      // Driver heading toward pickup - show remaining route to end of driverToPickupRoute
      const startIdx = Math.min(driverIdx, maxIdx);
      
      if (startIdx < maxIdx) {
        return phaseRoutePoints.slice(startIdx);
      }
      // Driver at pickup
      return null;
    } else if (trackingPhase === "EN_ROUTE_TO_DROPOFF") {
      // Driver heading toward dropoff - show remaining route to end of pickupToDropoffRoute
      const startIdx = Math.min(driverIdx, maxIdx);
      
      if (startIdx < maxIdx) {
        return phaseRoutePoints.slice(startIdx);
      }
      // Driver at destination
      return null;
    }
    
    // No tracking during other phases
    return null;
  }, [driverPosition, driverPositionIndex, phaseRoutePoints, trackingPhase]);

  return (
    <div className="h-screen flex flex-col bg-muted/30" data-testid="unified-booking-page">
      {/* Uber-style Sticky Header */}
      <header 
        className="sticky top-0 z-50 w-full bg-background border-b shadow-sm"
        data-testid="safego-header"
      >
        <div className="h-16 px-4 lg:px-6">
          <div className="h-full max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Left: Logo - Click 5 times to enable debug mode */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={handleDebugClick}
                data-testid="link-logo"
              >
                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                  <Car className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl tracking-tight hidden sm:inline">SafeGo</span>
              </div>
            </div>

            {/* Center: Service Switcher - Desktop Horizontal Tabs */}
            <nav className="hidden md:flex items-center" data-testid="desktop-service-switcher">
              <div className="flex items-center bg-muted/60 rounded-full p-1">
                {services.map((service) => {
                  const isActive = activeService === service.id;
                  const Icon = service.icon;
                  return (
                    <button
                      key={service.id}
                      onClick={() => setActiveService(service.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      data-testid={`service-tab-${service.id}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{service.id === "ride" ? "Ride" : service.id === "eats" ? "Eats" : "Parcel"}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Center: Service Switcher - Mobile Dropdown */}
            <div className="md:hidden flex-1 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="gap-2 px-4 rounded-full border-border"
                    data-testid="mobile-service-dropdown"
                  >
                    {activeService === "ride" && <Car className="h-4 w-4" />}
                    {activeService === "eats" && <UtensilsCrossed className="h-4 w-4" />}
                    {activeService === "parcel" && <Package className="h-4 w-4" />}
                    <span className="capitalize">{activeService}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  {services.map((service) => {
                    const Icon = service.icon;
                    return (
                      <DropdownMenuItem 
                        key={service.id}
                        onClick={() => setActiveService(service.id)}
                        className={activeService === service.id ? "bg-muted" : ""}
                        data-testid={`mobile-service-${service.id}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {service.id === "ride" ? "Ride" : service.id === "eats" ? "Eats" : "Parcel"}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: Navigation + Profile */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Desktop Navigation Links */}
              <nav className="hidden lg:flex items-center gap-1 mr-2" data-testid="desktop-nav">
                <Link href="/customer">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="nav-home">
                    <Home className="h-4 w-4" />
                    Home
                  </Button>
                </Link>
                <Link href="/customer/activity">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="nav-activity">
                    <Clock className="h-4 w-4" />
                    Activity
                  </Button>
                </Link>
                <Link href="/customer/support">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="nav-help">
                    <HelpCircle className="h-4 w-4" />
                    Help
                  </Button>
                </Link>
              </nav>

              {/* Theme Toggle */}
              <ThemeToggle variant="dropdown" />
              
              {/* Sound Toggle */}
              <SoundToggle />

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full"
                    data-testid="button-profile"
                  >
                    <Avatar className="h-8 w-8 border-2 border-border">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-medium">{user?.email || "Guest"}</p>
                    <p className="text-xs text-muted-foreground">SafeGo Account</p>
                  </div>
                  <Link href="/customer/profile">
                    <DropdownMenuItem data-testid="menu-profile">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/customer/wallet">
                    <DropdownMenuItem data-testid="menu-wallet">
                      <Wallet className="h-4 w-4 mr-2" />
                      Wallet
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  {/* Mobile-only nav links */}
                  <div className="lg:hidden">
                    <Link href="/customer">
                      <DropdownMenuItem data-testid="mobile-nav-home">
                        <Home className="h-4 w-4 mr-2" />
                        Home
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/customer/activity">
                      <DropdownMenuItem data-testid="mobile-nav-activity">
                        <Clock className="h-4 w-4 mr-2" />
                        Activity
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/customer/support">
                      <DropdownMenuItem data-testid="mobile-nav-help">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Help
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Button - Hidden on larger screens */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t bg-background animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-3 space-y-1">
              <Link href="/customer" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-menu-home">
                  <Home className="h-5 w-5" />
                  Home
                </Button>
              </Link>
              <Link href="/customer/activity" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-menu-activity">
                  <Clock className="h-5 w-5" />
                  Activity
                </Button>
              </Link>
              <Link href="/customer/support" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-menu-help">
                  <HelpCircle className="h-5 w-5" />
                  Help
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 lg:flex-none lg:w-[40%] lg:max-w-[480px] lg:flex-shrink-0 lg:border-r flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28 lg:pb-4 min-h-0">
            
            {activeService === "ride" && (
              <>
                {/* Choose Ride View - Compact Header with Pickup/Dropoff */}
                {showChooseRide && pickup && dropoff && activeRoute ? (
                  <>
                    {/* MOBILE: Address Capsule - Uber-style pill */}
                    <div className="md:hidden">
                      <div 
                        className="rounded-full px-4 py-2.5 flex items-center gap-3 border"
                        style={{ background: "#F9FAFB", borderColor: "#E5E7EB" }}
                        data-testid="mobile-address-capsule"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <div className="w-0.5 h-3 bg-border" />
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{pickup.address.split(",")[0]}</p>
                            <p className="text-xs font-medium truncate text-muted-foreground">{dropoff.address.split(",")[0]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button 
                            onClick={() => setIsMobileAddressExpanded(!isMobileAddressExpanded)}
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted"
                            data-testid="button-expand-address"
                          >
                            {isMobileAddressExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          <button 
                            onClick={handleEditLocations}
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted"
                            data-testid="button-edit-address-mobile"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Expanded address editor */}
                      {isMobileAddressExpanded && (
                        <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                          <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <span className="text-sm flex-1 truncate">{pickup.address}</span>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                            <span className="text-sm flex-1 truncate">{dropoff.address}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                            <span className="font-medium">{activeRoute.distanceMiles.toFixed(1)} mi</span>
                            <span>•</span>
                            <span>{formatDurationMinutes(Math.ceil(activeRoute.durationInTrafficSeconds / 60))}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DESKTOP: Compact Location Header - Original style */}
                    <div 
                      className="hidden md:block bg-background rounded-xl border border-border p-3 shadow-sm"
                      data-testid="ride-locations-header"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-2.5 w-2.5 rounded-full bg-foreground" />
                            <div className="w-0.5 h-6 bg-border" />
                            <div className="h-2.5 w-2.5 rounded-sm bg-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" data-testid="text-pickup-summary">
                              {pickup.address.split(",")[0]}
                            </p>
                            <p className="text-sm font-medium truncate mt-1.5" data-testid="text-dropoff-summary">
                              {dropoff.address.split(",")[0]}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 rounded-full flex-shrink-0"
                          onClick={handleEditLocations}
                          data-testid="button-edit-locations"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-muted-foreground">
                        <span className="font-medium">{activeRoute.distanceMiles.toFixed(1)} mi</span>
                        <span>•</span>
                        <span>{formatDurationMinutes(Math.ceil(activeRoute.durationInTrafficSeconds / 60))}</span>
                        {routes.length > 1 && (
                          <>
                            <span>•</span>
                            <button 
                              className="text-primary font-medium hover:underline"
                              onClick={() => {/* Could add route selector modal */}}
                            >
                              {routes.length} routes
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Global Promo Strip - Uber-style savings banner */}
                    {/* Only show when promo exists AND there's actual savings on the selected vehicle */}
                    {(() => {
                      const selectedFareData = calculateFareForCategory(activeRoute, selectedVehicleCategory);
                      const hasActualSavings = appliedPromo && selectedFareData.discountAmount > 0;
                      return hasActualSavings && (
                        <div 
                          className="px-4 py-2 rounded-full flex items-center justify-between"
                          style={{ background: "#ECFDF3" }}
                          data-testid="promo-banner"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "rgba(22, 163, 74, 0.15)" }}>
                              <Zap className="h-3.5 w-3.5" style={{ color: "#16A34A" }} />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: "#166534" }}>{appliedPromo.label}</span>
                              <span className="text-xs font-medium" style={{ color: "#166534" }}>
                                {appliedPromo.discountType === "PERCENT" 
                                  ? `• ${appliedPromo.discountPercent}% off your ride`
                                  : `• You save $${selectedFareData.discountAmount.toFixed(2)} on this trip`}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium whitespace-nowrap ml-2" style={{ color: "#6B7280" }}>Applied automatically</span>
                        </div>
                      );
                    })()}

                    {/* Route Selection */}
                    {routes.length > 1 && (
                      <div className="pt-3 pb-2">
                        <p className="text-sm font-semibold mb-3">
                          Choose your route
                        </p>
                        
                        {/* MOBILE: Route pills - grid for ≤3, horizontal scroll for 4+ */}
                        <div className="md:hidden">
                          <div 
                            className={routes.length <= 3 
                              ? "grid gap-2" 
                              : "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
                            }
                            style={routes.length <= 3 ? { gridTemplateColumns: `repeat(${routes.length}, 1fr)` } : undefined}
                          >
                            {routes.map((route, index) => {
                              const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                              const isActive = route.id === activeRouteId;
                              const routeLabel = index === 0 ? "Fastest" : (route.summary || `Route ${index + 1}`);
                              return (
                                <button
                                  key={route.id}
                                  onClick={() => setActiveRouteId(route.id)}
                                  className={`flex flex-col items-center justify-center h-14 px-2 rounded-xl transition-all text-center overflow-hidden ${
                                    routes.length > 3 ? 'flex-shrink-0 min-w-[120px]' : ''
                                  } ${
                                    isActive 
                                      ? "border-2 border-primary bg-blue-50 dark:bg-blue-900/30" 
                                      : "border border-border bg-background hover:border-primary/40"
                                  }`}
                                  data-testid={`route-chip-${route.id}`}
                                >
                                  <span className={`text-[11px] font-bold leading-tight truncate w-full px-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                                    {routeLabel}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground leading-tight truncate w-full px-1">
                                    {formatDurationMinutes(etaMin)} · {route.distanceMiles.toFixed(1)} mi
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* DESKTOP: Flex-wrap route buttons */}
                        <div className="hidden md:flex flex-wrap gap-2">
                          {routes.map((route, index) => {
                            const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                            const isActive = route.id === activeRouteId;
                            const routeLabel = index === 0 ? "Fastest" : (route.summary || `Route ${index + 1}`);
                            return (
                              <button
                                key={route.id}
                                onClick={() => setActiveRouteId(route.id)}
                                className={`relative flex flex-col p-3 rounded-xl transition-all flex-1 min-w-[31%] max-w-[33%] ${
                                  isActive 
                                    ? "border-2 border-primary bg-primary/5 shadow-md" 
                                    : "border border-border bg-background hover:border-primary/40 hover:shadow-sm"
                                }`}
                                data-testid={`route-button-${route.id}`}
                              >
                                {/* Selected badge - Top right inside chip */}
                                {isActive && (
                                  <div className="absolute top-1.5 right-1.5 text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                    Selected
                                  </div>
                                )}
                                {/* Route Label */}
                                <span className={`text-xs md:text-sm font-semibold text-left pr-10 truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                                  {routeLabel}
                                </span>
                                {/* Duration and Distance on single line */}
                                <span className="text-[10px] md:text-xs text-muted-foreground mt-1 text-left truncate">
                                  {formatDurationMinutes(etaMin)} • {route.distanceMiles.toFixed(1)} mi
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Selected Route Summary Line - Desktop only */}
                        {activeRoute && (
                          <div className="hidden md:flex mt-3 text-xs text-muted-foreground items-center gap-1">
                            <span className="font-medium">
                              {routes.findIndex(r => r.id === activeRouteId) === 0 
                                ? "Fastest" 
                                : (activeRoute.summary || "Selected route")}
                            </span>
                            <span>•</span>
                            <span>{formatDurationMinutes(Math.ceil(activeRoute.durationInTrafficSeconds / 60))}</span>
                            <span>•</span>
                            <span>{activeRoute.distanceMiles.toFixed(1)} mi</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* MOBILE: View on Map Button */}
                    <div className="md:hidden">
                      <button
                        onClick={() => setIsMobileMapOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                        data-testid="button-view-map-mobile"
                      >
                        <Map className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">View on map</span>
                      </button>
                    </div>

                    {/* Ride Selection Content - Only show when SELECTING */}
                    {rideStatus === "SELECTING" ? (
                      <>
                        {/* Choose Your Ride Title */}
                        <div className="flex items-center justify-between">
                          <p className="text-sm md:text-base font-semibold">Choose a ride</p>
                          <p className="text-xs text-muted-foreground">
                            {VEHICLE_CATEGORY_ORDER.filter(id => !checkUnavailable(id)).length} available
                          </p>
                        </div>

                    {/* MOBILE: Ride Cards List */}
                    <div 
                      className="md:hidden"
                      data-testid="ride-cards-mobile"
                    >
                      <div className="space-y-2">
                      {VEHICLE_CATEGORY_ORDER.map((categoryId: VehicleCategoryId) => {
                        const catConfig = VEHICLE_CATEGORIES[categoryId];
                        const isSelected = categoryId === selectedVehicleCategory;
                        const fareData = calculateFareForCategory(activeRoute, categoryId);
                        const vehicleImage = getVehicleCategoryImage(categoryId);
                        const isUnavailable = checkUnavailable(categoryId);
                        const isLimited = checkLimited(categoryId);
                        const categoryETA = getETA(categoryId);
                        const etaMinutes = categoryETA?.etaMinutes ?? (catConfig.etaMinutesOffset + 5);
                        const hasDiscount = fareData.discountAmount > 0;
                        const isPremium = categoryId.includes("BLACK");
                        
                        return (
                          <div
                            key={categoryId}
                            role="button"
                            tabIndex={isUnavailable ? -1 : 0}
                            onClick={() => !isUnavailable && setSelectedVehicleCategory(categoryId)}
                            onKeyDown={(e) => e.key === "Enter" && !isUnavailable && setSelectedVehicleCategory(categoryId)}
                            className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                              isSelected 
                                ? "ring-2 ring-primary bg-primary/5" 
                                : isUnavailable
                                  ? "bg-muted/40 opacity-60 cursor-not-allowed"
                                  : "bg-background border border-border hover:border-primary/30"
                            }`}
                            data-testid={`ride-card-mobile-${categoryId}`}
                          >
                            {/* Tag Badges - Top Right */}
                            <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
                              {catConfig.isPopular && !isUnavailable && (
                                <Badge className="text-[9px] px-1 py-0 bg-blue-500 text-white border-0">
                                  Popular
                                </Badge>
                              )}
                              {isLimited && !isUnavailable && (
                                <Badge className="text-[9px] px-1 py-0 bg-amber-500 text-white border-0">
                                  Limited
                                </Badge>
                              )}
                            </div>

                            {/* Left: Car Image */}
                            <div 
                              className="h-14 w-20 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                              style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%)" }}
                            >
                              <img 
                                src={vehicleImage} 
                                alt={catConfig.displayName}
                                className="h-12 w-auto object-contain"
                                style={{ 
                                  filter: isUnavailable 
                                    ? "grayscale(1) opacity(0.5)" 
                                    : "drop-shadow(0px 4px 8px rgba(0,0,0,0.1))"
                                }}
                              />
                            </div>

                            {/* Middle: Title + Caption */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{catConfig.displayName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {isUnavailable ? "Unavailable" : `${etaMinutes} min away · ${catConfig.seatCount} seats`}
                              </p>
                            </div>

                            {/* Right: Price Section */}
                            <div className="text-right flex-shrink-0">
                              {isUnavailable ? (
                                <p className="text-xs text-muted-foreground">N/A</p>
                              ) : (
                                <>
                                  {hasDiscount && (
                                    <p className="text-xs line-through text-muted-foreground">
                                      ${fareData.originalFare.toFixed(2)}
                                    </p>
                                  )}
                                  <p className="text-base font-bold">${fareData.finalFare.toFixed(2)}</p>
                                  {hasDiscount && (
                                    <Badge 
                                      className="text-[9px] px-1 py-0 border-0 mt-0.5"
                                      style={{ background: "#DCFCE7", color: "#166534" }}
                                    >
                                      Saver
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>

                    {/* DESKTOP: Grid Ride Cards */}
                    <div 
                      className="hidden md:grid grid-cols-2 gap-3"
                      data-testid="ride-cards-grid"
                    >
                      {VEHICLE_CATEGORY_ORDER.map((categoryId: VehicleCategoryId) => {
                        const catConfig = VEHICLE_CATEGORIES[categoryId];
                        const isSelected = categoryId === selectedVehicleCategory;
                        const fareData = calculateFareForCategory(activeRoute, categoryId);
                        const vehicleImage = getVehicleCategoryImage(categoryId);
                        const isUnavailable = checkUnavailable(categoryId);
                        const isLimited = checkLimited(categoryId);
                        const categoryETA = getETA(categoryId);
                        const etaMinutes = categoryETA?.etaMinutes ?? (catConfig.etaMinutesOffset + 5);
                        const hasDiscount = fareData.discountAmount > 0;
                        
                        const isPremium = categoryId.includes("BLACK");
                        
                        return (
                          <div
                            key={categoryId}
                            role="button"
                            tabIndex={isUnavailable ? -1 : 0}
                            onClick={() => !isUnavailable && setSelectedVehicleCategory(categoryId)}
                            onKeyDown={(e) => e.key === "Enter" && !isUnavailable && setSelectedVehicleCategory(categoryId)}
                            className={`relative flex flex-col rounded-2xl cursor-pointer transition-all overflow-hidden ${
                              isSelected 
                                ? "ring-2 ring-primary bg-primary/5 shadow-md" 
                                : isUnavailable
                                  ? "bg-muted/40 opacity-60 cursor-not-allowed"
                                  : "bg-background border border-border hover:shadow-md hover:border-primary/30"
                            }`}
                            data-testid={`ride-card-${categoryId}`}
                          >
                            {/* Tag Badges - Top Right */}
                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                              {catConfig.isPopular && !isUnavailable && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white border-0 shadow-sm">
                                  Popular
                                </Badge>
                              )}
                              {hasDiscount && !isUnavailable && (
                                <Badge 
                                  className="text-[10px] px-1.5 py-0.5 border-0 shadow-sm flex items-center"
                                  style={{ background: "#DCFCE7", color: "#166534" }}
                                >
                                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                  Saver
                                </Badge>
                              )}
                              {isLimited && !isUnavailable && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-white border-0 shadow-sm">
                                  Limited
                                </Badge>
                              )}
                              {isPremium && !isUnavailable && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-white border-0 shadow-sm">
                                  Premium
                                </Badge>
                              )}
                            </div>

                            {/* 3D Car Image Section */}
                            <div 
                              className="h-24 w-full flex items-center justify-center p-2 relative"
                              style={{ 
                                background: isUnavailable 
                                  ? "linear-gradient(180deg, #F5F5F5 0%, #E8E8E8 100%)" 
                                  : "linear-gradient(180deg, #FFFFFF 0%, #F8F8F8 60%, #EFEFEF 100%)" 
                              }}
                            >
                              <img 
                                src={vehicleImage} 
                                alt={catConfig.displayName}
                                className="h-full w-auto max-w-full object-contain"
                                style={{ 
                                  filter: isUnavailable 
                                    ? "grayscale(1) opacity(0.5)" 
                                    : "drop-shadow(0px 8px 16px rgba(0,0,0,0.15)) drop-shadow(0px 2px 4px rgba(0,0,0,0.1))",
                                  transform: "perspective(800px) rotateY(-5deg) scale(1.1)"
                                }}
                              />
                            </div>

                            {/* Card Content */}
                            <div className="p-3 flex-1 flex flex-col">
                              {/* Car Name & ETA */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{catConfig.displayName}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {isUnavailable ? "Unavailable" : `${etaMinutes} min away`}
                                  </p>
                                </div>
                                {/* Passenger Count */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                  <Users className="h-3 w-3" />
                                  <span>{catConfig.seatCount}</span>
                                </div>
                              </div>

                              {/* Price Section */}
                              <div className="mt-auto pt-2 border-t border-border/50">
                                {isUnavailable ? (
                                  <p className="text-sm text-muted-foreground">No drivers nearby</p>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-baseline gap-2">
                                      <p className="text-lg font-bold">${fareData.finalFare.toFixed(2)}</p>
                                      {hasDiscount && (
                                        <p className="text-sm line-through" style={{ color: "#6B7280" }}>
                                          ${fareData.originalFare.toFixed(2)}
                                        </p>
                                      )}
                                    </div>
                                    {hasDiscount && (
                                      <p className="text-xs font-medium" style={{ color: "#16A34A" }}>
                                        You save ${fareData.discountAmount.toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Selection Indicator */}
                            {isSelected && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
                  </>
                ) : (
                  /* Address Input View - When NOT in choose-ride mode */
                  <>
                    <Card 
                      className="bg-white dark:bg-card shadow-md border border-border overflow-hidden"
                      style={{ borderRadius: "16px" }}
                      data-testid="address-panel"
                    >
                      <CardContent className="p-0">
                        <div 
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setIsAddressPanelExpanded(!isAddressPanelExpanded)}
                          data-testid="address-panel-header"
                        >
                          <p className="text-sm font-semibold">Book a ride</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setIsAddressPanelExpanded(!isAddressPanelExpanded); }}
                            className="h-8 w-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
                            data-testid="button-toggle-panel"
                          >
                            {isAddressPanelExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>

                        {!isAddressPanelExpanded && (
                          <div className="px-4 pb-3 border-t">
                            <div className="flex items-center gap-3 pt-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                                  <span className="text-sm font-medium truncate">
                                    {pickup ? pickup.address.split(",")[0] : "Set pickup"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-red-500" />
                                  <span className="text-sm font-medium truncate">
                                    {dropoff ? dropoff.address.split(",")[0] : "Set dropoff"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {isAddressPanelExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t">
                            <div 
                              className={`flex items-center gap-3 p-3 rounded-xl transition-all mt-3 ${
                                focusedField === "pickup" 
                                  ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-500" 
                                  : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                              }`}
                              data-testid="pickup-row"
                            >
                              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-blue-100">
                                <div className="h-3 w-3 rounded-full bg-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[0.7rem] font-medium text-muted-foreground uppercase mb-0.5">Pickup</p>
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
                                  inputClassName="border-0 bg-transparent p-0 h-auto text-sm font-medium placeholder:text-muted-foreground/60 focus-visible:ring-0"
                                />
                              </div>
                              <button
                                onClick={handleSwapAddresses}
                                disabled={!pickup || !dropoff}
                                className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                                  pickup && dropoff
                                    ? "bg-muted hover:bg-muted/80 cursor-pointer" 
                                    : "bg-muted/50 opacity-50 cursor-not-allowed"
                                }`}
                                data-testid="button-swap"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
                              </button>
                            </div>

                            <div 
                              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                focusedField === "dropoff" 
                                  ? "bg-red-50 dark:bg-red-900/20 border border-red-500" 
                                  : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                              }`}
                              data-testid="dropoff-row"
                            >
                              <div className="h-8 w-8 rounded-full flex items-center justify-center bg-red-100">
                                <div className="h-3 w-3 rounded-full bg-red-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[0.7rem] font-medium text-muted-foreground uppercase mb-0.5">Dropoff</p>
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
                                  inputClassName="border-0 bg-transparent p-0 h-auto text-sm font-medium placeholder:text-muted-foreground/60 focus-visible:ring-0"
                                />
                              </div>
                              <div className="h-8 w-8" />
                            </div>

                            {locationError && (
                              <div className="px-3 py-2 bg-red-50 rounded-lg text-xs text-red-600">
                                {locationError}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {pickup && dropoff && !activeRoute && (
                      <div className="flex items-center justify-center py-4">
                        <Button
                          onClick={() => {}}
                          disabled={!pickup || !dropoff}
                          className="h-12 px-8 rounded-xl text-base font-semibold"
                          data-testid="button-show-prices"
                        >
                          <Car className="h-5 w-5 mr-2" />
                          Show prices
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* MOBILE: Compact Selected Ride Summary + Expandable Fare Details */}
                {showChooseRide && fareEstimate && (
                  rideStatus === "SELECTING" ? (
                    <div className="md:hidden space-y-3" data-testid="mobile-ride-summary">
                    {/* Summary Row */}
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center gap-3">
                        {/* Car Image */}
                        <div 
                          className="h-12 w-16 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%)" }}
                        >
                          <img 
                            src={getVehicleCategoryImage(selectedVehicleCategory)} 
                            alt={VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                            className="h-10 w-auto object-contain"
                            style={{ filter: "drop-shadow(0px 3px 6px rgba(0,0,0,0.1))" }}
                          />
                        </div>
                        
                        {/* Ride Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}</p>
                            <p className="text-base font-bold">${fareEstimate.finalFare.toFixed(2)}</p>
                          </div>
                          {fareEstimate.discountAmount > 0 && (
                            <p className="text-xs" style={{ color: "#16A34A" }}>You save ${fareEstimate.discountAmount.toFixed(2)}</p>
                          )}
                        </div>
                        
                        {/* Badges */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <Badge variant="secondary" className={`text-[10px] ${
                            fareEstimate.trafficLevel === "heavy" 
                              ? "bg-red-100 text-red-700" 
                              : fareEstimate.trafficLevel === "moderate"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }`}>
                            <Car className="h-2.5 w-2.5 mr-0.5" />
                            {fareEstimate.trafficLevel === "heavy" ? "Heavy" : fareEstimate.trafficLevel === "moderate" ? "Moderate" : "Light"}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            <Wallet className="h-2.5 w-2.5 mr-0.5" />
                            Card
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Mobile Fare Details - Expandable */}
                    <div className="rounded-xl border border-border bg-background overflow-hidden">
                      <button
                        onClick={() => setIsMobileFareExpanded(!isMobileFareExpanded)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                        data-testid="button-toggle-fare-mobile"
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">Fare details</span>
                        </div>
                        {isMobileFareExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      
                      {isMobileFareExpanded && (
                        <div className="px-3 pb-3 border-t">
                          <div className="pt-3 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Base fare</span>
                              <span className="font-medium">${fareEstimate.baseFare.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Time ({fareEstimate.etaWithTrafficMinutes} min)</span>
                              <span className="font-medium">${fareEstimate.timeFare.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Distance ({fareEstimate.distanceMiles} mi)</span>
                              <span className="font-medium">${fareEstimate.distanceFare.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Booking fee</span>
                              <span className="font-medium">${fareEstimate.bookingFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Taxes & surcharges</span>
                              <span className="font-medium">${fareEstimate.taxesAndSurcharges.toFixed(2)}</span>
                            </div>
                            {fareEstimate.discountAmount > 0 && (
                              <>
                                <div className="border-t pt-2 mt-2">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-medium">${fareEstimate.originalFare.toFixed(2)}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between" style={{ color: "#16A34A" }}>
                                  <span className="flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    {fareEstimate.promoCode || "Promo"}
                                  </span>
                                  <span className="font-medium">-${fareEstimate.discountAmount.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between text-base">
                                <span className="font-bold">Total</span>
                                <span className="font-bold">${fareEstimate.finalFare.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                  ) : (
                    /* Non-SELECTING Status Panels */
                    <>
                        {/* SEARCHING_DRIVER Status Panel */}
                        {rideStatus === "SEARCHING_DRIVER" && fareEstimate && (
                          <Card className="shadow-md rounded-xl overflow-hidden" data-testid="status-searching">
                            <CardContent className="p-4">
                              <div className="text-center">
                                <h3 className="text-lg font-semibold mb-4">Finding your driver…</h3>
                                
                                {/* Selected ride info */}
                                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl mb-4">
                                  <div 
                                    className="h-16 w-20 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%)" }}
                                  >
                                    <img 
                                      src={getVehicleCategoryImage(selectedVehicleCategory)} 
                                      alt={VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                                      className="h-14 w-auto object-contain"
                                      style={{ filter: "drop-shadow(0px 4px 8px rgba(0,0,0,0.1))" }}
                                    />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <p className="font-semibold">{VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}</p>
                                    <p className="text-xl font-bold">${fareEstimate.finalFare.toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {routes.findIndex(r => r.id === activeRouteId) === 0 ? "Fastest" : (activeRoute?.summary || "Route")} · {formatDurationMinutes(fareEstimate.etaWithTrafficMinutes)} · {fareEstimate.distanceMiles} mi
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Loading indicator */}
                                <div className="flex items-center justify-center gap-2 mb-4">
                                  <div className="flex gap-1">
                                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                                  </div>
                                </div>
                                
                                <p className="text-sm text-muted-foreground mb-4">
                                  We are looking for the best nearby driver for you.
                                </p>
                                
                                <button
                                  onClick={handleCancelRide}
                                  className="text-sm text-destructive hover:underline"
                                  data-testid="button-cancel-searching"
                                >
                                  Cancel ride
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* DRIVER_ASSIGNED Status Panel */}
                        {rideStatus === "DRIVER_ASSIGNED" && statusDriverInfo && fareEstimate && (
                          <div className="space-y-3">
                            <RideStatusPanel
                              status="DRIVER_ASSIGNED"
                              driver={statusDriverInfo}
                              pickupEtaMinutes={remainingMinutes || driverInfo?.pickupEtaMinutes || 5}
                              distanceMiles={remainingMiles || parseFloat(fareEstimate.distanceMiles) * 0.3}
                              vehicleCategory={selectedVehicleCategory}
                              speedMph={driverSpeedMph}
                              nextTurn={nextTurnInstruction}
                              onViewLiveMap={() => {
                                if (window.innerWidth < 768) {
                                  handleOpenMobileLiveTracking();
                                } else {
                                  handleViewLiveMapDesktop();
                                }
                              }}
                              onCancelRide={handleCancelRideWithConfirm}
                              isCancelling={isCancellingRide}
                            />
                            
                            {/* Debug control */}
                            {showDebugControls && (
                              <Card className="shadow-md rounded-xl overflow-hidden">
                                <CardContent className="p-3">
                                  <p className="text-xs text-muted-foreground mb-2">Debug Controls:</p>
                                  <Button size="sm" onClick={handleStartTrip} data-testid="debug-start-trip">
                                    Start Trip
                                  </Button>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        )}

                        {/* TRIP_IN_PROGRESS Status Panel */}
                        {rideStatus === "TRIP_IN_PROGRESS" && statusDriverInfo && fareEstimate && (
                          <div className="space-y-3">
                            <RideStatusPanel
                              status="TRIP_IN_PROGRESS"
                              driver={statusDriverInfo}
                              dropoffEtaMinutes={remainingMinutes}
                              distanceMiles={remainingMiles}
                              vehicleCategory={selectedVehicleCategory}
                              speedMph={driverSpeedMph}
                              nextTurn={nextTurnInstruction}
                              onViewLiveMap={() => {
                                if (window.innerWidth < 768) {
                                  handleOpenMobileLiveTracking();
                                } else {
                                  handleViewLiveMapDesktop();
                                }
                              }}
                            />
                            
                            {/* Debug control */}
                            {showDebugControls && (
                              <Card className="shadow-md rounded-xl overflow-hidden">
                                <CardContent className="p-3">
                                  <p className="text-xs text-muted-foreground mb-2">Debug Controls:</p>
                                  <Button size="sm" onClick={handleCompleteTrip} data-testid="debug-complete-trip">
                                    Complete Trip
                                  </Button>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        )}

                        {/* TRIP_COMPLETED Status Panel */}
                        {rideStatus === "TRIP_COMPLETED" && fareEstimate && (
                          <div className="space-y-4" data-testid="status-completed">
                            {/* Confirmation header */}
                            <div className="text-center py-4">
                              <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                              </div>
                              <h2 className="text-xl font-bold">Trip completed</h2>
                              <p className="text-muted-foreground">Hope you had a safe ride.</p>
                            </div>
                            
                            {/* Trip summary card */}
                            <Card className="shadow-md rounded-xl overflow-hidden">
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-3">Trip Summary</h3>
                                
                                {/* Addresses */}
                                <div className="space-y-2 mb-4">
                                  <div className="flex items-start gap-2">
                                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                                    <p className="text-sm flex-1">{pickup?.address}</p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5" />
                                    <p className="text-sm flex-1">{dropoff?.address}</p>
                                  </div>
                                </div>
                                
                                {/* Date/time and route */}
                                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                                  <p>{tripEndTime?.toLocaleDateString()} at {tripEndTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  <p>{routes.findIndex(r => r.id === activeRouteId) === 0 ? "Fastest" : (activeRoute?.summary || "Route")} · {formatDurationMinutes(fareEstimate.etaWithTrafficMinutes)} · {fareEstimate.distanceMiles} mi</p>
                                </div>
                                
                                {/* Final price */}
                                <div className="flex items-baseline justify-between border-t pt-3">
                                  <span className="font-semibold">Final Price</span>
                                  <span className="text-2xl font-bold">${fareEstimate.finalFare.toFixed(2)}</span>
                                </div>
                                
                                {fareEstimate.discountAmount > 0 && (
                                  <p className="text-sm text-green-600 mt-1">
                                    Promo {fareEstimate.promoCode} applied · You saved ${fareEstimate.discountAmount.toFixed(2)}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                            
                            {/* Rating section */}
                            <Card className="shadow-md rounded-xl overflow-hidden">
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-3">Rate your driver</h3>
                                
                                {/* Driver info */}
                                {driverInfo && (
                                  <div className="flex items-center gap-3 mb-4">
                                    <Avatar className="h-12 w-12">
                                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                                        {driverInfo.avatarInitials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-semibold">{driverInfo.name}</p>
                                      <p className="text-xs text-muted-foreground">{driverInfo.carModel}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Star rating */}
                                <div className="flex justify-center gap-2 mb-4">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      onClick={() => setUserRating(star)}
                                      className="p-1"
                                      data-testid={`star-${star}`}
                                    >
                                      <Star 
                                        className={`h-8 w-8 transition-colors ${
                                          star <= userRating 
                                            ? "fill-yellow-400 text-yellow-400" 
                                            : "text-muted-foreground"
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                                
                                {/* Tip buttons */}
                                <p className="text-sm font-medium mb-2">Add a tip</p>
                                <div className="flex gap-2 flex-wrap">
                                  {[null, 2, 4, 6].map((tip) => (
                                    <Button
                                      key={tip ?? "none"}
                                      variant={selectedTip === tip ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setSelectedTip(tip)}
                                      className="flex-1 min-w-[70px]"
                                      data-testid={`tip-${tip ?? "none"}`}
                                    >
                                      {tip === null ? "No tip" : `$${tip}`}
                                    </Button>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Tips go directly to your driver.
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* TRIP_CANCELLED Status Panel */}
                        {rideStatus === "TRIP_CANCELLED" && (
                          <Card className="shadow-md rounded-xl overflow-hidden" data-testid="status-cancelled">
                            <CardContent className="p-4 text-center">
                              <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle className="h-8 w-8 text-red-600" />
                              </div>
                              <h2 className="text-xl font-bold mb-2">Ride Cancelled</h2>
                              <p className="text-muted-foreground mb-6">Your ride has been cancelled.</p>
                              
                              <Button 
                                onClick={handleBackFromCancelled}
                                className="w-full"
                                data-testid="button-back-home"
                              >
                                Back to home
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                    </>
                  )
                )}

                {/* DESKTOP: Fare Summary Card - Shows when vehicle is selected AND in SELECTING state */}
                {showChooseRide && fareEstimate && rideStatus === "SELECTING" && (
                  <Card className="hidden md:block shadow-md rounded-xl overflow-hidden" data-testid="fare-summary-card">
                    <CardContent className="p-4">
                      {/* Main fare display - responsive layout */}
                      <div className="flex items-start justify-between gap-3">
                        {/* Left side: Vehicle image + fare info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div 
                            className="h-20 w-28 rounded-xl flex items-center justify-center overflow-hidden p-2 flex-shrink-0"
                            style={{ background: "linear-gradient(180deg, #FFFFFF 40%, #F2F2F2 100%)" }}
                          >
                            <img 
                              src={getVehicleCategoryImage(selectedVehicleCategory)} 
                              alt={VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                              className="w-full h-full object-contain"
                              style={{ filter: "drop-shadow(0px 4px 14px rgba(0,0,0,0.15))" }}
                              data-testid="img-selected-vehicle"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                            </p>
                            {/* Price row - aligned baseline */}
                            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                              <p className="text-2xl font-bold" data-testid="text-fare">
                                ${fareEstimate.finalFare.toFixed(2)}
                              </p>
                              {fareEstimate.discountAmount > 0 && (
                                <p className="text-sm line-through text-muted-foreground">
                                  ${fareEstimate.originalFare.toFixed(2)}
                                </p>
                              )}
                            </div>
                            {/* Savings badge - directly below prices */}
                            {fareEstimate.discountAmount > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full w-fit" style={{ background: "#DCFCE7" }}>
                                <Zap className="h-3 w-3" style={{ color: "#16A34A" }} />
                                <span className="text-xs font-semibold" style={{ color: "#166534" }}>You save ${fareEstimate.discountAmount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Right side: Distance/time metadata - vertically centered */}
                        <div className="text-right text-sm flex-shrink-0 flex flex-col justify-center">
                          <p className="text-muted-foreground text-xs md:text-sm" data-testid="text-distance">{fareEstimate.distanceMiles} mi</p>
                          <p className="font-semibold text-xs md:text-sm" data-testid="text-eta">
                            ~{formatDurationMinutes(fareEstimate.etaWithTrafficMinutes)}
                          </p>
                          <p className="text-[10px] md:text-xs mt-0.5 text-muted-foreground">
                            Pickup ~{getETA(selectedVehicleCategory)?.etaMinutes ?? 5} min
                          </p>
                        </div>
                      </div>
                      
                      {/* Status badges */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`text-xs ${
                          fareEstimate.trafficLevel === "heavy" 
                            ? "bg-red-100 text-red-700" 
                            : fareEstimate.trafficLevel === "moderate"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                        }`} data-testid="badge-traffic">
                          <Car className="h-3 w-3 mr-1" />
                          {fareEstimate.trafficLabel}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Wallet className="h-3 w-3 mr-1" />
                          Card/Wallet
                        </Badge>
                      </div>
                      
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
                            distanceMiles: parseFloat(fareEstimate.distanceMiles),
                            durationMinutes: fareEstimate.etaWithTrafficMinutes,
                            perMileRate: fareEstimate.perMileRate,
                            perMinuteRate: fareEstimate.perMinuteRate,
                            promoCode: fareEstimate.promoCode,
                          }}
                        />
                      </div>

                      {/* Confirm Ride Button - Desktop only (mobile uses fixed bottom) */}
                      <div className="hidden lg:block mt-4 pt-3 border-t">
                        <Button
                          onClick={handleRequestRide}
                          disabled={!canRequestRide}
                          className="w-full h-12 text-base font-semibold rounded-xl"
                          data-testid="button-confirm-ride-desktop"
                        >
                          {isRequestingRide ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Confirming...
                            </>
                          ) : (
                            <>
                              Confirm {VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                              <span className="ml-2 opacity-90">• ${fareEstimate.finalFare.toFixed(2)}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {activeService === "eats" && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
                <div className="text-center">
                  <UtensilsCrossed className="h-16 w-16 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">SafeGo Eats</p>
                  <p className="text-sm mt-2">Order from nearby restaurants</p>
                  <p className="text-xs mt-4 text-muted-foreground/60">Coming soon...</p>
                </div>
              </div>
            )}

            {activeService === "parcel" && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
                <div className="text-center">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">SafeGo Parcel</p>
                  <p className="text-sm mt-2">Send packages and documents</p>
                  <p className="text-xs mt-4 text-muted-foreground/60">Coming soon...</p>
                </div>
              </div>
            )}
          </div>
          
        </div>

        {/* Map Section - Hidden on mobile, shown on desktop */}
        <div ref={desktopMapRef} className="hidden md:block flex-1 min-h-0 relative overflow-hidden">
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
              <MapBoundsHandler pickupLocation={pickup} dropoffLocation={dropoff} routePoints={activeRoutePoints} />
              
              {/* Driver follow behavior when tracking */}
              {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverPosition && (
                <MapFollowDriver 
                  driverPosition={driverPosition}
                  isFollowing={isFollowingDriver}
                  onUserInteraction={() => setIsFollowingDriver(false)}
                />
              )}
              
              {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
              {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
              
              {/* Driver marker - shows when driver is assigned or trip in progress */}
              {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverPosition && (
                <Marker 
                  position={[driverPosition.lat, driverPosition.lng]} 
                  icon={rotatedDriverIcon}
                  zIndexOffset={1000}
                />
              )}
              
              {/* Customer location marker - blue GPS dot (Uber-style) */}
              {customerLocation && customerLocationIcon && (
                <Marker 
                  position={[customerLocation.lat, customerLocation.lng]} 
                  icon={customerLocationIcon}
                  zIndexOffset={500}
                />
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
              
              {/* Remaining route polyline - shows driver's path to destination */}
              {remainingRoutePoints && remainingRoutePoints.length > 1 && (
                <Polyline
                  positions={remainingRoutePoints}
                  pathOptions={{
                    color: "#10B981",
                    weight: 6,
                    opacity: 0.9,
                  }}
                />
              )}
            </MapContainer>
          )}
          
          {/* Re-center button - shows when user has panned away from driver */}
          {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverPosition && !isFollowingDriver && (
            <button
              onClick={handleRecenterOnDriver}
              className="absolute top-4 right-4 z-20 bg-background px-3 py-2 rounded-lg shadow-lg border hover-elevate flex items-center gap-2"
              data-testid="button-recenter-driver"
            >
              <Navigation className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Re-center</span>
            </button>
          )}

          {!pickup && (
            <button
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="absolute bottom-4 right-4 z-20 bg-background p-3 rounded-full shadow-lg border hover-elevate"
              data-testid="button-current-location"
            >
              {isLocating ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <Crosshair className="h-5 w-5 text-blue-600" />
              )}
            </button>
          )}

          {showChooseRide && activeRoute && (
            <div className="hidden lg:flex absolute bottom-4 left-4 right-4 justify-center z-20">
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
                  <>
                    Request {VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                    <span className="ml-2 opacity-90">• ${fareEstimate?.finalFare.toFixed(2) || "..."}</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar - Different actions based on ride status */}
      {activeService === "ride" && showChooseRide && activeRoute && (
        <div 
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background"
          style={{ 
            boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
            paddingBottom: 'env(safe-area-inset-bottom, 12px)'
          }}
        >
          <div className="px-4 py-3">
            {/* SELECTING: Show confirm button */}
            {rideStatus === "SELECTING" && (
              <Button
                onClick={handleRequestRide}
                disabled={!canRequestRide}
                size="lg"
                className="w-full text-base font-semibold"
                data-testid="button-confirm-ride-mobile"
              >
                {isRequestingRide ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    Confirm {VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                    <span className="ml-2 font-bold">· ${fareEstimate?.finalFare.toFixed(2) || "..."}</span>
                  </>
                )}
              </Button>
            )}
            
            {/* TRIP_COMPLETED: Show done button */}
            {rideStatus === "TRIP_COMPLETED" && (
              <Button
                onClick={handleFinishTripFlow}
                size="lg"
                className="w-full text-base font-semibold"
                data-testid="button-done-mobile"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Map Overlay/Bottom Sheet */}
      {isMobileMapOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          {/* Header with close button - changes based on ride status */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && (
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
              <h2 className="text-lg font-semibold">
                {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") 
                  ? "Live driver location" 
                  : "Route Map"}
              </h2>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMobileMapOpen(false)}
              data-testid="button-close-map"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Map takes most of the screen */}
          <div className="flex-1 relative">
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
                <MapBoundsHandler pickupLocation={pickup} dropoffLocation={dropoff} routePoints={activeRoutePoints} />
                
                {/* Driver follow behavior when tracking */}
                {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverPosition && (
                  <MapFollowDriver 
                    driverPosition={driverPosition}
                    isFollowing={isFollowingDriver}
                    onUserInteraction={() => setIsFollowingDriver(false)}
                  />
                )}
                
                {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
                {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
                
                {/* Driver marker - shows when driver is assigned or trip in progress */}
                {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverPosition && (
                  <Marker 
                    position={[driverPosition.lat, driverPosition.lng]} 
                    icon={rotatedDriverIcon}
                    zIndexOffset={1000}
                  />
                )}
                
                {/* Customer location marker - blue GPS dot (Uber-style) */}
                {customerLocation && customerLocationIcon && (
                  <Marker 
                    position={[customerLocation.lat, customerLocation.lng]} 
                    icon={customerLocationIcon}
                    zIndexOffset={500}
                  />
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
                
                {/* Remaining route polyline - shows driver's path to destination */}
                {remainingRoutePoints && remainingRoutePoints.length > 1 && (
                  <Polyline
                    positions={remainingRoutePoints}
                    pathOptions={{
                      color: "#10B981",
                      weight: 6,
                      opacity: 0.9,
                    }}
                  />
                )}
              </MapContainer>
            )}
            
            {/* Driver position loading indicator */}
            {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && isDriverPositionLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Updating driver location...</span>
                </div>
              </div>
            )}
            
            {/* Re-center button - shows when user has panned away from driver */}
            {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverPosition && !isFollowingDriver && (
              <button
                onClick={handleRecenterOnDriver}
                className="absolute top-4 right-4 z-20 bg-background px-3 py-2 rounded-lg shadow-lg border hover-elevate flex items-center gap-2"
                data-testid="button-recenter-driver-mobile"
              >
                <Navigation className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Re-center</span>
              </button>
            )}
          </div>
          
          {/* Bottom section - different content based on ride status */}
          <div className="p-4 border-t bg-background">
            {/* Show driver info when tracking */}
            {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && driverInfo && (
              <div className="flex items-center gap-3 mb-3 p-3 bg-muted/30 rounded-xl">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                    {driverInfo.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{driverInfo.name}</p>
                  <p className="text-xs text-muted-foreground">{driverInfo.carModel} · {driverInfo.plateNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">
                    {rideStatus === "DRIVER_ASSIGNED" 
                      ? `~${driverInfo.pickupEtaMinutes} min` 
                      : `~${formatDurationMinutes(remainingMinutes)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rideStatus === "DRIVER_ASSIGNED" ? "to pickup" : "remaining"}
                  </p>
                </div>
              </div>
            )}
            
            {/* Route selection - only when not tracking driver */}
            {rideStatus === "SELECTING" && routes.length > 1 && (
              <div className="mb-3">
                <p className="text-sm font-semibold mb-2">Choose your route</p>
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {routes.map((route, index) => {
                    const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                    const isActive = route.id === activeRouteId;
                    const routeLabel = index === 0 ? "Fastest" : (route.summary || `Route ${index + 1}`);
                    return (
                      <button
                        key={route.id}
                        onClick={() => setActiveRouteId(route.id)}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                          isActive 
                            ? "border-2 border-primary bg-blue-50 dark:bg-blue-900/30" 
                            : "border border-border bg-background"
                        }`}
                        data-testid={`map-route-chip-${route.id}`}
                      >
                        <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
                          {routeLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDurationMinutes(etaMin)} · {route.distanceMiles.toFixed(1)} mi
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Button 
              onClick={() => setIsMobileMapOpen(false)}
              className="w-full h-12 rounded-xl"
              data-testid="button-done-map"
            >
              {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") ? "Back to ride details" : "Done"}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Live Tracking Overlay - Full screen map with bottom sheet */}
      {isMobileLiveTrackingOpen && statusDriverInfo && (rideStatus === "DRIVER_ASSIGNED" || rideStatus === "TRIP_IN_PROGRESS") && (
        <MobileLiveTracking
          status={rideStatus}
          driver={statusDriverInfo}
          pickupEtaMinutes={remainingMinutes || driverInfo?.pickupEtaMinutes || 5}
          dropoffEtaMinutes={remainingMinutes}
          distanceMiles={rideStatus === "DRIVER_ASSIGNED" 
            ? (remainingMiles || parseFloat(fareEstimate?.distanceMiles || "0") * 0.3)
            : remainingMiles}
          vehicleCategory={selectedVehicleCategory}
          driverPosition={driverPosition}
          interpolatedPosition={interpolatedPosition}
          driverHeading={driverHeading}
          speedMph={driverSpeedMph}
          nextTurn={nextTurnInstruction}
          pickupLocation={pickup}
          dropoffLocation={dropoff}
          customerLocation={customerLocation}
          routePoints={activeRoutePoints}
          remainingRoutePoints={remainingRoutePoints}
          isFollowingDriver={isFollowingDriver}
          onBack={handleCloseMobileLiveTracking}
          onCancelRide={rideStatus === "DRIVER_ASSIGNED" ? handleCancelRideWithConfirm : undefined}
          onRecenterDriver={handleRecenterOnDriver}
          onUserInteraction={() => setIsFollowingDriver(false)}
          isCancelling={isCancellingRide}
        />
      )}
    </div>
  );
}
