import { Prisma, PromotionType, CouponDiscountType } from "@prisma/client";
import { prisma } from "../db";

// ====================================================
// PROMOTION VALIDATION UTILITIES
// Phase 7: Restaurant Promotions & Coupons
// ====================================================

export interface PromotionValidationResult {
  isValid: boolean;
  error?: string;
  discountAmount?: Prisma.Decimal;
  finalAmount?: Prisma.Decimal;
}

export interface CouponValidationResult {
  isValid: boolean;
  error?: string;
  discountAmount?: Prisma.Decimal;
  finalAmount?: Prisma.Decimal;
  coupon?: any;
}

/**
 * Validate if a promotion is currently active and applicable
 */
export function isPromotionActive(promotion: any): boolean {
  if (!promotion.isActive) return false;
  if (promotion.isFlagged) return false;

  const now = new Date();
  const startDate = new Date(promotion.startDate);
  const endDate = new Date(promotion.endDate);

  if (now < startDate || now > endDate) return false;

  // Check global usage limit
  if (promotion.globalUsageLimit && promotion.currentUsageCount >= promotion.globalUsageLimit) {
    return false;
  }

  return true;
}

/**
 * Check if current time is within time window for time-based promotions
 */
export function isWithinTimeWindow(promotion: any): boolean {
  if (!promotion.timeWindowStart || !promotion.timeWindowEnd) return true;

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  return currentTime >= promotion.timeWindowStart && currentTime <= promotion.timeWindowEnd;
}

/**
 * Validate if a promotion can be applied to a specific order
 */
export async function validatePromotionForOrder(
  promotionId: string,
  customerId: string,
  orderAmount: Prisma.Decimal | number,
  restaurantId: string,
  orderItems?: any[]
): Promise<PromotionValidationResult> {
  // Ensure orderAmount is a Prisma.Decimal
  const amount = typeof orderAmount === 'number' ? new Prisma.Decimal(orderAmount) : orderAmount;
  try {
    const promotion = await prisma.promotion.findUnique({
      where: { id: promotionId },
    });

    if (!promotion) {
      return { isValid: false, error: "Promotion not found" };
    }

    // Check if promotion belongs to the restaurant
    if (promotion.restaurantId !== restaurantId) {
      return { isValid: false, error: "Promotion not valid for this restaurant" };
    }

    // Check if promotion is active
    if (!isPromotionActive(promotion)) {
      return { isValid: false, error: "Promotion is not currently active" };
    }

    // Check time window
    if (!isWithinTimeWindow(promotion)) {
      return { isValid: false, error: "Promotion not valid at this time" };
    }

    // Check minimum order amount
    if (promotion.minOrderAmount && amount.lessThan(promotion.minOrderAmount)) {
      return {
        isValid: false,
        error: `Minimum order amount of ${promotion.minOrderAmount} required`,
      };
    }

    // Check per-customer usage limit
    if (promotion.usageLimitPerCustomer) {
      const customerUsageCount = await prisma.foodOrder.count({
        where: {
          customerId,
          appliedPromotionId: promotionId,
          status: { not: "cancelled" },
        },
      });

      if (customerUsageCount >= promotion.usageLimitPerCustomer) {
        return { isValid: false, error: "You have reached the usage limit for this promotion" };
      }
    }

    // Check if first-time customer only
    if (promotion.isFirstTimeCustomerOnly) {
      const previousOrders = await prisma.foodOrder.count({
        where: {
          customerId,
          restaurantId,
          status: "delivered",
        },
      });

      if (previousOrders > 0) {
        return { isValid: false, error: "This promotion is only for first-time customers" };
      }
    }

    // Calculate discount based on promotion type
    const discountAmount = calculatePromotionDiscount(promotion, amount, orderItems);

    if (discountAmount.lessThanOrEqualTo(0)) {
      return { isValid: false, error: "No discount applicable" };
    }

    const finalAmount = Prisma.Decimal.max(amount.minus(discountAmount), new Prisma.Decimal(0));

    return {
      isValid: true,
      discountAmount,
      finalAmount,
    };
  } catch (error) {
    console.error("Promotion validation error:", error);
    return { isValid: false, error: "Failed to validate promotion" };
  }
}

/**
 * Calculate discount amount based on promotion type
 */
export function calculatePromotionDiscount(
  promotion: any,
  orderAmount: Prisma.Decimal | number,
  orderItems?: any[]
): Prisma.Decimal {
  // Ensure orderAmount is a Prisma.Decimal
  const amount = typeof orderAmount === 'number' ? new Prisma.Decimal(orderAmount) : orderAmount;
  let discountAmount = new Prisma.Decimal(0);

  switch (promotion.promoType) {
    case "percentage_discount":
      if (promotion.discountPercentage) {
        const percentage = typeof promotion.discountPercentage === 'number' 
          ? new Prisma.Decimal(promotion.discountPercentage) 
          : promotion.discountPercentage;
        discountAmount = amount.mul(percentage).div(100);
      }
      break;

    case "fixed_discount":
      if (promotion.discountValue) {
        discountAmount = typeof promotion.discountValue === 'number'
          ? new Prisma.Decimal(promotion.discountValue)
          : promotion.discountValue;
      }
      break;

    case "bogo":
      // BOGO: Calculate discount based on cheapest qualifying items
      // This is simplified - actual implementation would need item details
      if (promotion.buyQuantity && promotion.getQuantity && orderItems) {
        // Calculate average item price and apply get_quantity discount
        const avgItemPrice = amount.div(orderItems.length);
        discountAmount = avgItemPrice.mul(promotion.getQuantity);
      }
      break;

    case "category_discount":
    case "time_window":
    case "first_time_customer":
      // Apply percentage or fixed discount
      if (promotion.discountPercentage) {
        const percentage = typeof promotion.discountPercentage === 'number' 
          ? new Prisma.Decimal(promotion.discountPercentage) 
          : promotion.discountPercentage;
        discountAmount = amount.mul(percentage).div(100);
      } else if (promotion.discountValue) {
        discountAmount = typeof promotion.discountValue === 'number'
          ? new Prisma.Decimal(promotion.discountValue)
          : promotion.discountValue;
      }
      break;
  }

  // Apply max discount cap if set
  if (promotion.maxDiscountCap) {
    const maxCap = typeof promotion.maxDiscountCap === 'number'
      ? new Prisma.Decimal(promotion.maxDiscountCap)
      : promotion.maxDiscountCap;
    if (discountAmount.greaterThan(maxCap)) {
      discountAmount = maxCap;
    }
  }

  return discountAmount;
}

/**
 * Validate coupon code and return coupon details if valid
 */
export async function validateCouponCode(
  code: string,
  customerId: string,
  orderAmount: Prisma.Decimal | number,
  restaurantId: string
): Promise<CouponValidationResult> {
  // Ensure orderAmount is a Prisma.Decimal
  const amount = typeof orderAmount === 'number' ? new Prisma.Decimal(orderAmount) : orderAmount;
  try {
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        restaurantId,
      },
    });

    if (!coupon) {
      return { isValid: false, error: "Invalid coupon code" };
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return { isValid: false, error: "This coupon is no longer active" };
    }

    if (coupon.isFlagged) {
      return { isValid: false, error: "This coupon has been flagged and cannot be used" };
    }

    // Check validity period
    const now = new Date();
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);

    if (now < startDate) {
      return { isValid: false, error: "This coupon is not yet valid" };
    }

    if (now > endDate) {
      return { isValid: false, error: "This coupon has expired" };
    }

    // Check global usage limit
    if (coupon.globalUsageLimit && coupon.currentUsageCount >= coupon.globalUsageLimit) {
      return { isValid: false, error: "This coupon has reached its usage limit" };
    }

    // Check per-customer usage limit
    if (coupon.usageLimitPerCustomer) {
      const customerUsageCount = await prisma.foodOrder.count({
        where: {
          customerId,
          appliedCouponCode: code.toUpperCase(),
          status: { not: "cancelled" },
        },
      });

      if (customerUsageCount >= coupon.usageLimitPerCustomer) {
        return { isValid: false, error: "You have already used this coupon the maximum number of times" };
      }
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && amount.lessThan(coupon.minOrderAmount)) {
      return {
        isValid: false,
        error: `Minimum order amount of ${coupon.minOrderAmount} required for this coupon`,
      };
    }

    // Calculate discount
    let discountAmount = new Prisma.Decimal(0);

    if (coupon.discountType === "percentage" && coupon.discountPercentage) {
      const percentage = typeof coupon.discountPercentage === 'number'
        ? new Prisma.Decimal(coupon.discountPercentage)
        : coupon.discountPercentage;
      discountAmount = amount.mul(percentage).div(100);
    } else if (coupon.discountType === "fixed_amount" && coupon.discountValue) {
      discountAmount = typeof coupon.discountValue === 'number'
        ? new Prisma.Decimal(coupon.discountValue)
        : coupon.discountValue;
    }

    // Apply max discount cap if set
    if (coupon.maxDiscountCap) {
      const maxCap = typeof coupon.maxDiscountCap === 'number'
        ? new Prisma.Decimal(coupon.maxDiscountCap)
        : coupon.maxDiscountCap;
      if (discountAmount.greaterThan(maxCap)) {
        discountAmount = maxCap;
      }
    }

    if (discountAmount.lessThanOrEqualTo(0)) {
      return { isValid: false, error: "No discount applicable from this coupon" };
    }

    const finalAmount = Prisma.Decimal.max(amount.minus(discountAmount), new Prisma.Decimal(0));

    return {
      isValid: true,
      discountAmount,
      finalAmount,
      coupon,
    };
  } catch (error) {
    console.error("Coupon validation error:", error);
    return { isValid: false, error: "Failed to validate coupon" };
  }
}

/**
 * Increment promotion usage count after successful order
 */
export async function incrementPromotionUsage(promotionId: string): Promise<void> {
  await prisma.promotion.update({
    where: { id: promotionId },
    data: { currentUsageCount: { increment: 1 } },
  });
}

/**
 * Increment coupon usage count after successful order
 */
export async function incrementCouponUsage(code: string, restaurantId: string): Promise<void> {
  await prisma.coupon.updateMany({
    where: {
      code: code.toUpperCase(),
      restaurantId,
    },
    data: { currentUsageCount: { increment: 1 } },
  });
}

/**
 * Generate random coupon code
 */
export function generateCouponCode(length: number = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a coupon code already exists for a restaurant
 */
export async function isCouponCodeUnique(code: string, restaurantId: string): Promise<boolean> {
  const existing = await prisma.coupon.findFirst({
    where: {
      code: code.toUpperCase(),
      restaurantId,
    },
  });
  return !existing;
}
