import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, AlertCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SupportTicket {
  id: string;
  ticketCode: string;
  serviceType: string;
  issueCategory: string;
  customerVisibleStatus: string;
  internalStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
  customer: {
    maskedName: string;
  };
}

const statusColors: Record<string, string> = {
  open: "bg-blue-500 dark:bg-blue-600",
  in_review: "bg-yellow-500 dark:bg-yellow-600",
  awaiting_customer: "bg-orange-500 dark:bg-orange-600",
  resolved: "bg-green-500 dark:bg-green-600",
  closed: "bg-gray-500 dark:bg-gray-600",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-500 dark:bg-gray-600",
  medium: "bg-blue-500 dark:bg-blue-600",
  high: "bg-orange-500 dark:bg-orange-600",
  urgent: "bg-red-500 dark:bg-red-600",
};

export default function RestaurantSupportTickets() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<{
    tickets: SupportTicket[];
    pagination: any;
  }>({
    queryKey: ["/api/admin/support/tickets", statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      
      const response = await fetch(`/api/admin/support/tickets?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      {error ? (
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Error Loading Tickets</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error ? error.message : "Failed to load support tickets"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Support Tickets
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage customer support requests for your food orders
        </p>
      </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select
                  value={priorityFilter}
                  onValueChange={setPriorityFilter}
                >
                  <SelectTrigger data-testid="select-priority-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.tickets.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center text-center gap-4">
                <MessageSquare className="h-16 w-16 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg">No Support Tickets</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    There are no support tickets matching your filters
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {data?.tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/admin/support-tickets/${ticket.id}`}
              >
                <Card
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  data-testid={`card-ticket-${ticket.id}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4">
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium" data-testid={`text-ticket-code-${ticket.id}`}>
                              {ticket.ticketCode}
                            </span>
                            <Badge
                              className={priorityColors[ticket.priority]}
                              data-testid={`badge-priority-${ticket.id}`}
                            >
                              {ticket.priority.toUpperCase()}
                            </Badge>
                            <Badge
                              className={statusColors[ticket.customerVisibleStatus]}
                              data-testid={`badge-status-${ticket.id}`}
                            >
                              {ticket.customerVisibleStatus.replace(/_/g, " ").toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Customer: {ticket.customer.maskedName}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          <span data-testid={`text-message-count-${ticket.id}`}>
                            {ticket._count.messages} {ticket._count.messages === 1 ? "message" : "messages"}
                          </span>
                        </div>
                      </div>

                      {/* Issue Info */}
                      <div>
                        <p className="text-sm font-medium">
                          Issue: {ticket.issueCategory.replace(/_/g, " ")}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            Created {new Date(ticket.createdAt).toLocaleDateString()} at{" "}
                            {new Date(ticket.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <p className="text-sm text-muted-foreground">
                Showing {data.tickets.length} of {data.pagination.total} tickets
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
