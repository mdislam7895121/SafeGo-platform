import { memo, useCallback, useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useDebounce, useThrottledCallback } from '@/hooks/useDebounce';
import { Loader2 } from 'lucide-react';

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

const MAX_VISIBLE_MARKERS = 50;
const MARKER_CLUSTER_THRESHOLD = 100;

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
  const [visibleMarkers, setVisibleMarkers] = useState<MapMarker[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  
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
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
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

    return () => clearMarkers();
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

  return (
    <div className={`relative ${className}`} data-testid="optimized-map-wrapper">
      {!isMapLoaded && <MapLoadingFallback />}
      <div 
        id="optimized-google-map"
        className={`w-full h-full rounded-lg ${isMapLoaded ? '' : 'hidden'}`}
        style={{ minHeight: '300px' }}
      />
    </div>
  );
});

export default OptimizedMapWrapper;
