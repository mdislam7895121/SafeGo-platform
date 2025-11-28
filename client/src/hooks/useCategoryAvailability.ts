/**
 * useCategoryAvailability Hook
 * 
 * C3 - Driver Availability for Vehicle Categories
 * Provides real-time driver availability status for each vehicle category
 * based on pickup location. Used to show availability indicators in the
 * rider options screen.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { type VehicleCategoryId, VEHICLE_CATEGORY_ORDER } from "@shared/vehicleCategories";

export type CategoryAvailabilityStatus = "available" | "limited" | "unavailable";

export interface CategoryAvailability {
  categoryId: VehicleCategoryId;
  status: CategoryAvailabilityStatus;
  driversNearby: number;
  etaMinutesOffset: number;
  reason?: string;
  lastUpdated: Date;
}

export interface UseCategoryAvailabilityOptions {
  pickupLat: number | null;
  pickupLng: number | null;
  enabled?: boolean;
  refreshIntervalMs?: number;
}

export interface UseCategoryAvailabilityResult {
  availability: Map<VehicleCategoryId, CategoryAvailability>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  getAvailability: (categoryId: VehicleCategoryId) => CategoryAvailability | undefined;
  isAvailable: (categoryId: VehicleCategoryId) => boolean;
  isLimited: (categoryId: VehicleCategoryId) => boolean;
  isUnavailable: (categoryId: VehicleCategoryId) => boolean;
}

function generateMockAvailability(): Map<VehicleCategoryId, CategoryAvailability> {
  const availability = new Map<VehicleCategoryId, CategoryAvailability>();
  
  const statusWeights: Record<CategoryAvailabilityStatus, number> = {
    available: 0.7,
    limited: 0.2,
    unavailable: 0.1,
  };
  
  const categoryAvailabilityBias: Partial<Record<VehicleCategoryId, number>> = {
    SAFEGO_X: 0.95,
    SAFEGO_COMFORT: 0.85,
    SAFEGO_COMFORT_XL: 0.75,
    SAFEGO_XL: 0.65,
    SAFEGO_BLACK: 0.55,
    SAFEGO_BLACK_SUV: 0.45,
    SAFEGO_WAV: 0.40,
  };

  for (const categoryId of VEHICLE_CATEGORY_ORDER) {
    const bias = categoryAvailabilityBias[categoryId] ?? 0.6;
    const rand = Math.random();
    
    let status: CategoryAvailabilityStatus;
    let driversNearby: number;
    let reason: string | undefined;
    
    if (rand < bias * statusWeights.available) {
      status = "available";
      driversNearby = Math.floor(Math.random() * 10) + 3;
    } else if (rand < bias * (statusWeights.available + statusWeights.limited)) {
      status = "limited";
      driversNearby = Math.floor(Math.random() * 2) + 1;
      reason = "High demand in your area";
    } else {
      status = "unavailable";
      driversNearby = 0;
      
      const reasons = [
        "No drivers nearby",
        "Service not available in this area",
        "Try again in a few minutes",
      ];
      reason = reasons[Math.floor(Math.random() * reasons.length)];
    }
    
    if (categoryId === "SAFEGO_WAV" && Math.random() < 0.3) {
      status = "limited";
      driversNearby = 1;
      reason = "WAV vehicles in high demand";
    }

    availability.set(categoryId, {
      categoryId,
      status,
      driversNearby,
      etaMinutesOffset: status === "limited" ? 3 : 0,
      reason,
      lastUpdated: new Date(),
    });
  }
  
  return availability;
}

export function useCategoryAvailability({
  pickupLat,
  pickupLng,
  enabled = true,
  refreshIntervalMs = 30000,
}: UseCategoryAvailabilityOptions): UseCategoryAvailabilityResult {
  const [availability, setAvailability] = useState<Map<VehicleCategoryId, CategoryAvailability>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!pickupLat || !pickupLng || !enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const mockData = generateMockAvailability();
      setAvailability(mockData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch availability"));
    } finally {
      setIsLoading(false);
    }
  }, [pickupLat, pickupLng, enabled]);

  useEffect(() => {
    if (enabled && pickupLat && pickupLng) {
      fetchAvailability();
    }
  }, [enabled, pickupLat, pickupLng, fetchAvailability]);

  useEffect(() => {
    if (!enabled || !pickupLat || !pickupLng) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchAvailability();
    }, refreshIntervalMs);

    return () => clearInterval(intervalId);
  }, [enabled, pickupLat, pickupLng, refreshIntervalMs, fetchAvailability]);

  const getAvailability = useCallback(
    (categoryId: VehicleCategoryId): CategoryAvailability | undefined => {
      return availability.get(categoryId);
    },
    [availability]
  );

  const isAvailable = useCallback(
    (categoryId: VehicleCategoryId): boolean => {
      const info = availability.get(categoryId);
      return info?.status === "available";
    },
    [availability]
  );

  const isLimited = useCallback(
    (categoryId: VehicleCategoryId): boolean => {
      const info = availability.get(categoryId);
      return info?.status === "limited";
    },
    [availability]
  );

  const isUnavailable = useCallback(
    (categoryId: VehicleCategoryId): boolean => {
      const info = availability.get(categoryId);
      return info?.status === "unavailable";
    },
    [availability]
  );

  return useMemo(
    () => ({
      availability,
      isLoading,
      error,
      refresh: fetchAvailability,
      getAvailability,
      isAvailable,
      isLimited,
      isUnavailable,
    }),
    [availability, isLoading, error, fetchAvailability, getAvailability, isAvailable, isLimited, isUnavailable]
  );
}
