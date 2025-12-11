import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { financeStatsService } from "../services/financeStatsService";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

const overviewQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  countryCode: z.enum(["BD", "US"]).optional(),
  serviceType: z.enum(["ride", "food", "delivery"]).optional(),
});

const gatewayQuerySchema = z.object({
  countryCode: z.enum(["BD", "US"]).optional(),
  provider: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  serviceType: z.enum(["ride", "food", "delivery"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("20"),
});

const balanceQuerySchema = z.object({
  countryCode: z.enum(["BD", "US"]).optional(),
  minNegative: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("20"),
});

const settlementsQuerySchema = z.object({
  userType: z.enum(["driver", "restaurant"]).optional(),
  userId: z.string().optional(),
  countryCode: z.enum(["BD", "US"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  adminId: z.string().optional(),
  method: z.string().optional(),
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("20"),
});

const createSettlementSchema = z.object({
  userType: z.enum(["driver", "restaurant"]),
  userId: z.string().min(1),
  userName: z.string().optional(),
  countryCode: z.enum(["BD", "US"]),
  totalAmount: z.number().positive(),
  currency: z.enum(["BDT", "USD"]),
  method: z.enum(["bank_transfer", "cash_deposit", "bkash", "nagad", "stripe_payout_adjust", "other"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  orderIds: z.array(z.object({
    orderType: z.enum(["ride", "food", "delivery"]),
    orderId: z.string(),
    commissionAmount: z.number(),
  })),
});

router.get("/overview", checkPermission(Permission.VIEW_REVENUE_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const query = overviewQuerySchema.parse(req.query);
    
    const stats = await financeStatsService.getOverviewStats({
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      countryCode: query.countryCode,
      serviceType: query.serviceType,
    });
    
    res.json(stats);
  } catch (error: any) {
    console.error("[AdminFinance] Overview error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch overview stats" });
  }
});

router.get("/gateway-reports", checkPermission(Permission.VIEW_REVENUE_ANALYTICS), async (req: AuthRequest, res: Response) => {
  try {
    const query = gatewayQuerySchema.parse(req.query);
    
    const reports = await financeStatsService.getGatewayReport({
      countryCode: query.countryCode,
      provider: query.provider,
      paymentMethod: query.paymentMethod,
      paymentStatus: query.paymentStatus,
      serviceType: query.serviceType,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      page: parseInt(query.page),
      pageSize: parseInt(query.pageSize),
    });
    
    res.json(reports);
  } catch (error: any) {
    console.error("[AdminFinance] Gateway reports error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch gateway reports" });
  }
});

router.get("/driver-balances", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res: Response) => {
  try {
    const query = balanceQuerySchema.parse(req.query);
    
    const balances = await financeStatsService.getDriverBalances({
      countryCode: query.countryCode,
      minNegative: query.minNegative ? parseFloat(query.minNegative) : undefined,
      search: query.search,
      page: parseInt(query.page),
      pageSize: parseInt(query.pageSize),
    });
    
    res.json(balances);
  } catch (error: any) {
    console.error("[AdminFinance] Driver balances error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch driver balances" });
  }
});

router.get("/driver-balances/:driverId/unsettled", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const orders = await financeStatsService.getDriverUnsettledOrders(driverId);
    res.json(orders);
  } catch (error: any) {
    console.error("[AdminFinance] Driver unsettled orders error:", error);
    res.status(500).json({ error: "Failed to fetch unsettled orders" });
  }
});

router.get("/restaurant-balances", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res: Response) => {
  try {
    const query = balanceQuerySchema.parse(req.query);
    
    const balances = await financeStatsService.getRestaurantBalances({
      countryCode: query.countryCode,
      minNegative: query.minNegative ? parseFloat(query.minNegative) : undefined,
      search: query.search,
      page: parseInt(query.page),
      pageSize: parseInt(query.pageSize),
    });
    
    res.json(balances);
  } catch (error: any) {
    console.error("[AdminFinance] Restaurant balances error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch restaurant balances" });
  }
});

router.get("/restaurant-balances/:restaurantId/unsettled", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const orders = await financeStatsService.getRestaurantUnsettledOrders(restaurantId);
    res.json(orders);
  } catch (error: any) {
    console.error("[AdminFinance] Restaurant unsettled orders error:", error);
    res.status(500).json({ error: "Failed to fetch unsettled orders" });
  }
});

router.get("/settlements", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res: Response) => {
  try {
    const query = settlementsQuerySchema.parse(req.query);
    
    const settlements = await financeStatsService.getSettlementsHistory({
      userType: query.userType,
      userId: query.userId,
      countryCode: query.countryCode,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      adminId: query.adminId,
      method: query.method,
      page: parseInt(query.page),
      pageSize: parseInt(query.pageSize),
    });
    
    res.json(settlements);
  } catch (error: any) {
    console.error("[AdminFinance] Settlements history error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch settlements history" });
  }
});

router.get("/settlements/:settlementId", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res: Response) => {
  try {
    const { settlementId } = req.params;
    const settlement = await financeStatsService.getSettlementDetails(settlementId);
    
    if (!settlement) {
      return res.status(404).json({ error: "Settlement not found" });
    }
    
    res.json(settlement);
  } catch (error: any) {
    console.error("[AdminFinance] Settlement details error:", error);
    res.status(500).json({ error: "Failed to fetch settlement details" });
  }
});

router.post("/settlements", checkPermission(Permission.PROCESS_WALLET_SETTLEMENT), async (req: AuthRequest, res: Response) => {
  try {
    const data = createSettlementSchema.parse(req.body);
    
    const adminId = req.user?.id || "";
    const adminName = req.adminUser?.name || req.user?.email || "";
    
    const settlement = await financeStatsService.createSettlement({
      ...data,
      adminId,
      adminName,
    });
    
    await logAuditEvent({
      adminId,
      actionType: ActionType.SETTLEMENT_CREATED,
      entityType: EntityType.SETTLEMENT,
      entityId: settlement.id,
      description: `Created ${data.userType} settlement of ${data.totalAmount} ${data.currency} for user ${data.userId}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      metadata: {
        userType: data.userType,
        userId: data.userId,
        amount: data.totalAmount,
        currency: data.currency,
        method: data.method,
        ordersCount: data.orderIds.length,
      },
    });
    
    res.status(201).json(settlement);
  } catch (error: any) {
    console.error("[AdminFinance] Create settlement error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid settlement data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create settlement" });
  }
});

export default router;
