import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ScrollText, 
  Search, 
  Download, 
  Shield,
  CheckCircle,
  Calendar as CalendarIcon,
  Filter,
  Globe,
  User,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  description: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: any;
  createdAt: string;
  hashValid: boolean;
}

interface AuditResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ChainVerification {
  chainValid: boolean;
  verifiedEntries: number;
  brokenLinks: number;
  verificationTime: string;
  lastVerified: string;
}

export default function AuditConsole() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    actorId: "",
    actionType: "",
    entityType: "",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
  });
  const { toast } = useToast();

  const { data: auditLogs, isLoading } = useQuery<AuditResponse>({
    queryKey: ["/api/admin/phase3a/audit/full", {
      page,
      limit: 50,
      ...filters,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    }],
  });

  const { data: chainVerification } = useQuery<ChainVerification>({
    queryKey: ["/api/admin/phase3a/audit/verify-chain"],
  });

  const exportMutation = useMutation({
    mutationFn: async (format: string) => {
      return apiRequest(`/api/admin/phase3a/audit/export?format=${format}`, {
        method: "GET",
      });
    },
    onSuccess: () => {
      toast({ title: "Export Started", description: "Audit log export has been initiated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to export audit logs.", variant: "destructive" });
    },
  });

  const resetFilters = () => {
    setFilters({
      actorId: "",
      actionType: "",
      entityType: "",
      dateFrom: undefined,
      dateTo: undefined,
    });
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Full Audit Visibility Console</h1>
          <p className="text-muted-foreground">Complete admin action history with hash-chain validation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportMutation.mutate("json")} data-testid="button-export-json">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => exportMutation.mutate("csv")} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{auditLogs?.pagination.total || 0}</p>
              </div>
              <ScrollText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-chain">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chain Status</p>
                <Badge variant={chainVerification?.chainValid ? "default" : "destructive"}>
                  {chainVerification?.chainValid ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : null}
                  {chainVerification?.chainValid ? "Valid" : "Invalid"}
                </Badge>
              </div>
              <Shield className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-verified">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified Entries</p>
                <p className="text-2xl font-bold text-green-600">{chainVerification?.verifiedEntries || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-broken">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Broken Links</p>
                <p className="text-2xl font-bold text-red-600">{chainVerification?.brokenLinks || 0}</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Actor ID</label>
              <Input
                placeholder="User ID"
                value={filters.actorId}
                onChange={(e) => setFilters({ ...filters, actorId: e.target.value })}
                data-testid="input-actor-id"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select
                value={filters.actionType}
                onValueChange={(v) => setFilters({ ...filters, actionType: v })}
              >
                <SelectTrigger data-testid="select-action-type">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
                  <SelectItem value="SETTINGS_UPDATED">Settings Updated</SelectItem>
                  <SelectItem value="USER_BLOCKED">User Blocked</SelectItem>
                  <SelectItem value="DATA_EXPORTED">Data Exported</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {filters.dateFrom ? format(filters.dateFrom, "MMM dd") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(d) => setFilters({ ...filters, dateFrom: d })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {filters.dateTo ? format(filters.dateTo, "MMM dd") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(d) => setFilters({ ...filters, dateTo: d })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters} className="w-full" data-testid="button-reset-filters">
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log Entries</CardTitle>
          <CardDescription>
            Page {auditLogs?.pagination.page || 1} of {auditLogs?.pagination.totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs?.logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(log.createdAt), "MMM dd, HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{log.actorEmail || log.actorId?.slice(0, 8) || "System"}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{log.actorRole}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {log.actionType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.entityType}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {log.entityId?.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            {log.ipAddress || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {log.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.hashValid ? "default" : "destructive"} className="text-xs">
                            {log.hashValid ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : null}
                            {log.hashValid ? "Valid" : "Invalid"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {auditLogs?.logs.length || 0} of {auditLogs?.pagination.total || 0} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= (auditLogs?.pagination.totalPages || 1)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
