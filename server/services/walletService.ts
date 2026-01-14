import { Prisma } from "@prisma/client";
import type {
  WalletOwnerType,
  WalletTransactionServiceType,
  WalletTransactionDirection,
  WalletTransactionReferenceType,
} from "@prisma/client";
import { prisma } from "../db";

export type TransactionClient = any;

export interface CreateWalletParams {
  ownerId: string;
  ownerType: WalletOwnerType;
  countryCode: string;
  currency: string;
  tx?: TransactionClient;
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
  tx?: TransactionClient;
}

export interface WalletBalanceUpdate {
  availableBalanceChange?: number;
  negativeBalanceChange?: number;
}

export class WalletService {
  async getOrCreateWallet(params: CreateWalletParams) {
    const { ownerId, ownerType, countryCode, currency, tx } = params;
    const db = tx || prisma;

    let wallet = await db.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId,
          ownerType,
        },
      },
    });

    if (!wallet) {
      wallet = await db.wallet.create({
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

  private async executeRecordTransaction(
    params: RecordTransactionParams,
    db: TransactionClient
  ): Promise<void> {
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

    const wallet = await db.wallet.findUnique({
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

    await db.wallet.update({
      where: { id: walletId },
      data: {
        availableBalance: newAvailableBalance,
        negativeBalance: newNegativeBalance,
      },
    });

    await db.walletTransaction.create({
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
  }

  async recordTransaction(params: RecordTransactionParams): Promise<void> {
    if (params.tx) {
      await this.executeRecordTransaction(params, params.tx);
    } else {
      await prisma.$transaction(async (tx) => {
        await this.executeRecordTransaction(params, tx);
      });
    }
  }

  async recordEarning(
    ownerId: string,
    ownerType: WalletOwnerType,
    countryCode: string,
    serviceType: WalletTransactionServiceType,
    amount: number,
    referenceType: WalletTransactionReferenceType,
    referenceId: string,
    description: string,
    tx?: TransactionClient
  ): Promise<void> {
    const currency = countryCode === "BD" ? "BDT" : "USD";
    const wallet = await this.getOrCreateWallet({
      ownerId,
      ownerType,
      countryCode,
      currency,
      tx,
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
      tx,
    });
  }

  /**
   * Record a commission debit against a wallet (increases negative balance).
   * Always uses serviceType "commission" internally to trigger negative balance logic.
   * The service context (ride/food/parcel) is tracked via referenceType parameter.
   */
  async recordCommission(
    ownerId: string,
    ownerType: WalletOwnerType,
    countryCode: string,
    _serviceType: WalletTransactionServiceType, // Kept for API compatibility, but overridden
    amount: number,
    referenceType: WalletTransactionReferenceType,
    referenceId: string,
    description: string,
    tx?: TransactionClient
  ): Promise<void> {
    const currency = countryCode === "BD" ? "BDT" : "USD";
    const wallet = await this.getOrCreateWallet({
      ownerId,
      ownerType,
      countryCode,
      currency,
      tx,
    });

    // Always use "commission" to trigger negative balance logic in recordTransaction
    // The service context is preserved in referenceType (ride, food_order, delivery)
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
      tx,
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
    },
    tx?: TransactionClient
  ): Promise<void> {
    const db = tx || prisma;
    const driver = await db.driverProfile.findUnique({
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
      // Use serviceType "commission" to trigger negative balance logic in recordTransaction
      await this.recordCommission(
        driverId,
        "driver",
        countryCode,
        "commission",
        commissionAmount,
        "ride",
        ride.id,
        `Commission owed for cash ride: ${ride.pickupAddress} → ${ride.dropoffAddress}`,
        tx
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
        `Ride payout: ${ride.pickupAddress} → ${ride.dropoffAddress}`,
        tx
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
    },
    tx?: TransactionClient
  ): Promise<void> {
    const db = tx || prisma;
    const restaurant = await db.restaurantProfile.findUnique({
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
      // Use serviceType "commission" to trigger negative balance logic in recordTransaction
      await this.recordCommission(
        restaurantId,
        "restaurant",
        countryCode,
        "commission",
        commissionAmount,
        "food_order",
        order.id,
        `Commission owed for cash food order → ${order.deliveryAddress}`,
        tx
      );
    } else {
      // Online: SafeGo pays restaurant their payout
      await this.recordEarning(
        restaurantId,
        "restaurant",
        countryCode,
        "food",
        payoutAmount,
        "food_order",
        order.id,
        `Food order payout → ${order.deliveryAddress}`,
        tx
      );
    }
  }

  /**
   * R6: Reverse a food order earning when order is refunded/cancelled
   * Uses amounts from EarningsTransaction to ensure consistency with original posting
   * @param tx Optional Prisma transaction client for atomic operations
   */
  async reverseFoodOrderEarning(
    restaurantId: string,
    orderId: string,
    earningsTransaction: {
      netEarnings: any;
      totalCommission: any;
      currency: string;
      countryCode: string;
    },
    tx?: TransactionClient
  ): Promise<void> {
    // Use transaction client if provided, otherwise use global prisma
    const db = tx || prisma;
    
    // Get the original order to determine payment method
    const order = await db.foodOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found for earnings reversal`);
    }

    // Use currency/country from the earnings transaction to match original posting
    const countryCode = earningsTransaction.countryCode;
    const currency = earningsTransaction.currency;
    const commissionAmount = Number(earningsTransaction.totalCommission.toString());
    const netEarningsAmount = Number(earningsTransaction.netEarnings.toString());

    // Get wallet using the same country/currency as original transaction
    const wallet = await db.wallet.findFirst({
      where: {
        ownerId: restaurantId,
        ownerType: "restaurant",
        countryCode,
      },
    });

    if (!wallet) {
      throw new Error(`Wallet not found for restaurant ${restaurantId} in ${countryCode}`);
    }

    if (order.paymentMethod === "cash") {
      // Cash: Reverse commission that was owed (reduces negative balance)
      // Mirror recordTransaction logic: reduce negativeBalance first, credit excess to availableBalance
      const currentNegativeBalance = parseFloat(wallet.negativeBalance.toString());
      const amountToReduceDebt = Math.min(commissionAmount, currentNegativeBalance);
      const excessAmount = commissionAmount - amountToReduceDebt;
      
      // Atomic update with proper debt reduction + excess crediting
      const updatedWallet = await db.wallet.update({
        where: { id: wallet.id },
        data: { 
          negativeBalance: { decrement: amountToReduceDebt },
          availableBalance: excessAmount > 0 ? { increment: excessAmount } : undefined,
        },
      });
      
      await db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          countryCode,
          serviceType: "commission_refund",
          direction: "credit",
          amount: commissionAmount,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "food_order",
          referenceId: orderId,
          description: `Refund: Commission reversed for cancelled cash order`,
        },
      });
    } else {
      // Online: Reverse payout that was credited to available balance
      // Use netEarnings (what was actually credited) instead of restaurantPayout
      // Atomic update with decrement to avoid race conditions
      const updatedWallet = await db.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: { decrement: netEarningsAmount } },
      });
      
      await db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          countryCode,
          serviceType: "refund",
          direction: "debit",
          amount: netEarningsAmount,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "food_order",
          referenceId: orderId,
          description: `Refund: Payout reversed for cancelled online order`,
        },
      });
    }
  }

  /**
   * Record food delivery earnings for a driver.
   * For online payments: Credits the driver's wallet with their delivery payout.
   * For cash payments: No wallet transaction needed - driver collects cash directly.
   * 
   * NOTE: SafeGo does NOT charge drivers a commission on food delivery courier fees.
   * Commission is only charged to restaurants (via recordFoodOrderEarning).
   * Drivers keep 100% of their delivery fee.
   */
  async recordFoodDeliveryEarning(
    driverId: string,
    delivery: {
      id: string;
      deliveryPayout: any;
      paymentMethod: "cash" | "online";
      deliveryAddress: string;
    },
    tx?: TransactionClient
  ): Promise<void> {
    const db = tx || prisma;
    const driver = await db.driverProfile.findUnique({
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
        "food",
        deliveryPayoutAmount,
        "food_order",
        delivery.id,
        `Food delivery payout → ${delivery.deliveryAddress}`,
        tx
      );
    }
    // Cash: Driver collects delivery fee directly, no wallet transaction needed
    // No commission charged on food delivery courier fees
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
    },
    tx?: TransactionClient
  ): Promise<void> {
    const db = tx || prisma;
    const driver = await db.driverProfile.findUnique({
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
      // Use serviceType "commission" to trigger negative balance logic in recordTransaction
      await this.recordCommission(
        driverId,
        "driver",
        countryCode,
        "commission",
        commissionAmount,
        "delivery",
        parcel.id,
        `Commission owed for cash parcel: ${parcel.pickupAddress} → ${parcel.dropoffAddress}`,
        tx
      );
    } else {
      // Online: SafeGo pays driver their payout
      await this.recordEarning(
        driverId,
        "driver",
        countryCode,
        "parcel",
        payoutAmount,
        "delivery",
        parcel.id,
        `Parcel delivery payout: ${parcel.pickupAddress} → ${parcel.dropoffAddress}`,
        tx
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
    const where: any = {};

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
    const where: any = {};

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
    const where: any = {};

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
    const where: any = {};

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
    const where: any = {
      serviceType: "commission",
    };

    if (filters?.startDate || filters?.endDate) {
      const createdAtFilter: { gte?: Date; lte?: Date } = {};
      if (filters?.startDate) {
        createdAtFilter.gte = filters.startDate;
      }
      if (filters?.endDate) {
        createdAtFilter.lte = filters.endDate;
      }
      where.createdAt = createdAtFilter;
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
    const where: any = {
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

  async listWalletsWithRBAC(adminContext: {
    adminRole: string;
    countryCode?: string;
    cityCode?: string;
    ownerType?: WalletOwnerType;
  }) {
    const { adminRole, countryCode, cityCode, ownerType } = adminContext;

    // Build RBAC filter for user jurisdiction
    // Note: cityCode is on profiles, not User model - only filter by countryCode at User level
    const userFilter: any = {};
    
    if (adminRole === "COUNTRY_ADMIN" && countryCode) {
      userFilter.countryCode = countryCode;
    } else if (adminRole === "CITY_ADMIN" && countryCode) {
      userFilter.countryCode = countryCode;
      // cityCode filtering is done at profile level, not user level
    }
    // SUPER_ADMIN: no filter (sees all)

    // Fetch wallets with proper filters
    const where: any = {};
    if (ownerType) {
      where.ownerType = ownerType;
    }

    const wallets = await prisma.wallet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit for performance
    });

    // Group wallets by owner type for batch fetching
    const driverOwnerIds = wallets.filter(w => w.ownerType === 'driver').map(w => w.ownerId);
    const customerOwnerIds = wallets.filter(w => w.ownerType === 'customer').map(w => w.ownerId);
    const restaurantOwnerIds = wallets.filter(w => w.ownerType === 'restaurant').map(w => w.ownerId);

    // Batch fetch owners with RBAC filtering
    const [driverProfiles, customerProfiles, restaurantProfiles] = await Promise.all([
      // Drivers: ownerId = user.id
      driverOwnerIds.length > 0 ? prisma.user.findMany({
        where: {
          id: { in: driverOwnerIds },
          ...(Object.keys(userFilter).length > 0 ? userFilter : {}),
        },
        include: {
          driverProfile: true,
        },
      }) : [],
      // Customers: ownerId = user.id
      customerOwnerIds.length > 0 ? prisma.user.findMany({
        where: {
          id: { in: customerOwnerIds },
          ...(Object.keys(userFilter).length > 0 ? userFilter : {}),
        },
        include: {
          customerProfile: true,
        },
      }) : [],
      // Restaurants: ownerId = restaurantProfile.id
      restaurantOwnerIds.length > 0 ? prisma.restaurantProfile.findMany({
        where: {
          id: { in: restaurantOwnerIds },
          ...(Object.keys(userFilter).length > 0 ? { user: userFilter } : {}),
        },
        include: {
          user: true,
        },
      }) : [],
    ]);

    // Build owner lookup maps
    const driverMap = new Map(driverProfiles.map(u => [u.id, u]));
    const customerMap = new Map(customerProfiles.map(u => [u.id, u]));
    const restaurantMap = new Map(restaurantProfiles.map(r => [r.id, r]));

    // Transform wallets to DTO with owner data
    const walletsWithOwners = wallets
      .map(wallet => {
        let owner: any = null;
        
        if (wallet.ownerType === 'driver') {
          const user = driverMap.get(wallet.ownerId);
          if (user) {
            owner = {
              email: user.email,
              countryCode: user.countryCode || '',
              cityCode: '', // cityCode is on profile, not user model
              fullName: user.driverProfile?.fullName || user.email,
            };
          }
        } else if (wallet.ownerType === 'customer') {
          const user = customerMap.get(wallet.ownerId);
          if (user) {
            owner = {
              email: user.email,
              countryCode: user.countryCode || '',
              cityCode: user.customerProfile?.cityCode || '',
              fullName: user.customerProfile?.fullName || user.email,
            };
          }
        } else if (wallet.ownerType === 'restaurant') {
          const restaurant = restaurantMap.get(wallet.ownerId);
          if (restaurant) {
            owner = {
              email: restaurant.user?.email || '',
              countryCode: restaurant.user?.countryCode || '',
              cityCode: restaurant.cityCode || '',
              restaurantName: restaurant.restaurantName || 'Unknown Restaurant',
            };
          }
        }

        // Skip if owner not found (RBAC filtered out)
        if (!owner) return null;

        // Get last transaction date
        return {
          id: wallet.id,
          walletType: wallet.ownerType, // Map ownerType to walletType for frontend
          ownerType: wallet.ownerType,
          ownerId: wallet.ownerId,
          currency: wallet.currency,
          availableBalance: wallet.availableBalance.toString(),
          negativeBalance: wallet.negativeBalance.toString(),
          createdAt: wallet.createdAt.toISOString(),
          lastTransactionDate: null, // Will be populated if needed
          owner,
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);

    return walletsWithOwners;
  }
}

export const walletService = new WalletService();
