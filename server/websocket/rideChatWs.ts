import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db";

const prisma = db;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userType?: string;
  rideId?: string;
  isAlive?: boolean;
}

interface WsMessage {
  type: string;
  payload: any;
}

const rideRooms = new Map<string, Set<AuthenticatedWebSocket>>();

const messageRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_MESSAGES_PER_MINUTE = 30;

export function setupRideChatWebSocket(server: HTTPServer) {
  const wss = new WebSocketServer({ server, path: "/api/rides/chat/ws" });

  wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const rideId = url.searchParams.get("rideId");

    if (!token || !rideId) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid connection parameters" } }));
      ws.close();
      return;
    }

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      ws.userId = decoded.id;
      ws.userType = decoded.role;
      ws.rideId = rideId;
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Authentication failed" } }));
      ws.close();
      return;
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        customerId: true,
        driverId: true,
        status: true,
      },
    });

    if (!ride) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Ride not found" } }));
      ws.close();
      return;
    }

    const isCustomer = ws.userType === "customer";
    const isDriver = ws.userType === "driver";
    
    let customerProfile = null;
    let driverProfile = null;

    if (isCustomer) {
      customerProfile = await prisma.customerProfile.findUnique({
        where: { userId: ws.userId },
        select: { id: true },
      });
      if (!customerProfile || customerProfile.id !== ride.customerId) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not authorized for this ride" } }));
        ws.close();
        return;
      }
    } else if (isDriver) {
      driverProfile = await prisma.driverProfile.findUnique({
        where: { userId: ws.userId },
        select: { id: true },
      });
      if (!driverProfile || driverProfile.id !== ride.driverId) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not authorized for this ride" } }));
        ws.close();
        return;
      }
    } else {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid user type" } }));
      ws.close();
      return;
    }

    if (!rideRooms.has(rideId)) {
      rideRooms.set(rideId, new Set());
    }
    rideRooms.get(rideId)!.add(ws);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());
        await handleMessage(ws, rideId, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
      }
    });

    ws.on("close", () => {
      const room = rideRooms.get(rideId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rideRooms.delete(rideId);
        }
      }
    });

    ws.send(JSON.stringify({ type: "connected", payload: { rideId } }));
  });

  // Store heartbeat interval for cleanup
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Cleanup interval when server closes to prevent memory leak
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    rideRooms.clear();
    messageRateLimit.clear();
  });
}

async function handleMessage(ws: AuthenticatedWebSocket, rideId: string, message: WsMessage) {
  const { type, payload } = message;

  if (type === "send_message") {
    const rateLimitKey = `${ws.userId}:${rideId}`;
    const now = Date.now();
    let limit = messageRateLimit.get(rateLimitKey);

    if (!limit || limit.resetAt < now) {
      limit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
      messageRateLimit.set(rateLimitKey, limit);
    }

    if (limit.count >= MAX_MESSAGES_PER_MINUTE) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Rate limit exceeded. Please wait." } }));
      return;
    }

    limit.count++;
    messageRateLimit.set(rateLimitKey, limit);

    if (!payload.message || typeof payload.message !== "string" || payload.message.trim().length === 0) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Message cannot be empty" } }));
      return;
    }

    const messageText = payload.message.trim().slice(0, 500);

    try {
      const chatMessage = await prisma.rideChatMessage.create({
        data: {
          rideId,
          senderId: ws.userId!,
          senderRole: ws.userType!,
          message: messageText,
          messageType: payload.messageType || "text",
        },
      });

      const room = rideRooms.get(rideId);
      if (room) {
        const broadcastMessage = JSON.stringify({
          type: "new_message",
          payload: {
            id: chatMessage.id,
            rideId,
            senderId: ws.userId,
            senderRole: ws.userType,
            message: chatMessage.message,
            messageType: chatMessage.messageType,
            createdAt: chatMessage.createdAt,
          },
        });

        room.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastMessage);
          }
        });
      }
    } catch (error) {
      console.error("Failed to save chat message:", error);
      ws.send(JSON.stringify({ type: "error", payload: { message: "Failed to send message" } }));
    }
  } else if (type === "mark_read") {
    try {
      await prisma.rideChatMessage.updateMany({
        where: {
          rideId,
          senderRole: ws.userType === "customer" ? "driver" : "customer",
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      const room = rideRooms.get(rideId);
      if (room) {
        const broadcastMessage = JSON.stringify({
          type: "messages_read",
          payload: {
            rideId,
            readBy: ws.userType,
          },
        });

        room.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastMessage);
          }
        });
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  } else if (type === "typing") {
    const room = rideRooms.get(rideId);
    if (room) {
      const broadcastMessage = JSON.stringify({
        type: "typing",
        payload: {
          rideId,
          userType: ws.userType,
          isTyping: payload.isTyping,
        },
      });

      room.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(broadcastMessage);
        }
      });
    }
  }
}

export function broadcastToRide(rideId: string, message: object) {
  const room = rideRooms.get(rideId);
  if (room) {
    const messageStr = JSON.stringify(message);
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}
