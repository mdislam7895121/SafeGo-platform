import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Shield, AlertTriangle, Lock, Activity, Users, TrendingUp, Clock, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ThreatData {
  summary: {
    blockedLoginsLast24h: number;
    suspiciousActivityLast24h: number;
    activeThreatsNow: number;
    avgApiLatencyMs: number;
  };
  activeSessions: Array<{
    userId: string;
    email: string;
    role: string;
    loginAt: string;
    ipAddress: string;
    userAgent: string;
  }>;
  recentThreats: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    userId: string | null;
    userEmail: string | null;
    createdAt: string;
    resolved: boolean;
  }>;
  activityChart: Array<{
    hour: string;
    failedLogins: number;
    suspiciousActions: number;
    blockedAttempts: number;
  }>;
  apiLatencyChart: Array<{
    timestamp: string;
    latencyMs: number;
  }>;
}

export default function AdminSecurityCenter() {
  const { data: threatData, isLoading, refetch } = useQuery<ThreatData>({
    queryKey: ["/api/admin/security/threats"],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

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
      {/* Header */}
      <div className="bg-destructive text-destructive-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-destructive-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-7 w-7" />
                Security Threat Center
              </h1>
              <p className="text-sm opacity-90">Real-time threat monitoring and incident response</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="bg-destructive-foreground/10 border-destructive-foreground/20 text-destructive-foreground"
            data-testid="button-refresh"
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Threat Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-blocked-logins">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocked Logins (24h)</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {threatData?.summary.blockedLoginsLast24h || 0}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-suspicious-activity">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspicious Activity (24h)</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {threatData?.summary.suspiciousActivityLast24h || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-threats">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Threats</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {threatData?.summary.activeThreatsNow || 0}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-api-latency">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg API Latency</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {threatData?.summary.avgApiLatencyMs || 0}ms
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Threat Activity (Last 24 Hours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={threatData?.activityChart || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="failedLogins" fill="#ef4444" name="Failed Logins" />
                <Bar dataKey="suspiciousActions" fill="#f97316" name="Suspicious Actions" />
                <Bar dataKey="blockedAttempts" fill="#eab308" name="Blocked Attempts" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* API Latency Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              API Latency Monitor (Last Hour)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={threatData?.apiLatencyChart || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="latencyMs" stroke="#3b82f6" name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Sessions ({threatData?.activeSessions.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!threatData?.activeSessions || threatData.activeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active sessions</p>
            ) : (
              <div className="space-y-3">
                {threatData.activeSessions.map((session, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between p-3 rounded-lg border hover-elevate"
                    data-testid={`session-${idx}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{session.email}</p>
                        <Badge variant="outline" className="text-xs">
                          {session.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>IP: {session.ipAddress}</span>
                        <span>Login: {format(new Date(session.loginAt), "MMM d, h:mm a")}</span>
                      </div>
                      {session.userAgent && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{session.userAgent}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Threats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!threatData?.recentThreats || threatData.recentThreats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent threats detected</p>
            ) : (
              <div className="space-y-3">
                {threatData.recentThreats.map((threat) => (
                  <div
                    key={threat.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                    data-testid={`threat-${threat.id}`}
                  >
                    <div className={`h-2 w-2 mt-2 rounded-full ${
                      threat.severity === "critical" ? "bg-red-500" :
                      threat.severity === "high" ? "bg-orange-500" :
                      threat.severity === "medium" ? "bg-yellow-500" :
                      "bg-blue-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{threat.type}</p>
                        <Badge variant={threat.resolved ? "default" : "destructive"} className="text-xs">
                          {threat.resolved ? "Resolved" : "Active"}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {threat.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{threat.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {threat.userEmail && <span>User: {threat.userEmail}</span>}
                        <span>{format(new Date(threat.createdAt), "MMM d, yyyy h:mm a")}</span>
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
