import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce, useThrottledCallback } from '@/hooks/useDebounce';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

interface OptimizedMapWrapperProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (markerId: string) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  className?: string;
  showControls?: boolean;
}

const MapLoadingFallback = memo(function MapLoadingFallback() {
  return (
    <div className="w-full h-full min-h-[300px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  );
});

const MapErrorFallback = memo(function MapErrorFallback({ 
  onRetry, 
  error 
}: { 
  onRetry: () => void; 
  error?: string;
}) {
  return (
    <div className="w-full h-full min-h-[300px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="text-center p-6">
        <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Map Unavailable
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
          {error || 'Unable to load the map. Please check your connection and try again.'}
        </p>
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    </div>
  );
});

const MAX_VISIBLE_MARKERS = 50;
const MARKER_CLUSTER_THRESHOLD = 100;

declare global {
  interface Window {
    google?: typeof google;
    initGoogleMapsCallback?: () => void;
  }
}

let googleMapsLoadPromise: Promise<void> | null = null;
let isGoogleMapsLoaded = false;

function removeExistingGoogleMapsScript(): void {
  const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
  existingScripts.forEach(script => script.remove());
  delete window.initGoogleMapsCallback;
  delete (window as any).google;
}

function loadGoogleMapsAPI(forceReload: boolean = false): Promise<void> {
  if (!forceReload && isGoogleMapsLoaded && window.google?.maps) {
    return Promise.resolve();
  }

  if (!forceReload && googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  if (forceReload) {
    removeExistingGoogleMapsScript();
    isGoogleMapsLoaded = false;
    googleMapsLoadPromise = null;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (!forceReload && window.google?.maps) {
      isGoogleMapsLoaded = true;
      resolve();
      return;
    }

    const apiKey = (window as any).__GOOGLE_MAPS_API_KEY__ || 
                   import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      reject(new Error('Google Maps API key not configured'));
      return;
    }

    window.initGoogleMapsCallback = () => {
      isGoogleMapsLoaded = true;
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsLoadPromise = null;
      isGoogleMapsLoaded = false;
      reject(new Error('Failed to load Google Maps API'));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

export const OptimizedMapWrapper = memo(function OptimizedMapWrapper({
  center,
  zoom = 13,
  markers = [],
  onMarkerClick,
  onCenterChange,
  className = '',
  showControls = true,
}: OptimizedMapWrapperProps) {
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [visibleMarkers, setVisibleMarkers] = useState<MapMarker[]>([]);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initAttemptedRef = useRef(false);
  
  const debouncedCenter = useDebounce(center, 300);

  const throttledCenterChange = useThrottledCallback(
    (newCenter: { lat: number; lng: number }) => {
      onCenterChange?.(newCenter);
    },
    500
  );

  const updateVisibleMarkers = useCallback((allMarkers: MapMarker[], bounds?: google.maps.LatLngBounds) => {
    if (!bounds) {
      setVisibleMarkers(allMarkers.slice(0, MAX_VISIBLE_MARKERS));
      return;
    }

    const inBoundsMarkers = allMarkers.filter(marker => 
      bounds.contains({ lat: marker.lat, lng: marker.lng })
    );

    if (inBoundsMarkers.length > MARKER_CLUSTER_THRESHOLD) {
      setVisibleMarkers(inBoundsMarkers.slice(0, MAX_VISIBLE_MARKERS));
    } else {
      setVisibleMarkers(inBoundsMarkers);
    }
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => {
      google.maps.event.clearInstanceListeners(marker);
      marker.setMap(null);
    });
    markersRef.current = [];
  }, []);

  const triggerResize = useCallback(() => {
    if (mapRef.current && window.google?.maps) {
      google.maps.event.trigger(mapRef.current, 'resize');
      const currentCenter = mapRef.current.getCenter();
      if (currentCenter) {
        mapRef.current.setCenter(currentCenter);
      }
    }
  }, []);

  const initializeMap = useCallback(async () => {
    if (!mapContainerRef.current || initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    try {
      await loadGoogleMapsAPI();

      if (!mapContainerRef.current) return;

      const map = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom,
        disableDefaultUI: !showControls,
        zoomControl: showControls,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: showControls,
        gestureHandling: 'cooperative',
      });

      mapRef.current = map;

      map.addListener('bounds_changed', () => {
        const bounds = map.getBounds();
        if (bounds) {
          updateVisibleMarkers(markers, bounds);
        }
      });

      map.addListener('center_changed', () => {
        const newCenter = map.getCenter();
        if (newCenter) {
          throttledCenterChange({
            lat: newCenter.lat(),
            lng: newCenter.lng(),
          });
        }
      });

      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            requestAnimationFrame(() => {
              triggerResize();
            });
          }
        }
      });

      resizeObserverRef.current.observe(mapContainerRef.current);

      google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
        setIsMapLoaded(true);
        setMapError(null);
        triggerResize();
      });

      setTimeout(() => {
        if (!isMapLoaded) {
          setIsMapLoaded(true);
          triggerResize();
        }
      }, 2000);

    } catch (error) {
      console.error('[OptimizedMapWrapper] Failed to initialize map:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to load map');
      initAttemptedRef.current = false;
    }
  }, [center, zoom, showControls, markers, updateVisibleMarkers, throttledCenterChange, triggerResize, isMapLoaded]);

  const handleRetry = useCallback(async () => {
    setMapError(null);
    initAttemptedRef.current = false;
    
    try {
      await loadGoogleMapsAPI(true);
      initializeMap();
    } catch (error) {
      console.error('[OptimizedMapWrapper] Retry failed:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to load map');
    }
  }, [initializeMap]);

  useEffect(() => {
    initializeMap();

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      clearMarkers();

      if (mapRef.current) {
        google.maps.event.clearInstanceListeners(mapRef.current);
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    clearMarkers();

    const newMarkers = visibleMarkers.map(markerData => {
      const marker = new google.maps.Marker({
        position: { lat: markerData.lat, lng: markerData.lng },
        map: mapRef.current!,
        title: markerData.label,
        optimized: true,
      });

      if (onMarkerClick) {
        marker.addListener('click', () => onMarkerClick(markerData.id));
      }

      return marker;
    });

    markersRef.current = newMarkers;
  }, [visibleMarkers, isMapLoaded, onMarkerClick, clearMarkers]);

  useEffect(() => {
    if (mapRef.current && isMapLoaded) {
      const bounds = mapRef.current.getBounds();
      updateVisibleMarkers(markers, bounds || undefined);
    }
  }, [markers, isMapLoaded, updateVisibleMarkers]);

  useEffect(() => {
    if (mapRef.current && isMapLoaded) {
      mapRef.current.panTo(debouncedCenter);
    }
  }, [debouncedCenter, isMapLoaded]);

  if (mapError) {
    return (
      <div className={`relative ${className}`} data-testid="optimized-map-wrapper">
        <MapErrorFallback onRetry={handleRetry} error={mapError} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid="optimized-map-wrapper">
      {!isMapLoaded && <MapLoadingFallback />}
      <div 
        ref={mapContainerRef}
        id="optimized-google-map"
        className={`w-full h-full rounded-lg ${isMapLoaded ? '' : 'opacity-0 absolute inset-0'}`}
        style={{ minHeight: '300px' }}
      />
    </div>
  );
});

export default OptimizedMapWrapper;
