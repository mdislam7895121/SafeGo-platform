import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  ArrowLeft,
  History,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  Wallet,
  Calendar,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Payout {
  id: string;
  amount: string;
  currency: string;
  status: string;
  method: string;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  scheduledAt: string | null;
}

interface PayoutHistoryResponse {
  payouts: Payout[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface PayoutStatsResponse {
  totalPayouts: number;
  completedPayouts: number;
  pendingPayouts: number;
  totalAmount: string;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bgColor: string; label: string }> = {
  completed: {
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "Completed",
  },
  processing: {
    icon: RefreshCw,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Processing",
  },
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "Pending",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "Failed",
  },
  refunded: {
    icon: AlertCircle,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "Refunded",
  },
};

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  BANK_TRANSFER: "Bank Transfer",
  mobile_wallet: "Mobile Wallet",
  MOBILE_WALLET: "Mobile Wallet",
  manual_request: "Manual Request",
  automatic: "Automatic",
  scheduled: "Scheduled",
};

export default function DriverWalletHistory() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [accumulatedPayouts, setAccumulatedPayouts] = useState<Payout[]>([]);

  const queryParams = new URLSearchParams();
  queryParams.set("limit", limit.toString());
  queryParams.set("offset", offset.toString());
  if (statusFilter !== "all") {
    queryParams.set("status", statusFilter);
  }

  const { data: historyData, isLoading: loadingHistory } = useQuery<PayoutHistoryResponse>({
    queryKey: ["/api/payout/history", statusFilter, offset],
    queryFn: async () => {
      const response = await fetch(`/api/payout/history?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch payout history");
      }
      return response.json();
    },
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<PayoutStatsResponse>({
    queryKey: ["/api/payout/stats"],
  });

  useEffect(() => {
    if (historyData?.payouts) {
      if (offset === 0) {
        setAccumulatedPayouts(historyData.payouts);
      } else {
        setAccumulatedPayouts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPayouts = historyData.payouts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newPayouts];
        });
      }
    }
  }, [historyData?.payouts, offset]);

  useEffect(() => {
    setOffset(0);
    setAccumulatedPayouts([]);
  }, [statusFilter]);

  const payouts = accumulatedPayouts;
  const hasMore = historyData?.hasMore || false;
  const total = historyData?.total || 0;

  const formatCurrency = (amount: string, currency?: string) => {
    const value = parseFloat(amount);
    if (currency === "BDT") {
      return `৳${value.toFixed(2)}`;
    }
    return `$${value.toFixed(2)}`;
  };

  const loadMore = () => {
    setOffset((prev) => prev + limit);
  };

  if (loadingHistory && offset === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver/wallet")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Payout History</h1>
            <p className="text-sm text-muted-foreground">Track all your payouts and withdrawals</p>
          </div>
        </div>

        {loadingStats ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : statsData ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-xl font-bold text-green-600" data-testid="stat-total-paid">
                      {formatCurrency(statsData.totalAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-xl font-bold" data-testid="stat-completed">
                      {statsData.completedPayouts}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-xl font-bold" data-testid="stat-pending">
                      {statsData.pendingPayouts}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} payout${total !== 1 ? "s" : ""} total` : "No payouts yet"}
          </p>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">No payouts yet</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all"
                  ? `No ${statusFilter} payouts found`
                  : "You haven't received any payouts yet. Your payout history will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payouts.map((payout) => {
              const status = statusConfig[payout.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const methodLabel = methodLabels[payout.method] || payout.method;

              return (
                <Card key={payout.id} data-testid={`card-payout-${payout.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`h-10 w-10 rounded-full ${status.bgColor} flex items-center justify-center shrink-0`}>
                          <StatusIcon className={`h-5 w-5 ${status.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold">{methodLabel}</p>
                            <Badge variant="outline" className={`${status.bgColor} ${status.color} border-0`}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{format(new Date(payout.createdAt), "MMM d, yyyy")}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(payout.createdAt), { addSuffix: true })}</span>
                          </div>
                          {payout.processedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Processed: {format(new Date(payout.processedAt), "MMM d, yyyy h:mm a")}
                            </p>
                          )}
                          {payout.failureReason && (
                            <p className="text-sm text-destructive mt-2">
                              {payout.failureReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg" data-testid={`amount-${payout.id}`}>
                          {formatCurrency(payout.amount, payout.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">
                          {payout.currency || "USD"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={loadMore}
                disabled={loadingHistory}
                data-testid="button-load-more"
              >
                {loadingHistory ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Load More
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
