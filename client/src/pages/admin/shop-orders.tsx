import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, Filter, ShoppingBag, Eye, Store, DollarSign, RefreshCw, Calendar } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStateCard } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface ShopOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  safegoCommission: number;
  shopPayout: number;
  paymentMethod: string;
  paymentStatus: string;
  placedAt: string;
  deliveredAt: string | null;
  shopName: string;
  shopLogo: string | null;
  countryCode: string;
  customerEmail: string;
  customerName: string;
  itemCount: number;
}

interface ShopOrdersResponse {
  success: boolean;
  orders: ShopOrder[];
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
    totalPayouts: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AdminShopOrders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get("status");
    const searchParam = urlParams.get("search");
    const pageParam = urlParams.get("page");
    
    if (statusParam) setStatusFilter(statusParam);
    if (searchParam) setSearchQuery(searchParam);
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, []);

  const { data, isLoading, refetch } = useQuery<ShopOrdersResponse>({
    queryKey: ["/api/admin/shop-orders", { 
      search: searchQuery || undefined, 
      status: statusFilter !== "all" ? statusFilter : undefined,
      paymentMethod: paymentFilter !== "all" ? paymentFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: currentPage,
      limit: 20,
    }],
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      placed: { label: "Placed", variant: "outline" },
      accepted: { label: "Accepted", variant: "secondary" },
      packing: { label: "Packing", variant: "secondary" },
      ready_for_pickup: { label: "Ready", variant: "secondary" },
      picked_up: { label: "Picked Up", variant: "secondary" },
      on_the_way: { label: "On The Way", variant: "default" },
      delivered: { label: "Delivered", variant: "default" },
      cancelled_by_customer: { label: "Cancelled (Customer)", variant: "destructive" },
      cancelled_by_shop: { label: "Cancelled (Shop)", variant: "destructive" },
      cancelled_by_driver: { label: "Cancelled (Driver)", variant: "destructive" },
      refunded: { label: "Refunded", variant: "outline" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" as const };
    return (
      <Badge variant={statusInfo.variant} data-testid={`badge-status-${status}`}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getPaymentBadge = (method: string, status: string) => {
    const methodLabel = method === "cash" ? "Cash" : "Online";
    const variant = status === "paid" ? "default" : "secondary";
    return (
      <Badge variant={variant} data-testid={`badge-payment-${method}-${status}`}>
        {methodLabel} - {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Shop Orders (BD)"
        description="Monitor all shop product orders in Bangladesh"
        icon={ShoppingBag}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number or shop name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="packing">Packing</SelectItem>
                  <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                  <SelectItem value="on_the_way">On The Way</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled_by_customer">Cancelled (Customer)</SelectItem>
                  <SelectItem value="cancelled_by_shop">Cancelled (Shop)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={(value) => { setPaymentFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-payment">
                  <SelectValue placeholder="All Payment Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment Methods</SelectItem>
                  <SelectItem value="cash">Cash on Delivery</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                  placeholder="From date"
                  data-testid="input-date-from"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                  placeholder="To date"
                  data-testid="input-date-to"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-orders">{data.stats.totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Revenue</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-revenue">৳{data.stats.totalRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Commission</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-commission">৳{data.stats.totalCommission.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Partner Payouts</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-payouts">৳{data.stats.totalPayouts.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !data?.orders?.length ? (
              <EmptyStateCard
                icon={ShoppingBag}
                title="No Orders Found"
                description="No shop orders match your current filters."
              />
            ) : (
              <div className="space-y-4">
                {data.orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover-elevate gap-4"
                    data-testid={`card-order-${order.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {order.shopLogo ? (
                        <img src={order.shopLogo} alt={order.shopName} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Store className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" data-testid={`text-order-number-${order.id}`}>
                            #{order.orderNumber}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-shop-name-${order.id}`}>{order.shopName}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.customerName} • {order.itemCount} items
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.placedAt), "dd MMM yyyy, HH:mm")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" data-testid={`text-amount-${order.id}`}>৳{order.totalAmount.toLocaleString()}</span>
                        {getPaymentBadge(order.paymentMethod, order.paymentStatus)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Commission: ৳{order.safegoCommission.toLocaleString()}
                      </div>
                      <Link href={`/admin/shop-partner-details/${order.id}`}>
                        <Button variant="ghost" size="sm" data-testid={`button-view-${order.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data?.pagination && data.pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  data-testid="button-prev"
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground" data-testid="text-pagination">
                  Page {currentPage} of {data.pagination.pages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage >= data.pagination.pages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  data-testid="button-next"
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
