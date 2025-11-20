import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bell, CheckCheck, Filter, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AdminNotification {
  id: string;
  type: string;
  severity: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string | null;
  countryCode: string | null;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminNotifications() {
  const { toast } = useToast();
  
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    type: "",
    severity: "",
    isRead: "",
    countryCode: "",
    entityType: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Construct query string from filters
  const queryString = new URLSearchParams({
    page: page.toString(),
    pageSize: "20",
    ...(filters.type && { type: filters.type }),
    ...(filters.severity && { severity: filters.severity }),
    ...(filters.isRead && { isRead: filters.isRead }),
    ...(filters.countryCode && { countryCode: filters.countryCode }),
    ...(filters.entityType && { entityType: filters.entityType }),
  }).toString();

  // Fetch notifications
  const { data, isLoading } = useQuery<{
    notifications: AdminNotification[];
    pagination: PaginationInfo;
  }>({
    queryKey: ["/api/admin/notifications", queryString],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/notifications/${id}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread-count"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/notifications/read-all", {
        method: "PATCH",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Marked ${data.count} notifications as read`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread-count"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({
      type: "",
      severity: "",
      isRead: "",
      countryCode: "",
      entityType: "",
    });
    setPage(1);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500 dark:bg-red-900 text-white";
      case "warning":
        return "bg-yellow-500 dark:bg-yellow-900 text-white";
      case "info":
        return "bg-blue-500 dark:bg-blue-900 text-white";
      default:
        return "bg-gray-500 dark:bg-gray-700 text-white";
    }
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Notification Center</h1>
              <p className="text-sm opacity-90">System alerts and notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  {showFilters ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Severity</label>
                  <Select
                    value={filters.severity}
                    onValueChange={(v) => handleFilterChange("severity", v)}
                  >
                    <SelectTrigger data-testid="select-severity">
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select
                    value={filters.isRead}
                    onValueChange={(v) => handleFilterChange("isRead", v)}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="All notifications" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All notifications</SelectItem>
                      <SelectItem value="false">Unread only</SelectItem>
                      <SelectItem value="true">Read only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Country</label>
                  <Select
                    value={filters.countryCode}
                    onValueChange={(v) => handleFilterChange("countryCode", v)}
                  >
                    <SelectTrigger data-testid="select-country">
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All countries</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Entity Type</label>
                  <Select
                    value={filters.entityType}
                    onValueChange={(v) => handleFilterChange("entityType", v)}
                  >
                    <SelectTrigger data-testid="select-entity-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="parcel">Parcel</SelectItem>
                      <SelectItem value="kyc">KYC</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="wallet">Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {data ? `${data.pagination.total} Notifications` : "Notifications"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : !data || data.notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notifications found</p>
              </div>
            ) : (
              <>
                {data.notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`${
                      !notification.isRead
                        ? "border-l-4 border-l-primary bg-accent/30"
                        : ""
                    } hover-elevate cursor-pointer`}
                    onClick={() => {
                      if (!notification.isRead) {
                        markAsReadMutation.mutate(notification.id);
                      }
                    }}
                    data-testid={`notification-${notification.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getSeverityColor(notification.severity)}>
                              {notification.severity}
                            </Badge>
                            {notification.countryCode && (
                              <Badge variant="outline">{notification.countryCode}</Badge>
                            )}
                            <Badge variant="outline">{notification.entityType}</Badge>
                            {!notification.isRead && (
                              <Badge variant="default" className="bg-primary">
                                New
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold mb-1">{notification.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                            {notification.actorEmail && (
                              <span>By: {notification.actorEmail}</span>
                            )}
                          </div>
                        </div>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsReadMutation.mutate(notification.id);
                            }}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                        disabled={page === data.pagination.totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
