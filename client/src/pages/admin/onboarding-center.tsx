import { useState } from "react";
import { useLocation } from "wouter";
import { Car, UtensilsCrossed, Store, Ticket, Filter, Eye, Clock, Search as SearchIcon, CheckCircle, XCircle, Clock4 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

interface Application {
  id: string;
  createdAt: string;
  status: string;
  city: string;
  region?: string;
  country: string;
  fullName?: string;
  email?: string;
  serviceType?: string;
  vehicleType?: string;
  restaurantName?: string;
  ownerName?: string;
  businessEmail?: string;
  cuisineType?: string;
  shopName?: string;
  category?: string;
  businessName?: string;
  contactPerson?: string;
  ticketType?: string;
  phoneNumber?: string;
}

interface ApplicationsResponse {
  applications: Application[];
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

function ApplicationTable({
  type,
  applications,
  isLoading,
  onViewDetails
}: {
  type: string;
  applications: Application[];
  isLoading: boolean;
  onViewDetails: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No applications found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => {
        const statusConfig = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
        const StatusIcon = statusConfig.icon;

        let primaryInfo = "";
        let secondaryInfo = "";

        switch (type) {
          case "drivers":
            primaryInfo = app.fullName || "";
            secondaryInfo = `${app.serviceType === "ride_driver" ? "Ride Driver" : "Delivery Courier"} - ${app.vehicleType}`;
            break;
          case "restaurants":
            primaryInfo = app.restaurantName || "";
            secondaryInfo = `${app.ownerName} - ${app.cuisineType}`;
            break;
          case "shops":
            primaryInfo = app.shopName || "";
            secondaryInfo = `${app.ownerName} - ${app.category}`;
            break;
          case "tickets":
            primaryInfo = app.businessName || "";
            secondaryInfo = `${app.contactPerson} - ${app.ticketType}`;
            break;
        }

        return (
          <Card key={app.id} className="hover-elevate cursor-pointer" onClick={() => onViewDetails(app.id)} data-testid={`card-application-${app.id}`}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{primaryInfo}</h3>
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{secondaryInfo}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{app.city}, {app.country}</span>
                    <span>{formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onViewDetails(app.id); }} data-testid={`button-view-${app.id}`}>
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

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

function PartnerTabContent({
  type,
  endpoint,
  icon: Icon,
  extraFilters
}: {
  type: string;
  endpoint: string;
  icon: typeof Car;
  extraFilters?: { key: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [extraFilter, setExtraFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (cityFilter.trim()) queryParams.append("city", cityFilter.trim());
  if (regionFilter !== "all") queryParams.append("region", regionFilter);
  if (extraFilters && extraFilter !== "all") queryParams.append(extraFilters[0].key, extraFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/partner-onboarding/${endpoint}${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<ApplicationsResponse>({
    queryKey: ['/api/partner-onboarding', endpoint, statusFilter, cityFilter, regionFilter, extraFilter, currentPage],
    queryFn: async () => {
      const response = await fetch(fullUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div>
      {data?.stats && <StatsCards stats={data.stats} />}

      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[150px]" data-testid={`select-status-${type}`}>
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

        {type === "drivers" && (
          <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="select-region-drivers">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="BD">Bangladesh</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        )}

        {extraFilters && (
          <Select value={extraFilter} onValueChange={(v) => { setExtraFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid={`select-extra-${type}`}>
              <SelectValue placeholder={extraFilters[0].label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {extraFilters[0].label}</SelectItem>
              {extraFilters[0].options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by city..."
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
              className="pl-9"
              data-testid={`input-search-${type}`}
            />
          </div>
        </div>
      </div>

      <ApplicationTable
        type={endpoint}
        applications={data?.applications || []}
        isLoading={isLoading}
        onViewDetails={(id) => navigate(`/admin/onboarding-center/${endpoint}/${id}`)}
      />

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            data-testid={`button-prev-${type}`}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {currentPage} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= data.pagination.totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            data-testid={`button-next-${type}`}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminOnboardingCenter() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner Onboarding Center"
        description="Manage partner applications from the landing page"
      />

      <Tabs defaultValue="drivers" className="w-full">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-partner-types">
          <TabsTrigger value="drivers" className="flex items-center gap-2" data-testid="tab-drivers">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Drivers</span>
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="flex items-center gap-2" data-testid="tab-restaurants">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="hidden sm:inline">Restaurants</span>
          </TabsTrigger>
          <TabsTrigger value="shops" className="flex items-center gap-2" data-testid="tab-shops">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Shops</span>
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2" data-testid="tab-tickets">
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" className="mt-6">
          <PartnerTabContent
            type="drivers"
            endpoint="drivers"
            icon={Car}
            extraFilters={[{
              key: "serviceType",
              label: "Service",
              options: [
                { value: "ride_driver", label: "Ride Driver" },
                { value: "delivery_courier", label: "Delivery Courier" }
              ]
            }]}
          />
        </TabsContent>

        <TabsContent value="restaurants" className="mt-6">
          <PartnerTabContent
            type="restaurants"
            endpoint="restaurants"
            icon={UtensilsCrossed}
            extraFilters={[{
              key: "cuisineType",
              label: "Cuisine",
              options: [
                { value: "Bengali", label: "Bengali" },
                { value: "Indian", label: "Indian" },
                { value: "Chinese", label: "Chinese" },
                { value: "Fast Food", label: "Fast Food" },
                { value: "Biryani", label: "Biryani" }
              ]
            }]}
          />
        </TabsContent>

        <TabsContent value="shops" className="mt-6">
          <PartnerTabContent
            type="shops"
            endpoint="shops"
            icon={Store}
            extraFilters={[{
              key: "category",
              label: "Category",
              options: [
                { value: "electronics", label: "Electronics" },
                { value: "groceries", label: "Groceries" },
                { value: "clothing", label: "Clothing" },
                { value: "essentials", label: "Essentials" }
              ]
            }]}
          />
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          <PartnerTabContent
            type="tickets"
            endpoint="tickets"
            icon={Ticket}
            extraFilters={[{
              key: "ticketType",
              label: "Type",
              options: [
                { value: "bus", label: "Bus" },
                { value: "train", label: "Train" },
                { value: "launch", label: "Launch" },
                { value: "event", label: "Event" }
              ]
            }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
