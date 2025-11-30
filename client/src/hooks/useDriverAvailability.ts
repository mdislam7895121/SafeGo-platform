import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number;
}

interface GpsStatus {
  isAvailable: boolean;
  signalStrength: "strong" | "medium" | "weak" | "none";
  error: string | null;
}

interface UseDriverAvailabilityOptions {
  enableLocationBroadcast?: boolean;
  locationUpdateInterval?: number;
}

interface UseDriverAvailabilityReturn {
  isOnline: boolean;
  isUpdatingStatus: boolean;
  isLoading: boolean;
  isVerified: boolean;
  hasVehicle: boolean;
  toggleOnlineStatus: () => void;
  driverLocation: DriverLocation | null;
  gpsStatus: GpsStatus;
  profile: any;
  vehicle: any;
  stats: any;
  wallet: any;
}

export function useDriverAvailability(
  options: UseDriverAvailabilityOptions = {}
): UseDriverAvailabilityReturn {
  const { enableLocationBroadcast = true, locationUpdateInterval = 5000 } = options;
  const { toast } = useToast();
  
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>({
    isAvailable: true,
    signalStrength: "none",
    error: null,
  });

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
    refetchInterval: 5000,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (isOnline: boolean) => {
      return apiRequest("/api/driver/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline }),
      });
    },
    onSuccess: (_, isOnline) => {
      toast({
        title: isOnline ? "You are now online" : "You are now offline",
        description: isOnline 
          ? "You can now receive ride requests" 
          : "You will not receive new ride requests",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      setIsUpdatingStatus(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsUpdatingStatus(false);
    },
  });

  const sendLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    const location: DriverLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
      accuracy: position.coords.accuracy,
    };
    
    setDriverLocation(location);
    
    const accuracy = position.coords.accuracy;
    let signalStrength: GpsStatus["signalStrength"] = "strong";
    if (accuracy > 100) signalStrength = "weak";
    else if (accuracy > 50) signalStrength = "medium";
    
    setGpsStatus({
      isAvailable: true,
      signalStrength,
      error: null,
    });

    if (enableLocationBroadcast) {
      try {
        await apiRequest("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(location),
        });
      } catch (error) {
        console.error("Failed to update location:", error);
      }
    }
  }, [enableLocationBroadcast]);

  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    console.error("Location error:", error);
    setGpsStatus({
      isAvailable: false,
      signalStrength: "none",
      error: error.message,
    });
  }, []);

  useEffect(() => {
    const vehicle = (driverData as any)?.vehicle;
    const isOnline = vehicle?.isOnline;

    if (isOnline && !locationWatchId && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        sendLocationUpdate,
        handleLocationError,
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: locationUpdateInterval 
        }
      );
      setLocationWatchId(watchId);
    } else if (!isOnline && locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }

    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [(driverData as any)?.vehicle?.isOnline, locationWatchId, sendLocationUpdate, handleLocationError, locationUpdateInterval]);

  const toggleOnlineStatus = useCallback(() => {
    const vehicle = (driverData as any)?.vehicle;
    const newStatus = !vehicle?.isOnline;
    setIsUpdatingStatus(true);
    toggleStatusMutation.mutate(newStatus);
  }, [driverData, toggleStatusMutation]);

  const profile = (driverData as any)?.profile;
  const vehicle = (driverData as any)?.vehicle;
  const stats = (driverData as any)?.stats;
  const wallet = (driverData as any)?.wallet;

  return {
    isOnline: !!vehicle?.isOnline,
    isUpdatingStatus,
    isLoading,
    isVerified: !!profile?.isVerified,
    hasVehicle: !!vehicle,
    toggleOnlineStatus,
    driverLocation,
    gpsStatus,
    profile,
    vehicle,
    stats,
    wallet,
  };
}
