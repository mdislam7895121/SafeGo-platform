import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Cpu, 
  HardDrive, 
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Layers
} from "lucide-react";

interface HealthMetrics {
  cpu: { usage: string; cores: number };
  memory: { usage: string; total: string; free: string };
  database: { status: string; latency: string };
  uptime: number;
  nodeVersion: string;
  timestamp: string;
}

interface QueueStatus {
  queues: Array<{
    name: string;
    pending: number;
    processed: number;
    failed: number;
    avgDelay: string;
  }>;
}

interface ErrorTrends {
  errors: any[];
  summary: { total: number; byType: Record<string, number> };
  period: string;
}

export default function HealthMonitor() {
  const [activeTab, setActiveTab] = useState("metrics");

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<HealthMetrics>({
    queryKey: ["/api/admin/phase3a/health/metrics"],
    refetchInterval: 10000,
  });

  const { data: queues, isLoading: queuesLoading } = useQuery<QueueStatus>({
    queryKey: ["/api/admin/phase3a/health/queues"],
    refetchInterval: 15000,
  });

  const { data: errors, isLoading: errorsLoading } = useQuery<ErrorTrends>({
    queryKey: ["/api/admin/phase3a/health/errors"],
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (usage: number) => {
    if (usage < 50) return "text-green-600";
    if (usage < 80) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">System Health Monitor</h1>
          <p className="text-muted-foreground">Real-time infrastructure monitoring</p>
        </div>
        <Button variant="outline" onClick={() => refetchMetrics()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-cpu">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">CPU</span>
              </div>
              <span className={`text-2xl font-bold ${getStatusColor(parseFloat(metrics?.cpu.usage || "0"))}`}>
                {metrics?.cpu.usage || "0"}%
              </span>
            </div>
            <Progress value={parseFloat(metrics?.cpu.usage || "0")} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">{metrics?.cpu.cores} cores</p>
          </CardContent>
        </Card>

        <Card data-testid="card-memory">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Memory</span>
              </div>
              <span className={`text-2xl font-bold ${getStatusColor(parseFloat(metrics?.memory.usage || "0"))}`}>
                {metrics?.memory.usage || "0"}%
              </span>
            </div>
            <Progress value={parseFloat(metrics?.memory.usage || "0")} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics?.memory.free} free of {metrics?.memory.total}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-database">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Database</span>
              </div>
              <Badge variant={metrics?.database.status === "healthy" ? "default" : "destructive"}>
                {metrics?.database.status === "healthy" ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mr-1" />
                )}
                {metrics?.database.status}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{metrics?.database.latency}</div>
            <p className="text-xs text-muted-foreground">Response time</p>
          </CardContent>
        </Card>

        <Card data-testid="card-uptime">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Uptime</span>
              </div>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Running
              </Badge>
            </div>
            <div className="text-2xl font-bold">{formatUptime(metrics?.uptime || 0)}</div>
            <p className="text-xs text-muted-foreground">Node {metrics?.nodeVersion}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="metrics" data-testid="tab-metrics">
            <Activity className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="queues" data-testid="tab-queues">
            <Layers className="h-4 w-4 mr-2" />
            Queue Status
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Error Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>Real-time system performance data</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">CPU Performance</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Usage</span>
                        <span className="font-mono">{metrics?.cpu.usage}%</span>
                      </div>
                      <Progress value={parseFloat(metrics?.cpu.usage || "0")} />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Cores</span>
                        <span>{metrics?.cpu.cores}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Memory Performance</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Usage</span>
                        <span className="font-mono">{metrics?.memory.usage}%</span>
                      </div>
                      <Progress value={parseFloat(metrics?.memory.usage || "0")} />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Total</span>
                        <span>{metrics?.memory.total}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Free</span>
                        <span>{metrics?.memory.free}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues">
          <Card>
            <CardHeader>
              <CardTitle>Background Queue Status</CardTitle>
              <CardDescription>Monitor job queues and processing status</CardDescription>
            </CardHeader>
            <CardContent>
              {queuesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {queues?.queues.map((queue) => (
                    <Card key={queue.name} className="hover-elevate" data-testid={`queue-${queue.name}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium capitalize">{queue.name}</span>
                          </div>
                          <Badge variant={queue.pending > 50 ? "destructive" : "default"}>
                            {queue.pending} pending
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Processed</p>
                            <p className="font-medium text-green-600">{queue.processed}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Failed</p>
                            <p className="font-medium text-red-600">{queue.failed}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pending</p>
                            <p className="font-medium">{queue.pending}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Delay</p>
                            <p className="font-medium">{queue.avgDelay}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Error Trends</CardTitle>
              <CardDescription>Recent errors and their frequency</CardDescription>
            </CardHeader>
            <CardContent>
              {errorsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Errors</p>
                        <p className="text-2xl font-bold text-red-600">{errors?.summary.total || 0}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Period</p>
                        <p className="text-2xl font-bold">{errors?.period || "24h"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Error Types</p>
                        <p className="text-2xl font-bold">{Object.keys(errors?.summary.byType || {}).length}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Errors by Type</h4>
                    {Object.entries(errors?.summary.byType || {}).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="font-mono text-sm">{type}</span>
                        <Badge variant="destructive">{count as number}</Badge>
                      </div>
                    ))}
                    {Object.keys(errors?.summary.byType || {}).length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No errors in the selected period
                      </div>
                    )}
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
