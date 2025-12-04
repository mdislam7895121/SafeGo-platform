import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { PartnerStatus } from "@prisma/client";

const router = Router();

router.get("/shop-partners", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { verificationStatus, search, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }
    if (search) {
      where.OR = [
        { shopName: { contains: search as string, mode: "insensitive" } },
        { ownerName: { contains: search as string, mode: "insensitive" } },
        { nidNumber: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [shopPartners, total] = await Promise.all([
      prisma.shopPartner.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { email: true, isBlocked: true } },
          _count: { select: { products: true, orders: true } },
        },
      }),
      prisma.shopPartner.count({ where }),
    ]);

    res.json({
      shopPartners,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Admin get shop partners error:", error);
    res.status(500).json({ error: "Failed to fetch shop partners" });
  }
});

router.get("/shop-partners/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, isBlocked: true, createdAt: true } },
        products: { take: 20, orderBy: { createdAt: "desc" } },
        orders: { take: 20, orderBy: { placedAt: "desc" } },
      },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    res.json({ shopPartner });
  } catch (error) {
    console.error("Admin get shop partner error:", error);
    res.status(500).json({ error: "Failed to fetch shop partner" });
  }
});

router.patch("/shop-partners/:id/verify", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { action, rejectionReason, commissionRate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    const validActions = ["approve", "reject", "suspend"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use: approve, reject, or suspend" });
    }

    const updateData: any = {
      updatedAt: new Date(),
      verifiedBy: userId,
    };

    if (action === "approve") {
      updateData.verificationStatus = "approved";
      updateData.isActive = true;
      updateData.verifiedAt = new Date();
      if (commissionRate !== undefined) {
        updateData.commissionRate = commissionRate;
      }
    } else if (action === "reject") {
      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      updateData.verificationStatus = "rejected";
      updateData.rejectionReason = rejectionReason;
      updateData.isActive = false;
    } else if (action === "suspend") {
      updateData.verificationStatus = "suspended";
      updateData.isActive = false;
      if (rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: `Shop partner ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended"} successfully`,
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        verificationStatus: updated.verificationStatus,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error("Admin verify shop partner error:", error);
    res.status(500).json({ error: "Failed to update shop partner" });
  }
});

router.patch("/shop-partners/:id/commission", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { commissionRate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ error: "Commission rate must be between 0 and 100" });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: { commissionRate, updatedAt: new Date() },
    });

    res.json({
      message: "Commission rate updated successfully",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        commissionRate: updated.commissionRate,
      },
    });
  } catch (error) {
    console.error("Admin update commission error:", error);
    res.status(500).json({ error: "Failed to update commission rate" });
  }
});

router.get("/ticket-operators", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { verificationStatus, operatorType, search, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }
    if (operatorType) {
      where.operatorType = operatorType;
    }
    if (search) {
      where.OR = [
        { operatorName: { contains: search as string, mode: "insensitive" } },
        { ownerName: { contains: search as string, mode: "insensitive" } },
        { nidNumber: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [operators, total] = await Promise.all([
      prisma.ticketOperator.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { email: true, isBlocked: true } },
          _count: {
            select: {
              ticketListings: true,
              ticketBookings: true,
              rentalVehicles: true,
              rentalBookings: true,
            },
          },
        },
      }),
      prisma.ticketOperator.count({ where }),
    ]);

    res.json({
      operators,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Admin get ticket operators error:", error);
    res.status(500).json({ error: "Failed to fetch ticket operators" });
  }
});

router.get("/ticket-operators/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, isBlocked: true, createdAt: true } },
        ticketListings: { take: 20, orderBy: { createdAt: "desc" } },
        ticketBookings: { take: 20, orderBy: { bookedAt: "desc" } },
        rentalVehicles: { take: 20, orderBy: { createdAt: "desc" } },
        rentalBookings: { take: 20, orderBy: { requestedAt: "desc" } },
      },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    res.json({ operator });
  } catch (error) {
    console.error("Admin get ticket operator error:", error);
    res.status(500).json({ error: "Failed to fetch ticket operator" });
  }
});

router.patch("/ticket-operators/:id/verify", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { action, rejectionReason, ticketCommissionRate, rentalCommissionRate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { id },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    const validActions = ["approve", "reject", "suspend"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use: approve, reject, or suspend" });
    }

    const updateData: any = {
      updatedAt: new Date(),
      verifiedBy: userId,
    };

    if (action === "approve") {
      updateData.verificationStatus = "approved";
      updateData.isActive = true;
      updateData.verifiedAt = new Date();
      if (ticketCommissionRate !== undefined) {
        updateData.ticketCommissionRate = ticketCommissionRate;
      }
      if (rentalCommissionRate !== undefined) {
        updateData.rentalCommissionRate = rentalCommissionRate;
      }
    } else if (action === "reject") {
      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      updateData.verificationStatus = "rejected";
      updateData.rejectionReason = rejectionReason;
      updateData.isActive = false;
    } else if (action === "suspend") {
      updateData.verificationStatus = "suspended";
      updateData.isActive = false;
      if (rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: `Ticket operator ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended"} successfully`,
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
        verificationStatus: updated.verificationStatus,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error("Admin verify ticket operator error:", error);
    res.status(500).json({ error: "Failed to update ticket operator" });
  }
});

router.patch("/ticket-operators/:id/commission", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { ticketCommissionRate, rentalCommissionRate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const updateData: any = { updatedAt: new Date() };

    if (ticketCommissionRate !== undefined) {
      if (ticketCommissionRate < 0 || ticketCommissionRate > 100) {
        return res.status(400).json({ error: "Ticket commission rate must be between 0 and 100" });
      }
      updateData.ticketCommissionRate = ticketCommissionRate;
    }

    if (rentalCommissionRate !== undefined) {
      if (rentalCommissionRate < 0 || rentalCommissionRate > 100) {
        return res.status(400).json({ error: "Rental commission rate must be between 0 and 100" });
      }
      updateData.rentalCommissionRate = rentalCommissionRate;
    }

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({ error: "At least one commission rate must be provided" });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: "Commission rates updated successfully",
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
        ticketCommissionRate: updated.ticketCommissionRate,
        rentalCommissionRate: updated.rentalCommissionRate,
      },
    });
  } catch (error) {
    console.error("Admin update commission error:", error);
    res.status(500).json({ error: "Failed to update commission rates" });
  }
});

router.get("/bd-expansion/stats", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const [
      shopPartnerStats,
      ticketOperatorStats,
      productOrderStats,
      ticketBookingStats,
      rentalBookingStats,
    ] = await Promise.all([
      prisma.shopPartner.groupBy({
        by: ["verificationStatus"],
        _count: true,
      }),
      prisma.ticketOperator.groupBy({
        by: ["verificationStatus"],
        _count: true,
      }),
      prisma.productOrder.groupBy({
        by: ["status"],
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.ticketBooking.groupBy({
        by: ["status"],
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.rentalBooking.groupBy({
        by: ["status"],
        _count: true,
        _sum: { totalAmount: true },
      }),
    ]);

    const totalShopPartners = shopPartnerStats.reduce((acc, s) => acc + s._count, 0);
    const pendingShopPartners = shopPartnerStats.find(s => s.verificationStatus === "pending")?._count || 0;
    const approvedShopPartners = shopPartnerStats.find(s => s.verificationStatus === "approved")?._count || 0;

    const totalTicketOperators = ticketOperatorStats.reduce((acc, s) => acc + s._count, 0);
    const pendingTicketOperators = ticketOperatorStats.find(s => s.verificationStatus === "pending")?._count || 0;
    const approvedTicketOperators = ticketOperatorStats.find(s => s.verificationStatus === "approved")?._count || 0;

    res.json({
      stats: {
        shopPartners: {
          total: totalShopPartners,
          pending: pendingShopPartners,
          approved: approvedShopPartners,
          breakdown: shopPartnerStats,
        },
        ticketOperators: {
          total: totalTicketOperators,
          pending: pendingTicketOperators,
          approved: approvedTicketOperators,
          breakdown: ticketOperatorStats,
        },
        productOrders: productOrderStats,
        ticketBookings: ticketBookingStats,
        rentalBookings: rentalBookingStats,
      },
    });
  } catch (error) {
    console.error("Admin BD expansion stats error:", error);
    res.status(500).json({ error: "Failed to fetch BD expansion stats" });
  }
});

router.get("/negative-balances", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const [shopPartnersWithNegative, ticketOperatorsWithNegative] = await Promise.all([
      prisma.shopPartner.findMany({
        where: { negativeBalance: { gt: 0 } },
        orderBy: { negativeBalance: "desc" },
        include: {
          user: { select: { email: true } },
        },
      }),
      prisma.ticketOperator.findMany({
        where: { negativeBalance: { gt: 0 } },
        orderBy: { negativeBalance: "desc" },
        include: {
          user: { select: { email: true } },
        },
      }),
    ]);

    const totalShopPartnerNegative = shopPartnersWithNegative.reduce(
      (acc, s) => acc + Number(s.negativeBalance),
      0
    );
    const totalTicketOperatorNegative = ticketOperatorsWithNegative.reduce(
      (acc, t) => acc + Number(t.negativeBalance),
      0
    );

    res.json({
      negativeBalances: {
        shopPartners: {
          total: totalShopPartnerNegative,
          count: shopPartnersWithNegative.length,
          accounts: shopPartnersWithNegative.map((s) => ({
            id: s.id,
            shopName: s.shopName,
            email: s.user.email,
            negativeBalance: s.negativeBalance,
            walletBalance: s.walletBalance,
          })),
        },
        ticketOperators: {
          total: totalTicketOperatorNegative,
          count: ticketOperatorsWithNegative.length,
          accounts: ticketOperatorsWithNegative.map((t) => ({
            id: t.id,
            operatorName: t.operatorName,
            email: t.user.email,
            negativeBalance: t.negativeBalance,
            walletBalance: t.walletBalance,
          })),
        },
        grandTotal: totalShopPartnerNegative + totalTicketOperatorNegative,
      },
    });
  } catch (error) {
    console.error("Admin negative balances error:", error);
    res.status(500).json({ error: "Failed to fetch negative balances" });
  }
});

router.post("/settle-balance/:type/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, id } = req.params;
    const { amount, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (type !== "shop-partner" && type !== "ticket-operator") {
      return res.status(400).json({ error: "Invalid type. Use: shop-partner or ticket-operator" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Settlement amount must be positive" });
    }

    if (type === "shop-partner") {
      const shopPartner = await prisma.shopPartner.findUnique({
        where: { id },
      });

      if (!shopPartner) {
        return res.status(404).json({ error: "Shop partner not found" });
      }

      const newNegativeBalance = Math.max(0, Number(shopPartner.negativeBalance) - amount);

      await prisma.shopPartner.update({
        where: { id },
        data: {
          negativeBalance: newNegativeBalance,
          updatedAt: new Date(),
        },
      });

      res.json({
        message: "Balance settled successfully",
        previousBalance: shopPartner.negativeBalance,
        newBalance: newNegativeBalance,
        settledAmount: amount,
      });
    } else {
      const operator = await prisma.ticketOperator.findUnique({
        where: { id },
      });

      if (!operator) {
        return res.status(404).json({ error: "Ticket operator not found" });
      }

      const newNegativeBalance = Math.max(0, Number(operator.negativeBalance) - amount);

      await prisma.ticketOperator.update({
        where: { id },
        data: {
          negativeBalance: newNegativeBalance,
          updatedAt: new Date(),
        },
      });

      res.json({
        message: "Balance settled successfully",
        previousBalance: operator.negativeBalance,
        newBalance: newNegativeBalance,
        settledAmount: amount,
      });
    }
  } catch (error) {
    console.error("Admin settle balance error:", error);
    res.status(500).json({ error: "Failed to settle balance" });
  }
});

// ===================================================
// STAGED ONBOARDING ADMIN ENDPOINTS
// ===================================================
import { randomUUID } from "crypto";

// Get partners by partner status (for staged tabs)
router.get("/partners-by-stage", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { partnerStatus, partnerType, page = "1", limit = "20" } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    let shopPartners: any[] = [];
    let ticketOperators: any[] = [];
    let shopTotal = 0;
    let operatorTotal = 0;

    const statusFilter = partnerStatus ? { partnerStatus: partnerStatus as PartnerStatus } : {};

    if (!partnerType || partnerType === "shop") {
      [shopPartners, shopTotal] = await Promise.all([
        prisma.shopPartner.findMany({
          where: statusFilter,
          take: parseInt(limit as string),
          skip,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { email: true } },
            _count: { select: { products: true } },
          },
        }),
        prisma.shopPartner.count({ where: statusFilter }),
      ]);
    }

    if (!partnerType || partnerType === "operator") {
      [ticketOperators, operatorTotal] = await Promise.all([
        prisma.ticketOperator.findMany({
          where: statusFilter,
          take: parseInt(limit as string),
          skip,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { email: true } },
            _count: { select: { ticketListings: true, rentalVehicles: true } },
          },
        }),
        prisma.ticketOperator.count({ where: statusFilter }),
      ]);
    }

    // Get counts for each status
    const [
      shopDraftCount,
      shopKycPendingCount,
      shopSetupIncompleteCount,
      shopReadyForReviewCount,
      shopLiveCount,
      shopRejectedCount,
      operatorDraftCount,
      operatorKycPendingCount,
      operatorSetupIncompleteCount,
      operatorReadyForReviewCount,
      operatorLiveCount,
      operatorRejectedCount,
    ] = await Promise.all([
      prisma.shopPartner.count({ where: { partnerStatus: "draft" } }),
      prisma.shopPartner.count({ where: { partnerStatus: "kyc_pending" } }),
      prisma.shopPartner.count({ where: { partnerStatus: "setup_incomplete" } }),
      prisma.shopPartner.count({ where: { partnerStatus: "ready_for_review" } }),
      prisma.shopPartner.count({ where: { partnerStatus: "live" } }),
      prisma.shopPartner.count({ where: { partnerStatus: "rejected" } }),
      prisma.ticketOperator.count({ where: { partnerStatus: "draft" } }),
      prisma.ticketOperator.count({ where: { partnerStatus: "kyc_pending" } }),
      prisma.ticketOperator.count({ where: { partnerStatus: "setup_incomplete" } }),
      prisma.ticketOperator.count({ where: { partnerStatus: "ready_for_review" } }),
      prisma.ticketOperator.count({ where: { partnerStatus: "live" } }),
      prisma.ticketOperator.count({ where: { partnerStatus: "rejected" } }),
    ]);

    res.json({
      shopPartners,
      ticketOperators,
      statusCounts: {
        shop: {
          draft: shopDraftCount,
          kyc_pending: shopKycPendingCount,
          setup_incomplete: shopSetupIncompleteCount,
          ready_for_review: shopReadyForReviewCount,
          live: shopLiveCount,
          rejected: shopRejectedCount,
        },
        operator: {
          draft: operatorDraftCount,
          kyc_pending: operatorKycPendingCount,
          setup_incomplete: operatorSetupIncompleteCount,
          ready_for_review: operatorReadyForReviewCount,
          live: operatorLiveCount,
          rejected: operatorRejectedCount,
        },
      },
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        shopTotal,
        operatorTotal,
      },
    });
  } catch (error) {
    console.error("Admin get partners by stage error:", error);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

// Approve KYC (move from kyc_pending to setup_incomplete)
router.patch("/shop-partners/:id/approve-kyc", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    if (shopPartner.partnerStatus !== "kyc_pending") {
      return res.status(400).json({ 
        error: "Can only approve KYC for partners in kyc_pending status",
        currentStatus: shopPartner.partnerStatus,
      });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        partnerStatus: "setup_incomplete",
        kycApprovedAt: new Date(),
        verifiedBy: userId,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_KYC_APPROVED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin approved KYC for ${shopPartner.shopName}`,
        metadata: { shopName: shopPartner.shopName, previousStatus: "kyc_pending" },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC approved successfully. Partner can now complete setup.",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        partnerStatus: updated.partnerStatus,
      },
    });
  } catch (error) {
    console.error("Admin approve KYC error:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

// Final approval (move from ready_for_review to live)
router.patch("/shop-partners/:id/go-live", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { commissionRate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    if (shopPartner.partnerStatus !== "ready_for_review") {
      return res.status(400).json({ 
        error: "Can only go live for partners in ready_for_review status",
        currentStatus: shopPartner.partnerStatus,
      });
    }

    // Update partner and user role
    const updated = await prisma.$transaction([
      prisma.shopPartner.update({
        where: { id },
        data: {
          partnerStatus: "live",
          verificationStatus: "approved",
          isActive: true,
          verifiedAt: new Date(),
          verifiedBy: userId,
          commissionRate: commissionRate || 10,
          updatedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: shopPartner.userId },
        data: { role: "shop_partner" },
      }),
    ]);

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_WENT_LIVE",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin approved ${shopPartner.shopName} to go live`,
        metadata: { shopName: shopPartner.shopName, commissionRate: commissionRate || 10 },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Shop partner is now LIVE!",
      shopPartner: {
        id: updated[0].id,
        shopName: updated[0].shopName,
        partnerStatus: updated[0].partnerStatus,
        isActive: updated[0].isActive,
      },
    });
  } catch (error) {
    console.error("Admin go live error:", error);
    res.status(500).json({ error: "Failed to make partner live" });
  }
});

// Reject partner (can be used at any stage)
router.patch("/shop-partners/:id/reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    const previousStatus = shopPartner.partnerStatus;

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        partnerStatus: "rejected",
        verificationStatus: "rejected",
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_REJECTED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin rejected ${shopPartner.shopName}: ${reason}`,
        metadata: { shopName: shopPartner.shopName, previousStatus, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Shop partner rejected",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        partnerStatus: updated.partnerStatus,
        rejectionReason: updated.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Admin reject partner error:", error);
    res.status(500).json({ error: "Failed to reject partner" });
  }
});

// Same endpoints for Ticket Operators
router.patch("/ticket-operators/:id/approve-kyc", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { id },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    if (operator.partnerStatus !== "kyc_pending") {
      return res.status(400).json({ 
        error: "Can only approve KYC for operators in kyc_pending status",
        currentStatus: operator.partnerStatus,
      });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        partnerStatus: "setup_incomplete",
        kycApprovedAt: new Date(),
        verifiedBy: userId,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_KYC_APPROVED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin approved KYC for ${operator.operatorName}`,
        metadata: { operatorName: operator.operatorName, previousStatus: "kyc_pending" },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC approved successfully. Operator can now complete setup.",
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
        partnerStatus: updated.partnerStatus,
      },
    });
  } catch (error) {
    console.error("Admin approve KYC error:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

router.patch("/ticket-operators/:id/go-live", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { ticketCommissionRate, rentalCommissionRate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    if (operator.partnerStatus !== "ready_for_review") {
      return res.status(400).json({ 
        error: "Can only go live for operators in ready_for_review status",
        currentStatus: operator.partnerStatus,
      });
    }

    // Update operator and user role
    const updated = await prisma.$transaction([
      prisma.ticketOperator.update({
        where: { id },
        data: {
          partnerStatus: "live",
          verificationStatus: "approved",
          isActive: true,
          verifiedAt: new Date(),
          verifiedBy: userId,
          ticketCommissionRate: ticketCommissionRate || 8,
          rentalCommissionRate: rentalCommissionRate || 12,
          updatedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: operator.userId },
        data: { role: "ticket_operator" },
      }),
    ]);

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_WENT_LIVE",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin approved ${operator.operatorName} to go live`,
        metadata: { 
          operatorName: operator.operatorName, 
          ticketCommissionRate: ticketCommissionRate || 8,
          rentalCommissionRate: rentalCommissionRate || 12,
        },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Ticket operator is now LIVE!",
      operator: {
        id: updated[0].id,
        operatorName: updated[0].operatorName,
        partnerStatus: updated[0].partnerStatus,
        isActive: updated[0].isActive,
      },
    });
  } catch (error) {
    console.error("Admin go live error:", error);
    res.status(500).json({ error: "Failed to make operator live" });
  }
});

router.patch("/ticket-operators/:id/reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { id },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    const previousStatus = operator.partnerStatus;

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        partnerStatus: "rejected",
        verificationStatus: "rejected",
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_REJECTED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin rejected ${operator.operatorName}: ${reason}`,
        metadata: { operatorName: operator.operatorName, previousStatus, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Ticket operator rejected",
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
        partnerStatus: updated.partnerStatus,
        rejectionReason: updated.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Admin reject operator error:", error);
    res.status(500).json({ error: "Failed to reject operator" });
  }
});

router.get("/staged-onboarding/stats", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const [shopStats, operatorStats] = await Promise.all([
      prisma.shopPartner.groupBy({
        by: ["partnerStatus"],
        _count: true,
      }),
      prisma.ticketOperator.groupBy({
        by: ["partnerStatus"],
        _count: true,
      }),
    ]);

    const statusOptions = ["draft", "kyc_pending", "setup_incomplete", "ready_for_review", "live", "rejected"];
    
    const shopCounts: Record<string, number> = {};
    const operatorCounts: Record<string, number> = {};
    
    statusOptions.forEach(s => {
      shopCounts[s] = 0;
      operatorCounts[s] = 0;
    });
    
    shopStats.forEach(item => {
      if (item.partnerStatus) {
        shopCounts[item.partnerStatus] = item._count;
      }
    });
    
    operatorStats.forEach(item => {
      if (item.partnerStatus) {
        operatorCounts[item.partnerStatus] = item._count;
      }
    });

    res.json({
      shops: shopCounts,
      operators: operatorCounts,
    });
  } catch (error) {
    console.error("Admin staged onboarding stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/staged-onboarding/partners", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { status, type } = req.query;
    
    const partners: any[] = [];
    
    if (type !== "operator") {
      const shops = await prisma.shopPartner.findMany({
        where: status ? { partnerStatus: status as PartnerStatus } : undefined,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { email: true } },
        },
      });
      
      shops.forEach(shop => {
        partners.push({
          ...shop,
          type: "shop",
        });
      });
    }
    
    if (type !== "shop") {
      const operators = await prisma.ticketOperator.findMany({
        where: status ? { partnerStatus: status as PartnerStatus } : undefined,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { email: true } },
        },
      });
      
      operators.forEach(op => {
        partners.push({
          ...op,
          type: "operator",
        });
      });
    }
    
    partners.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(partners.slice(0, 50));
  } catch (error) {
    console.error("Admin staged onboarding partners error:", error);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

router.post("/shop-partners/:id/kyc-approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shop = await prisma.shopPartner.findUnique({ where: { id } });
    if (!shop) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    if (shop.partnerStatus !== "kyc_pending") {
      return res.status(400).json({ error: "Shop partner is not in KYC pending status" });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        partnerStatus: "setup_incomplete",
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_KYC_APPROVED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin approved KYC for ${shop.shopName}`,
        metadata: { shopName: shop.shopName },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC approved successfully",
      shop: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin KYC approve error:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

router.post("/shop-partners/:id/kyc-reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const shop = await prisma.shopPartner.findUnique({ where: { id } });
    if (!shop) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        partnerStatus: "rejected",
        verificationStatus: "rejected",
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_KYC_REJECTED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin rejected KYC for ${shop.shopName}: ${reason}`,
        metadata: { shopName: shop.shopName, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC rejected",
      shop: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin KYC reject error:", error);
    res.status(500).json({ error: "Failed to reject KYC" });
  }
});

router.post("/shop-partners/:id/setup-return", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shop = await prisma.shopPartner.findUnique({ where: { id } });
    if (!shop) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        rejectionReason: reason || "সেটআপ সম্পূর্ণ করুন",
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_SETUP_RETURNED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin returned setup for ${shop.shopName}`,
        metadata: { shopName: shop.shopName, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Setup returned for revision",
      shop: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin setup return error:", error);
    res.status(500).json({ error: "Failed to return setup" });
  }
});

router.post("/shop-partners/:id/final-approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const shop = await prisma.shopPartner.findUnique({ where: { id } });
    if (!shop) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    if (shop.partnerStatus !== "ready_for_review") {
      return res.status(400).json({ error: "Shop partner is not ready for final review" });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        partnerStatus: "live",
        verificationStatus: "approved",
        isActive: true,
        rejectionReason: null,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_FINAL_APPROVED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin approved ${shop.shopName} to go LIVE`,
        metadata: { shopName: shop.shopName },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Shop partner is now LIVE!",
      shop: { id: updated.id, partnerStatus: updated.partnerStatus, isActive: updated.isActive },
    });
  } catch (error) {
    console.error("Admin final approve error:", error);
    res.status(500).json({ error: "Failed to approve" });
  }
});

router.post("/shop-partners/:id/final-reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const shop = await prisma.shopPartner.findUnique({ where: { id } });
    if (!shop) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    const updated = await prisma.shopPartner.update({
      where: { id },
      data: {
        partnerStatus: "rejected",
        verificationStatus: "rejected",
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "SHOP_PARTNER_FINAL_REJECTED",
        entityType: "shop_partner",
        entityId: id,
        description: `Admin rejected ${shop.shopName}: ${reason}`,
        metadata: { shopName: shop.shopName, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Shop partner rejected",
      shop: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin final reject error:", error);
    res.status(500).json({ error: "Failed to reject" });
  }
});

router.post("/ticket-operators/:id/kyc-approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({ where: { id } });
    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    if (operator.partnerStatus !== "kyc_pending") {
      return res.status(400).json({ error: "Operator is not in KYC pending status" });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        partnerStatus: "setup_incomplete",
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_KYC_APPROVED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin approved KYC for ${operator.operatorName}`,
        metadata: { operatorName: operator.operatorName },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC approved successfully",
      operator: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin KYC approve error:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

router.post("/ticket-operators/:id/kyc-reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const operator = await prisma.ticketOperator.findUnique({ where: { id } });
    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        partnerStatus: "rejected",
        verificationStatus: "rejected",
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_KYC_REJECTED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin rejected KYC for ${operator.operatorName}: ${reason}`,
        metadata: { operatorName: operator.operatorName, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC rejected",
      operator: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin KYC reject error:", error);
    res.status(500).json({ error: "Failed to reject KYC" });
  }
});

router.post("/ticket-operators/:id/setup-return", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({ where: { id } });
    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        rejectionReason: reason || "সেটআপ সম্পূর্ণ করুন",
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_SETUP_RETURNED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin returned setup for ${operator.operatorName}`,
        metadata: { operatorName: operator.operatorName, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Setup returned for revision",
      operator: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin setup return error:", error);
    res.status(500).json({ error: "Failed to return setup" });
  }
});

router.post("/ticket-operators/:id/final-approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const operator = await prisma.ticketOperator.findUnique({ where: { id } });
    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    if (operator.partnerStatus !== "ready_for_review") {
      return res.status(400).json({ error: "Operator is not ready for final review" });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        partnerStatus: "live",
        verificationStatus: "approved",
        isActive: true,
        rejectionReason: null,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_FINAL_APPROVED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin approved ${operator.operatorName} to go LIVE`,
        metadata: { operatorName: operator.operatorName },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Ticket operator is now LIVE!",
      operator: { id: updated.id, partnerStatus: updated.partnerStatus, isActive: updated.isActive },
    });
  } catch (error) {
    console.error("Admin final approve error:", error);
    res.status(500).json({ error: "Failed to approve" });
  }
});

router.post("/ticket-operators/:id/final-reject", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!adminUser?.adminProfile || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const operator = await prisma.ticketOperator.findUnique({ where: { id } });
    if (!operator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    const updated = await prisma.ticketOperator.update({
      where: { id },
      data: {
        partnerStatus: "rejected",
        verificationStatus: "rejected",
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: adminUser.email || "unknown",
        actorRole: "admin",
        actionType: "TICKET_OPERATOR_FINAL_REJECTED",
        entityType: "ticket_operator",
        entityId: id,
        description: `Admin rejected ${operator.operatorName}: ${reason}`,
        metadata: { operatorName: operator.operatorName, reason },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "Ticket operator rejected",
      operator: { id: updated.id, partnerStatus: updated.partnerStatus },
    });
  } catch (error) {
    console.error("Admin final reject error:", error);
    res.status(500).json({ error: "Failed to reject" });
  }
});

export default router;
