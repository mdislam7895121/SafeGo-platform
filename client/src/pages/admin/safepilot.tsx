import { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  DollarSign,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  BarChart3,
  MessageSquare,
  Lightbulb,
  Brain,
  Users,
  Heart,
  Megaphone,
  PieChart,
  Scale,
  ExternalLink,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  Target,
  TrendingDown,
  Activity,
  UserX,
  Ban,
  FileCheck,
  CreditCard,
  Eye,
  Radio,
  ShieldCheck,
  Gauge,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

type SafePilotMode = 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE';
type RiskLevel = 'SAFE' | 'CAUTION' | 'HIGH_RISK';

interface SafePilotAction {
  label: string;
  risk: RiskLevel;
  actionType?: string;
  payload?: Record<string, unknown>;
}

interface SafePilotQueryResponse {
  mode: SafePilotMode;
  summary: string[];
  keySignals: string[];
  actions: SafePilotAction[];
  monitor: string[];
  answerText?: string;
  insights?: Array<{
    type: string;
    title: string;
    detail: string;
    severity: string;
  }>;
  suggestions?: Array<{
    key: string;
    label: string;
    actionType: string;
    payload: Record<string, unknown>;
  }>;
  riskLevel?: string;
  error?: string;
}

interface SafePilotHistoryItem {
  id: string;
  pageKey: string;
  question: string;
  responseSummary: string;
  riskLevel: string;
  timestamp: string;
}

const quickActions = [
  { id: 'block-user', label: 'Block Suspicious User', icon: Ban, color: 'text-red-500' },
  { id: 'approve-kyc', label: 'Approve KYC', icon: FileCheck, color: 'text-green-500' },
  { id: 'process-refund', label: 'Process Refund', icon: CreditCard, color: 'text-blue-500' },
  { id: 'flag-fraud', label: 'Flag for Fraud Review', icon: AlertTriangle, color: 'text-orange-500' },
  { id: 'suspend-driver', label: 'Suspend Driver', icon: UserX, color: 'text-red-500' },
  { id: 'priority-support', label: 'Escalate to Priority', icon: Zap, color: 'text-purple-500' },
];

const intelligenceModules = [
  { 
    id: 'growth', 
    name: 'Growth Engine', 
    icon: TrendingUp, 
    color: 'bg-green-500/10 text-green-600',
    description: 'Revenue optimization & market expansion',
    query: 'What are the top growth opportunities right now?'
  },
  { 
    id: 'cost', 
    name: 'Cost Reduction', 
    icon: DollarSign, 
    color: 'bg-blue-500/10 text-blue-600',
    description: 'Detect abuse & reduce operational costs',
    query: 'How can we reduce operational costs this month?'
  },
  { 
    id: 'fraud', 
    name: 'Fraud Shield', 
    icon: Shield, 
    color: 'bg-red-500/10 text-red-600',
    description: 'Real-time fraud detection & prevention',
    query: 'Show me current fraud alerts and suspicious activities'
  },
  { 
    id: 'partner', 
    name: 'Partner Coach', 
    icon: Users, 
    color: 'bg-purple-500/10 text-purple-600',
    description: 'Partner performance & coaching',
    query: 'Which partners need attention or coaching?'
  },
  { 
    id: 'retention', 
    name: 'Customer Retention', 
    icon: Heart, 
    color: 'bg-pink-500/10 text-pink-600',
    description: 'Churn prediction & win-back strategies',
    query: 'Which customers are at risk of churning?'
  },
  { 
    id: 'marketing', 
    name: 'Marketing AI', 
    icon: Megaphone, 
    color: 'bg-orange-500/10 text-orange-600',
    description: 'Campaign optimization & segmentation',
    query: 'What marketing campaigns should we run this week?'
  },
  { 
    id: 'finance', 
    name: 'Financial Intelligence', 
    icon: PieChart, 
    color: 'bg-emerald-500/10 text-emerald-600',
    description: 'Revenue forecasting & profitability',
    query: 'What is the revenue forecast for this month?'
  },
  { 
    id: 'compliance', 
    name: 'Legal & Compliance', 
    icon: Scale, 
    color: 'bg-slate-500/10 text-slate-600',
    description: 'Regulatory monitoring & audit prep',
    query: 'Are there any compliance issues I need to address?'
  },
];

const getModeConfig = (mode: SafePilotMode) => {
  switch (mode) {
    case 'WATCH':
      return { icon: Eye, color: 'bg-blue-500', label: 'WATCH MODE', description: 'Monitoring & Alerts' };
    case 'GUARD':
      return { icon: ShieldCheck, color: 'bg-red-500', label: 'GUARD MODE', description: 'Security & Fraud' };
    case 'OPTIMIZE':
      return { icon: Gauge, color: 'bg-green-500', label: 'OPTIMIZE MODE', description: 'Performance & Revenue' };
    default:
      return { icon: MessageSquare, color: 'bg-purple-500', label: 'ASK MODE', description: 'General Queries' };
  }
};

const getRiskBadge = (risk: RiskLevel) => {
  switch (risk) {
    case 'HIGH_RISK':
      return <Badge variant="destructive" className="text-[10px] sm:text-xs">[HIGH RISK]</Badge>;
    case 'CAUTION':
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-[10px] sm:text-xs">[CAUTION]</Badge>;
    default:
      return <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] sm:text-xs">[SAFE]</Badge>;
  }
};

export default function SafePilotPage() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<SafePilotQueryResponse | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [monitorExpanded, setMonitorExpanded] = useState(false);
  const { toast } = useToast();

  const { data: contextData, isLoading: contextLoading } = useQuery({
    queryKey: ['/api/admin/safepilot/context', 'admin.dashboard'],
    enabled: true,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<SafePilotHistoryItem[]>({
    queryKey: ['/api/admin/safepilot/history'],
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/safepilot/metrics'],
  });

  const queryMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest('POST', '/api/admin/safepilot/query', {
        pageKey: 'admin.dashboard',
        question: q,
      });
      return res.json();
    },
    onSuccess: (data: SafePilotQueryResponse) => {
      setResponse(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/safepilot/history'] });
    },
    onError: () => {
      setResponse({
        mode: 'ASK',
        summary: ['Unable to process your question. Please try again.'],
        keySignals: [],
        actions: [],
        monitor: [],
        error: 'Failed to process query',
      });
    },
  });

  const handleSubmit = () => {
    if (!question.trim()) return;
    queryMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (actionId: string) => {
    toast({
      title: 'Action Initiated',
      description: `${actionId} action has been queued for processing.`,
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-safepilot-title">SafePilot</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">AI-powered business automation</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1 self-start sm:self-auto">
            <Activity className="h-3 w-3" />
            Online
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  Ask SafePilot
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Ask about operations, metrics, or get recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                <div className="flex flex-col gap-2 sm:gap-3">
                  <Textarea
                    placeholder="e.g., What are the top 3 risks right now? How can we reduce refund abuse?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[60px] sm:min-h-[80px] text-sm sm:text-base resize-none"
                    data-testid="input-safepilot-question"
                  />
                  <Button 
                    onClick={handleSubmit}
                    disabled={queryMutation.isPending || !question.trim()}
                    className="w-full min-h-[44px] sm:min-h-9 touch-manipulation"
                    data-testid="button-safepilot-submit"
                  >
                    {queryMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Ask SafePilot
                      </>
                    )}
                  </Button>
                </div>

                {response && !response.error && (
                  <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
                    <Separator />
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`h-7 sm:h-8 px-2 sm:px-3 rounded-full ${getModeConfig(response.mode).color} flex items-center gap-1.5`}>
                        {(() => {
                          const ModeIcon = getModeConfig(response.mode).icon;
                          return <ModeIcon className="h-3.5 w-3.5 text-white" />;
                        })()}
                        <span className="text-[10px] sm:text-xs font-medium text-white">{getModeConfig(response.mode).label}</span>
                      </div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{getModeConfig(response.mode).description}</span>
                    </div>

                    <Collapsible open={summaryExpanded} onOpenChange={setSummaryExpanded}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
                          <span className="font-medium text-sm">Summary</span>
                          {summaryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        {response.summary.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm bg-muted/50 p-2 sm:p-3 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="break-words">{item}</span>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>

                    {response.keySignals.length > 0 && (
                      <Collapsible open={signalsExpanded} onOpenChange={setSignalsExpanded}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
                            <span className="font-medium text-sm">Key Signals</span>
                            {signalsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-2">
                          {response.keySignals.map((signal, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                              <Radio className="h-3 w-3 shrink-0 mt-1" />
                              <span className="break-words">{signal}</span>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {response.actions.length > 0 && (
                      <Collapsible open={actionsExpanded} onOpenChange={setActionsExpanded}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
                            <span className="font-medium text-sm">Recommended Actions</span>
                            {actionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-2">
                          {response.actions.map((action, idx) => (
                            <div key={idx} className="flex items-center gap-2 flex-wrap p-2 sm:p-3 border rounded-lg bg-card">
                              {getRiskBadge(action.risk)}
                              <span className="text-xs sm:text-sm flex-1 min-w-0 break-words">{action.label}</span>
                              <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2">
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {response.monitor.length > 0 && (
                      <Collapsible open={monitorExpanded} onOpenChange={setMonitorExpanded}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
                            <span className="font-medium text-sm">What to Monitor</span>
                            {monitorExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-2">
                          {response.monitor.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                              <Eye className="h-3 w-3 shrink-0 mt-1" />
                              <span className="break-words">{item}</span>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}

                {response?.error && (
                  <div className="mt-4 p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Error Processing Query</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {response.summary[0] || 'Please try again or rephrase your question.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
                  Intelligence Modules
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Access specialized AI engines for different operations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {intelligenceModules.map((module) => (
                    <Card 
                      key={module.id}
                      className="p-2.5 sm:p-3 cursor-pointer hover-elevate transition-all touch-manipulation"
                      onClick={() => {
                        setQuestion(module.query);
                        queryMutation.mutate(module.query);
                      }}
                      data-testid={`module-${module.id}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg ${module.color} flex items-center justify-center shrink-0`}>
                          <module.icon className="h-4 w-4 sm:h-4 sm:w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs sm:text-sm truncate">{module.name}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{module.description}</div>
                        </div>
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 h-auto py-2 sm:py-2.5 px-2 sm:px-3 text-xs sm:text-sm"
                      onClick={() => handleQuickAction(action.id)}
                      data-testid={`button-quick-${action.id}`}
                    >
                      <action.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${action.color}`} />
                      <span className="truncate">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <History className="h-4 w-4 sm:h-5 sm:w-5" />
                  Recent Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : historyData && historyData.length > 0 ? (
                  <ScrollArea className="h-[200px] sm:h-[250px]">
                    <div className="space-y-2">
                      {historyData.slice(0, 5).map((item) => (
                        <div key={item.id} className="p-2 sm:p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs sm:text-sm font-medium truncate">{item.question}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.responseSummary}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px]">
                              {item.riskLevel}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No recent queries
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  Platform Health
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">System Status</span>
                    <Badge className="bg-green-500 text-[10px] sm:text-xs">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Active Drivers</span>
                    <span className="text-xs sm:text-sm font-medium">Loading...</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Open Alerts</span>
                    <span className="text-xs sm:text-sm font-medium">Loading...</span>
                  </div>
                  <Separator />
                  <Link href="/admin/safepilot/analytics">
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm touch-manipulation">
                      View Analytics Dashboard
                      <BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
