import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Car,
  UtensilsCrossed,
  Package,
  ChevronRight,
  Calendar,
  Filter,
  Star,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  DollarSign,
  ArrowRight,
  History,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ServiceType = "RIDE" | "FOOD" | "PARCEL";
type TripStatus = "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | "PENDING" | "ADJUSTED" | "REFUNDED";

interface UnifiedDriverTrip {
  id: string;
  serviceType: ServiceType;
  dateTime: string;
  completedAt: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  status: TripStatus;
  baseFare: number;
  deliveryFee: number | null;
  surgeOrBoost: number | null;
  tipAmount: number | null;
  safeGoCommission: number;
  driverEarnings: number;
  paymentMethod: string;
  tripCode: string;
  customerRating: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  restaurantName?: string;
  orderCode?: string;
}

interface TripHistoryResponse {
  trips: UnifiedDriverTrip[];
  summary: {
    totalTrips: number;
    totalEarnings?: number;
    completedTrips: number;
    cancelledTrips: number;
  };
  pagination: {
    offset: number;
    limit: number;
    hasMore: boolean;
    total: number;
  };
  kycStatus: string;
  kycApproved: boolean;
}

const serviceTypeConfig: Record<ServiceType, { icon: typeof Car; label: string; color: string }> = {
  RIDE: { icon: Car, label: "Ride", color: "bg-blue-500" },
  FOOD: { icon: UtensilsCrossed, label: "Food", color: "bg-orange-500" },
  PARCEL: { icon: Package, label: "Parcel", color: "bg-purple-500" },
};

const statusConfig: Record<TripStatus, { icon: typeof CheckCircle2; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  COMPLETED: { icon: CheckCircle2, label: "Completed", variant: "default" },
  CANCELLED: { icon: XCircle, label: "Cancelled", variant: "destructive" },
  IN_PROGRESS: { icon: Clock, label: "In Progress", variant: "secondary" },
  PENDING: { icon: Clock, label: "Pending", variant: "outline" },
  ADJUSTED: { icon: AlertCircle, label: "Adjusted", variant: "secondary" },
  REFUNDED: { icon: AlertCircle, label: "Refunded", variant: "destructive" },
};

type DateFilter = "today" | "7days" | "30days" | "custom";

export default function DriverTrips() {
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [offset, setOffset] = useState(0);
  const [accumulatedTrips, setAccumulatedTrips] = useState<UnifiedDriverTrip[]>([]);
  const limit = 20;

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { startDate: todayStart.toISOString(), endDate: now.toISOString() };
      case "7days":
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { startDate: sevenDaysAgo.toISOString(), endDate: now.toISOString() };
      case "30days":
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { startDate: thirtyDaysAgo.toISOString(), endDate: now.toISOString() };
      case "custom":
        return {
          startDate: customStartDate?.toISOString(),
          endDate: customEndDate?.toISOString(),
        };
      default:
        return {};
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());
    params.set("offset", offset.toString());
    
    if (serviceTypeFilter !== "all") {
      params.set("serviceType", serviceTypeFilter);
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    
    const dateRange = getDateRange();
    if (dateRange.startDate) {
      params.set("startDate", dateRange.startDate);
    }
    if (dateRange.endDate) {
      params.set("endDate", dateRange.endDate);
    }
    
    return params.toString();
  };

  const { data, isLoading, isFetching, refetch } = useQuery<TripHistoryResponse>({
    queryKey: ["/api/driver/trips", serviceTypeFilter, statusFilter, dateFilter, customStartDate, customEndDate, offset],
    queryFn: async () => {
      return apiRequest(`/api/driver/trips?${buildQueryParams()}`);
    },
  });

  useEffect(() => {
    if (data?.trips) {
      if (offset === 0) {
        setAccumulatedTrips(data.trips);
      } else {
        setAccumulatedTrips(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTrips = data.trips.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTrips];
        });
      }
    }
  }, [data?.trips, offset]);

  useEffect(() => {
    setOffset(0);
    setAccumulatedTrips([]);
  }, [serviceTypeFilter, statusFilter, dateFilter, customStartDate, customEndDate]);

  const loadMore = () => {
    setOffset(prev => prev + limit);
  };

  const formatCurrency = (value: number) => {
    if (value === 0 || value === undefined) return "$0.00";
    return `$${value.toFixed(2)}`;
  };

  const truncateLocation = (location: string, maxLength: number = 30) => {
    if (location.length <= maxLength) return location;
    return location.substring(0, maxLength) + "...";
  };

  if (isLoading && offset === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isKycApproved = data?.kycApproved ?? false;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <History className="h-6 w-6" />
              Trip History
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              View all your completed trips and earnings
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {!isKycApproved && (
          <Alert variant="destructive" data-testid="alert-kyc-warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Verification Required</AlertTitle>
            <AlertDescription>
              Complete your verification to view full earnings breakdown.{" "}
              <Link href="/driver/documents">
                <span className="underline cursor-pointer font-medium">Verify now</span>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card data-testid="card-total-trips">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Trips</div>
              <div className="text-2xl font-bold">{data?.summary?.totalTrips ?? 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-completed-trips">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold text-green-600">{data?.summary?.completedTrips ?? 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-cancelled-trips">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Cancelled</div>
              <div className="text-2xl font-bold text-red-600">{data?.summary?.cancelledTrips ?? 0}</div>
            </CardContent>
          </Card>
          {isKycApproved && (
            <Card data-testid="card-total-earnings">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Earnings</div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(data?.summary?.totalEarnings ?? 0)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={dateFilter === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("today")}
                  data-testid="button-filter-today"
                >
                  Today
                </Button>
                <Button
                  variant={dateFilter === "7days" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("7days")}
                  data-testid="button-filter-7days"
                >
                  7 Days
                </Button>
                <Button
                  variant={dateFilter === "30days" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("30days")}
                  data-testid="button-filter-30days"
                >
                  30 Days
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === "custom" ? "default" : "outline"}
                      size="sm"
                      data-testid="button-filter-custom"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Custom
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 border-b">
                      <p className="text-sm font-medium">Select date range</p>
                    </div>
                    <div className="flex flex-col sm:flex-row">
                      <div className="p-3 border-b sm:border-b-0 sm:border-r">
                        <p className="text-xs text-muted-foreground mb-2">Start Date</p>
                        <CalendarComponent
                          mode="single"
                          selected={customStartDate}
                          onSelect={(date) => {
                            setCustomStartDate(date);
                            setDateFilter("custom");
                          }}
                          disabled={(date) => date > new Date()}
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-2">End Date</p>
                        <CalendarComponent
                          mode="single"
                          selected={customEndDate}
                          onSelect={(date) => {
                            setCustomEndDate(date);
                            setDateFilter("custom");
                          }}
                          disabled={(date) => date > new Date() || (customStartDate ? date < customStartDate : false)}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-2 flex-1 sm:justify-end">
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-service-type">
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="RIDE">Rides</SelectItem>
                    <SelectItem value="FOOD">Food</SelectItem>
                    <SelectItem value="PARCEL">Parcel</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {accumulatedTrips.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2" data-testid="text-empty-title">No trips found</h3>
              <p className="text-muted-foreground mb-6" data-testid="text-empty-description">
                {dateFilter === "today" 
                  ? "You haven't completed any trips today yet."
                  : "Complete your first trip to see it here."}
              </p>
              <Link href="/driver/dashboard">
                <Button data-testid="button-go-online">Go Online</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accumulatedTrips.map((trip) => {
              const ServiceIcon = serviceTypeConfig[trip.serviceType].icon;
              const StatusIcon = statusConfig[trip.status].icon;
              const serviceConfig = serviceTypeConfig[trip.serviceType];
              const statusCfg = statusConfig[trip.status];

              return (
                <Link key={trip.id} href={`/driver/trips/${trip.id}?serviceType=${trip.serviceType}`}>
                  <Card 
                    className="hover-elevate cursor-pointer transition-all"
                    data-testid={`card-trip-${trip.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${serviceConfig.color} text-white flex-shrink-0`}>
                          <ServiceIcon className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm" data-testid={`text-trip-code-${trip.id}`}>
                                  {trip.tripCode}
                                </span>
                                <Badge variant={statusCfg.variant} className="text-xs">
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusCfg.label}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate" title={trip.pickupLocation}>
                                  {truncateLocation(trip.pickupLocation, 25)}
                                </span>
                                <ArrowRight className="h-3 w-3 flex-shrink-0 mx-1" />
                                <span className="truncate" title={trip.dropoffLocation}>
                                  {truncateLocation(trip.dropoffLocation, 25)}
                                </span>
                              </div>

                              {trip.restaurantName && (
                                <div className="text-sm text-muted-foreground mb-1">
                                  <UtensilsCrossed className="h-3.5 w-3.5 inline mr-1" />
                                  {trip.restaurantName}
                                </div>
                              )}

                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(trip.dateTime), "MMM d, yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(trip.dateTime), "h:mm a")}
                                </span>
                                {trip.customerRating && (
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    {trip.customerRating}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              {isKycApproved ? (
                                <div 
                                  className="text-lg font-bold text-primary"
                                  data-testid={`text-trip-earnings-${trip.id}`}
                                >
                                  {formatCurrency(trip.driverEarnings)}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  View details
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground capitalize">
                                {trip.paymentMethod}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            {data?.pagination?.hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isFetching}
                  data-testid="button-load-more"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
