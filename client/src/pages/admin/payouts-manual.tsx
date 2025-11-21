import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, Search, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient, fetchAdminCapabilities } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Wallet {
  id: string;
  ownerType: "driver" | "restaurant";
  balance: string;
  currency: string;
  countryCode: string;
  owner: {
    email: string;
    fullName?: string;
    restaurantName?: string;
  };
  lastPayoutDate?: string;
}

export default function AdminPayoutsManual() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token, logout } = useAuth();
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");

  // Fetch admin capabilities for RBAC with improved error handling
  const { data: capabilitiesData, error: capabilitiesError, isPending: isLoadingCapabilities } = useQuery<{ capabilities: string[] }>({
    queryKey: ["/api/admin/capabilities", token],
    queryFn: () => fetchAdminCapabilities(token),
    retry: false,
    enabled: !!token,
  });
  
  // Handle 401 errors by auto-logging out (using useEffect to avoid setState during render)
  useEffect(() => {
    if (capabilitiesError && (capabilitiesError as any)?.status === 401) {
      logout();
    }
  }, [capabilitiesError, logout]);

  const capabilities = capabilitiesData?.capabilities || [];
  const hasAccess = capabilities.includes("CREATE_MANUAL_PAYOUT");
  const hasCapabilitiesError = !isLoadingCapabilities && capabilitiesError && (capabilitiesError as any)?.status !== 401;

  // Fetch wallets
  const queryParams = new URLSearchParams();
  if (ownerTypeFilter !== "all") queryParams.append("ownerType", ownerTypeFilter);
  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/wallets${queryString ? `?${queryString}` : ""}`;

  const { data: walletsData, isPending: isLoadingWallets } = useQuery<{ wallets: Wallet[] }>({
    queryKey: [fullUrl],
    enabled: hasAccess,
  });

  // Manual payout mutation
  const manualPayoutMutation = useMutation({
    mutationFn: async (data: { walletId: string; amount: number; reason?: string }) => {
      const res = await apiRequest("POST", "/api/admin/payouts/run-manual", data);
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Manual payout successful",
        description: `Payout of ${result.amount} processed successfully`,
      });
      setConfirmDialogOpen(false);
      setSelectedWallet(null);
      setPayoutAmount("");
      setPayoutReason("");
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('/api/admin/wallets')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payout failed",
        description: error.message || "Failed to process manual payout",
        variant: "destructive",
      });
    },
  });

  const handleInitiatePayout = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setPayoutAmount(wallet.balance);
    setConfirmDialogOpen(true);
  };

  const handleConfirmPayout = () => {
    if (!selectedWallet || !payoutAmount) return;

    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > parseFloat(selectedWallet.balance)) {
      toast({
        title: "Insufficient balance",
        description: "Payout amount exceeds wallet balance",
        variant: "destructive",
      });
      return;
    }

    manualPayoutMutation.mutate({
      walletId: selectedWallet.id,
      amount,
      reason: payoutReason || undefined,
    });
  };

  // Filter wallets based on search
  const filteredWallets = walletsData?.wallets.filter((wallet) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      wallet.owner.email.toLowerCase().includes(query) ||
      wallet.owner.fullName?.toLowerCase().includes(query) ||
      wallet.owner.restaurantName?.toLowerCase().includes(query) ||
      wallet.id.toLowerCase().includes(query)
    );
  }) || [];

  // Loading state
  if (isLoadingCapabilities) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Capability error: hide all privileged UI and show only error banner with retry
  if (hasCapabilitiesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Unable to Verify Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't verify your permissions to access this page. This may be due to a temporary network issue.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} data-testid="button-retry">
                Retry
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin")} data-testid="button-back-to-admin">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No access (only if capabilities loaded successfully and user doesn't have permission)
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don't have permission to process manual payouts. Please contact your administrator.
            </p>
            <Button onClick={() => navigate("/admin")} data-testid="button-back-to-admin">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/payouts")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manual Payouts</h1>
            <p className="text-sm opacity-90">Process one-time manual payouts for specific wallets</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Error Banner */}
        {hasCapabilitiesError && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Unable to verify permissions
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Some features may not work correctly. Please refresh the page.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warning Card */}
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                  Use Manual Payouts Carefully
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Manual payouts should only be used for exceptional cases and special circumstances. 
                  For regular payouts, use the scheduled payout system. All manual payouts are logged 
                  and audited for security compliance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Wallets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ownerType">Account Type</Label>
                <Select value={ownerTypeFilter} onValueChange={setOwnerTypeFilter}>
                  <SelectTrigger id="ownerType" data-testid="select-owner-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="driver">Drivers</SelectItem>
                    <SelectItem value="restaurant">Restaurants</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Eligible Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingWallets ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading wallets...</p>
              </div>
            ) : filteredWallets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No wallets found matching your filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWallets.map((wallet) => (
                  <Card key={wallet.id} className="hover-elevate" data-testid={`wallet-card-${wallet.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">
                              {wallet.owner.fullName || wallet.owner.restaurantName || wallet.owner.email}
                            </p>
                            <Badge className={wallet.ownerType === "driver" ? "bg-purple-500" : "bg-orange-500"}>
                              {wallet.ownerType === "driver" ? "Driver" : "Restaurant"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {wallet.owner.email} • {wallet.countryCode}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {wallet.currency === "BDT" ? "৳" : "$"}
                            {parseFloat(wallet.balance).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {wallet.lastPayoutDate
                              ? `Last payout: ${new Date(wallet.lastPayoutDate).toLocaleDateString()}`
                              : "No previous payouts"}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleInitiatePayout(wallet)}
                          disabled={parseFloat(wallet.balance) <= 0}
                          data-testid={`button-payout-${wallet.id}`}
                        >
                          Process Payout
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Payout Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent data-testid="dialog-confirm-payout">
          <DialogHeader>
            <DialogTitle>Confirm Manual Payout</DialogTitle>
            <DialogDescription>
              You are about to process a manual payout. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">Recipient:</span>{" "}
                  {selectedWallet.owner.fullName || selectedWallet.owner.restaurantName || selectedWallet.owner.email}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Email:</span> {selectedWallet.owner.email}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Wallet Balance:</span>{" "}
                  {selectedWallet.currency === "BDT" ? "৳" : "$"}
                  {parseFloat(selectedWallet.balance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payoutAmount">Payout Amount</Label>
                <Input
                  id="payoutAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  data-testid="input-payout-amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payoutReason">Reason (Optional)</Label>
                <Textarea
                  id="payoutReason"
                  placeholder="Enter reason for manual payout..."
                  value={payoutReason}
                  onChange={(e) => setPayoutReason(e.target.value)}
                  rows={3}
                  data-testid="input-payout-reason"
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> This payout will be processed immediately and cannot be reversed.
                  All manual payouts are logged and audited.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              data-testid="button-cancel-payout"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayout}
              disabled={manualPayoutMutation.isPending || !payoutAmount}
              data-testid="button-confirm-payout"
            >
              {manualPayoutMutation.isPending ? "Processing..." : "Confirm Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
