import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  History,
  RefreshCw,
  Eye,
  Car,
  Building2,
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { format } from "date-fns";

interface Settlement {
  id: string;
  userType: string;
  userId: string;
  userName: string | null;
  countryCode: string;
  totalAmount: number;
  currency: string;
  method: string;
  reference: string | null;
  notes: string | null;
  status: string;
  createdByAdminId: string;
  createdByAdminName: string | null;
  createdAt: string;
  ordersCount: number;
}

interface SettlementDetails extends Settlement {
  orders: Array<{
    id: string;
    orderType: string;
    orderId: string;
    commissionAmountApplied: number;
    createdAt: string;
  }>;
}

interface SettlementsResponse {
  data: Settlement[];
  total: number;
  page: number;
  pageSize: number;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    cash_deposit: "Cash Deposit",
    bkash: "bKash",
    nagad: "Nagad",
    stripe_payout_adjust: "Stripe Adjust",
    other: "Other",
  };
  return labels[method] || method;
}

export default function FinanceSettlementsHistoryPage() {
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (userTypeFilter !== "all") queryParams.set("userType", userTypeFilter);
  if (countryFilter !== "all") queryParams.set("countryCode", countryFilter);
  if (methodFilter !== "all") queryParams.set("method", methodFilter);
  if (fromDate) queryParams.set("fromDate", fromDate);
  if (toDate) queryParams.set("toDate", toDate);
  queryParams.set("page", page.toString());
  queryParams.set("pageSize", "20");

  const { data, isLoading, refetch } = useQuery<SettlementsResponse>({
    queryKey: ["/api/admin/finance/settlements", queryParams.toString()],
  });

  const { data: settlementDetails, isLoading: detailsLoading } = useQuery<SettlementDetails>({
    queryKey: ["/api/admin/finance/settlements", selectedSettlementId],
    enabled: !!selectedSettlementId,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlements History"
        description="View all recorded settlements for drivers and restaurants"
        icon={History}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>User Type</Label>
              <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-user-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="driver">Drivers</SelectItem>
                  <SelectItem value="restaurant">Restaurants</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <Label>Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash_deposit">Cash Deposit</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="stripe_payout_adjust">Stripe Adjust</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
            <Button variant="outline" onClick={() => { setPage(1); refetch(); }} data-testid="button-apply">
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No settlements found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(settlement.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={settlement.userType === "driver" ? "default" : "secondary"}>
                          {settlement.userType === "driver" ? (
                            <Car className="h-3 w-3 mr-1" />
                          ) : (
                            <Building2 className="h-3 w-3 mr-1" />
                          )}
                          {settlement.userType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{settlement.userName || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{settlement.userId.slice(0, 8)}...</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{settlement.countryCode}</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        {formatCurrency(settlement.totalAmount, settlement.currency)}
                      </TableCell>
                      <TableCell>{getMethodLabel(settlement.method)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {settlement.reference || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {settlement.createdByAdminName || settlement.createdByAdminId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{settlement.ordersCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSettlementId(settlement.id)}
                              data-testid={`button-view-${settlement.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-[500px] sm:w-[600px]">
                            <SheetHeader>
                              <SheetTitle>Settlement Details</SheetTitle>
                              <SheetDescription>
                                ID: {settlement.id.slice(0, 12)}...
                              </SheetDescription>
                            </SheetHeader>
                            <div className="mt-6 space-y-4">
                              {detailsLoading ? (
                                <Skeleton className="h-32 w-full" />
                              ) : settlementDetails ? (
                                <>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Amount</p>
                                      <p className="text-xl font-bold text-green-600">
                                        {formatCurrency(settlementDetails.totalAmount, settlementDetails.currency)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Method</p>
                                      <p className="text-xl font-bold">{getMethodLabel(settlementDetails.method)}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">User</p>
                                      <p className="font-medium">
                                        {settlementDetails.userName || settlementDetails.userId}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Created By</p>
                                      <p className="font-medium">
                                        {settlementDetails.createdByAdminName || settlementDetails.createdByAdminId}
                                      </p>
                                    </div>
                                  </div>

                                  {settlementDetails.reference && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">Reference</p>
                                      <p className="font-medium">{settlementDetails.reference}</p>
                                    </div>
                                  )}

                                  {settlementDetails.notes && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">Notes</p>
                                      <p className="text-sm">{settlementDetails.notes}</p>
                                    </div>
                                  )}

                                  <div>
                                    <h4 className="font-medium mb-2">Applied Orders ({settlementDetails.orders.length})</h4>
                                    {settlementDetails.orders.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No orders associated</p>
                                    ) : (
                                      <div className="max-h-64 overflow-y-auto border rounded">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Type</TableHead>
                                              <TableHead>Order ID</TableHead>
                                              <TableHead>Commission</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {settlementDetails.orders.map((order) => (
                                              <TableRow key={order.id}>
                                                <TableCell>
                                                  <Badge variant="outline">{order.orderType}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm font-mono">
                                                  {order.orderId.slice(0, 12)}...
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                  {formatCurrency(order.commissionAmountApplied, settlementDetails.currency)}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <p className="text-muted-foreground">Settlement not found</p>
                              )}
                            </div>
                          </SheetContent>
                        </Sheet>
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
