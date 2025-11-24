import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Filter,
  ChevronRight,
  Calendar,
  DollarSign,
  Package,
  Clock,
  MapPin,
  User,
  Truck,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { ordersKeys } from "@/lib/queryKeys";

export default function RestaurantOrders() {

  const [, navigate] = useLocation();

  // Filters state
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 20;

  // Build filters object
  const filters = useMemo(() => {
    const f: Record<string, any> = {
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
    };

    if (statusFilter !== "all") f.status = statusFilter;
    if (orderTypeFilter !== "all") f.orderType = orderTypeFilter;
    if (timeRangeFilter !== "all") f.timeRange = timeRangeFilter;
    if (paymentStatusFilter !== "all") f.paymentStatus = paymentStatusFilter;

    return f;
  }, [statusFilter, orderTypeFilter, timeRangeFilter, paymentStatusFilter, currentPage]);

  // Fetch orders with filters using query key factory
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ordersKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, value.toString());
      });
      return await apiRequest(`/api/restaurant/orders?${params.toString()}`);
    },
  });

  const orders = ordersData?.orders || [];
  const pagination = ordersData?.pagination || { total: 0, hasMore: false };
  const totalPages = Math.ceil(pagination.total / itemsPerPage);

  // Status badge variant helper
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "placed":
      case "new":
        return "default";
      case "accepted":
      case "preparing":
        return "secondary";
      case "ready_for_pickup":
      case "picked_up":
      case "on_the_way":
        return "outline";
      case "completed":
      case "delivered":
        return "default";
      case "cancelled":
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Format status text
  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-6">
        {/* Filter Bar - Stable 24px spacing from header */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="placed">New</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready_for_pickup">Ready</SelectItem>
                    <SelectItem value="on_the_way">Out for Delivery</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Order Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Order Type</label>
                <Select
                  value={orderTypeFilter}
                  onValueChange={(value) => {
                    setOrderTypeFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time Range Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Time Range</label>
                <Select
                  value={timeRangeFilter}
                  onValueChange={(value) => {
                    setTimeRangeFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-time-filter">
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

              {/* Payment Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Payment Status</label>
                <Select
                  value={paymentStatusFilter}
                  onValueChange={(value) => {
                    setPaymentStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-payment-filter">
                    <SelectValue placeholder="All Payments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters Display */}
            {(statusFilter !== "all" ||
              orderTypeFilter !== "all" ||
              timeRangeFilter !== "all" ||
              paymentStatusFilter !== "all") && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {statusFilter !== "all" && (
                    <Badge variant="secondary">{formatStatus(statusFilter)}</Badge>
                  )}
                  {orderTypeFilter !== "all" && (
                    <Badge variant="secondary">{orderTypeFilter}</Badge>
                  )}
                  {timeRangeFilter !== "all" && (
                    <Badge variant="secondary">{timeRangeFilter.replace(/([A-Z])/g, " $1")}</Badge>
                  )}
                  {paymentStatusFilter !== "all" && (
                    <Badge variant="secondary">{paymentStatusFilter}</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStatusFilter("all");
                      setOrderTypeFilter("all");
                      setTimeRangeFilter("all");
                      setPaymentStatusFilter("all");
                      setCurrentPage(1);
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Orders List
              {!ordersLoading && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({orders.length} of {pagination.total})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                <p className="text-lg font-medium mb-2">No orders found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or check back later
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 hover-elevate transition-all cursor-pointer"
                    onClick={() => navigate(`/restaurant/orders/${order.id}`)}
                    data-testid={`order-row-${order.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left Section: Order Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm font-medium">
                            #{order.id.substring(0, 8)}
                          </span>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {formatStatus(order.status)}
                          </Badge>
                          <Badge variant="outline">
                            {order.orderType === "delivery" ? (
                              <>
                                <Truck className="h-3 w-3 mr-1" />
                                Delivery
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="h-3 w-3 mr-1" />
                                Pickup
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(order.createdAt), "MMM dd, yyyy")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(order.createdAt), "hh:mm a")}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {order.customer?.user?.email?.substring(0, 3)}***
                          </div>
                        </div>

                        {/* Items summary */}
                        {order.items && (
                          <p className="text-sm text-muted-foreground">
                            {order.items.length} item(s)
                          </p>
                        )}
                      </div>

                      {/* Right Section: Price and Action */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">Total</p>
                          <p className="text-xl font-bold text-primary">
                            ${Number(order.totalAmount).toFixed(2)}
                          </p>
                          {order.paymentStatus && (
                            <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"} className="text-xs mt-1">
                              {order.paymentStatus}
                            </Badge>
                          )}
                        </div>
                        <Button size="sm" variant="outline" data-testid={`button-view-${order.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        size="sm"
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => setCurrentPage(page)}
                        data-testid={`button-page-${page}`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && <span className="px-2">...</span>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
