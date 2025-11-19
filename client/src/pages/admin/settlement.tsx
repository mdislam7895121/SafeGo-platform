import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Eye,
  CheckCircle,
  AlertCircle,
  Package,
  Car,
  UtensilsCrossed,
  Store
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OverviewStats {
  driver: {
    totalWallets: number;
    totalPendingSettlement: number;
    totalBalance: number;
    walletsNeedingSettlement: number;
  };
  restaurant: {
    totalWallets: number;
    totalPendingSettlement: number;
    totalBalance: number;
    walletsNeedingSettlement: number;
  };
  overall: {
    totalPendingSettlement: number;
    totalWalletsNeedingSettlement: number;
    totalBalance: number;
  };
}

interface PendingWallet {
  walletId: string;
  walletType: "driver" | "restaurant";
  driverId?: string;
  restaurantId?: string;
  email: string;
  countryCode: string;
  fullName?: string;
  restaurantName?: string;
  address?: string;
  balance: number;
  negativeBalance: number;
  lastUpdated: string;
}

interface TransactionHistory {
  walletInfo: any;
  summary: {
    totalServices: number;
    totalEarnings: number;
    totalCommission: number;
    totalPayout: number;
  };
  breakdown: {
    rides?: any;
    deliveries?: any;
    foodOrders?: any;
  };
  recentTransactions: Array<{
    type: string;
    id: string;
    date: string;
    status: string;
    paymentMethod: string;
    fare: number;
    commission: number;
    payout: number;
  }>;
}

export default function AdminSettlement() {
  const { toast } = useToast();
  const [selectedWallet, setSelectedWallet] = useState<PendingWallet | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  // Fetch overview stats
  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewStats>({
    queryKey: ["/api/admin/settlement/overview"],
    refetchInterval: 10000,
  });

  // Fetch pending settlements
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: filterType === "all" 
      ? ["/api/admin/settlement/pending"]
      : ["/api/admin/settlement/pending", { walletType: filterType }],
    refetchInterval: 10000,
  });

  // Fetch transaction history for selected wallet
  const { data: transactionHistory, isLoading: historyLoading } = useQuery<TransactionHistory>({
    queryKey: [
      "/api/admin/settlement/transaction-history",
      selectedWallet?.walletType,
      selectedWallet?.walletId,
    ],
    enabled: !!selectedWallet && historyDialogOpen,
  });

  // Settlement mutation
  const settleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/settle-wallet", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settlement successful",
        description: data.message,
      });
      setSettleDialogOpen(false);
      setSelectedWallet(null);
      setSettlementAmount("");
      // Invalidate all settlement-related queries to refresh dashboard immediately
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlement/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlement/pending"] });
    },
    onError: (error: any) => {
      toast({
        title: "Settlement failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenHistory = (wallet: PendingWallet) => {
    setSelectedWallet(wallet);
    setHistoryDialogOpen(true);
  };

  const handleOpenSettle = (wallet: PendingWallet) => {
    setSelectedWallet(wallet);
    setSettlementAmount(wallet.negativeBalance.toFixed(2));
    setSettleDialogOpen(true);
  };

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWallet) return;

    const amount = parseFloat(settlementAmount);
    if (amount <= 0 || amount > selectedWallet.negativeBalance) {
      toast({
        title: "Invalid amount",
        description: "Settlement amount must be positive and not exceed negative balance",
        variant: "destructive",
      });
      return;
    }

    settleMutation.mutate({
      walletType: selectedWallet.walletType,
      walletId: selectedWallet.walletId,
      settlementAmount: amount,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover-elevate" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Wallet Settlement System</h1>
            <p className="text-sm text-primary-foreground/80">
              Monitor and settle commission balances
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pending
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-total-pending">
                  ${overview?.overall?.totalPendingSettlement?.toFixed(2) || "0.00"}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Commission owed to SafeGo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Wallets Pending
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-wallets-pending">
                  {overview?.overall?.totalWalletsNeedingSettlement || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Drivers & restaurants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Driver Settlements
              </CardTitle>
              <Car className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-driver-pending">
                  ${overview?.driver?.totalPendingSettlement?.toFixed(2) || "0.00"}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.driver?.walletsNeedingSettlement || 0} wallets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Restaurant Settlements
              </CardTitle>
              <Store className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-restaurant-pending">
                  ${overview?.restaurant?.totalPendingSettlement?.toFixed(2) || "0.00"}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.restaurant?.walletsNeedingSettlement || 0} wallets
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Settlements Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Pending Settlements</CardTitle>
                <CardDescription>
                  Wallets with outstanding commission balances
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Filter:</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="driver">Drivers</SelectItem>
                    <SelectItem value="restaurant">Restaurants</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pendingData?.pending?.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">All settled!</p>
                <p className="text-sm text-muted-foreground">
                  No pending settlements at this time
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name/Email</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingData?.pending?.map((wallet: PendingWallet) => (
                      <TableRow key={wallet.walletId} data-testid={`row-wallet-${wallet.walletId}`}>
                        <TableCell>
                          <Badge variant={wallet.walletType === "driver" ? "default" : "secondary"}>
                            {wallet.walletType === "driver" ? (
                              <Car className="h-3 w-3 mr-1" />
                            ) : (
                              <Store className="h-3 w-3 mr-1" />
                            )}
                            {wallet.walletType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {wallet.walletType === "driver" 
                                ? wallet.fullName 
                                : wallet.restaurantName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {wallet.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{wallet.countryCode}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600 font-medium">
                            ${wallet.balance.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-orange-600 font-bold">
                            ${wallet.negativeBalance.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenHistory(wallet)}
                              data-testid={`button-view-history-${wallet.walletId}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              History
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleOpenSettle(wallet)}
                              data-testid={`button-settle-${wallet.walletId}`}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Settle
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Settlement Process
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">For Cash Payments:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Driver/restaurant collects full fare from customer</li>
                  <li>SafeGo commission tracked as negative balance</li>
                  <li>They settle commission later via bank transfer or cash</li>
                  <li>Admin processes settlement and reduces negative balance</li>
                </ol>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium">For Online Payments:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Customer pays through app</li>
                  <li>SafeGo automatically keeps commission</li>
                  <li>Driver/restaurant balance increased by payout</li>
                  <li>No negative balance created</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction History</DialogTitle>
            <DialogDescription>
              Detailed breakdown of earnings and commissions
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : transactionHistory ? (
            <div className="space-y-6">
              {/* Wallet Info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name/Business</p>
                      <p className="font-medium">
                        {transactionHistory.walletInfo.fullName || 
                         transactionHistory.walletInfo.restaurantName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{transactionHistory.walletInfo.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Balance</p>
                      <p className="font-medium text-green-600">
                        ${transactionHistory.walletInfo.balance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="font-medium text-orange-600">
                        ${transactionHistory.walletInfo.negativeBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Services</p>
                    <p className="text-2xl font-bold">
                      {transactionHistory.summary.totalServices}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold">
                      ${transactionHistory.summary.totalEarnings.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">SafeGo Commission</p>
                    <p className="text-2xl font-bold text-orange-600">
                      ${transactionHistory.summary.totalCommission.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Net Payout</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${transactionHistory.summary.totalPayout.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Service Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Service Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactionHistory.breakdown.rides && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Car className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium">Ride Services</p>
                            <p className="text-sm text-muted-foreground">
                              {transactionHistory.breakdown.rides.count} rides 
                              ({transactionHistory.breakdown.rides.cashRides} cash, {transactionHistory.breakdown.rides.onlineRides} online)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            ${transactionHistory.breakdown.rides.totalFare.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Commission: ${transactionHistory.breakdown.rides.totalCommission.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {transactionHistory.breakdown.deliveries && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-purple-600" />
                          <div>
                            <p className="font-medium">Parcel Deliveries</p>
                            <p className="text-sm text-muted-foreground">
                              {transactionHistory.breakdown.deliveries.count} deliveries
                              ({transactionHistory.breakdown.deliveries.cashDeliveries} cash, {transactionHistory.breakdown.deliveries.onlineDeliveries} online)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            ${transactionHistory.breakdown.deliveries.totalFare.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Commission: ${transactionHistory.breakdown.deliveries.totalCommission.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {transactionHistory.breakdown.foodOrders && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <UtensilsCrossed className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">Food Orders</p>
                            <p className="text-sm text-muted-foreground">
                              {transactionHistory.breakdown.foodOrders.count} orders
                              ({transactionHistory.breakdown.foodOrders.cashOrders} cash, {transactionHistory.breakdown.foodOrders.onlineOrders} online)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            ${transactionHistory.breakdown.foodOrders.totalFare.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Commission: ${transactionHistory.breakdown.foodOrders.totalCommission.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              {transactionHistory.recentTransactions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead className="text-right">Fare</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                            <TableHead className="text-right">Payout</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactionHistory.recentTransactions.map((tx) => (
                            <TableRow key={`${tx.type}-${tx.id}`}>
                              <TableCell>
                                <Badge variant="outline">
                                  {tx.type === "ride" && <Car className="h-3 w-3 mr-1" />}
                                  {tx.type === "delivery" && <Package className="h-3 w-3 mr-1" />}
                                  {tx.type === "foodOrder" && <UtensilsCrossed className="h-3 w-3 mr-1" />}
                                  {tx.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(tx.date)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={tx.paymentMethod === "cash" ? "default" : "secondary"}>
                                  {tx.paymentMethod}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                ${tx.fare.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-orange-600">
                                ${tx.commission.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-green-600 font-medium">
                                ${tx.payout.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Settlement Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Settlement</DialogTitle>
            <DialogDescription>
              Reduce negative balance after receiving payment
            </DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {selectedWallet.walletType === "driver" ? "Driver" : "Restaurant"}
                      </p>
                      <p className="font-medium">
                        {selectedWallet.walletType === "driver" 
                          ? selectedWallet.fullName 
                          : selectedWallet.restaurantName}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedWallet.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Pending</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ${selectedWallet.negativeBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <form onSubmit={handleSubmitSettlement} className="space-y-4">
                <div>
                  <Label htmlFor="settlementAmount">Settlement Amount ($)</Label>
                  <Input
                    id="settlementAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                    required
                    data-testid="input-settlement-amount"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Amount received from {selectedWallet.walletType} (max: ${selectedWallet.negativeBalance.toFixed(2)})
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSettleDialogOpen(false)}
                    className="flex-1"
                    data-testid="button-cancel-settle"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={settleMutation.isPending}
                    data-testid="button-confirm-settle"
                  >
                    {settleMutation.isPending ? "Processing..." : "Confirm Settlement"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
