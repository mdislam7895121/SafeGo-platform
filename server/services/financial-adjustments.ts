import { prisma } from "../db";

/**
 * Financial Adjustments Service for Support Ticket Refunds
 * Handles refund processing without breaking existing commission logic
 */

interface RefundAdjustment {
  ticketId: string;
  ticketCode: string;
  serviceType: string;
  serviceId: string;
  paymentMethod: string;
  refundAmount: number;
  customerId: string;
  restaurantId?: string | null;
  driverId?: string | null;
  adminNote?: string;
  adminId: string;
}

/**
 * Process approved refund and create financial adjustment
 * Cash rides → driver negative balance
 * Cash food → restaurant negative balance
 * Online payments → SafeGo payout adjustment
 */
export async function processRefundAdjustment(data: RefundAdjustment) {
  const {
    ticketId,
    ticketCode,
    serviceType,
    serviceId,
    paymentMethod,
    refundAmount,
    customerId,
    restaurantId,
    driverId,
    adminNote,
    adminId,
  } = data;

  try {
    // Determine who bears the cost based on service type and payment method
    let affectedWalletId: string | null = null;
    let adjustmentType: string;
    let adjustmentReason: string;

    if (serviceType === "food_order") {
      // Food orders: restaurant bears the cost
      if (!restaurantId) {
        throw new Error("Restaurant ID required for food order refunds");
      }

      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id: restaurantId },
        select: { wallet: { select: { id: true } } },
      });

      if (!restaurant?.wallet) {
        throw new Error("Restaurant wallet not found");
      }

      affectedWalletId = restaurant.wallet.id;
      adjustmentType = paymentMethod === "cash" ? "cash_refund_deduction" : "online_refund_deduction";
      adjustmentReason = `Refund approved for support ticket ${ticketCode}`;

      // Create negative balance transaction for restaurant
      await prisma.walletTransaction.create({
        data: {
          walletId: affectedWalletId,
          transactionType: "adjustment",
          amount: -refundAmount,
          currency: "USD",
          status: "completed",
          description: adjustmentReason,
          metadata: {
            ticketId,
            ticketCode,
            serviceType,
            serviceId,
            paymentMethod,
            adminNote,
            adminId,
          },
        },
      });

      // Update restaurant wallet balance
      await prisma.wallet.update({
        where: { id: affectedWalletId },
        data: {
          balance: {
            decrement: refundAmount,
          },
        },
      });

    } else if (serviceType === "ride" && paymentMethod === "cash") {
      // Cash rides: driver bears the cost
      if (!driverId) {
        throw new Error("Driver ID required for cash ride refunds");
      }

      const driver = await prisma.driverProfile.findUnique({
        where: { id: driverId },
        select: { wallet: { select: { id: true } } },
      });

      if (!driver?.wallet) {
        throw new Error("Driver wallet not found");
      }

      affectedWalletId = driver.wallet.id;
      adjustmentType = "cash_refund_deduction";
      adjustmentReason = `Cash ride refund approved for support ticket ${ticketCode}`;

      // Create negative balance transaction for driver
      await prisma.walletTransaction.create({
        data: {
          walletId: affectedWalletId,
          transactionType: "adjustment",
          amount: -refundAmount,
          currency: "USD",
          status: "completed",
          description: adjustmentReason,
          metadata: {
            ticketId,
            ticketCode,
            serviceType,
            serviceId,
            paymentMethod,
            adminNote,
            adminId,
          },
        },
      });

      // Update driver wallet balance
      await prisma.wallet.update({
        where: { id: affectedWalletId },
        data: {
          balance: {
            decrement: refundAmount,
          },
        },
      });

    } else {
      // Online payments (rides or deliveries): SafeGo bears the cost
      adjustmentType = "online_refund_safego";
      adjustmentReason = `Online ${serviceType} refund approved for support ticket ${ticketCode}`;

      // No wallet transaction needed as SafeGo absorbs the cost
      // This is tracked separately in admin financial reports
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "admin",
        ipAddress: "",
        actionType: "refund_processed",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Processed ${adjustmentType} refund of $${refundAmount.toFixed(2)} for ticket ${ticketCode}`,
        metadata: {
          ticketId,
          ticketCode,
          serviceType,
          serviceId,
          refundAmount,
          paymentMethod,
          adjustmentType,
          affectedWalletId,
          adminNote,
        },
        success: true,
      },
    });

    return {
      success: true,
      adjustmentType,
      affectedWalletId,
      message: `Refund of $${refundAmount.toFixed(2)} processed successfully`,
    };

  } catch (error) {
    console.error("[Financial Adjustments] Failed to process refund:", error);
    
    // Log failure
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "admin",
        ipAddress: "",
        actionType: "refund_failed",
        entityType: "support_ticket",
        entityId: ticketId,
        description: `Failed to process refund for ticket ${ticketCode}: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          ticketId,
          ticketCode,
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
      },
    });

    throw error;
  }
}

/**
 * Get financial adjustment history for a support ticket
 */
export async function getTicketFinancialHistory(ticketId: string) {
  const transactions = await prisma.walletTransaction.findMany({
    where: {
      metadata: {
        path: ["ticketId"],
        equals: ticketId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return transactions;
}
