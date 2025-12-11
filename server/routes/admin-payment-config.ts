import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(["admin", "super_admin", "finance_admin"]));

const updatePaymentConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  iconName: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  supportsSaving: z.boolean().optional(),
  isDefaultForCountry: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  requiresKycLevel: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  supportsRecurring: z.boolean().optional(),
});

const createPaymentConfigSchema = z.object({
  countryCode: z.string().length(2),
  methodType: z.string().min(1),
  provider: z.string().min(1),
  serviceType: z.string().default("GLOBAL"),
  isEnabled: z.boolean().default(true),
  displayName: z.string().min(1),
  description: z.string().optional(),
  iconName: z.string().optional(),
  sortOrder: z.number().int().min(0).default(10),
  supportsSaving: z.boolean().default(true),
  isDefaultForCountry: z.boolean().default(false),
  priority: z.number().int().min(0).max(100).default(50),
  requiresKycLevel: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  supportsRecurring: z.boolean().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const { country, service, enabled } = req.query;

    const where: any = {};
    if (country) where.countryCode = country;
    if (service) where.serviceType = service;
    if (enabled !== undefined) where.isEnabled = enabled === "true";

    const configs = await prisma.countryPaymentConfig.findMany({
      where,
      orderBy: [
        { countryCode: "asc" },
        { serviceType: "asc" },
        { sortOrder: "asc" },
        { priority: "desc" },
      ],
    });

    const summary = {
      total: configs.length,
      enabled: configs.filter((c) => c.isEnabled).length,
      byCountry: {} as Record<string, number>,
      byService: {} as Record<string, number>,
    };

    configs.forEach((c) => {
      summary.byCountry[c.countryCode] = (summary.byCountry[c.countryCode] || 0) + 1;
      summary.byService[c.serviceType] = (summary.byService[c.serviceType] || 0) + 1;
    });

    res.json({
      configs,
      summary,
    });
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error listing configs:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const config = await prisma.countryPaymentConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return res.status(404).json({ error: "Payment config not found" });
    }

    res.json(config);
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error fetching config:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const body = createPaymentConfigSchema.parse(req.body);

    const existing = await prisma.countryPaymentConfig.findFirst({
      where: {
        countryCode: body.countryCode,
        methodType: body.methodType,
        serviceType: body.serviceType,
      },
    });

    if (existing) {
      return res.status(409).json({
        error: `Payment config already exists for ${body.methodType} in ${body.countryCode} (${body.serviceType})`,
      });
    }

    const config = await prisma.countryPaymentConfig.create({
      data: body,
    });

    res.status(201).json(config);
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error creating config:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const body = updatePaymentConfigSchema.parse(req.body);

    const existing = await prisma.countryPaymentConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Payment config not found" });
    }

    const config = await prisma.countryPaymentConfig.update({
      where: { id },
      data: body,
    });

    res.json(config);
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error updating config:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.patch("/:id/toggle", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.countryPaymentConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Payment config not found" });
    }

    const config = await prisma.countryPaymentConfig.update({
      where: { id },
      data: { isEnabled: !existing.isEnabled },
    });

    res.json({
      success: true,
      isEnabled: config.isEnabled,
      message: `Payment method ${config.isEnabled ? "enabled" : "disabled"}`,
    });
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error toggling config:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.countryPaymentConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Payment config not found" });
    }

    await prisma.countryPaymentConfig.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Payment config deleted",
    });
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error deleting config:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.post("/bulk-update", async (req: AuthRequest, res) => {
  try {
    const { countryCode, methodType, updates } = req.body;

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Updates object required" });
    }

    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (methodType) where.methodType = methodType;

    const result = await prisma.countryPaymentConfig.updateMany({
      where,
      data: updates,
    });

    res.json({
      success: true,
      count: result.count,
      message: `Updated ${result.count} payment configs`,
    });
  } catch (error: any) {
    console.error("[AdminPaymentConfig] Error bulk updating:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
