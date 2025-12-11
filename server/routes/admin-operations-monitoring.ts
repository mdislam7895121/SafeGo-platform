import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { z } from "zod";

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

const activeRidesFilterSchema = z.object({
  countryCode: z.enum(["BD", "US"]).optional(),
  status: z.string().optional(),
  driverId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

router.get("/active-rides", checkPermission(Permission.VIEW_OPERATIONS), async (req: AuthRequest, res) => {
  try {
    const filters = activeRidesFilterSchema.parse(req.query);
    const limit = Math.min(parseInt(filters.limit || "50"), 100);
    const offset = parseInt(filters.offset || "0");

    const whereClause: any = {
      status: {
        notIn: ["completed", "cancelled_by_customer", "cancelled_by_driver", "cancelled_by_system"],
      },
    };

    if (filters.countryCode) {
      whereClause.countryCode = filters.countryCode;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.driverId) {
      whereClause.driverId = filters.driverId;
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          customerId: true,
          driverId: true,
          countryCode: true,
          cityCode: true,
          pickupAddress: true,
          dropoffAddress: true,
          status: true,
          serviceFare: true,
          paymentMethod: true,
          createdAt: true,
          updatedAt: true,
          acceptedAt: true,
          arrivedAt: true,
          tripStartedAt: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              currentLat: true,
              currentLng: true,
            },
          },
        },
      }),
      prisma.ride.count({ where: whereClause }),
    ]);

    const statusCounts = await prisma.ride.groupBy({
      by: ["status"],
      where: {
        status: {
          notIn: ["completed", "cancelled_by_customer", "cancelled_by_driver", "cancelled_by_system"],
        },
      },
      _count: { id: true },
    });

    res.json({
      rides: rides.map((ride) => ({
        id: ride.id,
        customerId: ride.customerId,
        driverId: ride.driverId,
        countryCode: ride.countryCode,
        cityCode: ride.cityCode,
        pickupAddress: ride.pickupAddress ? 
          (ride.pickupAddress.length > 50 ? ride.pickupAddress.substring(0, 50) + "..." : ride.pickupAddress) : null,
        dropoffAddress: ride.dropoffAddress ? 
          (ride.dropoffAddress.length > 50 ? ride.dropoffAddress.substring(0, 50) + "..." : ride.dropoffAddress) : null,
        status: ride.status,
        fare: serializeDecimal(ride.serviceFare),
        paymentMethod: ride.paymentMethod,
        createdAt: ride.createdAt,
        updatedAt: ride.updatedAt,
        acceptedAt: ride.acceptedAt,
        arrivedAt: ride.arrivedAt,
        tripStartedAt: ride.tripStartedAt,
        customerName: ride.customer?.fullName || "Unknown",
        driverName: ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName || ""}`.trim() : null,
        driverLocation: ride.driver?.currentLat && ride.driver?.currentLng ? {
          lat: ride.driver.currentLat,
          lng: ride.driver.currentLng,
        } : null,
      })),
      total,
      statusBreakdown: statusCounts.reduce((acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      }, {} as Record<string, number>),
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("Get active rides error:", error);
    res.status(500).json({ error: "Failed to fetch active rides" });
  }
});

const driverOnlineFilterSchema = z.object({
  countryCode: z.enum(["BD", "US"]).optional(),
  isOnline: z.enum(["true", "false"]).optional(),
  isAvailable: z.enum(["true", "false"]).optional(),
  hasActiveTrip: z.enum(["true", "false"]).optional(),
  verificationStatus: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

router.get("/drivers/status", checkPermission(Permission.VIEW_OPERATIONS), async (req: AuthRequest, res) => {
  try {
    const filters = driverOnlineFilterSchema.parse(req.query);
    const limit = Math.min(parseInt(filters.limit || "50"), 100);
    const offset = parseInt(filters.offset || "0");

    const whereClause: any = {};

    if (filters.isOnline !== undefined) {
      whereClause.isOnline = filters.isOnline === "true";
    }

    if (filters.isAvailable !== undefined) {
      whereClause.isAvailable = filters.isAvailable === "true";
    }

    if (filters.hasActiveTrip === "true") {
      whereClause.currentAssignmentId = { not: null };
    } else if (filters.hasActiveTrip === "false") {
      whereClause.currentAssignmentId = null;
    }

    if (filters.countryCode) {
      whereClause.countryCode = filters.countryCode;
    }

    const [realtimeStates, total] = await Promise.all([
      prisma.driverRealtimeState.findMany({
        where: whereClause,
        orderBy: [{ isOnline: "desc" }, { lastUpdateAt: "desc" }],
        take: limit,
        skip: offset,
        include: {
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              verificationStatus: true,
              isVerified: true,
              isSuspended: true,
              driverType: true,
              country: true,
              currentLat: true,
              currentLng: true,
              lastLocationUpdate: true,
              user: {
                select: {
                  isBlocked: true,
                  countryCode: true,
                },
              },
            },
          },
        },
      }),
      prisma.driverRealtimeState.count({ where: whereClause }),
    ]);

    const activeRideCounts = await prisma.ride.groupBy({
      by: ["driverId"],
      where: {
        driverId: { in: realtimeStates.map(s => s.driverId).filter(Boolean) },
        status: { in: ["accepted", "driver_arriving", "arrived", "in_progress"] },
      },
      _count: { id: true },
    });

    const activeRideMap = activeRideCounts.reduce((acc, item) => {
      if (item.driverId) {
        acc[item.driverId] = item._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    const statusSummary = await prisma.driverRealtimeState.groupBy({
      by: ["isOnline", "isAvailable"],
      _count: { id: true },
    });

    res.json({
      drivers: realtimeStates.map((state) => ({
        driverId: state.driverId,
        name: state.driver ? `${state.driver.firstName} ${state.driver.lastName || ""}`.trim() : "Unknown",
        phone: state.driver?.phoneNumber || null,
        countryCode: state.driver?.user?.countryCode || state.countryCode,
        driverType: state.driver?.driverType || null,
        isOnline: state.isOnline,
        isAvailable: state.isAvailable,
        currentServiceMode: state.currentServiceMode,
        currentAssignmentId: state.currentAssignmentId,
        hasActiveTrip: !!activeRideMap[state.driverId],
        activeRideCount: activeRideMap[state.driverId] || 0,
        verificationStatus: state.driver?.verificationStatus || "unknown",
        isVerified: state.driver?.isVerified || false,
        isSuspended: state.driver?.isSuspended || false,
        isBlocked: state.driver?.user?.isBlocked || false,
        location: state.lastKnownLat && state.lastKnownLng ? {
          lat: state.lastKnownLat,
          lng: state.lastKnownLng,
        } : null,
        lastUpdateAt: state.lastUpdateAt,
        connectedAt: state.connectedAt,
        disconnectedAt: state.disconnectedAt,
      })),
      total,
      statusSummary: {
        online: statusSummary.filter(s => s.isOnline).reduce((sum, s) => sum + s._count.id, 0),
        offline: statusSummary.filter(s => !s.isOnline).reduce((sum, s) => sum + s._count.id, 0),
        available: statusSummary.filter(s => s.isAvailable).reduce((sum, s) => sum + s._count.id, 0),
        busy: statusSummary.filter(s => s.isOnline && !s.isAvailable).reduce((sum, s) => sum + s._count.id, 0),
      },
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("Get driver status error:", error);
    res.status(500).json({ error: "Failed to fetch driver status" });
  }
});

router.get("/drivers/:driverId/trips", checkPermission(Permission.VIEW_OPERATIONS), async (req: AuthRequest, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.query;

    const whereClause: any = { driverId };
    
    if (status === "active") {
      whereClause.status = { in: ["accepted", "driver_arriving", "arrived", "in_progress"] };
    }

    const rides = await prisma.ride.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        serviceFare: true,
        paymentMethod: true,
        createdAt: true,
        completedAt: true,
        customer: {
          select: {
            fullName: true,
          },
        },
      },
    });

    res.json({
      driverId,
      rides: rides.map(r => ({
        id: r.id,
        status: r.status,
        pickupAddress: r.pickupAddress,
        dropoffAddress: r.dropoffAddress,
        fare: serializeDecimal(r.serviceFare),
        paymentMethod: r.paymentMethod,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        customerName: r.customer?.fullName || "Unknown",
      })),
    });
  } catch (error) {
    console.error("Get driver trips error:", error);
    res.status(500).json({ error: "Failed to fetch driver trips" });
  }
});

export default router;
