import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "customer" | "driver";
  message: string;
  messageType: string;
  createdAt: string;
  isRead?: boolean;
}

interface UseRideChatOptions {
  rideId: string | null;
  isActive: boolean;
  isDrawerOpen: boolean;
  onNewDriverMessage?: (message: ChatMessage) => void;
}

interface UseRideChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  isDriverTyping: boolean;
  unreadCount: number;
  sendMessage: (text: string, messageType?: string) => void;
  sendTypingIndicator: (isTyping: boolean) => void;
  markAsRead: () => void;
  clearUnread: () => void;
}

export function useRideChat({
  rideId,
  isActive,
  isDrawerOpen,
  onNewDriverMessage,
}: UseRideChatOptions): UseRideChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDriverTyping, setIsDriverTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onNewDriverMessageRef = useRef(onNewDriverMessage);
  const isDrawerOpenRef = useRef(isDrawerOpen);

  useEffect(() => {
    onNewDriverMessageRef.current = onNewDriverMessage;
  }, [onNewDriverMessage]);
  
  useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  const fetchMessages = useCallback(async () => {
    if (!rideId) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/rides/${rideId}/chat`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        const unread = (data.messages || []).filter(
          (m: ChatMessage) => m.senderRole === "driver" && !m.isRead
        ).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("[useRideChat] Failed to fetch messages:", error);
    }
  }, [rideId]);

  useEffect(() => {
    if (!isActive || !rideId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setMessages([]);
      setUnreadCount(0);
      return;
    }

    fetchMessages();

    const token = localStorage.getItem("token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/rides/chat/ws?token=${token}&rideId=${rideId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          const newMessage = data.payload as ChatMessage;
          setMessages((prev) => [...prev, newMessage]);

          if (newMessage.senderRole === "driver") {
            if (isDrawerOpenRef.current) {
              // Drawer is open - mark as read immediately
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "mark_read", payload: {} }));
              }
            } else {
              // Drawer is closed - increment unread and notify
              setUnreadCount((prev) => prev + 1);
              onNewDriverMessageRef.current?.(newMessage);
            }
          }
        } else if (data.type === "typing") {
          if (data.payload.userType === "driver") {
            setIsDriverTyping(data.payload.isTyping);
          }
        } else if (data.type === "messages_read") {
          if (data.payload.readBy === "driver") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.senderRole === "customer" ? { ...msg, isRead: true } : msg
              )
            );
          }
        }
      } catch (error) {
        console.error("[useRideChat] Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("[useRideChat] WebSocket error:", error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isActive, rideId, fetchMessages]);

  const sendMessage = useCallback((text: string, messageType = "text") => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "send_message",
        payload: {
          message: text.trim(),
          messageType,
        },
      })
    );
  }, []);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "typing",
        payload: { isTyping },
      })
    );

    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "typing",
              payload: { isTyping: false },
            })
          );
        }
      }, 2000);
    }
  }, []);

  const markAsRead = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "mark_read", payload: {} }));
    setUnreadCount(0);
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    messages,
    isConnected,
    isDriverTyping,
    unreadCount,
    sendMessage,
    sendTypingIndicator,
    markAsRead,
    clearUnread,
  };
}
