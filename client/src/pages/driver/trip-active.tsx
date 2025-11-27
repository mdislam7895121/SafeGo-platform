import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Phone, 
  Navigation, 
  Shield, 
  Clock, 
  MapPin, 
  ChevronDown,
  Car,
  UtensilsCrossed,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SafeGoMap, type ActiveLeg } from "@/components/maps/SafeGoMap";

type TripStatusType = "accepted" | "arriving" | "arrived" | "started" | "completed" | "cancelled" | "in_progress" | "picked_up";

interface ActiveTrip {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  status: TripStatusType;
  tripCode: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  driverLat: number | null;
  driverLng: number | null;
  estimatedArrivalMinutes: number;
  estimatedTripMinutes: number;
  distanceKm: number;
  fare: number;
  customer: {
    firstName: string;
    phone: string | null;
  };
  restaurantName?: string;
  createdAt: string;
}

const navigationApps = [
  { id: "safego", name: "SafeGo Map", icon: MapPin },
  { id: "google", name: "Google Maps", icon: ExternalLink },
  { id: "apple", name: "Apple Maps", icon: ExternalLink },
  { id: "waze", name: "Waze", icon: ExternalLink },
];

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  accepted: { label: "Trip Accepted", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  arriving: { label: "Heading to Pickup", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  arrived: { label: "At Pickup", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  started: { label: "Trip in Progress", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  in_progress: { label: "Trip in Progress", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  picked_up: { label: "Picked Up", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completed", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  cancelled: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

function getServiceIcon(serviceType: string) {
  switch (serviceType) {
    case "RIDE": return Car;
    case "FOOD": return UtensilsCrossed;
    case "PARCEL": return Package;
    default: return Car;
  }
}

function buildNavigationUrl(app: string, lat: number, lng: number): string {
  const coords = `${lat},${lng}`;
  switch (app) {
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
    case "apple":
      return `maps://?daddr=${coords}`;
    case "waze":
      return `https://waze.com/ul?ll=${coords}&navigate=yes`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
  }
}

export default function DriverTripActive() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const { data: activeTripData, isLoading, error, refetch } = useQuery<{ activeTrip: ActiveTrip | null; hasActiveTrip: boolean }>({
    queryKey: ["/api/driver/trips/active"],
    refetchInterval: pollingEnabled ? 10000 : false,
  });

  const { data: preferences } = useQuery<{ preferredNavigationApp?: string }>({
    queryKey: ["/api/driver/preferences"],
  });

  const preferredNavApp = preferences?.preferredNavigationApp || "google";
  const activeTrip = activeTripData?.activeTrip;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ tripId, status, serviceType }: { tripId: string; status: string; serviceType: string }) => {
      return apiRequest(`/api/driver/trips/${tripId}/status?serviceType=${serviceType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trips/active"] });
      
      const statusLabels: Record<string, string> = {
        arriving: "Heading to pickup",
        arrived: "Arrived at pickup",
        started: "Trip started",
        completed: "Trip completed",
      };
      
      toast({
        title: statusLabels[variables.status] || "Status updated",
        description: "Trip status has been updated successfully",
      });
      
      if (variables.status === "completed") {
        setPollingEnabled(false);
        setTimeout(() => {
          setLocation("/driver/trips");
        }, 2000);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    return () => {
      setPollingEnabled(false);
    };
  }, []);

  const handleStatusUpdate = useCallback((newStatus: string) => {
    if (!activeTrip) return;
    updateStatusMutation.mutate({
      tripId: activeTrip.id,
      status: newStatus,
      serviceType: activeTrip.serviceType,
    });
  }, [activeTrip, updateStatusMutation]);

  const handleOpenNavigation = (appId: string) => {
    if (!activeTrip) return;
    
    if (appId === "safego" || preferredNavApp === "safego") {
      toast({ 
        title: "Using SafeGo Map", 
        description: "Turn-by-turn navigation is shown in the map above. Follow the blue route line." 
      });
      return;
    }
    
    const isHeadingToPickup = ["accepted", "arriving"].includes(activeTrip.status);
    const targetLat = isHeadingToPickup ? activeTrip.pickupLat : activeTrip.dropoffLat;
    const targetLng = isHeadingToPickup ? activeTrip.pickupLng : activeTrip.dropoffLng;
    
    if (targetLat && targetLng) {
      const url = buildNavigationUrl(appId, targetLat, targetLng);
      window.open(url, "_blank");
      toast({
        title: `Opening ${navigationApps.find(a => a.id === appId)?.name || "external map"}`,
        description: "Follow the directions in the external app",
      });
    } else {
      toast({
        title: "Location unavailable",
        description: "Cannot open navigation - coordinates not available",
        variant: "destructive",
      });
    }
  };

  const getActiveLeg = (): ActiveLeg => {
    if (!activeTrip) return "to_pickup";
    if (["accepted", "arriving"].includes(activeTrip.status)) return "to_pickup";
    if (["arrived", "started", "in_progress", "picked_up"].includes(activeTrip.status)) return "to_dropoff";
    return "completed";
  };

  const getNextAction = () => {
    if (!activeTrip) return null;
    
    switch (activeTrip.status) {
      case "accepted":
        return { label: "I'm On My Way", status: "arriving", variant: "default" as const };
      case "arriving":
        return { label: "I've Arrived", status: "arrived", variant: "default" as const };
      case "arrived":
        return { label: "Start Trip", status: "started", variant: "default" as const };
      case "started":
      case "in_progress":
      case "picked_up":
        return { label: "Complete Trip", status: "completed", variant: "default" as const };
      default:
        return null;
    }
  };

  const getEtaDisplay = () => {
    if (!activeTrip) return "";
    const isHeadingToPickup = ["accepted", "arriving"].includes(activeTrip.status);
    
    if (isHeadingToPickup) {
      return `${activeTrip.estimatedArrivalMinutes} min to pickup`;
    } else if (["arrived"].includes(activeTrip.status)) {
      return "Waiting for passenger";
    } else {
      return `${activeTrip.estimatedTripMinutes} min to destination`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading active trip...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">Unable to Load Trip</h2>
            <p className="text-muted-foreground">There was an error loading your active trip. Please try again.</p>
            <Button onClick={() => refetch()} data-testid="button-retry">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No Active Trip</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                You don't have an active trip right now. New trip requests will appear here when available.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/driver/dashboard">
                <Button variant="outline" data-testid="link-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <Link href="/driver/trips">
                <Button data-testid="link-trip-history">
                  View Trip History
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ServiceIcon = getServiceIcon(activeTrip.serviceType);
  const statusInfo = statusConfig[activeTrip.status] || statusConfig.accepted;
  const nextAction = getNextAction();
  const activeLeg = getActiveLeg();

  return (
    <div className="flex flex-col h-full" data-testid="active-trip-screen">
      <div className={`px-4 py-3 ${statusInfo.bgColor}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-background ${statusInfo.color}`}>
              <ServiceIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={`${statusInfo.bgColor} ${statusInfo.color} border-0`}>
                  {statusInfo.label}
                </Badge>
                <span className="text-sm font-medium text-muted-foreground">{activeTrip.tripCode}</span>
              </div>
              <div className="flex items-center gap-1 text-sm mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{getEtaDisplay()}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">${activeTrip.fare.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{activeTrip.distanceKm.toFixed(1)} km</p>
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-[250px] md:min-h-[350px]">
        <SafeGoMap
          driverLocation={activeTrip.driverLat && activeTrip.driverLng ? {
            lat: activeTrip.driverLat,
            lng: activeTrip.driverLng,
            label: "Your location",
          } : { lat: 40.7128, lng: -74.006, label: "Your location" }}
          pickupLocation={activeTrip.pickupLat && activeTrip.pickupLng ? {
            lat: activeTrip.pickupLat,
            lng: activeTrip.pickupLng,
            label: activeTrip.pickupAddress,
          } : null}
          dropoffLocation={activeTrip.dropoffLat && activeTrip.dropoffLng ? {
            lat: activeTrip.dropoffLat,
            lng: activeTrip.dropoffLng,
            label: activeTrip.dropoffAddress,
          } : null}
          activeLeg={activeLeg}
          className="h-full w-full"
        />
      </div>

      <div className="p-4 space-y-4 bg-background border-t">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {activeTrip.customer.firstName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate" data-testid="text-customer-name">
                    {activeTrip.customer.firstName}
                  </h3>
                  {activeTrip.restaurantName && (
                    <Badge variant="outline" className="flex-shrink-0">
                      {activeTrip.restaurantName}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground truncate" data-testid="text-pickup-address">
                      {activeTrip.pickupAddress}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground truncate" data-testid="text-dropoff-address">
                      {activeTrip.dropoffAddress}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {activeTrip.customer.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  asChild
                  data-testid="button-call-customer"
                >
                  <a href={`tel:${activeTrip.customer.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </a>
                </Button>
              )}
              <Link href="/driver/safety" className="flex-1">
                <Button variant="outline" size="sm" className="w-full" data-testid="button-safety">
                  <Shield className="h-4 w-4 mr-2" />
                  Safety
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1" data-testid="button-navigation-menu">
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {navigationApps.map((app) => (
                    <DropdownMenuItem
                      key={app.id}
                      onClick={() => handleOpenNavigation(app.id)}
                      className="cursor-pointer"
                      data-testid={`menu-item-nav-${app.id}`}
                    >
                      <app.icon className="h-4 w-4 mr-2" />
                      {app.name}
                      {app.id === preferredNavApp && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Default
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {nextAction && (
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold"
            onClick={() => handleStatusUpdate(nextAction.status)}
            disabled={updateStatusMutation.isPending}
            data-testid="button-next-action"
          >
            {updateStatusMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Updating...
              </>
            ) : nextAction.status === "completed" ? (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {nextAction.label}
              </>
            ) : (
              nextAction.label
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
