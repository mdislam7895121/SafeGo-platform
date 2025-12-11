import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { logAuditEvent } from "../utils/audit";
import { z } from "zod";

const router = Router();

type ServiceType = "RIDE" | "FOOD" | "PARCEL";
type TimeRange = "7d" | "30d" | "all";

interface PerformanceMetrics {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  inProgressTrips: number;
  averageRating: number | null;
  totalRatings: number;
  cancellationRate: number;
  completionRate: number;
  totalEarnings: number;
  totalCommission: number;
  netEarnings: number;
}

interface ServiceBreakdown {
  serviceType: ServiceType;
  totalTrips: number;
  completedTrips: number;
  averageRating: number | null;
  totalRatings: number;
  totalEarnings: number;
}

interface RatingBreakdown {
  star5: number;
  star4: number;
  star3: number;
  star2: number;
  star1: number;
  total: number;
  average: number | null;
}

interface DriverReview {
  id: string;
  serviceType: ServiceType;
  rating: number;
  comment: string | null;
  createdAt: Date;
  tripCode: string;
}

const PERFORMANCE_THRESHOLDS = {
  minimumRating: 4.5,
  maximumCancellationRate: 10,
  qualityRatingMinimum: 4.7,
  priorityAccessRating: 4.8,
};

function getDateRange(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

function generateTripCode(serviceType: string, id: string): string {
  const prefix = serviceType === "RIDE" ? "RD" : serviceType === "FOOD" ? "FD" : "PD";
  return `${prefix}-${id.substring(0, 8).toUpperCase()}`;
}

router.get(
  "/summary",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { range = "30d" } = req.query;

      const rangeSchema = z.enum(["7d", "30d", "all"]);
      const validatedRange = rangeSchema.parse(range);
      const dateFrom = getDateRange(validatedRange);

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      const driverId = driverProfile.id;
      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const dateFilter = dateFrom ? { gte: dateFrom } : undefined;

      const [rides, foodOrders, deliveries] = await Promise.all([
        prisma.ride.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
          },
          select: {
            id: true,
            status: true,
            customerRating: true,
            driverPayout: true,
            safegoCommission: true,
          },
        }),
        prisma.foodOrder.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
          },
          select: {
            id: true,
            status: true,
            customerRating: true,
            driverPayout: true,
            safegoCommission: true,
          },
        }),
        prisma.delivery.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
          },
          select: {
            id: true,
            status: true,
            customerRating: true,
            driverPayout: true,
            safegoCommission: true,
          },
        }),
      ]);

      const allTrips = [
        ...rides.map(r => ({ ...r, type: "RIDE" as ServiceType })),
        ...foodOrders.map(f => ({ ...f, type: "FOOD" as ServiceType })),
        ...deliveries.map(d => ({ ...d, type: "PARCEL" as ServiceType })),
      ];

      const completedTrips = allTrips.filter(t => 
        t.status === "completed" || t.status === "delivered"
      );
      const cancelledTrips = allTrips.filter(t => t.status === "cancelled");
      const inProgressTrips = allTrips.filter(t => 
        !["completed", "delivered", "cancelled"].includes(t.status)
      );

      const ratings = allTrips
        .filter(t => t.customerRating !== null && t.customerRating !== undefined)
        .map(t => t.customerRating as number);

      const averageRating = ratings.length > 0
        ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
        : null;

      const totalEarnings = completedTrips.reduce(
        (sum, t) => sum + serializeDecimal(t.driverPayout),
        0
      );
      const totalCommission = completedTrips.reduce(
        (sum, t) => sum + serializeDecimal(t.safegoCommission),
        0
      );

      const cancellationRate = allTrips.length > 0
        ? parseFloat(((cancelledTrips.length / allTrips.length) * 100).toFixed(1))
        : 0;

      const completionRate = allTrips.length > 0
        ? parseFloat(((completedTrips.length / allTrips.length) * 100).toFixed(1))
        : 0;

      const summary: PerformanceMetrics = {
        totalTrips: allTrips.length,
        completedTrips: completedTrips.length,
        cancelledTrips: cancelledTrips.length,
        inProgressTrips: inProgressTrips.length,
        averageRating,
        totalRatings: ratings.length,
        cancellationRate,
        completionRate,
        totalEarnings: isKycApproved ? totalEarnings : 0,
        totalCommission: isKycApproved ? totalCommission : 0,
        netEarnings: isKycApproved ? totalEarnings : 0,
      };

      await logAuditEvent({
        actorId: req.user!.userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_PERFORMANCE_SUMMARY",
        entityType: "performance",
        entityId: driverId,
        description: `Driver viewed performance summary for range: ${validatedRange}`,
        metadata: {
          range: validatedRange,
          totalTrips: summary.totalTrips,
          averageRating: summary.averageRating,
        },
      });

      res.json({
        summary: isKycApproved ? summary : {
          totalTrips: summary.totalTrips,
          completedTrips: summary.completedTrips,
          cancelledTrips: summary.cancelledTrips,
          inProgressTrips: summary.inProgressTrips,
          averageRating: summary.averageRating,
          totalRatings: summary.totalRatings,
          cancellationRate: summary.cancellationRate,
          completionRate: summary.completionRate,
        },
        range: validatedRange,
        rangeLabel: validatedRange === "7d" ? "Last 7 Days" : validatedRange === "30d" ? "Last 30 Days" : "All Time",
        kycApproved: isKycApproved,
        kycStatus: driverProfile.verificationStatus,
        thresholds: PERFORMANCE_THRESHOLDS,
      });
    } catch (error: any) {
      console.error("Error fetching performance summary:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid range parameter" });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/ratings",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { range = "30d" } = req.query;

      const rangeSchema = z.enum(["7d", "30d", "all"]);
      const validatedRange = rangeSchema.parse(range);
      const dateFrom = getDateRange(validatedRange);

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      const driverId = driverProfile.id;

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const dateFilter = dateFrom ? { gte: dateFrom } : undefined;

      const [rides, foodOrders, deliveries] = await Promise.all([
        prisma.ride.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
            customerRating: { not: null },
          },
          select: { customerRating: true },
        }),
        prisma.foodOrder.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
            customerRating: { not: null },
          },
          select: { customerRating: true },
        }),
        prisma.delivery.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
            customerRating: { not: null },
          },
          select: { customerRating: true },
        }),
      ]);

      const allRatings = [
        ...rides.map(r => r.customerRating as number),
        ...foodOrders.map(f => f.customerRating as number),
        ...deliveries.map(d => d.customerRating as number),
      ];

      const breakdown: RatingBreakdown = {
        star5: allRatings.filter(r => r === 5).length,
        star4: allRatings.filter(r => r === 4).length,
        star3: allRatings.filter(r => r === 3).length,
        star2: allRatings.filter(r => r === 2).length,
        star1: allRatings.filter(r => r === 1).length,
        total: allRatings.length,
        average: allRatings.length > 0
          ? parseFloat((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
          : null,
      };

      res.json({
        breakdown,
        range: validatedRange,
        rangeLabel: validatedRange === "7d" ? "Last 7 Days" : validatedRange === "30d" ? "Last 30 Days" : "All Time",
      });
    } catch (error: any) {
      console.error("Error fetching rating breakdown:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid range parameter" });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/reviews",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { range = "30d", page = "1", pageSize = "20" } = req.query;

      const rangeSchema = z.enum(["7d", "30d", "all"]);
      const validatedRange = rangeSchema.parse(range);
      const dateFrom = getDateRange(validatedRange);

      const pageNum = parseInt(page as string, 10) || 1;
      const limit = Math.min(parseInt(pageSize as string, 10) || 20, 50);
      const offset = (pageNum - 1) * limit;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      const driverId = driverProfile.id;

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const dateFilter = dateFrom ? { gte: dateFrom } : undefined;

      const [rides, foodOrders, deliveries] = await Promise.all([
        prisma.ride.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
            customerRating: { not: null },
          },
          select: {
            id: true,
            customerRating: true,
            customerFeedback: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.foodOrder.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
            customerRating: { not: null },
          },
          select: {
            id: true,
            customerRating: true,
            customerFeedback: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.delivery.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
            customerRating: { not: null },
          },
          select: {
            id: true,
            customerRating: true,
            customerFeedback: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const allReviews: DriverReview[] = [
        ...rides.map(r => ({
          id: r.id,
          serviceType: "RIDE" as ServiceType,
          rating: r.customerRating as number,
          comment: r.customerFeedback,
          createdAt: r.createdAt,
          tripCode: generateTripCode("RIDE", r.id),
        })),
        ...foodOrders.map(f => ({
          id: f.id,
          serviceType: "FOOD" as ServiceType,
          rating: f.customerRating as number,
          comment: f.customerFeedback,
          createdAt: f.createdAt,
          tripCode: generateTripCode("FOOD", f.id),
        })),
        ...deliveries.map(d => ({
          id: d.id,
          serviceType: "PARCEL" as ServiceType,
          rating: d.customerRating as number,
          comment: d.customerFeedback,
          createdAt: d.createdAt,
          tripCode: generateTripCode("PARCEL", d.id),
        })),
      ];

      allReviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const paginatedReviews = allReviews.slice(offset, offset + limit);
      const hasMore = allReviews.length > offset + limit;

      res.json({
        reviews: paginatedReviews,
        pagination: {
          page: pageNum,
          pageSize: limit,
          total: allReviews.length,
          hasMore,
        },
        range: validatedRange,
        rangeLabel: validatedRange === "7d" ? "Last 7 Days" : validatedRange === "30d" ? "Last 30 Days" : "All Time",
      });
    } catch (error: any) {
      console.error("Error fetching driver reviews:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid parameters" });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/service-breakdown",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { range = "30d" } = req.query;

      const rangeSchema = z.enum(["7d", "30d", "all"]);
      const validatedRange = rangeSchema.parse(range);
      const dateFrom = getDateRange(validatedRange);

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      const driverId = driverProfile.id;
      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const dateFilter = dateFrom ? { gte: dateFrom } : undefined;

      const [rides, foodOrders, deliveries] = await Promise.all([
        prisma.ride.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
          },
          select: {
            status: true,
            customerRating: true,
            driverPayout: true,
          },
        }),
        prisma.foodOrder.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
          },
          select: {
            status: true,
            customerRating: true,
            driverPayout: true,
          },
        }),
        prisma.delivery.findMany({
          where: {
            driverId,
            isDemo: false,
            createdAt: dateFilter,
          },
          select: {
            status: true,
            customerRating: true,
            driverPayout: true,
          },
        }),
      ]);

      const computeBreakdown = (
        items: Array<{ status: string; customerRating: number | null; driverPayout: any }>,
        serviceType: ServiceType
      ): ServiceBreakdown => {
        const completed = items.filter(i => i.status === "completed" || i.status === "delivered");
        const ratings = items
          .filter(i => i.customerRating !== null)
          .map(i => i.customerRating as number);

        return {
          serviceType,
          totalTrips: items.length,
          completedTrips: completed.length,
          averageRating: ratings.length > 0
            ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
            : null,
          totalRatings: ratings.length,
          totalEarnings: isKycApproved
            ? completed.reduce((sum, i) => sum + serializeDecimal(i.driverPayout), 0)
            : 0,
        };
      };

      const breakdown: ServiceBreakdown[] = [
        computeBreakdown(rides, "RIDE"),
        computeBreakdown(foodOrders, "FOOD"),
        computeBreakdown(deliveries, "PARCEL"),
      ];

      res.json({
        breakdown,
        range: validatedRange,
        rangeLabel: validatedRange === "7d" ? "Last 7 Days" : validatedRange === "30d" ? "Last 30 Days" : "All Time",
        kycApproved: isKycApproved,
      });
    } catch (error: any) {
      console.error("Error fetching service breakdown:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid range parameter" });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
