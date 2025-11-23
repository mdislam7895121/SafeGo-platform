import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, ShoppingCart, Clock, TrendingUp, Calendar } from "lucide-react";

interface OverviewMetrics {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgPreparationTime: number;
  avgOrderValue: number;
  commission: number;
  netPayout: number;
  hourlyDistribution: { hour: number; orders: number; revenue: number }[];
  dailyTrend: { date: string; orders: number; revenue: number }[];
}

export default function AnalyticsOverview() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: metrics, isLoading } = useQuery<OverviewMetrics>({
    queryKey: [`/api/restaurant/analytics/overview?startDate=${startDate}&endDate=${endDate}`],
  });

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Analytics Overview</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-20 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analytics Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track your restaurant's performance and key metrics
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              {formatCurrency(metrics?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Net: {formatCurrency(metrics?.netPayout || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-orders">
              {metrics?.totalOrders || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.completedOrders || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Prep Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-prep-time">
              {metrics?.avgPreparationTime || 0}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average preparation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-order-value">
              {formatCurrency(metrics?.avgOrderValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per completed order</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics?.dailyTrend?.slice(-14).map((day, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium w-24">{new Date(day.date).toLocaleDateString()}</div>
                <div className="flex-1">
                  <div className="h-6 bg-primary/20 rounded relative overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min((day.revenue / (metrics.totalRevenue / metrics.dailyTrend.length)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm font-medium w-20 text-right" data-testid={`text-daily-revenue-${idx}`}>
                  {formatCurrency(day.revenue)}
                </div>
                <div className="text-sm text-muted-foreground w-16 text-right">
                  {day.orders} orders
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Order Heatmap by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            {metrics?.hourlyDistribution?.map((hour) => {
              const maxOrders = Math.max(...(metrics.hourlyDistribution.map((h) => h.orders) || [1]));
              const intensity = hour.orders / maxOrders;
              return (
                <div
                  key={hour.hour}
                  className="p-3 rounded text-center"
                  style={{
                    backgroundColor: `rgba(var(--primary), ${intensity * 0.8 + 0.2})`,
                  }}
                  data-testid={`heatmap-hour-${hour.hour}`}
                >
                  <div className="text-xs font-medium">{hour.hour}:00</div>
                  <div className="text-lg font-bold mt-1">{hour.orders}</div>
                  <div className="text-xs mt-1">{formatCurrency(hour.revenue)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Gross Revenue</span>
              <span className="font-medium" data-testid="text-gross-revenue">
                {formatCurrency(metrics?.totalRevenue || 0)}
              </span>
            </div>
            <div className="flex justify-between text-destructive">
              <span className="text-sm">SafeGo Commission</span>
              <span className="font-medium" data-testid="text-commission">
                -{formatCurrency(metrics?.commission || 0)}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-medium">Net Payout</span>
              <span className="text-lg font-bold" data-testid="text-net-payout">
                {formatCurrency(metrics?.netPayout || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Total Orders</span>
              <span className="font-medium">{metrics?.totalOrders || 0}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span className="text-sm">Completed</span>
              <span className="font-medium" data-testid="text-completed-count">
                {metrics?.completedOrders || 0}
              </span>
            </div>
            <div className="flex justify-between text-destructive">
              <span className="text-sm">Cancelled</span>
              <span className="font-medium" data-testid="text-cancelled-count">
                {metrics?.cancelledOrders || 0}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-medium">Success Rate</span>
              <span className="text-lg font-bold">
                {metrics?.totalOrders
                  ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100)
                  : 0}
                %
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
