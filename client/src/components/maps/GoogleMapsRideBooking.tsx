import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

interface GoogleMapsRideBookingProps {
  pickupLocation: LocationData | null;
  dropoffLocation: LocationData | null;
  routePolyline: [number, number][] | null;
  defaultCenter: { lat: number; lng: number };
  defaultZoom?: number;
  onMapReady?: () => void;
  className?: string;
}

const MapLoadingFallback = memo(function MapLoadingFallback() {
  return (
    <div className="w-full h-full min-h-[200px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  );
});

const MapUnavailableFallback = memo(function MapUnavailableFallback({
  pickupLocation,
  dropoffLocation,
}: {
  pickupLocation: LocationData | null;
  dropoffLocation: LocationData | null;
}) {
  return (
    <div className="w-full h-full min-h-[200px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center p-6 max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <MapPin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Map Preview Unavailable
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Your route is ready. The map preview is temporarily unavailable.
        </p>
        
        {(pickupLocation || dropoffLocation) && (
          <div className="text-left bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            {pickupLocation && (
              <div className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {pickupLocation.address || `${pickupLocation.lat.toFixed(4)}, ${pickupLocation.lng.toFixed(4)}`}
                </span>
              </div>
            )}
            {dropoffLocation && (
              <div className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {dropoffLocation.address || `${dropoffLocation.lat.toFixed(4)}, ${dropoffLocation.lng.toFixed(4)}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const GoogleMapsRideBooking = memo(function GoogleMapsRideBooking({
  pickupLocation,
  dropoffLocation,
  routePolyline,
  defaultCenter,
  defaultZoom = 13,
  onMapReady,
  className = '',
}: GoogleMapsRideBookingProps) {
  const { isReady, isLoading, error, isDisabled } = useGoogleMaps();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineOutlineRef = useRef<google.maps.Polyline | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  const createPickupMarkerIcon = useCallback(() => {
    if (!window.google?.maps) return undefined;
    
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: '#22C55E',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
    };
  }, []);

  const createDropoffMarkerIcon = useCallback(() => {
    if (!window.google?.maps) return undefined;
    
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: '#EF4444',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
    };
  }, []);

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps || mapRef.current) return;

    const mapOptions: google.maps.MapOptions = {
      center: defaultCenter,
      zoom: defaultZoom,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    };

    const map = new google.maps.Map(mapContainerRef.current, mapOptions);
    mapRef.current = map;

    google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
      setIsMapInitialized(true);
      onMapReady?.();
    });

    setTimeout(() => {
      if (!isMapInitialized) {
        setIsMapInitialized(true);
        onMapReady?.();
      }
    }, 3000);
  }, [defaultCenter, defaultZoom, onMapReady, isMapInitialized]);

  const updatePickupMarker = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null);
      pickupMarkerRef.current = null;
    }

    if (pickupLocation) {
      pickupMarkerRef.current = new google.maps.Marker({
        position: { lat: pickupLocation.lat, lng: pickupLocation.lng },
        map: mapRef.current,
        icon: createPickupMarkerIcon(),
        title: 'Pickup',
        zIndex: 100,
      });
    }
  }, [pickupLocation, createPickupMarkerIcon]);

  const updateDropoffMarker = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setMap(null);
      dropoffMarkerRef.current = null;
    }

    if (dropoffLocation) {
      dropoffMarkerRef.current = new google.maps.Marker({
        position: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
        map: mapRef.current,
        icon: createDropoffMarkerIcon(),
        title: 'Dropoff',
        zIndex: 100,
      });
    }
  }, [dropoffLocation, createDropoffMarkerIcon]);

  const updateRoutePolyline = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (routePolylineOutlineRef.current) {
      routePolylineOutlineRef.current.setMap(null);
      routePolylineOutlineRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    if (routePolyline && routePolyline.length > 1) {
      const path = routePolyline.map(([lat, lng]) => ({ lat, lng }));

      routePolylineOutlineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#FFFFFF',
        strokeOpacity: 1,
        strokeWeight: 7,
        zIndex: 1,
        map: mapRef.current,
      });

      routePolylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#1DA1F2',
        strokeOpacity: 1,
        strokeWeight: 4,
        zIndex: 2,
        map: mapRef.current,
      });
    }
  }, [routePolyline]);

  const fitBounds = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (pickupLocation && dropoffLocation) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: pickupLocation.lat, lng: pickupLocation.lng });
      bounds.extend({ lat: dropoffLocation.lat, lng: dropoffLocation.lng });
      
      if (routePolyline && routePolyline.length > 0) {
        routePolyline.forEach(([lat, lng]) => {
          bounds.extend({ lat, lng });
        });
      }
      
      mapRef.current.fitBounds(bounds, { top: 60, right: 20, bottom: 20, left: 20 });
      
      const listener = google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
        const currentZoom = mapRef.current?.getZoom();
        if (currentZoom && currentZoom > 16) {
          mapRef.current?.setZoom(16);
        }
      });
      
      setTimeout(() => google.maps.event.removeListener(listener), 1000);
    } else if (pickupLocation) {
      mapRef.current.setCenter({ lat: pickupLocation.lat, lng: pickupLocation.lng });
      mapRef.current.setZoom(15);
    } else if (dropoffLocation) {
      mapRef.current.setCenter({ lat: dropoffLocation.lat, lng: dropoffLocation.lng });
      mapRef.current.setZoom(15);
    }
  }, [pickupLocation, dropoffLocation, routePolyline]);

  useEffect(() => {
    if (isReady && !mapRef.current) {
      initializeMap();
    }
  }, [isReady, initializeMap]);

  useEffect(() => {
    if (isMapInitialized) {
      updatePickupMarker();
    }
  }, [isMapInitialized, updatePickupMarker]);

  useEffect(() => {
    if (isMapInitialized) {
      updateDropoffMarker();
    }
  }, [isMapInitialized, updateDropoffMarker]);

  useEffect(() => {
    if (isMapInitialized) {
      updateRoutePolyline();
    }
  }, [isMapInitialized, updateRoutePolyline]);

  useEffect(() => {
    if (isMapInitialized) {
      fitBounds();
    }
  }, [isMapInitialized, fitBounds]);

  useEffect(() => {
    return () => {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = null;
      }
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setMap(null);
        dropoffMarkerRef.current = null;
      }
      if (routePolylineOutlineRef.current) {
        routePolylineOutlineRef.current.setMap(null);
        routePolylineOutlineRef.current = null;
      }
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
      if (mapRef.current) {
        google.maps.event.clearInstanceListeners(mapRef.current);
        mapRef.current = null;
      }
    };
  }, []);

  if (isDisabled || error) {
    return (
      <div className={`relative ${className}`} data-testid="google-maps-ride-booking-fallback">
        <MapUnavailableFallback
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
        />
      </div>
    );
  }

  if (isLoading || !isReady) {
    return (
      <div className={`relative ${className}`} data-testid="google-maps-ride-booking-loading">
        <MapLoadingFallback />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid="google-maps-ride-booking">
      {!isMapInitialized && (
        <div className="absolute inset-0 z-10">
          <MapLoadingFallback />
        </div>
      )}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ minHeight: '200px' }}
        aria-label="Ride booking map showing pickup and dropoff locations"
      />
    </div>
  );
});

export default GoogleMapsRideBooking;
