import { Prisma, PayoutStatus, PayoutMethod, WalletOwnerType } from "@prisma/client";
import { prisma } from "../db";
import { WalletService } from "./walletService";

export interface CreatePayoutParams {
  walletId: string;
  ownerId: string;
  ownerType: WalletOwnerType;
  amount: number;
  method: PayoutMethod;
  countryCode: string;
  payoutAccountId?: string;
  scheduledAt?: Date;
  createdByAdminId?: string;
}

export interface PayoutFilters {
  ownerId?: string;
  ownerType?: WalletOwnerType;
  status?: PayoutStatus;
  method?: PayoutMethod;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class PayoutService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  /**
   * Create a payout request
   */
  async createPayout(params: CreatePayoutParams) {
    const {
      walletId,
      ownerId,
      ownerType,
      amount,
      method,
      countryCode,
      payoutAccountId,
      scheduledAt,
      createdByAdminId,
    } = params;

    // Validate wallet and balance
    const wallet = await this.walletService.getWalletById(walletId);
    
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.ownerId !== ownerId || wallet.ownerType !== ownerType) {
      throw new Error("Wallet ownership mismatch");
    }

    // Check for negative balance (commission debt)
    const negativeBalance = parseFloat(wallet.negativeBalance.toString());
    if (negativeBalance > 0) {
      throw new Error(
        `Cannot request payout while commission debt exists. Outstanding: ${wallet.currency} ${negativeBalance.toFixed(2)}`
      );
    }

    // Validate sufficient balance
    const availableBalance = parseFloat(wallet.availableBalance.toString());
    if (availableBalance < amount) {
      throw new Error(
        `Insufficient balance. Available: ${wallet.currency} ${availableBalance.toFixed(2)}, Requested: ${wallet.currency} ${amount.toFixed(2)}`
      );
    }

    // Validate minimum payout amount based on country
    const minAmount = this.getMinimumPayoutAmount(countryCode);
    if (amount < minAmount) {
      throw new Error(
        `Minimum payout amount is ${wallet.currency} ${minAmount.toFixed(2)}`
      );
    }

    // Validate payout account if provided
    if (payoutAccountId) {
      const account = await prisma.payoutAccount.findUnique({
        where: { id: payoutAccountId },
      });

      if (!account || account.ownerId !== ownerId) {
        throw new Error("Payout account not found or access denied");
      }

      if (account.status !== "active") {
        throw new Error("Payout account must be active before use");
      }
    }

    // Create payout in transaction
    return await prisma.$transaction(async (tx) => {
      // Double-check balance hasn't changed
      const currentWallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });

      if (!currentWallet) {
        throw new Error("Wallet not found");
      }

      const currentAvailable = parseFloat(currentWallet.availableBalance.toString());
      if (currentAvailable < amount) {
        throw new Error("Insufficient funds - concurrent payout detected");
      }

      // Deduct from available balance
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          availableBalance: {
            decrement: new Prisma.Decimal(amount),
          },
        },
      });

      // Create payout record
      const payout = await tx.payout.create({
        data: {
          walletId,
          ownerId,
          ownerType,
          amount: new Prisma.Decimal(amount),
          method,
          status: scheduledAt ? "pending" : "processing",
          countryCode,
          scheduledAt,
          createdByAdminId,
        },
      });

      // Record transaction
      await tx.walletTransaction.create({
        data: {
          walletId,
          ownerType,
          countryCode,
          serviceType: "payout",
          direction: "debit",
          amount: new Prisma.Decimal(amount),
          referenceType: "payout",
          referenceId: payout.id,
          description: `Payout ${method === "auto_weekly" ? "(weekly)" : ""} - ${payout.id}`,
          balanceSnapshot: new Prisma.Decimal(currentAvailable).minus(amount),
          negativeBalanceSnapshot: currentWallet.negativeBalance,
          createdByAdminId,
        },
      });

      return payout;
    });
  }

  /**
   * Get payout history for an owner
   */
  async getPayoutHistory(filters: PayoutFilters) {
    const {
      ownerId,
      ownerType,
      status,
      method,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    const where: Prisma.PayoutWhereInput = {};

    if (ownerId) where.ownerId = ownerId;
    if (ownerType) where.ownerType = ownerType;
    if (status) where.status = status;
    if (method) where.method = method;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          wallet: {
            select: {
              currency: true,
              ownerId: true,
              ownerType: true,
            },
          },
        },
      }),
      prisma.payout.count({ where }),
    ]);

    return {
      payouts,
      total,
      limit,
      offset,
      hasMore: offset + payouts.length < total,
    };
  }

  /**
   * Get pending payouts for automatic processing
   */
  async getPendingAutomaticPayouts() {
    return await prisma.payout.findMany({
      where: {
        method: "auto_weekly",
        status: "pending",
        scheduledAt: {
          lte: new Date(),
        },
      },
      include: {
        wallet: true,
      },
    });
  }

  /**
   * Process a payout (mark as completed)
   */
  async processPayout(payoutId: string, externalReferenceId?: string) {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new Error("Payout not found");
    }

    if (payout.status === "completed") {
      throw new Error("Payout already completed");
    }

    return await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: "completed",
        processedAt: new Date(),
        externalReferenceId,
      },
    });
  }

  /**
   * Fail a payout (return funds to wallet)
   */
  async failPayout(payoutId: string, failureReason: string) {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: { wallet: true },
    });

    if (!payout) {
      throw new Error("Payout not found");
    }

    if (payout.status === "completed") {
      throw new Error("Cannot fail a completed payout");
    }

    return await prisma.$transaction(async (tx) => {
      // Return funds to wallet
      await tx.wallet.update({
        where: { id: payout.walletId },
        data: {
          availableBalance: {
            increment: payout.amount,
          },
        },
      });

      // Update payout status
      const updatedPayout = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: "failed",
          failureReason,
        },
      });

      // Record refund transaction
      await tx.walletTransaction.create({
        data: {
          walletId: payout.walletId,
          ownerType: payout.ownerType,
          countryCode: payout.countryCode,
          serviceType: "payout",
          direction: "credit",
          amount: payout.amount,
          referenceType: "payout",
          referenceId: payout.id,
          description: `Payout failed refund - ${payout.id}`,
          balanceSnapshot: payout.wallet.availableBalance,
          negativeBalanceSnapshot: payout.wallet.negativeBalance,
        },
      });

      return updatedPayout;
    });
  }

  /**
   * Schedule automatic weekly payouts for all eligible wallets
   */
  async scheduleWeeklyPayouts() {
    const now = new Date();
    const nextSunday = this.getNextSunday();

    // Find all wallets with sufficient balance
    const eligibleWallets = await prisma.wallet.findMany({
      where: {
        availableBalance: {
          gte: new Prisma.Decimal(10), // Minimum threshold
        },
        negativeBalance: {
          equals: new Prisma.Decimal(0),
        },
      },
    });

    const scheduled: any[] = [];

    for (const wallet of eligibleWallets) {
      try {
        // Check if there's already a scheduled payout for this week
        const existingScheduled = await prisma.payout.findFirst({
          where: {
            walletId: wallet.id,
            method: "auto_weekly",
            status: "pending",
            scheduledAt: {
              gte: now,
              lte: nextSunday,
            },
          },
        });

        if (existingScheduled) {
          continue; // Skip if already scheduled
        }

        // Get minimum payout amount for country
        const minAmount = this.getMinimumPayoutAmount(wallet.countryCode);
        const availableBalance = parseFloat(wallet.availableBalance.toString());

        if (availableBalance >= minAmount) {
          const payout = await this.createPayout({
            walletId: wallet.id,
            ownerId: wallet.ownerId,
            ownerType: wallet.ownerType,
            amount: availableBalance,
            method: "auto_weekly",
            countryCode: wallet.countryCode,
            scheduledAt: nextSunday,
          });

          scheduled.push(payout);
        }
      } catch (error) {
        console.error(`Failed to schedule payout for wallet ${wallet.id}:`, error);
      }
    }

    return {
      scheduled: scheduled.length,
      nextScheduledDate: nextSunday,
    };
  }

  /**
   * Get minimum payout amount based on country
   */
  private getMinimumPayoutAmount(countryCode: string): number {
    const minimums: Record<string, number> = {
      BD: 100, // 100 BDT
      US: 10, // $10 USD
    };

    return minimums[countryCode] || 10;
  }

  /**
   * Get next Sunday at 00:00:00
   */
  private getNextSunday(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);

    return nextSunday;
  }

  /**
   * List payout accounts for an owner
   */
  async listPayoutAccounts(ownerType: "driver" | "restaurant" | "shop_partner", ownerId: string) {
    const accounts = await prisma.payoutAccount.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });

    return accounts;
  }

  /**
   * Get payout statistics for an owner
   */
  async getPayoutStats(ownerId: string, ownerType: WalletOwnerType) {
    const [totalPayouts, completedPayouts, pendingPayouts, totalAmount] = await Promise.all([
      prisma.payout.count({
        where: { ownerId, ownerType },
      }),
      prisma.payout.count({
        where: { ownerId, ownerType, status: "completed" },
      }),
      prisma.payout.count({
        where: { ownerId, ownerType, status: "pending" },
      }),
      prisma.payout.aggregate({
        where: { ownerId, ownerType, status: "completed" },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalPayouts,
      completedPayouts,
      pendingPayouts,
      totalAmount: totalAmount._sum.amount || new Prisma.Decimal(0),
    };
  }

  /**
   * Admin method: Update payout status
   */
  async updateWalletPayoutStatus(params: {
    payoutId: string;
    status: PayoutStatus;
    failureReason?: string;
    externalReferenceId?: string;
    processedByAdminId: string;
  }) {
    const { payoutId, status, failureReason, externalReferenceId, processedByAdminId } = params;

    return await prisma.$transaction(async (tx) => {
      // Get current payout
      const currentPayout = await tx.payout.findUnique({
        where: { id: payoutId },
        include: { payoutAccount: true },
      });

      if (!currentPayout) {
        throw new Error("Payout not found");
      }

      // If marking as failed, refund the amount back to wallet
      if (status === "failed" && currentPayout.status === "pending") {
        await tx.wallet.update({
          where: { id: currentPayout.walletId },
          data: {
            availableBalance: {
              increment: currentPayout.amount,
            },
          },
        });

        // Create refund transaction record
        await tx.walletTransaction.create({
          data: {
            walletId: currentPayout.walletId,
            transactionType: "payout_refund",
            serviceType: "payout",
            direction: "credit",
            amount: currentPayout.amount,
            referenceType: "payout",
            referenceId: payoutId,
            description: `Payout failed - refunded to wallet: ${failureReason || "Unknown reason"}`,
            balanceSnapshot: new Prisma.Decimal(0), // Will be updated by trigger
            negativeBalanceSnapshot: new Prisma.Decimal(0),
            createdByAdminId: processedByAdminId,
          },
        });
      }

      // Update payout status
      const payout = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status,
          failureReason,
          externalReferenceId,
          processedAt: status === "completed" || status === "failed" ? new Date() : undefined,
        },
        include: {
          payoutAccount: true,
        },
      });

      return payout;
    });
  }

  /**
   * Admin method: Create payout batch
   */
  async createPayoutBatch(params: {
    periodStart: Date;
    periodEnd: Date;
    ownerType?: WalletOwnerType;
    countryCode?: string;
    minPayoutAmount?: number;
    createdByAdminId: string;
  }) {
    const { periodStart, periodEnd, ownerType, countryCode, minPayoutAmount, createdByAdminId } = params;

    const batch = await prisma.payoutBatch.create({
      data: {
        batchNumber: `BATCH-${Date.now()}`,
        periodStart,
        periodEnd,
        ownerType,
        countryCode,
        totalAmount: new Prisma.Decimal(0),
        totalCount: 0,
        status: "pending",
      },
    });

    return { batch, payoutsCreated: 0 };
  }

  /**
   * Admin method: List payout batches
   */
  async listPayoutBatches(filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [batches, total] = await Promise.all([
      prisma.payoutBatch.findMany({
        where,
        include: {
          _count: {
            select: {
              payouts: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
      prisma.payoutBatch.count({ where }),
    ]);

    return { batches, total, limit: filters?.limit || 20, offset: filters?.offset || 0 };
  }

  /**
   * Admin method: Get payout batch
   */
  async getPayoutBatch(id: string) {
    const batch = await prisma.payoutBatch.findUnique({
      where: { id },
      include: {
        payouts: {
          include: {
            payoutAccount: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            payouts: true,
          },
        },
      },
    });

    return batch;
  }

  /**
   * Admin method: Process payout batch
   */
  async processPayoutBatch(id: string, adminId: string) {
    const batch = await prisma.payoutBatch.findUnique({
      where: { id },
      include: {
        payouts: true,
      },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    if (batch.status !== "pending") {
      throw new Error("Batch already processed");
    }

    await prisma.payoutBatch.update({
      where: { id },
      data: {
        status: "processing",
        processedAt: new Date(),
      },
    });

    return { batch, processedCount: batch.payouts.length };
  }

  /**
   * Update payout account details
   */
  async updatePayoutAccount(id: string, data: any) {
    return prisma.payoutAccount.update({
      where: { id },
      data,
    });
  }

  /**
   * Set default payout account for driver/restaurant
   */
  async setDefaultPayoutAccount(type: "driver" | "restaurant", ownerId: string, accountId: string) {
    // Unset all other defaults for this owner
    await prisma.payoutAccount.updateMany({
      where: type === "driver" ? { driverId: ownerId } : { restaurantId: ownerId },
      data: { isDefault: false },
    });

    // Set the new default
    return prisma.payoutAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });
  }
}

export const payoutService = new PayoutService();

// Backwards compatibility - alias for existing code
export const walletPayoutService = payoutService;
