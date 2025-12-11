import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, History, FileText, ChevronRight, AlertCircle, Filter } from "lucide-react";
import { format } from "date-fns";

interface SafetyIncident {
  id: string;
  category: string;
  categoryLabel: string;
  description: string;
  incidentDate: string;
  status: string;
  statusLabel: string;
  tripId: string | null;
  tripType: string | null;
  locationAddress: string | null;
  attachments: string[];
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasAttachments: boolean;
}

interface IncidentsResponse {
  incidents: SafetyIncident[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "RESOLVED":
      return "default";
    case "UNDER_REVIEW":
      return "secondary";
    case "SUBMITTED":
      return "outline";
    case "CLOSED":
      return "secondary";
    default:
      return "outline";
  }
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case "RIDER_MISCONDUCT":
      return "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400";
    case "VEHICLE_DAMAGE":
      return "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400";
    case "PAYMENT_DISPUTE":
      return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400";
    case "LOST_AND_FOUND":
      return "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400";
    case "HARASSMENT_THREAT":
      return "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400";
    case "UNSAFE_LOCATION":
      return "bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
}

export default function DriverSafetyHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "10");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    return params.toString();
  };

  const { data, isLoading, error } = useQuery<IncidentsResponse>({
    queryKey: ["/api/driver/safety/incidents", page, statusFilter, categoryFilter],
    queryFn: async () => {
      const response = await fetch(`/api/driver/safety/incidents?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch incidents");
      return response.json();
    }
  });

  const handleFilterChange = () => {
    setPage(1);
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Unable to load incident history</p>
            <p className="text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/driver/safety">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-history-title">Incident History</h1>
            <p className="text-muted-foreground">View and track your safety reports</p>
          </div>
        </div>
        <Link href="/driver/safety/report">
          <Button className="gap-2" data-testid="button-new-report">
            <FileText className="h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Filter incidents by status or category</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Select 
                value={statusFilter} 
                onValueChange={(value) => { setStatusFilter(value); handleFilterChange(); }}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select 
                value={categoryFilter} 
                onValueChange={(value) => { setCategoryFilter(value); handleFilterChange(); }}
              >
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="RIDER_MISCONDUCT">Rider Misconduct</SelectItem>
                  <SelectItem value="VEHICLE_DAMAGE">Vehicle Damage</SelectItem>
                  <SelectItem value="PAYMENT_DISPUTE">Payment Dispute</SelectItem>
                  <SelectItem value="LOST_AND_FOUND">Lost & Found</SelectItem>
                  <SelectItem value="HARASSMENT_THREAT">Harassment/Threat</SelectItem>
                  <SelectItem value="UNSAFE_LOCATION">Unsafe Location</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data?.incidents && data.incidents.length > 0 ? (
        <>
          <div className="space-y-4">
            {data.incidents.map((incident) => (
              <Link key={incident.id} href={`/driver/safety/history/${incident.id}`}>
                <Card 
                  className="hover-elevate cursor-pointer"
                  data-testid={`card-incident-${incident.id}`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`p-3 rounded-lg ${getCategoryIcon(incident.category)}`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{incident.categoryLabel}</h4>
                        <Badge variant={getStatusBadgeVariant(incident.status)}>
                          {incident.statusLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {incident.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Incident date: {format(new Date(incident.incidentDate), "MMM d, yyyy")}
                        {incident.tripType && ` • ${incident.tripType}`}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 10) + 1} - {Math.min(page * 10, data.pagination.totalCount)} of {data.pagination.totalCount} incidents
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.pagination.hasMore}
                  onClick={() => setPage(page + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <History className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Incidents Found</h3>
            <p className="text-muted-foreground mb-6">
              {statusFilter !== "all" || categoryFilter !== "all" 
                ? "No incidents match your current filters" 
                : "You haven't reported any safety incidents yet"}
            </p>
            {statusFilter === "all" && categoryFilter === "all" && (
              <Link href="/driver/safety/report">
                <Button data-testid="button-report-first-incident">Report an Incident</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
