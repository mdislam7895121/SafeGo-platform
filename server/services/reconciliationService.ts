import { PrismaClient, WalletOwnerType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

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

    // Find corresponding wallet transaction
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        referenceType: "ride",
        referenceId: ride.id,
        ownerType: "driver",
      },
    });

    if (!transaction) {
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

    // Check for duplicates
    const duplicates = await prisma.walletTransaction.findMany({
      where: {
        referenceType: "ride",
        referenceId: ride.id,
        ownerType: "driver",
      },
    });

    if (duplicates.length > 1) {
      mismatches.push({
        type: "duplicate",
        severity: "critical",
        orderId: ride.id,
        orderType: "ride",
        expectedAmount: ride.driverPayout?.toString() || "0",
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Found ${duplicates.length} wallet transactions for ride ${ride.id}`,
      });
    }

    // Verify amount (driver payout should match transaction amount)
    const expectedAmount = ride.driverPayout || new Decimal(0);
    if (transaction.amount.abs().gt(expectedAmount.mul(1.1))) {
      // Allow 10% variance for commission calculations
      mismatches.push({
        type: "amount_mismatch",
        severity: "warning",
        orderId: ride.id,
        orderType: "ride",
        expectedAmount: expectedAmount.toString(),
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Amount mismatch for ride ${ride.id}: expected ~${expectedAmount}, got ${transaction.amount}`,
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

    // Find corresponding wallet transaction
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        referenceType: "food_order",
        referenceId: order.id,
        ownerType: "restaurant",
      },
    });

    if (!transaction) {
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

    // Check for duplicates
    const duplicates = await prisma.walletTransaction.findMany({
      where: {
        referenceType: "food_order",
        referenceId: order.id,
        ownerType: "restaurant",
      },
    });

    if (duplicates.length > 1) {
      mismatches.push({
        type: "duplicate",
        severity: "critical",
        orderId: order.id,
        orderType: "food",
        expectedAmount: order.restaurantPayout?.toString() || "0",
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Found ${duplicates.length} wallet transactions for food order ${order.id}`,
      });
    }

    // Verify amount (restaurant payout should match transaction amount)
    const expectedAmount = order.restaurantPayout || new Decimal(0);
    if (transaction.amount.abs().gt(expectedAmount.mul(1.1))) {
      mismatches.push({
        type: "amount_mismatch",
        severity: "warning",
        orderId: order.id,
        orderType: "food",
        expectedAmount: expectedAmount.toString(),
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Amount mismatch for food order ${order.id}`,
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

    // Find corresponding wallet transaction
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        referenceType: "delivery",
        referenceId: delivery.id,
        ownerType: "driver",
      },
    });

    if (!transaction) {
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

    // Check for duplicates
    const duplicates = await prisma.walletTransaction.findMany({
      where: {
        referenceType: "delivery",
        referenceId: delivery.id,
        ownerType: "driver",
      },
    });

    if (duplicates.length > 1) {
      mismatches.push({
        type: "duplicate",
        severity: "critical",
        orderId: delivery.id,
        orderType: "parcel",
        expectedAmount: delivery.driverPayout?.toString() || "0",
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Found ${duplicates.length} wallet transactions for parcel ${delivery.id}`,
      });
    }

    // Verify amount (driver payout should match transaction amount)
    const expectedAmount = delivery.driverPayout || new Decimal(0);
    if (transaction.amount.abs().gt(expectedAmount.mul(1.1))) {
      mismatches.push({
        type: "amount_mismatch",
        severity: "warning",
        orderId: delivery.id,
        orderType: "parcel",
        expectedAmount: expectedAmount.toString(),
        actualAmount: transaction.amount.toString(),
        transactionId: transaction.id,
        details: `Amount mismatch for parcel ${delivery.id}`,
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
  const filters: any = {
    createdAt: {
      gte: periodStart,
      lte: periodEnd,
    },
    referenceType: {
      in: ["ride", "food_order", "parcel"],
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
