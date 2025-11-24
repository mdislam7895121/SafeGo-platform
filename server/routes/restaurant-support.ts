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
 * GET /api/restaurant/support/tickets
 * List support tickets related to restaurant's food orders
 */
router.get("/support/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        isVerified: true,
        verificationStatus: true,
        restaurantName: true,
        ownerRole: true,
        canReplySupport: true,
        staffActive: true,
        isSuspended: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify restaurant KYC
    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ 
        error: "Restaurant verification required to access support system" 
      });
    }

    // Check support access permission (OWNER or STAFF+canReplySupport)
    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ 
        error: "You do not have permission to access support tickets. Please contact the restaurant owner." 
      });
    }

    // Parse query parameters for filtering
    const { status, priority, category, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build filter conditions
    const where: any = {
      restaurantId: restaurantProfile.id,
      serviceType: "food_order"
    };

    if (status && typeof status === "string") {
      where.customerVisibleStatus = status;
    }
    if (priority && typeof priority === "string") {
      where.priority = priority;
    }
    if (category && typeof category === "string") {
      where.issueCategory = category;
    }

    // Get tickets with pagination
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" }
        ],
        select: {
          id: true,
          ticketCode: true,
          serviceType: true,
          serviceId: true,
          issueCategory: true,
          customerVisibleStatus: true,
          internalStatus: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { messages: true }
          },
          customer: {
            select: {
              fullName: true
            }
          }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    // Mask customer identity
    const sanitizedTickets = tickets.map(ticket => ({
      ...ticket,
      customer: {
        maskedName: ticket.customer.fullName ? ticket.customer.fullName[0] + "***" : "***"
      }
    }));

    return res.json({
      tickets: sanitizedTickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("Error listing restaurant support tickets:", error);
    return res.status(500).json({ error: "Failed to list support tickets" });
  }
});

/**
 * GET /api/restaurant/support/tickets/:id
 * Get ticket details with messages
 */
router.get("/support/tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        ownerRole: true,
        canReplySupport: true,
        staffActive: true,
        isSuspended: true,
        isVerified: true,
        verificationStatus: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify KYC
    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    // Check support access permission
    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to access support tickets" });
    }

    // Get ticket (DO NOT include customer relation to prevent privacy leaks)
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          where: {
            OR: [
              { messageType: "public" },
              { actorRole: "restaurant_owner" },
              { actorRole: "restaurant_staff" }
            ]
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            messageBody: true,
            messageType: true,
            actorRole: true,
            attachmentUrls: true,
            createdAt: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Verify ownership
    if (ticket.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get customer for masked display only (separate query to control exposure)
    const customer = await prisma.customerProfile.findUnique({
      where: { id: ticket.customerId },
      select: { fullName: true }
    });

    // Sanitize response - NEVER expose real customer identity to restaurants
    const sanitizedTicket = {
      ...ticket,
      customer: {
        maskedName: customer?.fullName ? customer.fullName[0] + "***" : "C***"
      },
      // Remove customerId from response
      customerId: undefined
    };

    return res.json({ ticket: sanitizedTicket });
  } catch (error) {
    console.error("Error getting restaurant support ticket:", error);
    return res.status(500).json({ error: "Failed to get support ticket" });
  }
});

/**
 * POST /api/restaurant/support/tickets/:id/messages
 * Add a message/reply to a ticket
 */
router.post("/support/tickets/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    // NOTE: actorRole is NEVER accepted from request body - always server-derived for security
    const { messageBody, attachmentUrls = [], messageType = "public" } = req.body;

    // Validate input
    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    // Validate messageType
    if (messageType !== "public" && messageType !== "internal") {
      return res.status(400).json({ error: "Invalid message type" });
    }

    // Get restaurant profile and user
    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true,
          isVerified: true,
          verificationStatus: true
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

    // Verify KYC
    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    // Check support access permission (can view and reply)
    if (!checkSupportAccess(restaurantProfile, false)) {
      return res.status(403).json({ error: "You do not have permission to reply to support tickets" });
    }

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Verify ownership
    if (ticket.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Cannot reply to closed tickets
    if (ticket.customerVisibleStatus === "closed") {
      return res.status(400).json({ error: "Cannot reply to closed tickets" });
    }

    // Determine actor role
    const role = restaurantProfile.ownerRole || "OWNER";
    const actorRole = role === "OWNER" ? "restaurant_owner" : "restaurant_staff";

    // Create message
    const message = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        messageBody: messageBody.trim(),
        messageType: messageType === "internal" ? "internal" : "public",
        actorRole,
        actorId: userId,
        attachmentUrls: attachmentUrls || []
      }
    });

    // Update ticket status if public reply
    if (messageType === "public") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          internalStatus: "assigned_restaurant",
          updatedAt: new Date()
        }
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: actorRole,
        ipAddress: req.ip || "",
        actionType: messageType === "internal" ? "support_ticket_internal_note" : "support_ticket_reply",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Restaurant ${messageType === "internal" ? "added internal note" : "replied"} to ticket ${ticket.ticketCode}`,
        metadata: {
          messageId: message.id,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    // Send notifications (non-blocking)
    const ticketData = {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      serviceType: ticket.serviceType,
      customerId: ticket.customerId,
      restaurantId: ticket.restaurantId,
      driverId: ticket.driverId,
      issueCategory: ticket.issueCategory,
      internalStatus: ticket.internalStatus,
      priority: ticket.priority,
      country: ticket.countryCode,
    };
    
    notifyTicketReply(ticketData, "RESTAURANT", messageBody.trim(), messageType === "internal").catch((error) => {
      console.error("Failed to send restaurant reply notification:", error);
    });

    return res.status(201).json({
      id: message.id,
      actorRole: message.actorRole,
      messageBody: message.messageBody,
      messageType: message.messageType,
      createdAt: message.createdAt
    });
  } catch (error) {
    console.error("Error creating restaurant support message:", error);
    return res.status(500).json({ error: "Failed to create message" });
  }
});

/**
 * PATCH /api/restaurant/support/tickets/:id/status
 * Update ticket status (limited options for restaurants)
 */
router.patch("/support/tickets/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { internalStatus, customerVisibleStatus, resolutionNotes } = req.body;

    // Get restaurant profile and user
    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true,
          isVerified: true,
          verificationStatus: true
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

    // Verify KYC
    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    // Status update requires OWNER role only
    if (!checkSupportAccess(restaurantProfile, true)) {
      return res.status(403).json({ error: "Only restaurant owners can update ticket status" });
    }

    // Check permission (only OWNER can change status)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role !== "OWNER") {
      return res.status(403).json({ error: "Only restaurant owner can change ticket status" });
    }

    // Validate status values (restaurants have limited options)
    const allowedInternalStatuses = ["assigned_restaurant", "refund_pending"];
    const allowedCustomerStatuses = ["in_review", "awaiting_customer", "resolved"];

    if (internalStatus && !allowedInternalStatuses.includes(internalStatus)) {
      return res.status(400).json({ error: "Invalid internal status for restaurant" });
    }

    if (customerVisibleStatus && !allowedCustomerStatuses.includes(customerVisibleStatus)) {
      return res.status(400).json({ error: "Invalid customer visible status for restaurant" });
    }

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Verify ownership
    if (ticket.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update ticket
    const updateData: any = {};
    if (internalStatus) updateData.internalStatus = internalStatus;
    if (customerVisibleStatus) updateData.customerVisibleStatus = customerVisibleStatus;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "support_ticket_status_change",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Restaurant owner changed ticket ${ticket.ticketCode} status`,
        metadata: {
          previousInternalStatus: ticket.internalStatus,
          newInternalStatus: internalStatus,
          previousCustomerStatus: ticket.customerVisibleStatus,
          newCustomerStatus: customerVisibleStatus,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    return res.json({ ticket: updatedTicket });
  } catch (error) {
    console.error("Error updating restaurant support ticket status:", error);
    return res.status(500).json({ error: "Failed to update ticket status" });
  }
});

/**
 * POST /api/restaurant/support/tickets/:id/proposed-resolution
 * Propose a resolution (refund, replacement, etc) - requires admin approval
 * OWNER ONLY - requires elevated permission
 */
router.post("/support/tickets/:id/proposed-resolution", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { proposedResolution, proposedAmount, proposedNote } = req.body;

    // Get restaurant profile and user
    const [restaurantProfile, user] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          restaurantName: true,
          ownerRole: true,
          canReplySupport: true,
          staffActive: true,
          isSuspended: true,
          isVerified: true,
          verificationStatus: true
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

    // Verify KYC
    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Restaurant verification required" });
    }

    // Proposing resolution requires OWNER role only
    if (!checkSupportAccess(restaurantProfile, true)) {
      return res.status(403).json({ error: "Only restaurant owners can propose resolutions" });
    }

    // Validate input
    if (!proposedResolution || !proposedNote) {
      return res.status(400).json({ error: "Proposed resolution and note are required" });
    }

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Verify ownership
    if (ticket.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update ticket with proposed resolution
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        internalStatus: "refund_pending",
        proposedResolution,
        resolutionNotes: proposedNote,
        refundRequestedAmount: proposedAmount ? parseFloat(proposedAmount) : null
      }
    });

    // Create internal message about proposal
    await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        messageBody: `[Restaurant Proposed Resolution]\nType: ${proposedResolution}\n${proposedAmount ? `Amount: ${proposedAmount}\n` : ''}Note: ${proposedNote}`,
        messageType: "internal",
        actorRole: "restaurant_owner",
        actorId: userId,
        attachmentUrls: []
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "restaurant_owner",
        ipAddress: req.ip || "",
        actionType: "support_ticket_propose_resolution",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Restaurant proposed resolution for ticket ${ticket.ticketCode}`,
        metadata: {
          proposedResolution,
          proposedAmount,
          proposedNote,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.restaurantName
        },
        success: true
      }
    });

    return res.json({ ticket: updatedTicket });
  } catch (error) {
    console.error("Error proposing restaurant support resolution:", error);
    return res.status(500).json({ error: "Failed to propose resolution" });
  }
});

/**
 * ===========================
 * RESTAURANT SUPPORT CENTER ROUTES
 * (Phase 12.5: General support tickets for restaurant-initiated requests)
 * ===========================
 */

import { restaurantSupportService } from "../services/RestaurantSupportService";

/**
 * GET /api/restaurant/support-center/tickets
 * List restaurant's support center tickets (general support requests)
 */
router.get("/support-center/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, restaurantName: true }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
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
      select: { id: true, restaurantName: true }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
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
 * Create a new support center ticket
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
        select: { id: true, restaurantName: true }
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

    const ticket = await restaurantSupportService.createTicket({
      restaurantId: restaurantProfile.id,
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
 * Add a message to a support center ticket
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
        select: { id: true, restaurantName: true }
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

    const message = await restaurantSupportService.addMessage({
      ticketId,
      restaurantId: restaurantProfile.id,
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

export default router;
