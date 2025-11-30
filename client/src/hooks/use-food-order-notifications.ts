import { useEffect, useRef, useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OrderStatusUpdate {
  orderId: string;
  status: string;
  restaurantName?: string;
  driverName?: string;
  estimatedDeliveryTime?: string;
  driverLocation?: { lat: number; lng: number };
  timestamp: string;
}

interface Notification {
  type: string;
  orderId: string;
  title: string;
  body: string;
  status?: string;
  timestamp: string;
}

interface UseFoodOrderNotificationsOptions {
  orderId?: string;
  enabled?: boolean;
  onStatusUpdate?: (update: OrderStatusUpdate) => void;
  onNotification?: (notification: Notification) => void;
}

export function useFoodOrderNotifications({
  orderId,
  enabled = true,
  onStatusUpdate,
  onNotification,
}: UseFoodOrderNotificationsOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<OrderStatusUpdate | null>(null);
  const { toast } = useToast();

  const getToken = useCallback(() => {
    return localStorage.getItem("auth_token");
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token || !enabled) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    let url = `${protocol}//${host}/api/food-orders/notifications/ws?token=${encodeURIComponent(token)}`;
    
    if (orderId) {
      url += `&orderId=${encodeURIComponent(orderId)}`;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log("[FoodOrderNotifications] WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "connected":
              console.log("[FoodOrderNotifications] Connected:", data.payload);
              break;
              
            case "order_status_update":
              setLastUpdate(data.payload);
              onStatusUpdate?.(data.payload);
              break;
              
            case "notification":
              onNotification?.(data.payload);
              toast({
                title: data.payload.title,
                description: data.payload.body,
              });
              break;
              
            case "error":
              console.error("[FoodOrderNotifications] Error:", data.payload);
              break;
              
            case "pong":
              break;
              
            default:
              console.log("[FoodOrderNotifications] Unknown message:", data);
          }
        } catch (error) {
          console.error("[FoodOrderNotifications] Failed to parse message:", error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        console.log("[FoodOrderNotifications] WebSocket closed:", event.code, event.reason);
        
        if (enabled && !event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[FoodOrderNotifications] Attempting to reconnect...");
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error("[FoodOrderNotifications] WebSocket error:", error);
      };
    } catch (error) {
      console.error("[FoodOrderNotifications] Failed to create WebSocket:", error);
    }
  }, [enabled, orderId, getToken, onStatusUpdate, onNotification, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [isConnected]);

  return {
    isConnected,
    lastUpdate,
    connect,
    disconnect,
  };
}
