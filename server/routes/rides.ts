import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { walletService } from "../services/walletService";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// ====================================================
// POST /api/rides
// Create a new ride request (customer only)
// ====================================================
router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can request rides" });
    }

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      serviceFare,
      paymentMethod,
    } = req.body;

    // Validation - GPS coordinates are now optional
    if (!pickupAddress || !dropoffAddress || !serviceFare || !paymentMethod) {
      return res.status(400).json({ error: "Pickup address, dropoff address, fare, and payment method are required" });
    }

    if (!["cash", "online"].includes(paymentMethod)) {
      return res.status(400).json({ error: "paymentMethod must be 'cash' or 'online'" });
    }

    // Get customer profile with user data for jurisdiction
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (!customerProfile.isVerified) {
      return res.status(403).json({ error: "Customer must be verified to request rides" });
    }

    // Get jurisdiction from customer profile
    const countryCode = customerProfile.user.countryCode;
    const cityCode = customerProfile.cityCode || null;

    // Calculate commission (20% for now - can be made configurable later)
    const commissionRate = 0.20;
    const safegoCommission = parseFloat(serviceFare) * commissionRate;
    const driverPayout = parseFloat(serviceFare) - safegoCommission;

    // Validate lat/lng as numbers if provided
    const validPickupLat = pickupLat ? parseFloat(pickupLat.toString()) : null;
    const validPickupLng = pickupLng ? parseFloat(pickupLng.toString()) : null;
    const validDropoffLat = dropoffLat ? parseFloat(dropoffLat.toString()) : null;
    const validDropoffLng = dropoffLng ? parseFloat(dropoffLng.toString()) : null;

    // Validate that lat/lng are valid numbers if provided
    if ((pickupLat && isNaN(validPickupLat!)) || (pickupLng && isNaN(validPickupLng!))) {
      return res.status(400).json({ error: "Invalid pickup coordinates" });
    }
    if ((dropoffLat && isNaN(validDropoffLat!)) || (dropoffLng && isNaN(validDropoffLng!))) {
      return res.status(400).json({ error: "Invalid dropoff coordinates" });
    }

    // Create ride with jurisdiction and validated coordinates
    const ride = await prisma.ride.create({
      data: {
        customerId: customerProfile.id,
        countryCode,
        cityCode,
        pickupAddress,
        pickupLat: validPickupLat,
        pickupLng: validPickupLng,
        dropoffAddress,
        dropoffLat: validDropoffLat,
        dropoffLng: validDropoffLng,
        serviceFare: parseFloat(serviceFare),
        safegoCommission,
        driverPayout,
        paymentMethod,
        status: "requested",
      },
    });

    res.status(201).json({
      message: "Ride requested successfully",
      ride: {
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        serviceFare: ride.serviceFare,
        paymentMethod: ride.paymentMethod,
        status: ride.status,
        createdAt: ride.createdAt,
      },
    });
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({ error: "Failed to create ride request" });
  }
});

// ====================================================
// GET /api/rides/:id
// Get ride details
// ====================================================
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const ride = await prisma.ride.findUnique({
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

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Authorization check
    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (ride.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (ride.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      ride: {
        id: ride.id,
        customer: {
          email: ride.customer.user.email,
        },
        driver: ride.driver ? {
          email: ride.driver.user.email,
          vehicle: ride.driver.vehicle,
        } : null,
        pickupAddress: ride.pickupAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffAddress: ride.dropoffAddress,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng,
        serviceFare: ride.serviceFare,
        safegoCommission: ride.safegoCommission,
        driverPayout: ride.driverPayout,
        paymentMethod: ride.paymentMethod,
        status: ride.status,
        customerRating: ride.customerRating,
        customerFeedback: ride.customerFeedback,
        driverRating: ride.driverRating,
        driverFeedback: ride.driverFeedback,
        createdAt: ride.createdAt,
        completedAt: ride.completedAt,
      },
    });
  } catch (error) {
    console.error("Get ride error:", error);
    res.status(500).json({ error: "Failed to fetch ride details" });
  }
});

// ====================================================
// PATCH /api/rides/:id/accept
// Driver accepts ride
// ====================================================
router.patch("/:id/accept", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "driver") {
      return res.status(403).json({ error: "Only drivers can accept rides" });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to accept rides" });
    }

    if (!driverProfile.vehicle || !driverProfile.vehicle.isOnline) {
      return res.status(403).json({ error: "Driver must be online to accept rides" });
    }

    // Get ride
    const ride = await prisma.ride.findUnique({ where: { id } });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.status !== "requested" && ride.status !== "searching_driver") {
      return res.status(400).json({ error: "Ride cannot be accepted in current status" });
    }

    if (ride.driverId) {
      return res.status(400).json({ error: "Ride already has a driver" });
    }

    // Accept ride
    const updatedRide = await prisma.ride.update({
      where: { id },
      data: {
        driverId: driverProfile.id,
        status: "accepted",
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: (await prisma.customerProfile.findUnique({ where: { id: ride.customerId }, include: { user: true } }))!.userId,
        type: "ride_update",
        title: "Driver Found!",
        body: `Your ride has been accepted. Driver is on the way.`,
      },
    });

    res.json({
      message: "Ride accepted successfully",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
    });
  } catch (error) {
    console.error("Accept ride error:", error);
    res.status(500).json({ error: "Failed to accept ride" });
  }
});

// ====================================================
// PATCH /api/rides/:id/status
// Update ride status
// ====================================================
router.patch("/:id/status", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const validStatuses = ["requested", "searching_driver", "accepted", "driver_arriving", "in_progress", "completed", "cancelled_by_customer", "cancelled_by_driver"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const ride = await prisma.ride.findUnique({ where: { id } });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Authorization check
    if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (ride.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (ride.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update ride status
    const updatedRide = await prisma.ride.update({
      where: { id },
      data: { status },
    });

    // Create notification
    const recipientUserId = role === "driver" 
      ? (await prisma.customerProfile.findUnique({ where: { id: ride.customerId }, include: { user: true } }))!.userId
      : ride.driverId ? (await prisma.driverProfile.findUnique({ where: { id: ride.driverId }, include: { user: true } }))!.userId : null;

    if (recipientUserId) {
      await prisma.notification.create({
        data: {
          userId: recipientUserId,
          type: "ride_update",
          title: "Ride Status Updated",
          body: `Your ride status is now: ${status}`,
        },
      });
    }

    res.json({
      message: "Ride status updated successfully",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
    });
  } catch (error) {
    console.error("Update ride status error:", error);
    res.status(500).json({ error: "Failed to update ride status" });
  }
});

// ====================================================
// POST /api/rides/:id/complete
// Complete ride with ratings and apply commission
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

    const ride = await prisma.ride.findUnique({ where: { id } });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.status !== "in_progress") {
      return res.status(400).json({ error: "Ride must be in_progress to complete" });
    }

    if (!ride.driverId) {
      return res.status(400).json({ error: "Ride has no assigned driver" });
    }

    // Determine who is completing (customer or driver)
    let updateData: any = {};

    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (ride.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      updateData.customerRating = rating;
      updateData.customerFeedback = feedback || null;
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (ride.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      updateData.driverRating = rating;
      updateData.driverFeedback = feedback || null;
    } else {
      return res.status(403).json({ error: "Only customer or driver can complete ride" });
    }

    // If both have rated, mark as completed and apply commission logic
    if ((role === "customer" && ride.driverRating) || (role === "driver" && ride.customerRating)) {
      updateData.status = "completed";
      updateData.completedAt = new Date();

      // Apply commission logic
      const driver = await prisma.driverProfile.findUnique({
        where: { id: ride.driverId },
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
            totalEarnings: { increment: parseFloat(ride.serviceFare.toString()) },
          },
        });

        // Record ride earning in wallet with full transaction logging
        await walletService.recordRideEarning(
          ride.driverId,
          {
            id: ride.id,
            serviceFare: ride.serviceFare,
            driverPayout: ride.driverPayout,
            safegoCommission: ride.safegoCommission,
            paymentMethod: ride.paymentMethod as "cash" | "online",
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
          }
        );
      }
    }

    // Update ride
    const updatedRide = await prisma.ride.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: updateData.status === "completed" ? "Ride completed successfully" : "Rating submitted successfully",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
        customerRating: updatedRide.customerRating,
        driverRating: updatedRide.driverRating,
        completedAt: updatedRide.completedAt,
      },
    });
  } catch (error) {
    console.error("Complete ride error:", error);
    res.status(500).json({ error: "Failed to complete ride" });
  }
});

export default router;
