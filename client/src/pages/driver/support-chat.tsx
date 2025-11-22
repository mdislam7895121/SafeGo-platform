import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageCircle, User, Bot, ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ROLE_SUPPORT_TOPICS } from "@/config/supportTopics";

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
  escalatedAt?: string | null;
}

export default function DriverSupportChat() {
  const { toast } = useToast();
  const [messageInput, setMessageInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<string>("idle");
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<string | null>(null);
  const conversationStatusRef = useRef<string>("idle");
  const finalStatusRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Synchronously update both state and ref for conversation status
  const updateConversationStatus = (newStatus: string) => {
    conversationStatusRef.current = newStatus;
    finalStatusRef.current = newStatus;
    setConversationStatus(newStatus);
  };
  
  // Helper to apply closed/escalated state and cancel polling
  const applyClosedState = (status: "closed" | "escalated") => {
    updateConversationStatus(status);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
  
  // Keep ref in sync with state
  useEffect(() => {
    lastMessageTimeRef.current = lastMessageTime;
  }, [lastMessageTime]);
  
  const driverTopics = ROLE_SUPPORT_TOPICS.find(r => r.role === "driver");
  const quickTopics = driverTopics?.topics.map(topic => ({
    label: topic.label,
    key: topic.key,
  })) || [];

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
      // CRITICAL: Set status FIRST (updates ref synchronously) BEFORE setting conversationId
      // This prevents brief window where conversationId is truthy but status hasn't updated yet
      const backendStatus = data.conversation.status;
      if (backendStatus === "pending" || backendStatus === "escalated" || data.conversation.escalatedAt) {
        updateConversationStatus("escalated");
      } else if (backendStatus === "closed") {
        updateConversationStatus("closed");
      } else {
        updateConversationStatus("active");
      }
      
      // Now set conversationId after status ref is updated
      setConversationId(data.conversation.id);
      
      updateMessages(data.messages);
      
      const statusMessage = data.conversation.escalatedAt 
        ? "You're connected to a live support agent"
        : "You're now connected to SafeGo Support";
      
      toast({
        title: "Chat started",
        description: statusMessage,
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
      // DEFENSIVE GUARD: Check ref for latest status (prevents race conditions)
      if (conversationStatusRef.current !== "active") {
        throw new Error("Cannot send messages to a closed or escalated conversation");
      }
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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      // DEFENSIVE GUARD: Check ref for latest status (prevents race conditions)
      if (conversationStatusRef.current !== "active") {
        throw new Error("Cannot escalate a closed conversation");
      }
      const res = await apiRequest("POST", "/api/support/chat/escalate", {
        conversationId,
      });
      return res.json();
    },
    onSuccess: () => {
      applyClosedState("escalated");
      toast({
        title: "Escalated to live support",
        description: "A support agent will respond shortly",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/support/chat/messages", conversationId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to escalate. Please try again.",
        variant: "destructive",
      });
    },
  });

  const botFeedbackMutation = useMutation({
    mutationFn: async ({ messageId, helpful }: { messageId: string; helpful: boolean }) => {
      // DEFENSIVE GUARD: Check ref for latest status (prevents race conditions)
      if (conversationStatusRef.current !== "active") {
        throw new Error("Cannot provide feedback for a closed or escalated conversation");
      }
      const endpoint = helpful ? "/api/support/chat/bot-helpful" : "/api/support/chat/bot-unhelpful";
      const res = await apiRequest("POST", endpoint, { conversationId });
      return res.json();
    },
    onSuccess: (data, variables) => {
      setFeedbackGiven(prev => new Set(prev).add(variables.messageId));
      
      if (data.escalated) {
        applyClosedState("escalated");
        toast({
          title: "Escalated to live support",
          description: data.escalationMessage || "A support agent will assist you shortly",
        });
      } else {
        toast({
          title: "Feedback recorded",
          description: "Thank you for your feedback",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record feedback",
        variant: "destructive",
      });
    },
  });

  const endChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/chat/end", {
        conversationId,
        rating: selectedRating > 0 ? selectedRating : undefined,
        feedback: ratingFeedback.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      applyClosedState("closed");
      setShowRatingDialog(false);
      toast({
        title: "Chat ended",
        description: "Thank you for contacting SafeGo Support",
      });
      setTimeout(() => {
        setConversationId(null);
        setMessages([]);
        setSelectedRating(0);
        setRatingFeedback("");
        setFeedbackGiven(new Set());
        // CRITICAL: DO NOT reset conversationStatus - finalStatusRef preserves "closed"
        // until fresh /chat/start succeeds, preventing bot controls from flashing
      }, 2000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to end chat",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!conversationId) return;

    const fetchNewMessages = async () => {
      try {
        // Use ref to access latest lastMessageTime without triggering effect recreation
        const sinceParam = lastMessageTimeRef.current ? `&since=${lastMessageTimeRef.current}` : "";
        const res = await fetch(`/api/support/chat/messages?conversationId=${conversationId}${sinceParam}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        
        // CRITICAL: Always update conversation status from backend, regardless of message payload
        // Update ref FIRST (synchronous), then state (asynchronous)
        if (data.conversation) {
          const backendStatus = data.conversation.status;
          if (backendStatus === "pending" || backendStatus === "assigned" || backendStatus === "escalated" || data.conversation.escalatedAt) {
            // CRITICAL: Use applyClosedState to synchronously update ref and cancel polling
            applyClosedState("escalated");
          } else if (backendStatus === "closed" || data.conversation.closedAt) {
            // CRITICAL: Use applyClosedState to synchronously update ref and cancel polling
            applyClosedState("closed");
          } else if (backendStatus === "open" || backendStatus === "bot") {
            // Active conversation - update ref first, then state
            updateConversationStatus("active");
          }
        }
        
        // Update messages if new ones arrived
        if (data.messages && data.messages.length > 0) {
          updateMessages(data.messages);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    // CRITICAL: Fire immediately on mount to prevent 4s delay in status updates
    fetchNewMessages();
    
    // CRITICAL: Store interval handle in ref for cleanup in applyClosedState
    pollingIntervalRef.current = setInterval(fetchNewMessages, 4000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [conversationId]);

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
            <p className="text-sm text-muted-foreground">
              {conversationStatus === "escalated" ? "Connected to support agent" : "We're here to help"}
            </p>
          </div>
          <Badge 
            variant={conversationStatus === "escalated" ? "default" : "secondary"} 
            data-testid="badge-chat-status"
          >
            {conversationStatus === "escalated" ? "Live Agent" : "AI Assistant"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.senderType === "user" ? "items-end" : "items-start"}`}
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
            
            {msg.senderType === "bot" && !feedbackGiven.has(msg.id) && conversationStatus === "active" && conversationStatusRef.current === "active" && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => botFeedbackMutation.mutate({ messageId: msg.id, helpful: true })}
                  disabled={botFeedbackMutation.isPending}
                  data-testid={`button-bot-helpful-${msg.id}`}
                  className="text-xs"
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Helpful
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => botFeedbackMutation.mutate({ messageId: msg.id, helpful: false })}
                  disabled={botFeedbackMutation.isPending}
                  data-testid={`button-bot-unhelpful-${msg.id}`}
                  className="text-xs"
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  This didn't help
                </Button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-card p-4 space-y-4">
        {conversationStatus === "active" && conversationStatusRef.current === "active" && quickTopics.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="quick-replies-container">
            {quickTopics.map((topic) => (
              <Button
                key={topic.key}
                variant="outline"
                size="sm"
                onClick={() => handleQuickReply(topic.label)}
                disabled={sendMessageMutation.isPending}
                data-testid={`button-quick-reply-${topic.key}`}
              >
                {topic.label}
              </Button>
            ))}
          </div>
        )}

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
            disabled={sendMessageMutation.isPending || conversationStatus !== "active" || conversationStatusRef.current !== "active"}
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!messageInput.trim() || sendMessageMutation.isPending || conversationStatus !== "active" || conversationStatusRef.current !== "active"}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          {conversationStatus === "active" && conversationStatusRef.current === "active" && (
            <Button
              variant="ghost"
              onClick={() => escalateMutation.mutate()}
              disabled={escalateMutation.isPending}
              className="text-sm"
              data-testid="button-escalate-to-human"
            >
              Need more help? Contact live support →
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowRatingDialog(true)}
            disabled={conversationStatus === "closed" || conversationStatusRef.current === "closed"}
            className="text-sm ml-auto"
            data-testid="button-end-chat"
          >
            End Chat
          </Button>
        </div>
      </div>
      
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent data-testid="dialog-rating">
          <DialogHeader>
            <DialogTitle data-testid="text-rating-title">How was your support experience?</DialogTitle>
            <DialogDescription data-testid="text-rating-description">
              Your feedback helps us improve our service
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant={selectedRating === rating ? "default" : "outline"}
                  size="icon"
                  onClick={() => setSelectedRating(rating)}
                  data-testid={`button-rating-${rating}`}
                  className="h-12 w-12"
                >
                  <Star className={`h-6 w-6 ${selectedRating >= rating ? "fill-current" : ""}`} />
                </Button>
              ))}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Additional feedback (optional)
              </label>
              <Textarea
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="resize-none"
                rows={4}
                maxLength={500}
                data-testid="textarea-rating-feedback"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {ratingFeedback.length}/500 characters
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowRatingDialog(false);
                setSelectedRating(0);
                setRatingFeedback("");
              }}
              data-testid="button-cancel-rating"
            >
              Cancel
            </Button>
            <Button
              onClick={() => endChatMutation.mutate()}
              disabled={endChatMutation.isPending}
              data-testid="button-submit-rating"
            >
              {endChatMutation.isPending ? "Ending..." : "End Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
