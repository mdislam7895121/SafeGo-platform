import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Building2,
  Settings,
  RefreshCw,
  Download,
  Ban,
  ShieldCheck,
  Loader2,
  FileText,
  Calendar,
} from "lucide-react";

interface DashboardStats {
  settlements: {
    total: number;
    pending: number;
    completed: number;
  };
  balances: {
    drivers: { count: number; totalOwed: number };
    restaurants: { count: number; totalOwed: number };
  };
  restrictions: {
    drivers: number;
    restaurants: number;
  };
  pendingPayouts: number;
  recentAuditLogs: number;
}

interface Settlement {
  id: string;
  periodStart: string;
  periodEnd: string;
  countryCode: string;
  ownerId: string;
  ownerType: string;
  totalEarnings: number;
  cashCollected: number;
  onlinePayments: number;
  commissionDue: number;
  netSettlement: number;
  status: string;
  statementNumber: string;
  createdAt: string;
}

interface DriverBalance {
  id: string;
  driverId: string;
  driverName: string;
  countryCode: string;
  currentBalance: number;
  totalCashTrips: number;
  totalCommissionDue: number;
  isRestricted: boolean;
  restrictionReason: string;
  lastUpdated: string;
}

interface RestaurantBalance {
  id: string;
  restaurantId: string;
  restaurantName: string;
  countryCode: string;
  currentBalance: number;
  totalCashOrders: number;
  totalCommissionDue: number;
  isRestricted: boolean;
  restrictionReason: string;
  lastUpdated: string;
}

interface Threshold {
  id: string;
  countryCode: string;
  ownerType: string;
  thresholdType: string;
  thresholdValue: number;
  currency: string;
  description: string;
  isActive: boolean;
}

export default function FinanceCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [selectedBalance, setSelectedBalance] = useState<DriverBalance | RestaurantBalance | null>(null);
  const [balanceType, setBalanceType] = useState<"driver" | "restaurant">("driver");
  const [newThreshold, setNewThreshold] = useState({
    countryCode: "BD",
    ownerType: "driver",
    thresholdType: "negative_balance_max",
    thresholdValue: "",
    description: "",
  });

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardStats>({
    queryKey: ["/api/settlement-finance/dashboard"],
  });

  const { data: settlementsData, isLoading: settlementsLoading, refetch: refetchSettlements } = useQuery<{ settlements: Settlement[]; total: number }>({
    queryKey: ["/api/settlement-finance/settlements", { countryCode: countryFilter !== "all" ? countryFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined }],
  });

  const { data: driverBalances, isLoading: driverBalancesLoading, refetch: refetchDriverBalances } = useQuery<{ balances: DriverBalance[]; total: number }>({
    queryKey: ["/api/settlement-finance/balances/drivers", { countryCode: countryFilter !== "all" ? countryFilter : undefined }],
  });

  const { data: restaurantBalances, isLoading: restaurantBalancesLoading, refetch: refetchRestaurantBalances } = useQuery<{ balances: RestaurantBalance[]; total: number }>({
    queryKey: ["/api/settlement-finance/balances/restaurants", { countryCode: countryFilter !== "all" ? countryFilter : undefined }],
  });

  const { data: thresholds, isLoading: thresholdsLoading, refetch: refetchThresholds } = useQuery<{ thresholds: Threshold[] }>({
    queryKey: ["/api/settlement-finance/thresholds"],
  });

  const processSettlementMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      return apiRequest("POST", `/api/settlement-finance/settlements/${id}/process`, { action });
    },
    onSuccess: () => {
      toast({ title: "Settlement processed successfully" });
      refetchSettlements();
      refetchDashboard();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ id, type, amount, reason }: { id: string; type: string; amount: number; reason: string }) => {
      const endpoint = type === "driver"
        ? `/api/settlement-finance/balances/driver/${id}/adjust`
        : `/api/settlement-finance/balances/restaurant/${id}/adjust`;
      return apiRequest("POST", endpoint, { amount, reason });
    },
    onSuccess: () => {
      toast({ title: "Balance adjusted successfully" });
      refetchDriverBalances();
      refetchRestaurantBalances();
      setSelectedBalance(null);
      setAdjustAmount("");
      setAdjustReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const restrictMutation = useMutation({
    mutationFn: async ({ id, type, restrict, reason }: { id: string; type: string; restrict: boolean; reason: string }) => {
      const endpoint = type === "driver"
        ? `/api/settlement-finance/balances/driver/${id}/restrict`
        : `/api/settlement-finance/balances/restaurant/${id}/restrict`;
      return apiRequest("POST", endpoint, { restrict, reason });
    },
    onSuccess: () => {
      toast({ title: "Restriction updated successfully" });
      refetchDriverBalances();
      refetchRestaurantBalances();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveThresholdMutation = useMutation({
    mutationFn: async (data: typeof newThreshold) => {
      return apiRequest("POST", "/api/settlement-finance/thresholds", {
        ...data,
        thresholdValue: parseFloat(data.thresholdValue),
      });
    },
    onSuccess: () => {
      toast({ title: "Threshold saved successfully" });
      refetchThresholds();
      setNewThreshold({
        countryCode: "BD",
        ownerType: "driver",
        thresholdType: "negative_balance_max",
        thresholdValue: "",
        description: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number, currency = "BDT") => {
    return new Intl.NumberFormat("en-BD", { style: "currency", currency }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "outline",
      completed: "default",
      failed: "destructive",
      requires_review: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Finance Center</h1>
          <p className="text-muted-foreground">Settlement & Finance Automation Layer (Tasks 23-28)</p>
        </div>
        <Button variant="outline" onClick={() => { refetchDashboard(); refetchSettlements(); }} data-testid="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <TrendingUp className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="settlements" data-testid="tab-settlements">
            <FileText className="mr-2 h-4 w-4" />
            Settlements
          </TabsTrigger>
          <TabsTrigger value="driver-balances" data-testid="tab-driver-balances">
            <Users className="mr-2 h-4 w-4" />
            Driver Balances
          </TabsTrigger>
          <TabsTrigger value="restaurant-balances" data-testid="tab-restaurant-balances">
            <Building2 className="mr-2 h-4 w-4" />
            Restaurant Balances
          </TabsTrigger>
          <TabsTrigger value="thresholds" data-testid="tab-thresholds">
            <Settings className="mr-2 h-4 w-4" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Settlements</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-settlements">{dashboard.settlements.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.settlements.pending} pending, {dashboard.settlements.completed} completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Driver Balances</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-driver-total-owed">
                      {formatCurrency(Number(dashboard.balances.drivers.totalOwed))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.balances.drivers.count} drivers with balance
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Restaurant Balances</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-restaurant-total-owed">
                      {formatCurrency(Number(dashboard.balances.restaurants.totalOwed))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.balances.restaurants.count} restaurants with balance
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Restrictions</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive" data-testid="text-restrictions">
                      {dashboard.restrictions.drivers + dashboard.restrictions.restaurants}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.restrictions.drivers} drivers, {dashboard.restrictions.restaurants} restaurants
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Payouts</CardTitle>
                    <CardDescription>Payout requests awaiting approval</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold" data-testid="text-pending-payouts">{dashboard.pendingPayouts}</div>
                    <Button className="mt-4" variant="outline" onClick={() => window.location.href = "/admin/payout-center"}>
                      View Payout Center
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Audit Activity</CardTitle>
                    <CardDescription>Finance audit logs in the past 7 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold" data-testid="text-audit-logs">{dashboard.recentAuditLogs}</div>
                    <Button className="mt-4" variant="outline" onClick={() => window.location.href = "/admin/finance-logs"}>
                      View Finance Logs
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Weekly Settlements</CardTitle>
                  <CardDescription>View and manage settlement records</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="w-32" data-testid="select-country-filter">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {settlementsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statement #</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlementsData?.settlements?.map((settlement) => (
                      <TableRow key={settlement.id} data-testid={`row-settlement-${settlement.id}`}>
                        <TableCell className="font-mono text-sm">{settlement.statementNumber || settlement.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(settlement.periodStart).toLocaleDateString()} - {new Date(settlement.periodEnd).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{settlement.ownerType}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(Number(settlement.totalEarnings))}</TableCell>
                        <TableCell>{formatCurrency(Number(settlement.commissionDue))}</TableCell>
                        <TableCell className={Number(settlement.netSettlement) > 0 ? "text-destructive" : "text-green-600"}>
                          {formatCurrency(Number(settlement.netSettlement))}
                        </TableCell>
                        <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                        <TableCell>
                          {settlement.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => processSettlementMutation.mutate({ id: settlement.id, action: "complete" })}
                                disabled={processSettlementMutation.isPending}
                                data-testid={`button-complete-${settlement.id}`}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => processSettlementMutation.mutate({ id: settlement.id, action: "fail" })}
                                disabled={processSettlementMutation.isPending}
                                data-testid={`button-fail-${settlement.id}`}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!settlementsData?.settlements || settlementsData.settlements.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No settlements found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="driver-balances" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Driver Negative Balances</CardTitle>
                  <CardDescription>Track and manage driver outstanding balances</CardDescription>
                </div>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {driverBalancesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Balance Owed</TableHead>
                      <TableHead>Cash Trips</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverBalances?.balances?.map((balance) => (
                      <TableRow key={balance.id} data-testid={`row-driver-balance-${balance.id}`}>
                        <TableCell className="font-mono text-sm">{balance.driverId.slice(0, 8)}...</TableCell>
                        <TableCell>{balance.driverName || "Unknown"}</TableCell>
                        <TableCell><Badge variant="outline">{balance.countryCode}</Badge></TableCell>
                        <TableCell className={Number(balance.currentBalance) > 0 ? "text-destructive font-semibold" : ""}>
                          {formatCurrency(Number(balance.currentBalance))}
                        </TableCell>
                        <TableCell>{balance.totalCashTrips}</TableCell>
                        <TableCell>
                          {balance.isRestricted ? (
                            <Badge variant="destructive">Restricted</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(balance.lastUpdated)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedBalance(balance); setBalanceType("driver"); }}
                                  data-testid={`button-adjust-${balance.id}`}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Adjust Driver Balance</DialogTitle>
                                  <DialogDescription>
                                    Current balance: {formatCurrency(Number(balance.currentBalance))}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Adjustment Amount</Label>
                                    <Input
                                      type="number"
                                      value={adjustAmount}
                                      onChange={(e) => setAdjustAmount(e.target.value)}
                                      placeholder="Enter amount (negative to reduce)"
                                      data-testid="input-adjust-amount"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Reason</Label>
                                    <Textarea
                                      value={adjustReason}
                                      onChange={(e) => setAdjustReason(e.target.value)}
                                      placeholder="Enter reason for adjustment"
                                      data-testid="input-adjust-reason"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => adjustBalanceMutation.mutate({
                                      id: balance.driverId,
                                      type: "driver",
                                      amount: parseFloat(adjustAmount),
                                      reason: adjustReason,
                                    })}
                                    disabled={!adjustAmount || adjustBalanceMutation.isPending}
                                    data-testid="button-confirm-adjust"
                                  >
                                    {adjustBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adjust Balance"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant={balance.isRestricted ? "default" : "destructive"}
                              onClick={() => restrictMutation.mutate({
                                id: balance.driverId,
                                type: "driver",
                                restrict: !balance.isRestricted,
                                reason: balance.isRestricted ? "Manual override" : "High negative balance",
                              })}
                              disabled={restrictMutation.isPending}
                              data-testid={`button-restrict-${balance.id}`}
                            >
                              {balance.isRestricted ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!driverBalances?.balances || driverBalances.balances.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No driver balances found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurant-balances" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Restaurant Negative Balances</CardTitle>
                  <CardDescription>Track and manage restaurant outstanding balances</CardDescription>
                </div>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {restaurantBalancesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Balance Owed</TableHead>
                      <TableHead>Cash Orders</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restaurantBalances?.balances?.map((balance) => (
                      <TableRow key={balance.id} data-testid={`row-restaurant-balance-${balance.id}`}>
                        <TableCell className="font-mono text-sm">{balance.restaurantId.slice(0, 8)}...</TableCell>
                        <TableCell>{balance.restaurantName || "Unknown"}</TableCell>
                        <TableCell><Badge variant="outline">{balance.countryCode}</Badge></TableCell>
                        <TableCell className={Number(balance.currentBalance) > 0 ? "text-destructive font-semibold" : ""}>
                          {formatCurrency(Number(balance.currentBalance))}
                        </TableCell>
                        <TableCell>{balance.totalCashOrders}</TableCell>
                        <TableCell>
                          {balance.isRestricted ? (
                            <Badge variant="destructive">Restricted</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(balance.lastUpdated)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedBalance(balance); setBalanceType("restaurant"); }}
                                  data-testid={`button-adjust-${balance.id}`}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Adjust Restaurant Balance</DialogTitle>
                                  <DialogDescription>
                                    Current balance: {formatCurrency(Number(balance.currentBalance))}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Adjustment Amount</Label>
                                    <Input
                                      type="number"
                                      value={adjustAmount}
                                      onChange={(e) => setAdjustAmount(e.target.value)}
                                      placeholder="Enter amount (negative to reduce)"
                                      data-testid="input-adjust-amount"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Reason</Label>
                                    <Textarea
                                      value={adjustReason}
                                      onChange={(e) => setAdjustReason(e.target.value)}
                                      placeholder="Enter reason for adjustment"
                                      data-testid="input-adjust-reason"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => adjustBalanceMutation.mutate({
                                      id: balance.restaurantId,
                                      type: "restaurant",
                                      amount: parseFloat(adjustAmount),
                                      reason: adjustReason,
                                    })}
                                    disabled={!adjustAmount || adjustBalanceMutation.isPending}
                                    data-testid="button-confirm-adjust"
                                  >
                                    {adjustBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adjust Balance"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant={balance.isRestricted ? "default" : "destructive"}
                              onClick={() => restrictMutation.mutate({
                                id: balance.restaurantId,
                                type: "restaurant",
                                restrict: !balance.isRestricted,
                                reason: balance.isRestricted ? "Manual override" : "High negative balance",
                              })}
                              disabled={restrictMutation.isPending}
                              data-testid={`button-restrict-${balance.id}`}
                            >
                              {balance.isRestricted ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!restaurantBalances?.balances || restaurantBalances.balances.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No restaurant balances found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Thresholds</CardTitle>
                <CardDescription>Active settlement thresholds by country and role</CardDescription>
              </CardHeader>
              <CardContent>
                {thresholdsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {thresholds?.thresholds?.map((threshold) => (
                        <TableRow key={threshold.id} data-testid={`row-threshold-${threshold.id}`}>
                          <TableCell><Badge variant="outline">{threshold.countryCode}</Badge></TableCell>
                          <TableCell>{threshold.ownerType}</TableCell>
                          <TableCell>{threshold.thresholdType.replace(/_/g, " ")}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(threshold.thresholdValue), threshold.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!thresholds?.thresholds || thresholds.thresholds.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No thresholds configured
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configure Threshold</CardTitle>
                <CardDescription>Set or update settlement thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select
                      value={newThreshold.countryCode}
                      onValueChange={(v) => setNewThreshold({ ...newThreshold, countryCode: v })}
                    >
                      <SelectTrigger data-testid="select-threshold-country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BD">Bangladesh</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Owner Type</Label>
                    <Select
                      value={newThreshold.ownerType}
                      onValueChange={(v) => setNewThreshold({ ...newThreshold, ownerType: v })}
                    >
                      <SelectTrigger data-testid="select-threshold-owner-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                        <SelectItem value="shop">Shop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Threshold Type</Label>
                  <Select
                    value={newThreshold.thresholdType}
                    onValueChange={(v) => setNewThreshold({ ...newThreshold, thresholdType: v })}
                  >
                    <SelectTrigger data-testid="select-threshold-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="negative_balance_max">Max Negative Balance</SelectItem>
                      <SelectItem value="min_payout">Minimum Payout</SelectItem>
                      <SelectItem value="max_payout">Maximum Payout</SelectItem>
                      <SelectItem value="warning_threshold">Warning Threshold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Threshold Value</Label>
                  <Input
                    type="number"
                    value={newThreshold.thresholdValue}
                    onChange={(e) => setNewThreshold({ ...newThreshold, thresholdValue: e.target.value })}
                    placeholder="Enter threshold amount"
                    data-testid="input-threshold-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={newThreshold.description}
                    onChange={(e) => setNewThreshold({ ...newThreshold, description: e.target.value })}
                    placeholder="Describe this threshold"
                    data-testid="input-threshold-description"
                  />
                </div>
                <Button
                  onClick={() => saveThresholdMutation.mutate(newThreshold)}
                  disabled={!newThreshold.thresholdValue || saveThresholdMutation.isPending}
                  className="w-full"
                  data-testid="button-save-threshold"
                >
                  {saveThresholdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Threshold
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
