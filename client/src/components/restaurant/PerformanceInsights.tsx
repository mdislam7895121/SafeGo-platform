import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Check,
  X,
  Clock,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type TimeRange = "today" | "7d" | "30d";

interface AnalyticsData {
  range: string;
  groupBy: "hour" | "day";
  kpis: {
    totalOrders: number;
    totalEarnings: number;
    averageOrderValue: number;
    acceptanceRate: number;
    cancellationRate: number;
    onTimeCompletionCount: number;
  };
  charts: {
    ordersOverTime: { date: string; count: number }[];
    earningsOverTime: { date: string; amount: number }[];
    topItems: { name: string; count: number; revenue: number }[];
    topCategories: { name: string; count: number; revenue: number }[];
  };
  recentOrders: {
    id: string;
    orderCode: string;
    customerName: string;
    amount: number;
    orderType: string;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }[];
}

export function PerformanceInsights() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/restaurant/analytics", timeRange],
    queryFn: () => apiRequest(`/api/restaurant/analytics?range=${timeRange}`),
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { kpis, charts, recentOrders } = data;

  // Format status
  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Status badge variant
  const getStatusVariant = (status: string) => {
    if (status.includes("cancelled")) return "destructive";
    if (status === "completed" || status === "delivered") return "default";
    if (status === "placed") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Insights
        </h2>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <TabsList data-testid="tabs-analytics-range">
            <TabsTrigger value="today" data-testid="tab-analytics-today">
              Today
            </TabsTrigger>
            <TabsTrigger value="7d" data-testid="tab-analytics-7d">
              7 Days
            </TabsTrigger>
            <TabsTrigger value="30d" data-testid="tab-analytics-30d">
              30 Days
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Orders */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Orders</span>
              </div>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="kpi-total-orders">
              {kpis.totalOrders}
            </p>
          </CardContent>
        </Card>

        {/* Total Earnings */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Earnings</span>
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-green-600" data-testid="kpi-total-earnings">
              ${kpis.totalEarnings.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">After SafeGo fees</p>
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Order Value</span>
              </div>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="kpi-aov">
              ${kpis.averageOrderValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Acceptance Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Acceptance Rate</span>
              </div>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="kpi-acceptance-rate">
              {kpis.acceptanceRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Cancellation Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cancellation Rate</span>
              </div>
            </div>
            <p
              className={`text-2xl font-bold mt-2 ${
                kpis.cancellationRate > 10 ? "text-red-600" : ""
              }`}
              data-testid="kpi-cancellation-rate"
            >
              {kpis.cancellationRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* On-time Completion */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Completed Orders</span>
              </div>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="kpi-completed">
              {kpis.onTimeCompletionCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {charts.ordersOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={charts.ordersOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (data.groupBy === "hour") {
                        return value;
                      }
                      const date = new Date(value);
                      return format(date, "MMM d");
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No order data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earnings Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {charts.earningsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts.earningsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (data.groupBy === "hour") {
                        return value;
                      }
                      const date = new Date(value);
                      return format(date, "MMM d");
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Earnings"]}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No earnings data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Categories and Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {charts.topCategories.length > 0 ? (
              <div className="space-y-3">
                {charts.topCategories.map((category, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.count} orders</p>
                    </div>
                    <p className="font-semibold text-green-600">${category.revenue.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Items</CardTitle>
          </CardHeader>
          <CardContent>
            {charts.topItems.length > 0 ? (
              <div className="space-y-3">
                {charts.topItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.count} orders</p>
                    </div>
                    <p className="font-semibold text-green-600">${item.revenue.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No item data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Order ID
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Time
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Customer
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-2">
                      Amount
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Type
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => (window.location.href = `/restaurant/orders/${order.id}`)}
                      data-testid={`row-order-${order.id}`}
                    >
                      <td className="py-3 text-sm">#{order.orderCode || order.id.slice(0, 8)}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, h:mm a")}
                      </td>
                      <td className="py-3 text-sm">{order.customerName}</td>
                      <td className="py-3 text-sm text-right font-medium">
                        ${order.amount.toFixed(2)}
                      </td>
                      <td className="py-3 text-sm capitalize">{order.orderType}</td>
                      <td className="py-3">
                        <Badge variant={getStatusVariant(order.status)} className="text-xs">
                          {formatStatus(order.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No recent orders
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
