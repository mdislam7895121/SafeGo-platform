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

interface WalletsResponse {
  wallets: WalletData[];
  total: number;
}

export default function AdminWallets() {
  const [, navigate] = useLocation();
  const [walletTypeFilter, setWalletTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Build query params
  const queryParams = new URLSearchParams();
  if (walletTypeFilter !== "all") queryParams.append("walletType", walletTypeFilter);
  if (countryFilter !== "all") queryParams.append("country", countryFilter);

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/wallets${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<WalletsResponse>({
    queryKey: [fullUrl],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const getWalletTypeBadge = (type: string) => {
    return type === "driver" ? (
      <Badge className="bg-purple-500 dark:bg-purple-700">Driver</Badge>
    ) : (
      <Badge className="bg-orange-500 dark:bg-orange-700">Restaurant</Badge>
    );
  };

  const formatCurrency = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBalanceStatus = (availableBalance: string, negativeBalance: string, currency: string) => {
    const available = parseFloat(availableBalance);
    const negative = parseFloat(negativeBalance);

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
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Wallet Management</h1>
            <p className="text-sm opacity-90">View and manage all wallets</p>
          </div>
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Filter by Country
                </label>
                <Select
                  value={countryFilter}
                  onValueChange={setCountryFilter}
                >
                  <SelectTrigger data-testid="select-country-filter">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-4">
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
        ) : data?.wallets && data.wallets.length > 0 ? (
          <div className="space-y-3">
            {data.wallets.map((wallet) => (
              <Card key={wallet.id} className="hover-elevate" data-testid={`card-wallet-${wallet.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <p className="font-semibold truncate" data-testid={`text-owner-${wallet.id}`}>
                          {wallet.walletType === "driver" 
                            ? wallet.owner.fullName || wallet.owner.email
                            : wallet.owner.restaurantName || wallet.owner.email
                          }
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {getWalletTypeBadge(wallet.walletType)}
                        <Badge variant="outline">{wallet.owner.countryCode}</Badge>
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
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No wallets found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
