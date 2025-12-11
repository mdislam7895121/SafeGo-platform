import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, Users, Car, UtensilsCrossed, Store, Ticket, Clock, 
  CheckCircle, XCircle, AlertTriangle, Eye, RefreshCw, Filter,
  ChevronRight, Building2, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface OnboardingSummary {
  summary: {
    drivers: { pending: number; approved: number; rejected: number; suspended: number; total: number };
    restaurants: { pending: number; approved: number; rejected: number; suspended: number; total: number };
    shopPartners: { pending: number; approved: number; rejected: number; suspended: number; total: number };
    ticketOperators: { pending: number; approved: number; rejected: number; suspended: number; total: number };
  };
  timestamp: string;
}

interface PendingApplication {
  id: string;
  type: string;
  name: string;
  email: string;
  country: string;
  status: string;
  createdAt: string;
  driverType?: string;
  operatorType?: string;
  hasVehicle?: boolean;
  hasLogo?: boolean;
}

interface PendingData {
  pending: {
    drivers: PendingApplication[];
    restaurants: PendingApplication[];
    shopPartners: PendingApplication[];
    ticketOperators: PendingApplication[];
  };
}

const STATUS_CONFIG = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
  rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: AlertTriangle },
};

const PARTNER_TYPES = [
  { id: "driver", label: "Drivers", icon: Car, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950", detailPath: "/admin/drivers" },
  { id: "restaurant", label: "Restaurants", icon: UtensilsCrossed, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950", detailPath: "/admin/restaurants" },
  { id: "shop", label: "Shop Partners", icon: Store, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950", detailPath: "/admin/shop-partners" },
  { id: "ticket", label: "Ticket Operators", icon: Ticket, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950", detailPath: "/admin/ticket-operators" },
];

export default function OnboardingOverviewPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

  const summaryUrl = `/api/admin/onboarding/summary${countryFilter !== "all" ? `?countryCode=${countryFilter}` : ""}`;
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<OnboardingSummary>({
    queryKey: [summaryUrl],
    refetchInterval: 30000,
  });

  const pendingUrl = `/api/admin/onboarding/pending${activeTab !== "all" ? `?type=${activeTab}` : ""}`;
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery<PendingData>({
    queryKey: [pendingUrl],
    refetchInterval: 15000,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchPending();
    toast({ title: "Data refreshed", description: "Onboarding data has been updated" });
  };

  const getSummaryKey = (type: string) => {
    switch (type) {
      case "driver": return "drivers";
      case "restaurant": return "restaurants";
      case "shop": return "shopPartners";
      case "ticket": return "ticketOperators";
      default: return "drivers";
    }
  };

  const getDetailPath = (type: string, id: string) => {
    switch (type) {
      case "driver": return `/admin/drivers/${id}`;
      case "restaurant": return `/admin/restaurants/${id}`;
      case "shop": return `/admin/shop-partners/${id}`;
      case "ticket": return `/admin/ticket-operators/${id}`;
      default: return "#";
    }
  };

  const getAllPending = () => {
    if (!pendingData?.pending) return [];
    return [
      ...pendingData.pending.drivers,
      ...pendingData.pending.restaurants,
      ...pendingData.pending.shopPartners,
      ...pendingData.pending.ticketOperators,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getPendingByType = (type: string) => {
    if (!pendingData?.pending) return [];
    switch (type) {
      case "driver": return pendingData.pending.drivers;
      case "restaurant": return pendingData.pending.restaurants;
      case "shop": return pendingData.pending.shopPartners;
      case "ticket": return pendingData.pending.ticketOperators;
      default: return getAllPending();
    }
  };

  const totalPending = summaryData?.summary 
    ? summaryData.summary.drivers.pending + summaryData.summary.restaurants.pending + 
      summaryData.summary.shopPartners.pending + summaryData.summary.ticketOperators.pending
    : 0;

  const totalApproved = summaryData?.summary
    ? summaryData.summary.drivers.approved + summaryData.summary.restaurants.approved +
      summaryData.summary.shopPartners.approved + summaryData.summary.ticketOperators.approved
    : 0;

  const totalRejected = summaryData?.summary
    ? summaryData.summary.drivers.rejected + summaryData.summary.restaurants.rejected +
      summaryData.summary.shopPartners.rejected + summaryData.summary.ticketOperators.rejected
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Onboarding Overview</h1>
              <p className="text-muted-foreground">Review and manage all partner applications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-32" data-testid="select-country-filter">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card data-testid="card-total-pending">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-yellow-600" data-testid="text-pending-count">{totalPending}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-approved">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-green-600" data-testid="text-approved-count">{totalApproved}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active partners</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-rejected">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-red-600" data-testid="text-rejected-count">{totalRejected}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Declined applications</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {PARTNER_TYPES.map((type) => {
            const stats = summaryData?.summary?.[getSummaryKey(type.id) as keyof typeof summaryData.summary];
            const Icon = type.icon;
            return (
              <Card key={type.id} className="hover-elevate cursor-pointer" data-testid={`card-${type.id}-stats`}>
                <Link href={type.detailPath}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className={`p-2 rounded-lg ${type.bgColor}`}>
                      <Icon className={`h-5 w-5 ${type.color}`} />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold mb-2">{type.label}</h3>
                    {summaryLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="text-muted-foreground">Pending:</span>
                          <span className="font-medium">{stats?.pending || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-muted-foreground">Approved:</span>
                          <span className="font-medium">{stats?.approved || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">Rejected:</span>
                          <span className="font-medium">{stats?.rejected || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-gray-500" />
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium">{stats?.total || 0}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending Applications</CardTitle>
                <CardDescription>Review and approve partner applications</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" data-testid="tab-all">
                  All ({getAllPending().length})
                </TabsTrigger>
                <TabsTrigger value="driver" data-testid="tab-drivers">
                  <Car className="h-4 w-4 mr-1" />
                  Drivers
                </TabsTrigger>
                <TabsTrigger value="restaurant" data-testid="tab-restaurants">
                  <UtensilsCrossed className="h-4 w-4 mr-1" />
                  Restaurants
                </TabsTrigger>
                <TabsTrigger value="shop" data-testid="tab-shops">
                  <Store className="h-4 w-4 mr-1" />
                  Shops
                </TabsTrigger>
                <TabsTrigger value="ticket" data-testid="tab-tickets">
                  <Ticket className="h-4 w-4 mr-1" />
                  Tickets
                </TabsTrigger>
              </TabsList>

              <div className="space-y-3">
                {pendingLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))
                ) : getPendingByType(activeTab).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending applications in this category</p>
                  </div>
                ) : (
                  getPendingByType(activeTab).map((app) => {
                    const typeConfig = PARTNER_TYPES.find(t => t.id === app.type);
                    const Icon = typeConfig?.icon || Users;
                    return (
                      <div 
                        key={`${app.type}-${app.id}`} 
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`row-pending-${app.type}-${app.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${typeConfig?.bgColor || 'bg-gray-50'}`}>
                            <Icon className={`h-5 w-5 ${typeConfig?.color || 'text-gray-600'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{app.name || 'Unnamed'}</span>
                              <Badge variant="outline" className="text-xs">
                                {app.type === 'driver' && app.driverType ? app.driverType : app.type}
                              </Badge>
                              {app.type === 'ticket' && app.operatorType && (
                                <Badge variant="secondary" className="text-xs">{app.operatorType}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{app.email}</span>
                              <span>•</span>
                              <span>{app.country}</span>
                              <span>•</span>
                              <span>{format(new Date(app.createdAt), "MMM d, yyyy")}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_CONFIG.pending.color}>
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                          <Link href={getDetailPath(app.type, app.id)}>
                            <Button size="sm" data-testid={`button-review-${app.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
