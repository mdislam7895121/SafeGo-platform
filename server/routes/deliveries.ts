import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, AuthRequest, requireUnlockedAccount } from "../middleware/auth";
import { walletService } from "../services/walletService";
import { promotionBonusService } from "../services/promotionBonusService";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ====================================================
// POST /api/deliveries
// Create a new parcel delivery request (customer only)
// Locked accounts cannot request parcel deliveries
// ====================================================
router.post("/", requireUnlockedAccount, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can request parcel deliveries" });
    }

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      parcelDescription,
      serviceFare,
      paymentMethod,
    } = req.body;

    // Validation
    if (!pickupAddress || !pickupLat || !pickupLng || !dropoffAddress || !dropoffLat || !dropoffLng || !parcelDescription || !serviceFare || !paymentMethod) {
      return res.status(400).json({ error: "All delivery details are required" });
    }

    if (!["cash", "online"].includes(paymentMethod)) {
      return res.status(400).json({ error: "paymentMethod must be 'cash' or 'online'" });
    }

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (!customerProfile.isVerified) {
      return res.status(403).json({ error: "Customer must be verified to request deliveries" });
    }

    // Calculate commission (20% for now - can be made configurable later)
    const commissionRate = 0.20;
    const safegoCommission = parseFloat(serviceFare) * commissionRate;
    const driverPayout = parseFloat(serviceFare) - safegoCommission;

    // Create delivery
    const delivery = await prisma.delivery.create({
      data: {
        customerId: customerProfile.id,
        pickupAddress,
        pickupLat: parseFloat(pickupLat.toString()),
        pickupLng: parseFloat(pickupLng.toString()),
        dropoffAddress,
        dropoffLat: parseFloat(dropoffLat.toString()),
        dropoffLng: parseFloat(dropoffLng.toString()),
        parcelDescription,
        serviceFare: parseFloat(serviceFare),
        safegoCommission,
        driverPayout,
        paymentMethod,
        status: "requested",
      },
    });

    res.status(201).json({
      message: "Parcel delivery requested successfully",
      delivery: {
        id: delivery.id,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        parcelDescription: delivery.parcelDescription,
        serviceFare: delivery.serviceFare,
        paymentMethod: delivery.paymentMethod,
        status: delivery.status,
        createdAt: delivery.createdAt,
      },
    });
  } catch (error) {
    console.error("Create delivery error:", error);
    res.status(500).json({ error: "Failed to create delivery request" });
  }
});

// ====================================================
// GET /api/deliveries/:id
// Get delivery details
// ====================================================
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
            vehicle: true,
          },
        },
      },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    // Authorization check
    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (delivery.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (delivery.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      delivery: {
        id: delivery.id,
        customer: {
          email: delivery.customer.user.email,
        },
        driver: delivery.driver ? {
          email: delivery.driver.user.email,
          vehicle: delivery.driver.vehicle,
        } : null,
        pickupAddress: delivery.pickupAddress,
        pickupLat: delivery.pickupLat,
        pickupLng: delivery.pickupLng,
        dropoffAddress: delivery.dropoffAddress,
        dropoffLat: delivery.dropoffLat,
        dropoffLng: delivery.dropoffLng,
        parcelDescription: delivery.parcelDescription,
        serviceFare: delivery.serviceFare,
        safegoCommission: delivery.safegoCommission,
        driverPayout: delivery.driverPayout,
        paymentMethod: delivery.paymentMethod,
        status: delivery.status,
        customerRating: delivery.customerRating,
        customerFeedback: delivery.customerFeedback,
        driverRating: delivery.driverRating,
        driverFeedback: delivery.driverFeedback,
        createdAt: delivery.createdAt,
        completedAt: delivery.completedAt,
      },
    });
  } catch (error) {
    console.error("Get delivery error:", error);
    res.status(500).json({ error: "Failed to fetch delivery details" });
  }
});

// ====================================================
// PATCH /api/deliveries/:id/accept
// Driver accepts delivery
// ====================================================
router.patch("/:id/accept", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "driver") {
      return res.status(403).json({ error: "Only drivers can accept deliveries" });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to accept deliveries" });
    }

    if (!driverProfile.vehicle || !driverProfile.vehicle.isOnline) {
      return res.status(403).json({ error: "Driver must be online to accept deliveries" });
    }

    // Get delivery
    const delivery = await prisma.delivery.findUnique({ where: { id } });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (delivery.status !== "requested" && delivery.status !== "searching_driver") {
      return res.status(400).json({ error: "Delivery cannot be accepted in current status" });
    }

    if (delivery.driverId) {
      return res.status(400).json({ error: "Delivery already has a driver" });
    }

    // Accept delivery
    const updatedDelivery = await prisma.delivery.update({
      where: { id },
      data: {
        driverId: driverProfile.id,
        status: "accepted",
      },
    });

    // Create notification for customer
    const customerUser = await prisma.user.findFirst({
      where: { customerProfile: { id: delivery.customerId } },
    });

    if (customerUser) {
      await prisma.notification.create({
        data: {
          userId: customerUser.id,
          type: "delivery_update",
          title: "Driver Found!",
          body: `Your parcel delivery has been accepted. Driver is on the way to pickup.`,
        },
      });
    }

    res.json({
      message: "Delivery accepted successfully",
      delivery: {
        id: updatedDelivery.id,
        status: updatedDelivery.status,
      },
    });
  } catch (error) {
    console.error("Accept delivery error:", error);
    res.status(500).json({ error: "Failed to accept delivery" });
  }
});

// ====================================================
// PATCH /api/deliveries/:id/status
// Update delivery status
// ====================================================
router.patch("/:id/status", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const validStatuses = ["requested", "searching_driver", "accepted", "picked_up", "on_the_way", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const delivery = await prisma.delivery.findUnique({ where: { id } });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    // Authorization check
    if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (delivery.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (delivery.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update delivery status
    const updatedDelivery = await prisma.delivery.update({
      where: { id },
      data: { status },
    });

    // Create notification
    const customerUser = await prisma.user.findFirst({
      where: { customerProfile: { id: delivery.customerId } },
    });

    if (customerUser) {
      await prisma.notification.create({
        data: {
          userId: customerUser.id,
          type: "delivery_update",
          title: "Delivery Status Updated",
          body: `Your parcel delivery status is now: ${status}`,
        },
      });
    }

    res.json({
      message: "Delivery status updated successfully",
      delivery: {
        id: updatedDelivery.id,
        status: updatedDelivery.status,
      },
    });
  } catch (error) {
    console.error("Update delivery status error:", error);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

// ====================================================
// POST /api/deliveries/:id/complete
// Complete delivery with ratings and apply commission
// ====================================================
router.post("/:id/complete", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const delivery = await prisma.delivery.findUnique({ where: { id } });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (delivery.status !== "delivered") {
      return res.status(400).json({ error: "Delivery must be delivered to complete" });
    }

    if (!delivery.driverId) {
      return res.status(400).json({ error: "Delivery has no assigned driver" });
    }

    // Determine who is completing (customer or driver)
    let updateData: any = {};

    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (delivery.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      updateData.customerRating = rating;
      updateData.customerFeedback = feedback || null;
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (delivery.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      updateData.driverRating = rating;
      updateData.driverFeedback = feedback || null;
    } else {
      return res.status(403).json({ error: "Only customer or driver can complete delivery" });
    }

    // If both have rated, mark as completed and apply commission logic
    if ((role === "customer" && delivery.driverRating) || (role === "driver" && delivery.customerRating)) {
      updateData.status = "completed";
      updateData.completedAt = new Date();

      // Apply commission logic for driver
      const driver = await prisma.driverProfile.findUnique({
        where: { id: delivery.driverId },
        include: { driverWallet: true, vehicle: true, stats: true },
      });

      if (driver) {
        // Update driver stats
        await prisma.driverStats.update({
          where: { id: driver.stats!.id },
          data: {
            totalTrips: { increment: 1 },
            rating: (parseFloat(driver.stats!.rating.toString()) * driver.stats!.totalTrips + rating) / (driver.stats!.totalTrips + 1),
          },
        });

        // Update vehicle earnings
        await prisma.vehicle.update({
          where: { id: driver.vehicle!.id },
          data: {
            totalEarnings: { increment: parseFloat(delivery.serviceFare.toString()) },
          },
        });

        // Record parcel delivery earning in wallet with full transaction logging
        await walletService.recordParcelDeliveryEarning(
          delivery.driverId,
          {
            id: delivery.id,
            serviceFare: delivery.serviceFare,
            driverPayout: delivery.driverPayout,
            safegoCommission: delivery.safegoCommission,
            paymentMethod: delivery.paymentMethod as "cash" | "online",
            pickupAddress: delivery.pickupAddress,
            dropoffAddress: delivery.dropoffAddress,
          }
        );

        // Evaluate and apply promotion bonuses for driver (D5)
        try {
          await promotionBonusService.evaluateDriverBonuses({
            driverId: delivery.driverId,
            tripId: delivery.id,
            tripType: "parcel",
            earnings: parseFloat(delivery.driverPayout.toString()),
          });
        } catch (bonusError) {
          console.error("Promotion bonus evaluation error (non-blocking):", bonusError);
        }
      }
    }

    // Update delivery
    const updatedDelivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: updateData.status === "completed" ? "Delivery completed successfully" : "Rating submitted successfully",
      delivery: {
        id: updatedDelivery.id,
        status: updatedDelivery.status,
        customerRating: updatedDelivery.customerRating,
        driverRating: updatedDelivery.driverRating,
        completedAt: updatedDelivery.completedAt,
      },
    });
  } catch (error) {
    console.error("Complete delivery error:", error);
    res.status(500).json({ error: "Failed to complete delivery" });
  }
});

export default router;
