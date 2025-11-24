import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverPreviewCard, DriverPublicProfile } from "@/components/DriverPreviewCard";
import { ArrowLeft, MapPin, Navigation, Clock, DollarSign, Phone, MessageCircle } from "lucide-react";

export default function RideAssigned() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/customer/ride-assigned/:id");
  const id = params?.id;

  const { data: rideData, isLoading: isLoadingRide } = useQuery<{ ride: any }>({
    queryKey: [`/api/rides/${id}`],
    refetchInterval: 5000,
  });

  const ride = rideData?.ride;
  const driverProfileId = ride?.driver?.id;

  const { data: driverProfile, isLoading: isLoadingDriver } = useQuery<DriverPublicProfile>({
    queryKey: ['/api/driver/public-profile', driverProfileId],
    enabled: !!driverProfileId,
  });

  if (isLoadingRide) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <p className="text-muted-foreground">Ride not found</p>
            <Button onClick={() => setLocation("/customer")} className="mt-4" data-testid="button-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-white p-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/customer/activity")}
              className="text-white hover:bg-white/10"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Driver Assigned!</h1>
              <p className="text-sm text-white/80">Your driver is on the way</p>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0" data-testid="badge-status">
              In Progress
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {driverProfileId && (
          <>
            {isLoadingDriver ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-8 w-48" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-[180px] w-full mt-4" />
                  <Skeleton className="h-16 w-full mt-4" />
                </CardContent>
              </Card>
            ) : driverProfile ? (
              <DriverPreviewCard profile={driverProfile} show3DPreview={true} />
            ) : null}
          </>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" data-testid="button-call">
            <Phone className="h-4 w-4 mr-2" />
            Call Driver
          </Button>
          <Button variant="outline" className="flex-1" data-testid="button-message">
            <MessageCircle className="h-4 w-4 mr-2" />
            Message
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ride Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Navigation className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Pickup</p>
                <p className="font-medium" data-testid="text-pickup">
                  {ride.pickupAddress}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Dropoff</p>
                <p className="font-medium" data-testid="text-dropoff">
                  {ride.dropoffAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Estimated Fare</p>
                <p className="text-lg font-bold" data-testid="text-fare">
                  ${Number(ride.serviceFare).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Requested</p>
                <p className="font-medium" data-testid="text-time">
                  {new Date(ride.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => setLocation("/customer")}
          className="w-full"
          data-testid="button-done"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
