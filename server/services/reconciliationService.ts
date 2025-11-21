import { WalletOwnerType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db";

interface ReconciliationMismatch {
  type: "missing" | "duplicate" | "amount_mismatch";
  severity: "critical" | "warning" | "info";
  orderId: string;
  orderType: "ride" | "food" | "parcel";
  expectedAmount: string;
  actualAmount?: string;
  transactionId?: string;
  details: string;
}

interface ReconciliationReport {
  periodStart: Date;
  periodEnd: Date;
  ownerType?: WalletOwnerType;
  countryCode?: string;
  totalOrders: number;
  totalTransactions: number;
  totalMismatches: number;
  mismatches: ReconciliationMismatch[];
  summary: {
    missingTransactions: number;
    duplicateTransactions: number;
    amountMismatches: number;
  };
}

export async function reconcileWalletTransactions(params: {
  periodStart: Date;
  periodEnd: Date;
  ownerType?: WalletOwnerType;
  countryCode?: string;
}): Promise<ReconciliationReport> {
  const { periodStart, periodEnd, ownerType, countryCode } = params;

  const mismatches: ReconciliationMismatch[] = [];

  // Reconcile rides
  const rideMismatches = await reconcileRides(periodStart, periodEnd, ownerType, countryCode);
  mismatches.push(...rideMismatches);

  // Reconcile food orders
  const foodMismatches = await reconcileFoodOrders(periodStart, periodEnd, ownerType, countryCode);
  mismatches.push(...foodMismatches);

  // Reconcile parcels
  const parcelMismatches = await reconcileParcels(periodStart, periodEnd, ownerType, countryCode);
  mismatches.push(...parcelMismatches);

  // Calculate summary
  const summary = {
    missingTransactions: mismatches.filter((m) => m.type === "missing").length,
    duplicateTransactions: mismatches.filter((m) => m.type === "duplicate").length,
    amountMismatches: mismatches.filter((m) => m.type === "amount_mismatch").length,
  };

  // Count total orders and transactions for the period
  const totalOrders = await countOrdersInPeriod(periodStart, periodEnd, ownerType, countryCode);
  const totalTransactions = await countTransactionsInPeriod(
    periodStart,
    periodEnd,
    ownerType,
    countryCode
  );

  return {
    periodStart,
    periodEnd,
    ownerType,
    countryCode,
    totalOrders,
    totalTransactions,
    totalMismatches: mismatches.length,
    mismatches,
    summary,
  };
}

async function reconcileRides(
  periodStart: Date,
  periodEnd: Date,
  ownerType?: WalletOwnerType,
  countryCode?: string
): Promise<ReconciliationMismatch[]> {
  const mismatches: ReconciliationMismatch[] = [];

  // Only reconcile driver wallets for rides
  if (ownerType && ownerType !== "driver") {
    return mismatches;
  }

  const rideFilters: any = {
    completedAt: {
      gte: periodStart,
      lte: periodEnd,
    },
    status: "completed",
  };

  const rides = await prisma.ride.findMany({
    where: rideFilters,
    include: {
      driver: {
        include: {
          user: true,
        },
      },
    },
  });

  for (const ride of rides) {
    if (!ride.driver) continue;

    if (countryCode && ride.driver.user.countryCode !== countryCode) {
      continue;
    }

    // Find all corresponding wallet transactions (to detect both missing and duplicates)
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        referenceType: "ride",
        referenceId: ride.id,
        ownerType: "driver",
      },
    });

    if (transactions.length === 0) {
      mismatches.push({
        type: "missing",
        severity: "critical",
        orderId: ride.id,
        orderType: "ride",
        expectedAmount: ride.driverPayout?.toString() || "0",
        details: `Missing wallet transaction for completed ride ${ride.id}`,
      });
      continue;
    }

    if (transactions.length > 1) {
      mismatches.push({
        type: "duplicate",
        severity: "critical",
        orderId: ride.id,
        orderType: "ride",
        expectedAmount: ride.driverPayout?.toString() || "0",
        actualAmount: transactions[0].amount.toString(),
        transactionId: transactions[0].id,
        details: `Found ${transactions.length} wallet transactions for ride ${ride.id}`,
      });
    }

    // Verify amount using first transaction (driver payout should match transaction amount)
    const transaction = transactions[0];
    const expectedAmount = ride.driverPayout || new Decimal(0);
    const amountDifference = transaction.amount.abs().minus(expectedAmount).abs();
    const allowedVariance = expectedAmount.mul(0.1); // 10% variance

    if (amountDifference.gt(allowedVariance)) {
      mismatches.push({
        type: "amount_mismatch",
        severity: "warning",
        orderId: ride.id,
        orderType: "ride",
        expectedAmount: expectedAmount.toString(),
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Amount mismatch for ride ${ride.id}: expected ${expectedAmount}, got ${transaction.amount}`,
      });
    }
  }

  return mismatches;
}

async function reconcileFoodOrders(
  periodStart: Date,
  periodEnd: Date,
  ownerType?: WalletOwnerType,
  countryCode?: string
): Promise<ReconciliationMismatch[]> {
  const mismatches: ReconciliationMismatch[] = [];

  // Only reconcile restaurant wallets for food orders
  if (ownerType && ownerType !== "restaurant") {
    return mismatches;
  }

  const orderFilters: any = {
    deliveredAt: {
      gte: periodStart,
      lte: periodEnd,
    },
    status: "delivered",
  };

  const foodOrders = await prisma.foodOrder.findMany({
    where: orderFilters,
    include: {
      restaurant: {
        include: {
          user: true,
        },
      },
    },
  });

  for (const order of foodOrders) {
    if (!order.restaurant) continue;

    if (countryCode && order.restaurant.user.countryCode !== countryCode) {
      continue;
    }

    // Find all corresponding wallet transactions (to detect both missing and duplicates)
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        referenceType: "food_order",
        referenceId: order.id,
        ownerType: "restaurant",
      },
    });

    if (transactions.length === 0) {
      mismatches.push({
        type: "missing",
        severity: "critical",
        orderId: order.id,
        orderType: "food",
        expectedAmount: order.restaurantPayout?.toString() || "0",
        details: `Missing wallet transaction for delivered food order ${order.id}`,
      });
      continue;
    }

    if (transactions.length > 1) {
      mismatches.push({
        type: "duplicate",
        severity: "critical",
        orderId: order.id,
        orderType: "food",
        expectedAmount: order.restaurantPayout?.toString() || "0",
        actualAmount: transactions[0].amount.toString(),
        transactionId: transactions[0].id,
        details: `Found ${transactions.length} wallet transactions for food order ${order.id}`,
      });
    }

    // Verify amount using first transaction (restaurant payout should match transaction amount)
    const transaction = transactions[0];
    const expectedAmount = order.restaurantPayout || new Decimal(0);
    const amountDifference = transaction.amount.abs().minus(expectedAmount).abs();
    const allowedVariance = expectedAmount.mul(0.1); // 10% variance

    if (amountDifference.gt(allowedVariance)) {
      mismatches.push({
        type: "amount_mismatch",
        severity: "warning",
        orderId: order.id,
        orderType: "food",
        expectedAmount: expectedAmount.toString(),
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Amount mismatch for food order ${order.id}: expected ${expectedAmount}, got ${transaction.amount}`,
      });
    }
  }

  return mismatches;
}

async function reconcileParcels(
  periodStart: Date,
  periodEnd: Date,
  ownerType?: WalletOwnerType,
  countryCode?: string
): Promise<ReconciliationMismatch[]> {
  const mismatches: ReconciliationMismatch[] = [];

  // Only reconcile driver wallets for parcels
  if (ownerType && ownerType !== "driver") {
    return mismatches;
  }

  const parcelFilters: any = {
    deliveredAt: {
      gte: periodStart,
      lte: periodEnd,
    },
    status: "delivered",
  };

  const deliveries = await prisma.delivery.findMany({
    where: parcelFilters,
    include: {
      driver: {
        include: {
          user: true,
        },
      },
    },
  });

  for (const delivery of deliveries) {
    if (!delivery.driver) continue;

    if (countryCode && delivery.driver.user.countryCode !== countryCode) {
      continue;
    }

    // Find all corresponding wallet transactions (to detect both missing and duplicates)
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        referenceType: "delivery",
        referenceId: delivery.id,
        ownerType: "driver",
      },
    });

    if (transactions.length === 0) {
      mismatches.push({
        type: "missing",
        severity: "critical",
        orderId: delivery.id,
        orderType: "parcel",
        expectedAmount: delivery.driverPayout?.toString() || "0",
        details: `Missing wallet transaction for delivered parcel ${delivery.id}`,
      });
      continue;
    }

    if (transactions.length > 1) {
      mismatches.push({
        type: "duplicate",
        severity: "critical",
        orderId: delivery.id,
        orderType: "parcel",
        expectedAmount: delivery.driverPayout?.toString() || "0",
        actualAmount: transactions[0].amount.toString(),
        transactionId: transactions[0].id,
        details: `Found ${transactions.length} wallet transactions for parcel ${delivery.id}`,
      });
    }

    // Verify amount using first transaction (driver payout should match transaction amount)
    const transaction = transactions[0];
    const expectedAmount = delivery.driverPayout || new Decimal(0);
    const amountDifference = transaction.amount.abs().minus(expectedAmount).abs();
    const allowedVariance = expectedAmount.mul(0.1); // 10% variance

    if (amountDifference.gt(allowedVariance)) {
      mismatches.push({
        type: "amount_mismatch",
        severity: "warning",
        orderId: delivery.id,
        orderType: "parcel",
        expectedAmount: expectedAmount.toString(),
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Amount mismatch for parcel ${delivery.id}: expected ${expectedAmount}, got ${transaction.amount}`,
      });
    }
  }

  return mismatches;
}

async function countOrdersInPeriod(
  periodStart: Date,
  periodEnd: Date,
  ownerType?: WalletOwnerType,
  countryCode?: string
): Promise<number> {
  let total = 0;

  // Count rides (filtered by driver's country if countryCode is provided)
  if (!ownerType || ownerType === "driver") {
    const rideWhere: any = {
      completedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: "completed",
    };
    
    if (countryCode) {
      rideWhere.driver = {
        user: {
          countryCode: countryCode,
        },
      };
    }
    
    total += await prisma.ride.count({
      where: rideWhere,
    });
  }

  // Count food orders (filtered by restaurant's country if countryCode is provided)
  if (!ownerType || ownerType === "restaurant") {
    const orderWhere: any = {
      deliveredAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: "delivered",
    };
    
    if (countryCode) {
      orderWhere.restaurant = {
        user: {
          countryCode: countryCode,
        },
      };
    }
    
    total += await prisma.foodOrder.count({
      where: orderWhere,
    });
  }

  // Count parcels (deliveries) (filtered by driver's country if countryCode is provided)
  if (!ownerType || ownerType === "driver") {
    const deliveryWhere: any = {
      deliveredAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: "delivered",
    };
    
    if (countryCode) {
      deliveryWhere.driver = {
        user: {
          countryCode: countryCode,
        },
      };
    }
    
    total += await prisma.delivery.count({
      where: deliveryWhere,
    });
  }

  return total;
}

async function countTransactionsInPeriod(
  periodStart: Date,
  periodEnd: Date,
  ownerType?: WalletOwnerType,
  countryCode?: string
): Promise<number> {
  // Build base filters - WalletTransaction has countryCode field directly
  const filters: any = {
    createdAt: {
      gte: periodStart,
      lte: periodEnd,
    },
    referenceType: {
      in: ["ride", "food_order", "delivery"],
    },
  };

  if (ownerType) {
    filters.ownerType = ownerType;
  }

  if (countryCode) {
    filters.countryCode = countryCode;
  }

  return await prisma.walletTransaction.count({
    where: filters,
  });
}

export async function getReconciliationHistory(limit: number = 10) {
  // This would ideally be stored in a separate table, but for now we'll return recent audit logs
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      actionType: {
        in: ["RECONCILIATION_INITIATED", "RECONCILIATION_COMPLETED", "RECONCILIATION_MISMATCH_FOUND"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return auditLogs;
}
