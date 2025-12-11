import { useState } from "react";
import { useLocation } from "wouter";
import { Ticket, Eye, Clock, Search as SearchIcon, CheckCircle, XCircle, Clock4, Filter } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";

interface TicketApplication {
  id: string;
  createdAt: string;
  status: string;
  city: string;
  country: string;
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
  ticketType: string;
}

interface ApplicationsResponse {
  applications: TicketApplication[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    new: number;
    in_review: number;
    approved: number;
    rejected: number;
  };
}

const STATUS_CONFIG = {
  new: { label: "New", variant: "default" as const, icon: Clock4 },
  in_review: { label: "In Review", variant: "secondary" as const, icon: Clock },
  approved: { label: "Approved", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle }
};

function StatsCards({ stats }: { stats: { new: number; in_review: number; approved: number; rejected: number } }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock4 className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">New</span>
          </div>
          <p className="text-2xl font-bold mt-1" data-testid="stat-new">{stats.new}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">In Review</span>
          </div>
          <p className="text-2xl font-bold mt-1" data-testid="stat-in-review">{stats.in_review}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Approved</span>
          </div>
          <p className="text-2xl font-bold mt-1" data-testid="stat-approved">{stats.approved}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Rejected</span>
          </div>
          <p className="text-2xl font-bold mt-1" data-testid="stat-rejected">{stats.rejected}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOnboardingTickets() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (cityFilter.trim()) queryParams.append("city", cityFilter.trim());
  if (searchQuery.trim()) queryParams.append("search", searchQuery.trim());
  if (ticketTypeFilter !== "all") queryParams.append("ticketType", ticketTypeFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/partner-onboarding/tickets${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<ApplicationsResponse>({
    queryKey: ['/api/partner-onboarding/tickets', statusFilter, cityFilter, searchQuery, ticketTypeFilter, currentPage],
    queryFn: async () => {
      const response = await fetch(fullUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets Onboarding"
        description="Manage ticket partner applications (Bangladesh only)"
        icon={<Ticket className="h-6 w-6" />}
      />

      {data?.stats && <StatsCards stats={data.stats} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ticketTypeFilter} onValueChange={(v) => { setTicketTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger data-testid="select-ticket-type">
                <SelectValue placeholder="Ticket Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bus">Bus</SelectItem>
                <SelectItem value="train">Train</SelectItem>
                <SelectItem value="launch">Launch/Ferry</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
              data-testid="input-city"
            />

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or phone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.applications?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No ticket partner applications found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Ticket Type</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.applications.map((app) => {
                  const statusConfig = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={app.id} data-testid={`row-ticket-${app.id}`}>
                      <TableCell className="font-medium">{app.businessName}</TableCell>
                      <TableCell>{app.contactPerson}</TableCell>
                      <TableCell>{app.phoneNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{app.ticketType}</Badge>
                      </TableCell>
                      <TableCell>{app.city}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/onboarding/tickets/${app.id}`)}
                          data-testid={`button-view-${app.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            data-testid="button-prev"
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {currentPage} of {data.pagination.totalPages} ({data.pagination.total} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= data.pagination.totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            data-testid="button-next"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
