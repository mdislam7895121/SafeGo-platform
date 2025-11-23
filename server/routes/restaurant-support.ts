import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication and restaurant role
router.use(authenticateToken);
router.use(requireRole(["restaurant"]));

/**
 * Helper function to check if restaurant staff has support permissions
 */
async function hasRestaurantSupportPermission(
  restaurantProfile: any
): Promise<boolean> {
  const role = restaurantProfile.ownerRole || "OWNER";
  
  if (role === "OWNER") return true;
  
  // Check if staff has permission
  if (role === "STAFF" && restaurantProfile.staffId) {
    const staff = await prisma.restaurantStaff.findUnique({
      where: { id: restaurantProfile.staffId },
      select: { canHandleSupport: true }
    });
    return staff?.canHandleSupport || false;
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
        country: true,
        city: true,
        name: true,
        ownerRole: true,
        staffId: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permission
    const hasPermission = await hasRestaurantSupportPermission(restaurantProfile);
    if (!hasPermission) {
      return res.status(403).json({ error: "No permission to access support tickets" });
    }

    // Verify restaurant KYC
    if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "APPROVED") {
      return res.status(403).json({ 
        error: "Restaurant verification required to access support system" 
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
      serviceType: "FOOD"
    };

    if (status) {
      where.customerVisibleStatus = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (category) {
      where.category = category;
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
          serviceReferenceId: true,
          category: true,
          subject: true,
          customerVisibleStatus: true,
          internalStatus: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          lastCustomerReplyAt: true,
          lastProviderReplyAt: true,
          _count: {
            select: { messages: true }
          },
          customer: {
            select: {
              user: {
                select: {
                  fullName: true
                }
              }
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
        maskedName: ticket.customer.user.fullName[0] + "***"
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
        staffId: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permission
    const hasPermission = await hasRestaurantSupportPermission(restaurantProfile);
    if (!hasPermission) {
      return res.status(403).json({ error: "No permission to access support tickets" });
    }

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: {
          select: {
            user: {
              select: {
                fullName: true,
                email: true
              }
            }
          }
        },
        messages: {
          where: {
            OR: [
              { visibility: "PUBLIC" },
              { actorRole: "RESTAURANT" }
            ]
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            messageType: true,
            actorRole: true,
            actorDisplayName: true,
            attachmentUrls: true,
            visibility: true,
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

    // Mask customer identity
    const sanitizedTicket = {
      ...ticket,
      customer: {
        maskedName: ticket.customer.user.fullName[0] + "***",
        maskedEmail: ticket.customer.user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      }
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
    const userEmail = req.user!.email;
    const ticketId = req.params.id;
    const { content, messageType = "TEXT", attachmentUrls = [], visibility = "PUBLIC" } = req.body;

    // Validate input
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        ownerRole: true,
        staffId: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permission
    const hasPermission = await hasRestaurantSupportPermission(restaurantProfile);
    if (!hasPermission) {
      return res.status(403).json({ error: "No permission to reply to support tickets" });
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
    if (ticket.internalStatus === "CLOSED") {
      return res.status(400).json({ error: "Cannot reply to closed tickets" });
    }

    // Create message
    const message = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        content: content.trim(),
        messageType,
        actorRole: "RESTAURANT",
        actorId: restaurantProfile.staffId || restaurantProfile.id,
        actorDisplayName: restaurantProfile.name,
        attachmentUrls,
        visibility
      }
    });

    // Update ticket
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        lastProviderReplyAt: new Date(),
        internalStatus: visibility === "PUBLIC" ? "AWAITING_CUSTOMER" : ticket.internalStatus
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: restaurantProfile.id,
        actorEmail: userEmail,
        actorRole: "RESTAURANT_STAFF",
        actionType: visibility === "PUBLIC" ? "SUPPORT_TICKET_REPLY" : "SUPPORT_TICKET_INTERNAL_NOTE",
        targetType: "SupportTicket",
        targetId: ticketId,
        metadata: {
          messageId: message.id,
          messageType,
          visibility,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.name
        }
      }
    });

    return res.status(201).json({ message });
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
    const userEmail = req.user!.email;
    const ticketId = req.params.id;
    const { internalStatus, customerVisibleStatus, resolutionNote } = req.body;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        ownerRole: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permission (only OWNER can change status)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role !== "OWNER") {
      return res.status(403).json({ error: "Only restaurant owner can change ticket status" });
    }

    // Validate status values
    const allowedInternalStatuses = ["IN_REVIEW", "AWAITING_ADMIN", "RESOLVED"];
    const allowedCustomerStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"];

    if (internalStatus && !allowedInternalStatuses.includes(internalStatus)) {
      return res.status(400).json({ error: "Invalid internal status" });
    }

    if (customerVisibleStatus && !allowedCustomerStatuses.includes(customerVisibleStatus)) {
      return res.status(400).json({ error: "Invalid customer visible status" });
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
    if (resolutionNote) updateData.resolutionNote = resolutionNote;

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: restaurantProfile.id,
        actorEmail: userEmail,
        actorRole: "RESTAURANT_OWNER",
        actionType: "SUPPORT_TICKET_STATUS_CHANGE",
        targetType: "SupportTicket",
        targetId: ticketId,
        metadata: {
          previousInternalStatus: ticket.internalStatus,
          newInternalStatus: internalStatus,
          previousCustomerStatus: ticket.customerVisibleStatus,
          newCustomerStatus: customerVisibleStatus,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.name
        }
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
 * Propose a resolution (refund, replacement, etc)
 */
router.post("/support/tickets/:id/proposed-resolution", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userEmail = req.user!.email;
    const ticketId = req.params.id;
    const { resolutionType, proposedAmount, proposedNote } = req.body;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        ownerRole: true
      }
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permission (only OWNER can propose resolution)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role !== "OWNER") {
      return res.status(403).json({ error: "Only restaurant owner can propose resolution" });
    }

    // Validate input
    if (!resolutionType || !proposedNote) {
      return res.status(400).json({ error: "Resolution type and note are required" });
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
        internalStatus: "AWAITING_ADMIN",
        resolutionNote: proposedNote,
        metadata: {
          ...(ticket.metadata as object || {}),
          proposedResolution: {
            type: resolutionType,
            amount: proposedAmount,
            note: proposedNote,
            proposedAt: new Date().toISOString(),
            proposedBy: restaurantProfile.id
          }
        }
      }
    });

    // Create internal message about proposal
    await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        content: `[Restaurant Proposed Resolution]\nType: ${resolutionType}\n${proposedAmount ? `Amount: ${proposedAmount}\n` : ''}Note: ${proposedNote}`,
        messageType: "TEXT",
        actorRole: "RESTAURANT",
        actorId: restaurantProfile.id,
        actorDisplayName: restaurantProfile.name,
        visibility: "INTERNAL"
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: restaurantProfile.id,
        actorEmail: userEmail,
        actorRole: "RESTAURANT_OWNER",
        actionType: "SUPPORT_TICKET_PROPOSE_RESOLUTION",
        targetType: "SupportTicket",
        targetId: ticketId,
        metadata: {
          resolutionType,
          proposedAmount,
          proposedNote,
          restaurantId: restaurantProfile.id,
          restaurantName: restaurantProfile.name
        }
      }
    });

    return res.json({ ticket: updatedTicket });
  } catch (error) {
    console.error("Error proposing restaurant support resolution:", error);
    return res.status(500).json({ error: "Failed to propose resolution" });
  }
});

export default router;
