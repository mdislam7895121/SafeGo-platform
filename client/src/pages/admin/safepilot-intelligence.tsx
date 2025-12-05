import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Shield, 
  Users, 
  Heart, 
  Megaphone, 
  PieChart, 
  Scale,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Bot,
  Zap,
  Target,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardData {
  growth: {
    totalDemandZones: number;
    highDemandZones: number;
    supplyGaps: number;
    criticalGaps: number;
    onboardingOpportunities: number;
    surgeRecommendations: number;
    forecastTrend: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  };
  cost: {
    totalPotentialSavings: number;
    refundAbuserCount: number;
    discountAbuserCount: number;
    incentiveOverspendCount: number;
    payoutLeakageCount: number;
    criticalIssues: number;
    topActions: Array<{
      id: string;
      category: string;
      title: string;
      estimatedSavings: number;
      priority: number;
    }>;
  };
  fraud: {
    totalAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    estimatedTotalLoss: number;
    byCategory: Record<string, number>;
    topAlerts: Array<{
      id: string;
      category: string;
      severity: string;
      title: string;
      riskScore: number;
    }>;
  };
  partner: {
    lowPerformerCount: number;
    criticalCount: number;
    trainingNeeded: number;
    topPerformerCount: number;
    pendingActions: number;
    averageDriverRating: number;
    averageRestaurantRating: number;
  };
  retention: {
    unhappyCustomerCount: number;
    criticalChurnRisk: number;
    pendingApologies: number;
    winBackCandidates: number;
    totalRetentionValue: number;
    avgChurnProbability: number;
  };
  marketing: {
    socialCaptionsReady: number;
    notificationTemplates: number;
    localIdeas: number;
    upcomingCampaigns: number;
    totalEstimatedReach: number;
  };
  financial: {
    weeklyPrediction: number;
    monthlyPrediction: number;
    negativeBalanceRisks: number;
    settlementRisks: number;
    potentialSavings: number;
    revenueGrowth: number;
  };
  compliance: {
    totalViolations: number;
    criticalViolations: number;
    bdViolations: number;
    usViolations: number;
    pendingActions: number;
    complianceScore: number;
  };
  lastUpdated: string;
}

function ModuleCard({
  title,
  description,
  icon: Icon,
  color,
  metrics,
  status,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  metrics: Array<{ label: string; value: string | number; trend?: "up" | "down" | "neutral" }>;
  status: "healthy" | "warning" | "critical";
  onClick?: () => void;
}) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover-elevate",
        status === "critical" && "border-destructive/50",
        status === "warning" && "border-yellow-500/50"
      )}
      onClick={onClick}
      data-testid={`card-module-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", color)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          {status === "critical" && (
            <Badge variant="destructive" className="text-xs">Critical</Badge>
          )}
          {status === "warning" && (
            <Badge className="bg-yellow-500 text-xs">Attention</Badge>
          )}
          {status === "healthy" && (
            <Badge variant="secondary" className="text-xs">Healthy</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold">{metric.value}</p>
                {metric.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                {metric.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionItem({
  title,
  description,
  priority,
  category,
  onClick,
}: {
  title: string;
  description: string;
  priority: number;
  category: string;
  onClick?: () => void;
}) {
  return (
    <div 
      className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`action-item-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full",
          priority >= 90 ? "bg-red-500" : priority >= 70 ? "bg-yellow-500" : "bg-blue-500"
        )} />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{category}</Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function AlertItem({
  title,
  severity,
  category,
  riskScore,
}: {
  title: string;
  severity: string;
  category: string;
  riskScore: number;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg" data-testid={`alert-item-${category}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className={cn(
          "h-4 w-4",
          severity === "CRITICAL" ? "text-red-500" : 
          severity === "HIGH" ? "text-orange-500" : "text-yellow-500"
        )} />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{category.replace(/_/g, " ")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={severity === "CRITICAL" ? "destructive" : "secondary"} className="text-xs">
          {riskScore}%
        </Badge>
      </div>
    </div>
  );
}

export default function SafePilotIntelligence() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["/api/admin/safepilot/dashboard"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const getModuleStatus = (critical: number, warning: number): "healthy" | "warning" | "critical" => {
    if (critical > 0) return "critical";
    if (warning > 0) return "warning";
    return "healthy";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">SafePilot Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered business automation engine
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                <p className="text-xl font-bold" data-testid="text-monthly-revenue">
                  ${dashboard?.financial?.monthlyPrediction?.toLocaleString() || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Potential Savings</p>
                <p className="text-xl font-bold" data-testid="text-potential-savings">
                  ${dashboard?.cost?.totalPotentialSavings?.toLocaleString() || 0}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Critical Alerts</p>
                <p className="text-xl font-bold" data-testid="text-critical-alerts">
                  {(dashboard?.fraud?.criticalAlerts || 0) + (dashboard?.compliance?.criticalViolations || 0)}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Compliance Score</p>
                <p className="text-xl font-bold" data-testid="text-compliance-score">
                  {dashboard?.compliance?.complianceScore || 0}%
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="growth" data-testid="tab-growth">Growth</TabsTrigger>
          <TabsTrigger value="operations" data-testid="tab-operations">Operations</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="marketing" data-testid="tab-marketing">Marketing</TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ModuleCard
              title="Growth Engine"
              description="Demand-supply AI"
              icon={TrendingUp}
              color="bg-green-500"
              status={getModuleStatus(dashboard?.growth?.criticalGaps || 0, dashboard?.growth?.supplyGaps || 0)}
              metrics={[
                { label: "Demand Zones", value: dashboard?.growth?.highDemandZones || 0 },
                { label: "Supply Gaps", value: dashboard?.growth?.supplyGaps || 0 },
                { label: "Onboarding", value: dashboard?.growth?.onboardingOpportunities || 0 },
                { label: "Surge Recs", value: dashboard?.growth?.surgeRecommendations || 0 },
              ]}
            />

            <ModuleCard
              title="Cost Reduction"
              description="Expense killer AI"
              icon={DollarSign}
              color="bg-blue-500"
              status={getModuleStatus(dashboard?.cost?.criticalIssues || 0, dashboard?.cost?.refundAbuserCount || 0)}
              metrics={[
                { label: "Savings", value: `$${dashboard?.cost?.totalPotentialSavings || 0}` },
                { label: "Refund Issues", value: dashboard?.cost?.refundAbuserCount || 0 },
                { label: "Discount Abuse", value: dashboard?.cost?.discountAbuserCount || 0 },
                { label: "Payout Leaks", value: dashboard?.cost?.payoutLeakageCount || 0 },
              ]}
            />

            <ModuleCard
              title="Fraud Shield"
              description="Safety & security"
              icon={Shield}
              color="bg-red-500"
              status={getModuleStatus(dashboard?.fraud?.criticalAlerts || 0, dashboard?.fraud?.highAlerts || 0)}
              metrics={[
                { label: "Total Alerts", value: dashboard?.fraud?.totalAlerts || 0 },
                { label: "Critical", value: dashboard?.fraud?.criticalAlerts || 0 },
                { label: "Est. Loss", value: `$${dashboard?.fraud?.estimatedTotalLoss || 0}` },
                { label: "High Risk", value: dashboard?.fraud?.highAlerts || 0 },
              ]}
            />

            <ModuleCard
              title="Partner Success"
              description="Performance coach"
              icon={Users}
              color="bg-orange-500"
              status={getModuleStatus(dashboard?.partner?.criticalCount || 0, dashboard?.partner?.lowPerformerCount || 0)}
              metrics={[
                { label: "Low Performers", value: dashboard?.partner?.lowPerformerCount || 0 },
                { label: "Training Needed", value: dashboard?.partner?.trainingNeeded || 0 },
                { label: "Avg Driver", value: dashboard?.partner?.averageDriverRating?.toFixed(1) || "0" },
                { label: "Avg Restaurant", value: dashboard?.partner?.averageRestaurantRating?.toFixed(1) || "0" },
              ]}
            />

            <ModuleCard
              title="Customer Retention"
              description="Win-back AI"
              icon={Heart}
              color="bg-pink-500"
              status={getModuleStatus(dashboard?.retention?.criticalChurnRisk || 0, dashboard?.retention?.unhappyCustomerCount || 0)}
              metrics={[
                { label: "Unhappy", value: dashboard?.retention?.unhappyCustomerCount || 0 },
                { label: "Churn Risk", value: dashboard?.retention?.criticalChurnRisk || 0 },
                { label: "Win-back", value: dashboard?.retention?.winBackCandidates || 0 },
                { label: "Value at Risk", value: `$${dashboard?.retention?.totalRetentionValue || 0}` },
              ]}
            />

            <ModuleCard
              title="Marketing AI"
              description="Zero-budget marketing"
              icon={Megaphone}
              color="bg-purple-500"
              status="healthy"
              metrics={[
                { label: "Captions", value: dashboard?.marketing?.socialCaptionsReady || 0 },
                { label: "Templates", value: dashboard?.marketing?.notificationTemplates || 0 },
                { label: "Campaigns", value: dashboard?.marketing?.upcomingCampaigns || 0 },
                { label: "Est. Reach", value: dashboard?.marketing?.totalEstimatedReach?.toLocaleString() || 0 },
              ]}
            />

            <ModuleCard
              title="Financial Intel"
              description="Revenue forecasting"
              icon={PieChart}
              color="bg-cyan-500"
              status={getModuleStatus(0, dashboard?.financial?.negativeBalanceRisks || 0)}
              metrics={[
                { label: "Weekly", value: `$${dashboard?.financial?.weeklyPrediction?.toLocaleString() || 0}` },
                { label: "Monthly", value: `$${dashboard?.financial?.monthlyPrediction?.toLocaleString() || 0}` },
                { label: "Balance Risks", value: dashboard?.financial?.negativeBalanceRisks || 0 },
                { label: "Growth", value: `${dashboard?.financial?.revenueGrowth || 0}%`, trend: (dashboard?.financial?.revenueGrowth || 0) > 0 ? "up" : "down" },
              ]}
            />

            <ModuleCard
              title="Compliance Guard"
              description="Legal & regulatory"
              icon={Scale}
              color="bg-slate-500"
              status={getModuleStatus(dashboard?.compliance?.criticalViolations || 0, dashboard?.compliance?.totalViolations || 0)}
              metrics={[
                { label: "Violations", value: dashboard?.compliance?.totalViolations || 0 },
                { label: "Critical", value: dashboard?.compliance?.criticalViolations || 0 },
                { label: "BD Issues", value: dashboard?.compliance?.bdViolations || 0 },
                { label: "US Issues", value: dashboard?.compliance?.usViolations || 0 },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Demand Hotspots
                </CardTitle>
                <CardDescription>High-demand zones detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Total Demand Zones</p>
                      <p className="text-sm text-muted-foreground">Active areas with demand</p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-4">
                      {dashboard?.growth?.totalDemandZones || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div>
                      <p className="font-medium">High Demand Zones</p>
                      <p className="text-sm text-muted-foreground">Priority expansion areas</p>
                    </div>
                    <Badge className="bg-green-500 text-lg px-4">
                      {dashboard?.growth?.highDemandZones || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div>
                      <p className="font-medium">Surge Pricing Recommendations</p>
                      <p className="text-sm text-muted-foreground">Optimal pricing opportunities</p>
                    </div>
                    <Badge className="bg-blue-500 text-lg px-4">
                      {dashboard?.growth?.surgeRecommendations || 0}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Supply Analysis
                </CardTitle>
                <CardDescription>Partner supply status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    (dashboard?.growth?.criticalGaps || 0) > 0 
                      ? "bg-red-500/10 border-red-500/20" 
                      : "bg-muted"
                  )}>
                    <div>
                      <p className="font-medium">Supply Gaps</p>
                      <p className="text-sm text-muted-foreground">Areas needing more partners</p>
                    </div>
                    <Badge variant={(dashboard?.growth?.supplyGaps || 0) > 0 ? "destructive" : "secondary"} className="text-lg px-4">
                      {dashboard?.growth?.supplyGaps || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div>
                      <p className="font-medium">Onboarding Opportunities</p>
                      <p className="text-sm text-muted-foreground">Recommended partner recruitment</p>
                    </div>
                    <Badge className="bg-purple-500 text-lg px-4">
                      {dashboard?.growth?.onboardingOpportunities || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Forecast Trend</p>
                      <p className="text-sm text-muted-foreground">7-day growth prediction</p>
                    </div>
                    <Badge variant={
                      dashboard?.growth?.forecastTrend === "POSITIVE" ? "default" :
                      dashboard?.growth?.forecastTrend === "NEGATIVE" ? "destructive" : "secondary"
                    } className="text-lg px-4">
                      {dashboard?.growth?.forecastTrend || "NEUTRAL"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                  Cost Reduction Insights
                </CardTitle>
                <CardDescription>Expense optimization opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {dashboard?.cost?.topActions?.map((action, i) => (
                      <ActionItem
                        key={action.id || i}
                        title={action.title}
                        description={`Potential savings: $${action.estimatedSavings}`}
                        priority={action.priority}
                        category={action.category}
                      />
                    )) || (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No cost saving actions detected
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Partner Performance
                </CardTitle>
                <CardDescription>Partner success metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{dashboard?.partner?.averageDriverRating?.toFixed(1) || "0"}</p>
                      <p className="text-xs text-muted-foreground">Avg Driver Rating</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{dashboard?.partner?.averageRestaurantRating?.toFixed(1) || "0"}</p>
                      <p className="text-xs text-muted-foreground">Avg Restaurant Rating</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Low Performers</span>
                      <Badge variant="destructive">{dashboard?.partner?.lowPerformerCount || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Training Needed</span>
                      <Badge variant="secondary">{dashboard?.partner?.trainingNeeded || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Top Performers</span>
                      <Badge className="bg-green-500">{dashboard?.partner?.topPerformerCount || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending Actions</span>
                      <Badge variant="outline">{dashboard?.partner?.pendingActions || 0}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  Fraud Alerts
                </CardTitle>
                <CardDescription>Security threats detected</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {dashboard?.fraud?.topAlerts?.slice(0, 5).map((alert, i) => (
                      <AlertItem
                        key={alert.id || i}
                        title={alert.title}
                        severity={alert.severity}
                        category={alert.category}
                        riskScore={alert.riskScore}
                      />
                    )) || (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mb-2 text-green-500" />
                        <p className="text-sm">No fraud alerts detected</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-slate-500" />
                  Compliance Status
                </CardTitle>
                <CardDescription>Regulatory compliance overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full border-8 border-muted flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-3xl font-bold">{dashboard?.compliance?.complianceScore || 0}%</p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Violations</span>
                      <Badge variant={dashboard?.compliance?.totalViolations ? "destructive" : "secondary"}>
                        {dashboard?.compliance?.totalViolations || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">BD Violations</span>
                      <Badge variant="outline">{dashboard?.compliance?.bdViolations || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">US Violations</span>
                      <Badge variant="outline">{dashboard?.compliance?.usViolations || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending Actions</span>
                      <Badge variant="secondary">{dashboard?.compliance?.pendingActions || 0}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-purple-500" />
                  Content Ready
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Social Captions</span>
                    <Badge>{dashboard?.marketing?.socialCaptionsReady || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Notification Templates</span>
                    <Badge>{dashboard?.marketing?.notificationTemplates || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Local Ideas</span>
                    <Badge>{dashboard?.marketing?.localIdeas || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold">{dashboard?.marketing?.upcomingCampaigns || 0}</p>
                  <p className="text-sm text-muted-foreground">Upcoming Campaigns</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Estimated Reach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold">{dashboard?.marketing?.totalEstimatedReach?.toLocaleString() || 0}</p>
                  <p className="text-sm text-muted-foreground">Potential Customers</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                Customer Retention
              </CardTitle>
              <CardDescription>Win-back opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{dashboard?.retention?.unhappyCustomerCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Unhappy Customers</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg text-center border border-red-500/20">
                  <p className="text-2xl font-bold text-red-500">{dashboard?.retention?.criticalChurnRisk || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical Churn Risk</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg text-center border border-blue-500/20">
                  <p className="text-2xl font-bold text-blue-500">{dashboard?.retention?.winBackCandidates || 0}</p>
                  <p className="text-xs text-muted-foreground">Win-back Candidates</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg text-center border border-green-500/20">
                  <p className="text-2xl font-bold text-green-500">${dashboard?.retention?.totalRetentionValue?.toLocaleString() || 0}</p>
                  <p className="text-xs text-muted-foreground">Value at Risk</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-500" />
                AI-Recommended Actions
              </CardTitle>
              <CardDescription>Prioritized actions to improve business performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dashboard?.cost?.topActions?.map((action, i) => (
                    <ActionItem
                      key={action.id || i}
                      title={action.title}
                      description={`Save $${action.estimatedSavings} - Priority: ${action.priority}`}
                      priority={action.priority}
                      category={action.category}
                    />
                  ))}
                  
                  {(dashboard?.growth?.criticalGaps || 0) > 0 && (
                    <ActionItem
                      title="Address Critical Supply Gaps"
                      description={`${dashboard?.growth?.criticalGaps} critical gaps need immediate attention`}
                      priority={95}
                      category="GROWTH"
                    />
                  )}

                  {(dashboard?.fraud?.criticalAlerts || 0) > 0 && (
                    <ActionItem
                      title="Investigate Critical Fraud Alerts"
                      description={`${dashboard?.fraud?.criticalAlerts} critical security issues detected`}
                      priority={100}
                      category="SECURITY"
                    />
                  )}

                  {(dashboard?.compliance?.criticalViolations || 0) > 0 && (
                    <ActionItem
                      title="Resolve Compliance Violations"
                      description={`${dashboard?.compliance?.criticalViolations} critical compliance issues`}
                      priority={98}
                      category="COMPLIANCE"
                    />
                  )}

                  {(dashboard?.retention?.criticalChurnRisk || 0) > 0 && (
                    <ActionItem
                      title="Engage At-Risk Customers"
                      description={`${dashboard?.retention?.criticalChurnRisk} customers at high churn risk`}
                      priority={85}
                      category="RETENTION"
                    />
                  )}

                  {(dashboard?.partner?.lowPerformerCount || 0) > 0 && (
                    <ActionItem
                      title="Coach Low-Performing Partners"
                      description={`${dashboard?.partner?.lowPerformerCount} partners need improvement`}
                      priority={75}
                      category="PARTNER"
                    />
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center">
        Last updated: {dashboard?.lastUpdated ? new Date(dashboard.lastUpdated).toLocaleString() : "Never"}
      </div>
    </div>
  );
}
