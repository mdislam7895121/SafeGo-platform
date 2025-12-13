/**
 * SafeGo WebSocket Dispatch Hub
 * Phase 1A+1B: Real-time dispatch, ETA, route tracking, and chat
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { dispatchService } from '../services/dispatchService';
import { driverRealtimeStateService } from '../services/driverRealtimeStateService';
import { routingService } from '../services/routingService';
import { rideTelemetryService } from '../services/rideTelemetryService';
import { chatService } from '../services/chatService';
import { statusTransitionService } from '../services/statusTransitionService';
import { fareRecalculationService } from '../services/fareRecalculationService';
import { getDispatchFeatureConfig } from '../config/dispatchFeatures';
import { DispatchServiceMode } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('[Dispatch WebSocket] WARNING: JWT_SECRET not set, WebSocket authentication will fail');
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  profileId?: string;
  isAlive?: boolean;
  rooms?: Set<string>;
}

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
}

const customerConnections = new Map<string, AuthenticatedWebSocket>();
const driverConnections = new Map<string, AuthenticatedWebSocket>();
const sessionRooms = new Map<string, Set<AuthenticatedWebSocket>>();
const offerTimers = new Map<string, NodeJS.Timeout>();

let dispatchWssInstance: WebSocketServer | null = null;
const MAX_CONNECTIONS = 500;

export function setupDispatchWebSocket(server: HTTPServer) {
  if (dispatchWssInstance) {
    console.log('[Dispatch WebSocket] Already initialized, skipping duplicate setup');
    return;
  }
  
  const wss = new WebSocketServer({ server, path: '/api/dispatch/ws' });
  dispatchWssInstance = wss;

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    if (wss.clients.size > MAX_CONNECTIONS) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Server at capacity, try again later' } }));
      ws.close();
      return;
    }
    
    ws.isAlive = true;
    ws.rooms = new Set();

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'No token provided' } }));
      ws.close();
      return;
    }

    if (!JWT_SECRET) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Server configuration error' } }));
      ws.close();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
      ws.userId = decoded.id;
      ws.userRole = decoded.role;
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid token' } }));
      ws.close();
      return;
    }

    if (ws.userRole === 'customer') {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId: ws.userId },
        select: { id: true },
      });
      if (!profile) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Customer profile not found' } }));
        ws.close();
        return;
      }
      ws.profileId = profile.id;
      customerConnections.set(profile.id, ws);
    } else if (ws.userRole === 'driver') {
      const profile = await prisma.driverProfile.findUnique({
        where: { userId: ws.userId },
        select: { id: true, isVerified: true },
      });
      if (!profile) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Driver profile not found' } }));
        ws.close();
        return;
      }
      if (!profile.isVerified) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Driver not verified' } }));
        ws.close();
        return;
      }
      ws.profileId = profile.id;
      driverConnections.set(profile.id, ws);
    } else {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid role' } }));
      ws.close();
      return;
    }

    ws.send(JSON.stringify({
      type: 'connected',
      payload: { role: ws.userRole, profileId: ws.profileId },
    }));

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        handleDisconnect(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
    offerTimers.forEach((timer) => clearTimeout(timer));
    offerTimers.clear();
  });

  console.log('Dispatch WebSocket server initialized at /api/dispatch/ws');
}

async function handleMessage(ws: AuthenticatedWebSocket, message: WsMessage) {
  const { type, payload } = message;

  switch (type) {
    case 'driver:go_online':
      await handleDriverGoOnline(ws, payload);
      break;
    case 'driver:go_offline':
      await handleDriverGoOffline(ws);
      break;
    case 'driver:update_location':
      await handleDriverLocationUpdate(ws, payload);
      break;
    case 'driver:accept_offer':
      await handleDriverAcceptOffer(ws, payload);
      break;
    case 'driver:reject_offer':
      await handleDriverRejectOffer(ws, payload);
      break;
    case 'customer:subscribe_session':
      await handleCustomerSubscribeSession(ws, payload);
      break;
    case 'customer:cancel_dispatch':
      await handleCustomerCancelDispatch(ws, payload);
      break;
    // Phase 1B: Driver trip lifecycle
    case 'driver:mark_arrived':
      await handleDriverMarkArrived(ws, payload);
      break;
    case 'driver:start_trip':
      await handleDriverStartTrip(ws, payload);
      break;
    case 'driver:end_trip':
      await handleDriverEndTrip(ws, payload);
      break;
    case 'driver:trip_location_update':
      await handleDriverTripLocationUpdate(ws, payload);
      break;
    // Phase 1B: Chat
    case 'chat:send_message':
      await handleChatSendMessage(ws, payload);
      break;
    case 'chat:mark_read':
      await handleChatMarkRead(ws, payload);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Unknown message type' } }));
  }
}

async function handleDriverGoOnline(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { serviceMode, lat, lng, countryCode, cityCode } = payload as {
    serviceMode?: string;
    lat?: number;
    lng?: number;
    countryCode?: string;
    cityCode?: string;
  };

  const mode = (serviceMode as DispatchServiceMode) || DispatchServiceMode.ride;

  await driverRealtimeStateService.setDriverOnline(
    ws.profileId,
    mode,
    lat,
    lng,
    countryCode,
    cityCode
  );

  ws.send(JSON.stringify({
    type: 'driver:online_confirmed',
    payload: { serviceMode: mode },
  }));
}

async function handleDriverGoOffline(ws: AuthenticatedWebSocket) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  await driverRealtimeStateService.setDriverOffline(ws.profileId);

  ws.send(JSON.stringify({
    type: 'driver:offline_confirmed',
    payload: {},
  }));
}

async function handleDriverLocationUpdate(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { lat, lng, countryCode, cityCode } = payload as {
    lat: number;
    lng: number;
    countryCode?: string;
    cityCode?: string;
  };

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid coordinates' } }));
    return;
  }

  await driverRealtimeStateService.updateDriverLocation({
    driverId: ws.profileId,
    lat,
    lng,
    countryCode,
    cityCode,
  });
}

async function handleDriverAcceptOffer(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { sessionId } = payload as { sessionId: string };

  if (!sessionId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session ID required' } }));
    return;
  }

  const timerKey = `${sessionId}:${ws.profileId}`;
  const timer = offerTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    offerTimers.delete(timerKey);
  }

  const result = await dispatchService.handleDriverAccept(sessionId, ws.profileId);

  if (result.success) {
    ws.send(JSON.stringify({
      type: 'driver:offer_accepted',
      payload: { sessionId },
    }));

    const session = await dispatchService.getDispatchSession(sessionId);
    if (session) {
      broadcastToSession(sessionId, {
        type: 'dispatch:driver_assigned',
        payload: {
          sessionId,
          driver: session.assignedDriver,
        },
      });

      const customerWs = customerConnections.get(session.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(JSON.stringify({
          type: 'dispatch:driver_assigned',
          payload: {
            sessionId,
            driver: session.assignedDriver,
            status: 'driver_accepted',
          },
        }));
      }
    }
  } else {
    ws.send(JSON.stringify({
      type: 'driver:offer_accept_failed',
      payload: { sessionId, error: result.error },
    }));
  }
}

async function handleDriverRejectOffer(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { sessionId, reason } = payload as { sessionId: string; reason?: string };

  if (!sessionId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session ID required' } }));
    return;
  }

  const timerKey = `${sessionId}:${ws.profileId}`;
  const timer = offerTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    offerTimers.delete(timerKey);
  }

  const result = await dispatchService.handleDriverReject(sessionId, ws.profileId, reason);

  ws.send(JSON.stringify({
    type: 'driver:offer_rejected_confirmed',
    payload: { sessionId },
  }));

  if (result.nextOfferId) {
    await sendOfferToDriver(sessionId);
  } else {
    const session = await dispatchService.getDispatchSession(sessionId);
    if (session && session.status === 'no_driver_found') {
      const customerWs = customerConnections.get(session.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(JSON.stringify({
          type: 'dispatch:no_drivers_found',
          payload: { sessionId },
        }));
      }
    }
  }
}

async function handleCustomerSubscribeSession(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'customer' || !ws.profileId) return;

  const { sessionId } = payload as { sessionId: string };

  if (!sessionId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session ID required' } }));
    return;
  }

  const session = await dispatchService.getDispatchSession(sessionId);
  if (!session || session.customerId !== ws.profileId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session not found or unauthorized' } }));
    return;
  }

  if (!sessionRooms.has(sessionId)) {
    sessionRooms.set(sessionId, new Set());
  }
  sessionRooms.get(sessionId)!.add(ws);
  ws.rooms?.add(sessionId);

  ws.send(JSON.stringify({
    type: 'customer:session_subscribed',
    payload: {
      sessionId,
      status: session.status,
      assignedDriver: session.assignedDriver,
    },
  }));
}

async function handleCustomerCancelDispatch(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'customer' || !ws.profileId) return;

  const { sessionId } = payload as { sessionId: string };

  if (!sessionId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session ID required' } }));
    return;
  }

  const session = await dispatchService.getDispatchSession(sessionId);
  if (!session || session.customerId !== ws.profileId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session not found or unauthorized' } }));
    return;
  }

  await dispatchService.cancelDispatchSession(sessionId, 'customer');

  ws.send(JSON.stringify({
    type: 'customer:dispatch_cancelled',
    payload: { sessionId },
  }));

  if (session.currentOfferDriverId) {
    const driverWs = driverConnections.get(session.currentOfferDriverId);
    if (driverWs && driverWs.readyState === WebSocket.OPEN) {
      driverWs.send(JSON.stringify({
        type: 'driver:offer_cancelled',
        payload: { sessionId },
      }));
    }
  }
}

function handleDisconnect(ws: AuthenticatedWebSocket) {
  if (ws.userRole === 'customer' && ws.profileId) {
    customerConnections.delete(ws.profileId);
  } else if (ws.userRole === 'driver' && ws.profileId) {
    driverConnections.delete(ws.profileId);
    driverRealtimeStateService.setDriverOffline(ws.profileId).catch(console.error);
  }

  ws.rooms?.forEach((room) => {
    const roomSet = sessionRooms.get(room);
    if (roomSet) {
      roomSet.delete(ws);
      if (roomSet.size === 0) {
        sessionRooms.delete(room);
      }
    }
  });
}

function broadcastToSession(sessionId: string, message: WsMessage) {
  const room = sessionRooms.get(sessionId);
  if (!room) return;

  const data = JSON.stringify(message);
  room.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

export async function startDispatchSession(
  sessionId: string
): Promise<void> {
  const session = await dispatchService.getDispatchSession(sessionId);
  if (!session) return;

  const customerWs = customerConnections.get(session.customerId);
  if (customerWs && customerWs.readyState === WebSocket.OPEN) {
    customerWs.send(JSON.stringify({
      type: 'dispatch:session_started',
      payload: {
        sessionId,
        status: session.status,
        candidateCount: session.candidateDriverIds.length,
      },
    }));
  }

  if (session.candidateDriverIds.length > 0) {
    await sendOfferToDriver(sessionId);
  }
}

async function sendOfferToDriver(sessionId: string): Promise<void> {
  const result = await dispatchService.sendOfferToNextDriver(sessionId);

  if (!result.success || !result.driverId) {
    const session = await dispatchService.getDispatchSession(sessionId);
    if (session) {
      const customerWs = customerConnections.get(session.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(JSON.stringify({
          type: 'dispatch:no_drivers_found',
          payload: { sessionId },
        }));
      }
    }
    return;
  }

  const session = await dispatchService.getDispatchSession(sessionId);
  if (!session) return;

  const driverWs = driverConnections.get(result.driverId);
  if (driverWs && driverWs.readyState === WebSocket.OPEN) {
    driverWs.send(JSON.stringify({
      type: 'driver:ride_offer',
      payload: {
        sessionId,
        offerId: result.offerId,
        expiresAt: result.expiresAt?.toISOString(),
        pickup: {
          lat: session.pickupLat,
          lng: session.pickupLng,
          address: session.pickupAddress,
        },
        dropoff: {
          lat: session.dropoffLat,
          lng: session.dropoffLng,
          address: session.dropoffAddress,
        },
        serviceType: session.serviceType,
        customer: {
          name: session.customer.fullName || 'Customer',
        },
      },
    }));

    const customerWs = customerConnections.get(session.customerId);
    if (customerWs && customerWs.readyState === WebSocket.OPEN) {
      customerWs.send(JSON.stringify({
        type: 'dispatch:offer_sent',
        payload: {
          sessionId,
          driverIndex: session.rejectedDriverIds.length + session.expiredDriverIds.length + 1,
          totalCandidates: session.candidateDriverIds.length,
        },
      }));
    }

    if (result.expiresAt && result.offerId) {
      const timerKey = `${sessionId}:${result.driverId}`;
      const timeoutMs = result.expiresAt.getTime() - Date.now();
      
      const timer = setTimeout(async () => {
        offerTimers.delete(timerKey);
        const expireResult = await dispatchService.handleOfferExpired(sessionId, result.offerId!);
        
        if (expireResult.nextOfferId) {
          await sendOfferToDriver(sessionId);
        } else {
          const updatedSession = await dispatchService.getDispatchSession(sessionId);
          if (updatedSession && updatedSession.status === 'no_driver_found') {
            const custWs = customerConnections.get(updatedSession.customerId);
            if (custWs && custWs.readyState === WebSocket.OPEN) {
              custWs.send(JSON.stringify({
                type: 'dispatch:no_drivers_found',
                payload: { sessionId },
              }));
            }
          }
        }
      }, Math.max(0, timeoutMs));
      
      offerTimers.set(timerKey, timer);
    }
  } else {
    await dispatchService.handleOfferExpired(sessionId, result.offerId!);
    await sendOfferToDriver(sessionId);
  }
}

export function getDriverConnection(driverId: string): AuthenticatedWebSocket | undefined {
  return driverConnections.get(driverId);
}

export function getCustomerConnection(customerId: string): AuthenticatedWebSocket | undefined {
  return customerConnections.get(customerId);
}

export function isDriverOnline(driverId: string): boolean {
  const ws = driverConnections.get(driverId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
}

// ============================================================
// Phase 1B: Driver Trip Lifecycle Handlers
// ============================================================

async function handleDriverMarkArrived(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { rideId, sessionId } = payload as { rideId?: string; sessionId?: string };
  const entityId = rideId || sessionId;

  if (!entityId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Ride or session ID required' } }));
    return;
  }

  const ride = await prisma.ride.findFirst({
    where: {
      OR: [{ id: entityId }, { dispatchSessionId: entityId }],
      driverId: ws.profileId,
    },
    select: { id: true, customerId: true, status: true },
  });

  if (!ride) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Ride not found or not assigned to you' } }));
    return;
  }

  const result = await statusTransitionService.transitionRideStatus(
    ride.id,
    'driver_arriving',
    'driver',
    ws.profileId
  );

  if (result.success) {
    ws.send(JSON.stringify({
      type: 'driver:arrived_confirmed',
      payload: { rideId: ride.id, status: 'driver_arriving' },
    }));

    const customerWs = customerConnections.get(ride.customerId);
    if (customerWs && customerWs.readyState === WebSocket.OPEN) {
      customerWs.send(JSON.stringify({
        type: 'ride:driver_arrived',
        payload: { rideId: ride.id, status: 'driver_arriving' },
      }));
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', payload: { message: result.error } }));
  }
}

async function handleDriverStartTrip(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { rideId, sessionId } = payload as { rideId?: string; sessionId?: string };
  const entityId = rideId || sessionId;

  if (!entityId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Ride or session ID required' } }));
    return;
  }

  const ride = await prisma.ride.findFirst({
    where: {
      OR: [{ id: entityId }, { dispatchSessionId: entityId }],
      driverId: ws.profileId,
    },
    select: { id: true, customerId: true, status: true, pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true },
  });

  if (!ride) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Ride not found or not assigned to you' } }));
    return;
  }

  const result = await statusTransitionService.transitionRideStatus(
    ride.id,
    'in_progress',
    'driver',
    ws.profileId
  );

  if (result.success) {
    const config = getDispatchFeatureConfig();
    let etaToDropoff: number | undefined;

    if (config.etaCalculation.enabled && ride.pickupLat && ride.pickupLng && ride.dropoffLat && ride.dropoffLng) {
      const routeResult = await routingService.getRouteAndEta({
        originLat: ride.pickupLat,
        originLng: ride.pickupLng,
        destLat: ride.dropoffLat,
        destLng: ride.dropoffLng,
        serviceType: 'ride',
      });
      etaToDropoff = routeResult.durationSeconds;

      await prisma.ride.update({
        where: { id: ride.id },
        data: {
          etaToDropoffSeconds: etaToDropoff,
          etaLastUpdatedAt: new Date(),
        },
      });
    }

    ws.send(JSON.stringify({
      type: 'driver:trip_started_confirmed',
      payload: { rideId: ride.id, status: 'in_progress', etaToDropoffSeconds: etaToDropoff },
    }));

    const customerWs = customerConnections.get(ride.customerId);
    if (customerWs && customerWs.readyState === WebSocket.OPEN) {
      customerWs.send(JSON.stringify({
        type: 'ride:trip_started',
        payload: { rideId: ride.id, status: 'in_progress', etaToDropoffSeconds: etaToDropoff },
      }));
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', payload: { message: result.error } }));
  }
}

async function handleDriverEndTrip(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { rideId, sessionId } = payload as { rideId?: string; sessionId?: string };
  const entityId = rideId || sessionId;

  if (!entityId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Ride or session ID required' } }));
    return;
  }

  const ride = await prisma.ride.findFirst({
    where: {
      OR: [{ id: entityId }, { dispatchSessionId: entityId }],
      driverId: ws.profileId,
    },
    select: { id: true, customerId: true, status: true },
  });

  if (!ride) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Ride not found or not assigned to you' } }));
    return;
  }

  const result = await statusTransitionService.transitionRideStatus(
    ride.id,
    'completed',
    'driver',
    ws.profileId
  );

  if (result.success) {
    rideTelemetryService.clearRideCache(ride.id);

    const config = getDispatchFeatureConfig();
    let fareResult;

    if (config.fareRecalculation.enabled) {
      fareResult = await fareRecalculationService.recalculateFareForCompletedRide(ride.id);
    }

    ws.send(JSON.stringify({
      type: 'driver:trip_ended_confirmed',
      payload: {
        rideId: ride.id,
        status: 'completed',
        fareRecalculated: fareResult?.success,
        finalFare: fareResult?.newFare,
      },
    }));

    const customerWs = customerConnections.get(ride.customerId);
    if (customerWs && customerWs.readyState === WebSocket.OPEN) {
      customerWs.send(JSON.stringify({
        type: 'ride:trip_completed',
        payload: {
          rideId: ride.id,
          status: 'completed',
          finalFare: fareResult?.newFare,
          breakdown: fareResult?.breakdown,
        },
      }));

      if (fareResult?.success) {
        customerWs.send(JSON.stringify({
          type: 'ride:fare_finalized',
          payload: {
            rideId: ride.id,
            originalFare: fareResult.originalFare,
            finalFare: fareResult.newFare,
            breakdown: fareResult.breakdown,
            adjustmentReason: fareResult.adjustmentReason,
          },
        }));
      }
    }

    const conversation = await chatService.getConversationByEntity('ride', ride.id);
    if (conversation) {
      await chatService.closeConversation(conversation.id);
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', payload: { message: result.error } }));
  }
}

async function handleDriverTripLocationUpdate(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  if (ws.userRole !== 'driver' || !ws.profileId) return;

  const { rideId, lat, lng, heading, speed } = payload as {
    rideId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
  };

  if (!rideId || typeof lat !== 'number' || typeof lng !== 'number') {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid location data' } }));
    return;
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      id: true,
      customerId: true,
      driverId: true,
      status: true,
      dropoffLat: true,
      dropoffLng: true,
      etaLastUpdatedAt: true,
    },
  });

  if (!ride || ride.driverId !== ws.profileId) {
    return;
  }

  if (ride.status !== 'in_progress' && ride.status !== 'driver_arriving') {
    return;
  }

  const sample = await rideTelemetryService.recordLocationSample(rideId, ws.profileId, {
    lat,
    lng,
    heading,
    speed,
  });

  const customerWs = customerConnections.get(ride.customerId);
  if (customerWs && customerWs.readyState === WebSocket.OPEN) {
    customerWs.send(JSON.stringify({
      type: 'ride:route_update',
      payload: {
        rideId,
        driverLat: lat,
        driverLng: lng,
        heading,
        speed,
        sampleId: sample?.id,
      },
    }));
  }

  const config = getDispatchFeatureConfig();
  const lastUpdate = ride.etaLastUpdatedAt?.getTime() || 0;
  const now = Date.now();
  const throttleMs = config.etaCalculation.throttleIntervalSeconds * 1000;

  if (now - lastUpdate >= throttleMs && ride.dropoffLat && ride.dropoffLng) {
    const routeResult = await routingService.getRouteAndEta({
      originLat: lat,
      originLng: lng,
      destLat: ride.dropoffLat,
      destLng: ride.dropoffLng,
      serviceType: 'ride',
    });

    await prisma.ride.update({
      where: { id: rideId },
      data: {
        etaToDropoffSeconds: routeResult.durationSeconds,
        etaLastUpdatedAt: new Date(),
      },
    });

    if (customerWs && customerWs.readyState === WebSocket.OPEN) {
      customerWs.send(JSON.stringify({
        type: 'ride:eta_update',
        payload: {
          rideId,
          phase: ride.status === 'in_progress' ? 'to_dropoff' : 'to_pickup',
          etaSeconds: routeResult.durationSeconds,
          distanceMeters: routeResult.distanceMeters,
        },
      }));
    }
  }
}

// ============================================================
// Phase 1B: Chat Message Handlers
// ============================================================

async function handleChatSendMessage(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  const { conversationId, entityId, serviceType, text } = payload as {
    conversationId?: string;
    entityId?: string;
    serviceType?: 'ride' | 'food' | 'parcel';
    text: string;
  };

  if (!text || typeof text !== 'string') {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Message text required' } }));
    return;
  }

  if (!ws.profileId || !ws.userRole) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Not authenticated' } }));
    return;
  }

  let convId = conversationId;

  if (!convId && entityId && serviceType) {
    let customerId: string | undefined;
    let driverId: string | undefined;
    let restaurantId: string | undefined;

    if (serviceType === 'ride') {
      const ride = await prisma.ride.findUnique({
        where: { id: entityId },
        select: { customerId: true, driverId: true },
      });
      if (ride) {
        customerId = ride.customerId;
        driverId = ride.driverId || undefined;
      }
    } else if (serviceType === 'food') {
      const order = await prisma.foodOrder.findUnique({
        where: { id: entityId },
        select: { customerId: true, driverId: true, restaurantId: true },
      });
      if (order) {
        customerId = order.customerId;
        driverId = order.driverId || undefined;
        restaurantId = order.restaurantId;
      }
    } else if (serviceType === 'parcel') {
      const delivery = await prisma.delivery.findUnique({
        where: { id: entityId },
        select: { customerId: true, driverId: true },
      });
      if (delivery) {
        customerId = delivery.customerId;
        driverId = delivery.driverId || undefined;
      }
    }

    if (customerId) {
      const conv = await chatService.getOrCreateConversation(
        serviceType,
        entityId,
        customerId,
        driverId,
        restaurantId
      );
      if (conv) {
        convId = conv.id;
      }
    }
  }

  if (!convId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Conversation not found' } }));
    return;
  }

  const senderRole = ws.userRole as 'customer' | 'driver' | 'restaurant' | 'admin';
  const result = await chatService.sendMessage(convId, senderRole, ws.profileId, text);

  if (!result.success) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: result.error } }));
    return;
  }

  ws.send(JSON.stringify({
    type: 'chat:message_sent',
    payload: { message: result.message },
  }));

  const conversation = await prisma.tripConversation.findUnique({
    where: { id: convId },
    select: { customerId: true, driverId: true, restaurantId: true },
  });

  if (conversation && result.message) {
    const recipientIds = [
      conversation.customerId,
      conversation.driverId,
      conversation.restaurantId,
    ].filter((id): id is string => id !== null && id !== ws.profileId);

    for (const recipientId of recipientIds) {
      const recipientWs = customerConnections.get(recipientId) || driverConnections.get(recipientId);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        recipientWs.send(JSON.stringify({
          type: 'chat:message_new',
          payload: {
            conversationId: convId,
            message: result.message,
          },
        }));
      }
    }
  }
}

async function handleChatMarkRead(
  ws: AuthenticatedWebSocket,
  payload: Record<string, unknown>
) {
  const { conversationId } = payload as { conversationId: string };

  if (!conversationId || !ws.profileId || !ws.userRole) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid request' } }));
    return;
  }

  const count = await chatService.markMessagesAsRead(
    conversationId,
    ws.profileId,
    ws.userRole as 'customer' | 'driver' | 'restaurant' | 'admin'
  );

  ws.send(JSON.stringify({
    type: 'chat:marked_read',
    payload: { conversationId, count },
  }));
}

// ============================================================
// Phase 1B: ETA Broadcast Utility
// ============================================================

export async function broadcastEtaUpdate(
  rideId: string,
  customerId: string,
  phase: 'to_pickup' | 'to_dropoff',
  etaSeconds: number,
  distanceMeters: number
): Promise<void> {
  const customerWs = customerConnections.get(customerId);
  if (customerWs && customerWs.readyState === WebSocket.OPEN) {
    customerWs.send(JSON.stringify({
      type: 'ride:eta_update',
      payload: {
        rideId,
        phase,
        etaSeconds,
        distanceMeters,
      },
    }));
  }
}

export async function broadcastStatusUpdate(
  serviceType: 'ride' | 'food' | 'parcel',
  entityId: string,
  customerId: string,
  status: string,
  additionalPayload?: Record<string, unknown>
): Promise<void> {
  const customerWs = customerConnections.get(customerId);
  if (customerWs && customerWs.readyState === WebSocket.OPEN) {
    customerWs.send(JSON.stringify({
      type: `${serviceType}:status_update`,
      payload: {
        entityId,
        status,
        ...additionalPayload,
      },
    }));
  }
}
