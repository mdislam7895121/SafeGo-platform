import { prisma } from "../../lib/prisma";

interface TriggerResult {
  userId: string;
  triggerType: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export async function checkVerificationPendingTriggers(): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const pendingCustomers = await prisma.customer.findMany({
      where: {
        verificationStatus: "pending",
        createdAt: { lt: cutoff },
      },
      select: { id: true, fullName: true, country: true },
      take: 100,
    });

    for (const customer of pendingCustomers) {
      const alreadyNotified = await prisma.safePilotNotification.findFirst({
        where: {
          userId: customer.id,
          triggerType: "verification_pending_24h",
          createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!alreadyNotified) {
        const message = customer.country === "BD"
          ? "Your verification is pending. Please ensure you've uploaded your NID (front and back), profile photo, and provided your father's name, present address, and permanent address."
          : "Your verification is pending. Please ensure you've uploaded your government ID, profile photo, and provided your home address and emergency contact.";

        results.push({
          userId: customer.id,
          triggerType: "verification_pending_24h",
          title: "Complete Your Verification",
          message,
          metadata: { country: customer.country, role: "CUSTOMER" },
        });
      }
    }

    const pendingDrivers = await prisma.driverProfile.findMany({
      where: {
        verificationStatus: "pending",
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { fullName: true } },
        country: true,
        nidFrontImage: true,
        nidBackImage: true,
        driverLicenseImage: true,
      },
      take: 100,
    });

    for (const driver of pendingDrivers) {
      const alreadyNotified = await prisma.safePilotNotification.findFirst({
        where: {
          userId: driver.userId,
          triggerType: "verification_pending_24h",
          createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!alreadyNotified) {
        const missingDocs: string[] = [];
        if (driver.country === "BD") {
          if (!driver.nidFrontImage) missingDocs.push("NID front image");
          if (!driver.nidBackImage) missingDocs.push("NID back image");
        } else {
          if (!driver.driverLicenseImage) missingDocs.push("Driver license image");
        }

        const message = missingDocs.length > 0
          ? `Your driver verification is pending. Missing documents: ${missingDocs.join(", ")}. Please upload them to complete verification.`
          : "Your driver verification is pending review. Our team will review your documents shortly.";

        results.push({
          userId: driver.userId,
          triggerType: "verification_pending_24h",
          title: "Driver Verification Pending",
          message,
          metadata: { country: driver.country, role: "DRIVER", missingDocs },
        });
      }
    }
  } catch (error) {
    console.error("[SafePilot Triggers] Verification check error:", error);
  }

  return results;
}

export async function checkNegativeBalanceTriggers(): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];

  try {
    const driversWithNegativeBalance = await prisma.driverProfile.findMany({
      where: {
        walletBalance: { lt: 0 },
      },
      select: {
        id: true,
        userId: true,
        walletBalance: true,
        user: { select: { fullName: true } },
      },
      take: 100,
    });

    for (const driver of driversWithNegativeBalance) {
      const alreadyNotified = await prisma.safePilotNotification.findFirst({
        where: {
          userId: driver.userId,
          triggerType: "negative_balance_reminder",
          createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!alreadyNotified && driver.walletBalance) {
        results.push({
          userId: driver.userId,
          triggerType: "negative_balance_reminder",
          title: "Negative Balance Reminder",
          message: `Your wallet has a negative balance of ${Math.abs(Number(driver.walletBalance))} due to cash ride commissions. This will be settled during the weekly payout cycle. You can also make a manual payment to clear the balance.`,
          metadata: { balance: Number(driver.walletBalance), role: "DRIVER" },
        });
      }
    }
  } catch (error) {
    console.error("[SafePilot Triggers] Negative balance check error:", error);
  }

  return results;
}

export async function checkDelayedOrderTriggers(): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  const delayThreshold = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const delayedOrders = await prisma.foodOrder.findMany({
      where: {
        status: { in: ["placed", "accepted", "preparing"] },
        createdAt: { lt: delayThreshold },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        createdAt: true,
      },
      take: 50,
    });

    for (const order of delayedOrders) {
      const alreadyNotified = await prisma.safePilotNotification.findFirst({
        where: {
          userId: order.customerId,
          triggerType: "order_delayed",
          metadata: { path: ["orderId"], equals: order.id },
          createdAt: { gt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
      });

      if (!alreadyNotified) {
        results.push({
          userId: order.customerId,
          triggerType: "order_delayed",
          title: "Order Update",
          message: `Your order (${order.id.slice(0, 8)}...) is taking longer than expected. Current status: ${order.status}. Contact the restaurant or SafeGo Support if you have concerns.`,
          metadata: { orderId: order.id, status: order.status, role: "CUSTOMER" },
        });
      }
    }
  } catch (error) {
    console.error("[SafePilot Triggers] Delayed order check error:", error);
  }

  return results;
}

export async function checkCancelledRideTriggers(): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  const recentCutoff = new Date(Date.now() - 30 * 60 * 1000);

  try {
    const cancelledRides = await prisma.ride.findMany({
      where: {
        status: { in: ["cancelled_by_customer", "cancelled_by_driver", "cancelled_no_driver"] },
        updatedAt: { gt: recentCutoff },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        cancellationReason: true,
      },
      take: 50,
    });

    for (const ride of cancelledRides) {
      const alreadyNotified = await prisma.safePilotNotification.findFirst({
        where: {
          userId: ride.customerId,
          triggerType: "ride_cancelled_info",
          metadata: { path: ["rideId"], equals: ride.id },
        },
      });

      if (!alreadyNotified) {
        let reasonExplanation = "";
        switch (ride.status) {
          case "cancelled_by_customer":
            reasonExplanation = "You cancelled this ride. If you were charged a cancellation fee, it's because the driver had already started heading to your pickup location.";
            break;
          case "cancelled_by_driver":
            reasonExplanation = "The driver cancelled this ride. This could be due to traffic, vehicle issues, or other circumstances. You won't be charged for this cancellation.";
            break;
          case "cancelled_no_driver":
            reasonExplanation = "No driver was available for your ride. This can happen during high-demand periods. Try requesting again or consider scheduling for a later time.";
            break;
        }

        results.push({
          userId: ride.customerId,
          triggerType: "ride_cancelled_info",
          title: "Ride Cancellation Details",
          message: reasonExplanation,
          metadata: { rideId: ride.id, status: ride.status, role: "CUSTOMER" },
        });
      }
    }
  } catch (error) {
    console.error("[SafePilot Triggers] Cancelled ride check error:", error);
  }

  return results;
}

export async function processTriggers(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  const allTriggers: TriggerResult[] = [];

  try {
    const [verification, negativeBalance, delayedOrders, cancelledRides] = await Promise.all([
      checkVerificationPendingTriggers(),
      checkNegativeBalanceTriggers(),
      checkDelayedOrderTriggers(),
      checkCancelledRideTriggers(),
    ]);

    allTriggers.push(...verification, ...negativeBalance, ...delayedOrders, ...cancelledRides);

    for (const trigger of allTriggers) {
      try {
        await prisma.safePilotNotification.create({
          data: {
            userId: trigger.userId,
            triggerType: trigger.triggerType,
            title: trigger.title,
            message: trigger.message,
            metadata: trigger.metadata,
          },
        });
        processed++;
      } catch (e) {
        errors++;
        console.error("[SafePilot Triggers] Create notification error:", e);
      }
    }
  } catch (error) {
    console.error("[SafePilot Triggers] Process error:", error);
  }

  console.log(`[SafePilot Triggers] Processed ${processed} notifications, ${errors} errors`);
  return { processed, errors };
}

export async function getUserNotifications(userId: string, limit: number = 20): Promise<Array<{
  id: string;
  triggerType: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}>> {
  const notifications = await prisma.safePilotNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      triggerType: true,
      title: true,
      message: true,
      isRead: true,
      createdAt: true,
    },
  });

  return notifications;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    await prisma.safePilotNotification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return true;
  } catch (error) {
    console.error("[SafePilot Triggers] Mark read error:", error);
    return false;
  }
}
