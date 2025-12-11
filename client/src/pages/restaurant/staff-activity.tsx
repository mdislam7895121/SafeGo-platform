import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowLeft, Calendar, User, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  action: string;
  actionType: string;
  actorId: string;
  targetId: string | null;
  targetType: string | null;
  metadata: any;
  createdAt: string;
}

interface StaffMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function StaffActivityLogPage() {
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(undefined);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const { data: staffData } = useQuery<{ staff: StaffMember[] }>({
    queryKey: queryKeys.restaurant.staff.list,
  });

  const queryParams = new URLSearchParams();
  queryParams.append("limit", limit.toString());
  queryParams.append("offset", offset.toString());
  if (selectedStaffId) {
    queryParams.append("staffId", selectedStaffId);
  }

  const { data, isLoading } = useQuery<{
    logs: AuditLog[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }>({
    queryKey: [...queryKeys.restaurant.staff.activity, limit, offset, selectedStaffId],
    enabled: true,
  });

  const staff = staffData?.staff || [];
  const logs = data?.logs || [];
  const pagination = data?.pagination;

  const getActionBadgeVariant = (actionType: string) => {
    if (actionType.includes("CREATE")) return "default";
    if (actionType.includes("UPDATE")) return "secondary";
    if (actionType.includes("DELETE")) return "destructive";
    return "outline";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading && !data) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild data-testid="button-back">
          <Link href="/restaurant/staff">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Staff Activity Log</h1>
          <p className="text-muted-foreground mt-1">View actions performed by your staff members</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Filter activity logs by staff member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select
                value={selectedStaffId || "all"}
                onValueChange={(value) => {
                  setSelectedStaffId(value === "all" ? undefined : value);
                  setOffset(0);
                }}
              >
                <SelectTrigger data-testid="select-staff-filter">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff members</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-muted-foreground text-center">
              {selectedStaffId
                ? "This staff member hasn't performed any actions yet"
                : "Your staff members haven't performed any actions yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {logs.map((log) => {
              const staffMember = staff.find((s) => s.user.id === log.actorId);
              return (
                <Card key={log.id} data-testid={`card-log-${log.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionBadgeVariant(log.actionType)}>{log.actionType}</Badge>
                          {staffMember && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <User className="w-3 h-3 mr-1" />
                              <span data-testid={`text-actor-${log.id}`}>{staffMember.user.name}</span>
                            </div>
                          )}
                        </div>

                        <p className="text-sm" data-testid={`text-action-${log.id}`}>
                          {log.action}
                        </p>

                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="bg-muted rounded-md p-3 mt-2">
                            <p className="text-xs font-medium mb-1">Details:</p>
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground ml-4">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span data-testid={`text-date-${log.id}`}>{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {pagination && pagination.total > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
                    {pagination.total} logs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(offset + limit)}
                      disabled={!pagination.hasMore}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
