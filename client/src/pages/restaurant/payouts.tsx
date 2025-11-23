import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { format } from "date-fns";

export default function RestaurantPayouts() {
  const { toast } = useToast();
  const [payoutAmount, setPayoutAmount] = useState("");

  // Fetch payout overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["/api/restaurant/payouts/overview"],
  });

  // Fetch ledger
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ["/api/restaurant/payouts/ledger"],
  });

  // Fetch settlements
  const { data: settlementsData, isLoading: settlementsLoading } = useQuery({
    queryKey: ["/api/restaurant/payouts/settlements"],
  });

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async (amount: string) => {
      return await apiRequest("/api/restaurant/payouts/request-enhanced", {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted successfully",
      });
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/payouts/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/payouts/ledger"] });
    },
    onError: (error: any) => {
      toast({
        title: "Payout Request Failed",
        description: error.message || "Failed to submit payout request",
        variant: "destructive",
      });
    },
  });

  const handlePayoutRequest = () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payout amount",
        variant: "destructive",
      });
      return;
    }
    requestPayoutMutation.mutate(payoutAmount);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "earning":
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case "commission":
        return <ArrowDownRight className="h-4 w-4 text-orange-500" />;
      case "payout":
        return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
      case "adjustment":
        return <DollarSign className="h-4 w-4 text-purple-500" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      earning: "default",
      commission: "secondary",
      payout: "outline",
      adjustment: "secondary",
    };
    return <Badge variant={variants[type] || "default"}>{type}</Badge>;
  };

  if (overviewLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const hasNegativeBalance = overview?.negativeBalance > 0;
  const canRequestPayout = overview?.canRequestPayout;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-payouts-title">
          Payouts & Wallet
        </h1>
        <p className="text-muted-foreground">
          Manage your earnings, payouts, and settlement history
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wallet Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-wallet-balance">
              {overview?.currency} {overview?.walletBalance?.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for payout
            </p>
          </CardContent>
        </Card>

        {/* Negative Balance */}
        {hasNegativeBalance && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Debt</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-negative-balance">
                {overview?.currency} {overview?.negativeBalance?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                From cash orders
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Payouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-payouts">
              {overview?.currency} {overview?.pendingPayoutAmount?.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        {/* Next Settlement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Settlement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold" data-testid="text-next-settlement">
              {overview?.nextSettlementDate
                ? format(new Date(overview.nextSettlementDate), "MMM dd, yyyy")
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Weekly settlement cycle
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Request Section */}
      <Card>
        <CardHeader>
          <CardTitle>Request Payout</CardTitle>
          <CardDescription>
            Withdraw funds from your wallet to your bank account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canRequestPayout && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="text-payout-block-reason">
                {overview?.blockReason || "Payout not available"}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Amount ({overview?.currency})</Label>
              <Input
                id="payout-amount"
                type="number"
                placeholder="0.00"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                disabled={!canRequestPayout || requestPayoutMutation.isPending}
                data-testid="input-payout-amount"
              />
              <p className="text-xs text-muted-foreground">
                Minimum: {overview?.currency === "BDT" ? "500 BDT" : "10 USD"}
              </p>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePayoutRequest}
                disabled={!canRequestPayout || requestPayoutMutation.isPending || !payoutAmount}
                className="w-full"
                data-testid="button-request-payout"
              >
                {requestPayoutMutation.isPending ? "Processing..." : "Request Payout"}
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-lg font-semibold" data-testid="text-total-earnings">
                {overview?.currency} {overview?.totalEarnings?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Commissions</p>
              <p className="text-lg font-semibold" data-testid="text-total-commissions">
                {overview?.currency} {overview?.totalCommissions?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payouts</p>
              <p className="text-lg font-semibold" data-testid="text-total-payouts">
                {overview?.currency} {overview?.totalPayouts?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Ledger and Settlements */}
      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger" data-testid="tab-ledger">
            Transaction Ledger
          </TabsTrigger>
          <TabsTrigger value="settlements" data-testid="tab-settlements">
            Settlement Cycles
          </TabsTrigger>
        </TabsList>

        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                All wallet transactions including earnings, commissions, and payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : ledgerData?.ledger?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No transactions yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerData?.ledger?.map((entry: any) => (
                      <TableRow key={entry.id} data-testid={`row-ledger-${entry.id}`}>
                        <TableCell>
                          {format(new Date(entry.date), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(entry.type)}
                            {getTypeBadge(entry.type)}
                          </div>
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span
                            className={
                              entry.type === "earning" || entry.type === "adjustment"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {entry.type === "earning" || entry.type === "adjustment" ? "+" : "-"}
                            {overview?.currency} {Math.abs(entry.amount).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-balance-${entry.id}`}>
                          {overview?.currency} {entry.balance?.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlements Tab */}
        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <CardTitle>Settlement Cycles</CardTitle>
              <CardDescription>
                Weekly automated settlement batches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settlementsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : settlementsData?.settlements?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No settlement cycles yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Payouts</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlementsData?.settlements?.map((cycle: any) => (
                      <TableRow key={cycle.id} data-testid={`row-settlement-${cycle.id}`}>
                        <TableCell>
                          {format(new Date(cycle.periodStart), "MMM dd")} -{" "}
                          {format(new Date(cycle.periodEnd), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cycle.status === "completed"
                                ? "default"
                                : cycle.status === "processing"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {cycle.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{cycle.payoutCount}</TableCell>
                        <TableCell className="text-right font-medium">
                          {overview?.currency} {cycle.totalAmount?.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(cycle.createdAt), "MMM dd, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
