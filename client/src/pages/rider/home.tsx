import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Navigation,
  RefreshCw,
} from "lucide-react";

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

interface LastOrder {
  id: string;
  restaurantName: string;
  totalAmount: number;
  itemCount: number;
  status: string;
  createdAt: string;
}

interface PromotionCard {
  id: string;
  title: string;
  description: string;
  code?: string;
  expiresAt?: string;
}

const serviceCards = [
  {
    id: "ride",
    title: "Book a Ride",
    subtitle: "Door-to-door rides anytime",
    description: "Get picked up and dropped off safely with professional drivers",
    icon: Car,
    href: "/rider/trips?start=new",
    color: "bg-blue-500",
    testId: "rider-home-ride-card",
  },
  {
    id: "food",
    title: "Order Food",
    subtitle: "From your favorite restaurants",
    description: "Discover local restaurants and get food delivered fast",
    icon: UtensilsCrossed,
    href: "/rider/orders?start=new",
    color: "bg-orange-500",
    testId: "rider-home-food-card",
  },
  {
    id: "parcel",
    title: "Send a Parcel",
    subtitle: "Same-day delivery",
    description: "Send packages across the city with real-time tracking",
    icon: Package,
    href: "/rider/parcels?start=new",
    color: "bg-green-500",
    testId: "rider-home-parcel-card",
  },
];

function ServiceHeroCard({
  title,
  subtitle,
  description,
  icon: Icon,
  href,
  color,
  testId,
}: typeof serviceCards[0]) {
  return (
    <Card className="group hover-elevate overflow-hidden" data-testid={testId}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className={`h-12 w-12 rounded-xl ${color} flex items-center justify-center mb-3`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-sm">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Link href={href}>
          <Button className="w-full group-hover:translate-x-1 transition-transform" data-testid={`button-${testId}-start`}>
            Get Started
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function UpcomingTripWidget({ trip }: { trip: UpcomingTrip | null }) {
  if (!trip) {
    return (
      <Card className="hover-elevate" data-testid="rider-home-upcoming-trip">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Upcoming Trip
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Navigation className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming trips</p>
            <Link href="/rider/trips?start=new">
              <Button variant="ghost" size="sm" className="mt-2 text-primary" data-testid="button-book-ride-empty">
                Book a ride now
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover-elevate" data-testid="rider-home-upcoming-trip">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Upcoming Trip
          </CardTitle>
          <Badge variant="secondary">{trip.status}</Badge>
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
            <Button variant="outline" size="sm" className="w-full mt-2" data-testid="button-view-trip-details">
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LastOrderWidget({ order }: { order: LastOrder | null }) {
  if (!order) {
    return (
      <Card className="hover-elevate" data-testid="rider-home-last-order">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
            Recent Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent orders</p>
            <Link href="/rider/orders?start=new">
              <Button variant="ghost" size="sm" className="mt-2 text-primary" data-testid="button-order-food-empty">
                Order food now
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover-elevate" data-testid="rider-home-last-order">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-orange-500" />
            Recent Order
          </CardTitle>
          <Badge variant="outline">{order.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="font-medium">{order.restaurantName}</p>
            <p className="text-sm text-muted-foreground">
              {order.itemCount} items · ${order.totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/rider/orders/${order.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-order">
                View Order
              </Button>
            </Link>
            <Link href={`/rider/orders?reorder=${order.id}`}>
              <Button size="sm" className="gap-1" data-testid="button-reorder">
                <RefreshCw className="h-3 w-3" />
                Reorder
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PromotionsWidget({ promotions }: { promotions: PromotionCard[] }) {
  return (
    <Card className="hover-elevate" data-testid="rider-home-promotions">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-500" />
            Promotions
          </CardTitle>
          <Link href="/rider/promotions">
            <Button variant="ghost" size="sm" className="text-xs" data-testid="button-view-all-promotions">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {promotions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Gift className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active promotions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {promotions.slice(0, 2).map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
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
        )}
      </CardContent>
    </Card>
  );
}

function PointsWidget({ points, tier }: { points: number; tier: string }) {
  return (
    <Card className="hover-elevate" data-testid="rider-home-points">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            SafeGo Points
          </CardTitle>
          <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
            {tier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{points.toLocaleString()}</span>
          <span className="text-muted-foreground text-sm">points</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Earn points on every ride and order
        </p>
        <Link href="/rider/rewards">
          <Button variant="outline" size="sm" className="w-full mt-3" data-testid="button-view-rewards">
            View Rewards
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function MapPreview() {
  return (
    <Card className="overflow-hidden" data-testid="rider-home-map-preview">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Nearby Drivers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative h-48 bg-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Map preview</p>
              <p className="text-xs text-muted-foreground">Drivers nearby will appear here</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent h-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function RiderHome() {
  const { data: dashboardData, isLoading } = useQuery<{
    upcomingTrip?: UpcomingTrip;
    lastOrder?: LastOrder;
    promotions?: PromotionCard[];
    points?: number;
    tier?: string;
  }>({
    queryKey: ["/api/customer/dashboard"],
  });

  const upcomingTrip = dashboardData?.upcomingTrip || null;
  const lastOrder = dashboardData?.lastOrder || null;
  const promotions = dashboardData?.promotions || [];
  const points = dashboardData?.points || 0;
  const tier = dashboardData?.tier || "Bronze";

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-6 w-32 mt-3" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1" data-testid="text-rider-welcome">
          Where to?
        </h2>
        <p className="text-muted-foreground">
          Book a ride, order food, or send a package
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceCards.map((card) => (
          <ServiceHeroCard key={card.id} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UpcomingTripWidget trip={upcomingTrip} />
            <LastOrderWidget order={lastOrder} />
          </div>
          <MapPreview />
        </div>
        <div className="space-y-4">
          <PromotionsWidget promotions={promotions} />
          <PointsWidget points={points} tier={tier} />
        </div>
      </div>
    </div>
  );
}
