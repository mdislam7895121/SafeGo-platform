import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Filter, MoreHorizontal, Eye, Shield, ShieldAlert, User, Car, UtensilsCrossed, Store, Sparkles, MapPin, Phone, Mail, CheckCircle, XCircle, Clock, AlertCircle, Wallet, ExternalLink, ChevronDown, ChevronUp, FileText, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchWithAuth, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
}

interface PeopleKycResponse {
  results: PeopleKycResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  customer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  driver: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  shop_partner: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  ticket_operator: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

function getStatusBadge(result: PeopleKycResult) {
  if (result.isBlocked) {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Blocked</Badge>;
  }
  if (result.isSuspended) {
    return <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1"><AlertCircle className="h-3 w-3" />Suspended</Badge>;
  }
  return <Badge variant="outline" className="text-green-600 border-green-600 gap-1"><CheckCircle className="h-3 w-3" />Active</Badge>;
}

function getVerificationBadge(status: string, isVerified: boolean) {
  if (isVerified || status === "approved") {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1"><CheckCircle className="h-3 w-3" />Verified</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="outline" className="text-amber-600 border-amber-600 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
  }
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Unverified</Badge>;
}

function ProfileDetailPanel({ role, id, onClose }: { role: string; id: string; onClose: () => void }) {
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
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p>Failed to load profile details</p>
      </div>
    );
  }

  const { profile, activitySummary, walletSummary, riskSummary } = data;

  return (
    <ScrollArea className="h-[70vh]">
      <div className="space-y-6 p-1">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.profilePhotoUrl} />
            <AvatarFallback className="text-lg">
              {profile.firstName?.[0] || profile.name?.[0] || profile.shopName?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {profile.firstName && profile.lastName 
                ? `${profile.firstName} ${profile.lastName}`
                : profile.name || profile.shopName || profile.businessName || "N/A"}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>
              {getVerificationBadge(profile.verificationStatus, profile.isVerified)}
              {(profile.isBlocked || profile.isSuspended) && (
                <Badge variant="destructive">{profile.isBlocked ? "Blocked" : "Suspended"}</Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Contact Information
          </h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{profile.email || profile.user?.email || "No email"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{profile.phone || "No phone"}</span>
            </div>
            {(profile.address || profile.presentAddress || profile.homeAddress) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{profile.address || profile.presentAddress || profile.homeAddress}</span>
              </div>
            )}
            {profile.countryCode && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Country:</span>
                <Badge variant="outline">{profile.countryCode}</Badge>
              </div>
            )}
          </div>
        </div>

        {activitySummary && Object.keys(activitySummary).length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Activity Summary
              </h4>
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
                {activitySummary.parcelsCount !== undefined && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold">{activitySummary.parcelsCount}</p>
                    <p className="text-xs text-muted-foreground">Parcels</p>
                  </div>
                )}
                {activitySummary.avgRating !== undefined && activitySummary.avgRating > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold">{activitySummary.avgRating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </div>
                )}
                {activitySummary.complaintsCount !== undefined && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold">{activitySummary.complaintsCount}</p>
                    <p className="text-xs text-muted-foreground">Complaints</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {walletSummary && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Wallet Summary
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">${walletSummary.balance?.toFixed(2) || "0.00"}</p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
                {walletSummary.negativeBalance > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-red-600">-${walletSummary.negativeBalance?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Negative Balance</p>
                  </div>
                )}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">${walletSummary.lifetimeEarnings?.toFixed(2) || "0.00"}</p>
                  <p className="text-xs text-muted-foreground">Lifetime Earnings</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">${walletSummary.pendingBalance?.toFixed(2) || "0.00"}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
          </>
        )}

        {riskSummary && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Risk Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{riskSummary.recentEvents}</p>
                  <p className="text-xs text-muted-foreground">Recent Events</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className={`text-2xl font-bold ${riskSummary.openCases > 0 ? "text-red-600" : ""}`}>{riskSummary.openCases}</p>
                  <p className="text-xs text-muted-foreground">Open Cases</p>
                </div>
              </div>
              {riskSummary.events && riskSummary.events.length > 0 && (
                <div className="space-y-2">
                  {riskSummary.events.slice(0, 3).map((event: any) => (
                    <div key={event.id} className="bg-muted/30 rounded p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <Badge variant={event.severity === "critical" ? "destructive" : event.severity === "high" ? "outline" : "secondary"} className="text-[10px]">
                          {event.severity}
                        </Badge>
                        <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 truncate">{event.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-4">
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
    </ScrollArea>
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

  const [selectedProfile, setSelectedProfile] = useState<{ role: string; id: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useQuery<PeopleKycResponse>({
    queryKey: ["/api/admin/people-kyc", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
      });
      const res = await fetchWithAuth(`/api/admin/people-kyc?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      await throwIfResNotOk(res);
      return res.json();
    },
  });

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
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
  };

  const activeFilterCount = [
    filters.role !== "all",
    filters.country !== "all",
    filters.verification !== "all",
    filters.status !== "all",
    filters.search !== "",
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground px-4 sm:px-6 md:px-8 py-5 sm:py-6 rounded-b-2xl sm:rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">People & KYC Center</h1>
            <p className="text-xs sm:text-sm opacity-90">Unified user management and verification</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 bg-primary-foreground text-foreground"
              data-testid="input-search"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground relative gap-1.5"
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="h-5 min-w-5 p-0 flex items-center justify-center text-xs bg-primary-foreground text-primary">
                {activeFilterCount}
              </Badge>
            )}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {showFilters && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                  <Select value={filters.role} onValueChange={(v) => handleFilterChange("role", v)}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
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
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Country</label>
                  <Select value={filters.country} onValueChange={(v) => handleFilterChange("country", v)}>
                    <SelectTrigger data-testid="select-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Verification</label>
                  <Select value={filters.verification} onValueChange={(v) => handleFilterChange("verification", v)}>
                    <SelectTrigger data-testid="select-verification">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                  <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {activeFilterCount > 0 && (
                <div className="flex justify-end mt-3">
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    Clear all filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6">
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium">Failed to load data</p>
              <p className="text-sm">Please try again later</p>
            </CardContent>
          </Card>
        ) : data?.results.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Showing {data?.results.length || 0} of {data?.total || 0} results
              </p>
            </div>

            <div className="grid gap-4">
              {data?.results.map((result) => {
                const RoleIcon = roleIcons[result.role] || User;
                return (
                  <Card key={`${result.role}-${result.id}`} className="hover-elevate cursor-pointer" onClick={() => setSelectedProfile({ role: result.role, id: result.id })} data-testid={`card-profile-${result.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${roleColors[result.role]?.replace("text-", "bg-").replace("-800", "-100").replace("-200", "-900") || "bg-gray-100"}`}>
                          <RoleIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold truncate">{result.name}</h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge className={roleColors[result.role]}>{roleLabels[result.role]}</Badge>
                                {getStatusBadge(result)}
                                {getVerificationBadge(result.verificationStatus, result.isVerified)}
                                <Badge variant="outline">{result.countryCode}</Badge>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-view-${result.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1 truncate">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{result.email}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span>{result.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs">KYC:</span>
                              <Progress value={result.kycCompleteness} className="h-1.5 flex-1" />
                              <span className="text-xs font-medium">{result.kycCompleteness}%</span>
                            </div>
                            {result.walletBalance !== null && (
                              <div className="flex items-center gap-1">
                                <Wallet className="h-3.5 w-3.5 shrink-0" />
                                <span className={result.negativeBalance && result.negativeBalance > 0 ? "text-red-600" : "text-green-600"}>
                                  ${result.walletBalance.toFixed(2)}
                                  {result.negativeBalance && result.negativeBalance > 0 && (
                                    <span className="text-red-600 ml-1">(-${result.negativeBalance.toFixed(2)})</span>
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
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page <= 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {filters.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= data.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profile Details</DialogTitle>
            <DialogDescription>View user information and activity summary</DialogDescription>
          </DialogHeader>
          {selectedProfile && (
            <ProfileDetailPanel
              role={selectedProfile.role}
              id={selectedProfile.id}
              onClose={() => setSelectedProfile(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
