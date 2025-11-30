import { prisma } from "../db";
import { broadcastOrderUpdate, broadcastToUser } from "../websocket/foodOrderNotificationsWs";
import crypto from "crypto";

type FoodOrderStatus = "placed" | "accepted" | "preparing" | "ready_for_pickup" | "driver_assigned" | "driver_arriving" | "picked_up" | "on_the_way" | "delivered" | "cancelled" | "completed";

const NOTIFICATION_MESSAGES: Record<string, { title: string; body: string }> = {
  accepted: {
    title: "Order Accepted",
    body: "Great news! The restaurant has accepted your order and is getting it ready.",
  },
  preparing: {
    title: "Order Being Prepared",
    body: "Your food is now being prepared by the kitchen. We'll notify you when it's ready!",
  },
  ready_for_pickup: {
    title: "Order Ready for Pickup",
    body: "Your order is ready and waiting for a delivery driver. Almost there!",
  },
  driver_assigned: {
    title: "Driver Assigned",
    body: "A driver has been assigned to pick up your order.",
  },
  driver_arriving: {
    title: "Driver Arriving at Restaurant",
    body: "Your driver is on the way to pick up your order.",
  },
  picked_up: {
    title: "Driver Has Your Order",
    body: "Your food has been picked up and is on its way to you!",
  },
  on_the_way: {
    title: "Almost There!",
    body: "Your driver is approaching your delivery location. Get ready!",
  },
  delivered: {
    title: "Order Delivered",
    body: "Your food has been delivered. Enjoy your meal! Don't forget to rate your experience.",
  },
  cancelled: {
    title: "Order Cancelled",
    body: "Your food order has been cancelled. If you didn't request this, please contact support.",
  },
  completed: {
    title: "Order Completed",
    body: "Thank you for your order! We hope you enjoyed your meal.",
  },
};

export interface StatusUpdateResult {
  success: boolean;
  order?: {
    id: string;
    status: string;
  };
  error?: string;
}

export async function updateFoodOrderStatusWithNotifications(
  orderId: string,
  newStatus: FoodOrderStatus,
  options?: {
    skipNotification?: boolean;
    customMessage?: { title: string; body: string };
  }
): Promise<StatusUpdateResult> {
  try {
    const foodOrder = await prisma.foodOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        customerId: true,
        restaurantId: true,
        driverId: true,
      },
    });

    if (!foodOrder) {
      return { success: false, error: "Food order not found" };
    }

    const updatedOrder = await prisma.foodOrder.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    if (options?.skipNotification) {
      return {
        success: true,
        order: { id: updatedOrder.id, status: updatedOrder.status },
      };
    }

    const message = options?.customMessage || NOTIFICATION_MESSAGES[newStatus] || {
      title: "Order Update",
      body: `Your food order status is now: ${newStatus}`,
    };

    const customerUser = await prisma.user.findFirst({
      where: { customerProfile: { id: foodOrder.customerId } },
    });

    if (customerUser) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: customerUser.id,
          type: "food_order_update",
          title: message.title,
          body: message.body,
        },
      });

      broadcastToUser(customerUser.id, {
        type: "food_order_update",
        orderId,
        title: message.title,
        body: message.body,
        status: newStatus,
      });
    }

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: foodOrder.restaurantId },
      select: { restaurantName: true, userId: true },
    });

    broadcastOrderUpdate(orderId, newStatus, {
      restaurantName: restaurant?.restaurantName || undefined,
    });

    if (restaurant?.userId) {
      broadcastToUser(restaurant.userId, {
        type: "food_order_update",
        orderId,
        title: "Order Status Updated",
        body: `Order status changed to: ${newStatus}`,
        status: newStatus,
      });
    }

    if (foodOrder.driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: foodOrder.driverId },
        select: { userId: true },
      });

      if (driver?.userId) {
        broadcastToUser(driver.userId, {
          type: "food_order_update",
          orderId,
          title: "Delivery Status Updated",
          body: `Order status changed to: ${newStatus}`,
          status: newStatus,
        });
      }
    }

    return {
      success: true,
      order: { id: updatedOrder.id, status: updatedOrder.status },
    };
  } catch (error) {
    console.error("[FoodOrderStatusService] Error updating order status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order status",
    };
  }
}
