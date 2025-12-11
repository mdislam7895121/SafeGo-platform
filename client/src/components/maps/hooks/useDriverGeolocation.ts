import { useState, useEffect, useCallback, useRef } from "react";

export interface GeolocationPosition {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

export type GeolocationStatus = 
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "timeout"
  | "error";

export interface GeolocationError {
  code: number;
  message: string;
}

interface UseDriverGeolocationOptions {
  enableHighAccuracy?: boolean;
  updateIntervalMs?: number;
  maxAge?: number;
  timeout?: number;
  debounceMs?: number;
  onPositionUpdate?: (position: GeolocationPosition) => void;
  onError?: (error: GeolocationError) => void;
}

interface UseDriverGeolocationReturn {
  position: GeolocationPosition | null;
  status: GeolocationStatus;
  error: GeolocationError | null;
  isTracking: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  requestPermission: () => Promise<boolean>;
  getLastKnownPosition: () => GeolocationPosition | null;
}

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  updateIntervalMs: 3000,
  maxAge: 10000,
  timeout: 15000,
  debounceMs: 1000,
};

function getStatusMessage(status: GeolocationStatus): string {
  switch (status) {
    case "idle": return "Location tracking not started";
    case "requesting": return "Requesting location permission...";
    case "active": return "Tracking active";
    case "denied": return "Location permission denied. Please enable location access in your browser settings.";
    case "unavailable": return "Location services unavailable on this device";
    case "timeout": return "Location request timed out. Please try again.";
    case "error": return "An error occurred while getting location";
    default: return "";
  }
}

export function useDriverGeolocation(options: UseDriverGeolocationOptions = {}): UseDriverGeolocationReturn {
  const {
    enableHighAccuracy = DEFAULT_OPTIONS.enableHighAccuracy,
    updateIntervalMs = DEFAULT_OPTIONS.updateIntervalMs,
    maxAge = DEFAULT_OPTIONS.maxAge,
    timeout = DEFAULT_OPTIONS.timeout,
    debounceMs = DEFAULT_OPTIONS.debounceMs,
    onPositionUpdate,
    onError,
  } = options;
  
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  
  const handleSuccess = useCallback((geo: GeolocationPositionType) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < debounceMs) return;
    
    const newPosition: GeolocationPosition = {
      lat: geo.coords.latitude,
      lng: geo.coords.longitude,
      heading: geo.coords.heading,
      accuracy: geo.coords.accuracy,
      timestamp: geo.timestamp,
    };
    
    lastUpdateRef.current = now;
    lastPositionRef.current = newPosition;
    setPosition(newPosition);
    setStatus("active");
    setError(null);
    
    if (onPositionUpdate) {
      onPositionUpdate(newPosition);
    }
  }, [debounceMs, onPositionUpdate]);
  
  const handleError = useCallback((geoError: GeolocationPositionError) => {
    let newStatus: GeolocationStatus = "error";
    let message = "Unknown error";
    
    switch (geoError.code) {
      case 1:
        newStatus = "denied";
        message = "Location permission denied by user";
        break;
      case 2:
        newStatus = "unavailable";
        message = "Location information is unavailable";
        break;
      case 3:
        newStatus = "timeout";
        message = "Location request timed out";
        break;
    }
    
    const errorInfo: GeolocationError = {
      code: geoError.code,
      message,
    };
    
    setStatus(newStatus);
    setError(errorInfo);
    
    if (onError) {
      onError(errorInfo);
    }
  }, [onError]);
  
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError({ code: 0, message: "Geolocation not supported" });
      return false;
    }
    
    setStatus("requesting");
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (geo) => {
          handleSuccess(geo);
          resolve(true);
        },
        (err) => {
          handleError(err);
          resolve(false);
        },
        {
          enableHighAccuracy,
          maximumAge: maxAge,
          timeout,
        }
      );
    });
  }, [enableHighAccuracy, maxAge, timeout, handleSuccess, handleError]);
  
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError({ code: 0, message: "Geolocation not supported" });
      return;
    }
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    
    setIsTracking(true);
    setStatus("requesting");
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        maximumAge: maxAge,
        timeout,
      }
    );
  }, [enableHighAccuracy, maxAge, timeout, handleSuccess, handleError]);
  
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setStatus("idle");
  }, []);
  
  const getLastKnownPosition = useCallback(() => {
    return lastPositionRef.current;
  }, []);
  
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  return {
    position,
    status,
    error,
    isTracking,
    startTracking,
    stopTracking,
    requestPermission,
    getLastKnownPosition,
  };
}

type GeolocationPositionType = {
  coords: {
    latitude: number;
    longitude: number;
    heading: number | null;
    accuracy: number;
  };
  timestamp: number;
};

export { getStatusMessage };
export default useDriverGeolocation;
