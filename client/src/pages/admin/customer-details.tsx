import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, User, MapPin, Calendar, AlertCircle, Car, ShoppingBag, Package, Shield, Edit, CreditCard } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  // Bangladesh fields
  fullName?: string;
  fatherName?: string;
  phoneNumber?: string;
  village?: string;
  postOffice?: string;
  thana?: string;
  district?: string;
  presentAddress?: string;
  permanentAddress?: string;
  nidNumber?: string;
  nidFrontImageUrl?: string;
  nidBackImageUrl?: string;
  // US fields
  homeAddress?: string;
  governmentIdType?: string;
  governmentIdLast4?: string;
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
  const [showNid, setShowNid] = useState(false);
  const [nid, setNid] = useState<string>("");
  
  // Edit profile dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    fatherName: "",
    phoneNumber: "",
    village: "",
    postOffice: "",
    thana: "",
    district: "",
    presentAddress: "",
    permanentAddress: "",
    nid: "",
  });

  // Fetch customer details
  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: [`/api/admin/customers/${customerId}`],
    enabled: !!customerId,
    refetchInterval: 5000,
  });

  // Fetch payment methods
  const { data: paymentMethods, isLoading: isLoadingPayments } = useQuery({
    queryKey: [`/api/admin/customers/${customerId}/payment-methods`],
    enabled: !!customerId,
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

  // Fetch NID (admin-only, secure endpoint)
  const fetchNidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/admin/customers/${customerId}/nid`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch NID");
      }
      const data = await response.json();
      return data.nid;
    },
    onSuccess: (data) => {
      setNid(data);
      setShowNid(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      // Only send non-empty fields
      const payload: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value && value.trim()) {
          payload[key] = value.trim();
        }
      });

      const response = await apiRequest("PATCH", `/api/admin/customers/${customerId}/profile`, payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      setShowEditDialog(false);
      setEditForm({
        fullName: "",
        fatherName: "",
        phoneNumber: "",
        village: "",
        postOffice: "",
        thana: "",
        district: "",
        presentAddress: "",
        permanentAddress: "",
        nid: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handler to open edit dialog with existing data
  const handleOpenEditDialog = () => {
    if (customer) {
      setEditForm({
        fullName: customer.fullName || "",
        fatherName: customer.fatherName || "",
        phoneNumber: customer.phoneNumber || "",
        village: customer.village || "",
        postOffice: customer.postOffice || "",
        thana: customer.thana || "",
        district: customer.district || "",
        presentAddress: customer.presentAddress || "",
        permanentAddress: customer.permanentAddress || "",
        nid: customer.nidNumber || "",
      });
    }
    setShowEditDialog(true);
  };

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

      {/* Bangladesh Info - Only shown for Bangladesh customers */}
      {customer.user.countryCode === "BD" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Bangladesh Identity Information
                </CardTitle>
                <CardDescription>Verified identity details for Bangladesh</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEditDialog}
                data-testid="button-edit-profile"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {customer.fullName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                  <p className="text-sm" data-testid="text-full-name">{customer.fullName}</p>
                </div>
              )}
              {customer.fatherName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Father's Name</p>
                  <p className="text-sm" data-testid="text-father-name">{customer.fatherName}</p>
                </div>
              )}
              {customer.phoneNumber && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                  <p className="text-sm" data-testid="text-phone">{customer.phoneNumber}</p>
                </div>
              )}
              {customer.village && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Village</p>
                  <p className="text-sm" data-testid="text-village">{customer.village}</p>
                </div>
              )}
              {customer.postOffice && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Post Office</p>
                  <p className="text-sm" data-testid="text-post-office">{customer.postOffice}</p>
                </div>
              )}
              {customer.thana && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Thana</p>
                  <p className="text-sm" data-testid="text-thana">{customer.thana}</p>
                </div>
              )}
              {customer.district && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">District</p>
                  <p className="text-sm" data-testid="text-district">{customer.district}</p>
                </div>
              )}
              {customer.presentAddress && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Present Address</p>
                  <p className="text-sm" data-testid="text-present-address">{customer.presentAddress}</p>
                </div>
              )}
              {customer.permanentAddress && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Permanent Address</p>
                  <p className="text-sm" data-testid="text-permanent-address">{customer.permanentAddress}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">NID Number</p>
                {showNid ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono" data-testid="text-nid">{nid || customer.nidNumber || "Not available"}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNid(false)}
                      data-testid="button-hide-nid"
                    >
                      Hide
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNidMutation.mutate()}
                    disabled={fetchNidMutation.isPending}
                    data-testid="button-show-nid"
                  >
                    {fetchNidMutation.isPending ? "Loading..." : "Show NID"}
                  </Button>
                )}
              </div>
            </div>
            {(customer.nidFrontImageUrl || customer.nidBackImageUrl) && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">NID Images</p>
                <div className="flex gap-2">
                  {customer.nidFrontImageUrl && (
                    <a
                      href={customer.nidFrontImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                      data-testid="link-nid-front"
                    >
                      View Front
                    </a>
                  )}
                  {customer.nidBackImageUrl && (
                    <a
                      href={customer.nidBackImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                      data-testid="link-nid-back"
                    >
                      View Back
                    </a>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>Saved payment methods (read-only)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method: any) => (
                <div
                  key={method.id}
                  className="p-4 border rounded-lg"
                  data-testid={`payment-method-${method.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium" data-testid={`payment-name-${method.id}`}>
                          {method.paymentType === "card" ? "Credit/Debit Card" : "Mobile Wallet"}
                        </p>
                        {method.isDefault && (
                          <Badge variant="default" data-testid={`payment-default-${method.id}`}>
                            Default
                          </Badge>
                        )}
                        <Badge variant="outline" data-testid={`payment-status-${method.id}`}>
                          {method.status}
                        </Badge>
                      </div>
                      {method.paymentType === "card" && (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {method.cardBrand} •••• {method.cardLast4}
                          </p>
                          {method.expiryMonth && method.expiryYear && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expires {method.expiryMonth}/{method.expiryYear}
                            </p>
                          )}
                        </>
                      )}
                      {method.paymentType === "mobile_wallet" && (
                        <p className="text-sm text-muted-foreground">
                          {method.provider} •••• {method.cardLast4 || method.last4Digits}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-payment-methods">
              No payment methods configured
            </p>
          )}
        </CardContent>
      </Card>

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

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bangladesh Profile</DialogTitle>
            <DialogDescription>
              Update customer Bangladesh identity information. Leave NID blank to keep existing value.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-edit-fullName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-fatherName">Father's Name</Label>
              <Input
                id="edit-fatherName"
                value={editForm.fatherName}
                onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                placeholder="Enter father's name"
                data-testid="input-edit-fatherName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phoneNumber">Phone Number</Label>
              <Input
                id="edit-phoneNumber"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                placeholder="01XXXXXXXXX"
                data-testid="input-edit-phoneNumber"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-village">Village</Label>
              <Input
                id="edit-village"
                value={editForm.village}
                onChange={(e) => setEditForm({ ...editForm, village: e.target.value })}
                placeholder="Enter village name"
                data-testid="input-edit-village"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-postOffice">Post Office</Label>
              <Input
                id="edit-postOffice"
                value={editForm.postOffice}
                onChange={(e) => setEditForm({ ...editForm, postOffice: e.target.value })}
                placeholder="Enter post office"
                data-testid="input-edit-postOffice"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-thana">Thana</Label>
              <Input
                id="edit-thana"
                value={editForm.thana}
                onChange={(e) => setEditForm({ ...editForm, thana: e.target.value })}
                placeholder="Enter thana/upazila"
                data-testid="input-edit-thana"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-district">District</Label>
              <Input
                id="edit-district"
                value={editForm.district}
                onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                placeholder="Enter district"
                data-testid="input-edit-district"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-presentAddress">Present Address</Label>
              <Textarea
                id="edit-presentAddress"
                value={editForm.presentAddress}
                onChange={(e) => setEditForm({ ...editForm, presentAddress: e.target.value })}
                placeholder="Enter current address"
                data-testid="input-edit-presentAddress"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-permanentAddress">Permanent Address</Label>
              <Textarea
                id="edit-permanentAddress"
                value={editForm.permanentAddress}
                onChange={(e) => setEditForm({ ...editForm, permanentAddress: e.target.value })}
                placeholder="Enter permanent address"
                data-testid="input-edit-permanentAddress"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-nid">NID Number (10-17 digits)</Label>
              <Input
                id="edit-nid"
                value={editForm.nid}
                onChange={(e) => setEditForm({ ...editForm, nid: e.target.value })}
                placeholder="Enter NID (will be encrypted)"
                data-testid="input-edit-nid"
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep existing NID. Will be encrypted securely.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updateProfileMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateProfileMutation.mutate(editForm)}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
