import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, Filter, Eye, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface Complaint {
  id: string;
  driverId: string;
  driverEmail: string;
  customerId: string | null;
  customerEmail: string | null;
  rideId: string | null;
  ride: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    status: string;
    createdAt: string;
  } | null;
  reason: string;
  description: string | null;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
}

interface ComplaintsResponse {
  complaints: Complaint[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AdminComplaints() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/complaints${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<ComplaintsResponse>({
    queryKey: [fullUrl],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const getStatusBadge = (status: string) => {
    if (status === "resolved") {
      return <Badge className="bg-green-500" data-testid={`badge-resolved`}>Resolved</Badge>;
    }
    return <Badge variant="destructive" data-testid={`badge-open`}>Open</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Driver Complaints</h1>
            <p className="text-sm opacity-90">Review and resolve complaints</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-sm">
                Auto-refreshing every 5 seconds to show new complaints
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Complaints List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Complaints
                {data && (
                  <Badge variant="secondary" data-testid="text-total-count">
                    {data.pagination.total} total
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : data && data.complaints.length > 0 ? (
              <div className="space-y-3">
                {data.complaints.map((complaint) => (
                  <Card key={complaint.id} className="hover-elevate" data-testid={`card-complaint-${complaint.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold" data-testid={`text-reason-${complaint.id}`}>
                              {complaint.reason}
                            </p>
                            {getStatusBadge(complaint.status)}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <p className="text-muted-foreground">Driver</p>
                                <p className="font-medium" data-testid={`text-driver-${complaint.id}`}>
                                  {complaint.driverEmail}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Customer</p>
                                <p className="font-medium" data-testid={`text-customer-${complaint.id}`}>
                                  {complaint.customerEmail || "N/A"}
                                </p>
                              </div>
                            </div>

                            {complaint.ride && (
                              <div className="p-2 bg-muted rounded-md">
                                <p className="text-xs text-muted-foreground mb-1">Related Trip</p>
                                <p className="text-xs font-medium" data-testid={`text-ride-${complaint.id}`}>
                                  {complaint.ride.pickupAddress} → {complaint.ride.dropoffAddress}
                                </p>
                              </div>
                            )}

                            {complaint.description && (
                              <div>
                                <p className="text-muted-foreground">Description</p>
                                <p className="text-sm" data-testid={`text-description-${complaint.id}`}>
                                  {complaint.description}
                                </p>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span data-testid={`text-created-${complaint.id}`}>
                                Filed: {format(new Date(complaint.createdAt), "PPp")}
                              </span>
                              {complaint.resolvedAt && (
                                <span data-testid={`text-resolved-${complaint.id}`}>
                                  Resolved: {format(new Date(complaint.resolvedAt), "PPp")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/complaints/${complaint.id}`)}
                          data-testid={`button-view-${complaint.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No complaints found</p>
              </div>
            )}

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === data.pagination.totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
