import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; email?: string };
}

export async function checkSettlementRestriction(
  userId: string,
  userRole: string
): Promise<{ restricted: boolean; reason?: string; balance?: number }> {
  try {
    if (["driver", "DRIVER", "bd_driver"].includes(userRole)) {
      const balance = await prisma.driverNegativeBalance.findUnique({
        where: { driverId: userId },
      });

      if (balance?.isRestricted) {
        return {
          restricted: true,
          reason: balance.restrictionReason || "High negative balance - settlement required",
          balance: Number(balance.currentBalance),
        };
      }

      const threshold = await prisma.settlementThreshold.findFirst({
        where: {
          ownerType: "driver",
          thresholdType: "negative_balance_max",
          isActive: true,
        },
      });

      if (threshold && balance && Number(balance.currentBalance) > Number(threshold.thresholdValue)) {
        await prisma.driverNegativeBalance.update({
          where: { driverId: userId },
          data: {
            isRestricted: true,
            restrictedAt: new Date(),
            restrictionReason: `Auto-restricted: Balance ${balance.currentBalance} exceeds threshold ${threshold.thresholdValue}`,
          },
        });

        return {
          restricted: true,
          reason: `Negative balance exceeds maximum threshold. Please settle your outstanding balance.`,
          balance: Number(balance.currentBalance),
        };
      }
    }

    if (["restaurant", "RESTAURANT", "restaurant_owner"].includes(userRole)) {
      const balance = await prisma.restaurantNegativeBalance.findUnique({
        where: { restaurantId: userId },
      });

      if (balance?.isRestricted) {
        return {
          restricted: true,
          reason: balance.restrictionReason || "High negative balance - settlement required",
          balance: Number(balance.currentBalance),
        };
      }

      const threshold = await prisma.settlementThreshold.findFirst({
        where: {
          ownerType: "restaurant",
          thresholdType: "negative_balance_max",
          isActive: true,
        },
      });

      if (threshold && balance && Number(balance.currentBalance) > Number(threshold.thresholdValue)) {
        await prisma.restaurantNegativeBalance.update({
          where: { restaurantId: userId },
          data: {
            isRestricted: true,
            restrictedAt: new Date(),
            restrictionReason: `Auto-restricted: Balance ${balance.currentBalance} exceeds threshold ${threshold.thresholdValue}`,
          },
        });

        return {
          restricted: true,
          reason: `Negative balance exceeds maximum threshold. Please settle your outstanding balance.`,
          balance: Number(balance.currentBalance),
        };
      }
    }

    return { restricted: false };
  } catch (error) {
    console.error("[SettlementEnforcement] Check error:", error);
    return { restricted: false };
  }
}

export const enforceSettlementMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next();
  }

  const { id: userId, role: userRole } = req.user;

  if (["admin", "ADMIN", "super_admin", "SUPER_ADMIN", "customer", "CUSTOMER"].includes(userRole)) {
    return next();
  }

  const result = await checkSettlementRestriction(userId, userRole);

  if (result.restricted) {
    return res.status(403).json({
      error: "Settlement restriction active",
      message: result.reason,
      outstandingBalance: result.balance,
      settlementRequired: true,
      redirectTo: "/settlement/pay",
    });
  }

  next();
};

export const enforceDriverSettlement = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next();
  }

  const { id: userId, role: userRole } = req.user;

  if (!["driver", "DRIVER", "bd_driver"].includes(userRole)) {
    return next();
  }

  const result = await checkSettlementRestriction(userId, userRole);

  if (result.restricted) {
    return res.status(403).json({
      error: "Cannot accept rides",
      message: "Your account is restricted due to outstanding balance. Please settle before accepting new rides.",
      outstandingBalance: result.balance,
      settlementRequired: true,
    });
  }

  next();
};

export const enforceRestaurantSettlement = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next();
  }

  const { id: userId, role: userRole } = req.user;

  if (!["restaurant", "RESTAURANT", "restaurant_owner"].includes(userRole)) {
    return next();
  }

  const result = await checkSettlementRestriction(userId, userRole);

  if (result.restricted) {
    return res.status(403).json({
      error: "Cannot accept orders",
      message: "Your restaurant is restricted due to outstanding balance. Please settle before accepting new orders.",
      outstandingBalance: result.balance,
      settlementRequired: true,
    });
  }

  next();
};

export async function updateNegativeBalanceOnCashTrip(
  driverId: string,
  commissionAmount: number,
  countryCode: string = "BD"
): Promise<void> {
  try {
    await prisma.driverNegativeBalance.upsert({
      where: { driverId },
      create: {
        driverId,
        countryCode,
        currentBalance: commissionAmount,
        totalCashTrips: 1,
        totalCashCollected: commissionAmount,
        totalCommissionDue: commissionAmount,
        lastUpdated: new Date(),
      },
      update: {
        currentBalance: { increment: commissionAmount },
        totalCashTrips: { increment: 1 },
        totalCashCollected: { increment: commissionAmount },
        totalCommissionDue: { increment: commissionAmount },
        lastUpdated: new Date(),
      },
    });

    console.log(`[SettlementEnforcement] Driver ${driverId} balance updated by ${commissionAmount}`);
  } catch (error) {
    console.error("[SettlementEnforcement] Update balance error:", error);
  }
}

export async function updateNegativeBalanceOnCashOrder(
  restaurantId: string,
  commissionAmount: number,
  countryCode: string = "BD"
): Promise<void> {
  try {
    await prisma.restaurantNegativeBalance.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        countryCode,
        currentBalance: commissionAmount,
        totalCashOrders: 1,
        totalCashCollected: commissionAmount,
        totalCommissionDue: commissionAmount,
        lastUpdated: new Date(),
      },
      update: {
        currentBalance: { increment: commissionAmount },
        totalCashOrders: { increment: 1 },
        totalCashCollected: { increment: commissionAmount },
        totalCommissionDue: { increment: commissionAmount },
        lastUpdated: new Date(),
      },
    });

    console.log(`[SettlementEnforcement] Restaurant ${restaurantId} balance updated by ${commissionAmount}`);
  } catch (error) {
    console.error("[SettlementEnforcement] Update balance error:", error);
  }
}

export async function reduceNegativeBalanceOnOnlinePayment(
  userId: string,
  userType: "driver" | "restaurant",
  amount: number
): Promise<void> {
  try {
    if (userType === "driver") {
      await prisma.driverNegativeBalance.update({
        where: { driverId: userId },
        data: {
          currentBalance: { decrement: amount },
          totalOnlineSettled: { increment: amount },
          lastUpdated: new Date(),
        },
      });
    } else {
      await prisma.restaurantNegativeBalance.update({
        where: { restaurantId: userId },
        data: {
          currentBalance: { decrement: amount },
          totalOnlineSettled: { increment: amount },
          lastUpdated: new Date(),
        },
      });
    }

    console.log(`[SettlementEnforcement] ${userType} ${userId} balance reduced by ${amount}`);
  } catch (error) {
    console.error("[SettlementEnforcement] Reduce balance error:", error);
  }
}
