import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSwipeable } from "react-swipeable";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Phone, 
  Navigation, 
  Shield, 
  Clock, 
  MapPin, 
  ChevronDown,
  Car,
  UtensilsCrossed,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  CreditCard,
  Banknote,
  XCircle,
  Share2,
  AlertOctagon,
  ChevronRight,
  Timer,
  Route,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { SafeGoMap, type ActiveLeg } from "@/components/maps/SafeGoMap";

type TripStatusType = "accepted" | "arriving" | "arrived" | "started" | "completed" | "cancelled" | "in_progress" | "picked_up" | "in_transit";

interface ActiveTrip {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  status: TripStatusType;
  tripCode: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  driverLat: number | null;
  driverLng: number | null;
  estimatedArrivalMinutes: number;
  estimatedTripMinutes: number;
  distanceKm: number;
  fare: number;
  paymentMethod?: "card" | "cash" | "wallet";
  customer: {
    firstName: string;
    lastName?: string;
    phone: string | null;
    rating?: number;
  };
  restaurantName?: string;
  rideType?: string;
  createdAt: string;
  startedAt?: string;
}

const navigationApps = [
  { id: "safego", name: "SafeGo Map", icon: MapPin, description: "Use in-app navigation" },
  { id: "google", name: "Google Maps", icon: ExternalLink, description: "Open in Google Maps" },
  { id: "apple", name: "Apple Maps", icon: ExternalLink, description: "Open in Apple Maps" },
  { id: "waze", name: "Waze", icon: ExternalLink, description: "Open in Waze" },
];

const statusConfig: Record<string, { label: string; sublabel: string; color: string; bgColor: string; progress: number }> = {
  accepted: { label: "Heading to pickup", sublabel: "Navigate to pickup location", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", progress: 20 },
  arriving: { label: "Heading to pickup", sublabel: "Almost there", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30", progress: 35 },
  arrived: { label: "Waiting for rider", sublabel: "You've arrived at pickup", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", progress: 50 },
  started: { label: "On trip to destination", sublabel: "Drive safely", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", progress: 75 },
  in_progress: { label: "On trip to destination", sublabel: "Delivery in progress", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", progress: 75 },
  picking_up: { label: "Heading to pickup", sublabel: "Navigate to pickup location", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", progress: 30 },
  at_restaurant: { label: "At restaurant", sublabel: "Waiting for order", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", progress: 45 },
  picked_up: { label: "Order picked up", sublabel: "Navigate to customer", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", progress: 60 },
  completed: { label: "Trip completed", sublabel: "Earnings added to wallet", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30", progress: 100 },
  delivered: { label: "Delivery completed", sublabel: "Earnings added to wallet", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30", progress: 100 },
  cancelled: { label: "Cancelled", sublabel: "Trip was cancelled", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", progress: 0 },
};

function getServiceIcon(serviceType: string) {
  switch (serviceType) {
    case "RIDE": return Car;
    case "FOOD": return UtensilsCrossed;
    case "PARCEL": return Package;
    default: return Car;
  }
}

function getServiceLabel(serviceType: string, rideType?: string) {
  if (rideType) return rideType;
  switch (serviceType) {
    case "RIDE": return "Ride";
    case "FOOD": return "Food Delivery";
    case "PARCEL": return "Parcel";
    default: return "Trip";
  }
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

function triggerHapticFeedback(type: "light" | "medium" | "heavy" = "medium") {
  if (navigator.vibrate) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
}

function formatWaitTime(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function SwipeToComplete({ 
  onComplete, 
  label, 
  isPending 
}: { 
  onComplete: () => void; 
  label: string; 
  isPending: boolean;
}) {
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(300);
  
  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (isPending || isCompleting) return;
      const progress = Math.min(Math.max(e.deltaX / (containerWidth - 80), 0), 1);
      setSwipeProgress(progress);
      if (progress > 0.1) triggerHapticFeedback("light");
    },
    onSwipedRight: (e) => {
      if (isPending || isCompleting) return;
      const progress = e.deltaX / (containerWidth - 80);
      if (progress >= 0.85) {
        setIsCompleting(true);
        triggerHapticFeedback("heavy");
        setSwipeProgress(1);
        setTimeout(() => {
          onComplete();
          setIsCompleting(false);
          setSwipeProgress(0);
        }, 300);
      } else {
        setSwipeProgress(0);
      }
    },
    onTouchEndOrOnMouseUp: () => {
      if (!isCompleting && swipeProgress < 0.85) {
        setSwipeProgress(0);
      }
    },
    trackMouse: true,
    trackTouch: true,
  });

  return (
    <div 
      ref={(el) => {
        if (el) setContainerWidth(el.offsetWidth);
        if (el) handlers.ref(el);
      }}
      className="relative h-16 bg-primary/10 dark:bg-primary/20 rounded-2xl overflow-hidden border-2 border-primary/30 cursor-grab active:cursor-grabbing"
      data-testid="swipe-to-complete"
      onMouseDown={handlers.onMouseDown}
    >
      <div 
        className="absolute inset-y-0 left-0 bg-primary/30 transition-all duration-100"
        style={{ width: `${swipeProgress * 100}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-primary/70 select-none">
          {isPending ? "Completing..." : `Swipe to ${label}`}
        </span>
        <ChevronRight className="h-5 w-5 ml-1 text-primary/50 animate-pulse" />
      </div>
      <motion.div
        className="absolute top-1 left-1 bottom-1 w-14 bg-primary rounded-xl flex items-center justify-center shadow-lg"
        animate={{ x: swipeProgress * (containerWidth - 64) }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        data-testid="swipe-handle"
      >
        {isPending || isCompleting ? (
          <Loader2 className="h-6 w-6 text-primary-foreground animate-spin" />
        ) : (
          <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
        )}
      </motion.div>
    </div>
  );
}

interface GpsSnapshot {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export default function DriverTripActive() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [waitTime, setWaitTime] = useState("0:00");
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [liveEta, setLiveEta] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<string | null>(null);
  const [currentGpsPosition, setCurrentGpsPosition] = useState<GpsSnapshot | null>(null);

  const { data: activeTripData, isLoading, error, refetch } = useQuery<{ activeTrip: ActiveTrip | null; hasActiveTrip: boolean }>({
    queryKey: ["/api/driver/trips/active"],
    refetchInterval: pollingEnabled ? 2000 : false,
  });

  const { data: preferences } = useQuery<{ preferredNavigationApp?: string }>({
    queryKey: ["/api/driver/preferences"],
  });

  const preferredNavApp = preferences?.preferredNavigationApp || "google";
  const activeTrip = activeTripData?.activeTrip;

  useEffect(() => {
    if (activeTrip && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentGpsPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        (err) => {
          console.warn("GPS tracking error:", err.message);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [activeTrip?.id]);

  useEffect(() => {
    if (activeTrip?.status === "arrived" && activeTrip?.createdAt) {
      const interval = setInterval(() => {
        setWaitTime(formatWaitTime(activeTrip.createdAt));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTrip?.status, activeTrip?.createdAt]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ tripId, status, serviceType, gpsSnapshot }: { 
      tripId: string; 
      status: string; 
      serviceType: string;
      gpsSnapshot?: GpsSnapshot | null;
    }) => {
      const payload: Record<string, unknown> = { status };
      
      if (status === "completed" && gpsSnapshot) {
        payload.completionLocation = {
          lat: gpsSnapshot.lat,
          lng: gpsSnapshot.lng,
          accuracy: gpsSnapshot.accuracy,
          timestamp: gpsSnapshot.timestamp,
        };
      }
      
      return apiRequest(`/api/driver/trips/${tripId}/status?serviceType=${serviceType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips/active"] });
      triggerHapticFeedback("medium");
      
      const statusLabels: Record<string, string> = {
        arriving: "On the way to pickup",
        arrived: "Arrived at pickup location",
        started: "Trip started - drive safely!",
        completed: "Trip completed! Earnings added.",
      };
      
      toast({
        title: statusLabels[variables.status] || "Status updated",
        description: variables.status === "completed" ? "Great job!" : undefined,
      });
      
      if (variables.status === "completed") {
        setPollingEnabled(false);
        setTimeout(() => {
          setLocation("/driver/trips");
        }, 2500);
      }
    },
    onError: (error: any) => {
      triggerHapticFeedback("heavy");
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    return () => {
      setPollingEnabled(false);
    };
  }, []);

  const handleStatusUpdate = useCallback((newStatus: string) => {
    if (!activeTrip) return;
    
    if (newStatus === "completed") {
      setPendingCompletion(newStatus);
      setShowConfirmDialog(true);
      return;
    }
    
    updateStatusMutation.mutate({
      tripId: activeTrip.id,
      status: newStatus,
      serviceType: activeTrip.serviceType,
    });
  }, [activeTrip, updateStatusMutation]);

  const handleConfirmCompletion = useCallback(() => {
    if (!activeTrip || !pendingCompletion) return;
    
    updateStatusMutation.mutate({
      tripId: activeTrip.id,
      status: pendingCompletion,
      serviceType: activeTrip.serviceType,
      gpsSnapshot: currentGpsPosition,
    });
    
    setShowConfirmDialog(false);
    setPendingCompletion(null);
  }, [activeTrip, pendingCompletion, currentGpsPosition, updateStatusMutation]);

  const handleCancelCompletion = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingCompletion(null);
  }, []);

  const logNavigationEvent = useCallback(async (tripId: string, appName: string) => {
    try {
      await apiRequest("/api/driver/trips/log-navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, navigationApp: appName }),
      });
    } catch (err) {
      console.warn("Failed to log navigation event:", err);
    }
  }, []);

  const handleOpenNavigation = (appId: string) => {
    if (!activeTrip) return;
    
    if (appId === "safego" || preferredNavApp === "safego") {
      logNavigationEvent(activeTrip.id, "safego");
      toast({ 
        title: "Using SafeGo Map", 
        description: "Follow the route shown on the map above." 
      });
      return;
    }
    
    const isHeadingToPickup = ["accepted", "arriving"].includes(activeTrip.status);
    const targetLat = isHeadingToPickup ? activeTrip.pickupLat : activeTrip.dropoffLat;
    const targetLng = isHeadingToPickup ? activeTrip.pickupLng : activeTrip.dropoffLng;
    
    if (targetLat && targetLng) {
      logNavigationEvent(activeTrip.id, appId);
      const url = buildNavigationUrl(appId, targetLat, targetLng);
      window.open(url, "_blank");
      triggerHapticFeedback("light");
    } else {
      toast({
        title: "Location unavailable",
        description: "Cannot open navigation - coordinates not available",
        variant: "destructive",
      });
    }
  };

  const handleDistanceCalculated = useCallback((distanceKm: number, etaMinutes: number) => {
    setLiveDistance(distanceKm);
    setLiveEta(etaMinutes);
  }, []);

  const handleShareTrip = () => {
    if (!activeTrip) return;
    const shareUrl = `${window.location.origin}/track/${activeTrip.id}`;
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
    triggerHapticFeedback("light");
  };

  const getActiveLeg = (): ActiveLeg => {
    if (!activeTrip) return "to_pickup";
    if (["accepted", "arriving"].includes(activeTrip.status)) return "to_pickup";
    if (["arrived", "started", "in_progress", "picked_up"].includes(activeTrip.status)) return "to_dropoff";
    return "completed";
  };

  const getNextAction = () => {
    if (!activeTrip) return null;
    
    const serviceType = activeTrip.serviceType;
    const status = activeTrip.status;
    
    if (serviceType === "RIDE") {
      switch (status) {
        case "accepted":
          return { label: "I'm On My Way", status: "arriving", swipe: false };
        case "arriving":
          return { label: "I've Arrived", status: "arrived", swipe: false };
        case "arrived":
          return { label: "Start Trip", status: "started", swipe: false };
        case "started":
          return { label: "Complete Trip", status: "completed", swipe: true };
        default:
          return null;
      }
    } else if (serviceType === "FOOD") {
      switch (status) {
        case "accepted":
          return { label: "Head to Restaurant", status: "arriving", swipe: false };
        case "arriving":
        case "picked_up":
          return { label: "Arrived at Restaurant", status: "arrived", swipe: false };
        case "arrived":
        case "in_transit":
          return { label: "Order Picked Up", status: "started", swipe: false };
        case "started":
          return { label: "Deliver Order", status: "completed", swipe: true };
        default:
          return null;
      }
    } else if (serviceType === "PARCEL") {
      switch (status) {
        case "accepted":
          return { label: "Head to Pickup", status: "arriving", swipe: false };
        case "arriving":
        case "picked_up":
          return { label: "Parcel Collected", status: "arrived", swipe: false };
        case "arrived":
        case "in_transit":
          return { label: "Started Delivery", status: "started", swipe: false };
        case "started":
          return { label: "Deliver Parcel", status: "completed", swipe: true };
        default:
          return null;
      }
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div 
          className="text-center space-y-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground font-medium">Loading active trip...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">Unable to Load Trip</h2>
            <p className="text-muted-foreground">There was an error loading your active trip.</p>
            <Button onClick={() => refetch()} data-testid="button-retry">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <motion.div 
        className="p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-20 w-20 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Car className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">No Active Trip</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                You don't have an active trip. New requests will appear here.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/driver/dashboard">
                <Button variant="outline" data-testid="link-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/driver/trips">
                <Button data-testid="link-trip-history">
                  Trip History
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const ServiceIcon = getServiceIcon(activeTrip.serviceType);
  const statusInfo = statusConfig[activeTrip.status] || statusConfig.accepted;
  const nextAction = getNextAction();
  const activeLeg = getActiveLeg();
  const paymentType = activeTrip.paymentMethod || "card";
  const displayEta = liveEta ?? (activeLeg === "to_pickup" ? activeTrip.estimatedArrivalMinutes : activeTrip.estimatedTripMinutes);
  const displayDistance = liveDistance ?? activeTrip.distanceKm;

  return (
    <motion.div 
      className="flex flex-col h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="active-trip-screen"
    >
      <div className={`px-4 py-3 ${statusInfo.bgColor}`} data-testid="status-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl bg-background shadow-sm ${statusInfo.color}`} data-testid="icon-service-type">
              <ServiceIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-base font-bold ${statusInfo.color} truncate`} data-testid="text-status-label">{statusInfo.label}</h2>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-status-sublabel">{statusInfo.sublabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                {paymentType === "cash" ? (
                  <Banknote className="h-4 w-4 text-green-600" data-testid="icon-payment-cash" />
                ) : (
                  <CreditCard className="h-4 w-4 text-blue-600" data-testid="icon-payment-card" />
                )}
                <span className="text-lg font-bold" data-testid="text-fare">${activeTrip.fare.toFixed(2)}</span>
              </div>
              <Badge variant="secondary" className="text-[10px]" data-testid="badge-service-type">
                {getServiceLabel(activeTrip.serviceType, activeTrip.rideType)}
              </Badge>
            </div>
          </div>
        </div>
        <Progress value={statusInfo.progress} className="h-1 mt-3" data-testid="progress-trip" />
      </div>

      <div className="flex-1 relative min-h-[220px] md:min-h-[300px]">
        <SafeGoMap
          driverLocation={activeTrip.driverLat && activeTrip.driverLng ? {
            lat: activeTrip.driverLat,
            lng: activeTrip.driverLng,
            label: "Your location",
          } : { lat: 40.7128, lng: -74.006, label: "Your location" }}
          pickupLocation={activeTrip.pickupLat && activeTrip.pickupLng ? {
            lat: activeTrip.pickupLat,
            lng: activeTrip.pickupLng,
            label: activeTrip.pickupAddress,
          } : null}
          dropoffLocation={activeTrip.dropoffLat && activeTrip.dropoffLng ? {
            lat: activeTrip.dropoffLat,
            lng: activeTrip.dropoffLng,
            label: activeTrip.dropoffAddress,
          } : null}
          activeLeg={activeLeg}
          autoFollow={true}
          showEtaOverlay={true}
          onDistanceCalculated={handleDistanceCalculated}
          className="h-full w-full"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTrip.status}
          className="p-4 space-y-3 bg-background border-t"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 border-2 border-primary/20" data-testid="avatar-customer">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {activeTrip.customer.firstName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base" data-testid="text-customer-name">
                        {activeTrip.customer.firstName}
                        {activeTrip.customer.lastName ? ` ${activeTrip.customer.lastName.charAt(0)}.` : ""}
                      </h3>
                      {activeTrip.customer.rating && (
                        <div className="flex items-center gap-1 mt-0.5" data-testid="rating-customer">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium" data-testid="text-customer-rating">{activeTrip.customer.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {activeTrip.restaurantName && (
                      <Badge variant="outline" className="flex-shrink-0" data-testid="badge-restaurant">
                        {activeTrip.restaurantName}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-white">A</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="text-sm font-medium truncate" data-testid="text-pickup-address">
                          {activeTrip.pickupAddress}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-white">B</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Dropoff</p>
                        <p className="text-sm font-medium truncate" data-testid="text-dropoff-address">
                          {activeTrip.dropoffAddress}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t" data-testid="trip-metrics">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5" data-testid="metric-distance">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-distance">{displayDistance.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center gap-1.5" data-testid="metric-eta">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-eta">{displayEta} min</span>
                  </div>
                  {activeTrip.status === "arrived" && (
                    <div className="flex items-center gap-1.5" data-testid="metric-wait-time">
                      <Timer className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-500" data-testid="text-wait-time">{waitTime}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground" data-testid="text-trip-code">{activeTrip.tripCode}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4">
                {activeTrip.customer.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-col h-auto py-3 gap-1"
                    asChild
                    data-testid="button-call-customer"
                  >
                    <a href={`tel:${activeTrip.customer.phone}`}>
                      <Phone className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Call</span>
                    </a>
                  </Button>
                )}
                {!activeTrip.customer.phone && (
                  <Link href={`/driver/support?tripId=${activeTrip.id}&context=active_trip`}>
                    <Button variant="outline" size="sm" className="w-full flex-col h-auto py-3 gap-1" data-testid="button-message">
                      <MessageSquare className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Message</span>
                    </Button>
                  </Link>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-col h-auto py-3 gap-1"
                  onClick={handleShareTrip}
                  data-testid="button-share"
                >
                  <Share2 className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Share</span>
                </Button>
                <Link href={`/driver/safety?tripId=${activeTrip.id}`}>
                  <Button variant="outline" size="sm" className="w-full flex-col h-auto py-3 gap-1 border-red-200 dark:border-red-900/50" data-testid="button-sos">
                    <AlertOctagon className="h-5 w-5 text-red-500" />
                    <span className="text-[10px] font-medium text-red-500">SOS</span>
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1" data-testid="button-navigation-menu">
                      <Navigation className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Navigate</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {navigationApps.map((app) => (
                      <DropdownMenuItem
                        key={app.id}
                        onClick={() => handleOpenNavigation(app.id)}
                        className="cursor-pointer py-2.5"
                        data-testid={`menu-item-nav-${app.id}`}
                      >
                        <app.icon className="h-4 w-4 mr-2.5" />
                        <div className="flex-1">
                          <p className="font-medium">{app.name}</p>
                          <p className="text-[10px] text-muted-foreground">{app.description}</p>
                        </div>
                        {app.id === preferredNavApp && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Default
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <Link href="/driver/account/navigation">
                      <DropdownMenuItem className="cursor-pointer">
                        <span className="text-xs text-muted-foreground">Change default navigation app</span>
                      </DropdownMenuItem>
                    </Link>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {nextAction && (
            <div className="space-y-2">
              {nextAction.swipe ? (
                <SwipeToComplete
                  onComplete={() => handleStatusUpdate(nextAction.status)}
                  label={nextAction.label}
                  isPending={updateStatusMutation.isPending}
                />
              ) : (
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold"
                  onClick={() => handleStatusUpdate(nextAction.status)}
                  disabled={updateStatusMutation.isPending}
                  data-testid="button-next-action"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    nextAction.label
                  )}
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-6 pt-1">
            <Link href={`/driver/safety?tripId=${activeTrip.id}&action=report`}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive text-xs"
                data-testid="button-report-issue"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Report Issue
              </Button>
            </Link>
            <Link href={`/driver/support?tripId=${activeTrip.id}&action=cancel`}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive text-xs"
                data-testid="button-cancel-trip"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Cancel Trip
              </Button>
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent data-testid="dialog-confirm-completion">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Trip Completion</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTrip.serviceType === "RIDE" 
                ? "Are you sure you want to complete this ride? The fare will be calculated and added to your earnings."
                : activeTrip.serviceType === "FOOD"
                ? "Confirm that the order has been delivered to the customer. The delivery fee will be added to your earnings."
                : "Confirm that the parcel has been delivered. The delivery fee will be added to your earnings."
              }
              {!currentGpsPosition && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                  GPS location not available. Trip will be completed without location verification.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelCompletion} data-testid="button-cancel-completion">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCompletion} 
              disabled={updateStatusMutation.isPending}
              data-testid="button-confirm-completion"
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                "Complete Trip"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
