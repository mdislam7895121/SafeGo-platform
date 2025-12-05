import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  Zap,
  Target,
  Brain,
  Cog,
  Activity,
  FileText,
  Headphones,
  Lightbulb,
  Server,
  Settings,
  MessageSquare,
  TestTube,
  Play,
  Send,
  Loader2,
  AlertOctagon,
  MapPin,
  Eye,
  LineChart,
  PlayCircle,
  X,
  Radio,
  BarChart3,
} from "lucide-react";
import { SafePilotIcon } from "@/components/safepilot/SafePilotLogo";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Vision2030ModuleData {
  mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE';
  summary: string[];
  keySignals: string[];
  actions: Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' }>;
  monitor: string[];
  moduleData?: Record<string, unknown>;
}

type ModuleKey = 'growth' | 'cost-reduction' | 'fraud-shield' | 'partner-coach' | 
                 'customer-retention' | 'marketing-ai' | 'financial-intelligence' | 'legal-compliance';

const MODULE_CONFIG: Record<ModuleKey, { title: string; icon: typeof TrendingUp; color: string }> = {
  'growth': { title: 'Growth Engine', icon: TrendingUp, color: 'bg-green-500' },
  'cost-reduction': { title: 'Cost Reduction', icon: DollarSign, color: 'bg-blue-500' },
  'fraud-shield': { title: 'Fraud Shield', icon: Shield, color: 'bg-red-500' },
  'partner-coach': { title: 'Partner Coach', icon: Users, color: 'bg-orange-500' },
  'customer-retention': { title: 'Customer Retention', icon: Heart, color: 'bg-pink-500' },
  'marketing-ai': { title: 'Marketing AI', icon: Megaphone, color: 'bg-purple-500' },
  'financial-intelligence': { title: 'Financial Intelligence', icon: PieChart, color: 'bg-cyan-500' },
  'legal-compliance': { title: 'Legal & Compliance', icon: Scale, color: 'bg-slate-500' },
};

function ModuleDetailPanel({ 
  moduleKey, 
  data, 
  isLoading, 
  onClose 
}: { 
  moduleKey: ModuleKey; 
  data: Vision2030ModuleData | null; 
  isLoading: boolean;
  onClose: () => void;
}) {
  const config = MODULE_CONFIG[moduleKey];
  const Icon = config.icon;

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'GUARD': return 'bg-red-500 text-white';
      case 'WATCH': return 'bg-blue-500 text-white';
      case 'OPTIMIZE': return 'bg-green-500 text-white';
      default: return 'bg-purple-500 text-white';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH_RISK': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'CAUTION': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      default: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 px-4">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Unable to load module data</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", config.color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{config.title}</h3>
            <Badge className={getModeColor(data.mode)}>{data.mode} MODE</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-module">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <SafePilotIcon size="xs" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.summary.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-500" />
            Key Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {data.keySignals.map((signal, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {signal}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.actions.map((action, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg border text-sm",
                  getRiskColor(action.risk)
                )}
              >
                <span>{action.label}</span>
                <Badge variant="outline" className="text-xs shrink-0 ml-2">
                  {action.risk.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-500" />
            What to Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {data.monitor.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-3 w-3 shrink-0" />
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DiagnosticResult {
  timestamp: string;
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  summary: {
    totalModules: number;
    passed: number;
    failed: number;
    successRate: string;
  };
  modeDistribution: {
    WATCH: number;
    OPTIMIZE: number;
    GUARD: number;
    ASK: number;
  };
  vision2030Compliance: {
    allModesValid: boolean;
    structuredResponses: boolean;
    fallbacksWorking: boolean;
  };
  modules: Record<string, {
    status: 'PASS' | 'FAIL';
    mode: string;
    modeValid: boolean;
    hasData: boolean;
    metrics: Record<string, number | string>;
    responseTime: number;
    error?: string;
  }>;
  totalDiagnosticTime: string;
}

function DiagnosticPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const response = await apiRequest('GET', '/api/admin/safepilot/diagnostic');
      if (!response.ok) {
        throw new Error('Diagnostic failed');
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY': return 'bg-green-500 text-white';
      case 'DEGRADED': return 'bg-yellow-500 text-white';
      case 'CRITICAL': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'GUARD': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'WATCH': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'OPTIMIZE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'PASS' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-blue-500" />
                SafePilot System Diagnostic
              </CardTitle>
              <CardDescription>
                Test all 8 Intelligence Modules across WATCH, OPTIMIZE, GUARD, and ASK modes
              </CardDescription>
            </div>
            <Button 
              onClick={runDiagnostic} 
              disabled={isRunning}
              data-testid="button-run-diagnostic"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Diagnostic
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {!result && !error && !isRunning && (
            <div className="text-center py-12 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Run Diagnostic" to test all SafePilot Intelligence Modules</p>
            </div>
          )}
          
          {result && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-xs text-muted-foreground">System Health</p>
                  <Badge className={cn("mt-1", getHealthColor(result.systemHealth))}>
                    {result.systemHealth}
                  </Badge>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-green-500">{result.summary.successRate}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-xs text-muted-foreground">Modules Passed</p>
                  <p className="text-2xl font-bold">{result.summary.passed}/{result.summary.totalModules}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-xs text-muted-foreground">Diagnostic Time</p>
                  <p className="text-2xl font-bold">{result.totalDiagnosticTime}</p>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Mode Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 flex-wrap">
                    {Object.entries(result.modeDistribution).map(([mode, count]) => (
                      <div key={mode} className="flex items-center gap-2">
                        <Badge className={getModeColor(mode)}>{mode}</Badge>
                        <span className="text-lg font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Vision 2030 Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      {result.vision2030Compliance.allModesValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm">All Modes Valid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.vision2030Compliance.structuredResponses ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm">Structured Responses</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.vision2030Compliance.fallbacksWorking ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm">Fallbacks Working</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Module Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(result.modules).map(([moduleKey, moduleResult]) => {
                      const config = MODULE_CONFIG[moduleKey as ModuleKey];
                      const Icon = config?.icon || Activity;
                      return (
                        <div 
                          key={moduleKey}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", config?.color || "bg-gray-500")}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{config?.title || moduleKey}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge className={getStatusColor(moduleResult.status)} variant="outline">
                                  {moduleResult.status}
                                </Badge>
                                <Badge className={getModeColor(moduleResult.mode)} variant="outline">
                                  {moduleResult.mode}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p>{moduleResult.responseTime}ms</p>
                            {moduleResult.error && (
                              <p className="text-red-500 text-xs">{moduleResult.error}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Last diagnostic: {new Date(result.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  workforce: {
    totalAutomationRules: number;
    activeRules: number;
    proposedRules: number;
    estimatedHoursSavedPerWeek: number;
    automationCoveragePercent: number;
    adminWorkloadTrend: string;
  };
  health: {
    overallHealth: string;
    healthScore: number;
    criticalServices: number;
    degradedServices: number;
    activeJobs: number;
    failedJobs: number;
  };
  policy: {
    totalPolicies: number;
    activePolicies: number;
    draftPolicies: number;
    pendingSuggestions: number;
    averageImpactScore: number;
    policyEffectivenessPercent: number;
  };
  support: {
    totalPendingTickets: number;
    autoResolvable: number;
    avgResponseTime: number;
    customerSatisfaction: number;
    escalationRate: number;
    templateUsagePercent: number;
  };
  advisor: {
    overallScore: number;
    priorityActions: number;
    growthOpportunities: number;
    efficiencyGains: number;
    competitivePosition: string;
    monthsToBreakeven: number;
  };
  safety: {
    activeAlerts: number;
    routeDeviations: number;
    unsafeBehaviorCount: number;
    activeSOSAlerts: number;
    avgSeverityScore: number;
    recentIncidents: number;
  };
  location: {
    gpsSpoofingSuspects: number;
    teleportationAlerts: number;
    abnormalPatterns: number;
    flaggedDrivers: number;
    integrityScore: number;
    recentViolations: number;
  };
  insider: {
    suspiciousActivities: number;
    flaggedAdmins: number;
    afterHoursAccess: number;
    bulkOperations: number;
    threatLevel: string;
    lastSecurityReview: string;
  };
  predictive: {
    demandForecast24h: {
      totalPredictedRides: number;
      confidence: number;
    };
    churnRisk: {
      atRiskCustomers: number;
      potentialRevenueLoss: number;
    };
    revenueOutlook: {
      weeklyProjection: number;
      growthTrend: string;
    };
    capacityAlerts: number;
    fraudRiskEntities: number;
  };
  autoDecision: {
    pendingSuggestions: number;
    autoBlockedToday: number;
    reviewQueueSize: number;
    approvalRate: number;
    reversalRate: number;
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
        "cursor-pointer transition-all hover-elevate touch-manipulation",
        status === "critical" && "border-destructive/50",
        status === "warning" && "border-yellow-500/50"
      )}
      onClick={onClick}
      data-testid={`card-module-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="p-2.5 sm:p-4 pb-1.5 sm:pb-2">
        <div className="flex items-start sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", color)}>
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">{title}</CardTitle>
              <CardDescription className="text-[10px] sm:text-xs truncate">{description}</CardDescription>
            </div>
          </div>
          {status === "critical" && (
            <Badge variant="destructive" className="text-[10px] sm:text-xs shrink-0">!</Badge>
          )}
          {status === "warning" && (
            <Badge className="bg-yellow-500 text-[10px] sm:text-xs shrink-0">!</Badge>
          )}
          {status === "healthy" && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0 hidden sm:inline-flex">OK</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2.5 sm:p-4 pt-0 sm:pt-0">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {metrics.map((metric, i) => (
            <div key={i} className="space-y-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{metric.label}</p>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <p className="text-xs sm:text-sm font-semibold truncate">{metric.value}</p>
                {metric.trend === "up" && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500 shrink-0" />}
                {metric.trend === "down" && <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500 shrink-0" />}
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
      className="flex items-center justify-between p-2 sm:p-3 border rounded-lg hover-elevate cursor-pointer touch-manipulation gap-2"
      onClick={onClick}
      data-testid={`action-item-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className={cn(
          "w-2 h-2 rounded-full shrink-0",
          priority >= 90 ? "bg-red-500" : priority >= 70 ? "bg-yellow-500" : "bg-blue-500"
        )} />
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium truncate">{title}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:inline-flex">{category}</Badge>
        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
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
    <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg gap-2" data-testid={`alert-item-${category}`}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <AlertTriangle className={cn(
          "h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0",
          severity === "CRITICAL" ? "text-red-500" : 
          severity === "HIGH" ? "text-orange-500" : "text-yellow-500"
        )} />
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium truncate">{title}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{category.replace(/_/g, " ")}</p>
        </div>
      </div>
      <div className="flex items-center shrink-0">
        <Badge variant={severity === "CRITICAL" ? "destructive" : "secondary"} className="text-[10px] sm:text-xs">
          {riskScore}%
        </Badge>
      </div>
    </div>
  );
}

const PRELOADED_TEST_QUESTIONS = [
  { id: "1", category: "Cost", question: "How can I reduce operating costs this month?", response: "Based on SafePilot analysis: 1) You have 12 refund abuse cases worth $3,240 - consider tightening refund policies. 2) Driver incentive overspend detected in 3 zones - recommend reducing by 15%. 3) Unused promotional codes cost $890 monthly - consider expiration. Total potential savings: $5,847/month." },
  { id: "2", category: "Growth", question: "Where should we expand next?", response: "Growth Engine recommends: 1) Downtown financial district shows 340% unmet demand during lunch hours. 2) University area has high request rate but low driver coverage - add 8 drivers to capture $12,000/month. 3) Industrial zone shows emerging demand pattern for parcel delivery." },
  { id: "3", category: "Fraud", question: "Are there any active fraud risks?", response: "Fraud Shield detected: 1) 3 accounts with duplicate KYC documents - flagged for review. 2) 1 driver showing unusual trip patterns (possible GPS spoofing). 3) 2 customer accounts with abnormal refund requests. Recommended action: Review flagged accounts in Fraud Dashboard." },
  { id: "4", category: "Support", question: "How can we reduce support ticket volume?", response: "Support AI analysis: 1) 45% of tickets are about order status - implement proactive notifications. 2) 23% are refund requests - add self-service refund for orders under $15. 3) 18% are driver complaints - improve driver app UX. Estimated ticket reduction: 40%." },
  { id: "5", category: "Partner", question: "Which drivers need attention?", response: "Partner AI insights: 1) 5 drivers with ratings below 4.0 need coaching. 2) 3 high-performers are at churn risk (earnings dropped 30%). 3) 8 new drivers haven't completed training. Recommended: Schedule coaching sessions and retention bonuses for top performers." },
  { id: "6", category: "Revenue", question: "How can we increase revenue this quarter?", response: "Revenue optimization opportunities: 1) Enable surge pricing during peak hours (estimated +$8,400/week). 2) Launch loyalty program to increase order frequency (+12% projected). 3) Add premium delivery tier for time-sensitive parcels. 4) Partner with 15 pending restaurants in high-demand zones." },
  { id: "7", category: "Compliance", question: "Are we meeting all compliance requirements?", response: "Compliance Guard status: Overall score 94%. 1) 2 drivers have expired documents - send renewal reminders. 2) Data retention policy needs update for EU customers. 3) Insurance certificates current for all active drivers. 4) Background check refresh due for 12 drivers next month." },
  { id: "8", category: "System", question: "How is our system health?", response: "System Health Monitor: Overall health 98%. All core services operational. 1) Database latency slightly elevated (42ms avg). 2) Job queue processing normally. 3) API response times within SLA. 4) Memory usage optimal. Next maintenance window: Sunday 2 AM." },
];

const DEMO_ACTIONS = [
  { id: "1", title: "Auto-approve low-risk KYC", description: "Automatically approve KYC for returning customers with verified history", impact: "Saves 4 hours/week" },
  { id: "2", title: "Enable dynamic surge pricing", description: "Turn on AI-driven surge pricing during detected peak hours", impact: "+$2,100/week estimated" },
  { id: "3", title: "Block detected fraud accounts", description: "Suspend 3 accounts flagged for suspicious activity", impact: "Prevents $890 potential loss" },
  { id: "4", title: "Send driver coaching alerts", description: "Notify 5 underperforming drivers with improvement tips", impact: "Improve ratings by 0.3 avg" },
  { id: "5", title: "Launch win-back campaign", description: "Send personalized offers to 47 churning customers", impact: "Recover $2,340 in revenue" },
];

export default function SafePilotIntelligence() {
  const [activeTab, setActiveTab] = useState("overview");
  const [testModeOpen, setTestModeOpen] = useState(false);
  const [demoModeActive, setDemoModeActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState<typeof PRELOADED_TEST_QUESTIONS[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  
  const [selectedModule, setSelectedModule] = useState<ModuleKey | null>(null);
  const [moduleData, setModuleData] = useState<Vision2030ModuleData | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);

  const fetchModuleData = async (moduleKey: ModuleKey) => {
    setModuleLoading(true);
    setSelectedModule(moduleKey);
    setModuleDialogOpen(true);
    
    try {
      const response = await fetch(`/api/admin/safepilot/modules/${moduleKey}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setModuleData(data);
      } else {
        setModuleData({
          mode: 'ASK',
          summary: ['Module data temporarily unavailable', 'Please try again shortly'],
          keySignals: ['Connection issue', 'Retry recommended'],
          actions: [{ label: 'Retry loading', risk: 'SAFE' }],
          monitor: ['System status'],
        });
      }
    } catch (error) {
      console.error('Failed to fetch module data:', error);
      setModuleData({
        mode: 'ASK',
        summary: ['Unable to connect to module', 'Check your connection'],
        keySignals: ['Network error'],
        actions: [{ label: 'Retry', risk: 'SAFE' }],
        monitor: ['Connection status'],
      });
    } finally {
      setModuleLoading(false);
    }
  };

  const closeModuleDetail = () => {
    setModuleDialogOpen(false);
    setSelectedModule(null);
    setModuleData(null);
  };

  useEffect(() => {
    if (demoModeActive && demoStep < PRELOADED_TEST_QUESTIONS.length) {
      const timer = setTimeout(() => {
        setSelectedQuestion(PRELOADED_TEST_QUESTIONS[demoStep]);
        setDemoStep(prev => prev + 1);
      }, 4000);
      return () => clearTimeout(timer);
    } else if (demoStep >= PRELOADED_TEST_QUESTIONS.length) {
      setDemoModeActive(false);
      setDemoStep(0);
    }
  }, [demoModeActive, demoStep]);

  const handleTestQuestion = (q: typeof PRELOADED_TEST_QUESTIONS[0]) => {
    setIsProcessing(true);
    setTimeout(() => {
      setSelectedQuestion(q);
      setIsProcessing(false);
    }, 800);
  };

  const startDemoMode = () => {
    setDemoModeActive(true);
    setDemoStep(0);
    setSelectedQuestion(null);
  };

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
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#2F80ED] to-[#56CCF2] shrink-0">
            <SafePilotIcon size="sm" className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#2F80ED] to-[#56CCF2] bg-clip-text text-transparent truncate" data-testid="text-page-title">SafePilot Intelligence</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              AI-powered business automation engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Dialog open={testModeOpen} onOpenChange={setTestModeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm touch-manipulation" data-testid="button-test-mode">
                <TestTube className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Test Mode</span>
                <span className="sm:hidden">Test</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <SafePilotIcon size="xs" />
                  SafePilot Test Mode
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Test SafePilot intelligence with preloaded questions and demo actions
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="questions" className="h-full">
                  <TabsList className="grid w-full grid-cols-3 h-auto">
                    <TabsTrigger value="questions" className="text-xs sm:text-sm py-1.5 sm:py-2">Questions</TabsTrigger>
                    <TabsTrigger value="actions" className="text-xs sm:text-sm py-1.5 sm:py-2">Actions</TabsTrigger>
                    <TabsTrigger value="demo" className="text-xs sm:text-sm py-1.5 sm:py-2">Demo</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="questions" className="h-[50vh] sm:h-[400px] overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 h-full">
                      <ScrollArea className="h-full border rounded-lg p-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground mb-3">Preloaded Questions</p>
                          {PRELOADED_TEST_QUESTIONS.map((q) => (
                            <Button
                              key={q.id}
                              variant="ghost"
                              className="w-full justify-start text-left h-auto py-2 px-3"
                              onClick={() => handleTestQuestion(q)}
                              data-testid={`button-test-question-${q.id}`}
                            >
                              <div>
                                <Badge variant="outline" className="mb-1 text-xs">{q.category}</Badge>
                                <p className="text-sm">{q.question}</p>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                      
                      <div className="border rounded-lg p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-3">SafePilot Response</p>
                        {isProcessing ? (
                          <div className="flex items-center justify-center h-[300px]">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Processing...</span>
                            </div>
                          </div>
                        ) : selectedQuestion ? (
                          <div className="space-y-3">
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm font-medium">{selectedQuestion.question}</p>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-[#2F80ED]/10 to-[#56CCF2]/10 rounded-lg border border-[#2F80ED]/20">
                              <div className="flex items-start gap-2">
                                <SafePilotIcon size="xs" className="mt-1" />
                                <p className="text-sm">{selectedQuestion.response}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                            <p className="text-sm">Select a question to see SafePilot's response</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="actions" className="h-[400px]">
                    <ScrollArea className="h-full">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground mb-4">
                          These are demo actions that SafePilot can execute automatically.
                        </p>
                        {DEMO_ACTIONS.map((action) => (
                          <Card key={action.id} className="hover-elevate">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h4 className="font-medium">{action.title}</h4>
                                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                                  <Badge className="mt-2 bg-green-500">{action.impact}</Badge>
                                </div>
                                <Button size="sm" variant="outline" data-testid={`button-demo-action-${action.id}`}>
                                  <Play className="h-3 w-3 mr-1" />
                                  Execute
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="demo" className="h-[400px]">
                    <div className="flex flex-col items-center justify-center h-full space-y-6">
                      <div className="text-center space-y-2">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2F80ED]/20 to-[#56CCF2]/20 flex items-center justify-center mx-auto">
                          <SafePilotIcon size="lg" />
                        </div>
                        <h3 className="text-lg font-semibold">Auto Demo Mode</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          SafePilot will automatically cycle through all test questions, showcasing its intelligence capabilities.
                        </p>
                      </div>
                      
                      {demoModeActive ? (
                        <div className="space-y-4 w-full max-w-md">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                            <span className="text-sm">Demo running... ({demoStep}/{PRELOADED_TEST_QUESTIONS.length})</span>
                          </div>
                          {selectedQuestion && (
                            <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5">
                              <CardContent className="p-4">
                                <Badge variant="outline" className="mb-2">{selectedQuestion.category}</Badge>
                                <p className="font-medium text-sm mb-2">{selectedQuestion.question}</p>
                                <p className="text-xs text-muted-foreground">{selectedQuestion.response}</p>
                              </CardContent>
                            </Card>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => setDemoModeActive(false)}
                            data-testid="button-stop-demo"
                          >
                            Stop Demo
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="lg"
                          onClick={startDemoMode}
                          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                          data-testid="button-start-demo"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Auto Demo
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-xs sm:text-sm touch-manipulation"
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2", isRefetching && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <Dialog open={moduleDialogOpen} onOpenChange={(open) => !open && closeModuleDetail()}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <SafePilotIcon size="xs" />
              Intelligence Module
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Vision 2030 Analysis
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {selectedModule && (
              <ModuleDetailPanel
                moduleKey={selectedModule}
                data={moduleData}
                isLoading={moduleLoading}
                onClose={closeModuleDetail}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Monthly Revenue</p>
                <p className="text-base sm:text-xl font-bold truncate" data-testid="text-monthly-revenue">
                  ${dashboard?.financial?.monthlyPrediction?.toLocaleString() || 0}
                </p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500/50 shrink-0" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Potential Savings</p>
                <p className="text-base sm:text-xl font-bold truncate" data-testid="text-potential-savings">
                  ${dashboard?.cost?.totalPotentialSavings?.toLocaleString() || 0}
                </p>
              </div>
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500/50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Critical Alerts</p>
                <p className="text-base sm:text-xl font-bold" data-testid="text-critical-alerts">
                  {(dashboard?.fraud?.criticalAlerts || 0) + (dashboard?.compliance?.criticalViolations || 0)}
                </p>
              </div>
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500/50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-3 sm:pt-4 sm:px-6">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Compliance</p>
                <p className="text-base sm:text-xl font-bold" data-testid="text-compliance-score">
                  {dashboard?.compliance?.complianceScore || 0}%
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500/50 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
        <div className="w-full overflow-x-auto pb-1 -mb-1 scrollbar-none">
          <TabsList className="inline-flex w-max gap-1 p-1 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="growth" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-growth">Growth</TabsTrigger>
            <TabsTrigger value="operations" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-operations">Ops</TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-security">Security</TabsTrigger>
            <TabsTrigger value="automation" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-automation">Auto</TabsTrigger>
            <TabsTrigger value="advisor" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-advisor">Coach</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-actions">Actions</TabsTrigger>
            <TabsTrigger value="diagnostic" className="text-xs sm:text-sm py-1.5 px-2 sm:px-3 touch-manipulation whitespace-nowrap min-h-[36px]" data-testid="tab-diagnostic">Diagnostic</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
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
              onClick={() => fetchModuleData('growth')}
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
              onClick={() => fetchModuleData('cost-reduction')}
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
              onClick={() => fetchModuleData('fraud-shield')}
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
              onClick={() => fetchModuleData('partner-coach')}
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
              onClick={() => fetchModuleData('customer-retention')}
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
              onClick={() => fetchModuleData('marketing-ai')}
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
              onClick={() => fetchModuleData('financial-intelligence')}
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
              onClick={() => fetchModuleData('legal-compliance')}
            />

            <ModuleCard
              title="Workforce Automation"
              description="Admin task automation"
              icon={Cog}
              color="bg-indigo-500"
              status={getModuleStatus(0, dashboard?.workforce?.proposedRules || 0)}
              metrics={[
                { label: "Active Rules", value: dashboard?.workforce?.activeRules || 0 },
                { label: "Proposed", value: dashboard?.workforce?.proposedRules || 0 },
                { label: "Hours Saved", value: `${dashboard?.workforce?.estimatedHoursSavedPerWeek || 0}h` },
                { label: "Coverage", value: `${dashboard?.workforce?.automationCoveragePercent || 0}%` },
              ]}
            />

            <ModuleCard
              title="System Health"
              description="Infrastructure monitoring"
              icon={Activity}
              color="bg-emerald-500"
              status={getModuleStatus(
                dashboard?.health?.criticalServices || 0,
                dashboard?.health?.degradedServices || 0
              )}
              metrics={[
                { label: "Health Score", value: `${dashboard?.health?.healthScore || 0}%` },
                { label: "Critical", value: dashboard?.health?.criticalServices || 0 },
                { label: "Degraded", value: dashboard?.health?.degradedServices || 0 },
                { label: "Failed Jobs", value: dashboard?.health?.failedJobs || 0 },
              ]}
            />

            <ModuleCard
              title="Policy Engine"
              description="Dynamic policy management"
              icon={FileText}
              color="bg-amber-500"
              status={getModuleStatus(0, dashboard?.policy?.pendingSuggestions || 0)}
              metrics={[
                { label: "Active", value: dashboard?.policy?.activePolicies || 0 },
                { label: "Draft", value: dashboard?.policy?.draftPolicies || 0 },
                { label: "Suggestions", value: dashboard?.policy?.pendingSuggestions || 0 },
                { label: "Effectiveness", value: `${dashboard?.policy?.policyEffectivenessPercent || 0}%` },
              ]}
            />

            <ModuleCard
              title="Support AI"
              description="Automated customer support"
              icon={Headphones}
              color="bg-teal-500"
              status={getModuleStatus(0, (dashboard?.support?.totalPendingTickets || 0) > 50 ? 1 : 0)}
              metrics={[
                { label: "Pending", value: dashboard?.support?.totalPendingTickets || 0 },
                { label: "Auto-Resolve", value: dashboard?.support?.autoResolvable || 0 },
                { label: "CSAT", value: `${dashboard?.support?.customerSatisfaction || 0}%` },
                { label: "Response", value: `${dashboard?.support?.avgResponseTime || 0}m` },
              ]}
            />

            <ModuleCard
              title="Growth Advisor"
              description="Business coaching AI"
              icon={Lightbulb}
              color="bg-gradient-to-r from-purple-500 to-pink-500"
              status={getModuleStatus(0, dashboard?.advisor?.priorityActions || 0)}
              metrics={[
                { label: "Score", value: `${dashboard?.advisor?.overallScore || 0}/100` },
                { label: "Priority", value: dashboard?.advisor?.priorityActions || 0 },
                { label: "Opportunities", value: dashboard?.advisor?.growthOpportunities || 0 },
                { label: "Position", value: dashboard?.advisor?.competitivePosition || "N/A" },
              ]}
            />

            <ModuleCard
              title="Safety Incident"
              description="Real-time safety monitoring"
              icon={AlertOctagon}
              color="bg-rose-600"
              status={getModuleStatus(
                dashboard?.safety?.activeSOSAlerts || 0,
                dashboard?.safety?.activeAlerts || 0
              )}
              metrics={[
                { label: "Active Alerts", value: dashboard?.safety?.activeAlerts || 0 },
                { label: "SOS Alerts", value: dashboard?.safety?.activeSOSAlerts || 0 },
                { label: "Deviations", value: dashboard?.safety?.routeDeviations || 0 },
                { label: "Unsafe Behavior", value: dashboard?.safety?.unsafeBehaviorCount || 0 },
              ]}
            />

            <ModuleCard
              title="Location Integrity"
              description="GPS fraud detection"
              icon={MapPin}
              color="bg-violet-600"
              status={getModuleStatus(
                dashboard?.location?.teleportationAlerts || 0,
                dashboard?.location?.gpsSpoofingSuspects || 0
              )}
              metrics={[
                { label: "GPS Spoofing", value: dashboard?.location?.gpsSpoofingSuspects || 0 },
                { label: "Teleportation", value: dashboard?.location?.teleportationAlerts || 0 },
                { label: "Abnormal", value: dashboard?.location?.abnormalPatterns || 0 },
                { label: "Integrity", value: `${dashboard?.location?.integrityScore || 0}%` },
              ]}
            />

            <ModuleCard
              title="Insider Threat"
              description="Admin security monitoring"
              icon={Eye}
              color="bg-slate-700"
              status={getModuleStatus(
                dashboard?.insider?.flaggedAdmins || 0,
                dashboard?.insider?.suspiciousActivities || 0
              )}
              metrics={[
                { label: "Suspicious", value: dashboard?.insider?.suspiciousActivities || 0 },
                { label: "Flagged", value: dashboard?.insider?.flaggedAdmins || 0 },
                { label: "After Hours", value: dashboard?.insider?.afterHoursAccess || 0 },
                { label: "Bulk Ops", value: dashboard?.insider?.bulkOperations || 0 },
              ]}
            />

            <ModuleCard
              title="Predictive Analytics"
              description="AI forecasting engine"
              icon={LineChart}
              color="bg-sky-600"
              status={getModuleStatus(
                0,
                dashboard?.predictive?.capacityAlerts || 0
              )}
              metrics={[
                { label: "24h Rides", value: dashboard?.predictive?.demandForecast24h?.totalPredictedRides || 0 },
                { label: "Churn Risk", value: dashboard?.predictive?.churnRisk?.atRiskCustomers || 0 },
                { label: "Revenue", value: `$${(dashboard?.predictive?.revenueOutlook?.weeklyProjection || 0).toLocaleString()}` },
                { label: "Confidence", value: `${dashboard?.predictive?.demandForecast24h?.confidence || 0}%` },
              ]}
            />

            <ModuleCard
              title="Auto-Decision"
              description="Automated enforcement"
              icon={PlayCircle}
              color="bg-fuchsia-600"
              status={getModuleStatus(
                0,
                dashboard?.autoDecision?.pendingSuggestions || 0
              )}
              metrics={[
                { label: "Pending", value: dashboard?.autoDecision?.pendingSuggestions || 0 },
                { label: "Blocked Today", value: dashboard?.autoDecision?.autoBlockedToday || 0 },
                { label: "Queue", value: dashboard?.autoDecision?.reviewQueueSize || 0 },
                { label: "Approval", value: `${dashboard?.autoDecision?.approvalRate || 0}%` },
              ]}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Module Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Growth & Revenue</p>
                <p className="text-lg font-bold">4 modules</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Cost & Operations</p>
                <p className="text-lg font-bold">4 modules</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Security & Safety</p>
                <p className="text-lg font-bold">5 modules</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Automation & AI</p>
                <p className="text-lg font-bold">5 modules</p>
              </div>
            </div>
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

        <TabsContent value="automation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cog className="h-5 w-5 text-indigo-500" />
                  Workforce Automation
                </CardTitle>
                <CardDescription>Automate repetitive admin tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-lg text-center border border-indigo-500/20">
                      <p className="text-2xl font-bold">{dashboard?.workforce?.activeRules || 0}</p>
                      <p className="text-xs text-muted-foreground">Active Rules</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{dashboard?.workforce?.proposedRules || 0}</p>
                      <p className="text-xs text-muted-foreground">Proposed</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Hours Saved/Week</span>
                      <Badge className="bg-green-500">{dashboard?.workforce?.estimatedHoursSavedPerWeek || 0}h</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Automation Coverage</span>
                      <Badge variant="secondary">{dashboard?.workforce?.automationCoveragePercent || 0}%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Workload Trend</span>
                      <Badge variant="outline">{dashboard?.workforce?.adminWorkloadTrend || "STABLE"}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  System Health
                </CardTitle>
                <CardDescription>Infrastructure monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className={cn(
                      "w-24 h-24 rounded-full border-4 flex items-center justify-center",
                      dashboard?.health?.overallHealth === "HEALTHY" ? "border-green-500 bg-green-500/10" :
                      dashboard?.health?.overallHealth === "DEGRADED" ? "border-yellow-500 bg-yellow-500/10" :
                      "border-red-500 bg-red-500/10"
                    )}>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{dashboard?.health?.healthScore || 0}%</p>
                        <p className="text-xs text-muted-foreground">Health</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Critical Services</span>
                      <Badge variant={dashboard?.health?.criticalServices ? "destructive" : "secondary"}>
                        {dashboard?.health?.criticalServices || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Degraded Services</span>
                      <Badge variant="outline">{dashboard?.health?.degradedServices || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Failed Jobs</span>
                      <Badge variant={dashboard?.health?.failedJobs ? "destructive" : "secondary"}>
                        {dashboard?.health?.failedJobs || 0}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Dynamic Policy Engine
                </CardTitle>
                <CardDescription>AI-generated policies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">{dashboard?.policy?.activePolicies || 0}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">{dashboard?.policy?.draftPolicies || 0}</p>
                      <p className="text-xs text-muted-foreground">Draft</p>
                    </div>
                    <div className="p-2 bg-amber-500/10 rounded-lg text-center border border-amber-500/20">
                      <p className="text-xl font-bold">{dashboard?.policy?.pendingSuggestions || 0}</p>
                      <p className="text-xs text-muted-foreground">Suggested</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Policy Effectiveness</span>
                    <Badge className="bg-green-500">{dashboard?.policy?.policyEffectivenessPercent || 0}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-teal-500" />
                  Support Automation AI
                </CardTitle>
                <CardDescription>Automated ticket handling</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{dashboard?.support?.totalPendingTickets || 0}</p>
                      <p className="text-xs text-muted-foreground">Pending Tickets</p>
                    </div>
                    <div className="p-3 bg-teal-500/10 rounded-lg text-center border border-teal-500/20">
                      <p className="text-2xl font-bold">{dashboard?.support?.autoResolvable || 0}</p>
                      <p className="text-xs text-muted-foreground">Auto-Resolvable</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Customer Satisfaction</span>
                      <Badge className="bg-green-500">{dashboard?.support?.customerSatisfaction || 0}%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Avg Response Time</span>
                      <Badge variant="secondary">{dashboard?.support?.avgResponseTime || 0} min</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Escalation Rate</span>
                      <Badge variant="outline">{dashboard?.support?.escalationRate || 0}%</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advisor" className="space-y-4">
          <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-purple-500" />
                Growth Advisor - Business Coaching AI
              </CardTitle>
              <CardDescription>Strategic recommendations for your business</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-4xl font-bold">{dashboard?.advisor?.overallScore || 0}</p>
                    <p className="text-sm text-muted-foreground">Business Health Score</p>
                    <p className="text-xs text-muted-foreground mt-1">out of 100</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <p className="text-lg font-semibold">{dashboard?.advisor?.competitivePosition || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Market Position</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Key Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-sm">Priority Actions</span>
                      <Badge variant="destructive">{dashboard?.advisor?.priorityActions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-sm">Growth Opportunities</span>
                      <Badge className="bg-green-500">{dashboard?.advisor?.growthOpportunities || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-sm">Efficiency Gains</span>
                      <Badge variant="secondary">{dashboard?.advisor?.efficiencyGains || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-sm">Months to Breakeven</span>
                      <Badge variant="outline">{dashboard?.advisor?.monthsToBreakeven || 0}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Quick Actions</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-get-next-action">
                      <SafePilotIcon size="xs" className="mr-2" />
                      Get Next Best Action
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-revenue-accelerators">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      View Revenue Accelerators
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-market-analysis">
                      <Target className="h-4 w-4 mr-2" />
                      Market Opportunity Analysis
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-profitability-path">
                      <PieChart className="h-4 w-4 mr-2" />
                      Profitability Roadmap
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Business Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium">Revenue Optimization</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI has identified {dashboard?.advisor?.growthOpportunities || 0} opportunities to increase revenue
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium">Cost Efficiency</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard?.advisor?.efficiencyGains || 0} process improvements recommended
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium">Strategic Priority</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard?.advisor?.priorityActions || 0} high-impact actions require attention
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Coaching Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Focus on customer retention</p>
                      <p className="text-xs text-muted-foreground">VIP customers show high lifetime value potential</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Expand to high-demand zones</p>
                      <p className="text-xs text-muted-foreground">3 underserved areas identified with strong demand</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Zap className="h-5 w-5 text-purple-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Automate support tickets</p>
                      <p className="text-xs text-muted-foreground">45% of tickets can be auto-resolved</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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

        <TabsContent value="diagnostic" className="space-y-4">
          <DiagnosticPanel />
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center">
        Last updated: {dashboard?.lastUpdated ? new Date(dashboard.lastUpdated).toLocaleString() : "Never"}
      </div>
    </div>
  );
}
