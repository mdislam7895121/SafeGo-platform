import { Router } from "express";
import { Permission } from "../utils/permissions";
import { checkPermission } from "../middleware/authz";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";
import { rateLimitAnalytics } from "../middleware/rateLimit";
import { prisma } from "../db";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

// Apply security middleware to all analytics routes
router.use(rateLimitAnalytics); // Rate limiting (60 requests/min per user)

// ====================================================
// RBAC Helper - Filter data by admin role and jurisdiction
// ====================================================
interface RBACFilter {
  countryCode?: string;
  cityCode?: string;
  isUnrestricted: boolean;
}

async function getRBACFilter(req: AuthRequest): Promise<RBACFilter> {
  const user = req.user as any;
  
  if (!user || !user.id) {
    throw new Error("Unauthorized: No user found");
  }

  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: user.id },
    select: {
      adminRole: true,
      countryCode: true,
      cityCode: true,
    },
  });

  if (!adminProfile) {
    throw new Error("Unauthorized: Not an admin");
  }

  switch (adminProfile.adminRole) {
    case "SUPER_ADMIN":
      return { isUnrestricted: true };
    
    case "COUNTRY_ADMIN":
      if (!adminProfile.countryCode) {
        throw new Error("Forbidden: Country admin without assigned country");
      }
      return {
        countryCode: adminProfile.countryCode,
        isUnrestricted: false,
      };
    
    case "CITY_ADMIN":
      if (!adminProfile.countryCode || !adminProfile.cityCode) {
        throw new Error("Forbidden: City admin without assigned city");
      }
      return {
        countryCode: adminProfile.countryCode,
        cityCode: adminProfile.cityCode,
        isUnrestricted: false,
      };
    
    default:
      throw new Error("Forbidden: Insufficient permissions for analytics");
  }
}

// ====================================================
// Safe data helpers - Defensive null-check patterns
// ====================================================
function safeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

function safeArray<T>(value: any, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}

function safeString(value: any, defaultValue: string = ""): string {
  return typeof value === "string" ? value : defaultValue;
}

// Helper to build jurisdiction filter for Prisma queries
function buildJurisdictionFilter(rbacFilter: RBACFilter) {
  if (rbacFilter.isUnrestricted) {
    return {};
  }
  
  const userFilter: any = {};
  if (rbacFilter.countryCode) {
    userFilter.countryCode = rbacFilter.countryCode;
  }
  if (rbacFilter.cityCode) {
    userFilter.cityCode = rbacFilter.cityCode;
  }
  
  return userFilter;
}

// ====================================================
// Input sanitization helper
// ====================================================
function sanitizeQueryInput(input: any): string {
  if (typeof input !== "string") return "";
  return input.replace(/[^a-zA-Z0-9_-]/g, "");
}

function validateDateRange(dateFrom?: string, dateTo?: string): { from: Date | undefined; to: Date | undefined } {
  let from: Date | undefined;
  let to: Date | undefined;

  if (dateFrom) {
    from = new Date(dateFrom);
    if (isNaN(from.getTime())) {
      from = undefined;
    }
  }

  if (dateTo) {
    to = new Date(dateTo);
    if (isNaN(to.getTime())) {
      to = undefined;
    }
  }

  return { from, to };
}

// ====================================================
// GET /api/admin/analytics/overview
// Overview analytics across all services
// ====================================================
router.get("/overview", checkPermission(Permission.VIEW_ANALYTICS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Apply RBAC filtering
    const rbacFilter = await getRBACFilter(req);
    
    const { dateFrom, dateTo } = req.query;
    const { from, to } = validateDateRange(dateFrom as string, dateTo as string);

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Build where clause for services with RBAC filtering
    const whereClause: any = {};
    if (from || to) {
      whereClause.createdAt = dateFilter;
    }
    
    // Apply jurisdiction filtering for non-super-admins
    const userFilter: any = {};
    if (!rbacFilter.isUnrestricted) {
      if (rbacFilter.countryCode) {
        userFilter.countryCode = rbacFilter.countryCode;
      }
      if (rbacFilter.cityCode) {
        userFilter.cityCode = rbacFilter.cityCode;
      }
    }

    // Get counts by service type with RBAC filtering
    const [
      totalRides,
      completedRides,
      totalFoodOrders,
      completedFoodOrders,
      totalDeliveries,
      completedDeliveries,
      totalUsers,
      totalDrivers,
      totalCustomers,
      totalRestaurants,
      activeDrivers,
      totalRevenue,
    ] = await Promise.all([
      // Rides - filter by customer jurisdiction
      prisma.ride.count({
        where: {
          ...whereClause,
          ...(Object.keys(userFilter).length > 0 ? {
            customer: { user: userFilter }
          } : {}),
        },
      }),
      prisma.ride.count({
        where: {
          ...whereClause,
          status: "completed",
          ...(Object.keys(userFilter).length > 0 ? {
            customer: { user: userFilter }
          } : {}),
        },
      }),
      
      // Food Orders - filter by customer jurisdiction
      prisma.foodOrder.count({
        where: {
          ...whereClause,
          ...(Object.keys(userFilter).length > 0 ? {
            customer: { user: userFilter }
          } : {}),
        },
      }),
      prisma.foodOrder.count({
        where: {
          ...whereClause,
          status: "delivered",
          ...(Object.keys(userFilter).length > 0 ? {
            customer: { user: userFilter }
          } : {}),
        },
      }),
      
      // Deliveries - filter by customer jurisdiction
      prisma.delivery.count({
        where: {
          ...whereClause,
          ...(Object.keys(userFilter).length > 0 ? {
            customer: { user: userFilter }
          } : {}),
        },
      }),
      prisma.delivery.count({
        where: {
          ...whereClause,
          status: "delivered",
          ...(Object.keys(userFilter).length > 0 ? {
            customer: { user: userFilter }
          } : {}),
        },
      }),
      
      // Users - filter by jurisdiction
      prisma.user.count({ where: userFilter }),
      prisma.driverProfile.count({
        where: Object.keys(userFilter).length > 0 ? { user: userFilter } : undefined,
      }),
      prisma.customerProfile.count({
        where: Object.keys(userFilter).length > 0 ? { user: userFilter } : undefined,
      }),
      prisma.restaurantProfile.count({
        where: Object.keys(userFilter).length > 0 ? { user: userFilter } : undefined,
      }),
      
      // Active drivers (vehicles online) - filter by driver jurisdiction
      prisma.vehicle.groupBy({
        by: ["driverId"],
        where: {
          isOnline: true,
          ...(Object.keys(userFilter).length > 0 ? {
            driver: { user: userFilter }
          } : {}),
        },
      }).then(list => list.length),
      
      // Total revenue (sum of all service fares) - filter by customer jurisdiction
      Promise.all([
        prisma.ride.aggregate({
          where: {
            ...whereClause,
            status: "completed",
            ...(Object.keys(userFilter).length > 0 ? {
              customer: { user: userFilter }
            } : {}),
          },
          _sum: { serviceFare: true },
        }),
        prisma.foodOrder.aggregate({
          where: {
            ...whereClause,
            status: "delivered",
            ...(Object.keys(userFilter).length > 0 ? {
              customer: { user: userFilter }
            } : {}),
          },
          _sum: { serviceFare: true },
        }),
        prisma.delivery.aggregate({
          where: {
            ...whereClause,
            status: "delivered",
            ...(Object.keys(userFilter).length > 0 ? {
              customer: { user: userFilter }
            } : {}),
          },
          _sum: { serviceFare: true },
        }),
      ]).then(([rides, food, deliveries]) => {
        return (
          Number(rides._sum.serviceFare || 0) +
          Number(food._sum.serviceFare || 0) +
          Number(deliveries._sum.serviceFare || 0)
        );
      }),
    ]);

    // Calculate growth rates (compare to previous period)
    const periodLength = to && from ? to.getTime() - from.getTime() : 30 * 24 * 60 * 60 * 1000; // default 30 days
    const previousPeriodStart = new Date(from ? from.getTime() - periodLength : Date.now() - 2 * periodLength);
    const previousPeriodEnd = from || new Date(Date.now() - periodLength);

    const previousWhereClause = {
      createdAt: {
        gte: previousPeriodStart,
        lte: previousPeriodEnd,
      },
    };

    const [prevCompletedRides, prevCompletedFood, prevCompletedDeliveries] = await Promise.all([
      prisma.ride.count({ where: { ...previousWhereClause, status: "completed" } }),
      prisma.foodOrder.count({ where: { ...previousWhereClause, status: "delivered" } }),
      prisma.delivery.count({ where: { ...previousWhereClause, status: "delivered" } }),
    ]);

    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    // Audit log the analytics access
    await logAuditEvent({
      actorId: (req.user as any)?.id || null,
      actorEmail: (req.user as any)?.email || "unknown",
      actorRole: (req.user as any)?.role || "unknown",
      actionType: ActionType.VIEW_ANALYTICS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed analytics overview${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}${!rbacFilter.isUnrestricted ? ` [${rbacFilter.countryCode || ""}/${rbacFilter.cityCode || ""}]` : ""}`,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      success: true,
    });

    // Safe response with defensive defaults
    res.json({
      overview: {
        totalServices: safeNumber(totalRides + totalFoodOrders + totalDeliveries, 0),
        completedServices: safeNumber(completedRides + completedFoodOrders + completedDeliveries, 0),
        totalRevenue: safeNumber(totalRevenue, 0),
        totalUsers: safeNumber(totalUsers, 0),
        totalDrivers: safeNumber(totalDrivers, 0),
        totalCustomers: safeNumber(totalCustomers, 0),
        totalRestaurants: safeNumber(totalRestaurants, 0),
        activeDrivers: safeNumber(activeDrivers, 0),
      },
      services: {
        rides: {
          total: safeNumber(totalRides, 0),
          completed: safeNumber(completedRides, 0),
          completionRate: totalRides > 0 ? safeNumber(((completedRides / totalRides) * 100).toFixed(2), 0) : 0,
          growth: safeNumber(calculateGrowth(completedRides, prevCompletedRides), 0),
        },
        foodOrders: {
          total: safeNumber(totalFoodOrders, 0),
          completed: safeNumber(completedFoodOrders, 0),
          completionRate: totalFoodOrders > 0 ? safeNumber(((completedFoodOrders / totalFoodOrders) * 100).toFixed(2), 0) : 0,
          growth: safeNumber(calculateGrowth(completedFoodOrders, prevCompletedFood), 0),
        },
        deliveries: {
          total: safeNumber(totalDeliveries, 0),
          completed: safeNumber(completedDeliveries, 0),
          completionRate: totalDeliveries > 0 ? safeNumber(((completedDeliveries / totalDeliveries) * 100).toFixed(2), 0) : 0,
          growth: safeNumber(calculateGrowth(completedDeliveries, prevCompletedDeliveries), 0),
        },
      },
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    res.status(500).json({ error: "Failed to fetch analytics overview" });
  }
});

// ====================================================
// GET /api/admin/analytics/drivers
// Driver-specific analytics
// ====================================================
router.get("/drivers", checkPermission(Permission.VIEW_ANALYTICS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Apply RBAC filtering
    const rbacFilter = await getRBACFilter(req);
    
    const { dateFrom, dateTo } = req.query;
    const { from, to } = validateDateRange(dateFrom as string, dateTo as string);

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Top performing drivers
    const [rideDrivers, foodDrivers, deliveryDrivers] = await Promise.all([
      prisma.ride.groupBy({
        by: ["driverId"],
        where: {
          status: "completed",
          driverId: { not: null },
          ...(from || to ? { completedAt: dateFilter } : {}),
        },
        _count: { id: true },
        _sum: { driverPayout: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.foodOrder.groupBy({
        by: ["driverId"],
        where: {
          status: "delivered",
          driverId: { not: null },
          ...(from || to ? { deliveredAt: dateFilter } : {}),
        },
        _count: { id: true },
        _sum: { driverPayout: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.delivery.groupBy({
        by: ["driverId"],
        where: {
          status: "delivered",
          driverId: { not: null },
          ...(from || to ? { deliveredAt: dateFilter } : {}),
        },
        _count: { id: true },
        _sum: { driverPayout: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
    ]);

    // Combine and aggregate by driver
    const driverMap = new Map<string, { trips: number; earnings: number }>();
    
    [...rideDrivers, ...foodDrivers, ...deliveryDrivers].forEach((item) => {
      if (!item.driverId) return;
      const existing = driverMap.get(item.driverId) || { trips: 0, earnings: 0 };
      driverMap.set(item.driverId, {
        trips: existing.trips + item._count.id,
        earnings: existing.earnings + Number(item._sum.driverPayout || 0),
      });
    });

    // Get top 10 drivers
    const topDriverIds = Array.from(driverMap.entries())
      .sort((a, b) => b[1].trips - a[1].trips)
      .slice(0, 10)
      .map(([id]) => id);

    // Fetch driver details
    const driverProfiles = await prisma.driverProfile.findMany({
      where: { id: { in: topDriverIds } },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
          },
        },
      },
    });

    const topDrivers = topDriverIds.map((id) => {
      const profile = driverProfiles.find((p) => p.id === id);
      const stats = driverMap.get(id)!;
      return {
        driverName: profile?.fullName || profile?.user.email || "Unknown",
        revenue: Number(stats.earnings.toFixed(2)),
        trips: stats.trips,
      };
    });

    // Driver status - active vs inactive
    const totalDriverProfiles = await prisma.driverProfile.count();
    const activeDriversCount = await prisma.driverProfile.count({
      where: {
        id: {
          in: await prisma.ride.findMany({
            where: {
              status: "completed",
              driverId: { not: null },
              ...(from || to ? { completedAt: dateFilter } : {}),
            },
            select: { driverId: true },
            distinct: ["driverId"],
          }).then((rides) => rides.map((r) => r.driverId!).filter(Boolean)),
        },
      },
    });

    const inactiveDriversCount = Math.max(0, totalDriverProfiles - activeDriversCount);
    const retentionRate = totalDriverProfiles > 0 ? (activeDriversCount / totalDriverProfiles) * 100 : 0;

    // Performance trend - trips over time (daily aggregation)
    const performanceTrend: Array<{ date: string; trips: number }> = [];
    if (from && to) {
      const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i < Math.min(days, 30); i++) {
        const date = new Date(from);
        date.setDate(date.getDate() + i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayTrips = await prisma.ride.count({
          where: {
            status: "completed",
            completedAt: {
              gte: date,
              lt: nextDate,
            },
          },
        });
        
        performanceTrend.push({
          date: date.toISOString().split('T')[0],
          trips: dayTrips,
        });
      }
    }

    // Audit log
    await logAuditEvent({
      actorId: (req.user as any)?.id || null,
      actorEmail: (req.user as any)?.email || "unknown",
      actorRole: (req.user as any)?.role || "unknown",
      actionType: ActionType.VIEW_ANALYTICS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed driver analytics${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}`,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      success: true,
    });

    res.json({
      performanceTrend: performanceTrend || [],
      topDrivers: topDrivers || [],
      activeDrivers: activeDriversCount || 0,
      inactiveDrivers: inactiveDriversCount || 0,
      retentionRate: retentionRate || 0,
      totalDrivers: totalDriverProfiles || 0,
    });
  } catch (error) {
    console.error("Driver analytics error:", error);
    res.status(500).json({ error: "Failed to fetch driver analytics" });
  }
});

// ====================================================
// GET /api/admin/analytics/customers
// Customer-specific analytics
// ====================================================
router.get("/customers", checkPermission(Permission.VIEW_ANALYTICS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Apply RBAC filtering
    const rbacFilter = await getRBACFilter(req);
    
    const { dateFrom, dateTo } = req.query;
    const { from, to } = validateDateRange(dateFrom as string, dateTo as string);

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Top customers by number of orders
    const [rideCustomers, foodCustomers, deliveryCustomers] = await Promise.all([
      prisma.ride.groupBy({
        by: ["customerId"],
        where: {
          status: "completed",
          ...(from || to ? { completedAt: dateFilter } : {}),
        },
        _count: { id: true },
        _sum: { serviceFare: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.foodOrder.groupBy({
        by: ["customerId"],
        where: {
          status: "delivered",
          ...(from || to ? { deliveredAt: dateFilter } : {}),
        },
        _count: { id: true },
        _sum: { serviceFare: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.delivery.groupBy({
        by: ["customerId"],
        where: {
          status: "delivered",
          ...(from || to ? { deliveredAt: dateFilter } : {}),
        },
        _count: { id: true },
        _sum: { serviceFare: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
    ]);

    // Combine customer data
    const customerMap = new Map<string, { orders: number; spending: number }>();
    
    [...rideCustomers, ...foodCustomers, ...deliveryCustomers].forEach((item) => {
      const existing = customerMap.get(item.customerId) || { orders: 0, spending: 0 };
      customerMap.set(item.customerId, {
        orders: existing.orders + (item._count?.id || 0),
        spending: existing.spending + Number(item._sum?.serviceFare || 0),
      });
    });

    // Get top 10 customers
    const topCustomerIds = Array.from(customerMap.entries())
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 10)
      .map(([id]) => id);

    // Fetch customer details
    const customerProfiles = await prisma.customerProfile.findMany({
      where: { id: { in: topCustomerIds } },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
          },
        },
      },
    });

    const topCustomers = topCustomerIds.map((id) => {
      const profile = customerProfiles.find((p) => p.id === id);
      const stats = customerMap.get(id)!;
      return {
        customerId: id,
        name: profile?.fullName || profile?.user.email || "Unknown",
        email: profile?.user.email || "unknown",
        country: profile?.user.countryCode || "unknown",
        totalOrders: stats.orders,
        totalSpending: stats.spending.toFixed(2),
      };
    });

    // Customer status distribution
    const [totalCustomerProfiles, verifiedCustomers, pendingCustomers] = await Promise.all([
      prisma.customerProfile.count(),
      prisma.customerProfile.count({ where: { verificationStatus: "approved" } }),
      prisma.customerProfile.count({ where: { verificationStatus: "pending" } }),
    ]);

    // New customers (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newCustomers = await prisma.customerProfile.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: (req.user as any)?.id || null,
      actorEmail: (req.user as any)?.email || "unknown",
      actorRole: (req.user as any)?.role || "unknown",
      actionType: ActionType.VIEW_ANALYTICS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed customer analytics${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}`,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      success: true,
    });

    res.json({
      topCustomers,
      status: {
        total: totalCustomerProfiles,
        verified: verifiedCustomers,
        pending: pendingCustomers,
        new: newCustomers,
      },
    });
  } catch (error) {
    console.error("Customer analytics error:", error);
    res.status(500).json({ error: "Failed to fetch customer analytics" });
  }
});

// ====================================================
// GET /api/admin/analytics/restaurants
// Restaurant-specific analytics
// ====================================================
router.get("/restaurants", checkPermission(Permission.VIEW_ANALYTICS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Apply RBAC filtering
    const rbacFilter = await getRBACFilter(req);
    
    const { dateFrom, dateTo } = req.query;
    const { from, to } = validateDateRange(dateFrom as string, dateTo as string);

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Top restaurants by order volume
    const topRestaurants = await prisma.foodOrder.groupBy({
      by: ["restaurantId"],
      where: {
        status: "delivered",
        ...(from || to ? { deliveredAt: dateFilter } : {}),
      },
      _count: { id: true },
      _sum: { restaurantPayout: true, serviceFare: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Fetch restaurant details
    const restaurantIds = topRestaurants.map((r) => r.restaurantId);
    const restaurantProfiles = await prisma.restaurantProfile.findMany({
      where: { id: { in: restaurantIds } },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
          },
        },
      },
    });

    const topRestaurantsList = topRestaurants.map((item) => {
      const profile = restaurantProfiles.find((p) => p.id === item.restaurantId);
      return {
        restaurantId: item.restaurantId,
        name: profile?.restaurantName || "Unknown",
        email: profile?.user.email || "unknown",
        country: profile?.user.countryCode || "unknown",
        totalOrders: item._count?.id || 0,
        totalRevenue: Number(item._sum?.serviceFare || 0).toFixed(2),
        totalEarnings: Number(item._sum?.restaurantPayout || 0).toFixed(2),
      };
    });

    // Restaurant status distribution
    const [totalRestaurantProfiles, verifiedRestaurants, pendingRestaurants, rejectedRestaurants] = await Promise.all([
      prisma.restaurantProfile.count(),
      prisma.restaurantProfile.count({ where: { verificationStatus: "approved" } }),
      prisma.restaurantProfile.count({ where: { verificationStatus: "pending" } }),
      prisma.restaurantProfile.count({ where: { verificationStatus: "rejected" } }),
    ]);

    // Audit log
    await logAuditEvent({
      actorId: (req.user as any)?.id || null,
      actorEmail: (req.user as any)?.email || "unknown",
      actorRole: (req.user as any)?.role || "unknown",
      actionType: ActionType.VIEW_ANALYTICS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed restaurant analytics${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}`,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      success: true,
    });

    res.json({
      topRestaurants: topRestaurantsList,
      status: {
        total: totalRestaurantProfiles,
        verified: verifiedRestaurants,
        pending: pendingRestaurants,
        rejected: rejectedRestaurants,
      },
    });
  } catch (error) {
    console.error("Restaurant analytics error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant analytics" });
  }
});

// ====================================================
// GET /api/admin/analytics/revenue
// Revenue analytics across all services
// ====================================================
router.get("/revenue", checkPermission(Permission.VIEW_ANALYTICS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Apply RBAC filtering
    const rbacFilter = await getRBACFilter(req);
    
    const { dateFrom, dateTo } = req.query;
    const { from, to } = validateDateRange(dateFrom as string, dateTo as string);

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Revenue breakdown by service
    const [rideRevenue, foodRevenue, deliveryRevenue] = await Promise.all([
      prisma.ride.aggregate({
        where: {
          status: "completed",
          ...(from || to ? { completedAt: dateFilter } : {}),
        },
        _sum: {
          serviceFare: true,
          safegoCommission: true,
          driverPayout: true,
        },
        _count: { id: true },
      }),
      prisma.foodOrder.aggregate({
        where: {
          status: "delivered",
          ...(from || to ? { deliveredAt: dateFilter } : {}),
        },
        _sum: {
          serviceFare: true,
          safegoCommission: true,
          restaurantPayout: true,
          driverPayout: true,
        },
        _count: { id: true },
      }),
      prisma.delivery.aggregate({
        where: {
          status: "delivered",
          ...(from || to ? { deliveredAt: dateFilter } : {}),
        },
        _sum: {
          serviceFare: true,
          safegoCommission: true,
          driverPayout: true,
        },
        _count: { id: true },
      }),
    ]);

    // Commission analytics
    const totalCommission = 
      Number(rideRevenue._sum.safegoCommission || 0) +
      Number(foodRevenue._sum.safegoCommission || 0) +
      Number(deliveryRevenue._sum.safegoCommission || 0);

    const totalRevenue = 
      Number(rideRevenue._sum?.serviceFare || 0) +
      Number(foodRevenue._sum?.serviceFare || 0) +
      Number(deliveryRevenue._sum?.serviceFare || 0);

    // Payout breakdown
    const totalDriverPayouts = 
      Number(rideRevenue._sum.driverPayout || 0) +
      Number(foodRevenue._sum.driverPayout || 0) +
      Number(deliveryRevenue._sum.driverPayout || 0);

    const totalRestaurantPayouts = Number(foodRevenue._sum.restaurantPayout || 0);

    // Pending payouts
    const [pendingDriverPayouts, pendingRestaurantPayouts] = await Promise.all([
      prisma.payout.aggregate({
        where: {
          ownerType: "driver",
          status: "pending",
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payout.aggregate({
        where: {
          ownerType: "restaurant",
          status: "pending",
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Audit log
    await logAuditEvent({
      actorId: (req.user as any)?.id || null,
      actorEmail: (req.user as any)?.email || "unknown",
      actorRole: (req.user as any)?.role || "unknown",
      actionType: ActionType.VIEW_ANALYTICS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed revenue analytics${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}`,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      success: true,
    });

    res.json({
      overview: {
        totalRevenue: totalRevenue.toFixed(2),
        totalCommission: totalCommission.toFixed(2),
        commissionRate: totalRevenue > 0 ? ((totalCommission / totalRevenue) * 100).toFixed(2) : "0.00",
      },
      byService: {
        rides: {
          revenue: Number(rideRevenue._sum.serviceFare || 0).toFixed(2),
          commission: Number(rideRevenue._sum.safegoCommission || 0).toFixed(2),
          driverPayouts: Number(rideRevenue._sum.driverPayout || 0).toFixed(2),
          completedOrders: rideRevenue._count.id,
        },
        foodOrders: {
          revenue: Number(foodRevenue._sum?.serviceFare || 0).toFixed(2),
          commission: Number(foodRevenue._sum?.safegoCommission || 0).toFixed(2),
          restaurantPayouts: Number(foodRevenue._sum?.restaurantPayout || 0).toFixed(2),
          driverPayouts: Number(foodRevenue._sum?.driverPayout || 0).toFixed(2),
          completedOrders: foodRevenue._count?.id || 0,
        },
        deliveries: {
          revenue: Number(deliveryRevenue._sum.serviceFare || 0).toFixed(2),
          commission: Number(deliveryRevenue._sum.safegoCommission || 0).toFixed(2),
          driverPayouts: Number(deliveryRevenue._sum.driverPayout || 0).toFixed(2),
          completedOrders: deliveryRevenue._count.id,
        },
      },
      payouts: {
        totalDriverPayouts: totalDriverPayouts.toFixed(2),
        totalRestaurantPayouts: totalRestaurantPayouts.toFixed(2),
        pendingDriverPayouts: {
          amount: Number(pendingDriverPayouts._sum.amount || 0).toFixed(2),
          count: pendingDriverPayouts._count.id,
        },
        pendingRestaurantPayouts: {
          amount: Number(pendingRestaurantPayouts._sum.amount || 0).toFixed(2),
          count: pendingRestaurantPayouts._count.id,
        },
      },
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    res.status(500).json({ error: "Failed to fetch revenue analytics" });
  }
});

// ====================================================
// GET /api/admin/analytics/risk
// Risk and fraud detection analytics
// ====================================================
router.get("/risk", checkPermission(Permission.VIEW_ANALYTICS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Apply RBAC filtering
    const rbacFilter = await getRBACFilter(req);
    
    const { dateFrom, dateTo } = req.query;
    const { from, to } = validateDateRange(dateFrom as string, dateTo as string);

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Cancelled orders (potential fraud)
    const [cancelledRides, cancelledFood, cancelledDeliveries] = await Promise.all([
      prisma.ride.count({
        where: {
          status: { in: ["cancelled_by_customer", "cancelled_by_driver"] },
          ...(from || to ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.foodOrder.count({
        where: {
          status: { in: ["cancelled_by_customer", "cancelled_by_restaurant"] },
          ...(from || to ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.delivery.count({
        where: {
          status: { in: ["cancelled_by_customer", "cancelled_by_driver"] },
          ...(from || to ? { createdAt: dateFilter } : {}),
        },
      }),
    ]);

    // Blocked users
    const [blockedUsers, blockedDrivers, blockedCustomers, blockedRestaurants] = await Promise.all([
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.user.count({ where: { isBlocked: true, role: "driver" } }),
      prisma.user.count({ where: { isBlocked: true, role: "customer" } }),
      prisma.user.count({ where: { isBlocked: true, role: "restaurant" } }),
    ]);

    // Rejected KYC (potential fraud)
    const [rejectedDriverKYC, rejectedCustomerKYC, rejectedRestaurantKYC] = await Promise.all([
      prisma.driverProfile.count({ where: { verificationStatus: "rejected" } }),
      prisma.customerProfile.count({ where: { verificationStatus: "rejected" } }),
      prisma.restaurantProfile.count({ where: { verificationStatus: "rejected" } }),
    ]);

    // High negative balances (risk of non-payment)
    const [highRiskDriverWallets, highRiskRestaurantWallets] = await Promise.all([
      prisma.driverWallet.count({
        where: {
          negativeBalance: { gt: 1000 }, // High risk threshold
        },
      }),
      prisma.restaurantWallet.count({
        where: {
          negativeBalance: { gt: 1000 }, // High risk threshold
        },
      }),
    ]);

    // Low rating drivers/restaurants (quality risk)
    const lowRatedDrivers = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "driverId") as count
      FROM rides
      WHERE "driverRating" IS NOT NULL
      GROUP BY "driverId"
      HAVING AVG("driverRating") < 3.0
    `;

    // Total risk score calculation
    const totalRiskIndicators = 
      cancelledRides + cancelledFood + cancelledDeliveries +
      blockedUsers +
      rejectedDriverKYC + rejectedCustomerKYC + rejectedRestaurantKYC +
      highRiskDriverWallets + highRiskRestaurantWallets;

    // Audit log
    await logAuditEvent({
      actorId: (req.user as any)?.id || null,
      actorEmail: (req.user as any)?.email || "unknown",
      actorRole: (req.user as any)?.role || "unknown",
      actionType: ActionType.VIEW_ANALYTICS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed risk analytics${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}`,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      success: true,
    });

    res.json({
      cancellations: {
        total: cancelledRides + cancelledFood + cancelledDeliveries,
        byService: {
          rides: cancelledRides,
          foodOrders: cancelledFood,
          deliveries: cancelledDeliveries,
        },
      },
      blockedAccounts: {
        total: blockedUsers,
        byRole: {
          drivers: blockedDrivers,
          customers: blockedCustomers,
          restaurants: blockedRestaurants,
        },
      },
      rejectedKYC: {
        total: rejectedDriverKYC + rejectedCustomerKYC + rejectedRestaurantKYC,
        byRole: {
          drivers: rejectedDriverKYC,
          customers: rejectedCustomerKYC,
          restaurants: rejectedRestaurantKYC,
        },
      },
      financialRisk: {
        highNegativeBalances: {
          drivers: highRiskDriverWallets,
          restaurants: highRiskRestaurantWallets,
        },
      },
      qualityRisk: {
        lowRatedDrivers: Number(lowRatedDrivers[0]?.count || 0),
      },
      riskScore: {
        totalIndicators: totalRiskIndicators,
        severity: totalRiskIndicators > 100 ? "high" : totalRiskIndicators > 50 ? "medium" : "low",
      },
    });
  } catch (error) {
    console.error("Risk analytics error:", error);
    res.status(500).json({ error: "Failed to fetch risk analytics" });
  }
});

export default router;
