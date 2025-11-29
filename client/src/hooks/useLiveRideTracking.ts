import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface DriverLocation {
  lat: number;
  lng: number;
  headingDeg: number | null;
  speedMps: number | null;
  accuracy: number | null;
  updatedAt: string | null;
}

export interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string | null;
  rating: number | null;
  photoUrl: string | null;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
}

export interface LiveTrackingData {
  rideId: string;
  status: string;
  currentLeg: string | null;
  isActive: boolean;
  driverInfo: DriverInfo | null;
  driverLocation: DriverLocation | null;
  pickupLocation: LocationPoint | null;
  dropoffLocation: LocationPoint | null;
  routePolyline: string | null;
  etaSecondsToPickup: number | null;
  etaSecondsToDropoff: number | null;
  distanceMetersToPickup: number | null;
  distanceMetersToDropoff: number | null;
  timestamps: {
    acceptedAt: string | null;
    arrivedAt: string | null;
    tripStartedAt: string | null;
  };
  message?: string;
}

export interface UseLiveRideTrackingResult {
  data: LiveTrackingData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  
  driverPosition: { lat: number; lng: number } | null;
  driverHeading: number;
  speedMph: number;
  etaMinutes: number;
  remainingDistanceMiles: number;
  isPickedUp: boolean;
}

interface UseLiveRideTrackingOptions {
  rideId: string | null;
  enabled?: boolean;
  pollingIntervalMs?: number;
  onStatusChange?: (newStatus: string, oldStatus: string | null) => void;
}

function mpsToMph(mps: number | null): number {
  if (mps === null || mps <= 0) return 0;
  return Math.round(mps * 2.237);
}

function metersToMiles(meters: number | null): number {
  if (meters === null || meters <= 0) return 0;
  return meters * 0.000621371;
}

function secondsToMinutes(seconds: number | null): number {
  if (seconds === null || seconds <= 0) return 0;
  return Math.ceil(seconds / 60);
}

export function useLiveRideTracking({
  rideId,
  enabled = true,
  pollingIntervalMs = 3000,
  onStatusChange,
}: UseLiveRideTrackingOptions): UseLiveRideTrackingResult {
  const [data, setData] = useState<LiveTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const previousStatusRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchTrackingData = useCallback(async () => {
    if (!rideId) return;
    
    try {
      const response = await apiRequest(`/api/rides/${rideId}/live-tracking`, "GET");
      
      if (!isMountedRef.current) return;
      
      setData(response as LiveTrackingData);
      setError(null);
      setLastUpdated(new Date());
      setIsLoading(false);
      
      const newStatus = (response as LiveTrackingData).status;
      if (previousStatusRef.current !== null && previousStatusRef.current !== newStatus) {
        onStatusChange?.(newStatus, previousStatusRef.current);
      }
      previousStatusRef.current = newStatus;
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      console.error("[useLiveRideTracking] Fetch error:", err);
      setError(err.message || "Failed to fetch tracking data");
      setIsLoading(false);
    }
  }, [rideId, onStatusChange]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchTrackingData();
  }, [fetchTrackingData]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!rideId || !enabled) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    fetchTrackingData();

    pollingIntervalRef.current = setInterval(fetchTrackingData, pollingIntervalMs);

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [rideId, enabled, pollingIntervalMs, fetchTrackingData]);

  const driverPosition = useMemo(() => {
    if (!data?.driverLocation) return null;
    return {
      lat: data.driverLocation.lat,
      lng: data.driverLocation.lng,
    };
  }, [data?.driverLocation]);

  const driverHeading = useMemo(() => {
    return data?.driverLocation?.headingDeg ?? 0;
  }, [data?.driverLocation?.headingDeg]);

  const speedMph = useMemo(() => {
    return mpsToMph(data?.driverLocation?.speedMps ?? null);
  }, [data?.driverLocation?.speedMps]);

  const isPickedUp = useMemo(() => {
    return data?.status === "in_progress";
  }, [data?.status]);

  const etaMinutes = useMemo(() => {
    if (isPickedUp) {
      return secondsToMinutes(data?.etaSecondsToDropoff ?? null);
    }
    return secondsToMinutes(data?.etaSecondsToPickup ?? null);
  }, [data?.etaSecondsToPickup, data?.etaSecondsToDropoff, isPickedUp]);

  const remainingDistanceMiles = useMemo(() => {
    if (isPickedUp) {
      return metersToMiles(data?.distanceMetersToDropoff ?? null);
    }
    return metersToMiles(data?.distanceMetersToPickup ?? null);
  }, [data?.distanceMetersToPickup, data?.distanceMetersToDropoff, isPickedUp]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refetch,
    driverPosition,
    driverHeading,
    speedMph,
    etaMinutes,
    remainingDistanceMiles,
    isPickedUp,
  };
}

export function interpolateHeading(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

export function interpolatePosition(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  t: number
): { lat: number; lng: number } {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

export default useLiveRideTracking;
