import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";

export type TrafficCondition = "light" | "moderate" | "heavy";
export type EtaSource = "traffic" | "simulated" | "demo";

export interface TrafficEtaData {
  pickupEtaMinutes: number;
  distanceMeters: number;
  distanceMiles: number;
  speedMph: number;
  source: EtaSource;
  lastUpdatedAt: string;
  trafficCondition: TrafficCondition;
}

export interface UseTrafficEtaResult {
  pickupEtaMinutes: number | null;
  distanceMiles: number | null;
  speedMph: number | null;
  trafficCondition: TrafficCondition | null;
  source: EtaSource | null;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  refetch: () => Promise<void>;
  smoothedEtaMinutes: number | null;
}

interface UseTrafficEtaOptions {
  rideId: string | null;
  driverPosition: { lat: number; lng: number } | null;
  pickupLocation: { lat: number; lng: number } | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  demoMode?: boolean;
  forceTrafficCondition?: TrafficCondition;
}

const ETA_SMOOTHING_FACTOR = 0.3;
const MIN_UPDATE_INTERVAL_MS = 5000;
const DEMO_UPDATE_INTERVAL_MS = 8000;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateDemoEta(
  driverLat: number,
  driverLng: number,
  pickupLat: number,
  pickupLng: number
): TrafficEtaData {
  const distance = haversineDistance(driverLat, driverLng, pickupLat, pickupLng);
  const roadDistance = distance * 1.3;
  
  const hour = new Date().getHours();
  let trafficCondition: TrafficCondition;
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    trafficCondition = Math.random() > 0.3 ? "heavy" : "moderate";
  } else if (hour >= 22 || hour <= 5) {
    trafficCondition = Math.random() > 0.7 ? "moderate" : "light";
  } else {
    const rand = Math.random();
    trafficCondition = rand < 0.4 ? "light" : rand < 0.8 ? "moderate" : "heavy";
  }
  
  const speeds: Record<TrafficCondition, number> = {
    light: 800,
    moderate: 533,
    heavy: 267,
  };
  
  const baseSpeed = speeds[trafficCondition];
  const variance = 0.85 + Math.random() * 0.3;
  const effectiveSpeed = baseSpeed * variance;
  
  const etaMinutes = Math.max(1, Math.ceil(roadDistance / effectiveSpeed));
  const speedMph = Math.round((effectiveSpeed * 60) / 1609.344);
  
  return {
    pickupEtaMinutes: etaMinutes,
    distanceMeters: Math.round(roadDistance),
    distanceMiles: Math.round((roadDistance / 1609.344) * 10) / 10,
    speedMph: Math.min(speedMph, 80),
    source: "demo",
    lastUpdatedAt: new Date().toISOString(),
    trafficCondition,
  };
}

export function useTrafficEta({
  rideId,
  driverPosition,
  pickupLocation,
  enabled = true,
  pollIntervalMs = 15000,
  demoMode = false,
  forceTrafficCondition,
}: UseTrafficEtaOptions): UseTrafficEtaResult {
  const [data, setData] = useState<TrafficEtaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [smoothedEta, setSmoothedEta] = useState<number | null>(null);
  
  const lastFetchRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const smoothedEtaRef = useRef<number | null>(null);
  
  useEffect(() => {
    smoothedEtaRef.current = smoothedEta;
  }, [smoothedEta]);
  
  const hasPositionChanged = useCallback((
    newPos: { lat: number; lng: number } | null
  ): boolean => {
    if (!newPos || !lastPositionRef.current) return true;
    const distance = haversineDistance(
      lastPositionRef.current.lat,
      lastPositionRef.current.lng,
      newPos.lat,
      newPos.lng
    );
    return distance > 10;
  }, []);

  const fetchTrafficEta = useCallback(async (force = false) => {
    if (!rideId || !driverPosition || !pickupLocation) return;
    
    const now = Date.now();
    const minInterval = demoMode ? DEMO_UPDATE_INTERVAL_MS : MIN_UPDATE_INTERVAL_MS;
    
    if (!force && (now - lastFetchRef.current < minInterval)) {
      return;
    }
    
    if (!force && !hasPositionChanged(driverPosition)) {
      return;
    }
    
    lastFetchRef.current = now;
    lastPositionRef.current = driverPosition;
    setIsLoading(true);
    
    try {
      if (demoMode) {
        await new Promise(r => setTimeout(r, 100));
        const demoData = generateDemoEta(
          driverPosition.lat,
          driverPosition.lng,
          pickupLocation.lat,
          pickupLocation.lng
        );
        
        if (forceTrafficCondition) {
          demoData.trafficCondition = forceTrafficCondition;
          const speeds: Record<TrafficCondition, number> = {
            light: 800,
            moderate: 533,
            heavy: 267,
          };
          const distance = haversineDistance(
            driverPosition.lat,
            driverPosition.lng,
            pickupLocation.lat,
            pickupLocation.lng
          ) * 1.3;
          demoData.pickupEtaMinutes = Math.max(1, Math.ceil(distance / speeds[forceTrafficCondition]));
        }
        
        if (!isMountedRef.current) return;
        setData(demoData);
        setError(null);
        setLastUpdatedAt(new Date());
        
        const currentSmoothed = smoothedEtaRef.current;
        if (currentSmoothed === null) {
          setSmoothedEta(demoData.pickupEtaMinutes);
        } else {
          const newSmoothed = Math.round(
            currentSmoothed * (1 - ETA_SMOOTHING_FACTOR) + 
            demoData.pickupEtaMinutes * ETA_SMOOTHING_FACTOR
          );
          setSmoothedEta(Math.max(1, newSmoothed));
        }
      } else {
        const params = new URLSearchParams({
          rideId,
          driverLat: driverPosition.lat.toString(),
          driverLng: driverPosition.lng.toString(),
          pickupLat: pickupLocation.lat.toString(),
          pickupLng: pickupLocation.lng.toString(),
        });
        
        if (forceTrafficCondition) {
          params.set("forceTrafficCondition", forceTrafficCondition);
        }
        
        const response = await apiRequest(`/api/maps/traffic-eta?${params.toString()}`, {
          method: "GET",
        });
        
        if (!isMountedRef.current) return;
        
        if ((response as any).error === "Rate limited") {
          setIsLoading(false);
          return;
        }
        
        const etaData = response as TrafficEtaData;
        setData(etaData);
        setError(null);
        setLastUpdatedAt(new Date());
        
        const currentSmoothedBackend = smoothedEtaRef.current;
        if (currentSmoothedBackend === null) {
          setSmoothedEta(etaData.pickupEtaMinutes);
        } else {
          const newSmoothed = Math.round(
            currentSmoothedBackend * (1 - ETA_SMOOTHING_FACTOR) + 
            etaData.pickupEtaMinutes * ETA_SMOOTHING_FACTOR
          );
          setSmoothedEta(Math.max(1, newSmoothed));
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn("[useTrafficEta] Fetch error:", err);
      setError(err.message || "Failed to fetch ETA");
      
      if (driverPosition && pickupLocation) {
        const fallbackData = generateDemoEta(
          driverPosition.lat,
          driverPosition.lng,
          pickupLocation.lat,
          pickupLocation.lng
        );
        fallbackData.source = "demo";
        setData(fallbackData);
        
        const currentSmoothedFallback = smoothedEtaRef.current;
        if (currentSmoothedFallback === null) {
          setSmoothedEta(fallbackData.pickupEtaMinutes);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [rideId, driverPosition, pickupLocation, demoMode, forceTrafficCondition, hasPositionChanged]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !rideId || !driverPosition || !pickupLocation) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    
    fetchTrafficEta(true);
    
    const interval = demoMode ? DEMO_UPDATE_INTERVAL_MS : pollIntervalMs;
    pollIntervalRef.current = setInterval(() => {
      fetchTrafficEta();
    }, interval);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, rideId, demoMode, pollIntervalMs]);

  useEffect(() => {
    if (enabled && rideId && driverPosition && pickupLocation) {
      fetchTrafficEta();
    }
  }, [driverPosition?.lat, driverPosition?.lng]);

  const refetch = useCallback(async () => {
    lastFetchRef.current = 0;
    await fetchTrafficEta(true);
  }, [fetchTrafficEta]);

  return useMemo(() => ({
    pickupEtaMinutes: data?.pickupEtaMinutes ?? null,
    distanceMiles: data?.distanceMiles ?? null,
    speedMph: data?.speedMph ?? null,
    trafficCondition: data?.trafficCondition ?? null,
    source: data?.source ?? null,
    isLoading,
    error,
    lastUpdatedAt,
    refetch,
    smoothedEtaMinutes: smoothedEta,
  }), [data, isLoading, error, lastUpdatedAt, refetch, smoothedEta]);
}
