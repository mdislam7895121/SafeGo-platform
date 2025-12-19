/**
 * BD Ride Detail Page (Driver)
 * 
 * Shows detailed ride information for BD rides including:
 * - Route map with pickup/dropoff
 * - Full fare breakdown in BDT
 * - Cash collection workflow
 * - Night/peak multiplier details
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BDRideEarningsCard } from "@/components/driver/BDRideEarningsCard";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Clock,
  Calendar,
  Star,
  Phone,
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Car,
  Bike,
  Truck,
  Crown,
} from "lucide-react";
import { useEffect } from "react";

interface BDRideDetails {
  id: string;
  status: string;
  vehicleType: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm: number;
  durationMinutes: number;
  paymentMethod: "cash" | "online";
  countryCode: string;
  cityCode: string;
  requestedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  customer: {
    name: string;
    phone: string;
    rating: number;
  } | null;
  fareBreakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    subtotal: number;
    nightMultiplier: number;
    peakMultiplier: number;
    finalMultiplier: number;
    multiplierAdjustment: number;
    priorityFee: number;
    totalFare: number;
    minimumFareApplied: boolean;
    safegoCommission: number;
    driverEarnings: number;
    currency: string;
    commissionRate: number;
  };
  isNightTime: boolean;
  isPeakTime: boolean;
  cashCollected: boolean;
}

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 28px; height: 28px; background: #22C55E; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
    width: 28px; height: 28px; background: #EF4444; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="color: white; font-weight: bold; font-size: 12px;">B</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapBoundsHandler({ pickupLat, pickupLng, dropoffLat, dropoffLng }: {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const bounds = L.latLngBounds(
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng]
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    } else if (pickupLat && pickupLng) {
      map.setView([pickupLat, pickupLng], 15);
    }
  }, [map, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return null;
}

function getVehicleIcon(vehicleType: string) {
  switch (vehicleType) {
    case "bike":
      return <Bike className="h-5 w-5" />;
    case "cng":
      return <Truck className="h-5 w-5" />;
    case "car_premium":
      return <Crown className="h-5 w-5" />;
    default:
      return <Car className="h-5 w-5" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case "in_progress":
    case "picked_up":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          <Navigation className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    case "en_route":
    case "arrived":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          <Car className="h-3 w-3 mr-1" />
          En Route
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

export default function BDRideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ride, isLoading, error } = useQuery<BDRideDetails>({
    queryKey: ["/api/rides/bd", rideId],
    queryFn: async () => {
      const data = await apiRequest(`/api/rides/${rideId}`);
      return {
        ...data,
        fareBreakdown: data.fareBreakdown || {
          baseFare: Number(data.baseFareAmount) || 0,
          distanceFare: Number(data.distanceFareAmount) || 0,
          timeFare: Number(data.timeFareAmount) || 0,
          bookingFee: Number(data.bookingFee) || 0,
          subtotal: Number(data.serviceFare) || 0,
          nightMultiplier: Number(data.nightMultiplier) || 1,
          peakMultiplier: Number(data.peakMultiplier) || 1,
          finalMultiplier: Number(data.surgeMultiplier) || 1,
          multiplierAdjustment: 0,
          priorityFee: 0,
          totalFare: Number(data.serviceFare) || 0,
          minimumFareApplied: false,
          safegoCommission: Number(data.safegoCommission) || 0,
          driverEarnings: Number(data.driverEarnings) || 0,
          currency: data.fareCurrency || "BDT",
          commissionRate: 15,
        },
        isNightTime: Number(data.nightMultiplier) > 1,
        isPeakTime: Number(data.peakMultiplier) > 1,
        cashCollected: data.cashCollected || false,
        distanceKm: data.distanceKm || (data.distanceMiles ? data.distanceMiles * 1.60934 : 0),
      };
    },
    enabled: !!rideId,
  });

  const confirmCashMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/rides/${rideId}/confirm-cash`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Cash Confirmed",
        description: "Cash collection has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rides/bd", rideId] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/wallet"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm cash collection",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">Ride Not Found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find this ride in your history.
              </p>
              <Link href="/driver/trips">
                <Button data-testid="button-back-to-trips">Back to Trip History</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const defaultCenter: [number, number] = [23.8103, 90.4125];

  return (
    <div className="min-h-screen bg-background" data-testid="bd-ride-detail-page">
      <header className="sticky top-0 z-10 bg-card border-b p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/driver/trips")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Ride Details</h1>
            <p className="text-sm text-muted-foreground">
              {ride.requestedAt && format(new Date(ride.requestedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          {getStatusBadge(ride.status)}
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-0">
            <div className="h-48 rounded-t-lg overflow-hidden">
              <MapContainer
                center={
                  ride.pickupLat && ride.pickupLng
                    ? [ride.pickupLat, ride.pickupLng]
                    : defaultCenter
                }
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                <MapBoundsHandler
                  pickupLat={ride.pickupLat}
                  pickupLng={ride.pickupLng}
                  dropoffLat={ride.dropoffLat}
                  dropoffLng={ride.dropoffLng}
                />
                {ride.pickupLat && ride.pickupLng && (
                  <Marker position={[ride.pickupLat, ride.pickupLng]} icon={pickupIcon} />
                )}
                {ride.dropoffLat && ride.dropoffLng && (
                  <Marker position={[ride.dropoffLat, ride.dropoffLng]} icon={dropoffIcon} />
                )}
                {ride.pickupLat && ride.pickupLng && ride.dropoffLat && ride.dropoffLng && (
                  <Polyline
                    positions={[
                      [ride.pickupLat, ride.pickupLng],
                      [ride.dropoffLat, ride.dropoffLng],
                    ]}
                    pathOptions={{ color: "#3B82F6", weight: 3, opacity: 0.7, dashArray: "5, 10" }}
                  />
                )}
              </MapContainer>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Pickup</p>
                  <p className="font-medium">{ride.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Dropoff</p>
                  <p className="font-medium">{ride.dropoffAddress}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {ride.customer && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{ride.customer.name}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{ride.customer.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                {ride.status !== "completed" && ride.status !== "cancelled" && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" data-testid="button-call-customer">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" data-testid="button-message-customer">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <BDRideEarningsCard
          rideId={ride.id}
          vehicleType={ride.vehicleType}
          paymentMethod={ride.paymentMethod}
          distanceKm={ride.distanceKm}
          durationMin={ride.durationMinutes}
          fareBreakdown={ride.fareBreakdown}
          status={ride.status}
          isNightTime={ride.isNightTime}
          isPeakTime={ride.isPeakTime}
          cashCollected={ride.cashCollected}
          onCashCollectionConfirm={
            ride.paymentMethod === "cash" && ride.status === "completed" && !ride.cashCollected
              ? () => confirmCashMutation.mutate()
              : undefined
          }
        />

        <div className="flex items-center justify-center gap-4 py-4 text-sm text-muted-foreground">
          <span>Ride ID: {ride.id.slice(0, 8).toUpperCase()}</span>
          <Separator orientation="vertical" className="h-4" />
          <span>{ride.cityCode}</span>
        </div>
      </div>
    </div>
  );
}
