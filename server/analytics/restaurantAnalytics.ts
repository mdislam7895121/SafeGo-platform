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

// ====================================================
// PERFORMANCE INSIGHTS & ANOMALY DETECTION
// ====================================================

export interface PerformanceInsights {
  restaurantId: string;
  restaurantName: string;
  currentPeriod: {
    orders: number;
    revenue: number;
    cancellationRate: number;
    avgPrepTime: number;
  };
  previousPeriod: {
    orders: number;
    revenue: number;
    cancellationRate: number;
    avgPrepTime: number;
  };
  changes: {
    ordersDelta: number;
    ordersPercentChange: number;
    revenueDelta: number;
    revenuePercentChange: number;
    cancellationRateDelta: number;
    prepTimeDelta: number;
  };
  anomalies: {
    type: "cancellation_spike" | "order_drop" | "prep_time_spike";
    severity: "warning" | "critical";
    message: string;
  }[];
  topItems: { itemName: string; orderCount: number; revenue: number }[];
  summary: string;
}

export async function getRestaurantPerformanceInsights(
  restaurantId: string
): Promise<PerformanceInsights> {
  // Get restaurant name
  const restaurant = await prisma.restaurantProfile.findUnique({
    where: { id: restaurantId },
    select: { businessName: true },
  });

  const restaurantName = restaurant?.businessName || "Restaurant";

  // Current period: last 7 days
  const now = new Date();
  const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentEnd = now;

  // Previous period: 7 days before that
  const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const previousEnd = currentStart;

  // Fetch current period data
  const currentOrders = await prisma.foodOrder.findMany({
    where: {
      restaurantId,
      createdAt: { gte: currentStart, lte: currentEnd },
      isDemo: false,
    },
    select: {
      status: true,
      subtotal: true,
      acceptedAt: true,
      readyAt: true,
      items: true,
    },
  });

  // Fetch previous period data
  const previousOrders = await prisma.foodOrder.findMany({
    where: {
      restaurantId,
      createdAt: { gte: previousStart, lte: previousEnd },
      isDemo: false,
    },
    select: {
      status: true,
      subtotal: true,
      acceptedAt: true,
      readyAt: true,
    },
  });

  // Calculate current period metrics
  const currentDelivered = currentOrders.filter((o) => o.status === "delivered");
  const currentCancelled = currentOrders.filter((o) => o.status === "cancelled");
  const currentRevenue = currentDelivered.reduce(
    (sum, o) => sum + decimalToNumber(o.subtotal),
    0
  );
  const currentCancellationRate =
    currentOrders.length > 0
      ? Math.round((currentCancelled.length / currentOrders.length) * 100)
      : 0;

  const currentPrepTimes = currentOrders
    .filter((o) => o.acceptedAt && o.readyAt)
    .map((o) => {
      const accepted = new Date(o.acceptedAt!).getTime();
      const ready = new Date(o.readyAt!).getTime();
      return (ready - accepted) / 60000;
    });
  const currentAvgPrepTime =
    currentPrepTimes.length > 0
      ? Math.round(currentPrepTimes.reduce((sum, t) => sum + t, 0) / currentPrepTimes.length)
      : 0;

  // Calculate previous period metrics
  const previousDelivered = previousOrders.filter((o) => o.status === "delivered");
  const previousCancelled = previousOrders.filter((o) => o.status === "cancelled");
  const previousRevenue = previousDelivered.reduce(
    (sum, o) => sum + decimalToNumber(o.subtotal),
    0
  );
  const previousCancellationRate =
    previousOrders.length > 0
      ? Math.round((previousCancelled.length / previousOrders.length) * 100)
      : 0;

  const previousPrepTimes = previousOrders
    .filter((o) => o.acceptedAt && o.readyAt)
    .map((o) => {
      const accepted = new Date(o.acceptedAt!).getTime();
      const ready = new Date(o.readyAt!).getTime();
      return (ready - accepted) / 60000;
    });
  const previousAvgPrepTime =
    previousPrepTimes.length > 0
      ? Math.round(previousPrepTimes.reduce((sum, t) => sum + t, 0) / previousPrepTimes.length)
      : 0;

  // Calculate changes
  const ordersDelta = currentDelivered.length - previousDelivered.length;
  const ordersPercentChange =
    previousDelivered.length > 0
      ? Math.round((ordersDelta / previousDelivered.length) * 100)
      : 0;

  const revenueDelta = Math.round((currentRevenue - previousRevenue) * 100) / 100;
  const revenuePercentChange =
    previousRevenue > 0 ? Math.round((revenueDelta / previousRevenue) * 100) : 0;

  const cancellationRateDelta = currentCancellationRate - previousCancellationRate;
  const prepTimeDelta = currentAvgPrepTime - previousAvgPrepTime;

  // Detect anomalies
  const anomalies: PerformanceInsights["anomalies"] = [];

  // Anomaly: Cancellation spike (>10% increase or >30% absolute rate)
  if (cancellationRateDelta > 10 || currentCancellationRate > 30) {
    anomalies.push({
      type: "cancellation_spike",
      severity: currentCancellationRate > 30 ? "critical" : "warning",
      message: `Cancellation rate is ${currentCancellationRate}% (up ${cancellationRateDelta}% from last week)`,
    });
  }

  // Anomaly: Order drop (>30% decrease)
  if (ordersPercentChange < -30 && previousDelivered.length > 5) {
    anomalies.push({
      type: "order_drop",
      severity: ordersPercentChange < -50 ? "critical" : "warning",
      message: `Orders dropped ${Math.abs(ordersPercentChange)}% compared to last week`,
    });
  }

  // Anomaly: Prep time spike (>50% increase or >15 min increase)
  if ((prepTimeDelta > 15 || (previousAvgPrepTime > 0 && (prepTimeDelta / previousAvgPrepTime) > 0.5)) && currentAvgPrepTime > 20) {
    anomalies.push({
      type: "prep_time_spike",
      severity: prepTimeDelta > 20 ? "critical" : "warning",
      message: `Avg prep time increased to ${currentAvgPrepTime} minutes (up ${prepTimeDelta} min)`,
    });
  }

  // Get top items from current period
  const itemMap = new Map<string, { orderCount: number; revenue: number }>();
  currentDelivered.forEach((order) => {
    if (!order.items) return;
    try {
      const items = JSON.parse(order.items);
      items.forEach((item: any) => {
        const itemName = item.name || "Unknown Item";
        if (!itemMap.has(itemName)) {
          itemMap.set(itemName, { orderCount: 0, revenue: 0 });
        }
        const stat = itemMap.get(itemName)!;
        stat.orderCount++;
        stat.revenue += item.price * item.quantity || 0;
      });
    } catch (e) {
      // Skip invalid JSON
    }
  });

  const topItems = Array.from(itemMap.entries())
    .map(([itemName, stat]) => ({
      itemName,
      orderCount: stat.orderCount,
      revenue: Math.round(stat.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  // Generate summary
  const summaryParts: string[] = [];
  summaryParts.push(`${currentDelivered.length} orders this week`);
  if (ordersPercentChange !== 0) {
    summaryParts.push(
      ordersPercentChange > 0
        ? `(up ${ordersPercentChange}%)`
        : `(down ${Math.abs(ordersPercentChange)}%)`
    );
  }
  summaryParts.push(`with $${Math.round(currentRevenue)} revenue`);
  if (anomalies.length > 0) {
    summaryParts.push(`• ${anomalies.length} alert${anomalies.length > 1 ? "s" : ""} detected`);
  }

  return {
    restaurantId,
    restaurantName,
    currentPeriod: {
      orders: currentDelivered.length,
      revenue: Math.round(currentRevenue * 100) / 100,
      cancellationRate: currentCancellationRate,
      avgPrepTime: currentAvgPrepTime,
    },
    previousPeriod: {
      orders: previousDelivered.length,
      revenue: Math.round(previousRevenue * 100) / 100,
      cancellationRate: previousCancellationRate,
      avgPrepTime: previousAvgPrepTime,
    },
    changes: {
      ordersDelta,
      ordersPercentChange,
      revenueDelta,
      revenuePercentChange,
      cancellationRateDelta,
      prepTimeDelta,
    },
    anomalies,
    topItems,
    summary: summaryParts.join(" "),
  };
}

/**
 * Generate and send performance summary notification to restaurant owner
 * @param insights - Performance insights data
 */
export async function sendPerformanceNotification(
  insights: PerformanceInsights
): Promise<void> {
  // Get restaurant owner user
  const restaurantProfile = await prisma.restaurantProfile.findUnique({
    where: { id: insights.restaurantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!restaurantProfile) {
    console.error(`Restaurant profile not found: ${insights.restaurantId}`);
    return;
  }

  // Build notification body (no emojis per SafeGo guidelines)
  const bodyParts: string[] = [];

  // Summary
  bodyParts.push(`Weekly Performance Summary for ${insights.restaurantName}`);
  bodyParts.push("");
  bodyParts.push(`This Week:`);
  bodyParts.push(
    `• ${insights.currentPeriod.orders} orders, $${insights.currentPeriod.revenue} revenue`
  );
  bodyParts.push(
    `• ${insights.currentPeriod.cancellationRate}% cancellation rate, ${insights.currentPeriod.avgPrepTime} min avg prep time`
  );
  bodyParts.push("");

  // Changes vs last week
  if (insights.changes.ordersPercentChange !== 0 || insights.changes.revenuePercentChange !== 0) {
    bodyParts.push(`Changes vs Last Week:`);
    if (insights.changes.ordersPercentChange !== 0) {
      bodyParts.push(
        `• Orders: ${insights.changes.ordersPercentChange > 0 ? "+" : ""}${insights.changes.ordersPercentChange}% (${insights.changes.ordersPercentChange > 0 ? "+" : ""}${insights.changes.ordersDelta})`
      );
    }
    if (insights.changes.revenuePercentChange !== 0) {
      bodyParts.push(
        `• Revenue: ${insights.changes.revenuePercentChange > 0 ? "+" : ""}${insights.changes.revenuePercentChange}% ($${insights.changes.revenuePercentChange > 0 ? "+" : ""}${insights.changes.revenueDelta})`
      );
    }
    bodyParts.push("");
  }

  // Top items
  if (insights.topItems.length > 0) {
    bodyParts.push(`Top Performing Items:`);
    insights.topItems.forEach((item, index) => {
      bodyParts.push(
        `${index + 1}. ${item.itemName} - ${item.orderCount} orders, $${item.revenue}`
      );
    });
    bodyParts.push("");
  }

  // Anomalies/Alerts
  if (insights.anomalies.length > 0) {
    bodyParts.push(`Alerts:`);
    insights.anomalies.forEach((anomaly) => {
      const prefix = anomaly.severity === "critical" ? "[CRITICAL]" : "[WARNING]";
      bodyParts.push(`${prefix} ${anomaly.message}`);
    });
    bodyParts.push("");
  }

  bodyParts.push(`View detailed analytics in your restaurant dashboard.`);

  const notificationBody = bodyParts.join("\n");

  // Determine notification type based on anomalies
  const hasCriticalAnomaly = insights.anomalies.some((a) => a.severity === "critical");
  const notificationType = hasCriticalAnomaly ? "alert" : "analytics";
  const notificationTitle = hasCriticalAnomaly
    ? `Performance Alert - ${insights.restaurantName}`
    : `Weekly Performance Summary - ${insights.restaurantName}`;

  // Create notification for restaurant owner
  await prisma.notification.create({
    data: {
      userId: restaurantProfile.user.id,
      type: notificationType,
      title: notificationTitle,
      body: notificationBody,
    },
  });

  console.log(
    `Performance notification sent to ${restaurantProfile.user.email} (${insights.restaurantName})`
  );
}
