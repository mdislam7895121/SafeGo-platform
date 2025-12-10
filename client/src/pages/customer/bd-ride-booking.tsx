/**
 * Bangladesh Ride Booking Page
 * 
 * Customer-facing page for booking rides in Bangladesh with:
 * - Vehicle type selection (bike, cng, car_economy, car_premium)
 * - Real-time fare estimates with breakdown
 * - Cash and online payment options
 * - Night/peak surge indicators
 * - City-specific pricing
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { decodePolyline } from "@/lib/formatters";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Crosshair,
  Loader2,
  Car,
  Wallet,
  CreditCard,
  Moon,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Bike,
  Truck,
  Crown,
  Info,
  BanknoteIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

interface VehicleOption {
  vehicleType: string;
  displayName: string;
  description: string;
  baseFare: number;
  estimatedFare: number;
  fareRange: { min: number; max: number };
  currency: string;
  etaMinutes: number;
  capacity: number;
  icon: string;
  cashAllowed: boolean;
  onlineAllowed: boolean;
  isNightTime: boolean;
  isPeakTime: boolean;
  fareBreakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    nightMultiplier: number;
    peakMultiplier: number;
    fareBeforeTax?: number;
    bdTaxRate?: number;
    bdTaxAmount?: number;
    totalFare: number;
    currency: string;
  };
}

interface FareEstimateResponse {
  success: boolean;
  countryCode: string;
  cityCode: string;
  cityName: string;
  distanceKm: number;
  durationMin: number;
  vehicleOptions: VehicleOption[];
  estimateId: string;
  expiresAt: string;
}

interface CityOption {
  code: string;
  name: string;
}

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 28px; height: 28px; background: #22C55E; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="color: white; font-weight: bold; font-size: 12px;">A</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 28px; height: 28px; background: #EF4444; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="color: white; font-weight: bold; font-size: 12px;">B</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
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
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (pickupLocation) {
      map.setView([pickupLocation.lat, pickupLocation.lng], 15);
    } else if (dropoffLocation) {
      map.setView([dropoffLocation.lat, dropoffLocation.lng], 15);
    }
  }, [map, pickupLocation, dropoffLocation]);

  return null;
}

function getVehicleIcon(iconType: string) {
  switch (iconType) {
    case "bike":
      return <Bike className="h-6 w-6" />;
    case "truck":
      return <Truck className="h-6 w-6" />;
    case "car-front":
      return <Crown className="h-6 w-6" />;
    default:
      return <Car className="h-6 w-6" />;
  }
}

function getVehicleColor(vehicleType: string): string {
  switch (vehicleType) {
    case "bike":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    case "cng":
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
    case "car_economy":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    case "car_premium":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  }
}

export default function BDRideBooking() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>("DHK");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cash" | "online">("online");
  const [isLocating, setIsLocating] = useState(false);
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);

  const { data: cities, isLoading: citiesLoading } = useQuery<{ cities: CityOption[] }>({
    queryKey: ["/api/rides/bd/cities"],
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: fareEstimate,
    isLoading: fareLoading,
    refetch: refetchFare,
  } = useQuery<FareEstimateResponse>({
    queryKey: [
      "/api/rides/bd/fare-estimate",
      selectedCity,
      pickupLocation?.lat,
      pickupLocation?.lng,
      dropoffLocation?.lat,
      dropoffLocation?.lng,
      estimatedDistance,
      estimatedDuration,
    ],
    enabled:
      !!pickupLocation &&
      !!dropoffLocation &&
      !!estimatedDistance &&
      !!estimatedDuration &&
      estimatedDistance > 0,
    queryFn: async () => {
      const params = new URLSearchParams({
        countryCode: "BD",
        cityCode: selectedCity,
        pickupLat: pickupLocation!.lat.toString(),
        pickupLng: pickupLocation!.lng.toString(),
        dropoffLat: dropoffLocation!.lat.toString(),
        dropoffLng: dropoffLocation!.lng.toString(),
        estimatedDistanceKm: estimatedDistance!.toString(),
        estimatedDurationMin: estimatedDuration!.toString(),
      });
      const response = await fetch(`/api/rides/bd/fare-estimate?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch fare estimate");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
  });

  const requestRideMutation = useMutation({
    mutationFn: async (data: {
      vehicleType: string;
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      dropoffAddress: string;
      dropoffLat: number;
      dropoffLng: number;
      estimatedDistanceKm: number;
      estimatedDurationMin: number;
      paymentMethod: "cash" | "online";
    }) => {
      return apiRequest("/api/rides/bd/request", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          countryCode: "BD",
          cityCode: selectedCity,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Ride Requested",
        description: "Looking for a driver nearby...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      setLocation(`/customer/ride-details/${data.ride.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message || "Could not request ride",
        variant: "destructive",
      });
    },
  });

  const fetchRoute = useCallback(async () => {
    if (!pickupLocation || !dropoffLocation) return;

    try {
      const response = await fetch(
        `/api/maps/directions?origin=${pickupLocation.lat},${pickupLocation.lng}&destination=${dropoffLocation.lat},${dropoffLocation.lng}`
      );
      if (!response.ok) throw new Error("Failed to fetch route");

      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0].legs[0];
        setEstimatedDistance(route.distance.value / 1000);
        setEstimatedDuration(Math.ceil(route.duration.value / 60));

        if (data.routes[0].overview_polyline) {
          const decoded = decodePolyline(data.routes[0].overview_polyline.points);
          setRoutePolyline(decoded);
        }
      }
    } catch (error) {
      console.error("Route fetch error:", error);
      const directDistance = calculateDirectDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        dropoffLocation.lat,
        dropoffLocation.lng
      );
      setEstimatedDistance(directDistance);
      setEstimatedDuration(Math.ceil((directDistance / 30) * 60));
    }
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      fetchRoute();
    }
  }, [pickupLocation, dropoffLocation, fetchRoute]);

  const handleCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;
      const response = await fetch(
        `/api/maps/geocode?latlng=${latitude},${longitude}`
      );
      if (!response.ok) throw new Error("Failed to geocode location");

      const data = await response.json();
      const address =
        data.results?.[0]?.formatted_address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      setPickupLocation({
        address,
        lat: latitude,
        lng: longitude,
      });

      toast({
        title: "Location Found",
        description: "Using your current location as pickup",
      });
    } catch (error) {
      toast({
        title: "Location Error",
        description: "Could not get your current location",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  const handleRequestRide = () => {
    if (!pickupLocation || !dropoffLocation || !selectedVehicle || !estimatedDistance || !estimatedDuration) {
      toast({
        title: "Missing Information",
        description: "Please select pickup, dropoff, and vehicle type",
        variant: "destructive",
      });
      return;
    }

    const selectedOption = fareEstimate?.vehicleOptions.find(
      (v) => v.vehicleType === selectedVehicle
    );
    if (selectedOption && selectedPaymentMethod === "cash" && !selectedOption.cashAllowed) {
      toast({
        title: "Cash Not Available",
        description: "This vehicle type does not accept cash payment",
        variant: "destructive",
      });
      return;
    }

    requestRideMutation.mutate({
      vehicleType: selectedVehicle,
      pickupAddress: pickupLocation.address,
      pickupLat: pickupLocation.lat,
      pickupLng: pickupLocation.lng,
      dropoffAddress: dropoffLocation.address,
      dropoffLat: dropoffLocation.lat,
      dropoffLng: dropoffLocation.lng,
      estimatedDistanceKm: estimatedDistance,
      estimatedDurationMin: estimatedDuration,
      paymentMethod: selectedPaymentMethod,
    });
  };

  const selectedVehicleOption = fareEstimate?.vehicleOptions.find(
    (v) => v.vehicleType === selectedVehicle
  );

  const defaultCenter: [number, number] = [23.8103, 90.4125];

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="bd-ride-booking-page">
      <header className="flex items-center gap-3 p-4 border-b bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/customer")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Book a Ride</h1>
          <p className="text-sm text-muted-foreground">Bangladesh</p>
        </div>
        {cities?.cities && cities.cities.length > 0 && (
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
            data-testid="select-city"
          >
            {cities.cities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="flex-1 relative">
        <MapContainer
          center={pickupLocation ? [pickupLocation.lat, pickupLocation.lng] : defaultCenter}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsHandler
            pickupLocation={pickupLocation}
            dropoffLocation={dropoffLocation}
          />
          {pickupLocation && (
            <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon} />
          )}
          {dropoffLocation && (
            <Marker position={[dropoffLocation.lat, dropoffLocation.lng]} icon={dropoffIcon} />
          )}
          {routePolyline && routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              pathOptions={{ color: "#3B82F6", weight: 4, opacity: 0.8 }}
            />
          )}
        </MapContainer>

        <div className="absolute top-4 left-4 right-4 z-[1000]">
          <Card className="shadow-lg">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <GooglePlacesInput
                  value={pickupLocation?.address || ""}
                  onChange={() => {}}
                  placeholder="Enter pickup location"
                  variant="pickup"
                  onLocationSelect={(loc) => {
                    setPickupLocation({
                      address: loc.address,
                      lat: loc.lat,
                      lng: loc.lng,
                    });
                  }}
                  showCurrentLocation={false}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCurrentLocation}
                  disabled={isLocating}
                  data-testid="button-current-location"
                >
                  {isLocating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crosshair className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <GooglePlacesInput
                  value={dropoffLocation?.address || ""}
                  onChange={() => {}}
                  placeholder="Enter destination"
                  variant="dropoff"
                  onLocationSelect={(loc) => {
                    setDropoffLocation({
                      address: loc.address,
                      lat: loc.lat,
                      lng: loc.lng,
                    });
                  }}
                  showCurrentLocation={false}
                  className="flex-1"
                />
              </div>

              {estimatedDistance && estimatedDuration && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                  <div className="flex items-center gap-1">
                    <Navigation className="h-3.5 w-3.5" />
                    <span>{estimatedDistance.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>~{estimatedDuration} min</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-card border-t max-h-[55vh] overflow-y-auto">
        {fareLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!fareLoading && fareEstimate?.vehicleOptions && fareEstimate.vehicleOptions.length > 0 && (
          <div className="p-4 space-y-4">
            {(fareEstimate.vehicleOptions[0]?.isNightTime ||
              fareEstimate.vehicleOptions[0]?.isPeakTime) && (
              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <AlertDescription className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  {fareEstimate.vehicleOptions[0]?.isNightTime && (
                    <>
                      <Moon className="h-4 w-4" />
                      <span>Night rates apply (10 PM - 6 AM)</span>
                    </>
                  )}
                  {fareEstimate.vehicleOptions[0]?.isPeakTime && (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>Peak hour pricing active</span>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Select Vehicle</h3>
              <RadioGroup
                value={selectedVehicle || ""}
                onValueChange={setSelectedVehicle}
                className="space-y-2"
              >
                {fareEstimate.vehicleOptions.map((option) => (
                  <label
                    key={option.vehicleType}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedVehicle === option.vehicleType
                        ? "border-primary bg-primary/5"
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`vehicle-option-${option.vehicleType}`}
                  >
                    <RadioGroupItem
                      value={option.vehicleType}
                      id={option.vehicleType}
                      className="sr-only"
                    />
                    <div
                      className={`p-2.5 rounded-lg ${getVehicleColor(option.vehicleType)}`}
                    >
                      {getVehicleIcon(option.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.displayName}</span>
                        {option.capacity > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {option.capacity} seats
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {option.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {option.cashAllowed && (
                          <span className="flex items-center gap-1">
                            <BanknoteIcon className="h-3 w-3" /> Cash
                          </span>
                        )}
                        {option.onlineAllowed && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" /> Online
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        {formatCurrency(option.estimatedFare, "BDT")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {option.etaMinutes} min away
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {selectedVehicleOption && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Payment Method</h3>
                  <RadioGroup
                    value={selectedPaymentMethod}
                    onValueChange={(v) => setSelectedPaymentMethod(v as "cash" | "online")}
                    className="flex gap-3"
                  >
                    <label
                      className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedPaymentMethod === "online"
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                      data-testid="payment-online"
                    >
                      <RadioGroupItem value="online" id="online" className="sr-only" />
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="font-medium">Online</span>
                    </label>
                    <label
                      className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        !selectedVehicleOption.cashAllowed
                          ? "opacity-50 cursor-not-allowed"
                          : selectedPaymentMethod === "cash"
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                      data-testid="payment-cash"
                    >
                      <RadioGroupItem
                        value="cash"
                        id="cash"
                        className="sr-only"
                        disabled={!selectedVehicleOption.cashAllowed}
                      />
                      <Wallet className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Cash</span>
                    </label>
                  </RadioGroup>
                </div>

                <button
                  onClick={() => setShowFareBreakdown(!showFareBreakdown)}
                  className="flex items-center gap-2 text-sm text-primary hover:underline w-full justify-center py-2"
                  data-testid="button-fare-breakdown"
                >
                  <Info className="h-4 w-4" />
                  {showFareBreakdown ? "Hide" : "View"} Fare Breakdown
                  {showFareBreakdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {showFareBreakdown && selectedVehicleOption.fareBreakdown && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Fare</span>
                        <span>{formatCurrency(selectedVehicleOption.fareBreakdown.baseFare, "BDT")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Distance ({estimatedDistance?.toFixed(1)} km)
                        </span>
                        <span>{formatCurrency(selectedVehicleOption.fareBreakdown.distanceFare, "BDT")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Time ({estimatedDuration} min)
                        </span>
                        <span>{formatCurrency(selectedVehicleOption.fareBreakdown.timeFare, "BDT")}</span>
                      </div>
                      {selectedVehicleOption.fareBreakdown.bookingFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Booking Fee</span>
                          <span>{formatCurrency(selectedVehicleOption.fareBreakdown.bookingFee, "BDT")}</span>
                        </div>
                      )}
                      {selectedVehicleOption.fareBreakdown.nightMultiplier > 1 && (
                        <div className="flex justify-between text-amber-600">
                          <span className="flex items-center gap-1">
                            <Moon className="h-3 w-3" /> Night Rate
                          </span>
                          <span>×{selectedVehicleOption.fareBreakdown.nightMultiplier.toFixed(1)}</span>
                        </div>
                      )}
                      {selectedVehicleOption.fareBreakdown.peakMultiplier > 1 && (
                        <div className="flex justify-between text-orange-600">
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Peak Rate
                          </span>
                          <span>×{selectedVehicleOption.fareBreakdown.peakMultiplier.toFixed(1)}</span>
                        </div>
                      )}
                      {selectedVehicleOption.fareBreakdown.fareBeforeTax && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span>{formatCurrency(selectedVehicleOption.fareBreakdown.fareBeforeTax, "BDT")}</span>
                        </div>
                      )}
                      {(selectedVehicleOption.fareBreakdown.bdTaxAmount ?? 0) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            VAT ({selectedVehicleOption.fareBreakdown.bdTaxRate}%)
                          </span>
                          <span>+{formatCurrency(selectedVehicleOption.fareBreakdown.bdTaxAmount ?? 0, "BDT")}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(selectedVehicleOption.fareBreakdown.totalFare, "BDT")}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <Button
              className="w-full h-12 text-base"
              disabled={
                !selectedVehicle ||
                !pickupLocation ||
                !dropoffLocation ||
                requestRideMutation.isPending
              }
              onClick={handleRequestRide}
              data-testid="button-request-ride"
            >
              {requestRideMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : selectedVehicleOption ? (
                <>Request {selectedVehicleOption.displayName} · {formatCurrency(selectedVehicleOption.estimatedFare, "BDT")}</>
              ) : (
                "Select a Vehicle"
              )}
            </Button>
          </div>
        )}

        {!fareLoading &&
          (!fareEstimate?.vehicleOptions || fareEstimate.vehicleOptions.length === 0) &&
          pickupLocation &&
          dropoffLocation &&
          estimatedDistance && (
            <div className="p-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No vehicles available for this route. Please try a different location.
                </AlertDescription>
              </Alert>
            </div>
          )}

        {!pickupLocation || !dropoffLocation ? (
          <div className="p-4 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Enter pickup and destination to see available vehicles</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function calculateDirectDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
