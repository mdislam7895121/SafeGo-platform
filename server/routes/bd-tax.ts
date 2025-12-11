/**
 * Bangladesh Tax Routes
 * 
 * Admin-only endpoints for managing BD tax rules
 */

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import {
  getBdTaxRules,
  updateBdTaxRule,
  seedBdTaxRules,
  calculateBangladeshTax,
} from "../services/bangladeshTaxService";
import { BdServiceType } from "@prisma/client";

const router = Router();

router.use(authenticateToken);

const adminOnly = (req: AuthRequest, res: any, next: any) => {
  if (!["admin", "super_admin"].includes(req.user?.role || "")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.get("/rules", adminOnly, async (req: AuthRequest, res) => {
  try {
    const rules = await getBdTaxRules();

    const formattedRules = rules.map((rule) => ({
      id: rule.id,
      serviceType: rule.serviceType,
      serviceDisplayName: getServiceDisplayName(rule.serviceType),
      bdTaxType: rule.bdTaxType,
      bdTaxRatePercentage: Number(rule.bdTaxRatePercentage),
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));

    res.json({
      success: true,
      rules: formattedRules,
    });
  } catch (error) {
    console.error("[BdTaxRoutes] List error:", error);
    res.status(500).json({ error: "Failed to fetch BD tax rules" });
  }
});

const updateRuleSchema = z.object({
  bdTaxRatePercentage: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

router.patch("/rules/:serviceType", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { serviceType } = req.params;

    const validServiceTypes: BdServiceType[] = ["ride", "food", "parcel", "shop", "ticket", "rental"];
    if (!validServiceTypes.includes(serviceType as BdServiceType)) {
      return res.status(400).json({ error: "Invalid service type" });
    }

    const parsed = updateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updatedRule = await updateBdTaxRule(
      serviceType as BdServiceType,
      parsed.data,
      req.user?.userId
    );

    console.log(
      `[BdTaxRoutes] Rule updated for ${serviceType} by admin ${req.user?.userId}: ` +
        `rate=${parsed.data.bdTaxRatePercentage ?? "unchanged"}, active=${parsed.data.isActive ?? "unchanged"}`
    );

    res.json({
      success: true,
      rule: {
        id: updatedRule.id,
        serviceType: updatedRule.serviceType,
        bdTaxType: updatedRule.bdTaxType,
        bdTaxRatePercentage: Number(updatedRule.bdTaxRatePercentage),
        isActive: updatedRule.isActive,
        updatedAt: updatedRule.updatedAt,
      },
    });
  } catch (error) {
    console.error("[BdTaxRoutes] Update error:", error);
    res.status(500).json({ error: "Failed to update BD tax rule" });
  }
});

router.post("/preview", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { serviceType, baseAmount } = req.body;

    if (!serviceType || baseAmount === undefined) {
      return res.status(400).json({ error: "serviceType and baseAmount required" });
    }

    const result = await calculateBangladeshTax({
      serviceType,
      countryCode: "BD",
      baseAmount,
    });

    res.json({
      success: true,
      preview: {
        serviceType,
        baseAmount: Number(baseAmount),
        ...result,
      },
    });
  } catch (error) {
    console.error("[BdTaxRoutes] Preview error:", error);
    res.status(500).json({ error: "Failed to calculate preview" });
  }
});

router.post("/seed", adminOnly, async (req: AuthRequest, res) => {
  try {
    await seedBdTaxRules();
    const rules = await getBdTaxRules();

    res.json({
      success: true,
      message: "BD tax rules seeded successfully",
      rulesCount: rules.length,
    });
  } catch (error) {
    console.error("[BdTaxRoutes] Seed error:", error);
    res.status(500).json({ error: "Failed to seed BD tax rules" });
  }
});

function getServiceDisplayName(serviceType: string): string {
  const names: Record<string, string> = {
    ride: "Rides",
    food: "Food Orders",
    parcel: "Parcel Deliveries",
    shop: "Shop Orders",
    ticket: "Ticket Bookings",
    rental: "Rental Bookings",
  };
  return names[serviceType] || serviceType;
}

export default router;
