import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  Utensils,
  Package,
  MapPin,
  Navigation,
  DollarSign,
  Clock,
  X,
  Check,
  Phone,
  Store,
} from "lucide-react";

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

interface IncomingTaskPopupProps {
  assignment: TaskAssignment;
  onAccepted: (assignment: TaskAssignment) => void;
  onRejected: () => void;
  onExpired: () => void;
}

const SERVICE_ICONS = {
  ride: Car,
  food: Utensils,
  parcel: Package,
};

const SERVICE_LABELS = {
  ride: "Ride Request",
  food: "Food Delivery",
  parcel: "Parcel Delivery",
};

const SERVICE_COLORS = {
  ride: "bg-blue-500",
  food: "bg-orange-500",
  parcel: "bg-purple-500",
};

export function IncomingTaskPopup({
  assignment,
  onAccepted,
  onRejected,
  onExpired,
}: IncomingTaskPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [remainingTime, setRemainingTime] = useState(assignment.remainingSeconds);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/driver/task/accept", {
        assignmentId: assignment.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Task Accepted",
        description: "Navigate to pickup location",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/task/next"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/task/active"] });
      onAccepted(assignment);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/driver/task/reject", {
        assignmentId: assignment.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Task Declined",
        description: "Waiting for next task...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/task/next"] });
      onRejected();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (remainingTime <= 0) {
      onExpired();
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpired, remainingTime]);

  const handleAccept = useCallback(() => {
    if (!acceptMutation.isPending && !rejectMutation.isPending) {
      acceptMutation.mutate();
    }
  }, [acceptMutation, rejectMutation]);

  const handleReject = useCallback(() => {
    if (!acceptMutation.isPending && !rejectMutation.isPending) {
      rejectMutation.mutate();
    }
  }, [acceptMutation, rejectMutation]);

  const ServiceIcon = SERVICE_ICONS[assignment.serviceType];
  const progressPercent = (remainingTime / assignment.timeoutSeconds) * 100;
  const isUrgent = remainingTime <= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 animate-in fade-in duration-200">
      <Card
        className={`w-full max-w-md shadow-xl border-2 ${
          isUrgent ? "border-destructive animate-pulse" : "border-primary"
        }`}
        data-testid="popup-incoming-task"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${SERVICE_COLORS[assignment.serviceType]} text-white`}>
                <ServiceIcon className="h-5 w-5" />
              </div>
              <div>
                <Badge variant="secondary" className="text-sm">
                  {SERVICE_LABELS[assignment.serviceType]}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={`font-mono text-lg font-bold ${isUrgent ? "text-destructive" : ""}`}>
                {remainingTime}s
              </span>
            </div>
          </div>
          <Progress
            value={progressPercent}
            className={`h-2 mt-2 ${isUrgent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Estimated Earnings</span>
              <div className="flex items-center gap-1">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {assignment.estimatedEarnings.toFixed(2)}
                </span>
              </div>
            </div>
            {assignment.distanceToPickupKm && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Distance to pickup</span>
                <span className="font-medium">{assignment.distanceToPickupKm.toFixed(1)} km</span>
              </div>
            )}
            {assignment.etaToPickupMinutes && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ETA to pickup</span>
                <span className="font-medium">{assignment.etaToPickupMinutes} min</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {assignment.serviceType === "food" && assignment.restaurantName && (
              <div className="flex items-start gap-3">
                <Store className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Restaurant</p>
                  <p className="font-medium">{assignment.restaurantName}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <MapPin className="h-5 w-5 text-green-600 shrink-0" />
                {assignment.dropoffAddress && (
                  <>
                    <div className="w-0.5 h-4 bg-muted-foreground/30" />
                    <Navigation className="h-5 w-5 text-red-500 shrink-0" />
                  </>
                )}
              </div>
              <div className="space-y-2 flex-1">
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm font-medium line-clamp-2">{assignment.pickupAddress}</p>
                </div>
                {assignment.dropoffAddress && (
                  <div>
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-sm font-medium line-clamp-2">{assignment.dropoffAddress}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-3 pt-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={handleReject}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            data-testid="button-reject-task"
          >
            <X className="h-5 w-5 mr-2" />
            Decline
          </Button>
          <Button
            size="lg"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleAccept}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            data-testid="button-accept-task"
          >
            <Check className="h-5 w-5 mr-2" />
            {acceptMutation.isPending ? "Accepting..." : "Accept"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default IncomingTaskPopup;
