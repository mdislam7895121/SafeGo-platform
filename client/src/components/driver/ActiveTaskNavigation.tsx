import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  Utensils,
  Package,
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  User,
  Store,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface ActiveTask {
  navSession: {
    id: string;
    currentLeg: "to_pickup" | "to_dropoff" | "completed";
    currentLat?: number;
    currentLng?: number;
    etaSeconds?: number;
  };
  assignment: {
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
  } | null;
  taskDetails: any;
}

interface ActiveTaskNavigationProps {
  onTaskCompleted: () => void;
}

const SERVICE_ICONS = {
  ride: Car,
  food: Utensils,
  parcel: Package,
};

const SERVICE_LABELS = {
  ride: "Ride in Progress",
  food: "Food Delivery",
  parcel: "Parcel Delivery",
};

const STATUS_FLOWS = {
  ride: {
    to_pickup: ["driver_arriving"],
    to_dropoff: ["in_progress", "completed"],
  },
  food: {
    to_pickup: ["picked_up"],
    to_dropoff: ["on_the_way", "delivered"],
  },
  parcel: {
    to_pickup: ["picked_up"],
    to_dropoff: ["on_the_way", "delivered"],
  },
};

const STATUS_LABELS: Record<string, string> = {
  driver_arriving: "Arrived at Pickup",
  in_progress: "Start Trip",
  completed: "Complete Trip",
  picked_up: "Picked Up",
  on_the_way: "On The Way",
  delivered: "Delivered",
};

export function ActiveTaskNavigation({ onTaskCompleted }: ActiveTaskNavigationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const { data, isLoading, error } = useQuery<{ activeTask: ActiveTask | null }>({
    queryKey: ["/api/driver/task/active"],
    refetchInterval: 5000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: string }) => {
      const response = await apiRequest("POST", "/api/driver/task/update-status", {
        assignmentId,
        status,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/task/active"] });
      if (data.isCompleted) {
        toast({
          title: "Task Completed!",
          description: "Earnings have been added to your wallet",
        });
        onTaskCompleted();
      } else {
        toast({
          title: "Status Updated",
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (location: { lat: number; lng: number; heading?: number; speed?: number }) => {
      const assignmentId = data?.activeTask?.assignment?.id;
      const response = await apiRequest("POST", "/api/driver/navigation/update-location", {
        ...location,
        assignmentId,
      });
      return response.json();
    },
  });

  useEffect(() => {
    if (!data?.activeTask) return;

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateLocationMutation.mutate({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
            });
          },
          (error) => {
            console.error("[Navigation] Location error:", error);
          },
          { enableHighAccuracy: true }
        );
      }
    };

    const interval = setInterval(updateLocation, 10000);
    updateLocation();

    return () => clearInterval(interval);
  }, [data?.activeTask, updateLocationMutation]);

  const handleStatusUpdate = useCallback(
    (status: string) => {
      if (!data?.activeTask?.assignment?.id) return;
      updateStatusMutation.mutate({
        assignmentId: data.activeTask.assignment.id,
        status,
      });
    },
    [data?.activeTask?.assignment?.id, updateStatusMutation]
  );

  const openInMaps = useCallback((lat?: number, lng?: number, address?: string) => {
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.activeTask) {
    return (
      <Card className="w-full">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No Active Task</p>
          <p className="text-muted-foreground">Waiting for new assignments...</p>
        </CardContent>
      </Card>
    );
  }

  const { navSession, assignment, taskDetails } = data.activeTask;
  const serviceType = assignment?.serviceType || "ride";
  const ServiceIcon = SERVICE_ICONS[serviceType];
  const isPickupPhase = navSession.currentLeg === "to_pickup";
  const currentStatuses = STATUS_FLOWS[serviceType]?.[navSession.currentLeg] || [];

  const destinationLat = isPickupPhase
    ? assignment?.pickupLat || taskDetails?.pickupLat
    : assignment?.dropoffLat || taskDetails?.dropoffLat || taskDetails?.deliveryLat;
  const destinationLng = isPickupPhase
    ? assignment?.pickupLng || taskDetails?.pickupLng
    : assignment?.dropoffLng || taskDetails?.dropoffLng || taskDetails?.deliveryLng;
  const destinationAddress = isPickupPhase
    ? assignment?.pickupAddress || taskDetails?.pickupAddress
    : assignment?.dropoffAddress || taskDetails?.dropoffAddress || taskDetails?.deliveryAddress;

  const customerName = taskDetails?.customer?.firstName || "Customer";
  const customerPhone = taskDetails?.customer?.phone;
  const restaurantName = assignment?.restaurantName || taskDetails?.restaurant?.name;
  const restaurantPhone = taskDetails?.restaurant?.phone;

  return (
    <div className="space-y-4">
      <Card className="w-full border-2 border-primary" data-testid="card-active-task">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary text-primary-foreground">
                <ServiceIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{SERVICE_LABELS[serviceType]}</p>
                <Badge variant={isPickupPhase ? "outline" : "default"}>
                  {isPickupPhase ? "Navigate to Pickup" : "Navigate to Dropoff"}
                </Badge>
              </div>
            </div>
            {navSession.etaSeconds && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">ETA</p>
                <p className="font-bold">{Math.ceil(navSession.etaSeconds / 60)} min</p>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {serviceType === "food" && restaurantName && isPickupPhase && (
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">{restaurantName}</p>
                    {restaurantPhone && (
                      <p className="text-sm text-muted-foreground">{restaurantPhone}</p>
                    )}
                  </div>
                </div>
                {restaurantPhone && (
                  <Button size="icon" variant="ghost" asChild>
                    <a href={`tel:${restaurantPhone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {isPickupPhase ? (
                  <MapPin className="h-5 w-5 text-green-600" />
                ) : (
                  <Navigation className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">
                  {isPickupPhase ? "Pickup Location" : "Dropoff Location"}
                </p>
                <p className="font-medium">{destinationAddress}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openInMaps(destinationLat, destinationLng)}
                data-testid="button-open-maps"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Navigate
              </Button>
            </div>
          </div>

          {!isPickupPhase && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">{customerName}</p>
                  {customerPhone && (
                    <p className="text-sm text-muted-foreground">{customerPhone}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {customerPhone && (
                  <>
                    <Button size="icon" variant="outline" asChild>
                      <a href={`tel:${customerPhone}`} data-testid="button-call-customer">
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button size="icon" variant="outline" asChild>
                      <a href={`sms:${customerPhone}`} data-testid="button-message-customer">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {assignment && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <span className="text-muted-foreground">Earnings</span>
              <span className="text-xl font-bold text-green-600">
                ${assignment.estimatedEarnings.toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="flex-col gap-2 pt-4">
          {currentStatuses.map((status) => (
            <Button
              key={status}
              size="lg"
              className="w-full"
              onClick={() => handleStatusUpdate(status)}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-status-${status}`}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5 mr-2" />
              )}
              {STATUS_LABELS[status] || status}
            </Button>
          ))}
        </CardFooter>
      </Card>

      {serviceType === "food" && taskDetails?.items && (
        <Card data-testid="card-order-items">
          <CardHeader className="pb-2">
            <p className="font-semibold">Order Items</p>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {typeof taskDetails.items === "string"
                ? taskDetails.items
                : JSON.stringify(taskDetails.items)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ActiveTaskNavigation;
