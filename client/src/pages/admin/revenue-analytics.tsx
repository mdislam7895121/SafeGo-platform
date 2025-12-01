import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, DollarSign, TrendingUp, TrendingDown, 
  Calendar, Car, UtensilsCrossed, Package, Users,
  RefreshCw, Download, Filter, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface DailyAnalytics {
  date: string;
  totalFare: number;
  totalFareFormatted: string;
  totalCommission: number;
  totalCommissionFormatted: string;
  totalPartnerPayout: number;
  totalTrips: number;
  completedTrips: number;
  byService: Record<string, { fare: number; commission: number; trips: number }>;
}

interface AnalyticsSummary {
  success: boolean;
  range: string;
  startDate: string;
  endDate: string;
  currencyCode: string;
  dailyData: DailyAnalytics[];
  totals: {
    totalFare: number;
    totalFareFormatted: string;
    totalCommission: number;
    totalCommissionFormatted: string;
    totalPartnerPayout: number;
    totalPartnerPayoutFormatted: string;
    totalTrips: number;
    completedTrips: number;
    averageDailyFare: string;
  };
}

interface ServiceBreakdown {
  success: boolean;
  currencyCode: string;
  breakdown: Array<{
    serviceType: string;
    totalFare: number;
    totalFareFormatted: string;
    totalCommission: number;
    totalCommissionFormatted: string;
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    totalTips: number;
    totalRefunds: number;
    totalIncentivesPaid: number;
    cashOnlineRatio: string;
  }>;
  grandTotal: {
    totalFare: number;
    totalFareFormatted: string;
    totalCommission: number;
    totalCommissionFormatted: string;
  };
}

interface TopEarners {
  success: boolean;
  currencyCode: string;
  topDrivers: Array<{
    rank: number;
    driverId: string;
    name: string;
    totalEarnings: number;
    totalEarningsFormatted: string;
    totalTrips: number;
  }>;
  topRestaurants: Array<{
    rank: number;
    restaurantId: string;
    name: string;
    totalEarnings: number;
    totalEarningsFormatted: string;
    totalOrders: number;
  }>;
}

function RevenueCard({ 
  title, 
  value, 
  formattedValue,
  icon: Icon, 
  trend,
  subtitle,
  color = "primary"
}: {
  title: string;
  value: number;
  formattedValue: string;
  icon: any;
  trend?: { direction: "up" | "down" | "neutral"; percent: number };
  subtitle?: string;
  color?: "primary" | "green" | "orange" | "red" | "blue";
}) {
  const colorClasses = {
    primary: "text-primary",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>{formattedValue}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Icon className={`h-8 w-8 ${colorClasses[color]} opacity-80`} />
            {trend && (
              <div className={`flex items-center text-xs ${
                trend.direction === "up" ? "text-green-600" : 
                trend.direction === "down" ? "text-red-600" : 
                "text-muted-foreground"
              }`}>
                {trend.direction === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                 trend.direction === "down" ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                {(trend.percent ?? 0) > 0 ? "+" : ""}{(trend.percent ?? 0).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-16 text-xs text-muted-foreground truncate">{item.label}</div>
          <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${maxValue > 0 ? ((item.value ?? 0) / maxValue) * 100 : 0}%` }}
            />
          </div>
          <div className="w-20 text-xs font-medium text-right">${(item.value ?? 0).toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

export default function RevenueAnalytics() {
  const [range, setRange] = useState("last_7_days");
  const [countryCode, setCountryCode] = useState<string>("all");

  const queryParams = new URLSearchParams({
    range,
    ...(countryCode !== "all" && { countryCode }),
  }).toString();

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/admin/analytics/summary", range, countryCode],
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery<ServiceBreakdown>({
    queryKey: ["/api/admin/analytics/service-breakdown", countryCode],
  });

  const { data: topEarners, isLoading: earnersLoading } = useQuery<TopEarners>({
    queryKey: ["/api/admin/analytics/top-earners", range, countryCode],
  });

  const handleRefresh = () => {
    refetchSummary();
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'ride': return Car;
      case 'food': return UtensilsCrossed;
      case 'parcel': return Package;
      default: return DollarSign;
    }
  };

  const getServiceColor = (serviceType: string) => {
    switch (serviceType) {
      case 'ride': return 'text-blue-600 dark:text-blue-400';
      case 'food': return 'text-orange-600 dark:text-orange-400';
      case 'parcel': return 'text-green-600 dark:text-green-400';
      default: return 'text-primary';
    }
  };

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totals = summary?.totals;
  const dailyData = summary?.dailyData || [];
  const maxDailyFare = Math.max(...dailyData.map(d => d.totalFare), 1);

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Revenue Analytics</h1>
              <p className="text-sm opacity-90">Financial performance and insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-36 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground" data-testid="select-range">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger className="w-32 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground" data-testid="select-country">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm opacity-75">
          <span>Period: {summary?.startDate ? new Date(summary.startDate).toLocaleDateString() : ''} - {summary?.endDate ? new Date(summary.endDate).toLocaleDateString() : ''}</span>
          <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
            {summary?.currencyCode || 'USD'}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RevenueCard
            title="Total Revenue"
            value={totals?.totalFare || 0}
            formattedValue={totals?.totalFareFormatted || '$0.00'}
            icon={DollarSign}
            color="green"
            subtitle={`${totals?.totalTrips || 0} total trips`}
          />
          <RevenueCard
            title="Commission Earned"
            value={totals?.totalCommission || 0}
            formattedValue={totals?.totalCommissionFormatted || '$0.00'}
            icon={TrendingUp}
            color="blue"
            subtitle="Platform earnings"
          />
          <RevenueCard
            title="Partner Payouts"
            value={totals?.totalPartnerPayout || 0}
            formattedValue={totals?.totalPartnerPayoutFormatted || '$0.00'}
            icon={Users}
            color="orange"
            subtitle="Driver/Restaurant payouts"
          />
          <RevenueCard
            title="Avg Daily Revenue"
            value={0}
            formattedValue={totals?.averageDailyFare || '$0.00'}
            icon={BarChart3}
            color="primary"
            subtitle="Average per day"
          />
        </div>

        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList data-testid="tabs-analytics">
            <TabsTrigger value="daily" data-testid="tab-daily">Daily Trend</TabsTrigger>
            <TabsTrigger value="service" data-testid="tab-service">By Service</TabsTrigger>
            <TabsTrigger value="top-earners" data-testid="tab-earners">Top Earners</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" /> Daily Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data for selected period</p>
                ) : (
                  <SimpleBarChart 
                    data={dailyData.map(d => ({
                      label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      value: d.totalFare
                    }))}
                    maxValue={maxDailyFare}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {dailyData.map((day, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`day-${day.date}`}>
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{new Date(day.date).toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">{day.completedTrips} completed trips</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{day.totalFareFormatted}</p>
                          <p className="text-xs text-muted-foreground">Commission: {day.totalCommissionFormatted}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {breakdown?.breakdown?.map((service, index) => {
                const Icon = getServiceIcon(service.serviceType);
                return (
                  <Card key={index} data-testid={`card-service-${service.serviceType}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${getServiceColor(service.serviceType)}`} />
                        {service.serviceType.charAt(0).toUpperCase() + service.serviceType.slice(1)}s
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Revenue</span>
                        <span className="font-bold text-green-600">{service.totalFareFormatted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Commission</span>
                        <span className="font-medium">{service.totalCommissionFormatted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Trips</span>
                        <span className="font-medium">{service.totalTrips}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Completed</span>
                        <span className="text-green-600">{service.completedTrips}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cancelled</span>
                        <span className="text-red-600">{service.cancelledTrips}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Tips Collected</span>
                          <span className="text-sm">${(service.totalTips ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Refunds</span>
                          <span className="text-sm text-red-600">-${(service.totalRefunds ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Incentives Paid</span>
                          <span className="text-sm text-orange-600">${(service.totalIncentivesPaid ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {breakdown?.grandTotal && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Grand Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{breakdown.grandTotal.totalFareFormatted}</p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{breakdown.grandTotal.totalCommissionFormatted}</p>
                      <p className="text-xs text-muted-foreground">Total Commission</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="top-earners" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-600" /> Top Earning Drivers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!topEarners?.topDrivers || topEarners.topDrivers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No driver data available</p>
                  ) : (
                    <div className="space-y-2">
                      {topEarners.topDrivers.map((driver) => (
                        <div key={driver.driverId} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`driver-${driver.driverId}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                              {driver.rank}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{driver.name}</p>
                              <p className="text-xs text-muted-foreground">{driver.totalTrips} trips</p>
                            </div>
                          </div>
                          <p className="font-bold text-green-600">{driver.totalEarningsFormatted}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-orange-600" /> Top Earning Restaurants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!topEarners?.topRestaurants || topEarners.topRestaurants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No restaurant data available</p>
                  ) : (
                    <div className="space-y-2">
                      {topEarners.topRestaurants.map((restaurant) => (
                        <div key={restaurant.restaurantId} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`restaurant-${restaurant.restaurantId}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/20 flex items-center justify-center text-xs font-bold">
                              {restaurant.rank}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{restaurant.name}</p>
                              <p className="text-xs text-muted-foreground">{restaurant.totalOrders} orders</p>
                            </div>
                          </div>
                          <p className="font-bold text-green-600">{restaurant.totalEarningsFormatted}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
