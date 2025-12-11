import { Router, Request, Response } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [
      totalCustomerRatings,
      totalDriverRatings,
      totalPartnerRatings,
      activeFlags,
      restrictedDrivers,
      restrictedCustomers,
      restrictedPartners,
      recentSubmissions,
    ] = await Promise.all([
      prisma.customerRating.count(),
      prisma.driverRating.count(),
      prisma.partnerRating.count(),
      prisma.reputationFlag.count({ where: { status: "active" } }),
      prisma.driverRating.count({ where: { isRestricted: true } }),
      prisma.customerRating.count({ where: { isRestricted: true } }),
      prisma.partnerRating.count({ where: { isRestricted: true } }),
      prisma.ratingSubmission.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const avgDriverRating = await prisma.driverRating.aggregate({
      _avg: { averageRating: true },
    });

    const avgCustomerRating = await prisma.customerRating.aggregate({
      _avg: { averageRating: true },
    });

    const avgPartnerRating = await prisma.partnerRating.aggregate({
      _avg: { averageRating: true },
    });

    res.json({
      totalCustomerRatings,
      totalDriverRatings,
      totalPartnerRatings,
      activeFlags,
      restrictedDrivers,
      restrictedCustomers,
      restrictedPartners,
      recentSubmissions24h: recentSubmissions,
      averages: {
        driver: avgDriverRating._avg.averageRating || 5.0,
        customer: avgCustomerRating._avg.averageRating || 5.0,
        partner: avgPartnerRating._avg.averageRating || 5.0,
      },
    });
  } catch (error) {
    console.error("[AdminReputation] Stats error:", error);
    res.status(500).json({ error: "Failed to get reputation stats" });
  }
});

router.get("/customer-ratings", async (req: Request, res: Response) => {
  try {
    const { limit = "50", offset = "0", restricted, sortBy = "averageRating", sortOrder = "asc" } = req.query;

    const where: any = {};
    if (restricted === "true") where.isRestricted = true;

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc";

    const ratings = await prisma.customerRating.findMany({
      where,
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.customerRating.count({ where });

    res.json({ ratings, total });
  } catch (error) {
    console.error("[AdminReputation] Customer ratings error:", error);
    res.status(500).json({ error: "Failed to get customer ratings" });
  }
});

router.get("/driver-ratings", async (req: Request, res: Response) => {
  try {
    const { limit = "50", offset = "0", restricted, sortBy = "averageRating", sortOrder = "asc" } = req.query;

    const where: any = {};
    if (restricted === "true") where.isRestricted = true;

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc";

    const ratings = await prisma.driverRating.findMany({
      where,
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.driverRating.count({ where });

    res.json({ ratings, total });
  } catch (error) {
    console.error("[AdminReputation] Driver ratings error:", error);
    res.status(500).json({ error: "Failed to get driver ratings" });
  }
});

router.get("/partner-ratings", async (req: Request, res: Response) => {
  try {
    const { limit = "50", offset = "0", restricted, partnerType, sortBy = "averageRating", sortOrder = "asc" } = req.query;

    const where: any = {};
    if (restricted === "true") where.isRestricted = true;
    if (partnerType) where.partnerType = partnerType;

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc";

    const ratings = await prisma.partnerRating.findMany({
      where,
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.partnerRating.count({ where });

    res.json({ ratings, total });
  } catch (error) {
    console.error("[AdminReputation] Partner ratings error:", error);
    res.status(500).json({ error: "Failed to get partner ratings" });
  }
});

router.get("/flags", async (req: Request, res: Response) => {
  try {
    const { limit = "50", offset = "0", status, userRole, flagType, severity } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (userRole) where.userRole = userRole;
    if (flagType) where.flagType = flagType;
    if (severity) where.severity = severity;

    const flags = await prisma.reputationFlag.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.reputationFlag.count({ where });

    res.json({ flags, total });
  } catch (error) {
    console.error("[AdminReputation] Flags error:", error);
    res.status(500).json({ error: "Failed to get reputation flags" });
  }
});

router.post("/flags/:flagId/override", async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const { adminId, reason } = req.body;

    const flag = await prisma.reputationFlag.update({
      where: { id: flagId },
      data: {
        status: "overridden",
        overriddenBy: adminId,
        overriddenAt: new Date(),
        overrideReason: reason,
      },
    });

    if (flag.userRole === "driver") {
      await prisma.driverRating.updateMany({
        where: { driverId: flag.userId, isRestricted: true },
        data: {
          isRestricted: false,
          restrictionReason: `Override by admin: ${reason}`,
        },
      });
    } else if (flag.userRole === "customer") {
      await prisma.customerRating.updateMany({
        where: { customerId: flag.userId, isRestricted: true },
        data: {
          isRestricted: false,
          restrictionReason: `Override by admin: ${reason}`,
        },
      });
    } else if (flag.userRole === "partner") {
      await prisma.partnerRating.updateMany({
        where: { partnerId: flag.userId, isRestricted: true },
        data: {
          isRestricted: false,
          restrictionReason: `Override by admin: ${reason}`,
          searchVisibilityRank: 100,
        },
      });
    }

    await prisma.reputationLog.create({
      data: {
        userId: flag.userId,
        userRole: flag.userRole,
        eventType: "admin_override",
        eventDetails: { flagId, reason },
        actionType: "override",
        actionDetails: reason,
        triggeredBy: adminId,
      },
    });

    console.log(`[AdminReputation] Flag ${flagId} overridden by admin ${adminId}`);

    res.json({ success: true, flag });
  } catch (error) {
    console.error("[AdminReputation] Override flag error:", error);
    res.status(500).json({ error: "Failed to override flag" });
  }
});

router.post("/flags/:flagId/resolve", async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const { adminId, note } = req.body;

    const flag = await prisma.reputationFlag.update({
      where: { id: flagId },
      data: {
        status: "resolved",
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolutionNote: note,
      },
    });

    console.log(`[AdminReputation] Flag ${flagId} resolved by admin ${adminId}`);

    res.json({ success: true, flag });
  } catch (error) {
    console.error("[AdminReputation] Resolve flag error:", error);
    res.status(500).json({ error: "Failed to resolve flag" });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  try {
    const { limit = "100", offset = "0", userId, userRole, eventType } = req.query;

    const where: any = {};
    if (userId) where.userId = userId;
    if (userRole) where.userRole = userRole;
    if (eventType) where.eventType = eventType;

    const logs = await prisma.reputationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.reputationLog.count({ where });

    res.json({ logs, total });
  } catch (error) {
    console.error("[AdminReputation] Logs error:", error);
    res.status(500).json({ error: "Failed to get reputation logs" });
  }
});

router.get("/distribution", async (req: Request, res: Response) => {
  try {
    const [driverDist, customerDist, partnerDist] = await Promise.all([
      prisma.driverRating.aggregate({
        _sum: {
          oneStarCount: true,
          twoStarCount: true,
          threeStarCount: true,
          fourStarCount: true,
          fiveStarCount: true,
        },
      }),
      prisma.customerRating.aggregate({
        _sum: {
          oneStarCount: true,
          twoStarCount: true,
          threeStarCount: true,
          fourStarCount: true,
          fiveStarCount: true,
        },
      }),
      prisma.partnerRating.aggregate({
        _sum: {
          oneStarCount: true,
          twoStarCount: true,
          threeStarCount: true,
          fourStarCount: true,
          fiveStarCount: true,
        },
      }),
    ]);

    res.json({
      driver: {
        1: driverDist._sum.oneStarCount || 0,
        2: driverDist._sum.twoStarCount || 0,
        3: driverDist._sum.threeStarCount || 0,
        4: driverDist._sum.fourStarCount || 0,
        5: driverDist._sum.fiveStarCount || 0,
      },
      customer: {
        1: customerDist._sum.oneStarCount || 0,
        2: customerDist._sum.twoStarCount || 0,
        3: customerDist._sum.threeStarCount || 0,
        4: customerDist._sum.fourStarCount || 0,
        5: customerDist._sum.fiveStarCount || 0,
      },
      partner: {
        1: partnerDist._sum.oneStarCount || 0,
        2: partnerDist._sum.twoStarCount || 0,
        3: partnerDist._sum.threeStarCount || 0,
        4: partnerDist._sum.fourStarCount || 0,
        5: partnerDist._sum.fiveStarCount || 0,
      },
    });
  } catch (error) {
    console.error("[AdminReputation] Distribution error:", error);
    res.status(500).json({ error: "Failed to get rating distribution" });
  }
});

router.get("/daily-trend", async (req: Request, res: Response) => {
  try {
    const { days = "7" } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const submissions = await prisma.ratingSubmission.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        rating: true,
        targetRole: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const dailyData: Record<string, { driver: number[]; customer: number[]; partner: number[] }> = {};

    for (let i = 0; i < daysNum; i++) {
      const date = new Date(Date.now() - (daysNum - 1 - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dailyData[dateStr] = { driver: [], customer: [], partner: [] };
    }

    submissions.forEach((sub) => {
      const dateStr = sub.createdAt.toISOString().split("T")[0];
      if (dailyData[dateStr]) {
        if (sub.targetRole === "driver") {
          dailyData[dateStr].driver.push(sub.rating);
        } else if (sub.targetRole === "customer") {
          dailyData[dateStr].customer.push(sub.rating);
        } else if (sub.targetRole === "partner" || sub.targetRole === "restaurant") {
          dailyData[dateStr].partner.push(sub.rating);
        }
      }
    });

    const trend = Object.entries(dailyData).map(([date, data]) => ({
      date,
      driverAvg: data.driver.length > 0 ? data.driver.reduce((a, b) => a + b, 0) / data.driver.length : null,
      driverCount: data.driver.length,
      customerAvg: data.customer.length > 0 ? data.customer.reduce((a, b) => a + b, 0) / data.customer.length : null,
      customerCount: data.customer.length,
      partnerAvg: data.partner.length > 0 ? data.partner.reduce((a, b) => a + b, 0) / data.partner.length : null,
      partnerCount: data.partner.length,
    }));

    res.json({ trend });
  } catch (error) {
    console.error("[AdminReputation] Daily trend error:", error);
    res.status(500).json({ error: "Failed to get daily trend" });
  }
});

router.get("/thresholds", async (req: Request, res: Response) => {
  try {
    const thresholds = await prisma.ratingThreshold.findMany({
      orderBy: [{ userRole: "asc" }, { thresholdType: "asc" }],
    });

    res.json({ thresholds });
  } catch (error) {
    console.error("[AdminReputation] Thresholds error:", error);
    res.status(500).json({ error: "Failed to get thresholds" });
  }
});

router.post("/thresholds", async (req: Request, res: Response) => {
  try {
    const { userRole, thresholdType, minRating, actionRequired, actionDuration, fraudScorePenalty, adminId } = req.body;

    const threshold = await prisma.ratingThreshold.upsert({
      where: {
        userRole_thresholdType: { userRole, thresholdType },
      },
      update: {
        minRating,
        actionRequired,
        actionDuration,
        fraudScorePenalty: fraudScorePenalty || 0,
        updatedBy: adminId,
      },
      create: {
        userRole,
        thresholdType,
        minRating,
        actionRequired,
        actionDuration,
        fraudScorePenalty: fraudScorePenalty || 0,
        updatedBy: adminId,
      },
    });

    console.log(`[AdminReputation] Threshold updated: ${userRole}/${thresholdType} by admin ${adminId}`);

    res.json({ success: true, threshold });
  } catch (error) {
    console.error("[AdminReputation] Update threshold error:", error);
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

router.get("/distribution", async (req: Request, res: Response) => {
  try {
    const { userRole = "all" } = req.query;
    
    const distribution = {
      1: { customer: 0, driver: 0, partner: 0 },
      2: { customer: 0, driver: 0, partner: 0 },
      3: { customer: 0, driver: 0, partner: 0 },
      4: { customer: 0, driver: 0, partner: 0 },
      5: { customer: 0, driver: 0, partner: 0 },
    };

    if (userRole === "all" || userRole === "customer") {
      const customerRatings = await prisma.customerRating.findMany({
        select: { oneStarCount: true, twoStarCount: true, threeStarCount: true, fourStarCount: true, fiveStarCount: true },
      });
      customerRatings.forEach(r => {
        distribution[1].customer += r.oneStarCount;
        distribution[2].customer += r.twoStarCount;
        distribution[3].customer += r.threeStarCount;
        distribution[4].customer += r.fourStarCount;
        distribution[5].customer += r.fiveStarCount;
      });
    }

    if (userRole === "all" || userRole === "driver") {
      const driverRatings = await prisma.driverRating.findMany({
        select: { oneStarCount: true, twoStarCount: true, threeStarCount: true, fourStarCount: true, fiveStarCount: true },
      });
      driverRatings.forEach(r => {
        distribution[1].driver += r.oneStarCount;
        distribution[2].driver += r.twoStarCount;
        distribution[3].driver += r.threeStarCount;
        distribution[4].driver += r.fourStarCount;
        distribution[5].driver += r.fiveStarCount;
      });
    }

    if (userRole === "all" || userRole === "partner") {
      const partnerRatings = await prisma.partnerRating.findMany({
        select: { oneStarCount: true, twoStarCount: true, threeStarCount: true, fourStarCount: true, fiveStarCount: true },
      });
      partnerRatings.forEach(r => {
        distribution[1].partner += r.oneStarCount;
        distribution[2].partner += r.twoStarCount;
        distribution[3].partner += r.threeStarCount;
        distribution[4].partner += r.fourStarCount;
        distribution[5].partner += r.fiveStarCount;
      });
    }

    const formattedDistribution = Object.entries(distribution).map(([stars, counts]) => ({
      stars: parseInt(stars),
      ...counts,
      total: counts.customer + counts.driver + counts.partner,
    }));

    res.json({ distribution: formattedDistribution });
  } catch (error) {
    console.error("[AdminReputation] Distribution error:", error);
    res.status(500).json({ error: "Failed to get rating distribution" });
  }
});

router.get("/daily-trend", async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const daysCount = parseInt(days as string);
    const startDate = new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000);

    const submissions = await prisma.ratingSubmission.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, rating: true, targetRole: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyData: Record<string, { date: string; count: number; avgRating: number; total: number; customer: number; driver: number; partner: number }> = {};

    for (let i = 0; i < daysCount; i++) {
      const date = new Date(Date.now() - (daysCount - 1 - i) * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split("T")[0];
      dailyData[dateKey] = { date: dateKey, count: 0, avgRating: 0, total: 0, customer: 0, driver: 0, partner: 0 };
    }

    submissions.forEach(s => {
      const dateKey = s.createdAt.toISOString().split("T")[0];
      if (dailyData[dateKey]) {
        dailyData[dateKey].count++;
        dailyData[dateKey].total += s.rating;
        if (s.targetRole === "customer") dailyData[dateKey].customer++;
        else if (s.targetRole === "driver") dailyData[dateKey].driver++;
        else if (s.targetRole === "partner") dailyData[dateKey].partner++;
      }
    });

    const trend = Object.values(dailyData).map(d => ({
      ...d,
      avgRating: d.count > 0 ? Math.round((d.total / d.count) * 100) / 100 : 0,
    }));

    res.json({ trend });
  } catch (error) {
    console.error("[AdminReputation] Daily trend error:", error);
    res.status(500).json({ error: "Failed to get daily trend" });
  }
});

router.post("/clear-restriction/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { userRole, adminId, reason } = req.body;

    if (userRole === "driver") {
      await prisma.driverRating.updateMany({
        where: { driverId: userId },
        data: {
          isRestricted: false,
          restrictionReason: `Cleared by admin: ${reason}`,
        },
      });
    } else if (userRole === "customer") {
      await prisma.customerRating.updateMany({
        where: { customerId: userId },
        data: {
          isRestricted: false,
          restrictionReason: `Cleared by admin: ${reason}`,
        },
      });
    } else if (userRole === "partner") {
      await prisma.partnerRating.updateMany({
        where: { partnerId: userId },
        data: {
          isRestricted: false,
          restrictionReason: `Cleared by admin: ${reason}`,
          searchVisibilityRank: 100,
        },
      });
    }

    await prisma.reputationFlag.updateMany({
      where: { userId, userRole, status: "active" },
      data: {
        status: "overridden",
        overriddenBy: adminId,
        overriddenAt: new Date(),
        overrideReason: reason,
      },
    });

    await prisma.reputationLog.create({
      data: {
        userId,
        userRole,
        eventType: "admin_override",
        eventDetails: { reason },
        actionType: "clear_restriction",
        actionDetails: reason,
        triggeredBy: adminId,
      },
    });

    console.log(`[AdminReputation] Restriction cleared for ${userRole} ${userId} by admin ${adminId}`);

    res.json({ success: true });
  } catch (error) {
    console.error("[AdminReputation] Clear restriction error:", error);
    res.status(500).json({ error: "Failed to clear restriction" });
  }
});

export default router;
