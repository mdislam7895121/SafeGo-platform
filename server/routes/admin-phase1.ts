import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { z } from "zod";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

// ====================================================
// ADMIN CAPABILITIES & RBAC ROUTES
// ====================================================

/**
 * Get current admin's capabilities for role-aware navigation
 * Returns role, permissions, and navigation access
 */
router.get("/capabilities", async (req: AuthRequest, res) => {
  try {
    // Use req.adminUser set by loadAdminProfile middleware
    const adminUser = (req as any).adminUser;
    if (!adminUser || !adminUser.adminProfile) {
      return res.status(403).json({ error: "Admin profile not found" });
    }

    const permissions: string[] = adminUser.permissions || [];
    const adminRole = adminUser.adminProfile.adminRole;

    // Define navigation sections based on permissions
    const navigation = {
      dashboard: permissions.includes(Permission.VIEW_DASHBOARD),
      peopleKyc: permissions.includes(Permission.VIEW_PEOPLE_CENTER),
      safetyCenter: permissions.includes(Permission.VIEW_RISK_CENTER) || permissions.includes(Permission.VIEW_SAFETY_EVENTS),
      featureFlags: permissions.includes(Permission.VIEW_FEATURE_FLAGS),
      wallets: permissions.includes(Permission.VIEW_WALLET_SUMMARY),
      payouts: permissions.includes(Permission.VIEW_PAYOUTS),
      analytics: permissions.includes(Permission.VIEW_ANALYTICS_DASHBOARD),
      settings: permissions.includes(Permission.VIEW_SETTINGS),
      auditLog: permissions.includes(Permission.VIEW_AUDIT_LOG),
      fraudAlerts: permissions.includes(Permission.VIEW_FRAUD_ALERTS),
      support: permissions.includes(Permission.VIEW_SUPPORT_CONVERSATIONS),
      disputes: permissions.includes(Permission.VIEW_DISPUTES),
    };

    // Define action capabilities
    const actions = {
      canManagePeople: permissions.includes(Permission.MANAGE_PEOPLE_CENTER),
      canBulkKyc: permissions.includes(Permission.BULK_KYC_OPERATIONS),
      canManageRiskCases: permissions.includes(Permission.MANAGE_RISK_CASES),
      canResolveRiskCases: permissions.includes(Permission.RESOLVE_RISK_CASES),
      canManageSafetyAlerts: permissions.includes(Permission.MANAGE_SAFETY_ALERTS),
      canBlockUserSafety: permissions.includes(Permission.BLOCK_USER_SAFETY),
      canManageFeatureFlags: permissions.includes(Permission.MANAGE_FEATURE_FLAGS),
      canProcessWalletSettlement: permissions.includes(Permission.PROCESS_WALLET_SETTLEMENT),
      canProcessPayouts: permissions.includes(Permission.PROCESS_PAYOUTS),
      canManageFraudAlerts: permissions.includes(Permission.MANAGE_FRAUD_ALERTS),
      canResolveFraudAlerts: permissions.includes(Permission.RESOLVE_FRAUD_ALERTS),
      canEditSettings: permissions.includes(Permission.EDIT_SETTINGS),
      canManageDisputes: permissions.includes(Permission.MANAGE_DISPUTES),
      canProcessRefunds: permissions.includes(Permission.PROCESS_REFUNDS),
    };

    res.json({
      role: adminRole,
      permissions,
      navigation,
      actions,
      isSuperAdmin: adminRole === "SUPER_ADMIN",
      isActive: adminUser.adminProfile.isActive !== false,
    });
  } catch (error) {
    console.error("Error fetching admin capabilities:", error);
    res.status(500).json({ error: "Failed to fetch admin capabilities" });
  }
});

// ====================================================
// PEOPLE & KYC CENTER ROUTES
// ====================================================

const PeopleKycQuerySchema = z.object({
  role: z.enum(["all", "customer", "driver", "restaurant", "shop_partner", "ticket_operator"]).optional().default("all"),
  country: z.enum(["all", "BD", "US"]).optional().default("all"),
  verification: z.enum(["all", "pending", "approved", "rejected"]).optional().default("all"),
  status: z.enum(["all", "active", "suspended", "blocked"]).optional().default("all"),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

// Helper to calculate KYC completeness
function calculateCustomerKycCompleteness(c: any): number {
  const fields = [c.firstName, c.lastName, c.phoneNumber, c.nidNumber, c.dateOfBirth, c.homeAddress];
  const filled = fields.filter(f => f !== null && f !== undefined && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

function calculateDriverKycCompleteness(d: any): number {
  const fields = [d.firstName, d.lastName, d.phoneNumber, d.nidNumber, d.driverLicenseNumber, d.dateOfBirth, d.profilePhotoUrl];
  const filled = fields.filter(f => f !== null && f !== undefined && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

function calculateRestaurantKycCompleteness(r: any): number {
  const fields = [r.restaurantName, r.phone, r.address, r.cuisineType, r.businessLicenseNumber];
  const filled = fields.filter(f => f !== null && f !== undefined && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

router.get("/people-kyc", checkPermission(Permission.VIEW_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const query = PeopleKycQuerySchema.parse(req.query);
    const { role, country, verification, status, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const results: any[] = [];
    let total = 0;

    const shouldIncludeRole = (targetRole: string) => role === "all" || role === targetRole;

    // Customers
    if (shouldIncludeRole("customer")) {
      const customerWhere: any = {};
      if (verification !== "all") customerWhere.verificationStatus = verification;
      if (status === "suspended") customerWhere.isSuspended = true;
      if (status === "active") customerWhere.isSuspended = false;
      if (search) {
        customerWhere.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      const [customers, customerCount] = await Promise.all([
        prisma.customerProfile.findMany({
          where: customerWhere,
          include: { user: { select: { email: true } } },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "customer" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.customerProfile.count({ where: customerWhere }),
      ]);

      customers.forEach((c) => {
        results.push({
          id: c.id,
          oderId: c.userId,
          role: "customer",
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.fullName || "N/A",
          email: c.user?.email || "N/A",
          phone: c.phoneNumber || "N/A",
          countryCode: "N/A",
          verificationStatus: c.verificationStatus || "pending",
          isVerified: c.isVerified || false,
          isBlocked: false,
          isSuspended: c.isSuspended || false,
          kycCompleteness: calculateCustomerKycCompleteness(c),
          walletBalance: null,
          negativeBalance: null,
          createdAt: c.createdAt,
        });
      });
      if (role === "customer") total = customerCount;
      else total += customerCount;
    }

    // Drivers
    if (shouldIncludeRole("driver")) {
      const driverWhere: any = {};
      if (verification !== "all") driverWhere.verificationStatus = verification;
      if (status === "suspended") driverWhere.isSuspended = true;
      if (status === "active") driverWhere.isSuspended = false;
      if (search) {
        driverWhere.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      const [drivers, driverCount] = await Promise.all([
        prisma.driverProfile.findMany({
          where: driverWhere,
          include: { 
            user: { select: { email: true } },
          },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "driver" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.driverProfile.count({ where: driverWhere }),
      ]);

      // Get wallet balances separately
      const driverIds = drivers.map(d => d.id);
      const wallets = await prisma.driverWallet.findMany({
        where: { driverId: { in: driverIds } },
        select: { driverId: true, balance: true, negativeBalance: true },
      });
      const walletMap = new Map(wallets.map(w => [w.driverId, w]));

      drivers.forEach((d) => {
        const wallet = walletMap.get(d.id);
        results.push({
          id: d.id,
          oderId: d.userId,
          role: "driver",
          name: `${d.firstName || ""} ${d.lastName || ""}`.trim() || d.fullName || "N/A",
          email: d.user?.email || "N/A",
          phone: d.phoneNumber || "N/A",
          countryCode: "N/A",
          verificationStatus: d.verificationStatus || "pending",
          isVerified: d.isVerified || false,
          isBlocked: false,
          isSuspended: d.isSuspended || false,
          kycCompleteness: calculateDriverKycCompleteness(d),
          walletBalance: wallet ? Number(wallet.balance) : 0,
          negativeBalance: wallet ? Number(wallet.negativeBalance) : 0,
          createdAt: d.createdAt,
        });
      });
      if (role === "driver") total = driverCount;
      else total += driverCount;
    }

    // Restaurants
    if (shouldIncludeRole("restaurant")) {
      const restaurantWhere: any = {};
      if (country !== "all") restaurantWhere.countryCode = country;
      if (verification !== "all") restaurantWhere.verificationStatus = verification;
      if (status === "suspended") restaurantWhere.isSuspended = true;
      if (status === "active") restaurantWhere.isSuspended = false;
      if (search) {
        restaurantWhere.OR = [
          { restaurantName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const [restaurants, restaurantCount] = await Promise.all([
        prisma.restaurantProfile.findMany({
          where: restaurantWhere,
          include: { user: { select: { email: true } } },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "restaurant" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.restaurantProfile.count({ where: restaurantWhere }),
      ]);

      // Get wallet balances separately
      const restaurantIds = restaurants.map(r => r.id);
      const wallets = await prisma.restaurantWallet.findMany({
        where: { restaurantId: { in: restaurantIds } },
        select: { restaurantId: true, balance: true, negativeBalance: true },
      });
      const walletMap = new Map(wallets.map(w => [w.restaurantId, w]));

      restaurants.forEach((r) => {
        const wallet = walletMap.get(r.id);
        results.push({
          id: r.id,
          userId: r.userId,
          role: "restaurant",
          name: r.restaurantName || "N/A",
          email: r.user?.email || "N/A",
          phone: r.phone || "N/A",
          countryCode: r.countryCode || "N/A",
          verificationStatus: r.verificationStatus || "pending",
          isVerified: r.isVerified || false,
          isBlocked: false,
          isSuspended: r.isSuspended || false,
          kycCompleteness: calculateRestaurantKycCompleteness(r),
          walletBalance: wallet ? Number(wallet.balance) : 0,
          negativeBalance: wallet ? Number(wallet.negativeBalance) : 0,
          createdAt: r.createdAt,
        });
      });
      if (role === "restaurant") total = restaurantCount;
      else total += restaurantCount;
    }

    // Shop Partners (BD only)
    if (shouldIncludeRole("shop_partner")) {
      const shopWhere: any = {};
      if (country !== "all" && country !== "BD") {
        // Shop partners are BD only, skip if other country selected
      } else {
        if (verification !== "all") shopWhere.verificationStatus = verification;
        if (search) {
          shopWhere.OR = [
            { shopName: { contains: search, mode: "insensitive" } },
            { ownerName: { contains: search, mode: "insensitive" } },
            { contactPhone: { contains: search, mode: "insensitive" } },
          ];
        }

        const [shops, shopCount] = await Promise.all([
          prisma.shopPartner.findMany({
            where: shopWhere,
            include: { user: { select: { email: true } } },
            take: role === "all" ? Math.ceil(limit / 5) : limit,
            skip: role === "shop_partner" ? skip : 0,
            orderBy: { createdAt: "desc" },
          }),
          prisma.shopPartner.count({ where: shopWhere }),
        ]);

        shops.forEach((s) => {
          results.push({
            id: s.id,
            userId: s.userId,
            role: "shop_partner",
            name: s.shopName || s.ownerName || "N/A",
            email: s.user?.email || "N/A",
            phone: s.contactPhone || "N/A",
            countryCode: s.countryCode || "BD",
            verificationStatus: s.verificationStatus || "pending",
            isVerified: s.verificationStatus === "approved",
            isBlocked: false,
            isSuspended: false,
            kycCompleteness: 100,
            walletBalance: Number(s.walletBalance) || 0,
            negativeBalance: Number(s.negativeBalance) || 0,
            createdAt: s.createdAt,
          });
        });
        if (role === "shop_partner") total = shopCount;
        else total += shopCount;
      }
    }

    // Ticket Operators (BD only)
    if (shouldIncludeRole("ticket_operator")) {
      const operatorWhere: any = {};
      if (country !== "all" && country !== "BD") {
        // Ticket operators are BD only, skip if other country selected
      } else {
        if (verification !== "all") operatorWhere.verificationStatus = verification;
        if (search) {
          operatorWhere.OR = [
            { operatorName: { contains: search, mode: "insensitive" } },
            { ownerName: { contains: search, mode: "insensitive" } },
            { officePhone: { contains: search, mode: "insensitive" } },
          ];
        }

        const [operators, operatorCount] = await Promise.all([
          prisma.ticketOperator.findMany({
            where: operatorWhere,
            include: { user: { select: { email: true } } },
            take: role === "all" ? Math.ceil(limit / 5) : limit,
            skip: role === "ticket_operator" ? skip : 0,
            orderBy: { createdAt: "desc" },
          }),
          prisma.ticketOperator.count({ where: operatorWhere }),
        ]);

        operators.forEach((o) => {
          results.push({
            id: o.id,
            userId: o.userId,
            role: "ticket_operator",
            name: o.operatorName || o.ownerName || "N/A",
            email: o.user?.email || o.officeEmail || "N/A",
            phone: o.officePhone || "N/A",
            countryCode: o.countryCode || "BD",
            verificationStatus: o.verificationStatus || "pending",
            isVerified: o.verificationStatus === "approved",
            isBlocked: false,
            isSuspended: false,
            kycCompleteness: 100,
            walletBalance: Number(o.walletBalance) || 0,
            negativeBalance: Number(o.negativeBalance) || 0,
            createdAt: o.createdAt,
          });
        });
        if (role === "ticket_operator") total = operatorCount;
        else total += operatorCount;
      }
    }

    // Sort by most recent
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      results: role === "all" ? results.slice(0, limit) : results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching people/KYC data:", error);
    res.status(500).json({ error: "Failed to fetch people/KYC data" });
  }
});

// Get profile details
router.get("/people-kyc/:role/:id", checkPermission(Permission.VIEW_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const { role, id } = req.params;

    let profile: any = null;
    let activitySummary: any = {};
    let walletSummary: any = null;
    let riskSummary: any = null;

    switch (role) {
      case "customer": {
        profile = await prisma.customerProfile.findUnique({
          where: { id },
          include: {
            user: { select: { email: true, createdAt: true } },
          },
        });
        if (profile) {
          const [ridesCount, ordersCount] = await Promise.all([
            prisma.ride.count({ where: { customerId: profile.userId } }),
            prisma.foodOrder.count({ where: { customerId: profile.userId } }),
          ]);
          activitySummary = { ridesCount, ordersCount };
        }
        break;
      }
      case "driver": {
        profile = await prisma.driverProfile.findUnique({
          where: { id },
          include: {
            user: { select: { email: true, createdAt: true } },
          },
        });
        if (profile) {
          const [wallet, ridesCount, deliveriesCount] = await Promise.all([
            prisma.driverWallet.findUnique({ where: { driverId: profile.id } }),
            prisma.ride.count({ where: { driverId: profile.userId } }),
            prisma.foodOrder.count({ where: { driverId: profile.userId } }),
          ]);
          activitySummary = { 
            ridesCount, 
            deliveriesCount,
          };
          if (wallet) {
            walletSummary = {
              balance: Number(wallet.balance),
              negativeBalance: Number(wallet.negativeBalance),
            };
          }
        }
        break;
      }
      case "restaurant": {
        profile = await prisma.restaurantProfile.findUnique({
          where: { id },
          include: {
            user: { select: { email: true, createdAt: true } },
          },
        });
        if (profile) {
          const [wallet, ordersCount] = await Promise.all([
            prisma.restaurantWallet.findUnique({ where: { restaurantId: profile.id } }),
            prisma.foodOrder.count({ where: { restaurantId: profile.id } }),
          ]);
          activitySummary = { 
            ordersCount,
            avgRating: profile.averageRating || 0,
          };
          if (wallet) {
            walletSummary = {
              balance: Number(wallet.balance),
              negativeBalance: Number(wallet.negativeBalance),
            };
          }
        }
        break;
      }
      case "shop_partner": {
        profile = await prisma.shopPartner.findUnique({
          where: { id },
          include: { user: { select: { email: true, createdAt: true } } },
        });
        if (profile) {
          activitySummary = { totalOrders: profile.totalOrders };
          walletSummary = {
            balance: Number(profile.walletBalance),
            negativeBalance: Number(profile.negativeBalance),
          };
        }
        break;
      }
      case "ticket_operator": {
        profile = await prisma.ticketOperator.findUnique({
          where: { id },
          include: { user: { select: { email: true, createdAt: true } } },
        });
        if (profile) {
          activitySummary = { totalBookings: profile.totalBookings };
          walletSummary = {
            balance: Number(profile.walletBalance),
            negativeBalance: Number(profile.negativeBalance),
          };
        }
        break;
      }
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Get risk summary
    const riskEvents = await prisma.riskEvent.count({
      where: { userId: profile.userId },
    });
    const openCases = await prisma.riskCase.count({
      where: { primaryUserId: profile.userId, status: { in: ["open", "in_review"] } },
    });
    riskSummary = { eventCount: riskEvents, openCases };

    res.json({ profile, activitySummary, walletSummary, riskSummary });
  } catch (error) {
    console.error("Error fetching profile details:", error);
    res.status(500).json({ error: "Failed to fetch profile details" });
  }
});

// ====================================================
// SAFETY CENTER ROUTES
// ====================================================

const RiskEventQuerySchema = z.object({
  severity: z.enum(["all", "low", "medium", "high", "critical"]).optional().default("all"),
  category: z.enum(["all", "fraud", "safety", "abuse", "technical", "payment_risk", "compliance"]).optional().default("all"),
  source: z.string().optional(),
  acknowledged: z.enum(["all", "true", "false"]).optional().default("all"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

router.get("/risk-events", checkPermission(Permission.VIEW_RISK_CENTER), async (req: AuthRequest, res) => {
  try {
    const query = RiskEventQuerySchema.parse(req.query);
    const { severity, category, source, acknowledged, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (severity !== "all") where.severity = severity;
    if (category !== "all") where.category = category;
    if (source) where.source = source;
    if (acknowledged !== "all") where.isAcknowledged = acknowledged === "true";

    const [events, total] = await Promise.all([
      prisma.riskEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.riskEvent.count({ where }),
    ]);

    res.json({
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching risk events:", error);
    res.status(500).json({ error: "Failed to fetch risk events" });
  }
});

const RiskCaseQuerySchema = z.object({
  status: z.enum(["all", "open", "in_review", "resolved", "escalated"]).optional().default("all"),
  severity: z.enum(["all", "low", "medium", "high", "critical"]).optional().default("all"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

router.get("/risk-cases", checkPermission(Permission.VIEW_RISK_CENTER), async (req: AuthRequest, res) => {
  try {
    const query = RiskCaseQuerySchema.parse(req.query);
    const { status, severity, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status !== "all") where.status = status;
    if (severity !== "all") where.severity = severity;

    const [cases, total] = await Promise.all([
      prisma.riskCase.findMany({
        where,
        include: {
          riskEvents: { take: 5, orderBy: { createdAt: "desc" } },
          caseNotes: { take: 3, orderBy: { createdAt: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.riskCase.count({ where }),
    ]);

    res.json({
      cases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching risk cases:", error);
    res.status(500).json({ error: "Failed to fetch risk cases" });
  }
});

router.get("/risk-cases/:id", checkPermission(Permission.VIEW_RISK_CENTER), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const riskCase = await prisma.riskCase.findUnique({
      where: { id },
      include: {
        riskEvents: { orderBy: { createdAt: "desc" } },
        caseNotes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!riskCase) {
      return res.status(404).json({ error: "Risk case not found" });
    }

    // Get user profile based on role
    let userProfile = null;
    if (riskCase.role === "driver") {
      userProfile = await prisma.driverProfile.findFirst({
        where: { userId: riskCase.primaryUserId },
        select: { id: true, firstName: true, lastName: true, phoneNumber: true },
      });
    } else if (riskCase.role === "customer") {
      userProfile = await prisma.customerProfile.findFirst({
        where: { userId: riskCase.primaryUserId },
        select: { id: true, firstName: true, lastName: true, phoneNumber: true },
      });
    } else if (riskCase.role === "restaurant") {
      userProfile = await prisma.restaurantProfile.findFirst({
        where: { userId: riskCase.primaryUserId },
        select: { id: true, restaurantName: true, phone: true },
      });
    }

    res.json({ ...riskCase, userProfile });
  } catch (error) {
    console.error("Error fetching risk case:", error);
    res.status(500).json({ error: "Failed to fetch risk case" });
  }
});

const UpdateRiskCaseSchema = z.object({
  status: z.enum(["open", "in_review", "resolved", "escalated"]).optional(),
  resolutionNotes: z.string().optional(),
  actionsTaken: z.array(z.string()).optional(),
});

router.patch("/risk-cases/:id", checkPermission(Permission.MANAGE_RISK_CASES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = UpdateRiskCaseSchema.parse(req.body);

    const updateData: any = { ...data };
    if (data.status === "resolved") {
      updateData.resolvedAt = new Date();
    }

    const riskCase = await prisma.riskCase.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with specific action type
    const actionType = data.status === "resolved" 
      ? ActionType.RISK_CASE_RESOLVED 
      : data.status === "escalated" 
        ? ActionType.RISK_CASE_ESCALATED 
        : ActionType.RISK_CASE_UPDATED;
        
    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: (req as any).adminUser?.email || "unknown",
      actorRole: "admin",
      actionType,
      entityType: EntityType.RISK_CASE,
      entityId: id,
      description: `Updated risk case status to ${data.status}`,
      ipAddress: getClientIp(req),
      metadata: { 
        newStatus: data.status, 
        resolutionNotes: data.resolutionNotes,
        actionsTaken: data.actionsTaken 
      },
    });

    res.json(riskCase);
  } catch (error) {
    console.error("Error updating risk case:", error);
    res.status(500).json({ error: "Failed to update risk case" });
  }
});

const AddCaseNoteSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().optional().default(true),
});

router.post("/risk-cases/:id/notes", checkPermission(Permission.MANAGE_RISK_CASES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = AddCaseNoteSchema.parse(req.body);

    const note = await prisma.riskCaseNote.create({
      data: {
        riskCaseId: id,
        adminId: req.user?.userId || "unknown",
        adminEmail: (req as any).adminUser?.email || "unknown",
        content: data.content,
        isInternal: data.isInternal,
      },
    });

    // Log audit event for case note
    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: (req as any).adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: ActionType.RISK_CASE_NOTE_ADDED,
      entityType: EntityType.RISK_CASE,
      entityId: id,
      description: `Added note to risk case`,
      ipAddress: getClientIp(req),
      metadata: { 
        noteId: note.id,
        isInternal: data.isInternal 
      },
    });

    res.json(note);
  } catch (error) {
    console.error("Error adding case note:", error);
    res.status(500).json({ error: "Failed to add case note" });
  }
});

// Safety stats for dashboard
router.get("/safety-stats", checkPermission(Permission.VIEW_SAFETY_EVENTS), async (req: AuthRequest, res) => {
  try {
    const [
      totalEvents,
      openCases,
      criticalEvents,
      recentEvents,
    ] = await Promise.all([
      prisma.riskEvent.count(),
      prisma.riskCase.count({ where: { status: { in: ["open", "in_review"] } } }),
      prisma.riskEvent.count({ where: { severity: "critical", isAcknowledged: false } }),
      prisma.riskEvent.count({ 
        where: { 
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        } 
      }),
    ]);

    res.json({
      totalEvents,
      openCases,
      criticalEvents,
      recentEvents,
    });
  } catch (error) {
    console.error("Error fetching safety stats:", error);
    res.status(500).json({ error: "Failed to fetch safety stats" });
  }
});

// ====================================================
// FEATURE FLAGS ROUTES
// ====================================================

router.get("/feature-flags", checkPermission(Permission.VIEW_FEATURE_FLAGS), async (req: AuthRequest, res) => {
  try {
    const flags = await prisma.featureFlag.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(flags);
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    res.status(500).json({ error: "Failed to fetch feature flags" });
  }
});

router.get("/feature-flags/:id", checkPermission(Permission.VIEW_FEATURE_FLAGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    
    if (!flag) {
      return res.status(404).json({ error: "Feature flag not found" });
    }
    
    res.json(flag);
  } catch (error) {
    console.error("Error fetching feature flag:", error);
    res.status(500).json({ error: "Failed to fetch feature flag" });
  }
});

const CreateFeatureFlagSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores"),
  description: z.string().min(1),
  isEnabled: z.boolean().optional().default(false),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).optional().default("GLOBAL"),
  roleScope: z.string().optional(),
  serviceScope: z.string().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional().default(100),
  metadata: z.record(z.any()).optional(),
});

router.post("/feature-flags", checkPermission(Permission.MANAGE_FEATURE_FLAGS), async (req: AuthRequest, res) => {
  try {
    const data = CreateFeatureFlagSchema.parse(req.body);

    // Check if key already exists
    const existing = await prisma.featureFlag.findUnique({ where: { key: data.key } });
    if (existing) {
      return res.status(400).json({ error: "Feature flag with this key already exists" });
    }

    const flag = await prisma.featureFlag.create({
      data: {
        ...data,
        createdByAdminId: req.user?.userId,
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: (req as any).adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: ActionType.FEATURE_FLAG_CREATED,
      entityType: EntityType.FEATURE_FLAG,
      entityId: flag.id,
      description: `Created feature flag: ${data.key}`,
      ipAddress: getClientIp(req),
      metadata: { 
        key: data.key, 
        countryScope: data.countryScope,
        isEnabled: data.isEnabled,
        rolloutPercentage: data.rolloutPercentage 
      },
    });

    res.status(201).json(flag);
  } catch (error) {
    console.error("Error creating feature flag:", error);
    res.status(500).json({ error: "Failed to create feature flag" });
  }
});

const UpdateFeatureFlagSchema = z.object({
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).optional(),
  roleScope: z.string().optional(),
  serviceScope: z.string().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  metadata: z.record(z.any()).optional(),
});

router.patch("/feature-flags/:id", checkPermission(Permission.MANAGE_FEATURE_FLAGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = UpdateFeatureFlagSchema.parse(req.body);

    const flag = await prisma.featureFlag.update({
      where: { id },
      data: {
        ...data,
        updatedByAdminId: req.user?.userId,
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: (req as any).adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: ActionType.FEATURE_FLAG_UPDATED,
      entityType: EntityType.FEATURE_FLAG,
      entityId: id,
      description: `Updated feature flag: ${flag.key}`,
      ipAddress: getClientIp(req),
      metadata: { 
        key: flag.key,
        changes: data 
      },
    });

    res.json(flag);
  } catch (error) {
    console.error("Error updating feature flag:", error);
    res.status(500).json({ error: "Failed to update feature flag" });
  }
});

router.delete("/feature-flags/:id", checkPermission(Permission.MANAGE_FEATURE_FLAGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      return res.status(404).json({ error: "Feature flag not found" });
    }

    await prisma.featureFlag.delete({ where: { id } });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: (req as any).adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: ActionType.FEATURE_FLAG_DELETED,
      entityType: EntityType.FEATURE_FLAG,
      entityId: id,
      description: `Deleted feature flag: ${flag.key}`,
      ipAddress: getClientIp(req),
      metadata: { 
        key: flag.key,
        wasEnabled: flag.isEnabled 
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting feature flag:", error);
    res.status(500).json({ error: "Failed to delete feature flag" });
  }
});

export default router;
