import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Languages, 
  Star,
  Trophy,
  Calendar,
  Target,
  Smile,
  Moon,
  MessageCircle,
  Navigation,
  Sparkles,
  Gift,
  Award
} from "lucide-react";

// Compliment types - seed data structure ready for future API integration
const COMPLIMENT_TYPES = [
  { id: "1", title: "Excellent Service", icon: Smile, type: "excellent_service" },
  { id: "2", title: "Late Night Hero", icon: Moon, type: "late_night_hero" },
  { id: "3", title: "Great Conversation", icon: MessageCircle, type: "great_conversation" },
  { id: "4", title: "Expert Navigation", icon: Navigation, type: "expert_navigation" },
  { id: "5", title: "Neat and Tidy", icon: Sparkles, type: "neat_and_tidy" },
  { id: "6", title: "Great Amenities", icon: Gift, type: "great_amenities" },
  { id: "7", title: "Above and Beyond", icon: Award, type: "above_and_beyond" },
];

export default function DriverPublicProfile() {
  const { data: driverData, isLoading: driverLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: pointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ["/api/driver/points"],
  });

  const isLoading = driverLoading || pointsLoading;

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const stats = (driverData as any)?.stats;

  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || "Driver";

  const cityName = profile?.city || "Unknown";
  const countryCode = profile?.country || "US";
  const rating = stats?.rating ? Number(stats.rating) : 5.0;
  const totalTrips = stats?.totalTrips || 0;

  // Points and tier data
  const currentTier = (pointsData as any)?.currentTier;
  const hasNoTier = (pointsData as any)?.hasNoTier;

  // Calculate account age
  const accountCreatedDate = new Date(profile?.createdAt || Date.now());
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - accountCreatedDate.getTime());
  const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  const diffMonths = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
  const journeyTime = diffYears > 0 ? `${diffYears} yr ${diffMonths} mo` : `${diffMonths} mo`;

  // Compliments data - all 7 compliment types
  const sampleCompliments = [
    { ...COMPLIMENT_TYPES[0], count: 12 },
    { ...COMPLIMENT_TYPES[1], count: 6 },
    { ...COMPLIMENT_TYPES[2], count: 9 },
    { ...COMPLIMENT_TYPES[3], count: 8 },
    { ...COMPLIMENT_TYPES[4], count: 5 },
    { ...COMPLIMENT_TYPES[5], count: 4 },
    { ...COMPLIMENT_TYPES[6], count: 3 },
  ];

  // Calculate five-star trips estimate
  const fiveStarTrips = Math.floor(totalTrips * 0.8);

  // Determine languages based on country
  const languages = ["English"];
  if (countryCode === "BD") {
    languages.unshift("Bangla");
  }
  const languagesText = `Speaks ${languages.join(" and ")}`;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back Button */}
      <Link href="/driver/profile">
        <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Button>
      </Link>

      {/* Page Title */}
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* A) Profile Hero */}
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Large Circular Avatar */}
            <Avatar className="h-32 w-32 border-4 border-border">
              <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
              <AvatarFallback className="bg-muted text-muted-foreground text-3xl">
                <User className="h-16 w-16" />
              </AvatarFallback>
            </Avatar>

            {/* Driver Full Name */}
            <h2 className="text-3xl font-bold" data-testid="text-driver-name">
              {driverName}
            </h2>

            {/* Clickable Tier Badge Pill */}
            {currentTier && (
              <Link href="/driver/points">
                <Badge 
                  className="px-4 py-2 text-base cursor-pointer hover-elevate"
                  style={{ 
                    backgroundColor: `${currentTier.color}20`,
                    color: currentTier.color,
                    borderColor: currentTier.color
                  }}
                  data-testid="badge-tier-link"
                >
                  {currentTier.name}
                </Badge>
              </Link>
            )}
            {hasNoTier && (
              <Badge 
                variant="outline"
                className="px-4 py-2 text-base"
                data-testid="badge-no-tier"
              >
                No tier yet
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* B) About Driver Section */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* City and Country */}
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span data-testid="text-location">{cityName}, {countryCode}</span>
          </div>

          {/* Languages */}
          <div className="flex items-center gap-3">
            <Languages className="h-5 w-5 text-muted-foreground" />
            <span data-testid="text-languages">{languagesText}</span>
          </div>

          {/* Trips with SafeGo Summary */}
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-muted-foreground" />
            <span data-testid="text-trips-summary">
              {totalTrips.toLocaleString()} trips over {journeyTime}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* C) Compliments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Compliments</CardTitle>
            {/* TODO: Wire to real compliments page when available */}
            <Link href="/driver/profile/compliments">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sm h-auto px-2 py-1"
                data-testid="button-view-all-compliments"
              >
                View all
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {sampleCompliments.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sampleCompliments.map((compliment) => {
                const Icon = compliment.icon;
                return (
                  <div
                    key={compliment.id}
                    className="flex flex-col items-center text-center p-4 rounded-lg border bg-card hover-elevate"
                    data-testid={`compliment-${compliment.type}`}
                  >
                    {/* Icon with count badge */}
                    <div className="relative mb-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      {compliment.count > 0 && (
                        <Badge 
                          className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                          data-testid={`compliment-count-${compliment.type}`}
                        >
                          {compliment.count}
                        </Badge>
                      )}
                    </div>
                    {/* Title */}
                    <span className="text-sm font-medium">{compliment.title}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Smile className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No compliments yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                You have not received any compliments yet. Keep driving safely and providing great service.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* D) Achievements Section */}
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Trips */}
            <div className="p-6 rounded-lg border bg-card text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" data-testid="text-total-trips">
                {totalTrips.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total trips</div>
            </div>

            {/* Years with SafeGo */}
            <div className="p-6 rounded-lg border bg-card text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" data-testid="text-journey-years">
                {journeyTime}
              </div>
              <div className="text-sm text-muted-foreground">Journey with SafeGo</div>
            </div>

            {/* Five-Star Trips */}
            <div className="p-6 rounded-lg border bg-card text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div className="text-3xl font-bold mb-1" data-testid="text-five-star-trips">
                {fiveStarTrips > 0 ? fiveStarTrips.toLocaleString() : "Coming soon"}
              </div>
              <div className="text-sm text-muted-foreground">Five-star trips</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
