import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { safeAuditLogCreate } from "../utils/audit";

/**
 * Financial Adjustments Service for Support Ticket Refunds
 * Handles refund processing without breaking existing commission logic
 * Follows the same patterns as walletService.ts
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
  adminEmail: string;
  countryCode: string;
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
    adminEmail,
    countryCode,
  } = data;

  try {
    // Determine who bears the cost based on service type and payment method
    let affectedWalletId: string | null = null;
    let adjustmentType: string;
    let adjustmentReason: string;
    let ownerType: "driver" | "restaurant" | null = null;

    if (serviceType === "food_order") {
      // Food orders: restaurant bears the cost
      if (!restaurantId) {
        throw new Error("Restaurant ID required for food order refunds");
      }

      // Find restaurant wallet
      const wallet = await prisma.wallet.findUnique({
        where: {
          ownerId_ownerType: {
            ownerId: restaurantId,
            ownerType: "restaurant",
          },
        },
      });

      if (!wallet) {
        throw new Error("Restaurant wallet not found");
      }

      affectedWalletId = wallet.id;
      ownerType = "restaurant";
      adjustmentType = paymentMethod === "cash" ? "cash_refund_deduction" : "online_refund_deduction";
      adjustmentReason = `Refund approved for support ticket ${ticketCode}`;

      // Create negative balance transaction using Prisma transaction
      await prisma.$transaction(async (tx) => {
        const currentWallet = await tx.wallet.findUnique({
          where: { id: affectedWalletId! },
        });

        if (!currentWallet) {
          throw new Error("Wallet not found in transaction");
        }

        // Increase negative balance by refund amount
        const newNegativeBalance = new Prisma.Decimal(currentWallet.negativeBalance.toString())
          .plus(refundAmount);

        await tx.wallet.update({
          where: { id: affectedWalletId! },
          data: {
            negativeBalance: newNegativeBalance,
          },
        });

        // Create transaction record
        await tx.walletTransaction.create({
          data: {
            walletId: affectedWalletId!,
            ownerType: "restaurant",
            countryCode,
            serviceType: "refund",
            direction: "debit",
            amount: new Prisma.Decimal(refundAmount),
            balanceSnapshot: currentWallet.availableBalance,
            negativeBalanceSnapshot: newNegativeBalance,
            referenceType: "support_ticket",
            referenceId: ticketId,
            description: adjustmentReason,
            createdByAdminId: adminId,
          },
        });
      });

    } else if (serviceType === "ride" && paymentMethod === "cash") {
      // Cash rides: driver bears the cost
      if (!driverId) {
        throw new Error("Driver ID required for cash ride refunds");
      }

      // Find driver wallet
      const wallet = await prisma.wallet.findUnique({
        where: {
          ownerId_ownerType: {
            ownerId: driverId,
            ownerType: "driver",
          },
        },
      });

      if (!wallet) {
        throw new Error("Driver wallet not found");
      }

      affectedWalletId = wallet.id;
      ownerType = "driver";
      adjustmentType = "cash_refund_deduction";
      adjustmentReason = `Cash ride refund approved for support ticket ${ticketCode}`;

      // Create negative balance transaction
      await prisma.$transaction(async (tx) => {
        const currentWallet = await tx.wallet.findUnique({
          where: { id: affectedWalletId! },
        });

        if (!currentWallet) {
          throw new Error("Wallet not found in transaction");
        }

        // Increase negative balance by refund amount
        const newNegativeBalance = new Prisma.Decimal(currentWallet.negativeBalance.toString())
          .plus(refundAmount);

        await tx.wallet.update({
          where: { id: affectedWalletId! },
          data: {
            negativeBalance: newNegativeBalance,
          },
        });

        // Create transaction record
        await tx.walletTransaction.create({
          data: {
            walletId: affectedWalletId!,
            ownerType: "driver",
            countryCode,
            serviceType: "refund",
            direction: "debit",
            amount: new Prisma.Decimal(refundAmount),
            balanceSnapshot: currentWallet.availableBalance,
            negativeBalanceSnapshot: newNegativeBalance,
            referenceType: "support_ticket",
            referenceId: ticketId,
            description: adjustmentReason,
            createdByAdminId: adminId,
          },
        });
      });

    } else {
      // Online payments (rides or deliveries): SafeGo bears the cost
      adjustmentType = "online_refund_safego";
      adjustmentReason = `Online ${serviceType} refund approved for support ticket ${ticketCode}`;

      // No wallet transaction needed as SafeGo absorbs the cost
      // This is tracked separately in admin financial reports
    }

    // Create audit log
    await safeAuditLogCreate({
      data: {
        actorId: adminId,
        actorEmail: adminEmail,
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
          adminNote: adminNote || "",
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
    await safeAuditLogCreate({
      data: {
        actorId: adminId,
        actorEmail: adminEmail,
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
      referenceType: "support_ticket",
      referenceId: ticketId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return transactions;
}
