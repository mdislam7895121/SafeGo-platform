/**
 * SafeGo Admin Notifications WebSocket
 * Real-time notification delivery for admin dashboard
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const JWT_SECRET = process.env.JWT_SECRET;

interface AuthenticatedAdminSocket extends WebSocket {
  adminId?: string;
  adminEmail?: string;
  adminRole?: string;
  isAlive?: boolean;
  countryCode?: string;
}

interface AdminNotificationEvent {
  type: 'notification' | 'notification_read' | 'notification_count' | 'connected' | 'error';
  payload: any;
}

const adminConnections = new Map<string, AuthenticatedAdminSocket>();

let wss: WebSocketServer | null = null;

function getScopedCountFilter(ws: AuthenticatedAdminSocket): { isRead: boolean; countryCode?: string } {
  const baseFilter: { isRead: boolean; countryCode?: string } = { isRead: false };
  
  if (ws.adminRole === 'SUPER_ADMIN' || ws.adminRole === 'ADMIN') {
    return baseFilter;
  }
  
  if (ws.countryCode && (ws.adminRole === 'COUNTRY_ADMIN' || ws.adminRole === 'REGIONAL_MANAGER')) {
    return { ...baseFilter, countryCode: ws.countryCode };
  }
  
  return baseFilter;
}

export function setupAdminNotificationsWebSocket(server: HTTPServer) {
  wss = new WebSocketServer({ server, path: '/api/admin/notifications/ws' });

  wss.on('connection', async (ws: AuthenticatedAdminSocket, req) => {
    ws.isAlive = true;

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
      
      const admin = await prisma.adminAccount.findUnique({
        where: { userId: decoded.id },
        select: { 
          id: true, 
          email: true, 
          adminRole: true,
          countryCode: true,
        },
      });

      if (!admin) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Admin account not found' } }));
        ws.close();
        return;
      }

      ws.adminId = admin.id;
      ws.adminEmail = admin.email;
      ws.adminRole = admin.adminRole;
      ws.countryCode = admin.countryCode || undefined;

      adminConnections.set(admin.id, ws);

      ws.send(JSON.stringify({
        type: 'connected',
        payload: { 
          adminId: admin.id,
          adminRole: admin.adminRole,
          countryCode: admin.countryCode,
        },
      }));

      const countFilter = getScopedCountFilter(ws);
      const unreadCount = await prisma.adminNotification.count({
        where: countFilter,
      });
      ws.send(JSON.stringify({
        type: 'notification_count',
        payload: { count: unreadCount },
      }));

    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid token' } }));
      ws.close();
      return;
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleAdminMessage(ws, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
      }
    });

    ws.on('close', () => {
      if (ws.adminId) {
        adminConnections.delete(ws.adminId);
      }
    });
  });

  const pingInterval = setInterval(() => {
    wss?.clients.forEach((ws: AuthenticatedAdminSocket) => {
      if (ws.isAlive === false) {
        if (ws.adminId) {
          adminConnections.delete(ws.adminId);
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  console.log('Admin Notifications WebSocket server initialized at /api/admin/notifications/ws');
}

async function handleAdminMessage(ws: AuthenticatedAdminSocket, message: { type: string; payload: any }) {
  switch (message.type) {
    case 'mark_read':
      if (message.payload?.notificationId) {
        const notification = await prisma.adminNotification.findUnique({
          where: { id: message.payload.notificationId },
          select: { id: true, countryCode: true },
        });

        if (!notification) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Notification not found' } }));
          break;
        }

        if (ws.adminRole !== 'SUPER_ADMIN' && ws.adminRole !== 'ADMIN') {
          if (notification.countryCode && ws.countryCode !== notification.countryCode) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Access denied' } }));
            break;
          }
        }

        await prisma.adminNotification.update({
          where: { id: message.payload.notificationId },
          data: { isRead: true },
        });

        broadcastToAdmins({
          type: 'notification_read',
          payload: { notificationId: message.payload.notificationId, success: true },
        });

        for (const [adminId, adminWs] of adminConnections.entries()) {
          if (adminWs.readyState === WebSocket.OPEN) {
            const adminCountFilter = getScopedCountFilter(adminWs);
            const adminCount = await prisma.adminNotification.count({
              where: adminCountFilter,
            });
            adminWs.send(JSON.stringify({
              type: 'notification_count',
              payload: { count: adminCount },
            }));
          }
        }
      }
      break;

    case 'get_unread_count':
      const countFilter = getScopedCountFilter(ws);
      const count = await prisma.adminNotification.count({
        where: countFilter,
      });
      ws.send(JSON.stringify({
        type: 'notification_count',
        payload: { count },
      }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Unknown message type' } }));
  }
}

export function broadcastToAdmins(event: AdminNotificationEvent, targetCountryCode?: string) {
  adminConnections.forEach((ws, adminId) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!targetCountryCode || 
          ws.countryCode === targetCountryCode || 
          ws.adminRole === 'SUPER_ADMIN' || 
          ws.adminRole === 'ADMIN') {
        ws.send(JSON.stringify(event));
      }
    }
  });
}

export async function notifyAdmins(notification: {
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
  createdAt: Date;
}) {
  broadcastToAdmins({
    type: 'notification',
    payload: notification,
  }, notification.countryCode || undefined);

  for (const [adminId, ws] of adminConnections.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      const countFilter = getScopedCountFilter(ws);
      const count = await prisma.adminNotification.count({
        where: countFilter,
      });
      ws.send(JSON.stringify({
        type: 'notification_count',
        payload: { count },
      }));
    }
  }
}

export function getActiveAdminConnections(): number {
  return adminConnections.size;
}
