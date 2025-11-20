import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db";

const prisma = db;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userType?: string;
  isAlive?: boolean;
  isAdmin?: boolean;
}

interface WsMessage {
  type: string;
  payload: any;
}

// Rooms: conversationId -> Set of WebSockets
const rooms = new Map<string, Set<AuthenticatedWebSocket>>();

// Rate limiting: userId:conversationId -> message count
const messageRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 hour in ms
const MAX_MESSAGES_PER_HOUR = 100;

export function setupSupportChatWebSocket(server: HTTPServer) {
  const wss = new WebSocketServer({ server, path: "/api/support/chat/ws" });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const conversationId = url.searchParams.get("conversationId");

    if (!token || !conversationId) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid connection parameters" } }));
      ws.close();
      return;
    }

    // Authenticate
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      ws.userId = decoded.id;
      ws.userType = decoded.role;
      ws.isAdmin = decoded.role === "admin";
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Authentication failed" } }));
      ws.close();
      return;
    }

    // Join room
    if (!rooms.has(conversationId)) {
      rooms.set(conversationId, new Set());
    }
    rooms.get(conversationId)!.add(ws);

    // Heartbeat
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Message handler
    ws.on("message", async (data) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());
        await handleMessage(ws, conversationId, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message" } }));
      }
    });

    // Cleanup
    ws.on("close", () => {
      const room = rooms.get(conversationId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(conversationId);
        }
      }
    });

    ws.send(JSON.stringify({ type: "connected", payload: { conversationId } }));
  });

  // Heartbeat interval
  setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
}

async function handleMessage(ws: AuthenticatedWebSocket, conversationId: string, message: WsMessage) {
  const { type, payload } = message;

  if (type === "send_message") {
    // Check rate limit
    const rateLimitKey = `${ws.userId}:${conversationId}`;
    const now = Date.now();
    let limit = messageRateLimit.get(rateLimitKey);

    if (!limit || limit.resetAt < now) {
      limit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    }

    if (limit.count >= MAX_MESSAGES_PER_HOUR) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Rate limit exceeded" } }));
      return;
    }

    limit.count++;
    messageRateLimit.set(rateLimitKey, limit);

    // Broadcast to room
    const room = rooms.get(conversationId);
    if (room) {
      const broadcastMessage = JSON.stringify({
        type: "new_message",
        payload: {
          conversationId,
          senderId: ws.userId,
          senderType: ws.userType,
          body: payload.body,
          messageType: payload.messageType || "text",
          timestamp: new Date(),
        },
      });

      room.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastMessage);
        }
      });
    }
  } else if (type === "mark_read") {
    const room = rooms.get(conversationId);
    if (room) {
      const broadcastMessage = JSON.stringify({
        type: "message_read",
        payload: {
          conversationId,
          readBy: ws.userId,
        },
      });

      room.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastMessage);
        }
      });
    }
  }
}
