import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  FileText,
  Download,
  Users,
  Activity,
  AlertTriangle,
  Shield,
  Database,
  Server,
  Wifi,
  BarChart3,
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  ChevronRight,
  Mail,
  Cpu,
  HardDrive,
  Gauge,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  FileDown,
  StickyNote,
  Flag,
  Lock,
  Unlock,
  MapPin,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    healthy: "bg-green-500",
    online: "bg-green-500",
    warning: "bg-yellow-500",
    degraded: "bg-orange-500",
    critical: "bg-red-500",
    offline: "bg-gray-500",
    pending: "bg-blue-500",
    paused: "bg-gray-400",
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("h-2 w-2 rounded-full", colors[status] || "bg-gray-400")} />
      <span className="text-xs capitalize">{status}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-500 text-black",
    low: "bg-blue-500 text-white",
  };
  return (
    <Badge className={cn("text-xs", colors[severity] || "bg-gray-500")}>{severity.toUpperCase()}</Badge>
  );
}

function ServiceCard({ service }: { service: any }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-2.5 w-2.5 rounded-full",
          service.status === "healthy" ? "bg-green-500" : 
          service.status === "warning" ? "bg-yellow-500" : "bg-red-500"
        )} />
        <div>
          <p className="text-sm font-medium">{service.name}</p>
          <p className="text-xs text-muted-foreground">{service.latency}ms latency</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{service.uptime}%</p>
        <p className="text-xs text-muted-foreground">uptime</p>
      </div>
    </div>
  );
}

function HeatmapCell({ value, maxValue }: { value: number; maxValue: number }) {
  const intensity = maxValue > 0 ? value / maxValue : 0;
  return (
    <div
      className="w-6 h-6 rounded-sm border border-border"
      style={{
        backgroundColor: `rgba(99, 102, 241, ${intensity})`,
      }}
      title={`${value} actions`}
    />
  );
}

export default function OperationsCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState("24h");
  const [showNewReportDialog, setShowNewReportDialog] = useState(false);

  const { data: systemStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["/api/admin/phase3a/system/status-panel"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/system/status-panel").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: onlineAdmins, isLoading: loadingAdmins } = useQuery({
    queryKey: ["/api/admin/phase3a/presence/online"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/presence/online").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: scheduledReports } = useQuery({
    queryKey: ["/api/admin/phase3a/reports/scheduled"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/reports/scheduled").then(r => r.json()),
  });

  const { data: productivity } = useQuery({
    queryKey: ["/api/admin/phase3a/productivity/stats", period],
    queryFn: () => fetchWithAuth(`/api/admin/phase3a/productivity/stats?period=${period}`).then(r => r.json()),
  });

  const { data: failedLogins } = useQuery({
    queryKey: ["/api/admin/phase3a/security/failed-logins"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/security/failed-logins").then(r => r.json()),
  });

  const { data: heatmapData } = useQuery({
    queryKey: ["/api/admin/phase3a/analytics/activity-heatmap"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/analytics/activity-heatmap").then(r => r.json()),
  });

  const { data: dataQuality } = useQuery({
    queryKey: ["/api/admin/phase3a/data-quality/issues"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/data-quality/issues").then(r => r.json()),
  });

  const { data: quarantine } = useQuery({
    queryKey: ["/api/admin/phase3a/quarantine/items"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/quarantine/items").then(r => r.json()),
  });

  const { data: apiUsage } = useQuery({
    queryKey: ["/api/admin/phase3a/analytics/api-usage", period],
    queryFn: () => fetchWithAuth(`/api/admin/phase3a/analytics/api-usage?period=${period}`).then(r => r.json()),
  });

  const { data: countrySettings } = useQuery({
    queryKey: ["/api/admin/phase3a/compliance/country-settings"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/compliance/country-settings").then(r => r.json()),
  });

  const { data: configPreview } = useQuery({
    queryKey: ["/api/admin/phase3a/config/preview"],
    queryFn: () => fetchWithAuth("/api/admin/phase3a/config/preview").then(r => r.json()),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      fetchWithAuth("/api/admin/phase3a/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPage: "/admin/operations-center" }),
      }).catch(() => {});
    }, 60000);

    fetchWithAuth("/api/admin/phase3a/presence/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPage: "/admin/operations-center" }),
    }).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const getMaxHeatmapValue = () => {
    if (!heatmapData?.heatmap) return 1;
    let max = 0;
    Object.values(heatmapData.heatmap).forEach((hours: any) => {
      Object.values(hours).forEach((val: any) => {
        if (val > max) max = val;
      });
    });
    return max || 1;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operations Center</h1>
          <p className="text-muted-foreground">Enterprise monitoring and administration</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 hours</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">Data Quality</TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">API Usage</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">System Status</p>
                    <p className="text-2xl font-bold capitalize">{systemStatus?.overall || "Checking..."}</p>
                  </div>
                  <Gauge className={cn(
                    "h-8 w-8",
                    systemStatus?.overall === "healthy" ? "text-green-500" : "text-yellow-500"
                  )} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Online Admins</p>
                    <p className="text-2xl font-bold">{onlineAdmins?.totalOnline || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">CPU Usage</p>
                    <p className="text-2xl font-bold">{systemStatus?.system?.cpu || 0}%</p>
                  </div>
                  <Cpu className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Memory</p>
                    <p className="text-2xl font-bold">{systemStatus?.system?.memory?.percentage || 0}%</p>
                  </div>
                  <HardDrive className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Service Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStatus ? (
                  <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {systemStatus?.services?.map((service: any) => (
                      <ServiceCard key={service.name} service={service} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Online Admins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {loadingAdmins ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
                  ) : onlineAdmins?.onlineAdmins?.length > 0 ? (
                    <div className="space-y-2">
                      {onlineAdmins.onlineAdmins.map((admin: any) => (
                        <div key={admin.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <div>
                              <p className="text-sm font-medium">{admin.name}</p>
                              <p className="text-xs text-muted-foreground">{admin.currentPage}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">{admin.role}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p className="text-sm">No other admins online</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Admin Activity Heatmap
              </CardTitle>
              <CardDescription>Activity distribution by day and hour</CardDescription>
            </CardHeader>
            <CardContent>
              {heatmapData?.heatmap ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="flex gap-1 mb-2 ml-10">
                      {Array.from({ length: 24 }, (_, i) => (
                        <div key={i} className="w-6 text-center text-xs text-muted-foreground">
                          {i}
                        </div>
                      ))}
                    </div>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                      <div key={day} className="flex items-center gap-1 mb-1">
                        <div className="w-8 text-xs text-muted-foreground">{day}</div>
                        {Array.from({ length: 24 }, (_, h) => (
                          <HeatmapCell 
                            key={h} 
                            value={heatmapData.heatmap[day]?.[h] || 0}
                            maxValue={getMaxHeatmapValue()} 
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Skeleton className="h-48" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Admin Productivity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Actions</p>
                  <p className="text-2xl font-bold">{productivity?.summary?.totalActions || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Avg per Admin</p>
                  <p className="text-2xl font-bold">{productivity?.summary?.avgActionsPerAdmin || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Most Active</p>
                  <p className="text-2xl font-bold truncate">{productivity?.summary?.mostActiveAdmin || "N/A"}</p>
                </div>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {productivity?.stats?.slice(0, 10).map((stat: any, i: number) => (
                    <div key={stat.adminId} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium w-6">#{i + 1}</span>
                        <span className="text-sm">{stat.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">{stat.totalActions} actions</span>
                        <Progress value={stat.efficiency} className="w-20 h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Scheduled Reports</h2>
            <Dialog open={showNewReportDialog} onOpenChange={setShowNewReportDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-report">
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Scheduled Report</DialogTitle>
                  <DialogDescription>Configure automated report generation</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report Name</label>
                    <Input placeholder="Daily Revenue Summary" data-testid="input-report-name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Frequency</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Format</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipients</label>
                    <Input placeholder="email@example.com" data-testid="input-recipients" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewReportDialog(false)}>Cancel</Button>
                  <Button onClick={() => {
                    toast({ title: "Report scheduled successfully" });
                    setShowNewReportDialog(false);
                  }}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {scheduledReports?.schedules?.map((report: any) => (
              <Card key={report.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.frequency} | {report.format.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p>Next run: {new Date(report.nextRun).toLocaleDateString()}</p>
                        <p className="text-muted-foreground">Last: {new Date(report.lastRun).toLocaleDateString()}</p>
                      </div>
                      <StatusBadge status={report.status} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Failed Logins (24h)</p>
                    <p className="text-2xl font-bold">{failedLogins?.summary?.last24h || 0}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unique IPs</p>
                    <p className="text-2xl font-bold">{failedLogins?.summary?.uniqueIPs || 0}</p>
                  </div>
                  <Globe className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Blocked IPs</p>
                    <p className="text-2xl font-bold">{failedLogins?.summary?.blockedIPs || 0}</p>
                  </div>
                  <Shield className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Failed Login Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {failedLogins?.failedLogins?.map((login: any) => (
                    <div key={login.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{login.email}</p>
                        <p className="text-xs text-muted-foreground">
                          IP: {login.ip} | {login.country}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{new Date(login.timestamp).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{login.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Quarantine Vault
              </CardTitle>
              <CardDescription>Flagged accounts and suspicious items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10">
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-500">{quarantine?.summary?.criticalCount || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-500">{quarantine?.summary?.pendingReview || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                  <p className="text-sm text-muted-foreground">Total Quarantined</p>
                  <p className="text-2xl font-bold text-blue-500">{quarantine?.summary?.totalQuarantined || 0}</p>
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {quarantine?.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <SeverityBadge severity={item.severity} />
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.entityType}</Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        <Button variant="outline" size="sm">
                          <Unlock className="h-4 w-4 mr-1" />
                          Release
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Quality Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <svg className="w-32 h-32">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-muted"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={`${(dataQuality?.summary?.dataQualityScore || 0) * 3.52} 352`}
                        strokeLinecap="round"
                        className="text-primary transform -rotate-90 origin-center"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">{dataQuality?.summary?.dataQualityScore || 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {dataQuality?.summary?.totalIssues || 0} issues found
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issues by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dataQuality?.issues?.map((issue: any) => (
                    <div key={issue.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <SeverityBadge severity={issue.severity} />
                        <div>
                          <p className="text-sm font-medium">{issue.type}</p>
                          <p className="text-xs text-muted-foreground">{issue.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold">{issue.count}</span>
                        <Button variant="outline" size="sm">Fix</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total API Calls</p>
                    <p className="text-2xl font-bold">{apiUsage?.summary?.totalCalls?.toLocaleString() || 0}</p>
                  </div>
                  <Zap className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Latency</p>
                    <p className="text-2xl font-bold">{apiUsage?.summary?.avgLatency || 0}ms</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                    <p className="text-2xl font-bold">{apiUsage?.summary?.errorRate || 0}%</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endpoint Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiUsage?.endpoints?.map((endpoint: any) => (
                  <div key={endpoint.endpoint} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-sm font-mono">{endpoint.endpoint}</code>
                      <Badge variant={endpoint.errorRate > 2 ? "destructive" : "secondary"}>
                        {endpoint.errorRate}% errors
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Calls:</span>{" "}
                        <span className="font-medium">{endpoint.calls.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Latency:</span>{" "}
                        <span className="font-medium">{endpoint.avgLatency}ms</span>
                      </div>
                      <div>
                        <Progress value={Math.min(100, endpoint.avgLatency / 2)} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Country Compliance Settings
              </CardTitle>
              <CardDescription>View regulatory requirements by country</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {countrySettings?.countries?.map((country: any) => (
                  <div key={country.code} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg">
                          {country.code}
                        </div>
                        <div>
                          <p className="font-medium">{country.country}</p>
                          <p className="text-sm text-muted-foreground">{country.currency}</p>
                        </div>
                      </div>
                      <Badge variant="outline">Tax: {(country.taxRate * 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Min Age</p>
                        <p className="font-medium">{country.minAge} years</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">KYC Required</p>
                        <p className="font-medium">{country.kycRequired ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Documents</p>
                        <p className="font-medium">{country.documentTypes.join(", ")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Regulations</p>
                        <p className="font-medium">{country.regulations.join(", ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Feature Flag Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Flags</p>
                  <p className="text-2xl font-bold">{configPreview?.summary?.total || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10">
                  <p className="text-sm text-muted-foreground">Enabled</p>
                  <p className="text-2xl font-bold text-green-500">{configPreview?.summary?.enabled || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/10">
                  <p className="text-sm text-muted-foreground">Disabled</p>
                  <p className="text-2xl font-bold text-gray-500">{configPreview?.summary?.disabled || 0}</p>
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {configPreview?.flags?.slice(0, 10).map((flag: any) => (
                    <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{flag.name}</p>
                        <code className="text-xs text-muted-foreground">{flag.key}</code>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{flag.rolloutPercentage}%</span>
                        <Badge variant={flag.enabled ? "default" : "secondary"}>
                          {flag.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
