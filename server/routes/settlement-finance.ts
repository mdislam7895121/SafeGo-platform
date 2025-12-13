import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { z } from "zod";
import crypto from "crypto";
const router = Router();

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; email?: string };
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "safego-jwt-secret") as any;
    req.user = { id: decoded.userId || decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !["admin", "super_admin", "SUPER_ADMIN", "ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(authenticateToken);

async function createFinanceAuditLog(data: {
  adminId: string;
  adminEmail?: string;
  adminRole?: string;
  actionType: any;
  resourceType: string;
  resourceId?: string;
  targetUserId?: string;
  targetUserType?: string;
  targetUserName?: string;
  beforeValue?: any;
  afterValue?: any;
  changeAmount?: number;
  currency?: string;
  description: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  countryCode?: string;
}) {
  const lastLog = await prisma.financeAuditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { hashChain: true, id: true },
  });

  const logData = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString(),
    previousHash: lastLog?.hashChain || "genesis",
  });

  const hashChain = crypto.createHash("sha256").update(logData).digest("hex");

  return prisma.financeAuditLog.create({
    data: {
      ...data,
      hashChain,
      isVerified: true,
    },
  });
}

router.get("/dashboard", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalSettlements,
      pendingSettlements,
      completedSettlements,
      driverBalances,
      restaurantBalances,
      restrictedDrivers,
      restrictedRestaurants,
      pendingPayouts,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.weeklySettlement.count(),
      prisma.weeklySettlement.count({ where: { status: "pending" } }),
      prisma.weeklySettlement.count({ where: { status: "completed" } }),
      prisma.driverNegativeBalance.aggregate({ _sum: { currentBalance: true }, _count: true }),
      prisma.restaurantNegativeBalance.aggregate({ _sum: { currentBalance: true }, _count: true }),
      prisma.driverNegativeBalance.count({ where: { isRestricted: true } }),
      prisma.restaurantNegativeBalance.count({ where: { isRestricted: true } }),
      prisma.payoutRequest.count({ where: { status: "pending" } }),
      prisma.financeAuditLog.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

    res.json({
      settlements: {
        total: totalSettlements,
        pending: pendingSettlements,
        completed: completedSettlements,
      },
      balances: {
        drivers: {
          count: driverBalances._count,
          totalOwed: driverBalances._sum.currentBalance || 0,
        },
        restaurants: {
          count: restaurantBalances._count,
          totalOwed: restaurantBalances._sum.currentBalance || 0,
        },
      },
      restrictions: {
        drivers: restrictedDrivers,
        restaurants: restrictedRestaurants,
      },
      pendingPayouts,
      recentAuditLogs,
    });
  } catch (error: any) {
    console.error("[Settlement] Dashboard error:", error);
    res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});

router.get("/settlements", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, ownerType, status, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (ownerType) where.ownerType = ownerType;
    if (status) where.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [settlements, total] = await Promise.all([
      prisma.weeklySettlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.weeklySettlement.count({ where }),
    ]);

    res.json({ settlements, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/settlements/generate", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, ownerType, periodStart, periodEnd, timezone } = req.body;

    const statementNumber = `SET-${countryCode}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const settlement = await prisma.weeklySettlement.create({
      data: {
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        countryCode,
        timezone: timezone || "Asia/Dhaka",
        ownerId: req.body.ownerId || "system",
        ownerType: ownerType || "driver",
        ownerRole: req.body.ownerRole,
        totalEarnings: req.body.totalEarnings || 0,
        cashCollected: req.body.cashCollected || 0,
        onlinePayments: req.body.onlinePayments || 0,
        tipsEarned: req.body.tipsEarned || 0,
        bonusesEarned: req.body.bonusesEarned || 0,
        commissionDue: req.body.commissionDue || 0,
        taxDeducted: req.body.taxDeducted || 0,
        penaltiesApplied: req.body.penaltiesApplied || 0,
        previousNegBal: req.body.previousNegBal || 0,
        netSettlement: req.body.netSettlement || 0,
        totalTrips: req.body.totalTrips || 0,
        totalOrders: req.body.totalOrders || 0,
        totalDeliveries: req.body.totalDeliveries || 0,
        statementNumber,
        status: "pending",
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "settlement_created",
      resourceType: "settlement",
      resourceId: settlement.id,
      targetUserId: req.body.ownerId,
      targetUserType: ownerType,
      description: `Weekly settlement generated for ${ownerType} in ${countryCode}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      countryCode,
    });

    res.json({ settlement, message: "Settlement generated successfully" });
  } catch (error: any) {
    console.error("[Settlement] Generate error:", error);
    res.status(500).json({ error: error.message || "Failed to generate settlement" });
  }
});

router.post("/settlements/:id/process", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const settlement = await prisma.weeklySettlement.findUnique({ where: { id } });
    if (!settlement) return res.status(404).json({ error: "Settlement not found" });

    const beforeValue = { status: settlement.status };

    const updated = await prisma.weeklySettlement.update({
      where: { id },
      data: {
        status: action === "complete" ? "completed" : action === "fail" ? "failed" : "requires_review",
        processedAt: new Date(),
        processedBy: req.user!.id,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "settlement_completed",
      resourceType: "settlement",
      resourceId: id,
      targetUserId: settlement.ownerId,
      targetUserType: settlement.ownerType,
      beforeValue,
      afterValue: { status: updated.status },
      description: `Settlement ${action} for ${settlement.ownerType}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ settlement: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/balances/drivers", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, isRestricted, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (isRestricted !== undefined) where.isRestricted = isRestricted === "true";

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [balances, total] = await Promise.all([
      prisma.driverNegativeBalance.findMany({
        where,
        orderBy: { currentBalance: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.driverNegativeBalance.count({ where }),
    ]);

    res.json({ balances, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/balances/restaurants", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, isRestricted, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (isRestricted !== undefined) where.isRestricted = isRestricted === "true";

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [balances, total] = await Promise.all([
      prisma.restaurantNegativeBalance.findMany({
        where,
        orderBy: { currentBalance: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.restaurantNegativeBalance.count({ where }),
    ]);

    res.json({ balances, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/balances/driver/:driverId/adjust", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const { amount, reason } = req.body;

    let balance = await prisma.driverNegativeBalance.findUnique({ where: { driverId } });
    const beforeValue = balance ? { currentBalance: balance.currentBalance } : null;

    if (!balance) {
      balance = await prisma.driverNegativeBalance.create({
        data: {
          driverId,
          countryCode: req.body.countryCode || "BD",
          currentBalance: amount,
          lastUpdated: new Date(),
        },
      });
    } else {
      balance = await prisma.driverNegativeBalance.update({
        where: { driverId },
        data: {
          currentBalance: { increment: amount },
          lastUpdated: new Date(),
        },
      });
    }

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "balance_adjustment",
      resourceType: "driver_balance",
      resourceId: balance.id,
      targetUserId: driverId,
      targetUserType: "driver",
      beforeValue,
      afterValue: { currentBalance: balance.currentBalance },
      changeAmount: amount,
      currency: "BDT",
      description: `Driver balance adjusted by ${amount}`,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ balance, message: "Balance adjusted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/balances/restaurant/:restaurantId/adjust", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { amount, reason } = req.body;

    let balance = await prisma.restaurantNegativeBalance.findUnique({ where: { restaurantId } });
    const beforeValue = balance ? { currentBalance: balance.currentBalance } : null;

    if (!balance) {
      balance = await prisma.restaurantNegativeBalance.create({
        data: {
          restaurantId,
          countryCode: req.body.countryCode || "BD",
          currentBalance: amount,
          lastUpdated: new Date(),
        },
      });
    } else {
      balance = await prisma.restaurantNegativeBalance.update({
        where: { restaurantId },
        data: {
          currentBalance: { increment: amount },
          lastUpdated: new Date(),
        },
      });
    }

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "balance_adjustment",
      resourceType: "restaurant_balance",
      resourceId: balance.id,
      targetUserId: restaurantId,
      targetUserType: "restaurant",
      beforeValue,
      afterValue: { currentBalance: balance.currentBalance },
      changeAmount: amount,
      currency: "BDT",
      description: `Restaurant balance adjusted by ${amount}`,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ balance, message: "Balance adjusted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/balances/driver/:driverId/restrict", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const { restrict, reason } = req.body;

    const balance = await prisma.driverNegativeBalance.update({
      where: { driverId },
      data: {
        isRestricted: restrict,
        restrictedAt: restrict ? new Date() : null,
        restrictionReason: restrict ? reason : null,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: restrict ? "restriction_applied" : "restriction_removed",
      resourceType: "driver_balance",
      resourceId: balance.id,
      targetUserId: driverId,
      targetUserType: "driver",
      description: restrict ? `Driver restricted due to high negative balance` : `Driver restriction removed`,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ balance, message: restrict ? "Driver restricted" : "Restriction removed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/balances/restaurant/:restaurantId/restrict", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { restrict, reason } = req.body;

    const balance = await prisma.restaurantNegativeBalance.update({
      where: { restaurantId },
      data: {
        isRestricted: restrict,
        restrictedAt: restrict ? new Date() : null,
        restrictionReason: restrict ? reason : null,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: restrict ? "restriction_applied" : "restriction_removed",
      resourceType: "restaurant_balance",
      resourceId: balance.id,
      targetUserId: restaurantId,
      targetUserType: "restaurant",
      description: restrict ? `Restaurant restricted due to high negative balance` : `Restaurant restriction removed`,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ balance, message: restrict ? "Restaurant restricted" : "Restriction removed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/thresholds", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, ownerType } = req.query;
    const where: any = { isActive: true };
    if (countryCode) where.countryCode = countryCode;
    if (ownerType) where.ownerType = ownerType;

    const thresholds = await prisma.settlementThreshold.findMany({ where, orderBy: { countryCode: "asc" } });
    res.json({ thresholds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/thresholds", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, ownerType, thresholdType, thresholdValue, currency, description } = req.body;

    const existing = await prisma.settlementThreshold.findUnique({
      where: { countryCode_ownerType_thresholdType: { countryCode, ownerType, thresholdType } },
    });

    const beforeValue = existing ? { thresholdValue: existing.thresholdValue } : null;

    const threshold = await prisma.settlementThreshold.upsert({
      where: { countryCode_ownerType_thresholdType: { countryCode, ownerType, thresholdType } },
      create: {
        countryCode,
        ownerType,
        thresholdType,
        thresholdValue,
        currency: currency || "BDT",
        description,
        createdBy: req.user!.id,
      },
      update: {
        thresholdValue,
        currency,
        description,
        updatedBy: req.user!.id,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "threshold_change",
      resourceType: "threshold",
      resourceId: threshold.id,
      beforeValue,
      afterValue: { thresholdValue },
      changeAmount: thresholdValue,
      currency: currency || "BDT",
      description: `Threshold ${thresholdType} for ${ownerType} in ${countryCode} set to ${thresholdValue}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      countryCode,
    });

    res.json({ threshold, message: "Threshold saved successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const settlementPaySchema = z.object({
  paymentMethod: z.enum(["bkash", "nagad", "card", "stripe"]),
  amount: z.number().positive(),
  transactionId: z.string().optional(),
  phoneNumber: z.string().optional(),
});

router.post("/pay", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const data = settlementPaySchema.parse(req.body);

    let balance: any;
    let balanceType: string;

    if (["driver", "DRIVER", "bd_driver"].includes(userRole)) {
      balance = await prisma.driverNegativeBalance.findUnique({ where: { driverId: userId } });
      balanceType = "driver";
    } else if (["restaurant", "RESTAURANT", "restaurant_owner"].includes(userRole)) {
      balance = await prisma.restaurantNegativeBalance.findUnique({ where: { restaurantId: userId } });
      balanceType = "restaurant";
    } else {
      return res.status(400).json({ error: "Invalid user role for settlement payment" });
    }

    if (!balance || Number(balance.currentBalance) <= 0) {
      return res.json({ success: true, message: "No outstanding balance to pay" });
    }

    const paymentAmount = Math.min(data.amount, Number(balance.currentBalance));

    if (balanceType === "driver") {
      await prisma.driverNegativeBalance.update({
        where: { driverId: userId },
        data: {
          currentBalance: { decrement: paymentAmount },
          totalManualPayments: { increment: paymentAmount },
          isRestricted: Number(balance.currentBalance) - paymentAmount <= 0 ? false : balance.isRestricted,
          restrictedAt: Number(balance.currentBalance) - paymentAmount <= 0 ? null : balance.restrictedAt,
          lastUpdated: new Date(),
        },
      });
    } else {
      await prisma.restaurantNegativeBalance.update({
        where: { restaurantId: userId },
        data: {
          currentBalance: { decrement: paymentAmount },
          totalManualPayments: { increment: paymentAmount },
          isRestricted: Number(balance.currentBalance) - paymentAmount <= 0 ? false : balance.isRestricted,
          restrictedAt: Number(balance.currentBalance) - paymentAmount <= 0 ? null : balance.restrictedAt,
          lastUpdated: new Date(),
        },
      });
    }

    await createFinanceAuditLog({
      adminId: "system",
      actionType: "balance_adjustment",
      resourceType: `${balanceType}_balance`,
      resourceId: balance.id,
      targetUserId: userId,
      targetUserType: balanceType,
      beforeValue: { currentBalance: balance.currentBalance },
      afterValue: { currentBalance: Number(balance.currentBalance) - paymentAmount },
      changeAmount: -paymentAmount,
      currency: "BDT",
      description: `Settlement payment via ${data.paymentMethod}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Payment processed successfully",
      paymentAmount,
      remainingBalance: Number(balance.currentBalance) - paymentAmount,
      restrictionRemoved: Number(balance.currentBalance) - paymentAmount <= 0,
    });
  } catch (error: any) {
    console.error("[Settlement] Pay error:", error);
    res.status(500).json({ error: error.message || "Failed to process payment" });
  }
});

router.get("/payout-requests", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requesterType, status, countryCode, payoutMethod, page = "1", limit = "20", startDate, endDate } = req.query;

    const where: any = {};
    if (requesterType) where.requesterType = requesterType;
    if (status) where.status = status;
    if (countryCode) where.countryCode = countryCode;
    if (payoutMethod) where.payoutMethod = payoutMethod;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [requests, total] = await Promise.all([
      prisma.payoutRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.payoutRequest.count({ where }),
    ]);

    res.json({ requests, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/payout-requests", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { requestedAmount, payoutMethod, accountNumber, accountName, bankName, countryCode } = req.body;

    let requesterType: any;
    if (["driver", "DRIVER", "bd_driver"].includes(userRole)) {
      requesterType = "driver";
    } else if (["restaurant", "RESTAURANT", "restaurant_owner"].includes(userRole)) {
      requesterType = "restaurant";
    } else if (["shop", "SHOP", "shop_partner"].includes(userRole)) {
      requesterType = "shop";
    } else {
      return res.status(400).json({ error: "Invalid role for payout request" });
    }

    const request = await prisma.payoutRequest.create({
      data: {
        requesterId: userId,
        requesterType,
        requesterRole: userRole,
        countryCode: countryCode || "BD",
        requestedAmount,
        payoutMethod,
        accountNumber,
        accountName,
        bankName,
        status: "pending",
      },
    });

    res.json({ request, message: "Payout request submitted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/payout-requests/:id/approve", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const request = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Payout request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Request is not pending" });

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status: "approved",
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        statusNote: note,
        feeAmount: Number(request.requestedAmount) * 0.01,
        netAmount: Number(request.requestedAmount) * 0.99,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "payout_approved",
      resourceType: "payout",
      resourceId: id,
      targetUserId: request.requesterId,
      targetUserType: request.requesterType,
      changeAmount: Number(request.requestedAmount),
      currency: request.currency,
      description: `Payout request approved for ${request.requesterType}`,
      reason: note,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ request: updated, message: "Payout approved successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/payout-requests/:id/reject", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Payout request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Request is not pending" });

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status: "rejected",
        rejectedBy: req.user!.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "payout_rejected",
      resourceType: "payout",
      resourceId: id,
      targetUserId: request.requesterId,
      targetUserType: request.requesterType,
      changeAmount: Number(request.requestedAmount),
      currency: request.currency,
      description: `Payout request rejected for ${request.requesterType}`,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ request: updated, message: "Payout rejected" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/payout-requests/:id/process", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { externalRefId, gatewayResponse } = req.body;

    const request = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Payout request not found" });
    if (request.status !== "approved") return res.status(400).json({ error: "Request must be approved first" });

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status: "completed",
        processedBy: req.user!.id,
        processedAt: new Date(),
        completedAt: new Date(),
        externalRefId,
        gatewayResponse,
      },
    });

    await createFinanceAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      adminRole: req.user!.role,
      actionType: "payout_completed",
      resourceType: "payout",
      resourceId: id,
      targetUserId: request.requesterId,
      targetUserType: request.requesterType,
      changeAmount: Number(request.netAmount),
      currency: request.currency,
      description: `Payout completed for ${request.requesterType} via ${request.payoutMethod}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ request: updated, message: "Payout processed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/payout-requests/export", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requesterType, status, countryCode, startDate, endDate } = req.query;

    const where: any = {};
    if (requesterType) where.requesterType = requesterType;
    if (status) where.status = status;
    if (countryCode) where.countryCode = countryCode;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const requests = await prisma.payoutRequest.findMany({ where, orderBy: { createdAt: "desc" } });

    const csvHeader = "ID,Requester ID,Type,Role,Amount,Method,Account,Status,Created At,Approved By,Completed At\n";
    const csvRows = requests.map((r) =>
      `${r.id},${r.requesterId},${r.requesterType},${r.requesterRole || ""},${r.requestedAmount},${r.payoutMethod},${r.accountNumber || ""},${r.status},${r.createdAt.toISOString()},${r.approvedBy || ""},${r.completedAt?.toISOString() || ""}`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=payout-requests-${Date.now()}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit-logs", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actionType, resourceType, adminId, targetUserId, page = "1", limit = "50", startDate, endDate } = req.query;

    const where: any = {};
    if (actionType) where.actionType = actionType;
    if (resourceType) where.resourceType = resourceType;
    if (adminId) where.adminId = adminId;
    if (targetUserId) where.targetUserId = targetUserId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.financeAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.financeAuditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit-logs/verify", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.financeAuditLog.findMany({
      orderBy: { createdAt: "asc" },
      take: 1000,
    });

    let previousHash = "genesis";
    let verified = true;
    const issues: string[] = [];

    for (const log of logs) {
      if (!log.hashChain) {
        issues.push(`Log ${log.id} has no hash chain`);
        continue;
      }

      const expectedData = JSON.stringify({
        adminId: log.adminId,
        adminEmail: log.adminEmail,
        adminRole: log.adminRole,
        actionType: log.actionType,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        targetUserId: log.targetUserId,
        targetUserType: log.targetUserType,
        targetUserName: log.targetUserName,
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
        changeAmount: log.changeAmount,
        currency: log.currency,
        description: log.description,
        reason: log.reason,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        deviceFingerprint: log.deviceFingerprint,
        countryCode: log.countryCode,
        timestamp: log.createdAt.toISOString(),
        previousHash,
      });

      previousHash = log.hashChain;
    }

    res.json({
      verified,
      totalLogs: logs.length,
      issues,
      message: verified ? "All logs verified successfully" : "Some logs may have integrity issues",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
