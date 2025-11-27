import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Power,
  PowerOff,
  MapPin,
  Navigation,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  WifiOff,
  Battery,
  Car,
  Bell,
  BellOff,
  RefreshCw,
  ChevronLeft,
  Settings,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { IncomingTripRequest, type TripRequest } from "@/components/driver/IncomingTripRequest";

interface DriverStatus {
  isOnline: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  availabilityStatus: string;
  hasActiveTrip: boolean;
  activeTripId: string | null;
  currentLat: number | null;
  currentLng: number | null;
}

interface PendingRequestsResponse {
  requests: TripRequest[];
  message?: string;
}

const POLLING_INTERVAL_ONLINE = 3000;
const POLLING_INTERVAL_OFFLINE = 10000;

export default function DriverTripRequestsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isGoingOnline, setIsGoingOnline] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<TripRequest | null>(null);
  const [declinedRequestIds, setDeclinedRequestIds] = useState<Set<string>>(new Set());
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const lastLocationUpdate = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const { data: driverStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<DriverStatus>({
    queryKey: ["/api/driver/trips/driver-status"],
    refetchInterval: 5000,
    retry: 2,
  });

  const { data: pendingRequests, isLoading: requestsLoading, error: requestsError } = useQuery<PendingRequestsResponse>({
    queryKey: ["/api/driver/trips/requests/pending"],
    enabled: driverStatus?.isOnline && !driverStatus?.hasActiveTrip,
    refetchInterval: driverStatus?.isOnline ? POLLING_INTERVAL_ONLINE : POLLING_INTERVAL_OFFLINE,
    retry: 1,
    staleTime: 1000,
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async (isOnline: boolean) => {
      const response = await apiRequest("/api/driver/trips/driver-status", {
        method: "POST",
        body: JSON.stringify({ isOnline }),
      });
      return response;
    },
    onSuccess: (data, isOnline) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips/driver-status"] });
      toast({
        title: isOnline ? "You're now online" : "You're now offline",
        description: isOnline
          ? "You'll receive trip requests nearby"
          : "You won't receive new trip requests",
      });
      setIsGoingOnline(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsGoingOnline(false);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ requestId, serviceType }: { requestId: string; serviceType: string }) => {
      const position = await getCurrentPosition();
      const response = await apiRequest(`/api/driver/trips/requests/${requestId}/accept`, {
        method: "POST",
        body: JSON.stringify({
          serviceType,
          driverLat: position?.coords.latitude,
          driverLng: position?.coords.longitude,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips"] });
      toast({
        title: "Trip accepted!",
        description: "Navigate to the pickup location",
      });
      setCurrentRequest(null);
      navigate("/driver/active-trip");
    },
    onError: (error: any) => {
      toast({
        title: "Could not accept trip",
        description: error.message || "The trip may have been taken by another driver",
        variant: "destructive",
      });
      setCurrentRequest(null);
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips/requests/pending"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      serviceType, 
      reason, 
      autoDeclined 
    }: { 
      requestId: string; 
      serviceType: string; 
      reason?: string;
      autoDeclined?: boolean;
    }) => {
      const response = await apiRequest(`/api/driver/trips/requests/${requestId}/decline`, {
        method: "POST",
        body: JSON.stringify({ serviceType, reason, autoDeclined }),
      });
      return response;
    },
    onSuccess: (data, variables) => {
      setDeclinedRequestIds((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.add(variables.requestId);
        return newSet;
      });
      setCurrentRequest(null);
      if (!variables.autoDeclined) {
        toast({
          title: "Trip declined",
          description: "Looking for other trips nearby",
        });
      }
    },
    onError: () => {
      setCurrentRequest(null);
    },
  });

  const getCurrentPosition = (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    });
  };

  const updateLocationToServer = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastLocationUpdate.current < 30000) return;
    lastLocationUpdate.current = now;

    try {
      await apiRequest("/api/driver/trips/update-location", {
        method: "POST",
        body: JSON.stringify({ lat, lng }),
      });
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (driverStatus?.isOnline && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          updateLocationToServer(position.coords.latitude, position.coords.longitude);
          setConnectionError(false);
        },
        (error) => {
          console.warn("Geolocation error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [driverStatus?.isOnline, updateLocationToServer]);

  useEffect(() => {
    if (pendingRequests?.requests && pendingRequests.requests.length > 0 && !currentRequest) {
      const availableRequest = pendingRequests.requests.find(
        (req) => !declinedRequestIds.has(req.id)
      );
      if (availableRequest) {
        setCurrentRequest(availableRequest);
      }
    }
  }, [pendingRequests, currentRequest, declinedRequestIds]);

  useEffect(() => {
    if (driverStatus?.hasActiveTrip && driverStatus?.activeTripId) {
      navigate("/driver/active-trip");
    }
  }, [driverStatus?.hasActiveTrip, driverStatus?.activeTripId, navigate]);

  useEffect(() => {
    if (requestsError) {
      setConnectionError(true);
    }
  }, [requestsError]);

  const handleToggleOnline = () => {
    if (driverStatus?.isOnline) {
      setShowOfflineConfirm(true);
    } else {
      setIsGoingOnline(true);
      toggleOnlineMutation.mutate(true);
    }
  };

  const handleConfirmOffline = () => {
    setShowOfflineConfirm(false);
    toggleOnlineMutation.mutate(false);
  };

  const handleAccept = (tripId: string, serviceType: string) => {
    acceptMutation.mutate({ requestId: tripId, serviceType });
  };

  const handleDecline = (tripId: string, serviceType: string, reason?: string) => {
    declineMutation.mutate({ requestId: tripId, serviceType, reason });
  };

  const handleExpire = (tripId: string) => {
    const request = currentRequest;
    if (request) {
      declineMutation.mutate({
        requestId: tripId,
        serviceType: request.serviceType,
        autoDeclined: true,
      });
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading driver status...</p>
        </div>
      </div>
    );
  }

  if (!driverStatus?.isVerified) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Verification Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account needs to be verified before you can receive trip requests.
              Please complete your profile and upload required documents.
            </p>
            <Button onClick={() => navigate("/driver/documents")} className="w-full">
              Complete Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (driverStatus?.isSuspended) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Account Suspended
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your driver account has been suspended. Please contact support for assistance.
            </p>
            <Button onClick={() => navigate("/driver/support")} className="w-full">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver/dashboard")}
            data-testid="button-back-dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Trip Requests</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver/settings")}
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        <div className="space-y-4">
          <Card className="border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      driverStatus?.isOnline
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-muted"
                    }`}
                  >
                    {driverStatus?.isOnline ? (
                      <Power className="h-6 w-6 text-green-600" />
                    ) : (
                      <PowerOff className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p 
                      className="font-semibold"
                      data-testid="text-online-status"
                    >
                      {driverStatus?.isOnline ? "Online" : "Offline"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {driverStatus?.isOnline
                        ? "Receiving trip requests"
                        : "Go online to receive trips"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={driverStatus?.isOnline || false}
                  onCheckedChange={handleToggleOnline}
                  disabled={toggleOnlineMutation.isPending || isGoingOnline}
                  data-testid="switch-online-toggle"
                />
              </div>
            </CardContent>
          </Card>

          {connectionError && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="p-4 flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Connection issue
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Having trouble reaching the server
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConnectionError(false);
                    refetchStatus();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {driverStatus?.isOnline && (
            <AnimatePresence mode="wait">
              <motion.div
                key="online-content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Looking for trips</h3>
                      {requestsLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="relative">
                        <MapPin className="h-5 w-5 text-primary" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Your location</p>
                        <p className="text-xs text-muted-foreground">
                          {driverStatus?.currentLat && driverStatus?.currentLng
                            ? `${driverStatus.currentLat.toFixed(4)}, ${driverStatus.currentLng.toFixed(4)}`
                            : "Updating..."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Scanning for requests...</span>
                        <span className="text-muted-foreground">
                          {pendingRequests?.requests?.length || 0} available
                        </span>
                      </div>
                      <Progress value={100} className="h-1" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium">Tips for more trips</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Navigation className="h-4 w-4 mt-0.5 text-blue-500" />
                        Move to busy areas during peak hours
                      </li>
                      <li className="flex items-start gap-2">
                        <Clock className="h-4 w-4 mt-0.5 text-orange-500" />
                        Stay online during rush hours (7-9 AM, 5-8 PM)
                      </li>
                      <li className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 mt-0.5 text-green-500" />
                        Check surge areas for higher earnings
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}

          {!driverStatus?.isOnline && (
            <AnimatePresence mode="wait">
              <motion.div
                key="offline-content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                      <Car className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Ready to drive?</h3>
                      <p className="text-muted-foreground mt-1">
                        Go online to start receiving trip requests in your area
                      </p>
                    </div>
                    <Button
                      size="lg"
                      onClick={handleToggleOnline}
                      disabled={toggleOnlineMutation.isPending || isGoingOnline}
                      className="w-full"
                      data-testid="button-go-online"
                    >
                      {isGoingOnline || toggleOnlineMutation.isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Going online...
                        </>
                      ) : (
                        <>
                          <Power className="h-5 w-5 mr-2" />
                          Go Online
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-3">Recent earnings</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-lg font-bold">$0</p>
                        <p className="text-xs text-muted-foreground">Today</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-lg font-bold">0</p>
                        <p className="text-xs text-muted-foreground">Trips</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-lg font-bold">0h</p>
                        <p className="text-xs text-muted-foreground">Online</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <AnimatePresence>
        {currentRequest && (
          <IncomingTripRequest
            key={currentRequest.id}
            request={currentRequest}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onExpire={handleExpire}
            countdownSeconds={15}
          />
        )}
      </AnimatePresence>

      <AlertDialog open={showOfflineConfirm} onOpenChange={setShowOfflineConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go offline?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't receive new trip requests while offline. Your current earnings
              will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay Online</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOffline}>
              Go Offline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
