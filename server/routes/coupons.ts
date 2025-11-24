import { Router } from "express";
import { prisma } from "../db";

const router = Router();

// POST /api/coupons/validate - Validate coupon code for checkout
router.post("/validate", async (req, res) => {
  try {
    const {
      restaurantId,
      customerId,
      items = [],
      subtotal,
      currency = "USD",
      couponCode,
    } = req.body;

    // Validation
    if (!restaurantId || !couponCode || subtotal === undefined) {
      return res.status(400).json({
        valid: false,
        reasonCode: "MISSING_REQUIRED_FIELDS",
        messages: ["Restaurant ID, coupon code, and subtotal are required"],
      });
    }

    // Find coupon
    const coupon = await prisma.coupon.findUnique({
      where: {
        restaurantId_code: { restaurantId, code: couponCode },
      },
      include: {
        promotion: {
          include: {
            _count: {
              select: { promotionUsages: true },
            },
          },
        },
      },
    });

    if (!coupon) {
      return res.status(404).json({
        valid: false,
        reasonCode: "COUPON_NOT_FOUND",
        messages: ["Invalid coupon code"],
      });
    }

    // Check if coupon belongs to the same restaurant
    if (coupon.restaurantId !== restaurantId) {
      return res.status(400).json({
        valid: false,
        reasonCode: "INVALID_RESTAURANT",
        messages: ["This coupon is not valid for this restaurant"],
      });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({
        valid: false,
        reasonCode: "COUPON_INACTIVE",
        messages: ["This coupon is no longer active"],
      });
    }

    // Check time window
    const now = new Date();
    if (now < coupon.startDate) {
      return res.status(400).json({
        valid: false,
        reasonCode: "COUPON_NOT_YET_ACTIVE",
        messages: [`This coupon will be active starting ${coupon.startDate.toLocaleDateString()}`],
      });
    }

    if (now > coupon.endDate) {
      return res.status(400).json({
        valid: false,
        reasonCode: "COUPON_EXPIRED",
        messages: [`This coupon expired on ${coupon.endDate.toLocaleDateString()}`],
      });
    }

    // Check global usage limit
    if (coupon.globalUsageLimit && coupon.currentUsageCount >= coupon.globalUsageLimit) {
      return res.status(400).json({
        valid: false,
        reasonCode: "USAGE_LIMIT_REACHED",
        messages: ["This coupon has reached its usage limit"],
      });
    }

    // Check per-customer usage limit
    if (customerId && coupon.usageLimitPerCustomer) {
      const customerUsageCount = await prisma.promotionUsage.count({
        where: {
          couponId: coupon.id,
          customerId,
        },
      });

      if (customerUsageCount >= coupon.usageLimitPerCustomer) {
        return res.status(400).json({
          valid: false,
          reasonCode: "CUSTOMER_USAGE_LIMIT_REACHED",
          messages: ["You have already used this coupon the maximum number of times"],
        });
      }
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && subtotal < parseFloat(coupon.minOrderAmount.toString())) {
      return res.status(400).json({
        valid: false,
        reasonCode: "MINIMUM_ORDER_NOT_MET",
        messages: [`Minimum order amount of ${currency} ${coupon.minOrderAmount} required`],
      });
    }

    // Check promotion status if linked
    if (coupon.promotion) {
      if (coupon.promotion.status !== "ACTIVE") {
        return res.status(400).json({
          valid: false,
          reasonCode: "PROMOTION_NOT_ACTIVE",
          messages: ["The associated promotion is not currently active"],
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      const percentage = parseFloat(coupon.discountPercentage?.toString() || "0");
      discountAmount = (subtotal * percentage) / 100;
    } else if (coupon.discountType === "fixed_amount") {
      discountAmount = parseFloat(coupon.discountValue?.toString() || "0");
    }

    // Apply max discount cap if specified
    if (coupon.maxDiscountCap && discountAmount > parseFloat(coupon.maxDiscountCap.toString())) {
      discountAmount = parseFloat(coupon.maxDiscountCap.toString());
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    const newTotal = subtotal - discountAmount;

    // Return success response
    return res.json({
      valid: true,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      newTotal: parseFloat(newTotal.toFixed(2)),
      appliedPromotionId: coupon.promotionId,
      couponId: coupon.id,
      messages: [`Coupon applied: ${currency} ${discountAmount.toFixed(2)} off`],
    });
  } catch (error: any) {
    console.error("Coupon validation error:", error);
    return res.status(500).json({
      valid: false,
      reasonCode: "SERVER_ERROR",
      messages: ["Failed to validate coupon"],
    });
  }
});

export default router;
