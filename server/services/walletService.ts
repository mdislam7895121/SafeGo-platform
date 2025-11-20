import { PrismaClient, Prisma } from "@prisma/client";
import type {
  WalletOwnerType,
  WalletTransactionServiceType,
  WalletTransactionDirection,
  WalletTransactionReferenceType,
} from "@prisma/client";

const prisma = new PrismaClient();

export interface CreateWalletParams {
  ownerId: string;
  ownerType: WalletOwnerType;
  countryCode: string;
  currency: string;
}

export interface RecordTransactionParams {
  walletId: string;
  ownerType: WalletOwnerType;
  countryCode: string;
  serviceType: WalletTransactionServiceType;
  direction: WalletTransactionDirection;
  amount: number;
  referenceType: WalletTransactionReferenceType;
  referenceId?: string;
  description: string;
  createdByAdminId?: string;
}

export interface WalletBalanceUpdate {
  availableBalanceChange?: number;
  negativeBalanceChange?: number;
}

export class WalletService {
  async getOrCreateWallet(params: CreateWalletParams) {
    const { ownerId, ownerType, countryCode, currency } = params;

    let wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId,
          ownerType,
        },
      },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          ownerId,
          ownerType,
          countryCode,
          currency,
          availableBalance: new Prisma.Decimal(0),
          negativeBalance: new Prisma.Decimal(0),
        },
      });
    }

    return wallet;
  }

  async getWallet(ownerId: string, ownerType: WalletOwnerType) {
    return prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId,
          ownerType,
        },
      },
    });
  }

  async getWalletById(walletId: string) {
    return prisma.wallet.findUnique({
      where: { id: walletId },
    });
  }

  async recordTransaction(params: RecordTransactionParams): Promise<void> {
    const {
      walletId,
      ownerType,
      countryCode,
      serviceType,
      direction,
      amount,
      referenceType,
      referenceId,
      description,
      createdByAdminId,
    } = params;

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      let newAvailableBalance = new Prisma.Decimal(wallet.availableBalance.toString());
      let newNegativeBalance = new Prisma.Decimal(wallet.negativeBalance.toString());

      if (direction === "credit") {
        if (serviceType === "commission_refund") {
          const currentNegativeBalance = parseFloat(newNegativeBalance.toString());
          const refundAmount = parseFloat(amount.toString());
          
          if (currentNegativeBalance > 0) {
            const amountToReduceDebt = Math.min(currentNegativeBalance, refundAmount);
            const excessAmount = refundAmount - amountToReduceDebt;
            
            newNegativeBalance = newNegativeBalance.minus(amountToReduceDebt);
            
            if (excessAmount > 0) {
              newAvailableBalance = newAvailableBalance.plus(excessAmount);
            }
          } else {
            newAvailableBalance = newAvailableBalance.plus(refundAmount);
          }
        } else {
          newAvailableBalance = newAvailableBalance.plus(amount);
        }
      } else if (direction === "debit") {
        if (serviceType === "commission") {
          newNegativeBalance = newNegativeBalance.plus(amount);
        } else if (serviceType === "commission_settlement") {
          const currentNegativeBalance = parseFloat(newNegativeBalance.toString());
          const settlementAmount = parseFloat(amount.toString());
          
          if (settlementAmount > currentNegativeBalance) {
            throw new Error(
              `Cannot settle ${settlementAmount} - outstanding debt is only ${currentNegativeBalance}`
            );
          }
          
          newNegativeBalance = newNegativeBalance.minus(amount);
        } else {
          newAvailableBalance = newAvailableBalance.minus(amount);
        }
      }

      await tx.wallet.update({
        where: { id: walletId },
        data: {
          availableBalance: newAvailableBalance,
          negativeBalance: newNegativeBalance,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId,
          ownerType,
          countryCode,
          serviceType,
          direction,
          amount: new Prisma.Decimal(amount),
          balanceSnapshot: newAvailableBalance,
          negativeBalanceSnapshot: newNegativeBalance,
          referenceType,
          referenceId,
          description,
          createdByAdminId,
        },
      });
    });
  }

  async recordEarning(
    ownerId: string,
    ownerType: WalletOwnerType,
    countryCode: string,
    serviceType: WalletTransactionServiceType,
    amount: number,
    referenceType: WalletTransactionReferenceType,
    referenceId: string,
    description: string
  ): Promise<void> {
    const currency = countryCode === "BD" ? "BDT" : "USD";
    const wallet = await this.getOrCreateWallet({
      ownerId,
      ownerType,
      countryCode,
      currency,
    });

    await this.recordTransaction({
      walletId: wallet.id,
      ownerType,
      countryCode,
      serviceType,
      direction: "credit",
      amount,
      referenceType,
      referenceId,
      description,
    });
  }

  async recordCommission(
    ownerId: string,
    ownerType: WalletOwnerType,
    countryCode: string,
    serviceType: WalletTransactionServiceType,
    amount: number,
    referenceType: WalletTransactionReferenceType,
    referenceId: string,
    description: string
  ): Promise<void> {
    const currency = countryCode === "BD" ? "BDT" : "USD";
    const wallet = await this.getOrCreateWallet({
      ownerId,
      ownerType,
      countryCode,
      currency,
    });

    await this.recordTransaction({
      walletId: wallet.id,
      ownerType,
      countryCode,
      serviceType: "commission",
      direction: "debit",
      amount,
      referenceType,
      referenceId,
      description,
    });
  }

  async settleNegativeBalance(walletId: string, adminId?: string): Promise<{
    settled: boolean;
    amountSettled: number;
    remainingNegativeBalance: number;
  }> {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      const availableBalance = parseFloat(wallet.availableBalance.toString());
      const negativeBalance = parseFloat(wallet.negativeBalance.toString());

      if (negativeBalance <= 0) {
        return {
          settled: true,
          amountSettled: 0,
          remainingNegativeBalance: 0,
        };
      }

      const settlementAmount = Math.min(availableBalance, negativeBalance);

      if (settlementAmount > 0) {
        const newAvailableBalance = new Prisma.Decimal(availableBalance - settlementAmount);
        const newNegativeBalance = new Prisma.Decimal(negativeBalance - settlementAmount);

        await tx.wallet.update({
          where: { id: walletId },
          data: {
            availableBalance: newAvailableBalance,
            negativeBalance: newNegativeBalance,
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId,
            ownerType: wallet.ownerType,
            countryCode: wallet.countryCode,
            serviceType: "commission_settlement",
            direction: "debit",
            amount: new Prisma.Decimal(settlementAmount),
            balanceSnapshot: newAvailableBalance,
            negativeBalanceSnapshot: newNegativeBalance,
            referenceType: "auto_settlement",
            description: `Auto-settlement of commission debt: ${settlementAmount.toFixed(2)} ${wallet.currency}`,
            createdByAdminId: adminId,
          },
        });

        return {
          settled: newNegativeBalance.equals(0),
          amountSettled: settlementAmount,
          remainingNegativeBalance: parseFloat(newNegativeBalance.toString()),
        };
      }

      return {
        settled: false,
        amountSettled: 0,
        remainingNegativeBalance: negativeBalance,
      };
    });
  }

  async getWalletTransactions(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return prisma.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async getTransactionCount(walletId: string): Promise<number> {
    return prisma.walletTransaction.count({
      where: { walletId },
    });
  }

  async listWallets(filters?: {
    ownerType?: WalletOwnerType;
    countryCode?: string;
    minAvailableBalance?: number;
    maxAvailableBalance?: number;
    minNegativeBalance?: number;
    maxNegativeBalance?: number;
  }) {
    const where: Prisma.WalletWhereInput = {};

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.minAvailableBalance !== undefined || filters?.maxAvailableBalance !== undefined) {
      where.availableBalance = {};
      if (filters.minAvailableBalance !== undefined) {
        where.availableBalance.gte = new Prisma.Decimal(filters.minAvailableBalance);
      }
      if (filters.maxAvailableBalance !== undefined) {
        where.availableBalance.lte = new Prisma.Decimal(filters.maxAvailableBalance);
      }
    }

    if (filters?.minNegativeBalance !== undefined || filters?.maxNegativeBalance !== undefined) {
      where.negativeBalance = {};
      if (filters.minNegativeBalance !== undefined) {
        where.negativeBalance.gte = new Prisma.Decimal(filters.minNegativeBalance);
      }
      if (filters.maxNegativeBalance !== undefined) {
        where.negativeBalance.lte = new Prisma.Decimal(filters.maxNegativeBalance);
      }
    }

    return prisma.wallet.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getCommissionAnalytics(filters?: {
    startDate?: Date;
    endDate?: Date;
    countryCode?: string;
    serviceType?: WalletTransactionServiceType;
  }) {
    const where: Prisma.WalletTransactionWhereInput = {
      serviceType: "commission",
    };

    if (filters?.startDate) {
      where.createdAt = { ...where.createdAt, gte: filters.startDate };
    }

    if (filters?.endDate) {
      where.createdAt = { ...where.createdAt, lte: filters.endDate };
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.serviceType && filters.serviceType !== "commission") {
      where.serviceType = filters.serviceType;
    }

    const transactions = await prisma.walletTransaction.findMany({
      where,
      select: {
        amount: true,
        countryCode: true,
        serviceType: true,
        ownerType: true,
      },
    });

    const byCountry: Record<string, number> = {};
    const byServiceType: Record<string, number> = {};
    const byOwnerType: Record<string, number> = {};
    let total = 0;

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount.toString());
      total += amount;

      byCountry[tx.countryCode] = (byCountry[tx.countryCode] || 0) + amount;
      byServiceType[tx.serviceType] = (byServiceType[tx.serviceType] || 0) + amount;
      byOwnerType[tx.ownerType] = (byOwnerType[tx.ownerType] || 0) + amount;
    });

    return {
      total,
      byCountry,
      byServiceType,
      byOwnerType,
      transactionCount: transactions.length,
    };
  }
}

export const walletService = new WalletService();
