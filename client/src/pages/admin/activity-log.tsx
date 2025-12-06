import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Shield, CheckCircle, XCircle, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: any;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminActivityLog() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [successFilter, setSuccessFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("actorEmail", searchQuery);
  if (actionTypeFilter !== "all") queryParams.append("actionType", actionTypeFilter);
  if (entityTypeFilter !== "all") queryParams.append("entityType", entityTypeFilter);
  if (successFilter !== "all") queryParams.append("success", successFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("pageSize", "50");

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/audit-logs${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: [fullUrl],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page on filter change
  };

  const formatActionType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getSuccessBadge = (success: boolean) => {
    if (success) {
      return (
        <Badge variant="default" className="bg-green-600" data-testid="badge-success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" data-testid="badge-failed">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  };

  const getActionTypeBadge = (type: string) => {
    if (type.includes("LOGIN")) {
      return <Badge variant="outline" data-testid={`badge-action-${type}`}>Authentication</Badge>;
    }
    if (type.includes("APPROVED") || type.includes("REJECTED")) {
      return <Badge variant="secondary" data-testid={`badge-action-${type}`}>KYC</Badge>;
    }
    if (type.includes("BLOCKED") || type.includes("UNBLOCKED")) {
      return <Badge className="bg-orange-600" data-testid={`badge-action-${type}`}>Account Status</Badge>;
    }
    if (type.includes("DOCUMENT")) {
      return <Badge variant="outline" data-testid={`badge-action-${type}`}>Documents</Badge>;
    }
    if (type.includes("SETTLEMENT")) {
      return <Badge className="bg-blue-600" data-testid={`badge-action-${type}`}>Financial</Badge>;
    }
    return <Badge variant="outline" data-testid={`badge-action-${type}`}>Other</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Admin Activity Log</h1>
              <p className="text-[11px] text-muted-foreground">Security and compliance audit trail</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by admin email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        {/* Filters */}
        <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            value={actionTypeFilter}
            onValueChange={(value) => {
              setActionTypeFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger data-testid="select-action-type">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="ADMIN_LOGIN_SUCCESS">Login Success</SelectItem>
              <SelectItem value="ADMIN_LOGIN_FAILED">Login Failed</SelectItem>
              <SelectItem value="DRIVER_KYC_APPROVED">Driver KYC Approved</SelectItem>
              <SelectItem value="DRIVER_KYC_REJECTED">Driver KYC Rejected</SelectItem>
              <SelectItem value="CUSTOMER_KYC_APPROVED">Customer KYC Approved</SelectItem>
              <SelectItem value="CUSTOMER_KYC_REJECTED">Customer KYC Rejected</SelectItem>
              <SelectItem value="RESTAURANT_KYC_APPROVED">Restaurant KYC Approved</SelectItem>
              <SelectItem value="RESTAURANT_KYC_REJECTED">Restaurant KYC Rejected</SelectItem>
              <SelectItem value="DRIVER_BLOCKED">Driver Blocked</SelectItem>
              <SelectItem value="DRIVER_UNBLOCKED">Driver Unblocked</SelectItem>
              <SelectItem value="CUSTOMER_BLOCKED">Customer Blocked</SelectItem>
              <SelectItem value="CUSTOMER_UNBLOCKED">Customer Unblocked</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={entityTypeFilter}
            onValueChange={(value) => {
              setEntityTypeFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger data-testid="select-entity-type">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="DRIVER">Driver</SelectItem>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
              <SelectItem value="RESTAURANT">Restaurant</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={successFilter}
            onValueChange={(value) => {
              setSuccessFilter(value);
              handleFilterChange();
            }}
          >
            <SelectTrigger data-testid="select-success">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="true">Success Only</SelectItem>
              <SelectItem value="false">Failed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>

        {/* Results Summary */}
        {data && !isLoading && (
          <p className="text-sm text-muted-foreground" data-testid="text-results-summary">
            Showing {data.logs.length} of {data.pagination.total} audit events
          </p>
        )}

        {/* Audit Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : data && data.logs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{log.actorEmail}</span>
                            <Badge variant="outline" className="w-fit text-xs">
                              {log.actorRole}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getActionTypeBadge(log.actionType)}
                            <span className="text-xs text-muted-foreground">
                              {formatActionType(log.actionType)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{log.entityType}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {log.description}
                          </p>
                        </TableCell>
                        <TableCell>{getSuccessBadge(log.success)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ipAddress || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Activity Logged</h3>
                <p className="text-sm text-muted-foreground">
                  No admin activity has been recorded yet, or no results match your filters.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-previous-page"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground" data-testid="text-page-info">
              Page {currentPage} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={currentPage === data.pagination.totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
