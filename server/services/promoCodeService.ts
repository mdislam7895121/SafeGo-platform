import { prisma } from "../db";
import { RidePromoDiscountType, Prisma } from "@prisma/client";

export interface PromoCodeValidationContext {
  code: string;
  userId?: string;
  originalFare: number;
  rideTypeCode: string;
  countryCode?: string;
  cityCode?: string;
  isWalletPayment?: boolean;
}

export interface PromoCodeValidationResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  discountPercent: number;
  finalFare: number;
  displayMessage: string;
  errorCode?: string;
  errorMessage?: string;
  promoCodeId?: string;
  discountType?: RidePromoDiscountType;
}

function toNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return 0;
}

export class PromoCodeService {
  static async validatePromoCode(
    context: PromoCodeValidationContext
  ): Promise<PromoCodeValidationResult> {
    const { code, userId, originalFare, rideTypeCode, countryCode, cityCode, isWalletPayment } = context;
    const normalizedCode = code.trim().toUpperCase();

    const promoCode = await prisma.ridePromoCode.findUnique({
      where: { code: normalizedCode },
      include: {
        usages: userId ? {
          where: { userId },
        } : false,
      },
    });

    if (!promoCode) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "INVALID_CODE",
        errorMessage: "This promo code is not valid",
      };
    }

    if (!promoCode.isActive) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "CODE_INACTIVE",
        errorMessage: "This promo code is no longer active",
      };
    }

    const now = new Date();
    if (promoCode.validFrom && now < promoCode.validFrom) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "CODE_NOT_YET_ACTIVE",
        errorMessage: "This promo code is not yet active",
      };
    }

    if (promoCode.validTo && now > promoCode.validTo) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "CODE_EXPIRED",
        errorMessage: "This promo code has expired",
      };
    }

    if (promoCode.maxTotalUses && promoCode.currentUsageCount >= promoCode.maxTotalUses) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "USAGE_LIMIT_REACHED",
        errorMessage: "This promo code has reached its usage limit",
      };
    }

    if (promoCode.countryCode && countryCode && promoCode.countryCode !== countryCode) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "COUNTRY_NOT_ELIGIBLE",
        errorMessage: "This promo code is not available in your region",
      };
    }

    if (promoCode.cityCode && cityCode && promoCode.cityCode !== cityCode) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "CITY_NOT_ELIGIBLE",
        errorMessage: "This promo code is not available in your city",
      };
    }

    if (promoCode.rideTypes && promoCode.rideTypes.length > 0 && !promoCode.rideTypes.includes(rideTypeCode)) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "RIDE_TYPE_NOT_ELIGIBLE",
        errorMessage: `This promo code is not valid for ${rideTypeCode} rides`,
      };
    }

    if (promoCode.walletPaymentOnly && !isWalletPayment) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "WALLET_PAYMENT_REQUIRED",
        errorMessage: "This promo code requires SafeGo Wallet payment",
      };
    }

    const minFare = toNumber(promoCode.minFareAmount);
    if (minFare > 0 && originalFare < minFare) {
      return {
        valid: false,
        code: normalizedCode,
        discountAmount: 0,
        discountPercent: 0,
        finalFare: originalFare,
        displayMessage: "",
        errorCode: "MINIMUM_FARE_NOT_MET",
        errorMessage: `Minimum fare of $${minFare.toFixed(2)} required for this promo`,
      };
    }

    if (userId) {
      if (promoCode.firstRideOnly) {
        const hasCompletedRide = await prisma.ride.findFirst({
          where: { 
            customerId: userId,
            status: "COMPLETED",
          },
        });
        if (hasCompletedRide) {
          return {
            valid: false,
            code: normalizedCode,
            discountAmount: 0,
            discountPercent: 0,
            finalFare: originalFare,
            displayMessage: "",
            errorCode: "FIRST_RIDE_ONLY",
            errorMessage: "This promo code is only valid for first rides",
          };
        }
      }

      if (promoCode.newUsersOnly) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdAt: true },
        });
        if (user) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (user.createdAt < sevenDaysAgo) {
            return {
              valid: false,
              code: normalizedCode,
              discountAmount: 0,
              discountPercent: 0,
              finalFare: originalFare,
              displayMessage: "",
              errorCode: "NEW_USERS_ONLY",
              errorMessage: "This promo code is only valid for new users",
            };
          }
        }
      }

      const userUsages = promoCode.usages || [];
      if (promoCode.maxUsesPerUser && userUsages.length >= promoCode.maxUsesPerUser) {
        return {
          valid: false,
          code: normalizedCode,
          discountAmount: 0,
          discountPercent: 0,
          finalFare: originalFare,
          displayMessage: "",
          errorCode: "USER_USAGE_LIMIT_REACHED",
          errorMessage: "You have already used this promo code",
        };
      }
    }

    const discountValue = toNumber(promoCode.discountValue);
    const maxDiscount = promoCode.maxDiscountAmount ? toNumber(promoCode.maxDiscountAmount) : null;
    let discountAmount = 0;
    let discountPercent = 0;

    switch (promoCode.discountType) {
      case "PERCENTAGE":
        discountPercent = discountValue;
        discountAmount = originalFare * (discountPercent / 100);
        break;
      case "FIXED_AMOUNT":
        discountAmount = Math.min(discountValue, originalFare);
        discountPercent = (discountAmount / originalFare) * 100;
        break;
      case "CAPPED_PERCENTAGE":
        discountPercent = discountValue;
        discountAmount = originalFare * (discountPercent / 100);
        if (maxDiscount && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
          discountPercent = (discountAmount / originalFare) * 100;
        }
        break;
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    discountPercent = Math.round(discountPercent * 100) / 100;
    const finalFare = Math.max(0, Math.round((originalFare - discountAmount) * 100) / 100);

    const displayMessage = discountAmount > 0 
      ? `You save $${discountAmount.toFixed(2)} with code ${normalizedCode}!`
      : "";

    return {
      valid: true,
      code: normalizedCode,
      discountAmount,
      discountPercent,
      finalFare,
      displayMessage,
      promoCodeId: promoCode.id,
      discountType: promoCode.discountType,
    };
  }

  static async applyPromoCode(
    context: PromoCodeValidationContext,
    rideId?: string
  ): Promise<PromoCodeValidationResult> {
    const result = await this.validatePromoCode(context);

    if (!result.valid || !result.promoCodeId || !context.userId) {
      return result;
    }

    try {
      await prisma.$transaction([
        prisma.ridePromoCode.update({
          where: { id: result.promoCodeId },
          data: { currentUsageCount: { increment: 1 } },
        }),
        prisma.ridePromoCodeUsage.create({
          data: {
            promoCodeId: result.promoCodeId,
            userId: context.userId,
            rideId: rideId || null,
            discountApplied: new Prisma.Decimal(result.discountAmount),
            originalFare: new Prisma.Decimal(context.originalFare),
            finalFare: new Prisma.Decimal(result.finalFare),
          },
        }),
      ]);
    } catch (error) {
      console.error("[PromoCodeService] Failed to record promo usage:", error);
    }

    return result;
  }

  static async getActivePromoCodes(countryCode?: string, cityCode?: string): Promise<any[]> {
    const now = new Date();
    
    const promoCodes = await prisma.ridePromoCode.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [
          { validTo: null },
          { validTo: { gte: now } },
        ],
        ...(countryCode ? {
          OR: [
            { countryCode: null },
            { countryCode },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return promoCodes.map(pc => ({
      code: pc.code,
      discountType: pc.discountType,
      discountValue: toNumber(pc.discountValue),
      maxDiscountAmount: pc.maxDiscountAmount ? toNumber(pc.maxDiscountAmount) : null,
      minFareAmount: pc.minFareAmount ? toNumber(pc.minFareAmount) : null,
      description: pc.description,
      validTo: pc.validTo,
      firstRideOnly: pc.firstRideOnly,
      newUsersOnly: pc.newUsersOnly,
    }));
  }

  static async createPromoCode(data: {
    code: string;
    discountType: RidePromoDiscountType;
    discountValue: number;
    maxDiscountAmount?: number;
    minFareAmount?: number;
    countryCode?: string;
    cityCode?: string;
    rideTypes?: string[];
    maxTotalUses?: number;
    maxUsesPerUser?: number;
    validFrom?: Date;
    validTo?: Date;
    firstRideOnly?: boolean;
    newUsersOnly?: boolean;
    walletPaymentOnly?: boolean;
    description?: string;
    internalNotes?: string;
    createdBy?: string;
  }): Promise<any> {
    const normalizedCode = data.code.trim().toUpperCase();

    const existing = await prisma.ridePromoCode.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new Error("Promo code already exists");
    }

    const promoCode = await prisma.ridePromoCode.create({
      data: {
        code: normalizedCode,
        discountType: data.discountType,
        discountValue: new Prisma.Decimal(data.discountValue),
        maxDiscountAmount: data.maxDiscountAmount ? new Prisma.Decimal(data.maxDiscountAmount) : null,
        minFareAmount: data.minFareAmount ? new Prisma.Decimal(data.minFareAmount) : null,
        countryCode: data.countryCode || null,
        cityCode: data.cityCode || null,
        rideTypes: data.rideTypes || [],
        maxTotalUses: data.maxTotalUses || null,
        maxUsesPerUser: data.maxUsesPerUser ?? 1,
        validFrom: data.validFrom || new Date(),
        validTo: data.validTo || null,
        firstRideOnly: data.firstRideOnly || false,
        newUsersOnly: data.newUsersOnly || false,
        walletPaymentOnly: data.walletPaymentOnly || false,
        description: data.description || null,
        internalNotes: data.internalNotes || null,
        createdBy: data.createdBy || null,
        isActive: true,
      },
    });

    return promoCode;
  }

  static async updatePromoCode(
    id: string,
    data: Partial<{
      isActive: boolean;
      maxTotalUses: number;
      maxUsesPerUser: number;
      validTo: Date;
      description: string;
      internalNotes: string;
    }>
  ): Promise<any> {
    const promoCode = await prisma.ridePromoCode.update({
      where: { id },
      data,
    });
    return promoCode;
  }

  static async getPromoCodeStats(id: string): Promise<any> {
    const promoCode = await prisma.ridePromoCode.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!promoCode) {
      return null;
    }

    const totalDiscountGiven = await prisma.ridePromoCodeUsage.aggregate({
      where: { promoCodeId: id },
      _sum: { discountApplied: true },
    });

    return {
      promoCode,
      totalUsages: promoCode._count.usages,
      totalDiscountGiven: totalDiscountGiven._sum.discountApplied 
        ? toNumber(totalDiscountGiven._sum.discountApplied) 
        : 0,
    };
  }
}

export default PromoCodeService;
