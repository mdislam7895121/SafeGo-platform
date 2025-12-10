import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import { 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  HardDrive, 
  Wifi, 
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Filter,
  Play,
  Pause,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Circle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  FileJson,
  FileText,
  Layers,
  Link,
  GitBranch,
  Zap
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

type LogCategory = "API" | "AUTH" | "FRAUD" | "DRIVER" | "ERROR" | "PAYMENT" | "SYSTEM";
type LogSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

interface SystemMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  dbConnections: number;
  jobQueueDepth: number;
  websocketConnections: number;
}

interface LogEntry {
  id: string;
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  source: string;
  userId?: string;
  adminId?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  errorCode?: string;
  stackTrace?: string;
  ipAddress?: string;
  createdAt: string;
}

interface EventCorrelation {
  id: string;
  correlationId: string;
  rootEventType: string;
  rootEventId: string;
  rootEventTime: string;
  correlatedEvents: any[];
  suggestedRootCause?: string;
  confidenceScore?: number;
  analysisStatus: string;
  impactLevel?: string;
  estimatedImpact?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

interface MetricThresholdAlert {
  id: string;
  metricType: string;
  thresholdType: string;
  thresholdValue: number;
  alertSeverity: string;
  alertMessage: string;
  isEnabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  triggerCount: number;
}

const SEVERITY_COLORS: Record<LogSeverity, string> = {
  DEBUG: "bg-gray-500",
  INFO: "bg-blue-500",
  WARN: "bg-yellow-500",
  ERROR: "bg-red-500",
  CRITICAL: "bg-red-700",
};

const CATEGORY_ICONS: Record<LogCategory, typeof Activity> = {
  API: Server,
  AUTH: CheckCircle,
  FRAUD: AlertTriangle,
  DRIVER: Wifi,
  ERROR: XCircle,
  PAYMENT: Zap,
  SYSTEM: Cpu,
};

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6366F1"];

export default function ObservabilityCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLiveTail, setIsLiveTail] = useState(false);
  const [logFilters, setLogFilters] = useState({
    category: "",
    severity: "",
    searchQuery: "",
    hours: "24",
  });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [selectedCorrelation, setSelectedCorrelation] = useState<EventCorrelation | null>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<SystemMetrics[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const getToken = () => getAuthToken();

  const [accessDenied, setAccessDenied] = useState(false);

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError, refetch: refetchDashboard } = useQuery({
    queryKey: ["/api/admin/observability/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/dashboard", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.status === 403) {
        setAccessDenied(true);
        throw new Error("Access denied");
      }
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    refetchInterval: isLiveTail ? 5000 : 30000,
    retry: (failureCount, error) => {
      if (error?.message === "Access denied") return false;
      return failureCount < 2;
    },
  });

  const { data: logsData, isLoading: isLogsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["/api/admin/observability/logs", logFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (logFilters.category) params.append("category", logFilters.category);
      if (logFilters.severity) params.append("severity", logFilters.severity);
      if (logFilters.searchQuery) params.append("searchQuery", logFilters.searchQuery);
      const startTime = new Date(Date.now() - parseInt(logFilters.hours) * 60 * 60 * 1000);
      params.append("startTime", startTime.toISOString());
      params.append("limit", "100");
      const response = await fetch(`/api/admin/observability/logs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return response.json();
    },
    refetchInterval: isLiveTail ? 3000 : undefined,
  });

  const { data: correlationsData, isLoading: isCorrelationsLoading, refetch: refetchCorrelations } = useQuery({
    queryKey: ["/api/admin/observability/correlations"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/correlations?limit=50", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return response.json();
    },
  });

  const { data: alertsData, refetch: refetchAlerts } = useQuery({
    queryKey: ["/api/admin/observability/alerts"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/alerts", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return response.json();
    },
  });

  const { data: logStatsData } = useQuery({
    queryKey: ["/api/admin/observability/logs/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/logs/stats?hours=24", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return response.json();
    },
    refetchInterval: 60000,
  });

  const exportLogsMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      const response = await fetch("/api/admin/observability/logs/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          format,
          category: logFilters.category || undefined,
          severity: logFilters.severity || undefined,
          limit: 1000,
        }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logs_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Export complete", description: "Logs exported successfully" });
    },
    onError: () => {
      toast({ title: "Export failed", description: "Failed to export logs", variant: "destructive" });
    },
  });

  const updateCorrelationStatusMutation = useMutation({
    mutationFn: async ({ correlationId, status, resolutionNotes }: { correlationId: string; status: string; resolutionNotes?: string }) => {
      const response = await fetch(`/api/admin/observability/correlations/${correlationId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status, resolutionNotes }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/correlations"] });
      toast({ title: "Status updated", description: "Correlation status updated successfully" });
    },
  });

  useEffect(() => {
    if (!isLiveTail) return;

    const token = getToken();
    if (!token) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/api/admin/observability/ws?token=${token}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "metrics_update") {
        setMetricsHistory((prev) => [...prev.slice(-59), data.payload]);
      } else if (data.type === "log_update") {
        refetchLogs();
      } else if (data.type === "alert_update") {
        toast({
          title: `Alert: ${data.payload.alertSeverity}`,
          description: data.payload.alertMessage,
          variant: data.payload.alertSeverity === "CRITICAL" ? "destructive" : "default",
        });
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isLiveTail, refetchLogs, toast]);

  useEffect(() => {
    if (isLiveTail && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData, isLiveTail]);

  const metrics = dashboardData?.metrics as SystemMetrics | undefined;
  const logs = logsData?.logs as LogEntry[] | undefined;
  const correlations = correlationsData?.correlations as EventCorrelation[] | undefined;
  const alerts = alertsData?.alerts as MetricThresholdAlert[] | undefined;

  const getMetricTrend = (current: number, type: string) => {
    if (metricsHistory.length < 2) return null;
    const prev = (metricsHistory[metricsHistory.length - 2] as any)[type];
    if (current > prev) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (current < prev) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString();
  };

  const categoryChartData = logStatsData?.byCategory
    ? Object.entries(logStatsData.byCategory).map(([name, value]) => ({ name, value }))
    : [];

  const severityChartData = logStatsData?.bySeverity
    ? Object.entries(logStatsData.bySeverity).map(([name, value]) => ({ name, value }))
    : [];

  if (accessDenied) {
    return (
      <div className="container mx-auto p-4 md:p-6 flex items-center justify-center min-h-[60vh]" data-testid="page-observability-access-denied">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold">Access Restricted</h2>
            <p className="text-muted-foreground">
              The Observability Center requires elevated privileges. Only Super Admins and Infrastructure Admins can access this feature.
            </p>
            <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isDashboardLoading && !dashboardData) {
    return (
      <div className="container mx-auto p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading observability data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-observability-center">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Activity className="w-7 h-7" />
            Observability Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time system monitoring, logs, and event correlation
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="live-tail"
              checked={isLiveTail}
              onCheckedChange={setIsLiveTail}
              data-testid="switch-live-tail"
            />
            <Label htmlFor="live-tail" className="flex items-center gap-1">
              {isLiveTail ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span className="hidden md:inline">Live Tail</span>
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchDashboard();
              refetchLogs();
              refetchCorrelations();
            }}
            data-testid="button-refresh-all"
          >
            <RefreshCw className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-observability">
          <TabsTrigger value="dashboard" className="text-xs md:text-sm" data-testid="tab-dashboard">
            <Activity className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs md:text-sm" data-testid="tab-logs">
            <FileText className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Log Streams</span>
            <span className="sm:hidden">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="correlations" className="text-xs md:text-sm" data-testid="tab-correlations">
            <GitBranch className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Event Correlation</span>
            <span className="sm:hidden">Events</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
            <Card data-testid="card-metric-cpu">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <Cpu className="w-5 h-5 text-blue-500" />
                  {metrics && getMetricTrend(metrics.cpu, "cpu")}
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold" data-testid="text-cpu-value">
                    {metrics?.cpu?.toFixed(1) || "—"}%
                  </p>
                  <p className="text-xs text-muted-foreground">CPU Usage</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-metric-memory">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <HardDrive className="w-5 h-5 text-green-500" />
                  {metrics && getMetricTrend(metrics.memory, "memory")}
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold" data-testid="text-memory-value">
                    {metrics?.memory?.toFixed(1) || "—"}%
                  </p>
                  <p className="text-xs text-muted-foreground">Memory Usage</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-metric-db">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <Database className="w-5 h-5 text-purple-500" />
                  {metrics && getMetricTrend(metrics.dbConnections, "dbConnections")}
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold" data-testid="text-db-value">
                    {metrics?.dbConnections || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">DB Connections</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-metric-jobs">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <Layers className="w-5 h-5 text-orange-500" />
                  {metrics && getMetricTrend(metrics.jobQueueDepth, "jobQueueDepth")}
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold" data-testid="text-jobs-value">
                    {metrics?.jobQueueDepth || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Job Queue</p>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1 sm:col-span-1" data-testid="card-metric-websocket">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <Wifi className="w-5 h-5 text-cyan-500" />
                  {metrics && getMetricTrend(metrics.websocketConnections, "websocketConnections")}
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold" data-testid="text-ws-value">
                    {metrics?.websocketConnections || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">WebSocket Conns</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Metrics Trend (1 Hour)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] md:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metricsHistory.length > 0 ? metricsHistory : (dashboardData?.metrics ? [dashboardData.metrics] : [])}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip labelFormatter={formatTimestamp} />
                      <Area type="monotone" dataKey="cpu" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="CPU %" />
                      <Area type="monotone" dataKey="memory" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Memory %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Log Distribution (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-[120px]">
                    <p className="text-xs text-muted-foreground mb-2 text-center">By Category</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={40}
                          fill="#8884d8"
                        >
                          {categoryChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[120px]">
                    <p className="text-xs text-muted-foreground mb-2 text-center">By Severity</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={severityChartData}>
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 8 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8">
                          {severityChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.name === "CRITICAL" ? "#B91C1C" :
                                entry.name === "ERROR" ? "#EF4444" :
                                entry.name === "WARN" ? "#F59E0B" :
                                entry.name === "INFO" ? "#3B82F6" :
                                "#6B7280"
                              } 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {logStatsData && (
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span>Total Logs: <strong>{logStatsData.totalLogs}</strong></span>
                    <span>Error Rate: <strong className="text-red-500">{logStatsData.errorRate?.toFixed(2)}%</strong></span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Service Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {dashboardData?.services?.map((service: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          {service.status === "HEALTHY" ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : service.status === "DEGRADED" ? (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium">{service.serviceName}</span>
                        </div>
                        <Badge variant={service.status === "HEALTHY" ? "default" : "destructive"}>
                          {service.status}
                        </Badge>
                      </div>
                    )) || (
                      <p className="text-sm text-muted-foreground">No service health data</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Recent Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {dashboardData?.recentErrors?.map((error: any, index: number) => (
                      <div key={index} className="p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300 truncate">
                          {error.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(error.createdAt).toLocaleString()}
                        </p>
                      </div>
                    )) || (
                      <p className="text-sm text-muted-foreground">No recent errors</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-sm font-medium">Log Streams</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportLogsMutation.mutate("json")}
                    disabled={exportLogsMutation.isPending}
                    data-testid="button-export-json"
                  >
                    <FileJson className="w-4 h-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportLogsMutation.mutate("csv")}
                    disabled={exportLogsMutation.isPending}
                    data-testid="button-export-csv"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select
                  value={logFilters.category}
                  onValueChange={(v) => setLogFilters((f) => ({ ...f, category: v === "all" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-log-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="AUTH">Auth</SelectItem>
                    <SelectItem value="FRAUD">Fraud</SelectItem>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="PAYMENT">Payment</SelectItem>
                    <SelectItem value="SYSTEM">System</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={logFilters.severity}
                  onValueChange={(v) => setLogFilters((f) => ({ ...f, severity: v === "all" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-log-severity">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="DEBUG">Debug</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARN">Warning</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={logFilters.hours}
                  onValueChange={(v) => setLogFilters((f) => ({ ...f, hours: v }))}
                >
                  <SelectTrigger data-testid="select-log-timerange">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last Hour</SelectItem>
                    <SelectItem value="6">Last 6 Hours</SelectItem>
                    <SelectItem value="24">Last 24 Hours</SelectItem>
                    <SelectItem value="72">Last 3 Days</SelectItem>
                    <SelectItem value="168">Last Week</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={logFilters.searchQuery}
                    onChange={(e) => setLogFilters((f) => ({ ...f, searchQuery: e.target.value }))}
                    className="pl-8"
                    data-testid="input-log-search"
                  />
                </div>
              </div>

              <ScrollArea className="h-[300px] md:h-[400px] border rounded-md">
                <div className="p-2 space-y-1 font-mono text-xs">
                  {isLogsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading logs...</span>
                    </div>
                  ) : logs?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No logs found</p>
                  ) : (
                    logs?.map((log) => {
                      const CategoryIcon = CATEGORY_ICONS[log.category] || Activity;
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-2 p-2 rounded hover-elevate cursor-pointer border-l-2 transition-colors"
                          style={{ borderLeftColor: SEVERITY_COLORS[log.severity].replace("bg-", "") }}
                          onClick={() => setSelectedLog(log)}
                          data-testid={`log-entry-${log.id}`}
                        >
                          <Badge className={`${SEVERITY_COLORS[log.severity]} text-white text-[10px] shrink-0`}>
                            {log.severity}
                          </Badge>
                          <CategoryIcon className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground shrink-0">
                            {formatTimestamp(log.createdAt)}
                          </span>
                          <span className="text-muted-foreground shrink-0">[{log.source}]</span>
                          <span className="flex-1 truncate">{log.message}</span>
                          {log.statusCode && (
                            <Badge variant={log.statusCode >= 400 ? "destructive" : "secondary"} className="text-[10px]">
                              {log.statusCode}
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlations" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-medium">Event Correlation</CardTitle>
                  <CardDescription className="text-xs">
                    Link related events for root cause analysis
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {dashboardData?.pendingCorrelations || 0} Pending Analysis
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {isCorrelationsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading correlations...</span>
                    </div>
                  ) : correlations?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No event correlations found</p>
                  ) : (
                    correlations?.map((correlation) => (
                      <Card
                        key={correlation.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => setSelectedCorrelation(correlation)}
                        data-testid={`correlation-${correlation.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-4 h-4" />
                              <span className="font-medium">{correlation.rootEventType}</span>
                              <Badge 
                                variant={
                                  correlation.analysisStatus === "PENDING" ? "secondary" :
                                  correlation.analysisStatus === "CONFIRMED" ? "default" :
                                  correlation.analysisStatus === "DISMISSED" ? "outline" : "secondary"
                                }
                              >
                                {correlation.analysisStatus}
                              </Badge>
                              {correlation.impactLevel && (
                                <Badge 
                                  variant={
                                    correlation.impactLevel === "CRITICAL" ? "destructive" :
                                    correlation.impactLevel === "HIGH" ? "destructive" :
                                    "secondary"
                                  }
                                >
                                  {correlation.impactLevel}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(correlation.rootEventTime).toLocaleString()}
                            </span>
                          </div>
                          {correlation.suggestedRootCause && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {correlation.suggestedRootCause}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Link className="w-3 h-3" />
                              {Array.isArray(correlation.correlatedEvents) ? correlation.correlatedEvents.length : 0} linked events
                            </span>
                            {correlation.confidenceScore && (
                              <span>
                                Confidence: {(Number(correlation.confidenceScore) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <Badge>{selectedLog.category}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Severity</p>
                  <Badge className={`${SEVERITY_COLORS[selectedLog.severity]} text-white`}>
                    {selectedLog.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Source</p>
                  <p className="font-medium">{selectedLog.source}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                {selectedLog.method && (
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">{selectedLog.method}</p>
                  </div>
                )}
                {selectedLog.path && (
                  <div>
                    <p className="text-muted-foreground">Path</p>
                    <p className="font-medium font-mono text-xs">{selectedLog.path}</p>
                  </div>
                )}
                {selectedLog.statusCode && (
                  <div>
                    <p className="text-muted-foreground">Status Code</p>
                    <Badge variant={selectedLog.statusCode >= 400 ? "destructive" : "default"}>
                      {selectedLog.statusCode}
                    </Badge>
                  </div>
                )}
                {selectedLog.latencyMs && (
                  <div>
                    <p className="text-muted-foreground">Latency</p>
                    <p className="font-medium">{selectedLog.latencyMs}ms</p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div>
                    <p className="text-muted-foreground">User ID</p>
                    <p className="font-medium font-mono text-xs">{selectedLog.userId}</p>
                  </div>
                )}
                {selectedLog.requestId && (
                  <div>
                    <p className="text-muted-foreground">Request ID</p>
                    <p className="font-medium font-mono text-xs">{selectedLog.requestId}</p>
                  </div>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">Message</p>
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-mono text-sm whitespace-pre-wrap">{selectedLog.message}</p>
                </div>
              </div>
              {selectedLog.errorCode && (
                <div>
                  <p className="text-muted-foreground mb-2">Error Code</p>
                  <Badge variant="destructive">{selectedLog.errorCode}</Badge>
                </div>
              )}
              {selectedLog.stackTrace && (
                <div>
                  <p className="text-muted-foreground mb-2">Stack Trace</p>
                  <ScrollArea className="h-[200px] border rounded-md">
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap">{selectedLog.stackTrace}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCorrelation} onOpenChange={() => setSelectedCorrelation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Event Correlation Details
            </DialogTitle>
          </DialogHeader>
          {selectedCorrelation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Root Event Type</p>
                  <p className="font-medium">{selectedCorrelation.rootEventType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge>{selectedCorrelation.analysisStatus}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Event Time</p>
                  <p className="font-medium">{new Date(selectedCorrelation.rootEventTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Impact Level</p>
                  <Badge variant={selectedCorrelation.impactLevel === "CRITICAL" ? "destructive" : "secondary"}>
                    {selectedCorrelation.impactLevel || "Unknown"}
                  </Badge>
                </div>
                {selectedCorrelation.confidenceScore && (
                  <div>
                    <p className="text-muted-foreground">Confidence Score</p>
                    <p className="font-medium">{(Number(selectedCorrelation.confidenceScore) * 100).toFixed(0)}%</p>
                  </div>
                )}
              </div>
              
              {selectedCorrelation.suggestedRootCause && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-2">Suggested Root Cause</p>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm">{selectedCorrelation.suggestedRootCause}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">Correlated Events ({Array.isArray(selectedCorrelation.correlatedEvents) ? selectedCorrelation.correlatedEvents.length : 0})</p>
                <ScrollArea className="h-[150px] border rounded-md">
                  <div className="p-2 space-y-2">
                    {Array.isArray(selectedCorrelation.correlatedEvents) && selectedCorrelation.correlatedEvents.map((event: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <Circle className="w-2 h-2 fill-current" />
                          <span className="text-sm font-medium">{event.eventType}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {event.confidence && `${(event.confidence * 100).toFixed(0)}% confidence`}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {selectedCorrelation.analysisStatus === "PENDING" && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        updateCorrelationStatusMutation.mutate({
                          correlationId: selectedCorrelation.correlationId,
                          status: "CONFIRMED",
                        });
                        setSelectedCorrelation(null);
                      }}
                      data-testid="button-confirm-correlation"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateCorrelationStatusMutation.mutate({
                          correlationId: selectedCorrelation.correlationId,
                          status: "DISMISSED",
                        });
                        setSelectedCorrelation(null);
                      }}
                      data-testid="button-dismiss-correlation"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Dismiss
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
