import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Navigation,
  ArrowLeft,
  Crosshair,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useRideBooking, type LocationData } from "@/contexts/RideBookingContext";
import { SafeGoMap } from "@/components/maps/SafeGoMap";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RidePickupPage() {
  const [, setLocation] = useLocation();
  const { state, setPickup, setStep, canProceedToDropoff } = useRideBooking();
  
  const [searchQuery, setSearchQuery] = useState(state.pickup?.address || "");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: state.pickup?.lat || 23.8103,
    lng: state.pickup?.lng || 90.4125,
  });
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    state.pickup ? { lat: state.pickup.lat, lng: state.pickup.lng } : null
  );

  useEffect(() => {
    setStep("pickup");
  }, [setStep]);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error("Reverse geocode error:", error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  const handleGetCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        
        setMapCenter({ lat: latitude, lng: longitude });
        setMarkerPosition({ lat: latitude, lng: longitude });
        setSearchQuery(address);
        setPickup({
          address,
          lat: latitude,
          lng: longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("An unknown error occurred.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [reverseGeocode, setPickup]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setMarkerPosition({ lat, lng });
    const address = await reverseGeocode(lat, lng);
    setSearchQuery(address);
    setPickup({
      address,
      lat,
      lng,
    });
  }, [reverseGeocode, setPickup]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleConfirmPickup = () => {
    if (canProceedToDropoff) {
      setLocation("/rider/ride/dropoff");
    }
  };

  const handleBack = () => {
    setLocation("/rider/ride/new");
  };

  return (
    <div className="flex flex-col h-full" data-testid="ride-pickup-page">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back-pickup">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-pickup-title">Set Pickup Location</h1>
            <p className="text-sm text-muted-foreground">Tap on the map or use current location</p>
          </div>
        </div>

        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search pickup location..."
            className="pl-10 pr-10"
            data-testid="input-pickup-search"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
            data-testid="button-get-current-location"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
          </Button>
        </div>

        {locationError && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex-1 relative min-h-[300px]">
        <SafeGoMap
          center={mapCenter}
          zoom={15}
          pickupLocation={markerPosition ? {
            lat: markerPosition.lat,
            lng: markerPosition.lng,
            label: searchQuery || "Pickup",
          } : null}
          showControls={true}
          className="h-full w-full"
        />
        
        <div 
          className="absolute inset-0 cursor-crosshair"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const lat = mapCenter.lat + (rect.height / 2 - y) * 0.0001;
            const lng = mapCenter.lng + (x - rect.width / 2) * 0.0001;
            handleMapClick(lat, lng);
          }}
          data-testid="map-click-overlay"
        />
      </div>

      <div className="p-4 border-t bg-background space-y-3">
        {state.pickup && (
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">A</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Pickup location</p>
                  <p className="text-sm text-muted-foreground truncate" data-testid="text-selected-pickup">
                    {state.pickup.address}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!canProceedToDropoff}
          onClick={handleConfirmPickup}
          data-testid="button-confirm-pickup"
        >
          <Navigation className="h-5 w-5 mr-2" />
          Confirm Pickup
        </Button>
      </div>
    </div>
  );
}
