import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Search, Plus, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type Ticket = {
  id: string;
  ticketCode: string;
  serviceType: string;
  issueCategory: string;
  customerVisibleStatus: string;
  priority: string;
  createdAt: string;
  _count: {
    messages: number;
  };
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  awaiting_customer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
};

export default function MySupportTickets() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ tickets: Ticket[] }>({
    queryKey: ["/api/customer/support/tickets/my", { status: statusFilter !== "all" ? statusFilter : undefined, service: serviceFilter !== "all" ? serviceFilter : undefined }]
  });

  const filteredTickets = data?.tickets.filter(ticket => {
    if (search && !ticket.ticketCode.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  }) || [];

  const getServiceLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      food_order: "Food Order",
      ride: "Ride",
      delivery: "Parcel Delivery"
    };
    return labels[serviceType] || serviceType;
  };

  const getCategoryLabel = (category: string) => {
    return category.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">My Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Track and manage your support requests</p>
        </div>
        <Link href="/customer/create-support-ticket">
          <Button data-testid="button-create-ticket">
            <Plus className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ticket code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-tickets"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="awaiting_customer">Awaiting Response</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger data-testid="select-service-filter">
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="food_order">Food Orders</SelectItem>
                <SelectItem value="ride">Rides</SelectItem>
                <SelectItem value="delivery">Parcel Deliveries</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-tickets">No support tickets found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {search || statusFilter !== "all" || serviceFilter !== "all"
                ? "Try adjusting your filters"
                : "You haven't created any support tickets yet"}
            </p>
            <Link href="/customer/create-support-ticket">
              <Button data-testid="button-create-first-ticket">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <Link key={ticket.id} href={`/customer/support-tickets/${ticket.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-ticket-${ticket.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg" data-testid={`text-ticket-code-${ticket.id}`}>
                          {ticket.ticketCode}
                        </CardTitle>
                        <Badge className={priorityColors[ticket.priority]} data-testid={`badge-priority-${ticket.id}`}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span data-testid={`text-service-type-${ticket.id}`}>{getServiceLabel(ticket.serviceType)}</span>
                        <span>•</span>
                        <span data-testid={`text-category-${ticket.id}`}>{getCategoryLabel(ticket.issueCategory)}</span>
                      </div>
                    </div>
                    <Badge className={statusColors[ticket.customerVisibleStatus]} data-testid={`badge-status-${ticket.id}`}>
                      {ticket.customerVisibleStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span data-testid={`text-created-date-${ticket.id}`}>
                          {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span data-testid={`text-message-count-${ticket.id}`}>
                          {ticket._count.messages} {ticket._count.messages === 1 ? "message" : "messages"}
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
    </div>
  );
}
