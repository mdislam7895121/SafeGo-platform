import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, UtensilsCrossed, MapPin, DollarSign, ShoppingBag, AlertTriangle, Shield, Ban, Unlock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RestaurantDetails {
  id: string;
  userId: string;
  email: string;
  restaurantName: string;
  address: string;
  country: string;
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason: string | null;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  isBlocked: boolean;
  balance: number;
  negativeBalance: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalCommission: number;
  recentOrders: any[];
  complaints: any[];
  createdAt: string;
  accountCreated: string;
}

export default function RestaurantDetails() {
  const [, params] = useRoute("/admin/restaurants/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const restaurantId = params?.id;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");

  const { data: restaurant, isLoading } = useQuery<RestaurantDetails>({
    queryKey: [`/api/admin/restaurants/${restaurantId}`],
    refetchInterval: 5000,
    enabled: !!restaurantId,
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/restaurants/${restaurantId}/suspend`, { reason: suspensionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/restaurants/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Success", description: "Restaurant suspended successfully" });
      setShowSuspendDialog(false);
      setSuspensionReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to suspend restaurant", variant: "destructive" });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/restaurants/${restaurantId}/unsuspend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/restaurants/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Success", description: "Restaurant unsuspended successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unsuspend restaurant", variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/restaurants/${restaurantId}/block`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/restaurants/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Success", description: "Restaurant blocked successfully" });
      setShowBlockDialog(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to block restaurant", variant: "destructive" });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/restaurants/${restaurantId}/unblock`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/restaurants/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Success", description: "Restaurant unblocked successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unblock restaurant", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-muted-foreground">Restaurant not found</p>
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
            onClick={() => navigate("/admin/restaurants")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-restaurant-name">{restaurant.restaurantName}</h1>
            <p className="text-sm opacity-90">{restaurant.email}</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          {restaurant.isBlocked && (
            <Badge variant="destructive" data-testid="badge-blocked">Blocked</Badge>
          )}
          {restaurant.isSuspended && (
            <Badge className="bg-orange-500" data-testid="badge-suspended">Suspended</Badge>
          )}
          {restaurant.isVerified && (
            <Badge className="bg-green-500" data-testid="badge-verified">Verified</Badge>
          )}
          {!restaurant.isVerified && (
            <Badge variant="secondary" data-testid="badge-pending-kyc">Pending KYC</Badge>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Restaurant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Restaurant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Restaurant Name</p>
                <p className="font-medium" data-testid="text-name">{restaurant.restaurantName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium" data-testid="text-email">{restaurant.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <Badge variant="outline" data-testid="badge-country">{restaurant.country}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Created</p>
                <p className="text-sm" data-testid="text-created">
                  {format(new Date(restaurant.accountCreated), "PP")}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="flex items-start gap-2 mt-1" data-testid="text-address">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>{restaurant.address}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KYC Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              KYC Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {restaurant.verificationStatus === "approved" && (
                  <Badge className="bg-green-500">Verified</Badge>
                )}
                {restaurant.verificationStatus === "pending" && (
                  <Badge variant="secondary">Pending</Badge>
                )}
                {restaurant.verificationStatus === "rejected" && (
                  <Badge variant="destructive">Rejected</Badge>
                )}
              </div>
              {restaurant.rejectionReason && (
                <div>
                  <p className="text-sm text-muted-foreground">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-1">{restaurant.rejectionReason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Wallet Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Wallet & Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-balance">
                  ${Number(restaurant.balance).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owed Amount</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-owed">
                  ${Number(restaurant.negativeBalance).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold" data-testid="text-revenue">
                  ${Number(restaurant.totalRevenue).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SafeGo Commission</p>
                <p className="text-2xl font-bold" data-testid="text-commission">
                  ${Number(restaurant.totalCommission).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Order Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold" data-testid="text-total-orders">{restaurant.totalOrders}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed Orders</p>
                <p className="text-2xl font-bold" data-testid="text-completed-orders">{restaurant.completedOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Complaints */}
        {restaurant.complaints && restaurant.complaints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Complaints ({restaurant.complaints.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {restaurant.complaints.map((complaint) => (
                  <div key={complaint.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{complaint.reason}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(complaint.createdAt), "PPp")}
                        </p>
                      </div>
                      <Badge variant={complaint.status === "open" ? "destructive" : "secondary"}>
                        {complaint.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suspension Info */}
        {restaurant.isSuspended && (
          <Card className="border-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Shield className="h-5 w-5" />
                Suspension Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium" data-testid="text-suspension-reason">{restaurant.suspensionReason}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suspended At</p>
                <p className="text-sm">
                  {restaurant.suspendedAt && format(new Date(restaurant.suspendedAt), "PPp")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {!restaurant.isSuspended ? (
              <Button
                variant="default"
                onClick={() => setShowSuspendDialog(true)}
                disabled={suspendMutation.isPending || restaurant.isBlocked}
                data-testid="button-suspend"
              >
                <Shield className="h-4 w-4 mr-2" />
                Suspend Restaurant
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => unsuspendMutation.mutate()}
                disabled={unsuspendMutation.isPending || restaurant.isBlocked}
                data-testid="button-unsuspend"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Unsuspend Restaurant
              </Button>
            )}

            {!restaurant.isBlocked ? (
              <Button
                variant="destructive"
                onClick={() => setShowBlockDialog(true)}
                disabled={blockMutation.isPending}
                data-testid="button-block"
              >
                <Ban className="h-4 w-4 mr-2" />
                Block Restaurant
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => unblockMutation.mutate()}
                disabled={unblockMutation.isPending}
                data-testid="button-unblock"
              >
                <Unlock className="h-4 w-4 mr-2" />
                Unblock Restaurant
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent data-testid="dialog-suspend">
          <DialogHeader>
            <DialogTitle>Suspend Restaurant</DialogTitle>
            <DialogDescription>
              This will temporarily prevent the restaurant from receiving orders. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter suspension reason..."
            value={suspensionReason}
            onChange={(e) => setSuspensionReason(e.target.value)}
            data-testid="textarea-suspension-reason"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSuspendDialog(false)}
              data-testid="button-cancel-suspend"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => suspendMutation.mutate()}
              disabled={!suspensionReason.trim() || suspendMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent data-testid="dialog-block">
          <DialogHeader>
            <DialogTitle>Block Restaurant</DialogTitle>
            <DialogDescription>
              This will permanently block the restaurant account. The user will not be able to access SafeGo services. This action can be reversed later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBlockDialog(false)}
              data-testid="button-cancel-block"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? "Blocking..." : "Block Restaurant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
