import { Prisma, DeliveryServiceType } from "@prisma/client";
import { prisma } from "../db";
import { walletService, TransactionClient } from "./walletService";
import { driverNotificationService } from "./driverNotificationService";
import { customerNotificationService } from "./customerNotificationService";

export interface SettlementResult {
  success: boolean;
  entityId: string;
  entityType: "ride" | "food_order" | "delivery";
  settlementStatus: "pending" | "settled" | "failed" | "manual_review";
  driverWalletTransactionId?: string;
  restaurantWalletTransactionId?: string;
  platformLedgerEntryId?: string;
  error?: string;
  alreadySettled?: boolean;
}

export class SettlementService {
  async settleCompletedRide(rideId: string): Promise<SettlementResult> {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          driver: { include: { user: true } },
          customer: { include: { user: true } },
        },
      });

      if (!ride) {
        return {
          success: false,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "failed",
          error: `Ride ${rideId} not found`,
        };
      }

      if (ride.settlementStatus === "settled") {
        return {
          success: true,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "settled",
          alreadySettled: true,
        };
      }

      if (ride.status !== "completed") {
        return {
          success: false,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "failed",
          error: `Ride ${rideId} is not completed (status: ${ride.status})`,
        };
      }

      if (!ride.driver) {
        return {
          success: false,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "failed",
          error: `Ride ${rideId} has no assigned driver`,
        };
      }

      const driverProfile = ride.driver;
      if (!driverProfile.isVerified || driverProfile.verificationStatus !== "approved") {
        return {
          success: false,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "manual_review",
          error: `Driver ${driverProfile.id} is not verified for financial processing`,
        };
      }

      if (driverProfile.user.isBlocked) {
        return {
          success: false,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "manual_review",
          error: `Driver ${driverProfile.id} is blocked`,
        };
      }

      const fareAmount = Number(ride.serviceFare?.toString() || "0");
      const commission = Number(ride.safegoCommission?.toString() || "0");
      const countryCode = ride.driver.user.countryCode;
      const currency = countryCode === "BD" ? "BDT" : "USD";

      if (fareAmount <= 0) {
        return {
          success: false,
          entityId: rideId,
          entityType: "ride",
          settlementStatus: "failed",
          error: `Invalid fare amount for ride ${rideId}`,
        };
      }

      return await prisma.$transaction(async (tx) => {
        const paymentMethod = ride.paymentMethod as "cash" | "online";

        await walletService.recordRideEarning(
          ride.driverId!,
          {
            id: ride.id,
            serviceFare: ride.serviceFare,
            driverPayout: ride.driverPayout,
            safegoCommission: ride.safegoCommission,
            paymentMethod,
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
          },
          tx as TransactionClient
        );

        const platformLedgerEntry = await tx.platformRevenueLedger.create({
          data: {
            sourceType: "commission",
            serviceType: "ride",
            referenceType: "ride",
            referenceId: ride.id,
            actorType: "driver",
            actorId: ride.driverId!,
            countryCode,
            currency,
            grossAmount: new Prisma.Decimal(commission),
            netAmount: new Prisma.Decimal(commission),
            description: `Ride commission: ${ride.pickupAddress} → ${ride.dropoffAddress}`,
          },
        });

        await tx.ride.update({
          where: { id: rideId },
          data: {
            settlementStatus: "settled",
            settledAt: new Date(),
          },
        });

        const driverEarnings = Number(ride.driverPayout?.toString() || fareAmount - commission);
        driverNotificationService.sendEarningsSettled({
          driverId: ride.driverId!,
          amount: driverEarnings,
          currency,
          serviceType: DeliveryServiceType.ride,
          entityId: rideId,
        }).catch((err: Error) => console.error("[SettlementService] Notification error:", err));

        if (ride.customerId) {
          customerNotificationService.sendTripCompletedReceipt({
            customerId: ride.customerId,
            rideId,
            totalFare: fareAmount,
            currency,
          }).catch((err: Error) => console.error("[SettlementService] Customer notification error:", err));
        }

        return {
          success: true,
          entityId: rideId,
          entityType: "ride" as const,
          settlementStatus: "settled" as const,
          platformLedgerEntryId: platformLedgerEntry.id,
        };
      });
    } catch (error) {
      console.error(`Settlement failed for ride ${rideId}:`, error);
      
      try {
        await prisma.ride.update({
          where: { id: rideId },
          data: { settlementStatus: "failed" },
        });
      } catch (updateError) {
        console.error(`Failed to mark ride ${rideId} as failed:`, updateError);
      }

      return {
        success: false,
        entityId: rideId,
        entityType: "ride",
        settlementStatus: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async settleCompletedFoodOrder(orderId: string): Promise<SettlementResult> {
    try {
      const order = await prisma.foodOrder.findUnique({
        where: { id: orderId },
        include: {
          restaurant: { include: { user: true } },
          driver: { include: { user: true } },
          customer: { include: { user: true } },
        },
      });

      if (!order) {
        return {
          success: false,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "failed",
          error: `Food order ${orderId} not found`,
        };
      }

      if (order.settlementStatus === "settled") {
        return {
          success: true,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "settled",
          alreadySettled: true,
        };
      }

      if (order.status !== "delivered") {
        return {
          success: false,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "failed",
          error: `Food order ${orderId} is not delivered (status: ${order.status})`,
        };
      }

      if (!order.restaurant) {
        return {
          success: false,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "failed",
          error: `Food order ${orderId} has no associated restaurant`,
        };
      }

      const restaurantProfile = order.restaurant;
      if (!restaurantProfile.isVerified || restaurantProfile.verificationStatus !== "approved") {
        return {
          success: false,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "manual_review",
          error: `Restaurant ${restaurantProfile.id} is not verified for financial processing`,
        };
      }

      if (restaurantProfile.user.isBlocked) {
        return {
          success: false,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "manual_review",
          error: `Restaurant ${restaurantProfile.id} is blocked`,
        };
      }

      const orderTotal = Number(order.serviceFare?.toString() || "0");
      const restaurantCommission = Number(order.safegoCommission?.toString() || "0");
      const deliveryFee = Number(order.deliveryFee?.toString() || "0");
      const countryCode = restaurantProfile.user.countryCode;
      const currency = countryCode === "BD" ? "BDT" : "USD";

      if (orderTotal <= 0) {
        return {
          success: false,
          entityId: orderId,
          entityType: "food_order",
          settlementStatus: "failed",
          error: `Invalid order total for food order ${orderId}`,
        };
      }

      return await prisma.$transaction(async (tx) => {
        const paymentMethod = order.paymentMethod as "cash" | "online";

        await walletService.recordFoodOrderEarning(
          order.restaurantId,
          {
            id: order.id,
            serviceFare: order.serviceFare,
            restaurantPayout: order.restaurantPayout,
            safegoCommission: order.safegoCommission,
            paymentMethod,
            deliveryAddress: order.deliveryAddress || "Unknown",
          },
          tx as TransactionClient
        );

        if (order.driverId && order.driver) {
          const driverVerified = order.driver.isVerified && 
                                order.driver.verificationStatus === "approved" &&
                                !order.driver.user.isBlocked;
          
          if (driverVerified) {
            await walletService.recordFoodDeliveryEarning(
              order.driverId,
              {
                id: order.id,
                deliveryPayout: deliveryFee,
                paymentMethod,
                deliveryAddress: order.deliveryAddress || "Unknown",
              },
              tx as TransactionClient
            );
          }
        }

        const platformLedgerEntry = await tx.platformRevenueLedger.create({
          data: {
            sourceType: "commission",
            serviceType: "food",
            referenceType: "food_order",
            referenceId: order.id,
            actorType: "restaurant",
            actorId: order.restaurantId,
            countryCode,
            currency,
            grossAmount: new Prisma.Decimal(restaurantCommission),
            netAmount: new Prisma.Decimal(restaurantCommission),
            description: `Food order commission: Order #${order.id.slice(-8)}`,
          },
        });

        await tx.foodOrder.update({
          where: { id: orderId },
          data: {
            settlementStatus: "settled",
            settledAt: new Date(),
          },
        });

        if (order.driverId) {
          driverNotificationService.sendEarningsSettled({
            driverId: order.driverId,
            amount: deliveryFee,
            currency,
            serviceType: DeliveryServiceType.food,
            entityId: orderId,
          }).catch((err: Error) => console.error("[SettlementService] Food driver notification error:", err));
        }

        if (order.customerId) {
          customerNotificationService.sendOrderDelivered({
            customerId: order.customerId,
            orderId,
            totalAmount: orderTotal,
            currency,
          }).catch((err: Error) => console.error("[SettlementService] Food customer notification error:", err));
        }

        return {
          success: true,
          entityId: orderId,
          entityType: "food_order" as const,
          settlementStatus: "settled" as const,
          platformLedgerEntryId: platformLedgerEntry.id,
        };
      });
    } catch (error) {
      console.error(`Settlement failed for food order ${orderId}:`, error);
      
      try {
        await prisma.foodOrder.update({
          where: { id: orderId },
          data: { settlementStatus: "failed" },
        });
      } catch (updateError) {
        console.error(`Failed to mark food order ${orderId} as failed:`, updateError);
      }

      return {
        success: false,
        entityId: orderId,
        entityType: "food_order",
        settlementStatus: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async settleCompletedDelivery(deliveryId: string): Promise<SettlementResult> {
    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          driver: { include: { user: true } },
          customer: { include: { user: true } },
        },
      });

      if (!delivery) {
        return {
          success: false,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "failed",
          error: `Delivery ${deliveryId} not found`,
        };
      }

      if (delivery.settlementStatus === "settled") {
        return {
          success: true,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "settled",
          alreadySettled: true,
        };
      }

      if (delivery.status !== "delivered") {
        return {
          success: false,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "failed",
          error: `Delivery ${deliveryId} is not delivered (status: ${delivery.status})`,
        };
      }

      if (!delivery.driver) {
        return {
          success: false,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "failed",
          error: `Delivery ${deliveryId} has no assigned driver`,
        };
      }

      const driverProfile = delivery.driver;
      if (!driverProfile.isVerified || driverProfile.verificationStatus !== "approved") {
        return {
          success: false,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "manual_review",
          error: `Driver ${driverProfile.id} is not verified for financial processing`,
        };
      }

      if (driverProfile.user.isBlocked) {
        return {
          success: false,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "manual_review",
          error: `Driver ${driverProfile.id} is blocked`,
        };
      }

      const fareAmount = Number(delivery.serviceFare?.toString() || "0");
      const commission = Number(delivery.safegoCommission?.toString() || "0");
      const countryCode = driverProfile.user.countryCode;
      const currency = countryCode === "BD" ? "BDT" : "USD";

      if (fareAmount <= 0) {
        return {
          success: false,
          entityId: deliveryId,
          entityType: "delivery",
          settlementStatus: "failed",
          error: `Invalid fare amount for delivery ${deliveryId}`,
        };
      }

      return await prisma.$transaction(async (tx) => {
        const paymentMethod = delivery.paymentMethod as "cash" | "online";

        await walletService.recordParcelDeliveryEarning(
          delivery.driverId!,
          {
            id: delivery.id,
            serviceFare: delivery.serviceFare,
            driverPayout: delivery.driverPayout,
            safegoCommission: delivery.safegoCommission,
            paymentMethod,
            pickupAddress: delivery.pickupAddress,
            dropoffAddress: delivery.dropoffAddress,
          },
          tx as TransactionClient
        );

        const platformLedgerEntry = await tx.platformRevenueLedger.create({
          data: {
            sourceType: "commission",
            serviceType: "parcel",
            referenceType: "delivery",
            referenceId: delivery.id,
            actorType: "driver",
            actorId: delivery.driverId!,
            countryCode,
            currency,
            grossAmount: new Prisma.Decimal(commission),
            netAmount: new Prisma.Decimal(commission),
            description: `Parcel delivery commission: ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
          },
        });

        await tx.delivery.update({
          where: { id: deliveryId },
          data: {
            settlementStatus: "settled",
            settledAt: new Date(),
          },
        });

        const driverEarnings = Number(delivery.driverPayout?.toString() || fareAmount - commission);
        driverNotificationService.sendEarningsSettled({
          driverId: delivery.driverId!,
          amount: driverEarnings,
          currency,
          serviceType: DeliveryServiceType.parcel,
          entityId: deliveryId,
        }).catch((err: Error) => console.error("[SettlementService] Parcel driver notification error:", err));

        if (delivery.customerId) {
          customerNotificationService.sendParcelStatusUpdate({
            customerId: delivery.customerId,
            deliveryId,
            status: "delivered",
          }).catch((err: Error) => console.error("[SettlementService] Parcel customer notification error:", err));
        }

        return {
          success: true,
          entityId: deliveryId,
          entityType: "delivery" as const,
          settlementStatus: "settled" as const,
          platformLedgerEntryId: platformLedgerEntry.id,
        };
      });
    } catch (error) {
      console.error(`Settlement failed for delivery ${deliveryId}:`, error);
      
      try {
        await prisma.delivery.update({
          where: { id: deliveryId },
          data: { settlementStatus: "failed" },
        });
      } catch (updateError) {
        console.error(`Failed to mark delivery ${deliveryId} as failed:`, updateError);
      }

      return {
        success: false,
        entityId: deliveryId,
        entityType: "delivery",
        settlementStatus: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async retryFailedSettlement(
    entityType: "ride" | "food_order" | "delivery",
    entityId: string
  ): Promise<SettlementResult> {
    switch (entityType) {
      case "ride":
        await prisma.ride.update({
          where: { id: entityId },
          data: { settlementStatus: "pending" },
        });
        return this.settleCompletedRide(entityId);
      case "food_order":
        await prisma.foodOrder.update({
          where: { id: entityId },
          data: { settlementStatus: "pending" },
        });
        return this.settleCompletedFoodOrder(entityId);
      case "delivery":
        await prisma.delivery.update({
          where: { id: entityId },
          data: { settlementStatus: "pending" },
        });
        return this.settleCompletedDelivery(entityId);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async getPendingSettlements(
    entityType?: "ride" | "food_order" | "delivery",
    limit: number = 100
  ): Promise<Array<{ entityType: string; entityId: string; createdAt: Date }>> {
    const results: Array<{ entityType: string; entityId: string; createdAt: Date }> = [];

    if (!entityType || entityType === "ride") {
      const rides = await prisma.ride.findMany({
        where: {
          status: "completed",
          settlementStatus: "pending",
        },
        select: { id: true, createdAt: true },
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      results.push(...rides.map((r) => ({
        entityType: "ride",
        entityId: r.id,
        createdAt: r.createdAt,
      })));
    }

    if (!entityType || entityType === "food_order") {
      const orders = await prisma.foodOrder.findMany({
        where: {
          status: "delivered",
          settlementStatus: "pending",
        },
        select: { id: true, createdAt: true },
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      results.push(...orders.map((o) => ({
        entityType: "food_order",
        entityId: o.id,
        createdAt: o.createdAt,
      })));
    }

    if (!entityType || entityType === "delivery") {
      const deliveries = await prisma.delivery.findMany({
        where: {
          status: "delivered",
          settlementStatus: "pending",
        },
        select: { id: true, createdAt: true },
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      results.push(...deliveries.map((d) => ({
        entityType: "delivery",
        entityId: d.id,
        createdAt: d.createdAt,
      })));
    }

    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit);
  }

  async getFailedSettlements(
    entityType?: "ride" | "food_order" | "delivery",
    limit: number = 100
  ): Promise<Array<{ entityType: string; entityId: string; createdAt: Date }>> {
    const results: Array<{ entityType: string; entityId: string; createdAt: Date }> = [];

    if (!entityType || entityType === "ride") {
      const rides = await prisma.ride.findMany({
        where: {
          settlementStatus: { in: ["failed", "manual_review"] },
        },
        select: { id: true, createdAt: true },
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      results.push(...rides.map((r) => ({
        entityType: "ride",
        entityId: r.id,
        createdAt: r.createdAt,
      })));
    }

    if (!entityType || entityType === "food_order") {
      const orders = await prisma.foodOrder.findMany({
        where: {
          settlementStatus: { in: ["failed", "manual_review"] },
        },
        select: { id: true, createdAt: true },
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      results.push(...orders.map((o) => ({
        entityType: "food_order",
        entityId: o.id,
        createdAt: o.createdAt,
      })));
    }

    if (!entityType || entityType === "delivery") {
      const deliveries = await prisma.delivery.findMany({
        where: {
          settlementStatus: { in: ["failed", "manual_review"] },
        },
        select: { id: true, createdAt: true },
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      results.push(...deliveries.map((d) => ({
        entityType: "delivery",
        entityId: d.id,
        createdAt: d.createdAt,
      })));
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async processPendingSettlements(
    batchSize: number = 50,
    entityType?: "ride" | "food_order" | "delivery"
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: SettlementResult[];
  }> {
    const pending = await this.getPendingSettlements(entityType, batchSize);
    const results: SettlementResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
      let result: SettlementResult;
      switch (item.entityType) {
        case "ride":
          result = await this.settleCompletedRide(item.entityId);
          break;
        case "food_order":
          result = await this.settleCompletedFoodOrder(item.entityId);
          break;
        case "delivery":
          result = await this.settleCompletedDelivery(item.entityId);
          break;
        default:
          continue;
      }

      results.push(result);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: pending.length,
      succeeded,
      failed,
      results,
    };
  }

  async getSettlementStats(
    countryCode?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    rides: { pending: number; settled: number; failed: number };
    foodOrders: { pending: number; settled: number; failed: number };
    deliveries: { pending: number; settled: number; failed: number };
    platformRevenue: { totalCommissions: number; currency: string };
  }> {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const [
      rideStats,
      foodOrderStats,
      deliveryStats,
      platformRevenue,
    ] = await Promise.all([
      prisma.ride.groupBy({
        by: ["settlementStatus"],
        where: {
          ...(countryCode ? { driver: { user: { countryCode } } } : {}),
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        _count: { id: true },
      }),
      prisma.foodOrder.groupBy({
        by: ["settlementStatus"],
        where: {
          ...(countryCode ? { restaurant: { user: { countryCode } } } : {}),
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        _count: { id: true },
      }),
      prisma.delivery.groupBy({
        by: ["settlementStatus"],
        where: {
          ...(countryCode ? { driver: { user: { countryCode } } } : {}),
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        _count: { id: true },
      }),
      prisma.platformRevenueLedger.aggregate({
        where: {
          sourceType: "commission",
          ...(countryCode ? { countryCode } : {}),
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        _sum: { netAmount: true },
      }),
    ]);

    const extractStats = (stats: { settlementStatus: string | null; _count: { id: number } }[]) => {
      let pending = 0, settled = 0, failed = 0;
      for (const stat of stats) {
        if (stat.settlementStatus === "pending" || stat.settlementStatus === null) {
          pending += stat._count.id;
        } else if (stat.settlementStatus === "settled") {
          settled += stat._count.id;
        } else {
          failed += stat._count.id;
        }
      }
      return { pending, settled, failed };
    };

    return {
      rides: extractStats(rideStats),
      foodOrders: extractStats(foodOrderStats),
      deliveries: extractStats(deliveryStats),
      platformRevenue: {
        totalCommissions: Number(platformRevenue._sum.netAmount || 0),
        currency: countryCode === "BD" ? "BDT" : "USD",
      },
    };
  }
}

export const settlementService = new SettlementService();
