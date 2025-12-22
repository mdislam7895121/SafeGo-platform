import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, AlertCircle, User, Loader2 } from 'lucide-react';
import { sendAdminSafePilotQuery, AdminSafePilotResponse } from './adminSafePilotApi';

declare global {
  interface Window {
    __ADMIN_SAFEPILOT_MOUNTED__?: boolean;
  }
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
}

export default function AdminSafePilotPanel() {
  // Singleton guard - prevent duplicate mounts
  useEffect(() => {
    if (window.__ADMIN_SAFEPILOT_MOUNTED__) {
      console.warn('[AdminSafePilotPanel] Already mounted, skipping duplicate instance');
      return;
    }
    window.__ADMIN_SAFEPILOT_MOUNTED__ = true;
    console.log('[AdminSafePilotPanel] Mounted successfully');
    
    return () => {
      window.__ADMIN_SAFEPILOT_MOUNTED__ = false;
      console.log('[AdminSafePilotPanel] Unmounted');
    };
  }, []);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello Admin! I can help you with platform metrics, KPIs, verification queues, and risk analysis. What would you like to know?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSubmit = async () => {
    const query = input.trim();
    if (!query || isLoading) return;
    
    // Clear any previous error state
    setHasError(false);
    
    // Add user message (optimistic)
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response: AdminSafePilotResponse = await sendAdminSafePilotQuery(query);
      
      if (response.error) {
        // Show error bubble
        setHasError(true);
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: `${response.error}\n\nEndpoint: /api/admin/safepilot/query\n\n${response.reply}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        // Show assistant response
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      setHasError(true);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'error',
        content: `Network error: Unable to reach Admin SafePilot.\n\nEndpoint: /api/admin/safepilot/query\n\nPlease check your connection and try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  return (
    <Card className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3 border-b border-blue-100 dark:border-blue-900">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Bot className="w-5 h-5" />
          Admin SafePilot
          <span className="ml-auto text-xs font-normal text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
            ADMIN ONLY
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'error' 
                      ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300' 
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                  }`}>
                    {msg.role === 'error' ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.role === 'error'
                      ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs opacity-60 mt-1 block">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-300 animate-spin" />
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-500">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about platform risks, KPIs, KYC queues..."
              className="resize-none min-h-[60px] max-h-[120px]"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || !input.trim()}
              className="h-auto bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {hasError && (
            <p className="text-xs text-red-500 mt-2">
              An error occurred. Check the error message above for details.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
