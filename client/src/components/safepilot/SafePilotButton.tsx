import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  Sparkles, 
  X, 
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
  ArrowRight,
  Brain,
  Users,
  Heart,
  Megaphone,
  PieChart,
  Scale,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SafePilotSuggestion {
  key: string;
  label: string;
  actionType: 'NAVIGATE' | 'FILTER' | 'OPEN_PANEL' | 'RUN_REPORT' | 'BULK_ACTION' | 'SUGGEST_POLICY';
  payload: Record<string, any>;
  permission?: string;
}

interface SafePilotInsight {
  type: 'risk' | 'performance' | 'cost' | 'safety' | 'compliance' | 'fraud';
  title: string;
  detail: string;
  metrics?: Record<string, number | string>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SafePilotContextResponse {
  pageKey: string;
  summary: {
    title: string;
    description: string;
  };
  metrics: Record<string, number | string>;
  alerts: Array<{
    type: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  quickActions: SafePilotSuggestion[];
}

interface SafePilotQueryResponse {
  answerText: string;
  insights: SafePilotInsight[];
  suggestions: SafePilotSuggestion[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SafePilotHistoryItem {
  id: string;
  pageKey: string;
  question: string;
  responseSummary: string;
  riskLevel: string;
  timestamp: string;
  selectedActionKey?: string;
}

const getPageKeyFromPath = (pathname: string): string => {
  const path = pathname.replace(/^\/+/, '');
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return 'admin.dashboard';
  }
  
  if (segments[0] !== 'admin') {
    return 'admin.dashboard';
  }
  
  if (segments.length === 1) {
    return 'admin.dashboard';
  }
  
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const isNumericId = (s: string) => /^\d+$/.test(s);
  
  const knownRoutes: Record<string, string> = {
    'drivers': 'admin.drivers',
    'customers': 'admin.customers', 
    'restaurants': 'admin.restaurants',
    'rides': 'admin.rides',
    'food-orders': 'admin.food-orders',
    'payouts': 'admin.payouts',
    'safety': 'admin.safety',
    'ratings': 'admin.ratings',
    'reviews': 'admin.reviews',
    'refunds': 'admin.refunds',
    'disputes': 'admin.disputes',
    'kyc': 'admin.kyc',
    'people': 'admin.people',
    'wallets': 'admin.wallets',
    'parcels': 'admin.parcels',
    'deliveries': 'admin.deliveries',
    'fraud-detection': 'admin.fraud',
    'risk-center': 'admin.risk',
    'observability': 'admin.observability',
    'analytics': 'admin.analytics',
    'dashboard': 'admin.dashboard',
    'home': 'admin.dashboard',
    'settings': 'admin.settings',
    'users': 'admin.users',
    'complaints': 'admin.complaints',
    'media': 'admin.media',
    'notifications': 'admin.notifications',
  };
  
  const filteredSegments = segments.filter(s => !isUuid(s) && !isNumericId(s));
  
  if (filteredSegments.length > 1) {
    const primaryRoute = filteredSegments[1];
    if (knownRoutes[primaryRoute]) {
      return knownRoutes[primaryRoute];
    }
    return `admin.${primaryRoute}`;
  }
  
  return 'admin.dashboard';
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'HIGH':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'MEDIUM':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    default:
      return 'bg-green-500/10 text-green-500 border-green-500/20';
  }
};

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'risk':
      return <AlertTriangle className="h-4 w-4" />;
    case 'performance':
      return <TrendingUp className="h-4 w-4" />;
    case 'cost':
      return <DollarSign className="h-4 w-4" />;
    case 'safety':
      return <Shield className="h-4 w-4" />;
    case 'fraud':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Lightbulb className="h-4 w-4" />;
  }
};

export function SafePilotButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queryResponse, setQueryResponse] = useState<SafePilotQueryResponse | null>(null);
  const [activeTab, setActiveTab] = useState('intelligence');
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const pageKey = getPageKeyFromPath(location);

  const { data: statusData, isLoading: statusLoading } = useQuery<{
    enabled: boolean;
    permissions: {
      canUse: boolean;
    };
  }>({
    queryKey: ['/api/admin/safepilot/status'],
    enabled: location.startsWith('/admin'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: contextData, isLoading: contextLoading, refetch: refetchContext } = useQuery<SafePilotContextResponse>({
    queryKey: ['/api/admin/safepilot/context', pageKey],
    queryFn: async () => {
      const params = new URLSearchParams({ pageKey });
      const res = await fetch(`/api/admin/safepilot/context?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch context');
      return res.json();
    },
    enabled: isOpen,
    staleTime: 30 * 1000,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery<{ interactions: SafePilotHistoryItem[] }>({
    queryKey: ['/api/admin/safepilot/history'],
    enabled: isOpen && activeTab === 'history',
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (isOpen) {
      refetchContext();
      setQueryResponse(null);
      setActiveTab('context');
    }
  }, [pageKey, isOpen]);

  const handleSubmitQuestion = async () => {
    if (!question.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await apiRequest<SafePilotQueryResponse>('/api/admin/safepilot/query', {
        method: 'POST',
        body: JSON.stringify({
          pageKey,
          question: question.trim(),
        }),
      });

      setQueryResponse(response);
      setActiveTab('response');
      setQuestion('');
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/safepilot/history'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process your question. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = async (suggestion: SafePilotSuggestion) => {
    try {
      const response = await apiRequest<{ success: boolean; route?: string; filter?: string }>('/api/admin/safepilot/run-action', {
        method: 'POST',
        body: JSON.stringify({
          actionKey: suggestion.key,
          actionType: suggestion.actionType,
          payload: suggestion.payload,
        }),
      });

      if (response.success) {
        switch (suggestion.actionType) {
          case 'NAVIGATE':
            if (response.route) {
              setIsOpen(false);
              setLocation(response.route);
            }
            break;
          case 'FILTER':
            toast({
              title: 'Filter Applied',
              description: `Applied filter: ${response.filter}`,
            });
            break;
          case 'OPEN_PANEL':
            toast({
              title: 'Panel Opened',
              description: suggestion.label,
            });
            break;
          case 'RUN_REPORT':
            toast({
              title: 'Report Initiated',
              description: 'Report generation started. Check reports panel for status.',
            });
            break;
          default:
            toast({
              title: 'Action Executed',
              description: suggestion.label,
            });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to execute action.',
        variant: 'destructive',
      });
    }
  };

  if (!location.startsWith('/admin')) {
    return null;
  }

  const alertCount = contextData?.alerts?.length || 0;

  return (
    <>
      <Button
        data-testid="button-safepilot-launcher"
        size="icon"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-14 w-14 sm:h-14 sm:w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 touch-manipulation"
        onClick={() => setIsOpen(true)}
      >
        <Sparkles className="h-6 w-6" />
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-medium">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          className="w-full sm:max-w-lg p-0 flex flex-col h-[100dvh] sm:h-full" 
          data-testid="panel-safepilot"
          side="right"
        >
          <SheetHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-base sm:text-lg">SafePilot</SheetTitle>
                  <SheetDescription className="text-xs truncate">
                    AI-powered admin assistant
                  </SheetDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 shrink-0"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-4 mx-4 sm:mx-6 mt-3 sm:mt-4 shrink-0">
              <TabsTrigger value="intelligence" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-intelligence">
                <Brain className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                <span className="truncate">Intel</span>
              </TabsTrigger>
              <TabsTrigger value="context" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-context">
                <BarChart3 className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                <span className="truncate">Context</span>
              </TabsTrigger>
              <TabsTrigger value="response" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-response">
                <MessageSquare className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                <span className="truncate">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-history">
                <History className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                <span className="truncate">History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="intelligence" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Intelligence Modules</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence');
                      }}
                      data-testid="button-open-dashboard"
                    >
                      Full Dashboard
                      <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=growth');
                      }}
                      data-testid="card-module-growth"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Growth Engine</div>
                          <div className="text-xs text-muted-foreground">Demand-supply AI, expansion zones</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=operations');
                      }}
                      data-testid="card-module-cost"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Cost Reduction</div>
                          <div className="text-xs text-muted-foreground">Expense killer, savings finder</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=security');
                      }}
                      data-testid="card-module-fraud"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Fraud Shield</div>
                          <div className="text-xs text-muted-foreground">Ghost trips, coupon abuse detection</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=operations');
                      }}
                      data-testid="card-module-partner"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Partner Success</div>
                          <div className="text-xs text-muted-foreground">Performance coaching, training plans</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=marketing');
                      }}
                      data-testid="card-module-retention"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-pink-500/10 flex items-center justify-center">
                          <Heart className="h-4 w-4 text-pink-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Customer Retention</div>
                          <div className="text-xs text-muted-foreground">Win-back AI, churn prediction</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=marketing');
                      }}
                      data-testid="card-module-marketing"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Megaphone className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Marketing AI</div>
                          <div className="text-xs text-muted-foreground">Zero-budget marketing, captions</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=overview');
                      }}
                      data-testid="card-module-financial"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                          <PieChart className="h-4 w-4 text-cyan-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Financial Intel</div>
                          <div className="text-xs text-muted-foreground">Revenue forecasting, payout risks</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>

                    <Card 
                      className="p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/admin/safepilot-intelligence?tab=security');
                      }}
                      data-testid="card-module-compliance"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-500/10 flex items-center justify-center">
                          <Scale className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Compliance Guard</div>
                          <div className="text-xs text-muted-foreground">BD NID, US privacy compliance</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>
                  </div>

                  <div className="pt-2">
                    <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Business Automation Engine</div>
                          <div className="text-xs text-muted-foreground">
                            8 AI modules analyzing your business 24/7
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="context" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                {contextLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contextData ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg">{contextData.summary.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{contextData.summary.description}</p>
                    </div>

                    {Object.keys(contextData.metrics).length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">Key Metrics</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(contextData.metrics).map(([key, value]) => (
                            <Card key={key} className="p-3">
                              <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                              <div className="text-lg font-semibold mt-1">{String(value)}</div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {contextData.alerts.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">Active Alerts</h4>
                        <div className="space-y-2">
                          {contextData.alerts.map((alert, idx) => (
                            <Card key={idx} className={`p-3 border ${getSeverityColor(alert.severity)}`}>
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-sm font-medium">{alert.message}</div>
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {alert.severity}
                                  </Badge>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {contextData.quickActions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">Quick Actions</h4>
                        <div className="space-y-2">
                          {contextData.quickActions.map((action) => (
                            <Button
                              key={action.key}
                              variant="outline"
                              className="w-full justify-between"
                              onClick={() => handleActionClick(action)}
                              data-testid={`button-action-${action.key}`}
                            >
                              <span>{action.label}</span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Unable to load page context.</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="response" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                {queryResponse ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Answer</CardTitle>
                          <Badge className={getSeverityColor(queryResponse.riskLevel)}>
                            {queryResponse.riskLevel} Risk
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{queryResponse.answerText}</p>
                      </CardContent>
                    </Card>

                    {queryResponse.insights.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">Insights</h4>
                        <div className="space-y-2">
                          {queryResponse.insights.map((insight, idx) => (
                            <Card key={idx} className={`p-3 border ${getSeverityColor(insight.severity)}`}>
                              <div className="flex items-start gap-2">
                                {getInsightIcon(insight.type)}
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{insight.title}</div>
                                  <div className="text-xs text-muted-foreground mt-1">{insight.detail}</div>
                                  {insight.metrics && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {Object.entries(insight.metrics).map(([key, value]) => (
                                        <Badge key={key} variant="secondary" className="text-xs">
                                          {key}: {String(value)}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {queryResponse.suggestions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">Suggested Actions</h4>
                        <div className="space-y-2">
                          {queryResponse.suggestions.map((suggestion) => (
                            <Button
                              key={suggestion.key}
                              variant="outline"
                              className="w-full justify-between"
                              onClick={() => handleActionClick(suggestion)}
                              data-testid={`button-suggestion-${suggestion.key}`}
                            >
                              <span>{suggestion.label}</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
                    <p>Ask a question to see SafePilot's response.</p>
                    <p className="text-xs mt-2">
                      Try asking about high-risk drivers, pending KYC, or fraud alerts.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                {historyData?.interactions?.length ? (
                  <div className="space-y-3">
                    {historyData.interactions.map((item) => (
                      <Card key={item.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.question}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.responseSummary}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {item.pageKey}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Badge className={getSeverityColor(item.riskLevel)}>
                            {item.riskLevel}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <History className="h-12 w-12 mb-4 opacity-30" />
                    <p>No interaction history yet.</p>
                    <p className="text-xs mt-2">
                      Your questions and SafePilot responses will appear here.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Separator className="shrink-0" />
          <div className="p-3 sm:p-4 shrink-0 bg-background safe-area-bottom">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuestion();
              }}
              className="flex gap-2"
            >
              <Input
                data-testid="input-safepilot-question"
                placeholder="Ask about drivers, fraud, KYC..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 min-h-[44px] text-base sm:text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!question.trim() || isSubmitting}
                data-testid="button-safepilot-submit"
                className="min-h-[44px] min-w-[44px]"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default SafePilotButton;
