import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { VerificationCard } from "./VerificationCard";
import { ArrowLeft, Send, Loader2, HelpCircle, X } from "lucide-react";
import { useLocation } from "wouter";

interface ChatMessage {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}

const QUICK_TOPICS = [
  { label: "Payments & Wallet", value: "payments", icon: "💰" },
  { label: "Trips & Rides", value: "trips", icon: "🚗" },
  { label: "Documents & Vehicle", value: "documents", icon: "📄" },
  { label: "Tax Information", value: "tax", icon: "📊" },
  { label: "Account Settings", value: "account_settings", icon: "⚙️" },
];

interface SupportChatProps {
  backRoute: string;
  pageTitle?: string;
}

export function SupportChat({ backRoute, pageTitle = "SafeGo Support" }: SupportChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isVerified, setIsVerified] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getStatusLabel = () => {
    if (!isVerified) return "Not Started";
    const conversation = messages.find(m => m.senderType === "agent");
    if (conversation) return "Agent";
    return "Bot";
  };

  const getStatusVariant = () => {
    const status = getStatusLabel();
    if (status === "Agent") return "default";
    if (status === "Bot") return "secondary";
    return "outline";
  };

  const updateMessages = (newMessages: ChatMessage[]) => {
    if (newMessages.length === 0) return;
    
    const existingIds = new Set(messages.map(m => m.id));
    const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
    
    if (uniqueNew.length > 0) {
      setMessages(prev => [...prev, ...uniqueNew]);
      const latestTime = newMessages[newMessages.length - 1].createdAt;
      setLastMessageTime(latestTime);
    }
  };

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/chat/start", {});
      return res.json();
    },
    onSuccess: (data) => {
      setConversationId(data.conversation.id);
      updateMessages(data.messages);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error("No conversation");
      const res = await apiRequest("POST", "/api/support/chat/messages", {
        conversationId,
        content,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessageInput("");
      updateMessages(data.messages);
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
    sendMessageMutation.mutate(trimmed);
  };

  const handleQuickReply = (topicLabel: string) => {
    if (!conversationId) return;
    setShowTopics(false);
    sendMessageMutation.mutate(`I need help with: ${topicLabel}`);
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
      setShowTopics(true);
      queryClient.invalidateQueries({ queryKey: ["/api/support/chat"] });
      toast({
        title: "Chat ended",
        description: "You can start a new chat anytime.",
      });
    }
  };

  useEffect(() => {
    if (!conversationId || !lastMessageTime) return;

    const fetchNewMessages = async () => {
      try {
        const sinceParam = `&since=${lastMessageTime}`;
        const res = await fetch(`/api/support/chat/messages?conversationId=${conversationId}${sinceParam}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
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
  }, [conversationId, lastMessageTime, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-[540px] mx-auto py-6">
        {/* Top Bar */}
        <Card className="mb-4 mx-4">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation(backRoute)}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-base" data-testid="text-page-title">
                  {pageTitle}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Get help from our support team
                </p>
              </div>
            </div>
            <Badge variant={getStatusVariant()} data-testid="badge-chat-status">
              {getStatusLabel()}
            </Badge>
          </CardContent>
        </Card>

        {/* Verification Card (shown only if not verified) */}
        {!isVerified && <VerificationCard onVerified={handleVerified} />}

        {/* Chat Panel (shown only after verification) */}
        {isVerified && (
          <Card className="mx-4 mb-4" data-testid="card-chat-panel">
            <CardContent className="p-0">
              {/* Messages Area */}
              <div className="h-[500px] overflow-y-auto p-4 space-y-3" data-testid="div-messages">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <HelpCircle className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm">
                      Start the conversation by selecting a topic below
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
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.senderType === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
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

              {/* Quick Topic Buttons */}
              {showTopics && messages.length > 0 && (
                <div className="px-4 pb-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2">Quick topics:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TOPICS.map((topic) => (
                      <Button
                        key={topic.value}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReply(topic.label)}
                        disabled={sendMessageMutation.isPending}
                        data-testid={`button-topic-${topic.value}`}
                      >
                        <span className="mr-1">{topic.icon}</span>
                        {topic.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setShowTopics(false)}
                    data-testid="button-hide-topics"
                  >
                    Hide topics
                  </Button>
                </div>
              )}

              {/* Input Area */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    placeholder="Type a message..."
                    disabled={sendMessageMutation.isPending}
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
                <div className="flex items-center justify-between mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground p-0 h-auto"
                    onClick={() => setShowTopics(!showTopics)}
                    data-testid="button-toggle-topics"
                  >
                    {showTopics ? "Hide topics" : "Show topics"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleEndChat}
                    data-testid="button-end-chat"
                  >
                    <X className="h-3 w-3 mr-1" />
                    End Chat
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Footer */}
        <div className="mx-4 text-center">
          <p className="text-xs text-muted-foreground">
            SafeGo Support is available 24/7 to help you with any questions
          </p>
        </div>
      </div>
    </div>
  );
}
