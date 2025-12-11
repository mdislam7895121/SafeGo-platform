import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { FileText, AlertCircle, CheckCircle, RefreshCw, Loader2, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient, fetchAdminCapabilities } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReconciliationMismatch {
  walletId: string;
  ownerEmail: string;
  ownerType: string;
  expectedAmount: string;
  actualAmount: string;
  difference: string;
  reason: string;
}

interface ReconciliationReport {
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalExpectedPayouts: string;
  totalActualPayouts: string;
  mismatches: ReconciliationMismatch[];
  generatedAt: string;
}

export default function AdminPayoutsReports() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token, logout } = useAuth();
  
  const [periodStart, setPeriodStart] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 16));
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState("");

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
  const hasAccess = capabilities.includes("VIEW_PAYOUTS");
  const hasCapabilitiesError = !isLoadingCapabilities && capabilitiesError && (capabilitiesError as any)?.status !== 401;

  // Generate reconciliation report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      });

      if (ownerTypeFilter !== "all") {
        params.append("ownerType", ownerTypeFilter);
      }
      if (countryFilter) {
        params.append("countryCode", countryFilter.toUpperCase());
      }

      return await apiRequest(`/api/admin/payouts/reconciliation?${params.toString()}`, {
        method: "GET",
      });
    },
    onSuccess: (data: ReconciliationReport) => {
      toast({
        title: "Report generated",
        description: `Found ${data.mismatches.length} mismatches out of ${data.totalOrders} orders`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Report generation failed",
        description: error.message || "Failed to generate reconciliation report",
        variant: "destructive",
      });
    },
  });

  const report = generateReportMutation.data;

  const handleGenerateReport = () => {
    if (!hasAccess) {
      toast({
        title: "Access denied",
        description: "You don't have permission to view reconciliation reports",
        variant: "destructive",
      });
      return;
    }

    if (!periodStart || !periodEnd) {
      toast({
        title: "Invalid period",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    generateReportMutation.mutate();
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
              You don't have permission to view reconciliation reports. Please contact your administrator.
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
      <PageHeader
        title="Reconciliation Reports"
        description="Verify payout accuracy and detect mismatches"
        icon={DollarSign}
        backButton={{ label: "Back to Payouts", href: "/admin/payouts" }}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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

        {/* Report Generator */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Reconciliation Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="datetime-local"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  data-testid="input-period-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="datetime-local"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  data-testid="input-period-end"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ownerType">Account Type</Label>
                <Select value={ownerTypeFilter} onValueChange={setOwnerTypeFilter}>
                  <SelectTrigger id="ownerType" data-testid="select-owner-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="driver">Drivers</SelectItem>
                    <SelectItem value="restaurant">Restaurants</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="countryCode">Country Filter (Optional)</Label>
                <Input
                  id="countryCode"
                  placeholder="e.g., BD, US, UK"
                  maxLength={2}
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value.toUpperCase())}
                  data-testid="input-country-code"
                />
              </div>
            </div>

            <Button
              onClick={handleGenerateReport}
              disabled={generateReportMutation.isPending}
              className="w-full gap-2"
              data-testid="button-generate-report"
            >
              <RefreshCw className={`h-4 w-4 ${generateReportMutation.isPending ? "animate-spin" : ""}`} />
              {generateReportMutation.isPending ? "Generating..." : "Generate Report"}
            </Button>
          </CardContent>
        </Card>

        {/* Report Results */}
        {report && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                      <p className="text-2xl font-bold">{report.totalOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      report.mismatches.length === 0
                        ? "bg-green-100 dark:bg-green-900"
                        : "bg-yellow-100 dark:bg-yellow-900"
                    }`}>
                      {report.mismatches.length === 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mismatches</p>
                      <p className="text-2xl font-bold">{report.mismatches.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Report Period</p>
                    <p className="text-xs">
                      {format(new Date(report.periodStart), "MMM d, yyyy HH:mm")}
                    </p>
                    <p className="text-xs">to</p>
                    <p className="text-xs">
                      {format(new Date(report.periodEnd), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payout Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Payout Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Expected Total</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(report.totalExpectedPayouts).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Actual Total</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(report.totalActualPayouts).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mismatches */}
            {report.mismatches.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    Detected Mismatches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.mismatches.map((mismatch, index) => (
                      <Card
                        key={index}
                        className="border-yellow-200 dark:border-yellow-800"
                        data-testid={`mismatch-card-${index}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-semibold">{mismatch.ownerEmail}</p>
                                <Badge className={mismatch.ownerType === "driver" ? "bg-purple-500" : "bg-orange-500"}>
                                  {mismatch.ownerType === "driver" ? "Driver" : "Restaurant"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                Wallet ID: {mismatch.walletId}
                              </p>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Expected</p>
                                  <p className="font-semibold">
                                    ${parseFloat(mismatch.expectedAmount).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Actual</p>
                                  <p className="font-semibold">
                                    ${parseFloat(mismatch.actualAmount).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Difference</p>
                                  <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                                    ${parseFloat(mismatch.difference).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              {mismatch.reason && (
                                <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-sm">
                                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">Reason:</p>
                                  <p className="text-yellow-700 dark:text-yellow-300">{mismatch.reason}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8">
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
                    <p className="text-muted-foreground">
                      No mismatches detected. All payouts are reconciled correctly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* No Report Yet */}
        {!report && !generateReportMutation.isPending && (
          <Card>
            <CardContent className="p-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">No Report Generated</p>
                <p className="text-sm">
                  Select a date range and click "Generate Report" to view reconciliation data
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
