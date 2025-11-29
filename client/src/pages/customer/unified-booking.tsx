import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
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
} from "lucide-react";
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

function MapBoundsHandler({
  pickupLocation,
  dropoffLocation,
}: {
  pickupLocation: LocationData | null;
  dropoffLocation: LocationData | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      const bounds = L.latLngBounds(
        [pickupLocation.lat, pickupLocation.lng],
        [dropoffLocation.lat, dropoffLocation.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickupLocation) {
      map.setView([pickupLocation.lat, pickupLocation.lng], 15);
    } else if (dropoffLocation) {
      map.setView([dropoffLocation.lat, dropoffLocation.lng], 15);
    }
  }, [map, pickupLocation, dropoffLocation]);

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
  const [isClient, setIsClient] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const { getETA, isUnavailable: checkUnavailable, isLimited: checkLimited } = useCategoryAvailability({
    pickupLat: pickup?.lat ?? null,
    pickupLng: pickup?.lng ?? null,
  });

  const mapCenter = useMemo(() => {
    if (pickup) return { lat: pickup.lat, lng: pickup.lng };
    if (dropoff) return { lat: dropoff.lat, lng: dropoff.lng };
    return { lat: 40.7128, lng: -74.006 };
  }, [pickup, dropoff]);

  const routePolylines = useMemo(() => {
    return routes.map((route) => ({
      id: route.id,
      points: decodePolyline(route.polyline),
    }));
  }, [routes]);

  useEffect(() => {
    setIsClient(true);
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
          }
        }
      }
    );
  }, [pickup, dropoff, isGoogleMapsReady]);

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
    return {
      ...breakdown,
      distanceMiles: activeRoute.distanceMiles.toFixed(1),
      etaWithTrafficMinutes: Math.ceil(activeRoute.durationInTrafficSeconds / 60),
      trafficLevel: activeRoute.durationInTrafficSeconds > 1800 ? "heavy" : "light" as "heavy" | "light",
      trafficLabel: activeRoute.durationInTrafficSeconds > 1800 ? "Heavy traffic" : "Light traffic",
      promoCode: appliedPromo?.code,
      promoLabel: appliedPromo?.label,
    };
  }, [activeRoute, selectedVehicleCategory, computeFareBreakdown, appliedPromo]);

  const canRequestRide = pickup && dropoff && activeRoute && selectedVehicleCategory;

  const handleRequestRide = useCallback(async () => {
    if (!canRequestRide) return;
    setIsRequestingRide(true);
    toast({ title: "Finding your driver...", description: "Please wait while we match you with a nearby driver" });
    setTimeout(() => setIsRequestingRide(false), 2000);
  }, [canRequestRide, toast]);

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

  return (
    <div className="h-screen flex flex-col bg-muted/30" data-testid="unified-booking-page">
      {/* Uber-style Sticky Header */}
      <header 
        className="sticky top-0 z-50 w-full bg-background border-b shadow-sm"
        data-testid="safego-header"
      >
        <div className="h-16 px-4 lg:px-6">
          <div className="h-full max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Left: Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link href="/customer" className="flex items-center gap-2" data-testid="link-logo">
                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                  <Car className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl tracking-tight hidden sm:inline">SafeGo</span>
              </Link>
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

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        <div className="lg:w-[40%] lg:max-w-[480px] lg:flex-shrink-0 lg:overflow-y-auto lg:border-r flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-0 lg:pb-4">
            
            {activeService === "ride" && (
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

                {activeRoute && appliedPromo && (
                  <div 
                    className="px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer hover-elevate"
                    style={{ background: "#E7FCE5" }}
                    onClick={() => {
                      setAppliedPromo(null);
                      toast({ title: "Promo removed" });
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
                )}

                {activeRoute && (
                  <>
                    <div className="pt-2">
                      <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Car className="h-4 w-4" />
                        Choose your ride
                      </p>
                      <div className="space-y-2" data-testid="ride-list">
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
                          
                          return (
                            <div
                              key={categoryId}
                              role="button"
                              tabIndex={isUnavailable ? -1 : 0}
                              onClick={() => !isUnavailable && setSelectedVehicleCategory(categoryId)}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                isSelected 
                                  ? "bg-primary/5 border-2 border-primary" 
                                  : isUnavailable
                                    ? "bg-muted/30 border border-border opacity-50 cursor-not-allowed"
                                    : "bg-background border border-border hover:border-primary/30"
                              }`}
                              data-testid={`ride-option-${categoryId}`}
                            >
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
                                  <p className="text-[11px] font-medium mt-0.5 text-green-600">
                                    You save ${fareData.discountAmount.toFixed(2)}
                                  </p>
                                )}
                              </div>
                              
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

                    {routes.length > 1 && (
                      <div className="pt-3">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Choose route:</p>
                        <div className="flex gap-2">
                          {routes.map((route, index) => {
                            const etaMin = Math.ceil(route.durationInTrafficSeconds / 60);
                            const isActive = route.id === activeRouteId;
                            return (
                              <Button
                                key={route.id}
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                className={`flex-1 text-xs h-10 ${isActive ? "" : "opacity-70"}`}
                                onClick={() => setActiveRouteId(route.id)}
                                data-testid={`route-button-${route.id}`}
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

                    {fareEstimate && (
                      <Card className="shadow-md rounded-xl overflow-hidden" data-testid="fare-summary-card">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div 
                                className="h-20 w-28 rounded-xl flex items-center justify-center overflow-hidden p-3"
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
                              <div>
                                <p className="text-sm font-semibold">
                                  {VEHICLE_CATEGORIES[selectedVehicleCategory].displayName}
                                </p>
                                <div className="flex items-baseline gap-2 mt-1">
                                  <p className="text-2xl font-bold" data-testid="text-fare">
                                    ${fareEstimate.finalFare.toFixed(2)}
                                  </p>
                                  {fareEstimate.discountAmount > 0 && (
                                    <p className="text-sm line-through text-muted-foreground">
                                      ${fareEstimate.originalFare.toFixed(2)}
                                    </p>
                                  )}
                                </div>
                                {fareEstimate.discountAmount > 0 && (
                                  <div className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-green-50 w-fit text-green-600">
                                    <Zap className="h-3.5 w-3.5" />
                                    <span className="text-sm font-medium">You save ${fareEstimate.discountAmount.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground" data-testid="text-distance">{fareEstimate.distanceMiles} mi</p>
                              <p className="font-semibold" data-testid="text-eta">
                                ~{formatDurationMinutes(fareEstimate.etaWithTrafficMinutes)}
                              </p>
                              <p className="text-xs mt-0.5 text-muted-foreground">
                                Pickup in ~{getETA(selectedVehicleCategory)?.etaMinutes ?? 5} min
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={`text-xs ${
                              fareEstimate.trafficLevel === "heavy" 
                                ? "bg-red-100 text-red-700" 
                                : "bg-green-100 text-green-700"
                            }`}>
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
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {!activeRoute && (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground py-8">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">Enter pickup and dropoff</p>
                      <p className="text-sm mt-1">Set your locations to see ride options</p>
                    </div>
                  </div>
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
          
          {activeService === "ride" && (
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
          )}
        </div>

        <div className="flex-1 min-h-[250px] lg:min-h-0 relative overflow-hidden">
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
              
              {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
              {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
              
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
              data-testid="button-current-location"
            >
              {isLocating ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <Crosshair className="h-5 w-5 text-blue-600" />
              )}
            </button>
          )}

          <div className="hidden lg:flex absolute bottom-4 left-4 right-4 justify-center">
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
      </div>
    </div>
  );
}
