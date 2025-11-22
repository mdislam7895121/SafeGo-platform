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
// VERIFICATION ENDPOINTS (ALL ROLES)
// ====================================================

router.get("/chat/verification", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userType = req.user!.role;
    const { db } = await import("../db");

    if (userType === "driver") {
      const driver = await db.driverProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { email: true } },
          driverStats: true,
          vehicle: true,
        },
      });

      if (!driver) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      return res.json({
        name: driver.fullName || driver.user.email,
        country: driver.usaState ? "US" : "BD",
        city: driver.usaCity || driver.district || "Unknown",
        phone: driver.phoneNumber || driver.usaPhoneNumber || "",
        email: driver.user.email,
        rating: driver.driverStats?.rating ? Number(driver.driverStats.rating) : 5.0,
        totalTrips: driver.driverStats?.totalTrips || 0,
        kycStatus: driver.isVerified ? "Verified" : "Pending",
        vehicle: driver.vehicle ? `${driver.vehicle.vehicleModel || "Vehicle"}` : null,
      });
    }

    if (userType === "customer") {
      const customer = await db.customerProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { email: true } },
          rides: { select: { id: true } },
        },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }

      return res.json({
        name: customer.fullName || customer.user.email,
        city: customer.district || "Unknown",
        phone: customer.phoneNumber || "",
        email: customer.user.email,
        totalTrips: customer.rides.length,
      });
    }

    if (userType === "restaurant") {
      const restaurant = await db.restaurantProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { email: true } },
        },
      });

      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant profile not found" });
      }

      return res.json({
        restaurantName: restaurant.restaurantName || "Unknown Restaurant",
        city: restaurant.cityCode || "Unknown",
        ownerName: restaurant.user.email,
        phone: "",
        email: restaurant.user.email,
        restaurantId: restaurant.id,
      });
    }

    return res.status(400).json({ error: "Invalid user type" });
  } catch (error: any) {
    console.error("Error fetching verification data:", error);
    res.status(500).json({ error: "Failed to fetch verification data" });
  }
});

router.post("/chat/verify", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userType = req.user!.role;
    const { db } = await import("../db");

    // Find existing open conversation or create new one
    let conversation = await db.supportConversation.findFirst({
      where: {
        userId,
        userType,
        status: "open",
      },
    });

    if (!conversation) {
      conversation = await db.supportConversation.create({
        data: {
          userId,
          userType,
          status: "open",
          verifiedAt: new Date(),
        },
      });
    } else {
      // Update existing conversation with verification timestamp
      conversation = await db.supportConversation.update({
        where: { id: conversation.id },
        data: { verifiedAt: new Date() },
      });
    }

    res.json({ success: true, conversationId: conversation.id });
  } catch (error: any) {
    console.error("Error verifying user:", error);
    res.status(500).json({ error: "Failed to verify user" });
  }
});

// ====================================================
// CHAT ENDPOINTS (ALL ROLES)
// ====================================================

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
});

router.post("/chat/start", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userType = req.user!.role;
    const { db } = await import("../db");

    // SECURITY: Verify user has completed pre-chat verification
    const existingConversation = await db.supportConversation.findFirst({
      where: {
        userId,
        userType,
        status: "open",
      },
    });

    if (!existingConversation || !existingConversation.verifiedAt) {
      return res.status(403).json({ 
        error: "Verification required",
        message: "You must complete verification before starting chat" 
      });
    }

    // All roles (driver, customer, restaurant) can start a chat after verification
    const result = await startOrGetChat(userId, userType);

    res.json({
      conversation: {
        id: result.conversation.id,
        status: result.conversation.status,
        createdAt: result.conversation.createdAt,
        updatedAt: result.conversation.updatedAt,
        escalatedAt: result.conversation.escalatedAt,
        isEscalated: result.conversation.isEscalated,
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
    const { db } = await import("../db");
    const { conversationId, since } = req.query;

    if (!conversationId || typeof conversationId !== "string") {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const sinceDate = since && typeof since === "string" ? new Date(since) : undefined;

    const messages = await getMessages(conversationId, userId, sinceDate);

    // Include conversation status for real-time UI updates
    const conversation = await db.supportConversation.findUnique({
      where: { id: conversationId },
      select: {
        status: true,
        isEscalated: true,
        escalatedAt: true,
        closedAt: true,
      },
    });

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        senderType: msg.senderType,
        content: msg.body,
        createdAt: msg.createdAt,
      })),
      conversation: conversation || undefined,
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
    const { db } = await import("../db");

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

    // SECURITY: Verify conversation exists and user completed verification
    const conversation = await db.supportConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== userId || conversation.userType !== userType) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!conversation.verifiedAt) {
      return res.status(403).json({ 
        error: "Verification required",
        message: "You must complete verification before sending messages" 
      });
    }

    // All roles (driver, customer, restaurant) can send messages after verification
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
    const userType = req.user!.role;
    const { db } = await import("../db");
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    // SECURITY: Verify conversation exists and user completed verification
    const conversation = await db.supportConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== userId || conversation.userType !== userType) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!conversation.verifiedAt) {
      return res.status(403).json({ 
        error: "Verification required",
        message: "You must complete verification before escalating to human support" 
      });
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

// Mark bot response as unhelpful (increments unresolvedCount for auto-escalation)
router.post("/chat/bot-unhelpful", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { db } = await import("../db");
    const { EscalationService } = await import("../services/escalationService");
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const conversation = await db.supportConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // SECURITY: Reject bot feedback for closed, escalated, or assigned conversations
    if (conversation.status === "closed" || conversation.status === "pending" || conversation.status === "assigned" || conversation.status === "escalated" || conversation.isEscalated) {
      return res.status(400).json({ 
        error: "Bot feedback not allowed",
        message: "Cannot provide bot feedback for this conversation status"
      });
    }

    // Increment unresolved count
    await EscalationService.incrementUnresolvedCount(conversationId);

    // Check if auto-escalation threshold reached (3 unresolved attempts)
    const escalationCheck = await EscalationService.checkAutoEscalation(conversationId);
    
    if (escalationCheck && escalationCheck.escalated) {
      // Immediately escalate to human agent
      await EscalationService.escalateConversation(conversationId, "auto_unresolved");
      
      return res.json({ 
        success: true,
        escalated: true,
        escalationMessage: "You've been connected to a live support agent who will assist you shortly."
      });
    }

    res.json({ 
      success: true, 
      escalated: false,
      escalationMessage: ""
    });
  } catch (error: any) {
    console.error("Error recording bot feedback:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// Mark bot response as helpful (resets unresolvedCount)
router.post("/chat/bot-helpful", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { db } = await import("../db");
    const { EscalationService } = await import("../services/escalationService");
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const conversation = await db.supportConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // SECURITY: Reject bot feedback for closed, escalated, or assigned conversations
    if (conversation.status === "closed" || conversation.status === "pending" || conversation.status === "assigned" || conversation.status === "escalated" || conversation.isEscalated) {
      return res.status(400).json({ 
        error: "Bot feedback not allowed",
        message: "Cannot provide bot feedback for this conversation status"
      });
    }

    await EscalationService.resetUnresolvedCount(conversationId);

    res.json({ 
      success: true, 
      escalated: false,
      escalationMessage: ""
    });
  } catch (error: any) {
    console.error("Error recording bot feedback:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// End chat with optional rating and feedback
const endChatSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  feedback: z.string().max(500).optional(),
});

router.post("/chat/end", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { db } = await import("../db");
    const { conversationId, rating, feedback } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const validationResult = endChatSchema.safeParse({ rating, feedback });
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const conversation = await db.supportConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const updatedConversation = await db.supportConversation.update({
      where: { id: conversationId },
      data: {
        status: "closed",
        closedAt: new Date(),
        rating: validationResult.data.rating,
        feedback: validationResult.data.feedback,
      },
    });

    res.json({
      success: true,
      conversation: {
        id: updatedConversation.id,
        status: updatedConversation.status,
        closedAt: updatedConversation.closedAt,
        rating: updatedConversation.rating,
      },
    });
  } catch (error: any) {
    console.error("Error ending chat:", error);
    res.status(500).json({ error: "Failed to end chat" });
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
