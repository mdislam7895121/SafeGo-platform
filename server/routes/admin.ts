import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(["admin"]));

// ====================================================
// GET /api/admin/pending-kyc
// List all users with pending verification
// ====================================================
router.get("/pending-kyc", async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;

    // Get pending drivers
    let pendingDrivers = [];
    if (!role || role === "driver") {
      pendingDrivers = await prisma.driverProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    // Get pending customers
    let pendingCustomers = [];
    if (!role || role === "customer") {
      pendingCustomers = await prisma.customerProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    // Get pending restaurants
    let pendingRestaurants = [];
    if (!role || role === "restaurant") {
      pendingRestaurants = await prisma.restaurantProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    res.json({
      pending: {
        drivers: pendingDrivers.map((d: any) => ({
          userId: d.user.id,
          profileId: d.id,
          email: d.user.email,
          role: d.user.role,
          countryCode: d.user.countryCode,
          verificationStatus: d.verificationStatus,
          createdAt: d.user.createdAt,
        })),
        customers: pendingCustomers.map((c: any) => ({
          userId: c.user.id,
          profileId: c.id,
          email: c.user.email,
          role: c.user.role,
          countryCode: c.user.countryCode,
          verificationStatus: c.verificationStatus,
          createdAt: c.user.createdAt,
        })),
        restaurants: pendingRestaurants.map((r: any) => ({
          userId: r.user.id,
          profileId: r.id,
          email: r.user.email,
          restaurantName: r.restaurantName,
          role: r.user.role,
          countryCode: r.user.countryCode,
          verificationStatus: r.verificationStatus,
          createdAt: r.user.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Pending KYC error:", error);
    res.status(500).json({ error: "Failed to fetch pending KYC" });
  }
});

// ====================================================
// PATCH /api/admin/kyc/:userId
// Approve or reject KYC verification
// ====================================================
router.patch("/kyc/:userId", async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;

    if (!["approved", "rejected", "pending"].includes(verificationStatus)) {
      return res.status(400).json({ error: "Invalid verificationStatus. Must be: approved, rejected, or pending" });
    }

    if (verificationStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ error: "rejectionReason is required when rejecting KYC" });
    }

    // Get user to determine role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isVerified = verificationStatus === "approved";

    // Update appropriate profile based on role
    let updatedProfile;
    if (user.role === "driver") {
      updatedProfile = await prisma.driverProfile.update({
        where: { userId },
        data: {
          verificationStatus,
          isVerified,
          rejectionReason: verificationStatus === "rejected" ? rejectionReason : null,
        },
      });
    } else if (user.role === "customer") {
      updatedProfile = await prisma.customerProfile.update({
        where: { userId },
        data: {
          verificationStatus,
          isVerified,
          rejectionReason: verificationStatus === "rejected" ? rejectionReason : null,
        },
      });
    } else if (user.role === "restaurant") {
      updatedProfile = await prisma.restaurantProfile.update({
        where: { userId },
        data: {
          verificationStatus,
          isVerified,
          rejectionReason: verificationStatus === "rejected" ? rejectionReason : null,
        },
      });
    } else {
      return res.status(400).json({ error: "Admin users do not require KYC verification" });
    }

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId,
        type: "verification",
        title: `KYC ${verificationStatus}`,
        body: verificationStatus === "approved"
          ? "Your KYC has been approved. You can now use SafeGo services."
          : `Your KYC has been rejected. Reason: ${rejectionReason}`,
      },
    });

    res.json({
      message: `KYC ${verificationStatus} for user ${user.email}`,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("KYC update error:", error);
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

// ====================================================
// GET /api/admin/kyc/pending
// Frontend-compatible endpoint for pending KYC requests
// ====================================================
router.get("/kyc/pending", async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;

    // If no role specified, return empty array
    if (!role || typeof role !== "string") {
      return res.json([]);
    }

    let pendingUsers: any[] = [];

    if (role === "driver") {
      const profiles = await prisma.driverProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id, // profileId
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        verificationStatus: p.verificationStatus,
        dateOfBirth: p.dateOfBirth,
        nid: p.nidNumber,
        governmentId: p.governmentIdLast4,
        createdAt: p.user.createdAt,
      }));
    } else if (role === "customer") {
      const profiles = await prisma.customerProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id, // profileId
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        verificationStatus: p.verificationStatus,
        dateOfBirth: p.dateOfBirth,
        nid: p.nidNumber,
        governmentId: p.governmentIdLast4,
        createdAt: p.user.createdAt,
      }));
    } else if (role === "restaurant") {
      const profiles = await prisma.restaurantProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id, // profileId
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        restaurantName: p.restaurantName,
        verificationStatus: p.verificationStatus,
        createdAt: p.user.createdAt,
      }));
    }

    res.json(pendingUsers);
  } catch (error) {
    console.error("KYC pending fetch error:", error);
    res.status(500).json({ error: "Failed to fetch pending KYC requests" });
  }
});

// ====================================================
// POST /api/admin/kyc/approve
// Frontend-compatible endpoint for approving KYC
// ====================================================
router.post("/kyc/approve", async (req: AuthRequest, res) => {
  try {
    const { role, profileId } = req.body;

    if (!role || !profileId) {
      return res.status(400).json({ error: "role and profileId are required" });
    }

    // Get the userId from the profile
    let userId: string | null = null;
    if (role === "driver") {
      const profile = await prisma.driverProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.driverProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isVerified: true,
          rejectionReason: null,
        },
      });
    } else if (role === "customer") {
      const profile = await prisma.customerProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.customerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isVerified: true,
          rejectionReason: null,
        },
      });
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Restaurant profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.restaurantProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isVerified: true,
          rejectionReason: null,
        },
      });
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Create notification
    if (userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: "verification",
          title: "KYC Approved",
          body: "Your KYC has been approved. You can now use SafeGo services.",
        },
      });
    }

    res.json({
      message: "KYC approved successfully",
      profileId,
    });
  } catch (error) {
    console.error("KYC approval error:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

// ====================================================
// POST /api/admin/kyc/reject
// Frontend-compatible endpoint for rejecting KYC
// ====================================================
router.post("/kyc/reject", async (req: AuthRequest, res) => {
  try {
    const { role, profileId, reason } = req.body;

    if (!role || !profileId || !reason) {
      return res.status(400).json({ error: "role, profileId, and reason are required" });
    }

    // Get the userId from the profile
    let userId: string | null = null;
    if (role === "driver") {
      const profile = await prisma.driverProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.driverProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isVerified: false,
          rejectionReason: reason,
        },
      });
    } else if (role === "customer") {
      const profile = await prisma.customerProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.customerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isVerified: false,
          rejectionReason: reason,
        },
      });
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Restaurant profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.restaurantProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isVerified: false,
          rejectionReason: reason,
        },
      });
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Create notification
    if (userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: "verification",
          title: "KYC Rejected",
          body: `Your KYC has been rejected. Reason: ${reason}`,
        },
      });
    }

    res.json({
      message: "KYC rejected successfully",
      profileId,
    });
  } catch (error) {
    console.error("KYC rejection error:", error);
    res.status(500).json({ error: "Failed to reject KYC" });
  }
});

// ====================================================
// PATCH /api/admin/block/:userId
// Block or unblock a user
// ====================================================
router.patch("/block/:userId", async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== "boolean") {
      return res.status(400).json({ error: "isBlocked must be a boolean" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent blocking admin users
    if (user.role === "admin") {
      return res.status(400).json({ error: "Cannot block admin users" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: "admin",
        title: isBlocked ? "Account Blocked" : "Account Unblocked",
        body: isBlocked
          ? "Your account has been blocked. Please contact support for more information."
          : "Your account has been unblocked. You can now access SafeGo services.",
      },
    });

    res.json({
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isBlocked: updatedUser.isBlocked,
      },
    });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ error: "Failed to update user block status" });
  }
});

// ====================================================
// GET /api/admin/users
// List all users with optional role filter
// ====================================================
router.get("/users", async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;

    const users = await prisma.user.findMany({
      where: role ? { role: role as string } : undefined,
      select: {
        id: true,
        email: true,
        role: true,
        countryCode: true,
        isBlocked: true,
        createdAt: true,
        driverProfile: {
          select: {
            verificationStatus: true,
            isVerified: true,
          },
        },
        customerProfile: {
          select: {
            verificationStatus: true,
            isVerified: true,
          },
        },
        restaurantProfile: {
          select: {
            restaurantName: true,
            verificationStatus: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ====================================================
// POST /api/admin/settle-wallet
// Settle negative balance for driver or restaurant
// ====================================================
router.post("/settle-wallet", async (req: AuthRequest, res) => {
  try {
    const { walletType, walletId, settlementAmount } = req.body;

    if (!["driver", "restaurant"].includes(walletType)) {
      return res.status(400).json({ error: "walletType must be 'driver' or 'restaurant'" });
    }

    if (!walletId || !settlementAmount) {
      return res.status(400).json({ error: "walletId and settlementAmount are required" });
    }

    const amount = parseFloat(settlementAmount);
    if (amount <= 0) {
      return res.status(400).json({ error: "settlementAmount must be positive" });
    }

    if (walletType === "driver") {
      const wallet = await prisma.driverWallet.findUnique({ where: { id: walletId } });

      if (!wallet) {
        return res.status(404).json({ error: "Driver wallet not found" });
      }

      if (wallet.negativeBalance < amount) {
        return res.status(400).json({ error: "Settlement amount exceeds negative balance" });
      }

      // Settle the amount
      const updatedWallet = await prisma.driverWallet.update({
        where: { id: walletId },
        data: {
          negativeBalance: { decrement: amount },
        },
      });

      res.json({
        message: "Driver wallet settled successfully",
        wallet: {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          negativeBalance: updatedWallet.negativeBalance,
        },
      });
    } else {
      const wallet = await prisma.restaurantWallet.findUnique({ where: { id: walletId } });

      if (!wallet) {
        return res.status(404).json({ error: "Restaurant wallet not found" });
      }

      if (wallet.negativeBalance < amount) {
        return res.status(400).json({ error: "Settlement amount exceeds negative balance" });
      }

      // Settle the amount
      const updatedWallet = await prisma.restaurantWallet.update({
        where: { id: walletId },
        data: {
          negativeBalance: { decrement: amount },
        },
      });

      res.json({
        message: "Restaurant wallet settled successfully",
        wallet: {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          negativeBalance: updatedWallet.negativeBalance,
        },
      });
    }
  } catch (error) {
    console.error("Settle wallet error:", error);
    res.status(500).json({ error: "Failed to settle wallet" });
  }
});

export default router;
