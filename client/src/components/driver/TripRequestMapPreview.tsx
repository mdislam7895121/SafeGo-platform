import { useState, useMemo, memo } from "react";
import { MapPin, Navigation, AlertCircle, Loader2 } from "lucide-react";
import { SafeGoMap, type MapLocation } from "@/components/maps/SafeGoMap";

interface TripRequestMapPreviewProps {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupAddress: string;
  dropoffAddress: string;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateDeterministicRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): [number, number][] {
  const route: [number, number][] = [];
  const steps = 8;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = startLat + (endLat - startLat) * t;
    const lng = startLng + (endLng - startLng) * t;
    route.push([lat, lng]);
  }
  
  return route;
}

function TripRequestMapPreviewComponent({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
}: TripRequestMapPreviewProps) {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  
  const hasPickup = pickupLat !== null && pickupLng !== null;
  const hasDropoff = dropoffLat !== null && dropoffLng !== null;
  const hasRoute = hasPickup && hasDropoff;

  const mapCenter = useMemo((): MapLocation => {
    if (hasRoute) {
      return {
        lat: (pickupLat! + dropoffLat!) / 2,
        lng: (pickupLng! + dropoffLng!) / 2,
      };
    }
    if (hasPickup) {
      return { lat: pickupLat!, lng: pickupLng! };
    }
    return { lat: 40.7128, lng: -74.006 };
  }, [hasPickup, hasDropoff, hasRoute, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const pickupLocation = useMemo((): MapLocation | null => {
    if (!hasPickup) return null;
    return { lat: pickupLat!, lng: pickupLng!, label: pickupAddress };
  }, [hasPickup, pickupLat, pickupLng, pickupAddress]);

  const dropoffLocation = useMemo((): MapLocation | null => {
    if (!hasDropoff) return null;
    return { lat: dropoffLat!, lng: dropoffLng!, label: dropoffAddress };
  }, [hasDropoff, dropoffLat, dropoffLng, dropoffAddress]);

  const routeCoordinates = useMemo((): [number, number][] => {
    if (!hasRoute) return [];
    return generateDeterministicRoute(pickupLat!, pickupLng!, dropoffLat!, dropoffLng!);
  }, [hasRoute, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const tripDistance = useMemo(() => {
    if (!hasRoute) return null;
    return calculateDistance(pickupLat!, pickupLng!, dropoffLat!, dropoffLng!);
  }, [hasRoute, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const tripEta = useMemo(() => {
    if (!tripDistance) return null;
    return Math.ceil((tripDistance / 30) * 60);
  }, [tripDistance]);

  const mapZoom = useMemo(() => {
    if (!hasRoute || !tripDistance) return 14;
    if (tripDistance > 20) return 11;
    if (tripDistance > 10) return 12;
    if (tripDistance > 5) return 13;
    return 14;
  }, [hasRoute, tripDistance]);

  if (!hasPickup) {
    return (
      <div 
        className="relative h-32 rounded-xl overflow-hidden border-2 border-border bg-muted"
        data-testid="map-preview-fallback"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <MapPin className="h-8 w-8 text-green-500 mb-2" />
          <p className="text-xs text-muted-foreground text-center px-4 line-clamp-2">
            {pickupAddress}
          </p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div 
        className="relative h-32 rounded-xl overflow-hidden border-2 border-border bg-muted"
        data-testid="map-preview-error"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AlertCircle className="h-6 w-6 text-amber-500 mb-2" />
          <p className="text-xs text-muted-foreground">Map unavailable</p>
          <p className="text-xs font-medium mt-1 px-4 text-center line-clamp-1">
            {pickupAddress}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative h-32 rounded-xl overflow-hidden border-2 border-border"
      data-testid="map-preview-container"
    >
      {!mapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
      <SafeGoMap
        center={mapCenter}
        zoom={mapZoom}
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
        activeLeg="to_pickup"
        routeCoordinates={routeCoordinates}
        showControls={false}
        autoFollow={false}
        showEtaOverlay={false}
        showTrafficToggle={false}
        className="h-full w-full"
        onMapReady={() => setMapReady(true)}
        onDistanceCalculated={(distanceKm, etaMinutes) => {}}
      />

      {hasRoute && tripDistance && tripEta && (
        <div 
          className="absolute bottom-2 left-2 right-2 flex justify-between pointer-events-none"
          data-testid="map-route-info"
        >
          <div className="bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium flex items-center gap-1">
            <Navigation className="h-3 w-3 text-blue-500" />
            <span data-testid="text-trip-distance">{tripDistance.toFixed(1)} km</span>
          </div>
          <div className="bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium flex items-center gap-1">
            <span className="text-green-500">A</span>
            <span className="mx-1">→</span>
            <span className="text-red-500">B</span>
            <span className="ml-1" data-testid="text-trip-eta">{tripEta} min</span>
          </div>
        </div>
      )}

      {!hasRoute && hasPickup && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <div className="bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium flex items-center gap-1">
            <MapPin className="h-3 w-3 text-green-500" />
            <span>Pickup</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const TripRequestMapPreview = memo(TripRequestMapPreviewComponent);
export default TripRequestMapPreview;
