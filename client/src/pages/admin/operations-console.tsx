import { useState } from "react";
import { useLocation } from "wouter";
import { 
  ArrowLeft, Activity, Server, AlertTriangle, Clock, Check, 
  X, Loader2, RefreshCw, Play, Search, Filter, ChevronDown,
  Zap, Database, Bell, CreditCard, Map, Mail, HardDrive, Wifi,
  TrendingUp, TrendingDown, AlertCircle, Info, CheckCircle2, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type JobStatus = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";
type ServiceStatus = "OK" | "DEGRADED" | "DOWN";
type ErrorSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface SystemJob {
  id: string;
  jobName: string;
  jobCategory: string;
  startedAt: string;
  finishedAt: string | null;
  status: JobStatus;
  durationMs: number | null;
  recordsProcessed: number | null;
  recordsSucceeded: number | null;
  recordsFailed: number | null;
  errorSummary: string | null;
  triggeredBy: string | null;
  environment: string;
}

interface HealthCheck {
  serviceName: string;
  serviceType: string;
  status: ServiceStatus;
  latencyMs: number | null;
  statusMessage: string | null;
  errorMessage: string | null;
  checkedAt: string;
}

interface SystemError {
  id: string;
  service: string;
  severity: ErrorSeverity;
  errorCode: string | null;
  errorType: string | null;
  message: string;
  stackTrace: string | null;
  correlationId: string | null;
  userId: string | null;
  countryCode: string | null;
  environment: string;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
}

interface JobStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  avgDurationMs: number;
  successRate: number;
  timeRangeHours: number;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  critical: number;
  bySeverity: Record<string, number>;
  byService: Record<string, number>;
  timeRangeHours: number;
}

interface HealthSummary {
  overallStatus: ServiceStatus;
  services: HealthCheck[];
  stats: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
  };
  checkedAt: string;
}

const jobStatusConfig: Record<JobStatus, { label: string; color: string; icon: any }> = {
  RUNNING: { label: "Running", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Loader2 },
  SUCCESS: { label: "Success", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: Check },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: X },
  PARTIAL: { label: "Partial", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: X },
};

const healthStatusConfig: Record<ServiceStatus, { label: string; color: string; icon: any }> = {
  OK: { label: "Healthy", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  DEGRADED: { label: "Degraded", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertCircle },
  DOWN: { label: "Down", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

const severityConfig: Record<ErrorSeverity, { label: string; color: string; icon: any }> = {
  DEBUG: { label: "Debug", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: Info },
  INFO: { label: "Info", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Info },
  WARNING: { label: "Warning", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertTriangle },
  ERROR: { label: "Error", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", icon: AlertCircle },
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

const serviceTypeIcons: Record<string, any> = {
  database: Database,
  payment: CreditCard,
  notification: Bell,
  maps: Map,
  cache: HardDrive,
  realtime: Wifi,
  storage: HardDrive,
};

function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = jobStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`job-status-${status.toLowerCase()}`}>
      <Icon className={`h-3 w-3 ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function HealthStatusBadge({ status }: { status: ServiceStatus }) {
  const config = healthStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`health-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  const config = severityConfig[severity];
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`severity-${severity.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function SummaryCards({ 
  jobStats, 
  errorStats, 
  healthSummary 
}: { 
  jobStats?: JobStats; 
  errorStats?: ErrorStats;
  healthSummary?: HealthSummary;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card data-testid="card-jobs-summary">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Jobs (24h)</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{jobStats?.total || 0}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              {jobStats?.byStatus?.SUCCESS || 0}
            </span>
            <span className="flex items-center gap-1">
              <X className="h-3 w-3 text-red-500" />
              {jobStats?.byStatus?.FAILED || 0}
            </span>
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 text-blue-500" />
              {jobStats?.byStatus?.RUNNING || 0}
            </span>
          </div>
          <Progress 
            value={jobStats?.successRate || 100} 
            className="mt-2 h-1" 
          />
        </CardContent>
      </Card>

      <Card data-testid="card-health-summary">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">
              {healthSummary?.stats.healthy || 0}/{healthSummary?.stats.total || 0}
            </div>
            {healthSummary && <HealthStatusBadge status={healthSummary.overallStatus} />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {healthSummary?.stats.healthy || 0} OK
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-yellow-500" />
              {healthSummary?.stats.degraded || 0} Degraded
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              {healthSummary?.stats.down || 0} Down
            </span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-errors-summary">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Errors (24h)</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{errorStats?.total || 0}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              {errorStats?.critical || 0} Critical
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-yellow-500" />
              {errorStats?.unresolved || 0} Unresolved
            </span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-performance-summary">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Avg Job Duration</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(jobStats?.avgDurationMs || null)}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            {jobStats?.successRate || 100}% success rate
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function JobsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: jobsData, isLoading, refetch } = useQuery<{ jobs: SystemJob[] }>({
    queryKey: ["/api/admin/operations/jobs", statusFilter, categoryFilter],
    refetchInterval: 10000,
  });

  const { data: statsData } = useQuery<{ stats: JobStats }>({
    queryKey: ["/api/admin/operations/jobs/stats"],
    refetchInterval: 30000,
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason: string }) => {
      return apiRequest(`/api/admin/operations/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operations/jobs"] });
    },
  });

  const jobs = jobsData?.jobs || [];
  const filteredJobs = jobs.filter(job => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    if (categoryFilter !== "all" && job.jobCategory !== categoryFilter) return false;
    if (searchQuery && !job.jobName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set(jobs.map(j => j.jobCategory))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
              data-testid="input-search-jobs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="RUNNING">Running</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40" data-testid="select-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-jobs">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No jobs found</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {filteredJobs.map(job => (
              <Card key={job.id} data-testid={`card-job-${job.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <JobStatusBadge status={job.status} />
                      <div>
                        <div className="font-medium">{job.jobName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{job.jobCategory}</Badge>
                          <span>{format(new Date(job.startedAt), "MMM d, HH:mm:ss")}</span>
                          {job.triggeredBy && (
                            <span className="text-muted-foreground">by {job.triggeredBy}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <div className="font-medium">{formatDuration(job.durationMs)}</div>
                        {job.recordsProcessed !== null && (
                          <div className="text-xs text-muted-foreground">
                            {job.recordsSucceeded || 0}/{job.recordsProcessed} processed
                          </div>
                        )}
                      </div>
                      {job.status === "RUNNING" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => cancelMutation.mutate({ jobId: job.id, reason: "Cancelled by admin" })}
                          data-testid={`button-cancel-job-${job.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {job.errorSummary && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                      {job.errorSummary}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function HealthTab() {
  const { toast } = useToast();
  
  const { data: healthData, isLoading, refetch, isFetching } = useQuery<HealthSummary>({
    queryKey: ["/api/admin/operations/health"],
    refetchInterval: 30000,
  });

  const checkServiceMutation = useMutation({
    mutationFn: async (serviceName: string) => {
      return apiRequest(`/api/admin/operations/health/${serviceName}/check`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operations/health"] });
      toast({ title: "Health check completed" });
    },
  });

  const services = healthData?.services || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {healthData && (
            <>
              <HealthStatusBadge status={healthData.overallStatus} />
              <span className="text-sm text-muted-foreground">
                Last checked {formatDistanceToNow(new Date(healthData.checkedAt))} ago
              </span>
            </>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isFetching}
          data-testid="button-refresh-health"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Run All Checks
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map(service => {
            const ServiceIcon = serviceTypeIcons[service.serviceType] || Server;
            const statusConfig = healthStatusConfig[service.status];
            
            return (
              <Card key={service.serviceName} data-testid={`card-service-${service.serviceName}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <ServiceIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium capitalize">
                      {service.serviceName.replace(/_/g, " ")}
                    </CardTitle>
                  </div>
                  <HealthStatusBadge status={service.status} />
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Type:</span>
                      <span className="font-medium capitalize">{service.serviceType}</span>
                    </div>
                    {service.latencyMs !== null && (
                      <div className="flex items-center justify-between">
                        <span>Latency:</span>
                        <span className="font-medium">{service.latencyMs}ms</span>
                      </div>
                    )}
                    {service.statusMessage && (
                      <div className="mt-2 text-xs">{service.statusMessage}</div>
                    )}
                    {service.errorMessage && (
                      <div className="mt-2 text-xs text-red-500">{service.errorMessage}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => checkServiceMutation.mutate(service.serviceName)}
                    disabled={checkServiceMutation.isPending}
                    data-testid={`button-check-${service.serviceName}`}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${checkServiceMutation.isPending ? "animate-spin" : ""}`} />
                    Check Now
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ErrorsTab() {
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("unresolved");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedError, setSelectedError] = useState<SystemError | null>(null);
  const [resolution, setResolution] = useState("");

  const { data: errorsData, isLoading, refetch } = useQuery<{ errors: SystemError[]; total: number }>({
    queryKey: ["/api/admin/operations/errors", severityFilter, serviceFilter, resolvedFilter],
    refetchInterval: 15000,
  });

  const { data: servicesData } = useQuery<{ services: string[] }>({
    queryKey: ["/api/admin/operations/errors/services"],
  });

  const { data: statsData } = useQuery<{ stats: ErrorStats }>({
    queryKey: ["/api/admin/operations/errors/stats"],
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ errorId, resolution }: { errorId: string; resolution: string }) => {
      return apiRequest(`/api/admin/operations/errors/${errorId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operations/errors"] });
      toast({ title: "Error resolved" });
      setSelectedError(null);
      setResolution("");
    },
  });

  const errors = errorsData?.errors || [];
  const services = servicesData?.services || [];
  
  const filteredErrors = errors.filter(err => {
    if (severityFilter !== "all" && err.severity !== severityFilter) return false;
    if (serviceFilter !== "all" && err.service !== serviceFilter) return false;
    if (resolvedFilter === "resolved" && !err.isResolved) return false;
    if (resolvedFilter === "unresolved" && err.isResolved) return false;
    if (searchQuery && !err.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search errors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
              data-testid="input-search-errors"
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32" data-testid="select-severity-filter">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="DEBUG">Debug</SelectItem>
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-40" data-testid="select-service-filter">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {services.map(svc => (
                <SelectItem key={svc} value={svc}>{svc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
            <SelectTrigger className="w-36" data-testid="select-resolved-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-errors">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filteredErrors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground">No errors found</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {filteredErrors.map(error => (
              <Card 
                key={error.id} 
                className={`cursor-pointer hover-elevate ${error.isResolved ? "opacity-60" : ""}`}
                onClick={() => setSelectedError(error)}
                data-testid={`card-error-${error.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={error.severity} />
                        <Badge variant="outline" className="text-xs">{error.service}</Badge>
                        {error.isResolved && (
                          <Badge variant="secondary" className="text-xs">Resolved</Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium line-clamp-2">{error.message}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{format(new Date(error.createdAt), "MMM d, HH:mm:ss")}</span>
                        {error.errorCode && <span>Code: {error.errorCode}</span>}
                        {error.correlationId && (
                          <span className="truncate max-w-[150px]">ID: {error.correlationId}</span>
                        )}
                      </div>
                    </div>
                    {!error.isResolved && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedError(error);
                        }}
                        data-testid={`button-resolve-${error.id}`}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedError && <SeverityBadge severity={selectedError.severity} />}
              Error Details
            </DialogTitle>
            <DialogDescription>
              {selectedError?.service} - {selectedError?.errorType || "Unknown Type"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedError && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Message</Label>
                <div className="mt-1 p-3 bg-muted rounded text-sm">{selectedError.message}</div>
              </div>

              {selectedError.stackTrace && (
                <div>
                  <Label className="text-muted-foreground">Stack Trace</Label>
                  <ScrollArea className="h-40 mt-1">
                    <pre className="p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap">
                      {selectedError.stackTrace}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Time</Label>
                  <div>{format(new Date(selectedError.createdAt), "PPpp")}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Environment</Label>
                  <div>{selectedError.environment}</div>
                </div>
                {selectedError.correlationId && (
                  <div>
                    <Label className="text-muted-foreground">Correlation ID</Label>
                    <div className="font-mono text-xs">{selectedError.correlationId}</div>
                  </div>
                )}
                {selectedError.userId && (
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <div className="font-mono text-xs">{selectedError.userId}</div>
                  </div>
                )}
              </div>

              {selectedError.isResolved ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="text-sm font-medium text-green-600 dark:text-green-400">
                    Resolved by {selectedError.resolvedBy}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedError.resolvedAt && format(new Date(selectedError.resolvedAt), "PPpp")}
                  </div>
                  {selectedError.resolution && (
                    <div className="mt-2 text-sm">{selectedError.resolution}</div>
                  )}
                </div>
              ) : (
                <div>
                  <Label htmlFor="resolution">Resolution</Label>
                  <Textarea
                    id="resolution"
                    placeholder="Describe how this error was resolved..."
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-1"
                    data-testid="input-resolution"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedError(null)}>
              Close
            </Button>
            {selectedError && !selectedError.isResolved && (
              <Button 
                onClick={() => resolveMutation.mutate({ errorId: selectedError.id, resolution })}
                disabled={!resolution.trim() || resolveMutation.isPending}
                data-testid="button-submit-resolution"
              >
                {resolveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Mark Resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OperationsConsolePage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("jobs");

  const { data: jobStatsData } = useQuery<{ stats: JobStats }>({
    queryKey: ["/api/admin/operations/jobs/stats"],
    refetchInterval: 30000,
  });

  const { data: errorStatsData } = useQuery<{ stats: ErrorStats }>({
    queryKey: ["/api/admin/operations/errors/stats"],
    refetchInterval: 30000,
  });

  const { data: healthData } = useQuery<HealthSummary>({
    queryKey: ["/api/admin/operations/health"],
    refetchInterval: 30000,
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-operations-console">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-operations-console">Operations Console</h1>
          <p className="text-muted-foreground">
            Monitor system jobs, service health, and error tracking
          </p>
        </div>
      </div>

      <SummaryCards 
        jobStats={jobStatsData?.stats}
        errorStats={errorStatsData?.stats}
        healthSummary={healthData}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs" className="gap-2" data-testid="tab-jobs">
            <Zap className="h-4 w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2" data-testid="tab-health">
            <Server className="h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-2" data-testid="tab-errors">
            <AlertTriangle className="h-4 w-4" />
            Errors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <JobsTab />
        </TabsContent>

        <TabsContent value="health">
          <HealthTab />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
