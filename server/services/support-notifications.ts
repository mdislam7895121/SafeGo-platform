import { prisma } from "../db";

/**
 * Support Ticket Notification Service
 * Sends notifications to all relevant parties (customer, restaurant, driver, admin) when support tickets are created or updated
 */

interface TicketData {
  id: string;
  ticketCode: string;
  serviceType: string;
  customerId: string;
  restaurantId?: string | null;
  driverId?: string | null;
  issueCategory: string;
  internalStatus: string;
  priority: string;
  country: string;
}

/**
 * Send notification to customer when ticket is created
 */
export async function notifyCustomerTicketCreated(ticket: TicketData) {
  try {
    await prisma.notification.create({
      data: {
        id: `support-created-${ticket.id}`,
        userId: ticket.customerId,
        type: "support_ticket",
        title: "Support Ticket Created",
        body: `Your support ticket ${ticket.ticketCode} has been created. We'll review it shortly.`,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("[Support Notifications] Failed to notify customer of ticket creation:", error);
  }
}

/**
 * Send notification to restaurant when a ticket is created for their order
 */
export async function notifyRestaurantTicketCreated(ticket: TicketData) {
  if (!ticket.restaurantId) return;

  try {
    // Find restaurant owner/staff users
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: ticket.restaurantId },
      select: { userId: true },
    });

    if (!restaurant) return;

    await prisma.notification.create({
      data: {
        id: `support-restaurant-${ticket.id}`,
        userId: restaurant.userId,
        type: "support_ticket",
        title: "New Customer Issue",
        body: `A customer reported an issue with their order (${ticket.issueCategory.replace(/_/g, " ")}). Ticket: ${ticket.ticketCode}`,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("[Support Notifications] Failed to notify restaurant of ticket creation:", error);
  }
}

/**
 * Send notification to driver when a ticket involves their ride/delivery
 */
export async function notifyDriverTicketCreated(ticket: TicketData) {
  if (!ticket.driverId) return;

  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: ticket.driverId },
      select: { userId: true },
    });

    if (!driver) return;

    await prisma.notification.create({
      data: {
        id: `support-driver-${ticket.id}`,
        userId: driver.userId,
        type: "support_ticket",
        title: "Customer Support Issue",
        body: `A customer reported an issue with a ${ticket.serviceType === "ride" ? "ride" : "delivery"}. Ticket: ${ticket.ticketCode}`,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("[Support Notifications] Failed to notify driver of ticket creation:", error);
  }
}

/**
 * Send notification to admin when high-priority ticket is created
 */
export async function notifyAdminHighPriorityTicket(ticket: TicketData) {
  if (ticket.priority !== "high") return;

  try {
    await prisma.adminNotification.create({
      data: {
        id: `support-admin-high-${ticket.id}`,
        type: "support_ticket",
        severity: "high",
        entityType: "ticket",
        entityId: ticket.id,
        countryCode: ticket.country,
        title: "High Priority Support Ticket",
        message: `New high-priority ${ticket.serviceType} ticket: ${ticket.ticketCode} - ${ticket.issueCategory.replace(/_/g, " ")}`,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("[Support Notifications] Failed to notify admin of high-priority ticket:", error);
  }
}

/**
 * Send notification when a new reply is added to the ticket
 */
export async function notifyTicketReply(ticket: TicketData, actorRole: string, content: string, isInternal: boolean) {
  // Don't notify for internal messages
  if (isInternal) return;

  try {
    // Notify customer if reply is from restaurant/admin
    if (actorRole === "RESTAURANT" || actorRole === "ADMIN") {
      await prisma.notification.create({
        data: {
          id: `support-reply-customer-${ticket.id}-${Date.now()}`,
          userId: ticket.customerId,
          type: "support_reply",
          title: "New Reply to Your Support Ticket",
          body: `${actorRole === "ADMIN" ? "SafeGo Support" : "The restaurant"} replied to ticket ${ticket.ticketCode}`,
          isRead: false,
        },
      });
    }

    // Notify restaurant if reply is from customer/admin
    if (ticket.restaurantId && (actorRole === "CUSTOMER" || actorRole === "ADMIN")) {
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id: ticket.restaurantId },
        select: { userId: true },
      });

      if (restaurant) {
        await prisma.notification.create({
          data: {
            id: `support-reply-restaurant-${ticket.id}-${Date.now()}`,
            userId: restaurant.userId,
            type: "support_reply",
            title: "New Reply on Support Ticket",
            body: `${actorRole === "ADMIN" ? "SafeGo Admin" : "The customer"} replied to ticket ${ticket.ticketCode}`,
            isRead: false,
          },
        });
      }
    }

    // Notify driver if reply is from customer/admin
    if (ticket.driverId && (actorRole === "CUSTOMER" || actorRole === "ADMIN")) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: ticket.driverId },
        select: { userId: true },
      });

      if (driver) {
        await prisma.notification.create({
          data: {
            id: `support-reply-driver-${ticket.id}-${Date.now()}`,
            userId: driver.userId,
            type: "support_reply",
            title: "New Reply on Support Ticket",
            body: `${actorRole === "ADMIN" ? "SafeGo Support" : "The customer"} replied to ticket ${ticket.ticketCode}`,
            isRead: false,
          },
        });
      }
    }
  } catch (error) {
    console.error("[Support Notifications] Failed to send reply notification:", error);
  }
}

/**
 * Send notification when ticket status changes
 */
export async function notifyTicketStatusChange(ticket: TicketData, oldStatus: string, newStatus: string) {
  const statusLabels: Record<string, string> = {
    new: "New",
    assigned: "Assigned",
    in_review: "Under Review",
    awaiting_restaurant: "Awaiting Restaurant Response",
    awaiting_customer: "Awaiting Your Response",
    refund_proposed: "Refund Proposed",
    resolved: "Resolved",
    closed: "Closed",
  };

  const newStatusLabel = statusLabels[newStatus] || newStatus;

  try {
    // Always notify customer of status changes
    await prisma.notification.create({
      data: {
        id: `support-status-customer-${ticket.id}-${Date.now()}`,
        userId: ticket.customerId,
        type: "support_status",
        title: "Support Ticket Status Updated",
        body: `Your ticket ${ticket.ticketCode} status changed to: ${newStatusLabel}`,
        isRead: false,
      },
    });

    // Notify restaurant if relevant
    if (ticket.restaurantId && (newStatus === "awaiting_restaurant" || newStatus === "resolved")) {
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id: ticket.restaurantId },
        select: { userId: true },
      });

      if (restaurant) {
        await prisma.notification.create({
          data: {
            id: `support-status-restaurant-${ticket.id}-${Date.now()}`,
            userId: restaurant.userId,
            type: "support_status",
            title: "Support Ticket Status Updated",
            body: `Ticket ${ticket.ticketCode} status: ${newStatusLabel}`,
            isRead: false,
          },
        });
      }
    }
  } catch (error) {
    console.error("[Support Notifications] Failed to send status change notification:", error);
  }
}

/**
 * Send notification when refund is approved/denied
 */
export async function notifyRefundDecision(ticket: TicketData, approved: boolean, refundAmount?: number) {
  try {
    // Notify customer
    await prisma.notification.create({
      data: {
        id: `support-refund-customer-${ticket.id}`,
        userId: ticket.customerId,
        type: "support_refund",
        title: approved ? "Refund Approved" : "Refund Denied",
        body: approved
          ? `Your refund of $${refundAmount?.toFixed(2)} for ticket ${ticket.ticketCode} has been approved and will be processed shortly.`
          : `Your refund request for ticket ${ticket.ticketCode} has been reviewed and denied. Please check the ticket for details.`,
        isRead: false,
      },
    });

    // Notify restaurant if they're affected
    if (ticket.restaurantId && approved) {
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id: ticket.restaurantId },
        select: { userId: true },
      });

      if (restaurant) {
        await prisma.notification.create({
          data: {
            id: `support-refund-restaurant-${ticket.id}`,
            userId: restaurant.userId,
            type: "support_refund",
            title: "Refund Approved for Ticket",
            body: `A refund of $${refundAmount?.toFixed(2)} was approved for ticket ${ticket.ticketCode}. This may affect your earnings.`,
            isRead: false,
          },
        });
      }
    }
  } catch (error) {
    console.error("[Support Notifications] Failed to send refund decision notification:", error);
  }
}

/**
 * Send aging ticket alert to admin
 */
export async function notifyAdminAgingTicket(ticket: TicketData, ageHours: number) {
  try {
    await prisma.adminNotification.create({
      data: {
        id: `support-aging-${ticket.id}-${Date.now()}`,
        type: "support_ticket",
        severity: ageHours > 48 ? "high" : "medium",
        entityType: "ticket",
        entityId: ticket.id,
        countryCode: ticket.country,
        title: "Aging Support Ticket",
        message: `Ticket ${ticket.ticketCode} has been open for ${ageHours} hours without resolution`,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("[Support Notifications] Failed to send aging ticket notification:", error);
  }
}
