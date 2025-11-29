import { useState, useEffect, useRef, useCallback } from "react";

export interface CustomerLocation {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface UseCustomerLocationResult {
  location: CustomerLocation | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
  isPermissionDenied: boolean;
  retry: () => void;
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000,
};

export function useCustomerLocation(
  options: PositionOptions = DEFAULT_OPTIONS
): UseCustomerLocationResult {
  const [location, setLocation] = useState<CustomerLocation | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const newLocation: CustomerLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };
    
    setLocation(newLocation);
    setError(null);
    setIsLoading(false);
    setIsPermissionDenied(false);
    retryCountRef.current = 0;
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    setError(error);
    setIsLoading(false);
    
    if (error.code === error.PERMISSION_DENIED) {
      setIsPermissionDenied(true);
    }
    
    console.warn("[useCustomerLocation] Geolocation error:", error.message);
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("[useCustomerLocation] Geolocation not supported");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      options
    );

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );
  }, [handleSuccess, handleError, options]);

  const retry = useCallback(() => {
    retryCountRef.current += 1;
    setIsPermissionDenied(false);
    startWatching();
  }, [startWatching]);

  useEffect(() => {
    startWatching();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatching]);

  return {
    location,
    error,
    isLoading,
    isPermissionDenied,
    retry,
  };
}

export function createCustomerLocationIcon(): L.DivIcon {
  const L = (window as any).L;
  if (!L) return null as any;

  return L.divIcon({
    className: "customer-location-marker",
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(66, 133, 244, 0.2);
          border-radius: 50%;
          animation: customerPulse 2s ease-out infinite;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          background: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default useCustomerLocation;
