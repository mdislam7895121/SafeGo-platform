import { useQuery } from "@tanstack/react-query";
import {
  XCircle,
  Calendar,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { format } from "date-fns";

export default function OrdersCancellations() {
  const [whoCancelledFilter, setWhoCancelledFilter] = useState("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState("all");

  // Build query URL with params - filter cancelled orders server-side
  const cancellationsQueryUrl = useMemo(() => {
    const params = new URLSearchParams();
    // The FoodOrder status can be "cancelled" when order is cancelled
    // We check whoCancelled field to determine who cancelled it
    if (timeRangeFilter !== "all") {
      params.append("timeRange", timeRangeFilter);
    }
    params.append("limit", "200"); // Reasonable limit for cancelled orders

    return `/api/restaurant/orders?${params.toString()}`;
  }, [timeRangeFilter]);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: [cancellationsQueryUrl],
  });

  const allOrders = ordersData?.orders || [];

  // First filter only cancelled orders, then filter by who cancelled
  const cancelledOrders = useMemo(() => {
    return allOrders.filter((order: any) => order.cancelledAt !== null);
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    if (whoCancelledFilter === "all") return cancelledOrders;
    return cancelledOrders.filter((order: any) => {
      if (whoCancelledFilter === "restaurant") return order.whoCancelled === "restaurant";
      if (whoCancelledFilter === "customer") return order.whoCancelled === "customer";
      if (whoCancelledFilter === "driver") return order.whoCancelled === "driver";
      return true;
    });
  }, [cancelledOrders, whoCancelledFilter]);

  // Calculate stats from cancelled orders
  const stats = useMemo(() => {
    const total = cancelledOrders.length;
    const byRestaurant = cancelledOrders.filter((o: any) => o.whoCancelled === "restaurant").length;
    const byCustomer = cancelledOrders.filter((o: any) => o.whoCancelled === "customer").length;
    const byDriver = cancelledOrders.filter((o: any) => o.whoCancelled === "driver").length;
    const totalLost = cancelledOrders.reduce(
      (sum: number, o: any) => sum + Number(o.totalAmount || 0),
      0
    );

    return { total, byRestaurant, byCustomer, byDriver, totalLost };
  }, [cancelledOrders]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const getWhoCancelledBadge = (whoCancelled: string | null) => {
    if (whoCancelled === "restaurant") return { label: "By Restaurant", variant: "secondary" as const };
    if (whoCancelled === "customer") return { label: "By Customer", variant: "default" as const };
    if (whoCancelled === "driver") return { label: "By Driver", variant: "outline" as const };
    return { label: "Cancelled", variant: "destructive" as const };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Cancelled Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            View and analyze cancelled orders
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cancelled">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Restaurant</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-restaurant-cancelled">
              {stats.byRestaurant}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.byRestaurant / stats.total) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Customer</CardTitle>
            <User className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-customer-cancelled">
              {stats.byCustomer}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.byCustomer / stats.total) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Lost</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-revenue-lost">
              ${stats.totalLost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Potential earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cancelled By</label>
              <Select value={whoCancelledFilter} onValueChange={setWhoCancelledFilter}>
                <SelectTrigger data-testid="select-who-cancelled">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
                <SelectTrigger data-testid="select-time-range">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancelled Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Cancelled Orders List
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <XCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-lg font-medium mb-2">No cancelled orders found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order: any) => {
                const whoCancelledBadge = getWhoCancelledBadge(order.whoCancelled);
                return (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4"
                    data-testid={`order-cancelled-${order.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left Section */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm font-medium">
                            #{order.id.substring(0, 8)}
                          </span>
                          <Badge variant={whoCancelledBadge.variant}>{whoCancelledBadge.label}</Badge>
                          {order.cancellationReason && (
                            <Badge variant="outline" className="text-xs">
                              {order.cancellationReason}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(order.createdAt), "MMM dd, yyyy")}
                          </div>
                          {order.cancelledAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Cancelled {format(new Date(order.cancelledAt), "hh:mm a")}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {order.customer?.user?.email?.substring(0, 10)}***
                          </div>
                        </div>

                        {order.items && (
                          <p className="text-sm text-muted-foreground">
                            {order.items.length} item(s)
                          </p>
                        )}
                      </div>

                      {/* Right Section */}
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Order Value</p>
                        <p className="text-xl font-bold text-red-600">
                          ${Number(order.totalAmount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
