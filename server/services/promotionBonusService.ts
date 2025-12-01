import { prisma } from "../lib/prisma";

type ServiceType = "ride" | "food" | "parcel";
type DriverPromotionServiceType = "RIDES" | "FOOD" | "PARCEL" | "ANY";

interface TripCompletionInfo {
  driverId: string;
  tripId: string;
  tripType: ServiceType;
  earnings: number;
  countryCode: string;
  cityCode?: string;
  driverRating?: number;
}

interface BonusResult {
  promotionId: string;
  promotionName: string;
  bonusAmount: number;
  currency: string;
  message: string;
}

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

export class PromotionBonusService {
  
  private mapServiceType(tripType: ServiceType): DriverPromotionServiceType {
    switch (tripType) {
      case "ride": return "RIDES";
      case "food": return "FOOD";
      case "parcel": return "PARCEL";
      default: return "ANY";
    }
  }

  async getActivePromotionsForDriver(driverId: string, countryCode: string, cityCode?: string): Promise<any[]> {
    const now = new Date();
    
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        verificationStatus: true,
        securityStatus: true,
        user: {
          select: {
            countryCode: true
          }
        }
      }
    });

    if (!driverProfile) return [];

    const promotions = await prisma.driverPromotion.findMany({
      where: {
        status: "ACTIVE",
        startAt: { lte: now },
        endAt: { gte: now },
        OR: [
          { countryCode: null },
          { countryCode: countryCode }
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    const filteredPromotions = promotions.filter(promo => {
      if (promo.cityCode && promo.cityCode !== cityCode) return false;
      if (promo.requireKycApproved && driverProfile.verificationStatus !== "approved") return false;
      return true;
    });

    const result = await Promise.all(
      filteredPromotions.map(async (promo) => {
        const progress = await prisma.driverPromotionProgress.findUnique({
          where: {
            promotionId_driverId: {
              promotionId: promo.id,
              driverId: driverId
            }
          }
        });

        return {
          ...promo,
          rewardPerUnit: serializeDecimal(promo.rewardPerUnit),
          targetEarnings: promo.targetEarnings ? serializeDecimal(promo.targetEarnings) : null,
          maxRewardPerDriver: promo.maxRewardPerDriver ? serializeDecimal(promo.maxRewardPerDriver) : null,
          globalBudget: promo.globalBudget ? serializeDecimal(promo.globalBudget) : null,
          currentSpend: serializeDecimal(promo.currentSpend),
          minDriverRating: promo.minDriverRating ? serializeDecimal(promo.minDriverRating) : null,
          progress: progress ? {
            currentTrips: progress.currentTrips,
            currentEarnings: serializeDecimal(progress.currentEarnings),
            totalBonusEarned: serializeDecimal(progress.totalBonusEarned),
            lastUpdatedAt: progress.lastUpdatedAt
          } : null
        };
      })
    );

    return result;
  }

  async evaluateAndAwardBonuses(tripInfo: TripCompletionInfo): Promise<BonusResult[]> {
    const results: BonusResult[] = [];
    const now = new Date();

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { id: tripInfo.driverId },
      include: {
        user: { select: { countryCode: true } },
        driverWallet: true
      }
    });

    if (!driverProfile) {
      console.log(`[PromotionBonus] Driver not found: ${tripInfo.driverId}`);
      return results;
    }

    const serviceTypeFilter = this.mapServiceType(tripInfo.tripType);

    const activePromotions = await prisma.driverPromotion.findMany({
      where: {
        status: "ACTIVE",
        startAt: { lte: now },
        endAt: { gte: now },
        OR: [
          { serviceType: "ANY" },
          { serviceType: serviceTypeFilter }
        ]
      }
    });

    for (const promo of activePromotions) {
      if (promo.countryCode && promo.countryCode !== tripInfo.countryCode) continue;
      if (promo.cityCode && promo.cityCode !== tripInfo.cityCode) continue;
      if (promo.requireKycApproved && driverProfile.verificationStatus !== "approved") continue;

      if (promo.minDriverRating && tripInfo.driverRating) {
        const minRating = serializeDecimal(promo.minDriverRating);
        if (tripInfo.driverRating < minRating) continue;
      }

      if (promo.globalBudget) {
        const budget = serializeDecimal(promo.globalBudget);
        const spent = serializeDecimal(promo.currentSpend);
        if (spent >= budget) continue;
      }

      const bonusResult = await this.processBonusForPromotion(promo, tripInfo, driverProfile);
      if (bonusResult) {
        results.push(bonusResult);
      }
    }

    return results;
  }

  private async processBonusForPromotion(
    promo: any,
    tripInfo: TripCompletionInfo,
    driverProfile: any
  ): Promise<BonusResult | null> {
    const rewardPerUnit = serializeDecimal(promo.rewardPerUnit);
    const maxRewardPerDriver = promo.maxRewardPerDriver ? serializeDecimal(promo.maxRewardPerDriver) : null;

    let progress = await prisma.driverPromotionProgress.findUnique({
      where: {
        promotionId_driverId: {
          promotionId: promo.id,
          driverId: tripInfo.driverId
        }
      }
    });

    if (!progress) {
      progress = await prisma.driverPromotionProgress.create({
        data: {
          promotionId: promo.id,
          driverId: tripInfo.driverId,
          currentTrips: 0,
          currentEarnings: 0,
          totalBonusEarned: 0
        }
      });
    }

    const currentTotalBonus = serializeDecimal(progress.totalBonusEarned);
    if (maxRewardPerDriver && currentTotalBonus >= maxRewardPerDriver) {
      return null;
    }

    let bonusAmount = 0;
    let message = "";

    switch (promo.type) {
      case "PER_TRIP_BONUS":
        bonusAmount = rewardPerUnit;
        message = `Bonus for completing a ${tripInfo.tripType} trip`;
        break;

      case "QUEST_TRIPS":
        const targetTrips = promo.targetTrips || 0;
        const newTripCount = progress.currentTrips + 1;
        
        await prisma.driverPromotionProgress.update({
          where: { id: progress.id },
          data: {
            currentTrips: newTripCount,
            lastUpdatedAt: new Date()
          }
        });

        if (newTripCount >= targetTrips && progress.currentTrips < targetTrips) {
          bonusAmount = rewardPerUnit;
          message = `Quest completed: ${targetTrips} trips milestone reached!`;
        } else {
          return null;
        }
        break;

      case "EARNINGS_THRESHOLD":
        const targetEarnings = promo.targetEarnings ? serializeDecimal(promo.targetEarnings) : 0;
        const currentEarnings = serializeDecimal(progress.currentEarnings);
        const newEarnings = currentEarnings + tripInfo.earnings;

        await prisma.driverPromotionProgress.update({
          where: { id: progress.id },
          data: {
            currentEarnings: newEarnings,
            currentTrips: progress.currentTrips + 1,
            lastUpdatedAt: new Date()
          }
        });

        if (newEarnings >= targetEarnings && currentEarnings < targetEarnings) {
          bonusAmount = rewardPerUnit;
          message = `Earnings threshold reached: $${targetEarnings}!`;
        } else {
          return null;
        }
        break;
    }

    if (bonusAmount <= 0) return null;

    if (maxRewardPerDriver) {
      const remainingAllowance = maxRewardPerDriver - currentTotalBonus;
      bonusAmount = Math.min(bonusAmount, remainingAllowance);
    }

    if (promo.globalBudget) {
      const budgetRemaining = serializeDecimal(promo.globalBudget) - serializeDecimal(promo.currentSpend);
      bonusAmount = Math.min(bonusAmount, budgetRemaining);
    }

    if (bonusAmount <= 0) return null;

    const currency = driverProfile.user?.countryCode === "BD" ? "BDT" : "USD";

    await prisma.$transaction(async (tx) => {
      await tx.driverPromotionProgress.update({
        where: { id: progress!.id },
        data: {
          totalBonusEarned: { increment: bonusAmount },
          lastUpdatedAt: new Date()
        }
      });

      await tx.driverPromotion.update({
        where: { id: promo.id },
        data: {
          currentSpend: { increment: bonusAmount }
        }
      });

      await tx.driverPromotionPayout.create({
        data: {
          promotionId: promo.id,
          driverId: tripInfo.driverId,
          amount: bonusAmount,
          tripType: tripInfo.tripType,
          tripId: tripInfo.tripId
        }
      });

      if (driverProfile.driverWallet) {
        await tx.driverWallet.update({
          where: { id: driverProfile.driverWallet.id },
          data: {
            balance: { increment: bonusAmount }
          }
        });
      }
    });

    return {
      promotionId: promo.id,
      promotionName: promo.name,
      bonusAmount,
      currency,
      message
    };
  }

  async getDriverPromotionHistory(driverId: string, limit: number = 50): Promise<any[]> {
    const payouts = await prisma.driverPromotionPayout.findMany({
      where: { driverId },
      include: {
        promotion: {
          select: {
            id: true,
            name: true,
            type: true,
            serviceType: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return payouts.map((p: any) => ({
      id: p.id,
      promotionId: p.promotionId,
      promotionName: p.promotion.name,
      promotionType: p.promotion.type,
      serviceType: p.promotion.serviceType,
      amount: serializeDecimal(p.amount),
      tripType: p.tripType,
      tripId: p.tripId,
      createdAt: p.createdAt
    }));
  }

  async getDriverPromotionStats(driverId: string): Promise<any> {
    const [totalPayouts, currentMonth, activeProgress] = await Promise.all([
      prisma.driverPromotionPayout.aggregate({
        where: { driverId },
        _sum: { amount: true },
        _count: true
      }),

      prisma.driverPromotionPayout.aggregate({
        where: {
          driverId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { amount: true },
        _count: true
      }),

      prisma.driverPromotionProgress.findMany({
        where: {
          driverId,
          promotion: {
            status: "ACTIVE",
            endAt: { gte: new Date() }
          }
        },
        include: {
          promotion: true
        }
      })
    ]);

    return {
      totalBonusEarned: serializeDecimal(totalPayouts._sum.amount),
      totalBonusCount: totalPayouts._count,
      monthlyBonusEarned: serializeDecimal(currentMonth._sum.amount),
      monthlyBonusCount: currentMonth._count,
      activePromotions: activeProgress.length,
      inProgressQuests: activeProgress.filter((p: any) => 
        p.promotion.type === "QUEST_TRIPS" && 
        p.currentTrips < (p.promotion.targetTrips || 0)
      ).length
    };
  }
}

export const promotionBonusService = new PromotionBonusService();
