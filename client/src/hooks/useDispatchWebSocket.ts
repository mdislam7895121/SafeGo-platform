/**
 * SafeGo Dispatch WebSocket Hook
 * Phase 1A+1B: Real-time dispatch, ETA, route tracking, and chat
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

// Phase 1B: Live tracking types
export interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  sampleId?: string;
}

export interface EtaUpdate {
  phase: 'to_pickup' | 'to_dropoff';
  etaSeconds: number;
  distanceMeters: number;
}

export interface ChatMessage {
  id: string;
  senderRole: 'customer' | 'driver' | 'restaurant' | 'admin';
  senderId: string;
  text: string;
  sentAt: string;
  readAt?: string;
}

export interface TripState {
  rideId?: string;
  status?: string;
  driverLocation?: DriverLocation;
  etaToPickup?: number;
  etaToDropoff?: number;
  distanceMeters?: number;
  finalFare?: number;
  fareBreakdown?: Record<string, number>;
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
  // Phase 1B: Live trip tracking
  trip?: TripState;
  // Phase 1B: Chat
  messages?: ChatMessage[];
  unreadCount?: number;
  conversationId?: string;
  error?: string;
}

interface UseDispatchWebSocketOptions {
  token: string;
  onDriverAssigned?: (driver: DispatchDriver) => void;
  onNoDriversFound?: () => void;
  onRideOffer?: (offer: RideOffer) => void;
  onOfferCancelled?: () => void;
  onError?: (error: string) => void;
  // Phase 1B: Live trip tracking callbacks
  onDriverArrived?: (rideId: string) => void;
  onTripStarted?: (rideId: string, etaToDropoff?: number) => void;
  onTripCompleted?: (rideId: string, finalFare?: number) => void;
  onRouteUpdate?: (location: DriverLocation) => void;
  onEtaUpdate?: (eta: EtaUpdate) => void;
  onFareFinalized?: (rideId: string, originalFare: number, finalFare: number) => void;
  // Phase 1B: Chat callbacks
  onNewMessage?: (message: ChatMessage) => void;
}

export function useDispatchWebSocket(options: UseDispatchWebSocketOptions) {
  const { 
    token, 
    onDriverAssigned, 
    onNoDriversFound, 
    onRideOffer, 
    onOfferCancelled, 
    onError,
    // Phase 1B callbacks
    onDriverArrived,
    onTripStarted,
    onTripCompleted,
    onRouteUpdate,
    onEtaUpdate,
    onFareFinalized,
    onNewMessage,
  } = options;
  
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

      // Phase 1B: Trip lifecycle events
      case 'ride:driver_arrived':
        setState(prev => ({
          ...prev,
          trip: {
            ...prev.trip,
            rideId: payload.rideId as string,
            status: payload.status as string,
          },
        }));
        onDriverArrived?.(payload.rideId as string);
        break;

      case 'ride:trip_started':
        setState(prev => ({
          ...prev,
          trip: {
            ...prev.trip,
            rideId: payload.rideId as string,
            status: 'in_progress',
            etaToDropoff: payload.etaToDropoffSeconds as number | undefined,
          },
        }));
        onTripStarted?.(payload.rideId as string, payload.etaToDropoffSeconds as number | undefined);
        break;

      case 'ride:trip_completed':
        setState(prev => ({
          ...prev,
          trip: {
            ...prev.trip,
            rideId: payload.rideId as string,
            status: 'completed',
            finalFare: payload.finalFare as number | undefined,
            fareBreakdown: payload.breakdown as Record<string, number> | undefined,
          },
        }));
        onTripCompleted?.(payload.rideId as string, payload.finalFare as number | undefined);
        break;

      case 'ride:route_update':
        const location: DriverLocation = {
          lat: payload.driverLat as number,
          lng: payload.driverLng as number,
          heading: payload.heading as number | undefined,
          speed: payload.speed as number | undefined,
          sampleId: payload.sampleId as string | undefined,
        };
        setState(prev => ({
          ...prev,
          trip: {
            ...prev.trip,
            rideId: payload.rideId as string,
            driverLocation: location,
          },
        }));
        onRouteUpdate?.(location);
        break;

      case 'ride:eta_update':
        const eta: EtaUpdate = {
          phase: payload.phase as 'to_pickup' | 'to_dropoff',
          etaSeconds: payload.etaSeconds as number,
          distanceMeters: payload.distanceMeters as number,
        };
        setState(prev => ({
          ...prev,
          trip: {
            ...prev.trip,
            rideId: payload.rideId as string,
            ...(eta.phase === 'to_pickup' 
              ? { etaToPickup: eta.etaSeconds } 
              : { etaToDropoff: eta.etaSeconds }),
            distanceMeters: eta.distanceMeters,
          },
        }));
        onEtaUpdate?.(eta);
        break;

      case 'ride:fare_finalized':
        setState(prev => ({
          ...prev,
          trip: {
            ...prev.trip,
            rideId: payload.rideId as string,
            finalFare: payload.finalFare as number,
            fareBreakdown: payload.breakdown as Record<string, number> | undefined,
          },
        }));
        onFareFinalized?.(
          payload.rideId as string,
          payload.originalFare as number,
          payload.finalFare as number
        );
        break;

      // Phase 1B: Chat events
      case 'chat:message_new':
        const newMessage = payload.message as ChatMessage;
        setState(prev => ({
          ...prev,
          conversationId: payload.conversationId as string,
          messages: [...(prev.messages || []), newMessage],
          unreadCount: (prev.unreadCount || 0) + 1,
        }));
        onNewMessage?.(newMessage);
        break;

      case 'chat:message_sent':
        const sentMessage = payload.message as ChatMessage;
        setState(prev => ({
          ...prev,
          messages: [...(prev.messages || []), sentMessage],
        }));
        break;

      case 'chat:marked_read':
        setState(prev => ({
          ...prev,
          unreadCount: 0,
        }));
        break;

      // Driver-side confirmations
      case 'driver:arrived_confirmed':
      case 'driver:trip_started_confirmed':
      case 'driver:trip_ended_confirmed':
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          error: payload.message as string,
        }));
        onError?.(payload.message as string);
        break;
    }
  }, [
    onDriverAssigned, 
    onNoDriversFound, 
    onRideOffer, 
    onOfferCancelled, 
    onError,
    onDriverArrived,
    onTripStarted,
    onTripCompleted,
    onRouteUpdate,
    onEtaUpdate,
    onFareFinalized,
    onNewMessage,
  ]);

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

  // Phase 1B: Driver trip lifecycle actions
  const markArrived = useCallback((rideId: string) => {
    send('driver:mark_arrived', { rideId });
  }, [send]);

  const startTrip = useCallback((rideId: string) => {
    send('driver:start_trip', { rideId });
  }, [send]);

  const endTrip = useCallback((rideId: string) => {
    send('driver:end_trip', { rideId });
  }, [send]);

  const updateTripLocation = useCallback((
    rideId: string,
    lat: number,
    lng: number,
    heading?: number,
    speed?: number
  ) => {
    send('driver:trip_location_update', { rideId, lat, lng, heading, speed });
  }, [send]);

  // Phase 1B: Chat actions
  const sendChatMessage = useCallback((
    text: string,
    conversationId?: string,
    entityId?: string,
    serviceType?: 'ride' | 'food' | 'parcel'
  ) => {
    send('chat:send_message', { text, conversationId, entityId, serviceType });
  }, [send]);

  const markMessagesRead = useCallback((conversationId: string) => {
    send('chat:mark_read', { conversationId });
  }, [send]);

  // Reset trip state
  const resetTrip = useCallback(() => {
    setState(prev => ({
      ...prev,
      trip: undefined,
      messages: undefined,
      unreadCount: undefined,
      conversationId: undefined,
    }));
  }, []);

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
    // Phase 1B: Trip lifecycle
    markArrived,
    startTrip,
    endTrip,
    updateTripLocation,
    // Phase 1B: Chat
    sendChatMessage,
    markMessagesRead,
    resetTrip,
  };
}
