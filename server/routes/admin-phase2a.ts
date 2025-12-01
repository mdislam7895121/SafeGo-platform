import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { z } from "zod";
import { logAuditEvent, getClientIp } from "../utils/audit";
import { Prisma } from "@prisma/client";

const logAudit = async (
  req: AuthRequest,
  actionType: string,
  entityType: string,
  entityId: string,
  description: string,
  metadata?: Record<string, any>
) => {
  await logAuditEvent({
    actorId: req.user?.userId || null,
    actorEmail: req.user?.email || "unknown",
    actorRole: req.user?.role || "admin",
    ipAddress: getClientIp(req),
    actionType,
    entityType,
    entityId,
    description,
    metadata,
  });
};

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

const serializeDecimal = (val: any): number => {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(val.toString());
};

const IncentiveRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  countryCode: z.string().min(2, "Country code is required"),
  serviceType: z.enum(["ride", "food", "parcel"]),
  bonusType: z.enum(["per_trip", "streak", "target", "peak_hour", "first_trip"]),
  bonusAmount: z.number().positive("Bonus amount must be positive"),
  currency: z.string().default("USD"),
  triggerConditions: z.record(z.any()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  dailyBudget: z.number().positive().optional().nullable(),
  totalBudget: z.number().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  zoneIds: z.array(z.string()).optional(),
  priority: z.number().int().min(0).default(0),
});

const CancellationFeeRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  countryCode: z.string().min(2, "Country code is required"),
  serviceType: z.enum(["ride", "food", "parcel"]),
  cancelReason: z.enum(["customer_cancel", "no_show", "driver_cancel", "restaurant_cancel"]),
  feeType: z.enum(["flat", "percentage", "tiered"]),
  feeAmount: z.number().min(0, "Fee amount must be non-negative"),
  percentageRate: z.number().min(0).max(100).optional().nullable(),
  minimumFee: z.number().min(0).optional().nullable(),
  maximumFee: z.number().min(0).optional().nullable(),
  gracePeriodMinutes: z.number().int().min(0).default(5),
  driverSharePercentage: z.number().min(0).max(100).default(80),
  platformSharePercentage: z.number().min(0).max(100).default(20),
  isActive: z.boolean().default(true),
});

router.get(
  "/incentive-rules",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { countryCode, serviceType, bonusType, isActive } = req.query;

      const where: any = {};
      if (countryCode) where.countryCode = countryCode;
      if (serviceType) where.serviceType = serviceType;
      if (bonusType) where.bonusType = bonusType;
      if (isActive !== undefined) where.isActive = isActive === "true";

      const rules = await prisma.incentiveRule.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });

      res.json({
        rules: rules.map((rule) => ({
          ...rule,
          bonusAmount: serializeDecimal(rule.bonusAmount),
          dailyBudget: rule.dailyBudget ? serializeDecimal(rule.dailyBudget) : null,
          totalBudget: rule.totalBudget ? serializeDecimal(rule.totalBudget) : null,
          currentDailySpend: serializeDecimal(rule.currentDailySpend),
          totalSpend: serializeDecimal(rule.totalSpend),
        })),
        total: rules.length,
      });
    } catch (error: any) {
      console.error("Error fetching incentive rules:", error);
      res.status(500).json({ error: error.message || "Failed to fetch incentive rules" });
    }
  }
);

router.get(
  "/incentive-rules/:id",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const rule = await prisma.incentiveRule.findUnique({
        where: { id },
        include: {
          _count: { select: { awards: true } },
        },
      });

      if (!rule) {
        return res.status(404).json({ error: "Incentive rule not found" });
      }

      res.json({
        rule: {
          ...rule,
          bonusAmount: serializeDecimal(rule.bonusAmount),
          dailyBudget: rule.dailyBudget ? serializeDecimal(rule.dailyBudget) : null,
          totalBudget: rule.totalBudget ? serializeDecimal(rule.totalBudget) : null,
          currentDailySpend: serializeDecimal(rule.currentDailySpend),
          totalSpend: serializeDecimal(rule.totalSpend),
          awardCount: rule._count.awards,
        },
      });
    } catch (error: any) {
      console.error("Error fetching incentive rule:", error);
      res.status(500).json({ error: error.message || "Failed to fetch incentive rule" });
    }
  }
);

router.post(
  "/incentive-rules",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const validated = IncentiveRuleSchema.parse(req.body);

      const rule = await prisma.incentiveRule.create({
        data: {
          name: validated.name,
          description: validated.description,
          countryCode: validated.countryCode,
          serviceType: validated.serviceType,
          bonusType: validated.bonusType,
          bonusAmount: validated.bonusAmount,
          currency: validated.currency,
          triggerConditions: validated.triggerConditions || {},
          startDate: validated.startDate ? new Date(validated.startDate) : new Date(),
          endDate: validated.endDate ? new Date(validated.endDate) : null,
          dailyBudget: validated.dailyBudget,
          totalBudget: validated.totalBudget,
          isActive: validated.isActive,
          zoneIds: validated.zoneIds || [],
          priority: validated.priority,
        },
      });

      await logAudit(req, "CREATE", "incentive_rule", rule.id, "Created new incentive rule", { rule });

      res.status(201).json({
        success: true,
        rule: {
          ...rule,
          bonusAmount: serializeDecimal(rule.bonusAmount),
          dailyBudget: rule.dailyBudget ? serializeDecimal(rule.dailyBudget) : null,
          totalBudget: rule.totalBudget ? serializeDecimal(rule.totalBudget) : null,
        },
      });
    } catch (error: any) {
      console.error("Error creating incentive rule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message, details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to create incentive rule" });
    }
  }
);

router.patch(
  "/incentive-rules/:id",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const validated = IncentiveRuleSchema.partial().parse(req.body);

      const existingRule = await prisma.incentiveRule.findUnique({ where: { id } });
      if (!existingRule) {
        return res.status(404).json({ error: "Incentive rule not found" });
      }

      const updateData: any = {};
      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.countryCode !== undefined) updateData.countryCode = validated.countryCode;
      if (validated.serviceType !== undefined) updateData.serviceType = validated.serviceType;
      if (validated.bonusType !== undefined) updateData.bonusType = validated.bonusType;
      if (validated.bonusAmount !== undefined) updateData.bonusAmount = validated.bonusAmount;
      if (validated.currency !== undefined) updateData.currency = validated.currency;
      if (validated.triggerConditions !== undefined) updateData.triggerConditions = validated.triggerConditions;
      if (validated.startDate !== undefined) updateData.startDate = new Date(validated.startDate);
      if (validated.endDate !== undefined) updateData.endDate = validated.endDate ? new Date(validated.endDate) : null;
      if (validated.dailyBudget !== undefined) updateData.dailyBudget = validated.dailyBudget;
      if (validated.totalBudget !== undefined) updateData.totalBudget = validated.totalBudget;
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
      if (validated.zoneIds !== undefined) updateData.zoneIds = validated.zoneIds;
      if (validated.priority !== undefined) updateData.priority = validated.priority;

      const rule = await prisma.incentiveRule.update({
        where: { id },
        data: updateData,
      });

      await logAudit(req, "UPDATE", "incentive_rule", rule.id, "Updated incentive rule", { before: existingRule, after: rule });

      res.json({
        success: true,
        rule: {
          ...rule,
          bonusAmount: serializeDecimal(rule.bonusAmount),
          dailyBudget: rule.dailyBudget ? serializeDecimal(rule.dailyBudget) : null,
          totalBudget: rule.totalBudget ? serializeDecimal(rule.totalBudget) : null,
          currentDailySpend: serializeDecimal(rule.currentDailySpend),
          totalSpend: serializeDecimal(rule.totalSpend),
        },
      });
    } catch (error: any) {
      console.error("Error updating incentive rule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message, details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to update incentive rule" });
    }
  }
);

router.delete(
  "/incentive-rules/:id",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const existingRule = await prisma.incentiveRule.findUnique({ where: { id } });
      if (!existingRule) {
        return res.status(404).json({ error: "Incentive rule not found" });
      }

      const awardsCount = await prisma.incentiveAward.count({ where: { ruleId: id } });
      if (awardsCount > 0) {
        await prisma.incentiveRule.update({
          where: { id },
          data: { isActive: false },
        });

        await logAudit(req, "UPDATE", "incentive_rule", id, "Deactivated incentive rule (has existing awards)", { deactivated: true });

        return res.json({
          success: true,
          message: "Rule deactivated (has existing awards)",
          deactivated: true,
        });
      }

      await prisma.incentiveRule.delete({ where: { id } });

      await logAudit(req, "DELETE", "incentive_rule", id, "Deleted incentive rule", { deleted: existingRule });

      res.json({ success: true, message: "Rule deleted" });
    } catch (error: any) {
      console.error("Error deleting incentive rule:", error);
      res.status(500).json({ error: error.message || "Failed to delete incentive rule" });
    }
  }
);

router.get(
  "/incentive-awards",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { ruleId, driverId, status, startDate, endDate, page = "1", limit = "50" } = req.query;

      const where: any = {};
      if (ruleId) where.ruleId = ruleId;
      if (driverId) where.driverId = driverId;
      if (status) where.status = status;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const pageNum = parseInt(page as string, 10);
      const pageSize = Math.min(parseInt(limit as string, 10), 100);

      const [awards, total] = await Promise.all([
        prisma.incentiveAward.findMany({
          where,
          include: {
            rule: { select: { name: true, bonusType: true } },
            driver: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
        }),
        prisma.incentiveAward.count({ where }),
      ]);

      res.json({
        awards: awards.map((award) => ({
          ...award,
          awardAmount: serializeDecimal(award.awardAmount),
        })),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      console.error("Error fetching incentive awards:", error);
      res.status(500).json({ error: error.message || "Failed to fetch incentive awards" });
    }
  }
);

router.get(
  "/cancellation-fee-rules",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { countryCode, serviceType, isActive } = req.query;

      const where: any = {};
      if (countryCode) where.countryCode = countryCode;
      if (serviceType) where.serviceType = serviceType;
      if (isActive !== undefined) where.isActive = isActive === "true";

      const rules = await prisma.cancellationFeeRule.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      res.json({
        rules: rules.map((rule) => ({
          ...rule,
          feeAmount: serializeDecimal(rule.feeAmount),
          percentageRate: rule.percentageRate ? serializeDecimal(rule.percentageRate) : null,
          minimumFee: rule.minimumFee ? serializeDecimal(rule.minimumFee) : null,
          maximumFee: rule.maximumFee ? serializeDecimal(rule.maximumFee) : null,
          driverSharePercentage: serializeDecimal(rule.driverSharePercentage),
          platformSharePercentage: serializeDecimal(rule.platformSharePercentage),
        })),
        total: rules.length,
      });
    } catch (error: any) {
      console.error("Error fetching cancellation fee rules:", error);
      res.status(500).json({ error: error.message || "Failed to fetch cancellation fee rules" });
    }
  }
);

router.get(
  "/cancellation-fee-rules/:id",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const rule = await prisma.cancellationFeeRule.findUnique({ where: { id } });

      if (!rule) {
        return res.status(404).json({ error: "Cancellation fee rule not found" });
      }

      res.json({
        rule: {
          ...rule,
          feeAmount: serializeDecimal(rule.feeAmount),
          percentageRate: rule.percentageRate ? serializeDecimal(rule.percentageRate) : null,
          minimumFee: rule.minimumFee ? serializeDecimal(rule.minimumFee) : null,
          maximumFee: rule.maximumFee ? serializeDecimal(rule.maximumFee) : null,
          driverSharePercentage: serializeDecimal(rule.driverSharePercentage),
          platformSharePercentage: serializeDecimal(rule.platformSharePercentage),
        },
      });
    } catch (error: any) {
      console.error("Error fetching cancellation fee rule:", error);
      res.status(500).json({ error: error.message || "Failed to fetch cancellation fee rule" });
    }
  }
);

router.post(
  "/cancellation-fee-rules",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const validated = CancellationFeeRuleSchema.parse(req.body);

      if (validated.driverSharePercentage + validated.platformSharePercentage !== 100) {
        return res.status(400).json({ error: "Driver and platform share must sum to 100%" });
      }

      const rule = await prisma.cancellationFeeRule.create({
        data: {
          name: validated.name,
          description: validated.description,
          countryCode: validated.countryCode,
          serviceType: validated.serviceType,
          cancelReason: validated.cancelReason,
          feeType: validated.feeType,
          feeAmount: validated.feeAmount,
          percentageRate: validated.percentageRate,
          minimumFee: validated.minimumFee,
          maximumFee: validated.maximumFee,
          gracePeriodMinutes: validated.gracePeriodMinutes,
          driverSharePercentage: validated.driverSharePercentage,
          platformSharePercentage: validated.platformSharePercentage,
          isActive: validated.isActive,
        },
      });

      await logAudit(req, "CREATE", "cancellation_fee_rule", rule.id, "Created cancellation fee rule", { rule });

      res.status(201).json({
        success: true,
        rule: {
          ...rule,
          feeAmount: serializeDecimal(rule.feeAmount),
          percentageRate: rule.percentageRate ? serializeDecimal(rule.percentageRate) : null,
          minimumFee: rule.minimumFee ? serializeDecimal(rule.minimumFee) : null,
          maximumFee: rule.maximumFee ? serializeDecimal(rule.maximumFee) : null,
          driverSharePercentage: serializeDecimal(rule.driverSharePercentage),
          platformSharePercentage: serializeDecimal(rule.platformSharePercentage),
        },
      });
    } catch (error: any) {
      console.error("Error creating cancellation fee rule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message, details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to create cancellation fee rule" });
    }
  }
);

router.patch(
  "/cancellation-fee-rules/:id",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const validated = CancellationFeeRuleSchema.partial().parse(req.body);

      const existingRule = await prisma.cancellationFeeRule.findUnique({ where: { id } });
      if (!existingRule) {
        return res.status(404).json({ error: "Cancellation fee rule not found" });
      }

      const driverShare = validated.driverSharePercentage ?? Number(existingRule.driverSharePercentage);
      const platformShare = validated.platformSharePercentage ?? Number(existingRule.platformSharePercentage);
      if (driverShare + platformShare !== 100) {
        return res.status(400).json({ error: "Driver and platform share must sum to 100%" });
      }

      const updateData: any = {};
      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.countryCode !== undefined) updateData.countryCode = validated.countryCode;
      if (validated.serviceType !== undefined) updateData.serviceType = validated.serviceType;
      if (validated.cancelReason !== undefined) updateData.cancelReason = validated.cancelReason;
      if (validated.feeType !== undefined) updateData.feeType = validated.feeType;
      if (validated.feeAmount !== undefined) updateData.feeAmount = validated.feeAmount;
      if (validated.percentageRate !== undefined) updateData.percentageRate = validated.percentageRate;
      if (validated.minimumFee !== undefined) updateData.minimumFee = validated.minimumFee;
      if (validated.maximumFee !== undefined) updateData.maximumFee = validated.maximumFee;
      if (validated.gracePeriodMinutes !== undefined) updateData.gracePeriodMinutes = validated.gracePeriodMinutes;
      if (validated.driverSharePercentage !== undefined) updateData.driverSharePercentage = validated.driverSharePercentage;
      if (validated.platformSharePercentage !== undefined) updateData.platformSharePercentage = validated.platformSharePercentage;
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

      const rule = await prisma.cancellationFeeRule.update({
        where: { id },
        data: updateData,
      });

      await logAudit(req, "UPDATE", "cancellation_fee_rule", rule.id, "Updated cancellation fee rule", { before: existingRule, after: rule });

      res.json({
        success: true,
        rule: {
          ...rule,
          feeAmount: serializeDecimal(rule.feeAmount),
          percentageRate: rule.percentageRate ? serializeDecimal(rule.percentageRate) : null,
          minimumFee: rule.minimumFee ? serializeDecimal(rule.minimumFee) : null,
          maximumFee: rule.maximumFee ? serializeDecimal(rule.maximumFee) : null,
          driverSharePercentage: serializeDecimal(rule.driverSharePercentage),
          platformSharePercentage: serializeDecimal(rule.platformSharePercentage),
        },
      });
    } catch (error: any) {
      console.error("Error updating cancellation fee rule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message, details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to update cancellation fee rule" });
    }
  }
);

router.delete(
  "/cancellation-fee-rules/:id",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const existingRule = await prisma.cancellationFeeRule.findUnique({ where: { id } });
      if (!existingRule) {
        return res.status(404).json({ error: "Cancellation fee rule not found" });
      }

      await prisma.cancellationFeeRule.delete({ where: { id } });

      await logAudit(req, "DELETE", "cancellation_fee_rule", id, "Deleted cancellation fee rule", { deleted: existingRule });

      res.json({ success: true, message: "Rule deleted" });
    } catch (error: any) {
      console.error("Error deleting cancellation fee rule:", error);
      res.status(500).json({ error: error.message || "Failed to delete cancellation fee rule" });
    }
  }
);

router.get(
  "/platform-revenue-ledger",
  checkPermission(Permission.VIEW_WALLET_SUMMARY),
  async (req: AuthRequest, res) => {
    try {
      const { sourceType, startDate, endDate, page = "1", limit = "50" } = req.query;

      const where: any = {};
      if (sourceType) where.sourceType = sourceType;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const pageNum = parseInt(page as string, 10);
      const pageSize = Math.min(parseInt(limit as string, 10), 100);

      const [entries, total, summary] = await Promise.all([
        prisma.platformRevenueLedger.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
        }),
        prisma.platformRevenueLedger.count({ where }),
        prisma.platformRevenueLedger.aggregate({
          where,
          _sum: { grossAmount: true, netAmount: true },
        }),
      ]);

      res.json({
        entries: entries.map((entry) => ({
          ...entry,
          grossAmount: serializeDecimal(entry.grossAmount),
          netAmount: serializeDecimal(entry.netAmount),
        })),
        summary: {
          totalGrossRevenue: serializeDecimal(summary._sum.grossAmount),
          totalNetRevenue: serializeDecimal(summary._sum.netAmount),
        },
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      console.error("Error fetching platform revenue ledger:", error);
      res.status(500).json({ error: error.message || "Failed to fetch platform revenue ledger" });
    }
  }
);

router.get(
  "/platform-revenue-summary",
  checkPermission(Permission.VIEW_WALLET_SUMMARY),
  async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate, groupBy = "sourceType" } = req.query;

      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const results = await prisma.platformRevenueLedger.groupBy({
        by: [groupBy as any],
        where,
        _sum: { grossAmount: true, netAmount: true },
        _count: true,
      });

      const summary = results.map((r: any) => ({
        [groupBy as string]: r[groupBy as string],
        totalGrossRevenue: serializeDecimal(r._sum.grossAmount),
        totalNetRevenue: serializeDecimal(r._sum.netAmount),
        transactionCount: r._count,
      }));

      const totals = await prisma.platformRevenueLedger.aggregate({
        where,
        _sum: { grossAmount: true, netAmount: true },
        _count: true,
      });

      res.json({
        summary,
        totals: {
          totalGrossRevenue: serializeDecimal(totals._sum.grossAmount),
          totalNetRevenue: serializeDecimal(totals._sum.netAmount),
          totalTransactions: totals._count,
        },
      });
    } catch (error: any) {
      console.error("Error fetching platform revenue summary:", error);
      res.status(500).json({ error: error.message || "Failed to fetch platform revenue summary" });
    }
  }
);

router.post(
  "/incentive-rules/:id/reset-daily-spend",
  checkPermission(Permission.EDIT_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const rule = await prisma.incentiveRule.findUnique({ where: { id } });
      if (!rule) {
        return res.status(404).json({ error: "Incentive rule not found" });
      }

      const previousSpend = rule.currentDailySpend;

      await prisma.incentiveRule.update({
        where: { id },
        data: {
          currentDailySpend: 0,
          dailySpendResetAt: new Date(),
        },
      });

      await logAudit(req, "UPDATE", "incentive_rule", id, "Reset daily spend for incentive rule", { previousSpend: serializeDecimal(previousSpend) });

      res.json({
        success: true,
        message: "Daily spend reset successfully",
        previousSpend: serializeDecimal(previousSpend),
      });
    } catch (error: any) {
      console.error("Error resetting daily spend:", error);
      res.status(500).json({ error: error.message || "Failed to reset daily spend" });
    }
  }
);

export default router;
