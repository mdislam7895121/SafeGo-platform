import { Link } from "wouter";
import { ArrowLeft, User, Clock, Car, MapPin, Navigation } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Ride {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  serviceFare: number;
  status: string;
  driver: {
    email: string;
    vehicle: {
      vehicleType: string;
      vehicleModel: string;
      vehiclePlate: string;
    } | null;
  } | null;
  createdAt: string;
}

export default function CustomerActivity() {
  const { data, isLoading } = useQuery<{ rides: Ride[] }>({
    queryKey: ["/api/customer/rides"],
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Activity</h1>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : !data?.rides || data.rides.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
              <p className="text-muted-foreground text-sm">
                Your ride, food, and parcel delivery history will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          data.rides.map((ride) => (
            <Card key={ride.id} data-testid={`ride-${ride.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Ride</CardTitle>
                  <Badge className={getStatusColor(ride.status)} data-testid={`status-${ride.id}`}>
                    {getStatusLabel(ride.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Navigation className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pickup</p>
                    <p className="font-medium">{ride.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dropoff</p>
                    <p className="font-medium">{ride.dropoffAddress}</p>
                  </div>
                </div>
                {ride.driver && (
                  <div className="flex items-start gap-3 pt-2 border-t">
                    <Car className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Driver</p>
                      <p className="font-medium">{ride.driver.email}</p>
                      {ride.driver.vehicle && (
                        <p className="text-sm text-muted-foreground">
                          {ride.driver.vehicle.vehicleModel} - {ride.driver.vehicle.vehiclePlate}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {new Date(ride.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-lg font-bold">${Number(ride.serviceFare).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border h-16 flex items-center justify-around px-6">
        <Link href="/customer">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-home">
            <Car className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
        </Link>
        <Link href="/customer/activity">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-activity">
            <Clock className="h-5 w-5 text-primary" />
            <span className="text-xs text-primary font-medium">Activity</span>
          </Button>
        </Link>
        <Link href="/customer/profile">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-profile">
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
