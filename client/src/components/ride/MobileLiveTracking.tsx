import { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Car,
  Clock,
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Star,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Gauge,
  ArrowUp,
  CornerUpRight,
  CornerUpLeft,
  CornerDownRight,
  CornerDownLeft,
} from "lucide-react";
import { getVehicleCategoryImage } from "@/lib/vehicleMedia";
import { VEHICLE_CATEGORIES, type VehicleCategoryId } from "@shared/vehicleCategories";

export interface TurnInstruction {
  text: string;
  distanceFeet: number;
  maneuver: string;
}

export type DriverTrackingStatus = 
  | "DRIVER_ON_THE_WAY" 
  | "DRIVER_ARRIVED" 
  | "ON_TRIP" 
  | "TRIP_COMPLETED"
  | "DRIVER_ASSIGNED"
  | "TRIP_IN_PROGRESS";

export interface DriverInfo {
  id?: string;
  name: string;
  initials: string;
  rating: number;
  vehicleModel: string;
  vehicleColor: string;
  plate: string;
}

function normalizeStatus(status: DriverTrackingStatus): "DRIVER_ON_THE_WAY" | "DRIVER_ARRIVED" | "ON_TRIP" | "TRIP_COMPLETED" {
  switch (status) {
    case "DRIVER_ASSIGNED":
    case "DRIVER_ON_THE_WAY":
      return "DRIVER_ON_THE_WAY";
    case "TRIP_IN_PROGRESS":
    case "ON_TRIP":
      return "ON_TRIP";
    case "DRIVER_ARRIVED":
      return "DRIVER_ARRIVED";
    case "TRIP_COMPLETED":
      return "TRIP_COMPLETED";
    default:
      return "DRIVER_ON_THE_WAY";
  }
}

interface MobileLiveTrackingProps {
  status: DriverTrackingStatus;
  driver: DriverInfo;
  pickupEtaMinutes?: number;
  dropoffEtaMinutes?: number;
  distanceMiles?: number;
  vehicleCategory: VehicleCategoryId;
  driverPosition: { lat: number; lng: number } | null;
  interpolatedPosition?: { lat: number; lng: number } | null;
  driverHeading: number;
  speedMph?: number;
  nextTurn?: TurnInstruction | null;
  pickupLocation: { lat: number; lng: number } | null;
  dropoffLocation: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number } | null;
  routePoints: [number, number][];
  remainingRoutePoints: [number, number][] | null;
  isFollowingDriver: boolean;
  onBack: () => void;
  onCancelRide?: () => void;
  onRecenterDriver: () => void;
  onUserInteraction: () => void;
  isCancelling?: boolean;
}

const customerLocationIcon = L.divIcon({
  className: "customer-location-marker",
  html: `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
    ">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        background: rgba(66, 133, 244, 0.2);
        border-radius: 50%;
        animation: customerPulse 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16px;
        height: 16px;
        background: #4285F4;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 24px; height: 24px; background: #3B82F6; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 24px; height: 24px; background: #EF4444; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function createRotatedDriverIcon(heading: number): L.DivIcon {
  const arrowRotation = heading - 45;
  return L.divIcon({
    className: "driver-marker-pulsing",
    html: `<div style="
      position: relative;
      width: 36px; height: 36px;
    ">
      <div style="
        position: absolute;
        width: 36px; height: 36px; background: #10B981; 
        border: 4px solid white; border-radius: 50%; 
        box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        z-index: 2;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="transform: rotate(${arrowRotation}deg); transition: transform 0.3s ease;">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
        </svg>
      </div>
      <div style="
        position: absolute;
        width: 36px; height: 36px;
        background: rgba(16, 185, 129, 0.3);
        border-radius: 50%;
        animation: pulse 2s ease-out infinite;
        z-index: 1;
      "></div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function MapFollowDriver({
  driverPosition,
  isFollowing,
  onUserInteraction,
}: {
  driverPosition: { lat: number; lng: number } | null;
  isFollowing: boolean;
  onUserInteraction?: () => void;
}) {
  const map = useMap();
  const interactionDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!driverPosition || !isFollowing) return;
    map.panTo([driverPosition.lat, driverPosition.lng], { animate: true, duration: 0.5 });
  }, [map, driverPosition, isFollowing]);

  useEffect(() => {
    if (!onUserInteraction) return;
    
    const handleInteraction = () => {
      if (interactionDebounceRef.current) return;
      onUserInteraction();
      interactionDebounceRef.current = window.setTimeout(() => {
        interactionDebounceRef.current = null;
      }, 500);
    };
    
    map.on("dragstart", handleInteraction);
    map.on("zoomstart", handleInteraction);
    map.on("touchstart", handleInteraction);
    
    return () => {
      map.off("dragstart", handleInteraction);
      map.off("zoomstart", handleInteraction);
      map.off("touchstart", handleInteraction);
      if (interactionDebounceRef.current) {
        clearTimeout(interactionDebounceRef.current);
      }
    };
  }, [map, onUserInteraction]);

  return null;
}

function MapBoundsHandler({
  pickupLocation,
  dropoffLocation,
  driverPosition,
}: {
  pickupLocation: { lat: number; lng: number } | null;
  dropoffLocation: { lat: number; lng: number } | null;
  driverPosition: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    if (initialFitDoneRef.current) return;
    
    const points: [number, number][] = [];
    if (driverPosition) points.push([driverPosition.lat, driverPosition.lng]);
    if (pickupLocation) points.push([pickupLocation.lat, pickupLocation.lng]);
    if (dropoffLocation) points.push([dropoffLocation.lat, dropoffLocation.lng]);
    
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      initialFitDoneRef.current = true;
    } else if (driverPosition) {
      map.setView([driverPosition.lat, driverPosition.lng], 15);
      initialFitDoneRef.current = true;
    }
  }, [map, pickupLocation, dropoffLocation, driverPosition]);

  return null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatEtaText(minutes: number): string {
  if (minutes <= 1) return "Arriving now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDistance(feet: number): string {
  if (feet < 528) return `${Math.round(feet / 10) * 10} ft`;
  const miles = feet / 5280;
  if (miles < 0.1) return `${Math.round(feet)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function getTurnIcon(maneuver: string) {
  switch (maneuver) {
    case "right":
      return <CornerUpRight className="h-5 w-5" />;
    case "sharp_right":
      return <CornerDownRight className="h-5 w-5" />;
    case "slight_right":
      return <CornerUpRight className="h-5 w-5" />;
    case "left":
      return <CornerUpLeft className="h-5 w-5" />;
    case "sharp_left":
      return <CornerDownLeft className="h-5 w-5" />;
    case "slight_left":
      return <CornerUpLeft className="h-5 w-5" />;
    default:
      return <ArrowUp className="h-5 w-5" />;
  }
}

export function MobileLiveTracking({
  status,
  driver,
  pickupEtaMinutes,
  dropoffEtaMinutes,
  distanceMiles,
  vehicleCategory,
  driverPosition,
  interpolatedPosition,
  driverHeading,
  speedMph,
  nextTurn,
  pickupLocation,
  dropoffLocation,
  customerLocation,
  routePoints,
  remainingRoutePoints,
  isFollowingDriver,
  onBack,
  onCancelRide,
  onRecenterDriver,
  onUserInteraction,
  isCancelling = false,
}: MobileLiveTrackingProps) {
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  const categoryConfig = VEHICLE_CATEGORIES[vehicleCategory];
  const normalizedStatus = normalizeStatus(status);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const rotatedDriverIcon = useMemo(() => {
    return createRotatedDriverIcon(driverHeading);
  }, [driverHeading]);

  const displayPosition = interpolatedPosition || driverPosition;

  const getStatusText = () => {
    switch (normalizedStatus) {
      case "DRIVER_ON_THE_WAY":
        return pickupEtaMinutes && pickupEtaMinutes <= 1 
          ? "Arriving now" 
          : `On the way · ${formatEtaText(pickupEtaMinutes || 0)}`;
      case "DRIVER_ARRIVED":
        return "Driver arrived";
      case "ON_TRIP":
        return `${formatEtaText(dropoffEtaMinutes || 0)} to destination`;
      default:
        return "Tracking";
    }
  };

  const mapCenter = displayPosition || pickupLocation || { lat: 40.7128, lng: -74.006 };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col" data-testid="mobile-live-tracking">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm border-b safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">{getStatusText()}</p>
          </div>
          {!isFollowingDriver && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecenterDriver}
              className="gap-1 flex-shrink-0"
              data-testid="button-recenter"
            >
              <Navigation className="h-4 w-4" />
              Re-center
            </Button>
          )}
        </div>
      </div>

      {/* Full Screen Map */}
      <div className="flex-1 relative">
        {isClient && (
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={15}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            
            <MapBoundsHandler 
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              driverPosition={driverPosition}
            />
            
            <MapFollowDriver 
              driverPosition={displayPosition}
              isFollowing={isFollowingDriver}
              onUserInteraction={onUserInteraction}
            />
            
            {pickupLocation && (
              <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon} />
            )}
            {dropoffLocation && (
              <Marker position={[dropoffLocation.lat, dropoffLocation.lng]} icon={dropoffIcon} />
            )}
            
            {displayPosition && (
              <Marker 
                position={[displayPosition.lat, displayPosition.lng]} 
                icon={rotatedDriverIcon}
                zIndexOffset={1000}
              />
            )}
            
            {/* Customer location marker - blue GPS dot (Uber-style) */}
            {customerLocation && (
              <Marker 
                position={[customerLocation.lat, customerLocation.lng]} 
                icon={customerLocationIcon}
                zIndexOffset={500}
              />
            )}
            
            {/* Full route polyline */}
            {routePoints.length > 1 && (
              <Polyline
                positions={routePoints}
                pathOptions={{
                  color: "#3B82F6",
                  weight: 5,
                  opacity: 0.6,
                }}
              />
            )}
            
            {/* Remaining route polyline */}
            {remainingRoutePoints && remainingRoutePoints.length > 1 && (
              <Polyline
                positions={remainingRoutePoints}
                pathOptions={{
                  color: "#10B981",
                  weight: 6,
                  opacity: 0.9,
                }}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Bottom Sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-20 bg-background rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Sheet Handle */}
        <button
          onClick={() => setIsBottomSheetExpanded(!isBottomSheetExpanded)}
          className="w-full flex justify-center py-2"
          data-testid="button-toggle-sheet"
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </button>

        <div className={`px-4 pb-4 space-y-3 transition-all duration-200 ${isBottomSheetExpanded ? 'max-h-[300px]' : 'max-h-[100px]'} overflow-hidden`}>
          {/* Driver Card - Always visible */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-border flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {driver.initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{driver.name}</span>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {driver.rating.toFixed(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {driver.vehicleModel} · {driver.plate}
              </p>
            </div>

            <div 
              className="h-12 w-16 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%)" }}
            >
              <img 
                src={getVehicleCategoryImage(vehicleCategory)} 
                alt={categoryConfig.displayName}
                className="h-10 w-auto object-contain"
                style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))" }}
              />
            </div>
          </div>

          {/* Expanded Content */}
          {isBottomSheetExpanded && (
            <>
              {/* Turn-by-Turn Preview */}
              {nextTurn && (normalizedStatus === "DRIVER_ON_THE_WAY" || normalizedStatus === "ON_TRIP") && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20" data-testid="mobile-turn-preview">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {getTurnIcon(nextTurn.maneuver)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{nextTurn.text}</p>
                    <p className="text-xs text-muted-foreground">in {formatDistance(nextTurn.distanceFeet)}</p>
                  </div>
                </div>
              )}
              
              {/* ETA, Distance & Speed */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                {(normalizedStatus === "DRIVER_ON_THE_WAY" || normalizedStatus === "DRIVER_ARRIVED") && (
                  <>
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="font-semibold text-sm" data-testid="mobile-text-pickup-eta">
                          {normalizedStatus === "DRIVER_ARRIVED" 
                            ? "Arrived" 
                            : formatEtaText(pickupEtaMinutes || 0)}
                        </p>
                      </div>
                    </div>
                    {distanceMiles !== undefined && normalizedStatus === "DRIVER_ON_THE_WAY" && (
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Distance</p>
                          <p className="font-semibold text-sm">{distanceMiles.toFixed(1)} mi</p>
                        </div>
                      </div>
                    )}
                    {speedMph !== undefined && speedMph > 0 && normalizedStatus === "DRIVER_ON_THE_WAY" && (
                      <div className="flex items-center gap-2 flex-1">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Speed</p>
                          <p className="font-semibold text-sm" data-testid="mobile-text-driver-speed">{speedMph} mph</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {normalizedStatus === "ON_TRIP" && (
                  <>
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">ETA</p>
                        <p className="font-semibold text-sm" data-testid="mobile-text-dropoff-eta">
                          {formatEtaText(dropoffEtaMinutes || 0)}
                        </p>
                      </div>
                    </div>
                    {distanceMiles !== undefined && (
                      <div className="flex items-center gap-2 flex-1">
                        <Navigation className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Distance</p>
                          <p className="font-semibold text-sm">{distanceMiles.toFixed(1)} mi</p>
                        </div>
                      </div>
                    )}
                    {speedMph !== undefined && speedMph > 0 && (
                      <div className="flex items-center gap-2 flex-1">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Speed</p>
                          <p className="font-semibold text-sm" data-testid="mobile-text-driver-speed">{speedMph} mph</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Arrived Message */}
              {normalizedStatus === "DRIVER_ARRIVED" && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Please meet your driver at the pickup location.
                  </p>
                </div>
              )}

              {/* Cancel Button - Only before pickup */}
              {(normalizedStatus === "DRIVER_ON_THE_WAY" || normalizedStatus === "DRIVER_ARRIVED") && onCancelRide && (
                <Button 
                  onClick={onCancelRide}
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isCancelling}
                  data-testid="button-cancel-ride-mobile"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Cancel ride
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MobileLiveTracking;
