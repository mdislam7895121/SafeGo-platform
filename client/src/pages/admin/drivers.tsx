import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Filter, Car, Eye, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
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
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  isOnline: boolean;
  totalEarnings: string;
  averageRating: string;
  totalTrips: number;
  commissionPaid: string;
  walletBalance: number;
  negativeBalance: number;
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
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Parse URL query parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get("status");
    const countryParam = urlParams.get("country");
    const stateParam = urlParams.get("state");
    const verificationParam = urlParams.get("verificationStatus");
    const searchParam = urlParams.get("search");
    const pageParam = urlParams.get("page");
    
    if (statusParam) setStatusFilter(statusParam);
    if (countryParam) setCountryFilter(countryParam);
    if (stateParam) setStateFilter(stateParam);
    if (verificationParam) setVerificationFilter(verificationParam);
    if (searchParam) setSearchQuery(searchParam);
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, []);

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("search", searchQuery);
  if (countryFilter !== "all") queryParams.append("country", countryFilter);
  if (countryFilter === "US" && stateFilter !== "all") queryParams.append("state", stateFilter);
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (verificationFilter !== "all") queryParams.append("verificationStatus", verificationFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/drivers${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<DriversResponse>({
    queryKey: [fullUrl],
    refetchInterval: 30000, // Auto-refresh every 30 seconds for memory efficiency
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
      <PageHeader
        title="Driver Management"
        description="View and manage all drivers"
        icon={Car}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                  className="pl-10 min-h-[44px] sm:min-h-9"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Select 
                value={countryFilter} 
                onValueChange={(value) => { 
                  setCountryFilter(value);
                  if (value !== "US") setStateFilter("all");
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger data-testid="select-country" className="min-h-[44px] sm:min-h-9">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-status" className="min-h-[44px] sm:min-h-9">
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
                <SelectTrigger data-testid="select-verification" className="min-h-[44px] sm:min-h-9">
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

            {/* USA State Filter (conditional) */}
            {countryFilter === "US" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={stateFilter} onValueChange={(value) => { setStateFilter(value); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="select-state" className="min-h-[44px] sm:min-h-9">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="NY">New York (NY)</SelectItem>
                  </SelectContent>
                </Select>
                <div />
                <div />
              </div>
            )}
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

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Vehicle Type</p>
                                <p className="font-medium" data-testid={`text-vehicle-type-${driver.id}`}>
                                  {driver.vehicleType || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Make & Model</p>
                                <p className="font-medium" data-testid={`text-vehicle-model-${driver.id}`}>
                                  {driver.vehicleMake && driver.vehicleModel 
                                    ? `${driver.vehicleMake} ${driver.vehicleModel}` 
                                    : driver.vehicleModel || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Color</p>
                                <p className="font-medium" data-testid={`text-vehicle-color-${driver.id}`}>
                                  {driver.vehicleColor || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">License Plate</p>
                                <p className="font-medium font-mono" data-testid={`text-vehicle-plate-${driver.id}`}>
                                  {driver.vehiclePlate || "N/A"}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                                <p className="text-muted-foreground">Wallet Balance</p>
                                <p className="font-medium text-green-600 dark:text-green-400" data-testid={`text-wallet-${driver.id}`}>
                                  {driver.countryCode === "BD" ? "৳" : "$"}{(driver.walletBalance ?? 0).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Negative Balance</p>
                                <p className={`font-medium ${(driver.negativeBalance ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid={`text-negative-${driver.id}`}>
                                  {(driver.negativeBalance ?? 0) > 0 ? (
                                    <span className="flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      {driver.countryCode === "BD" ? "৳" : "$"}{(driver.negativeBalance ?? 0).toFixed(2)}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                          className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-fit shrink-0"
                        >
                          <Eye className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
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
