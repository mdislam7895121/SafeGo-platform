import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Car,
  UtensilsCrossed,
  Package,
  TrendingUp,
  TrendingDown,
  Users,
  Star,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  MapPin,
  Lightbulb,
  Zap,
  Shield,
  RefreshCw,
  ChevronRight,
  UserX,
  UserCheck,
  Gift,
  DollarSign,
  FileCheck,
  BookOpen,
  Map,
  Store,
  Search,
  BarChart3,
  Gauge,
  ThermometerSun,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsSummary {
  totalRides?: number;
  completedRides?: number;
  revenue?: number;
  completionRate?: number;
  totalOrders?: number;
  completedOrders?: number;
  avgOrderValue?: number;
  totalDeliveries?: number;
  successRate?: number;
}

interface DriverPerformance {
  id: string;
  name: string;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  performanceScore: number;
  rank: number;
  totalRides: number;
}

interface Insight {
  id: string;
  type: "opportunity" | "warning" | "attention" | "action_required";
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  actions?: { label: string; action: string; icon: string }[];
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  status: string;
  createdAt: string;
}

interface HealthStatus {
  status: string;
  score: number;
  system: {
    cpu: { usage: number; cores: number };
    memory: { usage: number; total: number; used: number; free: number };
    uptime: number;
  };
  services: { name: string; status: string; latency?: number; uptime?: number }[];
}

const SeverityBadge = ({ severity }: { severity: string }) => {
  const colors: Record<string, string> = {
    critical: "bg-red-500 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-500 text-black",
    low: "bg-blue-500 text-white",
  };
  return (
    <Badge className={cn("text-xs", colors[severity] || "bg-gray-500")}>
      {severity.toUpperCase()}
    </Badge>
  );
};

const InsightIcon = ({ type }: { type: string }) => {
  const icons: Record<string, any> = {
    opportunity: TrendingUp,
    warning: AlertTriangle,
    attention: AlertCircle,
    action_required: Zap,
  };
  const colors: Record<string, string> = {
    opportunity: "text-green-500",
    warning: "text-yellow-500",
    attention: "text-orange-500",
    action_required: "text-red-500",
  };
  const Icon = icons[type] || Lightbulb;
  return <Icon className={cn("h-5 w-5", colors[type] || "text-blue-500")} />;
};

const ActionIcon = ({ icon }: { icon: string }) => {
  const icons: Record<string, any> = {
    UserPlus: Users,
    Map: MapPin,
    Gift: Gift,
    TrendingUp: TrendingUp,
    Users: Users,
    BookOpen: BookOpen,
    FileCheck: FileCheck,
    UserCheck: UserCheck,
    DollarSign: DollarSign,
    Clock: Clock,
    MapPin: MapPin,
    Store: Store,
    Search: Search,
    Shield: Shield,
  };
  const Icon = icons[icon] || ChevronRight;
  return <Icon className="h-4 w-4" />;
};

function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color,
  format = "number"
}: { 
  title: string; 
  value: number; 
  change?: number;
  icon: any; 
  color: string;
  format?: "number" | "percent" | "currency";
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "percent": return `${val.toFixed(1)}%`;
      case "currency": return `$${val.toLocaleString()}`;
      default: return val.toLocaleString();
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{formatValue(value)}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {change >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={cn("text-xs", change >= 0 ? "text-green-500" : "text-red-500")}>
                  {Math.abs(change).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceHealthIndicator({ service }: { service: { name: string; status: string; latency?: number } }) {
  const statusColors: Record<string, string> = {
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    down: "bg-red-500",
    idle: "bg-gray-400",
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", statusColors[service.status] || "bg-gray-400")} />
        <span className="text-sm font-medium">{service.name}</span>
      </div>
      {service.latency !== undefined && (
        <span className="text-xs text-muted-foreground">{service.latency}ms</span>
      )}
    </div>
  );
}

export default function IntelligenceDashboard() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState("7d");
  const [activeTab, setActiveTab] = useState("overview");

  const headers = { Authorization: `Bearer ${token}` };

  const { data: ridesAnalytics, isLoading: loadingRides } = useQuery({
    queryKey: ["/api/admin/phase3c/analytics/rides", period],
    queryFn: () => fetch(`/api/admin/phase3c/analytics/rides?period=${period}`, { headers }).then(r => r.json()),
  });

  const { data: eatsAnalytics, isLoading: loadingEats } = useQuery({
    queryKey: ["/api/admin/phase3c/analytics/eats", period],
    queryFn: () => fetch(`/api/admin/phase3c/analytics/eats?period=${period}`, { headers }).then(r => r.json()),
  });

  const { data: parcelAnalytics, isLoading: loadingParcel } = useQuery({
    queryKey: ["/api/admin/phase3c/analytics/parcel", period],
    queryFn: () => fetch(`/api/admin/phase3c/analytics/parcel?period=${period}`, { headers }).then(r => r.json()),
  });

  const { data: driverIntelligence, isLoading: loadingDrivers } = useQuery({
    queryKey: ["/api/admin/phase3c/intelligence/drivers"],
    queryFn: () => fetch("/api/admin/phase3c/intelligence/drivers", { headers }).then(r => r.json()),
  });

  const { data: satisfaction, isLoading: loadingSatisfaction } = useQuery({
    queryKey: ["/api/admin/phase3c/intelligence/satisfaction", period],
    queryFn: () => fetch(`/api/admin/phase3c/intelligence/satisfaction?period=${period}`, { headers }).then(r => r.json()),
  });

  const { data: fraudData, isLoading: loadingFraud } = useQuery({
    queryKey: ["/api/admin/phase3c/intelligence/fraud"],
    queryFn: () => fetch("/api/admin/phase3c/intelligence/fraud", { headers }).then(r => r.json()),
  });

  const { data: healthData, isLoading: loadingHealth } = useQuery({
    queryKey: ["/api/admin/phase3c/intelligence/health"],
    queryFn: () => fetch("/api/admin/phase3c/intelligence/health", { headers }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["/api/admin/phase3c/intelligence/insights"],
    queryFn: () => fetch("/api/admin/phase3c/intelligence/insights", { headers }).then(r => r.json()),
  });

  const { data: incidents, isLoading: loadingIncidents } = useQuery({
    queryKey: ["/api/admin/phase3c/intelligence/incidents"],
    queryFn: () => fetch("/api/admin/phase3c/intelligence/incidents", { headers }).then(r => r.json()),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ actionType, targetId, reason }: { actionType: string; targetId: string; reason?: string }) => {
      return apiRequest("POST", `/api/admin/phase3c/intelligence/actions/${actionType}`, { targetId, reason });
    },
    onSuccess: () => {
      toast({ title: "Action executed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3c"] });
    },
    onError: () => {
      toast({ title: "Failed to execute action", variant: "destructive" });
    },
  });

  const handleAction = (action: string, targetId?: string) => {
    if (targetId) {
      actionMutation.mutate({ actionType: action, targetId });
    } else {
      toast({ title: `Action: ${action}`, description: "Feature navigation triggered" });
    }
  };

  const isLoading = loadingRides || loadingEats || loadingParcel;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Intelligence Dashboard</h1>
          <p className="text-muted-foreground">Enterprise analytics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
          <TabsTrigger value="drivers" data-testid="tab-drivers">Drivers</TabsTrigger>
          <TabsTrigger value="satisfaction" data-testid="tab-satisfaction">Satisfaction</TabsTrigger>
          <TabsTrigger value="fraud" data-testid="tab-fraud">Fraud</TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">Health</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Revenue"
              value={(ridesAnalytics?.summary?.revenue || 0) + (eatsAnalytics?.summary?.revenue || 0) + (parcelAnalytics?.summary?.revenue || 0)}
              change={12.5}
              icon={DollarSign}
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              format="currency"
            />
            <MetricCard
              title="Total Trips"
              value={(ridesAnalytics?.summary?.totalRides || 0) + (eatsAnalytics?.summary?.totalOrders || 0) + (parcelAnalytics?.summary?.totalDeliveries || 0)}
              change={8.3}
              icon={Activity}
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <MetricCard
              title="Avg Completion Rate"
              value={((ridesAnalytics?.summary?.completionRate || 0) + (eatsAnalytics?.summary?.completionRate || 0) + (parcelAnalytics?.summary?.successRate || 0)) / 3}
              change={2.1}
              icon={CheckCircle}
              color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
              format="percent"
            />
            <MetricCard
              title="Platform Health"
              value={healthData?.score || 0}
              icon={Gauge}
              color={healthData?.score > 80 ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"}
              format="percent"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Active Insights
                </CardTitle>
                <CardDescription>AI-generated recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {loadingInsights ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insights?.insights?.slice(0, 5).map((insight: Insight) => (
                        <div key={insight.id} className="p-3 rounded-lg border bg-card hover-elevate">
                          <div className="flex items-start gap-3">
                            <InsightIcon type={insight.type} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{insight.title}</p>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {insight.impact}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {insight.description}
                              </p>
                              {insight.actions && insight.actions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {insight.actions.slice(0, 2).map((action, i) => (
                                    <Button
                                      key={i}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => handleAction(action.action)}
                                      data-testid={`button-action-${action.action}`}
                                    >
                                      <ActionIcon icon={action.icon} />
                                      {action.label}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Active Incidents
                </CardTitle>
                <CardDescription>Requires attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {loadingIncidents ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : incidents?.incidents?.length > 0 ? (
                    <div className="space-y-3">
                      {incidents.incidents.slice(0, 5).map((incident: Incident) => (
                        <div key={incident.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{incident.title}</p>
                                <SeverityBadge severity={incident.severity} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {incident.description}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" className="shrink-0">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">No active incidents</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="h-5 w-5 text-purple-500" />
                  Rides
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingRides ? (
                  <Skeleton className="h-32" />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{ridesAnalytics?.summary?.totalRides || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Rides</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">${(ridesAnalytics?.summary?.revenue || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Completion Rate</span>
                        <span>{ridesAnalytics?.summary?.completionRate || 0}%</span>
                      </div>
                      <Progress value={ridesAnalytics?.summary?.completionRate || 0} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                  Eats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingEats ? (
                  <Skeleton className="h-32" />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{eatsAnalytics?.summary?.totalOrders || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Orders</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">${(eatsAnalytics?.summary?.revenue || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Completion Rate</span>
                        <span>{eatsAnalytics?.summary?.completionRate || 0}%</span>
                      </div>
                      <Progress value={eatsAnalytics?.summary?.completionRate || 0} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  Parcel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingParcel ? (
                  <Skeleton className="h-32" />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{parcelAnalytics?.summary?.totalDeliveries || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Deliveries</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">${(parcelAnalytics?.summary?.revenue || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Success Rate</span>
                        <span>{parcelAnalytics?.summary?.successRate || 0}%</span>
                      </div>
                      <Progress value={parcelAnalytics?.summary?.successRate || 0} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Total Drivers"
              value={driverIntelligence?.summary?.totalDrivers || 0}
              icon={Users}
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <MetricCard
              title="Avg Acceptance Rate"
              value={driverIntelligence?.summary?.avgAcceptanceRate || 0}
              icon={CheckCircle}
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              format="percent"
            />
            <MetricCard
              title="Avg Cancellation Rate"
              value={driverIntelligence?.summary?.avgCancellationRate || 0}
              icon={UserX}
              color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              format="percent"
            />
            <MetricCard
              title="Avg Rating"
              value={driverIntelligence?.summary?.avgRating || 0}
              icon={Star}
              color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Performers</CardTitle>
                <CardDescription>Highest performing drivers this month</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  {loadingDrivers ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14" />)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {driverIntelligence?.topPerformers?.map((driver: DriverPerformance, i: number) => (
                        <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                              i === 0 ? "bg-yellow-100 text-yellow-700" :
                              i === 1 ? "bg-gray-100 text-gray-700" :
                              i === 2 ? "bg-orange-100 text-orange-700" :
                              "bg-muted text-muted-foreground"
                            )}>
                              #{i + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{driver.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {driver.totalRides} rides | {driver.acceptanceRate}% acceptance
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium">{driver.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Needs Attention
                </CardTitle>
                <CardDescription>Drivers with performance issues</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  {loadingDrivers ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
                    </div>
                  ) : driverIntelligence?.needsAttention?.length > 0 ? (
                    <div className="space-y-2">
                      {driverIntelligence.needsAttention.map((driver: DriverPerformance) => (
                        <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
                          <div>
                            <p className="font-medium text-sm">{driver.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {driver.cancellationRate}% cancellation | Score: {driver.performanceScore}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleAction("flag_review", driver.id)}>
                            Review
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">All drivers performing well</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="satisfaction" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="CSAT Score"
              value={satisfaction?.summary?.csatScore || 0}
              icon={Star}
              color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
              format="percent"
            />
            <MetricCard
              title="NPS Score"
              value={satisfaction?.npsScore || 0}
              icon={TrendingUp}
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <MetricCard
              title="Total Reviews"
              value={satisfaction?.summary?.totalReviews || 0}
              icon={Users}
              color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            />
            <MetricCard
              title="Low Ratings"
              value={satisfaction?.summary?.lowRatingCount || 0}
              icon={AlertTriangle}
              color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Low Rating Alerts</CardTitle>
              <CardDescription>Recent 1-2 star reviews requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {loadingSatisfaction ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : satisfaction?.lowRatingAlerts?.length > 0 ? (
                  <div className="space-y-3">
                    {satisfaction.lowRatingAlerts.map((alert: any) => (
                      <div key={alert.id} className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} className={cn("h-4 w-4", s <= alert.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300")} />
                                ))}
                              </div>
                              <SeverityBadge severity={alert.severity} />
                            </div>
                            <p className="text-sm">{alert.comment || "No comment provided"}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Customer: {alert.customerName} | Driver: {alert.driverName}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">Respond</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      <p className="text-sm">No low rating alerts</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fraud" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Total Alerts"
              value={fraudData?.summary?.totalAlerts || 0}
              icon={AlertTriangle}
              color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            />
            <MetricCard
              title="Critical"
              value={fraudData?.summary?.criticalAlerts || 0}
              icon={AlertCircle}
              color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            />
            <MetricCard
              title="Pending Review"
              value={fraudData?.summary?.pendingReview || 0}
              icon={Clock}
              color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
            />
            <MetricCard
              title="Risk Score"
              value={fraudData?.riskScore || 0}
              icon={Shield}
              color={fraudData?.riskScore > 70 ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}
              format="percent"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                Fraud Alerts
              </CardTitle>
              <CardDescription>Suspicious activities detected</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                {loadingFraud ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : fraudData?.alerts?.length > 0 ? (
                  <div className="space-y-3">
                    {fraudData.alerts.slice(0, 10).map((alert: any) => (
                      <div key={alert.id} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{alert.type}</Badge>
                              <SeverityBadge severity={alert.severity} />
                            </div>
                            <p className="text-sm">{alert.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {alert.sourceIp && `IP: ${alert.sourceIp} | `}
                              {new Date(alert.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">Investigate</Button>
                            <Button variant="destructive" size="sm">Block</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No fraud alerts</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className={cn(
              "border-2",
              healthData?.status === "healthy" ? "border-green-500" :
              healthData?.status === "warning" ? "border-yellow-500" :
              healthData?.status === "degraded" ? "border-orange-500" :
              "border-red-500"
            )}>
              <CardContent className="p-4 text-center">
                <Gauge className={cn(
                  "h-12 w-12 mx-auto mb-2",
                  healthData?.status === "healthy" ? "text-green-500" :
                  healthData?.status === "warning" ? "text-yellow-500" :
                  healthData?.status === "degraded" ? "text-orange-500" :
                  "text-red-500"
                )} />
                <p className="text-3xl font-bold">{healthData?.score || 0}%</p>
                <p className="text-sm text-muted-foreground capitalize">{healthData?.status || "Unknown"}</p>
              </CardContent>
            </Card>

            <MetricCard
              title="CPU Usage"
              value={healthData?.system?.cpu?.usage || 0}
              icon={Cpu}
              color={healthData?.system?.cpu?.usage > 80 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}
              format="percent"
            />
            <MetricCard
              title="Memory Usage"
              value={healthData?.system?.memory?.usage || 0}
              icon={HardDrive}
              color={healthData?.system?.memory?.usage > 85 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"}
              format="percent"
            />
            <MetricCard
              title="Uptime"
              value={healthData?.system?.uptime || 0}
              icon={Clock}
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Status</CardTitle>
                <CardDescription>Real-time service health</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHealth ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : (
                  <div className="divide-y">
                    {healthData?.services?.map((service: any) => (
                      <ServiceHealthIndicator key={service.name} service={service} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Queue Statistics</CardTitle>
                <CardDescription>Background job processing</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHealth ? (
                  <Skeleton className="h-40" />
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm">Pending Jobs</span>
                      <span className="font-medium">{healthData?.queue?.pending || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Processing</span>
                      <span className="font-medium">{healthData?.queue?.processing || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Failed</span>
                      <span className="font-medium text-red-500">{healthData?.queue?.failed || 0}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm">Avg Latency</span>
                      <span className="font-medium">{healthData?.queue?.avgLatency || 0}ms</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Automated Insights</h2>
              <p className="text-sm text-muted-foreground">
                {insights?.totalInsights || 0} insights | {insights?.actionableCount || 0} actionable
              </p>
            </div>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3c/intelligence/insights"] })}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          </div>

          {loadingInsights ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {insights?.insights?.map((insight: Insight) => (
                <Card key={insight.id} className={cn(
                  "border-l-4",
                  insight.type === "opportunity" ? "border-l-green-500" :
                  insight.type === "warning" ? "border-l-yellow-500" :
                  insight.type === "attention" ? "border-l-orange-500" :
                  "border-l-red-500"
                )}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <InsightIcon type={insight.type} />
                        <CardTitle className="text-base">{insight.title}</CardTitle>
                      </div>
                      <Badge variant="secondary">{insight.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{insight.description}</p>
                    {insight.actions && insight.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {insight.actions.map((action, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleAction(action.action)}
                            data-testid={`button-insight-action-${action.action}`}
                          >
                            <ActionIcon icon={action.icon} />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
