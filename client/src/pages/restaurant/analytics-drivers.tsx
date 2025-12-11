import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bike, Clock, AlertTriangle, TrendingUp } from "lucide-react";

interface DriverAnalytics {
  driverStats: {
    driverId: string;
    driverName: string;
    avgPickupTime: number;
    avgDeliveryTime: number;
    cancellationCount: number;
    totalDeliveries: number;
  }[];
}

export default function AnalyticsDrivers() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: analytics, isLoading } = useQuery<DriverAnalytics>({
    queryKey: [`/api/restaurant/analytics/drivers?startDate=${startDate}&endDate=${endDate}`],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <h1 className="text-2xl font-bold mb-6">Driver Analytics</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const drivers = analytics?.driverStats || [];
  const totalDeliveries = drivers.reduce((sum, d) => sum + d.totalDeliveries, 0);
  const totalCancellations = drivers.reduce((sum, d) => sum + d.cancellationCount, 0);
  const avgPickupTime =
    drivers.length > 0
      ? Math.round(drivers.reduce((sum, d) => sum + d.avgPickupTime, 0) / drivers.length)
      : 0;
  const avgDeliveryTime =
    drivers.length > 0
      ? Math.round(drivers.reduce((sum, d) => sum + d.avgDeliveryTime, 0) / drivers.length)
      : 0;

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Driver Performance Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor driver efficiency and service quality
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-testid="input-start-date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-testid="input-end-date"
          />
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Bike className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-drivers">
              {drivers.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">In this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Pickup Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-pickup-time">
              {avgPickupTime}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">From ready to picked up</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-delivery-time">
              {avgDeliveryTime}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">From pickup to delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cancellations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-total-cancellations">
              {totalCancellations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDeliveries > 0
                ? `${Math.round((totalCancellations / totalDeliveries) * 100)}% rate`
                : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Driver Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Driver Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {drivers.length > 0 ? (
              drivers.map((driver, idx) => {
                const cancellationRate =
                  driver.totalDeliveries > 0
                    ? Math.round((driver.cancellationCount / driver.totalDeliveries) * 100)
                    : 0;

                return (
                  <div
                    key={driver.driverId}
                    className="p-4 bg-muted rounded space-y-3"
                    data-testid={`driver-stat-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-muted-foreground">#{idx + 1}</div>
                        <div>
                          <div className="font-medium">{driver.driverName}</div>
                          <div className="text-sm text-muted-foreground">
                            {driver.totalDeliveries} deliveries
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Performance Score</div>
                        <div
                          className={`text-lg font-bold ${
                            cancellationRate < 5 && driver.avgPickupTime < avgPickupTime
                              ? "text-green-600"
                              : cancellationRate > 10 || driver.avgPickupTime > avgPickupTime * 1.5
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {cancellationRate < 5 && driver.avgPickupTime < avgPickupTime
                            ? "Excellent"
                            : cancellationRate > 10 || driver.avgPickupTime > avgPickupTime * 1.5
                              ? "Needs Attention"
                              : "Good"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Pickup Time</div>
                        <div className="text-lg font-bold">{driver.avgPickupTime}m</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Delivery Time</div>
                        <div className="text-lg font-bold">{driver.avgDeliveryTime}m</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Cancellations</div>
                        <div className="text-lg font-bold text-destructive">
                          {driver.cancellationCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Cancel Rate</div>
                        <div
                          className={`text-lg font-bold ${
                            cancellationRate > 10 ? "text-destructive" : ""
                          }`}
                        >
                          {cancellationRate}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No driver data available for this period
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SLA Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground mb-1">Pickup SLA (15min)</div>
              <div className="text-2xl font-bold">
                {drivers.filter((d) => d.avgPickupTime <= 15).length}/{drivers.length}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {drivers.length > 0
                  ? Math.round((drivers.filter((d) => d.avgPickupTime <= 15).length / drivers.length) * 100)
                  : 0}
                % compliance
              </p>
            </div>

            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground mb-1">Delivery SLA (30min)</div>
              <div className="text-2xl font-bold">
                {drivers.filter((d) => d.avgDeliveryTime <= 30).length}/{drivers.length}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {drivers.length > 0
                  ? Math.round((drivers.filter((d) => d.avgDeliveryTime <= 30).length / drivers.length) * 100)
                  : 0}
                % compliance
              </p>
            </div>

            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground mb-1">Low Cancellation (below 5%)</div>
              <div className="text-2xl font-bold">
                {
                  drivers.filter(
                    (d) =>
                      d.totalDeliveries > 0 &&
                      (d.cancellationCount / d.totalDeliveries) * 100 < 5
                  ).length
                }
                /{drivers.length}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {drivers.length > 0
                  ? Math.round(
                      (drivers.filter(
                        (d) =>
                          d.totalDeliveries > 0 &&
                          (d.cancellationCount / d.totalDeliveries) * 100 < 5
                      ).length /
                        drivers.length) *
                        100
                    )
                  : 0}
                % of drivers
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
