import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

type DriverAssignmentStatus = "none" | "searching_driver" | "driver_assigned" | "driver_rejected" | "no_driver_found";
type DeliveryServiceType = "ride" | "food" | "parcel";

export interface DispatchConfig {
  enableFoodDeliveryDemo: boolean;
  driverSearchRadiusKm: number;
  driverSearchTimeoutSeconds: number;
  driverAutoAdvanceDemo: boolean;
  demoAutoAdvanceDelayMs: number;
}

export interface DriverInfo {
  id: string;
  userId: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  rating: number;
  countryCode: string | null;
  phoneNumber: string | null;
}

export interface DispatchResult {
  success: boolean;
  deliveryId?: string;
  driverId?: string;
  driverInfo?: DriverInfo;
  driverAssignmentStatus: DriverAssignmentStatus;
  eta?: number;
  error?: string;
}

const DEFAULT_CONFIG: DispatchConfig = {
  enableFoodDeliveryDemo: true,
  driverSearchRadiusKm: 5,
  driverSearchTimeoutSeconds: 120,
  driverAutoAdvanceDemo: true,
  demoAutoAdvanceDelayMs: 30000,
};

const DEMO_DRIVERS: Array<{
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  rating: number;
}> = [
  { id: "demo-driver-bd-1", name: "Rahim Khan", country: "BD", lat: 23.8103, lng: 90.4125, rating: 4.8 },
  { id: "demo-driver-bd-2", name: "Karim Ahmed", country: "BD", lat: 23.7808, lng: 90.4193, rating: 4.9 },
  { id: "demo-driver-us-1", name: "John Smith", country: "US", lat: 40.7128, lng: -74.0060, rating: 4.7 },
  { id: "demo-driver-us-2", name: "Mike Johnson", country: "US", lat: 40.7589, lng: -73.9851, rating: 4.6 },
];

export async function getDispatchConfig(): Promise<DispatchConfig> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      where: { key: "food_delivery_dispatch" },
    });
    if (settings?.valueJson && typeof settings.valueJson === 'object') {
      const config = settings.valueJson as Record<string, any>;
      return {
        enableFoodDeliveryDemo: config.enableFoodDeliveryDemo ?? DEFAULT_CONFIG.enableFoodDeliveryDemo,
        driverSearchRadiusKm: config.driverSearchRadiusKm ?? DEFAULT_CONFIG.driverSearchRadiusKm,
        driverSearchTimeoutSeconds: config.driverSearchTimeoutSeconds ?? DEFAULT_CONFIG.driverSearchTimeoutSeconds,
        driverAutoAdvanceDemo: config.driverAutoAdvanceDemo ?? DEFAULT_CONFIG.driverAutoAdvanceDemo,
        demoAutoAdvanceDelayMs: config.demoAutoAdvanceDelayMs ?? DEFAULT_CONFIG.demoAutoAdvanceDelayMs,
      };
    }
  } catch (error) {
    console.log("[FoodDeliveryDispatch] Using default config");
  }
  return DEFAULT_CONFIG;
}

export async function findAvailableDrivers(
  restaurantLat: number,
  restaurantLng: number,
  radiusKm: number,
  countryCode?: string
): Promise<DriverInfo[]> {
  const drivers = await prisma.driverProfile.findMany({
    where: {
      isVerified: true,
      isSuspended: false,
      user: {
        isBlocked: false,
        countryCode: countryCode || undefined,
      },
    },
    include: {
      user: true,
      driverStats: true,
    },
    take: 20,
  });

  return drivers.map((d) => ({
    id: d.id,
    userId: d.userId,
    fullName: d.fullName || `${d.firstName || ""} ${d.lastName || ""}`.trim() || null,
    profilePhotoUrl: d.profilePhotoUrl,
    rating: d.driverStats ? parseFloat(d.driverStats.ratingsSum.toString()) / Math.max(d.driverStats.totalRatingsReceived, 1) : 4.5,
    countryCode: d.user.countryCode,
    phoneNumber: d.phoneNumber,
  }));
}

function getDemoDriver(countryCode?: string): DriverInfo {
  const country = countryCode || "US";
  const countryDrivers = DEMO_DRIVERS.filter((d) => d.country === country);
  const driver = countryDrivers.length > 0 
    ? countryDrivers[Math.floor(Math.random() * countryDrivers.length)]
    : DEMO_DRIVERS[0];
  
  return {
    id: driver.id,
    userId: `demo-user-${driver.id}`,
    fullName: driver.name,
    profilePhotoUrl: null,
    rating: driver.rating,
    countryCode: driver.country,
    phoneNumber: driver.country === "BD" ? "+8801700000000" : "+12125551234",
  };
}

export async function dispatchFoodDelivery(
  foodOrderId: string,
  options?: { forceDemo?: boolean }
): Promise<DispatchResult> {
  const config = await getDispatchConfig();
  
  const foodOrder = await prisma.foodOrder.findUnique({
    where: { id: foodOrderId },
    include: {
      restaurant: true,
      customer: true,
    },
  });

  if (!foodOrder) {
    return {
      success: false,
      driverAssignmentStatus: "none",
      error: "Food order not found",
    };
  }

  if (foodOrder.status !== "ready_for_pickup") {
    return {
      success: false,
      driverAssignmentStatus: "none",
      error: `Order must be in ready_for_pickup status, current: ${foodOrder.status}`,
    };
  }

  const existingDeliveryId = (foodOrder as any).deliveryId;
  if (existingDeliveryId) {
    const existingDelivery = await prisma.delivery.findFirst({ where: { id: existingDeliveryId } });
    if (existingDelivery) {
      return {
        success: true,
        deliveryId: existingDelivery.id,
        driverId: existingDelivery.driverId || undefined,
        driverAssignmentStatus: (foodOrder as any).driverAssignmentStatus || "none",
        error: "Delivery already dispatched",
      };
    }
  }

  const deliveryId = randomUUID();
  const restaurantCountry = foodOrder.restaurant.countryCode || "US";
  
  const restaurantLat = foodOrder.pickupLat || foodOrder.restaurant.latitude || null;
  const restaurantLng = foodOrder.pickupLng || foodOrder.restaurant.longitude || null;

  let selectedDriver: DriverInfo | null = null;
  let driverAssignmentStatus: DriverAssignmentStatus = "searching_driver";
  let isDemo = foodOrder.isDemo || options?.forceDemo || config.enableFoodDeliveryDemo;

  if (isDemo) {
    selectedDriver = getDemoDriver(restaurantCountry);
    driverAssignmentStatus = "driver_assigned";
    console.log(`[FoodDeliveryDispatch] Demo mode: Assigned driver ${selectedDriver.fullName} to order ${foodOrderId}`);
  } else if (restaurantLat !== null && restaurantLng !== null) {
    const availableDrivers = await findAvailableDrivers(
      restaurantLat,
      restaurantLng,
      config.driverSearchRadiusKm,
      restaurantCountry
    );

    if (availableDrivers.length > 0) {
      selectedDriver = availableDrivers[0];
      driverAssignmentStatus = "driver_assigned";
    } else {
      console.log(`[FoodDeliveryDispatch] No drivers found for order ${foodOrderId}, entering search mode`);
    }
  } else {
    console.log(`[FoodDeliveryDispatch] No coordinates for order ${foodOrderId}, entering search mode`);
  }

  const driverPayout = parseFloat(foodOrder.driverPayout?.toString() || "0");
  const safegoCommission = parseFloat(foodOrder.safegoCommission.toString());
  const serviceFare = parseFloat(foodOrder.serviceFare.toString());

  try {
    await prisma.$transaction(async (tx) => {
      await tx.delivery.create({
        data: {
          id: deliveryId,
          customerId: foodOrder.customerId,
          driverId: selectedDriver?.id || null,
          pickupAddress: foodOrder.pickupAddress || foodOrder.restaurant.address,
          pickupLat: restaurantLat,
          pickupLng: restaurantLng,
          dropoffAddress: foodOrder.deliveryAddress,
          dropoffLat: foodOrder.deliveryLat,
          dropoffLng: foodOrder.deliveryLng,
          serviceFare: serviceFare,
          safegoCommission: safegoCommission,
          driverPayout: driverPayout,
          paymentMethod: foodOrder.paymentMethod,
          status: selectedDriver ? "accepted" : "searching_driver",
          serviceType: "food",
          countryCode: restaurantCountry,
          restaurantId: foodOrder.restaurantId,
          isDemo: isDemo,
          acceptedAt: selectedDriver ? new Date() : null,
          driverEtaMinutes: selectedDriver ? 15 : null,
          updatedAt: new Date(),
        },
      });

      await tx.foodOrder.update({
        where: { id: foodOrderId },
        data: {
          deliveryId: deliveryId,
          driverId: selectedDriver?.id || null,
          driverAssignmentStatus: driverAssignmentStatus,
          driverEtaMinutes: selectedDriver ? 15 : null,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: "system",
          actorEmail: "system@safego.app",
          actorRole: "system",
          actionType: "food_delivery_dispatch",
          entityType: "food_order",
          entityId: foodOrderId,
          description: `Dispatched food delivery for order ${foodOrderId}`,
          metadata: {
            deliveryId,
            driverId: selectedDriver?.id || null,
            driverAssignmentStatus,
            isDemo,
            restaurantId: foodOrder.restaurantId,
          },
          success: true,
        },
      });
    });

    if (isDemo && config.driverAutoAdvanceDemo && selectedDriver) {
      await prisma.platformSettings.upsert({
        where: { key: `demo_advance_${foodOrderId}` },
        update: {
          valueJson: {
            orderId: foodOrderId,
            deliveryId,
            status: "accepted",
            lastUpdated: new Date().toISOString(),
            nextAdvance: new Date(Date.now() + config.demoAutoAdvanceDelayMs).toISOString(),
          },
          updatedAt: new Date(),
        },
        create: {
          key: `demo_advance_${foodOrderId}`,
          valueJson: {
            orderId: foodOrderId,
            deliveryId,
            status: "accepted",
            lastUpdated: new Date().toISOString(),
            nextAdvance: new Date(Date.now() + config.demoAutoAdvanceDelayMs).toISOString(),
          },
        },
      });
      
      scheduleAutoAdvance(foodOrderId, deliveryId, config.demoAutoAdvanceDelayMs);
    }

    return {
      success: true,
      deliveryId,
      driverId: selectedDriver?.id,
      driverInfo: selectedDriver || undefined,
      driverAssignmentStatus,
      eta: selectedDriver ? 15 : undefined,
    };
  } catch (error) {
    console.error("[FoodDeliveryDispatch] Error:", error);
    return {
      success: false,
      driverAssignmentStatus: "none",
      error: error instanceof Error ? error.message : "Failed to dispatch delivery",
    };
  }
}

function scheduleAutoAdvance(foodOrderId: string, deliveryId: string, delayMs: number) {
  const statuses = [
    { foodStatus: "picked_up", deliveryStatus: "picked_up", delay: 1 },
    { foodStatus: "on_the_way", deliveryStatus: "on_the_way", delay: 2 },
    { foodStatus: "delivered", deliveryStatus: "delivered", delay: 3 },
  ];

  statuses.forEach(({ foodStatus, deliveryStatus, delay }) => {
    setTimeout(async () => {
      try {
        const order = await prisma.foodOrder.findUnique({ where: { id: foodOrderId } });
        if (!order || order.status === "delivered" || order.status.startsWith("cancelled")) {
          return;
        }

        const expectedPreviousStatus = delay === 1 ? "ready_for_pickup" 
          : delay === 2 ? "picked_up" 
          : "on_the_way";
          
        if (order.status !== expectedPreviousStatus) {
          console.log(`[FoodDeliveryDispatch] Skipping auto-advance for ${foodOrderId}: status is ${order.status}, expected ${expectedPreviousStatus}`);
          return;
        }

        await prisma.$transaction(async (tx) => {
          const now = new Date();
          const updateData: Prisma.FoodOrderUpdateInput = { status: foodStatus, updatedAt: now };
          
          if (foodStatus === "picked_up") (updateData as any).pickedUpAt = now;
          if (foodStatus === "delivered") {
            (updateData as any).deliveredAt = now;
            (updateData as any).completedAt = now;
          }

          await tx.foodOrder.update({
            where: { id: foodOrderId },
            data: updateData,
          });

          const deliveryUpdate: Prisma.DeliveryUpdateInput = { status: deliveryStatus, updatedAt: now };
          if (deliveryStatus === "picked_up") (deliveryUpdate as any).pickedUpAt = now;
          if (deliveryStatus === "delivered") (deliveryUpdate as any).deliveredAt = now;

          await tx.delivery.update({
            where: { id: deliveryId },
            data: deliveryUpdate,
          });

          await tx.platformSettings.upsert({
            where: { key: `demo_advance_${foodOrderId}` },
            update: {
              valueJson: {
                orderId: foodOrderId,
                deliveryId,
                status: foodStatus,
                lastUpdated: now.toISOString(),
                completed: foodStatus === "delivered",
              },
              updatedAt: now,
            },
            create: {
              key: `demo_advance_${foodOrderId}`,
              valueJson: {
                orderId: foodOrderId,
                deliveryId,
                status: foodStatus,
                lastUpdated: now.toISOString(),
                completed: foodStatus === "delivered",
              },
            },
          });

          console.log(`[FoodDeliveryDispatch] Auto-advanced order ${foodOrderId} to ${foodStatus} (demo mode)`);
        });
      } catch (error) {
        console.error(`[FoodDeliveryDispatch] Auto-advance failed for ${foodOrderId}:`, error);
      }
    }, delayMs * delay);
  });
}

export async function handleDriverAccept(
  deliveryId: string,
  driverId: string
): Promise<DispatchResult> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return {
      success: false,
      driverAssignmentStatus: "none",
      error: "Delivery not found",
    };
  }

  if (delivery.driverId && delivery.driverId !== driverId) {
    return {
      success: false,
      driverAssignmentStatus: "driver_assigned",
      error: "Delivery already assigned to another driver",
    };
  }

  if (delivery.status !== "searching_driver" && delivery.status !== "pending") {
    return {
      success: false,
      driverAssignmentStatus: delivery.status === "accepted" ? "driver_assigned" : "none",
      error: `Cannot accept delivery in ${delivery.status} status`,
    };
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    include: { user: true },
  });

  if (!driver || !driver.isVerified || driver.isSuspended || driver.user.isBlocked) {
    return {
      success: false,
      driverAssignmentStatus: "searching_driver",
      error: "Driver not eligible for deliveries",
    };
  }

  const linkedFoodOrder = await prisma.foodOrder.findFirst({
    where: { deliveryId },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const currentDelivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
      });
      
      if (currentDelivery?.driverId && currentDelivery.driverId !== driverId) {
        throw new Error("Delivery already assigned to another driver");
      }
      
      if (currentDelivery?.status !== "searching_driver" && currentDelivery?.status !== "pending") {
        throw new Error(`Cannot accept delivery in ${currentDelivery?.status} status`);
      }

      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          driverId,
          status: "accepted",
          acceptedAt: new Date(),
          driverEtaMinutes: 15,
          updatedAt: new Date(),
        },
      });

      if (linkedFoodOrder) {
        await tx.foodOrder.update({
          where: { id: linkedFoodOrder.id },
          data: {
            driverId,
            driverAssignmentStatus: "driver_assigned",
            driverEtaMinutes: 15,
            updatedAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: driver.userId,
          actorEmail: driver.user.email,
          actorRole: "driver",
          actionType: "food_delivery_accept",
          entityType: "delivery",
          entityId: deliveryId,
          description: `Driver ${driver.fullName || driver.id} accepted delivery ${deliveryId}`,
          metadata: {
            foodOrderId: linkedFoodOrder?.id,
            driverId,
          },
          success: true,
        },
      });
    });

    return {
      success: true,
      deliveryId,
      driverId,
      driverAssignmentStatus: "driver_assigned",
      eta: 15,
    };
  } catch (error) {
    console.error("[FoodDeliveryDispatch] Accept error:", error);
    return {
      success: false,
      driverAssignmentStatus: "searching_driver",
      error: error instanceof Error ? error.message : "Failed to accept delivery",
    };
  }
}

export async function handleDriverReject(
  deliveryId: string,
  driverId: string,
  reason?: string
): Promise<DispatchResult> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return {
      success: false,
      driverAssignmentStatus: "none",
      error: "Delivery not found",
    };
  }

  if (delivery.driverId && delivery.driverId !== driverId) {
    return {
      success: false,
      driverAssignmentStatus: "driver_assigned",
      error: "Cannot reject a delivery assigned to another driver",
    };
  }

  const linkedFoodOrder = await prisma.foodOrder.findFirst({
    where: { deliveryId },
  });

  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: driver?.userId || driverId,
      actorEmail: driver?.user.email || "driver",
      actorRole: "driver",
      actionType: "food_delivery_reject",
      entityType: "delivery",
      entityId: deliveryId,
      description: `Driver ${driverId} rejected delivery ${deliveryId}`,
      metadata: {
        foodOrderId: linkedFoodOrder?.id,
        reason,
      },
      success: true,
    },
  });

  return {
    success: true,
    deliveryId,
    driverAssignmentStatus: "searching_driver",
  };
}

export async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  
  const activeDeliveries = await prisma.delivery.findMany({
    where: {
      driverId,
      status: { in: ["accepted", "picked_up", "on_the_way"] },
    },
  });

  if (activeDeliveries.length === 0) {
    return { success: true };
  }

  try {
    for (const delivery of activeDeliveries) {
      await prisma.$transaction(async (tx) => {
        await tx.delivery.update({
          where: { id: delivery.id },
          data: {
            driverLastLocationLat: lat,
            driverLastLocationLng: lng,
            driverLocationUpdatedAt: now,
            updatedAt: now,
          },
        });

        const linkedFoodOrder = await tx.foodOrder.findFirst({
          where: { deliveryId: delivery.id },
        });

        if (linkedFoodOrder) {
          await tx.foodOrder.update({
            where: { id: linkedFoodOrder.id },
            data: {
              driverLastLocationLat: lat,
              driverLastLocationLng: lng,
              driverLocationUpdatedAt: now,
              updatedAt: now,
            },
          });
        }
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[FoodDeliveryDispatch] Location update error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update location" 
    };
  }
}

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  accepted: ["picked_up"],
  picked_up: ["on_the_way"],
  on_the_way: ["delivered"],
};

export async function updateDeliveryStatus(
  deliveryId: string,
  driverId: string,
  newStatus: "picked_up" | "on_the_way" | "delivered"
): Promise<{ success: boolean; error?: string }> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return { success: false, error: "Delivery not found" };
  }

  if (delivery.driverId !== driverId) {
    return { success: false, error: "Not authorized to update this delivery" };
  }

  if (!VALID_STATUS_TRANSITIONS[delivery.status]?.includes(newStatus)) {
    return { 
      success: false, 
      error: `Invalid transition: cannot move from '${delivery.status}' to '${newStatus}'. Valid next statuses: ${VALID_STATUS_TRANSITIONS[delivery.status]?.join(', ') || 'none'}` 
    };
  }

  const linkedFoodOrder = await prisma.foodOrder.findFirst({
    where: { deliveryId },
  });

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const currentDelivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
      });
      
      if (currentDelivery?.driverId !== driverId) {
        throw new Error("Driver assignment changed during update");
      }
      
      if (!VALID_STATUS_TRANSITIONS[currentDelivery.status]?.includes(newStatus)) {
        throw new Error(`Status already changed to ${currentDelivery.status}`);
      }

      const deliveryUpdate: Prisma.DeliveryUpdateInput = {
        status: newStatus,
        updatedAt: now,
      };
      if (newStatus === "picked_up") (deliveryUpdate as any).pickedUpAt = now;
      if (newStatus === "delivered") (deliveryUpdate as any).deliveredAt = now;

      await tx.delivery.update({
        where: { id: deliveryId },
        data: deliveryUpdate,
      });

      if (linkedFoodOrder) {
        const foodOrderUpdate: Prisma.FoodOrderUpdateInput = {
          status: newStatus,
          updatedAt: now,
        };
        if (newStatus === "picked_up") (foodOrderUpdate as any).pickedUpAt = now;
        if (newStatus === "delivered") {
          (foodOrderUpdate as any).deliveredAt = now;
          (foodOrderUpdate as any).completedAt = now;
        }

        await tx.foodOrder.update({
          where: { id: linkedFoodOrder.id },
          data: foodOrderUpdate,
        });
      }

      const driver = await tx.driverProfile.findUnique({
        where: { id: driverId },
        include: { user: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: driver?.userId || driverId,
          actorEmail: driver?.user.email || "driver",
          actorRole: "driver",
          actionType: `food_delivery_${newStatus}`,
          entityType: "delivery",
          entityId: deliveryId,
          description: `Driver updated delivery ${deliveryId} to ${newStatus}`,
          metadata: {
            foodOrderId: linkedFoodOrder?.id,
            driverId,
            previousStatus: delivery.status,
            newStatus,
          },
          success: true,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("[FoodDeliveryDispatch] Status update error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update status" 
    };
  }
}
