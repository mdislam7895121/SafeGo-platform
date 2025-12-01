/**
 * SafeGo Dispatch WebSocket Hook
 * Phase 1A: Real-time dispatch communication for customers and drivers
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type DispatchStatus = 
  | 'requested'
  | 'searching_driver'
  | 'offer_pending'
  | 'driver_accepted'
  | 'no_driver_found'
  | 'cancelled_by_customer'
  | 'cancelled_by_admin'
  | 'expired';

export interface DispatchDriver {
  id: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl?: string;
  phone?: string;
  vehicle?: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
    vehicleCategory?: string;
  };
}

export interface RideOffer {
  sessionId: string;
  offerId: string;
  expiresAt: string;
  pickup: {
    lat: number;
    lng: number;
    address: string;
  };
  dropoff: {
    lat: number;
    lng: number;
    address: string;
  };
  serviceType: string;
  customer: {
    firstName: string;
    lastName: string;
  };
}

export interface DispatchState {
  isConnected: boolean;
  sessionId?: string;
  status?: DispatchStatus;
  assignedDriver?: DispatchDriver;
  currentOffer?: RideOffer;
  offerProgress?: {
    driverIndex: number;
    totalCandidates: number;
  };
  error?: string;
}

interface UseDispatchWebSocketOptions {
  token: string;
  onDriverAssigned?: (driver: DispatchDriver) => void;
  onNoDriversFound?: () => void;
  onRideOffer?: (offer: RideOffer) => void;
  onOfferCancelled?: () => void;
  onError?: (error: string) => void;
}

export function useDispatchWebSocket(options: UseDispatchWebSocketOptions) {
  const { token, onDriverAssigned, onNoDriversFound, onRideOffer, onOfferCancelled, onError } = options;
  
  const [state, setState] = useState<DispatchState>({
    isConnected: false,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/dispatch/ws?token=${encodeURIComponent(token)}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true, error: undefined }));
      
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', payload: {} }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, isConnected: false }));
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setState(prev => ({ ...prev, error: 'Connection error' }));
      onError?.('Connection error');
    };
  }, [token, onError]);

  const handleMessage = useCallback((message: { type: string; payload: Record<string, unknown> }) => {
    const { type, payload } = message;

    switch (type) {
      case 'connected':
        break;

      case 'dispatch:session_started':
        setState(prev => ({
          ...prev,
          sessionId: payload.sessionId as string,
          status: payload.status as DispatchStatus,
        }));
        break;

      case 'dispatch:offer_sent':
        setState(prev => ({
          ...prev,
          status: 'offer_pending',
          offerProgress: {
            driverIndex: payload.driverIndex as number,
            totalCandidates: payload.totalCandidates as number,
          },
        }));
        break;

      case 'dispatch:driver_assigned':
        const driver = payload.driver as DispatchDriver;
        setState(prev => ({
          ...prev,
          status: 'driver_accepted',
          assignedDriver: driver,
        }));
        onDriverAssigned?.(driver);
        break;

      case 'dispatch:no_drivers_found':
        setState(prev => ({
          ...prev,
          status: 'no_driver_found',
        }));
        onNoDriversFound?.();
        break;

      case 'driver:ride_offer':
        const offer: RideOffer = {
          sessionId: payload.sessionId as string,
          offerId: payload.offerId as string,
          expiresAt: payload.expiresAt as string,
          pickup: payload.pickup as RideOffer['pickup'],
          dropoff: payload.dropoff as RideOffer['dropoff'],
          serviceType: payload.serviceType as string,
          customer: payload.customer as RideOffer['customer'],
        };
        setState(prev => ({
          ...prev,
          currentOffer: offer,
        }));
        onRideOffer?.(offer);
        break;

      case 'driver:offer_accepted':
        setState(prev => ({
          ...prev,
          currentOffer: undefined,
        }));
        break;

      case 'driver:offer_rejected_confirmed':
        setState(prev => ({
          ...prev,
          currentOffer: undefined,
        }));
        break;

      case 'driver:offer_cancelled':
        setState(prev => ({
          ...prev,
          currentOffer: undefined,
        }));
        onOfferCancelled?.();
        break;

      case 'driver:online_confirmed':
        break;

      case 'driver:offline_confirmed':
        break;

      case 'customer:session_subscribed':
        setState(prev => ({
          ...prev,
          sessionId: payload.sessionId as string,
          status: payload.status as DispatchStatus,
          assignedDriver: payload.assignedDriver as DispatchDriver | undefined,
        }));
        break;

      case 'customer:dispatch_cancelled':
        setState(prev => ({
          ...prev,
          status: 'cancelled_by_customer',
        }));
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          error: payload.message as string,
        }));
        onError?.(payload.message as string);
        break;
    }
  }, [onDriverAssigned, onNoDriversFound, onRideOffer, onOfferCancelled, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState({ isConnected: false });
  }, []);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const goOnline = useCallback((serviceMode: string, lat?: number, lng?: number, countryCode?: string) => {
    send('driver:go_online', { serviceMode, lat, lng, countryCode });
  }, [send]);

  const goOffline = useCallback(() => {
    send('driver:go_offline', {});
  }, [send]);

  const updateLocation = useCallback((lat: number, lng: number, countryCode?: string, cityCode?: string) => {
    send('driver:update_location', { lat, lng, countryCode, cityCode });
  }, [send]);

  const acceptOffer = useCallback((sessionId: string) => {
    send('driver:accept_offer', { sessionId });
  }, [send]);

  const rejectOffer = useCallback((sessionId: string, reason?: string) => {
    send('driver:reject_offer', { sessionId, reason });
  }, [send]);

  const subscribeToSession = useCallback((sessionId: string) => {
    send('customer:subscribe_session', { sessionId });
  }, [send]);

  const cancelDispatch = useCallback((sessionId: string) => {
    send('customer:cancel_dispatch', { sessionId });
  }, [send]);

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    goOnline,
    goOffline,
    updateLocation,
    acceptOffer,
    rejectOffer,
    subscribeToSession,
    cancelDispatch,
  };
}
