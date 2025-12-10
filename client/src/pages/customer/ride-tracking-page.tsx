/**
 * Ride Tracking Page
 * 
 * Real-time ride tracking for customers with:
 * - Live status updates
 * - Driver info (name + phone only, no documents)
 * - Map showing driver location and route
 * - ETA to pickup/dropoff
 * - Trip details and fare breakdown
 * - Payment method indicator
 * 
 * SafeGo Role Isolation: Customer cannot see driver documents (license, NID, etc.)
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Clock,
  Car,
  Wallet,
  CreditCard,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Star,
  Shield,
  User,
  ChevronDown,
  ChevronUp,
  Moon,
  Zap,
  Info,
  Navigation2,
  CircleDot,
  AlertTriangle,
} from "lucide-react";

interface RideData {
  id: string;
  status: string;
  countryCode: string;
  cityCode: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: string;
  paymentMethod: string;
  fareCurrency: string;
  serviceFare: number;
  distanceKm: number;
  durationMinutes: number;
  nightMultiplier?: number;
  peakMultiplier?: number;
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    profilePhotoUrl?: string;
    rating?: number;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePlate?: string;
    currentLat?: number;
    currentLng?: number;
  };
  fareBreakdown?: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    nightMultiplier: number;
    peakMultiplier: number;
    totalFare: number;
    currency: string;
  };
  etaMinutes?: number;
  routePolyline?: string;
}

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 28px; height: 28px; background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="color: white; font-weight: bold; font-size: 12px;">A</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 28px; height: 28px; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="color: white; font-weight: bold; font-size: 12px;">B</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const driverIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 36px; height: 36px; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.5-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapBoundsHandler({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  driverLat,
  driverLng,
}: {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  driverLat?: number;
  driverLng?: number;
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [
      [pickupLat, pickupLng],
      [dropoffLat, dropoffLng],
    ];
    if (driverLat && driverLng) {
      points.push([driverLat, driverLng]);
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [map, pickupLat, pickupLng, dropoffLat, dropoffLng, driverLat, driverLng]);

  return null;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "requested":
      return {
        label: "Finding Driver",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        icon: Loader2,
        description: "Looking for a driver nearby...",
        animate: true,
      };
    case "searching_driver":
      return {
        label: "Searching",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        icon: Loader2,
        description: "Searching for available drivers...",
        animate: true,
      };
    case "accepted":
      return {
        label: "Driver Assigned",
        color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        icon: CheckCircle,
        description: "Your driver is on the way to pick you up",
        animate: false,
      };
    case "driver_arriving":
      return {
        label: "Driver Arriving",
        color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        icon: Navigation2,
        description: "Your driver is arriving soon",
        animate: false,
      };
    case "arrived":
      return {
        label: "Driver Arrived",
        color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        icon: CircleDot,
        description: "Your driver has arrived at the pickup location",
        animate: false,
      };
    case "in_progress":
      return {
        label: "In Progress",
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
        icon: Car,
        description: "You are on your way to the destination",
        animate: false,
      };
    case "completed":
      return {
        label: "Completed",
        color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
        icon: CheckCircle,
        description: "Your ride has been completed",
        animate: false,
      };
    case "cancelled_by_customer":
    case "cancelled_by_driver":
    case "cancelled_no_driver":
      return {
        label: "Cancelled",
        color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        icon: XCircle,
        description: "This ride has been cancelled",
        animate: false,
      };
    default:
      return {
        label: status,
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
        icon: AlertCircle,
        description: "",
        animate: false,
      };
  }
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "BDT") {
    return `৳${amount.toFixed(0)}`;
  }
  return `$${amount.toFixed(2)}`;
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export default function RideTrackingPage() {
  const [, params] = useRoute("/customer/ride-tracking/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const rideId = params?.id;

  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: ride,
    isLoading,
    error,
    refetch,
  } = useQuery<RideData>({
    queryKey: ["/api/rides", rideId],
    enabled: !!rideId,
    refetchInterval: (query) => {
      const data = query.state.data as RideData | undefined;
      if (data?.status === "completed" || data?.status?.startsWith("cancelled")) {
        return false;
      }
      return 5000;
    },
    queryFn: async () => {
      return apiRequest(`/api/rides/${rideId}`, { method: "GET" });
    },
  });

  const cancelRideMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/rides/${rideId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Customer cancelled" }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Ride Cancelled",
        description: "Your ride has been cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId] });
      setShowCancelDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Could not cancel ride",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center gap-3 p-4 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/customer")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-6 w-32" />
        </header>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center gap-3 p-4 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/customer")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Ride Details</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Could not load ride details. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(ride.status);
  const StatusIcon = statusConfig.icon;
  const isActive = !["completed", "cancelled_by_customer", "cancelled_by_driver", "cancelled_no_driver"].includes(ride.status);
  const canCancel = ["requested", "searching_driver", "accepted", "driver_arriving"].includes(ride.status);

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="ride-tracking-page">
      <header className="flex items-center gap-3 p-3 sm:p-4 border-b bg-card shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/customer")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">Track Ride</h1>
          <Badge className={`${statusConfig.color} mt-1`}>
            {statusConfig.animate && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {statusConfig.label}
          </Badge>
        </div>
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            data-testid="button-cancel-ride"
          >
            Cancel
          </Button>
        )}
      </header>

      <div className="flex-1 relative min-h-0">
        <MapContainer
          center={[ride.pickupLat, ride.pickupLng]}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsHandler
            pickupLat={ride.pickupLat}
            pickupLng={ride.pickupLng}
            dropoffLat={ride.dropoffLat}
            dropoffLng={ride.dropoffLng}
            driverLat={ride.driver?.currentLat}
            driverLng={ride.driver?.currentLng}
          />
          <Marker position={[ride.pickupLat, ride.pickupLng]} icon={pickupIcon} />
          <Marker position={[ride.dropoffLat, ride.dropoffLng]} icon={dropoffIcon} />
          {ride.driver?.currentLat && ride.driver?.currentLng && (
            <Marker
              position={[ride.driver.currentLat, ride.driver.currentLng]}
              icon={driverIcon}
            />
          )}
          {ride.routePolyline && (
            <Polyline
              positions={decodePolyline(ride.routePolyline)}
              pathOptions={{ color: "#3B82F6", weight: 4, opacity: 0.8 }}
            />
          )}
        </MapContainer>
      </div>

      <div className="bg-card border-t max-h-[55vh] overflow-y-auto shrink-0">
        <div className="p-3 sm:p-4 space-y-4">
          <Alert className={`${statusConfig.color} border-0`}>
            <StatusIcon className={`h-4 w-4 ${statusConfig.animate ? "animate-spin" : ""}`} />
            <AlertDescription className="font-medium">
              {statusConfig.description}
            </AlertDescription>
          </Alert>

          {ride.driver && (
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    <AvatarImage src={ride.driver.profilePhotoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {ride.driver.firstName?.[0]}{ride.driver.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate" data-testid="text-driver-name">
                      {ride.driver.firstName} {ride.driver.lastName}
                    </h3>
                    {ride.driver.rating && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span>{ride.driver.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {ride.driver.vehicleMake && (
                      <p className="text-sm text-muted-foreground truncate">
                        {ride.driver.vehicleColor} {ride.driver.vehicleMake} {ride.driver.vehicleModel}
                        {ride.driver.vehiclePlate && ` · ${ride.driver.vehiclePlate}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                      data-testid="button-call-driver"
                    >
                      <a href={`tel:${ride.driver.phone}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setLocation(`/customer/ride-chat/${rideId}`)}
                      data-testid="button-chat-driver"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {ride.etaMinutes && isActive && (
            <div className="flex items-center justify-center gap-2 py-3 bg-primary/5 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg" data-testid="text-eta">
                {ride.status === "in_progress" ? "Arriving in" : "ETA"}: {ride.etaMinutes} min
              </span>
            </div>
          )}

          <Card>
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium truncate" data-testid="text-pickup-address">
                    {ride.pickupAddress}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="font-medium truncate" data-testid="text-dropoff-address">
                    {ride.dropoffAddress}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3.5 w-3.5" />
                    {ride.distanceKm?.toFixed(1)} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    ~{ride.durationMinutes} min
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ride.paymentMethod === "cash" ? (
                    <Badge variant="secondary" className="gap-1" data-testid="badge-payment-method">
                      <Wallet className="h-3 w-3" /> Cash
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1" data-testid="badge-payment-method">
                      <CreditCard className="h-3 w-3" /> Online
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Fare</span>
                <span className="font-bold text-xl" data-testid="text-total-fare">
                  {formatCurrency(ride.serviceFare, ride.fareCurrency)}
                </span>
              </div>

              <button
                onClick={() => setShowFareBreakdown(!showFareBreakdown)}
                className="flex items-center gap-2 text-sm text-primary hover:underline w-full justify-center py-1"
                data-testid="button-fare-breakdown"
              >
                <Info className="h-4 w-4" />
                {showFareBreakdown ? "Hide" : "View"} Details
                {showFareBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showFareBreakdown && ride.fareBreakdown && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Fare</span>
                    <span>{formatCurrency(ride.fareBreakdown.baseFare, ride.fareCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance</span>
                    <span>{formatCurrency(ride.fareBreakdown.distanceFare, ride.fareCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span>{formatCurrency(ride.fareBreakdown.timeFare, ride.fareCurrency)}</span>
                  </div>
                  {ride.fareBreakdown.bookingFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Booking Fee</span>
                      <span>{formatCurrency(ride.fareBreakdown.bookingFee, ride.fareCurrency)}</span>
                    </div>
                  )}
                  {ride.fareBreakdown.nightMultiplier > 1 && (
                    <div className="flex justify-between text-amber-600">
                      <span className="flex items-center gap-1">
                        <Moon className="h-3 w-3" /> Night Rate
                      </span>
                      <span>x{ride.fareBreakdown.nightMultiplier.toFixed(1)}</span>
                    </div>
                  )}
                  {ride.fareBreakdown.peakMultiplier > 1 && (
                    <div className="flex justify-between text-orange-600">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Peak Rate
                      </span>
                      <span>x{ride.fareBreakdown.peakMultiplier.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {ride.status === "completed" && (
            <Button
              className="w-full"
              onClick={() => setLocation(`/customer/ride-receipt/${rideId}`)}
              data-testid="button-view-receipt"
            >
              View Receipt
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Ride?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this ride? Cancellation fees may apply depending on the ride status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Ride
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelRideMutation.mutate()}
              disabled={cancelRideMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelRideMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Ride
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
