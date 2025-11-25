import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { Decimal } from "@prisma/client/runtime/library";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(["driver"]));

function serializeDecimal(value: Decimal | null | undefined): string {
  if (!value) return "0";
  return value.toString();
}

async function getDriverContext(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { user: true }
  });
  if (!driver) throw new Error("Driver profile not found");
  return {
    driverId: driver.id,
    countryCode: driver.user.countryCode || "US",
    verificationStatus: driver.verificationStatus,
    isVerified: driver.isVerified,
    email: driver.user.email
  };
}

async function getPayoutConfig(countryCode: string, serviceType: string = "GLOBAL") {
  let config = await prisma.countryPayoutConfig.findFirst({
    where: {
      countryCode,
      actorType: "DRIVER",
      serviceType,
      isEnabled: true
    }
  });
  if (!config && serviceType !== "GLOBAL") {
    config = await prisma.countryPayoutConfig.findFirst({
      where: {
        countryCode,
        actorType: "DRIVER",
        serviceType: "GLOBAL",
        isEnabled: true
      }
    });
  }
  return config;
}

function calculateFee(amount: Decimal, feeType: string, feeValue: Decimal): Decimal {
  if (feeType === "NONE") return new Decimal(0);
  if (feeType === "FLAT") return feeValue;
  if (feeType === "PERCENT") {
    return amount.mul(feeValue).div(100);
  }
  return new Decimal(0);
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = { USD: "$", BDT: "৳", EUR: "€", GBP: "£" };
  return symbols[currency] || currency;
}

/**
 * GET /api/driver/wallet/summary
 * Get wallet summary with country-specific payout rules
 */
router.get("/wallet/summary", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    let wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: ctx.driverId,
          ownerType: "driver"
        }
      }
    });

    if (!wallet) {
      const currency = ctx.countryCode === "BD" ? "BDT" : "USD";
      wallet = await prisma.wallet.create({
        data: {
          ownerId: ctx.driverId,
          ownerType: "driver",
          countryCode: ctx.countryCode,
          currency,
          availableBalance: 0,
          holdAmount: 0,
          negativeBalance: 0
        }
      });
    }

    const config = await getPayoutConfig(ctx.countryCode);

    const [totalEarnings, totalPayouts, pendingPayouts] = await Promise.all([
      prisma.walletTransaction.aggregate({
        where: { walletId: wallet.id, direction: "credit" },
        _sum: { amount: true }
      }),
      prisma.payout.aggregate({
        where: { walletId: wallet.id, status: "completed" },
        _sum: { amount: true }
      }),
      prisma.payout.count({
        where: { walletId: wallet.id, status: { in: ["pending", "processing"] } }
      })
    ]);

    const availableForPayout = wallet.availableBalance.sub(wallet.holdAmount).sub(wallet.negativeBalance);

    res.json({
      balance: serializeDecimal(wallet.availableBalance),
      holdAmount: serializeDecimal(wallet.holdAmount),
      negativeBalance: serializeDecimal(wallet.negativeBalance),
      availableForPayout: serializeDecimal(availableForPayout.isNegative() ? new Decimal(0) : availableForPayout),
      currency: wallet.currency,
      currencySymbol: getCurrencySymbol(wallet.currency),
      countryCode: wallet.countryCode,
      totalEarnings: serializeDecimal(totalEarnings._sum.amount),
      totalPayouts: serializeDecimal(totalPayouts._sum.amount),
      pendingPayoutsCount: pendingPayouts,
      kycStatus: ctx.verificationStatus,
      kycApproved: ctx.verificationStatus === "approved" || ctx.isVerified,
      payoutRules: config ? {
        minPayoutAmount: serializeDecimal(config.minPayoutAmount),
        maxPayoutAmount: config.maxPayoutAmount ? serializeDecimal(config.maxPayoutAmount) : null,
        payoutSchedule: config.payoutSchedule,
        payoutDayOfWeek: config.payoutDayOfWeek,
        payoutDayOfMonth: config.payoutDayOfMonth,
        platformFeeType: config.platformFeeType,
        platformFeeValue: serializeDecimal(config.platformFeeValue),
        requiresKycLevel: config.requiresKycLevel
      } : null
    });
  } catch (error: any) {
    console.error("Get driver wallet summary error:", error);
    res.status(500).json({ error: error.message || "Failed to get wallet summary" });
  }
});

/**
 * GET /api/driver/wallet/transactions
 * Get paginated wallet transaction history
 */
router.get("/wallet/transactions", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);
    const { limit = "20", offset = "0", type, serviceType, startDate, endDate } = req.query;

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: ctx.driverId,
          ownerType: "driver"
        }
      }
    });

    if (!wallet) {
      return res.json({ transactions: [], total: 0, pagination: { limit: 20, offset: 0 } });
    }

    const where: any = { walletId: wallet.id };
    if (type && type !== "all") where.referenceType = type;
    if (serviceType && serviceType !== "all") where.serviceType = serviceType;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate as string) };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.walletTransaction.count({ where })
    ]);

    res.json({
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.referenceType,
        serviceType: t.serviceType,
        direction: t.direction,
        amount: serializeDecimal(t.amount),
        description: t.description,
        createdAt: t.createdAt.toISOString()
      })),
      total,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    console.error("Get wallet transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

/**
 * GET /api/driver/payout-methods
 * Get driver's payout methods
 */
router.get("/payout-methods", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    const methods = await prisma.restaurantPayoutMethod.findMany({
      where: {
        actorType: "DRIVER",
        driverId: ctx.driverId,
        status: { not: "DISABLED" }
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });

    res.json({
      methods: methods.map(m => ({
        id: m.id,
        payoutRailType: m.payoutRailType,
        provider: m.provider,
        currency: m.currency,
        maskedDetails: m.maskedDetails,
        isDefault: m.isDefault,
        status: m.status,
        createdAt: m.createdAt.toISOString()
      })),
      kycStatus: ctx.verificationStatus,
      canAddMethod: ctx.verificationStatus === "approved" || ctx.isVerified
    });
  } catch (error: any) {
    console.error("Get payout methods error:", error);
    res.status(500).json({ error: "Failed to get payout methods" });
  }
});

/**
 * POST /api/driver/payout-methods
 * Add a new payout method
 */
router.post("/payout-methods", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    if (ctx.verificationStatus !== "approved" && !ctx.isVerified) {
      return res.status(403).json({
        error: "KYC verification required to add payout methods",
        kycStatus: ctx.verificationStatus,
        kycRequired: true
      });
    }

    const { payoutRailType, provider, maskedDetails, metadata } = req.body;

    if (!payoutRailType || !maskedDetails) {
      return res.status(400).json({ error: "payoutRailType and maskedDetails are required" });
    }

    const currency = ctx.countryCode === "BD" ? "BDT" : "USD";

    const existingMethods = await prisma.restaurantPayoutMethod.count({
      where: { actorType: "DRIVER", driverId: ctx.driverId, status: { not: "DISABLED" } }
    });

    const method = await prisma.restaurantPayoutMethod.create({
      data: {
        actorType: "DRIVER",
        driverId: ctx.driverId,
        countryCode: ctx.countryCode,
        payoutRailType,
        provider: provider || payoutRailType,
        currency,
        maskedDetails,
        metadata: metadata || {},
        isDefault: existingMethods === 0,
        status: "ACTIVE",
        createdByActorId: req.user!.userId,
        actorRole: "driver"
      }
    });

    res.status(201).json({
      method: {
        id: method.id,
        payoutRailType: method.payoutRailType,
        provider: method.provider,
        currency: method.currency,
        maskedDetails: method.maskedDetails,
        isDefault: method.isDefault,
        status: method.status
      }
    });
  } catch (error: any) {
    console.error("Create payout method error:", error);
    res.status(500).json({ error: "Failed to create payout method" });
  }
});

/**
 * PATCH /api/driver/payout-methods/:id/set-primary
 * Set a payout method as primary
 */
router.patch("/payout-methods/:id/set-primary", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);
    const { id } = req.params;

    const method = await prisma.restaurantPayoutMethod.findUnique({ where: { id } });
    if (!method || method.actorType !== "DRIVER" || method.driverId !== ctx.driverId) {
      return res.status(404).json({ error: "Payout method not found" });
    }

    await prisma.$transaction([
      prisma.restaurantPayoutMethod.updateMany({
        where: { actorType: "DRIVER", driverId: ctx.driverId },
        data: { isDefault: false }
      }),
      prisma.restaurantPayoutMethod.update({
        where: { id },
        data: { isDefault: true }
      })
    ]);

    res.json({ success: true, message: "Primary payout method updated" });
  } catch (error: any) {
    console.error("Set primary payout method error:", error);
    res.status(500).json({ error: "Failed to set primary payout method" });
  }
});

/**
 * DELETE /api/driver/payout-methods/:id
 * Soft-delete a payout method
 */
router.delete("/payout-methods/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);
    const { id } = req.params;

    const method = await prisma.restaurantPayoutMethod.findUnique({ where: { id } });
    if (!method || method.actorType !== "DRIVER" || method.driverId !== ctx.driverId) {
      return res.status(404).json({ error: "Payout method not found" });
    }

    const pendingPayouts = await prisma.payout.count({
      where: {
        ownerId: ctx.driverId,
        ownerType: "driver",
        payoutMethodId: id,
        status: { in: ["pending", "processing"] }
      }
    });

    if (pendingPayouts > 0) {
      return res.status(400).json({ error: "Cannot delete payout method with pending payouts" });
    }

    await prisma.restaurantPayoutMethod.update({
      where: { id },
      data: { status: "DISABLED" }
    });

    res.json({ success: true, message: "Payout method removed" });
  } catch (error: any) {
    console.error("Delete payout method error:", error);
    res.status(500).json({ error: "Failed to delete payout method" });
  }
});

/**
 * POST /api/driver/payouts
 * Request a payout with KYC enforcement and fee calculation
 */
router.post("/payouts", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    if (ctx.verificationStatus !== "approved" && !ctx.isVerified) {
      return res.status(403).json({
        error: "KYC verification required to request payouts",
        kycStatus: ctx.verificationStatus,
        kycRequired: true
      });
    }

    const { amount, payoutMethodId } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }
    if (!payoutMethodId) {
      return res.status(400).json({ error: "Payout method is required" });
    }

    const method = await prisma.restaurantPayoutMethod.findUnique({ where: { id: payoutMethodId } });
    if (!method || method.actorType !== "DRIVER" || method.driverId !== ctx.driverId) {
      return res.status(404).json({ error: "Payout method not found" });
    }
    if (method.status !== "ACTIVE") {
      return res.status(400).json({ error: "Payout method is not active" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: ctx.driverId,
          ownerType: "driver"
        }
      }
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const config = await getPayoutConfig(ctx.countryCode);
    if (!config) {
      return res.status(400).json({ error: "Payout not available in your region" });
    }

    const requestedAmount = new Decimal(amount);
    const availableBalance = wallet.availableBalance.sub(wallet.holdAmount).sub(wallet.negativeBalance);

    if (requestedAmount.lt(config.minPayoutAmount)) {
      return res.status(400).json({
        error: `Minimum payout amount is ${getCurrencySymbol(wallet.currency)}${config.minPayoutAmount}`,
        minAmount: serializeDecimal(config.minPayoutAmount)
      });
    }

    if (config.maxPayoutAmount && requestedAmount.gt(config.maxPayoutAmount)) {
      return res.status(400).json({
        error: `Maximum payout amount is ${getCurrencySymbol(wallet.currency)}${config.maxPayoutAmount}`,
        maxAmount: serializeDecimal(config.maxPayoutAmount)
      });
    }

    if (requestedAmount.gt(availableBalance)) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${getCurrencySymbol(wallet.currency)}${availableBalance.toFixed(2)}`,
        availableBalance: serializeDecimal(availableBalance)
      });
    }

    const feeAmount = calculateFee(requestedAmount, config.platformFeeType, config.platformFeeValue);
    const netAmount = requestedAmount.sub(feeAmount);

    if (netAmount.lte(0)) {
      return res.status(400).json({ error: "Payout amount too small after fees" });
    }

    const payout = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: requestedAmount },
          holdAmount: { increment: requestedAmount }
        }
      });

      if (updatedWallet.availableBalance.isNegative()) {
        throw new Error("Insufficient funds - concurrent operation detected");
      }

      const newPayout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          ownerId: ctx.driverId,
          ownerType: "driver",
          countryCode: ctx.countryCode,
          amount: requestedAmount,
          feeAmount,
          netAmount,
          method: "manual_request",
          status: "pending",
          payoutMethodId
        }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "driver",
          countryCode: ctx.countryCode,
          serviceType: "payout",
          direction: "debit",
          amount: requestedAmount,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "payout",
          referenceId: newPayout.id,
          description: `Payout request - ${getCurrencySymbol(wallet.currency)}${netAmount.toFixed(2)} (fee: ${getCurrencySymbol(wallet.currency)}${feeAmount.toFixed(2)})`
        }
      });

      return newPayout;
    });

    const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });

    res.status(201).json({
      success: true,
      payout: {
        id: payout.id,
        amount: serializeDecimal(payout.amount),
        feeAmount: serializeDecimal(payout.feeAmount),
        netAmount: serializeDecimal(payout.netAmount),
        currency: wallet.currency,
        status: payout.status,
        createdAt: payout.createdAt.toISOString()
      },
      wallet: {
        balance: serializeDecimal(updatedWallet?.availableBalance),
        holdAmount: serializeDecimal(updatedWallet?.holdAmount)
      }
    });
  } catch (error: any) {
    console.error("Create payout error:", error);
    res.status(500).json({ error: error.message || "Failed to create payout" });
  }
});

/**
 * GET /api/driver/payouts
 * Get driver's payout history
 */
router.get("/payouts", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);
    const { limit = "20", offset = "0", status } = req.query;

    const where: any = { ownerId: ctx.driverId, ownerType: "driver" };
    if (status && status !== "all") where.status = status;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        include: { wallet: { select: { currency: true } } },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.payout.count({ where })
    ]);

    res.json({
      payouts: payouts.map(p => ({
        id: p.id,
        amount: serializeDecimal(p.amount),
        feeAmount: serializeDecimal(p.feeAmount),
        netAmount: serializeDecimal(p.netAmount),
        currency: p.wallet.currency,
        status: p.status,
        method: p.method,
        failureReason: p.failureReason,
        createdAt: p.createdAt.toISOString(),
        processedAt: p.processedAt?.toISOString()
      })),
      total,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    console.error("Get payouts error:", error);
    res.status(500).json({ error: "Failed to get payouts" });
  }
});

export default router;
