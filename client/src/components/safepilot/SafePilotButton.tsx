import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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
  MessageSquare,
  Copy,
  Trash2,
  Check,
} from 'lucide-react';
import { SafePilotIcon } from './SafePilotLogo';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { fetchWithAuth, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { normalizeSafePilotReply } from './chatApi';

let __SAFEPILOT_BUTTON_MOUNTED__ = false;

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

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'support-issues',
    title: 'Support Issues',
    prompt: 'Show today\'s unresolved customer support tickets: counts by status, oldest 10, and suggested next actions.',
    icon: <LifeBuoy className="h-3.5 w-3.5" />,
    category: 'support',
  },
  {
    id: 'kyc-queue',
    title: 'KYC Queue',
    prompt: 'Show KYC pending approvals by age bucket (0-2h, 2-24h, 1-3d, 3d+) and top risk reasons.',
    icon: <Fingerprint className="h-3.5 w-3.5" />,
    category: 'support',
  },
  {
    id: 'fraud-signals',
    title: 'Fraud Signals',
    prompt: 'Summarize fraud signals in the last 24h: suspicious devices, repeat payment failures, abnormal refunds.',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    category: 'fraud',
  },
  {
    id: 'high-risk-users',
    title: 'High-Risk Users',
    prompt: 'List top 20 high-risk users with reason codes, last activity, and recommended actions.',
    icon: <Shield className="h-3.5 w-3.5" />,
    category: 'fraud',
  },
  {
    id: 'driver-violations',
    title: 'Driver Violations',
    prompt: 'Show driver violations in last 7 days: types, counts, repeat offenders, suggested enforcement.',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    category: 'operations',
  },
  {
    id: 'system-health',
    title: 'System Health',
    prompt: 'Give system health summary: error rate, slow endpoints, memory/CPU warnings, and top fixes.',
    icon: <Activity className="h-3.5 w-3.5" />,
    category: 'operations',
  },
  {
    id: 'payout-anomalies',
    title: 'Payout Anomalies',
    prompt: 'Detect payout anomalies: spikes, duplicates, unusual amounts; list top 20 with reasons.',
    icon: <DollarSign className="h-3.5 w-3.5" />,
    category: 'finance',
  },
  {
    id: 'platform-kpis',
    title: 'Platform KPIs',
    prompt: 'Show key platform KPIs: rides, orders, GMV, active users, NPS, and week-over-week changes.',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    category: 'finance',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  support: 'Support',
  fraud: 'Fraud',
  operations: 'Ops',
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

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pageKey = getPageKeyFromPath(location);

  useEffect(() => {
    if (__SAFEPILOT_BUTTON_MOUNTED__) return;
    __SAFEPILOT_BUTTON_MOUNTED__ = true;
    console.log('[SafePilotButton] Mounted');
    return () => {
      __SAFEPILOT_BUTTON_MOUNTED__ = false;
    };
  }, []);

  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 50);
    }
  }, [chatMessages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (location.startsWith('/admin/support-console')) return null;
  if (!location.startsWith('/admin')) return null;

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isSubmitting) return;

    const userQuestion = text.trim();
    setChatMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    }]);
    setQuestion('');
    setIsSubmitting(true);

    try {
      const res = await fetchWithAuth('/api/admin/safepilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey,
          question: buildPrompt(currentMode, currentPriority, userQuestion),
          role: 'ADMIN',
        }),
      });

      let data;
      try { data = await res.json(); } catch { data = null; }

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
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Connection error. Please try again.`,
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
    const transcript = chatMessages.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n');
    await navigator.clipboard.writeText(transcript);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const groupedActions = QUICK_ACTIONS.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, QuickAction[]>);

  const floatingButton = (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all duration-200 ease-out flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      aria-label="Open SafePilot AI assistant"
    >
      <SafePilotIcon className="w-7 h-7 text-white drop-shadow-sm" />
    </button>
  );

  const chatPanel = isOpen && (
    <div 
      className="fixed inset-0 z-[10000] flex items-end justify-end p-3 sm:p-5 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safepilot-title"
    >
      <div 
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-200"
        onClick={() => setIsOpen(false)}
        aria-label="Close SafePilot"
      />
      
      <div className="relative w-full max-w-[420px] h-[min(640px,85vh)] bg-background border border-border/50 rounded-2xl shadow-2xl shadow-black/10 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
        
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-b from-muted/40 to-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <SafePilotIcon className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <h2 id="safepilot-title" className="text-sm font-semibold text-foreground leading-tight">
                SafePilot
              </h2>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'} ring-2 ring-background`} />
                <span className="text-[10px] text-muted-foreground font-medium">
                  {isOnline ? 'Ready' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5">
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <button 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1.5 rounded-xl" sideOffset={8}>
                <div className="space-y-0.5">
                  <label className="flex items-center gap-2.5 px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/60 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={autoSendEnabled}
                      onChange={(e) => setAutoSendEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-blue-500"
                    />
                    <span className="font-medium">Auto-send</span>
                  </label>
                  <button
                    onClick={handleClearChat}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm font-medium hover:bg-muted/60 rounded-lg transition-colors text-left"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                    Clear chat
                  </button>
                  <button
                    onClick={handleExportChat}
                    disabled={chatMessages.length === 0}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm font-medium hover:bg-muted/60 rounded-lg transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copySuccess ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    Export chat
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3" ref={chatScrollRef}>
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                How can I help?
              </h3>
              <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
                Ask about metrics, KPIs, fraud signals, payouts, system health, or use Quick Actions below.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : msg.isError
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-800/50 rounded-bl-md'
                        : 'bg-muted/70 text-foreground rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 mt-1 px-1 font-medium">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}
              {isSubmitting && (
                <div className="flex items-start animate-in fade-in duration-150">
                  <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-border/50 p-3 bg-gradient-to-t from-muted/30 to-transparent">
          <div className="flex items-center gap-2 mb-2.5">
            <Popover open={modePopoverOpen} onOpenChange={setModePopoverOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium bg-muted/60 hover:bg-muted/80 border border-border/40 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                  <span className="text-foreground">{MODE_LABELS[currentMode]}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className={currentPriority === 'crisis' ? 'text-red-500' : 'text-muted-foreground'}>{PRIORITY_LABELS[currentPriority]}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-52 p-3 rounded-xl" sideOffset={8}>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mode</p>
                    <div className="flex gap-1">
                      {(['intel', 'context', 'chat'] as SafePilotMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => { setCurrentMode(m); setModePopoverOpen(false); }}
                          className={`flex-1 h-8 text-xs font-medium rounded-lg transition-all ${
                            currentMode === m
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'bg-muted/60 text-foreground hover:bg-muted'
                          }`}
                        >
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Priority</p>
                    <div className="flex gap-1">
                      {(['normal', 'crisis', 'history'] as SafePilotPriority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => { setCurrentPriority(p); setModePopoverOpen(false); }}
                          className={`flex-1 h-8 text-xs font-medium rounded-lg transition-all ${
                            currentPriority === p
                              ? p === 'crisis' ? 'bg-red-500 text-white shadow-sm' : 'bg-blue-500 text-white shadow-sm'
                              : 'bg-muted/60 text-foreground hover:bg-muted'
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

            <button
              onClick={() => setQuickActionsOpen(!quickActionsOpen)}
              className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg"
            >
              Quick actions
              {quickActionsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {quickActionsOpen && (
            <div className="mb-3 p-2 bg-muted/40 border border-border/30 rounded-xl max-h-44 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(groupedActions).map(([category, actions]) => (
                  <div key={category} className="contents">
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={(e) => handleQuickAction(action, e.shiftKey)}
                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-left hover:bg-muted/60 rounded-lg transition-colors group"
                      >
                        <span className="text-muted-foreground group-hover:text-blue-500 transition-colors">{action.icon}</span>
                        <span className="truncate">{action.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="flex-1 min-h-[44px] max-h-[88px] px-3.5 py-2.5 text-sm bg-muted/50 border border-border/40 rounded-xl resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              rows={1}
              disabled={isSubmitting}
              aria-label="Type your message"
            />
            <Button
              onClick={() => handleSubmit(question)}
              disabled={!question.trim() || isSubmitting}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-blue-500 hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:shadow-none transition-all"
              aria-label="Send message"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <p className="text-[10px] text-muted-foreground/60 text-center mt-2 font-medium">
            Enter to send · Shift+Enter for new line
          </p>
        </footer>
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
