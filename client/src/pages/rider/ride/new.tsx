import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Navigation,
  Clock,
  Home,
  Briefcase,
  Star,
  ChevronRight,
  Search,
} from "lucide-react";
import { useRideBooking } from "@/contexts/RideBookingContext";

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: "home" | "work" | "star";
}

interface RecentLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  usedAt: string;
}

const mockSavedPlaces: SavedPlace[] = [
  {
    id: "home",
    name: "Home",
    address: "123 Main Street, Dhaka",
    lat: 23.8103,
    lng: 90.4125,
    icon: "home",
  },
  {
    id: "work",
    name: "Work",
    address: "456 Business District, Dhaka",
    lat: 23.7937,
    lng: 90.4066,
    icon: "work",
  },
];

const mockRecentLocations: RecentLocation[] = [
  {
    id: "r1",
    address: "Bashundhara City Shopping Mall",
    lat: 23.7509,
    lng: 90.3935,
    usedAt: "Yesterday",
  },
  {
    id: "r2",
    address: "Dhaka Airport Terminal 1",
    lat: 23.8423,
    lng: 90.3976,
    usedAt: "2 days ago",
  },
  {
    id: "r3",
    address: "Gulshan 2 Circle",
    lat: 23.7934,
    lng: 90.4144,
    usedAt: "Last week",
  },
];

function getPlaceIcon(icon: SavedPlace["icon"]) {
  switch (icon) {
    case "home":
      return Home;
    case "work":
      return Briefcase;
    default:
      return Star;
  }
}

export default function RideNewPage() {
  const [, setLocation] = useLocation();
  const { setStep, setDropoff, clearBooking } = useRideBooking();

  useEffect(() => {
    clearBooking();
    setStep("pickup");
  }, [clearBooking, setStep]);

  const handleWhereToClick = () => {
    setLocation("/rider/ride/pickup");
  };

  const handleSavedPlaceClick = (place: SavedPlace) => {
    setDropoff({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      name: place.name,
    });
    setLocation("/rider/ride/pickup");
  };

  const handleRecentClick = (recent: RecentLocation) => {
    setDropoff({
      address: recent.address,
      lat: recent.lat,
      lng: recent.lng,
    });
    setLocation("/rider/ride/pickup");
  };

  return (
    <div className="flex flex-col h-full" data-testid="ride-new-page">
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-ride-new-title">
            Where to?
          </h1>
          <p className="text-muted-foreground">
            Enter your destination to get started
          </p>
        </div>

        <Card className="hover-elevate cursor-pointer" onClick={handleWhereToClick} data-testid="card-where-to">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Enter destination..."
                  className="border-0 p-0 h-auto text-base focus-visible:ring-0 cursor-pointer"
                  readOnly
                  data-testid="input-where-to"
                />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-current-location">
          <CardContent className="p-0">
            <Link href="/rider/ride/pickup">
              <button className="w-full flex items-center gap-3 p-4 hover-elevate text-left" data-testid="button-use-current-location">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Navigation className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Use current location</p>
                  <p className="text-sm text-muted-foreground">Set pickup to your GPS location</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
          </CardContent>
        </Card>

        {mockSavedPlaces.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Saved Places
            </h2>
            <Card>
              <CardContent className="p-0 divide-y">
                {mockSavedPlaces.map((place) => {
                  const Icon = getPlaceIcon(place.icon);
                  return (
                    <button
                      key={place.id}
                      className="w-full flex items-center gap-3 p-4 hover-elevate text-left"
                      onClick={() => handleSavedPlaceClick(place)}
                      data-testid={`saved-place-${place.id}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{place.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{place.address}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {mockRecentLocations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent
            </h2>
            <Card>
              <CardContent className="p-0 divide-y">
                {mockRecentLocations.map((recent) => (
                  <button
                    key={recent.id}
                    className="w-full flex items-center gap-3 p-4 hover-elevate text-left"
                    onClick={() => handleRecentClick(recent)}
                    data-testid={`recent-location-${recent.id}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{recent.address}</p>
                      <p className="text-sm text-muted-foreground">{recent.usedAt}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
