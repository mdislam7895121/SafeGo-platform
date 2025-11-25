import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  CreditCard,
  ChevronRight,
  TrendingUp,
  ArrowDownRight,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EarningSummary {
  currency: string;
  availableBalance: number;
  negativeBalance: number;
  pendingPayouts: number;
  totalEarnedAllTime: number;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  status: "pending" | "processing" | "completed" | "failed";
  failureReason: string | null;
  scheduledAt: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface PayoutsResponse {
  payouts: Payout[];
  currency: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

export default function DriverPayouts() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");

  const { data: summary, isLoading: loadingSummary } = useQuery<EarningSummary>({
    queryKey: ["/api/driver/earnings-summary"],
  });

  const { data: payoutsData, isLoading: loadingPayouts } = useQuery<PayoutsResponse>({
    queryKey: ["/api/driver/payouts", page],
    queryFn: async () => {
      const response = await fetch(`/api/driver/payouts?page=${page}&limit=20`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch payouts");
      return response.json();
    },
  });

  const { data: payoutMethod, isLoading: loadingMethod } = useQuery<PayoutMethod>({
    queryKey: ["/api/driver/payout-method"],
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async (amount: number) => {
      return await apiRequest("/api/driver/payouts/request", {
        method: "POST",
        body: JSON.stringify({ amount }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted and is pending approval.",
      });
      setRequestDialogOpen(false);
      setRequestAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/earnings-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payouts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit payout request",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || summary?.currency || "USD";
    if (curr === "BDT") {
      return `৳${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, icon: any }> = {
      pending: { variant: "outline", label: "Pending", icon: Clock },
      processing: { variant: "secondary", label: "Processing", icon: Loader2 },
      completed: { variant: "default", label: "Completed", icon: CheckCircle },
      failed: { variant: "destructive", label: "Failed", icon: XCircle },
    };

    const config = statusConfig[status] || { variant: "outline", label: status, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
        <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      auto_weekly: "Auto Weekly",
      manual_request: "Manual Request",
      manual_admin_settlement: "Admin Settlement",
    };
    return labels[method] || method;
  };

  const handleRequestPayout = () => {
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    requestPayoutMutation.mutate(amount);
  };

  const currency = summary?.currency || "USD";
  const minAmount = currency === "BDT" ? 500 : 10;

  if (loadingSummary || loadingMethod) {
    return (
      <div className="bg-background min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const hasNegativeBalance = (summary?.negativeBalance || 0) > 0;
  const availableBalance = summary?.availableBalance || 0;
  const canRequestPayout = !hasNegativeBalance && availableBalance >= minAmount;

  return (
    <div className="bg-background min-h-screen">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Negative Balance Warning */}
        {hasNegativeBalance && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Payout Blocked</p>
                  <p className="text-sm text-muted-foreground">
                    You have {formatCurrency(summary?.negativeBalance || 0)} in outstanding commissions. This must be cleared before you can request payouts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance & Request Card */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Available for Payout</p>
                <p className="text-4xl font-bold" data-testid="text-available-for-payout">
                  {formatCurrency(availableBalance)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Minimum payout: {formatCurrency(minAmount)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  onClick={() => setRequestDialogOpen(true)}
                  disabled={!canRequestPayout}
                  data-testid="button-request-payout"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Request Payout
                </Button>
                {!payoutMethod?.hasPayoutMethod && (
                  <Link href="/driver/account/payout-methods">
                    <Button variant="outline" size="sm" className="w-full" data-testid="link-add-payout-method">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Add Payout Method
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Method Info */}
        {payoutMethod?.hasPayoutMethod && payoutMethod.method && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Payout Method</CardTitle>
                <Link href="/driver/account/payout-methods">
                  <Button variant="link" size="sm" className="p-0" data-testid="link-manage-methods">
                    Manage <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{payoutMethod.method.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {payoutMethod.method.maskedAccount} · {payoutMethod.method.accountHolderName}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-xl font-bold" data-testid="text-pending-payouts">
                {formatCurrency(summary?.pendingPayouts || 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">All Time Earnings</span>
              </div>
              <p className="text-xl font-bold" data-testid="text-all-time">
                {formatCurrency(summary?.totalEarnedAllTime || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payout History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Payout History</CardTitle>
            <CardDescription>Your recent payout requests and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPayouts ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : !payoutsData?.payouts?.length ? (
              <div className="text-center py-12">
                <ArrowDownRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No payouts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Request your first payout when you have earnings
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {payoutsData.payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                    data-testid={`payout-item-${payout.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(payout.status)}
                          <span className="text-sm text-muted-foreground">
                            {getMethodLabel(payout.method)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(payout.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {payout.failureReason && (
                          <p className="text-xs text-destructive mt-1">{payout.failureReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${payout.status === "completed" ? "text-green-600" : ""}`}>
                        {formatCurrency(payout.amount)}
                      </p>
                      {payout.processedAt && (
                        <p className="text-xs text-muted-foreground">
                          Processed {format(new Date(payout.processedAt), "MMM d")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {payoutsData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {payoutsData.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(payoutsData.pagination.totalPages, page + 1))}
                      disabled={page === payoutsData.pagination.totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/driver/earnings">
            <Button variant="outline" className="w-full h-14 justify-start gap-3" data-testid="button-go-earnings">
              <TrendingUp className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Earnings</p>
                <p className="text-xs text-muted-foreground">View your trip earnings</p>
              </div>
            </Button>
          </Link>
          <Link href="/driver/account/payout-methods">
            <Button variant="outline" className="w-full h-14 justify-start gap-3" data-testid="button-go-payout-methods">
              <CreditCard className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Payout Methods</p>
                <p className="text-xs text-muted-foreground">Manage bank accounts</p>
              </div>
            </Button>
          </Link>
        </div>
      </div>

      {/* Request Payout Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Enter the amount you'd like to withdraw. Available: {formatCurrency(availableBalance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currency === "BDT" ? "৳" : "$"}
                </span>
                <Input
                  id="amount"
                  type="number"
                  min={minAmount}
                  max={availableBalance}
                  step="0.01"
                  placeholder={`Min ${minAmount}`}
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-payout-amount"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum: {formatCurrency(minAmount)} · Maximum: {formatCurrency(availableBalance)}
              </p>
            </div>

            {payoutMethod?.hasPayoutMethod && payoutMethod.method && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Payout will be sent to:</p>
                <p className="font-medium">
                  {payoutMethod.method.displayName} ({payoutMethod.method.maskedAccount})
                </p>
              </div>
            )}

            {!payoutMethod?.hasPayoutMethod && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  No payout method configured. Please add a payout method first.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestDialogOpen(false)}
              data-testid="button-cancel-request"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayout}
              disabled={
                requestPayoutMutation.isPending ||
                !requestAmount ||
                parseFloat(requestAmount) < minAmount ||
                parseFloat(requestAmount) > availableBalance
              }
              data-testid="button-submit-request"
            >
              {requestPayoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                "Request Payout"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
