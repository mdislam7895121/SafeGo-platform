import { Router, type Response } from "express";
import { prisma } from "../db";
import { loadAdminProfile, type AuthRequest } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";

const router = Router();

// All routes require authentication, admin role, and admin profile loaded
router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

/**
 * GET /api/admin/support/tickets
 * List all support tickets with comprehensive filtering
 */
router.get("/support/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const {
      serviceType,
      restaurantId,
      customerId,
      driverId,
      countryCode,
      priority,
      customerStatus,
      internalStatus,
      category,
      search,
      page = "1",
      limit = "50"
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 200);
    const skip = (pageNum - 1) * limitNum;

    // Build filter conditions
    const where: any = {};

    if (serviceType && typeof serviceType === "string") {
      where.serviceType = serviceType;
    }
    if (restaurantId && typeof restaurantId === "string") {
      where.restaurantId = restaurantId;
    }
    if (customerId && typeof customerId === "string") {
      where.customerId = customerId;
    }
    if (driverId && typeof driverId === "string") {
      where.driverId = driverId;
    }
    if (countryCode && typeof countryCode === "string") {
      where.countryCode = countryCode;
    }
    if (priority && typeof priority === "string") {
      where.priority = priority;
    }
    if (customerStatus && typeof customerStatus === "string") {
      where.customerVisibleStatus = customerStatus;
    }
    if (internalStatus && typeof internalStatus === "string") {
      where.internalStatus = internalStatus;
    }
    if (category && typeof category === "string") {
      where.issueCategory = category;
    }
    if (search && typeof search === "string") {
      where.OR = [
        { ticketCode: { contains: search, mode: "insensitive" } },
        { issueDescription: { contains: search, mode: "insensitive" } }
      ];
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
        include: {
          customer: {
            select: {
              id: true,
              fullName: true
            }
          },
          restaurant: {
            select: {
              id: true,
              restaurantName: true
            }
          },
          driver: {
            select: {
              id: true,
              user: {
                select: {
                  email: true
                }
              }
            }
          },
          _count: {
            select: { messages: true }
          }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    return res.json({
      tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("Error listing admin support tickets:", error);
    return res.status(500).json({ error: "Failed to list support tickets" });
  }
});

/**
 * GET /api/admin/support/tickets/:id
 * Get full ticket details including all messages (public and internal)
 */
router.get("/support/tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = req.params.id;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        restaurant: {
          select: {
            id: true,
            restaurantName: true
          }
        },
        driver: {
          select: {
            id: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: "asc" }
        },
        financialAdjustments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    return res.json({ ticket });
  } catch (error) {
    console.error("Error getting admin support ticket:", error);
    return res.status(500).json({ error: "Failed to get support ticket" });
  }
});

/**
 * PATCH /api/admin/support/tickets/:id/status
 * Update ticket status - admin has full control
 */
router.patch("/support/tickets/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.adminUser!.id;
    const adminEmail = req.adminUser!.email;
    const ticketId = req.params.id;
    const { customerVisibleStatus, internalStatus, priority, resolutionNotes } = req.body;

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Build update data
    const updateData: any = {};
    if (customerVisibleStatus) updateData.customerVisibleStatus = customerVisibleStatus;
    if (internalStatus) updateData.internalStatus = internalStatus;
    if (priority) updateData.priority = priority;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;

    // If closing or resolving, set timestamp
    if (customerVisibleStatus === "closed" || customerVisibleStatus === "resolved") {
      updateData.resolvedAt = new Date();
    }

    // Update ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorEmail: adminEmail,
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "support_ticket_admin_status_change",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Admin changed ticket ${ticket.ticketCode} status`,
        metadata: {
          previousInternalStatus: ticket.internalStatus,
          newInternalStatus: internalStatus,
          previousCustomerStatus: ticket.customerVisibleStatus,
          newCustomerStatus: customerVisibleStatus,
          previousPriority: ticket.priority,
          newPriority: priority
        },
        success: true
      }
    });

    return res.json({ ticket: updatedTicket });
  } catch (error) {
    console.error("Error updating admin support ticket status:", error);
    return res.status(500).json({ error: "Failed to update ticket status" });
  }
});

/**
 * POST /api/admin/support/tickets/:id/messages
 * Add admin message/reply to ticket
 */
router.post("/support/tickets/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.adminUser!.id;
    const adminEmail = req.adminUser!.email;
    const ticketId = req.params.id;
    // NOTE: actorRole is ALWAYS "admin" for admin messages - never accept from request
    const { messageBody, messageType = "public", attachmentUrls = [] } = req.body;

    // Validate input
    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    // Validate messageType
    if (messageType !== "public" && messageType !== "internal") {
      return res.status(400).json({ error: "Invalid message type" });
    }

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Create message
    const message = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        messageBody: messageBody.trim(),
        messageType: messageType === "internal" ? "internal" : "public",
        actorRole: "admin",
        actorId: adminUserId,
        attachmentUrls: attachmentUrls || []
      }
    });

    // Update ticket if public message
    if (messageType === "public") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          updatedAt: new Date()
        }
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorEmail: adminEmail,
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: messageType === "internal" ? "support_ticket_admin_internal_note" : "support_ticket_admin_reply",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Admin ${messageType === "internal" ? "added internal note" : "replied"} to ticket ${ticket.ticketCode}`,
        metadata: {
          messageId: message.id
        },
        success: true
      }
    });

    return res.status(201).json({
      id: message.id,
      actorRole: message.actorRole,
      messageBody: message.messageBody,
      messageType: message.messageType,
      createdAt: message.createdAt
    });
  } catch (error) {
    console.error("Error creating admin support message:", error);
    return res.status(500).json({ error: "Failed to create message" });
  }
});

/**
 * POST /api/admin/support/tickets/:id/financial-adjustment
 * Create financial adjustment (refund, charge, etc)
 */
router.post("/support/tickets/:id/financial-adjustment", async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.adminUser!.id;
    const adminEmail = req.adminUser!.email;
    const ticketId = req.params.id;
    const { adjustmentType, amount, currency = "USD", notes } = req.body;

    // Validate input
    if (!adjustmentType || !amount || !notes) {
      return res.status(400).json({ error: "Adjustment type, amount, and notes are required" });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Create financial adjustment
    const adjustment = await prisma.financialAdjustment.create({
      data: {
        ticketId,
        serviceType: ticket.serviceType,
        serviceId: ticket.serviceId,
        restaurantId: ticket.restaurantId,
        driverId: ticket.driverId,
        adjustmentType,
        amount: parseFloat(amount),
        currency,
        notes,
        createdByAdminId: adminUserId,
        approvedByAdminId: adminUserId,
        approvedAt: new Date()
      }
    });

    // Update ticket with approved refund amount
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        refundApprovedAmount: parseFloat(amount),
        internalStatus: "refund_approved",
        customerVisibleStatus: "resolved"
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorEmail: adminEmail,
        actorRole: "admin",
        ipAddress: req.ip || "",
        actionType: "support_ticket_financial_adjustment",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Admin approved ${adjustmentType} of ${currency} ${amount} for ticket ${ticket.ticketCode}`,
        metadata: {
          adjustmentId: adjustment.id,
          adjustmentType,
          amount,
          currency,
          notes
        },
        success: true
      }
    });

    return res.status(201).json({ adjustment });
  } catch (error) {
    console.error("Error creating financial adjustment:", error);
    return res.status(500).json({ error: "Failed to create financial adjustment" });
  }
});

export default router;
