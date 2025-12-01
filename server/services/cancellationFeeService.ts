import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { walletService, TransactionClient } from "./walletService";

export type CancellationFeeType = "customer_cancel" | "no_show" | "driver_cancel";
export type ServiceType = "ride" | "food" | "parcel";

export interface CancellationFeeResult {
  success: boolean;
  entityId: string;
  entityType: "ride" | "food_order" | "delivery";
  feeApplied: boolean;
  feeAmount: number;
  driverShare: number;
  platformShare: number;
  walletTransactionId?: string;
  platformLedgerEntryId?: string;
  error?: string;
  alreadyProcessed?: boolean;
}

export interface ApplyCancellationFeeParams {
  entityId: string;
  entityType: "ride" | "food_order" | "delivery";
  cancellationType: CancellationFeeType;
  cancellationReason?: string;
  cancelledBy: "customer" | "driver" | "restaurant" | "admin" | "system";
  estimatedFare?: number;
  driverArrived?: boolean;
}

export class CancellationFeeService {
  async applyCancellationFee(params: ApplyCancellationFeeParams): Promise<CancellationFeeResult> {
    const { entityId, entityType } = params;

    try {
      switch (entityType) {
        case "ride":
          return await this.applyRideCancellationFee(params);
        case "food_order":
          return await this.applyFoodOrderCancellationFee(params);
        case "delivery":
          return await this.applyDeliveryCancellationFee(params);
        default:
          return {
            success: false,
            entityId,
            entityType,
            feeApplied: false,
            feeAmount: 0,
            driverShare: 0,
            platformShare: 0,
            error: `Unknown entity type: ${entityType}`,
          };
      }
    } catch (error) {
      console.error(`Failed to apply cancellation fee to ${entityType} ${entityId}:`, error);
      return {
        success: false,
        entityId,
        entityType,
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async applyRideCancellationFee(params: ApplyCancellationFeeParams): Promise<CancellationFeeResult> {
    const { entityId, cancellationType, cancellationReason, cancelledBy, estimatedFare, driverArrived } = params;

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
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
        error: `Ride ${entityId} not found`,
      };
    }

    if (ride.cancellationFeeApplied !== null) {
      return {
        success: true,
        entityId,
        entityType: "ride",
        feeApplied: true,
        feeAmount: Number(ride.cancellationFeeApplied),
        driverShare: 0,
        platformShare: 0,
        alreadyProcessed: true,
      };
    }

    const countryCode = ride.driver?.user.countryCode || ride.customer?.user.countryCode || "US";

    const feeRule = await prisma.cancellationFeeRule.findFirst({
      where: {
        countryCode,
        serviceType: "ride",
        feeType: cancellationType,
        isActive: true,
      },
    });

    if (!feeRule) {
      await prisma.ride.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(0),
          whoCancelled: cancelledBy,
          cancellationReason: cancellationReason,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "ride",
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
      };
    }

    if (feeRule.requiresDriverArrival && !driverArrived) {
      await prisma.ride.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(0),
          whoCancelled: cancelledBy,
          cancellationReason: cancellationReason,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "ride",
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
      };
    }

    let feeAmount = 0;
    const fareBase = estimatedFare || Number(ride.serviceFare || 0);

    if (feeRule.flatFee) {
      feeAmount = Number(feeRule.flatFee);
    }

    if (feeRule.percentageFee) {
      feeAmount += fareBase * (Number(feeRule.percentageFee) / 100);
    }

    if (feeRule.minFee && feeAmount < Number(feeRule.minFee)) {
      feeAmount = Number(feeRule.minFee);
    }

    if (feeRule.maxFee && feeAmount > Number(feeRule.maxFee)) {
      feeAmount = Number(feeRule.maxFee);
    }

    feeAmount = Math.round(feeAmount * 100) / 100;

    const driverSharePercent = Number(feeRule.driverSharePercentage || 100);
    const platformSharePercent = Number(feeRule.platformSharePercentage || 0);
    const driverShare = Math.round((feeAmount * driverSharePercent / 100) * 100) / 100;
    const platformShare = Math.round((feeAmount * platformSharePercent / 100) * 100) / 100;

    const currency = feeRule.currency || (countryCode === "BD" ? "BDT" : "USD");

    return await prisma.$transaction(async (tx) => {
      let walletTransactionId: string | undefined;
      let platformLedgerEntryId: string | undefined;

      if (ride.driverId && ride.driver && driverShare > 0) {
        const driverProfile = ride.driver;
        
        if (driverProfile.isVerified && driverProfile.verificationStatus === "approved") {
          const wallet = await walletService.getOrCreateWallet({
            ownerId: driverProfile.id,
            ownerType: "driver",
            countryCode,
            currency,
            tx: tx as TransactionClient,
          });

          if (ride.paymentMethod === "online") {
            const updatedWallet = await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: { increment: driverShare },
              },
            });

            const transaction = await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                ownerType: "driver",
                countryCode,
                serviceType: "cancellation_fee",
                direction: "credit",
                amount: new Prisma.Decimal(driverShare),
                balanceSnapshot: updatedWallet.availableBalance,
                negativeBalanceSnapshot: updatedWallet.negativeBalance,
                referenceType: "ride",
                referenceId: entityId,
                description: `Cancellation fee for ride (${cancellationType}): ${ride.pickupAddress} → ${ride.dropoffAddress}`,
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
                serviceType: "cancellation_fee",
                direction: "credit",
                amount: new Prisma.Decimal(driverShare),
                balanceSnapshot: currentWallet?.availableBalance || new Prisma.Decimal(0),
                negativeBalanceSnapshot: currentWallet?.negativeBalance || new Prisma.Decimal(0),
                referenceType: "ride",
                referenceId: entityId,
                description: `Cash cancellation fee for ride (${cancellationType}): ${ride.pickupAddress} → ${ride.dropoffAddress}`,
              },
            });

            walletTransactionId = transaction.id;
          }
        }
      }

      if (platformShare > 0 && ride.driverId) {
        const ledgerEntry = await tx.platformRevenueLedger.create({
          data: {
            sourceType: "cancellation_fee",
            serviceType: "ride",
            referenceType: "ride",
            referenceId: entityId,
            actorType: "driver",
            actorId: ride.driverId,
            countryCode,
            currency,
            grossAmount: new Prisma.Decimal(platformShare),
            netAmount: new Prisma.Decimal(platformShare),
            description: `Cancellation fee (${cancellationType}): ${ride.pickupAddress} → ${ride.dropoffAddress}`,
          },
        });

        platformLedgerEntryId = ledgerEntry.id;
      }

      await tx.ride.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(feeAmount),
          cancellationFeeRuleId: feeRule.id,
          whoCancelled: cancelledBy,
          cancellationReason: cancellationReason,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "ride" as const,
        feeApplied: true,
        feeAmount,
        driverShare,
        platformShare,
        walletTransactionId,
        platformLedgerEntryId,
      };
    });
  }

  private async applyFoodOrderCancellationFee(params: ApplyCancellationFeeParams): Promise<CancellationFeeResult> {
    const { entityId, cancellationType, cancellationReason, cancelledBy, estimatedFare } = params;

    const order = await prisma.foodOrder.findUnique({
      where: { id: entityId },
      include: {
        driver: { include: { user: true } },
        restaurant: { include: { user: true } },
        customer: { include: { user: true } },
      },
    });

    if (!order) {
      return {
        success: false,
        entityId,
        entityType: "food_order",
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
        error: `Food order ${entityId} not found`,
      };
    }

    if (order.cancellationFeeApplied !== null) {
      return {
        success: true,
        entityId,
        entityType: "food_order",
        feeApplied: true,
        feeAmount: Number(order.cancellationFeeApplied),
        driverShare: 0,
        platformShare: 0,
        alreadyProcessed: true,
      };
    }

    const countryCode = order.restaurant?.user.countryCode || order.customer?.user.countryCode || "US";

    const feeRule = await prisma.cancellationFeeRule.findFirst({
      where: {
        countryCode,
        serviceType: "food",
        feeType: cancellationType,
        isActive: true,
      },
    });

    if (!feeRule) {
      await prisma.foodOrder.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(0),
          whoCancelled: cancelledBy,
          cancellationReason: cancellationReason,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "food_order",
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
      };
    }

    let feeAmount = 0;
    const fareBase = estimatedFare || Number(order.serviceFare || 0);

    if (feeRule.flatFee) {
      feeAmount = Number(feeRule.flatFee);
    }

    if (feeRule.percentageFee) {
      feeAmount += fareBase * (Number(feeRule.percentageFee) / 100);
    }

    if (feeRule.minFee && feeAmount < Number(feeRule.minFee)) {
      feeAmount = Number(feeRule.minFee);
    }

    if (feeRule.maxFee && feeAmount > Number(feeRule.maxFee)) {
      feeAmount = Number(feeRule.maxFee);
    }

    feeAmount = Math.round(feeAmount * 100) / 100;

    const driverSharePercent = Number(feeRule.driverSharePercentage || 100);
    const platformSharePercent = Number(feeRule.platformSharePercentage || 0);
    const driverShare = Math.round((feeAmount * driverSharePercent / 100) * 100) / 100;
    const platformShare = Math.round((feeAmount * platformSharePercent / 100) * 100) / 100;

    const currency = feeRule.currency || (countryCode === "BD" ? "BDT" : "USD");

    return await prisma.$transaction(async (tx) => {
      let walletTransactionId: string | undefined;
      let platformLedgerEntryId: string | undefined;

      if (order.driverId && order.driver && driverShare > 0) {
        const driverProfile = order.driver;
        
        if (driverProfile.isVerified && driverProfile.verificationStatus === "approved") {
          const wallet = await walletService.getOrCreateWallet({
            ownerId: driverProfile.id,
            ownerType: "driver",
            countryCode,
            currency,
            tx: tx as TransactionClient,
          });

          if (order.paymentMethod === "online") {
            const updatedWallet = await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: { increment: driverShare },
              },
            });

            const transaction = await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                ownerType: "driver",
                countryCode,
                serviceType: "cancellation_fee",
                direction: "credit",
                amount: new Prisma.Decimal(driverShare),
                balanceSnapshot: updatedWallet.availableBalance,
                negativeBalanceSnapshot: updatedWallet.negativeBalance,
                referenceType: "food_order",
                referenceId: entityId,
                description: `Cancellation fee for food order (${cancellationType})`,
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
                serviceType: "cancellation_fee",
                direction: "credit",
                amount: new Prisma.Decimal(driverShare),
                balanceSnapshot: currentWallet?.availableBalance || new Prisma.Decimal(0),
                negativeBalanceSnapshot: currentWallet?.negativeBalance || new Prisma.Decimal(0),
                referenceType: "food_order",
                referenceId: entityId,
                description: `Cash cancellation fee for food order (${cancellationType})`,
              },
            });

            walletTransactionId = transaction.id;
          }
        }
      }

      if (platformShare > 0 && order.restaurantId) {
        const ledgerEntry = await tx.platformRevenueLedger.create({
          data: {
            sourceType: "cancellation_fee",
            serviceType: "food",
            referenceType: "food_order",
            referenceId: entityId,
            actorType: "restaurant",
            actorId: order.restaurantId,
            countryCode,
            currency,
            grossAmount: new Prisma.Decimal(platformShare),
            netAmount: new Prisma.Decimal(platformShare),
            description: `Cancellation fee (${cancellationType}) for food order #${entityId.slice(-8)}`,
          },
        });

        platformLedgerEntryId = ledgerEntry.id;
      }

      await tx.foodOrder.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(feeAmount),
          cancellationFeeRuleId: feeRule.id,
          whoCancelled: cancelledBy,
          cancellationReason: cancellationReason,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "food_order" as const,
        feeApplied: true,
        feeAmount,
        driverShare,
        platformShare,
        walletTransactionId,
        platformLedgerEntryId,
      };
    });
  }

  private async applyDeliveryCancellationFee(params: ApplyCancellationFeeParams): Promise<CancellationFeeResult> {
    const { entityId, cancellationType, estimatedFare, driverArrived } = params;

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
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
        error: `Delivery ${entityId} not found`,
      };
    }

    if (delivery.cancellationFeeApplied !== null) {
      return {
        success: true,
        entityId,
        entityType: "delivery",
        feeApplied: true,
        feeAmount: Number(delivery.cancellationFeeApplied),
        driverShare: 0,
        platformShare: 0,
        alreadyProcessed: true,
      };
    }

    const countryCode = delivery.driver?.user.countryCode || delivery.customer?.user.countryCode || "US";

    const feeRule = await prisma.cancellationFeeRule.findFirst({
      where: {
        countryCode,
        serviceType: "parcel",
        feeType: cancellationType,
        isActive: true,
      },
    });

    if (!feeRule) {
      await prisma.delivery.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(0),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "delivery",
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
      };
    }

    if (feeRule.requiresDriverArrival && !driverArrived) {
      await prisma.delivery.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(0),
        },
      });

      return {
        success: true,
        entityId,
        entityType: "delivery",
        feeApplied: false,
        feeAmount: 0,
        driverShare: 0,
        platformShare: 0,
      };
    }

    let feeAmount = 0;
    const fareBase = estimatedFare || Number(delivery.serviceFare || 0);

    if (feeRule.flatFee) {
      feeAmount = Number(feeRule.flatFee);
    }

    if (feeRule.percentageFee) {
      feeAmount += fareBase * (Number(feeRule.percentageFee) / 100);
    }

    if (feeRule.minFee && feeAmount < Number(feeRule.minFee)) {
      feeAmount = Number(feeRule.minFee);
    }

    if (feeRule.maxFee && feeAmount > Number(feeRule.maxFee)) {
      feeAmount = Number(feeRule.maxFee);
    }

    feeAmount = Math.round(feeAmount * 100) / 100;

    const driverSharePercent = Number(feeRule.driverSharePercentage || 100);
    const platformSharePercent = Number(feeRule.platformSharePercentage || 0);
    const driverShare = Math.round((feeAmount * driverSharePercent / 100) * 100) / 100;
    const platformShare = Math.round((feeAmount * platformSharePercent / 100) * 100) / 100;

    const currency = feeRule.currency || (countryCode === "BD" ? "BDT" : "USD");

    return await prisma.$transaction(async (tx) => {
      let walletTransactionId: string | undefined;
      let platformLedgerEntryId: string | undefined;

      if (delivery.driverId && delivery.driver && driverShare > 0) {
        const driverProfile = delivery.driver;
        
        if (driverProfile.isVerified && driverProfile.verificationStatus === "approved") {
          const wallet = await walletService.getOrCreateWallet({
            ownerId: driverProfile.id,
            ownerType: "driver",
            countryCode,
            currency,
            tx: tx as TransactionClient,
          });

          if (delivery.paymentMethod === "online") {
            const updatedWallet = await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: { increment: driverShare },
              },
            });

            const transaction = await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                ownerType: "driver",
                countryCode,
                serviceType: "cancellation_fee",
                direction: "credit",
                amount: new Prisma.Decimal(driverShare),
                balanceSnapshot: updatedWallet.availableBalance,
                negativeBalanceSnapshot: updatedWallet.negativeBalance,
                referenceType: "delivery",
                referenceId: entityId,
                description: `Cancellation fee for parcel delivery (${cancellationType}): ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
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
                serviceType: "cancellation_fee",
                direction: "credit",
                amount: new Prisma.Decimal(driverShare),
                balanceSnapshot: currentWallet?.availableBalance || new Prisma.Decimal(0),
                negativeBalanceSnapshot: currentWallet?.negativeBalance || new Prisma.Decimal(0),
                referenceType: "delivery",
                referenceId: entityId,
                description: `Cash cancellation fee for parcel delivery (${cancellationType}): ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
              },
            });

            walletTransactionId = transaction.id;
          }
        }
      }

      if (platformShare > 0 && delivery.driverId) {
        const ledgerEntry = await tx.platformRevenueLedger.create({
          data: {
            sourceType: "cancellation_fee",
            serviceType: "parcel",
            referenceType: "delivery",
            referenceId: entityId,
            actorType: "driver",
            actorId: delivery.driverId,
            countryCode,
            currency,
            grossAmount: new Prisma.Decimal(platformShare),
            netAmount: new Prisma.Decimal(platformShare),
            description: `Cancellation fee (${cancellationType}): ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
          },
        });

        platformLedgerEntryId = ledgerEntry.id;
      }

      await tx.delivery.update({
        where: { id: entityId },
        data: {
          cancellationFeeApplied: new Prisma.Decimal(feeAmount),
          cancellationFeeRuleId: feeRule.id,
        },
      });

      return {
        success: true,
        entityId,
        entityType: "delivery" as const,
        feeApplied: true,
        feeAmount,
        driverShare,
        platformShare,
        walletTransactionId,
        platformLedgerEntryId,
      };
    });
  }

  async createCancellationFeeRule(data: {
    countryCode: string;
    serviceType: ServiceType;
    feeType: CancellationFeeType;
    createdByAdminId: string;
    gracePeriodSeconds?: number;
    noShowWaitMinutes?: number;
    currency: string;
    flatFee?: number;
    percentageFee?: number;
    minFee?: number;
    maxFee?: number;
    driverSharePercentage?: number;
    platformSharePercentage?: number;
    requiresDriverArrival?: boolean;
  }): Promise<any> {
    return prisma.cancellationFeeRule.create({
      data: {
        countryCode: data.countryCode,
        serviceType: data.serviceType as any,
        feeType: data.feeType as any,
        createdByAdminId: data.createdByAdminId,
        gracePeriodSeconds: data.gracePeriodSeconds ?? 60,
        noShowWaitMinutes: data.noShowWaitMinutes,
        currency: data.currency,
        flatFee: data.flatFee ? new Prisma.Decimal(data.flatFee) : null,
        percentageFee: data.percentageFee ? new Prisma.Decimal(data.percentageFee) : null,
        minFee: data.minFee ? new Prisma.Decimal(data.minFee) : null,
        maxFee: data.maxFee ? new Prisma.Decimal(data.maxFee) : null,
        driverSharePercentage: new Prisma.Decimal(data.driverSharePercentage ?? 100),
        platformSharePercentage: new Prisma.Decimal(data.platformSharePercentage ?? 0),
        requiresDriverArrival: data.requiresDriverArrival ?? true,
        isActive: true,
      },
    });
  }

  async updateCancellationFeeRule(
    ruleId: string,
    data: Partial<{
      gracePeriodSeconds: number;
      noShowWaitMinutes: number;
      flatFee: number;
      percentageFee: number;
      minFee: number;
      maxFee: number;
      driverSharePercentage: number;
      platformSharePercentage: number;
      requiresDriverArrival: boolean;
      isActive: boolean;
    }>
  ): Promise<any> {
    const updateData: any = {};
    
    if (data.gracePeriodSeconds !== undefined) updateData.gracePeriodSeconds = data.gracePeriodSeconds;
    if (data.noShowWaitMinutes !== undefined) updateData.noShowWaitMinutes = data.noShowWaitMinutes;
    if (data.flatFee !== undefined) updateData.flatFee = new Prisma.Decimal(data.flatFee);
    if (data.percentageFee !== undefined) updateData.percentageFee = new Prisma.Decimal(data.percentageFee);
    if (data.minFee !== undefined) updateData.minFee = new Prisma.Decimal(data.minFee);
    if (data.maxFee !== undefined) updateData.maxFee = new Prisma.Decimal(data.maxFee);
    if (data.driverSharePercentage !== undefined) updateData.driverSharePercentage = new Prisma.Decimal(data.driverSharePercentage);
    if (data.platformSharePercentage !== undefined) updateData.platformSharePercentage = new Prisma.Decimal(data.platformSharePercentage);
    if (data.requiresDriverArrival !== undefined) updateData.requiresDriverArrival = data.requiresDriverArrival;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.cancellationFeeRule.update({
      where: { id: ruleId },
      data: updateData,
    });
  }

  async getActiveCancellationRules(
    countryCode?: string,
    serviceType?: ServiceType
  ): Promise<any[]> {
    return prisma.cancellationFeeRule.findMany({
      where: {
        isActive: true,
        ...(countryCode ? { countryCode } : {}),
        ...(serviceType ? { serviceType } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const cancellationFeeService = new CancellationFeeService();
