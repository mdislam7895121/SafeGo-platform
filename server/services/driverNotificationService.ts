import { NotificationType, DeliveryServiceType } from "@prisma/client";
import { notificationService } from "./notificationService";
import { prisma } from "../lib/prisma";

interface RideOfferNotification {
  driverId: string;
  rideId: string;
  pickupArea: string;
  estimatedFare: number;
  currency: string;
  distanceMiles?: number;
  dispatchSessionId?: string;
}

interface RideAssignedNotification {
  driverId: string;
  rideId: string;
  customerName: string;
  pickupAddress: string;
}

interface RideCancelledNotification {
  driverId: string;
  rideId: string;
  reason?: string;
  cancellationFee?: number;
  currency?: string;
}

interface RideCompletedNotification {
  driverId: string;
  rideId: string;
  earnings: number;
  tipAmount?: number;
  currency: string;
}

interface FoodOrderAssignmentNotification {
  driverId: string;
  orderId: string;
  restaurantName: string;
  pickupAddress: string;
  deliveryFee: number;
  currency: string;
}

interface ParcelAssignmentNotification {
  driverId: string;
  deliveryId: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliveryFee: number;
  currency: string;
}

interface WalletBalanceNotification {
  driverId: string;
  balance: number;
  currency: string;
  threshold?: number;
}

interface IncentiveAwardedNotification {
  driverId: string;
  awardId: string;
  ruleName: string;
  amount: number;
  currency: string;
}

interface PayoutProcessedNotification {
  driverId: string;
  payoutId: string;
  amount: number;
  currency: string;
  method: string;
}

interface EarningsSettledNotification {
  driverId: string;
  amount: number;
  currency: string;
  serviceType: DeliveryServiceType;
  entityId: string;
}

class DriverNotificationService {
  async sendNewRideOffer(params: RideOfferNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true, firstName: true },
    });

    if (!driver) {
      console.warn(`[DriverNotificationService] Driver not found: ${params.driverId}`);
      return;
    }

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.NEW_RIDE_OFFER,
      title: "New Ride Request",
      body: `Pickup at ${params.pickupArea}. Estimated fare: ${params.currency} ${params.estimatedFare.toFixed(2)}`,
      data: {
        type: "NEW_RIDE_OFFER",
        rideId: params.rideId,
        dispatchSessionId: params.dispatchSessionId,
        pickupArea: params.pickupArea,
        estimatedFare: params.estimatedFare,
        currency: params.currency,
        distanceMiles: params.distanceMiles,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
      priority: "high",
      ttlSeconds: 30,
      collapseKey: `ride_offer_${params.rideId}`,
    });
  }

  async sendRideAssigned(params: RideAssignedNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.RIDE_ASSIGNED,
      title: "Ride Confirmed",
      body: `Pickup ${params.customerName} at ${params.pickupAddress}`,
      data: {
        type: "RIDE_ASSIGNED",
        rideId: params.rideId,
        customerName: params.customerName,
        pickupAddress: params.pickupAddress,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
      priority: "high",
    });
  }

  async sendRideCancelled(params: RideCancelledNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    let body = "Your ride has been cancelled.";
    if (params.cancellationFee && params.cancellationFee > 0) {
      body += ` You will receive ${params.currency} ${params.cancellationFee.toFixed(2)} cancellation fee.`;
    }
    if (params.reason) {
      body += ` Reason: ${params.reason}`;
    }

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.RIDE_CANCELLED,
      title: "Ride Cancelled",
      body,
      data: {
        type: "RIDE_CANCELLED",
        rideId: params.rideId,
        reason: params.reason,
        cancellationFee: params.cancellationFee,
        currency: params.currency,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
      priority: "high",
    });
  }

  async sendRideCompletedSummary(params: RideCompletedNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    let body = `You earned ${params.currency} ${params.earnings.toFixed(2)} for this ride.`;
    if (params.tipAmount && params.tipAmount > 0) {
      body += ` Plus ${params.currency} ${params.tipAmount.toFixed(2)} tip!`;
    }

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.RIDE_COMPLETED_SUMMARY,
      title: "Ride Completed",
      body,
      data: {
        type: "RIDE_COMPLETED_SUMMARY",
        rideId: params.rideId,
        earnings: params.earnings,
        tipAmount: params.tipAmount,
        currency: params.currency,
      },
      serviceType: DeliveryServiceType.ride,
      entityId: params.rideId,
    });
  }

  async sendNewFoodOrderAssignment(params: FoodOrderAssignmentNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.NEW_FOOD_ORDER_ASSIGNMENT,
      title: "New Delivery Request",
      body: `Pickup from ${params.restaurantName}. Delivery fee: ${params.currency} ${params.deliveryFee.toFixed(2)}`,
      data: {
        type: "NEW_FOOD_ORDER_ASSIGNMENT",
        orderId: params.orderId,
        restaurantName: params.restaurantName,
        pickupAddress: params.pickupAddress,
        deliveryFee: params.deliveryFee,
        currency: params.currency,
      },
      serviceType: DeliveryServiceType.food,
      entityId: params.orderId,
      priority: "high",
      ttlSeconds: 30,
    });
  }

  async sendNewParcelAssignment(params: ParcelAssignmentNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.NEW_PARCEL_ASSIGNMENT,
      title: "New Parcel Delivery",
      body: `Pickup at ${params.pickupAddress}. Delivery fee: ${params.currency} ${params.deliveryFee.toFixed(2)}`,
      data: {
        type: "NEW_PARCEL_ASSIGNMENT",
        deliveryId: params.deliveryId,
        pickupAddress: params.pickupAddress,
        dropoffAddress: params.dropoffAddress,
        deliveryFee: params.deliveryFee,
        currency: params.currency,
      },
      serviceType: DeliveryServiceType.parcel,
      entityId: params.deliveryId,
      priority: "high",
    });
  }

  async sendWalletNegativeBalanceReminder(params: WalletBalanceNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.WALLET_NEGATIVE_BALANCE_REMINDER,
      title: "Wallet Balance Alert",
      body: `Your SafeGo balance is ${params.currency} ${params.balance.toFixed(2)}. Please settle to continue receiving incentives.`,
      data: {
        type: "WALLET_NEGATIVE_BALANCE_REMINDER",
        balance: params.balance,
        currency: params.currency,
        threshold: params.threshold,
      },
      priority: "normal",
      collapseKey: `wallet_balance_${params.driverId}`,
    });
  }

  async sendIncentiveAwarded(params: IncentiveAwardedNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.INCENTIVE_AWARDED,
      title: "Bonus Earned!",
      body: `You earned a ${params.currency} ${params.amount.toFixed(2)} bonus for "${params.ruleName}"!`,
      data: {
        type: "INCENTIVE_AWARDED",
        awardId: params.awardId,
        ruleName: params.ruleName,
        amount: params.amount,
        currency: params.currency,
      },
    });
  }

  async sendPayoutProcessed(params: PayoutProcessedNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.PAYOUT_PROCESSED,
      title: "Payout Sent",
      body: `${params.currency} ${params.amount.toFixed(2)} has been sent to your ${params.method}.`,
      data: {
        type: "PAYOUT_PROCESSED",
        payoutId: params.payoutId,
        amount: params.amount,
        currency: params.currency,
        method: params.method,
      },
    });
  }

  async sendEarningsSettled(params: EarningsSettledNotification) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    const serviceLabel = params.serviceType === "ride" 
      ? "ride" 
      : params.serviceType === "food" 
        ? "food delivery" 
        : "parcel delivery";

    return notificationService.sendToUser({
      userId: driver.userId,
      role: "driver",
      type: NotificationType.EARNINGS_SETTLED,
      title: "Earnings Settled",
      body: `${params.currency} ${params.amount.toFixed(2)} has been added to your wallet for your ${serviceLabel}.`,
      data: {
        type: "EARNINGS_SETTLED",
        amount: params.amount,
        currency: params.currency,
        serviceType: params.serviceType,
        entityId: params.entityId,
      },
      serviceType: params.serviceType,
      entityId: params.entityId,
    });
  }
}

export const driverNotificationService = new DriverNotificationService();
