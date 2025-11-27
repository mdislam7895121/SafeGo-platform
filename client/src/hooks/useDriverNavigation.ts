import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  NavigationProvider,
  NavigationPreferences,
  DEFAULT_NAVIGATION_PREFERENCES,
  loadNavigationPreferences,
  saveNavigationPreferences,
  buildTripNavigationUrl,
  isExternalProvider,
  NAVIGATION_PROVIDERS,
  type NavigationCoordinates,
} from "@/lib/navigationProviders";

export interface ActiveTripInfo {
  id: string;
  status: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}

export interface DriverPosition {
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
  timestamp?: number;
}

interface UseDriverNavigationOptions {
  activeTrip?: ActiveTripInfo | null;
  driverPosition?: DriverPosition | null;
}

interface UseDriverNavigationReturn {
  preferences: NavigationPreferences;
  providers: typeof NAVIGATION_PROVIDERS;
  currentProvider: NavigationProvider;
  showTraffic: boolean;
  autoRecalculate: boolean;
  setPreference: <K extends keyof NavigationPreferences>(
    key: K,
    value: NavigationPreferences[K]
  ) => void;
  openInPrimaryMap: () => Promise<void>;
  openInExternalMap: (provider: NavigationProvider) => Promise<void>;
  toggleTrafficLayer: () => void;
  recenterOnDriver: () => void;
  logNavigationEvent: (provider: NavigationProvider, tripId?: string) => Promise<void>;
  isHeadingToPickup: boolean;
  targetCoordinates: { lat: number; lng: number } | null;
}

function triggerHapticFeedback(type: "light" | "medium" | "heavy" = "medium") {
  if (navigator.vibrate) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
}

export function useDriverNavigation({
  activeTrip,
  driverPosition,
}: UseDriverNavigationOptions = {}): UseDriverNavigationReturn {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [localPreferences, setLocalPreferences] = useState<NavigationPreferences>(
    loadNavigationPreferences()
  );
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const { data: serverPreferences } = useQuery<{ preferredNavigationApp?: string }>({
    queryKey: ["/api/driver/preferences"],
  });

  const updateNavigationMutation = useMutation({
    mutationFn: async (preferredNavigationApp: string) => {
      return apiRequest("/api/driver/preferences/navigation", {
        method: "PATCH",
        body: JSON.stringify({ preferredNavigationApp }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
    },
    onError: (error: any) => {
      console.warn("Failed to sync navigation preference to server:", error);
    },
  });

  const preferences = useMemo((): NavigationPreferences => {
    const serverNav = serverPreferences?.preferredNavigationApp;
    const primaryProvider = serverNav
      ? (serverNav as NavigationProvider)
      : localPreferences.primaryProvider;
    return {
      ...localPreferences,
      primaryProvider,
    };
  }, [serverPreferences, localPreferences]);

  const setPreference = useCallback(
    <K extends keyof NavigationPreferences>(key: K, value: NavigationPreferences[K]) => {
      setLocalPreferences((prev) => {
        const updated = { ...prev, [key]: value };
        saveNavigationPreferences({ [key]: value });
        return updated;
      });
      if (key === "primaryProvider") {
        updateNavigationMutation.mutate(value as string);
      }
    },
    [updateNavigationMutation]
  );

  const isHeadingToPickup = useMemo(() => {
    if (!activeTrip) return true;
    return ["accepted", "arriving"].includes(activeTrip.status);
  }, [activeTrip]);

  const targetCoordinates = useMemo(() => {
    if (!activeTrip) return null;
    const lat = isHeadingToPickup ? activeTrip.pickupLat : activeTrip.dropoffLat;
    const lng = isHeadingToPickup ? activeTrip.pickupLng : activeTrip.dropoffLng;
    if (lat && lng) return { lat, lng };
    return null;
  }, [activeTrip, isHeadingToPickup]);

  const logNavigationEvent = useCallback(
    async (provider: NavigationProvider, tripId?: string) => {
      try {
        await apiRequest("/api/driver/trips/log-navigation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId: tripId || activeTrip?.id,
            navigationApp: provider,
          }),
        });
      } catch (err) {
        console.warn("Failed to log navigation event:", err);
      }
    },
    [activeTrip?.id]
  );

  const openInPrimaryMap = useCallback(async () => {
    const provider = preferences.primaryProvider;

    if (provider === NavigationProvider.SAFEGO) {
      if (activeTrip) {
        await logNavigationEvent(NavigationProvider.SAFEGO, activeTrip.id);
        setLocation(`/driver/map?tripId=${activeTrip.id}`);
      } else {
        setLocation("/driver/map");
      }
      triggerHapticFeedback("light");
      return;
    }

    if (!activeTrip) {
      toast({
        title: "No active trip",
        description: "Navigation requires an active trip",
        variant: "destructive",
      });
      return;
    }

    const coordinates: NavigationCoordinates = {
      pickupLat: activeTrip.pickupLat,
      pickupLng: activeTrip.pickupLng,
      dropoffLat: activeTrip.dropoffLat,
      dropoffLng: activeTrip.dropoffLng,
      currentLat: driverPosition?.lat,
      currentLng: driverPosition?.lng,
    };

    const url = buildTripNavigationUrl(provider, coordinates, isHeadingToPickup, activeTrip.id);

    if (url) {
      await logNavigationEvent(provider, activeTrip.id);
      window.open(url, "_blank");
      triggerHapticFeedback("light");
    } else {
      toast({
        title: "Location unavailable",
        description: "Cannot open navigation - coordinates not available",
        variant: "destructive",
      });
    }
  }, [preferences.primaryProvider, activeTrip, driverPosition, isHeadingToPickup, toast, setLocation, logNavigationEvent]);

  const openInExternalMap = useCallback(
    async (provider: NavigationProvider) => {
      if (!isExternalProvider(provider)) {
        if (activeTrip) {
          await logNavigationEvent(NavigationProvider.SAFEGO, activeTrip.id);
          setLocation(`/driver/map?tripId=${activeTrip.id}`);
        } else {
          setLocation("/driver/map");
        }
        return;
      }

      if (!activeTrip) {
        toast({
          title: "No active trip",
          description: "External navigation requires an active trip",
          variant: "destructive",
        });
        return;
      }

      const coordinates: NavigationCoordinates = {
        pickupLat: activeTrip.pickupLat,
        pickupLng: activeTrip.pickupLng,
        dropoffLat: activeTrip.dropoffLat,
        dropoffLng: activeTrip.dropoffLng,
        currentLat: driverPosition?.lat,
        currentLng: driverPosition?.lng,
      };

      const url = buildTripNavigationUrl(provider, coordinates, isHeadingToPickup, activeTrip.id);

      if (url) {
        await logNavigationEvent(provider, activeTrip.id);
        window.open(url, "_blank");
        triggerHapticFeedback("light");
      } else {
        toast({
          title: "Location unavailable",
          description: "Cannot open navigation - coordinates not available",
          variant: "destructive",
        });
      }
    },
    [activeTrip, driverPosition, isHeadingToPickup, toast, setLocation, logNavigationEvent]
  );

  const toggleTrafficLayer = useCallback(() => {
    setPreference("showTrafficByDefault", !preferences.showTrafficByDefault);
    triggerHapticFeedback("light");
    toast({
      title: preferences.showTrafficByDefault ? "Traffic layer hidden" : "Traffic layer shown",
      description: "Your preference has been saved",
    });
  }, [preferences.showTrafficByDefault, setPreference, toast]);

  const recenterOnDriver = useCallback(() => {
    setRecenterTrigger((prev) => prev + 1);
    triggerHapticFeedback("light");
  }, []);

  return {
    preferences,
    providers: NAVIGATION_PROVIDERS,
    currentProvider: preferences.primaryProvider,
    showTraffic: preferences.showTrafficByDefault,
    autoRecalculate: preferences.autoRouteRecalculation,
    setPreference,
    openInPrimaryMap,
    openInExternalMap,
    toggleTrafficLayer,
    recenterOnDriver,
    logNavigationEvent,
    isHeadingToPickup,
    targetCoordinates,
  };
}

export default useDriverNavigation;
