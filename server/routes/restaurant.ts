import { Router } from "express";
import { Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { validateRestaurantKYC } from "../utils/kyc-validator";
import { notifyFoodOrderStatusChange, notifyRestaurantIssueEscalated } from "../utils/notifications";
import { prisma } from "../db";
import { auditMenuAction, getClientIp, EntityType } from "../utils/audit";

const router = Router();

// All routes require authentication and restaurant role
router.use(authenticateToken);
router.use(requireRole(["restaurant"]));

// Middleware to check KYC completion for critical operations
async function requireKYCCompletion(req: AuthRequest, res: any, next: any) {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Use user's countryCode as fallback if not set on profile
    const profileWithCountry = {
      ...restaurantProfile,
      countryCode: restaurantProfile.countryCode || restaurantProfile.user.countryCode,
    };

    const kycValidation = validateRestaurantKYC(profileWithCountry);
    if (!kycValidation.isComplete) {
      return res.status(403).json({
        error: "KYC verification required",
        message: "Please complete your KYC verification to perform this action",
        missingFields: kycValidation.missingFields,
        countryCode: kycValidation.countryCode,
      });
    }

    next();
  } catch (error) {
    console.error("KYC check error:", error);
    return res.status(500).json({ error: "Failed to verify KYC status" });
  }
}

// Middleware to check OWNER role for menu management
async function requireOwnerRole(req: AuthRequest, res: any, next: any) {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if user has OWNER role (default to OWNER if not set for backward compatibility)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role !== "OWNER") {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "Only restaurant owners can perform this action",
      });
    }

    next();
  } catch (error) {
    console.error("Owner role check error:", error);
    return res.status(500).json({ error: "Failed to verify permissions" });
  }
}

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

// ====================================================
// WALLET & PAYOUT API
// ====================================================

// GET /api/restaurant/wallet/transactions
// Get restaurant wallet transaction history
router.get("/wallet/transactions", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "restaurant",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.walletTransaction.count({
      where: { walletId: wallet.id },
    });

    res.json({
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST /api/restaurant/payout/request
// Request a payout
router.post("/payout/request", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Validate and parse amount (accepts numbers and numeric strings without precision loss)
    const { amount: rawAmount } = req.body;
    
    if (rawAmount === undefined || rawAmount === null) {
      return res.status(400).json({ error: "Amount is required" });
    }

    let amountDecimal: Prisma.Decimal;
    try {
      amountDecimal = new Prisma.Decimal(rawAmount);
    } catch {
      return res.status(400).json({ error: "Amount must be a valid number" });
    }

    if (!amountDecimal.isPositive()) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "restaurant",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check if restaurant has negative balance
    if (!wallet.negativeBalance.isZero()) {
      return res.status(400).json({
        error: `Cannot request payout while debt exists. Outstanding commission: ${wallet.negativeBalance} ${wallet.currency}`,
      });
    }

    // Check if restaurant has sufficient available balance
    if (wallet.availableBalance.lt(amountDecimal)) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${wallet.availableBalance} ${wallet.currency}`,
      });
    }

    // Create payout request atomically
    const payout = await prisma.$transaction(async (tx) => {
      // Deduct from wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amountDecimal },
        },
      });

      // Verify balance didn't go negative (concurrency protection)
      if (updatedWallet.availableBalance.isNegative()) {
        throw new Error("Insufficient funds - concurrent payout detected");
      }

      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          ownerId: restaurantProfile.id,
          countryCode: wallet.countryCode,
          amount: amountDecimal,
          method: "manual_request",
          status: "pending",
        },
      });

      // Record wallet transaction with accurate post-update snapshot
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          countryCode: wallet.countryCode,
          serviceType: "payout",
          direction: "debit",
          amount: amountDecimal,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "payout",
          referenceId: newPayout.id,
          description: `Payout request #${newPayout.id.substring(0, 8)}`,
        },
      });

      return newPayout;
    });

    res.status(201).json({
      message: "Payout request created successfully",
      payout,
    });
  } catch (error) {
    console.error("Request payout error:", error);
    res.status(500).json({ error: "Failed to create payout request" });
  }
});

// GET /api/restaurant/payouts
// Get restaurant payout history
router.get("/payouts", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const where: any = {
      ownerType: "restaurant",
      ownerId: restaurantProfile.id,
    };

    if (status) {
      where.status = status;
    }

    const payouts = await prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.payout.count({ where });

    res.json({
      payouts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get payouts error:", error);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

// ====================================================
// RESTAURANT PAYOUTS & SETTLEMENT SYSTEM (Phase 5)
// ====================================================

// GET /api/restaurant/payouts/overview
// Get comprehensive payout overview with wallet balance, settlements, etc.
router.get("/payouts/overview", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getRestaurantPayoutOverview } = await import("../payouts/restaurantPayouts");
    const overview = await getRestaurantPayoutOverview(restaurantProfile.id);

    res.json(overview);
  } catch (error: any) {
    console.error("Get payout overview error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout overview" });
  }
});

// GET /api/restaurant/payouts/ledger
// Get detailed wallet transaction ledger
router.get("/payouts/ledger", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getRestaurantLedger } = await import("../payouts/restaurantPayouts");
    const result = await getRestaurantLedger(restaurantProfile.id, limit, offset);

    res.json({
      ledger: result.ledger,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    });
  } catch (error: any) {
    console.error("Get ledger error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ledger" });
  }
});

// GET /api/restaurant/payouts/settlements
// Get settlement cycles (weekly settlements)
router.get("/payouts/settlements", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getRestaurantSettlements } = await import("../payouts/restaurantPayouts");
    const settlements = await getRestaurantSettlements(restaurantProfile.id);

    res.json({ settlements });
  } catch (error: any) {
    console.error("Get settlements error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch settlements" });
  }
});

// POST /api/restaurant/payouts/request-enhanced
// Enhanced payout request with OWNER-only access and comprehensive validation
router.post("/payouts/request-enhanced", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { amount: rawAmount } = req.body;

    // Check if user is RESTAURANT_OWNER (not STAFF)
    const { isRestaurantOwner } = await import("../payouts/restaurantPayouts");
    const isOwner = await isRestaurantOwner(userId);

    if (!isOwner) {
      return res.status(403).json({
        error: "Only restaurant owners can request payouts",
      });
    }

    // Validate amount
    if (rawAmount === undefined || rawAmount === null) {
      return res.status(400).json({ error: "Amount is required" });
    }

    let amountDecimal: Prisma.Decimal;
    try {
      amountDecimal = new Prisma.Decimal(rawAmount);
    } catch {
      return res.status(400).json({ error: "Amount must be a valid number" });
    }

    if (!amountDecimal.isPositive()) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if restaurant is verified
    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "KYC verification required to request payouts",
      });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "RESTAURANT",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check minimum payout threshold
    const minPayoutThreshold = restaurantProfile.countryCode === "BD" ? 500 : 10;
    if (amountDecimal.lt(minPayoutThreshold)) {
      return res.status(400).json({
        error: `Minimum payout amount is ${minPayoutThreshold} ${wallet.currency}`,
      });
    }

    // Check if restaurant has negative balance
    if (!wallet.negativeBalance.isZero()) {
      return res.status(400).json({
        error: `Cannot request payout while debt exists. Outstanding commission: ${wallet.negativeBalance} ${wallet.currency}`,
      });
    }

    // Check if restaurant has sufficient available balance
    if (wallet.availableBalance.lt(amountDecimal)) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${wallet.availableBalance} ${wallet.currency}`,
      });
    }

    // Create payout request atomically
    const payout = await prisma.$transaction(async (tx) => {
      // Deduct from wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amountDecimal },
        },
      });

      // Verify balance didn't go negative (concurrency protection)
      if (updatedWallet.availableBalance.isNegative()) {
        throw new Error("Insufficient funds - concurrent payout detected");
      }

      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          countryCode: wallet.countryCode,
          ownerType: "RESTAURANT",
          ownerId: restaurantProfile.id,
          amount: amountDecimal,
          method: "bank_transfer",
          status: "pending",
          isDemo: restaurantProfile.isDemo,
        },
      });

      // Create wallet transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "RESTAURANT",
          countryCode: wallet.countryCode,
          serviceType: "payout",
          direction: "debit",
          amount: amountDecimal,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "payout",
          referenceId: newPayout.id,
          description: `Payout request #${newPayout.id.substring(0, 8)}`,
        },
      });

      return newPayout;
    });

    res.status(201).json({
      message: "Payout request created successfully",
      payout,
    });
  } catch (error: any) {
    console.error("Request payout error:", error);
    res.status(500).json({ error: error.message || "Failed to create payout request" });
  }
});

// ====================================================
// MENU MANAGEMENT API
// ====================================================

// GET /api/restaurant/menu/categories
// Get all menu categories for restaurant
router.get("/menu/categories", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurantProfile.id },
      orderBy: { displayOrder: "asc" },
      include: {
        menuItems: {
          where: { isArchived: false },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error("Get menu categories error:", error);
    res.status(500).json({ error: "Failed to fetch menu categories" });
  }
});

// ====================================================
// RESTAURANT ORDER MANAGEMENT API
// ====================================================

// GET /api/restaurant/orders/overview
// Get restaurant orders overview with today's stats (requires KYC completion)
router.get("/orders/overview", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { restaurantWallet: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's orders
    const todayOrders = await prisma.foodOrder.findMany({
      where: {
        restaurantId: restaurantProfile.id,
        createdAt: { gte: todayStart },
      },
    });

    // Calculate today's stats
    const todayStats = todayOrders.reduce(
      (acc, order) => {
        acc.totalOrders++;
        acc.totalRevenue = acc.totalRevenue.add(order.serviceFare);
        acc.totalCommission = acc.totalCommission.add(order.safegoCommission);
        
        if (order.status === "placed") acc.placedCount++;
        else if (order.status === "accepted" || order.status === "preparing" || order.status === "ready_for_pickup") 
          acc.activeCount++;
        else if (order.status === "delivered") acc.completedCount++;
        else if (order.status.startsWith("cancelled")) acc.cancelledCount++;
        
        return acc;
      },
      {
        totalOrders: 0,
        totalRevenue: new Prisma.Decimal(0),
        totalCommission: new Prisma.Decimal(0),
        placedCount: 0,
        activeCount: 0,
        completedCount: 0,
        cancelledCount: 0,
      }
    );

    res.json({
      today: {
        totalOrders: todayStats.totalOrders,
        totalRevenue: todayStats.totalRevenue.toNumber(),
        totalCommission: todayStats.totalCommission.toNumber(),
        netRevenue: todayStats.totalRevenue.minus(todayStats.totalCommission).toNumber(),
        placedCount: todayStats.placedCount,
        activeCount: todayStats.activeCount,
        completedCount: todayStats.completedCount,
        cancelledCount: todayStats.cancelledCount,
      },
      wallet: restaurantProfile.restaurantWallet ? {
        balance: restaurantProfile.restaurantWallet.balance.toNumber(),
        negativeBalance: restaurantProfile.restaurantWallet.negativeBalance.toNumber(),
      } : null,
    });
  } catch (error) {
    console.error("Get orders overview error:", error);
    res.status(500).json({ error: "Failed to fetch orders overview" });
  }
});

// GET /api/restaurant/orders/live
// Get live orders board (Kanban-style) (requires KYC completion)
router.get("/orders/live", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get all active orders (not completed or cancelled)
    const activeStatuses = [
      "placed",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "on_the_way",
    ];

    const liveOrders = await prisma.foodOrder.findMany({
      where: {
        restaurantId: restaurantProfile.id,
        status: { in: activeStatuses },
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: {
          include: {
            user: { select: { email: true } },
          },
        },
        driver: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });

    // Group by status
    const boardColumns = {
      placed: [] as any[],
      accepted: [] as any[],
      preparing: [] as any[],
      ready_for_pickup: [] as any[],
      picked_up: [] as any[],
      on_the_way: [] as any[],
    };

    liveOrders.forEach((order) => {
      const column = boardColumns[order.status as keyof typeof boardColumns];
      if (column) {
        column.push({
          ...order,
          items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        });
      }
    });

    res.json({ board: boardColumns });
  } catch (error) {
    console.error("Get live orders error:", error);
    res.status(500).json({ error: "Failed to fetch live orders" });
  }
});

// GET /api/restaurant/orders
// Get all orders for restaurant
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const status = req.query.status as string;
    const orderType = req.query.orderType as string;
    const paymentStatus = req.query.paymentStatus as string;
    const timeRange = req.query.timeRange as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const where: any = { restaurantId: restaurantProfile.id };
    
    // Status filter
    if (status) {
      where.status = status;
    }

    // Order type filter (delivery/pickup)
    if (orderType) {
      where.orderType = orderType;
    }

    // Payment status filter
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    // Time range filter
    if (timeRange) {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'last7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // All time
      }

      where.createdAt = {
        gte: startDate,
      };
    }

    const orders = await prisma.foodOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: { email: true },
            },
            vehicle: true,
          },
        },
      },
    });

    const total = await prisma.foodOrder.count({ where });

    // Parse items JSON for each order
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
    }));

    res.json({
      orders: ordersWithParsedItems,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get restaurant orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/restaurant/orders/:id
// Get specific order details
router.get("/orders/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const order = await prisma.foodOrder.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
      include: {
        customer: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: { email: true },
            },
            vehicle: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      order: {
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      },
    });
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
});

// POST /api/restaurant/orders/:id/status
// Update order status with audit logging (requires KYC completion)
router.post("/orders/:id/status", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status } = req.body;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get current order
    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate status transitions (business rules)
    const validTransitions: Record<string, string[]> = {
      placed: ["accepted", "cancelled_restaurant"],
      accepted: ["preparing", "cancelled_restaurant"],
      preparing: ["ready_for_pickup", "cancelled_restaurant"],
      ready_for_pickup: ["picked_up"],
      picked_up: ["on_the_way"],
      on_the_way: ["delivered"],
    };

    const currentValidStatuses = validTransitions[order.status] || [];
    if (!currentValidStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${order.status} to ${status}`,
        validStatuses: currentValidStatuses,
      });
    }

    // Update order with transaction and audit log
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status with timestamps
      const updateData: any = { status };
      
      if (status === "accepted") updateData.acceptedAt = new Date();
      else if (status === "preparing") updateData.preparingAt = new Date();
      else if (status === "ready_for_pickup") updateData.readyAt = new Date();
      else if (status === "picked_up") updateData.pickedUpAt = new Date();
      else if (status === "delivered") {
        updateData.deliveredAt = new Date();
        updateData.completedAt = new Date();
      } else if (status.startsWith("cancelled")) {
        updateData.cancelledAt = new Date();
        updateData.whoCancelled = "restaurant";
      }

      const updated = await tx.foodOrder.update({
        where: { id },
        data: updateData,
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorEmail: restaurantProfile.user.email,
          actorRole: "restaurant",
          actionType: "order_status_update",
          entityType: "food_order",
          entityId: id,
          description: `Order status changed from ${order.status} to ${status}`,
          metadata: {
            restaurantId: restaurantProfile.id,
            previousStatus: order.status,
            newStatus: status,
            orderId: id,
          },
          success: true,
        },
      });

      return updated;
    });

    // Send notifications to all parties (restaurant, customer, driver)
    await notifyFoodOrderStatusChange({
      orderId: id,
      orderCode: order.orderCode || undefined,
      restaurantId: restaurantProfile.id,
      customerId: order.customerId,
      driverId: order.driverId || undefined,
      oldStatus: order.status,
      newStatus: status,
      updatedBy: userId,
      countryCode: restaurantProfile.countryCode || undefined,
    });

    res.json({
      message: "Order status updated successfully",
      order: {
        ...updatedOrder,
        items: typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : updatedOrder.items,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/restaurant/orders/:id/issue
// Report an issue with an order (requires KYC completion)
router.post("/orders/:id/issue", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { issueType, description } = req.body;

    const schema = z.object({
      issueType: z.enum(["quality", "delivery", "payment", "customer", "other"]),
      description: z.string().min(10).max(500),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify order ownership
    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Create audit log for issue report
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: restaurantProfile.user.email,
        actorRole: "restaurant",
        actionType: "order_issue_reported",
        entityType: "food_order",
        entityId: id,
        description: `Restaurant reported ${issueType} issue: ${description.substring(0, 100)}`,
        metadata: {
          restaurantId: restaurantProfile.id,
          orderId: id,
          issueType,
          description,
        },
        success: true,
      },
    });

    // Create admin notification for escalated issue
    await notifyRestaurantIssueEscalated({
      restaurantId: restaurantProfile.id,
      orderId: id,
      orderCode: order.orderCode || undefined,
      issueType,
      issueDescription: description,
      reportedBy: userId,
      countryCode: restaurantProfile.countryCode || undefined,
    });

    res.json({
      message: "Issue reported successfully. Our team will review and contact you soon.",
      issueId: id,
    });
  } catch (error) {
    console.error("Report order issue error:", error);
    res.status(500).json({ error: "Failed to report issue" });
  }
});

// GET /api/restaurant/wallet
// Get restaurant wallet information (requires KYC completion)
router.get("/wallet", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "RESTAURANT",
        },
      },
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await prisma.wallet.create({
        data: {
          ownerId: restaurantProfile.id,
          ownerType: "RESTAURANT",
          countryCode: restaurantProfile.countryCode || "US",
          availableBalance: 0,
          negativeBalance: 0,
          currency: restaurantProfile.countryCode === "BD" ? "BDT" : "USD",
          isDemo: restaurantProfile.isDemo,
        },
      });
    }

    // Format wallet data to match frontend expectations
    const formattedWallet = {
      availableBalance: wallet.availableBalance.toString(),
      negativeBalance: wallet.negativeBalance.toString(),
      currency: wallet.currency,
    };

    res.json({ wallet: formattedWallet });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet information" });
  }
});

// GET /api/restaurant/kyc-status
// Get KYC verification status
router.get("/kyc-status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const kycValidation = validateRestaurantKYC(restaurantProfile);

    res.json({
      isComplete: kycValidation.isComplete,
      missingFields: kycValidation.missingFields,
      countryCode: kycValidation.countryCode,
      verificationStatus: restaurantProfile.verificationStatus,
      isVerified: restaurantProfile.isVerified,
    });
  } catch (error) {
    console.error("Get KYC status error:", error);
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

// ====================================================
// MENU MANAGEMENT API (Phase 3)
// ====================================================

// GET /api/restaurant/menu/categories
// List all menu categories for the restaurant
router.get("/menu/categories", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurantProfile.id },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/restaurant/menu/categories
// Create a new menu category (OWNER only)
router.post("/menu/categories", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
    }).strict(); // Prevent unknown properties

    const { name, description, isActive } = schema.parse(req.body);

    // Get max display order for the restaurant
    const maxDisplayOrder = await prisma.menuCategory.aggregate({
      where: { restaurantId: restaurantProfile.id },
      _max: { displayOrder: true },
    });

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurantProfile.id,
        name,
        description: description || null,
        isActive: isActive ?? true,
        displayOrder: (maxDisplayOrder._max.displayOrder ?? 0) + 1,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_category",
      entityId: category.id,
      restaurantId: restaurantProfile.id,
      description: `Created menu category: ${name}`,
      metadata: { name, isActive },
    });

    res.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /api/restaurant/menu/categories/:id
// Update a menu category (OWNER only)
router.patch("/menu/categories/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify category belongs to restaurant
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    const updatedCategory = await prisma.menuCategory.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_category",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated menu category: ${updatedCategory.name}`,
      metadata: updates,
    });

    res.json({ category: updatedCategory });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/restaurant/menu/categories/:id
// Delete a menu category (OWNER only, only if no items)
router.delete("/menu/categories/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify category belongs to restaurant
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Prevent deletion if category has items
    if (category._count.menuItems > 0) {
      return res.status(400).json({
        error: "Cannot delete category with items",
        itemCount: category._count.menuItems,
      });
    }

    await prisma.menuCategory.delete({
      where: { id },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_category",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted menu category: ${category.name}`,
      metadata: { name: category.name },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// PATCH /api/restaurant/menu/categories/reorder
// Reorder menu categories (OWNER only)
router.patch("/menu/categories/reorder", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      categoryIds: z.array(z.string()).min(1), // At least one category required
    }).strict(); // Prevent unknown properties

    const { categoryIds } = schema.parse(req.body);

    // Verify all categories belong to restaurant
    const categories = await prisma.menuCategory.findMany({
      where: {
        id: { in: categoryIds },
        restaurantId: restaurantProfile.id,
      },
    });

    if (categories.length !== categoryIds.length) {
      return res.status(400).json({ error: "Invalid category IDs" });
    }

    // Update display order for each category
    await prisma.$transaction(
      categoryIds.map((id, index) =>
        prisma.menuCategory.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_category",
      entityId: restaurantProfile.id,
      restaurantId: restaurantProfile.id,
      description: `Reordered ${categoryIds.length} menu categories`,
      metadata: { categoryIds },
    });

    res.json({ message: "Categories reordered successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Reorder categories error:", error);
    res.status(500).json({ error: "Failed to reorder categories" });
  }
});

// GET /api/restaurant/menu/items
// List all menu items with pagination and filters
router.get("/menu/items", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const categoryId = req.query.categoryId as string;
    const search = req.query.search as string;
    const availability = req.query.availability as string;

    const where: any = {
      restaurantId: restaurantProfile.id,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
      ];
    }

    if (availability) {
      where.availabilityStatus = availability;
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          category: {
            select: { id: true, name: true },
          },
          optionGroups: {
            include: {
              options: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.menuItem.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get items error:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /api/restaurant/menu/items/:id
// Get single menu item with full details
router.get("/menu/items/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
      include: {
        category: true,
        optionGroups: {
          include: {
            options: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({ item });
  } catch (error) {
    console.error("Get item error:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// POST /api/restaurant/menu/items
// Create a new menu item (OWNER only)
router.post("/menu/items", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      categoryId: z.string(),
      name: z.string().min(1).max(200),
      shortDescription: z.string().max(500).optional(),
      longDescription: z.string().optional(),
      basePrice: z.coerce.number().min(0), // Coerce string to number for Decimal fields
      currency: z.string().default("USD"),
      preparationTimeMinutes: z.number().int().min(0).optional(),
      availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]).default("available"),
      isFeatured: z.boolean().default(false),
      isVegetarian: z.boolean().default(false),
      isVegan: z.boolean().default(false),
      isHalal: z.boolean().default(false),
      isSpicy: z.boolean().default(false),
      dietaryTags: z.array(z.string()).default([]),
      itemImageUrl: z.string().url().optional(),
    }).strict(); // Prevent unknown properties

    const data = schema.parse(req.body);

    // Verify category belongs to restaurant
    const category = await prisma.menuCategory.findFirst({
      where: {
        id: data.categoryId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId: restaurantProfile.id,
        categoryId: data.categoryId,
        name: data.name,
        shortDescription: data.shortDescription || null,
        longDescription: data.longDescription || null,
        basePrice: data.basePrice,
        currency: data.currency,
        preparationTimeMinutes: data.preparationTimeMinutes || null,
        availabilityStatus: data.availabilityStatus,
        isFeatured: data.isFeatured,
        isVegetarian: data.isVegetarian,
        isVegan: data.isVegan,
        isHalal: data.isHalal,
        isSpicy: data.isSpicy,
        dietaryTags: data.dietaryTags || [],
        itemImageUrl: data.itemImageUrl || null,
      },
      include: {
        category: true,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_item",
      entityId: item.id,
      restaurantId: restaurantProfile.id,
      description: `Created menu item: ${item.name}`,
      metadata: { name: item.name, categoryId: item.categoryId, basePrice: item.basePrice.toString() },
    });

    res.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create item error:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
});

// PATCH /api/restaurant/menu/items/:id
// Update a menu item (OWNER only)
router.patch("/menu/items/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const schema = z.object({
      categoryId: z.string().optional(),
      name: z.string().min(1).max(200).optional(),
      shortDescription: z.string().max(500).optional(),
      longDescription: z.string().optional(),
      basePrice: z.coerce.number().min(0).optional(), // Coerce string to number for Decimal fields
      currency: z.string().optional(),
      preparationTimeMinutes: z.number().int().min(0).optional(),
      availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]).optional(),
      isFeatured: z.boolean().optional(),
      isVegetarian: z.boolean().optional(),
      isVegan: z.boolean().optional(),
      isHalal: z.boolean().optional(),
      isSpicy: z.boolean().optional(),
      dietaryTags: z.array(z.string()).optional(),
      itemImageUrl: z.string().url().optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    // If category is being changed, verify it belongs to restaurant
    if (updates.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: updates.categoryId,
          restaurantId: restaurantProfile.id,
        },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: updates,
      include: {
        category: true,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated menu item: ${updatedItem.name}`,
      metadata: updates,
    });

    res.json({ item: updatedItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update item error:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// PATCH /api/restaurant/menu/items/:id/availability
// Toggle item availability (STAFF and OWNER allowed - no OWNER check needed)
router.patch("/menu/items/:id/availability", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const schema = z.object({
      availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]),
    }).strict(); // Prevent unknown properties

    const { availabilityStatus } = schema.parse(req.body);

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: { availabilityStatus },
      include: {
        category: true,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated item availability: ${updatedItem.name} to ${availabilityStatus}`,
      metadata: { availabilityStatus, itemName: updatedItem.name },
    });

    res.json({ item: updatedItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update item availability error:", error);
    res.status(500).json({ error: "Failed to update item availability" });
  }
});

// DELETE /api/restaurant/menu/items/:id
// Delete a menu item (OWNER only)
router.delete("/menu/items/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Delete associated option groups and options (cascade)
    await prisma.$transaction([
      prisma.menuOption.deleteMany({
        where: {
          optionGroup: {
            menuItemId: id,
          },
        },
      }),
      prisma.menuOptionGroup.deleteMany({
        where: { menuItemId: id },
      }),
      prisma.menuItem.delete({
        where: { id },
      }),
    ]);

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted menu item: ${item.name}`,
      metadata: { name: item.name, categoryId: item.categoryId },
    });

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// PATCH /api/restaurant/menu/items/bulk
// Bulk update menu items (OWNER only - toggle availability, update prices, etc.)
router.patch("/menu/items/bulk", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      itemIds: z.array(z.string()).min(1), // At least one item required
      updates: z.object({
        availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]).optional(),
        isFeatured: z.boolean().optional(),
        basePrice: z.coerce.number().min(0).optional(), // Coerce string to number for Decimal fields
      }).refine(data => Object.keys(data).length > 0, {
        message: "At least one field must be provided for update",
      }),
    }).strict(); // Prevent unknown properties

    const { itemIds, updates } = schema.parse(req.body);

    // Verify all items belong to restaurant
    const items = await prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        restaurantId: restaurantProfile.id,
      },
    });

    if (items.length !== itemIds.length) {
      return res.status(400).json({ error: "Invalid item IDs" });
    }

    // Perform bulk update
    const result = await prisma.menuItem.updateMany({
      where: {
        id: { in: itemIds },
        restaurantId: restaurantProfile.id,
      },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: restaurantProfile.id,
      restaurantId: restaurantProfile.id,
      description: `Bulk updated ${itemIds.length} menu items`,
      metadata: { itemIds, updates },
    });

    res.json({ message: "Items updated successfully", count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Bulk update items error:", error);
    res.status(500).json({ error: "Failed to update items" });
  }
});

// GET /api/restaurant/menu/option-groups
// List all option groups for a menu item
router.get("/menu/option-groups", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const itemId = req.query.itemId as string;

    if (!itemId) {
      return res.status(400).json({ error: "itemId is required" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify menu item belongs to restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const optionGroups = await prisma.menuOptionGroup.findMany({
      where: { itemId },
      orderBy: { createdAt: "asc" },
      include: {
        options: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    res.json({ optionGroups });
  } catch (error) {
    console.error("Get option groups error:", error);
    res.status(500).json({ error: "Failed to fetch option groups" });
  }
});

// POST /api/restaurant/menu/option-groups
// Create a new option group for a menu item (OWNER only)
router.post("/menu/option-groups", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      itemId: z.string(),
      name: z.string().min(1).max(100),
      type: z.string().default("single"),
      isRequired: z.boolean().default(false),
      minSelect: z.number().int().min(0).optional(),
      maxSelect: z.number().int().min(0).optional(),
    }).strict(); // Prevent unknown properties

    const data = schema.parse(req.body);

    // Verify menu item belongs to restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: data.itemId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const optionGroup = await prisma.menuOptionGroup.create({
      data: {
        restaurantId: restaurantProfile.id,
        itemId: data.itemId,
        name: data.name,
        type: data.type,
        isRequired: data.isRequired,
        minSelect: data.minSelect || null,
        maxSelect: data.maxSelect || null,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_option_group",
      entityId: optionGroup.id,
      restaurantId: restaurantProfile.id,
      description: `Created option group: ${optionGroup.name}`,
      metadata: { name: optionGroup.name, itemId: data.itemId },
    });

    res.json({ optionGroup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create option group error:", error);
    res.status(500).json({ error: "Failed to create option group" });
  }
});

// PATCH /api/restaurant/menu/option-groups/:id
// Update an option group (OWNER only)
router.patch("/menu/option-groups/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option group belongs to restaurant's menu item
    const optionGroup = await prisma.menuOptionGroup.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!optionGroup) {
      return res.status(404).json({ error: "Option group not found" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      type: z.string().optional(),
      isRequired: z.boolean().optional(),
      minSelect: z.number().int().min(0).optional(),
      maxSelect: z.number().int().min(0).optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    const updatedOptionGroup = await prisma.menuOptionGroup.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_option_group",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated option group: ${updatedOptionGroup.name}`,
      metadata: updates,
    });

    res.json({ optionGroup: updatedOptionGroup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update option group error:", error);
    res.status(500).json({ error: "Failed to update option group" });
  }
});

// DELETE /api/restaurant/menu/option-groups/:id
// Delete an option group (OWNER only, cascade deletes options)
router.delete("/menu/option-groups/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option group belongs to restaurant's menu item
    const optionGroup = await prisma.menuOptionGroup.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!optionGroup) {
      return res.status(404).json({ error: "Option group not found" });
    }

    // Delete option group (options are cascade deleted)
    await prisma.$transaction([
      prisma.menuOption.deleteMany({
        where: { optionGroupId: id },
      }),
      prisma.menuOptionGroup.delete({
        where: { id },
      }),
    ]);

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_option_group",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted option group: ${optionGroup.name}`,
      metadata: { name: optionGroup.name },
    });

    res.json({ message: "Option group deleted successfully" });
  } catch (error) {
    console.error("Delete option group error:", error);
    res.status(500).json({ error: "Failed to delete option group" });
  }
});

// POST /api/restaurant/menu/options
// Create a new option for an option group (OWNER only)
router.post("/menu/options", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      optionGroupId: z.string(),
      label: z.string().min(1).max(100),
      priceDelta: z.coerce.number().default(0), // Coerce string to number for Decimal fields
      isActive: z.boolean().default(true),
      isDefault: z.boolean().default(false),
    }).strict(); // Prevent unknown properties

    const data = schema.parse(req.body);

    // Verify option group belongs to restaurant's menu item
    const optionGroup = await prisma.menuOptionGroup.findFirst({
      where: {
        id: data.optionGroupId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!optionGroup) {
      return res.status(404).json({ error: "Option group not found" });
    }

    const option = await prisma.menuOption.create({
      data: {
        optionGroupId: data.optionGroupId,
        label: data.label,
        priceDelta: data.priceDelta,
        isActive: data.isActive,
        isDefault: data.isDefault,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_option",
      entityId: option.id,
      restaurantId: restaurantProfile.id,
      description: `Created menu option: ${option.label}`,
      metadata: { label: option.label, optionGroupId: data.optionGroupId, priceDelta: option.priceDelta.toString() },
    });

    res.json({ option });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create option error:", error);
    res.status(500).json({ error: "Failed to create option" });
  }
});

// PATCH /api/restaurant/menu/options/:id
// Update a menu option (OWNER only)
router.patch("/menu/options/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option belongs to restaurant's menu item
    const option = await prisma.menuOption.findFirst({
      where: {
        id,
        optionGroup: {
          restaurantId: restaurantProfile.id,
        },
      },
    });

    if (!option) {
      return res.status(404).json({ error: "Option not found" });
    }

    const schema = z.object({
      label: z.string().min(1).max(100).optional(),
      priceDelta: z.coerce.number().optional(), // Coerce string to number for Decimal fields
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    const updatedOption = await prisma.menuOption.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_option",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated menu option: ${updatedOption.label}`,
      metadata: updates,
    });

    res.json({ option: updatedOption });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update option error:", error);
    res.status(500).json({ error: "Failed to update option" });
  }
});

// DELETE /api/restaurant/menu/options/:id
// Delete a menu option (OWNER only)
router.delete("/menu/options/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option belongs to restaurant's menu item
    const option = await prisma.menuOption.findFirst({
      where: {
        id,
        optionGroup: {
          restaurantId: restaurantProfile.id,
        },
      },
    });

    if (!option) {
      return res.status(404).json({ error: "Option not found" });
    }

    await prisma.menuOption.delete({
      where: { id },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_option",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted menu option: ${option.label}`,
      metadata: { label: option.label },
    });

    res.json({ message: "Option deleted successfully" });
  } catch (error) {
    console.error("Delete option error:", error);
    res.status(500).json({ error: "Failed to delete option" });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS - Phase 4
// ============================================================================

import {
  getOverviewAnalytics,
  getItemAnalytics,
  getCustomerAnalytics,
  getDriverAnalytics,
} from "../analytics/restaurantAnalytics";

// Date range filter schema
const dateRangeSchema = z.object({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
});

// GET /api/restaurant/analytics/overview - Overview metrics
router.get("/analytics/overview", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const metrics = await getOverviewAnalytics(restaurantProfile.id, filters);
    res.json(metrics);
  } catch (error) {
    console.error("Overview analytics error:", error);
    res.status(500).json({ error: "Failed to fetch overview analytics" });
  }
});

// GET /api/restaurant/analytics/items - Item performance analytics
router.get("/analytics/items", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const analytics = await getItemAnalytics(restaurantProfile.id, filters);
    res.json(analytics);
  } catch (error) {
    console.error("Item analytics error:", error);
    res.status(500).json({ error: "Failed to fetch item analytics" });
  }
});

// GET /api/restaurant/analytics/customers - Customer analytics
router.get("/analytics/customers", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const analytics = await getCustomerAnalytics(restaurantProfile.id, filters);
    res.json(analytics);
  } catch (error) {
    console.error("Customer analytics error:", error);
    res.status(500).json({ error: "Failed to fetch customer analytics" });
  }
});

// GET /api/restaurant/analytics/drivers - Driver performance analytics
router.get("/analytics/drivers", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const analytics = await getDriverAnalytics(restaurantProfile.id, filters);
    res.json(analytics);
  } catch (error) {
    console.error("Driver analytics error:", error);
    res.status(500).json({ error: "Failed to fetch driver analytics" });
  }
});

// ====================================================
// STAFF MANAGEMENT SYSTEM (Phase 6)
// ====================================================

// GET /api/restaurant/staff
// Get all staff members for the current OWNER
router.get("/staff", requireOwnerRole, requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getStaffForOwner } = await import("../staff/staffUtils");
    const staff = await getStaffForOwner(restaurantProfile.id);

    res.json({ staff });
  } catch (error: any) {
    console.error("Get staff error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch staff" });
  }
});

// POST /api/restaurant/staff
// Create a new staff member (OWNER only)
router.post("/staff", requireOwnerRole, requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, temporaryPassword, permissions } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !temporaryPassword) {
      return res.status(400).json({
        error: "Name, email, phone, and temporary password are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, isVerified: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "Restaurant must be verified before adding staff",
      });
    }

    const { createStaffMember } = await import("../staff/staffUtils");
    const result = await createStaffMember(restaurantProfile.id, {
      name,
      email,
      phone,
      temporaryPassword,
      permissions,
    });

    res.status(201).json({
      message: "Staff member created successfully",
      staff: result.restaurantProfile,
    });
  } catch (error: any) {
    console.error("Create staff error:", error);
    res.status(500).json({ error: error.message || "Failed to create staff member" });
  }
});

// GET /api/restaurant/staff/:id
// Get details of a specific staff member
router.get("/staff/:id", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: staffId } = req.params;

    const { canManageStaff } = await import("../staff/staffUtils");
    const canManage = await canManageStaff(userId, staffId);

    if (!canManage) {
      return res.status(403).json({
        error: "You do not have permission to view this staff member",
      });
    }

    const staff = await prisma.restaurantProfile.findUnique({
      where: { id: staffId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    res.json({ staff });
  } catch (error: any) {
    console.error("Get staff details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch staff details" });
  }
});

// PATCH /api/restaurant/staff/:id
// Update staff member permissions (OWNER only)
router.patch("/staff/:id", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: staffId } = req.params;
    const { permissions } = req.body;

    const { canManageStaff } = await import("../staff/staffUtils");
    const canManage = await canManageStaff(userId, staffId);

    if (!canManage) {
      return res.status(403).json({
        error: "You do not have permission to manage this staff member",
      });
    }

    // Build update data from permissions object
    const updateData: any = {};
    if (permissions) {
      if (permissions.canEditCategories !== undefined)
        updateData.canEditCategories = permissions.canEditCategories;
      if (permissions.canEditItems !== undefined)
        updateData.canEditItems = permissions.canEditItems;
      if (permissions.canToggleAvailability !== undefined)
        updateData.canToggleAvailability = permissions.canToggleAvailability;
      if (permissions.canUseBulkTools !== undefined)
        updateData.canUseBulkTools = permissions.canUseBulkTools;
      if (permissions.canViewAnalytics !== undefined)
        updateData.canViewAnalytics = permissions.canViewAnalytics;
      if (permissions.canViewPayouts !== undefined)
        updateData.canViewPayouts = permissions.canViewPayouts;
      if (permissions.canManageOrders !== undefined)
        updateData.canManageOrders = permissions.canManageOrders;
    }

    const updatedStaff = await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: updateData,
    });

    res.json({
      message: "Staff permissions updated successfully",
      staff: updatedStaff,
    });
  } catch (error: any) {
    console.error("Update staff error:", error);
    res.status(500).json({ error: error.message || "Failed to update staff member" });
  }
});

// POST /api/restaurant/staff/:id/block
// Block or unblock a staff member (OWNER only)
router.post("/staff/:id/block", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: staffId } = req.params;
    const { block, reason } = req.body;

    const { canManageStaff } = await import("../staff/staffUtils");
    const canManage = await canManageStaff(userId, staffId);

    if (!canManage) {
      return res.status(403).json({
        error: "You do not have permission to manage this staff member",
      });
    }

    const updatedStaff = await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: {
        staffActive: !block,
      },
    });

    // Create notification for staff member
    await prisma.notification.create({
      data: {
        userId: updatedStaff.userId,
        type: "alert",
        title: block ? "Account Suspended" : "Account Activated",
        body: block
          ? `Your staff account has been suspended. ${reason ? `Reason: ${reason}` : ""}`
          : "Your staff account has been activated. You can now log in.",
      },
    });

    res.json({
      message: `Staff member ${block ? "blocked" : "unblocked"} successfully`,
      staff: updatedStaff,
    });
  } catch (error: any) {
    console.error("Block staff error:", error);
    res.status(500).json({ error: error.message || "Failed to block/unblock staff member" });
  }
});

// GET /api/restaurant/staff/activity-log
// Get activity log for all staff members (OWNER only)
router.get("/staff/activity-log", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const staffId = req.query.staffId as string | undefined;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get all staff IDs for this restaurant
    const { getStaffForOwner } = await import("../staff/staffUtils");
    const staff = await getStaffForOwner(restaurantProfile.id);
    const staffUserIds = staff.map((s) => s.user.id);

    // Build where clause for audit logs
    const where: any = {
      actorId: { in: staffUserIds },
    };

    // Filter by specific staff if provided
    if (staffId) {
      const staffMember = staff.find((s) => s.id === staffId);
      if (staffMember) {
        where.actorId = staffMember.user.id;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error("Get activity log error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch activity log" });
  }
});

export default router;
