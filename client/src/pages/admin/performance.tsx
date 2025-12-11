/**
 * Step 50: Enterprise Performance Dashboard
 * Real-time telemetry, system metrics, and stability monitoring
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity, 
  Database, 
  Server, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fetchAdminCapabilities } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { setAuthToken } from "@/lib/authToken";

export default function PerformanceDashboard() {
  const [, setLocation] = useLocation();
  const [hasAccess, setHasAccess] = useState(false);
  const [capabilitiesChecked, setCapabilitiesChecked] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState(false);

  // Fetch admin capabilities
  const { data: capabilitiesData, isLoading: capabilitiesLoading, error: capabilitiesQueryError } = useQuery({
    queryKey: ["/api/admin/capabilities"],
  });

  // Handle auto-logout on 401 using useEffect
  useEffect(() => {
    if (capabilitiesQueryError) {
      const errorStatus = (capabilitiesQueryError as any)?.status;
      if (errorStatus === 401) {
        setAuthToken(null);
        setLocation("/login");
      } else {
        setCapabilitiesError(true);
        setCapabilitiesChecked(true);
      }
    }
  }, [capabilitiesQueryError, setLocation]);

  // Check if user has VIEW_PERFORMANCE_DASHBOARD permission
  useEffect(() => {
    if (capabilitiesData && 'capabilities' in capabilitiesData) {
      const hasPermission = (capabilitiesData.capabilities as string[]).includes("VIEW_PERFORMANCE_DASHBOARD");
      setHasAccess(hasPermission);
      setCapabilitiesChecked(true);
    }
  }, [capabilitiesData]);

  // Fetch performance data (disabled until access is confirmed)
  const { data: overviewData, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ["/api/admin/performance/overview", { hours: 24 }],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: hasAccess,
  });

  const { data: databaseData, isLoading: databaseLoading } = useQuery({
    queryKey: ["/api/admin/performance/database", { minutes: 60 }],
    refetchInterval: 30000,
    enabled: hasAccess,
  });

  const { data: trafficData, isLoading: trafficLoading } = useQuery({
    queryKey: ["/api/admin/performance/traffic", { minutes: 60 }],
    refetchInterval: 30000,
    enabled: hasAccess,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/admin/performance/alerts", { limit: 20 }],
    refetchInterval: 30000,
    enabled: hasAccess,
  });

  const { data: thresholdsData, isLoading: thresholdsLoading } = useQuery({
    queryKey: ["/api/admin/performance/thresholds"],
    enabled: hasAccess,
  });

  // Loading state (capability check)
  if (capabilitiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-loading-capabilities">Loading capabilities...</p>
        </div>
      </div>
    );
  }

  // Capability error state (non-401 errors)
  if (capabilitiesError) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="alert-capability-error">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-2">Unable to verify permissions</p>
            <p className="text-sm mb-3">
              There was an error loading your access permissions. You can try refreshing the page.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="border-amber-600 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900"
              data-testid="button-retry-capabilities"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Access denied state (only after capability check is complete)
  if (capabilitiesChecked && !hasAccess) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Alert variant="destructive" data-testid="alert-access-denied">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">Access Denied</p>
            <p>You don't have permission to view the Performance Dashboard.</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Prevent rendering main content until capability check is complete
  if (!capabilitiesChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-checking-access">Verifying access...</p>
        </div>
      </div>
    );
  }

  const isLoading = overviewLoading || databaseLoading || trafficLoading || alertsLoading || thresholdsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-performance-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-performance">Performance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time system telemetry, metrics, and stability monitoring
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchOverview()}
          data-testid="button-refresh-performance"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-requests">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-total-requests">
                {overviewData?.traffic?.totalRequests?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {overviewData?.traffic?.timeRange || "24h"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-error-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-error-rate">
                {overviewData?.traffic?.errorRate || "0.00"}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {overviewData?.traffic?.failedRequests || 0} failed requests
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-response-time">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-avg-response-time">
                {overviewData?.traffic?.avgResponseTime || 0}ms
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all endpoints
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-db-avg-query-time">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">DB Query Time</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-db-avg-query-time">
                {overviewData?.database?.avgQueryTime || 0}ms
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {overviewData?.database?.slowQueries || 0} slow queries
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="traffic" className="space-y-4">
        <TabsList data-testid="tabs-performance">
          <TabsTrigger value="traffic" data-testid="tab-traffic">
            <Activity className="w-4 h-4 mr-2" />
            Traffic
          </TabsTrigger>
          <TabsTrigger value="database" data-testid="tab-database">
            <Database className="w-4 h-4 mr-2" />
            Database
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Server className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="thresholds" data-testid="tab-thresholds">
            <Settings className="w-4 h-4 mr-2" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        {/* Traffic Tab */}
        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Trends</CardTitle>
              <CardDescription>Request volume and success rate over time</CardDescription>
            </CardHeader>
            <CardContent>
              {trafficLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : trafficData?.trends && trafficData.trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trafficData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                    <Legend />
                    <Area type="monotone" dataKey="requestCount" stroke="#8884d8" fill="#8884d8" name="Requests" />
                    <Area type="monotone" dataKey="errorCount" stroke="#ef4444" fill="#ef4444" name="Errors" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No traffic data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Time Trend</CardTitle>
              <CardDescription>Average response time over time</CardDescription>
            </CardHeader>
            <CardContent>
              {trafficLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : trafficData?.trends && trafficData.trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trafficData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                    <Legend />
                    <Line type="monotone" dataKey="avgResponseTime" stroke="#10b981" name="Avg Response Time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No response time data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Performance</CardTitle>
              <CardDescription>Query performance and connection statistics</CardDescription>
            </CardHeader>
            <CardContent>
              {databaseLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : databaseData?.trends && databaseData.trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={databaseData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="queryCount" fill="#3b82f6" name="Query Count" />
                    <Bar dataKey="slowQueries" fill="#ef4444" name="Slow Queries" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No database data available</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Query Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Queries:</span>
                  <span className="font-medium">{databaseData?.summary?.totalQueries?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Query Time:</span>
                  <span className="font-medium">{databaseData?.summary?.avgQueryTime || 0}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slow Queries:</span>
                  <span className="font-medium">{databaseData?.summary?.slowQueries || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slow Query Rate:</span>
                  <span className="font-medium">{databaseData?.summary?.slowQueryRate || "0.00"}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Pool</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Connections:</span>
                  <span className="font-medium">{databaseData?.summary?.estimatedConnections || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Connection pool metrics are estimated based on Prisma client usage
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="value-memory-usage">
                  {overviewData?.current?.system?.memoryUsage || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Heap memory utilization
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="value-uptime">
                  {Math.floor((overviewData?.current?.system?.uptime || 0) / 3600)}h
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  System uptime
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="value-db-connections">
                  {overviewData?.current?.database?.activeConnections || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Database connections
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stability Alerts</CardTitle>
              <CardDescription>Recent system stability warnings and critical alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : alertsData?.alerts && alertsData.alerts.length > 0 ? (
                <div className="space-y-3">
                  {alertsData.alerts.map((alert: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 border rounded-md"
                      data-testid={`alert-item-${index}`}
                    >
                      <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                            {alert.severity}
                          </Badge>
                          <span className="font-medium">{alert.metric}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="text-muted-foreground">No stability alerts - system is healthy</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stability Thresholds</CardTitle>
              <CardDescription>Configured alerting thresholds for system monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              {thresholdsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Error Rate Threshold</label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{thresholdsData?.thresholds?.errorRatePercent || 0}%</span>
                        <span className="text-sm text-muted-foreground">maximum acceptable error rate</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">DB Latency Threshold</label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{thresholdsData?.thresholds?.dbLatencyMs || 0}ms</span>
                        <span className="text-sm text-muted-foreground">maximum query time</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Memory Usage Threshold</label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{thresholdsData?.thresholds?.memoryUsagePercent || 0}%</span>
                        <span className="text-sm text-muted-foreground">maximum memory usage</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Slow Query Threshold</label>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{thresholdsData?.thresholds?.slowQueryCount || 0}</span>
                        <span className="text-sm text-muted-foreground">per minute</span>
                      </div>
                    </div>
                  </div>

                  <Alert className="mt-4">
                    <AlertDescription className="text-sm">
                      <p className="font-medium mb-1">Threshold Configuration</p>
                      <p>These thresholds trigger warning and critical alerts when exceeded. Contact a SUPER_ADMIN to update threshold values.</p>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
