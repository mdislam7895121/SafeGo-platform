import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Wallet, DollarSign, Eye } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface WalletData {
  id: string;
  walletType: "driver" | "restaurant" | "customer";
  ownerType: "driver" | "restaurant" | "customer";
  ownerId: string;
  currency: string;
  availableBalance: string;
  negativeBalance: string;
  lastTransactionDate: string | null;
  createdAt: string;
  owner: {
    email: string;
    countryCode: string;
    cityCode?: string;
    fullName?: string;
    restaurantName?: string;
  };
}

interface WalletsResponse {
  wallets: WalletData[];
  total: number;
}

export default function AdminWallets() {
  const [, navigate] = useLocation();
  const [walletTypeFilter, setWalletTypeFilter] = useState<string>("all");

  // Build query params
  const queryParams = new URLSearchParams();
  if (walletTypeFilter !== "all") queryParams.append("walletType", walletTypeFilter);

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/wallets${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading, error } = useQuery<WalletsResponse>({
    queryKey: [fullUrl],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const getWalletTypeBadge = (type: string) => {
    if (type === "driver") {
      return <Badge className="bg-purple-500 dark:bg-purple-700">Driver</Badge>;
    } else if (type === "customer") {
      return <Badge className="bg-blue-500 dark:bg-blue-700">Customer</Badge>;
    } else {
      return <Badge className="bg-orange-500 dark:bg-orange-700">Restaurant</Badge>;
    }
  };

  const formatCurrency = (amount: string | undefined, currency: string | undefined) => {
    const num = parseFloat(amount || "0");
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBalanceStatus = (availableBalance: string | undefined, negativeBalance: string | undefined, currency: string | undefined) => {
    const available = parseFloat(availableBalance || "0");
    const negative = parseFloat(negativeBalance || "0");

    if (negative > 0) {
      return <Badge variant="destructive">Debt: {formatCurrency(negativeBalance, currency)}</Badge>;
    }
    if (available > 0) {
      return <Badge className="bg-green-500 dark:bg-green-700">Positive</Badge>;
    }
    return <Badge variant="secondary">Zero Balance</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Wallet Management</h1>
              <p className="text-[11px] text-muted-foreground">View and manage all wallets</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">Total Wallets</p>
                <p className="text-sm text-muted-foreground">
                  {data?.total ?? 0} active wallets
                </p>
              </div>
            </div>

            {/* Filters */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Filter by Type
              </label>
              <Select
                value={walletTypeFilter}
                onValueChange={setWalletTypeFilter}
              >
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-4">
        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center">
              <p className="text-destructive font-semibold mb-2">Failed to load wallets</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wallets List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !error && data?.wallets && data.wallets.length > 0 ? (
          <div className="space-y-3">
            {data.wallets.map((wallet) => {
              const ownerName = wallet.walletType === "driver" || wallet.walletType === "customer"
                ? wallet.owner?.fullName || wallet.owner?.email || "Unknown"
                : wallet.owner?.restaurantName || wallet.owner?.email || "Unknown Restaurant";
              
              return (
                <Card key={wallet.id} className="hover-elevate" data-testid={`card-wallet-${wallet.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <p className="font-semibold truncate" data-testid={`text-owner-${wallet.id}`}>
                            {ownerName}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {getWalletTypeBadge(wallet.walletType || wallet.ownerType)}
                          <Badge variant="outline">{wallet.owner?.countryCode || "N/A"}</Badge>
                          {getBalanceStatus(wallet.availableBalance, wallet.negativeBalance, wallet.currency)}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Available Balance</p>
                            <p className="font-semibold text-lg" data-testid={`text-balance-${wallet.id}`}>
                              {formatCurrency(wallet.availableBalance, wallet.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Negative Balance</p>
                            <p className="font-semibold text-lg text-red-600 dark:text-red-400" data-testid={`text-debt-${wallet.id}`}>
                              {formatCurrency(wallet.negativeBalance, wallet.currency)}
                            </p>
                          </div>
                        </div>

                        {wallet.lastTransactionDate && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last transaction: {format(new Date(wallet.lastTransactionDate), "MMM d, yyyy h:mm a")}
                          </p>
                        )}
                      </div>

                      <Link href={`/admin/wallets/${wallet.id}`}>
                        <Button
                          variant="outline"
                          size="icon"
                          data-testid={`button-view-${wallet.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : !error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No wallets found</p>
              <p className="text-xs text-muted-foreground mt-2">
                {walletTypeFilter !== "all" ? `Try changing the filter` : "Wallets will appear here when users are created"}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
