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
  balance: string;
  holdAmount: string;
  negativeBalance: string;
  availableForPayout: string;
  currency: string;
  currencySymbol: string;
  countryCode: string;
  totalEarnings: string;
  totalPayouts: string;
  pendingPayoutsCount: number;
  kycStatus: string;
  kycApproved: boolean;
  payoutRules: {
    minPayoutAmount: string;
    maxPayoutAmount: string | null;
    payoutSchedule: string;
    payoutDayOfWeek: number | null;
    payoutDayOfMonth: number | null;
    platformFeeType: string;
    platformFeeValue: string;
    requiresKycLevel: string;
  } | null;
}

interface Payout {
  id: string;
  amount: string;
  feeAmount: string;
  netAmount: string;
  currency: string;
  status: string;
  payoutMethodId: string | null;
  payoutRailType: string;
  provider: string;
  maskedDetails: string;
  notes: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface PayoutMethod {
  id: string;
  payoutRailType: string;
  provider: string;
  maskedDetails: string;
  accountHolderName: string | null;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

interface PayoutMethodsResponse {
  methods: PayoutMethod[];
  kycStatus: string;
  canAddMethod: boolean;
}

export default function DriverWallet() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [cashOutOpen, setCashOutOpen] = useState(false);

  // Fetch wallet summary (unified payout API)
  const { data: summary, isLoading: loadingSummary } = useQuery<WalletSummary>({
    queryKey: ["/api/payout/summary"],
    queryFn: () => apiRequest("/api/payout/summary"),
  });

  // Fetch recent payouts (unified payout API)
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery<{
    payouts: Payout[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/payout/history"],
    queryFn: () => apiRequest("/api/payout/history?limit=5"),
  });

  // Fetch payout methods (unified payout API)
  const { data: payoutMethodsData, isLoading: loadingMethod } = useQuery<PayoutMethodsResponse>({
    queryKey: ["/api/payout/methods"],
    queryFn: () => apiRequest("/api/payout/methods"),
  });

  // Cash out / payout request mutation (unified payout API)
  const cashOutMutation = useMutation({
    mutationFn: async (amount: string) => {
      const defaultMethod = payoutMethodsData?.methods.find(m => m.isDefault);
      const result = await apiRequest("/api/payout/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amount,
          payoutMethodId: defaultMethod?.id,
        }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payout Requested",
        description: data.message || "Your payout request has been submitted",
      });
      setCashOutOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/payout/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Payout Request Failed",
        description: error.message || "Failed to process payout request",
        variant: "destructive",
      });
    },
  });


  const formatPayoutMethod = (method: PayoutMethod | undefined) => {
    if (!method) return "Add payout method";
    
    const railLabels: Record<string, string> = {
      MOBILE_WALLET: "Mobile Wallet",
      BANK_TRANSFER: "Bank Transfer",
      STRIPE_CONNECT: "Stripe",
      PAYONEER: "Payoneer",
    };
    
    const railLabel = railLabels[method.payoutRailType] || method.payoutRailType;
    const provider = method.provider ? ` (${method.provider})` : "";
    return `${railLabel}${provider} ${method.maskedDetails}`;
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

  const getPayoutRailLabel = (railType: string) => {
    const railLabels: Record<string, string> = {
      MOBILE_WALLET: "Mobile Wallet",
      BANK_TRANSFER: "Bank Transfer",
      STRIPE_CONNECT: "Stripe Payout",
      PAYONEER: "Payoneer",
    };
    return railLabels[railType] || railType;
  };

  // Get default payout method
  const defaultPayoutMethod = payoutMethodsData?.methods.find(m => m.isDefault);
  const hasPayoutMethod = payoutMethodsData?.methods && payoutMethodsData.methods.length > 0;

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

  const availableForPayout = parseFloat(summary?.availableForPayout || "0");
  const currency = summary?.currency || "USD";
  const currencySymbol = summary?.currencySymbol || "$";
  const hasNegativeBalance = parseFloat(summary?.negativeBalance || "0") > 0;
  const holdAmount = parseFloat(summary?.holdAmount || "0");
  const kycApproved = summary?.kycApproved || false;

  return (
    <div className="bg-background min-h-screen">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Balance Card - Uber Style */}
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Balance Amount */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Available for Payout</p>
                <h1 className="text-5xl font-bold mb-2" data-testid="text-balance">
                  {currencySymbol}{availableForPayout.toFixed(2)}
                </h1>
                
                {/* KYC Warning */}
                {!kycApproved && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-2">
                    <span>Complete KYC verification to enable payouts</span>
                  </div>
                )}
                
                {/* Negative Balance / Hold Warning */}
                {hasNegativeBalance ? (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <span>
                      Outstanding debt: {currencySymbol}{parseFloat(summary?.negativeBalance || "0").toFixed(2)}
                    </span>
                  </div>
                ) : holdAmount > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    On hold: {currencySymbol}{holdAmount.toFixed(2)}
                  </p>
                ) : summary?.payoutRules ? (
                  <p className="text-sm text-muted-foreground">
                    Min payout: {currencySymbol}{parseFloat(summary.payoutRules.minPayoutAmount).toFixed(2)} • 
                    {summary.payoutRules.payoutSchedule === "WEEKLY" ? " Weekly payouts" : 
                     summary.payoutRules.payoutSchedule === "DAILY" ? " Daily payouts" : 
                     summary.payoutRules.payoutSchedule === "ON_DEMAND" ? " On-demand payouts" : " Monthly payouts"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Payout rules not configured</p>
                )}
              </div>

              {/* Fee Information */}
              {summary?.payoutRules && summary.payoutRules.platformFeeType !== "NONE" && (
                <div className="bg-muted/50 px-4 py-2 rounded-lg text-sm">
                  <span className="text-muted-foreground">Platform fee: </span>
                  <span className="font-medium">
                    {summary.payoutRules.platformFeeType === "FLAT" 
                      ? `${currencySymbol}${parseFloat(summary.payoutRules.platformFeeValue).toFixed(2)} per payout`
                      : `${parseFloat(summary.payoutRules.platformFeeValue).toFixed(1)}% per payout`}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => setCashOutOpen(true)}
                  disabled={availableForPayout <= 0 || hasNegativeBalance || !kycApproved || !hasPayoutMethod}
                  data-testid="button-cash-out"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Cash out
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/driver/earnings")}
                  data-testid="button-view-details"
                >
                  View earnings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
            <CardTitle className="text-xl">Payout activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/driver/wallet/history")}
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
                      <p className="font-medium">{getPayoutRailLabel(payout.payoutRailType)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payout.createdAt), "MMM d, yyyy")} • {payout.maskedDetails}
                      </p>
                      {payout.feeAmount && parseFloat(payout.feeAmount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Fee: {currencySymbol}{parseFloat(payout.feeAmount).toFixed(2)}
                        </p>
                      )}
                      {payout.failureReason && (
                        <p className="text-sm text-destructive mt-1">{payout.failureReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {getPayoutStatusBadge(payout.status)}
                      <div className="text-right">
                        <p className="font-semibold text-lg whitespace-nowrap">
                          {currencySymbol}{parseFloat(payout.netAmount || payout.amount).toFixed(2)}
                        </p>
                        {payout.feeAmount && parseFloat(payout.feeAmount) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Gross: {currencySymbol}{parseFloat(payout.amount).toFixed(2)}
                          </p>
                        )}
                      </div>
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
              onClick={() => navigate("/driver/wallet/methods")}
              className="flex items-center justify-between w-full p-6 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-payout-method"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold mb-1">Payout method</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPayoutMethod(defaultPayoutMethod)}
                  </p>
                  {hasPayoutMethod && payoutMethodsData!.methods.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      +{payoutMethodsData!.methods.length - 1} more
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
              onClick={() => navigate("/driver/support/help")}
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
              Request payout to your linked account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Balance */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Available for payout</p>
              <p className="text-2xl font-bold">{currencySymbol}{availableForPayout.toFixed(2)}</p>
            </div>

            {/* Fee Calculation */}
            {summary?.payoutRules && summary.payoutRules.platformFeeType !== "NONE" && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Payout Fee</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {summary.payoutRules.platformFeeType === "FLAT" 
                    ? `${currencySymbol}${parseFloat(summary.payoutRules.platformFeeValue).toFixed(2)} flat fee`
                    : `${parseFloat(summary.payoutRules.platformFeeValue).toFixed(1)}% of payout amount`}
                </p>
              </div>
            )}

            {/* Payout Method */}
            {hasPayoutMethod && defaultPayoutMethod ? (
              <div>
                <p className="text-sm font-medium mb-2">Payout method</p>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">{formatPayoutMethod(defaultPayoutMethod)}</p>
                  {defaultPayoutMethod.accountHolderName && (
                    <p className="text-sm text-muted-foreground">{defaultPayoutMethod.accountHolderName}</p>
                  )}
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

            {/* KYC Warning */}
            {!kycApproved && (
              <div className="border border-amber-500 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">KYC verification required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete your identity verification to enable payouts
                </p>
              </div>
            )}

            {/* Info */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Funds will be transferred within 1-2 business days.
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
              onClick={() => cashOutMutation.mutate(availableForPayout.toString())}
              disabled={!hasPayoutMethod || !kycApproved || availableForPayout <= 0 || cashOutMutation.isPending}
              data-testid="button-confirm-cash-out"
            >
              {cashOutMutation.isPending ? "Processing..." : `Cash out ${currencySymbol}${availableForPayout.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
