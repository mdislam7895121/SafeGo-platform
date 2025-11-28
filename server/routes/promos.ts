/**
 * Promotion Engine API Routes
 * 
 * Provides endpoints for calculating promos, checking eligibility,
 * applying promos to fares, and validating user-entered promo codes.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { PromotionEngine } from "../services/promotionEngine";
import { PromoCodeService } from "../services/promoCodeService";
import { optionalAuth, authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

const PromoCalculationSchema = z.object({
  originalFare: z.number().positive(),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  surgeMultiplier: z.number().min(1).max(10).default(1),
  rideTypeCode: z.string(),
  paymentMethod: z.string().optional(),
  isWalletPayment: z.boolean().optional().default(false),
  countryCode: z.string().default("US"),
  cityCode: z.string().optional(),
});

const ApplyPromoSchema = PromoCalculationSchema.extend({
  selectedPromoType: z.enum([
    "ANCHOR_ONLY",
    "SAVER",
    "FIRST_RIDE",
    "TIME_BASED",
    "LOCATION_BASED",
    "PAYMENT_METHOD",
    "REWARD_POINTS",
    "DRIVER_ARRIVAL",
  ]).optional(),
});

router.post("/calculate", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = PromoCalculationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validation.error.errors,
      });
      return;
    }

    const data = validation.data;
    const userId = req.user?.userId;

    const result = await PromotionEngine.calculateBestPromo({
      userId,
      originalFare: data.originalFare,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      dropoffLat: data.dropoffLat,
      dropoffLng: data.dropoffLng,
      surgeMultiplier: data.surgeMultiplier,
      rideTypeCode: data.rideTypeCode,
      paymentMethod: data.paymentMethod,
      isWalletPayment: data.isWalletPayment,
      countryCode: data.countryCode,
      cityCode: data.cityCode,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      bestPromo: result.bestPromo,
      availablePromos: result.availablePromos,
      eligibilityFlags: result.eligibilityFlags,
    });
  } catch (error) {
    console.error("[Promos] Calculate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate promos",
    });
  }
});

router.post("/apply", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = ApplyPromoSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validation.error.errors,
      });
      return;
    }

    const data = validation.data;
    const userId = req.user?.userId;

    const { promoResult, updatedUsage } = await PromotionEngine.applyPromoToFare(
      {
        userId,
        originalFare: data.originalFare,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        surgeMultiplier: data.surgeMultiplier,
        rideTypeCode: data.rideTypeCode,
        paymentMethod: data.paymentMethod,
        isWalletPayment: data.isWalletPayment,
        countryCode: data.countryCode,
        cityCode: data.cityCode,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
      data.selectedPromoType as any
    );

    res.json({
      success: true,
      promoResult,
      usageUpdated: updatedUsage,
    });
  } catch (error) {
    console.error("[Promos] Apply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply promo",
    });
  }
});

router.get("/eligibility", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.json({
        success: true,
        eligibility: {
          canUseFirstRide: true,
          canUseSaver: true,
          canUseTimeBased: true,
          canUseLocationBased: true,
          canUsePaymentMethod: true,
          weeklyUsesRemaining: 2,
          surgeBlocked: false,
          minimumFareBlocked: false,
        },
        isAuthenticated: false,
      });
      return;
    }

    const result = await PromotionEngine.calculateBestPromo({
      userId,
      originalFare: 20,
      pickupLat: 40.7128,
      pickupLng: -74.0060,
      dropoffLat: 40.7580,
      dropoffLng: -73.9855,
      surgeMultiplier: 1,
      rideTypeCode: "STANDARD",
      countryCode: "US",
    });

    res.json({
      success: true,
      eligibility: result.eligibilityFlags,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("[Promos] Eligibility error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check eligibility",
    });
  }
});

router.get("/loss-protection-config", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: PromotionEngine.LOSS_PROTECTION,
  });
});

const PromoCodeValidationSchema = z.object({
  code: z.string().min(1).max(50),
  originalFare: z.number().positive(),
  rideTypeCode: z.string(),
  countryCode: z.string().optional().default("US"),
  cityCode: z.string().optional(),
  isWalletPayment: z.boolean().optional().default(false),
});

router.post("/code/validate", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = PromoCodeValidationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        valid: false,
        message: "Invalid request body",
        errors: validation.error.errors,
      });
      return;
    }

    const data = validation.data;
    const userId = req.user?.userId;

    const result = await PromoCodeService.validatePromoCode({
      code: data.code,
      userId,
      originalFare: data.originalFare,
      rideTypeCode: data.rideTypeCode,
      countryCode: data.countryCode,
      cityCode: data.cityCode,
      isWalletPayment: data.isWalletPayment,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Promos] Code validation error:", error);
    res.status(500).json({
      success: false,
      valid: false,
      message: "Failed to validate promo code",
    });
  }
});

router.post("/code/apply", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validation = PromoCodeValidationSchema.extend({
      rideId: z.string().optional(),
    }).safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        success: false,
        valid: false,
        message: "Invalid request body",
        errors: validation.error.errors,
      });
      return;
    }

    const data = validation.data;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        valid: false,
        message: "Authentication required",
      });
      return;
    }

    const result = await PromoCodeService.applyPromoCode(
      {
        code: data.code,
        userId,
        originalFare: data.originalFare,
        rideTypeCode: data.rideTypeCode,
        countryCode: data.countryCode,
        cityCode: data.cityCode,
        isWalletPayment: data.isWalletPayment,
      },
      data.rideId
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Promos] Code apply error:", error);
    res.status(500).json({
      success: false,
      valid: false,
      message: "Failed to apply promo code",
    });
  }
});

router.get("/codes/active", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const countryCode = (req.query.countryCode as string) || "US";
    const cityCode = req.query.cityCode as string | undefined;

    const codes = await PromoCodeService.getActivePromoCodes(countryCode, cityCode);

    res.json({
      success: true,
      promoCodes: codes,
    });
  } catch (error) {
    console.error("[Promos] Get active codes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get active promo codes",
    });
  }
});

const CreatePromoCodeSchema = z.object({
  code: z.string().min(3).max(30),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "CAPPED_PERCENTAGE"]),
  discountValue: z.number().positive().max(100),
  maxDiscountAmount: z.number().positive().optional(),
  minFareAmount: z.number().positive().optional(),
  countryCode: z.string().optional(),
  cityCode: z.string().optional(),
  rideTypes: z.array(z.string()).optional(),
  maxTotalUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().optional().default(1),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  firstRideOnly: z.boolean().optional().default(false),
  newUsersOnly: z.boolean().optional().default(false),
  walletPaymentOnly: z.boolean().optional().default(false),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
});

router.post("/admin/codes", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validation = CreatePromoCodeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validation.error.errors,
      });
      return;
    }

    const data = validation.data;
    const adminUserId = req.user?.userId;

    const promoCode = await PromoCodeService.createPromoCode({
      ...data,
      discountType: data.discountType as any,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
      createdBy: adminUserId,
    });

    res.status(201).json({
      success: true,
      promoCode,
    });
  } catch (error: any) {
    console.error("[Promos] Create code error:", error);
    if (error.message === "Promo code already exists") {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to create promo code",
    });
  }
});

router.patch("/admin/codes/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateSchema = z.object({
      isActive: z.boolean().optional(),
      maxTotalUses: z.number().int().positive().optional(),
      maxUsesPerUser: z.number().int().positive().optional(),
      validTo: z.string().datetime().optional(),
      description: z.string().optional(),
      internalNotes: z.string().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validation.error.errors,
      });
      return;
    }

    const data = validation.data;
    const promoCode = await PromoCodeService.updatePromoCode(id, {
      ...data,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
    });

    res.json({
      success: true,
      promoCode,
    });
  } catch (error) {
    console.error("[Promos] Update code error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update promo code",
    });
  }
});

router.get("/admin/codes/:id/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stats = await PromoCodeService.getPromoCodeStats(id);

    if (!stats) {
      res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
      return;
    }

    res.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    console.error("[Promos] Get code stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get promo code stats",
    });
  }
});

export default router;
