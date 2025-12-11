import { useState } from "react";
import { Bell, CheckCircle, XCircle, Search as SearchIcon, Filter, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";

interface NotificationLog {
  id: string;
  createdAt: string;
  partnerType: string;
  partnerApplicationId: string;
  toEmail: string;
  subject: string;
  templateName: string;
  statusTrigger: string;
  previousStatus?: string;
  success: boolean;
  errorMessage?: string;
  region: string;
  country: string;
}

interface LogsResponse {
  logs: NotificationLog[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  DRIVER: "Driver/Courier",
  RESTAURANT: "Restaurant",
  SHOP: "Shop",
  TICKET: "Ticket Partner",
};

export default function NotificationLogsPage() {
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<string>("all");
  const [successFilter, setSuccessFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (partnerTypeFilter !== "all") params.append("partnerType", partnerTypeFilter);
    if (successFilter !== "all") params.append("success", successFilter);
    params.append("page", page.toString());
    params.append("limit", "20");
    return params.toString();
  };

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey: ['/api/partner-onboarding/notifications/logs', partnerTypeFilter, successFilter, page],
    queryFn: async () => {
      const response = await fetch(`/api/partner-onboarding/notifications/logs?${buildQueryParams()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch notification logs');
      return response.json();
    }
  });

  const handleRefresh = () => {
    refetch();
  };

  const logs = data?.logs || [];
  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Notification Logs"
        description="View all partner onboarding email notifications sent by the system"
        icon={Bell}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Sent</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="stat-total">{data?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Successful</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="stat-successful">
              {logs.filter(l => l.success).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Failed</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="stat-failed">
              {logs.filter(l => !l.success).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Page</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="stat-page">{page} / {totalPages}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Notification History</CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} data-testid="button-refresh">
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Select value={partnerTypeFilter} onValueChange={(v) => { setPartnerTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-partner-type">
                <SelectValue placeholder="Partner Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partner Types</SelectItem>
                <SelectItem value="DRIVER">Driver/Courier</SelectItem>
                <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                <SelectItem value="SHOP">Shop</SelectItem>
                <SelectItem value="TICKET">Ticket Partner</SelectItem>
              </SelectContent>
            </Select>
            <Select value={successFilter} onValueChange={(v) => { setSuccessFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-success">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="true">Successful</SelectItem>
                <SelectItem value="false">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notification logs found
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Partner Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status Trigger</TableHead>
                    <TableHead>Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-notification-${log.id}`}>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm">{format(new Date(log.createdAt), "MMM d, yyyy")}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{PARTNER_TYPE_LABELS[log.partnerType] || log.partnerType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[200px] truncate">{log.toEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[250px] truncate" title={log.subject}>{log.subject}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {log.previousStatus && <span className="text-muted-foreground">{log.previousStatus} → </span>}
                          <span className="font-medium">{log.statusTrigger}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" /> Sent
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Failed
                          </Badge>
                        )}
                        {log.errorMessage && (
                          <div className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
