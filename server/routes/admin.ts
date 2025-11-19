import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(["admin"]));

// ====================================================
// GET /api/admin/stats
// Get platform statistics for admin dashboard
// ====================================================
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    // Count total users
    const totalUsers = await prisma.user.count();

    // Total drivers (all driver profiles)
    const totalDrivers = await prisma.driverProfile.count();

    // Count active drivers (distinct drivers with at least one online vehicle)
    // Using groupBy to get distinct driverIds where isOnline = true
    const activeDriversList = await prisma.vehicle.groupBy({
      by: ['driverId'],
      where: { isOnline: true },
    });
    const activeDrivers = activeDriversList.length;

    // Pending drivers (not yet approved)
    const pendingDrivers = await prisma.driverProfile.count({
      where: { verificationStatus: "pending" },
    });

    // Pending customers
    const pendingCustomers = await prisma.customerProfile.count({
      where: { verificationStatus: "pending" },
    });

    // Pending restaurants
    const pendingRestaurants = await prisma.restaurantProfile.count({
      where: { verificationStatus: "pending" },
    });

    // Suspended drivers
    const suspendedDrivers = await prisma.driverProfile.count({
      where: { isSuspended: true },
    });

    // Blocked drivers (users with isBlocked = true and role = driver)
    const blockedDrivers = await prisma.user.count({
      where: {
        role: "driver",
        isBlocked: true,
      },
    });

    // Count total customers (users with role = customer)
    const totalCustomers = await prisma.user.count({
      where: { role: "customer" },
    });

    // Count total restaurants (users with role = restaurant)
    const restaurants = await prisma.user.count({
      where: { role: "restaurant" },
    });

    // Total complaints (open complaints - includes both driver and restaurant complaints)
    const openComplaints = await prisma.driverComplaint.count({
      where: { status: "open" },
    });

    res.json({
      totalUsers,
      totalDrivers,
      activeDrivers,
      pendingDrivers,
      pendingCustomers,
      pendingRestaurants,
      suspendedDrivers,
      blockedDrivers,
      totalCustomers,
      restaurants,
      openComplaints,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

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

// ====================================================
// DRIVER MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/drivers
// List all drivers with search, filters, and pagination
// ====================================================
router.get("/drivers", async (req: AuthRequest, res) => {
  try {
    const {
      search,
      country,
      verificationStatus,
      isSuspended,
      isOnline,
      status,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = { contains: search as string, mode: "insensitive" };
    }

    // Filter by country
    if (country) {
      userFilters.countryCode = country as string;
    }

    // Filter by verification status
    if (verificationStatus) {
      where.verificationStatus = verificationStatus as string;
    }

    // Filter by suspension status
    if (isSuspended !== undefined) {
      where.isSuspended = isSuspended === "true";
    }

    // Filter by status (active, suspended, blocked)
    if (status === "suspended") {
      where.isSuspended = true;
    } else if (status === "blocked") {
      userFilters.isBlocked = true;
    } else if (status === "active") {
      userFilters.isBlocked = false;
      where.isSuspended = false;
      where.isVerified = true;
    }

    // Apply user filters if any exist
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    // Filter by online status (requires vehicle check)
    let onlineFilter: any = undefined;
    if (isOnline !== undefined) {
      onlineFilter = { isOnline: isOnline === "true" };
    } else if (status === "active") {
      onlineFilter = { isOnline: true };
    }

    // Fetch drivers with full details
    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              countryCode: true,
              isBlocked: true,
              createdAt: true,
            },
          },
          vehicle: onlineFilter ? { where: onlineFilter } : true,
          stats: true,
          driverWallet: true,
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.driverProfile.count({ where }),
    ]);

    // Format response
    const formattedDrivers = drivers.map((driver) => ({
      id: driver.id,
      userId: driver.user.id,
      email: driver.user.email,
      countryCode: driver.user.countryCode,
      verificationStatus: driver.verificationStatus,
      isVerified: driver.isVerified,
      isSuspended: driver.isSuspended,
      suspensionReason: driver.suspensionReason,
      isBlocked: driver.user.isBlocked,
      isOnline: driver.vehicle?.isOnline || false,
      lastActive: driver.lastActive,
      totalTrips: driver.stats?.totalTrips || 0,
      totalEarnings: driver.stats?.totalEarnings || 0,
      averageRating: driver.stats?.averageRating || 0,
      walletBalance: driver.driverWallet?.balance || 0,
      negativeBalance: driver.driverWallet?.negativeBalance || 0,
      vehicleType: driver.vehicle?.vehicleType,
      vehicleModel: driver.vehicle?.vehicleModel,
      vehiclePlate: driver.vehicle?.vehiclePlate,
      createdAt: driver.user.createdAt,
    }));

    res.json({
      drivers: formattedDrivers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List drivers error:", error);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// ====================================================
// GET /api/admin/drivers/pending
// List drivers with pending verification
// ====================================================
router.get("/drivers/pending", async (req: AuthRequest, res) => {
  try {
    const pendingDrivers = await prisma.driverProfile.findMany({
      where: { verificationStatus: "pending" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" }, // FIFO order
    });

    const formatted = pendingDrivers.map((driver) => ({
      id: driver.id,
      userId: driver.user.id,
      email: driver.user.email,
      countryCode: driver.user.countryCode,
      verificationStatus: driver.verificationStatus,
      dateOfBirth: driver.dateOfBirth,
      nidNumber: driver.nidNumber,
      governmentIdLast4: driver.governmentIdLast4,
      createdAt: driver.user.createdAt,
    }));

    res.json({ drivers: formatted });
  } catch (error) {
    console.error("Pending drivers error:", error);
    res.status(500).json({ error: "Failed to fetch pending drivers" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id
// Get detailed driver information
// ====================================================
router.get("/drivers/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: true,
        vehicle: true,
        stats: true,
        driverWallet: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({
      driver: {
        id: driver.id,
        userId: driver.user.id,
        email: driver.user.email,
        countryCode: driver.user.countryCode,
        isBlocked: driver.user.isBlocked,
        verificationStatus: driver.verificationStatus,
        isVerified: driver.isVerified,
        rejectionReason: driver.rejectionReason,
        isSuspended: driver.isSuspended,
        suspensionReason: driver.suspensionReason,
        suspendedAt: driver.suspendedAt,
        lastActive: driver.lastActive,
        dateOfBirth: driver.dateOfBirth,
        emergencyContactName: driver.emergencyContactName,
        emergencyContactPhone: driver.emergencyContactPhone,
        // Bangladesh fields
        fatherName: driver.fatherName,
        presentAddress: driver.presentAddress,
        permanentAddress: driver.permanentAddress,
        nidNumber: driver.nidNumber,
        nidFrontImageUrl: driver.nidFrontImageUrl,
        nidBackImageUrl: driver.nidBackImageUrl,
        // US fields
        homeAddress: driver.homeAddress,
        governmentIdType: driver.governmentIdType,
        governmentIdLast4: driver.governmentIdLast4,
        driverLicenseNumber: driver.driverLicenseNumber,
        driverLicenseImageUrl: driver.driverLicenseImageUrl,
        driverLicenseExpiry: driver.driverLicenseExpiry,
        ssnLast4: driver.ssnLast4,
        // Vehicle info
        vehicle: driver.vehicle
          ? {
              id: driver.vehicle.id,
              vehicleType: driver.vehicle.vehicleType,
              vehicleModel: driver.vehicle.vehicleModel,
              vehiclePlate: driver.vehicle.vehiclePlate,
              isOnline: driver.vehicle.isOnline,
              totalEarnings: driver.vehicle.totalEarnings,
            }
          : null,
        // Stats
        totalTrips: driver.stats?.totalTrips || 0,
        totalEarnings: driver.stats?.totalEarnings || 0,
        averageRating: driver.stats?.averageRating || 0,
        completionRate: driver.stats?.completionRate || 0,
        // Wallet
        walletBalance: driver.driverWallet?.balance || 0,
        negativeBalance: driver.driverWallet?.negativeBalance || 0,
        createdAt: driver.user.createdAt,
        updatedAt: driver.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get driver details error:", error);
    res.status(500).json({ error: "Failed to fetch driver details" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id/trips
// Get driver trip history with filters
// ====================================================
router.get("/drivers/:id/trips", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { driverId: id };

    if (status) {
      where.status = status as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [trips, total] = await Promise.all([
      prisma.ride.findMany({
        where,
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
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ride.count({ where }),
    ]);

    const formattedTrips = trips.map((trip) => ({
      id: trip.id,
      customerEmail: trip.customer.user.email,
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress,
      serviceFare: trip.serviceFare,
      driverPayout: trip.driverPayout,
      paymentMethod: trip.paymentMethod,
      status: trip.status,
      customerRating: trip.customerRating,
      createdAt: trip.createdAt,
      completedAt: trip.completedAt,
    }));

    res.json({
      trips: formattedTrips,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get driver trips error:", error);
    res.status(500).json({ error: "Failed to fetch driver trips" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/suspend
// Suspend a driver (temporary)
// ====================================================
router.patch("/drivers/:id/suspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (driver.isSuspended) {
      return res.status(400).json({ error: "Driver is already suspended" });
    }

    // Update driver profile
    const updated = await prisma.driverProfile.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: driver.userId,
        type: "admin",
        title: "Account Suspended",
        body: `Your driver account has been temporarily suspended. Reason: ${reason}`,
      },
    });

    res.json({
      message: "Driver suspended successfully",
      driver: {
        id: updated.id,
        isSuspended: updated.isSuspended,
        suspensionReason: updated.suspensionReason,
        suspendedAt: updated.suspendedAt,
      },
    });
  } catch (error) {
    console.error("Suspend driver error:", error);
    res.status(500).json({ error: "Failed to suspend driver" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/unsuspend
// Unsuspend a driver
// ====================================================
router.patch("/drivers/:id/unsuspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (!driver.isSuspended) {
      return res.status(400).json({ error: "Driver is not suspended" });
    }

    // Update driver profile
    const updated = await prisma.driverProfile.update({
      where: { id },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: driver.userId,
        type: "admin",
        title: "Account Unsuspended",
        body: "Your driver account suspension has been lifted. You can now accept ride requests.",
      },
    });

    res.json({
      message: "Driver unsuspended successfully",
      driver: {
        id: updated.id,
        isSuspended: updated.isSuspended,
      },
    });
  } catch (error) {
    console.error("Unsuspend driver error:", error);
    res.status(500).json({ error: "Failed to unsuspend driver" });
  }
});

// ====================================================
// DELETE /api/admin/drivers/:id
// Delete a driver (only if no active trips/wallet issues)
// ====================================================
router.delete("/drivers/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: true,
        driverWallet: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Check for active trips
    const activeTrips = await prisma.ride.count({
      where: {
        driverId: id,
        status: {
          in: ["accepted", "driver_arriving", "in_progress"],
        },
      },
    });

    if (activeTrips > 0) {
      return res.status(400).json({
        error: "Cannot delete driver with active trips. Please wait for trips to complete.",
      });
    }

    // Check for negative balance
    if (driver.driverWallet && driver.driverWallet.negativeBalance > 0) {
      return res.status(400).json({
        error: "Cannot delete driver with unresolved negative balance. Settle wallet first.",
      });
    }

    // Delete driver (cascade will handle related records)
    await prisma.user.delete({
      where: { id: driver.userId },
    });

    res.json({
      message: "Driver deleted successfully",
      driverId: id,
    });
  } catch (error) {
    console.error("Delete driver error:", error);
    res.status(500).json({ error: "Failed to delete driver" });
  }
});

// ====================================================
// RESTAURANT MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/restaurants
// List all restaurants with filters
// ====================================================
router.get("/restaurants", async (req: AuthRequest, res) => {
  try {
    const { search, status } = req.query;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = {
        contains: search as string,
        mode: "insensitive",
      };
    }

    // Filter by status (active/suspended/blocked)
    if (status === "active") {
      where.isSuspended = false;
      userFilters.isBlocked = false;
    } else if (status === "suspended") {
      where.isSuspended = true;
    } else if (status === "blocked") {
      userFilters.isBlocked = true;
    }

    // Combine filters
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    const restaurants = await prisma.restaurantProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
        restaurantWallet: {
          select: {
            balance: true,
            negativeBalance: true,
          },
        },
        foodOrders: {
          where: {
            status: "delivered",
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant.id,
      userId: restaurant.user.id,
      email: restaurant.user.email,
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      country: restaurant.user.countryCode,
      verificationStatus: restaurant.verificationStatus,
      isVerified: restaurant.isVerified,
      rejectionReason: restaurant.rejectionReason,
      isSuspended: restaurant.isSuspended,
      suspensionReason: restaurant.suspensionReason,
      suspendedAt: restaurant.suspendedAt,
      isBlocked: restaurant.user.isBlocked,
      balance: restaurant.restaurantWallet?.balance || 0,
      negativeBalance: restaurant.restaurantWallet?.negativeBalance || 0,
      totalOrders: restaurant.foodOrders.length,
      createdAt: restaurant.createdAt,
    }));

    res.json(formattedRestaurants);
  } catch (error) {
    console.error("List restaurants error:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// ====================================================
// GET /api/admin/restaurants/:id
// Get restaurant details
// ====================================================
router.get("/restaurants/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        restaurantWallet: true,
        foodOrders: {
          select: {
            id: true,
            status: true,
            serviceFare: true,
            safegoCommission: true,
            restaurantPayout: true,
            createdAt: true,
            deliveredAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        complaints: {
          select: {
            id: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Calculate stats
    const completedOrders = restaurant.foodOrders.filter(
      (order) => order.status === "delivered"
    );
    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.restaurantPayout),
      0
    );
    const totalCommission = completedOrders.reduce(
      (sum, order) => sum + Number(order.safegoCommission),
      0
    );

    const formattedRestaurant = {
      id: restaurant.id,
      userId: restaurant.user.id,
      email: restaurant.user.email,
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      country: restaurant.user.countryCode,
      verificationStatus: restaurant.verificationStatus,
      isVerified: restaurant.isVerified,
      rejectionReason: restaurant.rejectionReason,
      isSuspended: restaurant.isSuspended,
      suspensionReason: restaurant.suspensionReason,
      suspendedAt: restaurant.suspendedAt,
      isBlocked: restaurant.user.isBlocked,
      balance: restaurant.restaurantWallet?.balance || 0,
      negativeBalance: restaurant.restaurantWallet?.negativeBalance || 0,
      totalOrders: restaurant.foodOrders.length,
      completedOrders: completedOrders.length,
      totalRevenue,
      totalCommission,
      recentOrders: restaurant.foodOrders,
      complaints: restaurant.complaints,
      createdAt: restaurant.createdAt,
      accountCreated: restaurant.user.createdAt,
    };

    res.json(formattedRestaurant);
  } catch (error) {
    console.error("Get restaurant details error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/suspend
// Suspend a restaurant (temporary - can't receive orders)
// ====================================================
router.patch("/restaurants/:id/suspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (restaurant.isSuspended) {
      return res.status(400).json({ error: "Restaurant is already suspended" });
    }

    const updated = await prisma.restaurantProfile.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: restaurant.userId,
        type: "admin",
        title: "Account Suspended",
        body: `Your restaurant account has been suspended. Reason: ${reason}`,
      },
    });

    res.json({
      message: "Restaurant suspended successfully",
      restaurant: {
        id: updated.id,
        isSuspended: updated.isSuspended,
        suspensionReason: updated.suspensionReason,
      },
    });
  } catch (error) {
    console.error("Suspend restaurant error:", error);
    res.status(500).json({ error: "Failed to suspend restaurant" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/unsuspend
// Unsuspend a restaurant (lift temporary suspension)
// ====================================================
router.patch("/restaurants/:id/unsuspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isSuspended) {
      return res.status(400).json({ error: "Restaurant is not suspended" });
    }

    const updated = await prisma.restaurantProfile.update({
      where: { id },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: restaurant.userId,
        type: "admin",
        title: "Account Unsuspended",
        body: "Your restaurant account suspension has been lifted. You can now receive orders.",
      },
    });

    res.json({
      message: "Restaurant unsuspended successfully",
      restaurant: {
        id: updated.id,
        isSuspended: updated.isSuspended,
      },
    });
  } catch (error) {
    console.error("Unsuspend restaurant error:", error);
    res.status(500).json({ error: "Failed to unsuspend restaurant" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/block
// Block a restaurant permanently (disables user account)
// ====================================================
router.patch("/restaurants/:id/block", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (restaurant.user.isBlocked) {
      return res.status(400).json({ error: "Restaurant is already blocked" });
    }

    await prisma.user.update({
      where: { id: restaurant.userId },
      data: { isBlocked: true },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: restaurant.userId,
        type: "admin",
        title: "Account Blocked",
        body: "Your restaurant account has been blocked by an administrator.",
      },
    });

    res.json({
      message: "Restaurant blocked successfully",
      restaurantId: id,
      userId: restaurant.userId,
    });
  } catch (error) {
    console.error("Block restaurant error:", error);
    res.status(500).json({ error: "Failed to block restaurant" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/unblock
// Unblock a restaurant (reactivate user account)
// ====================================================
router.patch("/restaurants/:id/unblock", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.user.isBlocked) {
      return res.status(400).json({ error: "Restaurant is not blocked" });
    }

    await prisma.user.update({
      where: { id: restaurant.userId },
      data: { isBlocked: false },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: restaurant.userId,
        type: "admin",
        title: "Account Unblocked",
        body: "Your restaurant account has been unblocked by an administrator.",
      },
    });

    res.json({
      message: "Restaurant unblocked successfully",
      restaurantId: id,
      userId: restaurant.userId,
    });
  } catch (error) {
    console.error("Unblock restaurant error:", error);
    res.status(500).json({ error: "Failed to unblock restaurant" });
  }
});

// ====================================================
// DRIVER COMPLAINTS ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/complaints
// List all driver complaints with filters
// ====================================================
router.get("/complaints", async (req: AuthRequest, res) => {
  try {
    const { status, driverId, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (driverId) {
      where.driverId = driverId as string;
    }

    const [complaints, total] = await Promise.all([
      prisma.driverComplaint.findMany({
        where,
        include: {
          driver: {
            include: {
              user: {
                select: {
                  email: true,
                  countryCode: true,
                },
              },
            },
          },
          customer: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          ride: {
            select: {
              id: true,
              pickupAddress: true,
              dropoffAddress: true,
              status: true,
              createdAt: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.driverComplaint.count({ where }),
    ]);

    const formattedComplaints = complaints.map((complaint) => ({
      id: complaint.id,
      driverId: complaint.driverId,
      driverEmail: complaint.driver.user.email,
      customerId: complaint.customerId,
      customerEmail: complaint.customer?.user.email || null,
      rideId: complaint.rideId,
      ride: complaint.ride || null,
      reason: complaint.reason,
      description: complaint.description,
      status: complaint.status,
      resolvedAt: complaint.resolvedAt,
      resolvedBy: complaint.resolvedBy,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    }));

    res.json({
      complaints: formattedComplaints,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List complaints error:", error);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// ====================================================
// GET /api/admin/complaints/:id
// Get complaint details
// ====================================================
router.get("/complaints/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const complaint = await prisma.driverComplaint.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                countryCode: true,
                isBlocked: true,
              },
            },
          },
        },
        customer: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        ride: true,
      },
    });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    res.json({
      complaint: {
        id: complaint.id,
        driverId: complaint.driverId,
        driver: {
          id: complaint.driver.id,
          email: complaint.driver.user.email,
          countryCode: complaint.driver.user.countryCode,
          isBlocked: complaint.driver.user.isBlocked,
          isSuspended: complaint.driver.isSuspended,
          verificationStatus: complaint.driver.verificationStatus,
        },
        customerId: complaint.customerId,
        customer: complaint.customer
          ? {
              id: complaint.customer.id,
              email: complaint.customer.user.email,
            }
          : null,
        rideId: complaint.rideId,
        ride: complaint.ride || null,
        reason: complaint.reason,
        description: complaint.description,
        status: complaint.status,
        resolvedAt: complaint.resolvedAt,
        resolvedBy: complaint.resolvedBy,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get complaint details error:", error);
    res.status(500).json({ error: "Failed to fetch complaint details" });
  }
});

// ====================================================
// POST /api/admin/complaints
// Create a new complaint (admin can create manually)
// ====================================================
router.post("/complaints", async (req: AuthRequest, res) => {
  try {
    const { driverId, customerId, rideId, reason, description } = req.body;

    if (!driverId || !reason) {
      return res.status(400).json({ error: "driverId and reason are required" });
    }

    // Verify driver exists
    const driver = await prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Verify customer if provided
    if (customerId) {
      const customer = await prisma.customerProfile.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
    }

    // Verify ride if provided
    if (rideId) {
      const ride = await prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
      }
    }

    const complaint = await prisma.driverComplaint.create({
      data: {
        driverId,
        customerId: customerId || null,
        rideId: rideId || null,
        reason,
        description: description || null,
      },
    });

    res.json({
      message: "Complaint created successfully",
      complaint,
    });
  } catch (error) {
    console.error("Create complaint error:", error);
    res.status(500).json({ error: "Failed to create complaint" });
  }
});

// ====================================================
// PATCH /api/admin/complaints/:id/resolve
// Resolve a complaint
// ====================================================
router.patch("/complaints/:id/resolve", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user?.userId;

    const complaint = await prisma.driverComplaint.findUnique({ where: { id } });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    if (complaint.status === "resolved") {
      return res.status(400).json({ error: "Complaint is already resolved" });
    }

    const updated = await prisma.driverComplaint.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    });

    res.json({
      message: "Complaint resolved successfully",
      complaint: updated,
    });
  } catch (error) {
    console.error("Resolve complaint error:", error);
    res.status(500).json({ error: "Failed to resolve complaint" });
  }
});

// ====================================================
// CUSTOMER MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/customers
// List all customers with filters and usage statistics
// ====================================================
router.get("/customers", async (req: AuthRequest, res) => {
  try {
    const { search, status } = req.query;

    // Build where clause
    const whereClause: any = {};

    // Join with user table for email search and status filtering
    const userWhere: any = { role: "customer" };

    if (search) {
      userWhere.email = {
        contains: search as string,
        mode: "insensitive",
      };
    }

    if (status) {
      if (status === "active") {
        userWhere.isBlocked = false;
        whereClause.isSuspended = false;
      } else if (status === "suspended") {
        whereClause.isSuspended = true;
      } else if (status === "blocked") {
        userWhere.isBlocked = true;
      }
    }

    whereClause.user = userWhere;

    const customers = await prisma.customerProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        rides: {
          select: { id: true, status: true },
        },
        foodOrders: {
          select: { id: true, status: true },
        },
        deliveries: {
          select: { id: true, status: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate usage statistics for each customer
    const customersWithStats = customers.map((customer) => ({
      id: customer.id,
      userId: customer.userId,
      email: customer.user.email,
      country: customer.user.countryCode,
      verificationStatus: customer.verificationStatus,
      isVerified: customer.isVerified,
      isSuspended: customer.isSuspended,
      suspensionReason: customer.suspensionReason,
      suspendedAt: customer.suspendedAt,
      isBlocked: customer.user.isBlocked,
      createdAt: customer.user.createdAt,
      totalRides: customer.rides.length,
      completedRides: customer.rides.filter((r) => r.status === "completed").length,
      totalFoodOrders: customer.foodOrders.length,
      completedFoodOrders: customer.foodOrders.filter((o) => o.status === "completed").length,
      totalParcels: customer.deliveries.length,
      completedParcels: customer.deliveries.filter((d) => d.status === "completed").length,
    }));

    res.json(customersWithStats);
  } catch (error) {
    console.error("Fetch customers error:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// ====================================================
// GET /api/admin/customers/:id
// Get detailed customer information with statistics
// ====================================================
router.get("/customers/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        rides: {
          select: {
            id: true,
            status: true,
            pickupLocation: true,
            dropoffLocation: true,
            fare: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        foodOrders: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        deliveries: {
          select: {
            id: true,
            status: true,
            pickupLocation: true,
            dropoffLocation: true,
            fare: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        driverComplaints: {
          select: {
            id: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Calculate statistics
    const stats = {
      totalRides: customer.rides.length,
      completedRides: customer.rides.filter((r) => r.status === "completed").length,
      totalFoodOrders: customer.foodOrders.length,
      completedFoodOrders: customer.foodOrders.filter((o) => o.status === "completed").length,
      totalParcels: customer.deliveries.length,
      completedParcels: customer.deliveries.filter((d) => d.status === "completed").length,
      openComplaints: customer.driverComplaints.filter((c) => c.status === "open").length,
    };

    res.json({
      ...customer,
      stats,
    });
  } catch (error) {
    console.error("Fetch customer details error:", error);
    res.status(500).json({ error: "Failed to fetch customer details" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/suspend
// Suspend a customer account (temporary restriction)
// ====================================================
router.patch("/customers/:id/suspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const customer = await prisma.customerProfile.findUnique({ where: { id } });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (customer.isSuspended) {
      return res.status(400).json({ error: "Customer is already suspended" });
    }

    const updated = await prisma.customerProfile.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: customer.userId,
        type: "account_suspended",
        title: "Account Suspended",
        message: `Your account has been suspended. Reason: ${reason}`,
      },
    });

    res.json({
      message: "Customer suspended successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Suspend customer error:", error);
    res.status(500).json({ error: "Failed to suspend customer" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/unsuspend
// Unsuspend a customer account
// ====================================================
router.patch("/customers/:id/unsuspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({ where: { id } });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!customer.isSuspended) {
      return res.status(400).json({ error: "Customer is not suspended" });
    }

    const updated = await prisma.customerProfile.update({
      where: { id },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: customer.userId,
        type: "account_active",
        title: "Account Unsuspended",
        message: "Your account suspension has been lifted. You can now use SafeGo services.",
      },
    });

    res.json({
      message: "Customer unsuspended successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Unsuspend customer error:", error);
    res.status(500).json({ error: "Failed to unsuspend customer" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/block
// Permanently block a customer account
// ====================================================
router.patch("/customers/:id/block", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({ 
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (customer.user.isBlocked) {
      return res.status(400).json({ error: "Customer is already blocked" });
    }

    // Block the user account
    await prisma.user.update({
      where: { id: customer.userId },
      data: { isBlocked: true },
    });

    // Get updated customer with user data
    const updated = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: customer.userId,
        type: "account_blocked",
        title: "Account Blocked",
        message: "Your account has been permanently blocked. Please contact support for more information.",
      },
    });

    res.json({
      message: "Customer blocked successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Block customer error:", error);
    res.status(500).json({ error: "Failed to block customer" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/unblock
// Unblock a customer account
// ====================================================
router.patch("/customers/:id/unblock", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({ 
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!customer.user.isBlocked) {
      return res.status(400).json({ error: "Customer is not blocked" });
    }

    // Unblock the user account
    await prisma.user.update({
      where: { id: customer.userId },
      data: { isBlocked: false },
    });

    // Get updated customer with user data
    const updated = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: customer.userId,
        type: "account_active",
        title: "Account Unblocked",
        message: "Your account has been unblocked. You can now use SafeGo services.",
      },
    });

    res.json({
      message: "Customer unblocked successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Unblock customer error:", error);
    res.status(500).json({ error: "Failed to unblock customer" });
  }
});

export default router;
