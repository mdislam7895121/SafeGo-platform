import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { getPhase3Features } from "../config/phase3Features";

const router = Router();

const publicRouter = Router();

export { publicRouter as parcelPublicRoutes };

router.use(authenticateToken);

// ============================================================
// PHASE 3: Parcel Pricing, Scheduling & Proof-of-Delivery
// ============================================================

// ====================================================
// GET /api/parcel/pricing
// Get parcel pricing configuration for a country
// ====================================================
router.get("/pricing", async (req: AuthRequest, res) => {
  try {
    const { countryCode = "US", zone } = req.query;

    const whereClause: any = {
      countryCode: String(countryCode).toUpperCase(),
      isActive: true,
    };

    if (zone) {
      whereClause.baseZone = String(zone);
    }

    const pricingConfigs = await prisma.parcelPricingConfig.findMany({
      where: whereClause,
      orderBy: { sizeCategory: "asc" },
    });

    res.json({
      pricing: pricingConfigs.map((config) => ({
        id: config.id,
        sizeCategory: config.sizeCategory,
        maxWeightKg: Number(config.maxWeightKg),
        baseFare: Number(config.baseFare),
        perKmRate: Number(config.perKmRate),
        perKgSurcharge: config.perKgSurcharge ? Number(config.perKgSurcharge) : null,
        countryCode: config.countryCode,
        zone: config.baseZone,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel] Error fetching pricing:", error);
    res.status(500).json({ error: error.message || "Failed to fetch parcel pricing" });
  }
});

// ====================================================
// POST /api/parcel/calculate-fare
// Calculate fare for a parcel delivery
// ====================================================
const calculateFareSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  sizeCategory: z.enum(["small", "medium", "large", "extra_large"]),
  weightKg: z.number().min(0.1).max(100).optional(),
  countryCode: z.string().length(2).optional(),
});

router.post("/calculate-fare", async (req: AuthRequest, res) => {
  try {
    const validationResult = calculateFareSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { pickupLat, pickupLng, dropoffLat, dropoffLng, sizeCategory, weightKg, countryCode = "US" } = validationResult.data;

    const toRad = (deg: number) => deg * (Math.PI / 180);
    const R = 6371;
    const dLat = toRad(dropoffLat - pickupLat);
    const dLng = toRad(dropoffLng - pickupLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(pickupLat)) * Math.cos(toRad(dropoffLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    const pricing = await prisma.parcelPricingConfig.findFirst({
      where: {
        countryCode: countryCode.toUpperCase(),
        sizeCategory,
        isActive: true,
      },
    });

    if (!pricing) {
      const defaultPricing = {
        small: { baseFare: 5.00, perKmRate: 1.00, perKgSurcharge: 0.50 },
        medium: { baseFare: 8.00, perKmRate: 1.25, perKgSurcharge: 0.75 },
        large: { baseFare: 12.00, perKmRate: 1.50, perKgSurcharge: 1.00 },
        extra_large: { baseFare: 18.00, perKmRate: 2.00, perKgSurcharge: 1.50 },
      };

      const defaults = defaultPricing[sizeCategory];
      let fare = defaults.baseFare + (distanceKm * defaults.perKmRate);

      if (weightKg) {
        fare += weightKg * defaults.perKgSurcharge;
      }

      return res.json({
        fare: Math.round(fare * 100) / 100,
        distanceKm: Math.round(distanceKm * 100) / 100,
        breakdown: {
          baseFare: defaults.baseFare,
          distanceFare: Math.round(distanceKm * defaults.perKmRate * 100) / 100,
          weightSurcharge: weightKg ? Math.round(weightKg * defaults.perKgSurcharge * 100) / 100 : 0,
        },
        isEstimate: true,
        currency: countryCode === "BD" ? "BDT" : "USD",
      });
    }

    let fare = Number(pricing.baseFare) + (distanceKm * Number(pricing.perKmRate));

    if (weightKg && pricing.perKgSurcharge) {
      fare += weightKg * Number(pricing.perKgSurcharge);
    }

    res.json({
      fare: Math.round(fare * 100) / 100,
      distanceKm: Math.round(distanceKm * 100) / 100,
      breakdown: {
        baseFare: Number(pricing.baseFare),
        distanceFare: Math.round(distanceKm * Number(pricing.perKmRate) * 100) / 100,
        weightSurcharge: weightKg && pricing.perKgSurcharge
          ? Math.round(weightKg * Number(pricing.perKgSurcharge) * 100) / 100
          : 0,
      },
      pricingConfigId: pricing.id,
      currency: countryCode === "BD" ? "BDT" : "USD",
    });
  } catch (error: any) {
    console.error("[Parcel] Error calculating fare:", error);
    res.status(500).json({ error: error.message || "Failed to calculate fare" });
  }
});

// ====================================================
// POST /api/parcel/schedule
// Schedule a parcel pickup for a future time
// ====================================================
const scheduleParcelSchema = z.object({
  pickupAddress: z.string().min(1).max(500),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffAddress: z.string().min(1).max(500),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  parcelDescription: z.string().min(1).max(500),
  sizeCategory: z.enum(["small", "medium", "large", "extra_large"]),
  weightKg: z.number().min(0.1).max(100).optional(),
  scheduledPickupTime: z.string().datetime(),
  paymentMethod: z.enum(["cash", "online", "wallet"]),
  specialInstructions: z.string().max(500).optional(),
});

router.post("/schedule", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = scheduleParcelSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: { select: { countryCode: true } } },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const countryCode = customer.user?.countryCode || "US";
    const features = await getPhase3Features(countryCode);

    if (!features.parcelSchedulingEnabled) {
      return res.status(403).json({ error: "Parcel scheduling is not enabled" });
    }

    const scheduledTime = new Date(data.scheduledPickupTime);
    const now = new Date();

    const minTime = new Date(now.getTime() + features.parcelScheduleMinHoursAhead * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() + features.parcelScheduleMaxDaysAhead * 24 * 60 * 60 * 1000);

    if (scheduledTime < minTime) {
      return res.status(400).json({
        error: `Scheduled pickup must be at least ${features.parcelScheduleMinHoursAhead} hours in advance`,
      });
    }

    if (scheduledTime > maxTime) {
      return res.status(400).json({
        error: `Scheduled pickup cannot be more than ${features.parcelScheduleMaxDaysAhead} days in advance`,
      });
    }

    const toRad = (deg: number) => deg * (Math.PI / 180);
    const R = 6371;
    const dLat = toRad(data.dropoffLat - data.pickupLat);
    const dLng = toRad(data.dropoffLng - data.pickupLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(data.pickupLat)) * Math.cos(toRad(data.dropoffLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    const pricing = await prisma.parcelPricingConfig.findFirst({
      where: {
        countryCode: countryCode.toUpperCase(),
        sizeCategory: data.sizeCategory,
        isActive: true,
      },
    });

    let serviceFare = 10.00;
    if (pricing) {
      serviceFare = Number(pricing.baseFare) + (distanceKm * Number(pricing.perKmRate));
      if (data.weightKg && pricing.perKgSurcharge) {
        serviceFare += data.weightKg * Number(pricing.perKgSurcharge);
      }
    }

    const commissionRate = 0.20;
    const safegoCommission = serviceFare * commissionRate;
    const driverPayout = serviceFare - safegoCommission;

    const delivery = await prisma.delivery.create({
      data: {
        customerId: customer.id,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        parcelDescription: data.parcelDescription,
        sizeCategory: data.sizeCategory,
        weightKg: data.weightKg ? new Prisma.Decimal(data.weightKg) : null,
        pickupType: "scheduled",
        scheduledPickupTime: scheduledTime,
        serviceFare: new Prisma.Decimal(Math.round(serviceFare * 100) / 100),
        safegoCommission: new Prisma.Decimal(Math.round(safegoCommission * 100) / 100),
        driverPayout: new Prisma.Decimal(Math.round(driverPayout * 100) / 100),
        paymentMethod: data.paymentMethod,
        status: "scheduled",
        pricingConfigId: pricing?.id,
      },
    });

    res.status(201).json({
      message: "Parcel pickup scheduled successfully",
      delivery: {
        id: delivery.id,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        scheduledPickupTime: delivery.scheduledPickupTime,
        sizeCategory: delivery.sizeCategory,
        weightKg: delivery.weightKg ? Number(delivery.weightKg) : null,
        serviceFare: Number(delivery.serviceFare),
        status: delivery.status,
        createdAt: delivery.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[Parcel] Error scheduling delivery:", error);
    res.status(500).json({ error: error.message || "Failed to schedule parcel pickup" });
  }
});

// ====================================================
// GET /api/parcel/scheduled
// Get customer's scheduled parcel deliveries
// ====================================================
router.get("/scheduled", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const scheduled = await prisma.delivery.findMany({
      where: {
        customerId: customer.id,
        pickupType: "scheduled",
        status: { in: ["scheduled", "requested"] },
      },
      orderBy: { scheduledPickupTime: "asc" },
    });

    res.json({
      deliveries: scheduled.map((d) => ({
        id: d.id,
        pickupAddress: d.pickupAddress,
        dropoffAddress: d.dropoffAddress,
        parcelDescription: d.parcelDescription,
        sizeCategory: d.sizeCategory,
        weightKg: d.weightKg ? Number(d.weightKg) : null,
        scheduledPickupTime: d.scheduledPickupTime,
        serviceFare: Number(d.serviceFare),
        status: d.status,
        createdAt: d.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel] Error fetching scheduled:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scheduled deliveries" });
  }
});

// ====================================================
// DELETE /api/parcel/scheduled/:id
// Cancel a scheduled parcel pickup
// ====================================================
router.delete("/scheduled/:id", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const deliveryId = req.params.id;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const delivery = await prisma.delivery.findFirst({
      where: {
        id: deliveryId,
        customerId: customer.id,
        pickupType: "scheduled",
        status: "scheduled",
      },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Scheduled delivery not found or cannot be cancelled" });
    }

    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: "cancelled" },
    });

    res.json({ success: true, message: "Scheduled pickup cancelled" });
  } catch (error: any) {
    console.error("[Parcel] Error cancelling scheduled:", error);
    res.status(500).json({ error: error.message || "Failed to cancel scheduled delivery" });
  }
});

// ====================================================
// POST /api/parcel/:id/proof-of-delivery
// Upload proof-of-delivery photo (driver only)
// ====================================================
const podPhotoSchema = z.object({
  photoUrl: z.string().url(),
  meta: z.object({
    gps_lat: z.number().optional(),
    gps_lng: z.number().optional(),
    device: z.string().optional(),
    timestamp: z.string().optional(),
  }).optional(),
});

router.post("/:id/proof-of-delivery", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const deliveryId = req.params.id;

    const validationResult = podPhotoSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { photoUrl, meta } = validationResult.data;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, driverId: driver.id },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found or not assigned to you" });
    }

    if (!["picked_up_parcel", "en_route_to_dropoff", "arrived_at_dropoff"].includes(delivery.status)) {
      return res.status(400).json({
        error: "Proof of delivery can only be uploaded during delivery",
      });
    }

    const photo = await prisma.deliveryProofPhoto.create({
      data: {
        deliveryId,
        driverId: driver.id,
        photoUrl,
        meta: meta || {},
      },
    });

    res.status(201).json({
      success: true,
      photo: {
        id: photo.id,
        photoUrl: photo.photoUrl,
        capturedAt: photo.capturedAt,
      },
    });
  } catch (error: any) {
    console.error("[Parcel] Error uploading POD photo:", error);
    res.status(500).json({ error: error.message || "Failed to upload proof of delivery" });
  }
});

// ====================================================
// GET /api/parcel/:id/proof-of-delivery
// Get proof-of-delivery photos for a delivery
// ====================================================
router.get("/:id/proof-of-delivery", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const deliveryId = req.params.id;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (role === "customer") {
      const customer = await prisma.customerProfile.findUnique({ where: { userId } });
      if (delivery.customerId !== customer?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driver = await prisma.driverProfile.findUnique({ where: { userId } });
      if (delivery.driverId !== driver?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const photos = await prisma.deliveryProofPhoto.findMany({
      where: { deliveryId },
      orderBy: { capturedAt: "asc" },
    });

    res.json({
      photos: photos.map((p) => ({
        id: p.id,
        photoUrl: p.photoUrl,
        capturedAt: p.capturedAt,
        meta: p.meta,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel] Error fetching POD photos:", error);
    res.status(500).json({ error: error.message || "Failed to fetch proof of delivery" });
  }
});

// ====================================================
// ADMIN: Parcel Pricing Management
// ====================================================

// GET /api/parcel/admin/pricing - Get all pricing configs (admin)
router.get("/admin/pricing", requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;

    const whereClause: any = {};
    if (countryCode) {
      whereClause.countryCode = String(countryCode).toUpperCase();
    }

    const configs = await prisma.parcelPricingConfig.findMany({
      where: whereClause,
      orderBy: [
        { countryCode: "asc" },
        { sizeCategory: "asc" },
      ],
    });

    res.json({
      pricingConfigs: configs.map((c) => ({
        id: c.id,
        countryCode: c.countryCode,
        baseZone: c.baseZone,
        sizeCategory: c.sizeCategory,
        maxWeightKg: Number(c.maxWeightKg),
        baseFare: Number(c.baseFare),
        perKmRate: Number(c.perKmRate),
        perKgSurcharge: c.perKgSurcharge ? Number(c.perKgSurcharge) : null,
        isActive: c.isActive,
        activeFrom: c.activeFrom,
        activeTo: c.activeTo,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel] Error fetching pricing configs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pricing configs" });
  }
});

// POST /api/parcel/admin/pricing - Create pricing config (admin)
const pricingConfigSchema = z.object({
  countryCode: z.string().length(2),
  baseZone: z.string().max(50).optional().nullable(),
  sizeCategory: z.enum(["small", "medium", "large", "extra_large"]),
  maxWeightKg: z.number().min(0.1).max(1000),
  baseFare: z.number().min(0),
  perKmRate: z.number().min(0),
  perKgSurcharge: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  activeFrom: z.string().datetime().optional().nullable(),
  activeTo: z.string().datetime().optional().nullable(),
});

router.post("/admin/pricing", requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const validationResult = pricingConfigSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const existing = await prisma.parcelPricingConfig.findFirst({
      where: {
        countryCode: data.countryCode.toUpperCase(),
        baseZone: data.baseZone || null,
        sizeCategory: data.sizeCategory,
      },
    });

    if (existing) {
      return res.status(400).json({
        error: "Pricing config already exists for this country/zone/size combination",
      });
    }

    const config = await prisma.parcelPricingConfig.create({
      data: {
        countryCode: data.countryCode.toUpperCase(),
        baseZone: data.baseZone || null,
        sizeCategory: data.sizeCategory,
        maxWeightKg: new Prisma.Decimal(data.maxWeightKg),
        baseFare: new Prisma.Decimal(data.baseFare),
        perKmRate: new Prisma.Decimal(data.perKmRate),
        perKgSurcharge: data.perKgSurcharge !== null ? new Prisma.Decimal(data.perKgSurcharge || 0) : null,
        isActive: data.isActive ?? true,
        activeFrom: data.activeFrom ? new Date(data.activeFrom) : null,
        activeTo: data.activeTo ? new Date(data.activeTo) : null,
      },
    });

    res.status(201).json({
      pricingConfig: {
        id: config.id,
        countryCode: config.countryCode,
        sizeCategory: config.sizeCategory,
        baseFare: Number(config.baseFare),
        perKmRate: Number(config.perKmRate),
        isActive: config.isActive,
      },
    });
  } catch (error: any) {
    console.error("[Parcel] Error creating pricing config:", error);
    res.status(500).json({ error: error.message || "Failed to create pricing config" });
  }
});

// PATCH /api/parcel/admin/pricing/:id - Update pricing config (admin)
router.patch("/admin/pricing/:id", requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const configId = req.params.id;

    const existing = await prisma.parcelPricingConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Pricing config not found" });
    }

    const partialSchema = pricingConfigSchema.partial();
    const validationResult = partialSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const updateData: any = {};

    if (data.baseFare !== undefined) updateData.baseFare = new Prisma.Decimal(data.baseFare);
    if (data.perKmRate !== undefined) updateData.perKmRate = new Prisma.Decimal(data.perKmRate);
    if (data.perKgSurcharge !== undefined) {
      updateData.perKgSurcharge = data.perKgSurcharge !== null ? new Prisma.Decimal(data.perKgSurcharge) : null;
    }
    if (data.maxWeightKg !== undefined) updateData.maxWeightKg = new Prisma.Decimal(data.maxWeightKg);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.activeFrom !== undefined) updateData.activeFrom = data.activeFrom ? new Date(data.activeFrom) : null;
    if (data.activeTo !== undefined) updateData.activeTo = data.activeTo ? new Date(data.activeTo) : null;

    const updated = await prisma.parcelPricingConfig.update({
      where: { id: configId },
      data: updateData,
    });

    res.json({
      pricingConfig: {
        id: updated.id,
        countryCode: updated.countryCode,
        sizeCategory: updated.sizeCategory,
        baseFare: Number(updated.baseFare),
        perKmRate: Number(updated.perKmRate),
        perKgSurcharge: updated.perKgSurcharge ? Number(updated.perKgSurcharge) : null,
        isActive: updated.isActive,
      },
    });
  } catch (error: any) {
    console.error("[Parcel] Error updating pricing config:", error);
    res.status(500).json({ error: error.message || "Failed to update pricing config" });
  }
});

// ============================================================
// SafeGo Parcel System: BD Domestic + International APIs
// ============================================================

import { ParcelPricingEngine, seedParcelZones } from "../services/parcelPricingEngine";
import type { Request, Response } from "express";

// POST /api/parcel/bd/calculate-price - Calculate BD parcel price (PUBLIC)
const bdCalculatePriceSchema = z.object({
  isInternational: z.boolean().default(false),
  actualWeightKg: z.number().min(0.01).max(100),
  lengthCm: z.number().min(0).max(300).optional(),
  widthCm: z.number().min(0).max(300).optional(),
  heightCm: z.number().min(0).max(300).optional(),
  domesticZoneType: z.enum(["same_city", "inside_division", "outside_division", "remote"]).optional(),
  destinationCountry: z.string().length(2).optional(),
  deliverySpeed: z.enum(["regular", "quick", "express", "super_express"]).optional(),
  isFragile: z.boolean().optional(),
  codEnabled: z.boolean().optional(),
  codAmount: z.number().min(0).optional(),
});

publicRouter.post("/bd/calculate-price", async (req: Request, res: Response) => {
  try {
    const validationResult = bdCalculatePriceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const input = validationResult.data;
    const pricing = await ParcelPricingEngine.calculatePrice({
      countryCode: "BD",
      ...input,
    });

    res.json({ pricing });
  } catch (error: any) {
    console.error("[Parcel BD] Error calculating price:", error);
    res.status(500).json({ error: error.message || "Failed to calculate price" });
  }
});

// GET /api/parcel/bd/zones - Get BD domestic zones (PUBLIC)
publicRouter.get("/bd/zones", async (req: Request, res: Response) => {
  try {
    const domesticZones = await prisma.parcelDomesticZone.findMany({
      where: { countryCode: "BD", isActive: true },
      orderBy: { zoneType: "asc" },
    });

    const internationalZones = await prisma.parcelInternationalZone.findMany({
      where: { originCountry: "BD", isActive: true },
      orderBy: { zoneType: "asc" },
    });

    res.json({
      domestic: domesticZones.map((z) => ({
        id: z.id,
        zoneType: z.zoneType,
        zoneName: z.zoneName,
        zoneCode: z.zoneCode,
        rates: {
          "0-1kg": Number(z.rate0to1kg),
          "1-2kg": Number(z.rate1to2kg),
          "2-5kg": Number(z.rate2to5kg),
          "5-10kg": Number(z.rate5to10kg),
          "above10kg": Number(z.rateAbove10kg),
        },
        remoteSurcharge: z.remoteSurcharge ? Number(z.remoteSurcharge) : null,
      })),
      international: internationalZones.map((z) => ({
        id: z.id,
        zoneType: z.zoneType,
        zoneName: z.zoneName,
        destinationCountries: z.destinationCountries,
        rates: {
          "0-0.5kg": Number(z.rate0to0_5kg),
          "0.5-1kg": Number(z.rate0_5to1kg),
          "1-2kg": Number(z.rate1to2kg),
          "2-5kg": Number(z.rate2to5kg),
          "5-10kg": Number(z.rate5to10kg),
          "above10kg": Number(z.rateAbove10kg),
        },
        fuelSurchargePercent: Number(z.fuelSurchargePercent),
        securitySurcharge: Number(z.securitySurcharge),
        estimatedDays: { min: z.estimatedDaysMin, max: z.estimatedDaysMax },
      })),
    });
  } catch (error: any) {
    console.error("[Parcel BD] Error fetching zones:", error);
    res.status(500).json({ error: error.message || "Failed to fetch zones" });
  }
});

// GET /api/parcel/bd/surcharges - Get surcharge rules (PUBLIC)
publicRouter.get("/bd/surcharges", async (req: Request, res: Response) => {
  try {
    const surcharges = await prisma.parcelSurchargeRule.findMany({
      where: { countryCode: "BD", isActive: true },
    });

    res.json({
      surcharges: surcharges.map((s) => ({
        ruleType: s.ruleType,
        displayName: s.displayName,
        description: s.description,
        flatAmount: s.flatAmount ? Number(s.flatAmount) : null,
        percentAmount: s.percentAmount ? Number(s.percentAmount) : null,
        minAmount: s.minAmount ? Number(s.minAmount) : null,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel BD] Error fetching surcharges:", error);
    res.status(500).json({ error: error.message || "Failed to fetch surcharges" });
  }
});

// POST /api/parcel/bd/request - Create a BD parcel delivery request
const bdParcelRequestSchema = z.object({
  pickupAddress: z.string().min(1).max(500),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffAddress: z.string().min(1).max(500),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  senderName: z.string().min(1).max(100),
  senderPhone: z.string().min(1).max(20),
  receiverName: z.string().min(1).max(100),
  receiverPhone: z.string().min(1).max(20),
  parcelType: z.string().min(1).max(50),
  parcelDescription: z.string().max(500).optional(),
  specialInstructions: z.string().max(500).optional(),
  actualWeightKg: z.number().min(0.01).max(100),
  lengthCm: z.number().min(0).max(300).optional(),
  widthCm: z.number().min(0).max(300).optional(),
  heightCm: z.number().min(0).max(300).optional(),
  isInternational: z.boolean().default(false),
  destinationCountry: z.string().length(2).optional(),
  domesticZoneType: z.enum(["same_city", "inside_division", "outside_division", "remote"]).optional(),
  deliverySpeed: z.enum(["regular", "quick", "express", "super_express"]).optional(),
  isFragile: z.boolean().optional(),
  codEnabled: z.boolean().optional(),
  codAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["cash", "online"]),
  scheduledPickupTime: z.string().datetime().optional(),
});

router.post("/bd/request", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = bdParcelRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const pricing = await ParcelPricingEngine.calculatePrice({
      countryCode: "BD",
      isInternational: data.isInternational,
      actualWeightKg: data.actualWeightKg,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      domesticZoneType: data.domesticZoneType,
      destinationCountry: data.destinationCountry,
      deliverySpeed: data.deliverySpeed,
      isFragile: data.isFragile,
      codEnabled: data.codEnabled,
      codAmount: data.codAmount,
    });

    const deliveryId = `DEL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const delivery = await prisma.delivery.create({
      data: {
        id: deliveryId,
        customerId: customer.id,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        serviceFare: new Prisma.Decimal(pricing.totalDeliveryCharge),
        safegoCommission: new Prisma.Decimal(pricing.commissionAmount),
        driverPayout: new Prisma.Decimal(pricing.driverPayoutAmount),
        paymentMethod: data.paymentMethod,
        status: "requested",
        serviceType: "parcel",
        countryCode: "BD",
        parcelType: data.parcelType,
        parcelDescription: data.parcelDescription,
        specialInstructions: data.specialInstructions,
        senderName: data.senderName,
        senderPhone: data.senderPhone,
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        actualWeightKg: new Prisma.Decimal(data.actualWeightKg),
        volumetricWeightKg: pricing.volumetricWeightKg ? new Prisma.Decimal(pricing.volumetricWeightKg) : null,
        chargeableWeightKg: new Prisma.Decimal(pricing.chargeableWeightKg),
        lengthCm: data.lengthCm ? new Prisma.Decimal(data.lengthCm) : null,
        widthCm: data.widthCm ? new Prisma.Decimal(data.widthCm) : null,
        heightCm: data.heightCm ? new Prisma.Decimal(data.heightCm) : null,
        isFragile: data.isFragile || false,
        domesticZoneType: data.domesticZoneType || null,
        isInternational: data.isInternational,
        destinationCountry: data.destinationCountry,
        deliverySpeed: data.deliverySpeed || "regular",
        codEnabled: data.codEnabled || false,
        codAmount: data.codAmount ? new Prisma.Decimal(data.codAmount) : null,
        baseDeliveryCharge: new Prisma.Decimal(pricing.baseDeliveryCharge),
        speedSurcharge: new Prisma.Decimal(pricing.speedSurcharge),
        fragileSurcharge: new Prisma.Decimal(pricing.fragileSurcharge),
        remoteSurcharge: new Prisma.Decimal(pricing.remoteSurcharge),
        fuelSurchargePercent: new Prisma.Decimal(pricing.fuelSurchargePercent),
        fuelSurchargeAmount: new Prisma.Decimal(pricing.fuelSurchargeAmount),
        codFee: new Prisma.Decimal(pricing.codFee),
        securitySurcharge: new Prisma.Decimal(pricing.securitySurcharge),
        totalDeliveryCharge: new Prisma.Decimal(pricing.totalDeliveryCharge),
        commissionAmount: new Prisma.Decimal(pricing.commissionAmount),
        driverPayoutAmount: new Prisma.Decimal(pricing.driverPayoutAmount),
        pricingBreakdown: pricing.breakdown,
        scheduledPickupTime: data.scheduledPickupTime ? new Date(data.scheduledPickupTime) : null,
        pickupType: data.scheduledPickupTime ? "scheduled" : "immediate",
        statusHistory: [{ status: "requested", timestamp: new Date().toISOString(), actor: "customer" }],
      },
    });

    res.status(201).json({
      message: "Parcel delivery request created successfully",
      delivery: {
        id: delivery.id,
        status: delivery.status,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        totalCharge: pricing.totalDeliveryCharge,
        currency: pricing.currency,
        breakdown: pricing.breakdown,
        estimatedDays: pricing.estimatedDays,
      },
    });
  } catch (error: any) {
    console.error("[Parcel BD] Error creating delivery:", error);
    res.status(500).json({ error: error.message || "Failed to create parcel delivery" });
  }
});

// GET /api/parcel/bd/my-parcels - Get customer's parcels
router.get("/bd/my-parcels", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const parcels = await prisma.delivery.findMany({
      where: {
        customerId: customer.id,
        serviceType: "parcel",
        countryCode: "BD",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      parcels: parcels.map((p) => ({
        id: p.id,
        status: p.status,
        pickupAddress: p.pickupAddress,
        dropoffAddress: p.dropoffAddress,
        senderName: p.senderName,
        receiverName: p.receiverName,
        parcelType: p.parcelType,
        isInternational: p.isInternational,
        totalCharge: p.totalDeliveryCharge ? Number(p.totalDeliveryCharge) : Number(p.serviceFare),
        codEnabled: p.codEnabled,
        codAmount: p.codAmount ? Number(p.codAmount) : null,
        deliverySpeed: p.deliverySpeed,
        createdAt: p.createdAt,
        deliveredAt: p.deliveredAt,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel BD] Error fetching parcels:", error);
    res.status(500).json({ error: error.message || "Failed to fetch parcels" });
  }
});

// GET /api/parcel/bd/:id - Get parcel details
router.get("/bd/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const parcelId = req.params.id;

    const parcel = await prisma.delivery.findUnique({
      where: { id: parcelId },
      include: {
        customer: {
          select: { fullName: true, user: { select: { phone: true } } },
        },
        driver: {
          select: { fullName: true, phoneNumber: true, profilePhotoUrl: true },
        },
        proofPhotos: true,
      },
    });

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    if (role === "customer") {
      const customer = await prisma.customerProfile.findUnique({ where: { userId } });
      if (parcel.customerId !== customer?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driver = await prisma.driverProfile.findUnique({ where: { userId } });
      if (parcel.driverId !== driver?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      parcel: {
        id: parcel.id,
        status: parcel.status,
        pickupAddress: parcel.pickupAddress,
        pickupLat: parcel.pickupLat,
        pickupLng: parcel.pickupLng,
        dropoffAddress: parcel.dropoffAddress,
        dropoffLat: parcel.dropoffLat,
        dropoffLng: parcel.dropoffLng,
        senderName: parcel.senderName,
        senderPhone: role !== "customer" ? parcel.senderPhone : null,
        receiverName: parcel.receiverName,
        receiverPhone: role !== "customer" ? parcel.receiverPhone : null,
        parcelType: parcel.parcelType,
        parcelDescription: parcel.parcelDescription,
        specialInstructions: parcel.specialInstructions,
        actualWeightKg: parcel.actualWeightKg ? Number(parcel.actualWeightKg) : null,
        chargeableWeightKg: parcel.chargeableWeightKg ? Number(parcel.chargeableWeightKg) : null,
        isFragile: parcel.isFragile,
        isInternational: parcel.isInternational,
        destinationCountry: parcel.destinationCountry,
        domesticZoneType: parcel.domesticZoneType,
        deliverySpeed: parcel.deliverySpeed,
        codEnabled: parcel.codEnabled,
        codAmount: parcel.codAmount ? Number(parcel.codAmount) : null,
        codCollected: parcel.codCollected,
        totalCharge: parcel.totalDeliveryCharge ? Number(parcel.totalDeliveryCharge) : Number(parcel.serviceFare),
        pricingBreakdown: parcel.pricingBreakdown,
        paymentMethod: parcel.paymentMethod,
        driverInfo: parcel.driver ? {
          name: parcel.driver.fullName,
          phone: parcel.driver.phoneNumber,
          photo: parcel.driver.profilePhotoUrl,
        } : null,
        proofPhotos: parcel.proofPhotos.map((p) => ({
          id: p.id,
          photoUrl: p.photoUrl,
          capturedAt: p.capturedAt,
        })),
        statusHistory: parcel.statusHistory,
        createdAt: parcel.createdAt,
        acceptedAt: parcel.acceptedAt,
        pickedUpAt: parcel.pickedUpAt,
        deliveredAt: parcel.deliveredAt,
      },
    });
  } catch (error: any) {
    console.error("[Parcel BD] Error fetching parcel:", error);
    res.status(500).json({ error: error.message || "Failed to fetch parcel" });
  }
});

// POST /api/parcel/bd/seed-zones - Seed BD zones (admin only)
router.post("/bd/seed-zones", requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    await seedParcelZones();
    res.json({ success: true, message: "BD zones seeded successfully" });
  } catch (error: any) {
    console.error("[Parcel BD] Error seeding zones:", error);
    res.status(500).json({ error: error.message || "Failed to seed zones" });
  }
});

// ============================================================
// Driver Parcel APIs
// ============================================================

// GET /api/parcel/driver/available - Get available parcel jobs for driver
router.get("/driver/available", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const parcels = await prisma.delivery.findMany({
      where: {
        serviceType: "parcel",
        status: { in: ["requested", "searching_driver"] },
        driverId: null,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      parcels: parcels.map((p) => ({
        id: p.id,
        pickupAddress: p.pickupAddress,
        pickupLat: p.pickupLat,
        pickupLng: p.pickupLng,
        dropoffAddress: p.dropoffAddress,
        dropoffLat: p.dropoffLat,
        dropoffLng: p.dropoffLng,
        parcelType: p.parcelType,
        chargeableWeightKg: p.chargeableWeightKg ? Number(p.chargeableWeightKg) : null,
        isFragile: p.isFragile,
        codEnabled: p.codEnabled,
        codAmount: p.codAmount ? Number(p.codAmount) : null,
        driverPayout: Number(p.driverPayout),
        deliverySpeed: p.deliverySpeed,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel Driver] Error fetching available:", error);
    res.status(500).json({ error: error.message || "Failed to fetch available parcels" });
  }
});

// POST /api/parcel/driver/:id/accept - Accept a parcel job
router.post("/driver/:id/accept", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parcelId = req.params.id;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const parcel = await prisma.delivery.findUnique({
      where: { id: parcelId },
    });

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    if (parcel.driverId) {
      return res.status(400).json({ error: "Parcel already assigned to a driver" });
    }

    if (!["requested", "searching_driver"].includes(parcel.status)) {
      return res.status(400).json({ error: "Parcel cannot be accepted in current status" });
    }

    const updatedHistory = [...(parcel.statusHistory as any[] || []), {
      status: "accepted",
      timestamp: new Date().toISOString(),
      actor: "driver",
    }];

    const updated = await prisma.delivery.update({
      where: { id: parcelId },
      data: {
        driverId: driver.id,
        status: "accepted",
        acceptedAt: new Date(),
        statusHistory: updatedHistory,
      },
    });

    res.json({
      success: true,
      message: "Parcel accepted successfully",
      parcel: {
        id: updated.id,
        status: updated.status,
        pickupAddress: updated.pickupAddress,
        dropoffAddress: updated.dropoffAddress,
        driverPayout: Number(updated.driverPayout),
      },
    });
  } catch (error: any) {
    console.error("[Parcel Driver] Error accepting parcel:", error);
    res.status(500).json({ error: error.message || "Failed to accept parcel" });
  }
});

// POST /api/parcel/driver/:id/picked-up - Mark parcel as picked up
router.post("/driver/:id/picked-up", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parcelId = req.params.id;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const parcel = await prisma.delivery.findFirst({
      where: { id: parcelId, driverId: driver.id },
    });

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found or not assigned to you" });
    }

    if (parcel.status !== "accepted") {
      return res.status(400).json({ error: "Parcel must be in accepted status" });
    }

    const updatedHistory = [...(parcel.statusHistory as any[] || []), {
      status: "picked_up",
      timestamp: new Date().toISOString(),
      actor: "driver",
    }];

    const updated = await prisma.delivery.update({
      where: { id: parcelId },
      data: {
        status: "picked_up",
        pickedUpAt: new Date(),
        statusHistory: updatedHistory,
      },
    });

    res.json({
      success: true,
      message: "Parcel marked as picked up",
      parcel: { id: updated.id, status: updated.status },
    });
  } catch (error: any) {
    console.error("[Parcel Driver] Error updating status:", error);
    res.status(500).json({ error: error.message || "Failed to update status" });
  }
});

// POST /api/parcel/driver/:id/on-the-way - Mark parcel as on the way
router.post("/driver/:id/on-the-way", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parcelId = req.params.id;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const parcel = await prisma.delivery.findFirst({
      where: { id: parcelId, driverId: driver.id },
    });

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found or not assigned to you" });
    }

    if (parcel.status !== "picked_up") {
      return res.status(400).json({ error: "Parcel must be in picked_up status" });
    }

    const updatedHistory = [...(parcel.statusHistory as any[] || []), {
      status: "on_the_way",
      timestamp: new Date().toISOString(),
      actor: "driver",
    }];

    const updated = await prisma.delivery.update({
      where: { id: parcelId },
      data: {
        status: "on_the_way",
        statusHistory: updatedHistory,
      },
    });

    res.json({
      success: true,
      message: "Parcel marked as on the way",
      parcel: { id: updated.id, status: updated.status },
    });
  } catch (error: any) {
    console.error("[Parcel Driver] Error updating status:", error);
    res.status(500).json({ error: error.message || "Failed to update status" });
  }
});

// POST /api/parcel/driver/:id/delivered - Mark parcel as delivered
const deliveredSchema = z.object({
  codCollected: z.boolean().optional(),
  proofPhotoUrl: z.string().url().optional(),
});

router.post("/driver/:id/delivered", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const parcelId = req.params.id;

    const validationResult = deliveredSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { codCollected, proofPhotoUrl } = validationResult.data;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const parcel = await prisma.delivery.findFirst({
      where: { id: parcelId, driverId: driver.id },
    });

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found or not assigned to you" });
    }

    if (!["picked_up", "on_the_way"].includes(parcel.status)) {
      return res.status(400).json({ error: "Parcel must be picked up or on the way" });
    }

    if (parcel.codEnabled && !codCollected) {
      return res.status(400).json({ error: "COD amount must be collected before marking as delivered" });
    }

    const updatedHistory = [...(parcel.statusHistory as any[] || []), {
      status: "delivered",
      timestamp: new Date().toISOString(),
      actor: "driver",
    }];

    const updated = await prisma.delivery.update({
      where: { id: parcelId },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
        codCollected: codCollected || false,
        codCollectedAt: codCollected ? new Date() : null,
        statusHistory: updatedHistory,
        negativeBalanceApplied: parcel.paymentMethod === "cash",
      },
    });

    if (proofPhotoUrl) {
      await prisma.deliveryProofPhoto.create({
        data: {
          deliveryId: parcelId,
          driverId: driver.id,
          photoUrl: proofPhotoUrl,
        },
      });
    }

    res.json({
      success: true,
      message: "Parcel delivered successfully",
      parcel: {
        id: updated.id,
        status: updated.status,
        driverPayout: Number(updated.driverPayout),
        codCollected: updated.codCollected,
      },
    });
  } catch (error: any) {
    console.error("[Parcel Driver] Error delivering parcel:", error);
    res.status(500).json({ error: error.message || "Failed to deliver parcel" });
  }
});

// GET /api/parcel/driver/my-jobs - Get driver's active/completed parcels
router.get("/driver/my-jobs", requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status } = req.query;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const whereClause: any = {
      driverId: driver.id,
      serviceType: "parcel",
    };

    if (status === "active") {
      whereClause.status = { in: ["accepted", "picked_up", "on_the_way"] };
    } else if (status === "completed") {
      whereClause.status = "delivered";
    }

    const parcels = await prisma.delivery.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      parcels: parcels.map((p) => ({
        id: p.id,
        status: p.status,
        pickupAddress: p.pickupAddress,
        dropoffAddress: p.dropoffAddress,
        parcelType: p.parcelType,
        chargeableWeightKg: p.chargeableWeightKg ? Number(p.chargeableWeightKg) : null,
        codEnabled: p.codEnabled,
        codAmount: p.codAmount ? Number(p.codAmount) : null,
        codCollected: p.codCollected,
        driverPayout: Number(p.driverPayout),
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt,
        acceptedAt: p.acceptedAt,
        deliveredAt: p.deliveredAt,
      })),
    });
  } catch (error: any) {
    console.error("[Parcel Driver] Error fetching jobs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch jobs" });
  }
});

export default router;
