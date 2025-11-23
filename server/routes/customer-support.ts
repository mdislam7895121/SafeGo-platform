import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, type AuthRequest } from "../middleware/auth";

const router = Router();

// Helper function to generate unique ticket code
async function generateTicketCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.supportTicket.count();
  const paddedCount = String(count + 1).padStart(6, "0");
  return `SG-SUP-${year}-${paddedCount}`;
}

// Helper function to get customer ID from user
async function getCustomerIdFromUser(userId: string): Promise<string | null> {
  const customer = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return customer?.id || null;
}

// Helper function to mask customer name for privacy
function maskCustomerName(name: string): string {
  if (!name || name.length < 3) return "***";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

/**
 * POST /api/customer/support/tickets
 * Create a new support ticket
 */
router.post("/tickets", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify customer is verified (KYC requirement)
    if (!customer.isVerified) {
      return res.status(403).json({ 
        error: "Account verification required to create support tickets" 
      });
    }

    const {
      serviceType,
      serviceId,
      issueCategory,
      issueDescription,
      photoUrls,
      priority,
    } = req.body;

    // Validate required fields
    if (!serviceType || !serviceId || !issueCategory || !issueDescription) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate service type
    if (!["food_order", "ride", "delivery"].includes(serviceType)) {
      return res.status(400).json({ error: "Invalid service type" });
    }

    // Verify service ownership and get details
    let service: any = null;
    let restaurantId: string | null = null;
    let driverId: string | null = null;
    let countryCode: string = customer.user.countryCode;
    let cityCode: string | null = customer.cityCode;

    if (serviceType === "food_order") {
      service = await prisma.foodOrder.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        return res.status(404).json({ error: "Food order not found" });
      }

      if (service.customerId !== customer.id) {
        return res.status(403).json({ 
          error: "You can only create tickets for your own orders" 
        });
      }

      restaurantId = service.restaurantId;
      driverId = service.driverId;
    } else if (serviceType === "ride") {
      service = await prisma.ride.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        return res.status(404).json({ error: "Ride not found" });
      }

      if (service.customerId !== customer.id) {
        return res.status(403).json({ 
          error: "You can only create tickets for your own rides" 
        });
      }

      driverId = service.driverId;
      countryCode = service.countryCode || countryCode;
      cityCode = service.cityCode || cityCode;
    } else if (serviceType === "delivery") {
      service = await prisma.delivery.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        return res.status(404).json({ error: "Delivery not found" });
      }

      if (service.customerId !== customer.id) {
        return res.status(403).json({ 
          error: "You can only create tickets for your own deliveries" 
        });
      }

      driverId = service.driverId;
    }

    // Check for duplicate tickets (rate limiting - max 3 tickets per service)
    const existingTicketCount = await prisma.supportTicket.count({
      where: {
        serviceType,
        serviceId,
        customerId: customer.id,
      },
    });

    if (existingTicketCount >= 3) {
      return res.status(429).json({ 
        error: "Maximum number of tickets reached for this service" 
      });
    }

    // Generate ticket code
    const ticketCode = await generateTicketCode();

    // Create support ticket
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketCode,
        serviceType,
        serviceId,
        restaurantId,
        customerId: customer.id,
        driverId,
        countryCode,
        cityCode,
        issueCategory,
        issueDescription,
        photoUrls: photoUrls || [],
        customerVisibleStatus: "open",
        internalStatus: restaurantId ? "assigned_restaurant" : "new",
        priority: priority || "medium",
        originChannel: "web",
      },
    });

    // Create initial message
    await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        actorId: userId,
        actorRole: "customer",
        messageType: "public",
        messageBody: issueDescription,
        attachmentUrls: photoUrls || [],
      },
    });

    // Update service with ticket count
    const updateData = {
      supportTicketCount: existingTicketCount + 1,
      lastSupportStatus: "open",
    };

    if (serviceType === "food_order") {
      await prisma.foodOrder.update({
        where: { id: serviceId },
        data: updateData,
      });
    } else if (serviceType === "ride") {
      await prisma.ride.update({
        where: { id: serviceId },
        data: updateData,
      });
    } else if (serviceType === "delivery") {
      await prisma.delivery.update({
        where: { id: serviceId },
        data: updateData,
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: customer.user.email,
        actorRole: "customer",
        ipAddress: req.ip || "",
        actionType: "support_ticket_created",
        entityType: "support_ticket",
        entityId: ticket.id,
        description: `Customer created support ticket ${ticketCode} for ${serviceType} ${serviceId}`,
        metadata: {
          ticketCode,
          serviceType,
          serviceId,
          issueCategory,
          customerId: customer.id,
        },
        success: true,
      },
    });

    // TODO: Send notifications to restaurant/admin

    return res.status(201).json({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      serviceType: ticket.serviceType,
      customerVisibleStatus: ticket.customerVisibleStatus,
      issueCategory: ticket.issueCategory,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
    });
  } catch (error) {
    console.error("[Customer Support] Error creating ticket:", error);
    return res.status(500).json({ error: "Failed to create support ticket" });
  }
});

/**
 * GET /api/customer/support/tickets/my
 * List customer's support tickets
 */
router.get("/tickets/my", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const customerId = await getCustomerIdFromUser(userId);
    if (!customerId) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const { status, serviceType, page = "1", limit = "20" } = req.query;

    const where: any = {
      customerId,
    };

    if (status && typeof status === "string") {
      where.customerVisibleStatus = status;
    }

    if (serviceType && typeof serviceType === "string") {
      where.serviceType = serviceType;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [tickets, totalCount] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
        select: {
          id: true,
          ticketCode: true,
          serviceType: true,
          serviceId: true,
          issueCategory: true,
          customerVisibleStatus: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return res.json({
      tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error("[Customer Support] Error listing tickets:", error);
    return res.status(500).json({ error: "Failed to list support tickets" });
  }
});

/**
 * GET /api/customer/support/tickets/:id
 * Get ticket details with messages
 */
router.get("/tickets/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const customerId = await getCustomerIdFromUser(userId);
    if (!customerId) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const { id } = req.params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          where: {
            OR: [
              { messageType: "public" },
              { actorId: userId }, // Customer can see their own messages
            ],
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            actorId: true,
            actorRole: true,
            messageType: true,
            messageBody: true,
            attachmentUrls: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Verify ownership
    if (ticket.customerId !== customerId) {
      return res.status(403).json({ 
        error: "You can only view your own support tickets" 
      });
    }

    // Remove internal status from customer view
    const { internalStatus, ...ticketData } = ticket;

    return res.json(ticketData);
  } catch (error) {
    console.error("[Customer Support] Error getting ticket:", error);
    return res.status(500).json({ error: "Failed to get support ticket" });
  }
});

/**
 * POST /api/customer/support/tickets/:id/messages
 * Add a message/reply to a ticket
 */
router.post("/tickets/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const customerId = await getCustomerIdFromUser(userId);
    if (!customerId) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const { id } = req.params;
    const { messageBody, attachmentUrls } = req.body;

    if (!messageBody || messageBody.trim().length === 0) {
      return res.status(400).json({ error: "Message body is required" });
    }

    // Get customer email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get ticket and verify ownership
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    if (ticket.customerId !== customerId) {
      return res.status(403).json({ 
        error: "You can only reply to your own support tickets" 
      });
    }

    // Check if ticket is closed
    if (ticket.customerVisibleStatus === "closed") {
      return res.status(400).json({ 
        error: "Cannot add messages to a closed ticket" 
      });
    }

    // Create message
    const message = await prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        actorId: userId,
        actorRole: "customer",
        messageType: "public",
        messageBody: messageBody.trim(),
        attachmentUrls: attachmentUrls || [],
      },
    });

    // Update ticket status if it was resolved
    if (ticket.customerVisibleStatus === "resolved") {
      await prisma.supportTicket.update({
        where: { id },
        data: {
          customerVisibleStatus: "awaiting_customer",
          updatedAt: new Date(),
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email,
        actorRole: "customer",
        ipAddress: req.ip || "",
        actionType: "support_ticket_reply",
        entityType: "support_ticket",
        entityId: ticket.id,
        description: `Customer replied to support ticket ${ticket.ticketCode}`,
        metadata: {
          ticketCode: ticket.ticketCode,
          messageId: message.id,
        },
        success: true,
      },
    });

    // TODO: Send notification to restaurant/admin

    return res.status(201).json({
      id: message.id,
      actorRole: message.actorRole,
      messageBody: message.messageBody,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("[Customer Support] Error adding message:", error);
    return res.status(500).json({ error: "Failed to add message" });
  }
});

export default router;
