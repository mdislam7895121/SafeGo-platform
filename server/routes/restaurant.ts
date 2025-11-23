import { Router } from "express";
import { Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { validateRestaurantKYC } from "../utils/kyc-validator";
import { notifyFoodOrderStatusChange, notifyRestaurantIssueEscalated } from "../utils/notifications";
import { prisma } from "../db";

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
          where: { isActive: true },
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

// POST /api/restaurant/menu/categories
// Create new menu category
router.post("/menu/categories", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, description, displayOrder } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurantProfile.id,
        name,
        description: description || null,
        displayOrder: displayOrder || 0,
        isActive: true,
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /api/restaurant/menu/categories/:id
// Update menu category
router.patch("/menu/categories/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name, description, displayOrder, isActive } = req.body;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify ownership
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCategory = await prisma.menuCategory.update({
      where: { id },
      data: updateData,
    });

    res.json({ category: updatedCategory });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/restaurant/menu/categories/:id
// Delete menu category
router.delete("/menu/categories/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify ownership
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if category has menu items
    const itemCount = await prisma.menuItem.count({
      where: { categoryId: id },
    });

    if (itemCount > 0) {
      return res.status(400).json({
        error: "Cannot delete category with menu items. Delete items first or move them to another category.",
      });
    }

    await prisma.menuCategory.delete({ where: { id } });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// GET /api/restaurant/menu/items
// Get all menu items for restaurant
router.get("/menu/items", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const items = await prisma.menuItem.findMany({
      where: { restaurantId: restaurantProfile.id },
      include: { category: true },
      orderBy: [{ categoryId: "asc" }, { displayOrder: "asc" }],
    });

    res.json({ items });
  } catch (error) {
    console.error("Get menu items error:", error);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

// POST /api/restaurant/menu/items
// Create new menu item
router.post("/menu/items", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { categoryId, name, description, price, imageUrl, displayOrder, isAvailable } = req.body;

    const schema = z.object({
      categoryId: z.string().uuid(),
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      price: z.number().positive(),
      imageUrl: z.string().url().optional(),
      displayOrder: z.number().int().optional(),
      isAvailable: z.boolean().optional(),
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
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify category ownership
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId: restaurantProfile.id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found or access denied" });
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId: restaurantProfile.id,
        categoryId,
        name,
        description: description || null,
        price,
        imageUrl: imageUrl || null,
        displayOrder: displayOrder || 0,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        isActive: true,
      },
    });

    res.status(201).json({ item });
  } catch (error) {
    console.error("Create menu item error:", error);
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

// PATCH /api/restaurant/menu/items/:id
// Update menu item
router.patch("/menu/items/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name, description, price, imageUrl, displayOrder, isAvailable, isActive, categoryId } = req.body;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify ownership
    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (categoryId) {
      // Verify new category ownership
      const category = await prisma.menuCategory.findFirst({
        where: { id: categoryId, restaurantId: restaurantProfile.id },
      });
      if (!category) {
        return res.status(404).json({ error: "Category not found or access denied" });
      }
      updateData.categoryId = categoryId;
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: updateData,
    });

    res.json({ item: updatedItem });
  } catch (error) {
    console.error("Update menu item error:", error);
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

// DELETE /api/restaurant/menu/items/:id
// Delete menu item
router.delete("/menu/items/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify ownership
    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    await prisma.menuItem.delete({ where: { id } });

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({ error: "Failed to delete menu item" });
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

export default router;
