import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and restaurant role
router.use(authenticateToken);
router.use(requireRole(["restaurant"]));

// ====================================================
// PATCH /api/restaurant/profile
// Update restaurant profile
// ====================================================
router.patch("/profile", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { restaurantName, address } = req.body;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Prepare update data
    const updateData: any = {};
    if (restaurantName) updateData.restaurantName = restaurantName;
    if (address) updateData.address = address;

    // Update profile
    const updatedProfile = await prisma.restaurantProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Profile updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ====================================================
// GET /api/restaurant/home
// Get restaurant dashboard data
// ====================================================
router.get("/home", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
        restaurantWallet: true,
      },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    res.json({
      profile: {
        id: restaurantProfile.id,
        email: restaurantProfile.user.email,
        restaurantName: restaurantProfile.restaurantName,
        address: restaurantProfile.address,
        countryCode: restaurantProfile.user.countryCode,
        verificationStatus: restaurantProfile.verificationStatus,
        isVerified: restaurantProfile.isVerified,
        rejectionReason: restaurantProfile.rejectionReason,
      },
      wallet: restaurantProfile.restaurantWallet ? {
        balance: restaurantProfile.restaurantWallet.balance,
        negativeBalance: restaurantProfile.restaurantWallet.negativeBalance,
      } : null,
    });
  } catch (error) {
    console.error("Restaurant home error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant data" });
  }
});

export default router;
