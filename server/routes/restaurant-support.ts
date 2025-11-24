import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { notifyTicketReply, notifyTicketStatusChange } from "../services/support-notifications";

const router = Router();

// All routes require authentication and restaurant role
router.use(authenticateToken);
router.use(requireRole(["restaurant"]));

/**
 * Helper function to check if restaurant user has support access
 * OWNER: Full access always (including null/undefined ownerRole for backward compatibility)
 * STAFF: Only if canReplySupport = true, staffActive = true, and not suspended
 */
function checkSupportAccess(profile: any, requireOwner: boolean = false): boolean {
  // OWNER always has full access (treat null/undefined as OWNER for backward compatibility)
  if (!profile.ownerRole || profile.ownerRole === "OWNER") {
    return true;
  }
  
  // If OWNER role is required, deny STAFF
  if (requireOwner) {
    return false;
  }
  
  // STAFF must have permission and be active
  if (profile.ownerRole === "STAFF") {
    return profile.canReplySupport && profile.staffActive && !profile.isSuspended;
  }
  
  return false;
}

/**
 * ===========================
 * RESTAURANT SUPPORT CENTER ROUTES
 * (Phase 12.5: General support tickets for restaurant-initiated requests)
 * ===========================
 */

import { restaurantSupportService } from "../services/GenericSupportService";

/**
 * GET /api/restaurant/support-center/tickets
 * List restaurant's support center tickets (general support requests)
 */
router.get("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        restaurantName: true,
        isVerified: true,
        verificationStatus: true,
        ownerRole: true,
        canReplySupport: true,
        staffActive: true,
        isSuspended: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ 
        error: "Restaurant verification required to access support system" 
      });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ 
        error: "You do not have permission to access support tickets. Please contact the restaurant owner." 
      });
    }

    const tickets = await restaurantSupportService.listTickets(restaurantProfile.id);

    return res.json({ tickets });
  } catch (error) {
    console.error("Error listing support center tickets:", error);
    return res.status(500).json({ error: "Failed to list tickets" });
  }
});

/**
 * GET /api/restaurant/support-center/tickets/:id
 * Get specific support center ticket with messages
 */
router.get("/support-center/tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        restaurantName: true,
        isVerified: true,
        verificationStatus: true,
        ownerRole: true,
        canReplySupport: true,
        staffActive: true,
        isSuspended: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to access support tickets" });
    }

    const ticket = await restaurantSupportService.getTicketById(ticketId, restaurantProfile.id);

    return res.json({ ticket });
  } catch (error: any) {
    console.error("Error getting support center ticket:", error);
    if (error.message === "Access denied: You can only view your own tickets") {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Ticket not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get ticket" });
  }
});

/**
 * POST /api/restaurant/support-center/tickets
 * Create a new support center ticket (OWNER or STAFF with canReplySupport)
 */
router.post("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subject, category, priority, description, channel, attachmentUrls } = req.body;

    if (!subject || !category || !description) {
      return res.status(400).json({ error: "Subject, category, and description are required" });
    }

    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          isVerified: true,
          verificationStatus: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
    ]);

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required to create support tickets" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ 
        error: "You do not have permission to create support tickets. Please contact the restaurant owner." 
      });
    }

    const ticket = await restaurantSupportService.createTicket({
      profileId: restaurantProfile.id,
      subject,
      category,
      priority: priority || "normal",
      description,
      channel: channel || "web",
      attachmentUrls
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "support_ticket_created",
        entityType: "restaurant_support_ticket",
        entityId: ticket.id,
        description: `Restaurant created support ticket ${ticket.ticketCode}`,
        metadata: {
          ticketCode: ticket.ticketCode,
          category: ticket.category,
          priority: ticket.priority,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    return res.status(201).json({ ticket });
  } catch (error) {
    console.error("Error creating support center ticket:", error);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

/**
 * POST /api/restaurant/support-center/tickets/:id/messages
 * Add a message to a support center ticket (OWNER or STAFF with canReplySupport)
 */
router.post("/support-center/tickets/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { messageBody, attachmentUrls } = req.body;

    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          isVerified: true,
          verificationStatus: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
    ]);

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ 
        error: "You do not have permission to reply to support tickets. Please contact the restaurant owner." 
      });
    }

    const message = await restaurantSupportService.addMessage({
      ticketId,
      profileId: restaurantProfile.id,
      senderRole: "restaurant",
      senderName: restaurantProfile.restaurantName,
      messageBody: messageBody.trim(),
      attachmentUrls
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "support_ticket_message_sent",
        entityType: "restaurant_support_ticket",
        entityId: ticketId,
        description: `Restaurant added message to ticket`,
        metadata: {
          messageId: message.id,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error adding message to support center ticket:", error);
    if (error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Ticket not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to add message" });
  }
});

/**
 * Live Chat Routes
 */
import { restaurantLiveChatService } from "../services/GenericLiveChatService";

/**
 * POST /api/restaurant/support-center/live-chat/start
 * Start a new live chat session
 */
router.post("/support-center/live-chat/start", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          isVerified: true,
          verificationStatus: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
    ]);

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to access live chat" });
    }

    // Check if there's already an active session
    const existingSession = await restaurantLiveChatService.getActiveSession(restaurantProfile.id);
    if (existingSession) {
      return res.json({ session: existingSession });
    }

    const session = await restaurantLiveChatService.createSession(restaurantProfile.id);

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "live_chat_session_started",
        entityType: "live_chat_session",
        entityId: session.id,
        description: `Restaurant started live chat session`,
        metadata: {
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    return res.status(201).json({ session });
  } catch (error) {
    console.error("Error starting live chat session:", error);
    return res.status(500).json({ error: "Failed to start live chat session" });
  }
});

/**
 * GET /api/restaurant/support-center/live-chat/:sessionId
 * Get live chat session with messages
 */
router.get("/support-center/live-chat/:sessionId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        isVerified: true,
        verificationStatus: true,
        ownerRole: true,
        canReplySupport: true,
        staffActive: true,
        isSuspended: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to access live chat" });
    }

    const session = await restaurantLiveChatService.getSessionById(sessionId, restaurantProfile.id);

    return res.json({ session });
  } catch (error: any) {
    console.error("Error getting live chat session:", error);
    if (error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Session not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get chat session" });
  }
});

/**
 * POST /api/restaurant/support-center/live-chat/:sessionId/messages
 * Send a message in live chat
 */
router.post("/support-center/live-chat/:sessionId/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;
    const { messageBody, attachmentUrls } = req.body;

    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          isVerified: true,
          verificationStatus: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
    ]);

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to send messages" });
    }

    const message = await restaurantLiveChatService.sendMessage({
      sessionId,
      profileId: restaurantProfile.id,
      senderRole: "restaurant",
      senderName: restaurantProfile.restaurantName,
      messageBody: messageBody.trim(),
      attachmentUrls
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "live_chat_message_sent",
        entityType: "live_chat_session",
        entityId: sessionId,
        description: `Restaurant sent live chat message`,
        metadata: {
          messageId: message.id,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error sending live chat message:", error);
    if (error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Session not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * POST /api/restaurant/support-center/live-chat/:sessionId/end
 * End a live chat session
 */
router.post("/support-center/live-chat/:sessionId/end", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        isVerified: true,
        verificationStatus: true,
        ownerRole: true,
        canReplySupport: true,
        staffActive: true,
        isSuspended: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to end chat sessions" });
    }

    const session = await restaurantLiveChatService.endSession(sessionId, restaurantProfile.id);

    return res.json({ session });
  } catch (error: any) {
    console.error("Error ending live chat session:", error);
    if (error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Session not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to end chat session" });
  }
});

/**
 * Support Callback Routes
 */
import { restaurantCallbackService } from "../services/GenericSupportCallbackService";

/**
 * POST /api/restaurant/support-center/callbacks
 * Request a callback from support
 */
router.post("/support-center/callbacks", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { phoneNumber, preferredTime, reason } = req.body;

    if (!phoneNumber || !preferredTime || !reason) {
      return res.status(400).json({ error: "Phone number, preferred time, and reason are required" });
    }

    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          isVerified: true,
          verificationStatus: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true
        }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
    ]);

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to request callbacks" });
    }

    const callback = await restaurantCallbackService.createCallback({
      profileId: restaurantProfile.id,
      phoneNumber,
      preferredTime,
      timezone: timezone || "UTC",
      reason
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "support_callback_requested",
        entityType: "support_callback",
        entityId: callback.id,
        description: `Restaurant requested support callback`,
        metadata: {
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName,
          preferredTime
        },
        success: true
      }
    });

    return res.status(201).json({ callback });
  } catch (error) {
    console.error("Error creating callback request:", error);
    return res.status(500).json({ error: "Failed to create callback request" });
  }
});

/**
 * Support Article Routes
 */
import { supportArticleService } from "../services/SupportArticleService";

/**
 * GET /api/restaurant/support-center/articles
 * Search support articles
 */
router.get("/support-center/articles", async (req: AuthRequest, res: Response) => {
  try {
    const { q, category } = req.query;

    const articles = await supportArticleService.searchArticles(
      q as string || "",
      category as string
    );

    return res.json({ articles });
  } catch (error) {
    console.error("Error searching articles:", error);
    return res.status(500).json({ error: "Failed to search articles" });
  }
});

/**
 * GET /api/restaurant/support-center/articles/:slug
 * Get specific article by slug
 */
router.get("/support-center/articles/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug;

    const article = await supportArticleService.getArticleBySlug(slug);

    return res.json({ article });
  } catch (error: any) {
    console.error("Error getting article:", error);
    if (error.message === "Article not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get article" });
  }
});

/**
 * GET /api/restaurant/support-center/categories
 * Get all article categories
 */
router.get("/support-center/categories", async (req: AuthRequest, res: Response) => {
  try {
    const categories = await supportArticleService.getAllCategories();
    return res.json({ categories });
  } catch (error) {
    console.error("Error getting categories:", error);
    return res.status(500).json({ error: "Failed to get categories" });
  }
});

export default router;
