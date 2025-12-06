import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Activity, AlertTriangle, Shield, Clock, TrendingUp, Users, Lock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AuditEvent {
  id: string;
  actorEmail: string | null;
  actionType: string;
  entityType: string;
  description: string;
  success: boolean;
  createdAt: string;
  ipAddress: string | null;
}

interface MonitoringData {
  summary: {
    failedLoginsLast24h: number;
    suspiciousActivityLast24h: number;
    blockedAttemptsLast24h: number;
    activeSessionsNow: number;
  };
  recentEvents: AuditEvent[];
  systemHealth: {
    apiLatencyMs: number;
    databaseStatus: string;
    cacheStatus: string;
  };
}

export default function AdminMonitoring() {
  const { data: monitoringData, isLoading, refetch } = useQuery<MonitoringData>({
    queryKey: ["/api/admin/monitoring"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <Link href="/admin">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                data-testid="button-back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="h-7 text-xs"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">System Monitoring</h1>
              <p className="text-[11px] text-muted-foreground">Real-time security and system health</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-failed-logins">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed Logins (24h)</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {monitoringData?.summary.failedLoginsLast24h || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-suspicious-activity">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspicious Activity (24h)</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {monitoringData?.summary.suspiciousActivityLast24h || 0}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-blocked-attempts">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocked Attempts (24h)</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {monitoringData?.summary.blockedAttemptsLast24h || 0}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-sessions">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {monitoringData?.summary.activeSessionsNow || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">API Latency</p>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    (monitoringData?.systemHealth.apiLatencyMs || 0) < 100 ? "default" : 
                    (monitoringData?.systemHealth.apiLatencyMs || 0) < 300 ? "secondary" : 
                    "destructive"
                  }>
                    {monitoringData?.systemHealth.apiLatencyMs || 0}ms
                  </Badge>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Database Status</p>
                <Badge variant={monitoringData?.systemHealth.databaseStatus === "healthy" ? "default" : "destructive"}>
                  {monitoringData?.systemHealth.databaseStatus || "Unknown"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cache Status</p>
                <Badge variant={monitoringData?.systemHealth.cacheStatus === "healthy" ? "default" : "destructive"}>
                  {monitoringData?.systemHealth.cacheStatus || "Unknown"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Security Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Security Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!monitoringData?.recentEvents || monitoringData.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent security events</p>
            ) : (
              <div className="space-y-3">
                {monitoringData.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                    data-testid={`event-${event.id}`}
                  >
                    <div className={`h-2 w-2 mt-2 rounded-full ${
                      event.success ? "bg-green-500" : "bg-red-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{event.actionType}</p>
                        <Badge variant="outline" className="text-xs">
                          {event.entityType}
                        </Badge>
                        {!event.success && (
                          <Badge variant="destructive" className="text-xs">Failed</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {event.actorEmail && <span>Actor: {event.actorEmail}</span>}
                        {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                        <span>{format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
