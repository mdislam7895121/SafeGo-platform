/**
 * SafeGo WebSocket Dispatch Hub
 * Phase 1A: Real-time dispatch communication between customers and drivers
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { dispatchService } from '../services/dispatchService';
import { driverRealtimeStateService } from '../services/driverRealtimeStateService';
import { DispatchServiceMode } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

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

export function setupDispatchWebSocket(server: HTTPServer) {
  const wss = new WebSocketServer({ server, path: '/api/dispatch/ws' });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    ws.rooms = new Set();

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'No token provided' } }));
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
          firstName: session.customer.firstName,
          lastName: session.customer.lastName,
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
