import { PrismaClient, WalletOwnerType, PayoutMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

interface SchedulePayoutParams {
  ownerType?: WalletOwnerType;
  countryCode?: string;
  minAmount?: number;
  periodStart: Date;
  periodEnd: Date;
  adminId: string;
}

interface SchedulePayoutResult {
  batchId: string;
  totalPayouts: number;
  totalAmount: string;
  payoutIds: string[];
}

interface ManualPayoutParams {
  walletId: string;
  amount: number;
  adminId: string;
  reason?: string;
}

export async function scheduleAutomaticPayouts(
  params: SchedulePayoutParams
): Promise<SchedulePayoutResult> {
  const { ownerType, countryCode, minAmount = 10, periodStart, periodEnd, adminId } = params;

  // Find all wallets that meet the criteria
  const walletFilters: any = {
    availableBalance: {
      gte: new Decimal(minAmount),
    },
  };

  if (ownerType) {
    walletFilters.ownerType = ownerType;
  }

  if (countryCode) {
    walletFilters.countryCode = countryCode;
  }

  const eligibleWallets = await prisma.wallet.findMany({
    where: walletFilters,
    include: {
      payouts: {
        where: {
          status: "pending",
        },
      },
    },
  });

  // Filter out wallets that already have pending payouts
  const walletsNeedingPayout = eligibleWallets.filter(
    (wallet) => wallet.payouts.length === 0
  );

  if (walletsNeedingPayout.length === 0) {
    throw new Error("No eligible wallets found for payout");
  }

  // Create a payout batch
  const batch = await prisma.payoutBatch.create({
    data: {
      batchType: ownerType || null,
      periodStart,
      periodEnd,
      totalPayoutCount: walletsNeedingPayout.length,
      totalPayoutAmount: walletsNeedingPayout.reduce(
        (sum, w) => sum.add(w.availableBalance),
        new Decimal(0)
      ),
      status: "created",
      createdByAdminId: adminId,
    },
  });

  // Create individual payouts
  const payoutPromises = walletsNeedingPayout.map((wallet) =>
    prisma.payout.create({
      data: {
        walletId: wallet.id,
        countryCode: wallet.countryCode,
        ownerType: wallet.ownerType,
        ownerId: wallet.ownerId,
        amount: wallet.availableBalance,
        method: PayoutMethod.auto_weekly,
        status: "pending",
        scheduledAt: new Date(),
        batchId: batch.id,
        createdByAdminId: adminId,
      },
    })
  );

  const createdPayouts = await Promise.all(payoutPromises);

  return {
    batchId: batch.id,
    totalPayouts: createdPayouts.length,
    totalAmount: batch.totalPayoutAmount.toString(),
    payoutIds: createdPayouts.map((p) => p.id),
  };
}

export async function runManualPayout(
  params: ManualPayoutParams
): Promise<{ payoutId: string; amount: string }> {
  const { walletId, amount, adminId, reason } = params;

  // Validate wallet exists and has sufficient balance
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const requestedAmount = new Decimal(amount);

  if (wallet.availableBalance.lt(requestedAmount)) {
    throw new Error(
      `Insufficient balance. Available: ${wallet.availableBalance}, Requested: ${requestedAmount}`
    );
  }

  // Check for existing pending payouts
  const pendingPayout = await prisma.payout.findFirst({
    where: {
      walletId,
      status: "pending",
    },
  });

  if (pendingPayout) {
    throw new Error("Wallet already has a pending payout");
  }

  // Create manual payout
  const payout = await prisma.payout.create({
    data: {
      walletId: wallet.id,
      countryCode: wallet.countryCode,
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      amount: requestedAmount,
      method: PayoutMethod.manual_admin_settlement,
      status: "pending",
      scheduledAt: new Date(),
      createdByAdminId: adminId,
      failureReason: reason || null,
    },
  });

  return {
    payoutId: payout.id,
    amount: payout.amount.toString(),
  };
}

export async function getScheduledPayouts(filters?: {
  status?: string;
  ownerType?: WalletOwnerType;
  countryCode?: string;
  batchId?: string;
}) {
  const where: any = {};

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }

  if (filters?.ownerType && filters.ownerType !== "all") {
    where.ownerType = filters.ownerType;
  }

  if (filters?.countryCode && filters.countryCode !== "all") {
    where.countryCode = filters.countryCode;
  }

  if (filters?.batchId) {
    where.batchId = filters.batchId;
  }

  const payouts = await prisma.payout.findMany({
    where,
    include: {
      wallet: true,
      batch: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return payouts;
}

export async function getPayoutBatches(filters?: {
  status?: string;
  ownerType?: WalletOwnerType;
}) {
  const where: any = {};

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }

  if (filters?.ownerType) {
    where.batchType = filters.ownerType;
  }

  const batches = await prisma.payoutBatch.findMany({
    where,
    include: {
      payouts: {
        include: {
          wallet: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return batches;
}
