import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, Filter, Package, Eye, MapPin, Truck, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStateCard } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface Parcel {
  id: string;
  createdAt: string;
  status: string;
  customerEmail: string;
  country: string;
  pickupAddress: string;
  dropoffAddress: string;
  serviceFare: number;
  driverEmail: string | null;
  deliveredAt: string | null;
}

interface ParcelsResponse {
  parcels: Parcel[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function AdminParcels() {
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<string>("all");

  // Parse URL query parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get("status");
    const countryParam = urlParams.get("country");
    const searchParam = urlParams.get("search");
    const pageParam = urlParams.get("page");
    
    if (statusParam) setStatusFilter(statusParam);
    if (countryParam) setCountryFilter(countryParam);
    if (searchParam) setSearchQuery(searchParam);
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, []);

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("search", searchQuery);
  if (countryFilter !== "all") queryParams.append("country", countryFilter);
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("pageSize", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/parcels${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<ParcelsResponse>({
    queryKey: [fullUrl],
    refetchInterval: 30000, // Auto-refresh every 30 seconds for memory efficiency
  });

  // Fetch parcel commission summary
  const { data: commissionData, isLoading: commissionLoading } = useQuery<{
    summary: {
      totalParcels: number;
      totalParcelRevenue: number;
      totalParcelCommission: number;
      commissionCollected: number;
      commissionPending: number;
    };
    byCountry: Record<string, { parcels: number; revenue: number; commission: number }>;
  }>({
    queryKey: [
      "/api/admin/parcels/commission-summary",
      { country: countryFilter === "all" ? undefined : countryFilter, dateRange }
    ],
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: string; className?: string }> = {
      requested: { label: "Requested", variant: "secondary" },
      searching_driver: { label: "Searching", variant: "default", className: "bg-yellow-500" },
      accepted: { label: "Accepted", variant: "default", className: "bg-blue-500" },
      picked_up: { label: "Picked Up", variant: "default", className: "bg-indigo-500" },
      on_the_way: { label: "On The Way", variant: "default", className: "bg-purple-500" },
      delivered: { label: "Delivered", variant: "default", className: "bg-green-500" },
      cancelled_by_customer: { label: "Cancelled (Customer)", variant: "destructive" },
      cancelled_by_driver: { label: "Cancelled (Driver)", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    return (
      <Badge 
        className={statusInfo.className} 
        variant={statusInfo.variant as any}
        data-testid={`badge-status-${status}`}
      >
        {statusInfo.label}
      </Badge>
    );
  };

  const truncateAddress = (address: string, maxLength = 30) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + "...";
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Parcel Management"
        description="View and manage all parcel deliveries"
        icon={Package}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
                  placeholder="Search by parcel ID or customer email..."
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

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger data-testid="select-daterange">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_pickup">Pending Pickup</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Commission Summary */}
        {commissionLoading ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Commission Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : commissionData?.summary ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-lg">Commission Overview</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {countryFilter !== "all" && (
                    <Badge variant="outline">
                      {countryFilter === "BD" ? "Bangladesh" : "USA"}
                    </Badge>
                  )}
                  {dateRange !== "all" && (
                    <Badge variant="secondary">
                      {dateRange === "7days" ? "Last 7 Days" : "Last 30 Days"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Parcels</p>
                  <p className="text-2xl font-bold" data-testid="text-total-parcels">
                    {commissionData.summary.totalParcels}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Commission Pending</p>
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-commission-pending">
                    ${commissionData.summary.commissionPending.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Commission Collected</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-commission-collected">
                    ${commissionData.summary.commissionCollected.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Statistics */}
        {data && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Showing {data.parcels.length} of {data.pagination.total} parcels
                  </span>
                </div>
                <span className="text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parcels List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))
          ) : data && data.parcels.length > 0 ? (
            data.parcels.map((parcel) => (
              <Card key={parcel.id} className="hover-elevate" data-testid={`card-parcel-${parcel.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm font-semibold" data-testid={`text-parcel-id-${parcel.id}`}>
                          {parcel.id.substring(0, 8).toUpperCase()}
                        </span>
                        {getStatusBadge(parcel.status)}
                        <Badge variant="outline" data-testid={`badge-country-${parcel.id}`}>
                          {parcel.country}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">
                            Pickup: <span className="text-foreground">{truncateAddress(parcel.pickupAddress)}</span>
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">
                            Dropoff: <span className="text-foreground">{truncateAddress(parcel.dropoffAddress)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span data-testid={`text-customer-${parcel.id}`}>Customer: {parcel.customerEmail}</span>
                        <span data-testid={`text-driver-${parcel.id}`}>
                          Driver: {parcel.driverEmail || "Not assigned"}
                        </span>
                        <span data-testid={`text-fare-${parcel.id}`}>
                          Fare: ${parcel.serviceFare.toFixed(2)}
                        </span>
                        <span data-testid={`text-created-${parcel.id}`}>
                          {format(new Date(parcel.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/admin/parcels/${parcel.id}`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-${parcel.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyStateCard
              icon={Package}
              title={searchQuery || statusFilter !== "all" || countryFilter !== "all" 
                ? "No parcels match your filters" 
                : "No active parcels today"}
              description={searchQuery || statusFilter !== "all" || countryFilter !== "all"
                ? "Try adjusting your search terms or filters to find what you're looking for."
                : "All parcels have been delivered or there are no new orders. New parcels will appear here as customers place orders."}
              iconColor="text-indigo-500/70"
              iconBgColor="bg-indigo-50 dark:bg-indigo-950/30"
              action={(searchQuery || statusFilter !== "all" || countryFilter !== "all") ? {
                label: "Clear Filters",
                onClick: () => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setCountryFilter("all");
                  setCurrentPage(1);
                },
                variant: "outline"
              } : undefined}
              testId="empty-parcels"
              size="md"
            />
          )}
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(data.pagination.totalPages, currentPage + 1))}
                  disabled={currentPage === data.pagination.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
