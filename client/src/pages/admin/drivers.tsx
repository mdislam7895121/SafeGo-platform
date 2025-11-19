import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Filter, Car, Shield, UserX, Clock, Eye, Ban, Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface Driver {
  id: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  lastActive: string | null;
  isBlocked: boolean;
  vehicleType: string | null;
  vehicleModel: string | null;
  isOnline: boolean;
  totalEarnings: string;
  averageRating: string;
  totalTrips: number;
  commissionPaid: string;
}

interface DriversResponse {
  drivers: Driver[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AdminDrivers() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Parse URL query parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get("status");
    const countryParam = urlParams.get("country");
    const verificationParam = urlParams.get("verificationStatus");
    const searchParam = urlParams.get("search");
    const pageParam = urlParams.get("page");
    
    if (statusParam) setStatusFilter(statusParam);
    if (countryParam) setCountryFilter(countryParam);
    if (verificationParam) setVerificationFilter(verificationParam);
    if (searchParam) setSearchQuery(searchParam);
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, []);

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("search", searchQuery);
  if (countryFilter !== "all") queryParams.append("country", countryFilter);
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (verificationFilter !== "all") queryParams.append("verificationStatus", verificationFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/drivers${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<DriversResponse>({
    queryKey: [fullUrl],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const getStatusBadge = (driver: Driver) => {
    if (driver.isBlocked) {
      return <Badge variant="destructive" data-testid={`badge-status-${driver.id}`}>Blocked</Badge>;
    }
    if (driver.isSuspended) {
      return <Badge className="bg-orange-500" data-testid={`badge-status-${driver.id}`}>Suspended</Badge>;
    }
    if (!driver.isVerified) {
      return <Badge variant="secondary" data-testid={`badge-status-${driver.id}`}>Pending KYC</Badge>;
    }
    if (driver.isOnline) {
      return <Badge className="bg-green-500" data-testid={`badge-status-${driver.id}`}>Online</Badge>;
    }
    return <Badge variant="outline" data-testid={`badge-status-${driver.id}`}>Offline</Badge>;
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
            <h1 className="text-2xl font-bold">Driver Management</h1>
            <p className="text-sm opacity-90">View and manage all drivers</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={countryFilter} onValueChange={(value) => { setCountryFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              <Select value={verificationFilter} onValueChange={(value) => { setVerificationFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-verification">
                  <SelectValue placeholder="All Verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verification</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Driver List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Drivers
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
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : data && data.drivers.length > 0 ? (
              <div className="space-y-3">
                {data.drivers.map((driver) => (
                  <Card key={driver.id} className="hover-elevate" data-testid={`card-driver-${driver.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold truncate" data-testid={`text-email-${driver.id}`}>
                              {driver.email}
                            </p>
                            <Badge variant="outline" data-testid={`text-country-${driver.id}`}>
                              {driver.countryCode}
                            </Badge>
                            {getStatusBadge(driver)}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Vehicle</p>
                              <p className="font-medium" data-testid={`text-vehicle-${driver.id}`}>
                                {driver.vehicleType || "No vehicle"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Rating</p>
                              <p className="font-medium" data-testid={`text-rating-${driver.id}`}>
                                {driver.averageRating || "N/A"} ⭐
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Trips</p>
                              <p className="font-medium" data-testid={`text-trips-${driver.id}`}>
                                {driver.totalTrips}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Earnings</p>
                              <p className="font-medium" data-testid={`text-earnings-${driver.id}`}>
                                {driver.countryCode === "BD" ? "৳" : "$"}{driver.totalEarnings}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Commission Paid</p>
                              <p className="font-medium text-primary" data-testid={`text-commission-${driver.id}`}>
                                {driver.countryCode === "BD" ? "৳" : "$"}{driver.commissionPaid}
                              </p>
                            </div>
                          </div>

                          {driver.isSuspended && driver.suspensionReason && (
                            <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950 rounded-md">
                              <p className="text-xs text-orange-800 dark:text-orange-200" data-testid={`text-suspension-reason-${driver.id}`}>
                                <strong>Suspended:</strong> {driver.suspensionReason}
                              </p>
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/drivers/${driver.id}`)}
                          data-testid={`button-view-${driver.id}`}
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
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No drivers found</p>
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
