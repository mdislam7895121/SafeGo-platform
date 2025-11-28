/**
 * Fare Calculation API Routes
 * 
 * Provides endpoints for multi-route fare calculation with:
 * - Per-route fare breakdown
 * - Regulatory fee detection
 * - Toll calculation
 * - Driver payout estimation
 */

import { Router } from "express";
import { z } from "zod";
import { authenticateToken, AuthRequest, optionalAuth } from "../middleware/auth";
import { 
  fareCalculationService, 
  type RouteInfo,
  type FareCalculationResult,
  type RideTypeCode 
} from "../services/fareCalculationService";

const router = Router();

// Validation schemas
const routeInfoSchema = z.object({
  routeId: z.string(),
  distanceMiles: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  trafficDurationMinutes: z.number().int().positive().optional(),
  polyline: z.string().optional(),
  summary: z.string().optional(),
  avoidsHighways: z.boolean().optional(),
  avoidsTolls: z.boolean().optional(),
  tollSegments: z.array(z.string()).optional(),
});

const fareCalculationRequestSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  rideTypeCode: z.enum(["SAVER", "STANDARD", "COMFORT", "XL", "PREMIUM"]),
  routes: z.array(routeInfoSchema).min(1).max(10),
  countryCode: z.string().length(2).optional().default("US"),
  cityCode: z.string().optional(),
  surgeMultiplier: z.number().min(1).max(5).optional().default(1),
  promoCode: z.string().optional(),
});

const allFaresRequestSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  routes: z.array(routeInfoSchema).min(1).max(10),
  countryCode: z.string().length(2).optional().default("US"),
  cityCode: z.string().optional(),
  surgeMultiplier: z.number().min(1).max(5).optional().default(1),
});

// ====================================================
// POST /api/fares/calculate
// Calculate fares for a single ride type across all route alternatives
// ====================================================
router.post("/calculate", optionalAuth, async (req: AuthRequest, res) => {
  try {
    const validation = fareCalculationRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request body",
        details: validation.error.errors 
      });
    }

    const data = validation.data;
    
    const result = await fareCalculationService.calculateFares({
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      dropoffLat: data.dropoffLat,
      dropoffLng: data.dropoffLng,
      rideTypeCode: data.rideTypeCode as RideTypeCode,
      routes: data.routes as RouteInfo[],
      countryCode: data.countryCode,
      cityCode: data.cityCode,
      surgeMultiplier: data.surgeMultiplier,
      promoCode: data.promoCode,
      customerId: req.user?.userId,
    });

    // Log the calculation for audit trail
    if (result.success && result.routeFares.length > 0) {
      try {
        await fareCalculationService.logFareCalculation(
          result,
          {
            pickupLat: data.pickupLat,
            pickupLng: data.pickupLng,
            dropoffLat: data.dropoffLat,
            dropoffLng: data.dropoffLng,
            rideTypeCode: data.rideTypeCode as RideTypeCode,
            routes: data.routes as RouteInfo[],
            countryCode: data.countryCode,
            cityCode: data.cityCode,
            surgeMultiplier: data.surgeMultiplier,
          },
          result.routeFares[0].routeId,
          req.user?.userId,
          req.ip,
          req.get("user-agent")
        );
      } catch (logError) {
        console.error("[FareRoutes] Error logging fare calculation:", logError);
        // Don't fail the request if logging fails
      }
    }

    return res.json(result);
  } catch (error) {
    console.error("[FareRoutes] Error calculating fares:", error);
    return res.status(500).json({ 
      error: "Failed to calculate fares",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ====================================================
// POST /api/fares/calculate-all
// Calculate fares for ALL ride types across all route alternatives
// Returns a comprehensive fare matrix
// ====================================================
router.post("/calculate-all", optionalAuth, async (req: AuthRequest, res) => {
  try {
    const validation = allFaresRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request body",
        details: validation.error.errors 
      });
    }

    const data = validation.data;
    
    const results = await fareCalculationService.calculateAllFares(
      data.pickupLat,
      data.pickupLng,
      data.dropoffLat,
      data.dropoffLng,
      data.routes as RouteInfo[],
      data.surgeMultiplier,
      data.countryCode,
      data.cityCode
    );

    // Convert Map to object for JSON serialization
    const fareMatrix: Record<string, FareCalculationResult> = {};
    results.forEach((value, key) => {
      fareMatrix[key] = value;
    });

    return res.json({
      success: true,
      fareMatrix,
      rideTypeCount: Object.keys(fareMatrix).length,
      routeCount: data.routes.length,
      currency: "USD",
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[FareRoutes] Error calculating all fares:", error);
    return res.status(500).json({ 
      error: "Failed to calculate fares",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ====================================================
// GET /api/fares/ride-types
// Get available ride types with basic info
// ====================================================
router.get("/ride-types", async (_req, res) => {
  try {
    // Trigger cache refresh to get ride types
    const tempResult = await fareCalculationService.calculateFares({
      pickupLat: 40.7128,
      pickupLng: -74.0060,
      dropoffLat: 40.7580,
      dropoffLng: -73.9855,
      rideTypeCode: "STANDARD",
      routes: [{ routeId: "temp", distanceMiles: 5, durationMinutes: 15 }],
    });

    // Since the service is a singleton, the cache is now populated
    // Return the list of ride types
    const rideTypes = [
      { code: "SAVER", name: "SafeGo Saver", description: "Budget-friendly option", iconType: "economy", capacity: 4 },
      { code: "STANDARD", name: "SafeGo X", description: "Affordable everyday rides", iconType: "economy", capacity: 4 },
      { code: "COMFORT", name: "SafeGo Comfort", description: "Newer cars with extra legroom", iconType: "comfort", capacity: 4 },
      { code: "XL", name: "SafeGo XL", description: "SUVs for groups up to 6", iconType: "xl", capacity: 6 },
      { code: "PREMIUM", name: "SafeGo Premium", description: "High-end vehicles", iconType: "premium", capacity: 4 },
    ];

    return res.json({
      success: true,
      rideTypes,
    });
  } catch (error) {
    console.error("[FareRoutes] Error fetching ride types:", error);
    return res.status(500).json({ 
      error: "Failed to fetch ride types",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ====================================================
// POST /api/fares/estimate
// Quick fare estimate without full breakdown (for UI previews)
// ====================================================
router.post("/estimate", async (req, res) => {
  try {
    const { distanceMiles, durationMinutes, rideTypeCode = "STANDARD" } = req.body;

    if (!distanceMiles || !durationMinutes) {
      return res.status(400).json({ error: "distanceMiles and durationMinutes are required" });
    }

    // Calculate quick estimate using default rates
    const baseRates: Record<string, { base: number; perMile: number; perMin: number; min: number }> = {
      SAVER: { base: 1.50, perMile: 0.90, perMin: 0.15, min: 4.00 },
      STANDARD: { base: 2.50, perMile: 1.50, perMin: 0.30, min: 5.00 },
      COMFORT: { base: 3.50, perMile: 2.00, perMin: 0.45, min: 7.00 },
      XL: { base: 4.00, perMile: 2.50, perMin: 0.50, min: 8.00 },
      PREMIUM: { base: 7.00, perMile: 3.50, perMin: 0.75, min: 15.00 },
    };

    const rates = baseRates[rideTypeCode] || baseRates.STANDARD;
    
    const estimate = Math.max(
      rates.base + (distanceMiles * rates.perMile) + (durationMinutes * rates.perMin),
      rates.min
    );

    return res.json({
      success: true,
      estimate: Math.round(estimate * 100) / 100,
      currency: "USD",
      rideTypeCode,
      note: "This is an estimate. Final fare may vary based on route, traffic, and fees.",
    });
  } catch (error) {
    console.error("[FareRoutes] Error estimating fare:", error);
    return res.status(500).json({ 
      error: "Failed to estimate fare",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
