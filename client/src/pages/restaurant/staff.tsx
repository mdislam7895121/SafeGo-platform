import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Activity,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface StaffMember {
  id: string;
  userId: string;
  staffActive: boolean;
  canEditCategories: boolean;
  canEditItems: boolean;
  canToggleAvailability: boolean;
  canUseBulkTools: boolean;
  canViewAnalytics: boolean;
  canViewPayouts: boolean;
  canManageOrders: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
}

interface AddStaffFormData {
  name: string;
  email: string;
  phone: string;
  temporaryPassword: string;
  permissions: {
    canEditCategories: boolean;
    canEditItems: boolean;
    canToggleAvailability: boolean;
    canUseBulkTools: boolean;
    canViewAnalytics: boolean;
    canViewPayouts: boolean;
    canManageOrders: boolean;
  };
}

export default function StaffManagementPage() {
  const { toast } = useToast();
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [blockingStaff, setBlockingStaff] = useState<StaffMember | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const [newStaff, setNewStaff] = useState<AddStaffFormData>({
    name: "",
    email: "",
    phone: "",
    temporaryPassword: "",
    permissions: {
      canEditCategories: false,
      canEditItems: false,
      canToggleAvailability: false,
      canUseBulkTools: false,
      canViewAnalytics: false,
      canViewPayouts: false,
      canManageOrders: false,
    },
  });

  const { data, isLoading } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ["/api/restaurant/staff"],
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: AddStaffFormData) => {
      return await apiRequest("/api/restaurant/staff", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Staff member added",
        description: "The staff member has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      setNewStaff({
        name: "",
        email: "",
        phone: "",
        temporaryPassword: "",
        permissions: {
          canEditCategories: false,
          canEditItems: false,
          canToggleAvailability: false,
          canUseBulkTools: false,
          canViewAnalytics: false,
          canViewPayouts: false,
          canManageOrders: false,
        },
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add staff member",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ staffId, permissions }: { staffId: string; permissions: any }) => {
      return await apiRequest(`/api/restaurant/staff/${staffId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Permissions updated",
        description: "Staff member permissions have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      setEditingStaff(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update permissions",
      });
    },
  });

  const blockStaffMutation = useMutation({
    mutationFn: async ({ staffId, block, reason }: { staffId: string; block: boolean; reason?: string }) => {
      return await apiRequest(`/api/restaurant/staff/${staffId}/block`, {
        method: "POST",
        body: JSON.stringify({ block, reason }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.block ? "Staff member blocked" : "Staff member unblocked",
        description: variables.block
          ? "The staff member has been blocked and cannot access the system."
          : "The staff member has been unblocked and can now access the system.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      setBlockingStaff(null);
      setBlockReason("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update staff status",
      });
    },
  });

  const handleCreateStaff = () => {
    if (!newStaff.name || !newStaff.email || !newStaff.phone || !newStaff.temporaryPassword) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    createStaffMutation.mutate(newStaff);
  };

  const handleUpdatePermissions = () => {
    if (!editingStaff) return;
    updatePermissionsMutation.mutate({
      staffId: editingStaff.id,
      permissions: {
        canEditCategories: editingStaff.canEditCategories,
        canEditItems: editingStaff.canEditItems,
        canToggleAvailability: editingStaff.canToggleAvailability,
        canUseBulkTools: editingStaff.canUseBulkTools,
        canViewAnalytics: editingStaff.canViewAnalytics,
        canViewPayouts: editingStaff.canViewPayouts,
        canManageOrders: editingStaff.canManageOrders,
      },
    });
  };

  const handleBlockStaff = () => {
    if (!blockingStaff) return;
    blockStaffMutation.mutate({
      staffId: blockingStaff.id,
      block: !blockingStaff.staffActive,
      reason: blockReason,
    });
  };

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-5 pb-8 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-10 w-full md:w-48" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const staff = data?.staff || [];
  const activeStaff = staff.filter((s) => s.staffActive);
  const blockedStaff = staff.filter((s) => !s.staffActive);

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-5 pb-8 space-y-5">
      {/* Header Block */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage your restaurant staff and their permissions
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild data-testid="button-activity-log">
              <Link href="/restaurant/staff/activity">
                <Activity className="w-4 h-4 mr-2" />
                Activity Log
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: 2-column layout, Mobile/Tablet: stacked */}
      <div className="grid gap-6 lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,480px]">
        {/* Left Column: Summary Cards + Staff List */}
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-staff">
                  {staff.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-active-staff">
                  {activeStaff.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-blocked-staff">
                  {blockedStaff.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staff List */}
          {staff.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No staff members yet</h3>
                <p className="text-muted-foreground text-center mb-4 text-sm md:text-base">
                  Add your first staff member using the form on the right
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {staff.map((member) => (
                <Card key={member.id} data-testid={`card-staff-${member.id}`}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base md:text-lg" data-testid={`text-staff-name-${member.id}`}>
                            {member.user.name}
                          </CardTitle>
                          {member.staffActive ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              Blocked
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          <div className="flex flex-col gap-1 text-sm">
                            <span data-testid={`text-staff-email-${member.id}`}>{member.user.email}</span>
                            <span data-testid={`text-staff-phone-${member.id}`}>{member.user.phone}</span>
                          </div>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingStaff(member)}
                          data-testid={`button-edit-permissions-${member.id}`}
                        >
                          <Settings className="w-4 h-4 md:mr-2" />
                          <span className="hidden md:inline">Permissions</span>
                        </Button>
                        <Button
                          variant={member.staffActive ? "destructive" : "default"}
                          size="sm"
                          onClick={() => setBlockingStaff(member)}
                          data-testid={`button-block-${member.id}`}
                        >
                          {member.staffActive ? (
                            <>
                              <ShieldAlert className="w-4 h-4 md:mr-2" />
                              <span className="hidden md:inline">Block</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 md:mr-2" />
                              <span className="hidden md:inline">Unblock</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-2" />
                        Last login:{" "}
                        {member.lastLoginAt
                          ? new Date(member.lastLoginAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Never"}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {member.canEditCategories && <Badge variant="secondary">Edit Categories</Badge>}
                        {member.canEditItems && <Badge variant="secondary">Edit Items</Badge>}
                        {member.canToggleAvailability && <Badge variant="secondary">Toggle Availability</Badge>}
                        {member.canUseBulkTools && <Badge variant="secondary">Bulk Tools</Badge>}
                        {member.canViewAnalytics && <Badge variant="secondary">View Analytics</Badge>}
                        {member.canViewPayouts && <Badge variant="secondary">View Payouts</Badge>}
                        {member.canManageOrders && <Badge variant="secondary">Manage Orders</Badge>}
                        {!member.canEditCategories &&
                          !member.canEditItems &&
                          !member.canToggleAvailability &&
                          !member.canUseBulkTools &&
                          !member.canViewAnalytics &&
                          !member.canViewPayouts &&
                          !member.canManageOrders && (
                            <Badge variant="outline" className="text-muted-foreground">
                              No permissions
                            </Badge>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Add Staff Form (inline card, always visible) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Staff Member
              </CardTitle>
              <CardDescription className="text-sm">
                Create a new staff account with a temporary password. The staff member will be prompted to change
                their password on first login.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Form Fields */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm md:text-base">
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    placeholder="Enter full name"
                    data-testid="input-staff-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="Enter email address"
                    data-testid="input-staff-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm md:text-base">
                    Phone *
                  </Label>
                  <Input
                    id="phone"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="Enter phone number"
                    data-testid="input-staff-phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm md:text-base">
                    Temporary Password *
                  </Label>
                  <Input
                    id="password"
                    type="text"
                    value={newStaff.temporaryPassword}
                    onChange={(e) => setNewStaff({ ...newStaff, temporaryPassword: e.target.value })}
                    placeholder="Enter temporary password"
                    data-testid="input-staff-password"
                  />
                </div>
              </div>

              {/* Permissions Section */}
              <div className="border-t pt-4 space-y-3">
                <Label className="text-base font-semibold">Permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canEditCategories" className="font-normal text-sm">
                      Edit Categories
                    </Label>
                    <Switch
                      id="canEditCategories"
                      checked={newStaff.permissions.canEditCategories}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canEditCategories: checked },
                        })
                      }
                      data-testid="switch-can-edit-categories"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="canEditItems" className="font-normal text-sm">
                      Edit Menu Items
                    </Label>
                    <Switch
                      id="canEditItems"
                      checked={newStaff.permissions.canEditItems}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canEditItems: checked },
                        })
                      }
                      data-testid="switch-can-edit-items"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="canToggleAvailability" className="font-normal text-sm">
                      Toggle Availability
                    </Label>
                    <Switch
                      id="canToggleAvailability"
                      checked={newStaff.permissions.canToggleAvailability}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canToggleAvailability: checked },
                        })
                      }
                      data-testid="switch-can-toggle-availability"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="canUseBulkTools" className="font-normal text-sm">
                      Use Bulk Tools
                    </Label>
                    <Switch
                      id="canUseBulkTools"
                      checked={newStaff.permissions.canUseBulkTools}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canUseBulkTools: checked },
                        })
                      }
                      data-testid="switch-can-use-bulk-tools"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="canViewAnalytics" className="font-normal text-sm">
                      View Analytics
                    </Label>
                    <Switch
                      id="canViewAnalytics"
                      checked={newStaff.permissions.canViewAnalytics}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canViewAnalytics: checked },
                        })
                      }
                      data-testid="switch-can-view-analytics"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="canViewPayouts" className="font-normal text-sm">
                      View Payouts
                    </Label>
                    <Switch
                      id="canViewPayouts"
                      checked={newStaff.permissions.canViewPayouts}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canViewPayouts: checked },
                        })
                      }
                      data-testid="switch-can-view-payouts"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="canManageOrders" className="font-normal text-sm">
                      Manage Orders
                    </Label>
                    <Switch
                      id="canManageOrders"
                      checked={newStaff.permissions.canManageOrders}
                      onCheckedChange={(checked) =>
                        setNewStaff({
                          ...newStaff,
                          permissions: { ...newStaff.permissions, canManageOrders: checked },
                        })
                      }
                      data-testid="switch-can-manage-orders"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  onClick={handleCreateStaff}
                  disabled={createStaffMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-add"
                >
                  {createStaffMutation.isPending ? "Creating..." : "Create Staff Member"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Permissions Dialog */}
      {editingStaff && (
        <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Permissions</DialogTitle>
              <DialogDescription>Update permissions for {editingStaff.user.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canEditCategories" className="font-normal">
                  Edit Categories
                </Label>
                <Switch
                  id="edit-canEditCategories"
                  checked={editingStaff.canEditCategories}
                  onCheckedChange={(checked) =>
                    setEditingStaff({ ...editingStaff, canEditCategories: checked })
                  }
                  data-testid="switch-edit-can-edit-categories"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canEditItems" className="font-normal">
                  Edit Menu Items
                </Label>
                <Switch
                  id="edit-canEditItems"
                  checked={editingStaff.canEditItems}
                  onCheckedChange={(checked) => setEditingStaff({ ...editingStaff, canEditItems: checked })}
                  data-testid="switch-edit-can-edit-items"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canToggleAvailability" className="font-normal">
                  Toggle Availability
                </Label>
                <Switch
                  id="edit-canToggleAvailability"
                  checked={editingStaff.canToggleAvailability}
                  onCheckedChange={(checked) =>
                    setEditingStaff({ ...editingStaff, canToggleAvailability: checked })
                  }
                  data-testid="switch-edit-can-toggle-availability"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canUseBulkTools" className="font-normal">
                  Use Bulk Tools
                </Label>
                <Switch
                  id="edit-canUseBulkTools"
                  checked={editingStaff.canUseBulkTools}
                  onCheckedChange={(checked) => setEditingStaff({ ...editingStaff, canUseBulkTools: checked })}
                  data-testid="switch-edit-can-use-bulk-tools"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canViewAnalytics" className="font-normal">
                  View Analytics
                </Label>
                <Switch
                  id="edit-canViewAnalytics"
                  checked={editingStaff.canViewAnalytics}
                  onCheckedChange={(checked) => setEditingStaff({ ...editingStaff, canViewAnalytics: checked })}
                  data-testid="switch-edit-can-view-analytics"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canViewPayouts" className="font-normal">
                  View Payouts
                </Label>
                <Switch
                  id="edit-canViewPayouts"
                  checked={editingStaff.canViewPayouts}
                  onCheckedChange={(checked) => setEditingStaff({ ...editingStaff, canViewPayouts: checked })}
                  data-testid="switch-edit-can-view-payouts"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-canManageOrders" className="font-normal">
                  Manage Orders
                </Label>
                <Switch
                  id="edit-canManageOrders"
                  checked={editingStaff.canManageOrders}
                  onCheckedChange={(checked) => setEditingStaff({ ...editingStaff, canManageOrders: checked })}
                  data-testid="switch-edit-can-manage-orders"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingStaff(null)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePermissions}
                disabled={updatePermissionsMutation.isPending}
                data-testid="button-confirm-edit"
              >
                {updatePermissionsMutation.isPending ? "Updating..." : "Update Permissions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Block/Unblock Dialog */}
      {blockingStaff && (
        <Dialog open={!!blockingStaff} onOpenChange={() => setBlockingStaff(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{blockingStaff.staffActive ? "Block" : "Unblock"} Staff Member</DialogTitle>
              <DialogDescription>
                {blockingStaff.staffActive
                  ? `Are you sure you want to block ${blockingStaff.user.name}? They will not be able to access the system.`
                  : `Are you sure you want to unblock ${blockingStaff.user.name}? They will be able to access the system again.`}
              </DialogDescription>
            </DialogHeader>

            {blockingStaff.staffActive && (
              <div className="space-y-2 py-4">
                <Label htmlFor="block-reason">Reason (optional)</Label>
                <Textarea
                  id="block-reason"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Enter reason for blocking this staff member"
                  data-testid="textarea-block-reason"
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockingStaff(null)} data-testid="button-cancel-block">
                Cancel
              </Button>
              <Button
                variant={blockingStaff.staffActive ? "destructive" : "default"}
                onClick={handleBlockStaff}
                disabled={blockStaffMutation.isPending}
                data-testid="button-confirm-block"
              >
                {blockStaffMutation.isPending
                  ? "Processing..."
                  : blockingStaff.staffActive
                    ? "Block Staff Member"
                    : "Unblock Staff Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
