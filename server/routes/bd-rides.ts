/**
 * Bangladesh Ride Pricing API Routes
 * 
 * Endpoints for BD-specific ride fare estimation and booking.
 * Implements SafeGo Master Rules:
 * - BD: Both cash and online payments allowed
 * - US: ONLY online payment (enforced at API level)
 */

import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authenticateToken, AuthRequest, requireUnlockedAccount } from "../middleware/auth";
import {
  calculateRideFare,
  getAvailableVehicleOptions,
  getPricingRules,
  getAvailableCities,
  getCityDisplayName,
  getVehicleDisplayName,
  VehicleType,
  PaymentMethod,
  SpeedOption,
} from "../services/bdRideFareCalculationService";
import { dispatchService } from "../services/dispatchService";
import { startDispatchSession } from "../websocket/dispatchWs";

const router = Router();

const fareEstimateSchema = z.object({
  countryCode: z.string().length(2).default("BD"),
  cityCode: z.string().min(2).max(10),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  estimatedDistanceKm: z.number().positive(),
  estimatedDurationMin: z.number().positive(),
  vehicleType: z.enum(["bike", "cng", "car_economy", "car_premium"]).optional(),
  speedOption: z.enum(["normal", "priority"]).default("normal"),
});

const rideRequestSchema = z.object({
  countryCode: z.string().length(2).default("BD"),
  cityCode: z.string().min(2).max(10),
  vehicleType: z.enum(["bike", "cng", "car_economy", "car_premium"]),
  pickupAddress: z.string().min(1),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupPlaceId: z.string().optional(),
  dropoffAddress: z.string().min(1),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffPlaceId: z.string().optional(),
  estimatedDistanceKm: z.number().positive(),
  estimatedDurationMin: z.number().positive(),
  paymentMethod: z.enum(["cash", "online"]),
  speedOption: z.enum(["normal", "priority"]).default("normal"),
  fareEstimateId: z.string().optional(),
});

router.get("/fare-estimate", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const parseResult = fareEstimateSchema.safeParse({
      countryCode: req.query.countryCode || "BD",
      cityCode: req.query.cityCode,
      pickupLat: parseFloat(req.query.pickupLat as string),
      pickupLng: parseFloat(req.query.pickupLng as string),
      dropoffLat: parseFloat(req.query.dropoffLat as string),
      dropoffLng: parseFloat(req.query.dropoffLng as string),
      estimatedDistanceKm: parseFloat(req.query.estimatedDistanceKm as string),
      estimatedDurationMin: parseFloat(req.query.estimatedDurationMin as string),
      vehicleType: req.query.vehicleType,
      speedOption: req.query.speedOption || "normal",
    });

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: parseResult.error.format(),
      });
    }

    const input = parseResult.data;
    const requestTimestamp = new Date();

    if (input.vehicleType) {
      const fareResult = await calculateRideFare({
        countryCode: input.countryCode,
        cityCode: input.cityCode,
        vehicleType: input.vehicleType,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        estimatedDistanceKm: input.estimatedDistanceKm,
        estimatedDurationMin: input.estimatedDurationMin,
        requestTimestamp,
        customerPaymentMethod: "online",
        speedOption: input.speedOption as SpeedOption,
      });

      if (!fareResult.success) {
        return res.status(400).json({ error: fareResult.error, errorCode: fareResult.errorCode });
      }

      return res.json({
        success: true,
        vehicleType: input.vehicleType,
        fare: fareResult.fare,
        fareRange: {
          min: Math.floor(fareResult.fare.totalFare * 0.9),
          max: Math.ceil(fareResult.fare.totalFare * 1.1),
        },
        isNightTime: fareResult.isNightTime,
        isPeakTime: fareResult.isPeakTime,
        cashAllowed: fareResult.cashAllowed,
        onlineAllowed: fareResult.onlineAllowed,
        estimateId: `EST-${Date.now()}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    const vehicleOptions = await getAvailableVehicleOptions(
      input.countryCode,
      input.cityCode,
      input.estimatedDistanceKm,
      input.estimatedDurationMin,
      requestTimestamp
    );

    if (vehicleOptions.length === 0) {
      return res.status(404).json({
        error: "No vehicle options available for this route",
        errorCode: "NO_VEHICLES_AVAILABLE",
      });
    }

    res.json({
      success: true,
      countryCode: input.countryCode,
      cityCode: input.cityCode,
      cityName: getCityDisplayName(input.cityCode),
      distanceKm: input.estimatedDistanceKm,
      durationMin: input.estimatedDurationMin,
      vehicleOptions,
      estimateId: `EST-${Date.now()}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("[BD-Rides] Fare estimate error:", error);
    res.status(500).json({ error: "Failed to calculate fare estimate" });
  }
});

router.post("/request", authenticateToken, requireUnlockedAccount, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can request rides" });
    }

    const parseResult = rideRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: parseResult.error.format(),
      });
    }

    const input = parseResult.data;
    const requestTimestamp = new Date();

    const fareResult = await calculateRideFare({
      countryCode: input.countryCode,
      cityCode: input.cityCode,
      vehicleType: input.vehicleType,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      estimatedDistanceKm: input.estimatedDistanceKm,
      estimatedDurationMin: input.estimatedDurationMin,
      requestTimestamp,
      customerPaymentMethod: input.paymentMethod,
      speedOption: input.speedOption as SpeedOption,
    });

    if (!fareResult.success) {
      return res.status(400).json({
        error: fareResult.error,
        errorCode: fareResult.errorCode,
      });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (!customerProfile.isVerified) {
      return res.status(403).json({ error: "Customer must be verified to request rides" });
    }

    const ride = await prisma.ride.create({
      data: {
        customerId: customerProfile.id,
        countryCode: input.countryCode,
        cityCode: input.cityCode,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        pickupPlaceId: input.pickupPlaceId,
        dropoffAddress: input.dropoffAddress,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        dropoffPlaceId: input.dropoffPlaceId,
        vehicleType: input.vehicleType,
        distanceKm: input.estimatedDistanceKm,
        distanceMiles: input.estimatedDistanceKm * 0.621371,
        durationMinutes: Math.round(input.estimatedDurationMin),
        baseFareAmount: fareResult.fare.baseFare,
        distanceFareAmount: fareResult.fare.distanceFare,
        timeFareAmount: fareResult.fare.timeFare,
        bookingFee: fareResult.fare.bookingFee,
        nightMultiplier: fareResult.fare.nightMultiplier,
        peakMultiplier: fareResult.fare.peakMultiplier,
        serviceFare: fareResult.fare.totalFare,
        safegoCommission: fareResult.fare.safegoCommission,
        driverPayout: fareResult.fare.driverEarnings,
        driverEarnings: fareResult.fare.driverEarnings,
        surgeMultiplier: fareResult.fare.finalMultiplier,
        paymentMethod: input.paymentMethod,
        fareCurrency: fareResult.fare.currency,
        speedOption: input.speedOption,
        pricingRuleId: fareResult.pricingRuleId,
        status: "requested",
        requestedAt: requestTimestamp,
        fareBreakdown: {
          baseFare: fareResult.fare.baseFare,
          distanceFare: fareResult.fare.distanceFare,
          timeFare: fareResult.fare.timeFare,
          bookingFee: fareResult.fare.bookingFee,
          subtotal: fareResult.fare.subtotal,
          nightMultiplier: fareResult.fare.nightMultiplier,
          peakMultiplier: fareResult.fare.peakMultiplier,
          finalMultiplier: fareResult.fare.finalMultiplier,
          multiplierAdjustment: fareResult.fare.multiplierAdjustment,
          priorityFee: fareResult.fare.priorityFee,
          totalFare: fareResult.fare.totalFare,
          minimumFareApplied: fareResult.fare.minimumFareApplied,
          safegoCommission: fareResult.fare.safegoCommission,
          driverEarnings: fareResult.fare.driverEarnings,
          currency: fareResult.fare.currency,
          commissionRate: fareResult.fare.commissionRate,
        },
        statusHistory: [
          {
            status: "requested",
            timestamp: requestTimestamp.toISOString(),
            actor: "customer",
          },
        ],
      },
    });

    await prisma.rideStatusEvent.create({
      data: {
        rideId: ride.id,
        toStatus: "requested",
        changedBy: userId,
        changedByRole: "customer",
        reason: "Ride requested by customer",
        metadata: {
          vehicleType: input.vehicleType,
          paymentMethod: input.paymentMethod,
          countryCode: input.countryCode,
          cityCode: input.cityCode,
        },
      },
    });

    try {
      await startDispatchSession(
        ride.id,
        {
          lat: input.pickupLat,
          lng: input.pickupLng,
        },
        input.vehicleType
      );

      await prisma.ride.update({
        where: { id: ride.id },
        data: {
          status: "searching_driver",
          dispatchStatus: "searching_driver",
        },
      });
    } catch (dispatchError) {
      console.error("[BD-Rides] Dispatch error:", dispatchError);
    }

    res.status(201).json({
      success: true,
      ride: {
        id: ride.id,
        status: ride.status,
        vehicleType: ride.vehicleType,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        paymentMethod: ride.paymentMethod,
        fare: {
          total: fareResult.fare.totalFare,
          currency: fareResult.fare.currency,
          breakdown: fareResult.fare,
        },
        driver: null,
        estimatedPickupTime: null,
      },
    });
  } catch (error) {
    console.error("[BD-Rides] Ride request error:", error);
    res.status(500).json({ error: "Failed to create ride request" });
  }
});

router.get("/vehicle-types", async (req, res) => {
  try {
    const countryCode = (req.query.countryCode as string) || "BD";
    const cityCode = req.query.cityCode as string;

    const where: any = { isActive: true, countryCode };
    if (cityCode) where.cityCode = cityCode;

    const rules = await prisma.ridePricingRule.findMany({
      where,
      select: {
        vehicleType: true,
        displayName: true,
        description: true,
        baseFare: true,
        currency: true,
        allowCash: true,
        allowOnline: true,
      },
      orderBy: { baseFare: "asc" },
    });

    const vehicleTypes = rules.map((rule) => ({
      type: rule.vehicleType,
      displayName: rule.displayName || getVehicleDisplayName(rule.vehicleType),
      description: rule.description,
      startingFare: Number(rule.baseFare),
      currency: rule.currency,
      allowCash: rule.allowCash,
      allowOnline: rule.allowOnline,
      capacity: getVehicleCapacity(rule.vehicleType as VehicleType),
      icon: getVehicleIcon(rule.vehicleType as VehicleType),
    }));

    res.json({
      success: true,
      countryCode,
      cityCode,
      vehicleTypes,
    });
  } catch (error) {
    console.error("[BD-Rides] Vehicle types error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle types" });
  }
});

router.get("/cities", async (req, res) => {
  try {
    const countryCode = (req.query.countryCode as string) || "BD";

    const cities = await getAvailableCities(countryCode);

    const cityDetails = cities.map((code) => ({
      code,
      name: getCityDisplayName(code),
    }));

    res.json({
      success: true,
      countryCode,
      cities: cityDetails,
    });
  } catch (error) {
    console.error("[BD-Rides] Cities error:", error);
    res.status(500).json({ error: "Failed to fetch cities" });
  }
});

router.get("/pricing-rules", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;

    if (!["admin", "super_admin"].includes(role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const countryCode = req.query.countryCode as string | undefined;
    const cityCode = req.query.cityCode as string | undefined;

    const rules = await getPricingRules(countryCode, cityCode);

    res.json({
      success: true,
      rules: rules.map((rule) => ({
        id: rule.id,
        countryCode: rule.countryCode,
        cityCode: rule.cityCode,
        cityName: getCityDisplayName(rule.cityCode),
        vehicleType: rule.vehicleType,
        vehicleDisplayName: rule.displayName || getVehicleDisplayName(rule.vehicleType),
        baseFare: Number(rule.baseFare),
        perKmRate: Number(rule.perKmRate),
        perMinRate: Number(rule.perMinRate),
        minimumFare: Number(rule.minimumFare),
        bookingFee: Number(rule.bookingFee),
        nightStartHour: rule.nightStartHour,
        nightEndHour: rule.nightEndHour,
        nightMultiplier: Number(rule.nightMultiplier),
        peakMultiplier: Number(rule.peakMultiplier),
        peakTimeRanges: rule.peakTimeRanges,
        commissionRate: Number(rule.commissionRate),
        currency: rule.currency,
        allowCash: rule.allowCash,
        allowOnline: rule.allowOnline,
        isActive: rule.isActive,
        version: rule.version,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[BD-Rides] Pricing rules error:", error);
    res.status(500).json({ error: "Failed to fetch pricing rules" });
  }
});

function getVehicleCapacity(vehicleType: VehicleType): number {
  switch (vehicleType) {
    case "bike":
      return 1;
    case "cng":
      return 3;
    case "car_economy":
      return 4;
    case "car_premium":
      return 4;
    default:
      return 4;
  }
}

function getVehicleIcon(vehicleType: VehicleType): string {
  switch (vehicleType) {
    case "bike":
      return "bike";
    case "cng":
      return "truck";
    case "car_economy":
      return "car";
    case "car_premium":
      return "car-front";
    default:
      return "car";
  }
}

export default router;
