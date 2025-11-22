import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, User, Bot } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  senderType: "user" | "admin" | "bot" | "system";
  content: string;
  createdAt: string;
}

interface ChatConversation {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const QUICK_REPLIES = [
  { label: "Payments & Wallet", icon: "💰" },
  { label: "Trips & Riders", icon: "🚗" },
  { label: "Documents & Vehicle", icon: "📄" },
  { label: "Tax Information", icon: "📊" },
  { label: "Account Settings", icon: "⚙️" },
];

export default function DriverSupportChat() {
  const { toast } = useToast();
  const [messageInput, setMessageInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      toast({
        title: "Chat started",
        description: "You're now connected to SafeGo Support",
      });
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

  const escalateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/chat/escalate", {
        conversationId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Escalated to live support",
        description: "A support agent will respond shortly",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/support/chat/messages", conversationId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to escalate. Please try again.",
        variant: "destructive",
      });
    },
  });

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
  }, [conversationId, lastMessageTime, messages, updateMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput);
  };

  const handleQuickReply = (label: string) => {
    if (!conversationId) return;
    sendMessageMutation.mutate(label);
  };

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background" data-testid="support-chat-start-screen">
        <Card className="p-8 max-w-md w-full space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-6">
              <MessageCircle className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold" data-testid="text-support-title">SafeGo Support</h2>
            <p className="text-muted-foreground" data-testid="text-support-description">
              Chat with SafeGo support or get instant answers from our assistant
            </p>
          </div>
          <Button
            onClick={() => startChatMutation.mutate()}
            disabled={startChatMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-start-chat"
          >
            {startChatMutation.isPending ? "Starting..." : "Start Chat"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="support-chat-window">
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-chat-header">SafeGo Support</h2>
            <p className="text-sm text-muted-foreground">We're here to help</p>
          </div>
          <Badge variant="secondary" data-testid="badge-chat-status">Active</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}
            data-testid={`message-${msg.senderType}-${msg.id}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                msg.senderType === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.senderType === "system"
                  ? "bg-muted text-muted-foreground text-sm italic text-center w-full"
                  : "bg-card border"
              }`}
            >
              {msg.senderType !== "user" && msg.senderType !== "system" && (
                <div className="flex items-center gap-2 mb-1">
                  {msg.senderType === "bot" ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">
                    {msg.senderType === "bot" ? "SafeGo Assistant" : "Support Agent"}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-2" data-testid="quick-replies-container">
          {QUICK_REPLIES.map((reply) => (
            <Button
              key={reply.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickReply(reply.label)}
              disabled={sendMessageMutation.isPending}
              data-testid={`button-quick-reply-${reply.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <span className="mr-1">{reply.icon}</span>
              {reply.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            disabled={sendMessageMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!messageInput.trim() || sendMessageMutation.isPending}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => escalateMutation.mutate()}
            disabled={escalateMutation.isPending}
            className="text-sm"
            data-testid="button-escalate-to-human"
          >
            Need more help? Contact live support →
          </Button>
        </div>
      </div>
    </div>
  );
}
