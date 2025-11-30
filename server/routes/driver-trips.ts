import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { logAuditEvent } from "../utils/audit";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

type ServiceType = "RIDE" | "FOOD" | "PARCEL";
type TripStatus = "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | "PENDING" | "ADJUSTED" | "REFUNDED";

interface UnifiedDriverTrip {
  id: string;
  serviceType: ServiceType;
  dateTime: Date;
  completedAt: Date | null;
  pickupLocation: string;
  dropoffLocation: string;
  status: TripStatus;
  baseFare: number;
  deliveryFee: number | null;
  surgeOrBoost: number | null;
  tipAmount: number | null;
  safeGoCommission: number;
  driverEarnings: number;
  paymentMethod: string;
  tripCode: string;
  customerRating: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  restaurantName?: string;
  orderCode?: string;
}

interface TripDetailBreakdown extends UnifiedDriverTrip {
  distanceFare: number | null;
  timeFare: number | null;
  promotionBonus: number | null;
  adjustments: Array<{
    type: string;
    amount: number;
    reason: string;
    date: Date;
  }>;
  supportTicketCount: number;
  lastSupportStatus: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

function mapRideStatus(status: string): TripStatus {
  const statusMap: Record<string, TripStatus> = {
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    in_progress: "IN_PROGRESS",
    pending: "PENDING",
    accepted: "IN_PROGRESS",
    arrived: "IN_PROGRESS",
    picked_up: "IN_PROGRESS",
    started: "IN_PROGRESS",
    adjusted: "ADJUSTED",
    refunded: "REFUNDED",
  };
  return statusMap[status.toLowerCase()] || "PENDING";
}

function mapFoodOrderStatus(status: string): TripStatus {
  const statusMap: Record<string, TripStatus> = {
    delivered: "COMPLETED",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    preparing: "IN_PROGRESS",
    ready: "IN_PROGRESS",
    picked_up: "IN_PROGRESS",
    pending: "PENDING",
    accepted: "IN_PROGRESS",
    adjusted: "ADJUSTED",
    refunded: "REFUNDED",
  };
  return statusMap[status.toLowerCase()] || "PENDING";
}

function mapDeliveryStatus(status: string): TripStatus {
  const statusMap: Record<string, TripStatus> = {
    delivered: "COMPLETED",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    in_transit: "IN_PROGRESS",
    picked_up: "IN_PROGRESS",
    pending: "PENDING",
    accepted: "IN_PROGRESS",
    adjusted: "ADJUSTED",
    refunded: "REFUNDED",
  };
  return statusMap[status.toLowerCase()] || "PENDING";
}

function generateTripCode(serviceType: ServiceType, id: string): string {
  const prefix = serviceType === "RIDE" ? "RD" : serviceType === "FOOD" ? "FD" : "PD";
  return `${prefix}-${id.slice(-8).toUpperCase()}`;
}

const filtersSchema = z.object({
  serviceType: z.enum(["RIDE", "FOOD", "PARCEL"]).optional(),
  status: z.enum(["COMPLETED", "CANCELLED", "IN_PROGRESS", "PENDING", "ADJUSTED", "REFUNDED"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minEarnings: z.string().optional(),
  maxEarnings: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

router.get(
  "/",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
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

      const filters = filtersSchema.parse(req.query);
      const limit = Math.min(parseInt(filters.limit || "20"), 50);
      const offset = parseInt(filters.offset || "0");

      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.lte = endDate;
      }

      const trips: UnifiedDriverTrip[] = [];

      if (!filters.serviceType || filters.serviceType === "RIDE") {
        const rideWhere: any = { driverId, isDemo: false };
        if (Object.keys(dateFilter).length > 0) {
          rideWhere.createdAt = dateFilter;
        }
        if (filters.status) {
          const statusValues = getStatusValuesForType("RIDE", filters.status);
          if (statusValues.length > 0) {
            rideWhere.status = { in: statusValues };
          }
        }

        const rides = await prisma.ride.findMany({
          where: rideWhere,
          orderBy: { createdAt: "desc" },
          take: limit * 3,
        });

        for (const ride of rides) {
          const driverEarnings = serializeDecimal(ride.driverPayout);
          if (filters.minEarnings && driverEarnings < parseFloat(filters.minEarnings)) continue;
          if (filters.maxEarnings && driverEarnings > parseFloat(filters.maxEarnings)) continue;

          trips.push({
            id: ride.id,
            serviceType: "RIDE",
            dateTime: ride.createdAt,
            completedAt: ride.completedAt,
            pickupLocation: ride.pickupAddress,
            dropoffLocation: ride.dropoffAddress,
            status: mapRideStatus(ride.status),
            baseFare: serializeDecimal(ride.serviceFare),
            deliveryFee: null,
            surgeOrBoost: null,
            tipAmount: null,
            safeGoCommission: serializeDecimal(ride.safegoCommission),
            driverEarnings,
            paymentMethod: ride.paymentMethod,
            tripCode: generateTripCode("RIDE", ride.id),
            customerRating: ride.customerRating,
            taxAmount: ride.totalTaxAmount ? serializeDecimal(ride.totalTaxAmount) : null,
            discountAmount: null,
          });
        }
      }

      if (!filters.serviceType || filters.serviceType === "FOOD") {
        const foodWhere: any = { driverId, isDemo: false };
        if (Object.keys(dateFilter).length > 0) {
          foodWhere.createdAt = dateFilter;
        }
        if (filters.status) {
          const statusValues = getStatusValuesForType("FOOD", filters.status);
          if (statusValues.length > 0) {
            foodWhere.status = { in: statusValues };
          }
        }

        const foodOrders = await prisma.foodOrder.findMany({
          where: foodWhere,
          orderBy: { createdAt: "desc" },
          take: limit * 3,
          include: {
            restaurant: {
              select: { restaurantName: true },
            },
          },
        });

        for (const order of foodOrders) {
          const driverEarnings = serializeDecimal(order.driverPayout);
          if (filters.minEarnings && driverEarnings < parseFloat(filters.minEarnings)) continue;
          if (filters.maxEarnings && driverEarnings > parseFloat(filters.maxEarnings)) continue;

          trips.push({
            id: order.id,
            serviceType: "FOOD",
            dateTime: order.createdAt,
            completedAt: order.completedAt || order.deliveredAt,
            pickupLocation: order.pickupAddress || order.restaurant.restaurantName,
            dropoffLocation: order.deliveryAddress,
            status: mapFoodOrderStatus(order.status),
            baseFare: serializeDecimal(order.serviceFare),
            deliveryFee: order.deliveryFee ? serializeDecimal(order.deliveryFee) : null,
            surgeOrBoost: null,
            tipAmount: null,
            safeGoCommission: serializeDecimal(order.safegoCommission),
            driverEarnings,
            paymentMethod: order.paymentMethod,
            tripCode: order.orderCode || generateTripCode("FOOD", order.id),
            customerRating: order.customerRating,
            taxAmount: order.totalTaxAmount ? serializeDecimal(order.totalTaxAmount) : null,
            discountAmount: order.discountAmount ? serializeDecimal(order.discountAmount) : null,
            restaurantName: order.restaurant.restaurantName,
            orderCode: order.orderCode || undefined,
          });
        }
      }

      if (!filters.serviceType || filters.serviceType === "PARCEL") {
        const deliveryWhere: any = { driverId, isDemo: false };
        if (Object.keys(dateFilter).length > 0) {
          deliveryWhere.createdAt = dateFilter;
        }
        if (filters.status) {
          const statusValues = getStatusValuesForType("PARCEL", filters.status);
          if (statusValues.length > 0) {
            deliveryWhere.status = { in: statusValues };
          }
        }

        const deliveries = await prisma.delivery.findMany({
          where: deliveryWhere,
          orderBy: { createdAt: "desc" },
          take: limit * 3,
        });

        for (const delivery of deliveries) {
          const driverEarnings = serializeDecimal(delivery.driverPayout);
          if (filters.minEarnings && driverEarnings < parseFloat(filters.minEarnings)) continue;
          if (filters.maxEarnings && driverEarnings > parseFloat(filters.maxEarnings)) continue;

          trips.push({
            id: delivery.id,
            serviceType: "PARCEL",
            dateTime: delivery.createdAt,
            completedAt: delivery.deliveredAt,
            pickupLocation: delivery.pickupAddress,
            dropoffLocation: delivery.dropoffAddress,
            status: mapDeliveryStatus(delivery.status),
            baseFare: serializeDecimal(delivery.serviceFare),
            deliveryFee: null,
            surgeOrBoost: null,
            tipAmount: null,
            safeGoCommission: serializeDecimal(delivery.safegoCommission),
            driverEarnings,
            paymentMethod: delivery.paymentMethod,
            tripCode: generateTripCode("PARCEL", delivery.id),
            customerRating: delivery.customerRating,
            taxAmount: delivery.totalTaxAmount ? serializeDecimal(delivery.totalTaxAmount) : null,
            discountAmount: null,
          });
        }
      }

      trips.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());

      const paginatedTrips = trips.slice(offset, offset + limit);
      const hasMore = trips.length > offset + limit;

      const summary = {
        totalTrips: trips.length,
        totalEarnings: trips.reduce((sum, t) => sum + t.driverEarnings, 0),
        completedTrips: trips.filter(t => t.status === "COMPLETED").length,
        cancelledTrips: trips.filter(t => t.status === "CANCELLED").length,
      };

      await logAuditEvent({
        actorId: req.user!.userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_TRIP_HISTORY",
        entityType: "trip_history",
        entityId: driverId,
        description: `Driver viewed trip history with filters: ${JSON.stringify(filters)}`,
        metadata: {
          filters: JSON.stringify(filters),
          resultCount: paginatedTrips.length,
          totalCount: trips.length,
        },
      });

      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      res.json({
        trips: paginatedTrips,
        summary: isKycApproved ? summary : {
          totalTrips: summary.totalTrips,
          completedTrips: summary.completedTrips,
          cancelledTrips: summary.cancelledTrips,
        },
        pagination: {
          offset,
          limit,
          hasMore,
          total: trips.length,
        },
        kycStatus: driverProfile.verificationStatus,
        kycApproved: isKycApproved,
      });
    } catch (error: any) {
      console.error("Error fetching driver trip history:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid filter parameters", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/:tripId",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { tripId } = req.params;
      const { serviceType } = req.query;

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

      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      let tripDetail: TripDetailBreakdown | null = null;

      if (!serviceType || serviceType === "RIDE") {
        const ride = await prisma.ride.findFirst({
          where: { id: tripId, driverId, isDemo: false },
        });

        if (ride) {
          tripDetail = {
            id: ride.id,
            serviceType: "RIDE",
            dateTime: ride.createdAt,
            completedAt: ride.completedAt,
            pickupLocation: ride.pickupAddress,
            dropoffLocation: ride.dropoffAddress,
            status: mapRideStatus(ride.status),
            baseFare: serializeDecimal(ride.serviceFare),
            deliveryFee: null,
            surgeOrBoost: null,
            tipAmount: null,
            distanceFare: null,
            timeFare: null,
            promotionBonus: null,
            safeGoCommission: serializeDecimal(ride.safegoCommission),
            driverEarnings: serializeDecimal(ride.driverPayout),
            paymentMethod: ride.paymentMethod,
            tripCode: generateTripCode("RIDE", ride.id),
            customerRating: ride.customerRating,
            taxAmount: ride.totalTaxAmount ? serializeDecimal(ride.totalTaxAmount) : null,
            discountAmount: null,
            adjustments: [],
            supportTicketCount: ride.supportTicketCount || 0,
            lastSupportStatus: ride.lastSupportStatus,
            pickupLat: ride.pickupLat,
            pickupLng: ride.pickupLng,
            dropoffLat: ride.dropoffLat,
            dropoffLng: ride.dropoffLng,
          };
        }
      }

      if (!tripDetail && (!serviceType || serviceType === "FOOD")) {
        const foodOrder = await prisma.foodOrder.findFirst({
          where: { id: tripId, driverId, isDemo: false },
          include: {
            restaurant: {
              select: { restaurantName: true },
            },
          },
        });

        if (foodOrder) {
          tripDetail = {
            id: foodOrder.id,
            serviceType: "FOOD",
            dateTime: foodOrder.createdAt,
            completedAt: foodOrder.completedAt || foodOrder.deliveredAt,
            pickupLocation: foodOrder.pickupAddress || foodOrder.restaurant.restaurantName,
            dropoffLocation: foodOrder.deliveryAddress,
            status: mapFoodOrderStatus(foodOrder.status),
            baseFare: serializeDecimal(foodOrder.serviceFare),
            deliveryFee: foodOrder.deliveryFee ? serializeDecimal(foodOrder.deliveryFee) : null,
            surgeOrBoost: null,
            tipAmount: null,
            distanceFare: null,
            timeFare: null,
            promotionBonus: null,
            safeGoCommission: serializeDecimal(foodOrder.safegoCommission),
            driverEarnings: serializeDecimal(foodOrder.driverPayout),
            paymentMethod: foodOrder.paymentMethod,
            tripCode: foodOrder.orderCode || generateTripCode("FOOD", foodOrder.id),
            customerRating: foodOrder.customerRating,
            taxAmount: foodOrder.totalTaxAmount ? serializeDecimal(foodOrder.totalTaxAmount) : null,
            discountAmount: foodOrder.discountAmount ? serializeDecimal(foodOrder.discountAmount) : null,
            restaurantName: foodOrder.restaurant.restaurantName,
            orderCode: foodOrder.orderCode || undefined,
            adjustments: [],
            supportTicketCount: foodOrder.supportTicketCount || 0,
            lastSupportStatus: foodOrder.lastSupportStatus,
            pickupLat: foodOrder.pickupLat,
            pickupLng: foodOrder.pickupLng,
            dropoffLat: foodOrder.deliveryLat,
            dropoffLng: foodOrder.deliveryLng,
          };
        }
      }

      if (!tripDetail && (!serviceType || serviceType === "PARCEL")) {
        const delivery = await prisma.delivery.findFirst({
          where: { id: tripId, driverId, isDemo: false },
        });

        if (delivery) {
          tripDetail = {
            id: delivery.id,
            serviceType: "PARCEL",
            dateTime: delivery.createdAt,
            completedAt: delivery.deliveredAt,
            pickupLocation: delivery.pickupAddress,
            dropoffLocation: delivery.dropoffAddress,
            status: mapDeliveryStatus(delivery.status),
            baseFare: serializeDecimal(delivery.serviceFare),
            deliveryFee: null,
            surgeOrBoost: null,
            tipAmount: null,
            distanceFare: null,
            timeFare: null,
            promotionBonus: null,
            safeGoCommission: serializeDecimal(delivery.safegoCommission),
            driverEarnings: serializeDecimal(delivery.driverPayout),
            paymentMethod: delivery.paymentMethod,
            tripCode: generateTripCode("PARCEL", delivery.id),
            customerRating: delivery.customerRating,
            taxAmount: delivery.totalTaxAmount ? serializeDecimal(delivery.totalTaxAmount) : null,
            discountAmount: null,
            adjustments: [],
            supportTicketCount: delivery.supportTicketCount || 0,
            lastSupportStatus: delivery.lastSupportStatus,
            pickupLat: delivery.pickupLat,
            pickupLng: delivery.pickupLng,
            dropoffLat: delivery.dropoffLat,
            dropoffLng: delivery.dropoffLng,
          };
        }
      }

      if (!tripDetail) {
        return res.status(404).json({ error: "Trip not found" });
      }

      await logAuditEvent({
        actorId: req.user!.userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_TRIP_DETAIL",
        entityType: "trip",
        entityId: tripId,
        description: `Driver viewed trip detail for ${tripDetail.tripCode}`,
        metadata: {
          serviceType: tripDetail.serviceType,
          tripCode: tripDetail.tripCode,
        },
      });

      if (!isKycApproved) {
        const limitedDetail = {
          ...tripDetail,
          safeGoCommission: 0,
          driverEarnings: 0,
          baseFare: 0,
          deliveryFee: null,
          taxAmount: null,
          discountAmount: null,
          adjustments: [],
        };
        return res.json({
          trip: limitedDetail,
          kycStatus: driverProfile.verificationStatus,
          kycApproved: false,
          kycRequired: true,
          message: "Complete verification to view full earnings breakdown",
        });
      }

      res.json({
        trip: tripDetail,
        kycStatus: driverProfile.verificationStatus,
        kycApproved: true,
      });
    } catch (error: any) {
      console.error("Error fetching trip detail:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

function getStatusValuesForType(serviceType: string, status: TripStatus): string[] {
  if (serviceType === "RIDE") {
    switch (status) {
      case "COMPLETED": return ["completed"];
      case "CANCELLED": return ["cancelled"];
      case "IN_PROGRESS": return ["in_progress", "accepted", "arrived", "picked_up", "started"];
      case "PENDING": return ["pending"];
      case "ADJUSTED": return ["adjusted"];
      case "REFUNDED": return ["refunded"];
      default: return [];
    }
  } else if (serviceType === "FOOD") {
    switch (status) {
      case "COMPLETED": return ["delivered", "completed"];
      case "CANCELLED": return ["cancelled"];
      case "IN_PROGRESS": return ["preparing", "ready", "picked_up", "accepted"];
      case "PENDING": return ["pending"];
      case "ADJUSTED": return ["adjusted"];
      case "REFUNDED": return ["refunded"];
      default: return [];
    }
  } else {
    switch (status) {
      case "COMPLETED": return ["delivered", "completed"];
      case "CANCELLED": return ["cancelled"];
      case "IN_PROGRESS": return ["in_transit", "picked_up", "accepted"];
      case "PENDING": return ["pending"];
      case "ADJUSTED": return ["adjusted"];
      case "REFUNDED": return ["refunded"];
      default: return [];
    }
  }
}

type ActiveTripStatus = "accepted" | "arriving" | "arrived" | "started" | "completed" | "cancelled";

interface ActiveTrip {
  id: string;
  serviceType: ServiceType;
  status: ActiveTripStatus;
  tripCode: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  driverLat: number | null;
  driverLng: number | null;
  estimatedArrivalMinutes: number;
  estimatedTripMinutes: number;
  distanceKm: number;
  fare: number;
  customer: {
    firstName: string;
    phone: string | null;
  };
  restaurantName?: string;
  createdAt: Date;
}

const activeStatusValues = ["accepted", "arriving", "driver_arriving", "arrived", "started", "in_progress", "picked_up"];

const validStatusTransitions: Record<string, string[]> = {
  accepted: ["arriving", "cancelled"],
  arriving: ["arrived", "cancelled"],
  driver_arriving: ["arrived", "cancelled"],
  arrived: ["started", "cancelled"],
  started: ["completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  picked_up: ["completed", "cancelled"],
};

const completionLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional(),
  timestamp: z.number().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(["arriving", "arrived", "started", "completed", "cancelled"]),
  driverLat: z.number().optional(),
  driverLng: z.number().optional(),
  reason: z.string().optional(),
  completionLocation: completionLocationSchema.optional(),
});

router.get(
  "/active",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { 
          id: true, 
          isVerified: true, 
          verificationStatus: true, 
          isSuspended: true,
          currentLat: true,
          currentLng: true,
        },
      });
      
      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }
      
      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }
      
      const driverId = driverProfile.id;

      const activeRide = await prisma.ride.findFirst({
        where: { 
          driverId, 
          status: { in: activeStatusValues },
          isDemo: false,
        },
        include: {
          customer: {
            select: { firstName: true, phone: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeRide) {
        const activeTrip: ActiveTrip = {
          id: activeRide.id,
          serviceType: "RIDE",
          status: activeRide.status as ActiveTripStatus,
          tripCode: generateTripCode("RIDE", activeRide.id),
          pickupAddress: activeRide.pickupAddress,
          pickupLat: activeRide.pickupLat,
          pickupLng: activeRide.pickupLng,
          dropoffAddress: activeRide.dropoffAddress,
          dropoffLat: activeRide.dropoffLat,
          dropoffLng: activeRide.dropoffLng,
          driverLat: driverProfile.currentLat,
          driverLng: driverProfile.currentLng,
          estimatedArrivalMinutes: 8,
          estimatedTripMinutes: 15,
          distanceKm: 5.2,
          fare: serializeDecimal(activeRide.driverPayout),
          customer: {
            firstName: activeRide.customer.firstName || "Customer",
            phone: activeRide.customer.phone,
          },
          createdAt: activeRide.createdAt,
        };
        
        return res.json({ activeTrip, hasActiveTrip: true });
      }

      const activeFoodOrder = await prisma.foodOrder.findFirst({
        where: { 
          driverId, 
          status: { in: ["accepted", "picked_up", "in_transit"] },
          isDemo: false,
        },
        include: {
          customer: {
            select: { firstName: true, phone: true },
          },
          restaurant: {
            select: { restaurantName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeFoodOrder) {
        const activeTrip: ActiveTrip = {
          id: activeFoodOrder.id,
          serviceType: "FOOD",
          status: activeFoodOrder.status as ActiveTripStatus,
          tripCode: activeFoodOrder.orderCode || generateTripCode("FOOD", activeFoodOrder.id),
          pickupAddress: activeFoodOrder.pickupAddress || activeFoodOrder.restaurant.restaurantName,
          pickupLat: activeFoodOrder.pickupLat,
          pickupLng: activeFoodOrder.pickupLng,
          dropoffAddress: activeFoodOrder.deliveryAddress,
          dropoffLat: activeFoodOrder.deliveryLat,
          dropoffLng: activeFoodOrder.deliveryLng,
          driverLat: driverProfile.currentLat,
          driverLng: driverProfile.currentLng,
          estimatedArrivalMinutes: 5,
          estimatedTripMinutes: 12,
          distanceKm: 3.8,
          fare: serializeDecimal(activeFoodOrder.driverPayout),
          customer: {
            firstName: activeFoodOrder.customer.firstName || "Customer",
            phone: activeFoodOrder.customer.phone,
          },
          restaurantName: activeFoodOrder.restaurant.restaurantName,
          createdAt: activeFoodOrder.createdAt,
        };
        
        return res.json({ activeTrip, hasActiveTrip: true });
      }

      const activeDelivery = await prisma.delivery.findFirst({
        where: { 
          driverId, 
          status: { in: ["accepted", "picked_up", "in_transit"] },
          isDemo: false,
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeDelivery) {
        const activeTrip: ActiveTrip = {
          id: activeDelivery.id,
          serviceType: "PARCEL",
          status: activeDelivery.status as ActiveTripStatus,
          tripCode: generateTripCode("PARCEL", activeDelivery.id),
          pickupAddress: activeDelivery.pickupAddress,
          pickupLat: activeDelivery.pickupLat,
          pickupLng: activeDelivery.pickupLng,
          dropoffAddress: activeDelivery.dropoffAddress,
          dropoffLat: activeDelivery.dropoffLat,
          dropoffLng: activeDelivery.dropoffLng,
          driverLat: driverProfile.currentLat,
          driverLng: driverProfile.currentLng,
          estimatedArrivalMinutes: 10,
          estimatedTripMinutes: 20,
          distanceKm: 7.5,
          fare: serializeDecimal(activeDelivery.driverPayout),
          customer: {
            firstName: activeDelivery.recipientName || "Recipient",
            phone: activeDelivery.recipientPhone,
          },
          createdAt: activeDelivery.createdAt,
        };
        
        return res.json({ activeTrip, hasActiveTrip: true });
      }

      res.json({ activeTrip: null, hasActiveTrip: false });
    } catch (error: any) {
      console.error("Error fetching active trip:", error);
      res.status(500).json({ error: "Failed to fetch active trip" });
    }
  }
);

router.post(
  "/:tripId/status",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { tripId } = req.params;
      const { serviceType } = req.query;
      
      const validatedData = statusUpdateSchema.parse(req.body);
      const { status: newStatus, driverLat, driverLng, reason, completionLocation } = validatedData;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isSuspended: true },
      });
      
      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }
      
      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }
      
      const driverId = driverProfile.id;

      let currentStatus: string | null = null;
      let entityType: string = "trip";
      let updateResult: any = null;

      if (!serviceType || serviceType === "RIDE") {
        const ride = await prisma.ride.findFirst({
          where: { id: tripId, driverId, isDemo: false },
        });
        
        if (ride) {
          currentStatus = ride.status;
          entityType = "ride";
          
          const allowedTransitions = validStatusTransitions[currentStatus] || [];
          if (!allowedTransitions.includes(newStatus)) {
            return res.status(400).json({ 
              error: `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
              allowedTransitions,
            });
          }
          
          // Build update data with proper timestamps
          const updateData: any = {
            status: newStatus,
            ...(newStatus === "arriving" && { status: "driver_arriving" }),
            ...(newStatus === "arrived" && { arrivedAt: new Date() }),
            ...(newStatus === "started" && { tripStartedAt: new Date(), status: "in_progress" }),
            ...(newStatus === "completed" && { completedAt: new Date() }),
          };
          
          updateResult = await prisma.ride.update({
            where: { id: tripId },
            data: updateData,
          });
          
          // Create status event record for audit trail
          try {
            await prisma.rideStatusEvent.create({
              data: {
                rideId: tripId,
                status: newStatus,
                changedBy: "driver",
                changedByActorId: driverId,
                latitude: driverLat ? new Prisma.Decimal(driverLat) : null,
                longitude: driverLng ? new Prisma.Decimal(driverLng) : null,
              },
            });
          } catch (eventError) {
            console.error("Failed to create status event:", eventError);
          }
        }
      }

      if (!updateResult && (!serviceType || serviceType === "FOOD")) {
        const foodOrder = await prisma.foodOrder.findFirst({
          where: { id: tripId, driverId, isDemo: false },
        });
        
        if (foodOrder) {
          currentStatus = foodOrder.status;
          entityType = "food_order";
          
          const foodStatusFlow: Record<string, string[]> = {
            accepted: ["arriving", "cancelled"],
            arriving: ["arrived", "cancelled"],
            arrived: ["started", "cancelled"],
            started: ["completed", "cancelled"],
            picked_up: ["completed", "cancelled"],
            in_transit: ["completed", "cancelled"],
          };
          const allowedTransitions = foodStatusFlow[currentStatus] || [];
          if (!allowedTransitions.includes(newStatus)) {
            return res.status(400).json({ 
              error: `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
              allowedTransitions,
            });
          }
          
          const foodStatusMap: Record<string, string> = {
            arriving: "picked_up",
            arrived: "picked_up",
            started: "in_transit",
            completed: "delivered",
          };
          const mappedStatus = foodStatusMap[newStatus] || newStatus;
          
          updateResult = await prisma.foodOrder.update({
            where: { id: tripId },
            data: {
              status: mappedStatus,
              ...(mappedStatus === "picked_up" && { pickedUpAt: new Date() }),
              ...(mappedStatus === "delivered" && { deliveredAt: new Date(), completedAt: new Date() }),
            },
          });
        }
      }

      if (!updateResult && (!serviceType || serviceType === "PARCEL")) {
        const delivery = await prisma.delivery.findFirst({
          where: { id: tripId, driverId, isDemo: false },
        });
        
        if (delivery) {
          currentStatus = delivery.status;
          entityType = "delivery";
          
          const parcelStatusFlow: Record<string, string[]> = {
            accepted: ["arriving", "cancelled"],
            arriving: ["arrived", "cancelled"],
            arrived: ["started", "cancelled"],
            started: ["completed", "cancelled"],
            picked_up: ["completed", "cancelled"],
            in_transit: ["completed", "cancelled"],
          };
          const allowedTransitions = parcelStatusFlow[currentStatus] || [];
          if (!allowedTransitions.includes(newStatus)) {
            return res.status(400).json({ 
              error: `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
              allowedTransitions,
            });
          }
          
          const deliveryStatusMap: Record<string, string> = {
            arriving: "picked_up",
            arrived: "picked_up",
            started: "in_transit",
            completed: "delivered",
          };
          const mappedStatus = deliveryStatusMap[newStatus] || newStatus;
          
          updateResult = await prisma.delivery.update({
            where: { id: tripId },
            data: {
              status: mappedStatus,
              ...(mappedStatus === "delivered" && { deliveredAt: new Date() }),
            },
          });
        }
      }

      if (!updateResult) {
        return res.status(404).json({ error: "Trip not found or not assigned to you" });
      }

      if (driverLat !== undefined && driverLng !== undefined) {
        await prisma.driverProfile.update({
          where: { id: driverId },
          data: { currentLat: driverLat, currentLng: driverLng },
        });
      }

      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "UPDATE_TRIP_STATUS",
        entityType,
        entityId: tripId,
        description: `Driver updated trip status from "${currentStatus}" to "${newStatus}"`,
        metadata: {
          previousStatus: currentStatus,
          newStatus,
          driverLat,
          driverLng,
          reason,
          ip: req.ip,
          ...(newStatus === "completed" && completionLocation && {
            completionLocation: {
              lat: completionLocation.lat,
              lng: completionLocation.lng,
              accuracy: completionLocation.accuracy,
              verified: completionLocation.accuracy ? completionLocation.accuracy < 100 : false,
            },
          }),
        },
      });

      res.json({ 
        success: true, 
        previousStatus: currentStatus,
        newStatus,
        message: `Trip status updated to ${newStatus}`,
      });
    } catch (error: any) {
      console.error("Error updating trip status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update trip status" });
    }
  }
);

router.post(
  "/:tripId/location",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { lat, lng } = req.body;
      
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      
      await prisma.driverProfile.update({
        where: { userId },
        data: { currentLat: lat, currentLng: lng },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating driver location:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  }
);

router.post(
  "/log-navigation",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { tripId, navigationApp } = req.body;
      
      if (!tripId || !navigationApp) {
        return res.status(400).json({ error: "Missing tripId or navigationApp" });
      }
      
      const validApps = ["safego", "google", "apple", "waze"];
      if (!validApps.includes(navigationApp)) {
        return res.status(400).json({ error: "Invalid navigation app" });
      }
      
      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "NAVIGATION_APP_OPENED",
        entityType: "trip",
        entityId: tripId,
        description: `Driver opened ${navigationApp} navigation for trip`,
        metadata: {
          navigationApp,
          timestamp: new Date().toISOString(),
          ip: req.ip,
        },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error logging navigation event:", error);
      res.status(500).json({ error: "Failed to log navigation event" });
    }
  }
);

interface PendingTripRequest {
  id: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  customerName: string;
  customerRating: number | null;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  estimatedFare: number;
  distanceToPickup: number | null;
  etaMinutes: number | null;
  surgeMultiplier: number | null;
  boostAmount: number | null;
  requestedAt: Date;
  expiresAt: Date;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateEtaFromDistance(distanceKm: number, avgSpeedKmh: number = 30): number {
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

router.get(
  "/requests/pending",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: { vehicle: true },
      });
      
      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      
      if (!driverProfile.isVerified) {
        return res.status(403).json({ error: "Driver must be verified to receive requests" });
      }
      
      const primaryVehicle = await prisma.vehicle.findFirst({
        where: { driverId: driverProfile.id, isPrimary: true, isActive: true },
      });
      
      if (!primaryVehicle || !primaryVehicle.isOnline) {
        return res.status(403).json({ error: "Driver must be online to receive requests" });
      }
      
      const hasActiveTrip = await prisma.ride.findFirst({
        where: {
          driverId: driverProfile.id,
          status: { in: ["accepted", "arrived", "started", "in_progress"] },
        },
      });
      
      if (hasActiveTrip) {
        return res.json({ requests: [], message: "Driver has active trip" });
      }
      
      const pendingRequests: PendingTripRequest[] = [];
      const driverLat = driverProfile.currentLat || 0;
      const driverLng = driverProfile.currentLng || 0;
      
      const pendingRides = await prisma.ride.findMany({
        where: {
          status: { in: ["requested", "searching_driver"] },
          driverId: null,
          isDemo: false,
        },
        include: {
          customer: {
            include: {
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      
      for (const ride of pendingRides) {
        const distanceToPickup = (ride.pickupLat && ride.pickupLng && driverLat && driverLng)
          ? calculateDistance(driverLat, driverLng, ride.pickupLat, ride.pickupLng)
          : null;
        
        pendingRequests.push({
          id: ride.id,
          serviceType: "RIDE",
          customerName: ride.customer?.user?.email?.split("@")[0] || "Customer",
          customerRating: null,
          pickupAddress: ride.pickupAddress,
          pickupLat: ride.pickupLat,
          pickupLng: ride.pickupLng,
          dropoffAddress: ride.dropoffAddress,
          dropoffLat: ride.dropoffLat,
          dropoffLng: ride.dropoffLng,
          estimatedFare: serializeDecimal(ride.serviceFare),
          distanceToPickup,
          etaMinutes: distanceToPickup ? calculateEtaFromDistance(distanceToPickup) : null,
          surgeMultiplier: null,
          boostAmount: null,
          requestedAt: ride.createdAt,
          expiresAt: new Date(ride.createdAt.getTime() + 30000),
        });
      }
      
      const pendingDeliveries = await prisma.delivery.findMany({
        where: {
          status: { in: ["requested", "searching_driver"] },
          driverId: null,
          isDemo: false,
        },
        include: {
          customer: {
            include: {
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      
      for (const delivery of pendingDeliveries) {
        const distanceToPickup = (delivery.pickupLat && delivery.pickupLng && driverLat && driverLng)
          ? calculateDistance(driverLat, driverLng, delivery.pickupLat, delivery.pickupLng)
          : null;
        
        pendingRequests.push({
          id: delivery.id,
          serviceType: "PARCEL",
          customerName: delivery.customer?.user?.email?.split("@")[0] || "Customer",
          customerRating: null,
          pickupAddress: delivery.pickupAddress,
          pickupLat: delivery.pickupLat,
          pickupLng: delivery.pickupLng,
          dropoffAddress: delivery.dropoffAddress,
          dropoffLat: delivery.dropoffLat,
          dropoffLng: delivery.dropoffLng,
          estimatedFare: serializeDecimal(delivery.serviceFare),
          distanceToPickup,
          etaMinutes: distanceToPickup ? calculateEtaFromDistance(distanceToPickup) : null,
          surgeMultiplier: null,
          boostAmount: null,
          requestedAt: delivery.createdAt,
          expiresAt: new Date(delivery.createdAt.getTime() + 30000),
        });
      }
      
      const readyFoodOrders = await prisma.foodOrder.findMany({
        where: {
          status: "ready_for_pickup",
          driverId: null,
        },
        include: {
          customer: {
            include: {
              user: { select: { email: true } },
            },
          },
          restaurant: { select: { businessName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      
      for (const order of readyFoodOrders) {
        pendingRequests.push({
          id: order.id,
          serviceType: "FOOD",
          customerName: order.customer?.user?.email?.split("@")[0] || "Customer",
          customerRating: null,
          pickupAddress: order.restaurant?.businessName || "Restaurant",
          pickupLat: null,
          pickupLng: null,
          dropoffAddress: order.deliveryAddress,
          dropoffLat: null,
          dropoffLng: null,
          estimatedFare: serializeDecimal(order.deliveryFee || 0),
          distanceToPickup: null,
          etaMinutes: null,
          surgeMultiplier: null,
          boostAmount: null,
          requestedAt: order.createdAt,
          expiresAt: new Date(order.createdAt.getTime() + 60000),
        });
      }
      
      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "TRIP_REQUESTS_VIEWED",
        entityType: "driver",
        entityId: driverProfile.id,
        description: `Driver viewed ${pendingRequests.length} pending requests`,
        metadata: {
          requestCount: pendingRequests.length,
          timestamp: new Date().toISOString(),
          ip: req.ip,
        },
      });
      
      res.json({ requests: pendingRequests });
    } catch (error: any) {
      console.error("Error fetching pending requests:", error);
      res.status(500).json({ error: "Failed to fetch pending requests" });
    }
  }
);

// Step 48: Get single ride request details for driver
router.get(
  "/requests/:requestId",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: { 
          user: { select: { countryCode: true } },
        },
      });
      
      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      
      if (!driverProfile.isVerified) {
        return res.status(403).json({ error: "Driver must be verified" });
      }
      
      // Try to find the ride
      const ride = await prisma.ride.findUnique({
        where: { id: requestId },
        include: {
          customer: {
            include: {
              user: { select: { email: true } },
            },
          },
        },
      });
      
      if (!ride) {
        return res.status(404).json({ error: "Ride request not found" });
      }
      
      if (ride.status !== "requested" && ride.status !== "searching_driver") {
        return res.status(400).json({ error: "Ride no longer available" });
      }
      
      // Get driver wallet for negative balance check
      const wallet = await prisma.driverWallet.findUnique({
        where: { driverId: driverProfile.id },
      });
      
      // Convert negative balance to positive outstanding amount for threshold check
      const rawNegativeBalance = wallet ? serializeDecimal(wallet.negativeBalance) : 0;
      const outstandingBalance = Math.abs(rawNegativeBalance);
      const countryCode = driverProfile.user?.countryCode || 'US';
      
      // Import config for threshold check
      const { shouldBlockCashRides } = await import('../config/driverRideConfig');
      const isCashBlocked = shouldBlockCashRides(outstandingBalance, countryCode);
      const isCashPayment = ride.paymentMethod === 'cash';
      
      // Get customer rating
      const customerReviews = await prisma.review.findMany({
        where: {
          entityId: ride.customerId,
          entityType: 'customer',
        },
        select: { rating: true },
      });
      
      const customerRating = customerReviews.length > 0
        ? customerReviews.reduce((sum, r) => sum + Number(r.rating), 0) / customerReviews.length
        : null;
      
      // Get customer total rides
      const customerRidesCount = await prisma.ride.count({
        where: { customerId: ride.customerId, status: 'completed' },
      });
      
      const requestDetails = {
        id: ride.id,
        serviceType: "RIDE" as const,
        pickupAddress: ride.pickupAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffAddress: ride.dropoffAddress,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng,
        estimatedDistanceKm: ride.estimatedDistanceKm || 0,
        estimatedDurationMinutes: ride.estimatedDurationMinutes || 0,
        totalFare: serializeDecimal(ride.serviceFare),
        driverPayout: serializeDecimal(ride.driverPayout),
        platformCommission: serializeDecimal(ride.safegoCommission),
        paymentMethod: ride.paymentMethod as "cash" | "card" | "wallet",
        rideType: ride.rideType || "Standard",
        customer: {
          firstName: ride.customer?.user?.email?.split("@")[0] || "Customer",
          rating: customerRating,
          phone: null, // Never expose phone until ride is accepted
          totalRides: customerRidesCount,
        },
        safetyNotes: null,
        expiresAt: new Date(ride.createdAt.getTime() + 60000).toISOString(),
        createdAt: ride.createdAt.toISOString(),
        cashBlocked: isCashBlocked && isCashPayment,
        cashBlockReason: isCashBlocked && isCashPayment
          ? `Your outstanding balance exceeds the threshold. Please clear your balance to accept cash rides.`
          : null,
      };
      
      res.json({ request: requestDetails });
    } catch (error: any) {
      console.error("Error fetching request details:", error);
      res.status(500).json({ error: "Failed to fetch request details" });
    }
  }
);

const acceptRequestSchema = z.object({
  serviceType: z.enum(["RIDE", "FOOD", "PARCEL"]),
  driverLat: z.number().optional(),
  driverLng: z.number().optional(),
});

router.post(
  "/requests/:requestId/accept",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    const requestShownAt = new Date();
    
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const validatedData = acceptRequestSchema.parse(req.body);
      const { serviceType, driverLat, driverLng } = validatedData;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: { vehicle: true },
      });
      
      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      
      if (!driverProfile.isVerified) {
        return res.status(403).json({ error: "Driver must be verified" });
      }
      
      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Driver account is suspended" });
      }
      
      const primaryVehicle = await prisma.vehicle.findFirst({
        where: { driverId: driverProfile.id, isPrimary: true, isActive: true },
      });
      
      if (!primaryVehicle || !primaryVehicle.isOnline) {
        return res.status(403).json({ error: "Driver must be online" });
      }
      
      const hasActiveTrip = await prisma.ride.findFirst({
        where: {
          driverId: driverProfile.id,
          status: { in: ["accepted", "arrived", "started", "in_progress"] },
        },
      });
      
      if (hasActiveTrip) {
        return res.status(409).json({ error: "Driver already has an active trip" });
      }
      
      let result;
      const decisionTime = Date.now() - requestShownAt.getTime();
      
      if (serviceType === "RIDE") {
        const ride = await prisma.ride.findUnique({ where: { id: requestId } });
        
        if (!ride) {
          return res.status(404).json({ error: "Ride not found" });
        }
        
        if (ride.status !== "requested" && ride.status !== "searching_driver") {
          return res.status(400).json({ error: "Ride no longer available" });
        }
        
        if (ride.driverId) {
          return res.status(409).json({ error: "Ride already accepted by another driver" });
        }
        
        // Step 48: Enforce cash ride blocking on backend
        if (ride.paymentMethod === 'cash') {
          const wallet = await prisma.driverWallet.findUnique({
            where: { driverId: driverProfile.id },
          });
          // Convert negative balance to positive outstanding amount for threshold check
          const rawNegativeBalance = wallet ? parseFloat(wallet.negativeBalance.toString()) : 0;
          const outstandingBalance = Math.abs(rawNegativeBalance);
          
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { countryCode: true },
          });
          const countryCode = user?.countryCode || 'US';
          
          const { shouldBlockCashRides } = await import('../config/driverRideConfig');
          if (shouldBlockCashRides(outstandingBalance, countryCode)) {
            return res.status(403).json({ 
              error: "Cash rides blocked",
              reason: "Your outstanding balance exceeds the threshold. Please clear your balance to accept cash rides.",
              cashBlocked: true
            });
          }
        }
        
        result = await prisma.ride.update({
          where: { id: requestId },
          data: {
            driverId: driverProfile.id,
            status: "accepted",
          },
        });
        
        const customerUser = await prisma.user.findFirst({
          where: { customerProfile: { id: ride.customerId } },
        });
        
        if (customerUser) {
          await prisma.notification.create({
            data: {
              userId: customerUser.id,
              type: "ride_update",
              title: "Driver Found!",
              body: "Your ride has been accepted. Driver is on the way.",
            },
          });
        }
      } else if (serviceType === "PARCEL") {
        const delivery = await prisma.delivery.findUnique({ where: { id: requestId } });
        
        if (!delivery) {
          return res.status(404).json({ error: "Delivery not found" });
        }
        
        if (delivery.status !== "requested" && delivery.status !== "searching_driver") {
          return res.status(400).json({ error: "Delivery no longer available" });
        }
        
        if (delivery.driverId) {
          return res.status(409).json({ error: "Delivery already accepted by another driver" });
        }
        
        result = await prisma.delivery.update({
          where: { id: requestId },
          data: {
            driverId: driverProfile.id,
            status: "accepted",
          },
        });
        
        const customerUser = await prisma.user.findFirst({
          where: { customerProfile: { id: delivery.customerId } },
        });
        
        if (customerUser) {
          await prisma.notification.create({
            data: {
              userId: customerUser.id,
              type: "delivery_update",
              title: "Driver Found!",
              body: "Your parcel delivery has been accepted.",
            },
          });
        }
      } else if (serviceType === "FOOD") {
        const foodOrder = await prisma.foodOrder.findUnique({ where: { id: requestId } });
        
        if (!foodOrder) {
          return res.status(404).json({ error: "Food order not found" });
        }
        
        if (foodOrder.status !== "ready_for_pickup") {
          return res.status(400).json({ error: "Order not ready for pickup" });
        }
        
        if (foodOrder.driverId) {
          return res.status(409).json({ error: "Order already accepted by another driver" });
        }
        
        result = await prisma.foodOrder.update({
          where: { id: requestId },
          data: {
            driverId: driverProfile.id,
            status: "picked_up",
          },
        });
        
        const customerUser = await prisma.user.findFirst({
          where: { customerProfile: { id: foodOrder.customerId } },
        });
        
        if (customerUser) {
          await prisma.notification.create({
            data: {
              id: crypto.randomUUID(),
              userId: customerUser.id,
              type: "food_order_update",
              title: "Driver Assigned",
              body: "Your order has been picked up and is on the way!",
            },
          });
        }
      } else {
        return res.status(400).json({ error: "Invalid service type" });
      }
      
      if (driverLat !== undefined && driverLng !== undefined) {
        await prisma.driverProfile.update({
          where: { id: driverProfile.id },
          data: { currentLat: driverLat, currentLng: driverLng },
        });
      }
      
      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "TRIP_REQUEST_ACCEPTED",
        entityType: serviceType.toLowerCase(),
        entityId: requestId,
        description: `Driver accepted ${serviceType} request`,
        metadata: {
          serviceType,
          requestShownAt: requestShownAt.toISOString(),
          actionTaken: "accept",
          decisionTimeMs: decisionTime,
          driverLat,
          driverLng,
          ip: req.ip,
        },
      });
      
      res.json({
        success: true,
        message: `${serviceType} request accepted successfully`,
        tripId: requestId,
        serviceType,
      });
    } catch (error: any) {
      console.error("Error accepting request:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to accept request" });
    }
  }
);

const declineRequestSchema = z.object({
  serviceType: z.enum(["RIDE", "FOOD", "PARCEL"]),
  reason: z.string().optional(),
  autoDeclined: z.boolean().optional(),
});

router.post(
  "/requests/:requestId/decline",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    const requestShownAt = new Date();
    
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const validatedData = declineRequestSchema.parse(req.body);
      const { serviceType, reason, autoDeclined } = validatedData;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      });
      
      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      
      const decisionTime = Date.now() - requestShownAt.getTime();
      
      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "TRIP_REQUEST_DECLINED",
        entityType: serviceType.toLowerCase(),
        entityId: requestId,
        description: `Driver ${autoDeclined ? "auto-" : ""}declined ${serviceType} request`,
        metadata: {
          serviceType,
          requestShownAt: requestShownAt.toISOString(),
          actionTaken: autoDeclined ? "auto_decline" : "decline",
          decisionTimeMs: decisionTime,
          reason: reason || (autoDeclined ? "timeout" : "not_specified"),
          ip: req.ip,
        },
      });
      
      res.json({
        success: true,
        message: `${serviceType} request declined`,
      });
    } catch (error: any) {
      console.error("Error declining request:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to decline request" });
    }
  }
);

router.get(
  "/driver-status",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          isVerified: true,
          isSuspended: true,
          availabilityStatus: true,
          currentLat: true,
          currentLng: true,
        },
      });
      
      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      
      const primaryVehicle = await prisma.vehicle.findFirst({
        where: { driverId: driverProfile.id, isPrimary: true, isActive: true },
        select: { isOnline: true },
      });
      
      const hasActiveTrip = await prisma.ride.findFirst({
        where: {
          driverId: driverProfile.id,
          status: { in: ["accepted", "arrived", "started", "in_progress"] },
        },
        select: { id: true, status: true },
      });
      
      res.json({
        isOnline: primaryVehicle?.isOnline || false,
        isVerified: driverProfile.isVerified,
        isSuspended: driverProfile.isSuspended,
        availabilityStatus: driverProfile.availabilityStatus,
        hasActiveTrip: !!hasActiveTrip,
        activeTripId: hasActiveTrip?.id || null,
        currentLat: driverProfile.currentLat,
        currentLng: driverProfile.currentLng,
      });
    } catch (error: any) {
      console.error("Error fetching driver status:", error);
      res.status(500).json({ error: "Failed to fetch driver status" });
    }
  }
);

router.post(
  "/driver-status",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { isOnline } = req.body;
      
      if (typeof isOnline !== "boolean") {
        return res.status(400).json({ error: "isOnline must be a boolean" });
      }
      
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      });
      
      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      
      if (!driverProfile.isVerified) {
        return res.status(403).json({ error: "Driver must be verified to go online" });
      }
      
      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Driver account is suspended" });
      }
      
      const primaryVehicle = await prisma.vehicle.findFirst({
        where: { driverId: driverProfile.id, isPrimary: true, isActive: true },
      });
      
      if (!primaryVehicle) {
        return res.status(400).json({ error: "No primary vehicle found" });
      }
      
      await prisma.vehicle.update({
        where: { id: primaryVehicle.id },
        data: { isOnline },
      });
      
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          availabilityStatus: isOnline ? "available" : "offline",
        },
      });
      
      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: isOnline ? "DRIVER_WENT_ONLINE" : "DRIVER_WENT_OFFLINE",
        entityType: "driver",
        entityId: driverProfile.id,
        description: `Driver ${isOnline ? "went online" : "went offline"}`,
        metadata: {
          previousStatus: primaryVehicle.isOnline ? "online" : "offline",
          newStatus: isOnline ? "online" : "offline",
          timestamp: new Date().toISOString(),
          ip: req.ip,
        },
      });
      
      res.json({
        success: true,
        isOnline,
        message: `Driver is now ${isOnline ? "online" : "offline"}`,
      });
    } catch (error: any) {
      console.error("Error updating driver status:", error);
      res.status(500).json({ error: "Failed to update driver status" });
    }
  }
);

// ============================================
// DRIVER EARNINGS BREAKDOWN ENDPOINT
// Returns detailed, transparent fare breakdown for drivers
// ============================================

import type { 
  DriverTripEarningsView, 
  RegulatoryBreakdown 
} from "../../shared/driverEarningsTypes";

router.get(
  "/:tripId/earnings",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { tripId } = req.params;
      const { serviceType } = req.query;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { 
          id: true, 
          isVerified: true, 
          verificationStatus: true, 
          isSuspended: true 
        },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      const driverId = driverProfile.id;

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const isKycApproved = driverProfile.isVerified && 
        driverProfile.verificationStatus === "approved";

      if (!isKycApproved) {
        return res.status(403).json({ 
          error: "Complete verification to view earnings breakdown",
          kycRequired: true,
          kycStatus: driverProfile.verificationStatus,
        });
      }

      let earningsView: DriverTripEarningsView | null = null;

      if (!serviceType || serviceType === "RIDE") {
        const ride = await prisma.ride.findFirst({
          where: { id: tripId, driverId, isDemo: false },
          include: {
            receipt: true,
            customer: {
              select: { firstName: true },
            },
          },
        });

        if (ride) {
          const receipt = ride.receipt;
          const fareBreakdown = receipt?.fareBreakdown as any;

          const regulatoryBreakdown: RegulatoryBreakdown = {};
          let regulatoryTotal = 0;

          if (fareBreakdown?.regulatoryFeesBreakdown) {
            for (const fee of fareBreakdown.regulatoryFeesBreakdown) {
              const amount = Number(fee.amount) || 0;
              regulatoryTotal += amount;
              
              const feeType = (fee.id || fee.name || "").toLowerCase();
              if (feeType.includes("congestion")) {
                regulatoryBreakdown.congestion = (regulatoryBreakdown.congestion || 0) + amount;
              } else if (feeType.includes("airport")) {
                regulatoryBreakdown.airportFee = (regulatoryBreakdown.airportFee || 0) + amount;
              } else if (feeType.includes("state") && feeType.includes("surcharge")) {
                regulatoryBreakdown.stateSurcharge = (regulatoryBreakdown.stateSurcharge || 0) + amount;
              } else if (feeType.includes("hvf") || feeType.includes("high volume")) {
                regulatoryBreakdown.hvfSurcharge = (regulatoryBreakdown.hvfSurcharge || 0) + amount;
              } else if (feeType.includes("black car fund") || feeType.includes("bcf")) {
                regulatoryBreakdown.blackCarFund = (regulatoryBreakdown.blackCarFund || 0) + amount;
              } else if (feeType.includes("long trip") || feeType.includes("long_trip")) {
                regulatoryBreakdown.longTripFee = (regulatoryBreakdown.longTripFee || 0) + amount;
              } else if (feeType.includes("out of town") || feeType.includes("out_of_town")) {
                regulatoryBreakdown.outOfTownFee = (regulatoryBreakdown.outOfTownFee || 0) + amount;
              } else if (feeType.includes("cross borough") || feeType.includes("cross_borough")) {
                regulatoryBreakdown.crossBoroughFee = (regulatoryBreakdown.crossBoroughFee || 0) + amount;
              } else if (feeType.includes("accessible") || feeType.includes("wav")) {
                regulatoryBreakdown.accessibleVehicleFee = (regulatoryBreakdown.accessibleVehicleFee || 0) + amount;
              } else {
                regulatoryBreakdown.other = (regulatoryBreakdown.other || 0) + amount;
              }
            }
          }

          if (fareBreakdown?.tollsBreakdown || fareBreakdown?.tollsTotal) {
            const tollsAmount = Number(fareBreakdown.tollsTotal) || 
              (fareBreakdown.tollsBreakdown?.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || 0);
            regulatoryBreakdown.tolls = tollsAmount;
            regulatoryTotal += tollsAmount;
          }

          const riderPaidTotal = receipt ? 
            serializeDecimal(receipt.totalFare) : 
            serializeDecimal(ride.serviceFare);

          const baseFare = receipt ? 
            serializeDecimal(receipt.baseFare) : 
            (fareBreakdown?.baseFare || 0);
          
          const distanceFare = receipt ? 
            serializeDecimal(receipt.distanceFare) : 
            (fareBreakdown?.distanceFare || 0);
          
          const timeFare = receipt ? 
            serializeDecimal(receipt.timeFare) : 
            (fareBreakdown?.timeFare || 0);

          const surgeAmount = receipt?.surgeFare ? 
            serializeDecimal(receipt.surgeFare) : 
            (fareBreakdown?.surgeAmount || 0);

          const bookingFee = fareBreakdown?.serviceFee || 0;
          const otherServiceFees = fareBreakdown?.additionalFeesTotal || 0;
          
          const tipAmount = receipt?.tipAmount ? 
            serializeDecimal(receipt.tipAmount) : 0;
          const tollsAmount = receipt?.tollsFare ? 
            serializeDecimal(receipt.tollsFare) : 
            (fareBreakdown?.tollsTotal || 0);

          const promoDiscountAmount = receipt?.discountAmount ? 
            serializeDecimal(receipt.discountAmount) : 
            serializeDecimal(ride.discountAmount || 0);

          const platformCommission = serializeDecimal(ride.safegoCommission);
          const driverEarnings = serializeDecimal(ride.driverPayout);

          const subtotal = baseFare + distanceFare + timeFare + surgeAmount + bookingFee + otherServiceFees;
          const commissionPercent = subtotal > 0 ? 
            Math.round((platformCommission / subtotal) * 100) : 15;

          const categoryCode = fareBreakdown?.vehicleCategoryId || "SAFEGO_X";
          const categoryLabel = fareBreakdown?.vehicleCategoryDisplayName || 
            categoryCode.replace("SAFEGO_", "SafeGo ").replace(/_/g, " ");

          earningsView = {
            tripId: ride.id,
            tripCode: generateTripCode("RIDE", ride.id),
            city: ride.cityCode || "Unknown",
            borough: fareBreakdown?.pickupBorough || undefined,
            serviceType: "RIDE",
            categoryCode,
            categoryLabel,

            riderPaidTotal,
            riderCurrency: receipt?.currency || "USD",

            baseFare,
            distanceFare,
            timeFare,
            surgeAmount,
            bookingFee,
            otherServiceFees,
            tipAmount,
            tollsAmount,
            deliveryFee: 0,

            hasRegulatoryFees: regulatoryTotal > 0,
            regulatoryFeesTotal: regulatoryTotal,
            regulatoryBreakdown,

            promoCode: fareBreakdown?.promoCode || null,
            promoLabel: fareBreakdown?.promoCode ? 
              `Rider discount applied` : null,
            promoDiscountAmount,

            platformCommissionAmount: platformCommission,
            platformCommissionPercent: commissionPercent,
            driverIncentivesAmount: 0,

            driverEarningsNet: driverEarnings,
            payoutCurrency: receipt?.currency || "USD",

            tripDistance: ride.distanceMiles || receipt?.distanceMiles || 0,
            tripDistanceUnit: "miles",
            tripDurationMinutes: ride.durationMinutes || receipt?.durationMinutes || 0,
            tripStartTime: ride.tripStartedAt?.toISOString() || ride.createdAt.toISOString(),
            tripEndTime: ride.completedAt?.toISOString() || null,

            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
            customerFirstName: ride.customer?.firstName || undefined,
            customerRating: ride.customerRating || undefined,
          };
        }
      }

      if (!earningsView && (!serviceType || serviceType === "FOOD")) {
        const foodOrder = await prisma.foodOrder.findFirst({
          where: { id: tripId, driverId, isDemo: false },
          include: {
            restaurant: { select: { restaurantName: true } },
            customer: { select: { firstName: true } },
          },
        });

        if (foodOrder) {
          const baseFare = serializeDecimal(foodOrder.serviceFare);
          const deliveryFee = foodOrder.deliveryFee ? 
            serializeDecimal(foodOrder.deliveryFee) : 0;
          const platformCommission = serializeDecimal(foodOrder.safegoCommission);
          const driverEarnings = serializeDecimal(foodOrder.driverPayout);
          const discountAmount = foodOrder.discountAmount ? 
            serializeDecimal(foodOrder.discountAmount) : 0;

          const subtotal = baseFare + deliveryFee;
          const commissionPercent = subtotal > 0 ? 
            Math.round((platformCommission / subtotal) * 100) : 15;

          earningsView = {
            tripId: foodOrder.id,
            tripCode: foodOrder.orderCode || generateTripCode("FOOD", foodOrder.id),
            city: foodOrder.cityCode || "Unknown",
            serviceType: "FOOD",
            categoryCode: "FOOD_DELIVERY",
            categoryLabel: "Food Delivery",

            riderPaidTotal: baseFare + deliveryFee - discountAmount,
            riderCurrency: foodOrder.currency || "USD",

            baseFare,
            distanceFare: 0,
            timeFare: 0,
            surgeAmount: 0,
            bookingFee: 0,
            otherServiceFees: 0,
            tipAmount: 0,
            tollsAmount: 0,
            deliveryFee,

            hasRegulatoryFees: false,
            regulatoryFeesTotal: 0,
            regulatoryBreakdown: {},

            promoCode: null,
            promoLabel: null,
            promoDiscountAmount: discountAmount,

            platformCommissionAmount: platformCommission,
            platformCommissionPercent: commissionPercent,
            driverIncentivesAmount: 0,

            driverEarningsNet: driverEarnings,
            payoutCurrency: foodOrder.currency || "USD",

            tripDistance: foodOrder.distanceMiles || 0,
            tripDistanceUnit: "miles",
            tripDurationMinutes: foodOrder.deliveryMinutes || 0,
            tripStartTime: foodOrder.createdAt.toISOString(),
            tripEndTime: (foodOrder.deliveredAt || foodOrder.completedAt)?.toISOString() || null,

            pickupAddress: foodOrder.pickupAddress || foodOrder.restaurant.restaurantName,
            dropoffAddress: foodOrder.deliveryAddress,
            customerFirstName: foodOrder.customer?.firstName || undefined,
            customerRating: foodOrder.customerRating || undefined,
          };
        }
      }

      if (!earningsView && (!serviceType || serviceType === "PARCEL")) {
        const delivery = await prisma.delivery.findFirst({
          where: { id: tripId, driverId, isDemo: false },
          include: {
            customer: { select: { firstName: true } },
          },
        });

        if (delivery) {
          const baseFare = serializeDecimal(delivery.serviceFare);
          const platformCommission = serializeDecimal(delivery.safegoCommission);
          const driverEarnings = serializeDecimal(delivery.driverPayout);

          const commissionPercent = baseFare > 0 ? 
            Math.round((platformCommission / baseFare) * 100) : 15;

          earningsView = {
            tripId: delivery.id,
            tripCode: generateTripCode("PARCEL", delivery.id),
            city: delivery.cityCode || "Unknown",
            serviceType: "PARCEL",
            categoryCode: "PARCEL_DELIVERY",
            categoryLabel: "Parcel Delivery",

            riderPaidTotal: baseFare,
            riderCurrency: delivery.currency || "USD",

            baseFare,
            distanceFare: 0,
            timeFare: 0,
            surgeAmount: 0,
            bookingFee: 0,
            otherServiceFees: 0,
            tipAmount: 0,
            tollsAmount: 0,
            deliveryFee: 0,

            hasRegulatoryFees: false,
            regulatoryFeesTotal: 0,
            regulatoryBreakdown: {},

            promoCode: null,
            promoLabel: null,
            promoDiscountAmount: 0,

            platformCommissionAmount: platformCommission,
            platformCommissionPercent: commissionPercent,
            driverIncentivesAmount: 0,

            driverEarningsNet: driverEarnings,
            payoutCurrency: delivery.currency || "USD",

            tripDistance: delivery.distanceMiles || 0,
            tripDistanceUnit: "miles",
            tripDurationMinutes: delivery.deliveryMinutes || 0,
            tripStartTime: delivery.createdAt.toISOString(),
            tripEndTime: delivery.deliveredAt?.toISOString() || null,

            pickupAddress: delivery.pickupAddress,
            dropoffAddress: delivery.dropoffAddress,
            customerFirstName: delivery.customer?.firstName || undefined,
            customerRating: delivery.customerRating || undefined,
          };
        }
      }

      if (!earningsView) {
        return res.status(404).json({ error: "Trip not found" });
      }

      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_EARNINGS_BREAKDOWN",
        entityType: "trip_earnings",
        entityId: tripId,
        description: `Driver viewed earnings breakdown for ${earningsView.tripCode}`,
        metadata: {
          serviceType: earningsView.serviceType,
          tripCode: earningsView.tripCode,
          driverEarnings: earningsView.driverEarningsNet,
        },
      });

      res.json({
        earnings: earningsView,
        kycStatus: driverProfile.verificationStatus,
        kycApproved: true,
      });
    } catch (error: any) {
      console.error("Error fetching earnings breakdown:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
