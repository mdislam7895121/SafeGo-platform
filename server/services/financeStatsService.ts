import { prisma } from "../db";
import { Prisma } from "@prisma/client";

export interface OverviewStatsParams {
  fromDate?: Date;
  toDate?: Date;
  countryCode?: string;
  serviceType?: "ride" | "food" | "delivery";
}

export interface GatewayReportParams {
  countryCode?: string;
  provider?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  serviceType?: "ride" | "food" | "delivery";
  fromDate?: Date;
  toDate?: Date;
  page: number;
  pageSize: number;
}

export interface BalanceParams {
  countryCode?: string;
  minNegative?: number;
  search?: string;
  page: number;
  pageSize: number;
}

export interface SettlementsHistoryParams {
  userType?: "driver" | "restaurant";
  userId?: string;
  countryCode?: string;
  fromDate?: Date;
  toDate?: Date;
  adminId?: string;
  method?: string;
  page: number;
  pageSize: number;
}

class FinanceStatsService {
  async getOverviewStats(params: OverviewStatsParams) {
    const { fromDate, toDate, countryCode, serviceType } = params;
    
    const dateFilter = {
      ...(fromDate && { gte: fromDate }),
      ...(toDate && { lte: toDate }),
    };

    const [
      rideStats,
      foodStats,
      deliveryStats,
      driverBalances,
      restaurantBalances,
    ] = await Promise.all([
      this.getRideRevenueStats(dateFilter, countryCode, serviceType === "ride" || !serviceType),
      this.getFoodRevenueStats(dateFilter, countryCode, serviceType === "food" || !serviceType),
      this.getDeliveryRevenueStats(dateFilter, countryCode, serviceType === "delivery" || !serviceType),
      prisma.driverNegativeBalance.aggregate({
        where: {
          currentBalance: { gt: 0 },
          ...(countryCode && { countryCode }),
        },
        _sum: { currentBalance: true },
        _count: true,
      }),
      prisma.restaurantNegativeBalance.aggregate({
        where: {
          currentBalance: { gt: 0 },
          ...(countryCode && { countryCode }),
        },
        _sum: { currentBalance: true },
        _count: true,
      }),
    ]);

    const onlineRevenueByCountry = [
      { countryCode: "BD", currency: "BDT", totalAmount: 0 },
      { countryCode: "US", currency: "USD", totalAmount: 0 },
    ];
    const cashCommissionByCountry = [
      { countryCode: "BD", currency: "BDT", totalCommission: 0 },
      { countryCode: "US", currency: "USD", totalCommission: 0 },
    ];

    const allStats = [
      ...(rideStats || []),
      ...(foodStats || []),
      ...(deliveryStats || []),
    ];

    for (const stat of allStats) {
      const idx = stat.countryCode === "US" ? 1 : 0;
      if (stat.paymentMethod !== "cash") {
        onlineRevenueByCountry[idx].totalAmount += Number(stat.totalAmount);
      } else {
        cashCommissionByCountry[idx].totalCommission += Number(stat.commission);
      }
    }

    const topDriversByNegativeBalance = await prisma.driverNegativeBalance.findMany({
      where: {
        currentBalance: { gt: 0 },
        ...(countryCode && { countryCode }),
      },
      orderBy: { currentBalance: "desc" },
      take: 10,
      select: {
        driverId: true,
        driverName: true,
        countryCode: true,
        currentBalance: true,
      },
    });

    const topRestaurantsByNegativeBalance = await prisma.restaurantNegativeBalance.findMany({
      where: {
        currentBalance: { gt: 0 },
        ...(countryCode && { countryCode }),
      },
      orderBy: { currentBalance: "desc" },
      take: 10,
      select: {
        restaurantId: true,
        restaurantName: true,
        countryCode: true,
        currentBalance: true,
      },
    });

    return {
      totalOnlineRevenueByCountry: onlineRevenueByCountry,
      totalCashCommissionByCountry: cashCommissionByCountry,
      totalDriverNegativeBalance: {
        count: driverBalances._count,
        totalAmount: Number(driverBalances._sum.currentBalance || 0),
      },
      totalRestaurantNegativeBalance: {
        count: restaurantBalances._count,
        totalAmount: Number(restaurantBalances._sum.currentBalance || 0),
      },
      topDriversByNegativeBalance,
      topRestaurantsByNegativeBalance,
      revenueByService: {
        ride: rideStats?.reduce((sum, s) => sum + Number(s.totalAmount), 0) || 0,
        food: foodStats?.reduce((sum, s) => sum + Number(s.totalAmount), 0) || 0,
        delivery: deliveryStats?.reduce((sum, s) => sum + Number(s.totalAmount), 0) || 0,
      },
    };
  }

  private async getRideRevenueStats(dateFilter: any, countryCode?: string, include = true) {
    if (!include) return [];
    
    const rides = await prisma.ride.groupBy({
      by: ["paymentMethod", "countryCode"],
      where: {
        status: "completed",
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        ...(countryCode && { countryCode }),
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
      },
      _count: true,
    });

    return rides.map((r) => ({
      serviceType: "ride",
      countryCode: r.countryCode || "BD",
      paymentMethod: r.paymentMethod || "cash",
      totalAmount: r._sum.serviceFare || 0,
      commission: r._sum.safegoCommission || 0,
      count: r._count,
    }));
  }

  private async getFoodRevenueStats(dateFilter: any, countryCode?: string, include = true) {
    if (!include) return [];
    
    const foods = await prisma.foodOrder.groupBy({
      by: ["paymentMethod", "countryCode"],
      where: {
        status: "delivered",
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        ...(countryCode && { countryCode }),
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
      },
      _count: true,
    });

    return foods.map((f) => ({
      serviceType: "food",
      countryCode: f.countryCode || "BD",
      paymentMethod: f.paymentMethod || "cash",
      totalAmount: f._sum.serviceFare || 0,
      commission: f._sum.safegoCommission || 0,
      count: f._count,
    }));
  }

  private async getDeliveryRevenueStats(dateFilter: any, countryCode?: string, include = true) {
    if (!include) return [];
    
    const deliveries = await prisma.delivery.groupBy({
      by: ["paymentMethod", "countryCode"],
      where: {
        status: "delivered",
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        ...(countryCode && { countryCode }),
      },
      _sum: {
        totalFare: true,
        safegoCommission: true,
      },
      _count: true,
    });

    return deliveries.map((d) => ({
      serviceType: "delivery",
      countryCode: d.countryCode || "BD",
      paymentMethod: d.paymentMethod || "cash",
      totalAmount: d._sum.totalFare || 0,
      commission: d._sum.safegoCommission || 0,
      count: d._count,
    }));
  }

  async getGatewayReport(params: GatewayReportParams) {
    const { countryCode, provider, paymentMethod, paymentStatus, serviceType, fromDate, toDate, page, pageSize } = params;
    
    const dateFilter = {
      ...(fromDate && { gte: fromDate }),
      ...(toDate && { lte: toDate }),
    };

    const buildWhere = (table: "ride" | "food" | "delivery") => {
      const base: any = {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        ...(countryCode && { countryCode }),
        ...(paymentMethod && { paymentMethod }),
        ...(provider && { paymentProvider: provider }),
      };
      
      if (table === "ride") {
        base.status = paymentStatus === "captured" ? "completed" : { not: "cancelled" };
      } else if (table === "food") {
        base.status = paymentStatus === "captured" ? "delivered" : { not: "cancelled" };
      } else {
        base.status = paymentStatus === "captured" ? "delivered" : { not: "cancelled" };
      }
      
      return base;
    };

    const results: any[] = [];
    const skip = (page - 1) * pageSize;
    const take = Math.ceil(pageSize / 3);

    if (!serviceType || serviceType === "ride") {
      const rides = await prisma.ride.findMany({
        where: buildWhere("ride"),
        select: {
          id: true,
          customerId: true,
          driverId: true,
          countryCode: true,
          paymentProvider: true,
          paymentMethod: true,
          paymentStatus: true,
          paymentReferenceId: true,
          serviceFare: true,
          safegoCommission: true,
          currency: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
        skip: serviceType ? skip : 0,
        take: serviceType ? pageSize : take,
      });

      results.push(...rides.map((r) => ({
        orderType: "ride",
        orderId: r.id,
        customerId: r.customerId,
        driverId: r.driverId,
        restaurantId: null,
        countryCode: r.countryCode || "BD",
        paymentProvider: r.paymentProvider || "cash",
        paymentMethod: r.paymentMethod || "cash",
        paymentStatus: r.paymentStatus || (r.status === "completed" ? "captured" : "pending"),
        paymentReferenceId: r.paymentReferenceId,
        currency: r.currency || (r.countryCode === "US" ? "USD" : "BDT"),
        amount: Number(r.serviceFare || 0),
        commissionAmount: Number(r.safegoCommission || 0),
        createdAt: r.createdAt,
      })));
    }

    if (!serviceType || serviceType === "food") {
      const foods = await prisma.foodOrder.findMany({
        where: buildWhere("food"),
        select: {
          id: true,
          customerId: true,
          driverId: true,
          restaurantId: true,
          countryCode: true,
          paymentProvider: true,
          paymentMethod: true,
          paymentStatus: true,
          paymentReferenceId: true,
          serviceFare: true,
          safegoCommission: true,
          currency: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
        skip: serviceType ? skip : 0,
        take: serviceType ? pageSize : take,
      });

      results.push(...foods.map((f) => ({
        orderType: "food",
        orderId: f.id,
        customerId: f.customerId,
        driverId: f.driverId,
        restaurantId: f.restaurantId,
        countryCode: f.countryCode || "BD",
        paymentProvider: f.paymentProvider || "cash",
        paymentMethod: f.paymentMethod || "cash",
        paymentStatus: f.paymentStatus || (f.status === "delivered" ? "captured" : "pending"),
        paymentReferenceId: f.paymentReferenceId,
        currency: f.currency || (f.countryCode === "US" ? "USD" : "BDT"),
        amount: Number(f.serviceFare || 0),
        commissionAmount: Number(f.safegoCommission || 0),
        createdAt: f.createdAt,
      })));
    }

    if (!serviceType || serviceType === "delivery") {
      const deliveries = await prisma.delivery.findMany({
        where: buildWhere("delivery"),
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          driverId: true,
          countryCode: true,
          paymentProvider: true,
          paymentMethod: true,
          paymentStatus: true,
          paymentReferenceId: true,
          totalFare: true,
          safegoCommission: true,
          currency: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
        skip: serviceType ? skip : 0,
        take: serviceType ? pageSize : take,
      });

      results.push(...deliveries.map((d) => ({
        orderType: "delivery",
        orderId: d.id,
        customerId: d.senderId,
        driverId: d.driverId,
        restaurantId: null,
        countryCode: d.countryCode || "BD",
        paymentProvider: d.paymentProvider || "cash",
        paymentMethod: d.paymentMethod || "cash",
        paymentStatus: d.paymentStatus || (d.status === "delivered" ? "captured" : "pending"),
        paymentReferenceId: d.paymentReferenceId,
        currency: d.currency || (d.countryCode === "US" ? "USD" : "BDT"),
        amount: Number(d.totalFare || 0),
        commissionAmount: Number(d.safegoCommission || 0),
        createdAt: d.createdAt,
      })));
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
      totalTransactions: results.length,
      totalCapturedAmount: results.filter(r => r.paymentStatus === "captured").reduce((sum, r) => sum + r.amount, 0),
      totalFailedAmount: results.filter(r => r.paymentStatus === "failed").reduce((sum, r) => sum + r.amount, 0),
      totalOnlineCommission: results.filter(r => r.paymentMethod !== "cash").reduce((sum, r) => sum + r.commissionAmount, 0),
    };

    return {
      data: results.slice(0, pageSize),
      total: results.length,
      page,
      pageSize,
      summary,
    };
  }

  async getDriverBalances(params: BalanceParams) {
    const { countryCode, minNegative, search, page, pageSize } = params;
    
    const where: any = {
      currentBalance: { gt: minNegative || 0 },
      ...(countryCode && { countryCode }),
      ...(search && {
        OR: [
          { driverId: { contains: search, mode: "insensitive" } },
          { driverName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.driverNegativeBalance.findMany({
        where,
        orderBy: { currentBalance: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.driverNegativeBalance.count({ where }),
    ]);

    const driverIds = data.map((d) => d.driverId);
    
    const [rideUnsettled, foodUnsettled, deliveryUnsettled] = await Promise.all([
      prisma.ride.groupBy({
        by: ["driverId"],
        where: {
          driverId: { in: driverIds },
          isCommissionSettled: false,
          status: "completed",
        },
        _count: true,
      }),
      prisma.foodOrder.groupBy({
        by: ["driverId"],
        where: {
          driverId: { in: driverIds },
          isCommissionSettled: false,
          status: "delivered",
        },
        _count: true,
      }),
      prisma.delivery.groupBy({
        by: ["driverId"],
        where: {
          driverId: { in: driverIds },
          isCommissionSettled: false,
          status: "delivered",
        },
        _count: true,
      }),
    ]);

    const unsettledCounts = new Map<string, number>();
    for (const r of rideUnsettled) {
      unsettledCounts.set(r.driverId, (unsettledCounts.get(r.driverId) || 0) + r._count);
    }
    for (const f of foodUnsettled) {
      if (f.driverId) unsettledCounts.set(f.driverId, (unsettledCounts.get(f.driverId) || 0) + f._count);
    }
    for (const d of deliveryUnsettled) {
      if (d.driverId) unsettledCounts.set(d.driverId, (unsettledCounts.get(d.driverId) || 0) + d._count);
    }

    return {
      data: data.map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        countryCode: d.countryCode,
        currentBalance: Number(d.currentBalance),
        negativeBalance: Number(d.currentBalance),
        unsettledOrdersCount: unsettledCounts.get(d.driverId) || 0,
        isRestricted: d.isRestricted,
        lastUpdated: d.lastUpdated,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getRestaurantBalances(params: BalanceParams) {
    const { countryCode, minNegative, search, page, pageSize } = params;
    
    const where: any = {
      currentBalance: { gt: minNegative || 0 },
      ...(countryCode && { countryCode }),
      ...(search && {
        OR: [
          { restaurantId: { contains: search, mode: "insensitive" } },
          { restaurantName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.restaurantNegativeBalance.findMany({
        where,
        orderBy: { currentBalance: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.restaurantNegativeBalance.count({ where }),
    ]);

    const restaurantIds = data.map((r) => r.restaurantId);
    
    const foodUnsettled = await prisma.foodOrder.groupBy({
      by: ["restaurantId"],
      where: {
        restaurantId: { in: restaurantIds },
        isCommissionSettled: false,
        status: "delivered",
      },
      _count: true,
    });

    const unsettledCounts = new Map<string, number>();
    for (const f of foodUnsettled) {
      unsettledCounts.set(f.restaurantId, f._count);
    }

    return {
      data: data.map((r) => ({
        restaurantId: r.restaurantId,
        restaurantName: r.restaurantName,
        countryCode: r.countryCode,
        currentBalance: Number(r.currentBalance),
        negativeBalance: Number(r.currentBalance),
        unsettledOrdersCount: unsettledCounts.get(r.restaurantId) || 0,
        isRestricted: r.isRestricted,
        lastUpdated: r.lastUpdated,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getDriverUnsettledOrders(driverId: string) {
    const [rides, foods, deliveries] = await Promise.all([
      prisma.ride.findMany({
        where: {
          driverId,
          isCommissionSettled: false,
          status: "completed",
        },
        select: {
          id: true,
          createdAt: true,
          serviceFare: true,
          safegoCommission: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.foodOrder.findMany({
        where: {
          driverId,
          isCommissionSettled: false,
          status: "delivered",
        },
        select: {
          id: true,
          createdAt: true,
          serviceFare: true,
          safegoCommission: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.delivery.findMany({
        where: {
          driverId,
          isCommissionSettled: false,
          status: "delivered",
        },
        select: {
          id: true,
          createdAt: true,
          totalFare: true,
          safegoCommission: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      rides: rides.map((r) => ({
        orderType: "ride",
        orderId: r.id,
        date: r.createdAt,
        amount: Number(r.serviceFare || 0),
        commissionAmount: Number(r.safegoCommission || 0),
        paymentMethod: r.paymentMethod,
      })),
      foods: foods.map((f) => ({
        orderType: "food",
        orderId: f.id,
        date: f.createdAt,
        amount: Number(f.serviceFare || 0),
        commissionAmount: Number(f.safegoCommission || 0),
        paymentMethod: f.paymentMethod,
      })),
      deliveries: deliveries.map((d) => ({
        orderType: "delivery",
        orderId: d.id,
        date: d.createdAt,
        amount: Number(d.totalFare || 0),
        commissionAmount: Number(d.safegoCommission || 0),
        paymentMethod: d.paymentMethod,
      })),
    };
  }

  async getRestaurantUnsettledOrders(restaurantId: string) {
    const foods = await prisma.foodOrder.findMany({
      where: {
        restaurantId,
        isCommissionSettled: false,
        status: "delivered",
      },
      select: {
        id: true,
        createdAt: true,
        serviceFare: true,
        safegoCommission: true,
        paymentMethod: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      foods: foods.map((f) => ({
        orderType: "food",
        orderId: f.id,
        date: f.createdAt,
        amount: Number(f.serviceFare || 0),
        commissionAmount: Number(f.safegoCommission || 0),
        paymentMethod: f.paymentMethod,
      })),
    };
  }

  async getSettlementsHistory(params: SettlementsHistoryParams) {
    const { userType, userId, countryCode, fromDate, toDate, adminId, method, page, pageSize } = params;
    
    const where: any = {
      ...(userType && { userType }),
      ...(userId && { userId }),
      ...(countryCode && { countryCode }),
      ...(adminId && { createdByAdminId: adminId }),
      ...(method && { method }),
      ...(fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      },
    };

    const [data, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        include: {
          orders: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.settlement.count({ where }),
    ]);

    return {
      data: data.map((s) => ({
        id: s.id,
        userType: s.userType,
        userId: s.userId,
        userName: s.userName,
        countryCode: s.countryCode,
        totalAmount: Number(s.totalAmount),
        currency: s.currency,
        method: s.method,
        reference: s.reference,
        notes: s.notes,
        status: s.status,
        createdByAdminId: s.createdByAdminId,
        createdByAdminName: s.createdByAdminName,
        createdAt: s.createdAt,
        ordersCount: s.orders.length,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getSettlementDetails(settlementId: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        orders: true,
      },
    });

    if (!settlement) return null;

    return {
      ...settlement,
      totalAmount: Number(settlement.totalAmount),
      orders: settlement.orders.map((o) => ({
        ...o,
        commissionAmountApplied: Number(o.commissionAmountApplied),
      })),
    };
  }

  async createSettlement(data: {
    userType: "driver" | "restaurant";
    userId: string;
    userName?: string;
    countryCode: string;
    totalAmount: number;
    currency: string;
    method: string;
    reference?: string;
    notes?: string;
    orderIds: Array<{ orderType: "ride" | "food" | "delivery"; orderId: string; commissionAmount: number }>;
    adminId: string;
    adminName?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          userType: data.userType,
          userId: data.userId,
          userName: data.userName,
          countryCode: data.countryCode,
          totalAmount: data.totalAmount,
          currency: data.currency,
          method: data.method as any,
          reference: data.reference,
          notes: data.notes,
          createdByAdminId: data.adminId,
          createdByAdminName: data.adminName,
          status: "completed",
          orders: {
            create: data.orderIds.map((o) => ({
              orderType: o.orderType,
              orderId: o.orderId,
              commissionAmountApplied: o.commissionAmount,
            })),
          },
        },
        include: { orders: true },
      });

      for (const order of data.orderIds) {
        if (order.orderType === "ride") {
          await tx.ride.update({
            where: { id: order.orderId },
            data: { isCommissionSettled: true },
          });
        } else if (order.orderType === "food") {
          await tx.foodOrder.update({
            where: { id: order.orderId },
            data: { isCommissionSettled: true },
          });
        } else if (order.orderType === "delivery") {
          await tx.delivery.update({
            where: { id: order.orderId },
            data: { isCommissionSettled: true },
          });
        }
      }

      if (data.userType === "driver") {
        await tx.driverNegativeBalance.updateMany({
          where: { driverId: data.userId },
          data: {
            currentBalance: { decrement: data.totalAmount },
            totalManualPayments: { increment: data.totalAmount },
            totalCommissionPaid: { increment: data.totalAmount },
            lastSettlementId: settlement.id,
            lastSettlementDate: new Date(),
            lastUpdated: new Date(),
          },
        });

        await tx.driverWallet.updateMany({
          where: { driverId: data.userId },
          data: {
            negativeBalance: { decrement: data.totalAmount },
          },
        });
      } else {
        await tx.restaurantNegativeBalance.updateMany({
          where: { restaurantId: data.userId },
          data: {
            currentBalance: { decrement: data.totalAmount },
            totalManualPayments: { increment: data.totalAmount },
            totalCommissionPaid: { increment: data.totalAmount },
            lastSettlementId: settlement.id,
            lastSettlementDate: new Date(),
            lastUpdated: new Date(),
          },
        });

        await tx.restaurantWallet.updateMany({
          where: { restaurantId: data.userId },
          data: {
            negativeBalance: { decrement: data.totalAmount },
          },
        });
      }

      return settlement;
    });
  }
}

export const financeStatsService = new FinanceStatsService();
