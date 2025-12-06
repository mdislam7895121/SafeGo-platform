import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Activity, 
  CreditCard, 
  Bell, 
  Map, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Zap
} from "lucide-react";
import { format } from "date-fns";

export default function SystemHealthCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["/api/admin/health/dashboard"],
  });

  const { data: paymentSummary, isLoading: paymentLoading } = useQuery({
    queryKey: ["/api/admin/health/payments/summary"],
    enabled: activeTab === "payments" || activeTab === "overview",
  });

  const { data: notificationSummary, isLoading: notificationLoading } = useQuery({
    queryKey: ["/api/admin/health/notifications/summary"],
    enabled: activeTab === "notifications" || activeTab === "overview",
  });

  const { data: mapSummary, isLoading: mapLoading } = useQuery({
    queryKey: ["/api/admin/health/maps/summary"],
    enabled: activeTab === "maps" || activeTab === "overview",
  });

  const { data: paymentLogs } = useQuery({
    queryKey: ["/api/admin/health/payments/logs"],
    enabled: activeTab === "payments",
  });

  const { data: notificationLogs } = useQuery({
    queryKey: ["/api/admin/health/notifications/logs"],
    enabled: activeTab === "notifications",
  });

  const { data: mapLogs } = useQuery({
    queryKey: ["/api/admin/health/maps/logs"],
    enabled: activeTab === "maps",
  });

  const checkPaymentsMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/health/payments/check", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/payments/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/payments/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/dashboard"] });
      toast({ title: "Payment gateways checked" });
    },
    onError: () => toast({ title: "Check failed", variant: "destructive" }),
  });

  const checkNotificationsMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/health/notifications/check", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/notifications/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/notifications/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/dashboard"] });
      toast({ title: "Notification channels checked" });
    },
    onError: () => toast({ title: "Check failed", variant: "destructive" }),
  });

  const checkMapsMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/health/maps/check", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/maps/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/maps/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/dashboard"] });
      toast({ title: "Map services checked" });
    },
    onError: () => toast({ title: "Check failed", variant: "destructive" }),
  });

  const loadTestMutation = useMutation({
    mutationFn: (requestCount: number) => 
      apiRequest("/api/admin/health/maps/load-test", { 
        method: "POST",
        body: JSON.stringify({ requestCount, service: "directions" })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/maps/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/maps/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health/dashboard"] });
      toast({ 
        title: "Load test completed",
        description: `Avg latency: ${data.avgLatencyMs}ms, Success: ${data.successRate?.toFixed(1)}%`
      });
    },
    onError: () => toast({ title: "Load test failed", variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500 hover-elevate"><CheckCircle className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500 hover-elevate"><AlertTriangle className="w-3 h-3 mr-1" /> Degraded</Badge>;
      case "unhealthy":
      case "critical":
        return <Badge variant="destructive" className="hover-elevate"><XCircle className="w-3 h-3 mr-1" /> Unhealthy</Badge>;
      default:
        return <Badge variant="secondary" className="hover-elevate"><Clock className="w-3 h-3 mr-1" /> Unknown</Badge>;
    }
  };

  const getOverallHealthColor = (health: string) => {
    switch (health) {
      case "healthy": return "text-green-500";
      case "degraded": return "text-yellow-500";
      case "critical": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">System Health Center</h1>
          <p className="text-muted-foreground">Monitor payment gateways, notifications, and map services</p>
        </div>
        <Button
          onClick={() => refetchDashboard()}
          variant="outline"
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {dashboardLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-muted`}>
                  <Activity className={`w-6 h-6 ${getOverallHealthColor(dashboard?.overallHealth)}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Health</p>
                  <p className={`text-2xl font-bold capitalize ${getOverallHealthColor(dashboard?.overallHealth)}`}>
                    {dashboard?.overallHealth || "Unknown"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Gateways</p>
                  <p className="text-2xl font-bold">{dashboard?.payments?.gateways?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Bell className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Notification Channels</p>
                  <p className="text-2xl font-bold">{dashboard?.notifications?.channels?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Map className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Map Services</p>
                  <p className="text-2xl font-bold">{dashboard?.maps?.services?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payment Gateways</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="maps" data-testid="tab-maps">Map Services</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Gateways
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.payments?.gateways?.map((g: any) => (
                  <div key={g.gateway} className="flex items-center justify-between">
                    <span className="capitalize">{g.gateway}</span>
                    {getStatusBadge(g.status)}
                  </div>
                )) || <p className="text-muted-foreground">No data</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Channels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.notifications?.channels?.map((c: any) => (
                  <div key={c.channel} className="flex items-center justify-between">
                    <span className="capitalize">{c.channel} ({c.provider})</span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(c.status)}
                      {c.alertTriggered && <Badge variant="destructive">Alert</Badge>}
                    </div>
                  </div>
                )) || <p className="text-muted-foreground">No data</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Map Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.maps?.services?.map((s: any) => (
                  <div key={s.service} className="flex items-center justify-between">
                    <span className="capitalize">{s.service.replace(/_/g, " ")}</span>
                    {getStatusBadge(s.status)}
                  </div>
                )) || <p className="text-muted-foreground">No data</p>}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => {
                checkPaymentsMutation.mutate();
                checkNotificationsMutation.mutate();
                checkMapsMutation.mutate();
              }}
              disabled={checkPaymentsMutation.isPending || checkNotificationsMutation.isPending || checkMapsMutation.isPending}
              data-testid="button-run-all-checks"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(checkPaymentsMutation.isPending || checkNotificationsMutation.isPending || checkMapsMutation.isPending) ? 'animate-spin' : ''}`} />
              Run All Health Checks
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Gateway Health</CardTitle>
                  <CardDescription>bKash, Nagad, and Stripe connectivity</CardDescription>
                </div>
                <Button 
                  onClick={() => checkPaymentsMutation.mutate()}
                  disabled={checkPaymentsMutation.isPending}
                  data-testid="button-check-payments"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${checkPaymentsMutation.isPending ? 'animate-spin' : ''}`} />
                  Check Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentLoading ? (
                <div className="h-40 bg-muted animate-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  {paymentSummary?.gateways?.map((g: any) => (
                    <div key={g.gateway} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold capitalize">{g.gateway}</h4>
                        {getStatusBadge(g.currentStatus)}
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Last Checked</span>
                          <span>{g.lastChecked ? format(new Date(g.lastChecked), "PPp") : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Checks (24h)</span>
                          <span>{g.checksLast24h || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Health Rate</span>
                          <span>{g.healthyRate !== null ? `${g.healthyRate}%` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Response</span>
                          <span>{g.avgResponseTimeMs !== null ? `${g.avgResponseTimeMs}ms` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Credentials</span>
                          <span>{g.credentialsValid ? "Valid" : "Invalid"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              <h4 className="font-semibold mb-2">Recent Logs</h4>
              <div className="space-y-2 max-h-60 overflow-auto">
                {paymentLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium">{log.gateway}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{log.responseTimeMs}ms</span>
                      <span>{format(new Date(log.checkedAt), "HH:mm:ss")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Notification Channel Health</CardTitle>
                  <CardDescription>SMS, Email, and Push notification services</CardDescription>
                </div>
                <Button 
                  onClick={() => checkNotificationsMutation.mutate()}
                  disabled={checkNotificationsMutation.isPending}
                  data-testid="button-check-notifications"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${checkNotificationsMutation.isPending ? 'animate-spin' : ''}`} />
                  Check Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notificationLoading ? (
                <div className="h-40 bg-muted animate-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  {notificationSummary?.channels?.map((c: any) => (
                    <div key={c.channel} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold capitalize">{c.channel} ({c.provider})</h4>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(c.currentStatus)}
                          {c.alertTriggered && <Badge variant="destructive">Alert Triggered</Badge>}
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Last Checked</span>
                          <span>{c.lastChecked ? format(new Date(c.lastChecked), "PPp") : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Checks (24h)</span>
                          <span>{c.checksLast24h || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Health Rate</span>
                          <span>{c.healthyRate !== null ? `${c.healthyRate}%` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Queue Depth</span>
                          <span>{c.avgQueueDepth !== null ? c.avgQueueDepth : "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Consecutive Failures</span>
                          <span className={c.consecutiveFailures >= 5 ? "text-red-500 font-bold" : ""}>
                            {c.consecutiveFailures}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              <h4 className="font-semibold mb-2">Recent Logs</h4>
              <div className="space-y-2 max-h-60 overflow-auto">
                {notificationLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium">{log.channel}</span>
                      {getStatusBadge(log.status)}
                      {log.alertTriggered && <Badge variant="destructive">Alert</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{log.responseTimeMs}ms</span>
                      <span>{format(new Date(log.checkedAt), "HH:mm:ss")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maps" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Map Service Health</CardTitle>
                  <CardDescription>Google Maps API services and performance</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => checkMapsMutation.mutate()}
                    disabled={checkMapsMutation.isPending}
                    data-testid="button-check-maps"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${checkMapsMutation.isPending ? 'animate-spin' : ''}`} />
                    Check Now
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => loadTestMutation.mutate(100)}
                    disabled={loadTestMutation.isPending}
                    data-testid="button-load-test"
                  >
                    <Zap className={`w-4 h-4 mr-2 ${loadTestMutation.isPending ? 'animate-spin' : ''}`} />
                    Run Load Test
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {mapLoading ? (
                <div className="h-40 bg-muted animate-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  {mapSummary?.services?.map((s: any) => (
                    <div key={s.service} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold capitalize">{s.service.replace(/_/g, " ")}</h4>
                        {getStatusBadge(s.currentStatus)}
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Last Checked</span>
                          <span>{s.lastChecked ? format(new Date(s.lastChecked), "PPp") : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Response Time</span>
                          <span>{s.responseTimeMs !== null ? `${s.responseTimeMs}ms` : "N/A"}</span>
                        </div>
                        {s.lastLoadTest && (
                          <>
                            <Separator className="my-1" />
                            <div className="flex justify-between">
                              <span>Load Test Avg Latency</span>
                              <span>{s.lastLoadTest.avgLatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Load Test Success Rate</span>
                              <span>{s.lastLoadTest.successRate?.toFixed(1)}%</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              <h4 className="font-semibold mb-2">Recent Logs</h4>
              <div className="space-y-2 max-h-60 overflow-auto">
                {mapLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium">{log.service.replace(/_/g, " ")}</span>
                      {getStatusBadge(log.status)}
                      {log.isLoadTest && <Badge>Load Test</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{log.responseTimeMs || log.avgLatencyMs}ms</span>
                      <span>{format(new Date(log.checkedAt), "HH:mm:ss")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
