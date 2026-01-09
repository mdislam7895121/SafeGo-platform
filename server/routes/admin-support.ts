import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { getAdminSupportContext } from "../utils/support-helpers";
import { adminSupportService } from "../services/GenericSupportService";
import { adminLiveChatService } from "../services/GenericLiveChatService";
import { adminCallbackService } from "../services/GenericSupportCallbackService";
import { supportArticleService } from "../services/SupportArticleService";
import { safeAuditLogCreate } from "../utils/audit";

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

    await safeAuditLogCreate({
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
    const query = (req.query.query as string) || "";
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
    const categories = await supportArticleService.getAllCategories();
    return res.json({ categories });
  } catch (error) {
    console.error("Error getting categories:", error);
    return res.status(500).json({ error: "Failed to get categories" });
  }
});

// ============================================
// DRIVER SUPPORT TICKET MANAGEMENT (D8)
// Admin routes for managing driver support tickets
// ============================================

/**
 * GET /api/admin/support-center/driver-tickets
 * List all driver support tickets (admin view)
 */
router.get("/support-center/driver-tickets", async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, priority, driverId, search, limit = "20", offset = "0" } = req.query;
    
    const whereClause: any = {};
    
    if (status && status !== "all") {
      whereClause.status = status;
    }
    if (category && category !== "all") {
      whereClause.category = category;
    }
    if (priority && priority !== "all") {
      whereClause.priority = priority;
    }
    if (driverId) {
      whereClause.driverId = driverId;
    }
    if (search) {
      whereClause.OR = [
        { ticketCode: { contains: search as string, mode: "insensitive" } },
        { subject: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } }
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.driverSupportTicket.findMany({
        where: whereClause,
        include: {
          driver: {
            select: { 
              id: true,
              firstName: true, 
              lastName: true,
              phoneNumber: true
            }
          },
          assignedAdmin: {
            select: { email: true }
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { messages: true } }
        },
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" }
        ],
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.driverSupportTicket.count({ where: whereClause })
    ]);

    // Get counts by status for dashboard
    const statusCounts = await prisma.driverSupportTicket.groupBy({
      by: ["status"],
      _count: { status: true }
    });

    return res.json({ 
      tickets, 
      total,
      statusCounts: statusCounts.reduce((acc: any, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      pagination: { 
        limit: parseInt(limit as string), 
        offset: parseInt(offset as string) 
      } 
    });
  } catch (error: any) {
    console.error("Error listing driver support tickets (admin):", error);
    return res.status(500).json({ error: "Failed to list driver tickets" });
  }
});

/**
 * GET /api/admin/support-center/driver-tickets/:id
 * Get specific driver ticket with full details (admin view)
 */
router.get("/support-center/driver-tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = req.params.id;

    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      include: {
        driver: {
          select: { 
            id: true,
            firstName: true, 
            lastName: true,
            phoneNumber: true,
            email: true,
            city: true,
            countryCode: true
          }
        },
        assignedAdmin: {
          select: { id: true, email: true }
        },
        messages: { 
          orderBy: { createdAt: "asc" }
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          include: {
            changedBy: { select: { email: true } }
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.json({ ticket });
  } catch (error: any) {
    console.error("Error getting driver support ticket (admin):", error);
    return res.status(500).json({ error: "Failed to get ticket" });
  }
});

/**
 * PATCH /api/admin/support-center/driver-tickets/:id/status
 * Update driver ticket status
 */
router.patch("/support-center/driver-tickets/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, ticketCode: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    // Update ticket and create status history in transaction
    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updated = await tx.driverSupportTicket.update({
        where: { id: ticketId },
        data: {
          status,
          resolvedAt: status === "resolved" || status === "closed" ? new Date() : null,
          updatedAt: new Date()
        }
      });

      await tx.driverSupportStatusHistory.create({
        data: {
          ticketId,
          previousStatus: ticket.status,
          newStatus: status,
          changedById: userId,
          changedByRole: "admin",
          note: note || null
        }
      });

      return updated;
    });

    // Create audit log
    await safeAuditLogCreate({
      data: {
        actorId: userId,
        actorEmail: user?.email || "",
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "driver_ticket_status_updated",
        entityType: "driver_support_ticket",
        entityId: ticketId,
        description: `Admin updated driver ticket ${ticket.ticketCode} status from ${ticket.status} to ${status}`,
        metadata: {
          ticketCode: ticket.ticketCode,
          previousStatus: ticket.status,
          newStatus: status,
          note
        },
        success: true
      }
    });

    return res.json({ ticket: updatedTicket, message: "Status updated successfully" });
  } catch (error: any) {
    console.error("Error updating driver ticket status:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

/**
 * PATCH /api/admin/support-center/driver-tickets/:id/admin-notes
 * Update internal admin notes (not visible to driver)
 */
router.patch("/support-center/driver-tickets/:id/admin-notes", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { adminNotes } = req.body;

    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketCode: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const updatedTicket = await prisma.driverSupportTicket.update({
      where: { id: ticketId },
      data: { adminNotes, updatedAt: new Date() }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    await safeAuditLogCreate({
      data: {
        actorId: userId,
        actorEmail: user?.email || "",
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "driver_ticket_notes_updated",
        entityType: "driver_support_ticket",
        entityId: ticketId,
        description: `Admin updated internal notes for ticket ${ticket.ticketCode}`,
        metadata: { ticketCode: ticket.ticketCode },
        success: true
      }
    });

    return res.json({ ticket: updatedTicket, message: "Notes updated successfully" });
  } catch (error: any) {
    console.error("Error updating admin notes:", error);
    return res.status(500).json({ error: "Failed to update notes" });
  }
});

/**
 * PATCH /api/admin/support-center/driver-tickets/:id/assign
 * Assign ticket to an admin
 */
router.patch("/support-center/driver-tickets/:id/assign", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { assignedAdminId } = req.body;

    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketCode: true, assignedAdminId: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Validate admin exists if assigning
    if (assignedAdminId) {
      const admin = await prisma.user.findUnique({
        where: { id: assignedAdminId, role: "admin" }
      });
      if (!admin) {
        return res.status(400).json({ error: "Invalid admin ID" });
      }
    }

    const updatedTicket = await prisma.driverSupportTicket.update({
      where: { id: ticketId },
      data: {
        assignedAdminId: assignedAdminId || null,
        updatedAt: new Date()
      },
      include: {
        assignedAdmin: { select: { email: true } }
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    await safeAuditLogCreate({
      data: {
        actorId: userId,
        actorEmail: user?.email || "",
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "driver_ticket_assigned",
        entityType: "driver_support_ticket",
        entityId: ticketId,
        description: assignedAdminId 
          ? `Ticket ${ticket.ticketCode} assigned to admin`
          : `Ticket ${ticket.ticketCode} unassigned`,
        metadata: { 
          ticketCode: ticket.ticketCode,
          previousAssignee: ticket.assignedAdminId,
          newAssignee: assignedAdminId
        },
        success: true
      }
    });

    return res.json({ ticket: updatedTicket, message: "Assignment updated successfully" });
  } catch (error: any) {
    console.error("Error assigning ticket:", error);
    return res.status(500).json({ error: "Failed to assign ticket" });
  }
});

/**
 * POST /api/admin/support-center/driver-tickets/:id/messages
 * Admin reply to driver ticket
 */
router.post("/support-center/driver-tickets/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { messageBody, attachmentUrls } = req.body;

    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const ticket = await prisma.driverSupportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, ticketCode: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    const message = await prisma.driverSupportMessage.create({
      data: {
        ticketId,
        senderRole: "support",
        senderName: user?.email || "Support Team",
        messageBody: messageBody.trim(),
        attachmentUrls: attachmentUrls || null
      }
    });

    // Update ticket timestamp
    await prisma.driverSupportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    await safeAuditLogCreate({
      data: {
        actorId: userId,
        actorEmail: user?.email || "",
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "driver_ticket_reply",
        entityType: "driver_support_message",
        entityId: message.id,
        description: `Admin replied to driver ticket ${ticket.ticketCode}`,
        metadata: { ticketCode: ticket.ticketCode, messageId: message.id },
        success: true
      }
    });

    return res.status(201).json({ message });
  } catch (error: any) {
    console.error("Error adding admin reply:", error);
    return res.status(500).json({ error: "Failed to add reply" });
  }
});

/**
 * GET /api/admin/support-center/driver-tickets/stats
 * Get driver support ticket statistics
 */
router.get("/support-center/driver-tickets-stats", async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      recentTickets
    ] = await Promise.all([
      prisma.driverSupportTicket.count(),
      prisma.driverSupportTicket.count({ where: { status: "open" } }),
      prisma.driverSupportTicket.count({ where: { status: "in_progress" } }),
      prisma.driverSupportTicket.count({ where: { status: "resolved" } }),
      prisma.driverSupportTicket.count({ where: { status: "closed" } }),
      prisma.driverSupportTicket.count({ where: { priority: "urgent", status: { not: "closed" } } }),
      prisma.driverSupportTicket.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    // Category breakdown
    const categoryBreakdown = await prisma.driverSupportTicket.groupBy({
      by: ["category"],
      _count: { category: true }
    });

    return res.json({
      stats: {
        total: totalTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets,
        urgent: urgentTickets,
        last24Hours: recentTickets
      },
      categoryBreakdown: categoryBreakdown.map(item => ({
        category: item.category,
        count: item._count.category
      }))
    });
  } catch (error: any) {
    console.error("Error getting driver ticket stats:", error);
    return res.status(500).json({ error: "Failed to get statistics" });
  }
});

export default router;
