import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import * as supportService from "../services/supportChatService";

declare global {
  namespace Express {
    interface User {
      id: string;
      role: string;
      email: string;
    }
  }
}

const router = Router();

// Auth middleware
router.use(authenticateToken);

// Create conversation
router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userType = req.user!.role as "driver" | "customer" | "restaurant";

    const conversation = await supportService.createConversation({
      userId,
      userType,
    });

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List user conversations
router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userType = req.user!.role as "driver" | "customer" | "restaurant";

    const conversations = await supportService.listUserConversations(userId, userType);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation with messages
router.get("/conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const conversation = await supportService.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send message
router.post("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { body, messageType = "text" } = req.body;
    const userType = req.user!.role;

    const message = await supportService.sendMessage({
      conversationId,
      senderType: userType === "admin" ? "admin" : "user",
      body,
      messageType: messageType as "text" | "image" | "file",
    });

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark message as read
router.patch("/messages/:messageId/read", async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = await supportService.markAsRead(messageId);
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: List all conversations
router.get("/admin/conversations", async (req: Request, res: Response) => {
  try {
    const conversations = await supportService.listAdminConversations();
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
