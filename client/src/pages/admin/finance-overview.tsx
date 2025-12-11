import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  DollarSign,
  TrendingDown,
  Building2,
  Car,
  UtensilsCrossed,
  Package,
  Calendar,
  RefreshCw,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";

interface OverviewStats {
  totalOnlineRevenueByCountry: Array<{ countryCode: string; currency: string; totalAmount: number }>;
  totalCashCommissionByCountry: Array<{ countryCode: string; currency: string; totalCommission: number }>;
  totalDriverNegativeBalance: { count: number; totalAmount: number };
  totalRestaurantNegativeBalance: { count: number; totalAmount: number };
  topDriversByNegativeBalance: Array<{ driverId: string; driverName: string | null; countryCode: string; currentBalance: number }>;
  topRestaurantsByNegativeBalance: Array<{ restaurantId: string; restaurantName: string | null; countryCode: string; currentBalance: number }>;
  revenueByService: { ride: number; food: number; delivery: number };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "primary",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  color?: "primary" | "green" | "orange" | "red" | "blue";
}) {
  const colorClasses = {
    primary: "text-primary",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
  };

  const bgClasses = {
    primary: "bg-primary/10",
    green: "bg-green-100 dark:bg-green-900/30",
    orange: "bg-orange-100 dark:bg-orange-900/30",
    red: "bg-red-100 dark:bg-red-900/30",
    blue: "bg-blue-100 dark:bg-blue-900/30",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${bgClasses[color]}`}>
            <Icon className={`h-5 w-5 ${colorClasses[color]}`} />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function FinanceOverviewPage() {
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  const queryParams = new URLSearchParams();
  if (countryFilter !== "all") queryParams.set("countryCode", countryFilter);
  if (serviceFilter !== "all") queryParams.set("serviceType", serviceFilter);
  if (fromDate) queryParams.set("fromDate", fromDate);
  if (toDate) queryParams.set("toDate", toDate);

  const { data, isLoading, refetch } = useQuery<OverviewStats>({
    queryKey: ["/api/admin/finance/overview", queryParams.toString()],
  });

  const bdRevenue = data?.totalOnlineRevenueByCountry.find((r) => r.countryCode === "BD")?.totalAmount || 0;
  const usRevenue = data?.totalOnlineRevenueByCountry.find((r) => r.countryCode === "US")?.totalAmount || 0;
  const bdCashCommission = data?.totalCashCommissionByCountry.find((r) => r.countryCode === "BD")?.totalCommission || 0;
  const usCashCommission = data?.totalCashCommissionByCountry.find((r) => r.countryCode === "US")?.totalCommission || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        description="Revenue analytics, negative balances, and commission tracking"
        icon={DollarSign}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-country-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Service Type</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-service-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="ride">Rides</SelectItem>
                  <SelectItem value="food">Food Orders</SelectItem>
                  <SelectItem value="delivery">Deliveries</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-from-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-to-date"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-stats">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Online Revenue (BD)"
              value={formatCurrency(bdRevenue, "BDT")}
              subtitle="SSLCOMMERZ payments"
              icon={Globe}
              color="green"
            />
            <StatCard
              title="Online Revenue (US)"
              value={formatCurrency(usRevenue, "USD")}
              subtitle="Stripe payments"
              icon={DollarSign}
              color="blue"
            />
            <StatCard
              title="Driver Negative Balances"
              value={formatCurrency(data?.totalDriverNegativeBalance.totalAmount || 0, "BDT")}
              subtitle={`${data?.totalDriverNegativeBalance.count || 0} drivers`}
              icon={Car}
              color="red"
            />
            <StatCard
              title="Restaurant Negative Balances"
              value={formatCurrency(data?.totalRestaurantNegativeBalance.totalAmount || 0, "BDT")}
              subtitle={`${data?.totalRestaurantNegativeBalance.count || 0} restaurants`}
              icon={Building2}
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="Cash Commission Owed (BD)"
              value={formatCurrency(bdCashCommission, "BDT")}
              subtitle="Estimated from cash orders"
              icon={TrendingDown}
              color="orange"
            />
            <StatCard
              title="Cash Commission Owed (US)"
              value={formatCurrency(usCashCommission, "USD")}
              subtitle="Estimated from cash orders"
              icon={TrendingDown}
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Ride Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data?.revenueByService.ride || 0, "BDT")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Food Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data?.revenueByService.food || 0, "BDT")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Delivery Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data?.revenueByService.delivery || 0, "BDT")}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Drivers by Negative Balance</CardTitle>
                <CardDescription>Drivers who owe the most commission</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.topDriversByNegativeBalance.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No drivers with negative balance</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.topDriversByNegativeBalance.map((driver) => (
                        <TableRow key={driver.driverId}>
                          <TableCell>
                            <Link href={`/admin/finance/driver-balances?search=${driver.driverId}`}>
                              <span className="hover:underline cursor-pointer" data-testid={`link-driver-${driver.driverId}`}>
                                {driver.driverName || driver.driverId.slice(0, 8)}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{driver.countryCode}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(Number(driver.currentBalance), driver.countryCode === "US" ? "USD" : "BDT")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Restaurants by Negative Balance</CardTitle>
                <CardDescription>Restaurants who owe the most commission</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.topRestaurantsByNegativeBalance.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No restaurants with negative balance</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurant</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.topRestaurantsByNegativeBalance.map((restaurant) => (
                        <TableRow key={restaurant.restaurantId}>
                          <TableCell>
                            <Link href={`/admin/finance/restaurant-balances?search=${restaurant.restaurantId}`}>
                              <span className="hover:underline cursor-pointer" data-testid={`link-restaurant-${restaurant.restaurantId}`}>
                                {restaurant.restaurantName || restaurant.restaurantId.slice(0, 8)}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{restaurant.countryCode}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(Number(restaurant.currentBalance), restaurant.countryCode === "US" ? "USD" : "BDT")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
