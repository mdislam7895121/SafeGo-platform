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
  Shield,
  Key,
  Smartphone,
  AlertTriangle,
  Lock,
  ShieldAlert,
  Activity,
  FileText,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Ban,
  Unlock,
} from "lucide-react";

export default function SecurityCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/security-hardening/dashboard"],
  });

  const { data: rateLimitStats } = useQuery({
    queryKey: ["/api/security-hardening/rate-limit/stats"],
  });

  const { data: wafStats } = useQuery({
    queryKey: ["/api/security-hardening/waf/stats"],
  });

  const { data: activeBlocks } = useQuery({
    queryKey: ["/api/security-hardening/rate-limit/blocks"],
  });

  const { data: wafLogs } = useQuery({
    queryKey: ["/api/security-hardening/waf/logs"],
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["/api/security-hardening/audit-logs"],
  });

  const { data: auditVerification } = useQuery({
    queryKey: ["/api/security-hardening/audit-logs/verify"],
  });

  const unblockMutation = useMutation({
    mutationFn: async ({ identifier, reason }: { identifier: string; reason: string }) => {
      return apiRequest("/api/security-hardening/rate-limit/unblock", {
        method: "POST",
        body: JSON.stringify({ identifier, adminId: "admin", reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Unblocked", description: "Identifier has been unblocked" });
      queryClient.invalidateQueries({ queryKey: ["/api/security-hardening/rate-limit/blocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security-hardening/dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unblock identifier", variant: "destructive" });
    },
  });

  const clearLoginBlocksMutation = useMutation({
    mutationFn: async (identifier: string) => {
      return apiRequest("/api/security-hardening/login-attempts/clear-blocks", {
        method: "POST",
        body: JSON.stringify({ identifier, adminId: "admin" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Cleared", description: "Login blocks have been cleared" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear blocks", variant: "destructive" });
    },
  });

  if (dashboardLoading) {
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
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Security Center</h1>
            <p className="text-muted-foreground">SafeGo Master Tasks 29-36: Security Hardening Layer</p>
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
            <CardTitle className="text-sm font-medium">Active Tokens</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-tokens">
              {dashboard?.overview?.activeTokens || 0}
            </div>
            <p className="text-xs text-muted-foreground">Valid JWT sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Blocks</CardTitle>
            <Ban className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-blocks">
              {dashboard?.overview?.activeBlocks || 0}
            </div>
            <p className="text-xs text-muted-foreground">Rate limit blocks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WAF Blocked Today</CardTitle>
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-waf-blocked">
              {dashboard?.today?.wafBlocked || 0}
            </div>
            <p className="text-xs text-muted-foreground">Malicious requests blocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-security-alerts">
              {dashboard?.pending?.unacknowledgedAlerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pending acknowledgment</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tokens" data-testid="tab-tokens">
            <Key className="h-4 w-4 mr-2" />
            JWT Tokens
          </TabsTrigger>
          <TabsTrigger value="rate-limits" data-testid="tab-rate-limits">
            <Lock className="h-4 w-4 mr-2" />
            Rate Limits
          </TabsTrigger>
          <TabsTrigger value="waf" data-testid="tab-waf">
            <ShieldAlert className="h-4 w-4 mr-2" />
            WAF Logs
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-devices">
            <Smartphone className="h-4 w-4 mr-2" />
            Devices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Today's Activity</CardTitle>
                <CardDescription>Security events in the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Login Attempts</span>
                  <Badge variant="outline">{dashboard?.today?.loginAttempts || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Failed Logins</span>
                  <Badge variant="destructive">{dashboard?.today?.failedLogins || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Security Alerts</span>
                  <Badge variant="secondary">{dashboard?.today?.securityAlerts || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Audit Logs</span>
                  <Badge variant="outline">{dashboard?.today?.auditLogs || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limit Stats</CardTitle>
                <CardDescription>API rate limiting summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Active Blocks</span>
                  <Badge variant="destructive">{rateLimitStats?.activeBlocks || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Blocks Today</span>
                  <Badge variant="secondary">{rateLimitStats?.blocksToday || 0}</Badge>
                </div>
                {rateLimitStats?.byCategory && Object.entries(rateLimitStats.byCategory).map(([category, count]) => (
                  <div key={category} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{category}</span>
                    <Badge variant="outline">{count as number}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WAF Stats</CardTitle>
                <CardDescription>Web Application Firewall summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Blocked Today</span>
                  <Badge variant="destructive">{wafStats?.blockedToday || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Logged Today</span>
                  <Badge variant="secondary">{wafStats?.loggedToday || 0}</Badge>
                </div>
                {wafStats?.byThreatType && Object.entries(wafStats.byThreatType).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm uppercase">{type}</span>
                    <Badge variant="outline">{count as number}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit Log Integrity</CardTitle>
                <CardDescription>Tamper-proof verification status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {auditVerification?.verified ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-600">Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium text-red-600">Issues Found</span>
                    </>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Logs</span>
                  <Badge variant="outline">{auditVerification?.totalLogs || 0}</Badge>
                </div>
                {auditVerification?.issues?.length > 0 && (
                  <div className="text-sm text-destructive">
                    {auditVerification.issues.length} issues detected
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>JWT Token Management</CardTitle>
              <CardDescription>
                Task 29: Rotating JWT tokens with refresh token rotation and reuse detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Enter user ID to search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-tokens"
                />
                <Button variant="outline" data-testid="button-search-tokens">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  JWT Rotation features:
                </div>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>15-minute access token expiry</li>
                  <li>7-day refresh token expiry</li>
                  <li>Token family tracking for reuse detection</li>
                  <li>Automatic revocation on suspicious activity</li>
                  <li>Device-bound tokens</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Blocks</CardTitle>
              <CardDescription>
                Task 35: API rate limiting with auto-blocking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeBlocks?.blocks?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active rate limit blocks
                  </div>
                ) : (
                  activeBlocks?.blocks?.map((block: any) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`block-item-${block.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={block.identifierType === "ip" ? "destructive" : "secondary"}>
                            {block.identifierType}
                          </Badge>
                          <span className="font-medium">{block.identifier}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {block.routeCategory} | {block.requestCount} requests
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Blocked until: {new Date(block.blockedUntil).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unblockMutation.mutate({ identifier: block.identifier, reason: "Admin override" })}
                        disabled={unblockMutation.isPending}
                        data-testid={`button-unblock-${block.id}`}
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        Unblock
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="font-medium">Auth Routes</div>
                  <div className="text-sm text-muted-foreground">20 req/min, 30min block</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium">Public Routes</div>
                  <div className="text-sm text-muted-foreground">60 req/min, 15min block</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium">Partner Routes</div>
                  <div className="text-sm text-muted-foreground">40 req/min, 20min block</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium">Admin Routes</div>
                  <div className="text-sm text-muted-foreground">100 req/min, 10min block</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WAF Threat Logs</CardTitle>
              <CardDescription>
                Task 36: Web Application Firewall security events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wafLogs?.logs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No WAF events logged
                  </div>
                ) : (
                  wafLogs?.logs?.slice(0, 20).map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`waf-log-${log.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              log.threatSeverity === "critical"
                                ? "destructive"
                                : log.threatSeverity === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {log.threatSeverity}
                          </Badge>
                          <Badge variant="outline">{log.threatType}</Badge>
                          {log.wasBlocked && <Badge variant="destructive">Blocked</Badge>}
                        </div>
                        <div className="text-sm font-medium">{log.requestPath}</div>
                        <div className="text-xs text-muted-foreground">
                          IP: {log.sourceIp} | Score: {log.threatScore}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" data-testid={`button-view-waf-${log.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WAF Rules Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="font-medium text-destructive">SQL Injection</div>
                  <div className="text-sm text-muted-foreground">Critical severity, score 90-95</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium text-orange-500">XSS</div>
                  <div className="text-sm text-muted-foreground">High severity, score 70-80</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium text-orange-500">Path Traversal</div>
                  <div className="text-sm text-muted-foreground">High severity, score 85</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium text-destructive">Command Injection</div>
                  <div className="text-sm text-muted-foreground">Critical severity, score 95</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Admin Audit Logs</CardTitle>
              <CardDescription>
                Task 34: Tamper-proof admin activity logging with hash chain verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs?.logs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No audit logs recorded
                  </div>
                ) : (
                  auditLogs?.logs?.slice(0, 20).map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`audit-log-${log.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              log.actionSeverity === "critical"
                                ? "destructive"
                                : log.actionSeverity === "high"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {log.actionSeverity}
                          </Badge>
                          <Badge variant="outline">{log.actionCategory}</Badge>
                          <span className="font-medium">{log.actionType}</span>
                        </div>
                        <div className="text-sm">
                          Admin: {log.adminEmail || log.adminId}
                        </div>
                        {log.targetUserId && (
                          <div className="text-xs text-muted-foreground">
                            Target: {log.targetUserName || log.targetUserId}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()} | {log.ipAddress}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.isVerified && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <Button size="sm" variant="ghost" data-testid={`button-view-audit-${log.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device History Management</CardTitle>
              <CardDescription>
                Task 33: User device tracking and suspicious login detection (Task 32)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Enter user ID to view devices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-devices"
                />
                <Button variant="outline" data-testid="button-search-devices">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  Device History features:
                </div>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Device fingerprinting and tracking</li>
                  <li>New device login alerts</li>
                  <li>New country login alerts</li>
                  <li>Rapid IP change detection</li>
                  <li>High-risk location blocking</li>
                  <li>Device trust management</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  OTP Rate Limiting (Task 30) & Login Throttling (Task 31):
                </div>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>3 OTP requests per minute</li>
                  <li>8 OTP requests per hour</li>
                  <li>5 failed logins = 5 min cooldown</li>
                  <li>10 failed logins = 30 min lockout</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
