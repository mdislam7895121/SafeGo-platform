import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  X, 
  Send, 
  Loader2, 
  Settings,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  Fingerprint,
  ShieldAlert,
  Shield,
  AlertTriangle,
  Activity,
  DollarSign,
  BarChart3,
  Sparkles,
  Copy,
  Trash2,
  Check,
} from 'lucide-react';
import { SafePilotIcon } from './SafePilotLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { fetchWithAuth, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { normalizeSafePilotReply } from './chatApi';

// Singleton guard to prevent duplicate mounts
let __SAFEPILOT_BUTTON_MOUNTED__ = false;

// Types
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
  prompt: string;
  icon: React.ReactNode;
  category: 'support' | 'fraud' | 'operations' | 'finance';
}

type SafePilotMode = 'intel' | 'context' | 'chat';
type SafePilotPriority = 'normal' | 'crisis' | 'history';

// Prompt system
const BASE_SYSTEM_INSTRUCTION = `You are Admin SafePilot for SafeGo. You answer ONLY admin/operator questions: metrics, KPIs, platform ops, KYC queues, fraud/risk signals, payouts, disputes, system health, and recommended actions. You must not handle end-user support conversations. If asked to do customer-support agent tasks, respond: 'Use Support SafePilot on /admin/support-console.' Be concise, action-oriented, and provide clear next steps.`;

const MODE_LABELS: Record<SafePilotMode, string> = {
  intel: 'Intel',
  context: 'Context',
  chat: 'Chat',
};

const PRIORITY_LABELS: Record<SafePilotPriority, string> = {
  normal: 'Normal',
  crisis: 'Crisis',
  history: 'History',
};

const MODE_INSTRUCTIONS: Record<SafePilotMode, string> = {
  intel: 'Mode: INTEL. Summarize signals, risks, and what to watch. Use bullet points.',
  context: 'Mode: CONTEXT. Explain what is happening, why, and dependencies.',
  chat: 'Mode: CHAT. Answer as a helpful operator assistant.',
};

const PRIORITY_INSTRUCTIONS: Record<SafePilotPriority, string> = {
  normal: '',
  crisis: 'Priority: CRISIS. Focus on incident response: impact, scope, mitigation, owner actions.',
  history: 'Priority: HISTORY. Provide trends, comparisons, and insights over time.',
};

function buildPrompt(mode: SafePilotMode, priority: SafePilotPriority, userText: string): string {
  const parts = [BASE_SYSTEM_INSTRUCTION];
  if (PRIORITY_INSTRUCTIONS[priority]) {
    parts.push(PRIORITY_INSTRUCTIONS[priority]);
  }
  parts.push(MODE_INSTRUCTIONS[mode]);
  parts.push(`User Query: ${userText}`);
  return parts.join('\n\n');
}

// Quick actions
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'support-issues',
    title: 'Support Issues',
    prompt: 'Show today\'s unresolved customer support tickets: counts by status, oldest 10, and suggested next actions.',
    icon: <LifeBuoy className="h-4 w-4" />,
    category: 'support',
  },
  {
    id: 'kyc-queue',
    title: 'KYC Queue',
    prompt: 'Show KYC pending approvals by age bucket (0-2h, 2-24h, 1-3d, 3d+) and top risk reasons.',
    icon: <Fingerprint className="h-4 w-4" />,
    category: 'support',
  },
  {
    id: 'fraud-signals',
    title: 'Fraud Signals',
    prompt: 'Summarize fraud signals in the last 24h: suspicious devices, repeat payment failures, abnormal refunds.',
    icon: <ShieldAlert className="h-4 w-4" />,
    category: 'fraud',
  },
  {
    id: 'high-risk-users',
    title: 'High-Risk Users',
    prompt: 'List top 20 high-risk users with reason codes, last activity, and recommended actions.',
    icon: <Shield className="h-4 w-4" />,
    category: 'fraud',
  },
  {
    id: 'driver-violations',
    title: 'Driver Violations',
    prompt: 'Show driver violations in last 7 days: types, counts, repeat offenders, suggested enforcement.',
    icon: <AlertTriangle className="h-4 w-4" />,
    category: 'operations',
  },
  {
    id: 'system-health',
    title: 'System Health',
    prompt: 'Give system health summary: error rate, slow endpoints, memory/CPU warnings, and top fixes.',
    icon: <Activity className="h-4 w-4" />,
    category: 'operations',
  },
  {
    id: 'payout-anomalies',
    title: 'Payout Anomalies',
    prompt: 'Detect payout anomalies: spikes, duplicates, unusual amounts; list top 20 with reasons.',
    icon: <DollarSign className="h-4 w-4" />,
    category: 'finance',
  },
  {
    id: 'platform-kpis',
    title: 'Platform KPIs',
    prompt: 'Show key platform KPIs: rides, orders, GMV, active users, NPS, and week-over-week changes.',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'finance',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  support: 'Support',
  fraud: 'Fraud',
  operations: 'Operations',
  finance: 'Finance',
};

const getPageKeyFromPath = (pathname: string): string => {
  const path = pathname.replace(/^\/+/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0 || segments[0] !== 'admin') return 'admin.dashboard';
  if (segments.length === 1) return 'admin.dashboard';
  return `admin.${segments[1]}`;
};

export function SafePilotButton() {
  const [location] = useLocation();
  const { toast } = useToast();

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMode, setCurrentMode] = useState<SafePilotMode>('chat');
  const [currentPriority, setCurrentPriority] = useState<SafePilotPriority>('normal');
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modePopoverOpen, setModePopoverOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pageKey = getPageKeyFromPath(location);

  // Singleton guard
  useEffect(() => {
    if (__SAFEPILOT_BUTTON_MOUNTED__) {
      console.warn('[SafePilotButton] Already mounted, skipping duplicate');
      return;
    }
    __SAFEPILOT_BUTTON_MOUNTED__ = true;
    console.log('[SafePilotButton] Mounted');
    return () => {
      __SAFEPILOT_BUTTON_MOUNTED__ = false;
      console.log('[SafePilotButton] Unmounted');
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [chatMessages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Hide on support-console
  if (location.startsWith('/admin/support-console')) {
    return null;
  }

  // Only show on admin pages
  if (!location.startsWith('/admin')) {
    return null;
  }

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isSubmitting) return;

    const userQuestion = text.trim();
    const userMessageId = `user-${Date.now()}`;
    
    setChatMessages(prev => [...prev, {
      id: userMessageId,
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    }]);
    setQuestion('');
    setIsSubmitting(true);

    const fullPrompt = buildPrompt(currentMode, currentPriority, userQuestion);

    try {
      const res = await fetchWithAuth('/api/admin/safepilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey,
          question: fullPrompt,
          role: 'ADMIN',
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const normalizedReply = normalizeSafePilotReply(data);
      const displayContent = normalizedReply?.trim() || 'No response received. Please try again.';

      setChatMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: displayContent,
        timestamp: new Date(),
        isError: !res.ok,
      }]);

      setIsOnline(true);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/safepilot/history'] });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
        isError: true,
      }]);
      setIsOnline(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAction = (action: QuickAction, shiftKey: boolean) => {
    if (autoSendEnabled || shiftKey) {
      handleSubmit(action.prompt);
    } else {
      setQuestion(action.prompt);
      inputRef.current?.focus();
    }
    setQuickActionsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(question);
    }
    if (e.key === 'Escape') {
      setModePopoverOpen(false);
      setSettingsOpen(false);
      setQuickActionsOpen(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setSettingsOpen(false);
    toast({ title: 'Chat cleared' });
  };

  const handleExportChat = async () => {
    const transcript = chatMessages
      .map(m => `[${m.role.toUpperCase()}] ${m.content}`)
      .join('\n\n');
    await navigator.clipboard.writeText(transcript);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const groupedActions = QUICK_ACTIONS.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, QuickAction[]>);

  // Floating button
  const floatingButton = (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
      aria-label="Open SafePilot"
    >
      <SafePilotIcon className="w-7 h-7 text-white" />
    </button>
  );

  // Chat panel
  const chatPanel = isOpen && (
    <div className="fixed inset-0 z-[10000] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md h-[600px] max-h-[80vh] bg-background border rounded-xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <SafePilotIcon className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-sm">SafePilot</span>
            <span 
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div className="flex items-center gap-1">
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2">
                <div className="space-y-1">
                  <label className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded">
                    <input
                      type="checkbox"
                      checked={autoSendEnabled}
                      onChange={(e) => setAutoSendEnabled(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Auto-send
                  </label>
                  <button
                    onClick={handleClearChat}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-muted rounded text-left"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear chat
                  </button>
                  <button
                    onClick={handleExportChat}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-muted rounded text-left"
                    disabled={chatMessages.length === 0}
                  >
                    {copySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Export chat
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chat body */}
        <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
              <Sparkles className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Ask SafePilot anything about your platform.</p>
              <p className="text-xs mt-1">Metrics, KPIs, fraud signals, payouts, and more.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : msg.isError
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              ))}
              {isSubmitting && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Composer */}
        <div className="border-t p-3 bg-background">
          {/* Mode/Priority pill */}
          <div className="flex items-center gap-2 mb-2">
            <Popover open={modePopoverOpen} onOpenChange={setModePopoverOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors">
                  <span className="font-medium">{MODE_LABELS[currentMode]}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{PRIORITY_LABELS[currentPriority]}</span>
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Mode</p>
                    <div className="flex gap-1">
                      {(['intel', 'context', 'chat'] as SafePilotMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setCurrentMode(m)}
                          className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                            currentMode === m
                              ? 'bg-blue-500 text-white'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Priority</p>
                    <div className="flex gap-1">
                      {(['normal', 'crisis', 'history'] as SafePilotPriority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setCurrentPriority(p)}
                          className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                            currentPriority === p
                              ? p === 'crisis'
                                ? 'bg-red-500 text-white'
                                : 'bg-blue-500 text-white'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Quick actions toggle */}
            <button
              onClick={() => setQuickActionsOpen(!quickActionsOpen)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Quick actions
              {quickActionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {/* Quick actions panel */}
          {quickActionsOpen && (
            <div className="mb-3 p-2 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
              {Object.entries(groupedActions).map(([category, actions]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 px-1">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="grid gap-1">
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={(e) => handleQuickAction(action, e.shiftKey)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-muted rounded transition-colors"
                      >
                        <span className="text-muted-foreground">{action.icon}</span>
                        <span>{action.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask SafePilot..."
              className="flex-1 min-h-[40px] max-h-[80px] px-3 py-2 text-sm bg-muted border-0 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              rows={1}
              disabled={isSubmitting}
              aria-label="Message input"
            />
            <Button
              onClick={() => handleSubmit(question)}
              disabled={!question.trim() || isSubmitting}
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Send message"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {!isOpen && floatingButton}
      {chatPanel}
    </>,
    document.body
  );
}

export default SafePilotButton;
