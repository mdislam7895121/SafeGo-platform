import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Car,
  Star,
  AlertOctagon,
  Share2,
  X,
  Loader2,
  CheckCircle2,
  Navigation,
  Route,
  ChevronRight,
} from "lucide-react";
import { SafeGoMap } from "@/components/maps/SafeGoMap";
import { useRideBooking } from "@/contexts/RideBookingContext";
import { useToast } from "@/hooks/use-toast";

interface ActiveRide {
  id: string;
  status: "requested" | "searching_driver" | "accepted" | "driver_arriving" | "arrived" | "in_progress" | "completed" | "cancelled_by_customer" | "cancelled_by_driver";
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  serviceFare: number;
  paymentMethod: string;
  driver?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    rating?: number;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licensePlate?: string;
    photoUrl?: string;
    currentLat?: number;
    currentLng?: number;
  };
  estimatedArrivalMinutes?: number;
  estimatedTripMinutes?: number;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; sublabel: string; color: string; bgColor: string; progress: number }> = {
  requested: { label: "Finding Driver", sublabel: "Searching for available drivers...", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", progress: 10 },
  searching_driver: { label: "Finding Driver", sublabel: "Matching you with the best driver...", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", progress: 20 },
  accepted: { label: "Driver Assigned", sublabel: "Your driver is preparing to pick you up", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", progress: 30 },
  driver_arriving: { label: "Driver on the Way", sublabel: "Your driver is heading to pickup", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30", progress: 50 },
  arrived: { label: "Driver Arrived", sublabel: "Your driver is waiting at pickup location", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", progress: 60 },
  in_progress: { label: "On Your Way", sublabel: "Enjoy your ride!", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", progress: 80 },
  completed: { label: "Trip Completed", sublabel: "Thanks for riding with SafeGo!", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30", progress: 100 },
  cancelled_by_customer: { label: "Cancelled", sublabel: "You cancelled this ride", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", progress: 0 },
  cancelled_by_driver: { label: "Cancelled", sublabel: "Driver cancelled this ride", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", progress: 0 },
};

function SearchingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center">
          <Car className="h-10 w-10 text-primary animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="mt-4 text-lg font-medium">Finding your driver...</p>
      <p className="text-sm text-muted-foreground">This usually takes 1-3 minutes</p>
    </div>
  );
}

export default function RiderTripActivePage() {
  const [, setLocation] = useLocation();
  const { state: bookingState, clearBooking } = useRideBooking();
  const { toast } = useToast();
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const rideId = bookingState.activeRideId;

  const { data: rideData, isLoading, error } = useQuery<{ ride: ActiveRide }>({
    queryKey: ["/api/rides", rideId],
    enabled: !!rideId && pollingEnabled,
    refetchInterval: pollingEnabled ? 5000 : false,
  });

  const ride = rideData?.ride;

  useEffect(() => {
    if (ride?.status === "completed" || ride?.status?.startsWith("cancelled")) {
      setPollingEnabled(false);
    }
  }, [ride?.status]);

  const handleShareTrip = () => {
    if (!ride) return;
    const shareUrl = `${window.location.origin}/track/${ride.id}`;
    if (navigator.share) {
      navigator.share({
        title: "Track my SafeGo trip",
        text: "Follow my trip in real-time",
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Trip tracking link copied to clipboard" });
    }
  };

  const handleCallDriver = () => {
    if (ride?.driver?.phone) {
      window.open(`tel:${ride.driver.phone}`, "_self");
    } else {
      toast({ title: "Phone unavailable", description: "Driver's phone number is not available yet" });
    }
  };

  const handleGoHome = () => {
    clearBooking();
    setLocation("/rider/home");
  };

  if (!rideId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6" data-testid="no-active-trip">
        <Car className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Active Trip</h2>
        <p className="text-muted-foreground text-center mb-4">
          You don't have an active trip right now.
        </p>
        <Link href="/rider/ride/new">
          <Button data-testid="button-book-new-ride">Book a Ride</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6" data-testid="trip-error">
        <AlertOctagon className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground text-center mb-4">
          Unable to load trip details. Please try again.
        </p>
        <Button onClick={() => setLocation("/rider/home")} data-testid="button-go-home-error">
          Go Home
        </Button>
      </div>
    );
  }

  const config = statusConfig[ride.status] || statusConfig.requested;
  const isSearching = ["requested", "searching_driver"].includes(ride.status);
  const hasDriver = !!ride.driver;
  const isCompleted = ride.status === "completed";
  const isCancelled = ride.status?.startsWith("cancelled");

  return (
    <div className="flex flex-col h-full" data-testid="rider-trip-active-page">
      <div className={`p-4 ${config.bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="secondary" className={`${config.color} bg-white/80 dark:bg-black/30`}>
              {config.label}
            </Badge>
            <p className="text-sm mt-1">{config.sublabel}</p>
          </div>
          {!isCompleted && !isCancelled && (
            <Progress value={config.progress} className="w-20 h-2" />
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-[200px]">
        {isSearching ? (
          <div className="h-full flex items-center justify-center bg-muted/30">
            <SearchingAnimation />
          </div>
        ) : (
          <SafeGoMap
            driverLocation={ride.driver?.currentLat && ride.driver?.currentLng ? {
              lat: ride.driver.currentLat,
              lng: ride.driver.currentLng,
              label: `${ride.driver.firstName}'s location`,
            } : null}
            pickupLocation={ride.pickupLat && ride.pickupLng ? {
              lat: ride.pickupLat,
              lng: ride.pickupLng,
              label: ride.pickupAddress,
            } : null}
            dropoffLocation={ride.dropoffLat && ride.dropoffLng ? {
              lat: ride.dropoffLat,
              lng: ride.dropoffLng,
              label: ride.dropoffAddress,
            } : null}
            activeLeg={ride.status === "in_progress" ? "to_dropoff" : "to_pickup"}
            showEtaOverlay={true}
            autoFollow={true}
            className="h-full w-full"
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={ride.status}
          className="p-4 border-t bg-background space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {hasDriver && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    <AvatarImage src={ride.driver?.photoUrl} alt={ride.driver?.firstName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {ride.driver?.firstName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold" data-testid="text-driver-name">
                        {ride.driver?.firstName}
                        {ride.driver?.lastName ? ` ${ride.driver.lastName.charAt(0)}.` : ""}
                      </h3>
                      {ride.driver?.rating && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-0.5" />
                          {ride.driver.rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    {ride.driver?.vehicleMake && (
                      <p className="text-sm text-muted-foreground" data-testid="text-vehicle-info">
                        {ride.driver.vehicleColor} {ride.driver.vehicleMake} {ride.driver.vehicleModel}
                      </p>
                    )}
                    {ride.driver?.licensePlate && (
                      <Badge variant="outline" className="mt-1 font-mono" data-testid="text-license-plate">
                        {ride.driver.licensePlate}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCallDriver}
                      data-testid="button-call-driver"
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" data-testid="button-message-driver">
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">A</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm font-medium truncate" data-testid="text-trip-pickup">
                      {ride.pickupAddress}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">B</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-sm font-medium truncate" data-testid="text-trip-dropoff">
                      {ride.dropoffAddress}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-4 text-sm">
                  {ride.estimatedArrivalMinutes && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {ride.estimatedArrivalMinutes} min
                    </span>
                  )}
                </div>
                <p className="font-bold text-lg" data-testid="text-trip-fare">
                  ৳{Number(ride.serviceFare).toFixed(0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {!isCompleted && !isCancelled && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleShareTrip}
                  data-testid="button-share-trip"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Trip
                </Button>
                <Link href={`/rider/support?tripId=${ride.id}`} className="flex-1">
                  <Button variant="outline" className="w-full" data-testid="button-trip-help">
                    <AlertOctagon className="h-4 w-4 mr-2 text-red-500" />
                    Help
                  </Button>
                </Link>
              </>
            )}
            {(isCompleted || isCancelled) && (
              <Button className="w-full" onClick={handleGoHome} data-testid="button-done">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
