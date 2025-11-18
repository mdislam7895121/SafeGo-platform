import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and driver role
router.use(authenticateToken);
router.use(requireRole(["driver"]));

// ====================================================
// GET /api/driver/home
// Get driver dashboard data
// ====================================================
router.get("/home", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
        vehicle: true,
        stats: true,
        driverWallet: true,
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    res.json({
      profile: {
        id: driverProfile.id,
        email: driverProfile.user.email,
        countryCode: driverProfile.user.countryCode,
        verificationStatus: driverProfile.verificationStatus,
        isVerified: driverProfile.isVerified,
        rejectionReason: driverProfile.rejectionReason,
      },
      vehicle: driverProfile.vehicle ? {
        id: driverProfile.vehicle.id,
        vehicleType: driverProfile.vehicle.vehicleType,
        vehicleModel: driverProfile.vehicle.vehicleModel,
        vehiclePlate: driverProfile.vehicle.vehiclePlate,
        isOnline: driverProfile.vehicle.isOnline,
        totalEarnings: driverProfile.vehicle.totalEarnings,
      } : null,
      stats: driverProfile.stats ? {
        rating: driverProfile.stats.rating,
        totalTrips: driverProfile.stats.totalTrips,
      } : null,
      wallet: driverProfile.driverWallet ? {
        balance: driverProfile.driverWallet.balance,
        negativeBalance: driverProfile.driverWallet.negativeBalance,
      } : null,
    });
  } catch (error) {
    console.error("Driver home error:", error);
    res.status(500).json({ error: "Failed to fetch driver data" });
  }
});

// ====================================================
// PATCH /api/driver/status
// Update driver online/offline status
// ====================================================
router.patch("/status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { isOnline } = req.body;

    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ error: "isOnline must be a boolean" });
    }

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.vehicle) {
      return res.status(400).json({ error: "Vehicle not registered. Please complete vehicle registration first." });
    }

    // Check if driver is verified
    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified before going online" });
    }

    // Update vehicle online status
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: driverProfile.vehicle.id },
      data: { isOnline },
    });

    res.json({
      message: `Driver is now ${isOnline ? "online" : "offline"}`,
      vehicle: {
        id: updatedVehicle.id,
        isOnline: updatedVehicle.isOnline,
      },
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
