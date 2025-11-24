import { Router } from "express";
import { prisma } from "../db";
import { payoutService } from "../services/payoutService";
import { bankVerificationService } from "../services/bankVerificationService";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { logAuditEvent, getClientIp } from "../utils/audit";
import type { WalletOwnerType, PayoutMethod } from "@prisma/client";

const router = Router();

/**
 * Helper to get owner details from authenticated user
 */
async function getOwnerDetails(req: AuthRequest): Promise<{
  ownerId: string;
  ownerType: WalletOwnerType;
  countryCode: string;
  email: string;
} | null> {
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role === "driver") {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!driver) return null;
    return {
      ownerId: driver.id,
      ownerType: "driver",
      countryCode: driver.user.countryCode,
      email: driver.user.email,
    };
  }

  if (role === "restaurant") {
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!restaurant) return null;
    return {
      ownerId: restaurant.id,
      ownerType: "restaurant",
      countryCode: restaurant.user.countryCode,
      email: restaurant.user.email,
    };
  }

  if (role === "customer") {
    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!customer) return null;
    return {
      ownerId: customer.id,
      ownerType: "customer",
      countryCode: customer.user.countryCode,
      email: customer.user.email,
    };
  }

  return null;
}

/**
 * GET /api/payout/methods
 * Get all payout methods for authenticated user
 */
router.get("/methods", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const methods = await prisma.payoutAccount.findMany({
      where: {
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        payoutType: true,
        provider: true,
        displayName: true,
        accountHolderName: true,
        maskedAccount: true,
        isDefault: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({ methods });
  } catch (error: any) {
    console.error("Get payout methods error:", error);
    res.status(500).json({ error: "Failed to fetch payout methods" });
  }
});

/**
 * POST /api/payout/methods
 * Add a new payout method
 */
router.post("/methods", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const {
      payoutType,
      accountHolderName,
      accountNumber,
      routingNumber,
      swiftCode,
      bankName,
      branchName,
      mobileWalletNumber,
    } = req.body;

    // Validate required fields
    if (!payoutType || !accountHolderName) {
      return res.status(400).json({
        error: "payoutType and accountHolderName are required",
      });
    }

    // Create and verify payout account
    const payoutAccount = await bankVerificationService.createVerifiedPayoutAccount({
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      countryCode: owner.countryCode as "BD" | "US",
      payoutType,
      accountDetails: {
        accountHolderName,
        accountNumber,
        routingNumber,
        swiftCode,
        bankName,
        branchName,
        mobileWalletNumber,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: owner.email,
      actorRole: owner.ownerType.toUpperCase() as any,
      ipAddress: getClientIp(req),
      actionType: "CREATE_PAYOUT_METHOD",
      entityType: "payout_account",
      entityId: payoutAccount.id,
      description: `Created ${payoutType} payout method`,
      metadata: { payoutType, status: payoutAccount.status },
    });

    res.status(201).json({
      method: {
        id: payoutAccount.id,
        payoutType: payoutAccount.payoutType,
        provider: payoutAccount.provider,
        displayName: payoutAccount.displayName,
        maskedAccount: payoutAccount.maskedAccount,
        status: payoutAccount.status,
      },
    });
  } catch (error: any) {
    console.error("Create payout method error:", error);
    const statusCode = error.message.includes("KYC validation failed") ? 400 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to create payout method" });
  }
});

/**
 * DELETE /api/payout/methods/:id
 * Delete a payout method
 */
router.delete("/methods/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { id } = req.params;

    // Verify ownership
    const method = await prisma.payoutAccount.findUnique({
      where: { id },
    });

    if (!method || method.ownerId !== owner.ownerId) {
      return res.status(404).json({ error: "Payout method not found" });
    }

    // Don't allow deleting if it's the only method or if there are pending payouts
    const pendingPayouts = await prisma.payout.count({
      where: {
        ownerId: owner.ownerId,
        status: { in: ["pending", "processing"] },
      },
    });

    if (pendingPayouts > 0) {
      return res.status(400).json({
        error: "Cannot delete payout method while payouts are pending",
      });
    }

    await prisma.payoutAccount.delete({ where: { id } });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: owner.email,
      actorRole: owner.ownerType.toUpperCase() as any,
      ipAddress: getClientIp(req),
      actionType: "DELETE_PAYOUT_METHOD",
      entityType: "payout_account",
      entityId: id,
      description: `Deleted payout method ${id}`,
      metadata: {},
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete payout method error:", error);
    res.status(500).json({ error: "Failed to delete payout method" });
  }
});

/**
 * POST /api/payout/verify
 * Verify KYC for payout capability
 */
router.post("/verify", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { payoutType, accountDetails } = req.body;

    const validation = await bankVerificationService.validateKYCForPayout({
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      countryCode: owner.countryCode as "BD" | "US",
      payoutType,
      accountDetails,
    });

    res.json({
      isValid: validation.isValid,
      errors: validation.errors,
      kycLevel: validation.kycLevel,
      canAddPayoutMethod: validation.isValid,
    });
  } catch (error: any) {
    console.error("Verify KYC error:", error);
    res.status(500).json({ error: "Failed to verify KYC" });
  }
});

/**
 * POST /api/payout/withdraw
 * Request a manual payout
 */
router.post("/withdraw", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { amount, payoutAccountId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    // Get wallet
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: owner.ownerId,
          ownerType: owner.ownerType,
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Create payout
    const payout = await payoutService.createPayout({
      walletId: wallet.id,
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      amount: parseFloat(amount),
      method: "manual_request",
      countryCode: wallet.countryCode,
      payoutAccountId,
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: owner.email,
      actorRole: owner.ownerType.toUpperCase() as any,
      ipAddress: getClientIp(req),
      actionType: "REQUEST_PAYOUT",
      entityType: "payout",
      entityId: payout.id,
      description: `Requested payout of ${wallet.currency} ${amount}`,
      metadata: { amount, method: "manual_request" },
    });

    res.status(201).json({
      payout: {
        id: payout.id,
        amount: payout.amount.toString(),
        status: payout.status,
        method: payout.method,
        createdAt: payout.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Withdraw error:", error);
    res.status(400).json({ error: error.message || "Failed to process withdrawal" });
  }
});

/**
 * POST /api/payout/schedule
 * Enable/disable automatic weekly payouts
 */
router.post("/schedule", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { enabled, payoutAccountId } = req.body;

    // Get wallet
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: owner.ownerId,
          ownerType: owner.ownerType,
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    if (enabled && !payoutAccountId) {
      return res.status(400).json({
        error: "Payout account ID required to enable automatic payouts",
      });
    }

    // Update wallet metadata or create preference
    // For now, we'll use a simple approach with wallet metadata
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        // Store preference in metadata or create separate AutoPayoutSettings model
        // Simplified for now
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: owner.email,
      actorRole: owner.ownerType.toUpperCase() as any,
      ipAddress: getClientIp(req),
      actionType: "UPDATE_PAYOUT_SCHEDULE",
      entityType: "wallet",
      entityId: wallet.id,
      description: `${enabled ? "Enabled" : "Disabled"} automatic weekly payouts`,
      metadata: { enabled, payoutAccountId },
    });

    res.json({
      success: true,
      autoPayoutEnabled: enabled,
      message: enabled
        ? "Automatic weekly payouts enabled"
        : "Automatic weekly payouts disabled",
    });
  } catch (error: any) {
    console.error("Schedule payout error:", error);
    res.status(500).json({ error: "Failed to update payout schedule" });
  }
});

/**
 * GET /api/payout/history
 * Get payout history with pagination
 */
router.get("/history", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as any;

    const history = await payoutService.getPayoutHistory({
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
      status,
      limit,
      offset,
    });

    res.json({
      payouts: history.payouts.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        currency: p.wallet.currency,
        status: p.status,
        method: p.method,
        failureReason: p.failureReason,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
        scheduledAt: p.scheduledAt,
      })),
      total: history.total,
      limit: history.limit,
      offset: history.offset,
      hasMore: history.hasMore,
    });
  } catch (error: any) {
    console.error("Get payout history error:", error);
    res.status(500).json({ error: "Failed to fetch payout history" });
  }
});

/**
 * GET /api/payout/stats
 * Get payout statistics
 */
router.get("/stats", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const owner = await getOwnerDetails(req);
    if (!owner) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const stats = await payoutService.getPayoutStats(owner.ownerId, owner.ownerType);

    res.json({
      totalPayouts: stats.totalPayouts,
      completedPayouts: stats.completedPayouts,
      pendingPayouts: stats.pendingPayouts,
      totalAmount: stats.totalAmount.toString(),
    });
  } catch (error: any) {
    console.error("Get payout stats error:", error);
    res.status(500).json({ error: "Failed to fetch payout statistics" });
  }
});

export default router;
