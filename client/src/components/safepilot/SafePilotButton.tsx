import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
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
  Users,
  Heart,
  Megaphone,
  PieChart,
  Scale,
  ExternalLink,
  Zap,
  Mic,
  MicOff,
  FileText,
  Activity,
  LifeBuoy,
  Bug,
  RefreshCw,
  Target,
  Rocket,
  Clock,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Info,
  Eye,
  Radio,
  Layers,
  FileDown,
  ShieldAlert,
  Fingerprint,
  TrendingDown,
  Brain,
  BellOff,
  Database,
  Volume2,
} from 'lucide-react';
import { SafePilotIcon } from './SafePilotLogo';
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
import { apiRequest, queryClient, fetchWithAuth } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { normalizeSafePilotReply } from './chatApi';

// Singleton guard to prevent duplicate mounts
let __SAFEPILOT_BUTTON_MOUNTED__ = false;

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

interface SafePilotAction {
  label: string;
  risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK';
  actionType?: string;
  payload?: Record<string, unknown>;
}

interface SafePilotQueryResponse {
  mode?: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE';
  summary?: string[];
  keySignals?: string[];
  actions?: SafePilotAction[];
  monitor?: string[];
  answerText?: string;
  insights?: SafePilotInsight[];
  suggestions?: SafePilotSuggestion[];
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  error?: string;
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

interface CrisisReportData {
  timestamp: string;
  mode: 'CRISIS_REPORT';
  summary: string;
  topRisks: Array<{ title: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; detail: string; impact: string; action: string }>;
  topOpportunities: Array<{ title: string; potential: string; timeframe: string; action: string }>;
  urgentFixes: Array<{ issue: string; priority: 'P0' | 'P1' | 'P2'; estimatedImpact: string; suggestedAction: string }>;
  financialImpact: { totalAtRisk: number; potentialSavings: number; revenueOpportunity: number };
  operationalImpact: { affectedUsers: number; affectedDrivers: number; affectedOrders: number };
  recommendedNextSteps: string[];
}

interface SurvivalModeData {
  timestamp: string;
  automationOpportunities: Array<{
    area: string;
    currentCost: string;
    savingsEstimate: string;
    automationLevel: 'FULL' | 'PARTIAL' | 'ASSISTED';
    implementation: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  costCuttingOptions: Array<{
    category: string;
    currentSpend: string;
    potentialSavings: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation: string;
  }>;
  growthOpportunities: Array<{
    opportunity: string;
    potentialRevenue: string;
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    timeToValue: string;
  }>;
  weeklyFocusAreas: string[];
  humanRequired: string[];
  canAutomate: string[];
}

interface AutonomousScanData {
  timestamp: string;
  scanDuration: number;
  findings: Array<{
    category: 'FRAUD' | 'DRIVER_ANOMALY' | 'ACCOUNT_SPIKE' | 'REFUND_SPIKE' | 'PAYMENT_ISSUE' | 'SAFETY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    detail: string;
    affectedCount: number;
    recommendedAction: string;
    autoActionAvailable: boolean;
  }>;
  healthScore: number;
  nextScanRecommended: string;
}

interface UltraAnomalyRadarData {
  mode: 'GUARD';
  summary: string[];
  keySignals: string[];
  actions: Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' }>;
  monitor: string[];
  anomalies: Array<{
    type: 'LOGIN_SPIKE' | 'PAYOUT_ANOMALY' | 'SUSPICIOUS_ORDER' | 'RATING_MANIPULATION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    affectedEntities: number;
    detectedAt: string;
  }>;
  radarScore: number;
  lastScanAt: string;
  nextScanIn: number;
}

interface UltraLostRevenueData {
  mode: 'OPTIMIZE';
  summary: string[];
  keySignals: string[];
  actions: Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' }>;
  monitor: string[];
  lostRevenue: {
    total: number;
    currency: string;
    breakdown: {
      uncompletedRides?: { count: number; amount: number };
      abandonedOrders?: { count: number; amount: number };
      payoutGaps?: { count: number; amount: number };
      delayRefunds?: { count: number; amount: number };
    };
  };
  recoveryOpportunities: Array<{
    category: string;
    potentialRecovery: number;
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation: string;
  }>;
}

interface UltraCorrelationData {
  mode: 'WATCH';
  summary: string[];
  keySignals: string[];
  actions: Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK' }>;
  monitor: string[];
  correlations: Array<{
    module1: string;
    module2: string;
    correlationType: 'STRONG' | 'MODERATE' | 'WEAK';
    riskImpact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    description: string;
    linkedEntities: number;
  }>;
  combinedRiskScore: number;
  riskBreakdown: Record<string, number>;
  linkedCauses: string[];
  confidence: number;
}

interface UltraVoicePilotData {
  mode: 'ASK';
  voicePilot: {
    enabled: boolean;
    transcribedCommand: string;
    recognizedIntent: string | null;
    mappedFunction: string | null;
    executionStatus: 'SUCCESS' | 'PENDING' | 'NOT_SUPPORTED';
    availableCommands: string[];
  };
  response: SafePilotQueryResponse | null;
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
    'payment-integrity': 'admin.payment-integrity',
    'earnings-disputes': 'admin.earnings-disputes',
    'driver-violations': 'admin.driver-violations',
    'trust-safety': 'admin.trust-safety',
    'policy-engine': 'admin.policy-engine',
    'export-center': 'admin.export-center',
    'activity-monitor': 'admin.activity-monitor',
    'ride-timeline': 'admin.ride-timeline',
    'notification-rules': 'admin.notification-rules',
    'global-search': 'admin.global-search',
    'operations-console': 'admin.operations-console',
    'backup-recovery': 'admin.backup-recovery',
    'safepilot-intelligence': 'admin.safepilot',
    'commissions': 'admin.commissions',
    'incentives': 'admin.incentives',
    'promotions': 'admin.promotions',
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
  category: 'support' | 'fraud' | 'operations' | 'finance' | 'health';
}

type SafePilotMode = 'intel' | 'context' | 'chat';
type SafePilotTier = 'ultra' | 'crisis' | 'survival' | 'history';

const BASE_SYSTEM_INSTRUCTION = `You are Admin SafePilot for SafeGo. You answer ONLY admin/operator questions: metrics, KPIs, platform ops, KYC queues, fraud/risk signals, payouts, disputes, system health, and recommended actions. You must not handle end-user support conversations. If asked to do customer-support agent tasks, respond: 'Use Support SafePilot on /admin/support-console.' Be concise, action-oriented, and provide clear next steps. When you list items, include IDs and timestamps if available.`;

const TIER_PREFIXES: Record<SafePilotTier, string> = {
  ultra: 'Priority: ULTRA. Be decisive. Provide immediate actions and the shortest path to fix.',
  crisis: 'Priority: CRISIS. Focus on incident response: impact, scope, mitigation, owner actions, and follow-up.',
  survival: 'Priority: SURVIVAL. Focus on stabilizing core operations, reducing risk, and preventing recurrence.',
  history: 'Priority: HISTORY. Provide trends, comparisons, and insights over time.',
};

const MODE_INSTRUCTIONS: Record<SafePilotMode, string> = {
  intel: 'Mode: INTEL. Summarize signals, risks, and what to watch. Use bullet points.',
  context: 'Mode: CONTEXT. Explain what is happening, why, and dependencies. Include assumptions.',
  chat: 'Mode: CHAT. Answer as a helpful operator assistant and ask one short follow-up only if needed.',
};

function buildPrompt(mode: SafePilotMode, tier: SafePilotTier, userText: string): string {
  return `${BASE_SYSTEM_INSTRUCTION}\n\n${TIER_PREFIXES[tier]}\n\n${MODE_INSTRUCTIONS[mode]}\n\nUser Query: ${userText}`;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'support-issues',
    title: 'Support Issues',
    description: 'Today\'s unresolved tickets by status',
    prompt: 'Show today\'s unresolved customer support tickets: counts by status, oldest 10, and suggested next actions.',
    icon: <LifeBuoy className="h-4 w-4" />,
    category: 'support',
  },
  {
    id: 'kyc-queue',
    title: 'KYC Queue',
    description: 'Pending approvals by age bucket',
    prompt: 'Show KYC pending approvals by age bucket (0-2h, 2-24h, 1-3d, 3d+) and top risk reasons.',
    icon: <Fingerprint className="h-4 w-4" />,
    category: 'support',
  },
  {
    id: 'fraud-signals',
    title: 'Fraud Signals',
    description: 'Last 24h suspicious activity',
    prompt: 'Summarize fraud signals in the last 24h: suspicious devices, repeat payment failures, abnormal refunds.',
    icon: <ShieldAlert className="h-4 w-4" />,
    category: 'fraud',
  },
  {
    id: 'high-risk-users',
    title: 'High-Risk Users',
    description: 'Top 20 with reason codes',
    prompt: 'List top 20 high-risk users with reason codes, last activity, and recommended actions.',
    icon: <Shield className="h-4 w-4" />,
    category: 'fraud',
  },
  {
    id: 'driver-violations',
    title: 'Driver Violations',
    description: 'Last 7 days violations summary',
    prompt: 'Show driver violations in last 7 days: types, counts, repeat offenders, suggested enforcement.',
    icon: <AlertTriangle className="h-4 w-4" />,
    category: 'operations',
  },
  {
    id: 'system-health',
    title: 'System Health',
    description: 'Error rates, slow endpoints, warnings',
    prompt: 'Give system health summary: error rate, slow endpoints, memory/CPU warnings, and top fixes.',
    icon: <Activity className="h-4 w-4" />,
    category: 'operations',
  },
  {
    id: 'payout-anomalies',
    title: 'Payout Anomalies',
    description: 'Spikes, duplicates, unusual amounts',
    prompt: 'Detect payout anomalies: spikes, duplicates, unusual amounts; list top 20 with reasons.',
    icon: <DollarSign className="h-4 w-4" />,
    category: 'finance',
  },
  {
    id: 'earnings-disputes',
    title: 'Earnings Disputes',
    description: 'Open vs resolved, resolution time',
    prompt: 'Summarize earnings disputes: open vs resolved, average resolution time, top dispute causes.',
    icon: <Scale className="h-4 w-4" />,
    category: 'finance',
  },
  {
    id: 'platform-kpis',
    title: 'Platform KPIs',
    description: 'Last 24h core metrics and trends',
    prompt: 'Show core KPIs for last 24h: rides, cancellations, refunds, disputes, KYC throughput, and trend vs prior day.',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'health',
  },
  {
    id: 'recommended-actions',
    title: 'Recommended Actions',
    description: 'Top 5 actions based on KPIs',
    prompt: 'Based on KPIs and incidents, recommend the top 5 actions to improve reliability and reduce fraud.',
    icon: <Target className="h-4 w-4" />,
    category: 'health',
  },
];

const getCategoryColor = (category: QuickAction['category']) => {
  switch (category) {
    case 'support': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'fraud': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'operations': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'finance': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'health': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
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
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    lastUrl: string;
    lastStatus: number | null;
    lastError: string | null;
    role: string;
  }>({ lastUrl: '', lastStatus: null, lastError: null, role: 'ADMIN' });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [currentMode, setCurrentMode] = useState<SafePilotMode>('intel');
  const [currentTier, setCurrentTier] = useState<SafePilotTier>('ultra');
  
  const [crisisReport, setCrisisReport] = useState<CrisisReportData | null>(null);
  const [isCrisisLoading, setIsCrisisLoading] = useState(false);
  const [survivalData, setSurvivalData] = useState<SurvivalModeData | null>(null);
  const [isSurvivalLoading, setIsSurvivalLoading] = useState(false);
  const [scanData, setScanData] = useState<AutonomousScanData | null>(null);
  const [isScanLoading, setIsScanLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [ultraAnomalyData, setUltraAnomalyData] = useState<UltraAnomalyRadarData | null>(null);
  const [isAnomalyLoading, setIsAnomalyLoading] = useState(false);
  const [ultraLostRevenueData, setUltraLostRevenueData] = useState<UltraLostRevenueData | null>(null);
  const [isLostRevenueLoading, setIsLostRevenueLoading] = useState(false);
  const [ultraCorrelationData, setUltraCorrelationData] = useState<UltraCorrelationData | null>(null);
  const [isCorrelationLoading, setIsCorrelationLoading] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState('');

  // Singleton guard effect
  useEffect(() => {
    if (__SAFEPILOT_BUTTON_MOUNTED__) {
      console.warn('[SafePilotButton] Duplicate mount prevented');
      return;
    }
    __SAFEPILOT_BUTTON_MOUNTED__ = true;
    console.log('[SafePilotButton] Mounted');
    
    return () => {
      __SAFEPILOT_BUTTON_MOUNTED__ = false;
      console.log('[SafePilotButton] Unmounted');
    };
  }, []);

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

  const { data: contextData, isLoading: contextLoading, error: contextError, refetch: refetchContext } = useQuery<SafePilotContextResponse>({
    queryKey: ['/api/admin/safepilot/context', pageKey],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ pageKey });
        const res = await fetchWithAuth(`/api/admin/safepilot/context?${params}`);
        
        if (!res.ok) {
          console.error('[SafePilot] Context fetch failed:', res.status);
          return {
            pageKey,
            summary: { 
              title: pageKey.replace('admin.', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
              description: 'Page-specific insights and actions' 
            },
            metrics: {},
            alerts: [],
            quickActions: [],
          };
        }
        return res.json();
      } catch (err) {
        console.error('[SafePilot] Context fetch error:', err);
        return {
          pageKey,
          summary: { 
            title: pageKey.replace('admin.', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
            description: 'Page-specific insights and actions' 
          },
          metrics: {},
          alerts: [],
          quickActions: [],
        };
      }
    },
    enabled: isOpen && location.startsWith('/admin'),
    staleTime: 30 * 1000,
    retry: 2,
    retryDelay: 500,
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

  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [chatMessages, isSubmitting]);

  const handleQuickAction = async (action: QuickAction) => {
    setQuestion(action.prompt);
    setActiveTab('response');
    
    if (autoSendEnabled) {
      const userMessageId = `user-${Date.now()}`;
      setChatMessages(prev => [...prev, {
        id: userMessageId,
        role: 'user',
        content: action.prompt,
        timestamp: new Date(),
      }]);
      setQuestion('');
      
      setIsSubmitting(true);
      const url = '/api/admin/safepilot/query';
      setDebugInfo(prev => ({ ...prev, lastUrl: url, lastStatus: null, lastError: null }));
      
      const fullPrompt = buildPrompt(currentMode, currentTier, action.prompt);
      console.log('[SafePilot] Quick Action with mode:', currentMode, 'tier:', currentTier);
      
      try {
        const res = await fetchWithAuth(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageKey,
            question: fullPrompt,
            role: 'ADMIN',
          }),
        });
        
        setDebugInfo(prev => ({ ...prev, lastStatus: res.status }));
        
        let data;
        try {
          data = await res.json();
        } catch (parseError) {
          data = null;
        }
        
        const normalizedReply = normalizeSafePilotReply(data);
        const isEmptyResponse = !normalizedReply || normalizedReply.trim().length === 0;
        const displayContent = isEmptyResponse 
          ? "SafePilot returned no response. Please try again."
          : normalizedReply;
        
        setChatMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: displayContent,
          timestamp: new Date(),
          isError: !res.ok || isEmptyResponse,
        }]);
        
        if (data) {
          setQueryResponse({
            mode: data.mode || 'ASK',
            summary: data.summary?.length > 0 ? data.summary : [],
            keySignals: data.keySignals || [],
            actions: data.actions || [],
            monitor: data.monitor || [],
            answerText: displayContent,
            insights: data.insights || [],
            suggestions: data.suggestions || [],
            riskLevel: data.riskLevel || 'LOW',
            error: !res.ok || isEmptyResponse ? (data.error || `HTTP ${res.status}`) : undefined,
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/admin/safepilot/history'] });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setDebugInfo(prev => ({ ...prev, lastError: errorMsg }));
        
        setChatMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${errorMsg}. Please try again.`,
          timestamp: new Date(),
          isError: true,
        }]);
        
        toast({
          title: 'Connection Issue',
          description: 'Please check your network and try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmitQuestion = async (retryCount = 0) => {
    if (!question.trim() || isSubmitting) return;

    // Input validation
    if (question.trim().length < 2) {
      toast({
        title: 'Question too short',
        description: 'Please enter a more detailed question.',
      });
      return;
    }

    const userQuestion = question.trim();
    
    // STEP 1: Optimistic rendering - add user message immediately
    const userMessageId = `user-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: userMessageId,
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    }]);
    
    // STEP 2: Clear input immediately
    setQuestion('');
    setActiveTab('response');

    setIsSubmitting(true);
    const url = '/api/admin/safepilot/query';
    setDebugInfo(prev => ({ ...prev, lastUrl: url, lastStatus: null, lastError: null }));
    
    const fullPrompt = buildPrompt(currentMode, currentTier, userQuestion);
    console.log('[SafePilot Admin] Submitting question:', { question: userQuestion.slice(0, 50), mode: currentMode, tier: currentTier, role: 'ADMIN', pageKey });
    
    try {
      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey,
          question: fullPrompt,
          role: 'ADMIN',
        }),
      });
      
      setDebugInfo(prev => ({ ...prev, lastStatus: res.status }));
      
      // Parse response
      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error('[SafePilot Admin] JSON parse error:', parseError);
        data = null;
      }
      
      // STEP 3: Use universal normalizer to extract reply text
      const normalizedReply = normalizeSafePilotReply(data);
      console.log('[SafePilot Admin] Normalized reply:', normalizedReply?.slice(0, 100));
      
      // Check if we got an actual reply
      const isEmptyResponse = !normalizedReply || normalizedReply.trim().length === 0;
      const displayContent = isEmptyResponse 
        ? "SafePilot returned no response (admin mode). Please check logs or try a different question."
        : normalizedReply;
      
      // Add assistant message
      setChatMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: displayContent,
        timestamp: new Date(),
        isError: !res.ok || isEmptyResponse,
      }]);
      
      // Also store structured response for the detail view
      if (data) {
        const response: SafePilotQueryResponse = {
          mode: data.mode || 'ASK',
          summary: data.summary?.length > 0 ? data.summary : [],
          keySignals: data.keySignals || [],
          actions: data.actions || [],
          monitor: data.monitor || [],
          answerText: displayContent,
          insights: data.insights || [],
          suggestions: data.suggestions || [],
          riskLevel: data.riskLevel || 'LOW',
          error: !res.ok || isEmptyResponse ? (data.error || `HTTP ${res.status}`) : undefined,
        };
        setQueryResponse(response);
      }

      console.log('[SafePilot Admin] Query complete:', { status: res.status, replyLength: displayContent.length, isEmptyResponse });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/safepilot/history'] });
    } catch (error) {
      console.error('[SafePilot Admin] Request error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDebugInfo(prev => ({ ...prev, lastError: errorMsg }));
      
      // Retry on network errors
      if (retryCount < 2) {
        console.log('[SafePilot Admin] Retrying...', retryCount + 1);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        setIsSubmitting(false);
        return handleSubmitQuestion(retryCount + 1);
      }
      
      // Add error message to chat
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMsg}. Please check your network and try again.`,
        timestamp: new Date(),
        isError: true,
      }]);
      
      toast({
        title: 'Connection Issue',
        description: 'Please check your network and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = async (suggestion: SafePilotSuggestion) => {
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/run-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionKey: suggestion.key,
          actionType: suggestion.actionType,
          payload: suggestion.payload,
        }),
      });
      const response = await res.json() as { success: boolean; route?: string; filter?: string };

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

  const handleCrisisReport = async () => {
    setIsCrisisLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/crisis-report');
      if (res.ok) {
        const data = await res.json() as CrisisReportData;
        setCrisisReport(data);
        setActiveTab('crisis');
      } else {
        throw new Error('Failed to generate crisis report');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate crisis report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCrisisLoading(false);
    }
  };

  const handleSurvivalMode = async () => {
    setIsSurvivalLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/survival-mode');
      if (res.ok) {
        const data = await res.json() as SurvivalModeData;
        setSurvivalData(data);
        setActiveTab('survival');
      } else {
        throw new Error('Failed to generate survival mode report');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate survival mode report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSurvivalLoading(false);
    }
  };

  const handleAutonomousScan = async () => {
    setIsScanLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/autonomous-scan');
      if (res.ok) {
        const data = await res.json() as AutonomousScanData;
        setScanData(data);
        toast({
          title: 'Scan Complete',
          description: `Health Score: ${data.healthScore}%. ${data.findings.length} findings.`,
        });
      } else {
        throw new Error('Scan failed');
      }
    } catch (error) {
      toast({
        title: 'Scan Error',
        description: 'Failed to run autonomous scan.',
        variant: 'destructive',
      });
    } finally {
      setIsScanLoading(false);
    }
  };

  const handleVoiceCommand = () => {
    if (isListening) {
      setIsListening(false);
      toast({
        title: 'Voice Mode',
        description: 'Voice commands will be available in a future update.',
      });
    } else {
      setIsListening(true);
      toast({
        title: 'Voice Mode',
        description: 'Voice recognition is coming soon! Type your question for now.',
      });
      setTimeout(() => setIsListening(false), 2000);
    }
  };

  const handleAnomalyRadar = async () => {
    setIsAnomalyLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/ultra/anomaly-radar');
      if (res.ok) {
        const data = await res.json() as UltraAnomalyRadarData;
        setUltraAnomalyData(data);
        toast({
          title: 'Anomaly Radar',
          description: `Score: ${data.radarScore}. ${data.anomalies.length} anomalies detected.`,
        });
      } else {
        throw new Error('Radar scan failed');
      }
    } catch (error) {
      toast({
        title: 'Radar Error',
        description: 'Failed to run anomaly radar scan.',
        variant: 'destructive',
      });
    } finally {
      setIsAnomalyLoading(false);
    }
  };

  const handleLostRevenue = async () => {
    setIsLostRevenueLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/ultra/lost-revenue');
      if (res.ok) {
        const data = await res.json() as UltraLostRevenueData;
        setUltraLostRevenueData(data);
        toast({
          title: 'Lost Revenue Analysis',
          description: `$${data.lostRevenue.total.toLocaleString()} in lost revenue detected.`,
        });
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze lost revenue.',
        variant: 'destructive',
      });
    } finally {
      setIsLostRevenueLoading(false);
    }
  };

  const handleCorrelation = async () => {
    setIsCorrelationLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/ultra/correlation');
      if (res.ok) {
        const data = await res.json() as UltraCorrelationData;
        setUltraCorrelationData(data);
        toast({
          title: 'Cross-Module Correlation',
          description: `Risk Score: ${data.combinedRiskScore}. ${data.correlations.length} correlations found.`,
        });
      } else {
        throw new Error('Correlation failed');
      }
    } catch (error) {
      toast({
        title: 'Correlation Error',
        description: 'Failed to run cross-module correlation.',
        variant: 'destructive',
      });
    } finally {
      setIsCorrelationLoading(false);
    }
  };

  const handleVoicePilotCommand = async (command: string) => {
    if (!command.trim()) return;
    
    try {
      const res = await fetchWithAuth('/api/admin/safepilot/ultra/voicepilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command.trim(),
          pageKey,
        }),
      });
      
      if (res.ok) {
        const data = await res.json() as UltraVoicePilotData;
        if (data.voicePilot.executionStatus === 'SUCCESS' && data.response) {
          setQueryResponse(data.response);
          setActiveTab('response');
        }
        toast({
          title: 'VoicePilot',
          description: data.voicePilot.recognizedIntent 
            ? `Executing: ${data.voicePilot.recognizedIntent}`
            : 'Command not recognized. Try: "show anomalies", "check risks", "show lost revenue"',
        });
      }
    } catch (error) {
      toast({
        title: 'VoicePilot Error',
        description: 'Failed to process command.',
        variant: 'destructive',
      });
    }
    setVoiceCommand('');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'bg-red-500 text-white';
      case 'P1': return 'bg-orange-500 text-white';
      case 'P2': return 'bg-yellow-500 text-black';
      case 'HIGH': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'LOW': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getAutomationColor = (level: string) => {
    switch (level) {
      case 'FULL': return 'bg-green-500 text-white';
      case 'PARTIAL': return 'bg-blue-500 text-white';
      case 'ASSISTED': return 'bg-purple-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Only show on admin pages
  if (!location.startsWith('/admin')) {
    return null;
  }
  
  // Don't show on support-console (which has embedded SupportSafePilotPanel)
  if (location === '/admin/support-console') {
    return null;
  }

  const alertCount = contextData?.alerts?.length || 0;

  return (
    <>
      {!isOpen && createPortal(
        <div
          className="group"
          style={{ 
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
          {/* Tooltip label on hover */}
          <div className="absolute right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            <span className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
              Open SafePilot
              <span className="text-xs text-gray-400">AI</span>
            </span>
          </div>
          <button
            data-testid="button-safepilot-launcher"
            type="button"
            aria-label="Open SafePilot AI assistant"
            onClick={() => setIsOpen(true)}
            className="rounded-full shadow-lg shadow-primary/25 bg-gradient-to-br from-[#0a1929] to-[#0d2137] hover:from-[#0d2137] hover:to-[#112a45] touch-manipulation transition-all duration-200 active:scale-95 border border-[#1e4976]/50 ring-2 ring-[#2F80ED]/20 hover:ring-[#2F80ED]/40 hover:shadow-xl hover:shadow-[#2F80ED]/30 flex items-center justify-center cursor-pointer"
            style={{ 
              width: '56px',
              height: '56px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <SafePilotIcon size="md" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-medium ring-2 ring-white">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        </div>,
        document.body
      )}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          className="w-full sm:max-w-lg p-0 flex flex-col h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh] z-[10000]" 
          data-testid="panel-safepilot"
          side="right"
        >
          <SheetHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
            <div className="flex items-center justify-between min-w-0 pl-4">
              <div className="flex items-center min-w-0">
                <div className="shrink-0" style={{ width: 48, height: 48 }}>
                  <SafePilotIcon size="lg" />
                </div>
                <div className="min-w-0 ml-3">
                  <SheetTitle className="text-base sm:text-lg bg-gradient-to-r from-[#2F80ED] to-[#56CCF2] bg-clip-text text-transparent font-semibold">SafePilot</SheetTitle>
                  <SheetDescription className="text-xs truncate">
                    AI Intelligence Engine
                  </SheetDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDebug(!showDebug)}
                className={`h-8 w-8 ${showDebug ? 'bg-yellow-500/20' : ''}`}
                title="Toggle debug info"
              >
                <Bug className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {showDebug && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 border-b text-xs font-mono shrink-0">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-yellow-800 dark:text-yellow-200">Admin Debug</span>
                <Badge variant="outline" className="text-xs">Role: {debugInfo.role}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-1 text-yellow-700 dark:text-yellow-300">
                <span>URL:</span><span className="truncate">{debugInfo.lastUrl || '-'}</span>
                <span>Status:</span>
                <span className={debugInfo.lastStatus && debugInfo.lastStatus >= 400 ? 'text-red-600' : ''}>
                  {debugInfo.lastStatus ?? '-'}
                </span>
                {debugInfo.lastError && (
                  <>
                    <span>Error:</span><span className="text-red-600 truncate">{debugInfo.lastError}</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-yellow-600 dark:text-yellow-400">
                Page: {pageKey}
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            if (value === 'intelligence') setCurrentMode('intel');
            else if (value === 'context') setCurrentMode('context');
            else if (value === 'response') setCurrentMode('chat');
            else if (value === 'ultra') setCurrentTier('ultra');
            else if (value === 'crisis') setCurrentTier('crisis');
            else if (value === 'survival') setCurrentTier('survival');
            else if (value === 'history') setCurrentTier('history');
          }} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 sm:px-6 mt-3 sm:mt-4 shrink-0">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="intelligence" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-intelligence">
                  <SafePilotIcon size="sm" className="mr-0.5 sm:mr-1.5 shrink-0" />
                  <span className="truncate">Intel</span>
                </TabsTrigger>
                <TabsTrigger value="context" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-context">
                  <SafePilotIcon size="sm" className="mr-0.5 sm:mr-1.5 shrink-0" />
                  <span className="truncate">Context</span>
                </TabsTrigger>
                <TabsTrigger value="response" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-response">
                  <SafePilotIcon size="sm" className="mr-0.5 sm:mr-1.5 shrink-0" />
                  <span className="truncate">Chat</span>
                </TabsTrigger>
              </TabsList>
              <TabsList className="grid grid-cols-4 w-full mt-1">
                <TabsTrigger value="ultra" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-ultra">
                  <Zap className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0 text-yellow-500" />
                  <span className="truncate">Ultra</span>
                </TabsTrigger>
                <TabsTrigger value="crisis" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-crisis">
                  <AlertTriangle className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                  <span className="truncate">Crisis</span>
                </TabsTrigger>
                <TabsTrigger value="survival" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-survival">
                  <LifeBuoy className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                  <span className="truncate">Survival</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-[10px] sm:text-xs px-1 sm:px-2 min-h-[40px] sm:min-h-9" data-testid="tab-safepilot-history">
                  <History className="h-3.5 w-3.5 mr-0.5 sm:mr-1.5 shrink-0" />
                  <span className="truncate">History</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="intelligence" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Quick Actions</h3>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoSendEnabled}
                          onChange={(e) => setAutoSendEnabled(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Auto-send
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <Card 
                        key={action.id}
                        className={`p-3 cursor-pointer transition-all hover:shadow-md border ${getCategoryColor(action.category)}`}
                        onClick={() => handleQuickAction(action)}
                        data-testid={`quick-action-${action.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${getCategoryColor(action.category)}`}>
                            {action.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground">{action.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{action.description}</div>
                          </div>
                          <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Separator className="my-4" />

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
                    <span className="ml-2 text-sm text-muted-foreground">Loading context...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {contextData?.summary?.title || pageKey.replace('admin.', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {contextData?.summary?.description || 'Page-specific insights and actions'}
                      </p>
                    </div>

                    {contextData && Object.keys(contextData.metrics || {}).length > 0 && (
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

                    {contextData?.alerts && contextData.alerts.length > 0 && (
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

                    {contextData?.quickActions && contextData.quickActions.length > 0 && (
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
                    {(!contextData?.metrics || Object.keys(contextData.metrics).length === 0) && 
                     (!contextData?.alerts || contextData.alerts.length === 0) && 
                     (!contextData?.quickActions || contextData.quickActions.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Ask SafePilot a question to get context-aware insights</p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="response" className="flex-1 flex flex-col mt-0 min-h-0">
              <div 
                ref={chatScrollRef} 
                className="flex-1 p-4 sm:p-6 overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '300px' }}
              >
                {/* Chat Message Bubbles */}
                {chatMessages.length > 0 ? (
                  <div className="space-y-4 mb-4">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isError ? 'bg-red-500' : 'bg-gradient-to-br from-[#2F80ED] to-[#56CCF2]'}`}>
                            <SafePilotIcon size="sm" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-[#2F80ED] to-[#56CCF2] text-white rounded-br-md'
                              : msg.isError
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-bl-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs opacity-60 mt-1">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isSubmitting && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80ED] to-[#56CCF2] flex items-center justify-center flex-shrink-0">
                          <SafePilotIcon size="sm" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-[#2F80ED] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-[#2F80ED] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-[#2F80ED] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
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
                
                {/* Structured Response Details (shown below chat bubbles) */}
                {queryResponse && chatMessages.length > 0 && (
                  <div className="space-y-4 border-t pt-4 mt-4">
                    {(queryResponse as any).mode && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          className={
                            (queryResponse as any).mode === 'WATCH' ? 'bg-blue-500 text-white' :
                            (queryResponse as any).mode === 'GUARD' ? 'bg-red-500 text-white' :
                            (queryResponse as any).mode === 'OPTIMIZE' ? 'bg-green-500 text-white' :
                            'bg-purple-500 text-white'
                          }
                        >
                          {(queryResponse as any).mode} MODE
                        </Badge>
                        <Badge className={getSeverityColor(queryResponse.riskLevel || 'LOW')}>
                          {queryResponse.riskLevel || 'LOW'} Risk
                        </Badge>
                      </div>
                    )}

                    {(queryResponse as any).keySignals?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Key Signals</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(queryResponse as any).keySignals.map((signal: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {signal}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(queryResponse as any).actions?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Recommended Actions</h4>
                        <div className="space-y-2">
                          {(queryResponse as any).actions.map((action: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                              <Badge 
                                variant={action.risk === 'HIGH_RISK' ? 'destructive' : 'secondary'}
                                className={
                                  action.risk === 'CAUTION' ? 'bg-yellow-500/20 text-yellow-700' :
                                  action.risk === 'SAFE' ? 'bg-green-500/20 text-green-700' : ''
                                }
                              >
                                {action.risk === 'HIGH_RISK' ? '[HIGH RISK]' : action.risk === 'CAUTION' ? '[CAUTION]' : '[SAFE]'}
                              </Badge>
                              <span className="text-sm flex-1">{action.label}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(queryResponse as any).monitor?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">What to Monitor</h4>
                        <div className="space-y-1">
                          {(queryResponse as any).monitor.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(queryResponse.insights?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Insights</h4>
                        <div className="space-y-2">
                          {queryResponse.insights?.map((insight, idx) => (
                            <Card key={idx} className={`p-2 border ${getSeverityColor(insight.severity)}`}>
                              <div className="flex items-start gap-2">
                                {getInsightIcon(insight.type)}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{insight.title}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{insight.detail}</div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {(queryResponse.suggestions?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Quick Actions</h4>
                        <div className="flex flex-wrap gap-2">
                          {queryResponse.suggestions?.map((suggestion) => (
                            <Button
                              key={suggestion.key}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleActionClick(suggestion)}
                              data-testid={`button-suggestion-${suggestion.key}`}
                            >
                              {suggestion.label}
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ultra" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Ultra Enhancement Pack
                    </h3>
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                      v3.0
                    </Badge>
                  </div>

                  <div className="grid gap-3">
                    <Card className="p-3 hover-elevate cursor-pointer" onClick={handleAnomalyRadar} data-testid="card-ultra-anomaly">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Radio className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Real-Time Anomaly Radar</div>
                          <div className="text-xs text-muted-foreground">Live detection every 10 seconds</div>
                        </div>
                        {isAnomalyLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : ultraAnomalyData ? (
                          <Badge className={ultraAnomalyData.radarScore > 50 ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}>
                            {ultraAnomalyData.radarScore}
                          </Badge>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Card>

                    <Card className="p-3 hover-elevate cursor-pointer" onClick={handleCorrelation} data-testid="card-ultra-correlation">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Layers className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Cross-Module Correlation</div>
                          <div className="text-xs text-muted-foreground">Combined risk scoring</div>
                        </div>
                        {isCorrelationLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : ultraCorrelationData ? (
                          <Badge className={ultraCorrelationData.combinedRiskScore > 50 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'}>
                            {ultraCorrelationData.combinedRiskScore}
                          </Badge>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Card>

                    <Card className="p-3 hover-elevate cursor-pointer" onClick={handleLostRevenue} data-testid="card-ultra-lost-revenue">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <TrendingDown className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Lost Revenue Detector</div>
                          <div className="text-xs text-muted-foreground">Identify revenue leakage</div>
                        </div>
                        {isLostRevenueLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : ultraLostRevenueData ? (
                          <Badge className="bg-green-500 text-white">
                            ${ultraLostRevenueData.lostRevenue.total.toLocaleString()}
                          </Badge>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Card>

                    <Card className="p-3" data-testid="card-ultra-auto-guard">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <ShieldAlert className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">SafePilot Auto-Guard</div>
                          <div className="text-xs text-muted-foreground">Auto actions on HIGH RISK</div>
                        </div>
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      </div>
                    </Card>

                    <Card className="p-3" data-testid="card-ultra-biometrics">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Fingerprint className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Behavioral Biometrics</div>
                          <div className="text-xs text-muted-foreground">Bot detection engine</div>
                        </div>
                        <Badge variant="outline" className="text-xs">Passive</Badge>
                      </div>
                    </Card>

                    <Card className="p-3" data-testid="card-ultra-xai">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                          <Brain className="h-4 w-4 text-cyan-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Explainable AI (X-AI)</div>
                          <div className="text-xs text-muted-foreground">WHY + confidence %</div>
                        </div>
                        <Badge variant="outline" className="text-xs">Enabled</Badge>
                      </div>
                    </Card>

                    <Card className="p-3" data-testid="card-ultra-silent">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gray-500/10 flex items-center justify-center">
                          <BellOff className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Silent Monitoring</div>
                          <div className="text-xs text-muted-foreground">Low-noise background alerts</div>
                        </div>
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      </div>
                    </Card>

                    <Card className="p-3" data-testid="card-ultra-memory">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <Database className="h-4 w-4 text-indigo-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Long-Term Memory</div>
                          <div className="text-xs text-muted-foreground">Lifetime patterns (5 years)</div>
                        </div>
                        <Badge variant="outline" className="text-xs">5Y Retention</Badge>
                      </div>
                    </Card>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      VoicePilot Commands
                    </h4>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Try: show anomalies, check risks..."
                        value={voiceCommand}
                        onChange={(e) => setVoiceCommand(e.target.value)}
                        className="flex-1 text-sm"
                        data-testid="input-voicepilot"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleVoicePilotCommand(voiceCommand);
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={() => handleVoicePilotCommand(voiceCommand)}
                        disabled={!voiceCommand.trim()}
                        data-testid="button-voicepilot-execute"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['show anomalies', 'check risks', 'show lost revenue', 'crisis report'].map((cmd) => (
                        <Badge
                          key={cmd}
                          variant="outline"
                          className="text-xs cursor-pointer hover-elevate"
                          onClick={() => handleVoicePilotCommand(cmd)}
                          data-testid={`badge-cmd-${cmd.replace(' ', '-')}`}
                        >
                          {cmd}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {ultraAnomalyData && (
                    <Card className="p-3 bg-red-500/5 border-red-500/20">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Radio className="h-4 w-4 text-red-500" />
                        Anomaly Radar Results
                      </h4>
                      <div className="space-y-2">
                        {ultraAnomalyData.anomalies.length > 0 ? (
                          ultraAnomalyData.anomalies.slice(0, 3).map((a, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{a.description}</span>
                              <Badge className={getSeverityColor(a.severity)}>{a.severity}</Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No anomalies detected</p>
                        )}
                      </div>
                    </Card>
                  )}

                  {ultraCorrelationData && (
                    <Card className="p-3 bg-purple-500/5 border-purple-500/20">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-purple-500" />
                        Correlation Results
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Combined Risk Score</span>
                          <Badge className={ultraCorrelationData.combinedRiskScore > 50 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'}>
                            {ultraCorrelationData.combinedRiskScore}/100
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Correlations Found</span>
                          <span className="text-muted-foreground">{ultraCorrelationData.correlations.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Confidence</span>
                          <span className="text-muted-foreground">{ultraCorrelationData.confidence}%</span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {ultraLostRevenueData && (
                    <Card className="p-3 bg-green-500/5 border-green-500/20">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-green-500" />
                        Lost Revenue Analysis
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Total Lost Revenue</span>
                          <Badge className="bg-green-500 text-white">
                            ${ultraLostRevenueData.lostRevenue.total.toLocaleString()}
                          </Badge>
                        </div>
                        {ultraLostRevenueData.recoveryOpportunities.slice(0, 2).map((opp, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{opp.category}</span>
                            <span className="text-green-600">${opp.potentialRecovery.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
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

            <TabsContent value="crisis" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                {crisisReport ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className={crisisReport.summary.includes('CRITICAL') ? 'bg-red-500 text-white' : crisisReport.summary.includes('WARNING') ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'}>
                        {crisisReport.summary.includes('CRITICAL') ? 'CRITICAL' : crisisReport.summary.includes('WARNING') ? 'WARNING' : 'STABLE'}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={handleCrisisReport} disabled={isCrisisLoading}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isCrisisLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>

                    <Card className="p-3 bg-muted/50">
                      <p className="text-sm">{crisisReport.summary}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last updated: {new Date(crisisReport.timestamp).toLocaleTimeString()}
                      </p>
                    </Card>

                    {crisisReport.topRisks.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Top Risks
                        </h4>
                        <div className="space-y-2">
                          {crisisReport.topRisks.map((risk, idx) => (
                            <Card key={idx} className={`p-3 border ${getSeverityColor(risk.severity)}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{risk.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{risk.detail}</p>
                                  <p className="text-xs mt-1"><span className="font-medium">Impact:</span> {risk.impact}</p>
                                </div>
                                <Badge className={getSeverityColor(risk.severity)}>{risk.severity}</Badge>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {crisisReport.urgentFixes.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4 text-orange-500" />
                          Urgent Fixes
                        </h4>
                        <div className="space-y-2">
                          {crisisReport.urgentFixes.map((fix, idx) => (
                            <Card key={idx} className="p-3">
                              <div className="flex items-start gap-2">
                                <Badge className={getPriorityColor(fix.priority)}>{fix.priority}</Badge>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{fix.issue}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{fix.suggestedAction}</p>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {crisisReport.topOpportunities.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Rocket className="h-4 w-4 text-green-500" />
                          Opportunities
                        </h4>
                        <div className="space-y-2">
                          {crisisReport.topOpportunities.map((opp, idx) => (
                            <Card key={idx} className="p-3 bg-green-500/5 border-green-500/20">
                              <p className="text-sm font-medium">{opp.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{opp.potential}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {opp.timeframe}
                                </Badge>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    <Card className="p-3">
                      <h4 className="font-medium text-sm mb-2">Financial Impact</h4>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-red-500/10 rounded">
                          <p className="text-xs text-muted-foreground">At Risk</p>
                          <p className="text-sm font-semibold text-red-500">${crisisReport.financialImpact.totalAtRisk.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded">
                          <p className="text-xs text-muted-foreground">Potential Savings</p>
                          <p className="text-sm font-semibold text-green-500">${crisisReport.financialImpact.potentialSavings.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded">
                          <p className="text-xs text-muted-foreground">Revenue Opp.</p>
                          <p className="text-sm font-semibold text-blue-500">${crisisReport.financialImpact.revenueOpportunity.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>

                    {crisisReport.recommendedNextSteps.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Next Steps</h4>
                        <div className="space-y-1">
                          {crisisReport.recommendedNextSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="h-12 w-12 mb-4 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground mb-4">Generate a real-time crisis report to see platform status.</p>
                    <Button onClick={handleCrisisReport} disabled={isCrisisLoading} data-testid="button-generate-crisis">
                      {isCrisisLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate Crisis Report
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="survival" className="flex-1 flex flex-col mt-0 min-h-0">
              <ScrollArea className="flex-1 p-4 sm:p-6">
                {survivalData ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Company Survival Mode</h3>
                      <Button variant="ghost" size="sm" onClick={handleSurvivalMode} disabled={isSurvivalLoading}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSurvivalLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-500" />
                        Automation Opportunities
                      </h4>
                      <div className="space-y-2">
                        {survivalData.automationOpportunities.map((opp, idx) => (
                          <Card key={idx} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{opp.area}</p>
                                  <Badge className={getAutomationColor(opp.automationLevel)} variant="secondary">
                                    {opp.automationLevel}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Current: {opp.currentCost}</p>
                                <p className="text-xs text-green-600 mt-0.5">Savings: {opp.savingsEstimate}</p>
                              </div>
                              <Badge className={getPriorityColor(opp.priority)}>{opp.priority}</Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-blue-500" />
                        Cost Cutting Options
                      </h4>
                      <div className="space-y-2">
                        {survivalData.costCuttingOptions.map((opt, idx) => (
                          <Card key={idx} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{opt.category}</p>
                                <p className="text-xs text-muted-foreground mt-1">{opt.currentSpend}</p>
                                <p className="text-xs text-green-600 mt-0.5">Potential savings: {opt.potentialSavings}</p>
                              </div>
                              <Badge className={getPriorityColor(opt.risk)}>Risk: {opt.risk}</Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                        Growth Opportunities
                      </h4>
                      <div className="space-y-2">
                        {survivalData.growthOpportunities.map((opp, idx) => (
                          <Card key={idx} className="p-3 bg-purple-500/5 border-purple-500/20">
                            <p className="text-sm font-medium">{opp.opportunity}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-purple-600">{opp.potentialRevenue}</span>
                              <Badge variant="outline" className="text-xs">Effort: {opp.effort}</Badge>
                              <Badge variant="outline" className="text-xs">{opp.timeToValue}</Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <Card className="p-3">
                      <h4 className="font-medium text-sm mb-2">Weekly Focus Areas</h4>
                      <div className="space-y-1">
                        {survivalData.weeklyFocusAreas.map((area, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <Target className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            <span>{area}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-3 bg-red-500/5 border-red-500/20">
                        <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Human Required
                        </h5>
                        <ul className="space-y-1">
                          {survivalData.humanRequired.slice(0, 4).map((item, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground">{item}</li>
                          ))}
                        </ul>
                      </Card>
                      <Card className="p-3 bg-green-500/5 border-green-500/20">
                        <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Can Automate
                        </h5>
                        <ul className="space-y-1">
                          {survivalData.canAutomate.slice(0, 4).map((item, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground">{item}</li>
                          ))}
                        </ul>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <LifeBuoy className="h-12 w-12 mb-4 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground mb-4">Get startup survival recommendations and cost optimization insights.</p>
                    <Button onClick={handleSurvivalMode} disabled={isSurvivalLoading} data-testid="button-survival-mode">
                      {isSurvivalLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <LifeBuoy className="h-4 w-4 mr-2" />
                          Enter Survival Mode
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Separator className="shrink-0" />
          <div className="p-3 sm:p-4 shrink-0 bg-background safe-area-bottom">
            <div className="flex items-center gap-1 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCrisisReport}
                disabled={isCrisisLoading}
                className="text-xs min-h-[36px] flex-1"
                data-testid="button-quick-crisis"
              >
                {isCrisisLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                Crisis
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAutonomousScan}
                disabled={isScanLoading}
                className="text-xs min-h-[36px] flex-1"
                data-testid="button-quick-scan"
              >
                {isScanLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
                Scan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSurvivalMode}
                disabled={isSurvivalLoading}
                className="text-xs min-h-[36px] flex-1"
                data-testid="button-quick-survival"
              >
                {isSurvivalLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LifeBuoy className="h-3 w-3 mr-1" />}
                Optimize
              </Button>
            </div>
            {scanData && (
              <div className="mb-2 p-2 rounded-lg bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${scanData.healthScore >= 80 ? 'bg-green-500' : scanData.healthScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="text-xs">Health: {scanData.healthScore}%</span>
                </div>
                <span className="text-xs text-muted-foreground">{scanData.findings.length} findings</span>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Mode: <span className="font-medium text-foreground uppercase">{currentMode}</span>
                {' | '}
                Priority: <span className="font-medium text-foreground uppercase">{currentTier}</span>
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendEnabled}
                  onChange={(e) => setAutoSendEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                <span className="text-muted-foreground">Auto-send</span>
              </label>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuestion();
              }}
              className="flex gap-2"
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleVoiceCommand}
                disabled={isSubmitting}
                className={`min-h-[44px] min-w-[44px] shrink-0 ${isListening ? 'bg-red-500/10 text-red-500' : ''}`}
                data-testid="button-voice-command"
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
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
