import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { getAdminSupportContext } from "../utils/support-helpers";
import { adminSupportService } from "../services/GenericSupportService";
import { adminLiveChatService } from "../services/GenericLiveChatService";
import { adminCallbackService } from "../services/GenericSupportCallbackService";
import { supportArticleService } from "../services/SupportArticleService";

const router = Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(["admin"]));

/**
 * GET /api/admin/support-center/tickets
 * List admin's support tickets
 */
router.get("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const context = await getAdminSupportContext(userId);
    
    const tickets = await adminSupportService.listTickets(context.profileId);
    return res.json({ tickets });
  } catch (error: any) {
    console.error("Error listing admin support tickets:", error);
    if (error.message.includes("verification required") || error.message.includes("suspended")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to list tickets" });
  }
});

/**
 * GET /api/admin/support-center/tickets/:id
 * Get specific ticket with messages
 */
router.get("/support-center/tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const context = await getAdminSupportContext(userId);

    const ticket = await adminSupportService.getTicketById(ticketId, context.profileId);
    return res.json({ ticket });
  } catch (error: any) {
    console.error("Error getting admin support ticket:", error);
    if (error.message === "Access denied: You can only view your own tickets") {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Ticket not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get ticket" });
  }
});

/**
 * POST /api/admin/support-center/tickets
 * Create a new support ticket
 */
router.post("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subject, category, priority, description, channel, attachmentUrls } = req.body;

    if (!subject || !category || !description) {
      return res.status(400).json({ error: "Subject, category, and description are required" });
    }

    const [context, user] = await Promise.all([
      getAdminSupportContext(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ticket = await adminSupportService.createTicket({
      profileId: context.profileId,
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
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "support_ticket_created",
        entityType: "admin_support_ticket",
        entityId: ticket.id,
        description: `Admin created support ticket ${ticket.ticketCode}`,
        metadata: {
          ticketCode: ticket.ticketCode,
          category: ticket.category,
          priority: ticket.priority,
          adminProfileId: context.profileId,
          adminName: context.displayName
        },
        success: true
      }
    });

    return res.status(201).json({ ticket });
  } catch (error: any) {
    console.error("Error creating admin support ticket:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

/**
 * POST /api/admin/support-center/tickets/:id/messages
 * Add a message to a ticket
 */
router.post("/support-center/tickets/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { messageBody, attachmentUrls } = req.body;

    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const context = await getAdminSupportContext(userId);

    const message = await adminSupportService.addMessage({
      ticketId,
      profileId: context.profileId,
      senderRole: context.senderRole,
      senderName: context.displayName,
      messageBody,
      attachmentUrls
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error adding admin support message:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to add message" });
  }
});

/**
 * POST /api/admin/support-center/live-chat/start
 * Start a live chat session
 */
router.post("/support-center/live-chat/start", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { initialMessage } = req.body;
    const context = await getAdminSupportContext(userId);

    const session = await adminLiveChatService.startSession({
      profileId: context.profileId,
      customerName: context.displayName,
      initialMessage
    });

    return res.status(201).json({ session });
  } catch (error: any) {
    console.error("Error starting admin live chat:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to start chat session" });
  }
});

/**
 * GET /api/admin/support-center/live-chat/:sessionId
 * Get live chat session
 */
router.get("/support-center/live-chat/:sessionId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;
    const context = await getAdminSupportContext(userId);

    const session = await adminLiveChatService.getSession(sessionId, context.profileId);
    return res.json({ session });
  } catch (error: any) {
    console.error("Error getting admin live chat session:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Chat session not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get chat session" });
  }
});

/**
 * POST /api/admin/support-center/live-chat/:sessionId/messages
 * Send message in live chat
 */
router.post("/support-center/live-chat/:sessionId/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;
    const { messageBody } = req.body;

    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const context = await getAdminSupportContext(userId);

    const message = await adminLiveChatService.sendMessage({
      sessionId,
      profileId: context.profileId,
      senderRole: "restaurant",
      senderName: context.displayName,
      messageBody
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error sending admin live chat message:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * POST /api/admin/support-center/live-chat/:sessionId/end
 * End live chat session
 */
router.post("/support-center/live-chat/:sessionId/end", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;
    const context = await getAdminSupportContext(userId);

    const session = await adminLiveChatService.endSession(sessionId, context.profileId);
    return res.json({ session });
  } catch (error: any) {
    console.error("Error ending admin live chat session:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to end chat session" });
  }
});

/**
 * POST /api/admin/support-center/callbacks
 * Request phone callback
 */
router.post("/support-center/callbacks", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { phoneNumber, preferredTime, timezone, reason } = req.body;

    if (!phoneNumber || !preferredTime || !timezone || !reason) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const context = await getAdminSupportContext(userId);

    const callback = await adminCallbackService.requestCallback({
      profileId: context.profileId,
      phoneNumber,
      preferredTime,
      timezone,
      reason
    });

    return res.status(201).json({ callback });
  } catch (error: any) {
    console.error("Error requesting admin callback:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to request callback" });
  }
});

/**
 * GET /api/admin/support-center/articles
 * Search support articles
 */
router.get("/support-center/articles", async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.query as string | undefined;
    const category = req.query.category as string | undefined;

    const articles = await supportArticleService.searchArticles(query, category);
    return res.json({ articles });
  } catch (error) {
    console.error("Error searching articles:", error);
    return res.status(500).json({ error: "Failed to search articles" });
  }
});

/**
 * GET /api/admin/support-center/articles/:slug
 * Get article by slug
 */
router.get("/support-center/articles/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug;
    const article = await supportArticleService.getArticleBySlug(slug);
    return res.json({ article });
  } catch (error: any) {
    console.error("Error getting article:", error);
    if (error.message === "Article not found" || error.message === "Article not available") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get article" });
  }
});

/**
 * GET /api/admin/support-center/categories
 * Get article categories
 */
router.get("/support-center/categories", async (req: AuthRequest, res: Response) => {
  try {
    const categories = await supportArticleService.getCategories();
    return res.json({ categories });
  } catch (error) {
    console.error("Error getting categories:", error);
    return res.status(500).json({ error: "Failed to get categories" });
  }
});

export default router;
