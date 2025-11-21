import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  ArrowRight,
  CreditCard,
  HelpCircle,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface WalletSummary {
  currentBalance: number;
  negativeBalance: number;
  pendingBalance: number;
  nextScheduledPayoutDate: string | null;
  currency: string;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  status: string;
  initiatedAt: string;
  completedAt: string | null;
  scheduledAt: string | null;
  failureReason: string | null;
}

interface PayoutMethod {
  hasPayoutMethod: boolean;
  method: {
    id: string;
    type: string;
    provider: string | null;
    displayName: string;
    maskedAccount: string;
    accountHolderName: string;
  } | null;
}

export default function DriverWallet() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [cashOutOpen, setCashOutOpen] = useState(false);

  // Fetch wallet summary
  const { data: summary, isLoading: loadingSummary } = useQuery<WalletSummary>({
    queryKey: ["/api/driver/wallet/summary"],
  });

  // Fetch recent payouts
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery<{
    payouts: Payout[];
  }>({
    queryKey: ["/api/driver/wallet/payouts"],
  });

  // Fetch payout method
  const { data: payoutMethod, isLoading: loadingMethod } = useQuery<PayoutMethod>({
    queryKey: ["/api/driver/payout-method"],
  });

  // Cash out mutation
  const cashOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/wallet/cash-out");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Cash Out Successful",
        description: data.message || "Your cash out request has been submitted",
      });
      setCashOutOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/driver/wallet/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/wallet/payouts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cash Out Failed",
        description: error.message || "Failed to process cash out request",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "BDT") {
      return `৳${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const formatPayoutMethod = (method: PayoutMethod["method"]) => {
    if (!method) return "";
    
    if (method.type === "mobile_wallet" && method.provider) {
      return `${method.provider.charAt(0).toUpperCase() + method.provider.slice(1)} ${method.maskedAccount}`;
    } else if (method.type === "bank_account") {
      return `Bank Account ${method.maskedAccount}`;
    } else if (method.type === "stripe_connect") {
      return `Stripe ${method.maskedAccount}`;
    }
    return method.displayName;
  };

  const getPayoutStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      completed: { variant: "default", label: "Completed" },
      processing: { variant: "secondary", label: "Processing" },
      pending: { variant: "outline", label: "Pending" },
      failed: { variant: "destructive", label: "Failed" },
    };

    const config = statusConfig[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant} data-testid={`badge-payout-${status}`}>{config.label}</Badge>;
  };

  const getPayoutType = (method: string) => {
    const methodLabels: Record<string, string> = {
      auto_weekly: "Weekly payout",
      manual_request: "Instant Pay",
      manual_admin_settlement: "Adjustment",
    };
    return methodLabels[method] || method;
  };

  if (loadingSummary || loadingPayouts || loadingMethod) {
    return (
      <div className="bg-background min-h-screen p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const currentBalance = summary?.currentBalance || 0;
  const currency = summary?.currency || "USD";
  const hasNegativeBalance = (summary?.negativeBalance || 0) > 0;

  return (
    <div className="bg-background min-h-screen">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Balance Card - Uber Style */}
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Balance Amount */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Available Balance</p>
                <h1 className="text-5xl font-bold mb-2" data-testid="text-balance">
                  {formatCurrency(currentBalance, currency)}
                </h1>
                
                {/* Payout Schedule or Negative Balance Warning */}
                {hasNegativeBalance ? (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <span>
                      Outstanding debt: {formatCurrency(summary?.negativeBalance || 0, currency)}
                    </span>
                  </div>
                ) : summary?.nextScheduledPayoutDate ? (
                  <p className="text-sm text-muted-foreground">
                    Payout scheduled: {format(new Date(summary.nextScheduledPayoutDate), "MMMM d, yyyy")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No payout scheduled</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => setCashOutOpen(true)}
                  disabled={currentBalance <= 0 || hasNegativeBalance}
                  data-testid="button-cash-out"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Cash out
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/driver/wallet/balance")}
                  data-testid="button-view-details"
                >
                  View balance details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-xl">Payout activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/driver/wallet/balance")}
              data-testid="link-see-all-payouts"
            >
              See all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {payoutsData && payoutsData.payouts.length > 0 ? (
              <div className="space-y-1">
                {payoutsData.payouts.slice(0, 5).map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between py-4 border-b last:border-0 hover-elevate px-4 rounded-lg cursor-pointer"
                    data-testid={`payout-item-${payout.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{getPayoutType(payout.method)}</p>
                      <p className="text-sm text-muted-foreground">
                        Initiated {format(new Date(payout.initiatedAt), "MMM d, yyyy")}
                      </p>
                      {payout.failureReason && (
                        <p className="text-sm text-destructive mt-1">{payout.failureReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {getPayoutStatusBadge(payout.status)}
                      <p className="font-semibold text-lg whitespace-nowrap">
                        {formatCurrency(payout.amount, currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No payout activity yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your payouts will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout Method */}
        <Card>
          <CardContent className="p-0">
            <button
              onClick={() => navigate("/driver/account")}
              className="flex items-center justify-between w-full p-6 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-payout-method"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold mb-1">Payout method</p>
                  {payoutMethod?.hasPayoutMethod && payoutMethod.method ? (
                    <p className="text-sm text-muted-foreground">
                      {formatPayoutMethod(payoutMethod.method)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add payout method
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardContent className="p-0">
            <button
              onClick={() => navigate("/driver/help")}
              className="flex items-center justify-between w-full p-6 hover-elevate active-elevate-2 rounded-lg"
              data-testid="link-help"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <HelpCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Help</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Cash Out Confirmation Dialog */}
      <Dialog open={cashOutOpen} onOpenChange={setCashOutOpen}>
        <DialogContent data-testid="dialog-cash-out">
          <DialogHeader>
            <DialogTitle>Cash out</DialogTitle>
            <DialogDescription>
              Request instant payout to your linked account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Balance */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Available balance</p>
              <p className="text-2xl font-bold">{formatCurrency(currentBalance, currency)}</p>
            </div>

            {/* Payout Method */}
            {payoutMethod?.hasPayoutMethod && payoutMethod.method ? (
              <div>
                <p className="text-sm font-medium mb-2">Payout method</p>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">{formatPayoutMethod(payoutMethod.method)}</p>
                  <p className="text-sm text-muted-foreground">{payoutMethod.method.accountHolderName}</p>
                </div>
              </div>
            ) : (
              <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                <p className="text-sm text-destructive font-medium">No payout method configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please add a payout method in Account Settings
                </p>
              </div>
            )}

            {/* Info */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Funds will be transferred within 1-2 business days. A small processing fee may apply.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCashOutOpen(false)}
              disabled={cashOutMutation.isPending}
              data-testid="button-cancel-cash-out"
            >
              Cancel
            </Button>
            <Button
              onClick={() => cashOutMutation.mutate()}
              disabled={!payoutMethod?.hasPayoutMethod || cashOutMutation.isPending}
              data-testid="button-confirm-cash-out"
            >
              {cashOutMutation.isPending ? "Processing..." : "Confirm cash out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
