import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { 
  handleDriverAccept, 
  handleDriverReject, 
  updateDriverLocation,
  updateDeliveryStatus,
} from "../services/foodDeliveryDispatchService";
import { 
  driverDeliveryConfig, 
  isDriverBlockedForCashDeliveries,
  getCashBlockingThreshold,
} from "../config/driverDeliveryConfig";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(["driver"]));

async function getDriverProfile(userId: string) {
  return prisma.driverProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
}

async function getDriverWallet(driverId: string) {
  return prisma.driverWallet.findUnique({
    where: { driverId },
  });
}

router.get("/pending", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified || driverProfile.isSuspended) {
      return res.status(403).json({ 
        error: "Driver not eligible for deliveries",
        reason: driverProfile.isSuspended ? "blocked" : "not_verified",
        message: driverProfile.isSuspended 
          ? "Please contact support; your account is currently blocked."
          : "Your account must be verified to receive delivery orders."
      });
    }

    const driverWallet = await getDriverWallet(driverProfile.id);
    const negativeBalance = parseFloat(driverWallet?.negativeBalance?.toString() || "0");
    const countryCode = driverProfile.user.countryCode || "US";
    const isCashBlocked = isDriverBlockedForCashDeliveries(negativeBalance, countryCode);
    const cashBlockingThreshold = getCashBlockingThreshold(countryCode);

    const pendingDeliveries = await prisma.delivery.findMany({
      where: {
        driverId: null,
        status: "searching_driver",
        serviceType: "food",
        countryCode: countryCode,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: driverDeliveryConfig.maxPendingDeliveriesShown,
    });

    const deliveriesWithOrders = await Promise.all(
      pendingDeliveries.map(async (delivery) => {
        const foodOrder = await prisma.foodOrder.findFirst({
          where: { deliveryId: delivery.id },
        });

        const paymentMethod = delivery.paymentMethod || "online";
        const isCashDelivery = paymentMethod.toLowerCase() === "cash";

        return {
          id: delivery.id,
          orderId: foodOrder?.id || null,
          orderCode: foodOrder?.orderCode || null,
          restaurant: delivery.restaurant ? {
            id: delivery.restaurant.id,
            name: delivery.restaurant.restaurantName,
            address: delivery.restaurant.address,
          } : null,
          pickupAddress: delivery.pickupAddress,
          pickupLat: delivery.pickupLat,
          pickupLng: delivery.pickupLng,
          dropoffAddress: delivery.dropoffAddress,
          dropoffLat: delivery.dropoffLat,
          dropoffLng: delivery.dropoffLng,
          estimatedPayout: parseFloat(delivery.driverPayout?.toString() || "0"),
          customerName: delivery.customer?.fullName || "Customer",
          createdAt: delivery.createdAt,
          paymentMethod,
          isCashDelivery,
          canAccept: !isCashDelivery || !isCashBlocked,
          cashBlockedReason: isCashDelivery && isCashBlocked 
            ? `You cannot accept cash deliveries until your balance is settled. Your negative balance (${countryCode === "BD" ? "৳" : "$"}${negativeBalance.toFixed(2)}) exceeds the threshold of ${countryCode === "BD" ? "৳" : "$"}${cashBlockingThreshold}.`
            : null,
        };
      })
    );

    res.json({
      deliveries: deliveriesWithOrders,
      count: deliveriesWithOrders.length,
      driverStatus: {
        isVerified: driverProfile.isVerified,
        isSuspended: driverProfile.isSuspended,
        negativeBalance,
        isCashBlocked,
        cashBlockingThreshold,
        countryCode,
      },
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error fetching pending deliveries:", error);
    res.status(500).json({ error: "Failed to fetch pending deliveries" });
  }
});

router.get("/active", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const activeDeliveries = await prisma.delivery.findMany({
      where: {
        driverId: driverProfile.id,
        status: { in: ["accepted", "picked_up", "on_the_way"] },
        serviceType: "food",
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
            address: true,
          },
        },
        foodOrder: {
          select: {
            id: true,
            orderCode: true,
            deliveryNotesForDriver: true,
          },
        },
      },
      orderBy: { acceptedAt: "desc" },
    });

    const deliveriesWithOrders = activeDeliveries.map((delivery) => {
      const paymentMethod = delivery.paymentMethod || "online";
      const isCashDelivery = paymentMethod.toLowerCase() === "cash";

      return {
        id: delivery.id,
        orderId: delivery.foodOrder?.id || null,
        orderCode: delivery.foodOrder?.orderCode || null,
        status: delivery.status,
        restaurant: delivery.restaurant ? {
          id: delivery.restaurant.id,
          name: delivery.restaurant.restaurantName,
          address: delivery.restaurant.address,
        } : null,
        pickupAddress: delivery.pickupAddress,
        pickupLat: delivery.pickupLat,
        pickupLng: delivery.pickupLng,
        dropoffAddress: delivery.dropoffAddress,
        dropoffLat: delivery.dropoffLat,
        dropoffLng: delivery.dropoffLng,
        estimatedPayout: parseFloat(delivery.driverPayout?.toString() || "0"),
        customer: delivery.customer ? {
          id: delivery.customer.id,
          name: delivery.customer.fullName || "Customer",
          phone: delivery.customer.phoneNumber,
        } : null,
        acceptedAt: delivery.acceptedAt,
        pickedUpAt: delivery.pickedUpAt,
        deliveryNotesForDriver: delivery.foodOrder?.deliveryNotesForDriver || null,
        paymentMethod,
        isCashDelivery,
        canAccept: true,
        cashBlockedReason: null,
      };
    });

    res.json({
      deliveries: deliveriesWithOrders,
      count: deliveriesWithOrders.length,
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error fetching active deliveries:", error);
    res.status(500).json({ error: "Failed to fetch active deliveries" });
  }
});

const acceptSchema = z.object({
  deliveryId: z.string().uuid(),
});

router.post("/accept", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified || driverProfile.isSuspended) {
      return res.status(403).json({ error: "Driver not eligible for deliveries" });
    }

    const validation = acceptSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { deliveryId } = validation.data;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    const paymentMethod = delivery.paymentMethod || "online";
    const isCashDelivery = paymentMethod.toLowerCase() === "cash";

    if (isCashDelivery) {
      const driverWallet = await getDriverWallet(driverProfile.id);
      const negativeBalance = parseFloat(driverWallet?.negativeBalance?.toString() || "0");
      const countryCode = driverProfile.user.countryCode || "US";
      const isCashBlocked = isDriverBlockedForCashDeliveries(negativeBalance, countryCode);

      if (isCashBlocked) {
        const threshold = getCashBlockingThreshold(countryCode);
        return res.status(403).json({
          error: "Cash deliveries blocked",
          message: `You cannot accept cash deliveries. Your negative balance (${countryCode === "BD" ? "৳" : "$"}${negativeBalance.toFixed(2)}) exceeds the threshold of ${countryCode === "BD" ? "৳" : "$"}${threshold}. Please settle your balance first.`,
          isCashBlocked: true,
          negativeBalance,
          threshold,
        });
      }
    }

    const result = await handleDriverAccept(deliveryId, driverProfile.id);

    if (!result.success) {
      const statusCode = result.error?.includes("not found") ? 404 
        : result.error?.includes("already assigned") ? 409 
        : result.error?.includes("Cannot accept") ? 400 
        : 400;
      return res.status(statusCode).json({ error: result.error });
    }

    res.json({
      message: "Delivery accepted successfully",
      deliveryId: result.deliveryId,
      driverAssignmentStatus: result.driverAssignmentStatus,
      eta: result.eta,
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error accepting delivery:", error);
    res.status(500).json({ error: "Failed to accept delivery" });
  }
});

const rejectSchema = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

router.post("/reject", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const validation = rejectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { deliveryId, reason } = validation.data;

    const result = await handleDriverReject(deliveryId, driverProfile.id, reason);

    if (!result.success) {
      const statusCode = result.error?.includes("not found") ? 404 
        : result.error?.includes("another driver") ? 403 
        : 400;
      return res.status(statusCode).json({ error: result.error });
    }

    res.json({
      message: "Delivery rejected",
      deliveryId: result.deliveryId,
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error rejecting delivery:", error);
    res.status(500).json({ error: "Failed to reject delivery" });
  }
});

const statusUpdateSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.enum(["picked_up", "on_the_way", "delivered"]),
});

router.post("/status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const validation = statusUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { deliveryId, status } = validation.data;

    const result = await updateDeliveryStatus(deliveryId, driverProfile.id, status);

    if (!result.success) {
      const statusCode = result.error?.includes("not found") ? 404 
        : result.error?.includes("Not authorized") ? 403 
        : result.error?.includes("Invalid transition") ? 400 
        : 400;
      return res.status(statusCode).json({ error: result.error });
    }

    res.json({
      message: `Delivery status updated to ${status}`,
      status,
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error updating status:", error);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

router.post("/location", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const validation = locationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { lat, lng } = validation.data;

    const result = await updateDriverLocation(driverProfile.id, lat, lng);

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to update location" });
    }

    res.json({
      message: "Location updated",
      lat,
      lng,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error updating location:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

router.get("/history", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;
    const dateFilter = req.query.dateFilter as string | undefined;

    const whereClause: any = {
      driverId: driverProfile.id,
      serviceType: "food",
    };

    if (statusFilter && ["delivered", "cancelled"].includes(statusFilter)) {
      whereClause.status = statusFilter;
    } else {
      whereClause.status = { in: ["delivered", "cancelled"] };
    }

    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      let dateStart: Date;
      
      switch (dateFilter) {
        case "today":
          dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "7days":
          dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30days":
          dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateStart = new Date(0);
      }
      
      whereClause.OR = [
        { deliveredAt: { gte: dateStart } },
        { cancelledAt: { gte: dateStart } },
      ];
    }

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where: whereClause,
        include: {
          restaurant: {
            select: {
              id: true,
              restaurantName: true,
            },
          },
          foodOrder: {
            select: {
              id: true,
              orderCode: true,
            },
          },
        },
        orderBy: { deliveredAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.delivery.count({
        where: whereClause,
      }),
    ]);

    const deliveriesWithOrders = deliveries.map((delivery) => {
      const paymentMethod = delivery.paymentMethod || "online";
      const isCashDelivery = paymentMethod.toLowerCase() === "cash";

      return {
        id: delivery.id,
        orderId: delivery.foodOrder?.id || null,
        orderCode: delivery.foodOrder?.orderCode || null,
        status: delivery.status,
        restaurantName: delivery.restaurant?.restaurantName || null,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        earnings: parseFloat(delivery.driverPayout?.toString() || "0"),
        deliveredAt: delivery.deliveredAt,
        acceptedAt: delivery.acceptedAt,
        paymentMethod,
        isCashDelivery,
      };
    });

    res.json({
      deliveries: deliveriesWithOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch delivery history" });
  }
});

router.get("/:deliveryId", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { deliveryId } = req.params;
    const driverProfile = await getDriverProfile(userId);

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
            address: true,
          },
        },
        foodOrder: {
          select: {
            id: true,
            orderCode: true,
            deliveryNotesForDriver: true,
            items: true,
          },
        },
      },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (delivery.driverId && delivery.driverId !== driverProfile.id) {
      return res.status(403).json({ error: "Not authorized to view this delivery" });
    }

    const paymentMethod = delivery.paymentMethod || "online";
    const isCashDelivery = paymentMethod.toLowerCase() === "cash";

    res.json({
      id: delivery.id,
      orderId: delivery.foodOrder?.id || null,
      orderCode: delivery.foodOrder?.orderCode || null,
      status: delivery.status,
      restaurant: delivery.restaurant ? {
        id: delivery.restaurant.id,
        name: delivery.restaurant.restaurantName,
        address: delivery.restaurant.address,
      } : null,
      pickupAddress: delivery.pickupAddress,
      pickupLat: delivery.pickupLat,
      pickupLng: delivery.pickupLng,
      dropoffAddress: delivery.dropoffAddress,
      dropoffLat: delivery.dropoffLat,
      dropoffLng: delivery.dropoffLng,
      estimatedPayout: parseFloat(delivery.driverPayout?.toString() || "0"),
      customer: delivery.customer ? {
        id: delivery.customer.id,
        name: delivery.customer.fullName || "Customer",
        phone: delivery.customer.phoneNumber,
      } : null,
      acceptedAt: delivery.acceptedAt,
      pickedUpAt: delivery.pickedUpAt,
      deliveredAt: delivery.deliveredAt,
      deliveryNotesForDriver: delivery.foodOrder?.deliveryNotesForDriver || null,
      items: delivery.foodOrder ? (
        typeof delivery.foodOrder.items === 'string' 
          ? JSON.parse(delivery.foodOrder.items) 
          : delivery.foodOrder.items
      ) : [],
      paymentMethod,
      isCashDelivery,
    });
  } catch (error) {
    console.error("[Driver Food Delivery] Error fetching delivery:", error);
    res.status(500).json({ error: "Failed to fetch delivery details" });
  }
});

export default router;
