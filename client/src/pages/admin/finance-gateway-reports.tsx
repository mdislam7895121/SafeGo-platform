import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CreditCard,
  RefreshCw,
  ExternalLink,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "captured":
    case "succeeded":
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

export default function FinanceGatewayReportsPage() {
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (countryFilter !== "all") queryParams.set("countryCode", countryFilter);
  if (providerFilter !== "all") queryParams.set("provider", providerFilter);
  if (methodFilter !== "all") queryParams.set("paymentMethod", methodFilter);
  if (statusFilter !== "all") queryParams.set("paymentStatus", statusFilter);
  if (serviceFilter !== "all") queryParams.set("serviceType", serviceFilter);
  if (fromDate) queryParams.set("fromDate", fromDate);
  if (toDate) queryParams.set("toDate", toDate);
  queryParams.set("page", page.toString());
  queryParams.set("pageSize", "20");

  const { data, isLoading, refetch } = useQuery<GatewayReportResponse>({
    queryKey: ["/api/admin/finance/gateway-reports", queryParams.toString()],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gateway Reports"
        description="Payment gateway transactions across all services"
        icon={CreditCard}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="sslcommerz">SSLCOMMERZ</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="stripe_card">Stripe Card</SelectItem>
                  <SelectItem value="apple_pay">Apple Pay</SelectItem>
                  <SelectItem value="google_pay">Google Pay</SelectItem>
                  <SelectItem value="sslcommerz_online">SSLCOMMERZ</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="captured">Captured</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ride">Ride</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-from-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-to-date"
              />
            </div>
            <Button variant="outline" onClick={() => { setPage(1); refetch(); }} data-testid="button-apply-filters">
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold">{data.summary.totalTransactions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Captured Amount</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.totalCapturedAmount, "BDT")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Failed Amount</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(data.summary.totalFailedAmount, "BDT")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Online Commission</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.summary.totalOnlineCommission, "BDT")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((tx) => (
                    <TableRow key={`${tx.orderType}-${tx.orderId}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.countryCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getServiceBadgeVariant(tx.orderType)}>
                          {tx.orderType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer hover:underline" data-testid={`text-order-${tx.orderId}`}>
                              {tx.orderId.slice(0, 8)}...
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{tx.orderId}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{tx.paymentProvider}</TableCell>
                      <TableCell>{tx.paymentMethod}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrency(tx.commissionAmount, tx.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(tx.paymentStatus)}>
                          {tx.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.paymentReferenceId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer text-xs">
                                {tx.paymentReferenceId.slice(0, 10)}...
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{tx.paymentReferenceId}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(data.total / 20)}
            onClick={() => setPage(page + 1)}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
