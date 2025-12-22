import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle, X, Send, Loader2, Bot, User as UserIcon, ChevronRight, RefreshCw, AlertCircle, CheckCircle, ExternalLink, CreditCard, Upload, Car, UtensilsCrossed, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export type ServiceType = 'RIDE' | 'FOOD' | 'PARCEL' | 'ALL';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  flagged?: boolean;
  createdAt: string;
  actions?: ActionButton[];
  isProactive?: boolean;
}

interface ActionButton {
  id: string;
  label: string;
  actionType: 'navigate' | 'api_call' | 'escalate' | 'upload';
  route?: string;
  apiEndpoint?: string;
  payload?: Record<string, any>;
  icon?: string;
}

interface ChatResponse {
  conversationId: string;
  reply: string;
  response?: string;
  sources: Array<{ id: string; title: string }>;
  suggestedActions?: string[];
  toolsUsed?: string[];
  messageId?: string;
}

interface CustomerSafePilotWidgetProps {
  service?: ServiceType;
  entityId?: string;
  entityType?: 'ride' | 'order' | 'delivery';
  autoOpen?: boolean;
  onClose?: () => void;
}

interface ProactiveTrigger {
  id: string;
  triggerType: string;
  message: string;
  actions: ActionButton[];
  priority: 'low' | 'medium' | 'high';
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  upload: <Upload className="w-4 h-4" />,
  navigate: <ChevronRight className="w-4 h-4" />,
  payment: <CreditCard className="w-4 h-4" />,
  ride: <Car className="w-4 h-4" />,
  food: <UtensilsCrossed className="w-4 h-4" />,
  parcel: <Package className="w-4 h-4" />,
  escalate: <ExternalLink className="w-4 h-4" />,
};

function getActionIcon(action: ActionButton): React.ReactNode {
  if (action.icon && ACTION_ICONS[action.icon]) {
    return ACTION_ICONS[action.icon];
  }
  return ACTION_ICONS[action.actionType] || <ChevronRight className="w-4 h-4" />;
}

function parseActionsFromResponse(reply: string, suggestedActions?: string[]): ActionButton[] {
  const actions: ActionButton[] = [];

  const actionPatterns: Array<{ pattern: RegExp; action: Partial<ActionButton> }> = [
    { pattern: /upload.*document|missing.*document|verification/i, action: { id: 'upload_doc', label: 'Upload Document', actionType: 'navigate', route: '/profile/verification', icon: 'upload' } },
    { pattern: /rebook.*ride|book.*again/i, action: { id: 'rebook_ride', label: 'Rebook Ride', actionType: 'navigate', route: '/ride/book', icon: 'ride' } },
    { pattern: /retry.*payment|payment.*method/i, action: { id: 'retry_payment', label: 'Retry Payment', actionType: 'navigate', route: '/wallet/payment-methods', icon: 'payment' } },
    { pattern: /contact.*support|escalate|speak.*agent/i, action: { id: 'contact_support', label: 'Contact Support', actionType: 'escalate', icon: 'escalate' } },
    { pattern: /track.*order|view.*order/i, action: { id: 'track_order', label: 'Track Order', actionType: 'navigate', route: '/orders', icon: 'food' } },
    { pattern: /track.*delivery|view.*delivery/i, action: { id: 'track_delivery', label: 'Track Delivery', actionType: 'navigate', route: '/deliveries', icon: 'parcel' } },
    { pattern: /wallet|balance/i, action: { id: 'view_wallet', label: 'View Wallet', actionType: 'navigate', route: '/wallet', icon: 'payment' } },
  ];

  for (const { pattern, action } of actionPatterns) {
    if (pattern.test(reply)) {
      actions.push(action as ActionButton);
    }
  }

  if (suggestedActions) {
    for (const suggestion of suggestedActions) {
      if (suggestion.toLowerCase().includes('verification')) {
        actions.push({ id: 'go_verification', label: suggestion, actionType: 'navigate', route: '/profile/verification', icon: 'upload' });
      } else if (suggestion.toLowerCase().includes('wallet') || suggestion.toLowerCase().includes('payment')) {
        actions.push({ id: 'go_wallet', label: suggestion, actionType: 'navigate', route: '/wallet', icon: 'payment' });
      } else if (suggestion.toLowerCase().includes('order')) {
        actions.push({ id: 'go_orders', label: suggestion, actionType: 'navigate', route: '/orders', icon: 'food' });
      } else if (suggestion.toLowerCase().includes('support')) {
        actions.push({ id: 'go_support', label: suggestion, actionType: 'escalate', icon: 'escalate' });
      }
    }
  }

  const uniqueActions = actions.reduce((acc, action) => {
    if (!acc.find(a => a.id === action.id)) {
      acc.push(action);
    }
    return acc;
  }, [] as ActionButton[]);

  return uniqueActions.slice(0, 3);
}

export function CustomerSafePilotWidget({
  service = 'ALL',
  entityId,
  entityType,
  autoOpen = false,
  onClose,
}: CustomerSafePilotWidgetProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const getCountry = (): 'BD' | 'US' | 'GLOBAL' => {
    const countryCode = user?.countryCode?.toUpperCase();
    if (countryCode === 'BD') return 'BD';
    if (countryCode === 'US') return 'US';
    return 'GLOBAL';
  };

  const { data: triggerData } = useQuery({
    queryKey: ['/api/safepilot/customer/triggers', service, entityId],
    queryFn: async () => {
      const params = new URLSearchParams({ service });
      if (entityId) params.append('entityId', entityId);
      if (entityType) params.append('entityType', entityType);
      
      const res = await fetch(`/api/safepilot/customer/triggers?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) return { triggers: [] };
      return res.json() as Promise<{ triggers: ProactiveTrigger[] }>;
    },
    enabled: isOpen && isAuthenticated,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (triggerData?.triggers && triggerData.triggers.length > 0 && messages.length === 0) {
      const proactiveMessages: ChatMessage[] = triggerData.triggers.map((trigger) => ({
        id: `proactive-${trigger.id}`,
        role: 'assistant' as const,
        content: trigger.message,
        createdAt: new Date().toISOString(),
        actions: trigger.actions,
        isProactive: true,
      }));
      setMessages(proactiveMessages);
    }
  }, [triggerData, messages.length]);

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('/api/safepilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          country: getCountry(),
          role: 'CUSTOMER',
          service,
          conversationId: conversationId || undefined,
          context: entityId ? { entityId, entityType } : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Chat failed');
      }
      return res.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      const responseText = data.reply || data.response || '';
      const actions = parseActionsFromResponse(responseText, data.suggestedActions);
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || `assistant-${Date.now()}`,
          role: 'assistant',
          content: responseText,
          createdAt: new Date().toISOString(),
          actions: actions.length > 0 ? actions : undefined,
        },
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Unable to get help',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setMessage('');
    chatMutation.mutate(message.trim());
  };

  const handleActionClick = async (action: ActionButton) => {
    switch (action.actionType) {
      case 'navigate':
        if (action.route) {
          setIsOpen(false);
          navigate(action.route);
        }
        break;
      case 'escalate':
        try {
          const res = await fetch('/api/support/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              subject: 'SafePilot Escalation',
              description: `User requested support escalation.\n\nConversation context:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
              category: service.toLowerCase(),
              priority: 'high',
              safepilotConversationId: conversationId,
            }),
          });
          if (res.ok) {
            toast({
              title: 'Support ticket created',
              description: 'Our team will contact you shortly.',
            });
            setMessages((prev) => [
              ...prev,
              {
                id: `system-${Date.now()}`,
                role: 'assistant',
                content: 'I\'ve escalated your issue to our support team. They will reach out to you shortly via email or phone.',
                createdAt: new Date().toISOString(),
              },
            ]);
          }
        } catch (error) {
          toast({
            title: 'Could not create ticket',
            description: 'Please try again or call our support line.',
            variant: 'destructive',
          });
        }
        break;
      case 'api_call':
        if (action.apiEndpoint) {
          try {
            await fetch(action.apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(action.payload || {}),
            });
            toast({ title: 'Action completed' });
          } catch {
            toast({ title: 'Action failed', variant: 'destructive' });
          }
        }
        break;
      case 'upload':
        if (action.route) {
          setIsOpen(false);
          navigate(action.route);
        }
        break;
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        aria-label="Need help? Ask SafePilot"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Need help?</span>
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-full" side="right">
          <SheetHeader className="p-4 border-b bg-gradient-to-r from-teal-500 to-cyan-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <div>
                  <SheetTitle className="text-white text-lg">SafePilot</SheetTitle>
                  <SheetDescription className="text-white/80 text-sm">
                    {service !== 'ALL' ? `${service} Help` : 'Your AI Assistant'}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewConversation}
                  className="text-white hover:bg-white/20"
                  title="New conversation"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Bot className="w-16 h-16 text-teal-500 mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">
                    How can I help you today?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[250px] mb-6">
                    Ask me anything about your {service !== 'ALL' ? service.toLowerCase() : 'SafeGo'} experience.
                  </p>
                  <div className="space-y-2 w-full max-w-[280px]">
                    {service === 'RIDE' && (
                      <>
                        <QuickQuestion text="Where is my driver?" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="How do I cancel a ride?" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="I was overcharged" onSelect={(q) => { setMessage(q); }} />
                      </>
                    )}
                    {service === 'FOOD' && (
                      <>
                        <QuickQuestion text="My order is late" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="Wrong items delivered" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="How do I get a refund?" onSelect={(q) => { setMessage(q); }} />
                      </>
                    )}
                    {service === 'PARCEL' && (
                      <>
                        <QuickQuestion text="Where is my package?" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="Delivery failed" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="Wrong address" onSelect={(q) => { setMessage(q); }} />
                      </>
                    )}
                    {service === 'ALL' && (
                      <>
                        <QuickQuestion text="How do I verify my account?" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="Payment issues" onSelect={(q) => { setMessage(q); }} />
                        <QuickQuestion text="Contact support" onSelect={(q) => { setMessage(q); }} />
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-teal-500 text-white rounded-br-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                        } ${msg.isProactive ? 'border-2 border-teal-300 dark:border-teal-600' : ''}`}
                      >
                        {msg.isProactive && (
                          <Badge variant="secondary" className="mb-2 text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Noticed something
                          </Badge>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="ml-11 mt-2 flex flex-wrap gap-2">
                        {msg.actions.map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleActionClick(action)}
                            className="text-xs h-8 border-teal-200 hover:bg-teal-50 hover:border-teal-400 dark:border-teal-700 dark:hover:bg-teal-900/30"
                          >
                            {getActionIcon(action)}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {chatMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-white dark:bg-slate-950">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your question..."
                  disabled={chatMutation.isPending}
                  className="flex-1"
                  maxLength={4000}
                />
                <Button
                  type="submit"
                  disabled={!message.trim() || chatMutation.isPending}
                  size="icon"
                  className="bg-teal-500 hover:bg-teal-600"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                SafePilot may provide suggestions. Always verify important information.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function QuickQuestion({ text, onSelect }: { text: string; onSelect: (text: string) => void }) {
  return (
    <button
      onClick={() => onSelect(text)}
      className="w-full text-left px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
    >
      <MessageCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
      <span>{text}</span>
    </button>
  );
}

export default CustomerSafePilotWidget;
