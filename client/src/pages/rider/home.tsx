import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Car,
  UtensilsCrossed,
  Package,
  MapPin,
  Clock,
  ArrowRight,
  Gift,
  Star,
  ChevronRight,
  Search,
  Calendar,
  ShoppingBag,
  Plane,
  Bus,
  Briefcase,
  Home,
} from "lucide-react";
import { getSavedPlaces, getRecentLocations, type SavedPlace, type RecentLocation } from "@/lib/locationService";

type ServiceTab = "rides" | "eats" | "courier";

interface UpcomingTrip {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledFor?: string;
  driverName?: string;
  vehicleInfo?: string;
  estimatedArrival?: string;
}

interface PromotionCard {
  id: string;
  title: string;
  description: string;
  code?: string;
  expiresAt?: string;
}

const suggestionTiles = [
  {
    id: "ride",
    label: "Ride",
    icon: Car,
    href: "/rider/ride/new",
    color: "bg-blue-500",
    promo: null,
  },
  {
    id: "food",
    label: "Food",
    icon: UtensilsCrossed,
    href: "/customer/food",
    color: "bg-orange-500",
    promo: "15% off",
  },
  {
    id: "grocery",
    label: "Grocery",
    icon: ShoppingBag,
    href: "/customer/food?category=grocery",
    color: "bg-green-500",
    promo: null,
  },
  {
    id: "courier",
    label: "Courier",
    icon: Package,
    href: "/rider/parcels?start=new",
    color: "bg-purple-500",
    promo: null,
  },
  {
    id: "reserve",
    label: "Reserve",
    icon: Calendar,
    href: "/rider/ride/new?scheduled=true",
    color: "bg-indigo-500",
    promo: null,
  },
  {
    id: "airport",
    label: "Airport",
    icon: Plane,
    href: "/rider/ride/new?type=airport",
    color: "bg-sky-500",
    promo: null,
  },
  {
    id: "shuttle",
    label: "Shuttle",
    icon: Bus,
    href: "/rider/ride/new?type=shuttle",
    color: "bg-teal-500",
    promo: "New",
  },
  {
    id: "rental",
    label: "Rental",
    icon: Car,
    href: "/rider/ride/new?type=rental",
    color: "bg-amber-500",
    promo: null,
  },
];

function SuggestionTile({ id, label, icon: Icon, href, color, promo }: typeof suggestionTiles[0]) {
  return (
    <Link href={href}>
      <div
        className="flex flex-col items-center p-3 rounded-xl hover-elevate cursor-pointer bg-muted/30"
        data-testid={`rider-home-suggestion-${id}`}
      >
        <div className={`relative h-12 w-12 rounded-full ${color} flex items-center justify-center mb-2`}>
          <Icon className="h-6 w-6 text-white" />
          {promo && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0"
            >
              {promo}
            </Badge>
          )}
        </div>
        <span className="text-sm font-medium text-center">{label}</span>
      </div>
    </Link>
  );
}

interface DisplayLocation {
  id: string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  type: "saved" | "recent";
}

function RecentLocationCard({
  location,
  onClick,
}: {
  location: DisplayLocation;
  onClick: () => void;
}) {
  const getIcon = () => {
    if (location.type === "saved") {
      const name = location.name?.toLowerCase();
      if (name === "home") return <Home className="h-5 w-5" />;
      if (name === "work") return <Briefcase className="h-5 w-5" />;
      return <Star className="h-5 w-5" />;
    }
    return <Clock className="h-5 w-5" />;
  };

  const addressParts = (location.address || "").split(",").filter(Boolean);
  const mainLabel = location.name || addressParts[0] || "Unknown location";
  const subLabel = location.name 
    ? addressParts[0] || "" 
    : addressParts.slice(1, 2).join(",").trim();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover-elevate w-full text-left min-w-[180px] max-w-[220px]"
      data-testid={`rider-home-location-${location.id}`}
    >
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{mainLabel}</p>
        {subLabel && (
          <p className="text-xs text-muted-foreground truncate">{subLabel}</p>
        )}
      </div>
    </button>
  );
}

function WhereToSearchBlock({ 
  onNavigate, 
  onScheduleLater 
}: { 
  onNavigate: () => void;
  onScheduleLater: () => void;
}) {
  return (
    <Card className="shadow-lg border-0 bg-background" data-testid="rider-home-where-to-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
          <button
            onClick={onNavigate}
            className="flex items-center gap-3 flex-1 hover-elevate rounded-lg p-1 -m-1 text-left"
            data-testid="rider-home-where-to"
          >
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p 
                className="text-lg font-medium"
                data-testid="text-rider-home-where-to"
              >
                Where to?
              </p>
            </div>
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 flex-shrink-0"
            onClick={onScheduleLater}
            data-testid="button-rider-schedule-later"
          >
            <Clock className="h-4 w-4" />
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PromoSection({
  title,
  description,
  ctaText,
  ctaHref,
  bgColor,
  icon: Icon,
  testId,
}: {
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  bgColor: string;
  icon: typeof Car;
  testId: string;
}) {
  return (
    <Card className={`${bgColor} border-0 overflow-hidden`} data-testid={testId}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-white/80 mb-3">{description}</p>
          <Link href={ctaHref}>
            <span
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              data-testid={`button-${testId}-cta`}
            >
              {ctaText}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
        <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="h-8 w-8 text-white" />
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingTripWidget({ trip }: { trip: UpcomingTrip | null }) {
  if (!trip) return null;

  return (
    <Card className="hover-elevate" data-testid="rider-home-upcoming-trip">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Upcoming Trip
          </CardTitle>
          <Badge variant="secondary">{trip.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <div className="w-px h-6 bg-border mx-auto" />
              <div className="h-2 w-2 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium truncate">{trip.pickupAddress}</p>
              <p className="text-sm text-muted-foreground truncate">{trip.dropoffAddress}</p>
            </div>
          </div>
          {trip.driverName && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Car className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{trip.driverName}</p>
                  <p className="text-xs text-muted-foreground">{trip.vehicleInfo}</p>
                </div>
              </div>
              {trip.estimatedArrival && (
                <p className="text-sm text-primary font-medium">{trip.estimatedArrival}</p>
              )}
            </div>
          )}
          <Link href={`/rider/trips/${trip.id}`}>
            <span 
              className="w-full mt-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm font-medium border border-input bg-background hover-elevate cursor-pointer"
              data-testid="button-view-trip-details"
            >
              View Details
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PromotionsWidget({ promotions }: { promotions: PromotionCard[] }) {
  if (promotions.length === 0) return null;

  return (
    <Card className="hover-elevate" data-testid="rider-home-promotions">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-500" />
            Active Promos
          </CardTitle>
          <Link href="/rider/wallet">
            <span 
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover-elevate cursor-pointer"
              data-testid="button-view-all-promotions"
            >
              View All
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {promotions.slice(0, 2).map((promo) => (
            <div
              key={promo.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              data-testid={`rider-promo-${promo.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{promo.title}</p>
                <p className="text-xs text-muted-foreground truncate">{promo.description}</p>
              </div>
              {promo.code && (
                <Badge variant="secondary" className="ml-2 flex-shrink-0">
                  {promo.code}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PointsWidget({ points, tier }: { points: number; tier: string }) {
  return (
    <Card className="hover-elevate" data-testid="rider-home-points">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm font-medium">{points.toLocaleString()} Points</p>
              <p className="text-xs text-muted-foreground">{tier} Member</p>
            </div>
          </div>
          <Link href="/rider/wallet">
            <span 
              className="inline-flex items-center justify-center h-8 w-8 rounded-md hover-elevate cursor-pointer"
              data-testid="button-view-rewards"
            >
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceTabContent({
  activeTab,
  displayLocations,
  onLocationClick,
}: {
  activeTab: ServiceTab;
  displayLocations: DisplayLocation[];
  onLocationClick: (address: string, lat: number, lng: number) => void;
}) {
  if (activeTab === "rides") {
    return (
      <div className="space-y-6">
        {displayLocations.length > 0 && (
          <div>
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-hide">
              {displayLocations.map((loc) => (
                <RecentLocationCard
                  key={loc.id}
                  location={loc}
                  onClick={() => onLocationClick(loc.address, loc.lat, loc.lng)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-base font-semibold mb-3" data-testid="text-rider-suggestions-title">
            Suggestions
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {suggestionTiles.map((tile) => (
              <SuggestionTile key={tile.id} {...tile} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "eats") {
    return (
      <div className="space-y-4">
        <Card className="hover-elevate" data-testid="rider-home-eats-search">
          <CardContent className="p-4">
            <Link href="/customer/food">
              <div 
                className="w-full flex items-center gap-3 bg-muted/50 rounded-xl p-4 hover-elevate cursor-pointer"
                data-testid="rider-home-eats-search-link"
              >
                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Search className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-medium">What are you craving?</p>
                  <p className="text-sm text-muted-foreground">Search for restaurants or cuisines</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "pizza", label: "Pizza", icon: UtensilsCrossed, color: "bg-red-500" },
            { id: "burgers", label: "Burgers", icon: UtensilsCrossed, color: "bg-yellow-500" },
            { id: "sushi", label: "Sushi", icon: UtensilsCrossed, color: "bg-pink-500" },
            { id: "chinese", label: "Chinese", icon: UtensilsCrossed, color: "bg-orange-500" },
            { id: "healthy", label: "Healthy", icon: ShoppingBag, color: "bg-green-500" },
            { id: "dessert", label: "Dessert", icon: UtensilsCrossed, color: "bg-purple-500" },
          ].map((cat) => (
            <Link key={cat.id} href={`/customer/food?category=${cat.id}`}>
              <div
                className="flex flex-col items-center p-3 rounded-xl hover-elevate cursor-pointer bg-muted/30"
                data-testid={`rider-home-eats-${cat.id}`}
              >
                <div className={`h-10 w-10 rounded-full ${cat.color} flex items-center justify-center mb-2`}>
                  <cat.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium">{cat.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === "courier") {
    return (
      <div className="space-y-4">
        <Card className="hover-elevate" data-testid="rider-home-courier-search">
          <CardContent className="p-4">
            <Link href="/rider/parcels?start=new">
              <div 
                className="w-full flex items-center gap-3 bg-muted/50 rounded-xl p-4 hover-elevate cursor-pointer"
                data-testid="rider-home-courier-search-link"
              >
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Package className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-medium">Send a package</p>
                  <p className="text-sm text-muted-foreground">Same-day delivery across the city</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "express", label: "Express", desc: "1-2 hours", color: "bg-red-500" },
            { id: "standard", label: "Standard", desc: "Same day", color: "bg-blue-500" },
            { id: "scheduled", label: "Scheduled", desc: "Pick a time", color: "bg-green-500" },
            { id: "bulk", label: "Bulk", desc: "Multiple items", color: "bg-purple-500" },
          ].map((opt) => (
            <Link key={opt.id} href={`/rider/parcels?start=new&type=${opt.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`rider-home-courier-${opt.id}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${opt.color} flex items-center justify-center flex-shrink-0`}>
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function RiderHome() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ServiceTab>("rides");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);

  useEffect(() => {
    setSavedPlaces(getSavedPlaces());
    setRecentLocations(getRecentLocations());
  }, []);

  const { data: dashboardData, isLoading } = useQuery<{
    upcomingTrip?: UpcomingTrip;
    promotions?: PromotionCard[];
    points?: number;
    tier?: string;
  }>({
    queryKey: ["/api/customer/dashboard"],
  });

  const upcomingTrip = dashboardData?.upcomingTrip || null;
  const promotions = dashboardData?.promotions || [];
  const points = dashboardData?.points || 0;
  const tier = dashboardData?.tier || "Bronze";

  const displayLocations: DisplayLocation[] = [
    ...savedPlaces
      .filter(p => p.lat !== 0 || p.lng !== 0)
      .slice(0, 2)
      .map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        type: "saved" as const,
      })),
    ...recentLocations
      .filter(r => r.address && r.address.trim() !== "")
      .slice(0, 3)
      .map(r => ({
        id: r.id,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        type: "recent" as const,
      })),
  ].slice(0, 4);

  const handleNavigateToRide = () => {
    setLocation("/rider/ride/new");
  };

  const handleScheduleLater = () => {
    setLocation("/rider/ride/new?scheduled=true");
  };

  const handleLocationClick = (address: string, lat: number, lng: number) => {
    setLocation("/rider/ride/new");
  };

  const tabButtons: { id: ServiceTab; label: string; icon: typeof Car }[] = [
    { id: "rides", label: "Rides", icon: Car },
    { id: "eats", label: "Eats", icon: UtensilsCrossed },
    { id: "courier", label: "Courier", icon: Package },
  ];

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-8" data-testid="rider-home-page">
      <div className="bg-primary/5 pb-6">
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex gap-2 mb-4">
            {tabButtons.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={activeTab === id ? "default" : "ghost"}
                size="sm"
                className={`rounded-full px-4 ${activeTab !== id ? "text-muted-foreground" : ""}`}
                onClick={() => setActiveTab(id)}
                data-testid={`rider-home-tab-${id}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>

          {activeTab === "rides" && (
            <WhereToSearchBlock 
              onNavigate={handleNavigateToRide} 
              onScheduleLater={handleScheduleLater}
            />
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <ServiceTabContent
          activeTab={activeTab}
          displayLocations={displayLocations}
          onLocationClick={handleLocationClick}
        />

        {activeTab === "rides" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PromoSection
              title="Get to the airport on time"
              description="Reserve a ride in advance for stress-free travel"
              ctaText="Plan a ride"
              ctaHref="/rider/ride/new?type=airport"
              bgColor="bg-gradient-to-r from-sky-500 to-blue-600"
              icon={Plane}
              testId="rider-home-promo-airport"
            />
            <PromoSection
              title="Order from your favourites"
              description="Delicious food delivered to your door"
              ctaText="Browse restaurants"
              ctaHref="/customer/food"
              bgColor="bg-gradient-to-r from-orange-500 to-red-500"
              icon={UtensilsCrossed}
              testId="rider-home-promo-food"
            />
          </div>
        )}

        {upcomingTrip && <UpcomingTripWidget trip={upcomingTrip} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PointsWidget points={points} tier={tier} />
          <PromotionsWidget promotions={promotions} />
        </div>
      </div>
    </div>
  );
}
