import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  ArrowLeft,
  Navigation,
  Crosshair,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { useRideBooking, type LocationData } from "@/contexts/RideBookingContext";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { DraggableMarker } from "@/components/maps/DraggableMarker";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { reverseGeocode, addRecentLocation } from "@/lib/locationService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import "leaflet/dist/leaflet.css";

function MapEventHandler({ 
  onMapMove, 
  onMapClick 
}: { 
  onMapMove: (center: { lat: number; lng: number }) => void;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMapMove({ lat: center.lat, lng: center.lng });
    },
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterControl({ 
  onClick, 
  isLocating 
}: { 
  onClick: () => void; 
  isLocating: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLocating}
      className="absolute bottom-24 right-4 z-[1000] bg-background p-3 rounded-full shadow-lg border hover-elevate"
      data-testid="button-recenter-map"
    >
      {isLocating ? (
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      ) : (
        <Crosshair className="h-6 w-6 text-blue-600" />
      )}
    </button>
  );
}

function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (
      !prevCenterRef.current ||
      prevCenterRef.current.lat !== center.lat ||
      prevCenterRef.current.lng !== center.lng
    ) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
      prevCenterRef.current = center;
    }
  }, [map, center, zoom]);

  return null;
}

export default function RidePickupPage() {
  const [, setLocation] = useLocation();
  const { state, setPickup, setStep, canProceedToDropoff } = useRideBooking();
  
  const [searchQuery, setSearchQuery] = useState(state.pickup?.address?.split(",")[0] || "");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: state.pickup?.lat || 23.8103,
    lng: state.pickup?.lng || 90.4125,
  });
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    state.pickup ? { lat: state.pickup.lat, lng: state.pickup.lng } : null
  );
  const [showMarkerAnimation, setShowMarkerAnimation] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  useEffect(() => {
    setStep("pickup");
  }, [setStep]);

  const updateLocationFromCoords = useCallback(async (lat: number, lng: number, animate = true) => {
    if (animate) setShowMarkerAnimation(true);
    setMarkerPosition({ lat, lng });
    setIsReverseGeocoding(true);
    
    try {
      const address = await reverseGeocode(lat, lng);
      const shortAddress = address.split(",")[0];
      setSearchQuery(shortAddress);
      setPickup({ address, lat, lng });
    } finally {
      setIsReverseGeocoding(false);
      if (animate) setTimeout(() => setShowMarkerAnimation(false), 400);
    }
  }, [setPickup]);

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
        setMapCenter({ lat: latitude, lng: longitude });
        await updateLocationFromCoords(latitude, longitude);
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
  }, [updateLocationFromCoords]);

  const handleLocationSelect = useCallback((location: { address: string; lat: number; lng: number }) => {
    setMapCenter({ lat: location.lat, lng: location.lng });
    setMarkerPosition({ lat: location.lat, lng: location.lng });
    setShowMarkerAnimation(true);
    setPickup(location);
    setTimeout(() => setShowMarkerAnimation(false), 400);
  }, [setPickup]);

  const handleMarkerDragEnd = useCallback(async (lat: number, lng: number) => {
    await updateLocationFromCoords(lat, lng, false);
  }, [updateLocationFromCoords]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    await updateLocationFromCoords(lat, lng);
  }, [updateLocationFromCoords]);

  const handleMapMove = useCallback((center: { lat: number; lng: number }) => {
  }, []);

  const handleConfirmPickup = () => {
    if (canProceedToDropoff && state.pickup) {
      addRecentLocation({
        address: state.pickup.address,
        lat: state.pickup.lat,
        lng: state.pickup.lng,
      });
      setLocation("/rider/ride/dropoff");
    }
  };

  const handleBack = () => {
    setLocation("/rider/ride/new");
  };

  return (
    <div className="flex flex-col h-full" data-testid="ride-pickup-page">
      <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack} 
              data-testid="button-back-pickup"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-pickup-title">
                Set Pickup Location
              </h1>
              <p className="text-sm text-muted-foreground">
                Drag the pin or search for a location
              </p>
            </div>
          </div>

          <GooglePlacesInput
            value={searchQuery}
            onChange={setSearchQuery}
            onLocationSelect={handleLocationSelect}
            onCurrentLocation={handleGetCurrentLocation}
            isLoadingCurrentLocation={isLocating}
            placeholder="Set pickup location"
            variant="pickup"
            showCurrentLocation={true}
          />

          {locationError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{locationError}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-[300px]">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
          <MapController center={mapCenter} zoom={16} />
          <MapEventHandler onMapMove={handleMapMove} onMapClick={handleMapClick} />
          
          {markerPosition && (
            <DraggableMarker
              position={markerPosition}
              onDragEnd={handleMarkerDragEnd}
              variant="pickup"
              isDraggable={true}
              showAnimation={showMarkerAnimation}
            />
          )}
        </MapContainer>
        
        <div className="absolute top-4 left-4 z-[1000] bg-primary/95 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <MapPin className="h-5 w-5 text-primary-foreground" />
              <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-semibold text-primary-foreground">SafeGo Map</span>
          </div>
        </div>
        
        <RecenterControl onClick={handleGetCurrentLocation} isLocating={isLocating} />
        
        <div className="absolute bottom-4 right-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-md border text-[10px] text-muted-foreground">
          Drag pin to adjust
        </div>
      </div>

      <div className="sticky bottom-0 z-20 p-4 border-t bg-background space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        {state.pickup && (
          <Card className="bg-muted/50 border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">A</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Pickup location</p>
                    {isReverseGeocoding && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p 
                    className="text-sm text-muted-foreground truncate" 
                    data-testid="text-selected-pickup"
                  >
                    {state.pickup.address}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full h-14 text-base font-semibold"
          size="lg"
          disabled={!canProceedToDropoff || isReverseGeocoding}
          onClick={handleConfirmPickup}
          data-testid="button-confirm-pickup"
        >
          {isReverseGeocoding ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Getting Address...
            </>
          ) : (
            <>
              <Navigation className="h-5 w-5 mr-2" />
              Confirm Pickup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
