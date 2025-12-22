import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Users, MessageSquare, Clock, DollarSign, Brain, Shield } from "lucide-react";

interface SafePilotFlags {
  customerSafePilotEnabled: boolean;
  rolloutPercentage: number;
  proactiveTriggersEnabled: boolean;
  autoFollowUpsEnabled: boolean;
  autoEscalationEnabled: boolean;
  adminReviewModeEnabled: boolean;
}

interface KPIMetrics {
  totalConversations: number;
  resolvedByAI: number;
  resolvedByAIPercentage: number;
  escalatedToHuman: number;
  escalatedPercentage: number;
  avgResolutionTimeMinutes: number;
  angryResolvedCount: number;
  angryResolvedRate: number;
  followUpsSent: number;
  followUpSuccessRate: number;
  ticketReductionPercentage: number;
  emotionBreakdown: {
    angry: number;
    confused: number;
    normal: number;
  };
  dailyTrend: Array<{
    date: string;
    conversations: number;
    resolved: number;
    escalated: number;
  }>;
}

interface CostReport {
  period: { start: string; end: string };
  ticketsAvoidedByAI: number;
  avgHandlingTimeMinutes: number;
  humanHoursSaved: number;
  estimatedCostSavedUSD: number;
  aiCostUSD: number;
  netSavingsUSD: number;
  costPerHumanTicketUSD: number;
  costPerAIResolutionUSD: number;
  roiPercentage: number;
  breakdown: {
    preAITicketVolume: number;
    currentTicketVolume: number;
    aiResolvedCount: number;
    escalatedCount: number;
  };
}

export default function SafePilotDashboard() {
  const [period, setPeriod] = useState<"today" | "7days" | "30days">("7days");
  const [country, setCountry] = useState<string>("all");
  const [service, setService] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: flagsData, isLoading: flagsLoading } = useQuery<{ flags: SafePilotFlags }>({
    queryKey: ["/api/safepilot/admin/flags"],
  });

  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpi } = useQuery<{ kpis: KPIMetrics }>({
    queryKey: ["/api/safepilot/admin/kpi", period, country, service],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (country !== "all") params.append("country", country);
      if (service !== "all") params.append("service", service);
      const res = await fetch(`/api/safepilot/admin/kpi?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: costData, isLoading: costLoading } = useQuery<{ report: CostReport }>({
    queryKey: ["/api/safepilot/admin/cost-report", period],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      const res = await fetch(`/api/safepilot/admin/cost-report?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: async ({ key, enabled, rolloutPercentage }: { key: string; enabled: boolean; rolloutPercentage?: number }) => {
      const res = await fetch(`/api/safepilot/admin/flags/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled, rolloutPercentage }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safepilot/admin/flags"] });
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (disable: boolean) => {
      const res = await fetch("/api/safepilot/admin/flags/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ disable }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safepilot/admin/flags"] });
    },
  });

  const handleDownloadReport = async (format: "csv" | "json") => {
    const params = new URLSearchParams({ period, format });
    window.open(`/api/safepilot/admin/cost-report/download?${params}`, "_blank");
  };

  const flags = flagsData?.flags;
  const kpis = kpiData?.kpis;
  const cost = costData?.report;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SafePilot Dashboard</h1>
          <p className="text-muted-foreground">AI Customer Support Performance & Control Center</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="US">US</SelectItem>
              <SelectItem value="BD">BD</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchKpi()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="kpis" className="space-y-6">
        <TabsList>
          <TabsTrigger value="kpis">Performance KPIs</TabsTrigger>
          <TabsTrigger value="costs">Cost & Savings</TabsTrigger>
          <TabsTrigger value="controls">Feature Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="kpis" className="space-y-6">
          {kpiLoading ? (
            <div className="text-center py-8">Loading KPIs...</div>
          ) : kpis ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.totalConversations}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">AI Resolution Rate</CardTitle>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {kpis.resolvedByAIPercentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">{kpis.resolvedByAI} resolved by AI</p>
                    <Progress value={kpis.resolvedByAIPercentage} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {kpis.escalatedPercentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">{kpis.escalatedToHuman} escalated to human</p>
                    <Progress value={kpis.escalatedPercentage} className="mt-2 bg-orange-100" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.avgResolutionTimeMinutes} min</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Angry Customer Resolution</CardTitle>
                    <CardDescription>Customers detected as angry who were successfully helped</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.angryResolvedRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">{kpis.angryResolvedCount} resolved</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Follow-Up Success</CardTitle>
                    <CardDescription>Follow-ups that led to issue resolution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.followUpSuccessRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">{kpis.followUpsSent} sent</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Ticket Reduction</CardTitle>
                    <CardDescription>Reduction in support tickets vs baseline</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-green-600">
                        {kpis.ticketReductionPercentage > 0 ? "-" : ""}
                        {kpis.ticketReductionPercentage}%
                      </div>
                      {kpis.ticketReductionPercentage > 0 ? (
                        <TrendingDown className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Emotion Distribution</CardTitle>
                  <CardDescription>Customer emotional state breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-8">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Angry: {kpis.emotionBreakdown.angry}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Confused: {kpis.emotionBreakdown.confused}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Normal: {kpis.emotionBreakdown.normal}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          {costLoading ? (
            <div className="text-center py-8">Loading cost report...</div>
          ) : cost ? (
            <>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleDownloadReport("csv")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
                <Button variant="outline" onClick={() => handleDownloadReport("json")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${cost.netSavingsUSD.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">AI cost: ${cost.aiCostUSD.toFixed(2)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Human Hours Saved</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{cost.humanHoursSaved} hrs</div>
                    <p className="text-xs text-muted-foreground">@ ${12}/hr</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Tickets Avoided</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{cost.ticketsAvoidedByAI}</div>
                    <p className="text-xs text-muted-foreground">Resolved by AI</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">ROI</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{cost.roiPercentage}%</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Comparison</CardTitle>
                  <CardDescription>AI vs Human Support Costs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Cost per Human Ticket</span>
                      <Badge variant="outline">${cost.costPerHumanTicketUSD}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cost per AI Resolution</span>
                      <Badge variant="outline" className="bg-green-50">${cost.costPerAIResolutionUSD}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Savings per Resolution</span>
                      <Badge className="bg-green-600">
                        ${(cost.costPerHumanTicketUSD - cost.costPerAIResolutionUSD).toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Volume Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Pre-AI Baseline (30d)</p>
                      <p className="text-xl font-bold">{cost.breakdown.preAITicketVolume}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Tickets</p>
                      <p className="text-xl font-bold">{cost.breakdown.currentTicketVolume}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">AI Resolved</p>
                      <p className="text-xl font-bold text-green-600">{cost.breakdown.aiResolvedCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Escalated</p>
                      <p className="text-xl font-bold text-orange-600">{cost.breakdown.escalatedCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="controls" className="space-y-6">
          {flagsLoading ? (
            <div className="text-center py-8">Loading controls...</div>
          ) : flags ? (
            <>
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Kill Switch
                  </CardTitle>
                  <CardDescription>
                    Emergency control to disable all SafePilot automation features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Automation Status</p>
                      <p className="text-sm text-muted-foreground">
                        Disables proactive triggers, auto follow-ups, and auto escalation
                      </p>
                    </div>
                    <Button
                      variant={flags.proactiveTriggersEnabled ? "destructive" : "default"}
                      onClick={() => killSwitchMutation.mutate(flags.proactiveTriggersEnabled)}
                      disabled={killSwitchMutation.isPending}
                    >
                      {flags.proactiveTriggersEnabled ? "Disable All" : "Enable All"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rollout Settings</CardTitle>
                  <CardDescription>Control SafePilot availability for customers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">SafePilot Enabled</Label>
                      <p className="text-sm text-muted-foreground">Master switch for customer SafePilot</p>
                    </div>
                    <Switch
                      checked={flags.customerSafePilotEnabled}
                      onCheckedChange={(checked) =>
                        updateFlagMutation.mutate({
                          key: "safepilot_customer_enabled",
                          enabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-medium">Rollout Percentage: {flags.rolloutPercentage}%</Label>
                    <p className="text-sm text-muted-foreground">
                      Percentage of customers who see SafePilot
                    </p>
                    <div className="flex gap-2">
                      {[10, 25, 50, 75, 100].map((pct) => (
                        <Button
                          key={pct}
                          variant={flags.rolloutPercentage === pct ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            updateFlagMutation.mutate({
                              key: "safepilot_rollout_percentage",
                              enabled: true,
                              rolloutPercentage: pct,
                            })
                          }
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feature Toggles</CardTitle>
                  <CardDescription>Individual feature controls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Proactive Triggers</Label>
                      <p className="text-sm text-muted-foreground">Show contextual help prompts</p>
                    </div>
                    <Switch
                      checked={flags.proactiveTriggersEnabled}
                      onCheckedChange={(checked) =>
                        updateFlagMutation.mutate({
                          key: "safepilot_proactive_triggers",
                          enabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Auto Follow-Ups</Label>
                      <p className="text-sm text-muted-foreground">Send reminders for unresolved issues</p>
                    </div>
                    <Switch
                      checked={flags.autoFollowUpsEnabled}
                      onCheckedChange={(checked) =>
                        updateFlagMutation.mutate({
                          key: "safepilot_auto_followups",
                          enabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Auto Escalation</Label>
                      <p className="text-sm text-muted-foreground">Automatically escalate to human support</p>
                    </div>
                    <Switch
                      checked={flags.autoEscalationEnabled}
                      onCheckedChange={(checked) =>
                        updateFlagMutation.mutate({
                          key: "safepilot_auto_escalation",
                          enabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Admin Review Mode</Label>
                      <p className="text-sm text-muted-foreground">Sample AI responses for quality review</p>
                    </div>
                    <Switch
                      checked={flags.adminReviewModeEnabled}
                      onCheckedChange={(checked) =>
                        updateFlagMutation.mutate({
                          key: "safepilot_admin_review_mode",
                          enabled: checked,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
