import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MessageCircle, Send, X, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "customer" | "driver";
  message: string;
  messageType: string;
  createdAt: string;
  isRead?: boolean;
}

interface DriverInfo {
  name: string;
  avatarInitials: string;
}

interface RideChatDrawerProps {
  driverInfo: DriverInfo | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  isConnected: boolean;
  isDriverTyping: boolean;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onMarkAsRead: () => void;
}

const quickMessages = [
  "I'm on my way",
  "I'll be there in 2 minutes",
  "Where are you?",
  "Please wait, coming now",
];

export function RideChatDrawer({
  driverInfo,
  isOpen,
  onOpenChange,
  messages,
  isConnected,
  isDriverTyping,
  onSendMessage,
  onTyping,
  onMarkAsRead,
}: RideChatDrawerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      onMarkAsRead();
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, onMarkAsRead, scrollToBottom]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, isOpen, scrollToBottom]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !isConnected) return;
    
    setIsSending(true);
    onSendMessage(inputValue.trim());
    setInputValue("");
    setIsSending(false);
  };

  const handleQuickMessage = (text: string) => {
    if (!isConnected) return;
    onSendMessage(text);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onTyping(true);
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "h:mm a");
    } catch {
      return "";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[70vh] p-0 rounded-t-2xl flex flex-col"
        data-testid="sheet-chat"
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  {driverInfo?.avatarInitials || "DR"}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-left text-base" data-testid="text-chat-driver-name">
                  {driverInfo?.name || "Driver"}
                </SheetTitle>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                    data-testid="indicator-connection-status"
                  />
                  <span className="text-xs text-muted-foreground">
                    {isConnected ? "Online" : "Connecting..."}
                  </span>
                </div>
              </div>
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
        </SheetHeader>

        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Send a message to your driver</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderRole === "customer" ? "justify-end" : "justify-start"
                  }`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.senderRole === "customer"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm break-words">{msg.message}</p>
                    <div
                      className={`flex items-center gap-1 mt-1 ${
                        msg.senderRole === "customer" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span
                        className={`text-[10px] ${
                          msg.senderRole === "customer"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                      {msg.senderRole === "customer" && (
                        msg.isRead ? (
                          <CheckCheck className="h-3 w-3 text-primary-foreground/70" data-testid="icon-read-receipt-double" />
                        ) : (
                          <Check className="h-3 w-3 text-primary-foreground/70" data-testid="icon-read-receipt-single" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {isDriverTyping && (
              <div className="flex justify-start" data-testid="typing-indicator">
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
          <div className="flex flex-wrap gap-2">
            {quickMessages.map((msg) => (
              <Button
                key={msg}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleQuickMessage(msg)}
                disabled={!isConnected || isSending}
                data-testid={`button-quick-${msg.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {msg}
              </Button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1"
              disabled={!isConnected}
              maxLength={500}
              data-testid="input-chat-message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || !isConnected || isSending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
