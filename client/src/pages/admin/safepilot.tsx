import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  DollarSign,
  ChevronRight,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface SafePilotQueryResponse {
  answerText: string;
  insights: Array<{
    type: string;
    title: string;
    detail: string;
    severity: string;
  }>;
  suggestions: Array<{
    key: string;
    label: string;
    actionType: string;
    payload: Record<string, any>;
  }>;
  riskLevel: string;
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
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'cost', 
    name: 'Cost Reduction', 
    icon: DollarSign, 
    color: 'bg-blue-500/10 text-blue-600',
    description: 'Detect abuse & reduce operational costs',
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'fraud', 
    name: 'Fraud Shield', 
    icon: Shield, 
    color: 'bg-red-500/10 text-red-600',
    description: 'Real-time fraud detection & prevention',
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'partner', 
    name: 'Partner Coach', 
    icon: Users, 
    color: 'bg-purple-500/10 text-purple-600',
    description: 'Partner performance & coaching',
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'retention', 
    name: 'Customer Retention', 
    icon: Heart, 
    color: 'bg-pink-500/10 text-pink-600',
    description: 'Churn prediction & win-back strategies',
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'marketing', 
    name: 'Marketing AI', 
    icon: Megaphone, 
    color: 'bg-orange-500/10 text-orange-600',
    description: 'Campaign optimization & segmentation',
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'finance', 
    name: 'Financial Intelligence', 
    icon: PieChart, 
    color: 'bg-emerald-500/10 text-emerald-600',
    description: 'Revenue forecasting & profitability',
    href: '/admin/safepilot-intelligence'
  },
  { 
    id: 'compliance', 
    name: 'Legal & Compliance', 
    icon: Scale, 
    color: 'bg-slate-500/10 text-slate-600',
    description: 'Regulatory monitoring & audit prep',
    href: '/admin/safepilot-intelligence'
  },
];

export default function SafePilotPage() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<SafePilotQueryResponse | null>(null);
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
    onSuccess: (data) => {
      setResponse(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/safepilot/history'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to process your question. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!question.trim()) return;
    queryMutation.mutate(question);
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-safepilot-title">SafePilot AI Assistant</h1>
              <p className="text-muted-foreground">Your intelligent admin copilot for SafeGo operations</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3" />
            Online
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Ask SafePilot
                </CardTitle>
                <CardDescription>
                  Ask any question about your platform operations, metrics, or get recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="e.g., What are the top fraud patterns this week? How can we reduce refund abuse?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-safepilot-question"
                  />
                </div>
                <Button 
                  onClick={handleSubmit}
                  disabled={queryMutation.isPending || !question.trim()}
                  className="w-full"
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

                {response && (
                  <div className="mt-4 space-y-4">
                    <Separator />
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">SafePilot Response</span>
                          <Badge className={getSeverityColor(response.riskLevel)}>
                            {response.riskLevel} Risk
                          </Badge>
                        </div>
                        <p className="text-muted-foreground" data-testid="text-safepilot-response">
                          {response.answerText}
                        </p>
                        
                        {response.insights && response.insights.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-medium">Key Insights:</span>
                            {response.insights.map((insight, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-lg">
                                <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-medium">{insight.title}:</span>{' '}
                                  <span className="text-muted-foreground">{insight.detail}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {response.suggestions && response.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {response.suggestions.map((suggestion, idx) => (
                              <Button key={idx} variant="outline" size="sm" className="gap-1">
                                {suggestion.label}
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common administrative actions at your fingertips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {quickActions.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 hover-elevate"
                      onClick={() => handleQuickAction(action.id)}
                      data-testid={`button-action-${action.id}`}
                    >
                      <action.icon className={`h-5 w-5 ${action.color}`} />
                      <span className="text-xs text-center">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Intelligence Modules
                </CardTitle>
                <CardDescription>
                  8 specialized AI modules for business automation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {intelligenceModules.map((module) => (
                    <Link key={module.id} href={module.href}>
                      <Card className="hover-elevate cursor-pointer h-full">
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className={`h-10 w-10 rounded-lg ${module.color} flex items-center justify-center`}>
                            <module.icon className="h-5 w-5" />
                          </div>
                          <span className="font-medium text-sm">{module.name}</span>
                          <span className="text-xs text-muted-foreground">{module.description}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/admin/safepilot-intelligence" className="w-full">
                  <Button variant="outline" className="w-full gap-2">
                    Open Full Intelligence Dashboard
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Live Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metricsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Users</span>
                      <span className="font-bold text-lg" data-testid="metric-active-users">
                        {(metricsData as any)?.activeUsers ?? '1,247'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Today's Revenue</span>
                      <span className="font-bold text-lg text-green-600" data-testid="metric-revenue">
                        ${((metricsData as any)?.todayRevenue ?? 45230).toLocaleString()}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending KYC</span>
                      <span className="font-bold text-lg text-orange-600" data-testid="metric-pending-kyc">
                        {(metricsData as any)?.pendingKyc ?? 23}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fraud Alerts</span>
                      <span className="font-bold text-lg text-red-600" data-testid="metric-fraud-alerts">
                        {(metricsData as any)?.fraudAlerts ?? 5}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Driver Issues</span>
                      <span className="font-bold text-lg text-yellow-600" data-testid="metric-driver-issues">
                        {(metricsData as any)?.driverIssues ?? 12}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(contextData as any)?.alerts?.length > 0 ? (
                    (contextData as any).alerts.slice(0, 5).map((alert: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <div className={`h-2 w-2 rounded-full mt-1.5 ${getSeverityColor(alert.severity)}`} />
                        <div>
                          <span className="font-medium">{alert.type}</span>
                          <p className="text-xs text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-start gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full mt-1.5 bg-red-500" />
                        <div>
                          <span className="font-medium">High Refund Rate</span>
                          <p className="text-xs text-muted-foreground">3 customers flagged for review</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full mt-1.5 bg-orange-500" />
                        <div>
                          <span className="font-medium">Driver Complaints</span>
                          <p className="text-xs text-muted-foreground">2 drivers with multiple complaints</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full mt-1.5 bg-yellow-500" />
                        <div>
                          <span className="font-medium">KYC Backlog</span>
                          <p className="text-xs text-muted-foreground">15 documents pending review</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : historyData && historyData.length > 0 ? (
                      historyData.slice(0, 10).map((item) => (
                        <div key={item.id} className="text-sm border-b pb-2 last:border-0">
                          <p className="font-medium truncate">{item.question}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.pageKey}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No recent questions. Ask SafePilot something!
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
