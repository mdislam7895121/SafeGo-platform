import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Navigation,
  Shield,
  TrendingUp,
  Clock,
  CheckCircle,
  RefreshCw,
  Route,
  Zap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SafetyEvent {
  id: string;
  tripType: string;
  tripId: string;
  eventType: string;
  priority: string;
  status: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

interface IncentiveRecommendation {
  id: string;
  countryCode: string;
  cityCode?: string;
  incentiveType: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  estimatedCost: number;
  targetDriverCount?: number;
  expiresAt?: string;
  createdAt: string;
}

interface RoutingConfig {
  id: string;
  countryCode: string;
  cityCode?: string;
  provider: string;
  distanceWeight: number;
  timeWeight: number;
  trafficWeight: number;
  safetyWeight: number;
  isActive: boolean;
}

interface SafetyStats {
  totalEvents: number;
  pendingEvents: number;
  resolvedToday: number;
  avgResponseTime: number;
}

function SafetyEventsPanel() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingAcknowledge, setPendingAcknowledge] = useState<string | null>(null);
  const [pendingResolve, setPendingResolve] = useState<string | null>(null);

  const queryUrl =
    statusFilter !== "all"
      ? `/api/phase5/admin/safety/events?status=${statusFilter}`
      : "/api/phase5/admin/safety/events";

  const { data: events = [], isLoading, isError, refetch } = useQuery<SafetyEvent[]>({
    queryKey: ["/api/phase5/admin/safety/events", statusFilter],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to fetch safety events");
      return res.json();
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (eventId: string) => {
      setPendingAcknowledge(eventId);
      return apiRequest(`/api/phase5/admin/safety/events/${eventId}/acknowledge`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Event acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/admin/safety/events", statusFilter] });
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/admin/safety/stats"] });
    },
    onError: () => {
      toast({ title: "Failed to acknowledge event", variant: "destructive" });
    },
    onSettled: () => {
      setPendingAcknowledge(null);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ eventId, notes }: { eventId: string; notes: string }) => {
      setPendingResolve(eventId);
      return apiRequest(`/api/phase5/admin/safety/events/${eventId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNotes: notes }),
      });
    },
    onSuccess: () => {
      toast({ title: "Event resolved" });
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/admin/safety/events", statusFilter] });
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/admin/safety/stats"] });
    },
    onError: () => {
      toast({ title: "Failed to resolve event", variant: "destructive" });
    },
    onSettled: () => {
      setPendingResolve(null);
    },
  });

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="font-medium" data-testid="text-safety-error">Failed to load safety events</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3"
            data-testid="button-retry-safety"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-safety-status">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-status-all">All Events</SelectItem>
            <SelectItem value="pending" data-testid="option-status-pending">Pending</SelectItem>
            <SelectItem value="acknowledged" data-testid="option-status-acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved" data-testid="option-status-resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-safety"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium" data-testid="text-no-events">No active safety events</p>
            <p className="text-sm text-muted-foreground">All clear!</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id} data-testid={`row-safety-event-${event.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium" data-testid={`text-event-type-${event.id}`}>
                      {event.eventType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trip: {event.tripId.slice(0, 8)}...
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" data-testid={`badge-trip-type-${event.id}`}>
                    {event.tripType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={event.priority === "critical" ? "destructive" : "secondary"}
                    data-testid={`badge-priority-${event.id}`}
                  >
                    {event.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      event.status === "resolved"
                        ? "default"
                        : event.status === "acknowledged"
                        ? "secondary"
                        : "destructive"
                    }
                    data-testid={`badge-status-${event.id}`}
                  >
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span data-testid={`text-time-${event.id}`}>
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 flex-wrap">
                    {event.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(event.id)}
                        disabled={pendingAcknowledge === event.id}
                        data-testid={`button-acknowledge-${event.id}`}
                      >
                        {pendingAcknowledge === event.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Acknowledge"
                        )}
                      </Button>
                    )}
                    {event.status !== "resolved" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          resolveMutation.mutate({
                            eventId: event.id,
                            notes: "Resolved by admin",
                          })
                        }
                        disabled={pendingResolve === event.id}
                        data-testid={`button-resolve-${event.id}`}
                      >
                        {pendingResolve === event.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Resolve"
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function IncentivesPanel() {
  const { toast } = useToast();
  const [countryCode, setCountryCode] = useState("US");
  const [pendingApprove, setPendingApprove] = useState<string | null>(null);
  const [pendingActivate, setPendingActivate] = useState<string | null>(null);

  const queryUrl = `/api/phase5/admin/incentives/recommendations?countryCode=${countryCode}`;

  const {
    data: recommendations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<IncentiveRecommendation[]>({
    queryKey: ["/api/phase5/admin/incentives/recommendations", countryCode],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/phase5/admin/incentives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode }),
      });
    },
    onSuccess: () => {
      toast({ title: "Recommendations generated" });
      queryClient.invalidateQueries({
        queryKey: ["/api/phase5/admin/incentives/recommendations", countryCode],
      });
    },
    onError: () => {
      toast({ title: "Failed to generate recommendations", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (recId: string) => {
      setPendingApprove(recId);
      return apiRequest(`/api/phase5/admin/incentives/${recId}/approve`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Recommendation approved" });
      queryClient.invalidateQueries({
        queryKey: ["/api/phase5/admin/incentives/recommendations", countryCode],
      });
    },
    onError: () => {
      toast({ title: "Failed to approve recommendation", variant: "destructive" });
    },
    onSettled: () => {
      setPendingApprove(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (recId: string) => {
      setPendingActivate(recId);
      return apiRequest(`/api/phase5/admin/incentives/${recId}/activate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Incentive activated" });
      queryClient.invalidateQueries({
        queryKey: ["/api/phase5/admin/incentives/recommendations", countryCode],
      });
    },
    onError: () => {
      toast({ title: "Failed to activate incentive", variant: "destructive" });
    },
    onSettled: () => {
      setPendingActivate(null);
    },
  });

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="font-medium" data-testid="text-incentives-error">
            Failed to load recommendations
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3"
            data-testid="button-retry-incentives"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Select value={countryCode} onValueChange={setCountryCode}>
          <SelectTrigger className="w-32" data-testid="select-incentive-country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="US" data-testid="option-country-us">US</SelectItem>
            <SelectItem value="BD" data-testid="option-country-bd">Bangladesh</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-incentives"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Generate
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            data-testid="button-refresh-incentives"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium" data-testid="text-no-recommendations">
              No recommendations
            </p>
            <p className="text-sm text-muted-foreground">
              Generate new incentive recommendations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Card key={rec.id} data-testid={`card-incentive-${rec.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4
                        className="font-medium truncate"
                        data-testid={`text-rec-title-${rec.id}`}
                      >
                        {rec.title}
                      </h4>
                      <Badge
                        variant={rec.priority === "high" ? "destructive" : "secondary"}
                        data-testid={`badge-rec-priority-${rec.id}`}
                      >
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-rec-status-${rec.id}`}>
                        {rec.status}
                      </Badge>
                    </div>
                    <p
                      className="text-sm text-muted-foreground mb-2"
                      data-testid={`text-rec-desc-${rec.id}`}
                    >
                      {rec.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span data-testid={`text-rec-type-${rec.id}`}>
                        Type: {rec.incentiveType}
                      </span>
                      <span data-testid={`text-rec-cost-${rec.id}`}>
                        Cost: ${Number(rec.estimatedCost).toFixed(2)}
                      </span>
                      {rec.targetDriverCount && (
                        <span data-testid={`text-rec-target-${rec.id}`}>
                          Target: {rec.targetDriverCount} drivers
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {rec.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMutation.mutate(rec.id)}
                        disabled={pendingApprove === rec.id}
                        data-testid={`button-approve-${rec.id}`}
                      >
                        {pendingApprove === rec.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Approve"
                        )}
                      </Button>
                    )}
                    {rec.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => activateMutation.mutate(rec.id)}
                        disabled={pendingActivate === rec.id}
                        data-testid={`button-activate-${rec.id}`}
                      >
                        {pendingActivate === rec.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Activate"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutingConfigPanel() {
  const [countryCode, setCountryCode] = useState("US");

  const queryUrl = `/api/phase5/admin/routing/config/${countryCode}`;

  const { data: config, isLoading, isError, refetch } = useQuery<RoutingConfig>({
    queryKey: ["/api/phase5/admin/routing/config", countryCode],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to fetch routing config");
      return res.json();
    },
  });

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="font-medium" data-testid="text-routing-error">
            Failed to load routing config
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3"
            data-testid="button-retry-routing"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Select value={countryCode} onValueChange={setCountryCode}>
          <SelectTrigger className="w-32" data-testid="select-routing-country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="US" data-testid="option-routing-us">US</SelectItem>
            <SelectItem value="BD" data-testid="option-routing-bd">Bangladesh</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : config ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Provider</span>
                <Badge data-testid="text-provider">{config.provider}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant={config.isActive ? "default" : "secondary"}
                  data-testid="text-routing-status"
                >
                  {config.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Optimization Weights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Distance</span>
                <span className="font-medium" data-testid="text-distance-weight">
                  {config.distanceWeight}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Time</span>
                <span className="font-medium" data-testid="text-time-weight">
                  {config.timeWeight}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Traffic</span>
                <span className="font-medium" data-testid="text-traffic-weight">
                  {config.trafficWeight}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Safety</span>
                <span className="font-medium" data-testid="text-safety-weight">
                  {config.safetyWeight}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground" data-testid="text-no-config">
              No configuration found
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Phase5Dashboard() {
  const { data: safetyStats } = useQuery<SafetyStats>({
    queryKey: ["/api/phase5/admin/safety/stats"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Phase 5: Experience Intelligence
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Real-time optimization and safety management
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Navigation</p>
                <p className="text-2xl font-bold" data-testid="text-stat-navigation">
                  -
                </p>
              </div>
              <Navigation className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Safety</p>
                <p className="text-2xl font-bold" data-testid="text-stat-pending">
                  {safetyStats?.pendingEvents || 0}
                </p>
              </div>
              <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
                <p className="text-2xl font-bold" data-testid="text-stat-resolved">
                  {safetyStats?.resolvedToday || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold" data-testid="text-stat-response">
                  {safetyStats?.avgResponseTime || 0}m
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="safety" className="space-y-4">
        <TabsList>
          <TabsTrigger value="safety" className="gap-2" data-testid="tab-safety">
            <Shield className="h-4 w-4" />
            Safety Events
          </TabsTrigger>
          <TabsTrigger value="incentives" className="gap-2" data-testid="tab-incentives">
            <TrendingUp className="h-4 w-4" />
            Incentives
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-2" data-testid="tab-routing">
            <Route className="h-4 w-4" />
            Routing Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="safety">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-safety-title">Safety Events Management</CardTitle>
              <CardDescription data-testid="text-safety-desc">
                Monitor and respond to safety incidents in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SafetyEventsPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incentives">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-incentives-title">
                Incentive Recommendations
              </CardTitle>
              <CardDescription data-testid="text-incentives-desc">
                AI-generated driver incentive optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncentivesPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-routing-title">Routing Configuration</CardTitle>
              <CardDescription data-testid="text-routing-desc">
                Configure route optimization parameters by country
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoutingConfigPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
