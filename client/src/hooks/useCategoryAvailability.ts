/**
 * useCategoryAvailability Hook
 * 
 * C3/C5 - Driver Availability and ETA for Vehicle Categories
 * Provides real-time driver availability status and pickup ETA for each 
 * vehicle category based on pickup location. Used to show availability 
 * indicators and ETA in the rider options screen.
 * 
 * ETA Calculation (C5):
 * - 10+ drivers → 2 min
 * - 5-9 drivers → 5 min
 * - 1-4 drivers → 8 min
 * - 0 drivers → null (No drivers nearby)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { type VehicleCategoryId, VEHICLE_CATEGORY_ORDER } from "@shared/vehicleCategories";
import { apiRequest } from "@/lib/queryClient";

export type CategoryAvailabilityStatus = "available" | "limited" | "unavailable";
export type AvailabilityLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface CategoryAvailability {
  categoryId: VehicleCategoryId;
  status: CategoryAvailabilityStatus;
  driversNearby: number;
  etaMinutes: number | null;
  etaText: string;
  availabilityLevel: AvailabilityLevel;
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
  getETA: (categoryId: VehicleCategoryId) => { etaMinutes: number | null; etaText: string } | undefined;
  isAvailable: (categoryId: VehicleCategoryId) => boolean;
  isLimited: (categoryId: VehicleCategoryId) => boolean;
  isUnavailable: (categoryId: VehicleCategoryId) => boolean;
}

interface APIAvailabilityResponse {
  categories: Array<{
    categoryId: VehicleCategoryId;
    driverCount: number;
    etaMinutes: number | null;
    etaText: string;
    availabilityLevel: AvailabilityLevel;
    isAvailable: boolean;
    displayName: string;
    description: string;
    seatCount: number;
    iconType: string;
    sortOrder: number;
  }>;
  totalNearbyDrivers: number;
  timestamp: string;
  pickupLocation?: { lat: number; lng: number };
}

function mapAvailabilityLevelToStatus(level: AvailabilityLevel): CategoryAvailabilityStatus {
  switch (level) {
    case "HIGH":
      return "available";
    case "MEDIUM":
    case "LOW":
      return "limited";
    case "NONE":
    default:
      return "unavailable";
  }
}

function generateMockAvailability(): Map<VehicleCategoryId, CategoryAvailability> {
  const availability = new Map<VehicleCategoryId, CategoryAvailability>();
  
  const mockCounts: Record<VehicleCategoryId, number> = {
    SAFEGO_X: 15,
    SAFEGO_COMFORT: 8,
    SAFEGO_COMFORT_XL: 4,
    SAFEGO_XL: 6,
    SAFEGO_BLACK: 3,
    SAFEGO_BLACK_SUV: 2,
    SAFEGO_WAV: 1,
  };

  for (const categoryId of VEHICLE_CATEGORY_ORDER) {
    const driverCount = mockCounts[categoryId];
    const etaMinutes = driverCount >= 10 ? 2 : driverCount >= 5 ? 5 : driverCount >= 1 ? 8 : null;
    const etaText = etaMinutes === null ? "No drivers nearby" : `${etaMinutes} min away`;
    const availabilityLevel: AvailabilityLevel = driverCount >= 10 ? "HIGH" : driverCount >= 5 ? "MEDIUM" : driverCount >= 1 ? "LOW" : "NONE";
    const status = mapAvailabilityLevelToStatus(availabilityLevel);

    availability.set(categoryId, {
      categoryId,
      status,
      driversNearby: driverCount,
      etaMinutes,
      etaText,
      availabilityLevel,
      reason: status === "unavailable" ? "No drivers nearby" : status === "limited" ? "Limited drivers in your area" : undefined,
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
      const response = await apiRequest<APIAvailabilityResponse>(
        `/api/customer/ride-options/availability?pickupLat=${pickupLat}&pickupLng=${pickupLng}`
      );

      const newAvailability = new Map<VehicleCategoryId, CategoryAvailability>();
      
      for (const cat of response.categories) {
        const status = mapAvailabilityLevelToStatus(cat.availabilityLevel);
        newAvailability.set(cat.categoryId, {
          categoryId: cat.categoryId,
          status,
          driversNearby: cat.driverCount,
          etaMinutes: cat.etaMinutes,
          etaText: cat.etaText,
          availabilityLevel: cat.availabilityLevel,
          reason: status === "unavailable" 
            ? "No drivers nearby" 
            : status === "limited" 
              ? "Limited drivers in your area" 
              : undefined,
          lastUpdated: new Date(response.timestamp),
        });
      }
      
      setAvailability(newAvailability);
    } catch (err) {
      console.error("[useCategoryAvailability] API error, using mock data:", err);
      const mockData = generateMockAvailability();
      setAvailability(mockData);
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
      return info?.availabilityLevel === "LOW";
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

  const getETA = useCallback(
    (categoryId: VehicleCategoryId): { etaMinutes: number | null; etaText: string } | undefined => {
      const info = availability.get(categoryId);
      if (!info) return undefined;
      return { etaMinutes: info.etaMinutes, etaText: info.etaText };
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
      getETA,
      isAvailable,
      isLimited,
      isUnavailable,
    }),
    [availability, isLoading, error, fetchAvailability, getAvailability, getETA, isAvailable, isLimited, isUnavailable]
  );
}
