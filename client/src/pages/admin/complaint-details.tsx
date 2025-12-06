import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { MessageSquareWarning, AlertTriangle, Shield, Ban, CheckCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
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
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ComplaintDetails {
  id: string;
  driverId: string;
  driver: {
    id: string;
    email: string;
    countryCode: string;
    isBlocked: boolean;
    isSuspended: boolean;
    verificationStatus: string;
  };
  customerId: string | null;
  customer: {
    id: string;
    email: string;
  } | null;
  rideId: string | null;
  ride: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    serviceFare: string;
    driverPayout: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  } | null;
  reason: string;
  description: string | null;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminComplaintDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/complaints/:id");
  const { toast } = useToast();
  const complaintId = params?.id;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");

  // Fetch complaint details with auto-refresh
  const { data: complaint, isLoading } = useQuery<ComplaintDetails>({
    queryKey: [`/api/admin/complaints/${complaintId}`],
    enabled: !!complaintId,
    refetchInterval: 30000, // Reduced for memory efficiency
  });

  // Resolve complaint mutation
  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/complaints/${complaintId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resolve complaint");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Complaint resolved successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/complaints/${complaintId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Suspend driver mutation
  const suspendDriverMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${complaint?.driverId}/suspend`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/admin/complaints/${complaintId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowSuspendDialog(false);
      setSuspensionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Block driver mutation
  const blockDriverMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${complaint?.driverId}/block`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/admin/complaints/${complaintId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowBlockDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!complaintId) {
    return <div>Invalid complaint ID</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Complaint Details"
        description={isLoading ? "Loading..." : complaint?.reason}
        icon={MessageSquareWarning}
        backButton={{ label: "Back to Complaints", href: "/admin/complaints" }}
        actions={
          !isLoading && complaint && (
            <Badge variant={complaint.status === "resolved" ? "default" : "destructive"} data-testid="badge-status">
              {complaint.status}
            </Badge>
          )
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : complaint ? (
          <>
            {/* Complaint Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Complaint Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Reason</p>
                    <p className="font-medium" data-testid="text-complaint-reason">{complaint.reason}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={complaint.status === "resolved" ? "default" : "destructive"}>
                      {complaint.status}
                    </Badge>
                  </div>
                </div>

                {complaint.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm" data-testid="text-description">{complaint.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Filed On</p>
                    <p className="text-sm" data-testid="text-created">
                      {format(new Date(complaint.createdAt), "PPpp")}
                    </p>
                  </div>
                  {complaint.resolvedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Resolved On</p>
                      <p className="text-sm" data-testid="text-resolved">
                        {format(new Date(complaint.resolvedAt), "PPpp")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Driver Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    Driver Information
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/drivers/${complaint.driver.id}`)}
                    data-testid="button-view-driver"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Full Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="text-driver-email">{complaint.driver.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium" data-testid="text-driver-country">{complaint.driver.countryCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {complaint.driver.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                      {complaint.driver.isSuspended && <Badge className="bg-orange-500">Suspended</Badge>}
                      {!complaint.driver.isBlocked && !complaint.driver.isSuspended && (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            {complaint.customer && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="text-customer-email">{complaint.customer.email}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Trip */}
            {complaint.ride && (
              <Card>
                <CardHeader>
                  <CardTitle>Related Trip</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup</p>
                      <p className="text-sm" data-testid="text-pickup">{complaint.ride.pickupAddress}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dropoff</p>
                      <p className="text-sm" data-testid="text-dropoff">{complaint.ride.dropoffAddress}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Fare</p>
                      <p className="font-medium" data-testid="text-fare">${complaint.ride.serviceFare}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Driver Payout</p>
                      <p className="font-medium" data-testid="text-payout">${complaint.ride.driverPayout}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="outline" data-testid="text-ride-status">{complaint.ride.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {complaint.status === "open" && (
                    <Button
                      variant="outline"
                      onClick={() => resolveMutation.mutate()}
                      disabled={resolveMutation.isPending}
                      data-testid="button-resolve"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                  )}

                  {!complaint.driver.isSuspended && !complaint.driver.isBlocked && (
                    <Button
                      variant="outline"
                      onClick={() => setShowSuspendDialog(true)}
                      data-testid="button-suspend-driver"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Suspend Driver
                    </Button>
                  )}

                  {!complaint.driver.isBlocked && (
                    <Button
                      variant="destructive"
                      onClick={() => setShowBlockDialog(true)}
                      data-testid="button-block-driver"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block Driver
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Complaint not found</p>
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
              onClick={() => suspendDriverMutation.mutate()}
              disabled={!suspensionReason || suspendDriverMutation.isPending}
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
              onClick={() => blockDriverMutation.mutate()}
              disabled={blockDriverMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-block"
            >
              Block Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
