import { NotificationType, DeliveryServiceType } from "@prisma/client";
import { notificationService } from "./notificationService";
import { prisma } from "../lib/prisma";

interface DriverAssignedNotification {
  customerId: string;
  rideId: string;
  driverName: string;
  vehicleInfo?: string;
  etaMinutes?: number;
}

interface DriverArrivingNotification {
  customerId: string;
  rideId: string;
  driverName: string;
  etaMinutes: number;
}

interface DriverArrivedNotification {
  customerId: string;
  rideId: string;
  driverName: string;
  vehicleInfo?: string;
}

interface TripStartedNotification {
  customerId: string;
  rideId: string;
  estimatedArrivalMinutes?: number;
}

interface TripCompletedNotification {
  customerId: string;
  rideId: string;
  totalFare: number;
  currency: string;
  distanceMiles?: number;
  durationMinutes?: number;
}

interface PaymentSuccessNotification {
  customerId: string;
  serviceType: DeliveryServiceType;
  entityId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
}

interface PaymentFailedNotification {
  customerId: string;
  serviceType: DeliveryServiceType;
  entityId: string;
  amount: number;
  currency: string;
  reason?: string;
}

interface OrderStatusUpdateNotification {
  customerId: string;
  orderId: string;
  status: string;
  restaurantName?: string;
  etaMinutes?: number;
}

interface ParcelStatusUpdateNotification {
  customerId: string;
  deliveryId: string;
  status: string;
  etaMinutes?: number;
}

interface OrderPickedUpNotification {
  customerId: string;
  orderId: string;
  driverName: string;
  etaMinutes?: number;
}

interface OrderDeliveredNotification {
  customerId: string;
  orderId: string;
  totalAmount: number;
  currency: string;
}

class CustomerNotificationService {
  async sendDriverAssigned(params: DriverAssignedNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) {
      console.warn(`[CustomerNotificationService] Customer not found: ${params.customerId}`);
      return;
    }

    let body = `${params.driverName} is on the way`;
    if (params.vehicleInfo) {
      body += ` in ${params.vehicleInfo}`;
    }
    if (params.etaMinutes) {
      body += `. Arriving in ${params.etaMinutes} mins`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.DRIVER_ASSIGNED,
      title: "Driver On The Way",
      body,
      data: {
        type: "DRIVER_ASSIGNED",
        rideId: params.rideId,
        driverName: params.driverName,
        vehicleInfo: params.vehicleInfo,
        etaMinutes: params.etaMinutes,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
      priority: "high",
    });
  }

  async sendDriverArriving(params: DriverArrivingNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.DRIVER_ARRIVING,
      title: "Driver Arriving Soon",
      body: `${params.driverName} will arrive in ${params.etaMinutes} minute${params.etaMinutes !== 1 ? "s" : ""}`,
      data: {
        type: "DRIVER_ARRIVING",
        rideId: params.rideId,
        driverName: params.driverName,
        etaMinutes: params.etaMinutes,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
      priority: "high",
      collapseKey: `ride_eta_${params.rideId}`,
    });
  }

  async sendDriverArrived(params: DriverArrivedNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    let body = `${params.driverName} has arrived`;
    if (params.vehicleInfo) {
      body += ` in ${params.vehicleInfo}`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.DRIVER_ARRIVED,
      title: "Driver Has Arrived",
      body,
      data: {
        type: "DRIVER_ARRIVED",
        rideId: params.rideId,
        driverName: params.driverName,
        vehicleInfo: params.vehicleInfo,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
      priority: "high",
    });
  }

  async sendTripStarted(params: TripStartedNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    let body = "Your trip has started.";
    if (params.estimatedArrivalMinutes) {
      body += ` Estimated arrival in ${params.estimatedArrivalMinutes} mins`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.TRIP_STARTED,
      title: "Trip Started",
      body,
      data: {
        type: "TRIP_STARTED",
        rideId: params.rideId,
        estimatedArrivalMinutes: params.estimatedArrivalMinutes,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
    });
  }

  async sendTripCompletedReceipt(params: TripCompletedNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    let body = `Trip completed. Total: ${params.currency} ${params.totalFare.toFixed(2)}`;
    if (params.distanceMiles && params.durationMinutes) {
      body += ` (${params.distanceMiles.toFixed(1)} mi, ${params.durationMinutes} mins)`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.TRIP_COMPLETED_RECEIPT,
      title: "Trip Completed",
      body,
      data: {
        type: "TRIP_COMPLETED_RECEIPT",
        rideId: params.rideId,
        totalFare: params.totalFare,
        currency: params.currency,
        distanceMiles: params.distanceMiles,
        durationMinutes: params.durationMinutes,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
    });
  }

  async sendPaymentSuccess(params: PaymentSuccessNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    const serviceLabel = params.serviceType === "ride" ? "ride" : params.serviceType === "food" ? "order" : "delivery";

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.PAYMENT_SUCCESS,
      title: "Payment Successful",
      body: `Your payment of ${params.currency} ${params.amount.toFixed(2)} for your ${serviceLabel} was successful.`,
      data: {
        type: "PAYMENT_SUCCESS",
        serviceType: params.serviceType,
        entityId: params.entityId,
        amount: params.amount,
        currency: params.currency,
        paymentMethod: params.paymentMethod,
      },
      serviceType: params.serviceType,
      entityId: params.entityId,
    });
  }

  async sendPaymentFailed(params: PaymentFailedNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    let body = `Your payment of ${params.currency} ${params.amount.toFixed(2)} failed.`;
    if (params.reason) {
      body += ` ${params.reason}`;
    }
    body += " Please update your payment method.";

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.PAYMENT_FAILED,
      title: "Payment Failed",
      body,
      data: {
        type: "PAYMENT_FAILED",
        serviceType: params.serviceType,
        entityId: params.entityId,
        amount: params.amount,
        currency: params.currency,
        reason: params.reason,
      },
      serviceType: params.serviceType,
      entityId: params.entityId,
      priority: "high",
    });
  }

  async sendOrderStatusUpdate(params: OrderStatusUpdateNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    const statusMessages: Record<string, string> = {
      confirmed: "Your order has been confirmed",
      preparing: "Your order is being prepared",
      ready_for_pickup: "Your order is ready for pickup",
      picked_up: "Your order has been picked up by the driver",
      on_the_way: "Your order is on its way",
      delivered: "Your order has been delivered",
      cancelled: "Your order has been cancelled",
    };

    let body = statusMessages[params.status] || `Order status: ${params.status}`;
    if (params.restaurantName && params.status === "preparing") {
      body = `${params.restaurantName} is preparing your order`;
    }
    if (params.etaMinutes && ["picked_up", "on_the_way"].includes(params.status)) {
      body += `. Arriving in ${params.etaMinutes} mins`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.ORDER_STATUS_UPDATE,
      title: "Order Update",
      body,
      data: {
        type: "ORDER_STATUS_UPDATE",
        orderId: params.orderId,
        status: params.status,
        restaurantName: params.restaurantName,
        etaMinutes: params.etaMinutes,
      },
      serviceType: DeliveryServiceType.food,
      entityId: params.orderId,
      collapseKey: `order_status_${params.orderId}`,
    });
  }

  async sendParcelStatusUpdate(params: ParcelStatusUpdateNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    const statusMessages: Record<string, string> = {
      pending: "Your parcel delivery is pending",
      assigned: "A driver has been assigned to your parcel",
      picked_up: "Your parcel has been picked up",
      in_transit: "Your parcel is on its way",
      delivered: "Your parcel has been delivered",
      cancelled: "Your parcel delivery has been cancelled",
    };

    let body = statusMessages[params.status] || `Parcel status: ${params.status}`;
    if (params.etaMinutes && ["picked_up", "in_transit"].includes(params.status)) {
      body += `. Arriving in ${params.etaMinutes} mins`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.PARCEL_STATUS_UPDATE,
      title: "Delivery Update",
      body,
      data: {
        type: "PARCEL_STATUS_UPDATE",
        deliveryId: params.deliveryId,
        status: params.status,
        etaMinutes: params.etaMinutes,
      },
      serviceType: DeliveryServiceType.parcel,
      entityId: params.deliveryId,
      collapseKey: `parcel_status_${params.deliveryId}`,
    });
  }

  async sendOrderPickedUp(params: OrderPickedUpNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    let body = `${params.driverName} has picked up your order`;
    if (params.etaMinutes) {
      body += `. Arriving in ${params.etaMinutes} mins`;
    }

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.ORDER_PICKED_UP,
      title: "Order Picked Up",
      body,
      data: {
        type: "ORDER_PICKED_UP",
        orderId: params.orderId,
        driverName: params.driverName,
        etaMinutes: params.etaMinutes,
      },
      serviceType: DeliveryServiceType.food,
      entityId: params.orderId,
      priority: "high",
    });
  }

  async sendOrderDelivered(params: OrderDeliveredNotification) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: params.customerId },
      select: { userId: true },
    });

    if (!customer) return;

    return notificationService.sendToUser({
      userId: customer.userId,
      role: "customer",
      type: NotificationType.ORDER_DELIVERED,
      title: "Order Delivered",
      body: `Your order has been delivered. Total: ${params.currency} ${params.totalAmount.toFixed(2)}. Enjoy your meal!`,
      data: {
        type: "ORDER_DELIVERED",
        orderId: params.orderId,
        totalAmount: params.totalAmount,
        currency: params.currency,
      },
      serviceType: DeliveryServiceType.food,
      entityId: params.orderId,
    });
  }
}

export const customerNotificationService = new CustomerNotificationService();
