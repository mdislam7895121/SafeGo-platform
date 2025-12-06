/**
 * Admin Ride Requests Page
 * 
 * Read-only view of all ride requests for admin monitoring.
 * SafeGo Admin Rules:
 * - Read-only access (no edit permissions)
 * - No status override unless admin_unblock logic applies
 * - Pricing breakdown visible but not editable
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  MapPin,
  Navigation,
  Clock,
  Car,
  Wallet,
  CreditCard,
  User,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Moon,
  Zap,
  Shield,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

interface RideRequest {
  id: string;
  status: string;
  countryCode: string;
  cityCode: string;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleType: string;
  paymentMethod: string;
  fareCurrency: string;
  serviceFare: number;
  safegoCommission: number;
  driverPayout: number;
  distanceKm: number;
  durationMinutes: number;
  nightMultiplier?: number;
  peakMultiplier?: number;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  fareBreakdown?: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    nightMultiplier: number;
    peakMultiplier: number;
    totalFare: number;
    currency: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface RideListResponse {
  success: boolean;
  rides: RideRequest[];
  pagination: PaginationInfo;
  total: number;
  page: number;
  limit: number;
}

function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; className: string }> = {
    requested: { label: "Requested", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    searching_driver: { label: "Searching", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    accepted: { label: "Accepted", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    driver_arriving: { label: "Arriving", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    arrived: { label: "Arrived", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    in_progress: { label: "In Progress", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
    cancelled_by_customer: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    cancelled_by_driver: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    cancelled_no_driver: { label: "No Driver", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  };

  const config = configs[status] || { label: status, className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" };
  return <Badge className={config.className}>{config.label}</Badge>;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "BDT") {
    return `৳${amount.toFixed(0)}`;
  }
  return `$${amount.toFixed(2)}`;
}

const DEFAULT_PAGE_LIMIT = 20;

export default function AdminRideRequests() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);

  const {
    data: ridesData,
    isLoading,
    error,
    refetch,
  } = useQuery<RideListResponse>({
    queryKey: ["/api/admin/rides", page, statusFilter, countryFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: DEFAULT_PAGE_LIMIT.toString(),
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (countryFilter !== "all") params.append("countryCode", countryFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/admin/ride-pricing/rides/list?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch rides");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
  });

  const rides = ridesData?.rides || [];
  const pagination = ridesData?.pagination;
  const effectiveLimit = pagination?.limit || ridesData?.limit || DEFAULT_PAGE_LIMIT;
  const totalRides = pagination?.total || ridesData?.total || 0;
  const totalPages = pagination?.totalPages || Math.ceil(totalRides / effectiveLimit);
  const hasNextPage = pagination?.hasNextPage ?? page < totalPages;
  const hasPreviousPage = pagination?.hasPreviousPage ?? page > 1;

  return (
    <div className="space-y-6" data-testid="admin-ride-requests-page">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ride Requests</h1>
          <p className="text-muted-foreground">
            View all ride requests (Read-only access)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Read Only
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, address, or customer..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]" data-testid="select-status">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="searching_driver">Searching</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled_by_customer">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={countryFilter}
              onValueChange={(v) => {
                setCountryFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-country">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to load rides. Please try again.</AlertDescription>
              </Alert>
            </div>
          ) : rides.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No ride requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Fare</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rides.map((ride) => (
                    <TableRow key={ride.id} data-testid={`row-ride-${ride.id}`}>
                      <TableCell className="font-mono text-xs">
                        {ride.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{getStatusBadge(ride.status)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1 truncate">
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                            <span className="truncate">{ride.pickupAddress}</span>
                          </div>
                          <div className="flex items-center gap-1 truncate">
                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                            <span className="truncate">{ride.dropoffAddress}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {ride.vehicleType.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ride.paymentMethod === "cash" ? (
                          <Badge variant="outline" className="gap-1">
                            <Wallet className="h-3 w-3" /> Cash
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <CreditCard className="h-3 w-3" /> Online
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(ride.serviceFare, ride.fareCurrency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(ride.requestedAt), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedRide(ride)}
                          data-testid={`button-view-${ride.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({totalRides} rides)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPreviousPage}
                  onClick={() => setPage(page - 1)}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNextPage}
                  onClick={() => setPage(page + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRide && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Ride Details
                  <Badge variant="secondary" className="ml-2 gap-1">
                    <Shield className="h-3 w-3" />
                    Read Only
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  ID: {selectedRide.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedRide.status)}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Route Details
                  </h4>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="font-medium">{selectedRide.pickupAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Dropoff</p>
                        <p className="font-medium">{selectedRide.dropoffAddress}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5" />
                      {selectedRide.distanceKm?.toFixed(1)} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      ~{selectedRide.durationMinutes} min
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Pricing Breakdown
                  </h4>
                  {selectedRide.fareBreakdown && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Fare</span>
                        <span>{formatCurrency(selectedRide.fareBreakdown.baseFare, selectedRide.fareCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distance Fare</span>
                        <span>{formatCurrency(selectedRide.fareBreakdown.distanceFare, selectedRide.fareCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time Fare</span>
                        <span>{formatCurrency(selectedRide.fareBreakdown.timeFare, selectedRide.fareCurrency)}</span>
                      </div>
                      {selectedRide.fareBreakdown.bookingFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Booking Fee</span>
                          <span>{formatCurrency(selectedRide.fareBreakdown.bookingFee, selectedRide.fareCurrency)}</span>
                        </div>
                      )}
                      {selectedRide.fareBreakdown.nightMultiplier > 1 && (
                        <div className="flex justify-between text-amber-600">
                          <span className="flex items-center gap-1">
                            <Moon className="h-3 w-3" /> Night Rate
                          </span>
                          <span>x{selectedRide.fareBreakdown.nightMultiplier.toFixed(1)}</span>
                        </div>
                      )}
                      {selectedRide.fareBreakdown.peakMultiplier > 1 && (
                        <div className="flex justify-between text-orange-600">
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Peak Rate
                          </span>
                          <span>x{selectedRide.fareBreakdown.peakMultiplier.toFixed(1)}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold">
                        <span>Total Fare</span>
                        <span>{formatCurrency(selectedRide.serviceFare, selectedRide.fareCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>SafeGo Commission</span>
                        <span>{formatCurrency(selectedRide.safegoCommission, selectedRide.fareCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Driver Payout</span>
                        <span>{formatCurrency(selectedRide.driverPayout, selectedRide.fareCurrency)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Vehicle Type</p>
                    <Badge variant="secondary" className="capitalize">
                      {selectedRide.vehicleType.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Payment Method</p>
                    {selectedRide.paymentMethod === "cash" ? (
                      <Badge variant="outline" className="gap-1">
                        <Wallet className="h-3 w-3" /> Cash
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <CreditCard className="h-3 w-3" /> Online
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Country</p>
                    <Badge variant="secondary">
                      {selectedRide.countryCode === "BD" ? "Bangladesh" : "United States"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">City</p>
                    <Badge variant="secondary">{selectedRide.cityCode}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Timeline
                  </h4>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Requested</span>
                      <span>{format(new Date(selectedRide.requestedAt), "PPp")}</span>
                    </div>
                    {selectedRide.acceptedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Accepted</span>
                        <span>{format(new Date(selectedRide.acceptedAt), "PPp")}</span>
                      </div>
                    )}
                    {selectedRide.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed</span>
                        <span>{format(new Date(selectedRide.completedAt), "PPp")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {(selectedRide.customer || selectedRide.driver) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      {selectedRide.customer && (
                        <div>
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <User className="h-4 w-4" /> Customer
                          </h4>
                          <div className="text-sm">
                            <p className="font-medium">
                              {selectedRide.customer.firstName} {selectedRide.customer.lastName}
                            </p>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {selectedRide.customer.phone}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedRide.driver && (
                        <div>
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <Car className="h-4 w-4" /> Driver
                          </h4>
                          <div className="text-sm">
                            <p className="font-medium">
                              {selectedRide.driver.firstName} {selectedRide.driver.lastName}
                            </p>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {selectedRide.driver.phone}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
