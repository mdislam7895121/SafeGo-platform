import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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

interface GlobalSummary {
  totalServices: number;
  totalGrossRevenue: number;
  totalSafegoCommission: number;
  totalDriverPayouts: number;
  totalRestaurantPayouts: number;
  serviceBreakdown: {
    rides: { count: number; revenue: number; commission: number; driverPayout: number };
    foodOrders: { count: number; revenue: number; commission: number; restaurantPayout: number; driverPayout: number };
    parcelDeliveries: { count: number; revenue: number; commission: number; driverPayout: number };
  };
  countryBreakdown: Array<{
    country: string;
    count: number;
    revenue: number;
    commission: number;
  }>;
}

interface RideEarnings {
  totalRides: number;
  totalRevenue: number;
  totalCommission: number;
  totalDriverPayout: number;
  avgFarePerRide: number;
  avgCommissionPerRide: number;
  topDrivers: Array<{
    driverId: string;
    driverName: string;
    email: string;
    rides: number;
    revenue: number;
    commission: number;
    payout: number;
  }>;
  countryBreakdown: Array<{
    country: string;
    rides: number;
    revenue: number;
    commission: number;
  }>;
}

interface FoodEarnings {
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalRestaurantPayout: number;
  totalDriverPayout: number;
  avgOrderValue: number;
  topRestaurants: Array<{
    restaurantId: string;
    restaurantName: string;
    email: string;
    orders: number;
    revenue: number;
    commission: number;
    payout: number;
  }>;
  topDeliveryDrivers: Array<{
    driverId: string;
    driverName: string;
    email: string;
    deliveries: number;
    earnings: number;
  }>;
  countryBreakdown: Array<{
    country: string;
    orders: number;
    revenue: number;
    commission: number;
  }>;
}

interface ParcelEarnings {
  totalDeliveries: number;
  totalRevenue: number;
  totalCommission: number;
  totalDriverPayout: number;
  avgDeliveryFee: number;
  topDrivers: Array<{
    driverId: string;
    driverName: string;
    email: string;
    deliveries: number;
    revenue: number;
    commission: number;
    payout: number;
  }>;
  countryBreakdown: Array<{
    country: string;
    deliveries: number;
    revenue: number;
    commission: number;
  }>;
}

interface PayoutAnalytics {
  totalPayouts: number;
  totalAmount: number;
  avgPayoutAmount: number;
  statusBreakdown: {
    pending: { count: number; amount: number };
    processing: { count: number; amount: number };
    completed: { count: number; amount: number };
    failed: { count: number; amount: number };
    rejected: { count: number; amount: number };
  };
  methodBreakdown: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  topRecipients: Array<{
    walletId: string;
    ownerName: string;
    email: string;
    walletType: string;
    payouts: number;
    totalAmount: number;
  }>;
  countryBreakdown: Array<{
    country: string;
    payouts: number;
    amount: number;
  }>;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AdminEarnings() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [country, setCountry] = useState<string>("all");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (country !== "all") params.append("country", country);
    return params.toString() ? `?${params.toString()}` : "";
  };

  const { data: globalData, isLoading: globalLoading } = useQuery<GlobalSummary>({
    queryKey: ["/api/admin/earnings/dashboard/global", dateFrom, dateTo, country],
  });

  const { data: rideData, isLoading: rideLoading } = useQuery<RideEarnings>({
    queryKey: ["/api/admin/earnings/dashboard/rides", dateFrom, dateTo, country],
  });

  const { data: foodData, isLoading: foodLoading } = useQuery<FoodEarnings>({
    queryKey: ["/api/admin/earnings/dashboard/food", dateFrom, dateTo, country],
  });

  const { data: parcelData, isLoading: parcelLoading } = useQuery<ParcelEarnings>({
    queryKey: ["/api/admin/earnings/dashboard/parcels", dateFrom, dateTo, country],
  });

  const { data: payoutData, isLoading: payoutLoading } = useQuery<PayoutAnalytics>({
    queryKey: ["/api/admin/earnings/dashboard/payouts", dateFrom, dateTo, country],
  });

  const formatCurrency = (amount: number, countryCode?: string) => {
    const currency = countryCode === "BD" ? "BDT" : countryCode === "US" ? "USD" : "USD";
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
            ) : globalData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Services</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-total-services">
                        {globalData.totalServices.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-gross-revenue">
                        {formatCurrency(globalData.totalGrossRevenue)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">SafeGo Commission</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-commission">
                        {formatCurrency(globalData.totalSafegoCommission)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-total-payouts">
                        {formatCurrency(globalData.totalDriverPayouts + globalData.totalRestaurantPayouts)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Service Breakdown</CardTitle>
                      <CardDescription>Revenue distribution by service type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Rides", value: globalData.serviceBreakdown.rides.revenue },
                              { name: "Food Orders", value: globalData.serviceBreakdown.foodOrders.revenue },
                              { name: "Parcels", value: globalData.serviceBreakdown.parcelDeliveries.revenue },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[0, 1, 2].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue by Country</CardTitle>
                      <CardDescription>Geographic revenue distribution</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={globalData.countryBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="country" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" />
                          <Bar dataKey="commission" fill="hsl(var(--chart-2))" name="Commission" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Service Performance Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead className="text-right">Avg per Service</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow data-testid="row-rides">
                          <TableCell className="font-medium flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            Rides
                          </TableCell>
                          <TableCell className="text-right">{globalData.serviceBreakdown.rides.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(globalData.serviceBreakdown.rides.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(globalData.serviceBreakdown.rides.commission)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(globalData.serviceBreakdown.rides.count > 0 
                              ? globalData.serviceBreakdown.rides.revenue / globalData.serviceBreakdown.rides.count 
                              : 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow data-testid="row-food">
                          <TableCell className="font-medium flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4" />
                            Food Orders
                          </TableCell>
                          <TableCell className="text-right">{globalData.serviceBreakdown.foodOrders.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(globalData.serviceBreakdown.foodOrders.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(globalData.serviceBreakdown.foodOrders.commission)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(globalData.serviceBreakdown.foodOrders.count > 0 
                              ? globalData.serviceBreakdown.foodOrders.revenue / globalData.serviceBreakdown.foodOrders.count 
                              : 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow data-testid="row-parcels">
                          <TableCell className="font-medium flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Parcel Deliveries
                          </TableCell>
                          <TableCell className="text-right">{globalData.serviceBreakdown.parcelDeliveries.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(globalData.serviceBreakdown.parcelDeliveries.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(globalData.serviceBreakdown.parcelDeliveries.commission)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(globalData.serviceBreakdown.parcelDeliveries.count > 0 
                              ? globalData.serviceBreakdown.parcelDeliveries.revenue / globalData.serviceBreakdown.parcelDeliveries.count 
                              : 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : null}
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
                        {rideData.totalRides.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-rides-revenue">
                        {formatCurrency(rideData.totalRevenue)}
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
                        {formatCurrency(rideData.totalCommission)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Fare</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-rides-avg">
                        {formatCurrency(rideData.avgFarePerRide)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue by Country</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={rideData.countryBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="country" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" />
                          <Bar dataKey="commission" fill="hsl(var(--chart-2))" name="Commission" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Drivers</CardTitle>
                      <CardDescription>By total revenue generated</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Driver</TableHead>
                            <TableHead className="text-right">Rides</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rideData.topDrivers.slice(0, 5).map((driver) => (
                            <TableRow key={driver.driverId} data-testid={`row-driver-${driver.driverId}`}>
                              <TableCell>
                                <div className="font-medium">{driver.driverName || driver.email}</div>
                                <div className="text-xs text-muted-foreground">{driver.email}</div>
                              </TableCell>
                              <TableCell className="text-right">{driver.rides}</TableCell>
                              <TableCell className="text-right">{formatCurrency(driver.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
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
                        {foodData.totalOrders.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-food-revenue">
                        {formatCurrency(foodData.totalRevenue)}
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
                        {formatCurrency(foodData.totalCommission)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Order</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-food-avg">
                        {formatCurrency(foodData.avgOrderValue)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Restaurants</CardTitle>
                      <CardDescription>By total revenue generated</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Restaurant</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {foodData.topRestaurants.slice(0, 5).map((restaurant) => (
                            <TableRow key={restaurant.restaurantId} data-testid={`row-restaurant-${restaurant.restaurantId}`}>
                              <TableCell>
                                <div className="font-medium">{restaurant.restaurantName}</div>
                                <div className="text-xs text-muted-foreground">{restaurant.email}</div>
                              </TableCell>
                              <TableCell className="text-right">{restaurant.orders}</TableCell>
                              <TableCell className="text-right">{formatCurrency(restaurant.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Delivery Drivers</CardTitle>
                      <CardDescription>By number of deliveries</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Driver</TableHead>
                            <TableHead className="text-right">Deliveries</TableHead>
                            <TableHead className="text-right">Earnings</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {foodData.topDeliveryDrivers.slice(0, 5).map((driver) => (
                            <TableRow key={driver.driverId} data-testid={`row-delivery-driver-${driver.driverId}`}>
                              <TableCell>
                                <div className="font-medium">{driver.driverName || driver.email}</div>
                                <div className="text-xs text-muted-foreground">{driver.email}</div>
                              </TableCell>
                              <TableCell className="text-right">{driver.deliveries}</TableCell>
                              <TableCell className="text-right">{formatCurrency(driver.earnings)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
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
                        {parcelData.totalDeliveries.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-parcel-revenue">
                        {formatCurrency(parcelData.totalRevenue)}
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
                        {formatCurrency(parcelData.totalCommission)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Fee</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-parcel-avg">
                        {formatCurrency(parcelData.avgDeliveryFee)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Delivery Drivers</CardTitle>
                    <CardDescription>By total deliveries and revenue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead className="text-right">Deliveries</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead className="text-right">Payout</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelData.topDrivers.map((driver) => (
                          <TableRow key={driver.driverId} data-testid={`row-parcel-driver-${driver.driverId}`}>
                            <TableCell>
                              <div className="font-medium">{driver.driverName || driver.email}</div>
                              <div className="text-xs text-muted-foreground">{driver.email}</div>
                            </TableCell>
                            <TableCell className="text-right">{driver.deliveries}</TableCell>
                            <TableCell className="text-right">{formatCurrency(driver.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(driver.commission)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(driver.payout)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : null}
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
                      <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-payout-count">
                        {payoutData.totalPayouts.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-payout-amount">
                        {formatCurrency(payoutData.totalAmount)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Payout</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-payout-avg">
                        {formatCurrency(payoutData.avgPayoutAmount)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-payout-completed">
                        {payoutData.statusBreakdown.completed.count.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Payout Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Completed", value: payoutData.statusBreakdown.completed.amount },
                              { name: "Pending", value: payoutData.statusBreakdown.pending.amount },
                              { name: "Processing", value: payoutData.statusBreakdown.processing.amount },
                              { name: "Failed", value: payoutData.statusBreakdown.failed.amount },
                              { name: "Rejected", value: payoutData.statusBreakdown.rejected.amount },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[0, 1, 2, 3, 4].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Payment Methods</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={payoutData.methodBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="method" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Bar dataKey="amount" fill="hsl(var(--chart-1))" name="Amount" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Recipients</CardTitle>
                    <CardDescription>By total payout amount</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Payouts</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payoutData.topRecipients.map((recipient) => (
                          <TableRow key={recipient.walletId} data-testid={`row-recipient-${recipient.walletId}`}>
                            <TableCell>
                              <div className="font-medium">{recipient.ownerName || recipient.email}</div>
                              <div className="text-xs text-muted-foreground">{recipient.email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{recipient.walletType}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{recipient.payouts}</TableCell>
                            <TableCell className="text-right">{formatCurrency(recipient.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
