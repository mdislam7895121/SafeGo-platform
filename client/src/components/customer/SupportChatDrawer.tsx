import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MessageCircle, Send, X, Check, CheckCheck, Headphones, Bot, User } from "lucide-react";
import { format } from "date-fns";

export interface SupportMessage {
  id: string;
  senderType: "user" | "admin" | "bot" | "system";
  content: string;
  createdAt: string;
  read?: boolean;
}

interface SupportChatDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rideId?: string | null;
  tripContext?: {
    pickupAddress?: string;
    dropoffAddress?: string;
  } | null;
}

const quickMessages = [
  "I need help with my ride",
  "I have a payment issue",
  "I want to report a problem",
  "I need to change my account details",
];

export function SupportChatDrawer({
  isOpen,
  onOpenChange,
  rideId,
  tripContext,
}: SupportChatDrawerProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<string>("open");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const data = await apiRequest(`/api/support/chat/messages?conversationId=${convId}`);
      setMessages(data.messages || []);
      if (data.conversation) {
        setConversationStatus(data.conversation.status);
      }
    } catch (error) {
      console.error("[SupportChat] Failed to fetch messages:", error);
    }
  }, []);

  const startOrResumeConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      const verifyData = await apiRequest("/api/support/chat/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const convId = verifyData.conversationId;
      setConversationId(convId);

      const data = await apiRequest("/api/support/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      setMessages(data.messages || []);
      setConversationStatus(data.conversation?.status || "open");
      setIsConnected(true);
      
      connectWebSocket(convId);
    } catch (error) {
      console.error("[SupportChat] Failed to start conversation:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback((convId: string) => {
    const token = getAuthToken();
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/support/chat/ws?token=${token}&conversationId=${convId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          const newMessage: SupportMessage = {
            id: data.payload.id || `msg-${Date.now()}`,
            senderType: data.payload.senderType,
            content: data.payload.body,
            createdAt: data.payload.timestamp || new Date().toISOString(),
          };
          setMessages((prev) => [...prev, newMessage]);
          setIsTyping(false);
        } else if (data.type === "typing") {
          setIsTyping(data.payload.isTyping);
        } else if (data.type === "message_read") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.senderType === "user" ? { ...msg, read: true } : msg
            )
          );
        }
      } catch (error) {
        console.error("[SupportChat] Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    if (isOpen && !conversationId) {
      startOrResumeConversation();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, conversationId, startOrResumeConversation]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages.length, isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen && conversationId) {
      pollIntervalRef.current = setInterval(() => {
        fetchMessages(conversationId);
      }, 5000);
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [isOpen, conversationId, fetchMessages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !conversationId || isSending) return;

    setIsSending(true);
    try {
      const data = await apiRequest("/api/support/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: text.trim(),
        }),
      });
      setMessages(data.messages || []);
    } catch (error) {
      console.error("[SupportChat] Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleQuickMessage = (text: string) => {
    sendMessage(text);
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "h:mm a");
    } catch {
      return "";
    }
  };

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case "admin":
        return <Headphones className="h-4 w-4" />;
      case "bot":
        return <Bot className="h-4 w-4" />;
      case "system":
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getSenderLabel = (senderType: string) => {
    switch (senderType) {
      case "admin":
        return "Support Agent";
      case "bot":
        return "SafeGo Assistant";
      case "system":
        return "System";
      default:
        return "You";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[70vh] p-0 rounded-t-2xl flex flex-col"
        data-testid="sheet-support-chat"
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  <Headphones className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-left text-base" data-testid="text-support-title">
                  SafeGo Support
                </SheetTitle>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                    data-testid="indicator-support-status"
                  />
                  <span className="text-xs text-muted-foreground">
                    {isLoading ? "Connecting..." : isConnected ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-support-chat"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {tripContext && (tripContext.pickupAddress || tripContext.dropoffAddress) && (
          <div className="px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Trip Context:</p>
            {tripContext.pickupAddress && <p>From: {tripContext.pickupAddress}</p>}
            {tripContext.dropoffAddress && <p>To: {tripContext.dropoffAddress}</p>}
          </div>
        )}

        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-3">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30 animate-pulse" />
                <p className="text-sm">Connecting to support...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Headphones className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Welcome to SafeGo Support</p>
                <p className="text-xs mt-1">How can we help you today?</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderType === "user" ? "justify-end" : "justify-start"
                  }`}
                  data-testid={`support-message-${msg.id}`}
                >
                  {msg.senderType !== "user" && (
                    <div className="flex-shrink-0 mr-2 mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getSenderIcon(msg.senderType)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.senderType === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : msg.senderType === "system"
                        ? "bg-muted/50 text-muted-foreground italic rounded-bl-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    {msg.senderType !== "user" && msg.senderType !== "system" && (
                      <p className="text-[10px] font-medium mb-1 opacity-70">
                        {getSenderLabel(msg.senderType)}
                      </p>
                    )}
                    <p className="text-sm break-words">{msg.content}</p>
                    <div
                      className={`flex items-center gap-1 mt-1 ${
                        msg.senderType === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span
                        className={`text-[10px] ${
                          msg.senderType === "user"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                      {msg.senderType === "user" && (
                        msg.read ? (
                          <CheckCheck className="h-3 w-3 text-primary-foreground/70" data-testid="icon-support-read-double" />
                        ) : (
                          <Check className="h-3 w-3 text-primary-foreground/70" data-testid="icon-support-read-single" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {isTyping && (
              <div className="flex justify-start" data-testid="support-typing-indicator">
                <div className="flex-shrink-0 mr-2 mt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      <Headphones className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                    <span
                      className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 space-y-3 flex-shrink-0">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-wrap gap-2">
              {quickMessages.map((msg) => (
                <Button
                  key={msg}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleQuickMessage(msg)}
                  disabled={!isConnected || isSending}
                  data-testid={`button-support-quick-${msg.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {msg}
                </Button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={!isConnected || isLoading}
              maxLength={500}
              data-testid="input-support-message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || !isConnected || isSending}
              data-testid="button-send-support-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
