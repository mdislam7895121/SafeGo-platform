import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { walletService, TransactionClient } from "./walletService";

export type IncentiveBonusType = "per_trip" | "streak" | "target" | "peak_hour" | "first_trip";
export type ServiceType = "ride" | "food" | "parcel";

export interface TriggerConditions {
  minTrips?: number;
  targetTrips?: number;
  targetEarnings?: number;
  timeWindowHours?: number;
  peakHours?: number[];
  peakDays?: number[];
  maxAwardsPerDay?: number;
  cooldownMinutes?: number;
}

export interface EvaluateIncentivesParams {
  driverId: string;
  serviceType: ServiceType;
  entityId: string;
  countryCode: string;
  tripTimestamp: Date;
}

export interface IncentiveAwardResult {
  ruleId: string;
  ruleName: string;
  bonusType: IncentiveBonusType;
  awardAmount: number;
  currency: string;
  walletTransactionId?: string;
}

export interface EvaluateIncentivesResult {
  success: boolean;
  entityId: string;
  awards: IncentiveAwardResult[];
  error?: string;
}

export class IncentiveService {
  async evaluateIncentives(params: EvaluateIncentivesParams): Promise<EvaluateIncentivesResult> {
    const { driverId, serviceType, entityId, countryCode, tripTimestamp } = params;

    try {
      const activeRules = await prisma.incentiveRule.findMany({
        where: {
          countryCode,
          isActive: true,
          serviceType: serviceType as any,
          startDate: { lte: tripTimestamp },
          OR: [
            { endDate: null },
            { endDate: { gte: tripTimestamp } },
          ],
        },
      });

      const awards: IncentiveAwardResult[] = [];

      for (const rule of activeRules) {
        const qualified = await this.checkRuleQualification(rule, params);
        
        if (qualified) {
          const award = await this.grantAward(rule, params);
          if (award) {
            awards.push(award);
          }
        }
      }

      return {
        success: true,
        entityId,
        awards,
      };
    } catch (error) {
      console.error(`Failed to evaluate incentives for ${entityId}:`, error);
      return {
        success: false,
        entityId,
        awards: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkRuleQualification(
    rule: any,
    params: EvaluateIncentivesParams
  ): Promise<boolean> {
    const { driverId, serviceType, tripTimestamp } = params;
    const conditions = rule.triggerConditions as TriggerConditions || {};

    switch (rule.bonusType) {
      case "per_trip":
        return await this.checkPerTripQualification(rule, driverId, conditions);
      case "streak":
        return await this.checkStreakQualification(rule, driverId, serviceType, conditions, tripTimestamp);
      case "target":
        return await this.checkTargetQualification(rule, driverId, serviceType, conditions, tripTimestamp);
      case "peak_hour":
        return await this.checkPeakHourQualification(conditions, tripTimestamp);
      case "first_trip":
        return await this.checkFirstTripQualification(driverId);
      default:
        return false;
    }
  }

  private async checkPerTripQualification(
    rule: any,
    driverId: string,
    conditions: TriggerConditions
  ): Promise<boolean> {
    if (conditions.maxAwardsPerDay) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const awardsToday = await prisma.incentiveAward.count({
        where: {
          ruleId: rule.id,
          driverId,
          createdAt: { gte: todayStart },
          status: { in: ["granted", "credited"] },
        },
      });

      if (awardsToday >= conditions.maxAwardsPerDay) {
        return false;
      }
    }

    if (conditions.cooldownMinutes) {
      const cooldownStart = new Date(Date.now() - conditions.cooldownMinutes * 60 * 1000);
      
      const recentAward = await prisma.incentiveAward.findFirst({
        where: {
          ruleId: rule.id,
          driverId,
          createdAt: { gte: cooldownStart },
        },
      });

      if (recentAward) {
        return false;
      }
    }

    return true;
  }

  private async checkStreakQualification(
    rule: any,
    driverId: string,
    serviceType: ServiceType,
    conditions: TriggerConditions,
    tripTimestamp: Date
  ): Promise<boolean> {
    const minTrips = conditions.minTrips || 3;
    const windowHours = conditions.timeWindowHours || 24;
    
    const windowStart = new Date(tripTimestamp.getTime() - windowHours * 60 * 60 * 1000);
    
    let recentTrips = 0;

    if (serviceType === "ride") {
      recentTrips = await prisma.ride.count({
        where: {
          driverId,
          status: "completed",
          completedAt: {
            gte: windowStart,
            lte: tripTimestamp,
          },
        },
      });
    } else if (serviceType === "food") {
      recentTrips = await prisma.foodOrder.count({
        where: {
          driverId,
          status: "delivered",
          deliveredAt: {
            gte: windowStart,
            lte: tripTimestamp,
          },
        },
      });
    } else if (serviceType === "parcel") {
      recentTrips = await prisma.delivery.count({
        where: {
          driverId,
          status: "delivered",
          deliveredAt: {
            gte: windowStart,
            lte: tripTimestamp,
          },
        },
      });
    }

    if (recentTrips >= minTrips) {
      const existingAward = await prisma.incentiveAward.findFirst({
        where: {
          ruleId: rule.id,
          driverId,
          createdAt: { gte: windowStart },
          status: { in: ["granted", "credited"] },
        },
      });

      if (!existingAward) {
        return true;
      }
    }

    return false;
  }

  private async checkTargetQualification(
    rule: any,
    driverId: string,
    serviceType: ServiceType,
    conditions: TriggerConditions,
    tripTimestamp: Date
  ): Promise<boolean> {
    const targetTrips = conditions.targetTrips;
    const targetEarnings = conditions.targetEarnings;
    const windowHours = conditions.timeWindowHours || 168;
    
    const windowStart = new Date(tripTimestamp.getTime() - windowHours * 60 * 60 * 1000);
    
    let tripCount = 0;
    let totalEarnings = 0;

    const wallet = await prisma.wallet.findFirst({
      where: { ownerId: driverId, ownerType: "driver" },
    });

    if (wallet) {
      const earnings = await prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          direction: "credit",
          serviceType: { in: ["ride", "food", "parcel"] },
          createdAt: { gte: windowStart, lte: tripTimestamp },
        },
        _sum: { amount: true },
      });
      totalEarnings = Number(earnings._sum.amount || 0);
    }

    if (serviceType === "ride") {
      tripCount = await prisma.ride.count({
        where: {
          driverId,
          status: "completed",
          completedAt: { gte: windowStart, lte: tripTimestamp },
        },
      });
    } else if (serviceType === "food") {
      tripCount = await prisma.foodOrder.count({
        where: {
          driverId,
          status: "delivered",
          deliveredAt: { gte: windowStart, lte: tripTimestamp },
        },
      });
    } else if (serviceType === "parcel") {
      tripCount = await prisma.delivery.count({
        where: {
          driverId,
          status: "delivered",
          deliveredAt: { gte: windowStart, lte: tripTimestamp },
        },
      });
    }

    const tripsQualified = !targetTrips || tripCount >= targetTrips;
    const earningsQualified = !targetEarnings || totalEarnings >= targetEarnings;

    if (tripsQualified && earningsQualified) {
      const existingAward = await prisma.incentiveAward.findFirst({
        where: {
          ruleId: rule.id,
          driverId,
          createdAt: { gte: windowStart },
          status: { in: ["granted", "credited"] },
        },
      });

      if (!existingAward) {
        return true;
      }
    }

    return false;
  }

  private async checkPeakHourQualification(
    conditions: TriggerConditions,
    tripTimestamp: Date
  ): Promise<boolean> {
    const peakHours = conditions.peakHours || [7, 8, 17, 18, 19];
    const peakDays = conditions.peakDays || [1, 2, 3, 4, 5];

    const tripHour = tripTimestamp.getHours();
    const tripDay = tripTimestamp.getDay();

    const isWithinPeakHours = peakHours.includes(tripHour);
    const isOnPeakDay = peakDays.includes(tripDay);

    return isWithinPeakHours && isOnPeakDay;
  }

  private async checkFirstTripQualification(driverId: string): Promise<boolean> {
    const rideCount = await prisma.ride.count({
      where: { driverId, status: "completed" },
    });
    const foodCount = await prisma.foodOrder.count({
      where: { driverId, status: "delivered" },
    });
    const parcelCount = await prisma.delivery.count({
      where: { driverId, status: "delivered" },
    });

    return (rideCount + foodCount + parcelCount) === 1;
  }

  private async grantAward(
    rule: any,
    params: EvaluateIncentivesParams
  ): Promise<IncentiveAwardResult | null> {
    const { driverId, serviceType, entityId, countryCode } = params;
    
    const awardAmount = Number(rule.bonusAmount || 0);
    const currency = rule.currency;

    if (awardAmount <= 0) {
      return null;
    }

    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM incentive_rules WHERE id = ${rule.id} FOR UPDATE`;
      
      const currentRule = await tx.incentiveRule.findUnique({
        where: { id: rule.id },
      });

      if (!currentRule || !currentRule.isActive) {
        console.log(`Rule ${rule.id} is no longer active`);
        return null;
      }

      const currentSpend = Number(currentRule.currentDailySpend || 0);
      const dailyBudget = currentRule.dailyBudget ? Number(currentRule.dailyBudget) : null;
      const totalBudget = currentRule.totalBudget ? Number(currentRule.totalBudget) : null;
      
      if (dailyBudget !== null && currentSpend + awardAmount > dailyBudget) {
        console.log(`Daily budget exhausted for rule ${rule.id}: ${currentSpend} + ${awardAmount} > ${dailyBudget}`);
        return null;
      }

      const totalAwardsSum = await tx.incentiveAward.aggregate({
        where: {
          ruleId: rule.id,
          status: { in: ["granted", "credited"] },
        },
        _sum: { awardAmount: true },
      });
      const totalAwarded = Number(totalAwardsSum._sum.awardAmount || 0);

      if (totalBudget !== null && totalAwarded + awardAmount > totalBudget) {
        console.log(`Total budget exhausted for rule ${rule.id}: ${totalAwarded} + ${awardAmount} > ${totalBudget}`);
        return null;
      }

      const award = await tx.incentiveAward.create({
        data: {
          ruleId: rule.id,
          driverId,
          serviceType: serviceType as any,
          ...(serviceType === "ride" ? { rideId: entityId } : {}),
          ...(serviceType === "food" ? { foodOrderId: entityId } : {}),
          ...(serviceType === "parcel" ? { deliveryId: entityId } : {}),
          countryCode,
          currency,
          awardAmount: new Prisma.Decimal(awardAmount),
          status: "pending",
          triggerDetails: {
            bonusType: currentRule.bonusType,
            ruleName: currentRule.name,
            entityId,
            timestamp: new Date().toISOString(),
          },
        },
      });

      const wallet = await walletService.getOrCreateWallet({
        ownerId: driverId,
        ownerType: "driver",
        countryCode,
        currency,
        tx: tx as TransactionClient,
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: awardAmount },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "driver",
          countryCode,
          serviceType: "incentive",
          direction: "credit",
          amount: new Prisma.Decimal(awardAmount),
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: serviceType === "ride" ? "ride" : serviceType === "food" ? "food_order" : "delivery",
          referenceId: entityId,
          description: `Incentive bonus: ${currentRule.name} (${currentRule.bonusType})`,
        },
      });

      await tx.incentiveAward.update({
        where: { id: award.id },
        data: {
          status: "granted",
          creditedAt: new Date(),
          walletTransactionId: transaction.id,
        },
      });

      await tx.incentiveRule.update({
        where: { id: rule.id },
        data: {
          currentDailySpend: { increment: awardAmount },
        },
      });

      return {
        ruleId: rule.id,
        ruleName: currentRule.name,
        bonusType: currentRule.bonusType as IncentiveBonusType,
        awardAmount,
        currency,
        walletTransactionId: transaction.id,
      };
    });
  }

  async createIncentiveRule(data: {
    name: string;
    description?: string;
    countryCode: string;
    cityCode?: string;
    serviceType: ServiceType;
    bonusType: IncentiveBonusType;
    triggerConditions: TriggerConditions;
    bonusAmount: number;
    bonusPercentage?: number;
    maxBonusAmount?: number;
    currency: string;
    dailyBudget?: number;
    totalBudget?: number;
    startDate: Date;
    endDate?: Date;
    priority?: number;
  }): Promise<any> {
    return prisma.incentiveRule.create({
      data: {
        name: data.name,
        description: data.description,
        countryCode: data.countryCode,
        cityCode: data.cityCode,
        serviceType: data.serviceType as any,
        bonusType: data.bonusType as any,
        triggerConditions: data.triggerConditions as any,
        bonusAmount: new Prisma.Decimal(data.bonusAmount),
        bonusPercentage: data.bonusPercentage ? new Prisma.Decimal(data.bonusPercentage) : null,
        maxBonusAmount: data.maxBonusAmount ? new Prisma.Decimal(data.maxBonusAmount) : null,
        currency: data.currency,
        dailyBudget: data.dailyBudget ? new Prisma.Decimal(data.dailyBudget) : null,
        totalBudget: data.totalBudget ? new Prisma.Decimal(data.totalBudget) : null,
        startDate: data.startDate,
        endDate: data.endDate,
        priority: data.priority ?? 0,
        isActive: true,
      },
    });
  }

  async updateIncentiveRule(
    ruleId: string,
    data: Partial<{
      name: string;
      description: string;
      triggerConditions: TriggerConditions;
      bonusAmount: number;
      dailyBudget: number;
      totalBudget: number;
      startDate: Date;
      endDate: Date;
      isActive: boolean;
      priority: number;
    }>
  ): Promise<any> {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.triggerConditions !== undefined) updateData.triggerConditions = data.triggerConditions;
    if (data.bonusAmount !== undefined) updateData.bonusAmount = new Prisma.Decimal(data.bonusAmount);
    if (data.dailyBudget !== undefined) updateData.dailyBudget = new Prisma.Decimal(data.dailyBudget);
    if (data.totalBudget !== undefined) updateData.totalBudget = new Prisma.Decimal(data.totalBudget);
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.priority !== undefined) updateData.priority = data.priority;

    return prisma.incentiveRule.update({
      where: { id: ruleId },
      data: updateData,
    });
  }

  async getActiveRules(
    countryCode?: string,
    serviceType?: ServiceType
  ): Promise<any[]> {
    return prisma.incentiveRule.findMany({
      where: {
        isActive: true,
        ...(countryCode ? { countryCode } : {}),
        ...(serviceType ? { serviceType: serviceType as any } : {}),
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  async getDriverIncentiveAwards(
    driverId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<any[]> {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    return prisma.incentiveAward.findMany({
      where: {
        driverId,
        status: { in: ["granted", "credited"] },
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      include: {
        rule: {
          select: { name: true, bonusType: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getIncentiveStats(
    countryCode?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalAwarded: number;
    awardCount: number;
    byType: Record<string, { count: number; total: number }>;
    currency: string;
  }> {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const awards = await prisma.incentiveAward.findMany({
      where: {
        status: { in: ["granted", "credited"] },
        ...(countryCode ? { countryCode } : {}),
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      include: {
        rule: { select: { bonusType: true } },
      },
    });

    const byType: Record<string, { count: number; total: number }> = {};
    let totalAwarded = 0;

    for (const award of awards) {
      const amount = Number(award.awardAmount);
      const type = award.rule.bonusType;
      
      totalAwarded += amount;
      
      if (!byType[type]) {
        byType[type] = { count: 0, total: 0 };
      }
      byType[type].count++;
      byType[type].total += amount;
    }

    return {
      totalAwarded,
      awardCount: awards.length,
      byType,
      currency: countryCode === "BD" ? "BDT" : "USD",
    };
  }

  async resetDailyBudgets(): Promise<number> {
    const result = await prisma.incentiveRule.updateMany({
      where: {
        isActive: true,
        dailyBudget: { not: null },
      },
      data: {
        currentDailySpend: new Prisma.Decimal(0),
        lastResetDate: new Date(),
      },
    });
    return result.count;
  }
}

export const incentiveService = new IncentiveService();
