import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  MapPin, 
  Mail, 
  Star, 
  TrendingUp, 
  Award, 
  Calendar,
  CheckCircle2,
  Trophy,
  Target,
  Clock
} from "lucide-react";

export default function DriverProfile() {
  const { data: driverData, isLoading: driverLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: pointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ["/api/driver/points"],
  });

  const isLoading = driverLoading || pointsLoading;

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const stats = (driverData as any)?.stats;
  const vehicle = (driverData as any)?.vehicle;

  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || "Driver";

  const cityName = profile?.city || "Unknown";
  const countryCode = profile?.country || "US";
  const rating = stats?.rating ? Number(stats.rating) : 5.0;
  const totalTrips = stats?.totalTrips || 0;

  // Points and tier data
  const currentTier = (pointsData as any)?.currentTier;
  const totalPoints = (pointsData as any)?.totalPoints || 0;
  const nextTier = (pointsData as any)?.nextTier;
  const progressPercentage = (pointsData as any)?.progressPercentage || 0;
  const pointsToNextTier = (pointsData as any)?.pointsToNextTier || 0;
  const hasNoTier = (pointsData as any)?.hasNoTier;

  // Calculate account age (sample data for now)
  const accountCreatedDate = new Date(profile?.createdAt || Date.now());
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - accountCreatedDate.getTime());
  const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  const diffMonths = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
  const journeyTime = diffYears > 0 ? `${diffYears} yr ${diffMonths} mo` : `${diffMonths} mo`;

  // Performance stats (using available data, placeholder for missing metrics)
  const acceptanceRate = 84; // Sample data - TODO: wire to real metric
  const cancellationRate = 7; // Sample data - TODO: wire to real metric
  const drivingScore = 94; // Sample data - TODO: wire to real metric

  // Sample badges - structured for future real data
  const badges = [
    { id: "1", title: "100 five-star trips", icon: Star, earned: totalTrips >= 100 },
    { id: "2", title: "1 year with SafeGo", icon: Calendar, earned: diffYears >= 1 },
    { id: "3", title: "Weekend hero", icon: Trophy, earned: false }, // Sample
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Profile Header - Uber Style */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Large Circular Avatar */}
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-border">
                <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
                <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              
              {/* Tier Pill attached to avatar */}
              {currentTier && (
                <Badge 
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1"
                  style={{ 
                    backgroundColor: `${currentTier.color}20`,
                    color: currentTier.color,
                    borderColor: currentTier.color
                  }}
                  data-testid="badge-tier"
                >
                  {currentTier.name}
                </Badge>
              )}
              {hasNoTier && (
                <Badge 
                  variant="outline"
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1"
                  data-testid="badge-no-tier"
                >
                  No tier yet
                </Badge>
              )}
            </div>

            {/* Driver Info */}
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-3" data-testid="text-driver-name">
                {driverName}
              </h2>
              
              {/* Email */}
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground" data-testid="text-driver-email">
                  {profile?.email}
                </span>
                {profile?.isVerified && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground" data-testid="text-driver-location">
                  {cityName}, {countryCode}
                </span>
              </div>

              {/* View Public Profile Button */}
              <Link href="/driver/profile/public">
                <Button variant="outline" size="sm" data-testid="button-view-public-profile">
                  View public profile
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SafeGo Points and Tier Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            SafeGo Points and tier
          </CardTitle>
          <CardDescription>
            Earn points with every trip to unlock exclusive benefits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Current tier</div>
              <div className="text-2xl font-bold" data-testid="text-current-tier">
                {currentTier ? currentTier.name : "No tier yet"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Current points</div>
              <div className="text-2xl font-bold" data-testid="text-total-points">
                {totalPoints.toLocaleString()} points
              </div>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress to {nextTier.name} tier</span>
                <span className="font-medium">{pointsToNextTier} points needed</span>
              </div>
              <Progress value={progressPercentage} className="h-3" data-testid="progress-next-tier" />
            </div>
          )}

          {!nextTier && currentTier && (
            <div className="bg-muted p-3 rounded-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">You are at the highest tier</span>
            </div>
          )}

          {/* Tier summary */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }}></div>
                <span>Blue: entry tier (1,000+ points)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }}></div>
                <span>Gold: mid tier with additional benefits (1,500+ points)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }}></div>
                <span>Premium: highest tier with full benefits (2,500+ points)</span>
              </div>
            </div>
          </div>

          {/* Link to full points page */}
          <Link href="/driver/points">
            <Button variant="ghost" className="px-0 h-auto text-sm hover:bg-transparent" data-testid="link-view-all-points">
              View detailed points breakdown →
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Driving Performance Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Driving performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Acceptance Rate */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold" data-testid="text-acceptance-rate">
                  {acceptanceRate}%
                </div>
                <div className="text-sm text-muted-foreground">Acceptance rate</div>
              </div>
            </CardContent>
          </Card>

          {/* Cancellation Rate */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold" data-testid="text-cancellation-rate">
                  {cancellationRate}%
                </div>
                <div className="text-sm text-muted-foreground">Cancellation rate</div>
              </div>
            </CardContent>
          </Card>

          {/* Star Rating */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold flex items-center gap-2" data-testid="text-star-rating">
                  {rating.toFixed(2)}
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                </div>
                <div className="text-sm text-muted-foreground">Star rating</div>
              </div>
            </CardContent>
          </Card>

          {/* Driving Score */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold" data-testid="text-driving-score">
                  {drivingScore}
                </div>
                <div className="text-sm text-muted-foreground">Driving insights score</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lifetime Highlights Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Lifetime highlights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Trips */}
          <Card>
            <CardContent className="p-6 flex items-center gap-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="text-4xl font-bold mb-1" data-testid="text-lifetime-trips">
                  {totalTrips.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total trips</div>
              </div>
            </CardContent>
          </Card>

          {/* Journey with SafeGo */}
          <Card>
            <CardContent className="p-6 flex items-center gap-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="text-4xl font-bold mb-1" data-testid="text-journey-time">
                  {journeyTime}
                </div>
                <div className="text-sm text-muted-foreground">Journey with SafeGo</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Badges Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Badges</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                      badge.earned
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                    }`}
                    data-testid={`badge-${badge.id}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{badge.title}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Earn badges by completing milestones and maintaining high performance
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
