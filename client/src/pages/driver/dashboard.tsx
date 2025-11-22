import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, DollarSign, Car, MapPin } from "lucide-react";

export default function DriverDashboard() {
  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
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
  const wallet = (driverData as any)?.wallet;

  const rating = stats?.rating ? Number(stats.rating) : 5.0;
  const totalTrips = stats?.totalTrips || 0;
  const dailyEarnings = stats?.todayEarnings ? Number(stats.todayEarnings) : 0;
  const weeklyEarnings = stats?.weekEarnings ? Number(stats.weekEarnings) : 0;
  const balance = wallet?.balance ? Number(wallet.balance) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-welcome">
          Welcome back, {profile?.firstName || "Driver"}!
        </h1>
        <p className="text-muted-foreground">
          Here's your performance overview
        </p>
      </div>

      {/* Dashboard Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rating Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-950/30 flex items-center justify-center">
                <Star className="h-6 w-6 fill-yellow-500 text-yellow-500" />
              </div>
              <div>
                <div className="text-3xl font-bold" data-testid="text-rating">
                  {rating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Out of 5.0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trips Completed Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trips Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-3xl font-bold" data-testid="text-trips-completed">
                  {totalTrips}
                </div>
                <p className="text-xs text-muted-foreground">Total trips</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Earnings Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Daily Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600" data-testid="text-daily-earnings">
                  ${dailyEarnings.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Earnings Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Weekly Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600" data-testid="text-weekly-earnings">
                  ${weeklyEarnings.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">This week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bonus Zones Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Bonus Zones
          </CardTitle>
          <CardDescription>
            High-demand areas with surge pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold mb-1">Downtown</h4>
              <p className="text-sm text-muted-foreground mb-2">1.5x surge</p>
              <p className="text-xs text-muted-foreground">Active until 8:00 PM</p>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold mb-1">Airport</h4>
              <p className="text-sm text-muted-foreground mb-2">2.0x surge</p>
              <p className="text-xs text-muted-foreground">Active all day</p>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold mb-1">Business District</h4>
              <p className="text-sm text-muted-foreground mb-2">1.3x surge</p>
              <p className="text-xs text-muted-foreground">Peak hours only</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
