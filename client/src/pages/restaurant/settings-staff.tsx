import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface StaffMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  staffActive: boolean;
  permissions: {
    canEditCategories: boolean;
    canEditItems: boolean;
    canToggleAvailability: boolean;
    canUseBulkTools: boolean;
    canViewAnalytics: boolean;
    canViewPayouts: boolean;
    canManageOrders: boolean;
  };
  lastLoginAt: string | null;
  createdAt: string;
}

const inviteStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone is required"),
  temporaryPassword: z.string().min(8, "Password must be at least 8 characters"),
  canEditCategories: z.boolean().default(false),
  canEditItems: z.boolean().default(false),
  canToggleAvailability: z.boolean().default(false),
  canUseBulkTools: z.boolean().default(false),
  canViewAnalytics: z.boolean().default(false),
  canViewPayouts: z.boolean().default(false),
  canManageOrders: z.boolean().default(false),
});

type InviteStaffFormValues = z.infer<typeof inviteStaffSchema>;

const editPermissionsSchema = z.object({
  canEditCategories: z.boolean(),
  canEditItems: z.boolean(),
  canToggleAvailability: z.boolean(),
  canUseBulkTools: z.boolean(),
  canViewAnalytics: z.boolean(),
  canViewPayouts: z.boolean(),
  canManageOrders: z.boolean(),
});

type EditPermissionsFormValues = z.infer<typeof editPermissionsSchema>;

export default function SettingsStaff() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Fetch staff members
  const { data: staffData, isLoading } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ["/api/restaurant/staff"],
  });

  const staffMembers = staffData?.staff || [];

  // Invite staff mutation
  const inviteForm = useForm<InviteStaffFormValues>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      temporaryPassword: "",
      canEditCategories: false,
      canEditItems: false,
      canToggleAvailability: false,
      canUseBulkTools: false,
      canViewAnalytics: false,
      canViewPayouts: false,
      canManageOrders: false,
    },
  });

  const inviteStaffMutation = useMutation({
    mutationFn: async (data: InviteStaffFormValues) => {
      const { canEditCategories, canEditItems, canToggleAvailability, canUseBulkTools, canViewAnalytics, canViewPayouts, canManageOrders, ...staffInfo } = data;
      const response = await apiRequest("POST", "/api/restaurant/staff", {
        ...staffInfo,
        permissions: {
          canEditCategories,
          canEditItems,
          canToggleAvailability,
          canUseBulkTools,
          canViewAnalytics,
          canViewPayouts,
          canManageOrders,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      toast({
        title: "Success",
        description: "Staff member invited successfully",
      });
      setInviteDialogOpen(false);
      inviteForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to invite staff member",
        variant: "destructive",
      });
    },
  });

  // Edit permissions form
  const editForm = useForm<EditPermissionsFormValues>({
    resolver: zodResolver(editPermissionsSchema),
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: EditPermissionsFormValues }) => {
      const response = await apiRequest("PATCH", `/api/restaurant/staff/${id}`, {
        permissions,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });
      setEditDialogOpen(false);
      setSelectedStaff(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update permissions",
        variant: "destructive",
      });
    },
  });

  // Toggle staff active status mutation
  const toggleStaffMutation = useMutation({
    mutationFn: async ({ id, staffActive }: { id: string; staffActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/restaurant/staff/${id}`, {
        staffActive,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      toast({
        title: "Success",
        description: variables.staffActive ? "Staff member activated" : "Staff member deactivated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff status",
        variant: "destructive",
      });
    },
  });

  // Delete (deactivate) staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/restaurant/staff/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/staff"] });
      toast({
        title: "Success",
        description: "Staff member deactivated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate staff member",
        variant: "destructive",
      });
    },
  });

  const handleInviteSubmit = (data: InviteStaffFormValues) => {
    inviteStaffMutation.mutate(data);
  };

  const handleEditPermissions = (staff: StaffMember) => {
    setSelectedStaff(staff);
    editForm.reset(staff.permissions);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (data: EditPermissionsFormValues) => {
    if (selectedStaff) {
      updatePermissionsMutation.mutate({ id: selectedStaff.id, permissions: data });
    }
  };

  const handleToggleActive = (staff: StaffMember) => {
    toggleStaffMutation.mutate({ id: staff.id, staffActive: !staff.staffActive });
  };

  const handleDelete = (staff: StaffMember) => {
    if (window.confirm(`Are you sure you want to deactivate ${staff.name}? They will lose access to the system.`)) {
      deleteStaffMutation.mutate(staff.id);
    }
  };

  const countActivePermissions = (permissions: StaffMember['permissions']) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-staff-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-staff-title">Staff & Roles</h1>
          <p className="text-muted-foreground" data-testid="text-staff-subtitle">
            Manage staff accounts and permissions for your restaurant
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-staff">
          <Plus className="h-4 w-4 mr-2" />
          Invite Staff
        </Button>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>
            {staffMembers.length} staff member{staffMembers.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading staff members...</div>
          ) : staffMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-staff">
              No staff members yet. Click "Invite Staff" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {staffMembers.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`staff-card-${staff.id}`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" data-testid={`text-staff-name-${staff.id}`}>{staff.name}</h3>
                      {staff.staffActive ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid={`badge-active-${staff.id}`}>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-inactive-${staff.id}`}>
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-staff-email-${staff.id}`}>{staff.email}</p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-staff-phone-${staff.id}`}>{staff.phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" data-testid={`badge-permissions-${staff.id}`}>
                        {countActivePermissions(staff.permissions)} permissions
                      </Badge>
                      {staff.lastLoginAt && (
                        <span className="text-xs text-muted-foreground">
                          Last login: {format(new Date(staff.lastLoginAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPermissions(staff)}
                      data-testid={`button-edit-${staff.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(staff)}
                      disabled={toggleStaffMutation.isPending}
                      data-testid={`button-toggle-${staff.id}`}
                    >
                      {staff.staffActive ? (
                        <><UserX className="h-4 w-4 mr-1" /> Deactivate</>
                      ) : (
                        <><UserCheck className="h-4 w-4 mr-1" /> Activate</>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(staff)}
                      disabled={deleteStaffMutation.isPending}
                      data-testid={`button-delete-${staff.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Staff Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-invite-staff">
          <DialogHeader>
            <DialogTitle>Invite New Staff Member</DialogTitle>
            <DialogDescription>
              Create a new staff account with custom permissions. They will receive a temporary password.
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit(handleInviteSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={inviteForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" data-testid="input-staff-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inviteForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1 555-0123" data-testid="input-staff-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="staff@restaurant.com" data-testid="input-staff-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteForm.control}
                name="temporaryPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="At least 8 characters" data-testid="input-staff-password" />
                    </FormControl>
                    <FormDescription>
                      Staff member will be asked to change this password after first login
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h3 className="font-semibold">Permissions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={inviteForm.control}
                    name="canManageOrders"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Manage Orders</FormLabel>
                          <FormDescription className="text-xs">
                            Accept, update, and track orders
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-manage-orders" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inviteForm.control}
                    name="canEditItems"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Edit Menu Items</FormLabel>
                          <FormDescription className="text-xs">
                            Create and modify menu items
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-edit-items" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inviteForm.control}
                    name="canEditCategories"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Edit Categories</FormLabel>
                          <FormDescription className="text-xs">
                            Manage menu categories
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-edit-categories" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inviteForm.control}
                    name="canToggleAvailability"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Toggle Availability</FormLabel>
                          <FormDescription className="text-xs">
                            Mark items as available/unavailable
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-toggle-availability" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inviteForm.control}
                    name="canUseBulkTools"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Use Bulk Tools</FormLabel>
                          <FormDescription className="text-xs">
                            Perform bulk price updates
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-use-bulk-tools" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inviteForm.control}
                    name="canViewAnalytics"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>View Analytics</FormLabel>
                          <FormDescription className="text-xs">
                            Access performance reports
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-view-analytics" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inviteForm.control}
                    name="canViewPayouts"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>View Payouts</FormLabel>
                          <FormDescription className="text-xs">
                            View earnings and payouts
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-can-view-payouts" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteStaffMutation.isPending} data-testid="button-submit-invite">
                  {inviteStaffMutation.isPending ? "Inviting..." : "Invite Staff Member"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-permissions">
          <DialogHeader>
            <DialogTitle>Edit Permissions: {selectedStaff?.name}</DialogTitle>
            <DialogDescription>
              Update staff member permissions. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="canManageOrders"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Manage Orders</FormLabel>
                        <FormDescription className="text-xs">
                          Accept, update, and track orders
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-manage-orders" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="canEditItems"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Edit Menu Items</FormLabel>
                        <FormDescription className="text-xs">
                          Create and modify menu items
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-edit-items" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="canEditCategories"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Edit Categories</FormLabel>
                        <FormDescription className="text-xs">
                          Manage menu categories
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-edit-categories" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="canToggleAvailability"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Toggle Availability</FormLabel>
                        <FormDescription className="text-xs">
                          Mark items as available/unavailable
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-toggle-availability" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="canUseBulkTools"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Use Bulk Tools</FormLabel>
                        <FormDescription className="text-xs">
                          Perform bulk price updates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-use-bulk-tools" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="canViewAnalytics"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>View Analytics</FormLabel>
                        <FormDescription className="text-xs">
                          Access performance reports
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-view-analytics" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="canViewPayouts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>View Payouts</FormLabel>
                        <FormDescription className="text-xs">
                          View earnings and payouts
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-can-view-payouts" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePermissionsMutation.isPending} data-testid="button-submit-edit">
                  {updatePermissionsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
