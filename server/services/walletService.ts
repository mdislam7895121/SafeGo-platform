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
      serviceType,  // CRITICAL: Preserve passed serviceType (ride, parcel_delivery, food_order)
      direction: "debit",
      amount,
      referenceType,
      referenceId,
      description,
    });
  }

  // Service-specific earning recording methods
  async recordRideEarning(
    driverId: string,
    ride: {
      id: string;
      serviceFare: any;
      driverPayout: any;
      safegoCommission: any;
      paymentMethod: "cash" | "online";
      pickupAddress: string;
      dropoffAddress: string;
    }
  ): Promise<void> {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    const countryCode = driver.user.countryCode;
    
    if (!ride.safegoCommission || !ride.driverPayout) {
      throw new Error(`Missing commission or payout amounts for ride ${ride.id}`);
    }

    const commissionAmount = Number(ride.safegoCommission.toString());
    const payoutAmount = Number(ride.driverPayout.toString());

    if (isNaN(commissionAmount) || commissionAmount < 0) {
      throw new Error(`Invalid commission amount: ${ride.safegoCommission}`);
    }

    if (isNaN(payoutAmount) || payoutAmount < 0) {
      throw new Error(`Invalid payout amount: ${ride.driverPayout}`);
    }

    if (ride.paymentMethod === "cash") {
      // Cash: Driver collects full cash, SafeGo commission becomes negative balance
      await this.recordCommission(
        driverId,
        "driver",
        countryCode,
        "ride",
        commissionAmount,
        "ride",
        ride.id,
        `Commission owed for cash ride: ${ride.pickupAddress} → ${ride.dropoffAddress}`
      );
    } else {
      // Online: SafeGo pays driver their payout
      await this.recordEarning(
        driverId,
        "driver",
        countryCode,
        "ride",
        payoutAmount,
        "ride",
        ride.id,
        `Ride payout: ${ride.pickupAddress} → ${ride.dropoffAddress}`
      );
    }
  }

  async recordFoodOrderEarning(
    restaurantId: string,
    order: {
      id: string;
      serviceFare: any;
      restaurantPayout: any;
      safegoCommission: any;
      paymentMethod: "cash" | "online";
      deliveryAddress: string;
    }
  ): Promise<void> {
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: restaurantId },
      include: { user: true },
    });

    if (!restaurant) {
      throw new Error(`Restaurant ${restaurantId} not found`);
    }

    const countryCode = restaurant.user.countryCode;
    
    if (!order.safegoCommission || !order.restaurantPayout) {
      throw new Error(`Missing commission or payout amounts for order ${order.id}`);
    }

    const commissionAmount = Number(order.safegoCommission.toString());
    const payoutAmount = Number(order.restaurantPayout.toString());

    if (isNaN(commissionAmount) || commissionAmount < 0) {
      throw new Error(`Invalid commission amount: ${order.safegoCommission}`);
    }

    if (isNaN(payoutAmount) || payoutAmount < 0) {
      throw new Error(`Invalid payout amount: ${order.restaurantPayout}`);
    }

    if (order.paymentMethod === "cash") {
      // Cash: Restaurant collects full cash, SafeGo commission becomes negative balance
      await this.recordCommission(
        restaurantId,
        "restaurant",
        countryCode,
        "food_order",
        commissionAmount,
        "food_order",
        order.id,
        `Commission owed for cash food order → ${order.deliveryAddress}`
      );
    } else {
      // Online: SafeGo pays restaurant their payout
      await this.recordEarning(
        restaurantId,
        "restaurant",
        countryCode,
        "food_order",
        payoutAmount,
        "food_order",
        order.id,
        `Food order payout → ${order.deliveryAddress}`
      );
    }
  }

  async recordFoodDeliveryEarning(
    driverId: string,
    delivery: {
      id: string;
      deliveryPayout: any;
      paymentMethod: "cash" | "online";
      deliveryAddress: string;
    }
  ): Promise<void> {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    const countryCode = driver.user.countryCode;

    if (delivery.paymentMethod === "online") {
      // Online: SafeGo pays driver their delivery fee
      if (!delivery.deliveryPayout) {
        throw new Error(`Missing delivery payout amount for order ${delivery.id}`);
      }

      const deliveryPayoutAmount = Number(delivery.deliveryPayout.toString());

      if (isNaN(deliveryPayoutAmount) || deliveryPayoutAmount < 0) {
        throw new Error(`Invalid delivery payout amount: ${delivery.deliveryPayout}`);
      }

      await this.recordEarning(
        driverId,
        "driver",
        countryCode,
        "food_delivery",
        deliveryPayoutAmount,
        "food_order",
        delivery.id,
        `Food delivery payout → ${delivery.deliveryAddress}`
      );
    }
    // Cash: Driver collects delivery fee directly, no wallet transaction needed
  }

  async recordParcelDeliveryEarning(
    driverId: string,
    parcel: {
      id: string;
      serviceFare: any;
      driverPayout: any;
      safegoCommission: any;
      paymentMethod: "cash" | "online";
      pickupAddress: string;
      dropoffAddress: string;
    }
  ): Promise<void> {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    const countryCode = driver.user.countryCode;
    
    if (!parcel.safegoCommission || !parcel.driverPayout) {
      throw new Error(`Missing commission or payout amounts for parcel ${parcel.id}`);
    }

    const commissionAmount = Number(parcel.safegoCommission.toString());
    const payoutAmount = Number(parcel.driverPayout.toString());

    if (isNaN(commissionAmount) || commissionAmount < 0) {
      throw new Error(`Invalid commission amount: ${parcel.safegoCommission}`);
    }

    if (isNaN(payoutAmount) || payoutAmount < 0) {
      throw new Error(`Invalid payout amount: ${parcel.driverPayout}`);
    }

    if (parcel.paymentMethod === "cash") {
      // Cash: Driver collects full cash, SafeGo commission becomes negative balance
      await this.recordCommission(
        driverId,
        "driver",
        countryCode,
        "parcel_delivery",
        commissionAmount,
        "delivery",
        parcel.id,
        `Commission owed for cash parcel: ${parcel.pickupAddress} → ${parcel.dropoffAddress}`
      );
    } else {
      // Online: SafeGo pays driver their payout
      await this.recordEarning(
        driverId,
        "driver",
        countryCode,
        "parcel_delivery",
        payoutAmount,
        "delivery",
        parcel.id,
        `Parcel delivery payout: ${parcel.pickupAddress} → ${parcel.dropoffAddress}`
      );
    }
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

  async getTransactionCount(filters?: {
    walletId?: string;
    ownerType?: WalletOwnerType;
    countryCode?: string;
    serviceType?: WalletTransactionServiceType;
    direction?: WalletTransactionDirection;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const where: Prisma.WalletTransactionWhereInput = {};

    if (filters?.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.serviceType) {
      where.serviceType = filters.serviceType;
    }

    if (filters?.direction) {
      where.direction = filters.direction;
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

    return prisma.walletTransaction.count({ where });
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

  async getWalletCount(filters?: {
    ownerType?: WalletOwnerType;
    countryCode?: string;
    minAvailableBalance?: number;
    maxAvailableBalance?: number;
    minNegativeBalance?: number;
    maxNegativeBalance?: number;
    search?: string;
  }): Promise<number> {
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

    return prisma.wallet.count({ where });
  }

  async listTransactions(filters?: {
    walletId?: string;
    ownerType?: WalletOwnerType;
    countryCode?: string;
    serviceType?: WalletTransactionServiceType;
    direction?: WalletTransactionDirection;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.WalletTransactionWhereInput = {};

    if (filters?.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.serviceType) {
      where.serviceType = filters.serviceType;
    }

    if (filters?.direction) {
      where.direction = filters.direction;
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

    return prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });
  }

  async getCommissionAnalytics(filters?: {
    startDate?: Date;
    endDate?: Date;
    countryCode?: string;
    ownerType?: WalletOwnerType;
    groupBy?: "day" | "week" | "month";
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

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    const transactions = await prisma.walletTransaction.findMany({
      where,
      select: {
        amount: true,
        countryCode: true,
        serviceType: true,
        ownerType: true,
        createdAt: true,
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

  async getEarningsSummary(filters?: {
    countryCode?: string;
    ownerType?: WalletOwnerType;
  }) {
    const where: Prisma.WalletTransactionWhereInput = {
      direction: "credit",
    };

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    const transactions = await prisma.walletTransaction.findMany({
      where,
      select: {
        amount: true,
        serviceType: true,
        countryCode: true,
        ownerType: true,
      },
    });

    let totalEarnings = 0;
    const earningsByService: Record<string, number> = {};
    const earningsByCountry: Record<string, number> = {};
    const earningsByOwnerType: Record<string, number> = {};

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount.toString());
      totalEarnings += amount;

      earningsByService[tx.serviceType] = (earningsByService[tx.serviceType] || 0) + amount;
      earningsByCountry[tx.countryCode] = (earningsByCountry[tx.countryCode] || 0) + amount;
      earningsByOwnerType[tx.ownerType] = (earningsByOwnerType[tx.ownerType] || 0) + amount;
    });

    const walletAggregates = await prisma.wallet.aggregate({
      where: {
        countryCode: filters?.countryCode,
        ownerType: filters?.ownerType,
      },
      _sum: {
        availableBalance: true,
        negativeBalance: true,
      },
      _count: true,
    });

    return {
      totalEarnings,
      earningsByService,
      earningsByCountry,
      earningsByOwnerType,
      totalAvailableBalance: parseFloat(walletAggregates._sum.availableBalance?.toString() || "0"),
      totalNegativeBalance: parseFloat(walletAggregates._sum.negativeBalance?.toString() || "0"),
      walletCount: walletAggregates._count,
    };
  }
}

export const walletService = new WalletService();
