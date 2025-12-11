/**
 * Admin Ride Pricing Routes
 * 
 * API endpoints for managing ride pricing rules (admin only)
 * Includes read-only ride listing for admin monitoring
 */

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { Prisma } from "@prisma/client";

const router = Router();

router.use(authenticateToken);

const adminOnly = (req: AuthRequest, res: any, next: any) => {
  if (!["admin", "super_admin"].includes(req.user?.role || "")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(adminOnly);

const updatePricingRuleSchema = z.object({
  baseFare: z.number().min(0).optional(),
  perKmRate: z.number().min(0).optional(),
  perMinRate: z.number().min(0).optional(),
  minimumFare: z.number().min(0).optional(),
  bookingFee: z.number().min(0).optional(),
  nightStartHour: z.number().min(0).max(23).optional(),
  nightEndHour: z.number().min(0).max(23).optional(),
  nightMultiplier: z.number().min(1).optional(),
  peakMultiplier: z.number().min(1).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  allowCash: z.boolean().optional(),
  allowOnline: z.boolean().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const countryCode = req.query.countryCode as string | undefined;
    const cityCode = req.query.cityCode as string | undefined;

    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (cityCode) where.cityCode = cityCode;

    const rules = await prisma.ridePricingRule.findMany({
      where,
      orderBy: [{ countryCode: "asc" }, { cityCode: "asc" }, { baseFare: "asc" }],
    });

    const cityNames: Record<string, string> = {
      DHK: "Dhaka",
      CTG: "Chittagong",
      KHL: "Khulna",
      SYL: "Sylhet",
    };

    const vehicleNames: Record<string, string> = {
      bike: "Bike",
      cng: "CNG Auto",
      car_economy: "Economy Car",
      car_premium: "Premium Car",
    };

    res.json({
      success: true,
      rules: rules.map((rule) => ({
        id: rule.id,
        countryCode: rule.countryCode,
        cityCode: rule.cityCode,
        cityName: cityNames[rule.cityCode] || rule.cityCode,
        vehicleType: rule.vehicleType,
        vehicleDisplayName: rule.displayName || vehicleNames[rule.vehicleType] || rule.vehicleType,
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
    console.error("[AdminRidePricing] List error:", error);
    res.status(500).json({ error: "Failed to fetch pricing rules" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const rule = await prisma.ridePricingRule.findUnique({
      where: { id },
    });

    if (!rule) {
      return res.status(404).json({ error: "Pricing rule not found" });
    }

    res.json({
      success: true,
      rule: {
        id: rule.id,
        countryCode: rule.countryCode,
        cityCode: rule.cityCode,
        vehicleType: rule.vehicleType,
        displayName: rule.displayName,
        description: rule.description,
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
      },
    });
  } catch (error) {
    console.error("[AdminRidePricing] Get error:", error);
    res.status(500).json({ error: "Failed to fetch pricing rule" });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const parseResult = updatePricingRuleSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parseResult.error.format(),
      });
    }

    const updates = parseResult.data;

    const existingRule = await prisma.ridePricingRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return res.status(404).json({ error: "Pricing rule not found" });
    }

    const updatedRule = await prisma.ridePricingRule.update({
      where: { id },
      data: {
        ...(updates.baseFare !== undefined && { baseFare: updates.baseFare }),
        ...(updates.perKmRate !== undefined && { perKmRate: updates.perKmRate }),
        ...(updates.perMinRate !== undefined && { perMinRate: updates.perMinRate }),
        ...(updates.minimumFare !== undefined && { minimumFare: updates.minimumFare }),
        ...(updates.bookingFee !== undefined && { bookingFee: updates.bookingFee }),
        ...(updates.nightStartHour !== undefined && { nightStartHour: updates.nightStartHour }),
        ...(updates.nightEndHour !== undefined && { nightEndHour: updates.nightEndHour }),
        ...(updates.nightMultiplier !== undefined && { nightMultiplier: updates.nightMultiplier }),
        ...(updates.peakMultiplier !== undefined && { peakMultiplier: updates.peakMultiplier }),
        ...(updates.commissionRate !== undefined && { commissionRate: updates.commissionRate }),
        ...(updates.allowCash !== undefined && { allowCash: updates.allowCash }),
        ...(updates.allowOnline !== undefined && { allowOnline: updates.allowOnline }),
        version: existingRule.version + 1,
        updatedAt: new Date(),
      },
    });

    console.log(
      `[AdminRidePricing] Rule updated: ${updatedRule.id} by admin ${req.user?.userId}`
    );

    res.json({
      success: true,
      rule: {
        id: updatedRule.id,
        version: updatedRule.version,
        updatedAt: updatedRule.updatedAt,
      },
    });
  } catch (error) {
    console.error("[AdminRidePricing] Update error:", error);
    res.status(500).json({ error: "Failed to update pricing rule" });
  }
});

router.post("/:id/toggle", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    const existingRule = await prisma.ridePricingRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return res.status(404).json({ error: "Pricing rule not found" });
    }

    const updatedRule = await prisma.ridePricingRule.update({
      where: { id },
      data: {
        isActive,
        version: existingRule.version + 1,
        updatedAt: new Date(),
      },
    });

    console.log(
      `[AdminRidePricing] Rule ${isActive ? "enabled" : "disabled"}: ${
        updatedRule.id
      } by admin ${req.user?.userId}`
    );

    res.json({
      success: true,
      rule: {
        id: updatedRule.id,
        isActive: updatedRule.isActive,
        version: updatedRule.version,
      },
    });
  } catch (error) {
    console.error("[AdminRidePricing] Toggle error:", error);
    res.status(500).json({ error: "Failed to toggle pricing rule" });
  }
});

const listRidesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  countryCode: z.enum(["BD", "US"]).optional(),
  search: z.string().max(100).optional(),
});

const VALID_RIDE_STATUSES = [
  "requested",
  "searching_driver",
  "accepted",
  "driver_arriving",
  "arrived",
  "in_progress",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_driver",
  "cancelled_no_driver",
];

router.get("/rides/list", async (req: AuthRequest, res) => {
  try {
    const parsed = listRidesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid query parameters", 
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { page, limit, status, countryCode, search } = parsed.data;

    if (status && status !== "all" && !VALID_RIDE_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const where: Prisma.RideRequestWhereInput = {};

    if (status && status !== "all") {
      where.status = status;
    }
    if (countryCode) {
      where.countryCode = countryCode;
    }
    if (search) {
      const sanitizedSearch = search.trim();
      if (sanitizedSearch) {
        where.OR = [
          { id: { contains: sanitizedSearch, mode: "insensitive" } },
          { pickupAddress: { contains: sanitizedSearch, mode: "insensitive" } },
          { dropoffAddress: { contains: sanitizedSearch, mode: "insensitive" } },
        ];
      }
    }

    const [rides, total] = await Promise.all([
      prisma.rideRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
      prisma.rideRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const ridesWithBreakdown = rides.map((ride) => ({
      id: ride.id,
      status: ride.status,
      countryCode: ride.countryCode,
      cityCode: ride.cityCode,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      vehicleType: ride.vehicleType,
      paymentMethod: ride.paymentMethod,
      fareCurrency: ride.fareCurrency,
      serviceFare: Number(ride.serviceFare),
      safegoCommission: Number(ride.safegoCommission),
      driverPayout: Number(ride.driverPayout),
      distanceKm: Number(ride.distanceKm),
      durationMinutes: ride.durationMinutes,
      nightMultiplier: ride.nightMultiplier ? Number(ride.nightMultiplier) : undefined,
      peakMultiplier: ride.peakMultiplier ? Number(ride.peakMultiplier) : undefined,
      requestedAt: ride.requestedAt,
      acceptedAt: ride.acceptedAt,
      completedAt: ride.completedAt,
      customer: ride.customer,
      driver: ride.driver,
      fareBreakdown: ride.fareBreakdown as any,
    }));

    console.log(`[AdminRides] List query by admin ${req.user?.userId}: page=${page}, limit=${limit}, total=${total}`);

    res.json({
      success: true,
      rides: ridesWithBreakdown,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[AdminRides] List error:", error);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

export default router;
