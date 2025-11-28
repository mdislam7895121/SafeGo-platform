/**
 * Promotion Engine API Routes
 * 
 * Provides endpoints for calculating promos, checking eligibility,
 * and applying promos to fares.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { PromotionEngine } from "../services/promotionEngine";
import { optionalAuth, AuthRequest } from "../middleware/auth";

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

export default router;
