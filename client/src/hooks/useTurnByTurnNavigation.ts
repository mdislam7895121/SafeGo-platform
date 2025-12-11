import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NavigationInstruction } from "@/components/driver/TurnByTurnNavigation";

interface NavigationSession {
  id: string;
  tripId: string;
  status: "active" | "paused" | "completed" | "cancelled";
  currentWaypointIndex: number;
  totalDistanceMeters: number;
  remainingDistanceMeters: number;
  estimatedArrivalTime: string;
  routePolyline?: string;
}

interface NavigationWaypoint {
  id: string;
  sessionId: string;
  sequenceOrder: number;
  latitude: number;
  longitude: number;
  instruction: string;
  distanceToNext: number;
  durationToNext: number;
  maneuverType: string;
  streetName?: string;
  isCompleted: boolean;
}

interface UseTurnByTurnNavigationOptions {
  tripId: string | null;
  tripType: "ride" | "food" | "parcel";
  driverLat?: number;
  driverLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  enabled?: boolean;
}

interface UseTurnByTurnNavigationReturn {
  session: NavigationSession | null;
  instructions: NavigationInstruction[];
  currentStepIndex: number;
  totalDistanceRemaining: string;
  etaMinutes: number;
  isLoading: boolean;
  isRerouting: boolean;
  isOffRoute: boolean;
  error: Error | null;
  startNavigation: () => Promise<void>;
  pauseNavigation: () => Promise<void>;
  resumeNavigation: () => Promise<void>;
  endNavigation: () => Promise<void>;
  recalculateRoute: () => Promise<void>;
  advanceToNextStep: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

function parseManeuverType(type: string): NavigationInstruction["maneuverType"] {
  const normalized = type.toLowerCase().replace(/[_-]/g, "");
  if (normalized.includes("left")) {
    return normalized.includes("slight") ? "slight-left" : "turn-left";
  }
  if (normalized.includes("right")) {
    return normalized.includes("slight") ? "slight-right" : "turn-right";
  }
  if (normalized.includes("uturn") || normalized.includes("reverse")) {
    return "u-turn";
  }
  if (normalized.includes("arrive") || normalized.includes("destination")) {
    return "arrive";
  }
  if (normalized.includes("depart") || normalized.includes("start")) {
    return "depart";
  }
  return "straight";
}

export function useTurnByTurnNavigation({
  tripId,
  tripType,
  driverLat,
  driverLng,
  destinationLat,
  destinationLng,
  enabled = true,
}: UseTurnByTurnNavigationOptions): UseTurnByTurnNavigationReturn {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  const { data: sessionData, isLoading: isLoadingSession, error: sessionError } = useQuery<{
    session: NavigationSession;
    waypoints: NavigationWaypoint[];
  }>({
    queryKey: ["/api/phase5/navigation/session", tripId],
    enabled: enabled && !!tripId,
    refetchInterval: 5000,
  });

  const instructions = useMemo((): NavigationInstruction[] => {
    if (!sessionData?.waypoints) return [];

    return sessionData.waypoints.map((wp, index) => ({
      id: wp.id,
      stepNumber: wp.sequenceOrder,
      instruction: wp.instruction,
      distance: formatDistance(wp.distanceToNext),
      distanceMeters: wp.distanceToNext,
      maneuverType: parseManeuverType(wp.maneuverType),
      streetName: wp.streetName,
      isActive: index === currentStepIndex,
      isCompleted: wp.isCompleted || index < currentStepIndex,
    }));
  }, [sessionData?.waypoints, currentStepIndex]);

  const totalDistanceRemaining = useMemo(() => {
    if (!sessionData?.session) return "0 m";
    return formatDistance(sessionData.session.remainingDistanceMeters);
  }, [sessionData?.session]);

  const etaMinutes = useMemo(() => {
    if (!sessionData?.session?.estimatedArrivalTime) return 0;
    const eta = new Date(sessionData.session.estimatedArrivalTime);
    const now = new Date();
    const diffMs = eta.getTime() - now.getTime();
    return Math.max(0, Math.round(diffMs / 60000));
  }, [sessionData?.session?.estimatedArrivalTime]);

  useEffect(() => {
    if (sessionData?.session?.currentWaypointIndex !== undefined) {
      setCurrentStepIndex(sessionData.session.currentWaypointIndex);
    }
  }, [sessionData?.session?.currentWaypointIndex]);

  const startNavigationMutation = useMutation({
    mutationFn: async () => {
      if (!tripId || !driverLat || !driverLng || !destinationLat || !destinationLng) {
        throw new Error("Missing required navigation parameters");
      }
      return apiRequest("/api/phase5/navigation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          tripType,
          originLat: driverLat,
          originLng: driverLng,
          destinationLat,
          destinationLng,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/navigation/session", tripId] });
    },
  });

  const pauseNavigationMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData?.session?.id) throw new Error("No active session");
      return apiRequest(`/api/phase5/navigation/session/${sessionData.session.id}/pause`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/navigation/session", tripId] });
    },
  });

  const resumeNavigationMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData?.session?.id) throw new Error("No active session");
      return apiRequest(`/api/phase5/navigation/session/${sessionData.session.id}/resume`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/navigation/session", tripId] });
    },
  });

  const endNavigationMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData?.session?.id) throw new Error("No active session");
      return apiRequest(`/api/phase5/navigation/session/${sessionData.session.id}/end`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/navigation/session", tripId] });
    },
  });

  const recalculateRouteMutation = useMutation({
    mutationFn: async () => {
      if (!tripId || !driverLat || !driverLng || !destinationLat || !destinationLng) {
        throw new Error("Missing required navigation parameters");
      }
      setIsRerouting(true);
      return apiRequest("/api/phase5/navigation/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionData?.session?.id,
          currentLat: driverLat,
          currentLng: driverLng,
          destinationLat,
          destinationLng,
        }),
      });
    },
    onSuccess: () => {
      setIsRerouting(false);
      setIsOffRoute(false);
      setCurrentStepIndex(0);
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/navigation/session", tripId] });
    },
    onError: () => {
      setIsRerouting(false);
    },
  });

  const advanceToNextStep = useCallback(() => {
    if (currentStepIndex < instructions.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, instructions.length]);

  return {
    session: sessionData?.session || null,
    instructions,
    currentStepIndex,
    totalDistanceRemaining,
    etaMinutes,
    isLoading: isLoadingSession,
    isRerouting,
    isOffRoute,
    error: sessionError as Error | null,
    startNavigation: () => startNavigationMutation.mutateAsync(),
    pauseNavigation: () => pauseNavigationMutation.mutateAsync(),
    resumeNavigation: () => resumeNavigationMutation.mutateAsync(),
    endNavigation: () => endNavigationMutation.mutateAsync(),
    recalculateRoute: () => recalculateRouteMutation.mutateAsync(),
    advanceToNextStep,
  };
}

export default useTurnByTurnNavigation;
