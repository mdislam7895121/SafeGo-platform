import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, User, MapPin, Calendar, AlertCircle, Car, ShoppingBag, Package, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface Customer {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    countryCode: string;
    isBlocked: boolean;
    createdAt: string;
  };
  verificationStatus: string;
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
  rides: any[];
  foodOrders: any[];
  deliveries: any[];
  driverComplaints: any[];
  stats: {
    totalRides: number;
    completedRides: number;
    totalFoodOrders: number;
    completedFoodOrders: number;
    totalParcels: number;
    completedParcels: number;
    openComplaints: number;
  };
}

export default function CustomerDetails() {
  const [, params] = useRoute("/admin/customers/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const customerId = params?.id;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);

  // Fetch customer details
  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: [`/api/admin/customers/${customerId}`],
    enabled: !!customerId,
    refetchInterval: 5000,
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/customers/${customerId}/suspend`, { reason: suspensionReason });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to suspend customer");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Customer suspended successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowSuspendDialog(false);
      setSuspensionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unsuspend mutation
  const unsuspendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/customers/${customerId}/unsuspend`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unsuspend customer");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Customer suspension lifted successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Block mutation
  const blockMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/customers/${customerId}/block`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to block customer");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Customer blocked successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowBlockDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unblock mutation
  const unblockMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/customers/${customerId}/unblock`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unblock customer");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Customer unblocked successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowUnblockDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Customer not found</p>
          <Button onClick={() => setLocation("/admin/customers")} className="mt-4">
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  const getKycBadge = () => {
    if (customer.isVerified) {
      return <Badge className="bg-green-600 hover:bg-green-700" data-testid="badge-kyc-verified">Verified</Badge>;
    }
    if (customer.verificationStatus === "pending") {
      return <Badge variant="secondary" data-testid="badge-kyc-pending">Pending</Badge>;
    }
    if (customer.verificationStatus === "rejected") {
      return <Badge variant="destructive" data-testid="badge-kyc-rejected">Rejected</Badge>;
    }
    return <Badge variant="outline">{customer.verificationStatus}</Badge>;
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/admin/customers")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight" data-testid="heading-customer-details">Customer Details</h2>
            <p className="text-muted-foreground" data-testid="text-email">{customer.user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {customer.isSuspended ? (
            <Button
              variant="default"
              onClick={() => unsuspendMutation.mutate()}
              disabled={unsuspendMutation.isPending}
              data-testid="button-unsuspend"
            >
              {unsuspendMutation.isPending ? "Unsuspending..." : "Unsuspend Customer"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setShowSuspendDialog(true)}
              disabled={customer.user.isBlocked}
              data-testid="button-suspend"
            >
              Suspend Customer
            </Button>
          )}
          {customer.user.isBlocked ? (
            <Button
              variant="default"
              onClick={() => setShowUnblockDialog(true)}
              data-testid="button-unblock"
            >
              Unblock Customer
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowBlockDialog(true)}
              data-testid="button-block"
            >
              Block Customer
            </Button>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2">
        {getKycBadge()}
        <Badge variant="outline" data-testid="badge-country">
          <MapPin className="h-3 w-3 mr-1" />
          {customer.user.countryCode}
        </Badge>
        {customer.user.isBlocked && (
          <Badge variant="destructive" data-testid="badge-blocked">Blocked</Badge>
        )}
        {customer.isSuspended && (
          <Badge variant="secondary" data-testid="badge-suspended">Suspended</Badge>
        )}
      </div>

      {/* Suspension Notice */}
      {customer.isSuspended && customer.suspensionReason && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Account Suspended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm"><strong>Reason:</strong> {customer.suspensionReason}</p>
            {customer.suspendedAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Suspended {formatDistanceToNow(new Date(customer.suspendedAt))} ago
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rides</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-rides">{customer.stats.totalRides}</div>
            <p className="text-xs text-muted-foreground">
              {customer.stats.completedRides} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Food Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-food">{customer.stats.totalFoodOrders}</div>
            <p className="text-xs text-muted-foreground">
              {customer.stats.completedFoodOrders} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parcel Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-parcels">{customer.stats.totalParcels}</div>
            <p className="text-xs text-muted-foreground">
              {customer.stats.completedParcels} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Created</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium" data-testid="text-created-at">
              {new Date(customer.user.createdAt).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(customer.user.createdAt))} ago
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KYC Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{getKycBadge()}</div>
            <p className="text-xs text-muted-foreground">Verification status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Complaints</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-complaints">{customer.stats.openComplaints}</div>
            <p className="text-xs text-muted-foreground">Active issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Rides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Recent Rides
            </CardTitle>
            <CardDescription>Last {customer.rides.length} rides</CardDescription>
          </CardHeader>
          <CardContent>
            {customer.rides.length > 0 ? (
              <div className="space-y-2">
                {customer.rides.slice(0, 5).map((ride: any) => (
                  <div key={ride.id} className="flex justify-between items-center border-b pb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ride.pickupLocation} → {ride.dropoffLocation}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ride.createdAt))} ago
                      </p>
                    </div>
                    <Badge variant={ride.status === "completed" ? "default" : "secondary"}>
                      {ride.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No rides yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Food Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Recent Food Orders
            </CardTitle>
            <CardDescription>Last {customer.foodOrders.length} orders</CardDescription>
          </CardHeader>
          <CardContent>
            {customer.foodOrders.length > 0 ? (
              <div className="space-y-2">
                {customer.foodOrders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex justify-between items-center border-b pb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">${order.totalAmount}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.createdAt))} ago
                      </p>
                    </div>
                    <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                      {order.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No food orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Complaints */}
      {customer.driverComplaints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Complaint History
            </CardTitle>
            <CardDescription>Customer complaints and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.driverComplaints.map((complaint: any) => (
                  <TableRow key={complaint.id}>
                    <TableCell>{complaint.reason}</TableCell>
                    <TableCell>
                      <Badge variant={complaint.status === "resolved" ? "default" : "secondary"}>
                        {complaint.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDistanceToNow(new Date(complaint.createdAt))} ago</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Customer Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will temporarily suspend the customer's ability to place orders. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter suspension reason..."
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              data-testid="textarea-suspension-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-suspend">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendMutation.mutate()}
              disabled={!suspensionReason.trim() || suspendMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Customer Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently block the customer from accessing SafeGo services. This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-block">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? "Blocking..." : "Block Customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Dialog */}
      <AlertDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock Customer Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the customer's access to SafeGo services.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-unblock">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unblockMutation.mutate()}
              disabled={unblockMutation.isPending}
              data-testid="button-confirm-unblock"
            >
              {unblockMutation.isPending ? "Unblocking..." : "Unblock Customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
