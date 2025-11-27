import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation, Crosshair, Loader2, Clock, Home, Briefcase, Star, ChevronRight, CreditCard, Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { 
  reverseGeocode, 
  getSavedPlaces, 
  getRecentLocations,
  addRecentLocation,
  calculateRouteInfo,
  type SavedPlace,
  type RecentLocation
} from "@/lib/locationService";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  currency: string;
  etaMinutes: number;
  distanceKm: number;
}

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

function generateRoutePolyline(pickup: LocationData, dropoff: LocationData): [number, number][] {
  const points: [number, number][] = [];
  const steps = 20;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = pickup.lat + (dropoff.lat - pickup.lat) * t;
    const lng = pickup.lng + (dropoff.lng - pickup.lng) * t;
    const offset = Math.sin(t * Math.PI) * 0.002;
    points.push([lat + offset, lng]);
  }
  
  return points;
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
  const [pickupIcon, setPickupIcon] = useState<any>(null);
  const [dropoffIcon, setDropoffIcon] = useState<any>(null);

  const routePolyline = useMemo(() => {
    if (typeof window === "undefined") return [];
    if (pickup && dropoff) {
      return generateRoutePolyline(pickup, dropoff);
    }
    return [];
  }, [pickup, dropoff]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsClient(true);
    setSavedPlaces(getSavedPlaces());
    setRecentLocations(getRecentLocations());
    
    setPickupIcon(createPickupIcon());
    setDropoffIcon(createDropoffIcon());
  }, []);

  useEffect(() => {
    if (isClient) {
      handleGetCurrentLocation();
    }
  }, [isClient]);

  useEffect(() => {
    if (pickup && dropoff) {
      calculateFareEstimate();
    } else {
      setFareEstimate(null);
    }
  }, [pickup, dropoff]);

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

  const calculateFareEstimate = useCallback(async () => {
    if (!pickup || !dropoff) return;
    
    setIsCalculatingFare(true);
    
    const routeInfo = calculateRouteInfo(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const baseFare = 2.50;
    const perKmRate = 1.25;
    const perMinRate = 0.30;
    
    const distanceFare = routeInfo.distanceKm * perKmRate;
    const timeFare = routeInfo.etaMinutes * perMinRate;
    const totalFare = baseFare + distanceFare + timeFare;
    
    setFareEstimate({
      baseFare,
      distanceFare: Math.round(distanceFare * 100) / 100,
      timeFare: Math.round(timeFare * 100) / 100,
      totalFare: Math.round(totalFare * 100) / 100,
      currency: "USD",
      etaMinutes: routeInfo.etaMinutes,
      distanceKm: routeInfo.distanceKm,
    });
    
    setIsCalculatingFare(false);
  }, [pickup, dropoff]);

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
    <div className="h-screen flex flex-col relative" data-testid="plan-your-ride-page">
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

      <div className="flex-1 relative overflow-hidden">
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
            {routePolyline.length > 0 && (
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: "#3B82F6",
                  weight: 4,
                  opacity: 0.8,
                  dashArray: "10, 10",
                }}
              />
            )}
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

        <div className="absolute top-4 left-4 right-4 z-20">
          <Card className="shadow-lg" data-testid="location-card">
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

      <div className="sticky bottom-0 z-30 bg-background border-t p-4 space-y-4 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        {fareEstimate && (
          <Card className="bg-muted/50" data-testid="fare-estimate-card">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated fare</p>
                    <p className="font-semibold text-lg" data-testid="text-fare-estimate">
                      ${fareEstimate.totalFare.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p data-testid="text-distance">{fareEstimate.distanceKm} km</p>
                  <p data-testid="text-eta">{fareEstimate.etaMinutes} min</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Wallet className="h-3 w-3 mr-1" />
                  Card/Wallet only
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {isCalculatingFare && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Calculating fare...</span>
          </div>
        )}

        <Button
          onClick={handleRequestRide}
          disabled={!canRequestRide}
          className="w-full h-12 text-base font-semibold"
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
          <p className="text-center text-xs text-muted-foreground">
            Set pickup and dropoff to continue
          </p>
        )}
      </div>
    </div>
  );
}
