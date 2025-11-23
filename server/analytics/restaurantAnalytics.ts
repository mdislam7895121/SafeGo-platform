import { PrismaClient, Decimal } from "@prisma/client";

const prisma = new PrismaClient();

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface OverviewMetrics {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgPreparationTime: number;
  avgOrderValue: number;
  commission: number;
  netPayout: number;
  hourlyDistribution: { hour: number; orders: number; revenue: number }[];
  dailyTrend: { date: string; orders: number; revenue: number }[];
}

export interface ItemAnalytics {
  topItems: { itemName: string; orderCount: number; totalAttempts: number; revenue: number }[];
  worstItems: { itemName: string; orderCount: number; totalAttempts: number; revenue: number }[];
  highCancellationItems: { itemName: string; totalAttempts: number; cancellationCount: number; cancellationRate: number }[];
  avgPrepTimeByItem: { itemName: string; avgPrepTime: number }[];
}

export interface CustomerAnalytics {
  repeatCustomerRatio: number;
  newCustomers: number;
  returningCustomers: number;
  avgBasketSize: number;
  topAreas: { area: string; orderCount: number }[];
}

export interface DriverAnalytics {
  driverStats: {
    driverId: string;
    driverName: string;
    avgPickupTime: number;
    avgDeliveryTime: number;
    cancellationCount: number;
    totalDeliveries: number;
  }[];
}

function decimalToNumber(value: Decimal | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

export async function getOverviewAnalytics(
  restaurantId: string,
  filters: DateRangeFilter
): Promise<OverviewMetrics> {
  const { startDate, endDate } = filters;

  const orders = await prisma.foodOrder.findMany({
    where: {
      restaurantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDemo: false,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      serviceFare: true,
      restaurantPayout: true,
      safegoCommission: true,
      subtotal: true,
      acceptedAt: true,
      readyAt: true,
      whoCancelled: true,
    },
  });

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "delivered").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;

  const totalRevenue = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + decimalToNumber(o.subtotal), 0);

  const commission = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + decimalToNumber(o.safegoCommission), 0);

  const netPayout = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + decimalToNumber(o.restaurantPayout), 0);

  // Calculate avg preparation time (acceptedAt -> readyAt)
  const prepTimes = orders
    .filter((o) => o.acceptedAt && o.readyAt)
    .map((o) => {
      const accepted = new Date(o.acceptedAt!).getTime();
      const ready = new Date(o.readyAt!).getTime();
      return (ready - accepted) / 60000; // minutes
    });

  const avgPreparationTime =
    prepTimes.length > 0
      ? prepTimes.reduce((sum, time) => sum + time, 0) / prepTimes.length
      : 0;

  const avgOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

  // Hourly distribution
  const hourlyMap = new Map<number, { orders: number; revenue: number }>();
  for (let hour = 0; hour < 24; hour++) {
    hourlyMap.set(hour, { orders: 0, revenue: 0 });
  }

  orders.forEach((order) => {
    if (order.status !== "delivered") return;
    const hour = new Date(order.createdAt).getHours();
    const current = hourlyMap.get(hour)!;
    current.orders++;
    current.revenue += decimalToNumber(order.subtotal);
  });

  const hourlyDistribution = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    hour,
    ...data,
  }));

  // Daily trend
  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  orders.forEach((order) => {
    if (order.status !== "delivered") return;
    const dateKey = new Date(order.createdAt).toISOString().split("T")[0];
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { orders: 0, revenue: 0 });
    }
    const current = dailyMap.get(dateKey)!;
    current.orders++;
    current.revenue += decimalToNumber(order.subtotal);
  });

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      ...data,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRevenue,
    totalOrders,
    completedOrders,
    cancelledOrders,
    avgPreparationTime: Math.round(avgPreparationTime),
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    commission,
    netPayout,
    hourlyDistribution,
    dailyTrend,
  };
}

export async function getItemAnalytics(
  restaurantId: string,
  filters: DateRangeFilter
): Promise<ItemAnalytics> {
  const { startDate, endDate } = filters;

  const orders = await prisma.foodOrder.findMany({
    where: {
      restaurantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDemo: false,
    },
    select: {
      items: true,
      status: true,
      subtotal: true,
      acceptedAt: true,
      readyAt: true,
      whoCancelled: true,
    },
  });

  // Parse items and aggregate
  const itemStats = new Map<
    string,
    { deliveredCount: number; revenue: number; cancellations: number; prepTimes: number[] }
  >();

  orders.forEach((order) => {
    if (!order.items) return;

    try {
      const items = JSON.parse(order.items);
      if (!Array.isArray(items)) return;

      items.forEach((item: any) => {
        const name = item.name || item.itemName || "Unknown Item";
        if (!itemStats.has(name)) {
          itemStats.set(name, { deliveredCount: 0, revenue: 0, cancellations: 0, prepTimes: [] });
        }

        const stat = itemStats.get(name)!;

        if (order.status === "delivered") {
          stat.deliveredCount++;
          stat.revenue += decimalToNumber(order.subtotal) / items.length;
        }

        if (order.status === "cancelled") {
          stat.cancellations++;
        }

        if (order.acceptedAt && order.readyAt) {
          const prepTime =
            (new Date(order.readyAt).getTime() - new Date(order.acceptedAt).getTime()) / 60000;
          stat.prepTimes.push(prepTime);
        }
      });
    } catch (e) {
      // Skip invalid JSON
    }
  });

  const itemArray = Array.from(itemStats.entries()).map(([name, stat]) => {
    const totalAttempts = stat.deliveredCount + stat.cancellations;
    return {
      itemName: name,
      orderCount: stat.deliveredCount,
      totalAttempts,
      revenue: Math.round(stat.revenue * 100) / 100,
      cancellationCount: stat.cancellations,
      cancellationRate:
        totalAttempts > 0 ? Math.round((stat.cancellations / totalAttempts) * 100) : 0,
      avgPrepTime:
        stat.prepTimes.length > 0
          ? Math.round(stat.prepTimes.reduce((a, b) => a + b, 0) / stat.prepTimes.length)
          : 0,
    };
  });

  const topItems = itemArray
    .filter((i) => i.totalAttempts >= 3)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((i) => ({ itemName: i.itemName, orderCount: i.orderCount, totalAttempts: i.totalAttempts, revenue: i.revenue }));

  const worstItems = itemArray
    .filter((i) => i.totalAttempts >= 3)
    .sort((a, b) => {
      const aPerf = a.revenue / a.totalAttempts;
      const bPerf = b.revenue / b.totalAttempts;
      return aPerf - bPerf; // Sort by revenue per attempt (ascending = worst performance)
    })
    .slice(0, 10)
    .map((i) => ({ itemName: i.itemName, orderCount: i.orderCount, totalAttempts: i.totalAttempts, revenue: i.revenue }));

  const highCancellationItems = itemArray
    .filter((i) => i.totalAttempts >= 3)
    .sort((a, b) => b.cancellationRate - a.cancellationRate)
    .slice(0, 10)
    .map((i) => ({
      itemName: i.itemName,
      totalAttempts: i.totalAttempts,
      cancellationCount: i.cancellationCount,
      cancellationRate: i.cancellationRate,
    }));

  const avgPrepTimeByItem = itemArray
    .filter((i) => i.avgPrepTime > 0)
    .sort((a, b) => b.avgPrepTime - a.avgPrepTime)
    .slice(0, 10)
    .map((i) => ({ itemName: i.itemName, avgPrepTime: i.avgPrepTime }));

  return {
    topItems,
    worstItems,
    highCancellationItems,
    avgPrepTimeByItem,
  };
}

export async function getCustomerAnalytics(
  restaurantId: string,
  filters: DateRangeFilter
): Promise<CustomerAnalytics> {
  const { startDate, endDate } = filters;

  const orders = await prisma.foodOrder.findMany({
    where: {
      restaurantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDemo: false,
    },
    select: {
      customerId: true,
      deliveryAddress: true,
      subtotal: true,
      itemsCount: true,
      status: true,
    },
  });

  // Customer frequency
  const customerOrders = new Map<string, number>();
  orders.forEach((order) => {
    customerOrders.set(order.customerId, (customerOrders.get(order.customerId) || 0) + 1);
  });

  const newCustomers = Array.from(customerOrders.values()).filter((count) => count === 1).length;
  const returningCustomers = customerOrders.size - newCustomers;
  const repeatCustomerRatio =
    customerOrders.size > 0 ? Math.round((returningCustomers / customerOrders.size) * 100) : 0;

  // Avg basket size
  const completedOrders = orders.filter((o) => o.status === "delivered");
  const totalItems = completedOrders.reduce((sum, o) => sum + (o.itemsCount || 0), 0);
  const avgBasketSize =
    completedOrders.length > 0 ? Math.round((totalItems / completedOrders.length) * 10) / 10 : 0;

  // Top areas (extract city from address)
  const areaMap = new Map<string, number>();
  orders.forEach((order) => {
    const parts = order.deliveryAddress.split(",");
    const area = parts.length > 1 ? parts[parts.length - 2].trim() : "Unknown";
    areaMap.set(area, (areaMap.get(area) || 0) + 1);
  });

  const topAreas = Array.from(areaMap.entries())
    .map(([area, orderCount]) => ({ area, orderCount }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 10);

  return {
    repeatCustomerRatio,
    newCustomers,
    returningCustomers,
    avgBasketSize,
    topAreas,
  };
}

export async function getDriverAnalytics(
  restaurantId: string,
  filters: DateRangeFilter
): Promise<DriverAnalytics> {
  const { startDate, endDate } = filters;

  const orders = await prisma.foodOrder.findMany({
    where: {
      restaurantId,
      driverId: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDemo: false,
    },
    select: {
      driverId: true,
      readyAt: true,
      pickedUpAt: true,
      deliveredAt: true,
      status: true,
      whoCancelled: true,
      driver: {
        select: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
  });

  const driverMap = new Map<
    string,
    {
      driverName: string;
      pickupTimes: number[];
      deliveryTimes: number[];
      cancellations: number;
      totalDeliveries: number;
    }
  >();

  orders.forEach((order) => {
    if (!order.driverId) return;

    if (!driverMap.has(order.driverId)) {
      driverMap.set(order.driverId, {
        driverName: order.driver?.user?.fullName || "Unknown Driver",
        pickupTimes: [],
        deliveryTimes: [],
        cancellations: 0,
        totalDeliveries: 0,
      });
    }

    const stat = driverMap.get(order.driverId)!;

    if (order.status === "delivered") {
      stat.totalDeliveries++;

      if (order.readyAt && order.pickedUpAt) {
        const pickupTime =
          (new Date(order.pickedUpAt).getTime() - new Date(order.readyAt).getTime()) / 60000;
        stat.pickupTimes.push(pickupTime);
      }

      if (order.pickedUpAt && order.deliveredAt) {
        const deliveryTime =
          (new Date(order.deliveredAt).getTime() - new Date(order.pickedUpAt).getTime()) / 60000;
        stat.deliveryTimes.push(deliveryTime);
      }
    }

    if (order.status === "cancelled" && order.whoCancelled === "driver") {
      stat.cancellations++;
    }
  });

  const driverStats = Array.from(driverMap.entries())
    .map(([driverId, stat]) => ({
      driverId,
      driverName: stat.driverName,
      avgPickupTime:
        stat.pickupTimes.length > 0
          ? Math.round(stat.pickupTimes.reduce((a, b) => a + b, 0) / stat.pickupTimes.length)
          : 0,
      avgDeliveryTime:
        stat.deliveryTimes.length > 0
          ? Math.round(stat.deliveryTimes.reduce((a, b) => a + b, 0) / stat.deliveryTimes.length)
          : 0,
      cancellationCount: stat.cancellations,
      totalDeliveries: stat.totalDeliveries,
    }))
    .sort((a, b) => b.totalDeliveries - a.totalDeliveries);

  return {
    driverStats,
  };
}

// ====================================================
// ADMIN ANALYTICS
// ====================================================

export interface AdminRestaurantAnalytics {
  platformMetrics: {
    totalRestaurants: number;
    activeRestaurants: number;
    totalRevenue: number;
    totalOrders: number;
    totalCommission: number;
    avgOrderValue: number;
  };
  topRestaurants: {
    restaurantId: string;
    restaurantName: string;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
  }[];
  dailyTrend: { date: string; orders: number; revenue: number; commission: number }[];
}

export async function getAdminRestaurantAnalytics(
  filters: DateRangeFilter
): Promise<AdminRestaurantAnalytics> {
  const { startDate, endDate } = filters;

  // Get all delivered orders (exclude demo and cancelled)
  const orders = await prisma.foodOrder.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "delivered",
      isDemo: false,
    },
    select: {
      id: true,
      restaurantId: true,
      createdAt: true,
      subtotal: true,
      safegoCommission: true,
      restaurant: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  });

  // Calculate platform metrics (using subtotal for consistency with restaurant analytics)
  const totalRevenue = orders.reduce((sum, o) => sum + decimalToNumber(o.subtotal), 0);
  const totalCommission = orders.reduce((sum, o) => sum + decimalToNumber(o.safegoCommission), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Get active restaurants count (have at least one order in period)
  const activeRestaurantIds = new Set(orders.map((o) => o.restaurantId));
  const activeRestaurants = activeRestaurantIds.size;

  // Get total restaurants count
  const totalRestaurants = await prisma.restaurantProfile.count({
    where: { isDemo: false },
  });

  // Aggregate by restaurant for top performers
  const restaurantMap = new Map<
    string,
    {
      restaurantName: string;
      revenue: number;
      orderCount: number;
    }
  >();

  orders.forEach((order) => {
    if (!restaurantMap.has(order.restaurantId)) {
      restaurantMap.set(order.restaurantId, {
        restaurantName: order.restaurant?.businessName || "Unknown Restaurant",
        revenue: 0,
        orderCount: 0,
      });
    }

    const stat = restaurantMap.get(order.restaurantId)!;
    stat.revenue += decimalToNumber(order.subtotal);
    stat.orderCount++;
  });

  const topRestaurants = Array.from(restaurantMap.entries())
    .map(([restaurantId, stat]) => ({
      restaurantId,
      restaurantName: stat.restaurantName,
      totalRevenue: Math.round(stat.revenue * 100) / 100,
      totalOrders: stat.orderCount,
      avgOrderValue:
        stat.orderCount > 0 ? Math.round((stat.revenue / stat.orderCount) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // Daily trend aggregation
  const dailyMap = new Map<
    string,
    {
      orders: number;
      revenue: number;
      commission: number;
    }
  >();

  orders.forEach((order) => {
    const dateKey = order.createdAt.toISOString().split("T")[0];

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { orders: 0, revenue: 0, commission: 0 });
    }

    const stat = dailyMap.get(dateKey)!;
    stat.orders++;
    stat.revenue += decimalToNumber(order.subtotal);
    stat.commission += decimalToNumber(order.safegoCommission);
  });

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, stat]) => ({
      date,
      orders: stat.orders,
      revenue: Math.round(stat.revenue * 100) / 100,
      commission: Math.round(stat.commission * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    platformMetrics: {
      totalRestaurants,
      activeRestaurants,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalCommission: Math.round(totalCommission * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    },
    topRestaurants,
    dailyTrend,
  };
}
