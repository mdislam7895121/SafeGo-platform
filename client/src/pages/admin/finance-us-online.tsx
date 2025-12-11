import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CreditCard,
  RefreshCw,
  ExternalLink,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

interface GatewayTransaction {
  orderType: string;
  orderId: string;
  customerId: string;
  driverId: string | null;
  restaurantId: string | null;
  countryCode: string;
  paymentProvider: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReferenceId: string | null;
  currency: string;
  amount: number;
  commissionAmount: number;
  earningsAmount: number;
  createdAt: string;
}

interface GatewayReportResponse {
  data: GatewayTransaction[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalTransactions: number;
    totalCapturedAmount: number;
    totalFailedAmount: number;
    totalOnlineCommission: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "captured":
    case "succeeded":
    case "paid":
      return "default";
    case "pending":
    case "processing":
      return "secondary";
    case "failed":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function getServiceBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "ride":
      return "default";
    case "food":
      return "secondary";
    case "delivery":
      return "outline";
    default:
      return "outline";
  }
}

export default function FinanceUSOnlinePage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  queryParams.set("countryCode", "US");
  queryParams.set("provider", "stripe");
  if (statusFilter !== "all") queryParams.set("paymentStatus", statusFilter);
  if (serviceFilter !== "all") queryParams.set("serviceType", serviceFilter);
  if (fromDate) queryParams.set("fromDate", fromDate);
  if (toDate) queryParams.set("toDate", toDate);
  queryParams.set("page", page.toString());
  queryParams.set("pageSize", "25");

  const { data, isLoading, refetch } = useQuery<GatewayReportResponse>({
    queryKey: ["/api/admin/finance/gateway-reports", "us-stripe", queryParams.toString()],
  });

  const { data: configData } = useQuery<{ featureEnabled: boolean; stripeConfigured: boolean; status: string }>({
    queryKey: ["/api/payments/stripe/us/config"],
  });

  const isFeatureActive = configData?.status === "READY";

  return (
    <div className="space-y-6" data-testid="page-finance-us-online">
      <PageHeader
        title="US Online Payments (Stripe)"
        description="Monitor and manage Stripe payments for US customers across all services"
        icon={CreditCard}
      />

      {!isFeatureActive && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">US Online Payments Not Active</p>
              <p className="text-sm text-muted-foreground">
                {configData?.featureEnabled === false
                  ? "The FEATURE_US_ONLINE_PAYMENTS_ENABLED flag is not set."
                  : "Stripe is not configured. Please set up Stripe credentials."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total-transactions">
                {data?.summary?.totalTransactions ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Captured</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600" data-testid="stat-total-captured">
                {formatCurrency(data?.summary?.totalCapturedAmount ?? 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">SafeGo Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-blue-600" data-testid="stat-total-commission">
                {formatCurrency(data?.summary?.totalOnlineCommission ?? 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600" data-testid="stat-total-failed">
                {formatCurrency(data?.summary?.totalFailedAmount ?? 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter US Stripe transactions by date range and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
                data-testid="input-from-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
                data-testid="input-to-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-32" data-testid="select-service">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="ride">Rides</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="captured">Captured</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>US Stripe Transactions</CardTitle>
          <CardDescription>
            Showing {data?.data?.length ?? 0} of {data?.total ?? 0} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((tx) => (
                  <TableRow key={tx.orderId} data-testid={`row-transaction-${tx.orderId}`}>
                    <TableCell>
                      <Badge variant={getServiceBadgeVariant(tx.orderType)}>
                        {tx.orderType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{tx.orderId.substring(0, 8)}...</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono">{tx.orderId}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell className="text-blue-600">
                      {formatCurrency(tx.commissionAmount)}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(tx.earningsAmount ?? (tx.amount - tx.commissionAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(tx.paymentStatus)}>
                        {tx.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.paymentReferenceId ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help flex items-center gap-1">
                              {tx.paymentReferenceId.substring(0, 12)}...
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-mono">{tx.paymentReferenceId}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.data?.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No US Stripe transactions found for the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {data && data.total > data.pageSize && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                Page {page} of {Math.ceil(data.total / data.pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / data.pageSize)}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
