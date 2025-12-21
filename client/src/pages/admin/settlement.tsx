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
  Store,
  Download,
  Play,
  Clock,
  XCircle,
  ShieldAlert,
  Calendar
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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
  parcel?: {
    totalDeliveries: number;
    pendingCommission: number;
  };
  overall: {
    totalPendingSettlement: number;
    totalWalletsNeedingSettlement: number;
    totalBalance: number;
  };
}

interface PendingSettlementsResponse {
  pending: PendingWallet[];
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

interface RestaurantSummary {
  restaurantId: string;
  restaurantName: string;
  email: string;
  countryCode: string;
  totalOrders: number;
  totalEarnings: number;
  totalCommission: number;
  commissionPaid: number;
  commissionPending: number;
  walletBalance: number;
}

interface ParcelSummary {
  summary: {
    totalParcels: number;
    totalParcelRevenue: number;
    totalParcelCommission: number;
    commissionCollected: number;
    commissionPending: number;
  };
  byCountry: Record<string, {
    parcels: number;
    revenue: number;
    commission: number;
  }>;
}

export default function AdminSettlement() {
  const { toast } = useToast();
  const [selectedWallet, setSelectedWallet] = useState<PendingWallet | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  
  // FIX 1: Settlement Click Safety - Confirmation modal state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  
  // Analytics filters
  const [analyticsCountry, setAnalyticsCountry] = useState<string>("all");
  const [analyticsDateRange, setAnalyticsDateRange] = useState<string>("all");
  
  // Batch management state
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOwnerType, setBatchOwnerType] = useState("all");
  const [batchCountry, setBatchCountry] = useState("all");
  const [minPayoutAmount, setMinPayoutAmount] = useState("10");
  
  // Calculate week range for settlement
  const getWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return {
      start: startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      end: endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    };
  };
  
  const weekRange = getWeekRange();

  // Fetch overview stats
  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewStats>({
    queryKey: ["/api/admin/settlement/overview"],
    refetchInterval: 10000,
  });

  // Fetch pending settlements
  const { data: pendingData, isLoading: pendingLoading } = useQuery<PendingSettlementsResponse>({
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

  // Fetch restaurant commission summary
  const { data: restaurantData, isLoading: restaurantLoading } = useQuery<{ restaurants: RestaurantSummary[] }>({
    queryKey: [
      "/api/admin/restaurants/commission-summary",
      { country: analyticsCountry, dateRange: analyticsDateRange }
    ],
    refetchInterval: 30000,
  });

  // Fetch parcel commission summary  
  const { data: parcelData, isLoading: parcelLoading } = useQuery<ParcelSummary>({
    queryKey: [
      "/api/admin/parcels/commission-summary",
      { country: analyticsCountry, dateRange: analyticsDateRange }
    ],
    refetchInterval: 30000,
  });

  // Settlement mutation with FIX 1: Week range & double settlement prevention
  const settleMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/settle-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          weekStart: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).toISOString().split('T')[0],
          weekEnd: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 6)).toISOString().split('T')[0],
          paymentMethod: paymentMethod,
          receiptNumber: receiptNumber || undefined,
          notes: settlementNotes || undefined,
        }),
      });
    },
    onSuccess: (data) => {
      const amount = parseFloat(settlementAmount);
      const remaining = selectedWallet ? selectedWallet.negativeBalance - amount : 0;
      
      // FIX 4: Partial Payment Clarity - Show carry-forward info
      if (remaining > 0) {
        toast({
          title: "Partial Settlement Recorded",
          description: `Received ${selectedWallet?.countryCode === 'BD' ? '৳' : '$'}${amount.toFixed(2)}. Remaining balance of ${selectedWallet?.countryCode === 'BD' ? '৳' : '$'}${remaining.toFixed(2)} carries forward to next week.`,
        });
      } else {
        toast({
          title: "Settlement Successful",
          description: data.message || "Full payment received and recorded.",
        });
      }
      
      setSettleDialogOpen(false);
      setConfirmDialogOpen(false);
      setSelectedWallet(null);
      setSettlementAmount("");
      setPaymentMethod("cash");
      setReceiptNumber("");
      setSettlementNotes("");
      
      // Invalidate all settlement-related queries to refresh dashboard immediately
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlement/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlement/pending"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && 
        typeof query.queryKey[0] === 'string' && 
        query.queryKey[0].startsWith('/api/admin/payouts')
      });
    },
    onError: (error: any) => {
      setConfirmDialogOpen(false);
      toast({
        title: "Settlement Failed",
        description: error.message || "Could not process settlement. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Batch creation mutation
  const createBatchMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/payout-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Batch created",
        description: `Created batch with ${data.payouts?.length || 0} payouts`,
      });
      setBatchDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlement/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlement/pending"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && 
        typeof query.queryKey[0] === 'string' && 
        query.queryKey[0].startsWith('/api/admin/payouts')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create batch",
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

  const handleCreateBatch = () => {
    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const payload: any = {
      periodStart,
      periodEnd,
      minPayoutAmount: parseFloat(minPayoutAmount),
    };

    if (batchOwnerType !== "all") {
      payload.ownerType = batchOwnerType;
    }

    if (batchCountry !== "all") {
      payload.countryCode = batchCountry;
    }

    createBatchMutation.mutate(payload);
  };

  // FIX 1: Settlement Click Safety - Show confirmation before final submission
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

    // Open confirmation dialog instead of submitting directly
    setConfirmDialogOpen(true);
  };
  
  // FIX 1: Actual settlement after confirmation
  const handleConfirmSettlement = () => {
    if (!selectedWallet) return;
    
    const amount = parseFloat(settlementAmount);
    settleMutation.mutate({
      walletType: selectedWallet.walletType,
      walletId: selectedWallet.walletId,
      settlementAmount: amount,
    });
  };
  
  // FIX 4: Calculate remaining balance for partial payments
  const getRemainingBalance = () => {
    if (!selectedWallet) return 0;
    const amount = parseFloat(settlementAmount) || 0;
    return Math.max(0, selectedWallet.negativeBalance - amount);
  };
  
  const isPartialPayment = () => {
    if (!selectedWallet) return false;
    const amount = parseFloat(settlementAmount) || 0;
    return amount > 0 && amount < selectedWallet.negativeBalance;
  };
  
  // Format currency based on country
  const formatAmount = (amount: number, countryCode?: string) => {
    const symbol = countryCode === 'BD' ? '৳' : '$';
    return `${symbol}${amount.toFixed(2)}`;
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Parcel Settlements
              </CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-parcel-pending">
                  ${overview?.parcel?.pendingCommission?.toFixed(2) || "0.00"}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.parcel?.totalDeliveries || 0} deliveries
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Batch Actions */}
        <div className="flex justify-end mb-4">
          <Button 
            onClick={() => setBatchDialogOpen(true)}
            data-testid="button-create-batch"
          >
            <Download className="h-4 w-4 mr-2" />
            Create Payout Batch
          </Button>
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

        {/* Restaurant & Parcel Analytics */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Commission Analytics</CardTitle>
                <CardDescription>
                  Detailed breakdown of restaurant and parcel commission data
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={analyticsCountry} onValueChange={setAnalyticsCountry}>
                  <SelectTrigger className="w-[140px]" data-testid="select-analytics-country">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={analyticsDateRange} onValueChange={setAnalyticsDateRange}>
                  <SelectTrigger className="w-[140px]" data-testid="select-analytics-daterange">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="restaurants" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="restaurants" data-testid="tab-restaurants">
                  <Store className="h-4 w-4 mr-2" />
                  Restaurants
                </TabsTrigger>
                <TabsTrigger value="parcels" data-testid="tab-parcels">
                  <Package className="h-4 w-4 mr-2" />
                  Parcels
                </TabsTrigger>
              </TabsList>

              {/* Restaurants Tab */}
              <TabsContent value="restaurants" className="mt-6">
                {restaurantLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !restaurantData?.restaurants || restaurantData.restaurants.length === 0 ? (
                  <div className="text-center py-12">
                    <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">No data available</p>
                    <p className="text-sm text-muted-foreground">
                      No restaurant commission data found for the selected filters
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Restaurant</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Earnings</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Pending</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restaurantData.restaurants.map((restaurant) => (
                          <TableRow key={restaurant.restaurantId} data-testid={`row-restaurant-${restaurant.restaurantId}`}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{restaurant.restaurantName}</span>
                                <span className="text-xs text-muted-foreground">{restaurant.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{restaurant.countryCode}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{restaurant.totalOrders}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-green-600 font-medium">
                                ${restaurant.totalEarnings.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-blue-600 font-medium">
                                ${restaurant.totalCommission.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              ${restaurant.commissionPaid.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-orange-600 font-bold">
                                ${restaurant.commissionPending.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              ${restaurant.walletBalance.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link href={`/admin/restaurants/${restaurant.restaurantId}`}>
                                <Button variant="outline" size="sm" data-testid={`button-view-${restaurant.restaurantId}`}>
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Parcels Tab */}
              <TabsContent value="parcels" className="mt-6">
                {parcelLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : !parcelData?.summary ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">No data available</p>
                    <p className="text-sm text-muted-foreground">
                      No parcel commission data found for the selected filters
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground mb-1">Total Parcels</p>
                          <p className="text-2xl font-bold" data-testid="text-total-parcels">
                            {parcelData.summary.totalParcels}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                          <p className="text-2xl font-bold text-green-600" data-testid="text-parcel-revenue">
                            ${parcelData.summary.totalParcelRevenue.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground mb-1">Total Commission</p>
                          <p className="text-2xl font-bold text-blue-600" data-testid="text-parcel-total-commission">
                            ${parcelData.summary.totalParcelCommission.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground mb-1">Commission Pending</p>
                          <p className="text-2xl font-bold text-orange-600" data-testid="text-parcel-pending-commission">
                            ${parcelData.summary.commissionPending.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* By Country Breakdown */}
                    {Object.keys(parcelData.byCountry).length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3">Breakdown by Country</h3>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Country</TableHead>
                                <TableHead className="text-right">Parcels</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Commission</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(parcelData.byCountry).map(([country, stats]) => (
                                <TableRow key={country} data-testid={`row-country-${country}`}>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {country === "BD" ? "Bangladesh" : country === "US" ? "USA" : country}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{stats.parcels}</TableCell>
                                  <TableCell className="text-right">
                                    <span className="text-green-600 font-medium">
                                      ${stats.revenue.toFixed(2)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className="text-blue-600 font-medium">
                                      ${stats.commission.toFixed(2)}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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

      {/* Batch Creation Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent data-testid="dialog-create-batch">
          <DialogHeader>
            <DialogTitle>Create Payout Batch</DialogTitle>
            <DialogDescription>
              Create a batch of payouts for eligible wallets (last 7 days)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batch-owner-type">Wallet Type</Label>
              <Select value={batchOwnerType} onValueChange={setBatchOwnerType}>
                <SelectTrigger id="batch-owner-type" data-testid="select-batch-owner-type">
                  <SelectValue placeholder="Select wallet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="batch-country">Country</Label>
              <Select value={batchCountry} onValueChange={setBatchCountry}>
                <SelectTrigger id="batch-country" data-testid="select-batch-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="batch-min-amount">Minimum Payout Amount</Label>
              <Input
                id="batch-min-amount"
                type="number"
                value={minPayoutAmount}
                onChange={(e) => setMinPayoutAmount(e.target.value)}
                placeholder="10.00"
                data-testid="input-batch-min-amount"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setBatchDialogOpen(false)}
              className="flex-1"
              data-testid="button-cancel-batch"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBatch}
              disabled={createBatchMutation.isPending}
              className="flex-1"
              data-testid="button-confirm-batch"
            >
              {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Settlement Dialog with FIX 1 & FIX 4 */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Process Cash Settlement
            </DialogTitle>
            <DialogDescription>
              Record payment received from driver for weekly commission
            </DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <div className="space-y-4">
              {/* Driver/Restaurant Info Card */}
              <Card className="border-2">
                <CardContent className="pt-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {selectedWallet.walletType === "driver" ? "Driver" : "Restaurant"}
                      </p>
                      <p className="font-semibold text-lg">
                        {selectedWallet.walletType === "driver" 
                          ? selectedWallet.fullName 
                          : selectedWallet.restaurantName}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedWallet.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Due</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatAmount(selectedWallet.negativeBalance, selectedWallet.countryCode)}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {weekRange.start} - {weekRange.end}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <form onSubmit={handleSubmitSettlement} className="space-y-4">
                {/* Settlement Amount */}
                <div>
                  <Label htmlFor="settlementAmount">Amount Received</Label>
                  <Input
                    id="settlementAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                    required
                    className="text-lg font-medium"
                    data-testid="input-settlement-amount"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max: {formatAmount(selectedWallet.negativeBalance, selectedWallet.countryCode)}
                  </p>
                </div>
                
                {/* FIX 4: Partial Payment Clarity - Show remaining balance */}
                {isPartialPayment() && (
                  <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Partial Payment</span>
                      </div>
                      <p className="text-sm mt-1">
                        Remaining <span className="font-bold">{formatAmount(getRemainingBalance(), selectedWallet.countryCode)}</span> will carry forward to next week.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Driver will be flagged as at-risk for partial payment.
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Payment Method */}
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Receipt Number (Optional) */}
                <div>
                  <Label htmlFor="receiptNumber">Receipt/Reference # (Optional)</Label>
                  <Input
                    id="receiptNumber"
                    type="text"
                    placeholder="e.g., RCV-2024-001"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    data-testid="input-receipt-number"
                  />
                </div>
                
                {/* Notes (Optional) */}
                <div>
                  <Label htmlFor="settlementNotes">Notes (Optional)</Label>
                  <Input
                    id="settlementNotes"
                    type="text"
                    placeholder="Any additional notes..."
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    data-testid="input-settlement-notes"
                  />
                </div>

                <div className="flex gap-2 pt-2">
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
                    disabled={!settlementAmount || parseFloat(settlementAmount) <= 0}
                    data-testid="button-proceed-settle"
                  >
                    Review & Confirm
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* FIX 1: Settlement Confirmation Dialog - Prevents Accidental Double Settlement */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Confirm Settlement
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to record the following settlement:</p>
                
                {selectedWallet && (
                  <Card className="border-2 border-green-200 dark:border-green-800">
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-semibold">
                          {selectedWallet.walletType === "driver" 
                            ? selectedWallet.fullName 
                            : selectedWallet.restaurantName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Week:</span>
                        <span className="font-semibold">{weekRange.start} - {weekRange.end}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount Due:</span>
                        <span className="font-semibold text-orange-600">
                          {formatAmount(selectedWallet.negativeBalance, selectedWallet.countryCode)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">Amount Received:</span>
                        <span className="font-bold text-green-600 text-lg">
                          {formatAmount(parseFloat(settlementAmount) || 0, selectedWallet.countryCode)}
                        </span>
                      </div>
                      {isPartialPayment() && (
                        <div className="flex justify-between text-yellow-600">
                          <span>Remaining (Carry Forward):</span>
                          <span className="font-semibold">
                            {formatAmount(getRemainingBalance(), selectedWallet.countryCode)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Payment Method:</span>
                        <span className="uppercase">{paymentMethod}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <p className="text-sm text-muted-foreground">
                  This action will be logged and cannot be duplicated for the same driver in the same week.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSettlement}
              disabled={settleMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-final-confirm"
            >
              {settleMutation.isPending ? "Processing..." : "Confirm Settlement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
