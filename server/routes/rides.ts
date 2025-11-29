import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { walletService } from "../services/walletService";
import { promotionBonusService } from "../services/promotionBonusService";

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
      pickupPlaceId,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      dropoffPlaceId,
      // Route metrics from Google Directions
      distanceMiles,
      durationMinutes,
      routePolyline,
      rawDistanceMeters,
      rawDurationSeconds,
      routeProviderSource,
      serviceFare,
      paymentMethod,
    } = req.body;

    // Validation - GPS coordinates are now optional
    if (!pickupAddress || !dropoffAddress || !serviceFare || !paymentMethod) {
      return res.status(400).json({ error: "Pickup address, dropoff address, fare, and payment method are required" });
    }

    // Validate serviceFare is a valid positive number
    const fareNumber = parseFloat(serviceFare);
    if (isNaN(fareNumber) || fareNumber <= 0) {
      return res.status(400).json({ error: "Service fare must be a positive number" });
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

    // Calculate commission using Prisma Decimal (20% for now - can be made configurable later)
    const commissionRate = 0.20;
    const serviceFareDecimal = new Prisma.Decimal(fareNumber);
    const safegoCommission = serviceFareDecimal.mul(commissionRate);
    const driverPayout = serviceFareDecimal.sub(safegoCommission);

    // Validate and parse lat/lng - handle undefined, null, and zero correctly
    const parseCoordinate = (value: any): number | null => {
      // If undefined or null, return null
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = parseFloat(value.toString());
      // Validate it's a valid number (including zero)
      if (isNaN(parsed)) {
        throw new Error('Invalid coordinate');
      }
      return parsed;
    };

    let validPickupLat: number | null = null;
    let validPickupLng: number | null = null;
    let validDropoffLat: number | null = null;
    let validDropoffLng: number | null = null;

    try {
      validPickupLat = parseCoordinate(pickupLat);
      validPickupLng = parseCoordinate(pickupLng);
      validDropoffLat = parseCoordinate(dropoffLat);
      validDropoffLng = parseCoordinate(dropoffLng);
    } catch (error) {
      return res.status(400).json({ error: "Invalid coordinates - must be valid numbers" });
    }

    // Parse route metrics (optional fields from Google Directions)
    const parseOptionalNumber = (value: any): number | null => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };
    
    const parseOptionalInt = (value: any): number | null => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = typeof value === 'number' ? Math.round(value) : parseInt(value);
      return isNaN(parsed) ? null : parsed;
    };

    // Create ride with jurisdiction, validated coordinates, and route metadata
    const ride = await prisma.ride.create({
      data: {
        customerId: customerProfile.id,
        countryCode,
        cityCode,
        pickupAddress,
        pickupLat: validPickupLat,
        pickupLng: validPickupLng,
        pickupPlaceId: pickupPlaceId || null,
        dropoffAddress,
        dropoffLat: validDropoffLat,
        dropoffLng: validDropoffLng,
        dropoffPlaceId: dropoffPlaceId || null,
        // Route metrics from Google Directions API
        distanceMiles: parseOptionalNumber(distanceMiles),
        durationMinutes: parseOptionalInt(durationMinutes),
        routePolyline: routePolyline || null,
        rawDistanceMeters: parseOptionalInt(rawDistanceMeters),
        rawDurationSeconds: parseOptionalInt(rawDurationSeconds),
        routeProviderSource: routeProviderSource || null,
        serviceFare: serviceFareDecimal,
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
        distanceMiles: ride.distanceMiles,
        durationMinutes: ride.durationMinutes,
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

    const isDriverOrAdmin = role === "driver" || role === "admin";
    
    res.json({
      ride: {
        id: ride.id,
        customer: {
          email: ride.customer.user.email,
        },
        driver: ride.driver ? {
          id: ride.driver.id,
          firstName: ride.driver.firstName,
          lastName: ride.driver.lastName || undefined,
          phone: ride.driver.phone || undefined,
          rating: ride.driver.rating ? Number(ride.driver.rating) : undefined,
          photoUrl: ride.driver.photoUrl || undefined,
          currentLat: ride.driver.currentLat ? Number(ride.driver.currentLat) : undefined,
          currentLng: ride.driver.currentLng ? Number(ride.driver.currentLng) : undefined,
          lastLocationUpdate: ride.driver.lastLocationUpdate || undefined,
          vehicleMake: ride.driver.vehicle?.make || undefined,
          vehicleModel: ride.driver.vehicle?.model || undefined,
          vehicleColor: ride.driver.vehicle?.color || undefined,
          vehicleYear: ride.driver.vehicle?.year || undefined,
          licensePlate: ride.driver.vehicle?.licensePlate || undefined,
        } : null,
        pickupAddress: ride.pickupAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffAddress: ride.dropoffAddress,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng,
        routePolyline: ride.routePolyline,
        distanceMiles: ride.distanceMiles,
        durationMinutes: ride.durationMinutes,
        trafficEtaSeconds: ride.trafficEtaSeconds,
        serviceFare: ride.serviceFare,
        ...(isDriverOrAdmin && {
          safegoCommission: ride.safegoCommission,
          driverPayout: ride.driverPayout,
        }),
        tollAmount: ride.tollAmount,
        surgeMultiplier: ride.surgeMultiplier,
        paymentMethod: ride.paymentMethod,
        status: ride.status,
        currentLeg: ride.currentLeg,
        customerRating: ride.customerRating,
        customerFeedback: ride.customerFeedback,
        driverRating: ride.driverRating,
        driverFeedback: ride.driverFeedback,
        createdAt: ride.createdAt,
        acceptedAt: ride.acceptedAt,
        arrivedAt: ride.arrivedAt,
        tripStartedAt: ride.tripStartedAt,
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

        // Evaluate and apply promotion bonuses (D5)
        try {
          await promotionBonusService.evaluateDriverBonuses({
            driverId: ride.driverId,
            tripId: ride.id,
            tripType: "ride",
            earnings: parseFloat(ride.driverPayout.toString()),
          });
        } catch (bonusError) {
          console.error("Promotion bonus evaluation error (non-blocking):", bonusError);
        }
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

// ====================================================
// Phase A: POST /api/rides/:id/chat
// Send a chat message to the ride
// ====================================================
router.post("/:id/chat", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, userId: true } },
        driver: { select: { id: true, userId: true } },
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Verify sender is participant
    let senderType: "customer" | "driver";
    if (role === "customer" && ride.customer.userId === userId) {
      senderType = "customer";
    } else if (role === "driver" && ride.driver?.userId === userId) {
      senderType = "driver";
    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only allow chat during active ride
    if (!["accepted", "driver_arriving", "arrived", "in_progress"].includes(ride.status)) {
      return res.status(400).json({ error: "Chat is only available during active rides" });
    }

    const chatMessage = await prisma.rideChatMessage.create({
      data: {
        rideId: id,
        senderType,
        message: message.trim(),
      },
    });

    res.status(201).json({
      message: "Message sent",
      chatMessage: {
        id: chatMessage.id,
        senderType: chatMessage.senderType,
        message: chatMessage.message,
        createdAt: chatMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("Send chat message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ====================================================
// Phase A: GET /api/rides/:id/chat
// Get chat messages for a ride
// ====================================================
router.get("/:id/chat", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, userId: true, fullName: true } },
        driver: { select: { id: true, userId: true, firstName: true } },
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Verify requester is participant
    if (role === "customer" && ride.customer.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    } else if (role === "driver" && ride.driver?.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    } else if (role !== "customer" && role !== "driver" && role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await prisma.rideChatMessage.findMany({
      where: { rideId: id },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        message: m.message,
        createdAt: m.createdAt,
        senderName: m.senderType === "customer" ? ride.customer.fullName : ride.driver?.firstName,
      })),
    });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ====================================================
// Phase A: POST /api/rides/:id/cancel
// Cancel an active ride
// ====================================================
const cancelRideSchema = z.object({
  reason: z.enum(["changed_mind", "driver_too_far", "wrong_pickup", "price_too_high", "found_alternative", "other"]),
  notes: z.string().optional(),
});

router.post("/:id/cancel", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const validatedData = cancelRideSchema.parse(req.body);

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Determine canceller type
    let cancelledBy: "customer" | "driver";
    if (role === "customer" && ride.customer.userId === userId) {
      cancelledBy = "customer";
    } else if (role === "driver" && ride.driver?.userId === userId) {
      cancelledBy = "driver";
    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if ride can be cancelled
    const cancellableStatuses = ["requested", "searching_driver", "accepted", "driver_arriving", "arrived"];
    if (!cancellableStatuses.includes(ride.status)) {
      return res.status(400).json({ error: "Ride cannot be cancelled in current status" });
    }

    // Calculate cancellation fee (only if ride was accepted and cancelling after driver is en route)
    let cancellationFee = 0;
    const feeWaivedReason: string | null = null;
    if (cancelledBy === "customer" && ["accepted", "driver_arriving", "arrived"].includes(ride.status)) {
      cancellationFee = 5.00; // $5 cancellation fee
    }

    // Create cancellation record
    await prisma.rideCancellation.create({
      data: {
        rideId: id,
        cancelledBy,
        reason: validatedData.reason,
        notes: validatedData.notes,
        cancellationFee,
        feeWaivedReason,
      },
    });

    // Update ride status
    const updatedRide = await prisma.ride.update({
      where: { id },
      data: {
        status: cancelledBy === "customer" ? "cancelled_by_customer" : "cancelled_by_driver",
      },
    });

    // Create notification for the other party
    const notifyUserId = cancelledBy === "customer" ? ride.driver?.userId : ride.customer.userId;
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: "ride_update",
          title: cancelledBy === "customer" ? "Ride Cancelled" : "Ride Cancelled by Driver",
          body: cancelledBy === "customer" 
            ? "The customer has cancelled the ride." 
            : "Your driver has cancelled the ride. We're finding you a new driver.",
        },
      });
    }

    res.json({
      message: "Ride cancelled successfully",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
      cancellationFee,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid cancellation data", details: error.errors });
    }
    console.error("Cancel ride error:", error);
    res.status(500).json({ error: "Failed to cancel ride" });
  }
});

// ====================================================
// GET /api/rides/:id/chat
// Get chat messages for a ride
// ====================================================
router.get("/:id/chat", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid ride ID format" });
    }

    // Get ride with customer and driver
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        customer: true,
        driver: true,
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Verify access (customer or assigned driver)
    const isCustomer = role === "customer" && ride.customer.userId === userId;
    const isDriver = role === "driver" && ride.driver?.userId === userId;
    if (!isCustomer && !isDriver) {
      return res.status(403).json({ error: "Not authorized to view this ride's messages" });
    }

    // Get chat messages
    const messages = await prisma.rideChatMessage.findMany({
      where: { rideId: id },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        senderType: msg.senderType,
        message: msg.message,
        createdAt: msg.createdAt.toISOString(),
        senderName: msg.senderType === "customer" ? ride.customer.fullName : ride.driver?.fullName,
      })),
    });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ error: "Failed to get chat messages" });
  }
});

// ====================================================
// POST /api/rides/:id/rate
// Submit a rating for a completed ride
// ====================================================
const rateRideSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  raterType: z.enum(["customer", "driver"]),
});

router.post("/:id/rate", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    
    const validatedData = rateRideSchema.parse(req.body);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid ride ID format" });
    }

    // Get ride with customer and driver
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        customer: true,
        driver: true,
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Verify ride is completed
    if (ride.status !== "completed") {
      return res.status(400).json({ error: "Can only rate completed rides" });
    }

    // Verify access and rater type
    const isCustomer = role === "customer" && ride.customer.userId === userId;
    const isDriver = role === "driver" && ride.driver?.userId === userId;

    if (!isCustomer && !isDriver) {
      return res.status(403).json({ error: "Not authorized to rate this ride" });
    }

    // Verify rater type matches user role
    if ((isCustomer && validatedData.raterType !== "customer") || 
        (isDriver && validatedData.raterType !== "driver")) {
      return res.status(400).json({ error: "Rater type does not match your role" });
    }

    // Update ride with rating
    if (isCustomer) {
      // Customer rating the driver
      if (ride.customerRating) {
        return res.status(400).json({ error: "You have already rated this ride" });
      }
      
      await prisma.ride.update({
        where: { id },
        data: {
          customerRating: validatedData.rating,
          customerComment: validatedData.comment,
        },
      });

      // Update driver's average rating
      if (ride.driverId) {
        const driverRatings = await prisma.ride.findMany({
          where: { 
            driverId: ride.driverId, 
            customerRating: { not: null },
          },
          select: { customerRating: true },
        });
        
        const avgRating = driverRatings.reduce((sum, r) => sum + (r.customerRating || 0), 0) / driverRatings.length;
        
        await prisma.driverProfile.update({
          where: { id: ride.driverId },
          data: { rating: avgRating },
        });
      }
    } else if (isDriver) {
      // Driver rating the customer
      if (ride.driverRating) {
        return res.status(400).json({ error: "You have already rated this ride" });
      }
      
      await prisma.ride.update({
        where: { id },
        data: {
          driverRating: validatedData.rating,
          driverComment: validatedData.comment,
        },
      });
    }

    res.json({
      message: "Rating submitted successfully",
      rating: validatedData.rating,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid rating data", details: error.errors });
    }
    console.error("Rate ride error:", error);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

// ====================================================
// GET /api/rides/:id/receipt
// Get receipt for a completed ride
// ====================================================
router.get("/:id/receipt", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid ride ID format" });
    }

    // Get ride with all details
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        customer: true,
        driver: true,
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Verify access
    const isCustomer = role === "customer" && ride.customer.userId === userId;
    const isDriver = role === "driver" && ride.driver?.userId === userId;
    if (!isCustomer && !isDriver) {
      return res.status(403).json({ error: "Not authorized to view this receipt" });
    }

    // Verify ride is completed
    if (ride.status !== "completed") {
      return res.status(400).json({ error: "Receipt only available for completed rides" });
    }

    // Check if receipt exists, create if not
    let receipt = await prisma.rideReceipt.findUnique({
      where: { rideId: id },
    });

    if (!receipt) {
      // Create receipt
      const baseFare = Number(ride.serviceFare) || 0;
      const surge = Number(ride.surgeMultiplier) || 1;
      const tip = Number(ride.tipAmount) || 0;
      const discount = Number(ride.discountAmount) || 0;
      const subtotal = baseFare;
      const total = (subtotal * surge) + tip - discount;

      receipt = await prisma.rideReceipt.create({
        data: {
          rideId: id,
          baseFare: new Prisma.Decimal(baseFare),
          distanceFare: new Prisma.Decimal(0),
          timeFare: new Prisma.Decimal(0),
          surgeFee: new Prisma.Decimal((subtotal * surge) - subtotal),
          tipAmount: new Prisma.Decimal(tip),
          discount: new Prisma.Decimal(discount),
          total: new Prisma.Decimal(total),
          currency: "USD",
          paymentMethod: ride.paymentMethod || "card",
          paymentStatus: "completed",
        },
      });
    }

    res.json({
      receipt: {
        id: receipt.id,
        rideId: receipt.rideId,
        baseFare: Number(receipt.baseFare),
        distanceFare: Number(receipt.distanceFare),
        timeFare: Number(receipt.timeFare),
        surgeFee: Number(receipt.surgeFee),
        tipAmount: Number(receipt.tipAmount),
        discount: Number(receipt.discount),
        total: Number(receipt.total),
        currency: receipt.currency,
        paymentMethod: receipt.paymentMethod,
        paymentStatus: receipt.paymentStatus,
        createdAt: receipt.createdAt.toISOString(),
      },
      ride: {
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        createdAt: ride.createdAt.toISOString(),
        completedAt: ride.completedAt?.toISOString(),
        distanceMiles: ride.distanceMiles,
        durationMinutes: ride.durationMinutes,
        driver: ride.driver ? {
          name: ride.driver.fullName,
          rating: ride.driver.rating,
          vehicle: ride.driver.vehicleMake && ride.driver.vehicleModel 
            ? `${ride.driver.vehicleMake} ${ride.driver.vehicleModel}`
            : null,
          licensePlate: ride.driver.licensePlate,
        } : null,
      },
    });
  } catch (error) {
    console.error("Get receipt error:", error);
    res.status(500).json({ error: "Failed to get receipt" });
  }
});

// ====================================================
// PATCH /api/rides/:id/destination
// Change dropoff destination mid-trip
// ====================================================
const changeDestinationSchema = z.object({
  dropoffAddress: z.string().min(1),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffPlaceId: z.string().optional(),
  newFare: z.number().optional(),
  newDistanceMiles: z.number().optional(),
  newDurationMinutes: z.number().optional(),
});

router.patch("/:id/destination", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can change destination" });
    }

    const validatedData = changeDestinationSchema.parse(req.body);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid ride ID format" });
    }

    // Get ride
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Verify ownership
    if (ride.customer.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to modify this ride" });
    }

    // Verify ride is in progress
    const allowedStatuses = ["accepted", "driver_arriving", "arrived", "in_progress"];
    if (!allowedStatuses.includes(ride.status)) {
      return res.status(400).json({ error: "Cannot change destination in current ride status" });
    }

    // Store original destination for audit
    const originalDropoff = {
      address: ride.dropoffAddress,
      lat: ride.dropoffLat,
      lng: ride.dropoffLng,
    };

    // Update ride with new destination
    const updatedRide = await prisma.ride.update({
      where: { id },
      data: {
        dropoffAddress: validatedData.dropoffAddress,
        dropoffLat: validatedData.dropoffLat,
        dropoffLng: validatedData.dropoffLng,
        dropoffPlaceId: validatedData.dropoffPlaceId,
        ...(validatedData.newFare && { serviceFare: new Prisma.Decimal(validatedData.newFare) }),
        ...(validatedData.newDistanceMiles && { distanceMiles: validatedData.newDistanceMiles }),
        ...(validatedData.newDurationMinutes && { durationMinutes: validatedData.newDurationMinutes }),
      },
    });

    // Create status event for audit
    try {
      await prisma.rideStatusEvent.create({
        data: {
          rideId: id,
          status: "destination_changed",
          changedBy: "customer",
          changedByActorId: ride.customerId,
          metadata: JSON.stringify({
            originalDropoff,
            newDropoff: {
              address: validatedData.dropoffAddress,
              lat: validatedData.dropoffLat,
              lng: validatedData.dropoffLng,
            },
          }),
        },
      });
    } catch (eventError) {
      console.error("Failed to create destination change event:", eventError);
    }

    // Notify driver of destination change
    if (ride.driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: ride.driverId },
        select: { userId: true },
      });
      
      if (driver) {
        await prisma.notification.create({
          data: {
            userId: driver.userId,
            type: "ride_update",
            title: "Destination Changed",
            body: `Customer changed destination to: ${validatedData.dropoffAddress}`,
          },
        });
      }
    }

    res.json({
      message: "Destination updated successfully",
      ride: {
        id: updatedRide.id,
        dropoffAddress: updatedRide.dropoffAddress,
        dropoffLat: updatedRide.dropoffLat,
        dropoffLng: updatedRide.dropoffLng,
        serviceFare: Number(updatedRide.serviceFare),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid destination data", details: error.errors });
    }
    console.error("Change destination error:", error);
    res.status(500).json({ error: "Failed to change destination" });
  }
});

// ====================================================
// GET /api/rides/:id/live-tracking
// Real-time tracking data for active ride
// ====================================================
router.get("/:id/live-tracking", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Fetch ride with driver info
    const ride = await prisma.ride.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        driverId: true,
        status: true,
        currentLeg: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        routePolyline: true,
        distanceMiles: true,
        durationMinutes: true,
        trafficEtaSeconds: true,
        acceptedAt: true,
        arrivedAt: true,
        tripStartedAt: true,
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Authorization: only ride's customer or admin can access tracking
    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (ride.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only allow tracking for active rides
    const activeStatuses = ["accepted", "driver_arriving", "arrived", "in_progress"];
    if (!activeStatuses.includes(ride.status)) {
      return res.json({
        rideId: ride.id,
        status: ride.status,
        isActive: false,
        message: "Ride is not in an active tracking state",
      });
    }

    // Get driver info and latest location
    let driverLocation = null;
    let driverInfo = null;

    if (ride.driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: ride.driverId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          rating: true,
          photoUrl: true,
          currentLat: true,
          currentLng: true,
          lastLocationUpdate: true,
        },
      });

      if (driver) {
        driverInfo = {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          rating: driver.rating ? Number(driver.rating) : null,
          photoUrl: driver.photoUrl,
        };

        // Get latest location from RideLiveLocation table
        const latestLocation = await prisma.rideLiveLocation.findFirst({
          where: { rideId: id },
          orderBy: { createdAt: 'desc' },
        });

        if (latestLocation) {
          // Calculate speed from last two positions
          const previousLocation = await prisma.rideLiveLocation.findFirst({
            where: { 
              rideId: id,
              createdAt: { lt: latestLocation.createdAt }
            },
            orderBy: { createdAt: 'desc' },
          });

          let calculatedSpeedMps: number | null = null;
          let calculatedHeading: number | null = latestLocation.heading;

          if (previousLocation) {
            const timeDiffMs = latestLocation.createdAt.getTime() - previousLocation.createdAt.getTime();
            if (timeDiffMs > 0 && timeDiffMs < 30000) { // Only calculate if within 30 seconds
              const distanceMeters = haversineDistance(
                previousLocation.lat,
                previousLocation.lng,
                latestLocation.lat,
                latestLocation.lng
              );
              calculatedSpeedMps = distanceMeters / (timeDiffMs / 1000);
              
              // Calculate heading if not provided
              if (calculatedHeading === null) {
                calculatedHeading = calculateBearing(
                  previousLocation.lat,
                  previousLocation.lng,
                  latestLocation.lat,
                  latestLocation.lng
                );
              }
            }
          }

          // Use stored speed if available, otherwise use calculated
          const speedMps = latestLocation.speed !== null 
            ? latestLocation.speed / 3.6  // Convert km/h to m/s
            : calculatedSpeedMps;

          driverLocation = {
            lat: latestLocation.lat,
            lng: latestLocation.lng,
            headingDeg: calculatedHeading,
            speedMps: speedMps,
            accuracy: latestLocation.accuracy,
            updatedAt: latestLocation.createdAt.toISOString(),
          };
        } else if (driver.currentLat !== null && driver.currentLng !== null) {
          // Fallback to driver profile location
          driverLocation = {
            lat: Number(driver.currentLat),
            lng: Number(driver.currentLng),
            headingDeg: null,
            speedMps: null,
            accuracy: null,
            updatedAt: driver.lastLocationUpdate?.toISOString() || null,
          };
        }
      }
    }

    // Determine current phase and calculate ETAs
    const isPickedUp = ride.status === "in_progress";
    let etaSecondsToPickup: number | null = null;
    let etaSecondsToDropoff: number | null = null;
    let distanceMetersToPickup: number | null = null;
    let distanceMetersToDropoff: number | null = null;

    if (driverLocation && ride.pickupLat && ride.pickupLng) {
      distanceMetersToPickup = haversineDistance(
        driverLocation.lat,
        driverLocation.lng,
        ride.pickupLat,
        ride.pickupLng
      );
      
      // Estimate ETA based on average city speed (25 mph = 11.2 m/s)
      const avgSpeedMps = driverLocation.speedMps && driverLocation.speedMps > 2 
        ? driverLocation.speedMps 
        : 11.2;
      etaSecondsToPickup = Math.round(distanceMetersToPickup / avgSpeedMps);
    }

    if (ride.dropoffLat && ride.dropoffLng) {
      if (isPickedUp && driverLocation) {
        distanceMetersToDropoff = haversineDistance(
          driverLocation.lat,
          driverLocation.lng,
          ride.dropoffLat,
          ride.dropoffLng
        );
      } else if (ride.pickupLat && ride.pickupLng) {
        distanceMetersToDropoff = haversineDistance(
          ride.pickupLat,
          ride.pickupLng,
          ride.dropoffLat,
          ride.dropoffLng
        );
      }
      
      if (distanceMetersToDropoff !== null) {
        const avgSpeedMps = driverLocation?.speedMps && driverLocation.speedMps > 2 
          ? driverLocation.speedMps 
          : 11.2;
        etaSecondsToDropoff = Math.round(distanceMetersToDropoff / avgSpeedMps);
      }
    }

    res.json({
      rideId: ride.id,
      status: ride.status,
      currentLeg: ride.currentLeg,
      isActive: true,
      
      driverInfo,
      driverLocation,
      
      pickupLocation: ride.pickupLat && ride.pickupLng ? {
        lat: ride.pickupLat,
        lng: ride.pickupLng,
        address: ride.pickupAddress,
      } : null,
      
      dropoffLocation: ride.dropoffLat && ride.dropoffLng ? {
        lat: ride.dropoffLat,
        lng: ride.dropoffLng,
        address: ride.dropoffAddress,
      } : null,
      
      routePolyline: ride.routePolyline,
      
      etaSecondsToPickup: isPickedUp ? null : etaSecondsToPickup,
      etaSecondsToDropoff,
      distanceMetersToPickup: isPickedUp ? null : distanceMetersToPickup,
      distanceMetersToDropoff,
      
      timestamps: {
        acceptedAt: ride.acceptedAt?.toISOString() || null,
        arrivedAt: ride.arrivedAt?.toISOString() || null,
        tripStartedAt: ride.tripStartedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Live tracking error:", error);
    res.status(500).json({ error: "Failed to fetch tracking data" });
  }
});

// ====================================================
// POST /api/rides/:id/driver-location
// Driver updates their location during ride
// ====================================================
router.post("/:id/driver-location", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "driver") {
      return res.status(403).json({ error: "Only drivers can update location" });
    }

    const { lat, lng, heading, speed, accuracy } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: "Valid lat and lng are required" });
    }

    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Verify driver is assigned to this ride
    const ride = await prisma.ride.findUnique({
      where: { id },
      select: { driverId: true, status: true },
    });

    if (!ride || ride.driverId !== driverProfile.id) {
      return res.status(403).json({ error: "Not assigned to this ride" });
    }

    const activeStatuses = ["accepted", "driver_arriving", "arrived", "in_progress"];
    if (!activeStatuses.includes(ride.status)) {
      return res.status(400).json({ error: "Ride is not active" });
    }

    // Store location in RideLiveLocation
    await prisma.rideLiveLocation.create({
      data: {
        rideId: id,
        driverId: driverProfile.id,
        lat,
        lng,
        heading: typeof heading === 'number' ? heading : null,
        speed: typeof speed === 'number' ? speed : null,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
      },
    });

    // Also update driver's current location
    await prisma.driverProfile.update({
      where: { id: driverProfile.id },
      data: {
        currentLat: lat,
        currentLng: lng,
        lastLocationUpdate: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Update driver location error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// Helper: Calculate haversine distance between two points in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Calculate bearing between two points in degrees
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const x = Math.sin(dLng) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(x, y) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

export default router;
