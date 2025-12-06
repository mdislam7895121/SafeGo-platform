import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Star,
  Users,
  Car,
  Store,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  XCircle,
  Flag,
  Shield,
  BarChart3,
  Activity,
  Unlock,
} from "lucide-react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";

export default function ReputationCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [flagFilter, setFlagFilter] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/reputation/stats"],
  });

  const { data: customerRatings } = useQuery({
    queryKey: ["/api/admin/reputation/customer-ratings"],
  });

  const { data: driverRatings } = useQuery({
    queryKey: ["/api/admin/reputation/driver-ratings"],
  });

  const { data: partnerRatings } = useQuery({
    queryKey: ["/api/admin/reputation/partner-ratings"],
  });

  const { data: flags } = useQuery({
    queryKey: ["/api/admin/reputation/flags", flagFilter],
  });

  const { data: distribution } = useQuery({
    queryKey: ["/api/admin/reputation/distribution"],
  });

  const { data: dailyTrend } = useQuery({
    queryKey: ["/api/admin/reputation/daily-trend"],
  });

  const overrideFlagMutation = useMutation({
    mutationFn: async ({ flagId, reason }: { flagId: string; reason: string }) => {
      return apiRequest(`/api/admin/reputation/flags/${flagId}/override`, {
        method: "POST",
        body: JSON.stringify({ adminId: "admin", reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Flag Overridden", description: "Restriction has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reputation/flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reputation/stats"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to override flag", variant: "destructive" });
    },
  });

  const clearRestrictionMutation = useMutation({
    mutationFn: async ({ userId, userRole, reason }: { userId: string; userRole: string; reason: string }) => {
      return apiRequest(`/api/admin/reputation/clear-restriction/${userId}`, {
        method: "POST",
        body: JSON.stringify({ userRole, adminId: "admin", reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Restriction Cleared", description: "User restriction has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reputation"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear restriction", variant: "destructive" });
    },
  });

  const formatRating = (rating: number) => {
    return rating?.toFixed(2) || "5.00";
  };

  const getRatingBadge = (rating: number) => {
    if (rating >= 4.5) return <Badge className="bg-green-500">Excellent</Badge>;
    if (rating >= 4.0) return <Badge className="bg-blue-500">Good</Badge>;
    if (rating >= 3.5) return <Badge className="bg-yellow-500">Fair</Badge>;
    if (rating >= 3.0) return <Badge className="bg-orange-500">Low</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  const distributionData = distribution ? [
    { star: "1 Star", driver: distribution.driver?.[1] || 0, customer: distribution.customer?.[1] || 0, partner: distribution.partner?.[1] || 0 },
    { star: "2 Stars", driver: distribution.driver?.[2] || 0, customer: distribution.customer?.[2] || 0, partner: distribution.partner?.[2] || 0 },
    { star: "3 Stars", driver: distribution.driver?.[3] || 0, customer: distribution.customer?.[3] || 0, partner: distribution.partner?.[3] || 0 },
    { star: "4 Stars", driver: distribution.driver?.[4] || 0, customer: distribution.customer?.[4] || 0, partner: distribution.partner?.[4] || 0 },
    { star: "5 Stars", driver: distribution.driver?.[5] || 0, customer: distribution.customer?.[5] || 0, partner: distribution.partner?.[5] || 0 },
  ] : [];

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Reputation & Performance Center</h1>
            <p className="text-muted-foreground">SafeGo Master Tasks 37-42: Ratings & Reputation Engine</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries()}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Driver Ratings</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-driver-ratings">
              {stats?.totalDriverRatings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatRating(stats?.averages?.driver)} | Restricted: {stats?.restrictedDrivers || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Ratings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-customer-ratings">
              {stats?.totalCustomerRatings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatRating(stats?.averages?.customer)} | Restricted: {stats?.restrictedCustomers || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Ratings</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-partner-ratings">
              {stats?.totalPartnerRatings || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatRating(stats?.averages?.partner)} | Restricted: {stats?.restrictedPartners || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Flags</CardTitle>
            <Flag className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-flags">
              {stats?.activeFlags || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Ratings today: {stats?.recentSubmissions24h || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Customer Ratings</TabsTrigger>
          <TabsTrigger value="drivers" data-testid="tab-drivers">Driver Ratings</TabsTrigger>
          <TabsTrigger value="partners" data-testid="tab-partners">Partner Ratings</TabsTrigger>
          <TabsTrigger value="flags" data-testid="tab-flags">Reputation Flags</TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Rating Distribution
                </CardTitle>
                <CardDescription>Breakdown of ratings by star count</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="star" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="driver" fill="#3b82f6" name="Drivers" />
                    <Bar dataKey="customer" fill="#22c55e" name="Customers" />
                    <Bar dataKey="partner" fill="#f59e0b" name="Partners" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Daily Rating Trend
                </CardTitle>
                <CardDescription>Average ratings over the past 7 days</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[1, 5]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="driverAvg" stroke="#3b82f6" name="Drivers" strokeWidth={2} />
                    <Line type="monotone" dataKey="customerAvg" stroke="#22c55e" name="Customers" strokeWidth={2} />
                    <Line type="monotone" dataKey="partnerAvg" stroke="#f59e0b" name="Partners" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reputation Flags</CardTitle>
              <CardDescription>Latest auto-restrictions and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Flag Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(flags?.flags || []).slice(0, 5).map((flag: any) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-mono text-xs">{flag.userId.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline">{flag.userRole}</Badge>
                      </TableCell>
                      <TableCell>{flag.flagType.replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Badge variant={flag.severity === "critical" ? "destructive" : flag.severity === "high" ? "default" : "secondary"}>
                          {flag.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={flag.status === "active" ? "destructive" : "secondary"}>
                          {flag.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(flag.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {flag.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => overrideFlagMutation.mutate({ flagId: flag.id, reason: "Admin override" })}
                            disabled={overrideFlagMutation.isPending}
                            data-testid={`button-override-${flag.id}`}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Override
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!flags?.flags || flags.flags.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No reputation flags found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Ratings
              </CardTitle>
              <CardDescription>All customer rating records sorted by average rating</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Average Rating</TableHead>
                    <TableHead>Total Ratings</TableHead>
                    <TableHead>1-5 Breakdown</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(customerRatings?.ratings || []).map((rating: any) => (
                    <TableRow key={rating.id}>
                      <TableCell className="font-mono text-xs">{rating.customerId.slice(0, 12)}...</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold">{formatRating(rating.averageRating)}</span>
                          {getRatingBadge(rating.averageRating)}
                        </div>
                      </TableCell>
                      <TableCell>{rating.totalRatings}</TableCell>
                      <TableCell className="text-xs">
                        {rating.oneStarCount}/{rating.twoStarCount}/{rating.threeStarCount}/{rating.fourStarCount}/{rating.fiveStarCount}
                      </TableCell>
                      <TableCell>
                        {rating.isRestricted ? (
                          <Badge variant="destructive">Restricted</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rating.isRestricted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => clearRestrictionMutation.mutate({
                              userId: rating.customerId,
                              userRole: "customer",
                              reason: "Admin override"
                            })}
                            disabled={clearRestrictionMutation.isPending}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!customerRatings?.ratings || customerRatings.ratings.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No customer ratings found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Driver Ratings
              </CardTitle>
              <CardDescription>All driver rating records sorted by average rating</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver ID</TableHead>
                    <TableHead>Average Rating</TableHead>
                    <TableHead>Total Ratings</TableHead>
                    <TableHead>Priority Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(driverRatings?.ratings || []).map((rating: any) => (
                    <TableRow key={rating.id}>
                      <TableCell className="font-mono text-xs">{rating.driverId.slice(0, 12)}...</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold">{formatRating(rating.averageRating)}</span>
                          {getRatingBadge(rating.averageRating)}
                        </div>
                      </TableCell>
                      <TableCell>{rating.totalRatings}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${rating.priorityScore}%` }}
                            />
                          </div>
                          <span className="text-xs">{rating.priorityScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rating.isRestricted ? (
                          <Badge variant="destructive">{rating.restrictionLevel || "Restricted"}</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rating.isRestricted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => clearRestrictionMutation.mutate({
                              userId: rating.driverId,
                              userRole: "driver",
                              reason: "Admin override"
                            })}
                            disabled={clearRestrictionMutation.isPending}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!driverRatings?.ratings || driverRatings.ratings.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No driver ratings found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Partner Ratings
              </CardTitle>
              <CardDescription>All partner/restaurant rating records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Average Rating</TableHead>
                    <TableHead>Total Ratings</TableHead>
                    <TableHead>Visibility Rank</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(partnerRatings?.ratings || []).map((rating: any) => (
                    <TableRow key={rating.id}>
                      <TableCell className="font-mono text-xs">{rating.partnerId.slice(0, 12)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rating.partnerType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold">{formatRating(rating.averageRating)}</span>
                          {getRatingBadge(rating.averageRating)}
                        </div>
                      </TableCell>
                      <TableCell>{rating.totalRatings}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-amber-500 rounded-full"
                              style={{ width: `${rating.searchVisibilityRank}%` }}
                            />
                          </div>
                          <span className="text-xs">{rating.searchVisibilityRank}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rating.isRestricted ? (
                          <Badge variant="destructive">Reduced Visibility</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rating.isRestricted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => clearRestrictionMutation.mutate({
                              userId: rating.partnerId,
                              userRole: "partner",
                              reason: "Admin override"
                            })}
                            disabled={clearRestrictionMutation.isPending}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!partnerRatings?.ratings || partnerRatings.ratings.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No partner ratings found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="h-5 w-5" />
                    Reputation Flags
                  </CardTitle>
                  <CardDescription>Auto-restrictions and warnings triggered by low ratings</CardDescription>
                </div>
                <Select value={flagFilter} onValueChange={setFlagFilter}>
                  <SelectTrigger className="w-40" data-testid="select-flag-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Flags</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="overridden">Overridden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Flag Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Restriction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(flags?.flags || []).map((flag: any) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-mono text-xs">{flag.userId.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline">{flag.userRole}</Badge>
                      </TableCell>
                      <TableCell>{flag.flagType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{flag.flagReason}</TableCell>
                      <TableCell>
                        <Badge variant={flag.severity === "critical" ? "destructive" : flag.severity === "high" ? "default" : "secondary"}>
                          {flag.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {flag.restrictionApplied ? (
                          <Badge variant="outline">{flag.restrictionApplied}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {flag.status === "active" ? (
                          <Badge variant="destructive">Active</Badge>
                        ) : flag.status === "overridden" ? (
                          <Badge className="bg-blue-500">Overridden</Badge>
                        ) : (
                          <Badge variant="secondary">{flag.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(flag.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {flag.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => overrideFlagMutation.mutate({ flagId: flag.id, reason: "Admin manual override" })}
                            disabled={overrideFlagMutation.isPending}
                            data-testid={`button-override-flag-${flag.id}`}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Override
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!flags?.flags || flags.flags.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No reputation flags found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution by Role</CardTitle>
                <CardDescription>Number of ratings at each star level</CardDescription>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="star" type="category" width={60} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="driver" fill="#3b82f6" name="Drivers" />
                    <Bar dataKey="customer" fill="#22c55e" name="Customers" />
                    <Bar dataKey="partner" fill="#f59e0b" name="Partners" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7-Day Rating Trend</CardTitle>
                <CardDescription>Average ratings over the past week</CardDescription>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[1, 5]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="driverAvg" stroke="#3b82f6" name="Drivers" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="customerAvg" stroke="#22c55e" name="Customers" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="partnerAvg" stroke="#f59e0b" name="Partners" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Daily Rating Volume</CardTitle>
                <CardDescription>Number of ratings submitted per day</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="driverCount" fill="#3b82f6" name="Driver Ratings" />
                    <Bar dataKey="customerCount" fill="#22c55e" name="Customer Ratings" />
                    <Bar dataKey="partnerCount" fill="#f59e0b" name="Partner Ratings" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
