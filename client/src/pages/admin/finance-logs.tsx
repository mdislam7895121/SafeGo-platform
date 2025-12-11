import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  RefreshCw,
  Shield,
  Loader2,
  Eye,
  Lock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Settings,
  Ban,
  ShieldCheck,
} from "lucide-react";

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  targetUserId: string;
  targetUserType: string;
  targetUserName: string;
  beforeValue: any;
  afterValue: any;
  changeAmount: number;
  currency: string;
  description: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  countryCode: string;
  hashChain: string;
  isVerified: boolean;
  createdAt: string;
}

interface VerifyResult {
  verified: boolean;
  totalLogs: number;
  issues: string[];
  message: string;
}

export default function FinanceLogs() {
  const { toast } = useToast();
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);

  const buildQueryParams = () => {
    const params: Record<string, string> = { page: page.toString(), limit: "50" };
    if (actionFilter !== "all") params.actionType = actionFilter;
    if (resourceFilter !== "all") params.resourceType = resourceFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  };

  const { data: logsData, isLoading, refetch } = useQuery<{ logs: AuditLog[]; total: number; totalPages: number }>({
    queryKey: ["/api/settlement-finance/audit-logs", buildQueryParams()],
  });

  const { data: verifyResult, isLoading: verifyLoading, refetch: verifyLogs } = useQuery<VerifyResult>({
    queryKey: ["/api/settlement-finance/audit-logs/verify"],
    enabled: false,
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatCurrency = (amount: number, currency = "BDT") => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-BD", { style: "currency", currency }).format(amount);
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      settlement_created: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      settlement_adjusted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      settlement_completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      payout_initiated: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      payout_approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      payout_rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      payout_completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      threshold_change: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      balance_adjustment: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      manual_override: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      restriction_applied: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      restriction_removed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    const icons: Record<string, any> = {
      settlement_created: FileText,
      settlement_adjusted: Settings,
      settlement_completed: CheckCircle,
      payout_initiated: DollarSign,
      payout_approved: CheckCircle,
      payout_rejected: Ban,
      payout_completed: CheckCircle,
      threshold_change: Settings,
      balance_adjustment: DollarSign,
      manual_override: Settings,
      restriction_applied: Ban,
      restriction_removed: ShieldCheck,
    };
    const Icon = icons[action] || FileText;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${colors[action] || "bg-gray-100 text-gray-800"}`}>
        <Icon className="h-3 w-3" />
        {action.replace(/_/g, " ")}
      </span>
    );
  };

  const getResourceBadge = (resource: string) => {
    const colors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      settlement: "default",
      payout: "secondary",
      driver_balance: "outline",
      restaurant_balance: "outline",
      threshold: "secondary",
    };
    return <Badge variant={colors[resource] || "outline"}>{resource.replace(/_/g, " ")}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Finance Audit Logs</h1>
          <p className="text-muted-foreground">Immutable Finance Audit Trail (Task 28)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => verifyLogs()}
            disabled={verifyLoading}
            data-testid="button-verify"
          >
            {verifyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Verify Integrity
          </Button>
        </div>
      </div>

      {verifyResult && (
        <Card className={verifyResult.verified ? "border-green-500" : "border-destructive"}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {verifyResult.verified ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              <CardTitle className="text-lg">Integrity Verification</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={verifyResult.verified ? "text-green-600" : "text-destructive"}>
              {verifyResult.message}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {verifyResult.totalLogs} logs verified
            </p>
            {verifyResult.issues.length > 0 && (
              <ul className="mt-2 text-sm text-destructive">
                {verifyResult.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>All financial operations are logged here and cannot be modified or deleted</CardDescription>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Immutable Records
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-44" data-testid="select-action-filter">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="settlement_created">Settlement Created</SelectItem>
                <SelectItem value="settlement_adjusted">Settlement Adjusted</SelectItem>
                <SelectItem value="settlement_completed">Settlement Completed</SelectItem>
                <SelectItem value="payout_approved">Payout Approved</SelectItem>
                <SelectItem value="payout_rejected">Payout Rejected</SelectItem>
                <SelectItem value="payout_completed">Payout Completed</SelectItem>
                <SelectItem value="threshold_change">Threshold Change</SelectItem>
                <SelectItem value="balance_adjustment">Balance Adjustment</SelectItem>
                <SelectItem value="restriction_applied">Restriction Applied</SelectItem>
                <SelectItem value="restriction_removed">Restriction Removed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-40" data-testid="select-resource-filter">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="settlement">Settlement</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="driver_balance">Driver Balance</SelectItem>
                <SelectItem value="restaurant_balance">Restaurant Balance</SelectItem>
                <SelectItem value="threshold">Threshold</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
              data-testid="input-start-date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
              data-testid="input-end-date"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData?.logs?.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{log.adminEmail || log.adminId.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{log.adminRole}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.actionType)}</TableCell>
                      <TableCell>{getResourceBadge(log.resourceType)}</TableCell>
                      <TableCell>
                        {log.targetUserId ? (
                          <div className="text-sm">
                            <div className="font-mono">{log.targetUserId.slice(0, 8)}...</div>
                            <div className="text-xs text-muted-foreground">{log.targetUserType}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {log.changeAmount ? (
                          <span className={Number(log.changeAmount) > 0 ? "text-green-600" : "text-destructive"}>
                            {Number(log.changeAmount) > 0 ? "+" : ""}
                            {formatCurrency(Number(log.changeAmount), log.currency)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 truncate" title={log.description}>
                        {log.description}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLog(log)}
                              data-testid={`button-view-${log.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Audit Log Details</DialogTitle>
                              <DialogDescription>
                                Log ID: {log.id}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Timestamp:</span>
                                  <p className="text-muted-foreground">{formatDate(log.createdAt)}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Admin:</span>
                                  <p className="text-muted-foreground">{log.adminEmail || log.adminId}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Action:</span>
                                  <p>{getActionBadge(log.actionType)}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Resource:</span>
                                  <p>{getResourceBadge(log.resourceType)}</p>
                                </div>
                                <div>
                                  <span className="font-medium">IP Address:</span>
                                  <p className="font-mono text-muted-foreground">{log.ipAddress || "-"}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Country:</span>
                                  <p className="text-muted-foreground">{log.countryCode || "-"}</p>
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Description:</span>
                                <p className="text-muted-foreground">{log.description}</p>
                              </div>
                              {log.reason && (
                                <div>
                                  <span className="font-medium">Reason:</span>
                                  <p className="text-muted-foreground">{log.reason}</p>
                                </div>
                              )}
                              {log.beforeValue && (
                                <div>
                                  <span className="font-medium">Before Value:</span>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.beforeValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.afterValue && (
                                <div>
                                  <span className="font-medium">After Value:</span>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.afterValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              <div className="border-t pt-4">
                                <div className="flex items-center gap-2">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">Hash Chain:</span>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground break-all mt-1">
                                  {log.hashChain || "Not available"}
                                </p>
                                <div className="flex items-center gap-1 mt-2">
                                  {log.isVerified ? (
                                    <>
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                      <span className="text-sm text-green-600">Verified</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                      <span className="text-sm text-destructive">Verification pending</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!logsData?.logs || logsData.logs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {logsData && logsData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {logsData.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(logsData.totalPages, page + 1))}
                    disabled={page === logsData.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
