import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { FoodOrderStatus } from "@shared/foodOrderStatus";

export interface DriverLocation {
  lat: number | null;
  lng: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  updatedAt: string | null;
}

export interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string | null;
  rating: number | null;
  photoUrl: string | null;
  vehicle: {
    make: string;
    model: string;
    color: string;
    plate: string;
  } | null;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  address: string;
  cuisineType: string | null;
  logoUrl: string | null;
  location: { lat: number; lng: number } | null;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface FoodTrackingData {
  orderId: string;
  orderCode: string | null;
  status: FoodOrderStatus;
  isActive: boolean;
  restaurant: RestaurantInfo;
  deliveryLocation: {
    address: string;
    lat: number | null;
    lng: number | null;
  };
  driver: DriverInfo | null;
  driverLocation: DriverLocation | null;
  etaToRestaurantSeconds: number | null;
  etaToCustomerSeconds: number | null;
  distanceToRestaurantMeters: number | null;
  distanceToCustomerMeters: number | null;
  items: OrderItem[];
  itemsCount: number | null;
  subtotal: string | null;
  deliveryFee: string | null;
  serviceFare: string;
  paymentMethod: string;
  timestamps: {
    placedAt: string;
    acceptedAt: string | null;
    preparingAt: string | null;
    readyAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
  };
  cancellation: {
    cancelledBy: string | null;
    reason: string | null;
  } | null;
}

export interface UseLiveFoodTrackingResult {
  data: FoodTrackingData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  
  driverPosition: { lat: number; lng: number } | null;
  driverHeading: number;
  speedMph: number;
  etaMinutes: number;
  remainingDistanceMiles: number;
  isDeliveryPhase: boolean;
  isOrderPickedUp: boolean;
}

interface UseLiveFoodTrackingOptions {
  orderId: string | null;
  enabled?: boolean;
  pollingIntervalMs?: number;
  onStatusChange?: (newStatus: FoodOrderStatus, oldStatus: FoodOrderStatus | null) => void;
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

export function useLiveFoodTracking({
  orderId,
  enabled = true,
  pollingIntervalMs = 5000,
  onStatusChange,
}: UseLiveFoodTrackingOptions): UseLiveFoodTrackingResult {
  const [data, setData] = useState<FoodTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const previousStatusRef = useRef<FoodOrderStatus | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchTrackingData = useCallback(async () => {
    if (!orderId) return;
    
    try {
      const response = await apiRequest(`/api/food-orders/${orderId}/live-tracking`, { method: "GET" });
      
      if (!isMountedRef.current) return;
      
      setData(response as FoodTrackingData);
      setError(null);
      setLastUpdated(new Date());
      setIsLoading(false);
      
      const newStatus = (response as FoodTrackingData).status;
      if (previousStatusRef.current !== null && previousStatusRef.current !== newStatus) {
        onStatusChange?.(newStatus, previousStatusRef.current);
      }
      previousStatusRef.current = newStatus;
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      console.error("[useLiveFoodTracking] Fetch error:", err);
      setError(err.message || "Failed to fetch tracking data");
      setIsLoading(false);
    }
  }, [orderId, onStatusChange]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchTrackingData();
  }, [fetchTrackingData]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!orderId || !enabled) {
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
  }, [orderId, enabled, pollingIntervalMs, fetchTrackingData]);

  const driverPosition = useMemo(() => {
    if (!data?.driverLocation?.lat || !data?.driverLocation?.lng) return null;
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

  const isDeliveryPhase = useMemo(() => {
    const deliveryStatuses = ["driver_assigned", "driver_arriving", "picked_up", "on_the_way"];
    return deliveryStatuses.includes(data?.status || "");
  }, [data?.status]);

  const isOrderPickedUp = useMemo(() => {
    return data?.status === "picked_up" || data?.status === "on_the_way";
  }, [data?.status]);

  const etaMinutes = useMemo(() => {
    if (isOrderPickedUp) {
      return secondsToMinutes(data?.etaToCustomerSeconds ?? null);
    }
    return secondsToMinutes(data?.etaToRestaurantSeconds ?? null);
  }, [data?.etaToRestaurantSeconds, data?.etaToCustomerSeconds, isOrderPickedUp]);

  const remainingDistanceMiles = useMemo(() => {
    if (isOrderPickedUp) {
      return metersToMiles(data?.distanceToCustomerMeters ?? null);
    }
    return metersToMiles(data?.distanceToRestaurantMeters ?? null);
  }, [data?.distanceToRestaurantMeters, data?.distanceToCustomerMeters, isOrderPickedUp]);

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
    isDeliveryPhase,
    isOrderPickedUp,
  };
}

export default useLiveFoodTracking;
