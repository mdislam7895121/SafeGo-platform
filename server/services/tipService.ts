import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { walletService, TransactionClient } from "./walletService";

export type ServiceType = "ride" | "food" | "parcel";

export interface RecordTipParams {
  entityId: string;
  entityType: "ride" | "food_order" | "delivery";
  tipAmount: number;
  tipPaymentMethod: "cash" | "online";
  tippedBy?: string;
}

export interface TipResult {
  success: boolean;
  entityId: string;
  entityType: "ride" | "food_order" | "delivery";
  tipAmount: number;
  tipPaymentMethod: "cash" | "online";
  walletTransactionId?: string;
  error?: string;
  alreadyProcessed?: boolean;
}

export class TipService {
  async recordTip(params: RecordTipParams): Promise<TipResult> {
    const { entityId, entityType, tipAmount, tipPaymentMethod, tippedBy } = params;

    if (tipAmount <= 0) {
      return {
        success: false,
        entityId,
        entityType,
        tipAmount,
        tipPaymentMethod,
        error: "Tip amount must be greater than zero",
      };
    }

    try {
      switch (entityType) {
        case "ride":
          return await this.recordRideTip(params);
        case "food_order":
          return await this.recordFoodOrderTip(params);
        case "delivery":
          return await this.recordDeliveryTip(params);
        default:
          return {
            success: false,
            entityId,
            entityType,
            tipAmount,
            tipPaymentMethod,
            error: `Unknown entity type: ${entityType}`,
          };
      }
    } catch (error) {
      console.error(`Failed to record tip for ${entityType} ${entityId}:`, error);
      return {
        success: false,
        entityId,
        entityType,
        tipAmount,
        tipPaymentMethod,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async recordRideTip(params: RecordTipParams): Promise<TipResult> {
    const { entityId, tipAmount, tipPaymentMethod, tippedBy } = params;

    const ride = await prisma.ride.findUnique({
      where: { id: entityId },
      include: {
        driver: { include: { user: true } },
        customer: { include: { user: true } },
      },
    });

    if (!ride) {
      return {
        success: false,
        entityId,
        entityType: "ride",
        tipAmount,
        tipPaymentMethod,
        error: `Ride ${entityId} not found`,
      };
    }

    if (ride.tipSettledAt) {
      return {
        success: true,
        entityId,
        entityType: "ride",
        tipAmount: Number(ride.tipAmount || 0),
        tipPaymentMethod: (ride.tipPaymentMethod as "cash" | "online") || tipPaymentMethod,
        alreadyProcessed: true,
      };
    }

    if (!ride.driverId || !ride.driver) {
      return {
        success: false,
        entityId,
        entityType: "ride",
        tipAmount,
        tipPaymentMethod,
        error: `Ride ${entityId} has no assigned driver`,
      };
    }

    const driverProfile = ride.driver;
    if (!driverProfile.isVerified || driverProfile.verificationStatus !== "approved") {
      return {
        success: false,
        entityId,
        entityType: "ride",
        tipAmount,
        tipPaymentMethod,
        error: `Driver ${driverProfile.id} is not verified for receiving tips`,
      };
    }

    const countryCode = driverProfile.user.countryCode;
    const currency = countryCode === "BD" ? "BDT" : "USD";

    return await prisma.$transaction(async (tx) => {
      let walletTransactionId: string | undefined;

      const wallet = await walletService.getOrCreateWallet({
        ownerId: driverProfile.id,
        ownerType: "driver",
        countryCode,
        currency,
        tx: tx as TransactionClient,
      });

      if (tipPaymentMethod === "online") {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: tipAmount },
          },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: "driver",
            countryCode,
            serviceType: "tip",
            direction: "credit",
            amount: new Prisma.Decimal(tipAmount),
            balanceSnapshot: updatedWallet.availableBalance,
            negativeBalanceSnapshot: updatedWallet.negativeBalance,
            referenceType: "ride",
            referenceId: entityId,
            description: `Tip for ride: ${ride.pickupAddress} → ${ride.dropoffAddress}`,
          },
        });

        walletTransactionId = transaction.id;
      } else {
        const currentWallet = await tx.wallet.findUnique({
          where: { id: wallet.id },
        });
        
        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: "driver",
            countryCode,
            serviceType: "tip",
            direction: "credit",
            amount: new Prisma.Decimal(tipAmount),
            balanceSnapshot: currentWallet?.availableBalance || new Prisma.Decimal(0),
            negativeBalanceSnapshot: currentWallet?.negativeBalance || new Prisma.Decimal(0),
            referenceType: "ride",
            referenceId: entityId,
            description: `Cash tip for ride: ${ride.pickupAddress} → ${ride.dropoffAddress}`,
          },
        });

        walletTransactionId = transaction.id;
      }

      await tx.ride.update({
        where: { id: entityId },
        data: {
          tipAmount: new Prisma.Decimal(tipAmount),
          tipPaymentMethod,
          tipSettledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "ride" as const,
        tipAmount,
        tipPaymentMethod,
        walletTransactionId,
      };
    });
  }

  private async recordFoodOrderTip(params: RecordTipParams): Promise<TipResult> {
    const { entityId, tipAmount, tipPaymentMethod } = params;

    const order = await prisma.foodOrder.findUnique({
      where: { id: entityId },
      include: {
        driver: { include: { user: true } },
        customer: { include: { user: true } },
      },
    });

    if (!order) {
      return {
        success: false,
        entityId,
        entityType: "food_order",
        tipAmount,
        tipPaymentMethod,
        error: `Food order ${entityId} not found`,
      };
    }

    if (order.tipSettledAt) {
      return {
        success: true,
        entityId,
        entityType: "food_order",
        tipAmount: Number(order.tipAmount || 0),
        tipPaymentMethod: (order.tipPaymentMethod as "cash" | "online") || tipPaymentMethod,
        alreadyProcessed: true,
      };
    }

    if (!order.driverId || !order.driver) {
      return {
        success: false,
        entityId,
        entityType: "food_order",
        tipAmount,
        tipPaymentMethod,
        error: `Food order ${entityId} has no assigned delivery driver`,
      };
    }

    const driverProfile = order.driver;
    if (!driverProfile.isVerified || driverProfile.verificationStatus !== "approved") {
      return {
        success: false,
        entityId,
        entityType: "food_order",
        tipAmount,
        tipPaymentMethod,
        error: `Driver ${driverProfile.id} is not verified for receiving tips`,
      };
    }

    const countryCode = driverProfile.user.countryCode;
    const currency = countryCode === "BD" ? "BDT" : "USD";

    return await prisma.$transaction(async (tx) => {
      let walletTransactionId: string | undefined;

      const wallet = await walletService.getOrCreateWallet({
        ownerId: driverProfile.id,
        ownerType: "driver",
        countryCode,
        currency,
        tx: tx as TransactionClient,
      });

      if (tipPaymentMethod === "online") {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: tipAmount },
          },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: "driver",
            countryCode,
            serviceType: "tip",
            direction: "credit",
            amount: new Prisma.Decimal(tipAmount),
            balanceSnapshot: updatedWallet.availableBalance,
            negativeBalanceSnapshot: updatedWallet.negativeBalance,
            referenceType: "food_order",
            referenceId: entityId,
            description: `Tip for food delivery: Order #${entityId.slice(-8)}`,
          },
        });

        walletTransactionId = transaction.id;
      } else {
        const currentWallet = await tx.wallet.findUnique({
          where: { id: wallet.id },
        });
        
        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: "driver",
            countryCode,
            serviceType: "tip",
            direction: "credit",
            amount: new Prisma.Decimal(tipAmount),
            balanceSnapshot: currentWallet?.availableBalance || new Prisma.Decimal(0),
            negativeBalanceSnapshot: currentWallet?.negativeBalance || new Prisma.Decimal(0),
            referenceType: "food_order",
            referenceId: entityId,
            description: `Cash tip for food delivery: Order #${entityId.slice(-8)}`,
          },
        });

        walletTransactionId = transaction.id;
      }

      await tx.foodOrder.update({
        where: { id: entityId },
        data: {
          tipAmount: new Prisma.Decimal(tipAmount),
          tipPaymentMethod,
          tipSettledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "food_order" as const,
        tipAmount,
        tipPaymentMethod,
        walletTransactionId,
      };
    });
  }

  private async recordDeliveryTip(params: RecordTipParams): Promise<TipResult> {
    const { entityId, tipAmount, tipPaymentMethod } = params;

    const delivery = await prisma.delivery.findUnique({
      where: { id: entityId },
      include: {
        driver: { include: { user: true } },
        customer: { include: { user: true } },
      },
    });

    if (!delivery) {
      return {
        success: false,
        entityId,
        entityType: "delivery",
        tipAmount,
        tipPaymentMethod,
        error: `Delivery ${entityId} not found`,
      };
    }

    if (delivery.tipSettledAt) {
      return {
        success: true,
        entityId,
        entityType: "delivery",
        tipAmount: Number(delivery.tipAmount || 0),
        tipPaymentMethod: (delivery.tipPaymentMethod as "cash" | "online") || tipPaymentMethod,
        alreadyProcessed: true,
      };
    }

    if (!delivery.driverId || !delivery.driver) {
      return {
        success: false,
        entityId,
        entityType: "delivery",
        tipAmount,
        tipPaymentMethod,
        error: `Delivery ${entityId} has no assigned driver`,
      };
    }

    const driverProfile = delivery.driver;
    if (!driverProfile.isVerified || driverProfile.verificationStatus !== "approved") {
      return {
        success: false,
        entityId,
        entityType: "delivery",
        tipAmount,
        tipPaymentMethod,
        error: `Driver ${driverProfile.id} is not verified for receiving tips`,
      };
    }

    const countryCode = driverProfile.user.countryCode;
    const currency = countryCode === "BD" ? "BDT" : "USD";

    return await prisma.$transaction(async (tx) => {
      let walletTransactionId: string | undefined;

      const wallet = await walletService.getOrCreateWallet({
        ownerId: driverProfile.id,
        ownerType: "driver",
        countryCode,
        currency,
        tx: tx as TransactionClient,
      });

      if (tipPaymentMethod === "online") {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: tipAmount },
          },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: "driver",
            countryCode,
            serviceType: "tip",
            direction: "credit",
            amount: new Prisma.Decimal(tipAmount),
            balanceSnapshot: updatedWallet.availableBalance,
            negativeBalanceSnapshot: updatedWallet.negativeBalance,
            referenceType: "delivery",
            referenceId: entityId,
            description: `Tip for parcel delivery: ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
          },
        });

        walletTransactionId = transaction.id;
      } else {
        const currentWallet = await tx.wallet.findUnique({
          where: { id: wallet.id },
        });
        
        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: "driver",
            countryCode,
            serviceType: "tip",
            direction: "credit",
            amount: new Prisma.Decimal(tipAmount),
            balanceSnapshot: currentWallet?.availableBalance || new Prisma.Decimal(0),
            negativeBalanceSnapshot: currentWallet?.negativeBalance || new Prisma.Decimal(0),
            referenceType: "delivery",
            referenceId: entityId,
            description: `Cash tip for parcel delivery: ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
          },
        });

        walletTransactionId = transaction.id;
      }

      await tx.delivery.update({
        where: { id: entityId },
        data: {
          tipAmount: new Prisma.Decimal(tipAmount),
          tipPaymentMethod,
          tipSettledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "delivery" as const,
        tipAmount,
        tipPaymentMethod,
        walletTransactionId,
      };
    });
  }

  async getDriverTipStats(
    driverId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalTips: number;
    tipCount: number;
    averageTip: number;
    byPaymentMethod: { cash: number; online: number };
    byServiceType: { ride: number; food: number; parcel: number };
    currency: string;
  }> {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const [rides, foodOrders, deliveries, driverProfile] = await Promise.all([
      prisma.ride.findMany({
        where: {
          driverId,
          tipAmount: { not: null },
          tipSettledAt: { not: null },
          ...(startDate || endDate ? { tipSettledAt: dateFilter } : {}),
        },
        select: { tipAmount: true, tipPaymentMethod: true },
      }),
      prisma.foodOrder.findMany({
        where: {
          driverId,
          tipAmount: { not: null },
          tipSettledAt: { not: null },
          ...(startDate || endDate ? { tipSettledAt: dateFilter } : {}),
        },
        select: { tipAmount: true, tipPaymentMethod: true },
      }),
      prisma.delivery.findMany({
        where: {
          driverId,
          tipAmount: { not: null },
          tipSettledAt: { not: null },
          ...(startDate || endDate ? { tipSettledAt: dateFilter } : {}),
        },
        select: { tipAmount: true, tipPaymentMethod: true },
      }),
      prisma.driverProfile.findUnique({
        where: { id: driverId },
        include: { user: true },
      }),
    ]);

    let totalTips = 0;
    let tipCount = 0;
    const byPaymentMethod = { cash: 0, online: 0 };
    const byServiceType = { ride: 0, food: 0, parcel: 0 };

    for (const ride of rides) {
      const amount = Number(ride.tipAmount || 0);
      totalTips += amount;
      tipCount++;
      byServiceType.ride += amount;
      if (ride.tipPaymentMethod === "cash") {
        byPaymentMethod.cash += amount;
      } else {
        byPaymentMethod.online += amount;
      }
    }

    for (const order of foodOrders) {
      const amount = Number(order.tipAmount || 0);
      totalTips += amount;
      tipCount++;
      byServiceType.food += amount;
      if (order.tipPaymentMethod === "cash") {
        byPaymentMethod.cash += amount;
      } else {
        byPaymentMethod.online += amount;
      }
    }

    for (const delivery of deliveries) {
      const amount = Number(delivery.tipAmount || 0);
      totalTips += amount;
      tipCount++;
      byServiceType.parcel += amount;
      if (delivery.tipPaymentMethod === "cash") {
        byPaymentMethod.cash += amount;
      } else {
        byPaymentMethod.online += amount;
      }
    }

    const countryCode = driverProfile?.user?.countryCode || "US";

    return {
      totalTips,
      tipCount,
      averageTip: tipCount > 0 ? totalTips / tipCount : 0,
      byPaymentMethod,
      byServiceType,
      currency: countryCode === "BD" ? "BDT" : "USD",
    };
  }

  async getPlatformTipStats(
    countryCode?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalTips: number;
    tipCount: number;
    averageTip: number;
    byServiceType: { ride: number; food: number; parcel: number };
    currency: string;
  }> {
    const tipTransactions = await prisma.walletTransaction.findMany({
      where: {
        serviceType: "tip",
        direction: "credit",
        ...(countryCode ? { countryCode } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      select: {
        amount: true,
        referenceType: true,
      },
    });

    let totalTips = 0;
    const byServiceType = { ride: 0, food: 0, parcel: 0 };

    for (const tx of tipTransactions) {
      const amount = Number(tx.amount);
      totalTips += amount;
      
      if (tx.referenceType === "ride") {
        byServiceType.ride += amount;
      } else if (tx.referenceType === "food_order") {
        byServiceType.food += amount;
      } else if (tx.referenceType === "delivery") {
        byServiceType.parcel += amount;
      }
    }

    return {
      totalTips,
      tipCount: tipTransactions.length,
      averageTip: tipTransactions.length > 0 ? totalTips / tipTransactions.length : 0,
      byServiceType,
      currency: countryCode === "BD" ? "BDT" : "USD",
    };
  }
}

export const tipService = new TipService();
