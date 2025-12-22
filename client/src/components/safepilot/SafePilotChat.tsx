import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle, X, Send, Loader2, Bot, User as UserIcon, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  flagged?: boolean;
  createdAt: string;
  error?: boolean;
}

interface ChatResponse {
  conversationId: string;
  messageId?: string;
  reply?: string;
  response?: string;
  flagged?: boolean;
  sources?: string[];
}

interface DebugInfo {
  lastUrl: string;
  lastStatus: number | null;
  lastError: string | null;
  lastResponse: string | null;
}

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
}

export function SafePilotChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    lastUrl: '',
    lastStatus: null,
    lastError: null,
    lastResponse: null,
  });
  const [showDebug, setShowDebug] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const getRole = (): 'CUSTOMER' | 'DRIVER' | 'RESTAURANT' | 'ADMIN' => {
    const role = user?.role?.toUpperCase();
    if (role === 'ADMIN') return 'ADMIN';
    if (role === 'DRIVER' || role === 'PENDING_DRIVER') return 'DRIVER';
    if (role === 'RESTAURANT' || role === 'PENDING_RESTAURANT') return 'RESTAURANT';
    return 'CUSTOMER';
  };

  const getCountry = (): 'BD' | 'US' | 'GLOBAL' => {
    const countryCode = user?.countryCode?.toUpperCase();
    if (countryCode === 'BD') return 'BD';
    if (countryCode === 'US') return 'US';
    return 'GLOBAL';
  };

  const { data: conversationsData, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/safepilot/chat/conversations'],
    queryFn: async () => {
      const res = await fetch('/api/safepilot/chat/conversations', {
        credentials: 'include',
      });
      if (!res.ok) return { conversations: [] };
      return res.json();
    },
    enabled: isOpen && isAuthenticated,
    staleTime: 60 * 1000,
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['/api/safepilot/chat/history', conversationId],
    queryFn: async () => {
      if (!conversationId) return { messages: [] };
      const res = await fetch(`/api/safepilot/chat/history/${conversationId}`, {
        credentials: 'include',
      });
      if (!res.ok) return { messages: [] };
      return res.json();
    },
    enabled: isOpen && !!conversationId,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (historyData?.messages) {
      setMessages(historyData.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        flagged: m.flagged,
        createdAt: m.createdAt,
      })));
    }
  }, [historyData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const url = '/api/safepilot/chat';
      setDebugInfo(prev => ({ ...prev, lastUrl: url, lastStatus: null, lastError: null }));
      
      console.log('[SafePilot] Sending message:', { text, role: getRole(), country: getCountry() });
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          country: getCountry(),
          role: getRole(),
          service: 'ALL',
          conversationId: conversationId || undefined,
        }),
      });
      
      const responseText = await res.text();
      let data: ChatResponse | null = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        data = null;
      }
      
      setDebugInfo({
        lastUrl: url,
        lastStatus: res.status,
        lastError: !res.ok ? ((data as any)?.error || `HTTP ${res.status}`) : null,
        lastResponse: responseText?.substring(0, 120) || null,
      });
      
      console.log('[SafePilot] Response:', { status: res.status, data });
      
      if (!res.ok) {
        throw new Error((data as any)?.error || `Request failed (${res.status})`);
      }
      
      if (!data) {
        throw new Error('Empty response from server');
      }
      
      return data;
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      const replyText = data.reply || data.response || 'No response received.';
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || `msg-${Date.now()}`,
          role: 'assistant',
          content: replyText,
          flagged: data.flagged,
          createdAt: new Date().toISOString(),
        },
      ]);
      refetchConversations();
    },
    onError: (error: Error) => {
      console.error('[SafePilot] Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error.message}`,
          createdAt: new Date().toISOString(),
          error: true,
        },
      ]);
      toast({
        title: 'Chat Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setMessage('');
    chatMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (id: string) => {
    setConversationId(id);
  };

  const conversations: Conversation[] = conversationsData?.conversations || [];

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-105"
        aria-label="Open SafePilot AI Chat"
      >
        <Bot className="w-6 h-6" />
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-full" side="right">
          <SheetHeader className="p-4 border-b bg-gradient-to-r from-teal-500 to-cyan-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <div>
                  <SheetTitle className="text-white text-lg">SafePilot AI</SheetTitle>
                  <SheetDescription className="text-white/80 text-sm">
                    Your intelligent assistant
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {debugInfo.lastUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDebug(!showDebug)}
                    className={`text-white hover:bg-white/20 ${showDebug ? 'bg-white/20' : ''}`}
                    title="Toggle debug info"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </Button>
                )}
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
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {showDebug && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 border-b text-xs font-mono">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-yellow-800 dark:text-yellow-200">Debug Info</span>
                <button onClick={() => setShowDebug(false)} className="text-yellow-600 hover:text-yellow-800">hide</button>
              </div>
              <div className="space-y-0.5 text-yellow-700 dark:text-yellow-300">
                <div>URL: {debugInfo.lastUrl || 'none'}</div>
                <div>Status: {debugInfo.lastStatus ?? 'pending'}</div>
                {debugInfo.lastError && <div className="text-red-600">Error: {debugInfo.lastError}</div>}
                {debugInfo.lastResponse && <div>Response: {debugInfo.lastResponse}</div>}
              </div>
            </div>
          )}

          {!showDebug && debugInfo.lastError && (
            <div className="p-2 bg-red-50 dark:bg-red-900/30 border-b">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4" />
                <span>{debugInfo.lastError}</span>
                <button 
                  onClick={() => setShowDebug(true)} 
                  className="ml-auto text-xs underline hover:no-underline"
                >
                  Details
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            {conversations.length > 0 && !conversationId && (
              <div className="w-full p-4 border-b bg-slate-50 dark:bg-slate-900">
                <h3 className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  Recent Conversations
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {conversations.slice(0, 5).map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors truncate"
                    >
                      {conv.title || 'Untitled conversation'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {messages.length === 0 && !historyLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Bot className="w-16 h-16 text-teal-500 mb-4" />
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">
                      How can I help you today?
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[250px]">
                      Ask me anything about SafeGo services, policies, or how to use the platform.
                    </p>
                    <div className="mt-6 space-y-2 w-full max-w-[280px]">
                      {[
                        'How do I book a ride?',
                        'What payment methods are accepted?',
                        'How can I contact support?',
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setMessage(q);
                            setTimeout(() => handleSend(), 100);
                          }}
                          className="w-full text-left px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {historyLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  </div>
                )}

                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.error ? 'bg-red-500' : 'bg-teal-500'}`}>
                          {msg.error ? <AlertCircle className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-teal-500 text-white rounded-br-md'
                            : msg.error
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-bl-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                        } ${msg.flagged ? 'border-2 border-red-500' : ''}`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.flagged && (
                          <p className="text-xs mt-1 text-red-500">Content flagged</p>
                        )}
                        {msg.error && (
                          <button 
                            onClick={() => setShowDebug(true)} 
                            className="text-xs mt-1 underline hover:no-underline"
                          >
                            View details
                          </button>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 text-white" />
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
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
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
                  SafePilot AI may occasionally provide inaccurate information.
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default SafePilotChat;
