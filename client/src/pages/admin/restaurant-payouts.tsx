import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Wallet, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function AdminRestaurantPayouts() {
  const { toast } = useToast();
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [externalRef, setExternalRef] = useState("");

  // Fetch restaurant list with balances
  const { data: restaurantsData, isLoading: restaurantsLoading } = useQuery({
    queryKey: ["/api/admin/payouts/restaurants"],
  });

  // Fetch pending payouts
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/admin/payouts/pending"],
  });

  // Approve payout mutation
  const approveMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      return await apiRequest(`/api/admin/payouts/${payoutId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      toast({ title: "Payout Approved", description: "Payout has been approved for processing" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts/pending"] });
      setShowApproveDialog(false);
      setSelectedPayout(null);
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve payout",
        variant: "destructive",
      });
    },
  });

  // Reject payout mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ payoutId, reason }: { payoutId: string; reason: string }) => {
      return await apiRequest(`/api/admin/payouts/${payoutId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Payout Rejected", description: "Payout has been rejected and refunded" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts/pending"] });
      setShowRejectDialog(false);
      setSelectedPayout(null);
      setRejectReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject payout",
        variant: "destructive",
      });
    },
  });

  // Complete payout mutation
  const completeMutation = useMutation({
    mutationFn: async ({
      payoutId,
      externalReferenceId,
    }: {
      payoutId: string;
      externalReferenceId?: string;
    }) => {
      return await apiRequest(`/api/admin/payouts/${payoutId}/complete`, {
        method: "POST",
        body: JSON.stringify({ externalReferenceId }),
      });
    },
    onSuccess: () => {
      toast({ title: "Payout Completed", description: "Payout marked as completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts/pending"] });
      setShowCompleteDialog(false);
      setSelectedPayout(null);
      setExternalRef("");
    },
    onError: (error: any) => {
      toast({
        title: "Completion Failed",
        description: error.message || "Failed to complete payout",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (payout: any) => {
    setSelectedPayout(payout);
    setShowApproveDialog(true);
  };

  const handleReject = (payout: any) => {
    setSelectedPayout(payout);
    setShowRejectDialog(true);
  };

  const handleComplete = (payout: any) => {
    setSelectedPayout(payout);
    setShowCompleteDialog(true);
  };

  const confirmApprove = () => {
    if (selectedPayout) {
      approveMutation.mutate(selectedPayout.id);
    }
  };

  const confirmReject = () => {
    if (selectedPayout && rejectReason.trim()) {
      rejectMutation.mutate({ payoutId: selectedPayout.id, reason: rejectReason });
    }
  };

  const confirmComplete = () => {
    if (selectedPayout) {
      completeMutation.mutate({ payoutId: selectedPayout.id, externalReferenceId: externalRef });
    }
  };

  if (restaurantsLoading || pendingLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const restaurants = restaurantsData?.restaurants || [];
  const pendingPayouts = pendingData?.payouts || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-admin-payouts-title">
          Restaurant Payouts Management
        </h1>
        <p className="text-muted-foreground">
          Manage restaurant wallet balances and payout requests
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-count">
              {pendingPayouts.length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-restaurant-count">
              {restaurants.length}
            </div>
            <p className="text-xs text-muted-foreground">Verified restaurants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Balances</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-negative-count">
              {restaurants.filter((r: any) => r.negativeBalance > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">With outstanding debt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Balances</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-positive-count">
              {restaurants.filter((r: any) => r.walletBalance > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">With available funds</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Payout Requests</CardTitle>
          <CardDescription>Review and approve or reject payout requests</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingPayouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending payouts</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayouts.map((payout: any) => (
                  <TableRow key={payout.id} data-testid={`row-payout-${payout.id}`}>
                    <TableCell className="font-medium">{payout.restaurantName}</TableCell>
                    <TableCell>{payout.restaurantEmail}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {payout.wallet.currency} {parseFloat(payout.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payout.status === "pending"
                            ? "secondary"
                            : payout.status === "processing"
                            ? "default"
                            : "outline"
                        }
                      >
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(payout.createdAt), "MMM dd, yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payout.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(payout)}
                              data-testid={`button-approve-${payout.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(payout)}
                              data-testid={`button-reject-${payout.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {payout.status === "processing" && (
                          <Button
                            size="sm"
                            onClick={() => handleComplete(payout)}
                            data-testid={`button-complete-${payout.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restaurant Balances Table */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Wallet Balances</CardTitle>
          <CardDescription>Overview of all restaurant wallet balances</CardDescription>
        </CardHeader>
        <CardContent>
          {restaurants.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No restaurants found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                  <TableHead className="text-right">Negative Balance</TableHead>
                  <TableHead className="text-right">Pending Payouts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.map((restaurant: any) => (
                  <TableRow key={restaurant.restaurantId} data-testid={`row-restaurant-${restaurant.restaurantId}`}>
                    <TableCell className="font-medium">{restaurant.restaurantName}</TableCell>
                    <TableCell>{restaurant.email}</TableCell>
                    <TableCell>{restaurant.countryCode}</TableCell>
                    <TableCell className="text-right">
                      <span className={restaurant.walletBalance > 0 ? "text-green-600" : ""}>
                        {restaurant.currency} {restaurant.walletBalance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {restaurant.negativeBalance > 0 ? (
                        <span className="text-destructive">
                          {restaurant.currency} {restaurant.negativeBalance.toFixed(2)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {restaurant.pendingPayoutCount > 0 ? (
                        <Badge variant="secondary">{restaurant.pendingPayoutCount}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payout Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this payout request?
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-2">
              <p>
                <strong>Restaurant:</strong> {selectedPayout.restaurantName}
              </p>
              <p>
                <strong>Amount:</strong> {selectedPayout.wallet.currency}{" "}
                {parseFloat(selectedPayout.amount).toFixed(2)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payout Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this payout. The amount will be refunded to the restaurant's wallet.
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <p>
                <strong>Restaurant:</strong> {selectedPayout.restaurantName}
              </p>
              <p>
                <strong>Amount:</strong> {selectedPayout.wallet.currency}{" "}
                {parseFloat(selectedPayout.amount).toFixed(2)}
              </p>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Rejection Reason</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  data-testid="input-reject-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payout as Paid</DialogTitle>
            <DialogDescription>
              Mark this payout as completed and processed.
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <p>
                <strong>Restaurant:</strong> {selectedPayout.restaurantName}
              </p>
              <p>
                <strong>Amount:</strong> {selectedPayout.wallet.currency}{" "}
                {parseFloat(selectedPayout.amount).toFixed(2)}
              </p>
              <div className="space-y-2">
                <Label htmlFor="external-ref">External Reference (Optional)</Label>
                <Input
                  id="external-ref"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder="Transaction ID or reference number"
                  data-testid="input-external-ref"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmComplete} disabled={completeMutation.isPending} data-testid="button-confirm-complete">
              {completeMutation.isPending ? "Completing..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
