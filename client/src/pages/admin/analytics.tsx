import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HealthIndicator } from "@/components/ui/HealthIndicator";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Car,
  Store,
  DollarSign,
  ShieldAlert,
  Activity,
  AlertTriangle,
  RefreshCw,
  Download,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { fetchAdminCapabilities } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { setAuthToken } from "@/lib/authToken";

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Convert date range shortcuts to actual date parameters
function convertDateRange(range: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (range) {
    case "1d":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return {
    dateFrom: from.toISOString(),
    dateTo: to,
  };
}

export default function AnalyticsDashboard() {
  const [, setLocation] = useLocation();
  const [dateRange, setDateRange] = useState("7d");
  const [country, setCountry] = useState("all");
  const [capabilitiesError, setCapabilitiesError] = useState(false);

  // ====================================================
  // Capability Check & RBAC Enforcement
  // ====================================================
  const { data: capabilitiesData, isLoading: capabilitiesLoading, error: capabilitiesQueryError } = useQuery({
    queryKey: ["/api/admin/capabilities"],
    retry: false,
  });

  // Auto-logout on 401 (using useEffect to avoid React setState during render)
  useEffect(() => {
    if (capabilitiesQueryError) {
      const errorStatus = (capabilitiesQueryError as any)?.status;
      if (errorStatus === 401) {
        setAuthToken(null);
        setLocation("/login");
      } else {
        setCapabilitiesError(true);
      }
    }
  }, [capabilitiesQueryError, setLocation]);

  // Check if user has VIEW_ANALYTICS_DASHBOARD permission
  const hasAccess = capabilitiesData && 'capabilities' in capabilitiesData 
    ? (capabilitiesData.capabilities as string[]).includes("VIEW_ANALYTICS_DASHBOARD")
    : false;

  // Convert date range to actual dates (memoized to prevent changing on every render)
  const { dateFrom, dateTo } = useMemo(() => convertDateRange(dateRange), [dateRange]);

  // ====================================================
  // Data Queries (only enabled if hasAccess)
  // ====================================================
  const { data: overviewDataRaw, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview } = useQuery({
    queryKey: [`/api/admin/analytics/overview?dateFrom=${dateFrom}&dateTo=${dateTo}&country=${country}`],
    enabled: hasAccess,
    retry: false,
  });
  const overviewData = overviewDataRaw as any;

  const { data: driversDataRaw, isLoading: driversLoading, error: driversError } = useQuery({
    queryKey: [`/api/admin/analytics/drivers?dateFrom=${dateFrom}&dateTo=${dateTo}&country=${country}`],
    enabled: hasAccess,
    retry: false,
  });
  const driversData = driversDataRaw as any;

  const { data: customersDataRaw, isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: [`/api/admin/analytics/customers?dateFrom=${dateFrom}&dateTo=${dateTo}&country=${country}`],
    enabled: hasAccess,
    retry: false,
  });
  const customersData = customersDataRaw as any;

  const { data: restaurantsDataRaw, isLoading: restaurantsLoading, error: restaurantsError } = useQuery({
    queryKey: [`/api/admin/analytics/restaurants?dateFrom=${dateFrom}&dateTo=${dateTo}&country=${country}`],
    enabled: hasAccess,
    retry: false,
  });
  const restaurantsData = restaurantsDataRaw as any;

  const { data: revenueDataRaw, isLoading: revenueLoading, error: revenueError } = useQuery({
    queryKey: [`/api/admin/analytics/revenue?dateFrom=${dateFrom}&dateTo=${dateTo}&country=${country}`],
    enabled: hasAccess,
    retry: false,
  });
  const revenueData = revenueDataRaw as any;

  const { data: riskDataRaw, isLoading: riskLoading, error: riskError } = useQuery({
    queryKey: [`/api/admin/analytics/risk?dateFrom=${dateFrom}&dateTo=${dateTo}&country=${country}`],
    enabled: hasAccess,
    retry: false,
  });
  const riskData = riskDataRaw as any;

  // ====================================================
  // Loading State (during capability fetch)
  // ====================================================
  if (capabilitiesLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // ====================================================
  // Error State (capability fetch failed, non-401)
  // ====================================================
  if (capabilitiesError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to verify permissions. Please try again.
              <Button
                variant="outline"
                size="sm"
                className="ml-4"
                onClick={() => window.location.reload()}
                data-testid="button-reload"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // ====================================================
  // Access Denied State (only after capability data is loaded)
  // ====================================================
  if (!capabilitiesLoading && !hasAccess) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <ShieldAlert className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You do not have permission to view analytics dashboard. Please contact your administrator for access.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ====================================================
  // Main Dashboard UI
  // ====================================================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="heading-analytics">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive platform analytics and performance insights
              </p>
              <div className="mt-2">
                <HealthIndicator />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]" data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-[140px]" data-testid="select-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="IN">India</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Overview Stats */}
        {overviewLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : overviewError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load overview data. {(overviewError as any).message}</AlertDescription>
          </Alert>
        ) : overviewData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-revenue">
                  {formatCurrency(overviewData?.totalRevenue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(overviewData?.totalTrips ?? 0).toLocaleString()} total trips
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-active-users">
                  {(overviewData?.activeUsers ?? 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(overviewData?.newUsers ?? 0).toLocaleString()} new this period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-active-drivers">
                  {(overviewData?.activeDrivers ?? 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(((overviewData?.activeDrivers ?? 0) / Math.max(overviewData?.totalDrivers ?? 1, 1)) * 100).toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Commission</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary" data-testid="stat-avg-commission">
                  {(overviewData?.avgCommissionRate ?? 0).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(overviewData?.totalCommission ?? 0)} total
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="drivers" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="drivers" data-testid="tab-drivers">
              <Car className="h-4 w-4 mr-2" />
              Drivers
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="restaurants" data-testid="tab-restaurants">
              <Store className="h-4 w-4 mr-2" />
              Restaurants
            </TabsTrigger>
            <TabsTrigger value="revenue" data-testid="tab-revenue">
              <DollarSign className="h-4 w-4 mr-2" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">
              <ShieldAlert className="h-4 w-4 mr-2" />
              Risk
            </TabsTrigger>
          </TabsList>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-6">
            {driversLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-80" />
                ))}
              </div>
            ) : driversError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load driver analytics.</AlertDescription>
              </Alert>
            ) : driversData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Driver Performance Trend</CardTitle>
                    <CardDescription>Total trips completed over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={driversData?.performanceTrend ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="trips"
                          stroke={CHART_COLORS[0]}
                          fill={CHART_COLORS[0]}
                          fillOpacity={0.6}
                          name="Trips"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Drivers by Revenue</CardTitle>
                    <CardDescription>Best performing drivers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={(driversData?.topDrivers ?? []).slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="driverName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="revenue" fill={CHART_COLORS[1]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Driver Activity Status</CardTitle>
                    <CardDescription>Active vs inactive drivers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Active", value: driversData?.activeDrivers ?? 0 },
                            { name: "Inactive", value: driversData?.inactiveDrivers ?? 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {[0, 1].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Driver Retention</CardTitle>
                    <CardDescription>Drivers with rides this period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-center py-8" data-testid="stat-retention-rate">
                      {(driversData?.retentionRate ?? 0).toFixed(1)}%
                    </div>
                    <p className="text-center text-muted-foreground">
                      {driversData?.activeDrivers ?? 0} of {driversData?.totalDrivers ?? 0} drivers active
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            {customersLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-80" />
                ))}
              </div>
            ) : customersError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load customer analytics.</AlertDescription>
              </Alert>
            ) : customersData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Growth Trend</CardTitle>
                    <CardDescription>New customers over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={customersData?.growthTrend ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="newCustomers" stroke={CHART_COLORS[2]} name="New Customers" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Customer Spending Distribution</CardTitle>
                    <CardDescription>Revenue by customer segment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={customersData?.spendingDistribution ?? []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="revenue"
                        >
                          {(customersData?.spendingDistribution ?? []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Customers</CardTitle>
                    <CardDescription>By total spending</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={(customersData?.topCustomers ?? []).slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="customerName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="totalSpent" fill={CHART_COLORS[3]} name="Total Spent" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Customer Retention</CardTitle>
                    <CardDescription>Repeat customer rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-center py-8" data-testid="stat-customer-retention">
                      {(customersData?.repeatCustomerRate ?? 0).toFixed(1)}%
                    </div>
                    <p className="text-center text-muted-foreground">
                      {customersData?.repeatCustomers ?? 0} repeat of {customersData?.totalCustomers ?? 0} total
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* Restaurants Tab */}
          <TabsContent value="restaurants" className="space-y-6">
            {restaurantsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-80" />
                ))}
              </div>
            ) : restaurantsError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load restaurant analytics.</AlertDescription>
              </Alert>
            ) : restaurantsData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Volume Trend</CardTitle>
                    <CardDescription>Restaurant orders over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={restaurantsData?.orderTrend ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="orders"
                          stroke={CHART_COLORS[4]}
                          fill={CHART_COLORS[4]}
                          fillOpacity={0.6}
                          name="Orders"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Restaurants</CardTitle>
                    <CardDescription>By total revenue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={(restaurantsData?.topRestaurants ?? []).slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="restaurantName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="revenue" fill={CHART_COLORS[0]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Restaurant Status</CardTitle>
                    <CardDescription>Active vs inactive restaurants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Active", value: restaurantsData?.activeRestaurants ?? 0 },
                            { name: "Inactive", value: restaurantsData?.inactiveRestaurants ?? 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {[0, 1].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index + 1]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Order Value</CardTitle>
                    <CardDescription>Per restaurant order</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-center py-8" data-testid="stat-avg-order-value">
                      {formatCurrency(restaurantsData?.avgOrderValue ?? 0)}
                    </div>
                    <p className="text-center text-muted-foreground">
                      {(restaurantsData?.totalOrders ?? 0).toLocaleString()} total orders
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {revenueLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-80" />
                ))}
              </div>
            ) : revenueError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load revenue analytics.</AlertDescription>
              </Alert>
            ) : revenueData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                    <CardDescription>Total revenue over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={revenueData?.revenueTrend ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke={CHART_COLORS[2]}
                          fill={CHART_COLORS[2]}
                          fillOpacity={0.6}
                          name="Revenue"
                        />
                        <Area
                          type="monotone"
                          dataKey="commission"
                          stroke={CHART_COLORS[3]}
                          fill={CHART_COLORS[3]}
                          fillOpacity={0.6}
                          name="Commission"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Service Revenue Breakdown</CardTitle>
                    <CardDescription>Revenue by service type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={revenueData?.serviceBreakdown ?? []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="revenue"
                        >
                          {(revenueData?.serviceBreakdown ?? []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method Distribution</CardTitle>
                    <CardDescription>Revenue by payment type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData?.paymentMethods ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="method" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="amount" fill={CHART_COLORS[4]} name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Country Revenue Distribution</CardTitle>
                    <CardDescription>Revenue by geographic region</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData?.countryBreakdown ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="country" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="revenue" fill={CHART_COLORS[1]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* Risk Tab */}
          <TabsContent value="risk" className="space-y-6">
            {riskLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-80" />
                ))}
              </div>
            ) : riskError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load risk analytics.</AlertDescription>
              </Alert>
            ) : riskData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Fraud Detection Trend</CardTitle>
                    <CardDescription>Flagged incidents over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={riskData?.fraudTrend ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="highRisk" stroke="#ef4444" name="High Risk" />
                        <Line type="monotone" dataKey="mediumRisk" stroke="#f59e0b" name="Medium Risk" />
                        <Line type="monotone" dataKey="lowRisk" stroke="#10b981" name="Low Risk" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Risk Distribution</CardTitle>
                    <CardDescription>Current risk levels across platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "High Risk", value: riskData?.highRiskCount ?? 0 },
                            { name: "Medium Risk", value: riskData?.mediumRiskCount ?? 0 },
                            { name: "Low Risk", value: riskData?.lowRiskCount ?? 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#10b981" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Blocked Transactions</CardTitle>
                    <CardDescription>Prevented fraudulent activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-center py-8 text-destructive" data-testid="stat-blocked-txn">
                      {(riskData?.blockedTransactions ?? 0).toLocaleString()}
                    </div>
                    <p className="text-center text-muted-foreground">
                      {formatCurrency(riskData?.preventedLoss ?? 0)} in prevented losses
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Security Status</CardTitle>
                    <CardDescription>Accounts under review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Normal</span>
                        <Badge variant="outline">{(riskData?.normalAccounts ?? 0).toLocaleString()}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Under Observation</span>
                        <Badge variant="secondary">{(riskData?.observationAccounts ?? 0).toLocaleString()}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Needs Review</span>
                        <Badge variant="destructive">{(riskData?.reviewAccounts ?? 0).toLocaleString()}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
