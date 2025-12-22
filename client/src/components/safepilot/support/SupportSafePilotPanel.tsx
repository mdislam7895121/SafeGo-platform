import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, AlertCircle, User, Loader2, Headphones } from 'lucide-react';
import { sendSupportSafePilotQuery, SupportSafePilotResponse } from './supportSafePilotApi';

declare global {
  interface Window {
    __SUPPORT_SAFEPILOT_MOUNTED__?: boolean;
  }
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
}

export default function SupportSafePilotPanel() {
  // Singleton guard - prevent duplicate mounts
  useEffect(() => {
    if (window.__SUPPORT_SAFEPILOT_MOUNTED__) {
      console.warn('[SupportSafePilotPanel] Already mounted, skipping duplicate instance');
      return;
    }
    window.__SUPPORT_SAFEPILOT_MOUNTED__ = true;
    console.log('[SupportSafePilotPanel] Mounted successfully');
    
    return () => {
      window.__SUPPORT_SAFEPILOT_MOUNTED__ = false;
      console.log('[SupportSafePilotPanel] Unmounted');
    };
  }, []);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello Support Admin! I can help you with customer issues, support tickets, refunds, and conversation summaries. How can I assist you today?',
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
      const response: SupportSafePilotResponse = await sendSupportSafePilotQuery(query);
      
      if (response.error) {
        // Show error bubble
        setHasError(true);
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: `${response.error}\n\nEndpoint: /api/support/safepilot/query\n\n${response.reply}`,
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
        content: `Network error: Unable to reach Support SafePilot.\n\nEndpoint: /api/support/safepilot/query\n\nPlease check your connection and try again.`,
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
    <Card className="h-full flex flex-col bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-950 border-green-200 dark:border-green-800">
      <CardHeader className="pb-3 border-b border-green-100 dark:border-green-900">
        <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
          <Headphones className="w-5 h-5" />
          Support SafePilot
          <span className="ml-auto text-xs font-normal text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded">
            SUPPORT ADMIN ONLY
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
                      : 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                  }`}>
                    {msg.role === 'error' ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-green-600 text-white'
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
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-green-600 dark:text-green-300 animate-spin" />
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
              placeholder="Ask about unresolved issues, tickets, refunds..."
              className="resize-none min-h-[60px] max-h-[120px]"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || !input.trim()}
              className="h-auto bg-green-600 hover:bg-green-700"
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
