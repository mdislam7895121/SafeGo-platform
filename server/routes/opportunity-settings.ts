import { Router } from "express";
import { PrismaClient, OpportunityBonusType } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";

const router = Router();
const prisma = new PrismaClient();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole(["admin"]));

// Validation schema for creating opportunity settings
const createOpportunitySettingSchema = z.object({
  bonusType: z.enum(["trip_boost", "surge_boost", "peak_hour_boost", "per_ride_bonus"]),
  countryCode: z.string().min(2).max(2),
  currency: z.string().min(3).max(3),
  baseAmount: z.number().min(0),
  promoAmount: z.number().min(0).optional(),
  promoMultiplier: z.number().min(0).optional(),
  zoneId: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

// Validation schema for updating opportunity settings
const updateOpportunitySettingSchema = createOpportunitySettingSchema.partial();

// ====================================================
// GET /api/admin/opportunity-settings
// List all opportunity settings
// ====================================================
router.get("/", async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.opportunitySetting.findMany({
      where: {
        isDemo: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ settings });
  } catch (error) {
    console.error("Error fetching opportunity settings:", error);
    res.status(500).json({ error: "Failed to fetch opportunity settings" });
  }
});

// ====================================================
// GET /api/admin/opportunity-settings/:id
// Get single opportunity setting by ID
// ====================================================
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const setting = await prisma.opportunitySetting.findUnique({
      where: { id },
    });

    if (!setting) {
      return res.status(404).json({ error: "Opportunity setting not found" });
    }

    res.json(setting);
  } catch (error) {
    console.error("Error fetching opportunity setting:", error);
    res.status(500).json({ error: "Failed to fetch opportunity setting" });
  }
});

// ====================================================
// POST /api/admin/opportunity-settings
// Create new opportunity setting
// ====================================================
router.post("/", async (req: AuthRequest, res) => {
  try {
    const validatedData = createOpportunitySettingSchema.parse(req.body);
    const adminId = req.user!.userId;

    // Validation: Cannot have both promoAmount and promoMultiplier
    if (validatedData.promoAmount && validatedData.promoMultiplier) {
      return res.status(400).json({
        error: "Cannot specify both promo amount and promo multiplier",
      });
    }

    // Validation: Promo amount must be >= base amount
    if (validatedData.promoAmount && validatedData.promoAmount < validatedData.baseAmount) {
      return res.status(400).json({
        error: "Promo amount must be greater than or equal to base amount",
      });
    }

    // Validation: End date must be > start date
    if (validatedData.startAt && validatedData.endAt) {
      if (new Date(validatedData.endAt) <= new Date(validatedData.startAt)) {
        return res.status(400).json({
          error: "End date must be after start date",
        });
      }
    }

    // Check if an active setting already exists for this (bonusType, countryCode, zoneId)
    if (validatedData.isActive) {
      const existingSetting = await prisma.opportunitySetting.findFirst({
        where: {
          bonusType: validatedData.bonusType as OpportunityBonusType,
          countryCode: validatedData.countryCode,
          zoneId: validatedData.zoneId || null,
          isActive: true,
          isDemo: false,
        },
      });

      if (existingSetting) {
        return res.status(409).json({
          error: `An active ${validatedData.bonusType} setting already exists for ${validatedData.countryCode}${validatedData.zoneId ? ` in zone ${validatedData.zoneId}` : ""}`,
        });
      }
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    const newSetting = await prisma.opportunitySetting.create({
      data: {
        bonusType: validatedData.bonusType as OpportunityBonusType,
        countryCode: validatedData.countryCode,
        currency: validatedData.currency,
        baseAmount: validatedData.baseAmount,
        promoAmount: validatedData.promoAmount,
        promoMultiplier: validatedData.promoMultiplier,
        zoneId: validatedData.zoneId,
        startAt: validatedData.startAt ? new Date(validatedData.startAt) : null,
        endAt: validatedData.endAt ? new Date(validatedData.endAt) : null,
        isActive: validatedData.isActive,
        notes: validatedData.notes,
        createdByAdminId: adminId,
        isDemo: false,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: adminId,
      actorEmail: admin?.email || "unknown",
      actorRole: admin?.role || "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.CREATE,
      entityType: "opportunity_setting",
      entityId: newSetting.id,
      description: `Created ${validatedData.bonusType} opportunity setting for ${validatedData.countryCode}`,
      metadata: {
        bonusType: newSetting.bonusType,
        countryCode: newSetting.countryCode,
        baseAmount: newSetting.baseAmount.toString(),
      },
    });

    res.status(201).json(newSetting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating opportunity setting:", error);
    res.status(500).json({ error: "Failed to create opportunity setting" });
  }
});

// ====================================================
// PATCH /api/admin/opportunity-settings/:id
// Update existing opportunity setting
// ====================================================
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateOpportunitySettingSchema.parse(req.body);
    const adminId = req.user!.userId;

    // Check if setting exists
    const existingSetting = await prisma.opportunitySetting.findUnique({
      where: { id },
    });

    if (!existingSetting) {
      return res.status(404).json({ error: "Opportunity setting not found" });
    }

    // Validation: Cannot have both promoAmount and promoMultiplier
    const finalPromoAmount = validatedData.promoAmount !== undefined
      ? validatedData.promoAmount
      : existingSetting.promoAmount?.toNumber();
    const finalPromoMultiplier = validatedData.promoMultiplier !== undefined
      ? validatedData.promoMultiplier
      : existingSetting.promoMultiplier?.toNumber();

    if (finalPromoAmount && finalPromoMultiplier) {
      return res.status(400).json({
        error: "Cannot specify both promo amount and promo multiplier",
      });
    }

    // Validation: Promo amount must be >= base amount
    const finalBaseAmount = validatedData.baseAmount !== undefined
      ? validatedData.baseAmount
      : existingSetting.baseAmount.toNumber();

    if (finalPromoAmount && finalPromoAmount < finalBaseAmount) {
      return res.status(400).json({
        error: "Promo amount must be greater than or equal to base amount",
      });
    }

    // Validation: End date must be > start date
    const finalStartAt = validatedData.startAt !== undefined
      ? (validatedData.startAt ? new Date(validatedData.startAt) : null)
      : existingSetting.startAt;
    const finalEndAt = validatedData.endAt !== undefined
      ? (validatedData.endAt ? new Date(validatedData.endAt) : null)
      : existingSetting.endAt;

    if (finalStartAt && finalEndAt && finalEndAt <= finalStartAt) {
      return res.status(400).json({
        error: "End date must be after start date",
      });
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    // Update the setting
    const updatedSetting = await prisma.opportunitySetting.update({
      where: { id },
      data: {
        ...(validatedData.bonusType && { bonusType: validatedData.bonusType as OpportunityBonusType }),
        ...(validatedData.countryCode && { countryCode: validatedData.countryCode }),
        ...(validatedData.currency && { currency: validatedData.currency }),
        ...(validatedData.baseAmount !== undefined && { baseAmount: validatedData.baseAmount }),
        ...(validatedData.promoAmount !== undefined && { promoAmount: validatedData.promoAmount }),
        ...(validatedData.promoMultiplier !== undefined && { promoMultiplier: validatedData.promoMultiplier }),
        ...(validatedData.zoneId !== undefined && { zoneId: validatedData.zoneId }),
        ...(validatedData.startAt !== undefined && {
          startAt: validatedData.startAt ? new Date(validatedData.startAt) : null,
        }),
        ...(validatedData.endAt !== undefined && {
          endAt: validatedData.endAt ? new Date(validatedData.endAt) : null,
        }),
        ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
        updatedByAdminId: adminId,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: adminId,
      actorEmail: admin?.email || "unknown",
      actorRole: admin?.role || "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.UPDATE,
      entityType: "opportunity_setting",
      entityId: id,
      description: `Updated ${updatedSetting.bonusType} opportunity setting for ${updatedSetting.countryCode}`,
      metadata: {
        changes: Object.keys(validatedData),
      },
    });

    res.json(updatedSetting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating opportunity setting:", error);
    res.status(500).json({ error: "Failed to update opportunity setting" });
  }
});

// ====================================================
// DELETE /api/admin/opportunity-settings/:id
// Deactivate opportunity setting (soft delete)
// ====================================================
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Check if setting exists
    const existingSetting = await prisma.opportunitySetting.findUnique({
      where: { id },
    });

    if (!existingSetting) {
      return res.status(404).json({ error: "Opportunity setting not found" });
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    // Soft delete by setting isActive to false
    const deactivatedSetting = await prisma.opportunitySetting.update({
      where: { id },
      data: {
        isActive: false,
        updatedByAdminId: adminId,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: adminId,
      actorEmail: admin?.email || "unknown",
      actorRole: admin?.role || "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.DELETE,
      entityType: "opportunity_setting",
      entityId: id,
      description: `Deactivated ${deactivatedSetting.bonusType} opportunity setting for ${deactivatedSetting.countryCode}`,
      metadata: {
        bonusType: deactivatedSetting.bonusType,
        countryCode: deactivatedSetting.countryCode,
      },
    });

    res.json({ message: "Opportunity setting deactivated successfully" });
  } catch (error) {
    console.error("Error deleting opportunity setting:", error);
    res.status(500).json({ error: "Failed to deactivate opportunity setting" });
  }
});

export default router;
