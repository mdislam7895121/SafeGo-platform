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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { MessageSquare, Search, Filter, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

type Ticket = {
  id: string;
  ticketCode: string;
  serviceType: string;
  issueCategory: string;
  internalStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customerIdentifier: string;
  restaurantName?: string;
  driverName?: string;
  country: string;
  _count: {
    messages: number;
  };
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  assigned: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  awaiting_restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  awaiting_customer: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  refund_proposed: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
};

export default function AdminSupportCenter() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const buildQueryParams = () => {
    const params: Record<string, string> = { page: page.toString(), limit: "20" };
    if (statusFilter !== "all") params.status = statusFilter;
    if (serviceTypeFilter !== "all") params.serviceType = serviceTypeFilter;
    if (priorityFilter !== "all") params.priority = priorityFilter;
    if (countryFilter !== "all") params.country = countryFilter;
    if (search) params.search = search;
    return new URLSearchParams(params).toString();
  };

  const { data, isLoading, refetch } = useQuery<{
    tickets: Ticket[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["/api/admin/support/tickets", buildQueryParams()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/support/tickets?${buildQueryParams()}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    }
  });

  const getServiceLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      food_order: "Food Order",
      ride: "Ride",
      delivery: "Parcel"
    };
    return labels[serviceType] || serviceType;
  };

  const getCategoryLabel = (category: string) => {
    return category.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Support Center</h1>
          <p className="text-muted-foreground mt-1">Manage all customer support tickets globally</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticket code, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-tickets"
              />
            </div>

            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger data-testid="select-service-type-filter">
                <SelectValue placeholder="Service Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="food_order">Food Orders</SelectItem>
                <SelectItem value="ride">Rides</SelectItem>
                <SelectItem value="delivery">Parcels</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="awaiting_restaurant">Awaiting Restaurant</SelectItem>
                <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                <SelectItem value="refund_proposed">Refund Proposed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger data-testid="select-priority-filter">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger data-testid="select-country-filter">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setServiceTypeFilter("all");
                setPriorityFilter("all");
                setCountryFilter("all");
                setSearch("");
                setPage(1);
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.tickets.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tickets.map((ticket) => (
                    <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-mono text-sm" data-testid={`text-ticket-code-${ticket.id}`}>
                            {ticket.ticketCode}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(ticket.createdAt), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-service-${ticket.id}`}>
                          {getServiceLabel(ticket.serviceType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" data-testid={`text-category-${ticket.id}`}>
                          {getCategoryLabel(ticket.issueCategory)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm" data-testid={`text-customer-${ticket.id}`}>
                          {ticket.customerIdentifier}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {ticket.restaurantName && (
                            <div data-testid={`text-restaurant-${ticket.id}`}>{ticket.restaurantName}</div>
                          )}
                          {ticket.driverName && (
                            <div data-testid={`text-driver-${ticket.id}`}>{ticket.driverName}</div>
                          )}
                          {!ticket.restaurantName && !ticket.driverName && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[ticket.internalStatus]} data-testid={`badge-status-${ticket.id}`}>
                          {getStatusLabel(ticket.internalStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[ticket.priority]} data-testid={`badge-priority-${ticket.id}`}>
                          {ticket.priority.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono" data-testid={`text-country-${ticket.id}`}>
                          {ticket.country}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" data-testid={`text-messages-${ticket.id}`}>
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{ticket._count.messages}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/support/${ticket.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${ticket.id}`}>
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total} tickets
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                      disabled={page >= data.pagination.totalPages}
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
  );
}
