import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Clock,
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Star,
  CheckCircle2,
  AlertCircle,
  Map,
  X,
  Loader2,
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

export interface DriverTrackingUpdate {
  tripId: string;
  status: DriverTrackingStatus;
  driver: DriverInfo;
  pickupEtaMinutes?: number;
  dropoffEtaMinutes?: number;
  distanceMiles?: number;
  currentPosition: {
    lat: number;
    lng: number;
    heading?: number;
  };
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  routePolyline: [number, number][];
}

interface RideStatusPanelProps {
  status: DriverTrackingStatus;
  driver: DriverInfo;
  pickupEtaMinutes?: number;
  dropoffEtaMinutes?: number;
  distanceMiles?: number;
  vehicleCategory: VehicleCategoryId;
  finalFare?: number;
  tripDurationMinutes?: number;
  tripDistanceMiles?: number;
  speedMph?: number;
  nextTurn?: TurnInstruction | null;
  onViewLiveMap?: () => void;
  onCancelRide?: () => void;
  onContactDriver?: () => void;
  onMessageDriver?: () => void;
  onRateTrip?: (rating: number) => void;
  isCancelling?: boolean;
  showActions?: boolean;
  unreadMessageCount?: number;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
      return <CornerUpRight className="h-4 w-4" />;
    case "sharp_right":
      return <CornerDownRight className="h-4 w-4" />;
    case "slight_right":
      return <CornerUpRight className="h-4 w-4" />;
    case "left":
      return <CornerUpLeft className="h-4 w-4" />;
    case "sharp_left":
      return <CornerDownLeft className="h-4 w-4" />;
    case "slight_left":
      return <CornerUpLeft className="h-4 w-4" />;
    default:
      return <ArrowUp className="h-4 w-4" />;
  }
}

export function RideStatusPanel({
  status,
  driver,
  pickupEtaMinutes,
  dropoffEtaMinutes,
  distanceMiles,
  vehicleCategory,
  finalFare,
  tripDurationMinutes,
  tripDistanceMiles,
  speedMph,
  nextTurn,
  onViewLiveMap,
  onCancelRide,
  onContactDriver,
  onMessageDriver,
  onRateTrip,
  isCancelling = false,
  showActions = true,
  unreadMessageCount = 0,
}: RideStatusPanelProps) {
  const categoryConfig = VEHICLE_CATEGORIES[vehicleCategory];
  const normalizedStatus = normalizeStatus(status);
  
  const formatEtaText = (minutes: number): string => {
    if (minutes <= 1) return "Arriving now";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusTitle = () => {
    switch (normalizedStatus) {
      case "DRIVER_ON_THE_WAY":
        return "Your driver is on the way";
      case "DRIVER_ARRIVED":
        return "Your driver has arrived";
      case "ON_TRIP":
        return "On your way to destination";
      case "TRIP_COMPLETED":
        return "Trip completed";
      default:
        return "Ride in progress";
    }
  };

  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case "DRIVER_ON_THE_WAY":
        return <Car className="h-5 w-5 text-primary" />;
      case "DRIVER_ARRIVED":
        return <MapPin className="h-5 w-5 text-green-600" />;
      case "ON_TRIP":
        return <Navigation className="h-5 w-5 text-primary" />;
      case "TRIP_COMPLETED":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      default:
        return <Car className="h-5 w-5" />;
    }
  };

  return (
    <Card className="shadow-md rounded-xl overflow-hidden" data-testid={`status-panel-${status.toLowerCase().replace(/_/g, "-")}`}>
      <CardContent className="p-0">
        {/* Status Header */}
        <div className="px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h3 className="font-semibold text-base">{getStatusTitle()}</h3>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Driver Card */}
          <div className="flex items-center gap-3">
            {/* Driver Avatar */}
            <Avatar className="h-14 w-14 border-2 border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {driver.initials}
              </AvatarFallback>
            </Avatar>

            {/* Driver Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base truncate">{driver.name}</span>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {driver.rating.toFixed(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {driver.vehicleModel} · {driver.vehicleColor}
              </p>
              <p className="text-sm font-medium mt-0.5">{driver.plate}</p>
            </div>

            {/* Vehicle Image */}
            <div 
              className="h-14 w-20 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F2F2F2 100%)" }}
            >
              <img 
                src={getVehicleCategoryImage(vehicleCategory)} 
                alt={categoryConfig.displayName}
                className="h-12 w-auto object-contain"
                style={{ filter: "drop-shadow(0px 3px 6px rgba(0,0,0,0.1))" }}
              />
            </div>
          </div>

          {/* ETA & Distance Info */}
          {normalizedStatus !== "TRIP_COMPLETED" && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl">
                {(normalizedStatus === "DRIVER_ON_THE_WAY" || normalizedStatus === "DRIVER_ARRIVED") && (
                  <>
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="font-semibold text-sm" data-testid="text-pickup-eta">
                          {normalizedStatus === "DRIVER_ARRIVED" 
                            ? "Arrived" 
                            : formatEtaText(pickupEtaMinutes || 0)}
                        </p>
                      </div>
                    </div>
                    {normalizedStatus === "DRIVER_ON_THE_WAY" && distanceMiles !== undefined && (
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Distance</p>
                          <p className="font-semibold text-sm">{distanceMiles.toFixed(1)} mi</p>
                        </div>
                      </div>
                    )}
                    {normalizedStatus === "DRIVER_ON_THE_WAY" && speedMph !== undefined && speedMph > 0 && (
                      <div className="flex items-center gap-2 flex-1">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Speed</p>
                          <p className="font-semibold text-sm" data-testid="text-driver-speed">{speedMph} mph</p>
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
                        <p className="font-semibold text-sm" data-testid="text-dropoff-eta">
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
                          <p className="font-semibold text-sm" data-testid="text-driver-speed">{speedMph} mph</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Turn-by-Turn Preview */}
              {nextTurn && (normalizedStatus === "DRIVER_ON_THE_WAY" || normalizedStatus === "ON_TRIP") && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20" data-testid="turn-preview">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {getTurnIcon(nextTurn.maneuver)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{nextTurn.text}</p>
                    <p className="text-xs text-muted-foreground">in {formatDistance(nextTurn.distanceFeet)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DRIVER_ARRIVED Message */}
          {normalizedStatus === "DRIVER_ARRIVED" && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                Please meet your driver at the pickup location.
              </p>
            </div>
          )}

          {/* TRIP_COMPLETED Summary */}
          {normalizedStatus === "TRIP_COMPLETED" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">Final fare</p>
                  <p className="text-2xl font-bold">${(finalFare || 0).toFixed(2)}</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-semibold">{(tripDistanceMiles || 0).toFixed(1)} mi</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold">{formatDuration(tripDurationMinutes || 0)}</p>
                </div>
              </div>
              
              <div className="p-3 bg-muted/20 rounded-xl text-center">
                <p className="text-sm text-muted-foreground">Rating coming soon</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {showActions && normalizedStatus !== "TRIP_COMPLETED" && (
            <div className="space-y-2">
              {/* Primary Action Row */}
              <div className="flex gap-2">
                {onViewLiveMap && (
                  <Button 
                    onClick={onViewLiveMap}
                    className="flex-1 gap-2"
                    variant="default"
                    data-testid="button-view-live-map"
                  >
                    <Map className="h-4 w-4" />
                    View live map
                  </Button>
                )}
                
                {onMessageDriver && (
                  <Button 
                    onClick={onMessageDriver}
                    variant="outline"
                    size="icon"
                    className="relative"
                    data-testid="button-message-driver"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {unreadMessageCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                        data-testid="badge-unread-messages"
                      >
                        {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                      </Badge>
                    )}
                  </Button>
                )}
                
                {onContactDriver && (
                  <Button 
                    onClick={onContactDriver}
                    variant="outline"
                    size="icon"
                    data-testid="button-contact-driver"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Cancel Ride - Only before trip starts */}
              {(normalizedStatus === "DRIVER_ON_THE_WAY" || normalizedStatus === "DRIVER_ARRIVED") && onCancelRide && (
                <Button 
                  onClick={onCancelRide}
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isCancelling}
                  data-testid="button-cancel-ride"
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default RideStatusPanel;
