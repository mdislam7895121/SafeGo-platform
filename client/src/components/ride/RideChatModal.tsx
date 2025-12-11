import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  senderType: "customer" | "driver";
  message: string;
  createdAt: string;
  senderName?: string;
}

interface DriverInfo {
  name: string;
  avatarInitials: string;
}

interface RideChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string | null;
  driver: DriverInfo | null;
  customerName?: string;
  isDemoMode?: boolean;
}

const DEMO_MESSAGES: Message[] = [
  {
    id: "msg-1",
    senderType: "driver",
    message: "Hi! I'm on my way to pick you up. Should be there in about 5 minutes.",
    createdAt: new Date(Date.now() - 120000).toISOString(),
    senderName: "Michael Chen",
  },
  {
    id: "msg-2",
    senderType: "customer",
    message: "Great, thanks! I'm waiting outside.",
    createdAt: new Date(Date.now() - 60000).toISOString(),
    senderName: "You",
  },
];

const QUICK_REPLIES = [
  "I'm waiting outside",
  "I'll be right there",
  "Running a few minutes late",
  "Can you come to the back entrance?",
];

export function RideChatModal({
  open,
  onOpenChange,
  rideId,
  driver,
  customerName = "You",
  isDemoMode = true,
}: RideChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      if (isDemoMode) {
        setMessages(DEMO_MESSAGES.map(msg => ({
          ...msg,
          senderName: msg.senderType === "driver" ? driver?.name : customerName,
        })));
      } else if (rideId) {
        fetchMessages();
      }
    }
  }, [open, rideId, isDemoMode, driver?.name, customerName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchMessages = async () => {
    if (!rideId) return;
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/rides/${rideId}/chat`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || newMessage.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      senderType: "customer",
      message: text,
      createdAt: new Date().toISOString(),
      senderName: customerName,
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage("");
    setIsSending(true);

    try {
      if (!isDemoMode && rideId) {
        await apiRequest(`/api/rides/${rideId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
      }

      if (isDemoMode) {
        setTimeout(() => {
          const driverResponse: Message = {
            id: `demo-${Date.now()}`,
            senderType: "driver",
            message: getAutoResponse(text),
            createdAt: new Date().toISOString(),
            senderName: driver?.name || "Driver",
          };
          setMessages(prev => [...prev, driverResponse]);
        }, 1500);
      }
    } catch (error: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getAutoResponse = (userMessage: string): string => {
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes("late") || lowerMsg.includes("few minutes")) {
      return "No problem, take your time. I'll wait for you.";
    }
    if (lowerMsg.includes("outside") || lowerMsg.includes("waiting")) {
      return "Perfect! I can see you. I'll pull up right now.";
    }
    if (lowerMsg.includes("back entrance") || lowerMsg.includes("side")) {
      return "Got it, heading to the back entrance now.";
    }
    return "Thanks for letting me know!";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {driver?.avatarInitials || "D"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-base">{driver?.name || "Driver"}</DialogTitle>
              <p className="text-xs text-muted-foreground">Your driver</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-chat"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">
                Start a conversation with your driver
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderType === "customer" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      msg.senderType === "customer"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.senderType === "customer"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4 flex-shrink-0 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {QUICK_REPLIES.map((reply) => (
              <Button
                key={reply}
                variant="outline"
                size="sm"
                onClick={() => handleSendMessage(reply)}
                disabled={isSending}
                className="text-xs"
                data-testid={`quick-reply-${reply.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {reply}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!newMessage.trim() || isSending}
              size="icon"
              data-testid="button-send-message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
