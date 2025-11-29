import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { VerificationCard } from "./VerificationCard";
import { getTopicsForRole } from "@/config/supportTopics";
import { ArrowLeft, Send, Loader2, HelpCircle, X, MessageCircle, Shield } from "lucide-react";
import { useLocation } from "wouter";

interface ChatMessage {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}

interface SupportChatProps {
  backRoute: string;
  pageTitle?: string;
}

export function SupportChat({ backRoute, pageTitle }: SupportChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isVerified, setIsVerified] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roleTopics = user ? getTopicsForRole(user.role) : undefined;
  const title = pageTitle || roleTopics?.title || "SafeGo Support";
  const subtitle = roleTopics?.subtitle || "We're here to help";
  
  const SEND_COOLDOWN_MS = 1000;

  const getStatusLabel = () => {
    if (!isVerified) return "Not Started";
    const hasAgent = messages.find(m => m.senderType === "agent");
    if (hasAgent) return "Agent";
    return "Bot";
  };

  const getStatusVariant = () => {
    const status = getStatusLabel();
    if (status === "Agent") return "default";
    if (status === "Bot") return "secondary";
    return "outline";
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const updateMessages = (newMessages: ChatMessage[]) => {
    if (newMessages.length === 0) return;
    
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
      if (uniqueNew.length === 0) return prev;
      return [...prev, ...uniqueNew];
    });
    
    const latestTime = newMessages[newMessages.length - 1].createdAt;
    setLastMessageTime(latestTime);
    scrollToBottom();
  };
  
  const addDemoMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    scrollToBottom();
  };

  const startChatMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest("/api/support/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return res.json();
      } catch {
        setDemoMode(true);
        return {
          conversation: { id: `demo-${Date.now()}` },
          messages: [{
            id: "welcome-1",
            senderType: "bot",
            content: "Hello! Welcome to SafeGo Support. How can I help you today?",
            createdAt: new Date().toISOString(),
          }],
        };
      }
    },
    onSuccess: (data) => {
      setConversationId(data.conversation.id);
      updateMessages(data.messages);
    },
    onError: () => {
      setDemoMode(true);
      setConversationId(`demo-${Date.now()}`);
      setMessages([{
        id: "welcome-1",
        senderType: "bot",
        content: "Hello! Welcome to SafeGo Support. How can I help you today?",
        createdAt: new Date().toISOString(),
      }]);
    },
  });

  const getDemoResponse = (userMessage: string): string => {
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes("ride") || lowerMsg.includes("trip")) {
      return "I'd be happy to help with your ride. Could you please share more details about what you need assistance with?";
    }
    if (lowerMsg.includes("payment") || lowerMsg.includes("charge") || lowerMsg.includes("refund")) {
      return "I understand you have a payment concern. Our team will review this and get back to you shortly. For urgent matters, please provide the trip ID.";
    }
    if (lowerMsg.includes("driver") || lowerMsg.includes("rating")) {
      return "Thank you for reaching out about this. We take feedback seriously and will investigate the matter.";
    }
    if (lowerMsg.includes("agent") || lowerMsg.includes("human") || lowerMsg.includes("person")) {
      return "I'm connecting you with a support specialist. Please hold while we find an available agent. Average wait time is under 2 minutes.";
    }
    return "Thank you for your message. A support specialist will review this and respond shortly. Is there anything else I can help you with?";
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error("No conversation");
      
      if (demoMode) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          senderType: "user",
          content,
          createdAt: new Date().toISOString(),
        };
        addDemoMessage(userMsg);
        return { demoMode: true, demoResponse: getDemoResponse(content) };
      }
      
      const res = await apiRequest("/api/support/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessageInput("");
      setLastSendTime(Date.now());
      
      if (data.demoMode && data.demoResponse) {
        setTimeout(() => {
          const botMsg: ChatMessage = {
            id: `bot-${Date.now()}`,
            senderType: "bot",
            content: data.demoResponse,
            createdAt: new Date().toISOString(),
          };
          addDemoMessage(botMsg);
        }, 800 + Math.random() * 700);
      } else if (data.messages) {
        updateMessages(data.messages);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !conversationId) return;
    
    const now = Date.now();
    if (now - lastSendTime < SEND_COOLDOWN_MS) {
      toast({
        title: "Please wait",
        description: "You're sending messages too quickly.",
        variant: "default",
      });
      return;
    }
    
    sendMessageMutation.mutate(trimmed);
  };

  const handleQuickTopic = (userMessage: string, botResponse: string) => {
    if (!conversationId || sendMessageMutation.isPending) return;
    
    const now = Date.now();
    if (now - lastSendTime < SEND_COOLDOWN_MS) return;
    setLastSendTime(now);
    
    if (demoMode) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        senderType: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      };
      addDemoMessage(userMsg);
      
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          senderType: "bot",
          content: botResponse,
          createdAt: new Date().toISOString(),
        };
        addDemoMessage(botMsg);
      }, 600);
      return;
    }
    
    sendMessageMutation.mutate(userMessage, {
      onSuccess: () => {
        setTimeout(() => {
          const botMessage: ChatMessage = {
            id: `bot-${Date.now()}`,
            senderType: "bot",
            content: botResponse,
            createdAt: new Date().toISOString(),
          };
          addDemoMessage(botMessage);
        }, 500);
      },
    });
  };

  const handleVerified = () => {
    setIsVerified(true);
    startChatMutation.mutate();
  };

  const handleEndChat = () => {
    if (confirm("Are you sure you want to end this chat?")) {
      setIsVerified(false);
      setConversationId(null);
      setMessages([]);
      setLastMessageTime(null);
      setDemoMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/support/chat"] });
      toast({
        title: "Chat ended",
        description: "You can start a new chat anytime.",
      });
    }
  };

  useEffect(() => {
    if (!conversationId || !lastMessageTime || demoMode) return;

    const fetchNewMessages = async () => {
      try {
        const sinceParam = `&since=${lastMessageTime}`;
        const res = await fetch(`/api/support/chat/messages?conversationId=${conversationId}${sinceParam}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('safego_token')}`,
          },
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          updateMessages(data.messages);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    const interval = setInterval(fetchNewMessages, 4000);
    return () => clearInterval(interval);
  }, [conversationId, lastMessageTime, demoMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(backRoute)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-lg" data-testid="text-page-title">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Badge variant={getStatusVariant()} data-testid="badge-chat-status">
            {getStatusLabel()}
          </Badge>
        </div>
      </div>

      {/* Main Content: Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Verification + Quick Topics */}
          <div className="lg:col-span-1 space-y-4">
            {/* Verification Overview Card */}
            {!isVerified ? (
              <VerificationCard onVerified={handleVerified} compact={true} />
            ) : (
              <Card data-testid="card-verified-status">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">Verified</h3>
                      <p className="text-xs text-muted-foreground">
                        {user?.email && user.email.includes("@") 
                          ? `${user.email.charAt(0)}***@${user.email.split("@")[1]}`
                          : "Account verified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Topics Section */}
            {isVerified && roleTopics && (
              <Card data-testid="card-quick-topics">
                <CardHeader className="pb-3">
                  <h3 className="font-semibold text-sm">Quick Topics</h3>
                  <p className="text-xs text-muted-foreground">
                    Select a topic to get instant help
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {roleTopics.topics.map((topic) => (
                    <Button
                      key={topic.key}
                      variant="outline"
                      className="w-full justify-start hover-elevate active-elevate-2"
                      onClick={() => handleQuickTopic(topic.userMessage, topic.botResponse)}
                      disabled={sendMessageMutation.isPending}
                      data-testid={`button-topic-${topic.key}`}
                    >
                      <MessageCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-left text-sm">{topic.label}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Help Info */}
            {isVerified && (
              <div className="text-center px-2">
                <p className="text-xs text-muted-foreground">
                  Type 'agent' anytime to speak with a human support specialist
                </p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Chat */}
          <div className="lg:col-span-2">
            {!isVerified ? (
              <Card className="h-[600px] flex items-center justify-center" data-testid="card-chat-placeholder">
                <CardContent className="text-center">
                  <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">Start Live Support</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Verify your account details to begin chatting with our support team. 
                    We're available 24/7 to help you.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-[600px] flex flex-col" data-testid="card-chat-panel">
                {/* Chat Header */}
                <CardHeader className="border-b flex flex-row items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-base">Live Support</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEndChat}
                    data-testid="button-end-chat"
                  >
                    <X className="h-4 w-4 mr-1" />
                    End Chat
                  </Button>
                </CardHeader>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="div-messages">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                      <p className="text-sm">
                        Select a quick topic or type your message below
                      </p>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          msg.senderType === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1.5">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      placeholder="Type your message..."
                      disabled={sendMessageMutation.isPending}
                      className="flex-1"
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendMessageMutation.isPending}
                      size="icon"
                      data-testid="button-send"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <p className="text-xs text-center text-muted-foreground">
          SafeGo Support is available 24/7 · Typical response time: under 2 minutes
        </p>
      </div>
    </div>
  );
}
