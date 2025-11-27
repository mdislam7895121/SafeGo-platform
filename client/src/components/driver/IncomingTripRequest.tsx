import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  Star,
  User,
  ChevronRight,
  X,
  Car,
  UtensilsCrossed,
  Package,
  Zap,
  TrendingUp,
  AlertCircle,
  Loader2,
  Battery,
  BatteryLow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TripRequestMapPreview } from "./TripRequestMapPreview";

export interface TripRequest {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  customerName: string;
  customerRating: number | null;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  estimatedFare: number;
  distanceToPickup: number | null;
  etaMinutes: number | null;
  surgeMultiplier: number | null;
  boostAmount: number | null;
  requestedAt: string;
  expiresAt: string;
}

interface IncomingTripRequestProps {
  request: TripRequest;
  onAccept: (tripId: string, serviceType: string) => void;
  onDecline: (tripId: string, serviceType: string, reason?: string) => void;
  onExpire: (tripId: string) => void;
  countdownSeconds?: number;
}

const serviceIcons = {
  RIDE: Car,
  FOOD: UtensilsCrossed,
  PARCEL: Package,
};

const serviceLabels = {
  RIDE: "Ride Request",
  FOOD: "Food Delivery",
  PARCEL: "Parcel Delivery",
};

const serviceColors = {
  RIDE: "bg-blue-500",
  FOOD: "bg-orange-500",
  PARCEL: "bg-purple-500",
};

function IncomingTripRequestComponent({
  request,
  onAccept,
  onDecline,
  onExpire,
  countdownSeconds = 15,
}: IncomingTripRequestProps) {
  const [timeLeft, setTimeLeft] = useState(countdownSeconds);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const requestShownAt = useRef(Date.now());
  const swipeThreshold = 200;

  const ServiceIcon = serviceIcons[request.serviceType];

  useEffect(() => {
    requestShownAt.current = Date.now();
    
    if (!hasTriggeredHaptic) {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
      
      try {
        audioRef.current = new Audio("/notification.mp3");
        audioRef.current.volume = 0.7;
        audioRef.current.play().catch(() => {});
      } catch (e) {}
      
      setHasTriggeredHaptic(true);
    }
  }, [hasTriggeredHaptic]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire(request.id);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, request.id, onExpire]);

  const handleAccept = useCallback(async () => {
    if (isAccepting || isDeclining) return;
    setIsAccepting(true);
    
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    onAccept(request.id, request.serviceType);
  }, [isAccepting, isDeclining, onAccept, request.id, request.serviceType]);

  const handleDecline = useCallback(async (reason?: string) => {
    if (isAccepting || isDeclining) return;
    setIsDeclining(true);
    
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    onDecline(request.id, request.serviceType, reason);
  }, [isAccepting, isDeclining, onDecline, request.id, request.serviceType]);

  const handleSwipe = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const progress = Math.min(Math.max(info.offset.x / swipeThreshold, 0), 1);
      setSwipeProgress(progress);
    },
    []
  );

  const handleSwipeEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x >= swipeThreshold) {
        handleAccept();
      } else {
        setSwipeProgress(0);
      }
    },
    [handleAccept]
  );

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - timeLeft / countdownSeconds);

  const formatDistance = (km: number | null) => {
    if (km === null) return "—";
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        data-testid="modal-incoming-trip-request"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col"
        >
          <div className={`${serviceColors[request.serviceType]} px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2 text-white">
              <ServiceIcon className="h-5 w-5" />
              <span className="font-semibold">{serviceLabels[request.serviceType]}</span>
            </div>
            
            <div className="relative flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
              </svg>
              <span 
                className="absolute text-white font-bold text-lg"
                data-testid="text-countdown-timer"
              >
                {timeLeft}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-border">
                  <AvatarFallback className="text-lg font-semibold bg-muted">
                    {request.customerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 
                    className="font-semibold text-lg truncate"
                    data-testid="text-customer-name"
                  >
                    {request.customerName}
                  </h3>
                  {request.customerRating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span data-testid="text-customer-rating">
                        {request.customerRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {!request.customerRating && (
                    <span className="text-sm text-muted-foreground">New customer</span>
                  )}
                </div>
              </div>

              {(request.surgeMultiplier && request.surgeMultiplier > 1) || request.boostAmount ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {request.surgeMultiplier && request.surgeMultiplier > 1 && (
                    <Badge 
                      variant="secondary" 
                      className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center gap-1"
                      data-testid="badge-surge"
                    >
                      <Zap className="h-3 w-3" />
                      {request.surgeMultiplier.toFixed(1)}x Surge
                    </Badge>
                  )}
                  {request.boostAmount && request.boostAmount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1"
                      data-testid="badge-boost"
                    >
                      <TrendingUp className="h-3 w-3" />
                      +{formatCurrency(request.boostAmount)} Boost
                    </Badge>
                  )}
                </div>
              ) : null}

              <Card className="border-2 border-border">
                <CardContent className="p-3 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-200 dark:ring-green-800" />
                      <div className="w-0.5 h-8 bg-border my-1" />
                      <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-200 dark:ring-red-800" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p 
                          className="text-sm text-muted-foreground"
                          data-testid="label-pickup"
                        >
                          Pickup
                        </p>
                        <p 
                          className="font-medium text-sm line-clamp-2"
                          data-testid="text-pickup-address"
                        >
                          {request.pickupAddress}
                        </p>
                      </div>
                      <div>
                        <p 
                          className="text-sm text-muted-foreground"
                          data-testid="label-dropoff"
                        >
                          Drop-off
                        </p>
                        <p 
                          className="font-medium text-sm line-clamp-2"
                          data-testid="text-dropoff-address"
                        >
                          {request.dropoffAddress}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <Navigation className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p 
                      className="font-semibold text-sm"
                      data-testid="text-distance-to-pickup"
                    >
                      {formatDistance(request.distanceToPickup)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p 
                      className="font-semibold text-sm"
                      data-testid="text-eta-minutes"
                    >
                      {request.etaMinutes ? `${request.etaMinutes} min` : "—"}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-muted-foreground">Est. Fare</p>
                    <p 
                      className="font-semibold text-sm"
                      data-testid="text-estimated-fare"
                    >
                      {formatCurrency(request.estimatedFare)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <TripRequestMapPreview
                pickupLat={request.pickupLat}
                pickupLng={request.pickupLng}
                dropoffLat={request.dropoffLat}
                dropoffLng={request.dropoffLng}
                pickupAddress={request.pickupAddress}
                dropoffAddress={request.dropoffAddress}
              />
            </div>
          </div>

          <div className="p-4 border-t bg-background space-y-3">
            <div className="relative h-14 bg-muted rounded-xl overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-green-500 opacity-20"
                style={{ width: `${swipeProgress * 100}%` }}
              />
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: swipeThreshold }}
                dragElastic={0.1}
                onDrag={handleSwipe}
                onDragEnd={handleSwipeEnd}
                className="absolute left-1 top-1 bottom-1 w-12 bg-green-500 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
                whileTap={{ scale: 0.95 }}
                data-testid="button-swipe-accept"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm font-medium text-muted-foreground ml-8">
                  Swipe to accept
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleDecline()}
                disabled={isAccepting || isDeclining}
                className="h-12 text-base font-medium"
                data-testid="button-decline-trip"
              >
                {isDeclining ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <X className="h-5 w-5 mr-2" />
                )}
                Decline
              </Button>
              
              <Button
                size="lg"
                onClick={handleAccept}
                disabled={isAccepting || isDeclining}
                className="h-12 text-base font-medium bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-accept-trip"
              >
                {isAccepting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Accept
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Request will auto-decline in {timeLeft}s if not accepted
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export const IncomingTripRequest = memo(IncomingTripRequestComponent);
export default IncomingTripRequest;
