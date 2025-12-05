import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Shield,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Anomaly {
  id: string;
  type: string;
  rideId?: string;
  paymentId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  difference?: number;
  error?: string;
  detectedAt: string;
  status: string;
  reason?: string;
  resolution?: string;
  retryCount?: number;
}

interface FraudPattern {
  id: string;
  pattern: string;
  description: string;
  severity: string;
  affectedEntities: string[];
  detectedAt: string;
  status: string;
}

interface PaymentIntegrityResponse {
  summary: {
    totalTransactions24h: number;
    flaggedTransactions: number;
    underchargeAnomalies: number;
    overchargeAnomalies: number;
    stripeSyncErrors: number;
    fraudPatterns: number;
    integrityScore: number;
  };
  anomalies: Anomaly[];
  fraudPatterns: FraudPattern[];
  syncStatus: {
    lastSync: string;
    pendingSync: number;
    failedSync: number;
    healthStatus: string;
  };
  trends: {
    anomalyRate7d: number[];
    fraudRate7d: number[];
  };
}

export default function PaymentIntegrity() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, refetch } = useQuery<PaymentIntegrityResponse>({
    queryKey: ["/api/admin/phase4/payment-integrity"],
    refetchInterval: 30000,
  });

  const trendData = data?.trends
    ? data.trends.anomalyRate7d.map((rate, idx) => ({
        day: `Day ${idx + 1}`,
        anomalyRate: rate,
        fraudRate: data.trends.fraudRate7d[idx],
      }))
    : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "investigating":
        return <Badge className="bg-blue-500">Investigating</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "confirmed":
        return <Badge variant="destructive">Confirmed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-600">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge className="bg-green-500">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getSyncHealthBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500" data-testid="badge-sync-health">Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500" data-testid="badge-sync-health">Degraded</Badge>;
      case "critical":
        return <Badge variant="destructive" data-testid="badge-sync-health">Critical</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-sync-health">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Payment Integrity Dashboard</h1>
              <p className="text-sm opacity-90">Monitor payment anomalies and fraud patterns</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card data-testid="metric-transactions">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CreditCard className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold" data-testid="value-transactions">{data?.summary?.totalTransactions24h?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">24h Transactions</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-integrity-score">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500" data-testid="value-integrity-score">{data?.summary?.integrityScore?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">Integrity Score</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-flagged">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500" data-testid="value-flagged">{data?.summary?.flaggedTransactions || 0}</p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-undercharges">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <TrendingDown className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500" data-testid="value-undercharges">{data?.summary?.underchargeAnomalies || 0}</p>
                <p className="text-xs text-muted-foreground">Undercharges</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-overcharges">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <p className="text-xl font-bold text-purple-500" data-testid="value-overcharges">{data?.summary?.overchargeAnomalies || 0}</p>
                <p className="text-xs text-muted-foreground">Overcharges</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-sync-errors">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <RefreshCw className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500" data-testid="value-sync-errors">{data?.summary?.stripeSyncErrors || 0}</p>
                <p className="text-xs text-muted-foreground">Sync Errors</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-fraud-patterns">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Users className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500" data-testid="value-fraud-patterns">{data?.summary?.fraudPatterns || 0}</p>
                <p className="text-xs text-muted-foreground">Fraud Patterns</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2" data-testid="card-trends">
            <CardHeader>
              <CardTitle>7-Day Trends</CardTitle>
              <CardDescription>Anomaly and fraud rate trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="anomalyRate" stroke="#f97316" name="Anomaly Rate (%)" />
                  <Line type="monotone" dataKey="fraudRate" stroke="#ef4444" name="Fraud Rate (%)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-stripe-sync">
            <CardHeader>
              <CardTitle>Stripe Sync Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between" data-testid="row-sync-status">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getSyncHealthBadge(data?.syncStatus?.healthStatus || "unknown")}
                </div>
                <div className="flex items-center justify-between" data-testid="row-last-sync">
                  <span className="text-sm text-muted-foreground">Last Sync</span>
                  <span className="text-sm" data-testid="value-last-sync">
                    {data?.syncStatus?.lastSync
                      ? formatDistanceToNow(new Date(data.syncStatus.lastSync), { addSuffix: true })
                      : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between" data-testid="row-pending-sync">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <Badge variant="outline" data-testid="badge-pending-sync">{data?.syncStatus?.pendingSync || 0}</Badge>
                </div>
                <div className="flex items-center justify-between" data-testid="row-failed-sync">
                  <span className="text-sm text-muted-foreground">Failed</span>
                  <Badge variant="destructive" data-testid="badge-failed-sync">{data?.syncStatus?.failedSync || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="anomalies" data-testid="tab-anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="fraud" data-testid="tab-fraud">Fraud Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="anomalies">
            <Card>
              <CardHeader>
                <CardTitle>Payment Anomalies</CardTitle>
                <CardDescription>Undercharges, overcharges, and sync errors</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {data?.anomalies?.map((anomaly) => (
                      <Card key={anomaly.id} className="hover-elevate" data-testid={`card-anomaly-${anomaly.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-2 rounded-lg ${
                                  anomaly.type === "undercharge"
                                    ? "bg-red-100 dark:bg-red-900"
                                    : anomaly.type === "overcharge"
                                      ? "bg-purple-100 dark:bg-purple-900"
                                      : "bg-blue-100 dark:bg-blue-900"
                                }`}
                              >
                                {anomaly.type === "undercharge" ? (
                                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                                ) : anomaly.type === "overcharge" ? (
                                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                ) : (
                                  <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium capitalize">{anomaly.type.replace(/_/g, " ")}</span>
                                  {getStatusBadge(anomaly.status)}
                                </div>
                                {anomaly.rideId && (
                                  <p className="text-sm text-muted-foreground">Ride: {anomaly.rideId}</p>
                                )}
                                {anomaly.paymentId && (
                                  <p className="text-sm text-muted-foreground">Payment: {anomaly.paymentId}</p>
                                )}
                                {anomaly.reason && <p className="text-sm mt-1">{anomaly.reason}</p>}
                                {anomaly.resolution && (
                                  <p className="text-sm text-green-600 mt-1">{anomaly.resolution}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  Detected {formatDistanceToNow(new Date(anomaly.detectedAt), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            {anomaly.difference !== undefined && (
                              <div className="text-right">
                                <p
                                  className={`font-bold ${anomaly.difference < 0 ? "text-red-500" : "text-purple-500"}`}
                                >
                                  {anomaly.difference > 0 ? "+" : ""}
                                  {formatCurrency(anomaly.difference)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Expected: {formatCurrency(anomaly.expectedAmount || 0)}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud">
            <Card>
              <CardHeader>
                <CardTitle>Fraud Patterns</CardTitle>
                <CardDescription>Detected fraudulent behavior patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {data?.fraudPatterns?.map((pattern) => (
                      <Card
                        key={pattern.id}
                        className="hover-elevate border-l-4 border-l-red-500"
                        data-testid={`card-fraud-${pattern.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium capitalize">{pattern.pattern.replace(/_/g, " ")}</span>
                                {getSeverityBadge(pattern.severity)}
                                {getStatusBadge(pattern.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{pattern.description}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Affected:</span>
                                {pattern.affectedEntities.map((entity, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {entity}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Detected {formatDistanceToNow(new Date(pattern.detectedAt), { addSuffix: true })}
                              </p>
                            </div>
                            <Button variant="outline" size="sm" data-testid={`button-investigate-${pattern.id}`}>
                              <Search className="h-4 w-4 mr-1" />
                              Investigate
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
