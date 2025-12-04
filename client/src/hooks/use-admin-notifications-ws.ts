import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface NotificationEvent {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string | null;
  countryCode: string | null;
  actorId: string | null;
  actorEmail: string | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface WsMessage {
  type: 'notification' | 'notification_read' | 'notification_count' | 'connected' | 'error';
  payload: any;
}

interface UseAdminNotificationsWsOptions {
  onNotification?: (notification: NotificationEvent) => void;
  onUnreadCountChange?: (count: number) => void;
  enabled?: boolean;
}

export function useAdminNotificationsWs(options: UseAdminNotificationsWsOptions = {}) {
  const { onNotification, onUnreadCountChange, enabled = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const { data: authData } = useQuery<{ token?: string }>({
    queryKey: ['/api/auth/token'],
    enabled: false,
    staleTime: Infinity,
  });

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || !enabled) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/admin/notifications/ws?token=${encodeURIComponent(token)}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        console.log('[AdminNotificationsWS] Connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'notification':
              queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
              if (onNotification) {
                onNotification(message.payload as NotificationEvent);
              }
              break;

            case 'notification_read':
              if (message.payload.success) {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications/unread-count'] });
              }
              break;

            case 'notification_count':
              queryClient.setQueryData(['/api/admin/notifications/unread-count'], { count: message.payload.count });
              if (onUnreadCountChange) {
                onUnreadCountChange(message.payload.count);
              }
              break;

            case 'connected':
              console.log('[AdminNotificationsWS] Authenticated:', message.payload);
              break;

            case 'error':
              console.error('[AdminNotificationsWS] Error:', message.payload.message);
              setConnectionError(message.payload.message);
              break;
          }
        } catch (error) {
          console.error('[AdminNotificationsWS] Failed to parse message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log('[AdminNotificationsWS] Disconnected:', event.code, event.reason);
        
        if (enabled && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[AdminNotificationsWS] Attempting reconnect...');
            connect();
          }, 5000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[AdminNotificationsWS] WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };

    } catch (error) {
      console.error('[AdminNotificationsWS] Failed to create WebSocket:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [enabled, onNotification, onUnreadCountChange, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting');
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_read',
        payload: { notificationId },
      }));
    }
  }, []);

  const refreshUnreadCount = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'get_unread_count',
        payload: {},
      }));
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    markAsRead,
    refreshUnreadCount,
    reconnect: connect,
  };
}
