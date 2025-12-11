import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { DriverRealtimeStateService } from "../services/driverRealtimeStateService";
import { commissionService } from "../services/commissionService";

const router = Router();
const driverRealtimeStateService = DriverRealtimeStateService.getInstance();

router.use(authenticateToken);
router.use(requireRole(["driver"]));

async function getDriverProfile(userId: string) {
  return prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      isVerified: true,
      isSuspended: true,
      country: true,
      user: {
        select: {
          countryCode: true,
          isBlocked: true,
        },
      },
    },
  });
}

async function validateRideOwnership(rideId: string, driverId: string) {
  return prisma.ride.findFirst({
    where: { id: rideId, driverId },
    include: {
      customer: {
        select: {
          fullName: true,
          phoneNumber: true,
        },
      },
    },
  });
}

router.post("/:rideId/accept", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to accept rides" });
    }

    if (driverProfile.isSuspended || driverProfile.user.isBlocked) {
      return res.status(403).json({ error: "Your account is suspended" });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.status !== "searching_driver" && ride.status !== "requested") {
      return res.status(400).json({ error: `Cannot accept ride in status: ${ride.status}` });
    }

    if (ride.driverId && ride.driverId !== driverProfile.id) {
      return res.status(400).json({ error: "Ride already assigned to another driver" });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        driverId: driverProfile.id,
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    try {
      await driverRealtimeStateService.setDriverBusy(driverProfile.id, rideId);
    } catch (e) {
      console.error("Failed to update realtime state:", e);
    }

    res.json({
      message: "Ride accepted successfully",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
        pickupAddress: updatedRide.pickupAddress,
        dropoffAddress: updatedRide.dropoffAddress,
      },
    });
  } catch (error) {
    console.error("Accept ride error:", error);
    res.status(500).json({ error: "Failed to accept ride" });
  }
});

router.post("/:rideId/reject", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.status !== "searching_driver" && ride.status !== "requested") {
      return res.status(400).json({ error: "Cannot reject ride in current status" });
    }

    await prisma.rideDriverRejection.create({
      data: {
        rideId,
        driverId: driverProfile.id,
        reason: req.body.reason || "driver_declined",
      },
    });

    res.json({
      message: "Ride rejected",
      rideId,
    });
  } catch (error) {
    console.error("Reject ride error:", error);
    res.status(500).json({ error: "Failed to reject ride" });
  }
});

router.post("/:rideId/arriving", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const ride = await validateRideOwnership(rideId, driverProfile.id);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found or not assigned to you" });
    }

    if (ride.status !== "accepted") {
      return res.status(400).json({ error: `Cannot mark arriving from status: ${ride.status}` });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: "driver_arriving",
        driverArrivingAt: new Date(),
      },
    });

    res.json({
      message: "Status updated to arriving",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
    });
  } catch (error) {
    console.error("Arriving error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/:rideId/arrived", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const ride = await validateRideOwnership(rideId, driverProfile.id);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found or not assigned to you" });
    }

    if (ride.status !== "driver_arriving") {
      return res.status(400).json({ error: `Cannot mark arrived from status: ${ride.status}` });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: "arrived",
        arrivedAt: new Date(),
      },
    });

    res.json({
      message: "Arrived at pickup location",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
    });
  } catch (error) {
    console.error("Arrived error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/:rideId/start", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const ride = await validateRideOwnership(rideId, driverProfile.id);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found or not assigned to you" });
    }

    if (ride.status !== "driver_arriving" && ride.status !== "arrived") {
      return res.status(400).json({ error: `Cannot start trip from status: ${ride.status}` });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: "in_progress",
        tripStartedAt: new Date(),
      },
    });

    res.json({
      message: "Trip started",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
    });
  } catch (error) {
    console.error("Start trip error:", error);
    res.status(500).json({ error: "Failed to start trip" });
  }
});

router.post("/:rideId/complete", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const ride = await validateRideOwnership(rideId, driverProfile.id);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found or not assigned to you" });
    }

    if (ride.status !== "in_progress") {
      return res.status(400).json({ error: `Cannot complete trip from status: ${ride.status}` });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    try {
      await driverRealtimeStateService.setDriverAvailable(driverProfile.id);
    } catch (e) {
      console.error("Failed to update realtime state:", e);
    }

    const fare = parseFloat(updatedRide.serviceFare?.toString() || "0");
    if (fare > 0) {
      try {
        await commissionService.calculateRideCommission(
          rideId,
          driverProfile.id,
          fare,
          updatedRide.countryCode || "BD"
        );
      } catch (commissionError) {
        console.error("Commission calculation error (non-fatal):", commissionError);
      }
    }

    res.json({
      message: "Trip completed successfully",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
        fare,
      },
    });
  } catch (error) {
    console.error("Complete trip error:", error);
    res.status(500).json({ error: "Failed to complete trip" });
  }
});

router.post("/:rideId/cancel", async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    const driverProfile = await getDriverProfile(userId);
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const ride = await validateRideOwnership(rideId, driverProfile.id);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found or not assigned to you" });
    }

    if (ride.status === "completed" || ride.status.includes("cancelled")) {
      return res.status(400).json({ error: "Cannot cancel a completed or already cancelled ride" });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: "cancelled_by_driver",
        cancelledAt: new Date(),
        cancellationReason: reason || "Driver cancelled",
      },
    });

    try {
      await driverRealtimeStateService.setDriverAvailable(driverProfile.id);
    } catch (e) {
      console.error("Failed to update realtime state:", e);
    }

    res.json({
      message: "Ride cancelled",
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
      },
    });
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({ error: "Failed to cancel ride" });
  }
});

export default router;
