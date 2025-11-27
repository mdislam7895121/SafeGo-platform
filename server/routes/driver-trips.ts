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

const activeStatusValues = ["accepted", "arriving", "arrived", "started", "in_progress", "picked_up"];

const validStatusTransitions: Record<string, string[]> = {
  accepted: ["arriving", "cancelled"],
  arriving: ["arrived", "cancelled"],
  arrived: ["started", "cancelled"],
  started: ["completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  picked_up: ["completed", "cancelled"],
};

const statusUpdateSchema = z.object({
  status: z.enum(["arriving", "arrived", "started", "completed", "cancelled"]),
  driverLat: z.number().optional(),
  driverLng: z.number().optional(),
  reason: z.string().optional(),
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
      const { status: newStatus, driverLat, driverLng, reason } = validatedData;
      
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
          
          updateResult = await prisma.ride.update({
            where: { id: tripId },
            data: {
              status: newStatus,
              ...(newStatus === "completed" && { completedAt: new Date() }),
            },
          });
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

export default router;
