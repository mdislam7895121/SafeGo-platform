import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Wallet, DollarSign, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface WalletInfo {
  id: string;
  walletType: "driver" | "restaurant";
  driverId: string | null;
  restaurantId: string | null;
  currency: string;
  availableBalance: string;
  negativeBalance: string;
  lastTransactionDate: string | null;
  createdAt: string;
  owner: {
    email: string;
    countryCode: string;
    fullName?: string;
    restaurantName?: string;
  };
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  negativeBalanceAfter: string;
  description: string;
  metadata: any;
  createdAt: string;
}

interface WalletDetailsResponse {
  wallet: WalletInfo;
  transactions: WalletTransaction[];
  total: number;
}

export default function AdminWalletDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/wallets/:id");
  const walletId = params?.id;

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Build query params
  const queryParams = new URLSearchParams();
  if (typeFilter !== "all") queryParams.append("type", typeFilter);
  queryParams.append("limit", limit.toString());
  queryParams.append("offset", offset.toString());

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/wallets/${walletId}${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<WalletDetailsResponse>({
    queryKey: [fullUrl],
    enabled: !!walletId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const formatCurrency = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTransactionTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      RIDE_EARNING: "bg-green-500 dark:bg-green-700",
      FOOD_EARNING: "bg-green-500 dark:bg-green-700",
      PARCEL_EARNING: "bg-green-500 dark:bg-green-700",
      COMMISSION_DEDUCTION: "bg-red-500 dark:bg-red-700",
      PAYOUT_DEDUCTION: "bg-orange-500 dark:bg-orange-700",
      SETTLEMENT: "bg-blue-500 dark:bg-blue-700",
      REFUND: "bg-purple-500 dark:bg-purple-700",
      ADJUSTMENT: "bg-gray-500 dark:bg-gray-700",
    };

    return (
      <Badge className={typeColors[type] || "bg-gray-500 dark:bg-gray-700"}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getAmountDisplay = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const symbol = currency === "BDT" ? "৳" : "$";
    const absAmount = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatted = `${symbol}${absAmount}`;
    const isCredit = num > 0;

    return (
      <span className={isCredit ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
        {isCredit ? "+" : "-"}{formatted}
      </span>
    );
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (data && data.transactions.length === limit) {
      setOffset(offset + limit);
    }
  };

  if (!walletId) {
    return <div>Invalid wallet ID</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Wallet Ledger"
        description="Transaction history"
        icon={Wallet}
        backButton={{ label: "Back to Wallets", href: "/admin/wallets" }}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Wallet Summary */}
        {isLoading ? (
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : data?.wallet ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="h-6 w-6 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-lg" data-testid="text-wallet-owner">
                    {data.wallet.walletType === "driver" 
                      ? data.wallet.owner.fullName || data.wallet.owner.email
                      : data.wallet.owner.restaurantName || data.wallet.owner.email
                    }
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge className={data.wallet.walletType === "driver" ? "bg-purple-500 dark:bg-purple-700" : "bg-orange-500 dark:bg-orange-700"}>
                      {data.wallet.walletType === "driver" ? "Driver" : "Restaurant"}
                    </Badge>
                    <Badge variant="outline">{data.wallet.owner.countryCode}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-available-balance">
                    {formatCurrency(data.wallet.availableBalance, data.wallet.currency)}
                  </p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Negative Balance</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-negative-balance">
                    {formatCurrency(data.wallet.negativeBalance, data.wallet.currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Filter by Type:</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-64" data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="RIDE_EARNING">Ride Earning</SelectItem>
                  <SelectItem value="FOOD_EARNING">Food Earning</SelectItem>
                  <SelectItem value="PARCEL_EARNING">Parcel Earning</SelectItem>
                  <SelectItem value="COMMISSION_DEDUCTION">Commission</SelectItem>
                  <SelectItem value="PAYOUT_DEDUCTION">Payout</SelectItem>
                  <SelectItem value="SETTLEMENT">Settlement</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        ) : data?.transactions && data.transactions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((txn) => (
                      <TableRow key={txn.id} data-testid={`row-transaction-${txn.id}`}>
                        <TableCell className="text-sm">
                          {format(new Date(txn.createdAt), "MMM d, yyyy")}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(txn.createdAt), "h:mm a")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getTransactionTypeBadge(txn.type)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm" data-testid={`text-description-${txn.id}`}>
                            {txn.description}
                          </p>
                          {txn.metadata && Object.keys(txn.metadata).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {Object.entries(txn.metadata).map(([key, value]) => (
                                <span key={key} className="mr-2">
                                  {key}: {String(value)}
                                </span>
                              ))}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-amount-${txn.id}`}>
                          {getAmountDisplay(txn.amount, data.wallet.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm" data-testid={`text-balance-after-${txn.id}`}>
                          {formatCurrency(txn.balanceAfter, data.wallet.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  onClick={handlePreviousPage}
                  disabled={offset === 0}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Showing {offset + 1} - {offset + data.transactions.length} of {data.total}
                </span>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={data.transactions.length < limit}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No transactions found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
