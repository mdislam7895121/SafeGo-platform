import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, AlertCircle, Clock } from "lucide-react";

interface ItemAnalytics {
  topItems: { itemName: string; orderCount: number; totalAttempts: number; revenue: number }[];
  worstItems: { itemName: string; orderCount: number; totalAttempts: number; revenue: number }[];
  highCancellationItems: { itemName: string; totalAttempts: number; cancellationCount: number; cancellationRate: number }[];
  avgPrepTimeByItem: { itemName: string; avgPrepTime: number }[];
}

export default function AnalyticsItems() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: analytics, isLoading } = useQuery<ItemAnalytics>({
    queryKey: [`/api/restaurant/analytics/items?startDate=${startDate}&endDate=${endDate}`],
  });

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <h1 className="text-2xl font-bold mb-6">Item Analytics</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-60 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Item Performance Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Analyze your menu items' sales and performance
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle>Top Selling Items</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.topItems && analytics.topItems.length > 0 ? (
                analytics.topItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                    data-testid={`top-item-${idx}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.orderCount} delivered ({item.totalAttempts} total)
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data available for this period
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worst Performing Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              <CardTitle>Lowest Performing Items</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.worstItems && analytics.worstItems.length > 0 ? (
                analytics.worstItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                    data-testid={`worst-item-${idx}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.orderCount} delivered ({item.totalAttempts} total)
                      </div>
                    </div>
                    <div className="text-lg font-bold text-destructive">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data available for this period
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* High Cancellation Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle>High Cancellation Items</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.highCancellationItems && analytics.highCancellationItems.length > 0 ? (
                analytics.highCancellationItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                    data-testid={`cancellation-item-${idx}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.cancellationCount} cancelled ({item.totalAttempts} total)
                      </div>
                    </div>
                    <div className="text-lg font-bold text-orange-600">
                      {item.cancellationRate}%
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No cancellation data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preparation Time by Item */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle>Average Prep Time by Item</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.avgPrepTimeByItem && analytics.avgPrepTimeByItem.length > 0 ? (
                analytics.avgPrepTimeByItem.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                    data-testid={`prep-time-item-${idx}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.itemName}</div>
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {item.avgPrepTime}m
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No preparation time data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
