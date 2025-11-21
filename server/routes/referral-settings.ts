import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, loadAdminProfile } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { z } from "zod";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

// ====================================================
// GET /api/admin/referral-settings
// List all referral settings with optional filters
// ====================================================
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { countryCode, userType, status, isDemo } = req.query;

    const where: any = {
      isDemo: isDemo === "true" ? true : false,
    };

    if (countryCode) {
      where.countryCode = countryCode as string;
    }

    if (userType && (userType === "driver" || userType === "rider")) {
      where.userType = userType;
    }

    // Status filter logic
    const now = new Date();
    if (status === "active") {
      where.isActive = true;
      where.OR = [
        { startAt: null, endAt: null },
        { startAt: { lte: now }, endAt: { gte: now } },
        { startAt: { lte: now }, endAt: null },
        { startAt: null, endAt: { gte: now } },
      ];
    } else if (status === "scheduled") {
      where.isActive = true;
      where.startAt = { gt: now };
    } else if (status === "expired") {
      where.OR = [
        { isActive: false },
        { endAt: { lt: now } },
      ];
    }

    const settings = await prisma.referralSetting.findMany({
      where,
      orderBy: [
        { countryCode: "asc" },
        { userType: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        _count: {
          select: { referralRewards: true },
        },
      },
    });

    // Calculate effective bonus for each setting
    const enrichedSettings = settings.map(setting => {
      const isWithinDateRange = 
        (!setting.startAt || new Date(setting.startAt) <= now) &&
        (!setting.endAt || new Date(setting.endAt) >= now);
      
      let effectiveBonus = setting.baseAmount;
      let isPromoActive = false;

      if (setting.isActive && isWithinDateRange) {
        if (setting.promoAmount && setting.promoAmount.gt(setting.baseAmount)) {
          effectiveBonus = setting.promoAmount;
          isPromoActive = true;
        } else if (setting.promoMultiplier) {
          effectiveBonus = setting.baseAmount.mul(setting.promoMultiplier);
          isPromoActive = true;
        }
      }

      return {
        ...setting,
        effectiveBonus: effectiveBonus.toString(),
        isPromoActive,
        rewardsCount: setting._count.referralRewards,
      };
    });

    res.json({ settings: enrichedSettings });
  } catch (error) {
    console.error("Error fetching referral settings:", error);
    res.status(500).json({ error: "Failed to fetch referral settings" });
  }
});

// ====================================================
// GET /api/admin/referral-settings/:id
// Get single referral setting by ID
// ====================================================
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const setting = await prisma.referralSetting.findUnique({
      where: { id },
      include: {
        _count: {
          select: { referralRewards: true },
        },
      },
    });

    if (!setting) {
      return res.status(404).json({ error: "Referral setting not found" });
    }

    res.json({ setting });
  } catch (error) {
    console.error("Error fetching referral setting:", error);
    res.status(500).json({ error: "Failed to fetch referral setting" });
  }
});

// ====================================================
// POST /api/admin/referral-settings
// Create new referral setting
// ====================================================
const createSettingSchema = z.object({
  countryCode: z.string().length(2),
  userType: z.enum(["driver", "rider"]),
  currency: z.string().min(3).max(3),
  baseAmount: z.number().min(0),
  promoAmount: z.number().min(0).optional(),
  promoMultiplier: z.number().min(1).optional(),
  promoLabel: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
  isDemo: z.boolean().default(false),
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = createSettingSchema.parse(req.body);

    // Validation: Cannot have both promoAmount and promoMultiplier
    if (data.promoAmount && data.promoMultiplier) {
      return res.status(400).json({ 
        error: "Cannot set both promo_amount and promo_multiplier. Choose one." 
      });
    }

    // Validation: Promo amount must be >= base amount
    if (data.promoAmount && data.promoAmount < data.baseAmount) {
      return res.status(400).json({ 
        error: "Promo amount must be greater than or equal to base amount" 
      });
    }

    // Validation: End date must be after start date
    if (data.startAt && data.endAt && new Date(data.endAt) <= new Date(data.startAt)) {
      return res.status(400).json({ 
        error: "End date must be after start date" 
      });
    }

    // Check for existing active setting with same country/userType
    if (data.isActive) {
      const existingActive = await prisma.referralSetting.findFirst({
        where: {
          countryCode: data.countryCode,
          userType: data.userType,
          isActive: true,
          isDemo: data.isDemo,
        },
      });

      if (existingActive) {
        return res.status(409).json({ 
          error: `An active referral setting already exists for ${data.userType}s in ${data.countryCode}. Please deactivate it first.` 
        });
      }
    }

    const setting = await prisma.referralSetting.create({
      data: {
        countryCode: data.countryCode,
        userType: data.userType,
        currency: data.currency,
        baseAmount: data.baseAmount,
        promoAmount: data.promoAmount,
        promoMultiplier: data.promoMultiplier,
        promoLabel: data.promoLabel,
        startAt: data.startAt ? new Date(data.startAt) : null,
        endAt: data.endAt ? new Date(data.endAt) : null,
        isActive: data.isActive,
        notes: data.notes,
        isDemo: data.isDemo,
        createdByAdminId: req.user!.userId,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.CREATE,
      entityType: EntityType.REFERRAL_SETTING,
      entityId: setting.id,
      description: `Created referral setting for ${setting.userType}s in ${setting.countryCode}`,
      metadata: {
        countryCode: setting.countryCode,
        userType: setting.userType,
        baseAmount: setting.baseAmount.toString(),
        promoAmount: setting.promoAmount?.toString(),
        currency: setting.currency,
      },
      success: true,
    });

    res.status(201).json({ setting });
  } catch (error) {
    console.error("Error creating referral setting:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create referral setting" });
  }
});

// ====================================================
// PATCH /api/admin/referral-settings/:id
// Update existing referral setting
// ====================================================
const updateSettingSchema = z.object({
  baseAmount: z.number().min(0).optional(),
  promoAmount: z.number().min(0).optional().nullable(),
  promoMultiplier: z.number().min(1).optional().nullable(),
  promoLabel: z.string().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateSettingSchema.parse(req.body);

    const existing = await prisma.referralSetting.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Referral setting not found" });
    }

    // Validation: Cannot have both promoAmount and promoMultiplier
    const finalPromoAmount = data.promoAmount !== undefined ? data.promoAmount : existing.promoAmount;
    const finalPromoMultiplier = data.promoMultiplier !== undefined ? data.promoMultiplier : existing.promoMultiplier;
    
    if (finalPromoAmount && finalPromoMultiplier) {
      return res.status(400).json({ 
        error: "Cannot set both promo_amount and promo_multiplier. Set one to null." 
      });
    }

    // Validation: Promo amount must be >= base amount
    const finalBaseAmount = data.baseAmount !== undefined ? data.baseAmount : existing.baseAmount;
    if (finalPromoAmount && finalPromoAmount.toString() && parseFloat(finalPromoAmount.toString()) < parseFloat(finalBaseAmount.toString())) {
      return res.status(400).json({ 
        error: "Promo amount must be greater than or equal to base amount" 
      });
    }

    // Validation: End date must be after start date
    const finalStartAt = data.startAt !== undefined ? data.startAt : existing.startAt;
    const finalEndAt = data.endAt !== undefined ? data.endAt : existing.endAt;
    if (finalStartAt && finalEndAt && new Date(finalEndAt) <= new Date(finalStartAt)) {
      return res.status(400).json({ 
        error: "End date must be after start date" 
      });
    }

    const setting = await prisma.referralSetting.update({
      where: { id },
      data: {
        ...data,
        startAt: data.startAt !== undefined ? (data.startAt ? new Date(data.startAt) : null) : undefined,
        endAt: data.endAt !== undefined ? (data.endAt ? new Date(data.endAt) : null) : undefined,
        updatedByAdminId: req.user!.userId,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.UPDATE,
      entityType: EntityType.REFERRAL_SETTING,
      entityId: setting.id,
      description: `Updated referral setting for ${setting.userType}s in ${setting.countryCode}`,
      metadata: {
        old: { baseAmount: existing.baseAmount.toString() },
        new: { baseAmount: setting.baseAmount.toString() },
      },
      success: true,
    });

    res.json({ setting });
  } catch (error) {
    console.error("Error updating referral setting:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update referral setting" });
  }
});

// ====================================================
// POST /api/admin/referral-settings/:id/deactivate
// Deactivate a referral setting
// ====================================================
router.post("/:id/deactivate", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.referralSetting.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Referral setting not found" });
    }

    if (!existing.isActive) {
      return res.status(400).json({ error: "Referral setting is already inactive" });
    }

    const setting = await prisma.referralSetting.update({
      where: { id },
      data: {
        isActive: false,
        updatedByAdminId: req.user!.userId,
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.UPDATE,
      entityType: EntityType.REFERRAL_SETTING,
      entityId: setting.id,
      description: `Deactivated referral setting for ${setting.userType}s in ${setting.countryCode}`,
      success: true,
    });

    res.json({ setting, message: "Referral setting deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating referral setting:", error);
    res.status(500).json({ error: "Failed to deactivate referral setting" });
  }
});

// ====================================================
// DELETE /api/admin/referral-settings/:id
// Delete a referral setting (only if no rewards exist)
// ====================================================
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.referralSetting.findUnique({
      where: { id },
      include: {
        _count: {
          select: { referralRewards: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Referral setting not found" });
    }

    if (existing._count.referralRewards > 0) {
      return res.status(400).json({ 
        error: `Cannot delete referral setting with ${existing._count.referralRewards} existing rewards. Deactivate it instead.` 
      });
    }

    await prisma.referralSetting.delete({
      where: { id },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.DELETE,
      entityType: EntityType.REFERRAL_SETTING,
      entityId: id,
      description: `Deleted referral setting for ${existing.userType}s in ${existing.countryCode}`,
      success: true,
    });

    res.json({ message: "Referral setting deleted successfully" });
  } catch (error) {
    console.error("Error deleting referral setting:", error);
    res.status(500).json({ error: "Failed to delete referral setting" });
  }
});

export default router;
