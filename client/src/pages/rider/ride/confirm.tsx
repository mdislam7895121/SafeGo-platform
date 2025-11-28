import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Car,
  CreditCard,
  Wallet,
  Banknote,
  Clock,
  Route,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useRideBooking } from "@/contexts/RideBookingContext";
import { SafeGoMap } from "@/components/maps/SafeGoMap";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

function getPaymentIcon(type: string) {
  switch (type) {
    case "card":
      return CreditCard;
    case "wallet":
      return Wallet;
    default:
      return Banknote;
  }
}

export default function RideConfirmPage() {
  const [, setLocation] = useLocation();
  const { state, setActiveRide, setStep, clearBooking, canProceedToConfirm } = useRideBooking();
  const { toast } = useToast();
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!canProceedToConfirm) {
      setLocation("/rider/ride/options");
    }
  }, [canProceedToConfirm, setLocation]);

  const createRideMutation = useMutation({
    mutationFn: async () => {
      if (!state.pickup || !state.dropoff || !state.selectedOption || !state.paymentMethod) {
        throw new Error("Missing booking details");
      }

      const promo = state.promoValidation;
      const fareEstimate = state.fareEstimate;
      const originalFare = fareEstimate 
        ? fareEstimate.totalFare + (fareEstimate.promoDiscount || 0)
        : state.selectedOption.estimatedFare;
      const promoDiscount = fareEstimate?.promoDiscount || (promo?.valid ? promo.discountAmount : 0);
      const finalFare = fareEstimate?.totalFare || state.selectedOption.estimatedFare;

      const response = await apiRequest("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress: state.pickup.address,
          pickupLat: state.pickup.lat,
          pickupLng: state.pickup.lng,
          pickupPlaceId: state.pickup.placeId || null,
          dropoffAddress: state.dropoff.address,
          dropoffLat: state.dropoff.lat,
          dropoffLng: state.dropoff.lng,
          dropoffPlaceId: state.dropoff.placeId || null,
          distanceMiles: state.routeData?.distanceMiles || null,
          durationMinutes: state.routeData?.durationMinutes || null,
          routePolyline: state.routeData?.routePolyline || null,
          rawDistanceMeters: state.routeData?.rawDistanceMeters || null,
          rawDurationSeconds: state.routeData?.rawDurationSeconds || null,
          routeProviderSource: state.routeData?.providerSource || null,
          serviceFare: finalFare,
          originalFare: originalFare,
          promoDiscount: promoDiscount,
          promoCode: promo?.valid ? promo.code : null,
          promoCodeId: promo?.valid ? promo.promoCodeId : null,
          paymentMethod: state.paymentMethod.type === "cash" ? "cash" : "online",
        }),
      });

      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Ride Requested!",
        description: "Finding you a driver...",
      });
      setActiveRide(data.ride.id);
      setLocation("/rider/trip/active");
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to request ride. Please try again.";
      setRequestError(errorMessage);
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleConfirmRide = () => {
    setRequestError(null);
    setStep("requesting");
    createRideMutation.mutate();
  };

  const handleBack = () => {
    setLocation("/rider/ride/options");
  };

  const handleCancel = () => {
    clearBooking();
    setLocation("/rider/home");
  };

  if (!state.pickup || !state.dropoff || !state.selectedOption || !state.paymentMethod) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Booking Incomplete</h2>
        <p className="text-muted-foreground text-center mb-4">
          Some booking details are missing. Please start over.
        </p>
        <Button onClick={() => setLocation("/rider/ride/new")} data-testid="button-start-over">
          Start Over
        </Button>
      </div>
    );
  }

  const PaymentIcon = getPaymentIcon(state.paymentMethod.type);
  const distanceMiles = state.routeData?.distanceMiles ?? 0;
  const durationMins = state.routeData?.durationMinutes ?? 0;
  const hasRouteData = distanceMiles > 0 && durationMins > 0;
  
  const routeCoordinates = useMemo(() => {
    if (state.routeData?.routePolyline) {
      try {
        return decodePolyline(state.routeData.routePolyline);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [state.routeData?.routePolyline]);

  return (
    <div className="flex flex-col h-full" data-testid="ride-confirm-page">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            disabled={createRideMutation.isPending}
            data-testid="button-back-confirm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-confirm-title">Confirm Your Ride</h1>
            <p className="text-sm text-muted-foreground">Review details before booking</p>
          </div>
        </div>
      </div>

      <div className="h-40 relative">
        <SafeGoMap
          pickupLocation={{
            lat: state.pickup.lat,
            lng: state.pickup.lng,
            label: "Pickup",
          }}
          dropoffLocation={{
            lat: state.dropoff.lat,
            lng: state.dropoff.lng,
            label: "Dropoff",
          }}
          routeCoordinates={routeCoordinates}
          activeLeg="to_dropoff"
          showControls={false}
          className="h-full w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {requestError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Booking Failed</AlertTitle>
            <AlertDescription>{requestError}</AlertDescription>
          </Alert>
        )}

        {!hasRouteData && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Route Information Unavailable</AlertTitle>
            <AlertDescription>
              Distance and travel time couldn't be calculated. The fare is based on estimated distance.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">A</span>
                </div>
                <div className="w-0.5 h-8 bg-border my-1" />
                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">B</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium" data-testid="text-confirm-pickup">{state.pickup.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="font-medium" data-testid="text-confirm-dropoff">{state.dropoff.address}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1" data-testid="text-distance">
                  <Route className="h-4 w-4" />
                  {distanceMiles > 0 ? `${distanceMiles.toFixed(1)} mi` : "--"}
                </span>
                <span className="flex items-center gap-1" data-testid="text-duration">
                  <Clock className="h-4 w-4" />
                  {durationMins > 0 ? `~${durationMins} min` : "--"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Car className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold" data-testid="text-confirm-ride-type">{state.selectedOption.name}</h3>
                <p className="text-sm text-muted-foreground">{state.selectedOption.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ETA: {state.selectedOption.etaMinutes} min
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold" data-testid="text-confirm-fare">
                  ৳{state.selectedOption.estimatedFare}
                </p>
                <p className="text-xs text-muted-foreground">{state.selectedOption.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PaymentIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium" data-testid="text-confirm-payment">
                    {state.paymentMethod.label}
                    {state.paymentMethod.lastFour && ` ••••${state.paymentMethod.lastFour}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Payment method</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleBack}
                disabled={createRideMutation.isPending}
                data-testid="button-change-payment"
              >
                Change
              </Button>
            </div>
          </CardContent>
        </Card>

        {state.promoValidation?.valid && (
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Promo code applied
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500">{state.promoValidation.code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-700 dark:text-green-400" data-testid="text-promo-discount">
                    -৳{state.promoValidation.discountAmount.toFixed(2)}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">Saved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>By confirming, you agree to SafeGo's terms of service.</p>
          <p>Fare may change based on traffic and route.</p>
        </div>
      </div>

      <div className="p-4 border-t bg-background space-y-2">
        <Button
          className="w-full"
          size="lg"
          onClick={handleConfirmRide}
          disabled={createRideMutation.isPending}
          data-testid="button-request-ride"
        >
          {createRideMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Requesting Ride...
            </>
          ) : (
            <>
              Request {state.selectedOption.name}
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={handleCancel}
          disabled={createRideMutation.isPending}
          data-testid="button-cancel-booking"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
