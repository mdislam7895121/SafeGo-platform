import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";

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

// ====================================================
// WALLET & PAYOUT API
// ====================================================

// GET /api/restaurant/wallet
// Get restaurant wallet details
router.get("/wallet", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

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

    res.json(wallet);
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

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

export default router;
