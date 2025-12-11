import { Link, useLocation } from "wouter";
import { ArrowLeft, User, Clock, Car, MapPin, Navigation, ChevronRight, UtensilsCrossed, Package, HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [, setLocationRoute] = useLocation();
  
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

  const handleRideClick = (rideId: string, status: string) => {
    if (status === "completed") {
      setLocationRoute(`/customer/trip-receipt/${rideId}`);
    } else if (status === "accepted" || status === "driver_arriving") {
      setLocationRoute(`/customer/ride-assigned/${rideId}`);
    } else {
      setLocationRoute(`/customer/trip-receipt/${rideId}`);
    }
  };

  const rides = data?.rides || [];
  const completedRides = rides.filter(r => r.status === "completed");
  const activeRides = rides.filter(r => r.status !== "completed" && !r.status.includes("cancelled"));

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

      <div className="p-4">
        <Tabs defaultValue="rides" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="rides" data-testid="tab-rides">
              <Car className="h-4 w-4 mr-2" />
              Rides
            </TabsTrigger>
            <TabsTrigger value="food" data-testid="tab-food">
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Food
            </TabsTrigger>
            <TabsTrigger value="parcel" data-testid="tab-parcel">
              <Package className="h-4 w-4 mr-2" />
              Parcel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rides" className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </>
            ) : rides.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Car className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No rides yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Your ride history will appear here
                  </p>
                  <Link href="/customer">
                    <Button data-testid="button-book-first-ride">Book your first ride</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                {activeRides.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Active</h3>
                    {activeRides.map((ride) => (
                      <Card 
                        key={ride.id} 
                        className="mb-3 hover-elevate cursor-pointer"
                        onClick={() => handleRideClick(ride.id, ride.status)}
                        data-testid={`ride-${ride.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Car className="h-5 w-5 text-primary" />
                              <span className="font-medium">SafeGo Ride</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(ride.status)} data-testid={`status-${ride.id}`}>
                                {getStatusLabel(ride.status)}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                              <p className="text-sm truncate flex-1">{ride.pickupAddress}</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                              <p className="text-sm truncate flex-1">{ride.dropoffAddress}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <span className="text-sm text-muted-foreground">
                              {new Date(ride.createdAt).toLocaleDateString()}
                            </span>
                            <span className="font-bold">{formatCurrency(Number(ride.serviceFare), "USD")}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {completedRides.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Past Rides</h3>
                    {completedRides.map((ride) => (
                      <Card 
                        key={ride.id} 
                        className="mb-3 hover-elevate cursor-pointer"
                        onClick={() => handleRideClick(ride.id, ride.status)}
                        data-testid={`ride-${ride.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Car className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">SafeGo Ride</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" data-testid={`status-${ride.id}`}>
                                Completed
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                              <p className="text-sm truncate flex-1">{ride.pickupAddress}</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                              <p className="text-sm truncate flex-1">{ride.dropoffAddress}</p>
                            </div>
                          </div>
                          {ride.driver && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>{ride.driver.email?.split('@')[0]}</span>
                              {ride.driver.vehicle && (
                                <span>• {ride.driver.vehicle.vehicleModel}</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <span className="text-sm text-muted-foreground">
                              {new Date(ride.createdAt).toLocaleDateString()}
                            </span>
                            <span className="font-bold">{formatCurrency(Number(ride.serviceFare), "USD")}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {rides.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">Need help with a ride?</p>
                          <p className="text-xs text-muted-foreground">Contact our support team</p>
                        </div>
                      </div>
                      <Link href="/customer/support">
                        <Button variant="outline" size="sm" data-testid="button-get-help">
                          Get Help
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="food" className="space-y-4">
            <Card>
              <CardContent className="p-12 text-center">
                <UtensilsCrossed className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No food orders yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Your food delivery history will appear here
                </p>
                <Link href="/customer/food">
                  <Button data-testid="button-order-food">Order Food</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parcel" className="space-y-4">
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No parcel deliveries yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Your parcel delivery history will appear here
                </p>
                <Link href="/customer/parcel">
                  <Button data-testid="button-send-parcel">Send a Parcel</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
