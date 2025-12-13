import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

let cachedJwtSecret: string | null = null;

function getJwtSecret(): string {
  if (cachedJwtSecret) return cachedJwtSecret;
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("[FoodOrderNotificationsWS] CRITICAL: JWT_SECRET is not configured - cannot start WebSocket server");
  }
  cachedJwtSecret = secret;
  return cachedJwtSecret;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userType?: string;
  orderId?: string;
  isAlive?: boolean;
}

interface WsMessage {
  type: string;
  payload: any;
}

const orderRooms = new Map<string, Set<AuthenticatedWebSocket>>();
const userConnections = new Map<string, Set<AuthenticatedWebSocket>>();

let wssInstance: WebSocketServer | null = null;
const MAX_FOOD_ORDER_CONNECTIONS = 300;

export function setupFoodOrderNotificationsWebSocket(server: HTTPServer) {
  if (wssInstance) {
    console.log('[Food Order Notifications WebSocket] Already initialized, skipping duplicate setup');
    return;
  }
  
  const secret = getJwtSecret();
  const wss = new WebSocketServer({ server, path: "/api/food-orders/notifications/ws" });
  wssInstance = wss;

  wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
    if (wss.clients.size > MAX_FOOD_ORDER_CONNECTIONS) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Server at capacity" } }));
      ws.close();
      return;
    }
    
    ws.isAlive = true;

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const orderId = url.searchParams.get("orderId");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Token required" } }));
      ws.close();
      return;
    }

    try {
      const decoded: any = jwt.verify(token, secret);
      ws.userId = decoded.id;
      ws.userType = decoded.role;
      ws.orderId = orderId || undefined;
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Authentication failed" } }));
      ws.close();
      return;
    }

    if (orderId) {
      const foodOrder = await prisma.foodOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customerId: true,
          restaurantId: true,
          driverId: true,
          status: true,
        },
      });

      if (!foodOrder) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Order not found" } }));
        ws.close();
        return;
      }

      let isAuthorized = false;

      if (ws.userType === "customer") {
        const customerProfile = await prisma.customerProfile.findUnique({
          where: { userId: ws.userId },
          select: { id: true },
        });
        isAuthorized = customerProfile?.id === foodOrder.customerId;
      } else if (ws.userType === "restaurant") {
        const restaurantProfile = await prisma.restaurantProfile.findUnique({
          where: { userId: ws.userId },
          select: { id: true },
        });
        isAuthorized = restaurantProfile?.id === foodOrder.restaurantId;
      } else if (ws.userType === "driver") {
        const driverProfile = await prisma.driverProfile.findUnique({
          where: { userId: ws.userId },
          select: { id: true },
        });
        isAuthorized = driverProfile?.id === foodOrder.driverId;
      } else if (ws.userType === "admin") {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not authorized for this order" } }));
        ws.close();
        return;
      }

      if (!orderRooms.has(orderId)) {
        orderRooms.set(orderId, new Set());
      }
      orderRooms.get(orderId)!.add(ws);

      ws.send(JSON.stringify({
        type: "connected",
        payload: {
          orderId,
          currentStatus: foodOrder.status,
          message: "Connected to order notifications",
        },
      }));
    } else {
      if (!userConnections.has(ws.userId!)) {
        userConnections.set(ws.userId!, new Set());
      }
      userConnections.get(ws.userId!)!.add(ws);

      ws.send(JSON.stringify({
        type: "connected",
        payload: {
          message: "Connected to all order notifications",
        },
      }));
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());
        
        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
      }
    });

    ws.on("close", () => {
      if (ws.orderId) {
        const room = orderRooms.get(ws.orderId);
        if (room) {
          room.delete(ws);
          if (room.size === 0) {
            orderRooms.delete(ws.orderId);
          }
        }
      }
      
      if (ws.userId) {
        const connections = userConnections.get(ws.userId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            userConnections.delete(ws.userId);
          }
        }
      }
    });
  });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  return wss;
}

export function broadcastOrderUpdate(orderId: string, status: string, data: {
  restaurantName?: string;
  driverName?: string;
  estimatedDeliveryTime?: string;
  driverLocation?: { lat: number; lng: number };
}) {
  const room = orderRooms.get(orderId);
  
  if (room) {
    const message = JSON.stringify({
      type: "order_status_update",
      payload: {
        orderId,
        status,
        ...data,
        timestamp: new Date().toISOString(),
      },
    });

    room.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

export function broadcastToUser(userId: string, notification: {
  type: string;
  orderId: string;
  title: string;
  body: string;
  status?: string;
}) {
  const connections = userConnections.get(userId);
  
  if (connections) {
    const message = JSON.stringify({
      type: "notification",
      payload: {
        ...notification,
        timestamp: new Date().toISOString(),
      },
    });

    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}
