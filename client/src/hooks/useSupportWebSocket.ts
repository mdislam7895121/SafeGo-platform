import { useEffect, useRef, useState, useCallback } from "react";

interface MessageData {
  conversationId: string;
  sender: { userId: string; userType: string; userName?: string };
  content: string;
  timestamp: string;
}

interface ErrorData {
  message: string;
}

interface JoinedData {
  conversationId: string;
}

interface UseSupportWebSocketOptions {
  token: string | null;
  onMessage: (data: MessageData) => void;
  onError?: (error: ErrorData) => void;
}

export function useSupportWebSocket({
  token,
  onMessage,
  onError,
}: UseSupportWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const joinedConversationsRef = useRef<Set<string>>(new Set());

  const connect = useCallback(() => {
    if (!token) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/support/ws?token=${encodeURIComponent(token)}`;
      
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("[WebSocket] Connected to support chat");
        setIsConnected(true);
        
        // Clear any pending reconnect timeout to prevent duplicate connections
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
        
        // Rejoin all previously joined conversations using current ref value
        joinedConversationsRef.current.forEach((conversationId) => {
          socket.send(JSON.stringify({
            type: "join",
            conversationId,
          }));
        });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "message":
              onMessage(data);
              break;
            case "joined":
              console.log(`[WebSocket] Joined conversation: ${data.conversationId}`);
              joinedConversationsRef.current.add(data.conversationId);
              break;
            case "error":
              console.error("[WebSocket] Error:", data.message);
              if (onError) onError(data);
              break;
            default:
              console.log("[WebSocket] Unknown message type:", data.type);
          }
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("[WebSocket] Connection error:", error);
        setIsConnected(false);
      };

      socket.onclose = () => {
        console.log("[WebSocket] Disconnected");
        setIsConnected(false);
        
        // Attempt reconnection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[WebSocket] Attempting to reconnect...");
          connect();
        }, 3000);
      };

      ws.current = socket;
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
    }
  }, [token, onMessage, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
    joinedConversationsRef.current.clear();
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "join",
        conversationId,
      }));
    }
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "message",
        conversationId,
        content,
      }));
    } else {
      console.error("[WebSocket] Cannot send message: not connected");
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    joinConversation,
    sendMessage,
    disconnect,
  };
}
