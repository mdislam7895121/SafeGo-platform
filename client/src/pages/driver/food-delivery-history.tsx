import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Store,
  DollarSign,
  CheckCircle2,
  XCircle,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface HistoryDelivery {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  status: string;
  restaurantName: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  earnings: number;
  deliveredAt: string | null;
  acceptedAt: string | null;
}

interface HistoryResponse {
  deliveries: HistoryDelivery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type DateFilter = "today" | "7days" | "30days" | "all";
type StatusFilter = "all" | "delivered" | "cancelled";

export default function DriverFoodDeliveryHistory() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const queryString = (() => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    
    if (dateFilter !== "all") {
      params.set("dateFilter", dateFilter);
    }
    
    return params.toString();
  })();

  const { data, isLoading, error, refetch } = useQuery<HistoryResponse>({
    queryKey: [`/api/driver/food-delivery/history?${queryString}`],
  });

  const totalEarnings = data?.deliveries.reduce((sum, d) => 
    d.status === "delivered" ? sum + (d.earnings || 0) : sum, 0
  ) || 0;

  const completedCount = data?.deliveries.filter(d => d.status === "delivered").length || 0;
  const cancelledCount = data?.deliveries.filter(d => d.status === "cancelled").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Link href="/driver/food-deliveries">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold" data-testid="text-page-title">Delivery History</h1>
              <p className="text-sm text-muted-foreground">
                {data?.pagination.total || 0} total deliveries
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setPage(1); }}>
            <SelectTrigger className="w-[130px]" data-testid="select-date-filter">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
            <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-lg font-bold text-green-600" data-testid="text-total-earnings">
                ${totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Earnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-lg font-bold" data-testid="text-completed-count">
                {completedCount}
              </p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
              <p className="text-lg font-bold" data-testid="text-cancelled-count">
                {cancelledCount}
              </p>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="font-medium mb-2">Failed to Load History</h3>
              <p className="text-sm text-muted-foreground">
                Please try again later
              </p>
            </CardContent>
          </Card>
        ) : (data?.deliveries?.length || 0) === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No Delivery History</h3>
              <p className="text-sm text-muted-foreground">
                Your completed deliveries will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="list-history">
            {data?.deliveries.map((delivery) => (
              <Card key={delivery.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-orange-500" />
                        <span className="font-medium" data-testid={`text-restaurant-${delivery.id}`}>
                          {delivery.restaurantName || "Restaurant"}
                        </span>
                        {delivery.orderCode && (
                          <Badge variant="outline" className="text-xs">
                            #{delivery.orderCode}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {delivery.deliveredAt 
                          ? format(new Date(delivery.deliveredAt), "MMM d, yyyy 'at' h:mm a")
                          : delivery.acceptedAt
                          ? format(new Date(delivery.acceptedAt), "MMM d, yyyy 'at' h:mm a")
                          : "Date unavailable"
                        }
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`font-semibold ${delivery.status === "delivered" ? "text-green-600" : "text-muted-foreground"}`}>
                        ${(delivery.earnings || 0).toFixed(2)}
                      </p>
                      <Badge 
                        variant={delivery.status === "delivered" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {delivery.status === "delivered" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Delivered
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelled
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.pagination.totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page >= data.pagination.totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
