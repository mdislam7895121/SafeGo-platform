import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  ArrowLeft,
  ArrowRight,
  Clock,
  Ruler,
  Loader2,
  Check,
} from "lucide-react";
import { useRideBooking, type RouteData } from "@/contexts/RideBookingContext";
import { MapContainer, TileLayer, useMap, Polyline, Marker } from "react-leaflet";
import { DraggableMarker } from "@/components/maps/DraggableMarker";
import { LocationSearchInput } from "@/components/rider/LocationSearchInput";
import { reverseGeocode, addRecentLocation, getRouteDirections, decodePolyline } from "@/lib/locationService";
import "leaflet/dist/leaflet.css";

function createPickupIcon() {
  if (typeof window === "undefined") return null;
  const L = require("leaflet");
  return L.divIcon({
    className: "safego-pickup-icon-static",
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

function MapBoundsHandler({ 
  pickupLocation, 
  dropoffLocation 
}: { 
  pickupLocation: { lat: number; lng: number } | null;
  dropoffLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    if (pickupLocation && dropoffLocation && !hasFittedRef.current) {
      const L = require("leaflet");
      const bounds = L.latLngBounds(
        [pickupLocation.lat, pickupLocation.lng],
        [dropoffLocation.lat, dropoffLocation.lng]
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      hasFittedRef.current = true;
    } else if (pickupLocation && !dropoffLocation) {
      map.setView([pickupLocation.lat, pickupLocation.lng], 15);
    }
  }, [map, pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (dropoffLocation) {
      hasFittedRef.current = false;
    }
  }, [dropoffLocation?.lat, dropoffLocation?.lng]);

  return null;
}

function generateRoutePolyline(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number }
): [number, number][] {
  const points: [number, number][] = [];
  const steps = 30;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = pickup.lat + (dropoff.lat - pickup.lat) * t;
    const lng = pickup.lng + (dropoff.lng - pickup.lng) * t;
    const curve = Math.sin(t * Math.PI) * 0.001;
    points.push([lat + curve * 0.5, lng + curve]);
  }
  
  return points;
}

export default function RideDropoffPage() {
  const [, setLocation] = useLocation();
  const { state, setDropoff, setRouteData, setStep, canProceedToDropoff, canProceedToOptions } = useRideBooking();
  
  const [searchQuery, setSearchQuery] = useState(state.dropoff?.address?.split(",")[0] || "");
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: state.pickup?.lat || 23.8103,
    lng: state.pickup?.lng || 90.4125,
  });
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    state.dropoff ? { lat: state.dropoff.lat, lng: state.dropoff.lng } : null
  );
  const [showMarkerAnimation, setShowMarkerAnimation] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [localRouteInfo, setLocalRouteInfo] = useState<{ distanceMiles: number; durationMinutes: number } | null>(
    state.routeData ? { distanceMiles: state.routeData.distanceMiles, durationMinutes: state.routeData.durationMinutes } : null
  );
  const [googleRoutePolyline, setGoogleRoutePolyline] = useState<[number, number][]>([]);

  const pickupIcon = useMemo(() => createPickupIcon(), []);

  useEffect(() => {
    if (!canProceedToDropoff) {
      setLocation("/rider/ride/pickup");
      return;
    }
    setStep("dropoff");
  }, [setStep, canProceedToDropoff, setLocation]);

  useEffect(() => {
    if (state.pickup && state.dropoff) {
      setIsCalculatingRoute(true);
      getRouteDirections(
        { lat: state.pickup.lat, lng: state.pickup.lng },
        { lat: state.dropoff.lat, lng: state.dropoff.lng }
      ).then((routeResult) => {
        if (routeResult) {
          setLocalRouteInfo({
            distanceMiles: routeResult.distanceMiles,
            durationMinutes: routeResult.durationMinutes,
          });
          if (routeResult.polyline) {
            setGoogleRoutePolyline(decodePolyline(routeResult.polyline));
          } else {
            setGoogleRoutePolyline([]);
          }
          const newRouteData: RouteData = {
            distanceMiles: routeResult.distanceMiles,
            durationMinutes: routeResult.durationMinutes,
            rawDistanceMeters: routeResult.rawDistanceMeters || 0,
            rawDurationSeconds: routeResult.rawDurationSeconds || 0,
            routePolyline: routeResult.polyline || "",
            providerSource: routeResult.providerSource || "google_maps",
          };
          setRouteData(newRouteData);
        } else {
          setLocalRouteInfo(null);
          setGoogleRoutePolyline([]);
          setRouteData(null);
        }
      }).catch(() => {
        setLocalRouteInfo(null);
        setGoogleRoutePolyline([]);
        setRouteData(null);
      }).finally(() => {
        setIsCalculatingRoute(false);
      });
    } else {
      setLocalRouteInfo(null);
      setGoogleRoutePolyline([]);
      setRouteData(null);
    }
  }, [state.pickup, state.dropoff, setRouteData]);

  const updateLocationFromCoords = useCallback(async (lat: number, lng: number, animate = true) => {
    if (animate) setShowMarkerAnimation(true);
    setMarkerPosition({ lat, lng });
    setIsReverseGeocoding(true);
    
    try {
      const address = await reverseGeocode(lat, lng);
      const shortAddress = address.split(",")[0];
      setSearchQuery(shortAddress);
      setDropoff({ address, lat, lng });
    } finally {
      setIsReverseGeocoding(false);
      if (animate) setTimeout(() => setShowMarkerAnimation(false), 400);
    }
  }, [setDropoff]);

  const handleLocationSelect = useCallback((location: { address: string; lat: number; lng: number }) => {
    setMapCenter({ lat: location.lat, lng: location.lng });
    setMarkerPosition({ lat: location.lat, lng: location.lng });
    setShowMarkerAnimation(true);
    setDropoff(location);
    setTimeout(() => setShowMarkerAnimation(false), 400);
  }, [setDropoff]);

  const handleMarkerDragEnd = useCallback(async (lat: number, lng: number) => {
    await updateLocationFromCoords(lat, lng, false);
  }, [updateLocationFromCoords]);

  const handleConfirmDropoff = () => {
    if (canProceedToOptions && state.dropoff) {
      addRecentLocation({
        address: state.dropoff.address,
        lat: state.dropoff.lat,
        lng: state.dropoff.lng,
      });
      setLocation("/rider/ride/options");
    }
  };

  const handleBack = () => {
    setLocation("/rider/ride/pickup");
  };

  const fallbackPolyline = state.pickup && state.dropoff
    ? generateRoutePolyline(state.pickup, state.dropoff)
    : [];
  const routePolyline = googleRoutePolyline.length > 0 ? googleRoutePolyline : fallbackPolyline;

  return (
    <div className="flex flex-col h-full" data-testid="ride-dropoff-page">
      <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack} 
              data-testid="button-back-dropoff"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-dropoff-title">
                Where are you going?
              </h1>
              <p className="text-sm text-muted-foreground">
                Search or select your destination
              </p>
            </div>
          </div>

          <Card className="mb-3 bg-muted/30 border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">A</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm font-medium truncate" data-testid="text-pickup-summary">
                    {state.pickup?.address?.split(",")[0] || "Not set"}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <div className="w-8 h-px bg-muted-foreground/30" />
                  <ArrowRight className="h-4 w-4" />
                  <div className="w-8 h-px bg-muted-foreground/30" />
                </div>
                <div className="h-8 w-8 rounded-full border-2 border-dashed border-red-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-red-500">B</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <LocationSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onLocationSelect={handleLocationSelect}
            placeholder="Where to?"
            variant="dropoff"
            showCurrentLocation={false}
            autoFocus={true}
          />
        </div>
      </div>

      <div className="flex-1 relative min-h-[250px]">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapBoundsHandler 
            pickupLocation={state.pickup} 
            dropoffLocation={markerPosition} 
          />
          
          {state.pickup && pickupIcon && (
            <Marker
              position={[state.pickup.lat, state.pickup.lng]}
              icon={pickupIcon}
            />
          )}
          
          {markerPosition && (
            <DraggableMarker
              position={markerPosition}
              onDragEnd={handleMarkerDragEnd}
              variant="dropoff"
              isDraggable={true}
              showAnimation={showMarkerAnimation}
            />
          )}
          
          {routePolyline.length > 1 && (
            <>
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: "#374151",
                  weight: 8,
                  opacity: 0.3,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: "#3B82F6",
                  weight: 5,
                  opacity: 0.9,
                  lineCap: "round",
                  lineJoin: "round",
                  dashArray: "10, 10",
                }}
              />
            </>
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

        {localRouteInfo && (
          <div 
            className="absolute top-4 right-4 z-[1000] bg-background/95 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border"
            data-testid="route-info-overlay"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold" data-testid="text-route-eta">{localRouteInfo.durationMinutes}</span>
                <span className="text-xs text-muted-foreground">min</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold" data-testid="text-route-distance">{localRouteInfo.distanceMiles.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">mi</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-4 left-4 right-4 z-[1000] flex gap-2">
          <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-md border text-xs font-medium">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>Pickup</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-md border text-xs font-medium">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span>Dropoff</span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 p-4 border-t bg-background space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        {state.dropoff && (
          <Card className="bg-muted/50 border-l-4 border-l-red-500">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">B</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Dropoff location</p>
                    {isReverseGeocoding && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p 
                    className="text-sm text-muted-foreground truncate" 
                    data-testid="text-selected-dropoff"
                  >
                    {state.dropoff.address}
                  </p>
                  {localRouteInfo && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {localRouteInfo.durationMinutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3" />
                        {localRouteInfo.distanceMiles.toFixed(1)} mi
                      </span>
                    </div>
                  )}
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
          disabled={!canProceedToOptions || isReverseGeocoding}
          onClick={handleConfirmDropoff}
          data-testid="button-confirm-destination"
        >
          {isReverseGeocoding ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Getting Address...
            </>
          ) : (
            <>
              <ArrowRight className="h-5 w-5 mr-2" />
              Confirm Destination
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
