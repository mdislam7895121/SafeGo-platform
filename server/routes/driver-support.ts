import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { getDriverSupportContext } from "../utils/support-helpers";
import { driverLiveChatService } from "../services/GenericLiveChatService";
import { driverCallbackService } from "../services/GenericSupportCallbackService";
import { supportArticleService } from "../services/SupportArticleService";
import { DriverSupportCategory } from "@prisma/client";
import { safeAuditLogCreate } from "../utils/audit";

const router = Router();

// All routes require authentication and driver role
router.use(authenticateToken);
router.use(requireRole(["driver"]));

/**
 * Support Categories Configuration
 * Uber-style categories with subcategories for driver support
 */
const SUPPORT_CATEGORIES = {
  account_documents: {
    label: "Account & Documents",
    description: "Profile, KYC, documents, account settings",
    icon: "FileText",
    subcategories: [
      { value: "profile_update", label: "Update profile information" },
      { value: "document_upload", label: "Document upload issues" },
      { value: "document_verification", label: "Document verification status" },
      { value: "account_access", label: "Account access problems" },
      { value: "account_deactivation", label: "Account deactivation" },
      { value: "background_check", label: "Background check questions" },
    ]
  },
  trip_issues: {
    label: "Trip Issues",
    description: "Ride problems, cancellations, customer complaints",
    icon: "Car",
    subcategories: [
      { value: "wrong_route", label: "Wrong route taken" },
      { value: "customer_complaint", label: "Customer complaint" },
      { value: "trip_adjustment", label: "Trip fare adjustment" },
      { value: "cancellation_fee", label: "Cancellation fee dispute" },
      { value: "trip_safety", label: "Safety incident during trip" },
      { value: "trip_not_started", label: "Trip didn't start properly" },
      { value: "navigation_issue", label: "Navigation/GPS issues" },
    ]
  },
  payment_earnings: {
    label: "Payment & Earnings",
    description: "Payouts, earnings, payment methods",
    icon: "DollarSign",
    subcategories: [
      { value: "missing_payment", label: "Missing payment" },
      { value: "payout_issue", label: "Payout processing issue" },
      { value: "earnings_question", label: "Earnings calculation question" },
      { value: "payment_method", label: "Payment method setup" },
      { value: "tax_documents", label: "Tax documents" },
      { value: "instant_pay", label: "Instant pay issues" },
    ]
  },
  incentives_promotions: {
    label: "Incentives & Promotions",
    description: "Bonuses, promotions, rewards questions",
    icon: "Gift",
    subcategories: [
      { value: "bonus_not_received", label: "Bonus not received" },
      { value: "promotion_eligibility", label: "Promotion eligibility" },
      { value: "quest_issue", label: "Quest/challenge not tracking" },
      { value: "referral_bonus", label: "Referral bonus question" },
      { value: "points_issue", label: "SafeGo Points issue" },
    ]
  },
  safety_emergency: {
    label: "Safety & Emergency",
    description: "Safety concerns, accidents, emergency support",
    icon: "Shield",
    subcategories: [
      { value: "accident_report", label: "Report an accident" },
      { value: "safety_concern", label: "Safety concern" },
      { value: "harassment", label: "Harassment incident" },
      { value: "vehicle_damage", label: "Vehicle damage" },
      { value: "emergency_assistance", label: "Emergency assistance needed" },
    ]
  },
  app_technical: {
    label: "App & Technical",
    description: "App issues, bugs, technical problems",
    icon: "Smartphone",
    subcategories: [
      { value: "app_crash", label: "App crashing" },
      { value: "login_issue", label: "Login problems" },
      { value: "gps_issue", label: "GPS/location issues" },
      { value: "notification_issue", label: "Notification problems" },
      { value: "feature_request", label: "Feature request" },
      { value: "other_technical", label: "Other technical issue" },
    ]
  },
};

/**
 * Generate unique ticket code
 */
async function generateTicketCode(): Promise<string> {
  const year = new Date().getFullYear();
  const lastTicket = await prisma.driverSupportTicket.findFirst({
    where: { ticketCode: { startsWith: "DST" } },
    orderBy: { createdAt: "desc" },
    select: { ticketCode: true }
  });

  let nextNumber = 1;
  if (lastTicket?.ticketCode) {
    const match = lastTicket.ticketCode.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  return `DST-${year}-${String(nextNumber).padStart(6, "0")}`;
}

/**
 * GET /api/driver/support-center/support-categories
 * Get all support categories with subcategories
 */
router.get("/support-center/support-categories", async (req: AuthRequest, res: Response) => {
  try {
    const categories = Object.entries(SUPPORT_CATEGORIES).map(([key, value]) => ({
      value: key,
      ...value
    }));
    return res.json({ categories });
  } catch (error) {
    console.error("Error getting support categories:", error);
    return res.status(500).json({ error: "Failed to get categories" });
  }
});

/**
 * GET /api/driver/support-center/tickets
 * List driver's support tickets with filtering
 */
router.get("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const context = await getDriverSupportContext(userId);
    
    const { status, category, limit = "20", offset = "0" } = req.query;
    
    const whereClause: any = { driverId: context.profileId };
    if (status && status !== "all") {
      whereClause.status = status;
    }
    if (category && category !== "all") {
      whereClause.category = category as DriverSupportCategory;
    }

    const [tickets, total] = await Promise.all([
      prisma.driverSupportTicket.findMany({
        where: whereClause,
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { messages: true } }
        },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.driverSupportTicket.count({ where: whereClause })
    ]);

    return res.json({ tickets, total, pagination: { limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error: any) {
    console.error("Error listing driver support tickets:", error);
    if (error.message.includes("verification required") || error.message.includes("suspended")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to list tickets" });
  }
});

/**
 * GET /api/driver/support-center/tickets/:id
 * Get specific ticket with messages and timeline
 */
router.get("/support-center/tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const context = await getDriverSupportContext(userId);

    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        statusHistory: { 
          orderBy: { createdAt: "asc" },
          include: { changedBy: { select: { email: true } } }
        },
        driver: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.driverId !== context.profileId) {
      return res.status(403).json({ error: "Access denied: You can only view your own tickets" });
    }

    // Return ticket without admin-only fields
    const { adminNotes, assignedAdminId, ...publicTicket } = ticket;
    return res.json({ ticket: publicTicket });
  } catch (error: any) {
    console.error("Error getting driver support ticket:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to get ticket" });
  }
});

/**
 * POST /api/driver/support-center/tickets
 * Create a new support ticket with enhanced fields
 */
router.post("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subject, category, subcategory, tripId, priority, description, channel, attachmentUrls } = req.body;

    if (!subject || !category || !description) {
      return res.status(400).json({ error: "Subject, category, and description are required" });
    }

    // Validate category
    if (!Object.keys(SUPPORT_CATEGORIES).includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const [context, user] = await Promise.all([
      getDriverSupportContext(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ticketCode = await generateTicketCode();

    // Create ticket with status history in a transaction
    const ticket = await prisma.$transaction(async (tx) => {
      const newTicket = await tx.driverSupportTicket.create({
        data: {
          ticketCode,
          driverId: context.profileId,
          subject,
          category: category as DriverSupportCategory,
          subcategory: subcategory || null,
          tripId: tripId || null,
          priority: priority || "normal",
          status: "open",
          description,
          channel: channel || "web",
          attachmentUrls: attachmentUrls || null
        },
        include: { messages: true }
      });

      // Create initial status history entry
      await tx.driverSupportStatusHistory.create({
        data: {
          ticketId: newTicket.id,
          previousStatus: null,
          newStatus: "open",
          changedByRole: "system",
          note: "Ticket created"
        }
      });

      return newTicket;
    });

    await safeAuditLogCreate({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "driver",
        ipAddress: req.ip || "",
        actionType: "support_ticket_created",
        entityType: "driver_support_ticket",
        entityId: ticket.id,
        description: `Driver created support ticket ${ticket.ticketCode}`,
        metadata: {
          ticketCode: ticket.ticketCode,
          category: ticket.category,
          subcategory: ticket.subcategory,
          priority: ticket.priority,
          driverProfileId: context.profileId,
          driverName: context.displayName,
          tripId: tripId || null
        },
        success: true
      }
    });

    return res.status(201).json({ ticket });
  } catch (error: any) {
    console.error("Error creating driver support ticket:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

/**
 * POST /api/driver/support-center/tickets/:id/messages
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

    const context = await getDriverSupportContext(userId);

    // Verify ownership
    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, driverId: true, status: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.driverId !== context.profileId) {
      return res.status(403).json({ error: "Access denied: You can only add messages to your own tickets" });
    }

    if (ticket.status === "closed") {
      return res.status(400).json({ error: "Cannot add messages to closed tickets" });
    }

    const message = await prisma.driverSupportMessage.create({
      data: {
        ticketId,
        senderRole: "driver",
        senderName: context.displayName,
        messageBody: messageBody.trim(),
        attachmentUrls: attachmentUrls || null
      }
    });

    // Update ticket timestamp
    await prisma.driverSupportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error adding driver support message:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to add message" });
  }
});

/**
 * GET /api/driver/support-center/recent-trips
 * Get recent trips for association with support tickets
 */
router.get("/support-center/recent-trips", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const context = await getDriverSupportContext(userId);
    
    // Return empty array for now - trips table would need to exist
    // This is a placeholder for when ride/delivery history is available
    return res.json({ trips: [] });
  } catch (error: any) {
    console.error("Error getting recent trips:", error);
    return res.status(500).json({ error: "Failed to get recent trips" });
  }
});

/**
 * POST /api/driver/support-center/live-chat/start
 * Start a live chat session
 */
router.post("/support-center/live-chat/start", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { initialMessage } = req.body;
    const context = await getDriverSupportContext(userId);

    const session = await driverLiveChatService.startSession({
      profileId: context.profileId,
      customerName: context.displayName,
      initialMessage
    });

    return res.status(201).json({ session });
  } catch (error: any) {
    console.error("Error starting driver live chat:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to start chat session" });
  }
});

/**
 * GET /api/driver/support-center/live-chat/:sessionId
 * Get live chat session
 */
router.get("/support-center/live-chat/:sessionId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;
    const context = await getDriverSupportContext(userId);

    const session = await driverLiveChatService.getSession(sessionId, context.profileId);
    return res.json({ session });
  } catch (error: any) {
    console.error("Error getting driver live chat session:", error);
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
 * POST /api/driver/support-center/live-chat/:sessionId/messages
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

    const context = await getDriverSupportContext(userId);

    const message = await driverLiveChatService.sendMessage({
      sessionId,
      profileId: context.profileId,
      senderRole: "driver",
      senderName: context.displayName,
      messageBody
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error sending driver live chat message:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * POST /api/driver/support-center/live-chat/:sessionId/end
 * End live chat session
 */
router.post("/support-center/live-chat/:sessionId/end", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;
    const context = await getDriverSupportContext(userId);

    const session = await driverLiveChatService.endSession(sessionId, context.profileId);
    return res.json({ session });
  } catch (error: any) {
    console.error("Error ending driver live chat session:", error);
    if (error.message.includes("verification required") || error.message.includes("Access denied")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to end chat session" });
  }
});

/**
 * POST /api/driver/support-center/callbacks
 * Request phone callback
 */
router.post("/support-center/callbacks", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { phoneNumber, preferredTime, timezone, reason } = req.body;

    if (!phoneNumber || !preferredTime || !timezone || !reason) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const context = await getDriverSupportContext(userId);

    const callback = await driverCallbackService.requestCallback({
      profileId: context.profileId,
      phoneNumber,
      preferredTime,
      timezone,
      reason
    });

    return res.status(201).json({ callback });
  } catch (error: any) {
    console.error("Error requesting driver callback:", error);
    if (error.message.includes("verification required")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to request callback" });
  }
});

/**
 * GET /api/driver/support-center/articles
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
 * GET /api/driver/support-center/articles/:slug
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
 * GET /api/driver/support-center/categories
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
