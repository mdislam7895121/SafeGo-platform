import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import IncomingTaskPopup from "@/components/driver/IncomingTaskPopup";
import ActiveTaskNavigation from "@/components/driver/ActiveTaskNavigation";
import {
  Car,
  Utensils,
  Package,
  Power,
  PowerOff,
  MapPin,
  Loader2,
  Wifi,
  WifiOff,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DriverProfile {
  id: string;
  isVerified: boolean;
  driverStatus: "offline" | "available" | "busy";
  isOnline: boolean;
  totalEarnedToday: number;
  totalEarnedThisWeek: number;
  canRide: boolean;
  canFoodDelivery: boolean;
  canParcelDelivery: boolean;
}

interface TaskAssignment {
  id: string;
  serviceType: "ride" | "food" | "parcel";
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  restaurantName?: string;
  estimatedEarnings: number;
  distanceToPickupKm?: number;
  etaToPickupMinutes?: number;
  remainingSeconds: number;
  timeoutSeconds: number;
}

interface ActiveTask {
  navSession: any;
  assignment: any;
  taskDetails: any;
}

export default function DriverLiveAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGoingOnline, setIsGoingOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<TaskAssignment | null>(null);

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<{
    driver: DriverProfile;
    earnings: any;
  }>({
    queryKey: ["/api/driver/delivery/dashboard"],
  });

  const { data: nextTaskData, refetch: refetchNextTask } = useQuery<{
    assignment: TaskAssignment | null;
  }>({
    queryKey: ["/api/driver/task/next"],
    enabled: dashboardData?.driver?.isOnline === true,
    refetchInterval: dashboardData?.driver?.isOnline ? 3000 : false,
  });

  const { data: activeTaskData } = useQuery<{ activeTask: ActiveTask | null }>({
    queryKey: ["/api/driver/task/active"],
    enabled: dashboardData?.driver?.driverStatus === "busy",
    refetchInterval: dashboardData?.driver?.driverStatus === "busy" ? 5000 : false,
  });

  const goOnlineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/driver/delivery/go-online", {
        lat: currentLocation?.lat,
        lng: currentLocation?.lng,
      });
      return response.json();
    },
    onSuccess: async () => {
      const pools = [];
      if (dashboardData?.driver?.canRide) pools.push("ride_pool");
      if (dashboardData?.driver?.canFoodDelivery) pools.push("food_pool");
      if (dashboardData?.driver?.canParcelDelivery) pools.push("parcel_pool");

      if (pools.length > 0) {
        await apiRequest("POST", "/api/driver/pool/join", {
          pools,
          lat: currentLocation?.lat,
          lng: currentLocation?.lng,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/driver/delivery/dashboard"] });
      toast({
        title: "You are now online",
        description: "Waiting for incoming tasks...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to go online",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setIsGoingOnline(false),
  });

  const goOfflineMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/driver/pool/leave", {});
      const response = await apiRequest("POST", "/api/driver/delivery/go-offline", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/delivery/dashboard"] });
      toast({
        title: "You are now offline",
        description: "You will not receive new tasks",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to go offline",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("[Location] Error:", error);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    if (nextTaskData?.assignment && !pendingAssignment && dashboardData?.driver?.driverStatus !== "busy") {
      setPendingAssignment(nextTaskData.assignment);
    }
  }, [nextTaskData?.assignment, pendingAssignment, dashboardData?.driver?.driverStatus]);

  const handleToggleOnline = useCallback(() => {
    if (dashboardData?.driver?.isOnline) {
      goOfflineMutation.mutate();
    } else {
      setIsGoingOnline(true);
      goOnlineMutation.mutate();
    }
  }, [dashboardData?.driver?.isOnline, goOnlineMutation, goOfflineMutation]);

  const handleTaskAccepted = useCallback(() => {
    setPendingAssignment(null);
    queryClient.invalidateQueries({ queryKey: ["/api/driver/delivery/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/driver/task/active"] });
  }, [queryClient]);

  const handleTaskRejected = useCallback(() => {
    setPendingAssignment(null);
    refetchNextTask();
  }, [refetchNextTask]);

  const handleTaskExpired = useCallback(() => {
    setPendingAssignment(null);
    refetchNextTask();
    toast({
      title: "Task Expired",
      description: "The task offer has timed out",
      variant: "destructive",
    });
  }, [refetchNextTask, toast]);

  const handleTaskCompleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/driver/delivery/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/driver/task/next"] });
    refetchNextTask();
  }, [queryClient, refetchNextTask]);

  if (isDashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const driver = dashboardData?.driver;
  const isOnline = driver?.isOnline || false;
  const isBusy = driver?.driverStatus === "busy";
  const canGoOnline = driver?.isVerified === true;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <Card data-testid="card-online-status">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Driver Status</CardTitle>
            <Badge variant={isOnline ? "default" : "secondary"} className="gap-1">
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!canGoOnline && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Complete verification to go online and receive tasks
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${
                  isOnline ? "bg-green-100 dark:bg-green-900" : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                {isOnline ? (
                  <Power className="h-6 w-6 text-green-600" />
                ) : (
                  <PowerOff className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {isBusy ? "On a Task" : isOnline ? "Waiting for Tasks" : "Go Online to Start"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isBusy
                    ? "Complete your current task"
                    : isOnline
                    ? "You will receive task offers"
                    : "Toggle to start receiving tasks"}
                </p>
              </div>
            </div>
            <Switch
              checked={isOnline}
              onCheckedChange={handleToggleOnline}
              disabled={!canGoOnline || isGoingOnline || isBusy || goOnlineMutation.isPending || goOfflineMutation.isPending}
              data-testid="switch-online-status"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
              <Car className={`h-5 w-5 mb-1 ${driver?.canRide ? "text-blue-500" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Rides</span>
              <Badge variant={driver?.canRide ? "default" : "outline"} className="mt-1 text-xs">
                {driver?.canRide ? "Active" : "Disabled"}
              </Badge>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
              <Utensils className={`h-5 w-5 mb-1 ${driver?.canFoodDelivery ? "text-orange-500" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Food</span>
              <Badge variant={driver?.canFoodDelivery ? "default" : "outline"} className="mt-1 text-xs">
                {driver?.canFoodDelivery ? "Active" : "Disabled"}
              </Badge>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
              <Package className={`h-5 w-5 mb-1 ${driver?.canParcelDelivery ? "text-purple-500" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Parcel</span>
              <Badge variant={driver?.canParcelDelivery ? "default" : "outline"} className="mt-1 text-xs">
                {driver?.canParcelDelivery ? "Active" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-earnings-summary">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Today's Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-bold text-green-600">
                ${(driver?.totalEarnedToday || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold text-blue-600">
                ${(driver?.totalEarnedThisWeek || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isBusy && activeTaskData?.activeTask && (
        <ActiveTaskNavigation onTaskCompleted={handleTaskCompleted} />
      )}

      {isOnline && !isBusy && !pendingAssignment && (
        <Card className="border-dashed" data-testid="card-waiting-tasks">
          <CardContent className="py-12 text-center">
            <div className="relative mx-auto w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <MapPin className="absolute inset-0 m-auto h-6 w-6 text-primary" />
            </div>
            <p className="text-lg font-medium">Looking for tasks nearby...</p>
            <p className="text-muted-foreground">
              Stay online to receive ride, food, and parcel delivery requests
            </p>
          </CardContent>
        </Card>
      )}

      {pendingAssignment && (
        <IncomingTaskPopup
          assignment={pendingAssignment}
          onAccepted={handleTaskAccepted}
          onRejected={handleTaskRejected}
          onExpired={handleTaskExpired}
        />
      )}
    </div>
  );
}
