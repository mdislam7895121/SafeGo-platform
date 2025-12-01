import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  Database,
  Server,
  Lock,
  Eye,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  lastCheck: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  metrics: {
    apiErrorRate: number;
    paymentFailureRate: number;
    kycVerificationFailureRate: number;
    fcmDeliveryRate: number;
    avgResponseTime: number;
  };
  alerts: {
    critical: number;
    warning: number;
  };
}

interface SecuritySummary {
  openFindings: number;
  criticalCount: number;
  recentAttacks: number;
  blockedIPs: number;
}

interface AttackLog {
  id: string;
  type: string;
  sourceIp: string;
  userId?: string;
  userType?: string;
  requestPath?: string;
  detectionReason: string;
  blocked: boolean;
  createdAt: string;
}

interface DeploymentCheck {
  name: string;
  category: string;
  passed: boolean;
  message: string;
}

interface DeploymentReadiness {
  ready: boolean;
  environment: string;
  checks: DeploymentCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    critical: number;
  };
  blockers: string[];
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: any }> = {
    healthy: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
    ok: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
    degraded: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: AlertTriangle },
    unhealthy: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle }
  };
  
  const variant = variants[status] || variants.unhealthy;
  const Icon = variant.icon;
  
  return (
    <Badge className={`${variant.color} gap-1`} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function MetricCard({ title, value, unit, icon: Icon, trend }: {
  title: string;
  value: number;
  unit: string;
  icon: any;
  trend?: 'good' | 'bad' | 'neutral';
}) {
  const trendColors = {
    good: 'text-green-600 dark:text-green-400',
    bad: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground'
  };
  
  return (
    <Card data-testid={`card-metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${trendColors[trend || 'neutral']}`}>
              {value.toFixed(1)}{unit}
            </p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemHealthPage() {
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/admin/system-health"],
    refetchInterval: 30000
  });
  
  const { data: security, isLoading: securityLoading } = useQuery<SecuritySummary>({
    queryKey: ["/api/admin/security-audit"],
    refetchInterval: 60000
  });
  
  const { data: attacksData, isLoading: attacksLoading } = useQuery<{ attacks: AttackLog[] }>({
    queryKey: ["/api/admin/attack-logs"],
    refetchInterval: 30000
  });
  
  const { data: deployment, isLoading: deploymentLoading } = useQuery<DeploymentReadiness>({
    queryKey: ["/api/admin/deployment-checks"],
    refetchInterval: 60000
  });
  
  const attacks = attacksData?.attacks || [];
  
  if (healthLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">System Health</h1>
          <p className="text-muted-foreground">Monitor security, performance, and deployment readiness</p>
        </div>
        <div className="flex items-center gap-2">
          {health && <StatusBadge status={health.status} />}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetchHealth()}
            data-testid="button-refresh-health"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="API Error Rate"
          value={health?.metrics.apiErrorRate || 0}
          unit="%"
          icon={Activity}
          trend={(health?.metrics.apiErrorRate || 0) < 5 ? 'good' : 'bad'}
        />
        <MetricCard
          title="Payment Failure Rate"
          value={health?.metrics.paymentFailureRate || 0}
          unit="%"
          icon={Lock}
          trend={(health?.metrics.paymentFailureRate || 0) < 2 ? 'good' : 'bad'}
        />
        <MetricCard
          title="KYC Rejection Rate"
          value={health?.metrics.kycVerificationFailureRate || 0}
          unit="%"
          icon={Eye}
          trend="neutral"
        />
        <MetricCard
          title="Avg Response Time"
          value={health?.metrics.avgResponseTime || 0}
          unit="ms"
          icon={Server}
          trend={(health?.metrics.avgResponseTime || 0) < 200 ? 'good' : 'bad'}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1" data-testid="card-security-alerts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Critical Findings</span>
                <Badge variant={security?.criticalCount ? "destructive" : "secondary"}>
                  {security?.criticalCount || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Open Findings</span>
                <Badge variant="secondary">{security?.openFindings || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Attacks (24h)</span>
                <Badge variant={security?.recentAttacks ? "destructive" : "secondary"}>
                  {security?.recentAttacks || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2" data-testid="card-service-health">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Service Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {health?.checks.map((check, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      check.status === 'healthy' ? 'bg-green-500' :
                      check.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium capitalize">{check.service}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.latency && (
                      <span className="text-sm text-muted-foreground">{check.latency}ms</span>
                    )}
                    <StatusBadge status={check.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="attacks" className="w-full">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="attacks" data-testid="tab-attacks">Recent Attacks</TabsTrigger>
          <TabsTrigger value="deployment" data-testid="tab-deployment">Deployment Readiness</TabsTrigger>
        </TabsList>
        
        <TabsContent value="attacks">
          <Card data-testid="card-attack-logs">
            <CardHeader>
              <CardTitle>Attack Logs</CardTitle>
              <CardDescription>Recent security events and blocked attacks</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {attacksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : attacks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No attacks detected</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attacks.map((attack) => (
                      <div 
                        key={attack.id} 
                        className="p-3 border rounded-lg"
                        data-testid={`row-attack-${attack.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="destructive" className="text-xs">
                            {attack.type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(attack.createdAt), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm">{attack.detectionReason}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>IP: {attack.sourceIp}</span>
                          {attack.requestPath && <span>Path: {attack.requestPath}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="deployment">
          <Card data-testid="card-deployment-checks">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deployment Readiness</CardTitle>
                  <CardDescription>Pre-deployment checklist and environment validation</CardDescription>
                </div>
                {deployment && (
                  <Badge variant={deployment.ready ? "default" : "destructive"}>
                    {deployment.ready ? "Ready" : "Not Ready"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {deploymentLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{deployment?.summary.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Checks</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{deployment?.summary.passed || 0}</p>
                      <p className="text-xs text-muted-foreground">Passed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{deployment?.summary.failed || 0}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{deployment?.summary.critical || 0}</p>
                      <p className="text-xs text-muted-foreground">Blockers</p>
                    </div>
                  </div>
                  
                  {deployment?.blockers && deployment.blockers.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">Deployment Blockers</h4>
                      <ul className="space-y-1">
                        {deployment.blockers.map((blocker, i) => (
                          <li key={i} className="text-sm text-red-600 dark:text-red-300">
                            {blocker}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {deployment?.checks.map((check, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          {check.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">{check.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {check.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
