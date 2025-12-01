import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  User,
  Star,
  CreditCard,
  Banknote,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Shield,
  Route,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface RideRequestDetail {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  totalFare: number;
  driverPayout: number;
  platformCommission: number;
  paymentMethod: "cash" | "card" | "wallet";
  rideType: string;
  customer: {
    firstName: string;
    rating: number | null;
    phone: string | null;
    totalRides: number;
  };
  safetyNotes: string | null;
  expiresAt: string;
  createdAt: string;
  cashBlocked?: boolean;
  cashBlockReason?: string | null;
}

function buildNavigationUrl(app: string, lat: number, lng: number): string {
  const coords = `${lat},${lng}`;
  switch (app) {
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=driving`;
    case "apple":
      return `maps://?daddr=${coords}&dirflg=d`;
    case "waze":
      return `https://waze.com/ul?ll=${coords}&navigate=yes`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=driving`;
  }
}

export default function DriverRideRequestDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: requestData, isLoading, error } = useQuery<{ request: RideRequestDetail }>({
    queryKey: ["/api/driver/trips/requests", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/driver/trips/requests/${params.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch request details");
      return response.json();
    },
    enabled: !!params.id,
    refetchInterval: 10000,
  });

  const request = requestData?.request;

  useEffect(() => {
    if (request?.expiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, (new Date(request.expiresAt).getTime() - Date.now()) / 1000);
        setTimeRemaining(Math.floor(remaining));
        if (remaining <= 0) {
          clearInterval(interval);
          toast({
            title: "Request Expired",
            description: "This ride request has expired",
            variant: "destructive",
          });
          navigate("/driver/trip-requests");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [request?.expiresAt, navigate, toast]);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      let position: GeolocationPosition | null = null;
      if (navigator.geolocation) {
        position = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
      return apiRequest(`/api/driver/trips/requests/${params.id}/accept`, {
        method: "POST",
        body: JSON.stringify({
          serviceType: request?.serviceType || "RIDE",
          driverLat: position?.coords.latitude,
          driverLng: position?.coords.longitude,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips"] });
      toast({
        title: "Ride Accepted",
        description: "Navigate to the pickup location",
      });
      navigate("/driver/trip/active");
    },
    onError: (error: any) => {
      toast({
        title: "Could not accept ride",
        description: error.message || "The ride may have been taken by another driver",
        variant: "destructive",
      });
      navigate("/driver/trip-requests");
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (reason?: string) => {
      return apiRequest(`/api/driver/trips/requests/${params.id}/decline`, {
        method: "POST",
        body: JSON.stringify({
          serviceType: request?.serviceType || "RIDE",
          reason,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Ride Declined",
        description: "Looking for other rides nearby",
      });
      navigate("/driver/trip-requests");
    },
    onError: () => {
      navigate("/driver/trip-requests");
    },
  });

  const handleAccept = () => {
    acceptMutation.mutate();
  };

  const handleDecline = (reason?: string) => {
    setShowDeclineDialog(false);
    declineMutation.mutate(reason);
  };

  const openInMaps = (lat: number | null, lng: number | null, address: string) => {
    if (lat && lng) {
      window.open(buildNavigationUrl("google", lat, lng), "_blank");
    } else {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" data-testid="loading-request-detail">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-background p-4" data-testid="error-request-detail">
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">Request Not Found</h2>
            <p className="text-muted-foreground">
              This ride request may have expired or been accepted by another driver.
            </p>
            <Button onClick={() => navigate("/driver/trip-requests")} data-testid="button-back-to-requests">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Requests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCash = request.paymentMethod === "cash";

  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="page-ride-request-detail"
    >
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver/trip-requests")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Ride Request</h1>
          {timeRemaining !== null && timeRemaining > 0 && (
            <Badge variant={timeRemaining < 10 ? "destructive" : "secondary"} data-testid="badge-time-remaining">
              <Clock className="h-3 w-3 mr-1" />
              {timeRemaining}s
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-sm" data-testid="badge-ride-type">
                {request.rideType || "Standard"}
              </Badge>
              <div className="flex items-center gap-2">
                {isCash ? (
                  <Badge className="bg-green-500" data-testid="badge-payment-cash">
                    <Banknote className="h-3 w-3 mr-1" />
                    Cash
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500" data-testid="badge-payment-card">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Card
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium text-sm truncate" data-testid="text-pickup-address">
                    {request.pickupAddress}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => openInMaps(request.pickupLat, request.pickupLng, request.pickupAddress)}
                    data-testid="button-open-pickup-maps"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open in Maps
                  </Button>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-muted ml-4 h-4" />

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="font-medium text-sm truncate" data-testid="text-dropoff-address">
                    {request.dropoffAddress}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => openInMaps(request.dropoffLat, request.dropoffLng, request.dropoffAddress)}
                    data-testid="button-open-dropoff-maps"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open in Maps
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <Route className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold" data-testid="text-distance">
                  {request.estimatedDistanceKm.toFixed(1)} km
                </p>
                <p className="text-xs text-muted-foreground">Distance</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold" data-testid="text-duration">
                  {request.estimatedDurationMinutes} min
                </p>
                <p className="text-xs text-muted-foreground">Est. Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Fare Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer Pays</span>
              <span className="font-medium" data-testid="text-total-fare">${request.totalFare.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">SafeGo Fee</span>
              <span className="text-muted-foreground" data-testid="text-commission">
                -${request.platformCommission.toFixed(2)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold">Your Earnings</span>
              <span className="text-xl font-bold text-green-600" data-testid="text-driver-payout">
                ${request.driverPayout.toFixed(2)}
              </span>
            </div>
            {isCash && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Customer will pay <strong>${request.totalFare.toFixed(2)}</strong> in cash. 
                    The SafeGo fee will be deducted from your wallet balance.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10">
                  {request.customer.firstName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium" data-testid="text-customer-name">
                  {request.customer.firstName}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {request.customer.rating ? (
                    <span className="flex items-center gap-1" data-testid="text-customer-rating">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {request.customer.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span>New rider</span>
                  )}
                  <span>•</span>
                  <span>{request.customer.totalRides} rides</span>
                </div>
              </div>
              {request.customer.phone && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`tel:${request.customer.phone}`, "_self")}
                  data-testid="button-call-customer"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {request.safetyNotes && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-300 text-sm">Safety Note</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400" data-testid="text-safety-notes">
                    {request.safetyNotes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {request.cashBlocked && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive text-sm">Cash Rides Blocked</p>
                  <p className="text-sm text-destructive/80" data-testid="text-cash-blocked-reason">
                    {request.cashBlockReason || "Your outstanding balance exceeds the threshold. Please clear your balance to accept cash rides."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <div className="sticky bottom-0 bg-background border-t p-4 safe-area-inset-bottom">
        <div className="max-w-lg mx-auto space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={handleAccept}
            disabled={acceptMutation.isPending || declineMutation.isPending || request.cashBlocked}
            data-testid="button-accept-ride"
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Accepting...
              </>
            ) : request.cashBlocked ? (
              <>
                <AlertTriangle className="h-5 w-5 mr-2" />
                Cash Rides Blocked
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Accept Ride • ${request.driverPayout.toFixed(2)}
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => setShowDeclineDialog(true)}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            data-testid="button-decline-ride"
          >
            {declineMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Declining...
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 mr-2" />
                Decline
              </>
            )}
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this ride?</AlertDialogTitle>
            <AlertDialogDescription>
              This ride will be offered to other drivers. You can continue receiving new requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDecline()}>
              Decline Ride
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
