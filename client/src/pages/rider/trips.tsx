import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Car,
  MapPin,
  Clock,
  Calendar,
  Search,
  Plus,
  ChevronRight,
  Star,
  Navigation,
} from "lucide-react";

interface Trip {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  distance: number;
  duration: number;
  driverName?: string;
  driverRating?: number;
  vehicleInfo?: string;
  scheduledFor?: string;
  createdAt: string;
  completedAt?: string;
}

function TripCard({ trip }: { trip: Trip }) {
  const statusColors: Record<string, string> = {
    requested: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    accepted: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    arriving: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    in_progress: "bg-green-500/20 text-green-700 dark:text-green-400",
    completed: "bg-muted text-muted-foreground",
    canceled: "bg-red-500/20 text-red-700 dark:text-red-400",
  };

  return (
    <Card className="hover-elevate" data-testid={`trip-card-${trip.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {new Date(trip.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(trip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <Badge className={statusColors[trip.status] || "bg-muted"}>
            {trip.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <div className="mt-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <div className="w-px h-4 bg-border mx-auto" />
            <div className="h-2 w-2 rounded-full bg-red-500" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm truncate">{trip.pickupAddress}</p>
            <p className="text-sm text-muted-foreground truncate">{trip.dropoffAddress}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>${trip.fare.toFixed(2)}</span>
            <span>{trip.distance.toFixed(1)} km</span>
            <span>{trip.duration} min</span>
          </div>
          <Link href={`/rider/trips/${trip.id}`}>
            <Button variant="ghost" size="sm" data-testid={`button-trip-details-${trip.id}`}>
              Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        {trip.driverName && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {trip.driverName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{trip.driverName}</p>
              <p className="text-xs text-muted-foreground">{trip.vehicleInfo}</p>
            </div>
            {trip.driverRating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                <span className="text-sm">{trip.driverRating}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RiderTrips() {
  const searchParams = useSearch();
  const isNewTrip = searchParams.includes("start=new");
  const [activeTab, setActiveTab] = useState<string>(isNewTrip ? "new" : "upcoming");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tripsData, isLoading } = useQuery<{
    upcoming: Trip[];
    past: Trip[];
  }>({
    queryKey: ["/api/customer/trips"],
  });

  const upcomingTrips = tripsData?.upcoming || [];
  const pastTrips = tripsData?.past || [];

  const filteredPastTrips = pastTrips.filter((trip) =>
    trip.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trip.dropoffAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-trips-title">
            Rides
          </h1>
          <p className="text-muted-foreground">
            Manage your trips and bookings
          </p>
        </div>
        <Link href="/rider/trips?start=new">
          <Button data-testid="button-new-trip">
            <Plus className="h-4 w-4 mr-2" />
            Book Ride
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming-trips">
            <Clock className="h-4 w-4 mr-2" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past-trips">
            <Calendar className="h-4 w-4 mr-2" />
            Past
          </TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-new-trip">
            <Plus className="h-4 w-4 mr-2" />
            New Ride
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : upcomingTrips.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Navigation className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No upcoming trips</h3>
                <p className="text-muted-foreground mb-4">
                  Book a ride to get started
                </p>
                <Link href="/rider/trips?start=new">
                  <Button data-testid="button-book-ride-empty-state">
                    <Plus className="h-4 w-4 mr-2" />
                    Book a Ride
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search past trips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-trips"
            />
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPastTrips.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No past trips</h3>
                <p className="text-muted-foreground">
                  Your trip history will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPastTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Where are you going?
              </CardTitle>
              <CardDescription>
                Enter your destination to book a ride
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <Input
                    placeholder="Enter pickup location"
                    data-testid="input-pickup-location"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <Input
                    placeholder="Enter destination"
                    data-testid="input-destination"
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Recent places</p>
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start h-auto py-3" data-testid="button-recent-place-home">
                    <MapPin className="h-4 w-4 mr-3 text-muted-foreground" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Home</p>
                      <p className="text-xs text-muted-foreground">123 Main Street</p>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start h-auto py-3" data-testid="button-recent-place-work">
                    <MapPin className="h-4 w-4 mr-3 text-muted-foreground" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Work</p>
                      <p className="text-xs text-muted-foreground">456 Office Park</p>
                    </div>
                  </Button>
                </div>
              </div>

              <Button className="w-full" size="lg" data-testid="button-find-rides">
                <Car className="h-4 w-4 mr-2" />
                Find Rides
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
