import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface PayoutRequest {
  id: string;
  walletType: "driver" | "restaurant" | "customer";
  amount: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  processedByAdminId: string | null;
  rejectionReason: string | null;
  owner?: {
    email?: string;
    countryCode?: string;
    currency?: string;
    cityCode?: string;
    fullName?: string;
    restaurantName?: string;
  };
}

interface PayoutsResponse {
  payouts: PayoutRequest[];
  total: number;
}

export default function AdminPayouts() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [walletTypeFilter, setWalletTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  
  // Dialog state
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch admin capabilities for RBAC
  const { data: capabilitiesData } = useQuery<{ capabilities: string[] }>({
    queryKey: ["/api/admin/capabilities"],
  });
  const capabilities = capabilitiesData?.capabilities || [];
  const canManagePayouts = capabilities.includes("MANAGE_PAYOUTS");

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (walletTypeFilter !== "all") queryParams.append("walletType", walletTypeFilter);
  if (countryFilter !== "all") queryParams.append("country", countryFilter);

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/payouts${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading, error } = useQuery<PayoutsResponse>({
    queryKey: [fullUrl],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Approve payout mutation
  const approveMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const res = await apiRequest("PUT", `/api/admin/payouts/${payoutId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payout approved",
        description: "Payout request has been approved successfully",
      });
      setApproveDialogOpen(false);
      setSelectedPayout(null);
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith('/api/admin/payouts')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject payout mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ payoutId, reason }: { payoutId: string; reason: string }) => {
      const res = await apiRequest("PUT", `/api/admin/payouts/${payoutId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payout rejected",
        description: "Payout request has been rejected",
      });
      setRejectDialogOpen(false);
      setSelectedPayout(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith('/api/admin/payouts')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | undefined, currency: string | undefined) => {
    const num = parseFloat(amount || "0");
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
      pending: { label: "Pending", className: "bg-yellow-500 dark:bg-yellow-700", icon: Clock },
      approved: { label: "Approved", className: "bg-green-500 dark:bg-green-700", icon: CheckCircle },
      rejected: { label: "Rejected", className: "bg-red-500 dark:bg-red-700", icon: XCircle },
      processing: { label: "Processing", className: "bg-blue-500 dark:bg-blue-700", icon: Clock },
      completed: { label: "Completed", className: "bg-green-500 dark:bg-green-700", icon: CheckCircle },
      failed: { label: "Failed", className: "bg-red-500 dark:bg-red-700", icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getWalletTypeBadge = (type: string) => {
    if (type === "driver") {
      return <Badge className="bg-purple-500 dark:bg-purple-700">Driver</Badge>;
    } else if (type === "customer") {
      return <Badge className="bg-blue-500 dark:bg-blue-700">Customer</Badge>;
    } else {
      return <Badge className="bg-orange-500 dark:bg-orange-700">Restaurant</Badge>;
    }
  };

  const handleApprove = (payout: PayoutRequest) => {
    setSelectedPayout(payout);
    setApproveDialogOpen(true);
  };

  const handleReject = (payout: PayoutRequest) => {
    setSelectedPayout(payout);
    setRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    if (selectedPayout) {
      approveMutation.mutate(selectedPayout.id);
    }
  };

  const confirmReject = () => {
    if (selectedPayout && rejectionReason.trim()) {
      rejectMutation.mutate({ payoutId: selectedPayout.id, reason: rejectionReason });
    }
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
            <h1 className="text-2xl font-bold">Payout Management</h1>
            <p className="text-sm opacity-90">Review and approve payout requests</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">Total Payouts</p>
                <p className="text-sm text-muted-foreground">
                  {data?.total ?? 0} payout requests
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Filter by Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Filter by Type
                </label>
                <Select value={walletTypeFilter} onValueChange={setWalletTypeFilter}>
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
                <Select value={countryFilter} onValueChange={setCountryFilter}>
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
        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center">
              <p className="text-destructive font-semibold mb-2">Failed to load payout requests</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Permission Warning */}
        {!canManagePayouts && !error && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                    View-Only Access
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    You can view payout requests but don't have permission to approve or reject them. 
                    Contact your administrator if you need the MANAGE_PAYOUTS permission.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payouts List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !error && data?.payouts && data.payouts.length > 0 ? (
          <div className="space-y-3">
            {data.payouts.map((payout) => {
              const ownerName = payout.walletType === "driver" || payout.walletType === "customer"
                ? payout.owner?.fullName || payout.owner?.email || "Unknown"
                : payout.owner?.restaurantName || payout.owner?.email || "Unknown Restaurant";
              
              return (
                <Card key={payout.id} className="hover-elevate" data-testid={`card-payout-${payout.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <p className="font-semibold truncate" data-testid={`text-owner-${payout.id}`}>
                            {ownerName}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {getWalletTypeBadge(payout.walletType)}
                          <Badge variant="outline">{payout.owner?.countryCode || "N/A"}</Badge>
                          {getStatusBadge(payout.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-semibold text-lg text-green-600 dark:text-green-400" data-testid={`text-amount-${payout.id}`}>
                              {formatCurrency(payout.amount, payout.owner?.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Requested At</p>
                            <p className="font-medium">
                              {format(new Date(payout.requestedAt), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>

                        {payout.processedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Processed: {format(new Date(payout.processedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        )}

                        {payout.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                            <p className="text-xs text-muted-foreground">Rejection Reason:</p>
                            <p className="text-sm text-red-600 dark:text-red-400">{payout.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {payout.status === "pending" && canManagePayouts && (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(payout)}
                            data-testid={`button-approve-${payout.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(payout)}
                            data-testid={`button-reject-${payout.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : !error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No payout requests found</p>
              <p className="text-xs text-muted-foreground mt-2">
                {statusFilter !== "all" || walletTypeFilter !== "all" || countryFilter !== "all"
                  ? "Try changing the filters"
                  : "Payout requests will appear here when users request payouts"}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent data-testid="dialog-approve">
          <DialogHeader>
            <DialogTitle>Approve Payout Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this payout request?
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-2">
              <p><strong>Owner:</strong> {selectedPayout.walletType === "driver" || selectedPayout.walletType === "customer"
                ? selectedPayout.owner?.fullName || selectedPayout.owner?.email || "Unknown"
                : selectedPayout.owner?.restaurantName || selectedPayout.owner?.email || "Unknown Restaurant"
              }</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedPayout.amount, selectedPayout.owner?.currency)}</p>
              <p><strong>Type:</strong> {selectedPayout.walletType}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              data-testid="button-cancel-approve"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Reject Payout Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payout request.
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p><strong>Owner:</strong> {selectedPayout.walletType === "driver" || selectedPayout.walletType === "customer"
                  ? selectedPayout.owner?.fullName || selectedPayout.owner?.email || "Unknown"
                  : selectedPayout.owner?.restaurantName || selectedPayout.owner?.email || "Unknown Restaurant"
                }</p>
                <p><strong>Amount:</strong> {formatCurrency(selectedPayout.amount, selectedPayout.owner?.currency)}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rejection Reason</label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="min-h-24"
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
