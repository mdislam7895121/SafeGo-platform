import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

interface PricingBreakdown {
  basePrice: number;
  surgeMultiplier: number;
  surgeAmount: number;
  subtotalAfterSurge: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  appliedPromotions: string[];
  appliedCoupons: string[];
}

// GET /api/customer/restaurants/:id/pricing
// Returns comprehensive dynamic pricing breakdown for a restaurant
router.get("/:id/pricing", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id: restaurantId } = req.params;
    const userId = req.user!.userId;

    // Get customer profile
    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // KYC verification check
    if (!customer.isVerified) {
      return res.status(403).json({
        error: "verification_required",
        message: "Customer verification required to view location-based pricing",
      });
    }

    // Get restaurant profile
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: restaurantId },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // City/Country matching for location-based pricing
    if (customer.user.countryCode !== restaurant.user.countryCode) {
      return res.status(403).json({
        error: "country_mismatch",
        message: "Restaurant not available in your country",
      });
    }

    // City matching: allow if restaurant is nationwide (null) or customer is in same city
    const cityMatch = !restaurant.cityCode || restaurant.cityCode === customer.cityCode;
    if (!cityMatch) {
      return res.status(403).json({
        error: "city_mismatch",
        message: "Restaurant not available in your city",
      });
    }

    // Get operational settings
    const operational = await prisma.operationalSettings.findUnique({
      where: { restaurantId },
    });

    // Get current day and time for surge/hours calculation
    const now = new Date();
    const currentDayOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Get today's business hours
    const todayHours = await prisma.restaurantHours.findFirst({
      where: {
        restaurantId,
        dayOfWeek: currentDayOfWeek as any,
      },
    });

    // Calculate real-time open status
    let isOpen = false;
    if (todayHours && !todayHours.isClosed && !operational?.isTemporarilyClosed) {
      const { openTime1, closeTime1, openTime2, closeTime2 } = todayHours;
      
      // Check if within first shift
      if (openTime1 && closeTime1) {
        if (currentTime >= openTime1 && currentTime <= closeTime1) {
          isOpen = true;
        }
      }
      
      // Check if within second shift (split shift)
      if (!isOpen && openTime2 && closeTime2) {
        if (currentTime >= openTime2 && currentTime <= closeTime2) {
          isOpen = true;
        }
      }
    }

    // Get surge pricing settings
    const surgeSettings = await prisma.surgeSettings.findFirst({
      where: { restaurantId },
    });

    // Calculate surge multiplier
    let surgeMultiplier = 1.0;
    let surgeReason = null;

    if (surgeSettings?.surgeEnabled && isOpen) {
      // Check time-based surge (peak hours)
      const peakHours = (surgeSettings.peakHours as string[]) || [];
      const currentHour = now.getHours();
      
      if (peakHours.includes(String(currentHour))) {
        surgeMultiplier = Math.max(surgeMultiplier, Number(surgeSettings.surgeMultiplier) || 1.0);
        surgeReason = "peak_hours";
      }

      // Check weekend surge
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      if (isWeekend && surgeSettings.weekendMultiplier) {
        const weekendMult = Number(surgeSettings.weekendMultiplier);
        if (weekendMult > surgeMultiplier) {
          surgeMultiplier = weekendMult;
          surgeReason = "weekend";
        }
      }
    }

    // Check throttling status (high demand indicator)
    let isThrottled = false;
    if (operational?.maxConcurrentOrders) {
      const activeOrderCount = await prisma.foodOrder.count({
        where: {
          restaurantId,
          status: { in: ["placed", "confirmed", "preparing", "ready_for_pickup"] },
        },
      });
      const utilizationRate = activeOrderCount / operational.maxConcurrentOrders;
      isThrottled = utilizationRate >= 0.8; // 80% capacity = throttled
    }

    // Get active promotions for this restaurant
    const activePromotions = await prisma.promotion.findMany({
      where: {
        restaurantId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: {
        discountPercentage: "desc", // Best discount first
      },
    });

    // Filter promotions by time window if applicable
    const eligiblePromotions = activePromotions.filter((promo: any) => {
      if (promo.timeWindowStart && promo.timeWindowEnd) {
        return currentTime >= promo.timeWindowStart && currentTime <= promo.timeWindowEnd;
      }
      return true;
    });

    // Get customer's order count (for first-time customer promotions)
    const orderCount = await prisma.foodOrder.count({
      where: { customerId: customer.id },
    });

    const isFirstTimeCustomer = orderCount === 0;

    // Filter promotions for first-time customers
    const customerEligiblePromotions = eligiblePromotions.filter((promo: any) => {
      if (promo.promoType === "first_time_customer") {
        return isFirstTimeCustomer;
      }
      return true;
    });

    // Get active coupons (codes that customer could potentially use)
    const activeCoupons = await prisma.coupon.findMany({
      where: {
        restaurantId,
        isActive: true,
        isFlagged: false,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      take: 5, // Show top 5 available coupons
    });

    // Calculate best discount (percentage-based for display)
    let bestDiscountPercent = 0;
    const appliedPromotions: string[] = [];

    for (const promo of customerEligiblePromotions) {
      if (promo.discountPercentage) {
        const discountPercent = Number(promo.discountPercentage);
        if (discountPercent > bestDiscountPercent) {
          bestDiscountPercent = discountPercent;
          appliedPromotions.length = 0; // Clear previous
          appliedPromotions.push(promo.title);
        }
      }
    }

    // Prepare pricing breakdown (for a hypothetical $100 base order)
    const basePriceExample = 100;
    const surgeAmount = basePriceExample * (surgeMultiplier - 1);
    const subtotalAfterSurge = basePriceExample * surgeMultiplier;
    const discountAmount = subtotalAfterSurge * (bestDiscountPercent / 100);
    const finalPrice = subtotalAfterSurge - discountAmount;

    const pricingBreakdown: PricingBreakdown = {
      basePrice: basePriceExample,
      surgeMultiplier,
      surgeAmount,
      subtotalAfterSurge,
      discountPercent: bestDiscountPercent,
      discountAmount,
      finalPrice,
      appliedPromotions,
      appliedCoupons: [], // Coupons applied at checkout
    };

    // Get delivery zone eligibility (simplified - actual calculation in status endpoint)
    const deliveryZones = await prisma.deliveryZone.findMany({
      where: { restaurantId },
    });

    const hasDeliveryZones = deliveryZones.length > 0;
    const deliveryZoneEligible = hasDeliveryZones; // Simplified for pricing display

    // Prepare response payload
    const response = {
      basePriceMultiplier: 1.0,
      surgeMultiplier,
      surgeReason,
      discountPercent: bestDiscountPercent,
      activePromotions: customerEligiblePromotions.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        promoType: p.promoType,
        discountPercentage: p.discountPercentage ? Number(p.discountPercentage) : null,
        discountValue: p.discountValue ? Number(p.discountValue) : null,
        minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
        maxDiscountCap: p.maxDiscountCap ? Number(p.maxDiscountCap) : null,
        timeWindowStart: p.timeWindowStart,
        timeWindowEnd: p.timeWindowEnd,
      })),
      couponEligibility: activeCoupons.map((c: any) => ({
        code: c.code,
        discountType: c.discountType,
        discountPercentage: c.discountPercentage ? Number(c.discountPercentage) : null,
        discountValue: c.discountValue ? Number(c.discountValue) : null,
        minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
        maxDiscountCap: c.maxDiscountCap ? Number(c.maxDiscountCap) : null,
      })),
      prepTimeMinutes: operational?.preparationTimeMinutes || null,
      realTimeOpenStatus: isOpen,
      deliveryZoneEligible,
      throttlingLimitReached: isThrottled,
      dynamicPricingBreakdown: pricingBreakdown,
    };

    // Audit log for pricing view
    await prisma.auditLog.create({
      data: {
        actorId: customer.id,
        actorEmail: customer.user.email,
        actorRole: "customer",
        actionType: "PRICING_VIEW",
        entityType: "restaurant_pricing",
        entityId: restaurantId,
        description: `Customer viewed pricing for restaurant ${restaurantId}`,
        metadata: {
          customerId: customer.id,
          surgeMultiplier,
          bestDiscountPercent,
          isOpen,
          isThrottled,
        },
        ipAddress: req.ip || null,
        success: true,
      },
    });

    return res.json(response);
  } catch (error) {
    console.error("[Pricing API] Error:", error);
    return res.status(500).json({ error: "Failed to fetch pricing information" });
  }
});

export default router;
