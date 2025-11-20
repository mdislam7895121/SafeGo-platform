import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "../db";
import jwt from "jsonwebtoken";
import * as supportService from "../services/supportService";

const prisma = db;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function loadAdminPermissions(adminId: string): Promise<string[]> {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        isActive: true,
        role: {
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!admin?.isActive) {
      return [];
    }

    return admin?.role?.permissions || [];
  } catch (error) {
    console.error("Failed to load admin permissions:", error);
    return [];
  }
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userType?: "driver" | "customer" | "restaurant" | "admin";
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  payload: any;
}

const conversationRooms = new Map<string, Set<AuthenticatedWebSocket>>();

export function setupSupportChatWebSocket(server: HTTPServer) {
  const wss = new WebSocketServer({ server, path: "/api/support/ws" });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    
    const token = new URL(req.url || "", `http://${req.headers.host}`).searchParams.get("token");
    
    if (!token) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Authentication required" } }));
      ws.close();
      return;
    }

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      ws.userId = decoded.id;
      ws.userType = decoded.role as any;
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid token" } }));
      ws.close();
      return;
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message);
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
      }
    });

    ws.on("close", () => {
      removeFromAllRooms(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(async (ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      if (ws.userType === "admin" && ws.userId) {
        const permissions = await loadAdminPermissions(ws.userId);
        if (permissions.length === 0) {
          console.log(`Disconnecting inactive admin ${ws.userId}`);
          removeFromAllRooms(ws);
          ws.send(JSON.stringify({ type: "error", payload: { message: "Admin account deactivated or permissions revoked" } }));
          ws.close();
          return;
        }
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  console.log("Support chat WebSocket server started on path /api/support/ws");

  return wss;
}

async function handleWebSocketMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
  const { type, payload } = message;

  switch (type) {
    case "auth":
      await handleAuth(ws, payload);
      break;

    case "joinConversation":
      await handleJoinConversation(ws, payload);
      break;

    case "leaveConversation":
      await handleLeaveConversation(ws, payload);
      break;

    case "sendMessage":
      await handleSendMessage(ws, payload);
      break;

    case "typing":
      await handleTyping(ws, payload);
      break;

    default:
      ws.send(JSON.stringify({ type: "error", payload: { message: "Unknown message type" } }));
  }
}

async function handleAuth(ws: AuthenticatedWebSocket, payload: any) {
  if (!ws.userId || !ws.userType) {
    ws.send(JSON.stringify({ type: "authError", payload: { message: "Already authenticated at connection" } }));
    return;
  }

  ws.send(JSON.stringify({ type: "authSuccess", payload: { userId: ws.userId, userType: ws.userType } }));
}

async function handleJoinConversation(ws: AuthenticatedWebSocket, payload: any) {
  const { conversationId } = payload;

  if (!ws.userId || !ws.userType) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Not authenticated" } }));
    return;
  }

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Conversation not found" } }));
    return;
  }

  if (ws.userType === "admin") {
    const permissions = await loadAdminPermissions(ws.userId);
    
    if (permissions.length === 0) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Admin account inactive or permissions revoked" } }));
      return;
    }
    
    if (!permissions.includes("VIEW_SUPPORT_CONVERSATIONS")) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Missing VIEW_SUPPORT_CONVERSATIONS permission" } }));
      return;
    }
  } else {
    const isOwner = conversation.userId === ws.userId && conversation.userType === ws.userType;
    if (!isOwner) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Not authorized" } }));
      return;
    }
  }

  if (!conversationRooms.has(conversationId)) {
    conversationRooms.set(conversationId, new Set());
  }

  conversationRooms.get(conversationId)!.add(ws);

  ws.send(JSON.stringify({ type: "joinedConversation", payload: { conversationId } }));
}

async function handleLeaveConversation(ws: AuthenticatedWebSocket, payload: any) {
  const { conversationId } = payload;

  const room = conversationRooms.get(conversationId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      conversationRooms.delete(conversationId);
    }
  }

  ws.send(JSON.stringify({ type: "leftConversation", payload: { conversationId } }));
}

async function handleSendMessage(ws: AuthenticatedWebSocket, payload: any) {
  const { conversationId, content, messageType } = payload;

  if (!conversationId || !content) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing required fields" } }));
    return;
  }

  if (!ws.userId || !ws.userType) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Not authenticated" } }));
    return;
  }

  try {
    const permissions = ws.userType === "admin" ? await loadAdminPermissions(ws.userId) : [];
    
    if (permissions.length === 0 && ws.userType === "admin") {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Admin account inactive or permissions revoked" } }));
      return;
    }
    
    const message = await supportService.sendMessage(
      {
        conversationId,
        senderId: ws.userId,
        senderType: ws.userType === "admin" ? "admin" : "user",
        content,
        messageType: messageType || "text",
      },
      {
        userId: ws.userId,
        userType: ws.userType,
        permissions,
      }
    );

    broadcastToConversation(conversationId, {
      type: "newMessage",
      payload: message,
    });

    ws.send(JSON.stringify({
      type: "messageSent",
      payload: { message },
    }));
  } catch (error) {
    console.error("Error sending message:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send message";
    ws.send(JSON.stringify({ type: "error", payload: { message: errorMessage } }));
  }
}

async function handleTyping(ws: AuthenticatedWebSocket, payload: any) {
  const { conversationId, isTyping } = payload;

  if (!ws.userId || !ws.userType) {
    return;
  }

  broadcastToConversation(conversationId, {
    type: "typing",
    payload: {
      userId: ws.userId,
      userType: ws.userType,
      isTyping,
    },
  }, ws);
}

async function broadcastToConversation(conversationId: string, message: any, excludeWs?: AuthenticatedWebSocket) {
  const room = conversationRooms.get(conversationId);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  const clientsToRemove: AuthenticatedWebSocket[] = [];
  
  for (const client of room) {
    if (client === excludeWs || client.readyState !== WebSocket.OPEN) {
      continue;
    }
    
    if (client.userType === "admin" && client.userId) {
      const permissions = await loadAdminPermissions(client.userId);
      if (permissions.length === 0 || !permissions.includes("VIEW_SUPPORT_CONVERSATIONS")) {
        clientsToRemove.push(client);
        continue;
      }
    }
    
    client.send(messageStr);
  }
  
  clientsToRemove.forEach(client => {
    room.delete(client);
    client.send(JSON.stringify({ type: "error", payload: { message: "Permissions revoked" } }));
    client.close();
  });
  
  if (room.size === 0) {
    conversationRooms.delete(conversationId);
  }
}

function removeFromAllRooms(ws: AuthenticatedWebSocket) {
  conversationRooms.forEach((room, conversationId) => {
    room.delete(ws);
    if (room.size === 0) {
      conversationRooms.delete(conversationId);
    }
  });
}
