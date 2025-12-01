import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { getPhase3Features } from "../config/phase3Features";

const router = Router();

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

export default router;
