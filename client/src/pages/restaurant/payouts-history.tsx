import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Download, Clock, CheckCircle, XCircle, AlertCircle, DollarSign, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface WalletSummary {
  currentBalance: number;
  currency: string;
  countryCode: string;
  minimumPayoutAmount: number;
  hasPayoutAccount: boolean;
  nextScheduledPayoutDate: string | null;
}

interface Payout {
  id: string;
  amount: string;
  currency: string;
  status: string;
  method: string;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  scheduledAt: string | null;
}

export default function PayoutsHistory() {
  const { toast } = useToast();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Fetch wallet summary from existing wallet endpoint
  const { data: walletData, isLoading: loadingWallet } = useQuery<WalletSummary>({
    queryKey: ["/api/restaurant/wallet"],
  });

  // Fetch payout methods for withdrawal account selection
  const { data: methodsData } = useQuery<{ methods: Array<{ id: string; displayName: string; isDefault: boolean; status: string }> }>({
    queryKey: ["/api/payout/methods"],
  });

  // Fetch payout history using correct endpoint
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery<{ payouts: Payout[]; total: number }>({
    queryKey: ["/api/payout/history"],
  });

  // Withdrawal mutation using correct endpoint with required accountId
  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, payoutAccountId }: { amount: number; payoutAccountId: string }) => {
      return apiRequest("/api/payout/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, payoutAccountId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/history"] });
      toast({
        title: "Success",
        description: "Withdrawal request submitted successfully",
      });
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setSelectedAccountId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAccountId) {
      toast({
        title: "No Payout Method Selected",
        description: "Please select a payout method for withdrawal",
        variant: "destructive",
      });
      return;
    }

    if (walletData && amount < walletData.minimumPayoutAmount) {
      toast({
        title: "Amount Too Low",
        description: `Minimum withdrawal amount is ${formatCurrency(walletData.minimumPayoutAmount, walletData.currency)}`,
        variant: "destructive",
      });
      return;
    }

    if (walletData && amount > walletData.currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "Withdrawal amount exceeds available balance",
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate({ amount, payoutAccountId: selectedAccountId });
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "BDT") {
      return `৳${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <DollarSign className="h-3 w-3" />
            Processing
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="gap-1 text-destructive">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto mt-6 py-6 px-4 md:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-payout-history">Payout History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your withdrawals and view payout history
        </p>
      </div>

      {/* Wallet Summary Card */}
      {loadingWallet ? (
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-24 bg-muted rounded" />
          </CardContent>
        </Card>
      ) : walletData ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Available Balance
                </CardTitle>
                <CardDescription>
                  Minimum withdrawal: {formatCurrency(walletData.minimumPayoutAmount, walletData.currency)}
                </CardDescription>
              </div>
              <Button
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={
                  !walletData ||
                  !methodsData?.methods?.some(m => m.status === "active") ||
                  walletData.currentBalance < walletData.minimumPayoutAmount
                }
                className="gap-2"
                data-testid="button-request-withdrawal"
              >
                <Download className="h-4 w-4" />
                Request Withdrawal
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold" data-testid="text-wallet-balance">
                {formatCurrency(walletData.currentBalance, walletData.currency)}
              </span>
              <span className="text-muted-foreground">
                {walletData.currency}
              </span>
            </div>

            {(!methodsData?.methods || methodsData.methods.length === 0) && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please add a payout method before requesting withdrawals.
                </AlertDescription>
              </Alert>
            )}
            {methodsData?.methods && methodsData.methods.length > 0 && !methodsData.methods.some(m => m.status === "active") && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  All payout methods are pending verification. Please wait for approval before requesting withdrawals.
                </AlertDescription>
              </Alert>
            )}

            {walletData.nextScheduledPayoutDate && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Next automatic payout: {format(new Date(walletData.nextScheduledPayoutDate), "PPP")}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load wallet balance. Please complete KYC verification to access payout features.
          </AlertDescription>
        </Alert>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
          <CardDescription>
            Track your payout requests and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPayouts ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border animate-pulse">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : payoutsData?.payouts && payoutsData.payouts.length > 0 ? (
            <div className="space-y-3">
              {payoutsData.payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`card-payout-${payout.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                      <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" data-testid={`text-payout-amount-${payout.id}`}>
                          {formatCurrency(parseFloat(payout.amount), payout.currency)}
                        </h3>
                        {getStatusBadge(payout.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Method: {payout.method.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {format(new Date(payout.createdAt), "PPP")}
                        {payout.processedAt && ` • Processed: ${format(new Date(payout.processedAt), "PPP")}`}
                      </p>
                      {payout.failureReason && (
                        <p className="text-xs text-destructive mt-1">
                          Reason: {payout.failureReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payout requests yet</p>
              <p className="text-sm mt-1">Your withdrawal requests will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw to your payout account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {walletData && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Available balance: <strong>{formatCurrency(walletData.currentBalance, walletData.currency)}</strong>
                  <br />
                  Minimum amount: <strong>{formatCurrency(walletData.minimumPayoutAmount, walletData.currency)}</strong>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="payout-method">Payout Method</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger data-testid="select-payout-method">
                  <SelectValue placeholder="Select payout method" />
                </SelectTrigger>
                <SelectContent>
                  {methodsData?.methods && methodsData.methods.length > 0 ? (
                    methodsData.methods
                      .filter((m) => m.status === "active")
                      .map((method) => (
                        <SelectItem key={method.id} value={method.id} data-testid={`option-method-${method.id}`}>
                          {method.displayName} {method.isDefault && "(Default)"}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="none" disabled>No active payout methods</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Withdrawal Amount</Label>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.01"
                min={walletData?.minimumPayoutAmount || 0}
                max={walletData?.currentBalance || 0}
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                data-testid="input-withdraw-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawDialogOpen(false)}
              data-testid="button-cancel-withdraw"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
