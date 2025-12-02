import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";

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

export default router;
