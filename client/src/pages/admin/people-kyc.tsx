import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Shield,
  ShieldAlert,
  User,
  Car,
  UtensilsCrossed,
  Store,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Wallet,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity,
  Users,
  AlertTriangle,
  Ban,
  UserX,
  Flag,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchWithAuth, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PageHeader,
  StatusBadge,
  SeverityBadge,
  DetailDrawer,
  DetailSection,
  DetailItem,
  DetailList,
  Timeline,
  EmptyState,
  MetricCard,
  MetricGrid,
  QuickFilterBar,
} from "@/components/admin";

interface PeopleKycResult {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  isBlocked: boolean;
  isSuspended: boolean;
  kycCompleteness: number;
  walletBalance: number | null;
  negativeBalance: number | null;
  createdAt: string;
  riskFlags?: number;
}

interface PeopleKycResponse {
  results: PeopleKycResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats?: {
    totalUsers: number;
    pendingKyc: number;
    suspended: number;
    blocked: number;
  };
}

interface ProfileDetail {
  profile: any;
  activitySummary: any;
  walletSummary: any;
  riskSummary: any;
}

const roleIcons: Record<string, any> = {
  customer: User,
  driver: Car,
  restaurant: UtensilsCrossed,
  shop_partner: Store,
  ticket_operator: Sparkles,
};

const roleLabels: Record<string, string> = {
  customer: "Customer",
  driver: "Driver",
  restaurant: "Restaurant",
  shop_partner: "Shop Partner",
  ticket_operator: "Ticket Operator",
};

const roleColors: Record<string, string> = {
  customer: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  driver: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  restaurant: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  shop_partner: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  ticket_operator: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
};

function getAccountStatus(result: PeopleKycResult) {
  if (result.isBlocked) return "blocked";
  if (result.isSuspended) return "suspended";
  return "active";
}

function getVerificationStatus(status: string, isVerified: boolean) {
  if (isVerified || status === "approved") return "verified";
  if (status === "pending") return "pending";
  if (status === "rejected") return "rejected";
  return "unverified";
}

function ProfileDetailPanel({
  role,
  id,
  onClose,
}: {
  role: string;
  id: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery<ProfileDetail>({
    queryKey: ["/api/admin/people-kyc", role, id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/people-kyc/${role}/${id}`, {
        headers: { "Content-Type": "application/json" },
      });
      await throwIfResNotOk(res);
      return res.json();
    },
    enabled: !!role && !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Failed to load profile"
        description="Unable to retrieve profile details. Please try again."
        action={
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      />
    );
  }

  const { profile, activitySummary, walletSummary, riskSummary } = data;
  const profileName =
    profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile.name || profile.shopName || profile.businessName || "N/A";

  const timelineEvents =
    riskSummary?.events?.slice(0, 5).map((event: any) => ({
      id: event.id,
      title: event.type || "Risk Event",
      description: event.description,
      timestamp: new Date(event.createdAt).toLocaleString(),
      icon:
        event.severity === "critical"
          ? AlertTriangle
          : event.severity === "high"
          ? AlertCircle
          : Flag,
      iconColor:
        event.severity === "critical"
          ? "text-red-500"
          : event.severity === "high"
          ? "text-orange-500"
          : "text-amber-500",
    })) || [];

  return (
    <div className="space-y-6">
      <DetailSection title="Contact Information" icon={User} iconColor="text-blue-500">
        <DetailList
          items={[
            {
              label: "Email",
              value: profile.email || profile.user?.email || "No email",
              icon: Mail,
            },
            {
              label: "Phone",
              value: profile.phone || "No phone",
              icon: Phone,
            },
            {
              label: "Address",
              value:
                profile.address ||
                profile.presentAddress ||
                profile.homeAddress ||
                "Not provided",
              icon: MapPin,
            },
            {
              label: "Country",
              value: (
                <Badge variant="outline" className="text-xs">
                  {profile.countryCode || "N/A"}
                </Badge>
              ),
            },
          ]}
        />
      </DetailSection>

      {activitySummary && Object.keys(activitySummary).length > 0 && (
        <DetailSection title="Activity Summary" icon={Activity} iconColor="text-green-500">
          <div className="grid grid-cols-2 gap-3">
            {activitySummary.ridesCount !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{activitySummary.ridesCount}</p>
                <p className="text-xs text-muted-foreground">Total Rides</p>
              </div>
            )}
            {activitySummary.ordersCount !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{activitySummary.ordersCount}</p>
                <p className="text-xs text-muted-foreground">Food Orders</p>
              </div>
            )}
            {activitySummary.deliveriesCount !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{activitySummary.deliveriesCount}</p>
                <p className="text-xs text-muted-foreground">Deliveries</p>
              </div>
            )}
            {activitySummary.avgRating !== undefined && activitySummary.avgRating > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{activitySummary.avgRating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {walletSummary && (
        <DetailSection title="Wallet Summary" icon={Wallet} iconColor="text-emerald-500">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600">
                ${walletSummary.balance?.toFixed(2) || "0.00"}
              </p>
              <p className="text-xs text-muted-foreground">Balance</p>
            </div>
            {walletSummary.negativeBalance > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-600">
                  -${walletSummary.negativeBalance?.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Negative Balance</p>
              </div>
            )}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold">
                ${walletSummary.lifetimeEarnings?.toFixed(2) || "0.00"}
              </p>
              <p className="text-xs text-muted-foreground">Lifetime Earnings</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold">
                ${walletSummary.pendingBalance?.toFixed(2) || "0.00"}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </DetailSection>
      )}

      {riskSummary && (
        <DetailSection title="Risk Summary" icon={ShieldAlert} iconColor="text-red-500">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-2xl font-bold">{riskSummary.recentEvents || 0}</p>
              <p className="text-xs text-muted-foreground">Recent Events</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p
                className={`text-2xl font-bold ${
                  riskSummary.openCases > 0 ? "text-red-600" : ""
                }`}
              >
                {riskSummary.openCases || 0}
              </p>
              <p className="text-xs text-muted-foreground">Open Cases</p>
            </div>
          </div>
          {timelineEvents.length > 0 && (
            <Timeline events={timelineEvents} className="mt-4" />
          )}
        </DetailSection>
      )}

      <div className="flex gap-2 pt-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/admin/${role}s/${id}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Full Profile
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/admin/documents?userId=${profile.userId}`}>
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function PeopleKycCenter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    role: "all",
    country: "all",
    verification: "all",
    status: "all",
    search: "",
    page: 1,
  });

  const [selectedProfile, setSelectedProfile] = useState<{
    role: string;
    userId: string;
    profileId: string;
    name: string;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState("all");

  const { data, isLoading, error, refetch } = useQuery<PeopleKycResponse>({
    queryKey: ["/api/admin/people-kyc", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.set(key, String(value));
      });
      const res = await fetchWithAuth(`/api/admin/people-kyc?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      await throwIfResNotOk(res);
      return res.json();
    },
  });

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    if (filter === "all") {
      setFilters((prev) => ({
        ...prev,
        status: "all",
        verification: "all",
        page: 1,
      }));
    } else if (filter === "pending_kyc") {
      setFilters((prev) => ({
        ...prev,
        verification: "pending",
        status: "all",
        page: 1,
      }));
    } else if (filter === "suspended") {
      setFilters((prev) => ({
        ...prev,
        status: "suspended",
        verification: "all",
        page: 1,
      }));
    } else if (filter === "blocked") {
      setFilters((prev) => ({
        ...prev,
        status: "blocked",
        verification: "all",
        page: 1,
      }));
    }
  };

  const clearFilters = () => {
    setFilters({
      role: "all",
      country: "all",
      verification: "all",
      status: "all",
      search: "",
      page: 1,
    });
    setQuickFilter("all");
  };

  const activeFilterCount = [
    filters.role !== "all",
    filters.country !== "all",
    filters.verification !== "all",
    filters.status !== "all",
    filters.search !== "",
  ].filter(Boolean).length;

  const quickFilters = [
    { id: "all", label: "All Users", count: data?.total },
    { id: "pending_kyc", label: "Pending KYC", count: data?.stats?.pendingKyc },
    { id: "suspended", label: "Suspended", count: data?.stats?.suspended },
    { id: "blocked", label: "Blocked", count: data?.stats?.blocked },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="People & KYC Center"
        description="Unified user management, verification, and risk monitoring"
        icon={Users}
        iconColor="text-blue-500"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "People & KYC Center" },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="button-export"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </>
        }
      >
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={filters.role}
              onValueChange={(v) => handleFilterChange("role", v)}
            >
              <SelectTrigger className="w-[140px] h-9" data-testid="select-role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="driver">Drivers</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="shop_partner">Shop Partners</SelectItem>
                <SelectItem value="ticket_operator">Ticket Operators</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.country}
              onValueChange={(v) => handleFilterChange("country", v)}
            >
              <SelectTrigger className="w-[130px] h-9" data-testid="select-country">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9 gap-1.5"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">More</span>
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-muted/50 rounded-lg border">
            <Select
              value={filters.verification}
              onValueChange={(v) => handleFilterChange("verification", v)}
            >
              <SelectTrigger className="w-[140px] h-8" data-testid="select-verification">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(v) => handleFilterChange("status", v)}
            >
              <SelectTrigger className="w-[130px] h-8" data-testid="select-status">
                <SelectValue placeholder="Account Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-muted-foreground"
                data-testid="button-clear-filters"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </PageHeader>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <QuickFilterBar
          filters={quickFilters}
          activeFilter={quickFilter}
          onFilterChange={handleQuickFilter}
          className="mb-4"
        />

        <MetricGrid columns={4} className="mb-6">
          <MetricCard
            title="Total Users"
            value={data?.stats?.totalUsers || data?.total || 0}
            icon={Users}
            iconColor="text-blue-500"
            iconBgColor="bg-blue-500/10"
            isLoading={isLoading}
          />
          <MetricCard
            title="Pending KYC"
            value={data?.stats?.pendingKyc || 0}
            icon={Clock}
            iconColor="text-amber-500"
            iconBgColor="bg-amber-500/10"
            isLoading={isLoading}
            onClick={() => handleQuickFilter("pending_kyc")}
          />
          <MetricCard
            title="Suspended"
            value={data?.stats?.suspended || 0}
            icon={UserX}
            iconColor="text-orange-500"
            iconBgColor="bg-orange-500/10"
            isLoading={isLoading}
            onClick={() => handleQuickFilter("suspended")}
          />
          <MetricCard
            title="Blocked"
            value={data?.stats?.blocked || 0}
            icon={Ban}
            iconColor="text-red-500"
            iconBgColor="bg-red-500/10"
            isLoading={isLoading}
            onClick={() => handleQuickFilter("blocked")}
          />
        </MetricGrid>

        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState
                icon={AlertCircle}
                title="Failed to load data"
                description="We couldn't retrieve the user list. Please try again."
                action={
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : data?.results.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState
                icon={Search}
                title="No results found"
                description="Try adjusting your search or filter criteria."
                action={
                  activeFilterCount > 0 && (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Showing {data?.results.length || 0} of {data?.total || 0} results
              </p>
            </div>

            <div className="grid gap-3">
              {data?.results.map((result) => {
                const RoleIcon = roleIcons[result.role] || User;
                const accountStatus = getAccountStatus(result);
                const verificationStatus = getVerificationStatus(
                  result.verificationStatus,
                  result.isVerified
                );

                return (
                  <Card
                    key={`${result.role}-${result.id}`}
                    className="hover-elevate cursor-pointer"
                    onClick={() =>
                      setSelectedProfile({
                        role: result.role,
                        userId: result.userId,
                        profileId: result.id,
                        name: result.name,
                      })
                    }
                    data-testid={`card-profile-${result.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 border-2 border-background">
                          <AvatarFallback className="bg-muted">
                            <RoleIcon className="h-5 w-5 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">{result.name}</h3>
                                {result.riskFlags && result.riskFlags > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="bg-red-500/10 text-red-600 border-red-500/20 gap-1"
                                  >
                                    <Flag className="h-3 w-3" />
                                    {result.riskFlags}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <Badge variant="outline" className={roleColors[result.role]}>
                                  {roleLabels[result.role]}
                                </Badge>
                                <StatusBadge status={accountStatus} size="sm" showIcon />
                                <StatusBadge status={verificationStatus} size="sm" showIcon />
                                <Badge variant="outline" className="text-xs">
                                  {result.countryCode}
                                </Badge>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`button-actions-${result.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProfile({
                                      role: result.role,
                                      userId: result.userId,
                                      profileId: result.id,
                                      name: result.name,
                                    });
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/admin/${result.role}s/${result.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Full Profile
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/admin/documents?userId=${result.userId}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Documents
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{result.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span>{result.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">KYC:</span>
                              <Progress value={result.kycCompleteness} className="h-1.5 flex-1" />
                              <span className="text-xs font-medium">{result.kycCompleteness}%</span>
                            </div>
                            {result.walletBalance !== null && (
                              <div className="flex items-center gap-1.5">
                                <Wallet className="h-3.5 w-3.5 shrink-0" />
                                <span
                                  className={
                                    result.negativeBalance && result.negativeBalance > 0
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }
                                >
                                  ${result.walletBalance.toFixed(2)}
                                  {result.negativeBalance && result.negativeBalance > 0 && (
                                    <span className="text-red-600 ml-1">
                                      (-${result.negativeBalance.toFixed(2)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Page {filters.page} of {data.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(filters.page - 1)}
                    disabled={filters.page <= 1}
                    className="gap-1"
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                      const pageNum =
                        data.totalPages <= 5
                          ? i + 1
                          : filters.page <= 3
                          ? i + 1
                          : filters.page >= data.totalPages - 2
                          ? data.totalPages - 4 + i
                          : filters.page - 2 + i;
                      return (
                        <Button
                          key={pageNum}
                          variant={filters.page === pageNum ? "secondary" : "ghost"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(filters.page + 1)}
                    disabled={filters.page >= data.totalPages}
                    className="gap-1"
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DetailDrawer
        open={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        title={selectedProfile?.name || "Profile Details"}
        subtitle={selectedProfile ? roleLabels[selectedProfile.role] : undefined}
        badge={
          selectedProfile && (
            <Badge variant="outline" className={roleColors[selectedProfile.role]}>
              {roleLabels[selectedProfile.role]}
            </Badge>
          )
        }
        width="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedProfile(null)}>
              Close
            </Button>
            {selectedProfile && (
              <Button asChild className="flex-1">
                <Link href={`/admin/${selectedProfile.role}s/${selectedProfile.profileId}`}>
                  Full Profile
                </Link>
              </Button>
            )}
          </div>
        }
      >
        {selectedProfile && (
          <ProfileDetailPanel
            role={selectedProfile.role}
            id={selectedProfile.userId}
            onClose={() => setSelectedProfile(null)}
          />
        )}
      </DetailDrawer>
    </div>
  );
}
