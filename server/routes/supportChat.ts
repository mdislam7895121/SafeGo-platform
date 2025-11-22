import express from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import {
  startOrGetChat,
  getMessages,
  sendMessage,
  escalateToHuman,
  getAdminConversations,
  getAdminMessages,
  sendAdminReply,
  closeConversation,
} from "../services/liveChatService";

const router = express.Router();

interface AuthRequest extends express.Request {
  user?: {
    userId: string;
    role: string;
    countryCode: string;
  };
}

// ====================================================
// DRIVER CHAT ENDPOINTS
// ====================================================

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
});

router.post("/chat/start", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userType = req.user!.role;

    if (userType !== "driver") {
      return res.status(403).json({ error: "Only drivers can access this endpoint" });
    }

    const result = await startOrGetChat(userId, userType);

    res.json({
      conversation: {
        id: result.conversation.id,
        status: result.conversation.status,
        createdAt: result.conversation.createdAt,
        updatedAt: result.conversation.updatedAt,
      },
      messages: result.messages.map((msg) => ({
        id: msg.id,
        senderType: msg.senderType,
        content: msg.body,
        createdAt: msg.createdAt,
      })),
      isNew: result.isNew,
    });
  } catch (error: any) {
    console.error("Error starting chat:", error);
    res.status(500).json({ error: "Failed to start chat" });
  }
});

router.get("/chat/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { conversationId, since } = req.query;

    if (!conversationId || typeof conversationId !== "string") {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const sinceDate = since && typeof since === "string" ? new Date(since) : undefined;

    const messages = await getMessages(conversationId, userId, sinceDate);

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        senderType: msg.senderType,
        content: msg.body,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error getting messages:", error);
    res.status(403).json({ error: error.message || "Failed to get messages" });
  }
});

router.post("/chat/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userType = req.user!.role;

    if (userType !== "driver") {
      return res.status(403).json({ error: "Only drivers can access this endpoint" });
    }

    const { conversationId, content } = req.body;

    const validationResult = sendMessageSchema.safeParse({ content });
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const result = await sendMessage(conversationId, userId, validationResult.data.content);

    res.json({
      messages: result.allMessages.map((msg) => ({
        id: msg.id,
        senderType: msg.senderType,
        content: msg.body,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
});

router.post("/chat/escalate", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const result = await escalateToHuman(conversationId, userId);

    res.json({
      conversation: {
        id: result.conversation.id,
        status: result.conversation.status,
        escalatedAt: result.conversation.escalatedAt,
      },
      message: result.message,
    });
  } catch (error: any) {
    console.error("Error escalating conversation:", error);
    res.status(500).json({ error: error.message || "Failed to escalate conversation" });
  }
});

// ====================================================
// ADMIN SUPPORT ENDPOINTS
// ====================================================

router.get("/admin/conversations", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userRole = req.user!.role;

    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { status, limit } = req.query;
    const limitNum = limit && typeof limit === "string" ? parseInt(limit, 10) : 50;

    const conversations = await getAdminConversations(
      typeof status === "string" ? status : undefined,
      limitNum
    );

    res.json({ conversations });
  } catch (error: any) {
    console.error("Error getting admin conversations:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

router.get("/admin/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userRole = req.user!.role;

    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const messages = await getAdminMessages(id);

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        senderType: msg.senderType,
        content: msg.body,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error getting admin messages:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

const adminReplySchema = z.object({
  content: z.string().min(1, "Reply cannot be empty").max(2000, "Reply too long"),
});

router.post("/admin/conversations/:id/reply", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userRole = req.user!.role;
    const adminUserId = req.user!.userId;

    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const { content } = req.body;

    const validationResult = adminReplySchema.safeParse({ content });
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const result = await sendAdminReply(id, adminUserId, validationResult.data.content);

    res.json({
      message: {
        id: result.message.id,
        senderType: result.message.senderType,
        content: result.message.body,
        createdAt: result.message.createdAt,
      },
      conversation: {
        id: result.conversation.id,
        status: result.conversation.status,
        assignedAdminId: result.conversation.assignedAdminId,
      },
    });
  } catch (error: any) {
    console.error("Error sending admin reply:", error);
    res.status(500).json({ error: error.message || "Failed to send reply" });
  }
});

router.post("/admin/conversations/:id/close", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userRole = req.user!.role;
    const adminUserId = req.user!.userId;

    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const conversation = await closeConversation(id, adminUserId);

    res.json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error closing conversation:", error);
    res.status(500).json({ error: error.message || "Failed to close conversation" });
  }
});

export default router;
