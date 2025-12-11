import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, ShoppingBag, MapPin } from "lucide-react";

interface CustomerAnalytics {
  repeatCustomerRatio: number;
  newCustomers: number;
  returningCustomers: number;
  avgBasketSize: number;
  topAreas: { area: string; orderCount: number }[];
}

export default function AnalyticsCustomers() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: analytics, isLoading } = useQuery<CustomerAnalytics>({
    queryKey: [`/api/restaurant/analytics/customers?startDate=${startDate}&endDate=${endDate}`],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <h1 className="text-2xl font-bold mb-6">Customer Analytics</h1>
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
    );
  }

  const totalCustomers = (analytics?.newCustomers || 0) + (analytics?.returningCustomers || 0);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Customer Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Understand your customer base and behavior
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
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-customers">
              {totalCustomers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unique customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-new-customers">
              {analytics?.newCustomers || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">First-time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repeat Customer Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-repeat-ratio">
              {analytics?.repeatCustomerRatio || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.returningCustomers || 0} returning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Basket Size</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-basket-size">
              {analytics?.avgBasketSize || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">New Customers</span>
                  <span className="text-sm font-bold text-green-600">
                    {analytics?.newCustomers || 0}
                  </span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-green-600"
                    style={{
                      width: `${totalCustomers > 0 ? ((analytics?.newCustomers || 0) / totalCustomers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Returning Customers</span>
                  <span className="text-sm font-bold text-blue-600">
                    {analytics?.returningCustomers || 0}
                  </span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{
                      width: `${totalCustomers > 0 ? ((analytics?.returningCustomers || 0) / totalCustomers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-muted-foreground">Repeat Customer Ratio</div>
                  <div className="text-2xl font-bold mt-1">
                    {analytics?.repeatCustomerRatio || 0}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Unique</div>
                  <div className="text-2xl font-bold mt-1">{totalCustomers}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Customer Areas */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Top Customer Areas</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.topAreas && analytics.topAreas.length > 0 ? (
                analytics.topAreas.map((area, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                    data-testid={`top-area-${idx}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-lg font-bold text-muted-foreground">#{idx + 1}</div>
                      <div className="font-medium">{area.area}</div>
                    </div>
                    <div className="text-lg font-bold">{area.orderCount} orders</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No area data available for this period
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground mb-1">Avg Items per Order</div>
              <div className="text-2xl font-bold">{analytics?.avgBasketSize || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Basket size indicator
              </p>
            </div>

            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground mb-1">Customer Retention</div>
              <div className="text-2xl font-bold">{analytics?.repeatCustomerRatio || 0}%</div>
              <p className="text-xs text-muted-foreground mt-2">
                {analytics?.repeatCustomerRatio && analytics.repeatCustomerRatio >= 40
                  ? "Excellent retention"
                  : analytics?.repeatCustomerRatio && analytics.repeatCustomerRatio >= 25
                    ? "Good retention"
                    : "Focus on retention"}
              </p>
            </div>

            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground mb-1">Growth Indicator</div>
              <div className="text-2xl font-bold">
                {totalCustomers > 0
                  ? Math.round(((analytics?.newCustomers || 0) / totalCustomers) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground mt-2">New customer ratio</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
