import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Navigation, User, Car, Phone, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function RideDetails() {
  const { id } = useParams();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/rides/${id}`],
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/rides/${id}/status`, {
        status: "cancelled_by_customer",
      });
    },
    onSuccess: () => {
      toast({
        title: "Ride cancelled",
        description: "Your ride has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/rides/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      requested: "bg-blue-500",
      searching_driver: "bg-yellow-500",
      accepted: "bg-green-500",
      driver_arriving: "bg-green-600",
      in_progress: "bg-purple-500",
      completed: "bg-gray-500",
      cancelled_by_customer: "bg-red-500",
      cancelled_by_driver: "bg-red-600",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const canCancel = (status: string) => {
    return ["requested", "searching_driver", "accepted", "driver_arriving"].includes(status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const ride = data?.ride;

  if (!ride) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Ride not found</p>
            <Link href="/customer/activity">
              <Button className="mt-4">Back to Activity</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer/activity">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground"
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Ride Details</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Status</CardTitle>
              <Badge className={getStatusColor(ride.status)} data-testid="badge-status">
                {getStatusLabel(ride.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Pickup</p>
                <p className="font-medium" data-testid="text-pickup">
                  {ride.pickupAddress}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Navigation className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Dropoff</p>
                <p className="font-medium" data-testid="text-dropoff">
                  {ride.dropoffAddress}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Info */}
        {ride.driver && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Driver Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium" data-testid="text-driver-email">
                  {ride.driver.email}
                </p>
              </div>

              {ride.driver.vehicle && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium" data-testid="text-vehicle">
                      {ride.driver.vehicle.vehicleType} - {ride.driver.vehicle.vehicleModel}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">License Plate</p>
                    <p className="font-medium font-mono" data-testid="text-plate">
                      {ride.driver.vehicle.vehiclePlate}
                    </p>
                  </div>
                </>
              )}

              {ride.driverRating && (
                <div>
                  <p className="text-sm text-muted-foreground">Your Rating</p>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < ride.driverRating ? "fill-yellow-500 text-yellow-500" : "text-gray-300"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium">{ride.driverRating}/5</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Fare</span>
              <span className="font-medium" data-testid="text-fare">
                ${parseFloat(ride.serviceFare).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium capitalize" data-testid="text-payment">
                {ride.paymentMethod}
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium">Total</span>
              <span className="font-bold text-lg" data-testid="text-total">
                ${parseFloat(ride.serviceFare).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {canCancel(ride.status) && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            data-testid="button-cancel-ride"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Ride"}
          </Button>
        )}

        {ride.status === "completed" && !ride.driverRating && (
          <Card className="bg-muted">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Rate your experience to help us improve our service
              </p>
              <Button className="mt-3">Rate Driver</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
