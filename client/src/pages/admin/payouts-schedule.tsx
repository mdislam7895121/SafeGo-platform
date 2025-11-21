import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, Clock, Play, Pause, Plus, Trash2, Edit, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient, fetchAdminCapabilities } from "@/lib/queryClient";
import { format } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface SchedulePayoutForm {
  ownerType?: "driver" | "restaurant";
  countryCode?: string;
  minAmount?: number;
  periodStart: string;
  periodEnd: string;
}

export default function AdminPayoutsSchedule() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token, logout } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SchedulePayoutForm>({
    periodStart: new Date().toISOString().slice(0, 16),
    periodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  });

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

  // Schedule payout mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: SchedulePayoutForm) => {
      const res = await apiRequest("POST", "/api/admin/payouts/schedule", data);
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Payouts scheduled",
        description: `Scheduled ${result.totalPayouts} payouts totaling ${result.totalAmount}`,
      });
      setCreateDialogOpen(false);
      setFormData({
        periodStart: new Date().toISOString().slice(0, 16),
        periodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling failed",
        description: error.message || "Failed to schedule payouts",
        variant: "destructive",
      });
    },
  });

  const handleSchedule = () => {
    if (!hasAccess) {
      toast({
        title: "Access denied",
        description: "You don't have permission to schedule payouts",
        variant: "destructive",
      });
      return;
    }

    scheduleMutation.mutate(formData);
  };

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
              You don't have permission to schedule payouts. Please contact your administrator.
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
            <h1 className="text-2xl font-bold">Scheduled Payouts</h1>
            <p className="text-sm opacity-90">Configure and manage automatic payout schedules</p>
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

        {/* Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">About Scheduled Payouts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Schedule automatic batch payouts for drivers and restaurants based on time periods, 
                  minimum balance thresholds, and country filters. The system will process eligible 
                  wallets and create payout batches automatically.
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  data-testid="button-create-schedule"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Schedule New Payout Batch
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Schedules */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Scheduling History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Scheduled payout batches will appear here. Use the button above to create your first schedule.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Schedule Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-schedule">
          <DialogHeader>
            <DialogTitle>Schedule Automatic Payouts</DialogTitle>
            <DialogDescription>
              Configure a batch payout for eligible wallets within the specified time period
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ownerType">Target Accounts</Label>
                <Select
                  value={formData.ownerType || "all"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      ownerType: value === "all" ? undefined : (value as "driver" | "restaurant"),
                    })
                  }
                >
                  <SelectTrigger id="ownerType" data-testid="select-owner-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All (Drivers & Restaurants)</SelectItem>
                    <SelectItem value="driver">Drivers Only</SelectItem>
                    <SelectItem value="restaurant">Restaurants Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="countryCode">Country Filter (Optional)</Label>
                <Input
                  id="countryCode"
                  placeholder="e.g., BD, US, UK"
                  maxLength={2}
                  value={formData.countryCode || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      countryCode: e.target.value.toUpperCase() || undefined,
                    })
                  }
                  data-testid="input-country-code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minAmount">Minimum Balance Threshold (Optional)</Label>
              <Input
                id="minAmount"
                type="number"
                placeholder="e.g., 50.00"
                min="0"
                step="0.01"
                value={formData.minAmount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                data-testid="input-min-amount"
              />
              <p className="text-xs text-muted-foreground">
                Only process wallets with balance greater than or equal to this amount
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="datetime-local"
                  value={formData.periodStart}
                  onChange={(e) =>
                    setFormData({ ...formData, periodStart: e.target.value })
                  }
                  data-testid="input-period-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="datetime-local"
                  value={formData.periodEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, periodEnd: e.target.value })
                  }
                  data-testid="input-period-end"
                />
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> This will create a payout batch for all eligible wallets 
                matching your criteria. Ensure your filters are correct before proceeding.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel-schedule"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={scheduleMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Payouts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
