import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { decodePolyline } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Send,
  AlertCircle,
  Receipt,
  ThumbsUp,
} from "lucide-react";
import { SafeGoMap } from "@/components/maps/SafeGoMap";
import { useRideBooking } from "@/contexts/RideBookingContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ActiveRide {
  id: string;
  status: "requested" | "searching_driver" | "accepted" | "driver_arriving" | "arrived" | "in_progress" | "completed" | "cancelled_by_customer" | "cancelled_by_driver";
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  routePolyline?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  trafficEtaSeconds?: number;
  serviceFare: number;
  tollAmount?: number;
  surgeMultiplier?: number;
  paymentMethod: string;
  currentLeg?: string;
  driver?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    rating?: number;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehicleYear?: number;
    licensePlate?: string;
    photoUrl?: string;
    currentLat?: number;
    currentLng?: number;
    lastLocationUpdate?: string;
  };
  estimatedArrivalMinutes?: number;
  estimatedTripMinutes?: number;
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  tripStartedAt?: string;
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

function LiveEtaCountdown({ 
  baseEtaSeconds, 
  startTime, 
  label 
}: { 
  baseEtaSeconds: number; 
  startTime: string; 
  label: string;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(baseEtaSeconds);

  useEffect(() => {
    const startDate = new Date(startTime).getTime();
    const calculateRemaining = () => {
      const elapsed = Math.floor((Date.now() - startDate) / 1000);
      const remaining = Math.max(0, baseEtaSeconds - elapsed);
      setRemainingSeconds(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [baseEtaSeconds, startTime]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg" data-testid="eta-countdown">
      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
        <Clock className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">
          {minutes > 0 ? `${minutes}m ` : ""}{seconds.toString().padStart(2, "0")}s
        </p>
      </div>
    </div>
  );
}

const CANCEL_REASONS = [
  { value: "changed_mind", label: "Changed my mind" },
  { value: "driver_too_far", label: "Driver is too far away" },
  { value: "wrong_pickup", label: "Wrong pickup location" },
  { value: "price_too_high", label: "Price is too high" },
  { value: "found_alternative", label: "Found alternative transport" },
  { value: "other", label: "Other reason" },
];

interface ChatMessage {
  id: string;
  senderType: "customer" | "driver";
  message: string;
  createdAt: string;
  senderName?: string;
}

export default function RiderTripActivePage() {
  const [, setLocation] = useLocation();
  const { state: bookingState, clearBooking } = useRideBooking();
  const { toast } = useToast();
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [hasRated, setHasRated] = useState(false);

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

  // Chat messages query
  const { data: chatData, refetch: refetchChat } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["/api/rides", rideId, "chat"],
    enabled: !!rideId && showChatDrawer && !!ride?.driver,
    refetchInterval: showChatDrawer ? 3000 : false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest(`/api/rides/${rideId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: () => {
      setChatMessage("");
      refetchChat();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Cancel ride mutation
  const cancelRideMutation = useMutation({
    mutationFn: async (data: { reason: string; notes?: string }) => {
      return apiRequest(`/api/rides/${rideId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      setShowCancelModal(false);
      toast({
        title: "Ride cancelled",
        description: data.cancellationFee > 0 
          ? `A $${data.cancellationFee.toFixed(2)} cancellation fee has been applied.`
          : "Your ride has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel ride",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessageMutation.mutate(chatMessage.trim());
    }
  };

  const handleCancelRide = () => {
    if (cancelReason) {
      cancelRideMutation.mutate({ reason: cancelReason });
    }
  };

  // Rating mutation
  const rateRideMutation = useMutation({
    mutationFn: async (data: { rating: number; comment?: string }) => {
      return apiRequest(`/api/rides/${rideId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, raterType: "customer" }),
      });
    },
    onSuccess: () => {
      setShowRatingModal(false);
      setHasRated(true);
      toast({
        title: "Thank you for your feedback!",
        description: "Your rating helps improve our service.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit rating",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmitRating = () => {
    rateRideMutation.mutate({ rating, comment: ratingComment || undefined });
  };

  // Show rating modal when trip is completed
  useEffect(() => {
    if (ride?.status === "completed" && !hasRated && !showRatingModal) {
      const timer = setTimeout(() => setShowRatingModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [ride?.status, hasRated, showRatingModal]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current && chatData?.messages) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatData?.messages]);

  // Determine if cancellation fee applies
  const showCancelFeeWarning = ride && ["accepted", "driver_arriving", "arrived"].includes(ride.status);

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

  const routeCoordinates = useMemo(() => {
    if (ride?.routePolyline) {
      return decodePolyline(ride.routePolyline);
    }
    return undefined;
  }, [ride?.routePolyline]);

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
            routeCoordinates={routeCoordinates}
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
                        {ride.driver.vehicleColor} {ride.driver.vehicleYear ? `${ride.driver.vehicleYear} ` : ""}{ride.driver.vehicleMake} {ride.driver.vehicleModel}
                      </p>
                    )}
                    {ride.driver?.licensePlate && (
                      <Badge variant="outline" className="mt-1 font-mono text-base px-3" data-testid="text-license-plate">
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
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setShowChatDrawer(true)}
                      data-testid="button-message-driver"
                    >
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live ETA Countdown */}
          {hasDriver && !isCompleted && !isCancelled && ride.trafficEtaSeconds && ride.acceptedAt && (
            <LiveEtaCountdown
              baseEtaSeconds={ride.trafficEtaSeconds}
              startTime={ride.status === "in_progress" && ride.tripStartedAt ? ride.tripStartedAt : ride.acceptedAt}
              label={ride.status === "in_progress" ? "Arriving at destination in" : "Driver arriving in"}
            />
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
                  Share
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => setShowCancelModal(true)}
                  data-testid="button-cancel-ride"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Link href={`/rider/support?tripId=${ride.id}`} className="flex-1">
                  <Button variant="outline" className="w-full" data-testid="button-trip-help">
                    <AlertOctagon className="h-4 w-4 mr-2 text-red-500" />
                    Help
                  </Button>
                </Link>
              </>
            )}
            {isCompleted && (
              <>
                {!hasRated && (
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowRatingModal(true)}
                    data-testid="button-rate-ride"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Rate
                  </Button>
                )}
                <Link href={`/rider/trip/${ride.id}/receipt`} className="flex-1">
                  <Button variant="outline" className="w-full" data-testid="button-view-receipt">
                    <Receipt className="h-4 w-4 mr-2" />
                    Receipt
                  </Button>
                </Link>
                <Button className="flex-1" onClick={handleGoHome} data-testid="button-done">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Done
                </Button>
              </>
            )}
            {isCancelled && (
              <Button className="w-full" onClick={handleGoHome} data-testid="button-done">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Cancel Ride Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Ride</DialogTitle>
            <DialogDescription>
              Please tell us why you want to cancel this ride.
            </DialogDescription>
          </DialogHeader>
          
          {showCancelFeeWarning && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Cancellation fee may apply</p>
                <p className="text-amber-700 dark:text-amber-300">
                  Since a driver has been assigned, a small cancellation fee may be charged.
                </p>
              </div>
            </div>
          )}
          
          <RadioGroup value={cancelReason} onValueChange={setCancelReason} className="space-y-2">
            {CANCEL_REASONS.map((reason) => (
              <div key={reason.value} className="flex items-center space-x-3 p-3 border rounded-lg hover-elevate cursor-pointer">
                <RadioGroupItem value={reason.value} id={reason.value} />
                <Label htmlFor={reason.value} className="flex-1 cursor-pointer">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Keep Ride
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancelRide}
              disabled={!cancelReason || cancelRideMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelRideMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Cancel Ride
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Drawer */}
      <Drawer open={showChatDrawer} onOpenChange={setShowChatDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat with {ride.driver?.name || "Driver"}
            </DrawerTitle>
          </DrawerHeader>
          
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]"
          >
            {(!chatData?.messages || chatData.messages.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Send a message to your driver</p>
              </div>
            ) : (
              chatData.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === "customer" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.senderType === "customer"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { 
                        hour: "2-digit", 
                        minute: "2-digit" 
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!chatMessage.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">How was your ride?</DialogTitle>
            <DialogDescription className="text-center">
              Rate your experience with {ride?.driver?.firstName || "your driver"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-6">
            {ride?.driver && (
              <Avatar className="h-16 w-16 mb-4">
                <AvatarFallback className="text-xl">
                  {ride.driver.firstName?.charAt(0) || "D"}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                  data-testid={`button-star-${star}`}
                >
                  <Star 
                    className={`h-10 w-10 ${
                      star <= rating 
                        ? "fill-yellow-400 text-yellow-400" 
                        : "text-gray-300"
                    }`} 
                  />
                </button>
              ))}
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              {rating === 5 ? "Excellent!" : 
               rating === 4 ? "Great!" : 
               rating === 3 ? "Good" : 
               rating === 2 ? "Fair" : "Poor"}
            </p>
            
            <Textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Add a comment (optional)"
              className="w-full"
              rows={3}
              data-testid="textarea-rating-comment"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRatingModal(false);
                setHasRated(true);
              }}
            >
              Skip
            </Button>
            <Button 
              onClick={handleSubmitRating}
              disabled={rateRideMutation.isPending}
              data-testid="button-submit-rating"
            >
              {rateRideMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ThumbsUp className="h-4 w-4 mr-2" />
              )}
              Submit Rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
