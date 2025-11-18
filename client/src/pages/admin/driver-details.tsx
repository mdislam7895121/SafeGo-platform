import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Car, Shield, Ban, Unlock, Trash2, Clock, DollarSign, Star, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DriverDetails {
  id: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  lastActive: string | null;
  isBlocked: boolean;
  vehicle: {
    id: string;
    vehicleType: string;
    vehicleModel: string;
    vehiclePlate: string;
    isOnline: boolean;
    totalEarnings: string;
  } | null;
  stats: {
    rating: string;
    averageRating: string;
    totalTrips: number;
    totalEarnings: string;
    completionRate: string;
  } | null;
  wallet: {
    balance: string;
    negativeBalance: string;
  } | null;
}

interface Trip {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  serviceFare: string;
  driverPayout: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export default function AdminDriverDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/drivers/:id");
  const { toast } = useToast();
  const driverId = params?.id;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");

  // Fetch driver details
  const { data: driver, isLoading } = useQuery<DriverDetails>({
    queryKey: [`/api/admin/drivers/${driverId}`],
    enabled: !!driverId,
  });

  // Fetch trip history
  const { data: trips } = useQuery<Trip[]>({
    queryKey: [`/api/admin/drivers/${driverId}/trips`],
    enabled: !!driverId,
  });

  // Suspend driver mutation
  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: suspensionReason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to suspend driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver suspended successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowSuspendDialog(false);
      setSuspensionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unsuspend driver mutation
  const unsuspendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/unsuspend`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unsuspend driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver suspension lifted successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Block driver mutation
  const blockMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/block`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to block driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver blocked successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowBlockDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unblock driver mutation
  const unblockMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/unblock`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unblock driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver unblocked successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete driver mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      navigate("/admin/drivers");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setShowDeleteDialog(false);
    },
  });

  const getStatusBadge = () => {
    if (!driver) return null;
    if (driver.isBlocked) {
      return <Badge variant="destructive">Blocked</Badge>;
    }
    if (driver.isSuspended) {
      return <Badge className="bg-orange-500">Suspended</Badge>;
    }
    if (!driver.isVerified) {
      return <Badge variant="secondary">Pending KYC</Badge>;
    }
    if (driver.vehicle?.isOnline) {
      return <Badge className="bg-green-500">Online</Badge>;
    }
    return <Badge variant="outline">Offline</Badge>;
  };

  if (!driverId) {
    return <div>Invalid driver ID</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/drivers")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Driver Details</h1>
            {isLoading ? (
              <Skeleton className="h-4 w-48 mt-1 bg-primary-foreground/20" />
            ) : (
              <p className="text-sm opacity-90" data-testid="text-email">{driver?.email}</p>
            )}
          </div>
          {!isLoading && driver && getStatusBadge()}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : driver ? (
          <>
            {/* Driver Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Driver Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="text-driver-email">{driver.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium" data-testid="text-driver-country">{driver.countryCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Verification Status</p>
                    <Badge variant={driver.isVerified ? "default" : "secondary"} data-testid="text-verification-status">
                      {driver.verificationStatus}
                    </Badge>
                  </div>
                </div>

                {driver.vehicle && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle Type</p>
                      <p className="font-medium" data-testid="text-vehicle-type">{driver.vehicle.vehicleType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle Model</p>
                      <p className="font-medium" data-testid="text-vehicle-model">{driver.vehicle.vehicleModel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">License Plate</p>
                      <p className="font-medium" data-testid="text-vehicle-plate">{driver.vehicle.vehiclePlate}</p>
                    </div>
                  </div>
                )}

                {driver.lastActive && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Last Active</p>
                    <p className="font-medium" data-testid="text-last-active">
                      {format(new Date(driver.lastActive), "PPpp")}
                    </p>
                  </div>
                )}

                {driver.isSuspended && driver.suspensionReason && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-900 dark:text-orange-100">Suspended</p>
                        <p className="text-sm text-orange-800 dark:text-orange-200" data-testid="text-suspension-reason">
                          {driver.suspensionReason}
                        </p>
                        {driver.suspendedAt && (
                          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            Since {format(new Date(driver.suspendedAt), "PPp")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Star className="h-8 w-8 text-yellow-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-rating">
                      {driver.stats?.averageRating || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <TrendingUp className="h-8 w-8 text-blue-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-trips">
                      {driver.stats?.totalTrips || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <DollarSign className="h-8 w-8 text-green-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-earnings">
                      ${driver.stats?.totalEarnings || driver.vehicle?.totalEarnings || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Earnings</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <DollarSign className="h-8 w-8 text-purple-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-wallet">
                      ${driver.wallet?.balance || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {driver.isSuspended ? (
                    <Button
                      variant="outline"
                      onClick={() => unsuspendMutation.mutate()}
                      disabled={unsuspendMutation.isPending}
                      data-testid="button-unsuspend"
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Lift Suspension
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowSuspendDialog(true)}
                      disabled={driver.isBlocked}
                      data-testid="button-suspend"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Suspend Driver
                    </Button>
                  )}

                  {driver.isBlocked ? (
                    <Button
                      variant="outline"
                      onClick={() => unblockMutation.mutate()}
                      disabled={unblockMutation.isPending}
                      data-testid="button-unblock"
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Unblock Driver
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => setShowBlockDialog(true)}
                      data-testid="button-block"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block Driver
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    data-testid="button-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Driver
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Trip History */}
            {trips && trips.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Trips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trips.slice(0, 10).map((trip) => (
                      <div key={trip.id} className="p-3 border rounded-lg" data-testid={`trip-${trip.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{trip.pickupAddress} → {trip.dropoffAddress}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(trip.createdAt), "PPp")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">${trip.driverPayout}</p>
                            <Badge variant={trip.status === "completed" ? "default" : "secondary"} className="mt-1">
                              {trip.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Driver not found</p>
          </div>
        )}
      </div>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a reason for suspending this driver. They will not be able to accept new ride requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for suspension..."
            value={suspensionReason}
            onChange={(e) => setSuspensionReason(e.target.value)}
            data-testid="textarea-suspension-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-suspend">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendMutation.mutate()}
              disabled={!suspensionReason || suspendMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Driver</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently block the driver from logging in. This action can be undone later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-block">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-block"
            >
              Block Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the driver account. This action cannot be undone. The driver must have no active trips and no negative wallet balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
