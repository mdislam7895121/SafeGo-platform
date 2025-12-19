import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  MapPin,
  Clock,
  DollarSign,
  Star,
  User,
  Car,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Navigation,
  CreditCard,
  Shield,
  Search,
  Map,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TimelineEvent {
  type: string;
  timestamp: string;
  title: string;
  description: string;
  location?: { lat: number; lng: number; address: string } | null;
}

interface PaymentEvent {
  type: string;
  timestamp: string;
  title: string;
  amount: number;
  description: string;
}

interface RideTimelineResponse {
  ride: {
    id: string;
    status: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupLocation?: { lat: number; lng: number } | null;
    dropoffLocation?: { lat: number; lng: number } | null;
    routePolyline?: string | null;
    distanceMiles?: number | null;
    durationMinutes?: number | null;
    fare: number;
    customerRating?: number | null;
    driverRating?: number | null;
    customer: string;
    driver: string;
  };
  timeline: TimelineEvent[];
  safetyEvents: any[];
  paymentEvents: PaymentEvent[];
  anomalies: any[];
}

function RouteMap({ pickup, dropoff }: { 
  pickup?: { lat: number; lng: number } | null; 
  dropoff?: { lat: number; lng: number } | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!pickup && !dropoff) return;

    const center = pickup || dropoff || { lat: 40.7128, lng: -74.006 };
    const map = L.map(mapRef.current).setView([center.lat, center.lng], 13);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    const pickupIcon = L.divIcon({
      className: "custom-marker",
      html: '<div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-lg">A</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const dropoffIcon = L.divIcon({
      className: "custom-marker",
      html: '<div class="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-lg">B</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (pickup) {
      L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
        .addTo(map)
        .bindPopup("Pickup Location");
    }

    if (dropoff) {
      L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon })
        .addTo(map)
        .bindPopup("Dropoff Location");
    }

    if (pickup && dropoff) {
      const routeLine = L.polyline(
        [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ],
        { color: "#3b82f6", weight: 4, opacity: 0.7, dashArray: "10, 10" }
      ).addTo(map);

      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickup, dropoff]);

  if (!pickup && !dropoff) {
    return (
      <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Map className="h-8 w-8 mx-auto mb-2" />
          <p>No location data available</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className="h-[300px] rounded-lg" data-testid="map-route" />;
}

export default function RideTimeline() {
  const params = useParams();
  const [rideIdInput, setRideIdInput] = useState(params.id || "");
  const [searchRideId, setSearchRideId] = useState(params.id || "");

  const { data, isLoading, error } = useQuery<RideTimelineResponse>({
    queryKey: [`/api/admin/phase4/ride-timeline/${searchRideId}`],
    enabled: !!searchRideId,
  });

  const handleSearch = () => {
    if (rideIdInput.trim()) {
      setSearchRideId(rideIdInput.trim());
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "ride_requested":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "driver_accepted":
        return <User className="h-4 w-4 text-green-500" />;
      case "driver_arrived":
        return <MapPin className="h-4 w-4 text-orange-500" />;
      case "trip_started":
        return <Navigation className="h-4 w-4 text-purple-500" />;
      case "trip_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "ride_cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderStars = (rating: number | null | undefined) => {
    if (!rating) return <span className="text-muted-foreground">No rating</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Ride Timeline Viewer"
        description="View detailed ride timeline and events"
        icon={Clock}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter Ride ID to view timeline..."
                  value={rideIdInput}
                  onChange={(e) => setRideIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-8"
                  data-testid="input-ride-id"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search">
                View Timeline
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Ride not found or unable to load timeline</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Ride Details
                  </CardTitle>
                  {getStatusBadge(data.ride.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pickup</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
                      <p className="text-sm">{data.ride.pickupAddress}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Dropoff</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                      <p className="text-sm">{data.ride.dropoffAddress}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Customer</p>
                    <p className="font-medium">{data.ride.customer}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Driver</p>
                    <p className="font-medium">{data.ride.driver}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">${Number(data.ride.fare).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Fare</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{data.ride.distanceMiles?.toFixed(1) || "—"}</p>
                    <p className="text-xs text-muted-foreground">Miles</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{data.ride.durationMinutes || "—"}</p>
                    <p className="text-xs text-muted-foreground">Minutes</p>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center">{renderStars(data.ride.customerRating)}</div>
                    <p className="text-xs text-muted-foreground">Customer Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Route Visualization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RouteMap
                  pickup={data.ride.pickupLocation}
                  dropoff={data.ride.dropoffLocation}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Event Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {data.timeline.map((event, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              {getEventIcon(event.type)}
                            </div>
                            {index < data.timeline.length - 1 && <div className="w-0.5 h-full bg-border" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{event.title}</p>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.timestamp), "h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                            {event.location && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {event.location.address}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.paymentEvents.length > 0 ? (
                      <div className="space-y-3">
                        {data.paymentEvents.map((event, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{event.title}</p>
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            </div>
                            <p className="font-bold text-green-600">${Number(event.amount).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No payment events</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Safety Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.safetyEvents.length > 0 ? (
                      <div className="space-y-3">
                        {data.safetyEvents.map((event: any, index: number) => (
                          <div key={index} className="p-3 bg-muted rounded-lg">
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No safety events recorded</p>
                    )}
                  </CardContent>
                </Card>

                {data.anomalies.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="h-5 w-5" />
                        Anomalies Detected
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.anomalies.map((anomaly: any, index: number) => (
                          <div key={index} className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                            <p className="font-medium text-orange-700 dark:text-orange-400">{anomaly.type}</p>
                            <p className="text-sm text-orange-600 dark:text-orange-300">{anomaly.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {!searchRideId && !isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Enter a Ride ID to view its timeline</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
