import { db } from "../db";
import { Decimal } from "@prisma/client/runtime/library";
import type { RidePromotion, RidePromotionUsage } from "@prisma/client";

export interface PromoCalculationInput {
  userId: string;
  originalFare: number;
  vehicleCategory: string;
  cityCode?: string;
  surgeMultiplier?: number;
  rideId?: string;
}

export interface PromoCalculationResult {
  originalFare: number;
  discountAmount: number;
  finalFare: number;
  promoId: string | null;
  promoCode: string | null;
  promoLabel: string | null;
  promoDescription: string | null;
}

export interface RidePromotionData {
  id: string;
  name: string;
  description: string | null;
  discountType: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount: number | null;
  appliesTo: "ALL" | "CITY" | "CATEGORY" | "USER_SEGMENT";
  targetCities: string[];
  targetCategories: string[];
  userRule: "ALL_RIDES" | "FIRST_RIDE" | "N_RIDES";
  rideCountLimit: number | null;
  maxSurgeAllowed: number | null;
  isDefault: boolean;
  priority: number;
}

export class RidePromotionService {
  async ensureDefaultPromoExists(): Promise<void> {
    const existingDefault = await db.ridePromotion.findFirst({
      where: { isDefault: true, isActive: true }
    });

    if (!existingDefault) {
      await db.ridePromotion.create({
        data: {
          name: "SafeGo Everyday Saver",
          description: "15% SafeGo promo applied",
          discountType: "PERCENT",
          value: new Decimal(15),
          maxDiscountAmount: new Decimal(10),
          appliesTo: "ALL",
          userRule: "ALL_RIDES",
          isActive: true,
          isDefault: true,
          priority: 100
        }
      });
      console.log("[RidePromotionService] Created default 'SafeGo Everyday Saver' promotion");
    }
  }

  async getActivePromotions(): Promise<RidePromotionData[]> {
    const now = new Date();
    
    const promos = await db.ridePromotion.findMany({
      where: {
        isActive: true,
        OR: [
          { startAt: { lte: now }, endAt: null },
          { startAt: { lte: now }, endAt: { gte: now } }
        ]
      },
      orderBy: [
        { priority: "desc" },
        { isDefault: "desc" }
      ]
    });

    return promos.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      discountType: p.discountType,
      value: Number(p.value),
      maxDiscountAmount: p.maxDiscountAmount ? Number(p.maxDiscountAmount) : null,
      appliesTo: p.appliesTo,
      targetCities: p.targetCities,
      targetCategories: p.targetCategories,
      userRule: p.userRule,
      rideCountLimit: p.rideCountLimit,
      maxSurgeAllowed: p.maxSurgeAllowed ? Number(p.maxSurgeAllowed) : null,
      isDefault: p.isDefault,
      priority: p.priority
    }));
  }

  async getUserRideCount(userId: string): Promise<number> {
    const count = await db.ride.count({
      where: {
        customerId: userId,
        status: "completed"
      }
    });
    return count;
  }

  async getUserPromoUsageCount(userId: string, promoId: string): Promise<number> {
    const count = await db.ridePromotionUsage.count({
      where: {
        userId,
        promotionId: promoId
      }
    });
    return count;
  }

  async isPromoEligible(
    promo: RidePromotionData,
    input: PromoCalculationInput
  ): Promise<boolean> {
    if (promo.maxSurgeAllowed && input.surgeMultiplier) {
      if (input.surgeMultiplier > promo.maxSurgeAllowed) {
        return false;
      }
    }

    switch (promo.appliesTo) {
      case "CITY":
        if (!input.cityCode || !promo.targetCities.includes(input.cityCode)) {
          return false;
        }
        break;
      case "CATEGORY":
        if (!promo.targetCategories.includes(input.vehicleCategory)) {
          return false;
        }
        break;
      case "ALL":
      default:
        break;
    }

    const userRideCount = await this.getUserRideCount(input.userId);

    switch (promo.userRule) {
      case "FIRST_RIDE":
        if (userRideCount > 0) {
          return false;
        }
        break;
      case "N_RIDES":
        if (promo.rideCountLimit && userRideCount >= promo.rideCountLimit) {
          return false;
        }
        break;
      case "ALL_RIDES":
      default:
        break;
    }

    return true;
  }

  calculateDiscount(
    promo: RidePromotionData,
    originalFare: number
  ): number {
    let discount = 0;

    if (promo.discountType === "PERCENT") {
      discount = (originalFare * promo.value) / 100;
      if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
        discount = promo.maxDiscountAmount;
      }
    } else {
      discount = promo.value;
    }

    discount = Math.min(discount, originalFare);
    
    return Math.round(discount * 100) / 100;
  }

  async calculatePromoDiscount(
    input: PromoCalculationInput
  ): Promise<PromoCalculationResult> {
    const activePromos = await this.getActivePromotions();

    for (const promo of activePromos) {
      const isEligible = await this.isPromoEligible(promo, input);
      
      if (isEligible) {
        const discountAmount = this.calculateDiscount(promo, input.originalFare);
        const finalFare = Math.round((input.originalFare - discountAmount) * 100) / 100;

        return {
          originalFare: input.originalFare,
          discountAmount,
          finalFare,
          promoId: promo.id,
          promoCode: promo.name.replace(/\s+/g, "").toUpperCase().substring(0, 10),
          promoLabel: promo.name,
          promoDescription: promo.description
        };
      }
    }

    return {
      originalFare: input.originalFare,
      discountAmount: 0,
      finalFare: input.originalFare,
      promoId: null,
      promoCode: null,
      promoLabel: null,
      promoDescription: null
    };
  }

  async recordPromoUsage(
    promoId: string,
    userId: string,
    rideId: string | null,
    discountApplied: number,
    originalFare: number,
    finalFare: number,
    vehicleCategory?: string,
    cityCode?: string
  ): Promise<void> {
    await db.ridePromotionUsage.create({
      data: {
        promotionId: promoId,
        userId,
        rideId,
        discountApplied: new Decimal(discountApplied),
        originalFare: new Decimal(originalFare),
        finalFare: new Decimal(finalFare),
        vehicleCategory,
        cityCode
      }
    });

    await db.ridePromotion.update({
      where: { id: promoId },
      data: { currentUsageCount: { increment: 1 } }
    });
  }

  async createPromotion(data: {
    name: string;
    description?: string;
    discountType: "PERCENT" | "FLAT";
    value: number;
    maxDiscountAmount?: number;
    appliesTo: "ALL" | "CITY" | "CATEGORY" | "USER_SEGMENT";
    targetCities?: string[];
    targetCategories?: string[];
    targetUserSegments?: string[];
    userRule: "ALL_RIDES" | "FIRST_RIDE" | "N_RIDES";
    rideCountLimit?: number;
    maxSurgeAllowed?: number;
    startAt?: Date;
    endAt?: Date;
    globalUsageLimit?: number;
    usagePerUserLimit?: number;
    isActive?: boolean;
    priority?: number;
    createdBy?: string;
  }) {
    return db.ridePromotion.create({
      data: {
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        value: new Decimal(data.value),
        maxDiscountAmount: data.maxDiscountAmount ? new Decimal(data.maxDiscountAmount) : null,
        appliesTo: data.appliesTo,
        targetCities: data.targetCities || [],
        targetCategories: data.targetCategories || [],
        targetUserSegments: data.targetUserSegments || [],
        userRule: data.userRule,
        rideCountLimit: data.rideCountLimit,
        maxSurgeAllowed: data.maxSurgeAllowed ? new Decimal(data.maxSurgeAllowed) : null,
        startAt: data.startAt || new Date(),
        endAt: data.endAt,
        globalUsageLimit: data.globalUsageLimit,
        usagePerUserLimit: data.usagePerUserLimit,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        createdBy: data.createdBy
      }
    });
  }

  async updatePromotion(id: string, data: Partial<{
    name: string;
    description: string;
    discountType: "PERCENT" | "FLAT";
    value: number;
    maxDiscountAmount: number | null;
    appliesTo: "ALL" | "CITY" | "CATEGORY" | "USER_SEGMENT";
    targetCities: string[];
    targetCategories: string[];
    targetUserSegments: string[];
    userRule: "ALL_RIDES" | "FIRST_RIDE" | "N_RIDES";
    rideCountLimit: number | null;
    maxSurgeAllowed: number | null;
    startAt: Date;
    endAt: Date | null;
    globalUsageLimit: number | null;
    usagePerUserLimit: number | null;
    isActive: boolean;
    priority: number;
  }>) {
    const updateData: any = { ...data };
    
    if (data.value !== undefined) {
      updateData.value = new Decimal(data.value);
    }
    if (data.maxDiscountAmount !== undefined) {
      updateData.maxDiscountAmount = data.maxDiscountAmount ? new Decimal(data.maxDiscountAmount) : null;
    }
    if (data.maxSurgeAllowed !== undefined) {
      updateData.maxSurgeAllowed = data.maxSurgeAllowed ? new Decimal(data.maxSurgeAllowed) : null;
    }

    return db.ridePromotion.update({
      where: { id },
      data: updateData
    });
  }

  async getPromotionById(id: string) {
    return db.ridePromotion.findUnique({
      where: { id },
      include: {
        usages: {
          take: 100,
          orderBy: { appliedAt: "desc" }
        }
      }
    });
  }

  async listPromotions(params: {
    isActive?: boolean;
    skip?: number;
    take?: number;
  } = {}) {
    const { isActive, skip = 0, take = 50 } = params;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [promotions, total] = await Promise.all([
      db.ridePromotion.findMany({
        where,
        skip,
        take,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" }
        ],
        include: {
          _count: {
            select: { usages: true }
          }
        }
      }),
      db.ridePromotion.count({ where })
    ]);

    return { promotions, total };
  }

  async deletePromotion(id: string) {
    await db.ridePromotionUsage.deleteMany({
      where: { promotionId: id }
    });
    
    return db.ridePromotion.delete({
      where: { id }
    });
  }

  async getPromoStats(promoId: string) {
    const usages = await db.ridePromotionUsage.findMany({
      where: { promotionId: promoId }
    });

    const totalDiscountGiven = usages.reduce((sum, u) => sum + Number(u.discountApplied), 0);
    const totalOriginalFare = usages.reduce((sum, u) => sum + Number(u.originalFare), 0);
    const uniqueUsers = new Set(usages.map(u => u.userId)).size;

    return {
      totalUsages: usages.length,
      uniqueUsers,
      totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
      totalOriginalFare: Math.round(totalOriginalFare * 100) / 100,
      averageDiscount: usages.length > 0 ? Math.round((totalDiscountGiven / usages.length) * 100) / 100 : 0
    };
  }
}

export const ridePromotionService = new RidePromotionService();
