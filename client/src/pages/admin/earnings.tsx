import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAdminCapabilities } from "@/lib/queryClient";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Users,
  Car,
  UtensilsCrossed,
  Package,
  CreditCard,
  Calendar,
  Globe,
  BarChart3,
  Download,
  Filter,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

// Backend response types (match earningsService.ts)
interface GlobalSummary {
  totalRidesEarnings: number;
  totalFoodEarnings: number;
  totalParcelEarnings: number;
  totalCommission: number;
  payoutsCompleted: number;
  payoutsPending: number;
}

interface ServiceEarnings {
  gross: number;
  commission: number;
  net: number;
  count: number;
  chartData: Array<{ date: string; amount: number }>;
}

interface PayoutAnalytics {
  weeklyAutoPayouts: number;
  manualCashouts: number;
  pending: number;
  completed: number;
  failed: Array<{ id: string; amount: number; reason: string; date: string }>;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AdminEarnings() {
  const [, navigate] = useLocation();
  const { token, logout } = useAuth();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [country, setCountry] = useState<string>("all");

  // Capability check for RBAC
  const {
    data: capabilitiesData,
    isPending: isLoadingCapabilities,
    error: capabilitiesError,
  } = useQuery<{ capabilities: string[] }>({
    queryKey: ["/api/admin/capabilities", token],
    queryFn: () => fetchAdminCapabilities(token),
    retry: false,
    enabled: !!token,
  });

  const capabilities = capabilitiesData?.capabilities || [];
  const hasCapabilitiesError = !!capabilitiesError;
  const hasAccess = capabilities.includes("VIEW_EARNINGS_DASHBOARD");

  // Auto-logout on 401
  useEffect(() => {
    if (capabilitiesError && "status" in capabilitiesError && capabilitiesError.status === 401) {
      console.log("🔴 401 error detected, logging out...");
      logout();
    }
  }, [capabilitiesError, logout]);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (country !== "all") params.append("country", country);
    return params.toString() ? `?${params.toString()}` : "";
  };

  const queryString = buildQueryString();

  const { data: globalData, isLoading: globalLoading } = useQuery<GlobalSummary>({
    queryKey: [`/api/admin/earnings/dashboard/global${queryString}`],
    enabled: hasAccess,
  });

  const { data: rideData, isLoading: rideLoading } = useQuery<ServiceEarnings>({
    queryKey: [`/api/admin/earnings/dashboard/rides${queryString}`],
    enabled: hasAccess,
  });

  const { data: foodData, isLoading: foodLoading } = useQuery<ServiceEarnings>({
    queryKey: [`/api/admin/earnings/dashboard/food${queryString}`],
    enabled: hasAccess,
  });

  const { data: parcelData, isLoading: parcelLoading } = useQuery<ServiceEarnings>({
    queryKey: [`/api/admin/earnings/dashboard/parcels${queryString}`],
    enabled: hasAccess,
  });

  const { data: payoutData, isLoading: payoutLoading } = useQuery<PayoutAnalytics>({
    queryKey: [`/api/admin/earnings/dashboard/payouts${queryString}`],
    enabled: hasAccess,
  });

  const formatCurrency = (amount: number, countryCode?: string) => {
    const currency = countryCode === "BD" ? "BDT" : countryCode === "US" ? "USD" : "USD";
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Loading state
  if (isLoadingCapabilities) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Capability error: hide all privileged UI
  if (hasCapabilitiesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Unable to Verify Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't verify your permissions to access this page. This may be due to a temporary network issue.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} data-testid="button-retry">
                Retry
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin")} data-testid="button-back-to-admin">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don't have permission to view earnings analytics. Please contact your administrator.
            </p>
            <Button onClick={() => navigate("/admin")} data-testid="button-back-to-admin">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-6 w-6" />
                  Earnings & Analytics Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Comprehensive platform revenue, commission, and payout analytics
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="input-date-from"
                />
              </div>
              <div>
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="input-date-to"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="country" data-testid="select-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="BD">Bangladesh (BD)</SelectItem>
                    <SelectItem value="US">United States (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="rides" data-testid="tab-rides">
              <Car className="h-4 w-4 mr-2" />
              Rides
            </TabsTrigger>
            <TabsTrigger value="food" data-testid="tab-food">
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Food
            </TabsTrigger>
            <TabsTrigger value="parcels" data-testid="tab-parcels">
              <Package className="h-4 w-4 mr-2" />
              Parcels
            </TabsTrigger>
            <TabsTrigger value="payouts" data-testid="tab-payouts">
              <CreditCard className="h-4 w-4 mr-2" />
              Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {globalLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : globalData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Gross Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-total-revenue">
                        {formatCurrency((globalData?.totalRidesEarnings ?? 0) + (globalData?.totalFoodEarnings ?? 0) + (globalData?.totalParcelEarnings ?? 0))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Rides: {formatCurrency(globalData?.totalRidesEarnings ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Food: {formatCurrency(globalData?.totalFoodEarnings ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parcels: {formatCurrency(globalData?.totalParcelEarnings ?? 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">SafeGo Commission</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-commission">
                        {formatCurrency(globalData?.totalCommission ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Payouts Status</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium">
                        Completed: {formatCurrency(globalData?.payoutsCompleted ?? 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pending: {formatCurrency(globalData?.payoutsPending ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Breakdown by Service Type</CardTitle>
                    <CardDescription>Distribution of earnings across ride-hailing, food delivery, and parcel services</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Rides", value: globalData?.totalRidesEarnings ?? 0 },
                            { name: "Food Orders", value: globalData?.totalFoodEarnings ?? 0 },
                            { name: "Parcels", value: globalData?.totalParcelEarnings ?? 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[0, 1, 2].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value) ?? 0)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No earnings data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rides" className="space-y-6">
            {rideLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : rideData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Rides</CardTitle>
                      <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-rides-count">
                        {(rideData?.count ?? 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-rides-revenue">
                        {formatCurrency(rideData?.gross ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Commission</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-rides-commission">
                        {formatCurrency(rideData?.commission ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Net Payout</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-rides-net">
                        {formatCurrency(rideData?.net ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                    <CardDescription>Daily ride earnings over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={rideData?.chartData ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value) ?? 0)} />
                        <Legend />
                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-1))" name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No ride earnings data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="food" className="space-y-6">
            {foodLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : foodData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                      <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-food-count">
                        {(foodData?.count ?? 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-food-revenue">
                        {formatCurrency(foodData?.gross ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Commission</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-food-commission">
                        {formatCurrency(foodData?.commission ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Net Payout</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-food-net">
                        {formatCurrency(foodData?.net ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                    <CardDescription>Daily food order earnings over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={foodData?.chartData ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value) ?? 0)} />
                        <Legend />
                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-2))" name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No food earnings data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="parcels" className="space-y-6">
            {parcelLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : parcelData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-parcel-count">
                        {(parcelData?.count ?? 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-parcel-revenue">
                        {formatCurrency(parcelData?.gross ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Commission</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-parcel-commission">
                        {formatCurrency(parcelData?.commission ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Net Payout</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-parcel-net">
                        {formatCurrency(parcelData?.net ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                    <CardDescription>Daily parcel delivery earnings over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={parcelData?.chartData ?? []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value) ?? 0)} />
                        <Legend />
                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-3))" name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No parcel earnings data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="space-y-6">
            {payoutLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : payoutData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Weekly Auto Payouts</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-payout-weekly">
                        {formatCurrency(payoutData?.weeklyAutoPayouts ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Manual Cashouts</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-payout-manual">
                        {formatCurrency(payoutData?.manualCashouts ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending</CardTitle>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600" data-testid="stat-payout-pending">
                        {formatCurrency(payoutData?.pending ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600" data-testid="stat-payout-completed">
                        {formatCurrency(payoutData?.completed ?? 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {(payoutData?.failed?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Failed Payouts</CardTitle>
                      <CardDescription>Recent payout failures requiring attention</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(payoutData?.failed ?? []).slice(0, 10).map((payout) => (
                            <TableRow key={payout?.id ?? ""} data-testid={`row-failed-payout-${payout?.id ?? ""}`}>
                              <TableCell className="font-mono text-xs">{payout?.id ?? "N/A"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(payout?.amount ?? 0)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{payout?.reason ?? "Unknown"}</TableCell>
                              <TableCell className="text-sm">{payout?.date ? new Date(payout.date).toLocaleString() : "N/A"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No payout analytics data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
