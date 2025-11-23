/**
 * Restaurant Payouts & Settlement System
 * Phase 5: Comprehensive payout management for restaurants
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export interface RestaurantPayoutOverview {
  restaurantId: string;
  restaurantName: string;
  walletBalance: number;
  negativeBalance: number;
  pendingPayoutAmount: number;
  lastPayoutDate: Date | null;
  nextSettlementDate: Date | null;
  totalEarnings: number;
  totalCommissions: number;
  totalPayouts: number;
  currency: string;
  canRequestPayout: boolean;
  blockReason?: string;
}

export interface LedgerEntry {
  id: string;
  date: Date;
  type: "earning" | "commission" | "payout" | "adjustment";
  description: string;
  amount: number;
  balance: number;
  negativeBalance: number;
  referenceType?: string;
  referenceId?: string;
}

export interface SettlementCycle {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  totalAmount: number;
  payoutCount: number;
  createdAt: Date;
}

/**
 * Get restaurant payout overview
 * @param restaurantId - Restaurant profile ID
 */
export async function getRestaurantPayoutOverview(
  restaurantId: string
): Promise<RestaurantPayoutOverview> {
  const restaurantProfile = await prisma.restaurantProfile.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      businessName: true,
      isVerified: true,
      isDemo: true,
      countryCode: true,
    },
  });

  if (!restaurantProfile) {
    throw new Error("Restaurant not found");
  }

  // Get or create wallet
  let wallet = await prisma.wallet.findUnique({
    where: {
      ownerId_ownerType: {
        ownerId: restaurantId,
        ownerType: "RESTAURANT",
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        ownerId: restaurantId,
        ownerType: "RESTAURANT",
        countryCode: restaurantProfile.countryCode || "US",
        availableBalance: 0,
        negativeBalance: 0,
        currency: restaurantProfile.countryCode === "BD" ? "BDT" : "USD",
        isDemo: restaurantProfile.isDemo,
      },
    });
  }

  // Get pending payout amount
  const pendingPayouts = await prisma.payout.aggregate({
    where: {
      ownerType: "RESTAURANT",
      ownerId: restaurantId,
      status: "pending",
    },
    _sum: {
      amount: true,
    },
  });

  // Get last payout date
  const lastPayout = await prisma.payout.findFirst({
    where: {
      ownerType: "RESTAURANT",
      ownerId: restaurantId,
      status: "completed",
    },
    orderBy: {
      processedAt: "desc",
    },
    select: {
      processedAt: true,
    },
  });

  // Calculate next settlement date (weekly - every Monday)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextSettlementDate = new Date(today);
  nextSettlementDate.setDate(today.getDate() + daysUntilMonday);
  nextSettlementDate.setHours(0, 0, 0, 0);

  // Calculate totals from food orders
  const orderStats = await prisma.foodOrder.aggregate({
    where: {
      restaurantId,
      status: "delivered",
    },
    _sum: {
      restaurantPayout: true,
      safegoCommission: true,
    },
  });

  // Get total payouts
  const payoutStats = await prisma.payout.aggregate({
    where: {
      ownerType: "RESTAURANT",
      ownerId: restaurantId,
      status: {
        in: ["completed", "processing"],
      },
    },
    _sum: {
      amount: true,
    },
  });

  const totalEarnings = orderStats._sum.restaurantPayout
    ? parseFloat(orderStats._sum.restaurantPayout.toString())
    : 0;
  const totalCommissions = orderStats._sum.safegoCommission
    ? parseFloat(orderStats._sum.safegoCommission.toString())
    : 0;
  const totalPayouts = payoutStats._sum.amount
    ? parseFloat(payoutStats._sum.amount.toString())
    : 0;

  // Check if can request payout
  const minPayoutThreshold = restaurantProfile.countryCode === "BD" ? 500 : 10; // 500 BDT or $10 USD
  const hasNegativeBalance = !wallet.negativeBalance.isZero();
  const hasSufficientBalance = wallet.availableBalance.gte(minPayoutThreshold);
  const isKYCVerified = restaurantProfile.isVerified;

  let canRequestPayout = true;
  let blockReason: string | undefined;

  if (!isKYCVerified) {
    canRequestPayout = false;
    blockReason = "KYC verification required";
  } else if (hasNegativeBalance) {
    canRequestPayout = false;
    blockReason = `Outstanding debt: ${wallet.negativeBalance} ${wallet.currency}`;
  } else if (!hasSufficientBalance) {
    canRequestPayout = false;
    blockReason = `Minimum balance required: ${minPayoutThreshold} ${wallet.currency}`;
  }

  return {
    restaurantId: restaurantProfile.id,
    restaurantName: restaurantProfile.businessName || "Unknown Restaurant",
    walletBalance: parseFloat(wallet.availableBalance.toString()),
    negativeBalance: parseFloat(wallet.negativeBalance.toString()),
    pendingPayoutAmount: pendingPayouts._sum.amount
      ? parseFloat(pendingPayouts._sum.amount.toString())
      : 0,
    lastPayoutDate: lastPayout?.processedAt || null,
    nextSettlementDate,
    totalEarnings,
    totalCommissions,
    totalPayouts,
    currency: wallet.currency,
    canRequestPayout,
    blockReason,
  };
}

/**
 * Get restaurant ledger (wallet transactions)
 * @param restaurantId - Restaurant profile ID
 * @param limit - Number of entries to return
 * @param offset - Pagination offset
 */
export async function getRestaurantLedger(
  restaurantId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ ledger: LedgerEntry[]; total: number }> {
  const wallet = await prisma.wallet.findUnique({
    where: {
      ownerId_ownerType: {
        ownerId: restaurantId,
        ownerType: "RESTAURANT",
      },
    },
  });

  if (!wallet) {
    return { ledger: [], total: 0 };
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    skip: offset,
  });

  const total = await prisma.walletTransaction.count({
    where: {
      walletId: wallet.id,
    },
  });

  const ledger: LedgerEntry[] = transactions.map((tx) => {
    let type: "earning" | "commission" | "payout" | "adjustment";
    if (tx.referenceType === "food_order" && tx.direction === "credit") {
      type = "earning";
    } else if (tx.referenceType === "food_order" && tx.direction === "debit") {
      type = "commission";
    } else if (tx.referenceType === "payout") {
      type = "payout";
    } else {
      type = "adjustment";
    }

    return {
      id: tx.id,
      date: tx.createdAt,
      type,
      description: tx.description,
      amount: parseFloat(tx.amount.toString()),
      balance: parseFloat(tx.balanceSnapshot.toString()),
      negativeBalance: parseFloat(tx.negativeBalanceSnapshot.toString()),
      referenceType: tx.referenceType,
      referenceId: tx.referenceId || undefined,
    };
  });

  return { ledger, total };
}

/**
 * Get settlement cycles for restaurant
 * @param restaurantId - Restaurant profile ID
 */
export async function getRestaurantSettlements(
  restaurantId: string
): Promise<SettlementCycle[]> {
  // Get all payout batches that include this restaurant's payouts
  const payouts = await prisma.payout.findMany({
    where: {
      ownerType: "RESTAURANT",
      ownerId: restaurantId,
      batchId: {
        not: null,
      },
    },
    select: {
      batchId: true,
    },
    distinct: ["batchId"],
  });

  const batchIds = payouts
    .map((p) => p.batchId)
    .filter((id): id is string => id !== null);

  if (batchIds.length === 0) {
    return [];
  }

  const batches = await prisma.payoutBatch.findMany({
    where: {
      id: {
        in: batchIds,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return batches.map((batch) => ({
    id: batch.id,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    status: batch.status,
    totalAmount: parseFloat(batch.totalPayoutAmount.toString()),
    payoutCount: batch.totalPayoutCount,
    createdAt: batch.createdAt,
  }));
}

/**
 * Check if user is restaurant OWNER (not STAFF)
 * @param userId - User ID
 */
export async function isRestaurantOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === "RESTAURANT_OWNER";
}

/**
 * Get all restaurants with their payout status (admin view)
 */
export async function getAllRestaurantPayouts(filters?: {
  hasNegativeBalance?: boolean;
  hasPendingPayouts?: boolean;
  countryCode?: string;
}): Promise<any[]> {
  const restaurants = await prisma.restaurantProfile.findMany({
    where: {
      isVerified: true,
      isDemo: false,
    },
    select: {
      id: true,
      businessName: true,
      countryCode: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const results = await Promise.all(
    restaurants.map(async (restaurant) => {
      const wallet = await prisma.wallet.findUnique({
        where: {
          ownerId_ownerType: {
            ownerId: restaurant.id,
            ownerType: "RESTAURANT",
          },
        },
      });

      const pendingPayouts = await prisma.payout.aggregate({
        where: {
          ownerType: "RESTAURANT",
          ownerId: restaurant.id,
          status: "pending",
        },
        _sum: {
          amount: true,
        },
        _count: true,
      });

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.businessName || "Unknown",
        email: restaurant.user.email,
        countryCode: restaurant.countryCode || "US",
        walletBalance: wallet
          ? parseFloat(wallet.availableBalance.toString())
          : 0,
        negativeBalance: wallet
          ? parseFloat(wallet.negativeBalance.toString())
          : 0,
        pendingPayoutCount: pendingPayouts._count,
        pendingPayoutAmount: pendingPayouts._sum.amount
          ? parseFloat(pendingPayouts._sum.amount.toString())
          : 0,
        currency: wallet?.currency || "USD",
      };
    })
  );

  // Apply filters
  let filtered = results;

  if (filters?.hasNegativeBalance) {
    filtered = filtered.filter((r) => r.negativeBalance > 0);
  }

  if (filters?.hasPendingPayouts) {
    filtered = filtered.filter((r) => r.pendingPayoutCount > 0);
  }

  if (filters?.countryCode) {
    filtered = filtered.filter((r) => r.countryCode === filters.countryCode);
  }

  return filtered;
}
