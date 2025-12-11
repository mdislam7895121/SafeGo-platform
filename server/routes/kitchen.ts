import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { getPhase3Features } from "../config/phase3Features";

const router = Router();

router.use(authenticateToken);

// ============================================================
// PHASE 3: Kitchen Ticket System for Restaurant Order Management
// ============================================================

// ====================================================
// GET /api/kitchen/tickets
// Get all kitchen tickets for the restaurant (restaurant role)
// ====================================================
router.get("/tickets", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: { select: { countryCode: true } } },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const countryCode = restaurant.user?.countryCode || "US";
    const features = await getPhase3Features(countryCode);

    if (!features.kitchenSystemEnabled) {
      return res.status(403).json({ error: "Kitchen system is not enabled" });
    }

    const whereClause: any = { restaurantId: restaurant.id };
    if (status) {
      whereClause.status = status;
    }

    const tickets = await prisma.kitchenTicket.findMany({
      where: whereClause,
      include: {
        foodOrder: {
          select: {
            id: true,
            orderCode: true,
            items: true,
            status: true,
            specialInstructions: true,
            createdAt: true,
            customer: {
              select: {
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
      take: Number(limit),
      skip: Number(offset),
    });

    const counts = await prisma.kitchenTicket.groupBy({
      by: ["status"],
      where: { restaurantId: restaurant.id },
      _count: true,
    });

    const statusCounts = {
      queued: 0,
      in_progress: 0,
      ready: 0,
      picked_up: 0,
    };

    counts.forEach((c) => {
      statusCounts[c.status as keyof typeof statusCounts] = c._count;
    });

    res.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        foodOrderId: t.foodOrderId,
        status: t.status,
        prepTimeEstimateMinutes: t.prepTimeEstimateMinutes,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        handedToDriverAt: t.handedToDriverAt,
        notes: t.notes,
        priority: t.priority,
        createdAt: t.createdAt,
        order: {
          id: t.foodOrder.id,
          orderCode: t.foodOrder.orderCode,
          items: t.foodOrder.items,
          status: t.foodOrder.status,
          specialInstructions: t.foodOrder.specialInstructions,
          createdAt: t.foodOrder.createdAt,
          customerName: t.foodOrder.customer?.fullName || "Guest",
          customerPhone: t.foodOrder.customer?.phoneNumber,
        },
      })),
      statusCounts,
    });
  } catch (error: any) {
    console.error("[Kitchen] Error fetching tickets:", error);
    res.status(500).json({ error: error.message || "Failed to fetch kitchen tickets" });
  }
});

// ====================================================
// GET /api/kitchen/tickets/:id
// Get a specific kitchen ticket
// ====================================================
router.get("/tickets/:id", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: ticketId, restaurantId: restaurant.id },
      include: {
        foodOrder: {
          select: {
            id: true,
            orderCode: true,
            items: true,
            status: true,
            specialInstructions: true,
            deliveryAddress: true,
            deliveryAddressLat: true,
            deliveryAddressLng: true,
            createdAt: true,
            customer: {
              select: {
                fullName: true,
                phoneNumber: true,
              },
            },
            driver: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Kitchen ticket not found" });
    }

    res.json({
      ticket: {
        id: ticket.id,
        foodOrderId: ticket.foodOrderId,
        status: ticket.status,
        prepTimeEstimateMinutes: ticket.prepTimeEstimateMinutes,
        startedAt: ticket.startedAt,
        completedAt: ticket.completedAt,
        handedToDriverAt: ticket.handedToDriverAt,
        notes: ticket.notes,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        order: {
          id: ticket.foodOrder.id,
          orderCode: ticket.foodOrder.orderCode,
          items: ticket.foodOrder.items,
          status: ticket.foodOrder.status,
          specialInstructions: ticket.foodOrder.specialInstructions,
          deliveryAddress: ticket.foodOrder.deliveryAddress,
          customerName: ticket.foodOrder.customer?.fullName || "Guest",
          customerPhone: ticket.foodOrder.customer?.phoneNumber,
          driverName: ticket.foodOrder.driver
            ? `${ticket.foodOrder.driver.firstName || ""} ${ticket.foodOrder.driver.lastName || ""}`.trim()
            : null,
          driverPhone: ticket.foodOrder.driver?.phoneNumber,
          createdAt: ticket.foodOrder.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error fetching ticket:", error);
    res.status(500).json({ error: error.message || "Failed to fetch kitchen ticket" });
  }
});

// Ticket status update schema
const ticketStatusSchema = z.object({
  status: z.enum(["queued", "in_progress", "ready", "picked_up"]),
  prepTimeEstimateMinutes: z.number().min(1).max(180).optional(),
  notes: z.string().max(500).optional(),
});

// ====================================================
// PATCH /api/kitchen/tickets/:id
// Update kitchen ticket status
// ====================================================
router.patch("/tickets/:id", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;

    const validationResult = ticketStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { status, prepTimeEstimateMinutes, notes } = validationResult.data;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const existingTicket = await prisma.kitchenTicket.findFirst({
      where: { id: ticketId, restaurantId: restaurant.id },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: "Kitchen ticket not found" });
    }

    const updateData: any = { status };

    if (prepTimeEstimateMinutes !== undefined) {
      updateData.prepTimeEstimateMinutes = prepTimeEstimateMinutes;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === "in_progress" && !existingTicket.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === "ready" && !existingTicket.completedAt) {
      updateData.completedAt = new Date();
    }

    if (status === "picked_up" && !existingTicket.handedToDriverAt) {
      updateData.handedToDriverAt = new Date();
    }

    const updated = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    if (status === "ready") {
      await prisma.foodOrder.update({
        where: { id: existingTicket.foodOrderId },
        data: { status: "ready_for_pickup" },
      });
    }

    res.json({
      success: true,
      ticket: {
        id: updated.id,
        status: updated.status,
        prepTimeEstimateMinutes: updated.prepTimeEstimateMinutes,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
        handedToDriverAt: updated.handedToDriverAt,
        notes: updated.notes,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error updating ticket:", error);
    res.status(500).json({ error: error.message || "Failed to update kitchen ticket" });
  }
});

// ====================================================
// POST /api/kitchen/tickets/:id/start
// Start preparing an order (shortcut endpoint)
// ====================================================
router.post("/tickets/:id/start", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { prepTimeEstimateMinutes } = req.body;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: ticketId, restaurantId: restaurant.id },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Kitchen ticket not found" });
    }

    if (ticket.status !== "queued") {
      return res.status(400).json({ error: "Ticket must be in queued status to start" });
    }

    const updated = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: {
        status: "in_progress",
        startedAt: new Date(),
        prepTimeEstimateMinutes: prepTimeEstimateMinutes || restaurant.prepTimeDefaultMinutes || 20,
      },
    });

    await prisma.foodOrder.update({
      where: { id: ticket.foodOrderId },
      data: { status: "preparing" },
    });

    res.json({
      success: true,
      ticket: {
        id: updated.id,
        status: updated.status,
        startedAt: updated.startedAt,
        prepTimeEstimateMinutes: updated.prepTimeEstimateMinutes,
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error starting ticket:", error);
    res.status(500).json({ error: error.message || "Failed to start kitchen ticket" });
  }
});

// ====================================================
// POST /api/kitchen/tickets/:id/complete
// Mark order as ready for pickup (shortcut endpoint)
// ====================================================
router.post("/tickets/:id/complete", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: ticketId, restaurantId: restaurant.id },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Kitchen ticket not found" });
    }

    if (ticket.status !== "in_progress") {
      return res.status(400).json({ error: "Ticket must be in progress to complete" });
    }

    const updated = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: {
        status: "ready",
        completedAt: new Date(),
      },
    });

    await prisma.foodOrder.update({
      where: { id: ticket.foodOrderId },
      data: { status: "ready_for_pickup" },
    });

    res.json({
      success: true,
      ticket: {
        id: updated.id,
        status: updated.status,
        completedAt: updated.completedAt,
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error completing ticket:", error);
    res.status(500).json({ error: error.message || "Failed to complete kitchen ticket" });
  }
});

// ====================================================
// POST /api/kitchen/tickets/:id/handoff
// Mark order as handed to driver (shortcut endpoint)
// ====================================================
router.post("/tickets/:id/handoff", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: ticketId, restaurantId: restaurant.id },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Kitchen ticket not found" });
    }

    if (ticket.status !== "ready") {
      return res.status(400).json({ error: "Ticket must be ready to hand off" });
    }

    const updated = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: {
        status: "picked_up",
        handedToDriverAt: new Date(),
      },
    });

    await prisma.foodOrder.update({
      where: { id: ticket.foodOrderId },
      data: { status: "picked_up" },
    });

    res.json({
      success: true,
      ticket: {
        id: updated.id,
        status: updated.status,
        handedToDriverAt: updated.handedToDriverAt,
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error handing off ticket:", error);
    res.status(500).json({ error: error.message || "Failed to hand off kitchen ticket" });
  }
});

// ====================================================
// PATCH /api/kitchen/tickets/:id/priority
// Update ticket priority
// ====================================================
router.patch("/tickets/:id/priority", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const ticketId = req.params.id;
    const { priority } = req.body;

    if (typeof priority !== "number" || priority < 0 || priority > 10) {
      return res.status(400).json({ error: "Priority must be a number between 0 and 10" });
    }

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: ticketId, restaurantId: restaurant.id },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Kitchen ticket not found" });
    }

    const updated = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: { priority },
    });

    res.json({
      success: true,
      ticket: {
        id: updated.id,
        priority: updated.priority,
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error updating priority:", error);
    res.status(500).json({ error: error.message || "Failed to update ticket priority" });
  }
});

// ====================================================
// GET /api/kitchen/settings
// Get kitchen settings for restaurant
// ====================================================
router.get("/settings", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        prepTimeDefaultMinutes: true,
        isAcceptingOrders: true,
        kitchenStatus: true,
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json({
      settings: {
        prepTimeDefaultMinutes: restaurant.prepTimeDefaultMinutes || 20,
        isAcceptingOrders: restaurant.isAcceptingOrders ?? true,
        kitchenStatus: restaurant.kitchenStatus || "normal",
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error fetching settings:", error);
    res.status(500).json({ error: error.message || "Failed to fetch kitchen settings" });
  }
});

// ====================================================
// PATCH /api/kitchen/settings
// Update kitchen settings
// ====================================================
const kitchenSettingsSchema = z.object({
  prepTimeDefaultMinutes: z.number().min(5).max(120).optional(),
  isAcceptingOrders: z.boolean().optional(),
  kitchenStatus: z.enum(["normal", "busy", "paused"]).optional(),
});

router.patch("/settings", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = kitchenSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const updated = await prisma.restaurantProfile.update({
      where: { id: restaurant.id },
      data: {
        ...(data.prepTimeDefaultMinutes !== undefined && { prepTimeDefaultMinutes: data.prepTimeDefaultMinutes }),
        ...(data.isAcceptingOrders !== undefined && { isAcceptingOrders: data.isAcceptingOrders }),
        ...(data.kitchenStatus !== undefined && { kitchenStatus: data.kitchenStatus }),
      },
    });

    res.json({
      success: true,
      settings: {
        prepTimeDefaultMinutes: updated.prepTimeDefaultMinutes,
        isAcceptingOrders: updated.isAcceptingOrders,
        kitchenStatus: updated.kitchenStatus,
      },
    });
  } catch (error: any) {
    console.error("[Kitchen] Error updating settings:", error);
    res.status(500).json({ error: error.message || "Failed to update kitchen settings" });
  }
});

export default router;
