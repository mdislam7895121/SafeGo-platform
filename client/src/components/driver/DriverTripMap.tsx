import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Navigation,
  ExternalLink,
  MapPin,
  Layers,
  Crosshair,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SafeGoMap, type ActiveLeg, type MapLocation } from "@/components/maps/SafeGoMap";
import { useDriverNavigation } from "@/hooks/useDriverNavigation";
import {
  NavigationProvider,
  NAVIGATION_PROVIDERS,
} from "@/lib/navigationProviders";

export interface DriverTripMapProps {
  tripId: string;
  tripStatus: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  dropoffAddress: string;
  driverLat?: number | null;
  driverLng?: number | null;
  driverHeading?: number;
  onDistanceCalculated?: (distanceKm: number, etaMinutes: number) => void;
  showNavigationControls?: boolean;
  showFullscreenButton?: boolean;
  className?: string;
}

function triggerHapticFeedback(type: "light" | "medium" | "heavy" = "medium") {
  if (navigator.vibrate) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
}

export function DriverTripMap({
  tripId,
  tripStatus,
  pickupLat,
  pickupLng,
  pickupAddress,
  dropoffLat,
  dropoffLng,
  dropoffAddress,
  driverLat,
  driverLng,
  driverHeading,
  onDistanceCalculated,
  showNavigationControls = true,
  showFullscreenButton = true,
  className = "",
}: DriverTripMapProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [autoFollow, setAutoFollow] = useState(true);

  const {
    preferences,
    providers,
    currentProvider,
    openInExternalMap,
    logNavigationEvent,
  } = useDriverNavigation({
    activeTrip: {
      id: tripId,
      status: tripStatus,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
    },
    driverPosition: driverLat && driverLng ? { lat: driverLat, lng: driverLng } : null,
  });

  const activeLeg = useMemo((): ActiveLeg => {
    if (["accepted", "arriving"].includes(tripStatus)) return "to_pickup";
    if (["arrived", "started", "in_progress", "picked_up"].includes(tripStatus))
      return "to_dropoff";
    return "completed";
  }, [tripStatus]);

  const driverLocation = useMemo((): MapLocation | null => {
    if (!driverLat || !driverLng) return null;
    return { lat: driverLat, lng: driverLng, heading: driverHeading };
  }, [driverLat, driverLng, driverHeading]);

  const pickupLocation = useMemo((): MapLocation | null => {
    if (!pickupLat || !pickupLng) return null;
    return { lat: pickupLat, lng: pickupLng, label: pickupAddress };
  }, [pickupLat, pickupLng, pickupAddress]);

  const dropoffLocation = useMemo((): MapLocation | null => {
    if (!dropoffLat || !dropoffLng) return null;
    return { lat: dropoffLat, lng: dropoffLng, label: dropoffAddress };
  }, [dropoffLat, dropoffLng, dropoffAddress]);

  const mapCenter = useMemo((): MapLocation => {
    if (driverLocation) return driverLocation;
    if (pickupLocation) return pickupLocation;
    return { lat: 40.7128, lng: -74.006 };
  }, [driverLocation, pickupLocation]);

  const handleRecenter = useCallback(() => {
    setAutoFollow(true);
    triggerHapticFeedback("light");
  }, []);

  const handleOpenFullscreen = useCallback(async () => {
    await logNavigationEvent(NavigationProvider.SAFEGO, tripId);
    setLocation(`/driver/map?tripId=${tripId}`);
    triggerHapticFeedback("light");
  }, [tripId, setLocation, logNavigationEvent]);

  const handleProviderSelect = useCallback(
    async (provider: NavigationProvider) => {
      if (provider === NavigationProvider.SAFEGO) {
        await handleOpenFullscreen();
        return;
      }
      await openInExternalMap(provider);
    },
    [handleOpenFullscreen, openInExternalMap]
  );

  return (
    <div className={`relative ${className}`} data-testid="driver-trip-map">
      <SafeGoMap
        center={mapCenter}
        zoom={15}
        driverLocation={driverLocation}
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
        activeLeg={activeLeg}
        showControls={false}
        autoFollow={autoFollow}
        showEtaOverlay={activeLeg !== "completed"}
        showTrafficToggle={false}
        onDistanceCalculated={onDistanceCalculated}
        className="h-full w-full"
      />

      {showNavigationControls && (
        <div className="absolute bottom-3 right-3 z-[1000] flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full shadow-md bg-background/95 backdrop-blur-sm"
            onClick={handleRecenter}
            data-testid="button-map-recenter"
          >
            <Crosshair className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-10 w-10 rounded-full shadow-md bg-background/95 backdrop-blur-sm"
                data-testid="button-map-navigate"
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Open in...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {providers.map((provider) => (
                <DropdownMenuItem
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider.id)}
                  className="flex items-center justify-between"
                  data-testid={`nav-provider-${provider.id}`}
                >
                  <div className="flex items-center gap-2">
                    {provider.isExternal ? (
                      <ExternalLink className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    <span className="text-sm">{provider.name}</span>
                  </div>
                  {currentProvider === provider.id && (
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      Default
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {showFullscreenButton && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-3 right-14 z-[1000] shadow-md bg-background/95 backdrop-blur-sm"
          onClick={handleOpenFullscreen}
          data-testid="button-map-fullscreen"
        >
          <Route className="h-4 w-4 mr-1.5" />
          <span className="text-xs">Full Map</span>
        </Button>
      )}
    </div>
  );
}

export default DriverTripMap;
