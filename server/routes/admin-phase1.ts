import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { z } from "zod";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { walletService } from "../services/walletService";

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

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

router.get("/people-kyc", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const query = PeopleKycQuerySchema.parse(req.query);
    const { role, country, verification, status, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const results: any[] = [];
    let total = 0;

    const shouldIncludeRole = (targetRole: string) => role === "all" || role === targetRole;

    if (shouldIncludeRole("customer")) {
      const customerWhere: any = {};
      if (country !== "all") customerWhere.countryCode = country;
      if (verification !== "all") customerWhere.verificationStatus = verification;
      if (status === "blocked") customerWhere.isBlocked = true;
      if (status === "active") customerWhere.isBlocked = false;
      if (search) {
        customerWhere.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
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
          userId: c.userId,
          role: "customer",
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || "N/A",
          email: c.user?.email || c.email || "N/A",
          phone: c.phone || "N/A",
          countryCode: c.countryCode || "N/A",
          verificationStatus: c.verificationStatus || "pending",
          isVerified: c.isVerified || false,
          isBlocked: c.isBlocked || false,
          isSuspended: false,
          kycCompleteness: calculateCustomerKycCompleteness(c),
          walletBalance: null,
          negativeBalance: null,
          createdAt: c.createdAt,
        });
      });
      if (role === "customer") total = customerCount;
      else total += customerCount;
    }

    if (shouldIncludeRole("driver")) {
      const driverWhere: any = {};
      if (country !== "all") driverWhere.countryCode = country;
      if (verification !== "all") driverWhere.verificationStatus = verification;
      if (status === "blocked") driverWhere.isBlocked = true;
      if (status === "suspended") driverWhere.isSuspended = true;
      if (status === "active") {
        driverWhere.isBlocked = false;
        driverWhere.isSuspended = false;
      }
      if (search) {
        driverWhere.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const [drivers, driverCount] = await Promise.all([
        prisma.driverProfile.findMany({
          where: driverWhere,
          include: { 
            user: { select: { email: true } },
            wallet: { select: { balance: true, negativeBalance: true } },
          },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "driver" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.driverProfile.count({ where: driverWhere }),
      ]);

      drivers.forEach((d) => {
        results.push({
          id: d.id,
          userId: d.userId,
          role: "driver",
          name: `${d.firstName || ""} ${d.lastName || ""}`.trim() || "N/A",
          email: d.user?.email || d.email || "N/A",
          phone: d.phone || "N/A",
          countryCode: d.countryCode || "N/A",
          verificationStatus: d.verificationStatus || "pending",
          isVerified: d.isVerified || false,
          isBlocked: d.isBlocked || false,
          isSuspended: d.isSuspended || false,
          kycCompleteness: calculateDriverKycCompleteness(d),
          walletBalance: d.wallet?.balance ? Number(d.wallet.balance) : 0,
          negativeBalance: d.wallet?.negativeBalance ? Number(d.wallet.negativeBalance) : 0,
          createdAt: d.createdAt,
        });
      });
      if (role === "driver") total = driverCount;
      else total += driverCount;
    }

    if (shouldIncludeRole("restaurant")) {
      const restaurantWhere: any = {};
      if (country !== "all") restaurantWhere.countryCode = country;
      if (verification !== "all") restaurantWhere.verificationStatus = verification;
      if (status === "blocked") restaurantWhere.isBlocked = true;
      if (status === "suspended") restaurantWhere.isSuspended = true;
      if (status === "active") {
        restaurantWhere.isBlocked = false;
        restaurantWhere.isSuspended = false;
      }
      if (search) {
        restaurantWhere.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const [restaurants, restaurantCount] = await Promise.all([
        prisma.restaurantProfile.findMany({
          where: restaurantWhere,
          include: { 
            user: { select: { email: true } },
            wallet: { select: { balance: true, negativeBalance: true } },
          },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "restaurant" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.restaurantProfile.count({ where: restaurantWhere }),
      ]);

      restaurants.forEach((r) => {
        results.push({
          id: r.id,
          userId: r.userId,
          role: "restaurant",
          name: r.name || r.ownerName || "N/A",
          email: r.user?.email || r.email || "N/A",
          phone: r.phone || "N/A",
          countryCode: r.countryCode || "N/A",
          verificationStatus: r.verificationStatus || "pending",
          isVerified: r.isVerified || false,
          isBlocked: r.isBlocked || false,
          isSuspended: r.isSuspended || false,
          kycCompleteness: calculateRestaurantKycCompleteness(r),
          walletBalance: r.wallet?.balance ? Number(r.wallet.balance) : 0,
          negativeBalance: r.wallet?.negativeBalance ? Number(r.wallet.negativeBalance) : 0,
          createdAt: r.createdAt,
        });
      });
      if (role === "restaurant") total = restaurantCount;
      else total += restaurantCount;
    }

    if (shouldIncludeRole("shop_partner")) {
      const shopWhere: any = {};
      if (country !== "all") shopWhere.countryCode = country;
      if (verification !== "all") shopWhere.verificationStatus = verification;
      if (status === "blocked") shopWhere.isBlocked = true;
      if (status === "suspended") shopWhere.isSuspended = true;
      if (status === "active") {
        shopWhere.isBlocked = false;
        shopWhere.isSuspended = false;
      }
      if (search) {
        shopWhere.OR = [
          { shopName: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const [shops, shopCount] = await Promise.all([
        prisma.shopPartnerProfile.findMany({
          where: shopWhere,
          include: { user: { select: { email: true } } },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "shop_partner" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.shopPartnerProfile.count({ where: shopWhere }),
      ]);

      shops.forEach((s) => {
        results.push({
          id: s.id,
          userId: s.userId,
          role: "shop_partner",
          name: s.shopName || s.ownerName || "N/A",
          email: s.user?.email || s.email || "N/A",
          phone: s.phone || "N/A",
          countryCode: s.countryCode || "BD",
          verificationStatus: s.verificationStatus || "pending",
          isVerified: s.isVerified || false,
          isBlocked: s.isBlocked || false,
          isSuspended: s.isSuspended || false,
          kycCompleteness: 100,
          walletBalance: null,
          negativeBalance: null,
          createdAt: s.createdAt,
        });
      });
      if (role === "shop_partner") total = shopCount;
      else total += shopCount;
    }

    if (shouldIncludeRole("ticket_operator")) {
      const operatorWhere: any = {};
      if (country !== "all") operatorWhere.countryCode = country;
      if (verification !== "all") operatorWhere.verificationStatus = verification;
      if (status === "blocked") operatorWhere.isBlocked = true;
      if (status === "suspended") operatorWhere.isSuspended = true;
      if (status === "active") {
        operatorWhere.isBlocked = false;
        operatorWhere.isSuspended = false;
      }
      if (search) {
        operatorWhere.OR = [
          { businessName: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const [operators, operatorCount] = await Promise.all([
        prisma.ticketOperatorProfile.findMany({
          where: operatorWhere,
          include: { user: { select: { email: true } } },
          take: role === "all" ? Math.ceil(limit / 5) : limit,
          skip: role === "ticket_operator" ? skip : 0,
          orderBy: { createdAt: "desc" },
        }),
        prisma.ticketOperatorProfile.count({ where: operatorWhere }),
      ]);

      operators.forEach((o) => {
        results.push({
          id: o.id,
          userId: o.userId,
          role: "ticket_operator",
          name: o.businessName || o.ownerName || "N/A",
          email: o.user?.email || o.email || "N/A",
          phone: o.phone || "N/A",
          countryCode: o.countryCode || "BD",
          verificationStatus: o.verificationStatus || "pending",
          isVerified: o.isVerified || false,
          isBlocked: o.isBlocked || false,
          isSuspended: o.isSuspended || false,
          kycCompleteness: 100,
          walletBalance: null,
          negativeBalance: null,
          createdAt: o.createdAt,
        });
      });
      if (role === "ticket_operator") total = operatorCount;
      else total += operatorCount;
    }

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

router.get("/people-kyc/:role/:id", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
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
          const [ridesCount, ordersCount, parcelsCount, complaintsCount] = await Promise.all([
            prisma.ride.count({ where: { customerId: profile.userId } }),
            prisma.foodOrder.count({ where: { customerId: profile.userId } }),
            prisma.parcelDelivery.count({ where: { customerId: profile.userId } }),
            prisma.complaint.count({ where: { complainantUserId: profile.userId } }),
          ]);
          activitySummary = { ridesCount, ordersCount, parcelsCount, complaintsCount };
        }
        break;
      }
      case "driver": {
        profile = await prisma.driverProfile.findUnique({
          where: { id },
          include: {
            user: { select: { email: true, createdAt: true } },
            wallet: true,
            vehicles: true,
          },
        });
        if (profile) {
          const [ridesCount, deliveriesCount, parcelsCount, complaintsCount, avgRating] = await Promise.all([
            prisma.ride.count({ where: { driverId: profile.userId } }),
            prisma.foodOrder.count({ where: { driverId: profile.userId } }),
            prisma.parcelDelivery.count({ where: { driverId: profile.userId } }),
            prisma.complaint.count({ where: { complainantUserId: profile.userId } }),
            prisma.driverRating.aggregate({ where: { driverId: profile.id }, _avg: { rating: true } }),
          ]);
          activitySummary = { 
            ridesCount, 
            deliveriesCount, 
            parcelsCount, 
            complaintsCount,
            avgRating: avgRating._avg.rating || 0,
          };
          if (profile.wallet) {
            walletSummary = {
              balance: Number(profile.wallet.balance),
              negativeBalance: Number(profile.wallet.negativeBalance),
              lifetimeEarnings: Number(profile.wallet.lifetimeEarnings),
              pendingBalance: Number(profile.wallet.pendingBalance),
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
            wallet: true,
          },
        });
        if (profile) {
          const [ordersCount, complaintsCount, avgRating] = await Promise.all([
            prisma.foodOrder.count({ where: { restaurantId: profile.id } }),
            prisma.complaint.count({ where: { complainantUserId: profile.userId } }),
            prisma.restaurantRating.aggregate({ where: { restaurantId: profile.id }, _avg: { rating: true } }),
          ]);
          activitySummary = { 
            ordersCount, 
            complaintsCount,
            avgRating: avgRating._avg.rating || 0,
          };
          if (profile.wallet) {
            walletSummary = {
              balance: Number(profile.wallet.balance),
              negativeBalance: Number(profile.wallet.negativeBalance),
              lifetimeEarnings: Number(profile.wallet.lifetimeEarnings),
              pendingBalance: Number(profile.wallet.pendingBalance),
            };
          }
        }
        break;
      }
      case "shop_partner": {
        profile = await prisma.shopPartnerProfile.findUnique({
          where: { id },
          include: { user: { select: { email: true, createdAt: true } } },
        });
        break;
      }
      case "ticket_operator": {
        profile = await prisma.ticketOperatorProfile.findUnique({
          where: { id },
          include: { user: { select: { email: true, createdAt: true } } },
        });
        break;
      }
      default:
        return res.status(400).json({ error: "Invalid role" });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const riskEvents = await prisma.riskEvent.findMany({
      where: { userId: profile.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const openRiskCases = await prisma.riskCase.count({
      where: { 
        primaryUserId: profile.userId,
        status: { in: ["open", "in_review"] },
      },
    });

    riskSummary = {
      recentEvents: riskEvents.length,
      openCases: openRiskCases,
      events: riskEvents,
    };

    res.json({
      profile,
      activitySummary,
      walletSummary,
      riskSummary,
    });
  } catch (error) {
    console.error("Error fetching profile detail:", error);
    res.status(500).json({ error: "Failed to fetch profile detail" });
  }
});

// ====================================================
// SAFETY CENTER ROUTES
// ====================================================

const SafetyQuerySchema = z.object({
  role: z.enum(["all", "customer", "driver", "restaurant", "shop_partner", "ticket_operator"]).optional().default("all"),
  country: z.enum(["all", "BD", "US"]).optional().default("all"),
  severity: z.enum(["all", "low", "medium", "high", "critical"]).optional().default("all"),
  category: z.enum(["all", "fraud", "safety", "abuse", "technical", "payment_risk", "compliance"]).optional().default("all"),
  status: z.enum(["all", "open", "in_review", "resolved", "escalated"]).optional().default("all"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

router.get("/safety/cases", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const query = SafetyQuerySchema.parse(req.query);
    const { role, country, severity, status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role !== "all") where.role = role;
    if (country !== "all") where.countryCode = country;
    if (severity !== "all") where.severity = severity;
    if (status !== "all") where.status = status;

    const [cases, total] = await Promise.all([
      prisma.riskCase.findMany({
        where,
        include: {
          riskEvents: { orderBy: { createdAt: "desc" }, take: 5 },
          _count: { select: { riskEvents: true, caseNotes: true } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
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

router.get("/safety/events", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const query = SafetyQuerySchema.parse(req.query);
    const { role, severity, category, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role !== "all") where.role = role;
    if (severity !== "all") where.severity = severity;
    if (category !== "all") where.category = category;

    const [events, total] = await Promise.all([
      prisma.riskEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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

router.get("/safety/cases/:id", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
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

    let userProfile: any = null;
    switch (riskCase.role) {
      case "driver":
        userProfile = await prisma.driverProfile.findFirst({
          where: { userId: riskCase.primaryUserId },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        });
        break;
      case "customer":
        userProfile = await prisma.customerProfile.findFirst({
          where: { userId: riskCase.primaryUserId },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        });
        break;
      case "restaurant":
        userProfile = await prisma.restaurantProfile.findFirst({
          where: { userId: riskCase.primaryUserId },
          select: { id: true, name: true, ownerName: true, email: true, phone: true },
        });
        break;
    }

    res.json({
      ...riskCase,
      userProfile,
    });
  } catch (error) {
    console.error("Error fetching risk case:", error);
    res.status(500).json({ error: "Failed to fetch risk case" });
  }
});

const UpdateCaseSchema = z.object({
  status: z.enum(["open", "in_review", "resolved", "escalated"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  resolutionNotes: z.string().optional(),
  actionsTaken: z.array(z.string()).optional(),
});

router.patch("/safety/cases/:id", checkPermission(Permission.MANAGE_USERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = UpdateCaseSchema.parse(req.body);

    const updateData: any = { ...updates };
    if (updates.status === "resolved") {
      updateData.resolvedAt = new Date();
    }

    const riskCase = await prisma.riskCase.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      actorId: req.user?.id,
      actorEmail: req.user?.email || "admin",
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.UPDATE,
      entityType: EntityType.OTHER,
      entityId: id,
      description: `Updated risk case status to ${updates.status || "updated"}`,
      metadata: updates,
      success: true,
    });

    res.json(riskCase);
  } catch (error) {
    console.error("Error updating risk case:", error);
    res.status(500).json({ error: "Failed to update risk case" });
  }
});

const AddNoteSchema = z.object({
  content: z.string().min(1).max(2000),
  isInternal: z.boolean().optional().default(true),
});

router.post("/safety/cases/:id/notes", checkPermission(Permission.MANAGE_USERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal } = AddNoteSchema.parse(req.body);

    const note = await prisma.riskCaseNote.create({
      data: {
        riskCaseId: id,
        adminId: req.adminUser?.id || "",
        adminEmail: req.user?.email || "admin",
        content,
        isInternal,
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error("Error adding case note:", error);
    res.status(500).json({ error: "Failed to add case note" });
  }
});

router.get("/safety/stats", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const [
      openCases,
      criticalCases,
      todayEvents,
      unresolvedByCategory,
    ] = await Promise.all([
      prisma.riskCase.count({ where: { status: { in: ["open", "in_review"] } } }),
      prisma.riskCase.count({ where: { severity: "critical", status: { in: ["open", "in_review"] } } }),
      prisma.riskEvent.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.riskEvent.groupBy({
        by: ["category"],
        where: { isAcknowledged: false },
        _count: true,
      }),
    ]);

    res.json({
      openCases,
      criticalCases,
      todayEvents,
      unresolvedByCategory,
    });
  } catch (error) {
    console.error("Error fetching safety stats:", error);
    res.status(500).json({ error: "Failed to fetch safety stats" });
  }
});

// ====================================================
// FEATURE FLAGS ROUTES
// ====================================================

router.get("/feature-flags", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
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

router.get("/feature-flags/:id", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
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

const CreateFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  description: z.string().min(1).max(500),
  isEnabled: z.boolean().optional().default(false),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).optional().default("GLOBAL"),
  roleScope: z.string().optional().nullable(),
  serviceScope: z.string().optional().nullable(),
  rolloutPercentage: z.number().min(0).max(100).optional().default(100),
});

router.post("/feature-flags", checkPermission(Permission.MANAGE_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const data = CreateFlagSchema.parse(req.body);

    const existing = await prisma.featureFlag.findUnique({ where: { key: data.key } });
    if (existing) {
      return res.status(400).json({ error: "Feature flag with this key already exists" });
    }

    const flag = await prisma.featureFlag.create({
      data: {
        ...data,
        createdByAdminId: req.adminUser?.id,
      },
    });

    await logAuditEvent({
      actorId: req.user?.id,
      actorEmail: req.user?.email || "admin",
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.CREATE,
      entityType: EntityType.OTHER,
      entityId: flag.id,
      description: `Created feature flag: ${data.key}`,
      metadata: data,
      success: true,
    });

    res.status(201).json(flag);
  } catch (error) {
    console.error("Error creating feature flag:", error);
    res.status(500).json({ error: "Failed to create feature flag" });
  }
});

const UpdateFlagSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  isEnabled: z.boolean().optional(),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).optional(),
  roleScope: z.string().optional().nullable(),
  serviceScope: z.string().optional().nullable(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
});

router.patch("/feature-flags/:id", checkPermission(Permission.MANAGE_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = UpdateFlagSchema.parse(req.body);

    const flag = await prisma.featureFlag.update({
      where: { id },
      data: {
        ...data,
        updatedByAdminId: req.adminUser?.id,
      },
    });

    await logAuditEvent({
      actorId: req.user?.id,
      actorEmail: req.user?.email || "admin",
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.UPDATE,
      entityType: EntityType.OTHER,
      entityId: flag.id,
      description: `Updated feature flag: ${flag.key}`,
      metadata: data,
      success: true,
    });

    res.json(flag);
  } catch (error) {
    console.error("Error updating feature flag:", error);
    res.status(500).json({ error: "Failed to update feature flag" });
  }
});

router.delete("/feature-flags/:id", checkPermission(Permission.MANAGE_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      return res.status(404).json({ error: "Feature flag not found" });
    }

    await prisma.featureFlag.delete({ where: { id } });

    await logAuditEvent({
      actorId: req.user?.id,
      actorEmail: req.user?.email || "admin",
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType: ActionType.DELETE,
      entityType: EntityType.OTHER,
      entityId: id,
      description: `Deleted feature flag: ${flag.key}`,
      success: true,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting feature flag:", error);
    res.status(500).json({ error: "Failed to delete feature flag" });
  }
});

// ====================================================
// HELPER FUNCTIONS
// ====================================================

function calculateCustomerKycCompleteness(customer: any): number {
  const countryCode = customer.countryCode || "BD";
  let total = 0;
  let completed = 0;

  if (countryCode === "BD") {
    total = 6;
    if (customer.fatherName) completed++;
    if (customer.dateOfBirth) completed++;
    if (customer.presentAddress) completed++;
    if (customer.permanentAddress) completed++;
    if (customer.nidEncrypted || customer.nidNumber) completed++;
    if (customer.emergencyContactName && customer.emergencyContactPhone) completed++;
  } else {
    total = 4;
    if (customer.dateOfBirth) completed++;
    if (customer.homeAddress) completed++;
    if (customer.governmentIdType && customer.governmentIdLast4Encrypted) completed++;
    if (customer.emergencyContactName && customer.emergencyContactPhone) completed++;
  }

  return Math.round((completed / total) * 100);
}

function calculateDriverKycCompleteness(driver: any): number {
  const countryCode = driver.countryCode || "BD";
  let total = 0;
  let completed = 0;

  if (countryCode === "BD") {
    total = 6;
    if (driver.profilePhotoUrl) completed++;
    if (driver.fatherName) completed++;
    if (driver.dateOfBirth) completed++;
    if (driver.presentAddress) completed++;
    if (driver.nidEncrypted || driver.nidNumber) completed++;
    if (driver.emergencyContactName && driver.emergencyContactPhone) completed++;
  } else {
    total = 7;
    if (driver.profilePhotoUrl) completed++;
    if (driver.firstName && driver.lastName) completed++;
    if (driver.dateOfBirth) completed++;
    if (driver.homeAddress) completed++;
    if (driver.dmvLicenseFrontUrl && driver.dmvLicenseBackUrl) completed++;
    if (driver.dmvLicenseExpiry) completed++;
    if (driver.emergencyContactName && driver.emergencyContactPhone) completed++;
  }

  return Math.round((completed / total) * 100);
}

function calculateRestaurantKycCompleteness(restaurant: any): number {
  let total = 5;
  let completed = 0;

  if (restaurant.name) completed++;
  if (restaurant.address) completed++;
  if (restaurant.phone) completed++;
  if (restaurant.businessLicenseNumber || restaurant.businessLicenseUrl) completed++;
  if (restaurant.ownerName) completed++;

  return Math.round((completed / total) * 100);
}

export default router;
