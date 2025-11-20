import { db } from "../db";
import type { Decimal } from "@prisma/client/runtime/library";

interface DateFilter {
  gte?: Date;
  lte?: Date;
}

interface GlobalSummary {
  totalRidesEarnings: number;
  totalFoodEarnings: number;
  totalParcelEarnings: number;
  totalCommission: number;
  payoutsCompleted: number;
  payoutsPending: number;
}

interface ServiceEarnings {
  gross: number;
  commission: number;
  net: number;
  count: number;
  chartData: Array<{ date: string; amount: number }>;
}

interface PayoutAnalytics {
  weeklyAutoPayouts: number;
  manualCashouts: number;
  pending: number;
  completed: number;
  failed: Array<{ id: string; amount: number; reason: string; date: string }>;
}

interface EarningsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  country?: string;
}

const decimalToNumber = (value: Decimal | null): number => {
  if (!value) return 0;
  return Number(value.toString());
};

const cache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 30000;

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function getGlobalSummary(filters: EarningsFilters = {}): Promise<GlobalSummary> {
  const cacheKey = `global-${JSON.stringify(filters)}`;
  const cached = getCached<GlobalSummary>(cacheKey);
  if (cached) return cached;

  const dateFilter: DateFilter = {};
  if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
  if (filters.dateTo) dateFilter.lte = filters.dateTo;

  const countryFilter = filters.country && filters.country !== 'all' 
    ? { countryCode: filters.country } 
    : {};

  const [ridesAgg, foodAgg, parcelAgg, payoutsAgg] = await Promise.all([
    db.ride.aggregate({
      where: {
        status: "completed",
        completedAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          driver: { user: { countryCode: filters.country } }
        })
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
        driverPayout: true,
      },
      _count: true,
    }),
    
    db.foodOrder.aggregate({
      where: {
        status: "delivered",
        deliveredAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          restaurant: { user: { countryCode: filters.country } }
        })
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
        restaurantPayout: true,
        driverPayout: true,
      },
      _count: true,
    }),
    
    db.delivery.aggregate({
      where: {
        status: "delivered",
        deliveredAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          driver: { user: { countryCode: filters.country } }
        })
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
        driverPayout: true,
      },
      _count: true,
    }),
    
    db.payout.groupBy({
      by: ['status'],
      where: {
        createdAt: dateFilter,
        ...countryFilter,
      },
      _sum: {
        amount: true,
      },
      _count: true,
    }),
  ]);

  const payoutsCompleted = payoutsAgg.find(p => p.status === 'completed')?._sum.amount ?? null;
  const payoutsPending = payoutsAgg.find(p => p.status === 'pending')?._sum.amount ?? null;

  const result: GlobalSummary = {
    totalRidesEarnings: decimalToNumber(ridesAgg._sum.serviceFare),
    totalFoodEarnings: decimalToNumber(foodAgg._sum.serviceFare),
    totalParcelEarnings: decimalToNumber(parcelAgg._sum.serviceFare),
    totalCommission: 
      decimalToNumber(ridesAgg._sum.safegoCommission) +
      decimalToNumber(foodAgg._sum.safegoCommission) +
      decimalToNumber(parcelAgg._sum.safegoCommission),
    payoutsCompleted: decimalToNumber(payoutsCompleted),
    payoutsPending: decimalToNumber(payoutsPending),
  };

  setCache(cacheKey, result);
  return result;
}

async function buildChartData(
  data: Array<{ completedDate: Date | null; total: Decimal }>
): Promise<Array<{ date: string; amount: number }>> {
  const grouped = new Map<string, number>();
  
  for (const row of data) {
    if (row.completedDate) {
      const dateKey = row.completedDate.toISOString().split('T')[0];
      const current = grouped.get(dateKey) || 0;
      grouped.set(dateKey, current + decimalToNumber(row.total));
    }
  }
  
  return Array.from(grouped.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRideEarnings(filters: EarningsFilters = {}): Promise<ServiceEarnings> {
  const cacheKey = `rides-${JSON.stringify(filters)}`;
  const cached = getCached<ServiceEarnings>(cacheKey);
  if (cached) return cached;

  const dateFilter: DateFilter = {};
  if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
  if (filters.dateTo) dateFilter.lte = filters.dateTo;

  const [agg, chartRawData] = await Promise.all([
    db.ride.aggregate({
      where: {
        status: "completed",
        completedAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          driver: { user: { countryCode: filters.country } }
        })
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
        driverPayout: true,
      },
      _count: true,
    }),
    
    db.ride.findMany({
      where: {
        status: "completed",
        completedAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          driver: { user: { countryCode: filters.country } }
        })
      },
      select: {
        completedAt: true,
        serviceFare: true,
      },
      orderBy: {
        completedAt: 'asc',
      },
    }),
  ]);

  const chartData = await buildChartData(
    chartRawData.map(r => ({ 
      completedDate: r.completedAt, 
      total: r.serviceFare 
    }))
  );

  const result: ServiceEarnings = {
    gross: decimalToNumber(agg._sum.serviceFare),
    commission: decimalToNumber(agg._sum.safegoCommission),
    net: decimalToNumber(agg._sum.driverPayout),
    count: agg._count,
    chartData,
  };

  setCache(cacheKey, result);
  return result;
}

export async function getFoodEarnings(filters: EarningsFilters = {}): Promise<ServiceEarnings> {
  const cacheKey = `food-${JSON.stringify(filters)}`;
  const cached = getCached<ServiceEarnings>(cacheKey);
  if (cached) return cached;

  const dateFilter: DateFilter = {};
  if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
  if (filters.dateTo) dateFilter.lte = filters.dateTo;

  const [agg, chartRawData] = await Promise.all([
    db.foodOrder.aggregate({
      where: {
        status: "delivered",
        deliveredAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          restaurant: { user: { countryCode: filters.country } }
        })
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
        restaurantPayout: true,
      },
      _count: true,
    }),
    
    db.foodOrder.findMany({
      where: {
        status: "delivered",
        deliveredAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          restaurant: { user: { countryCode: filters.country } }
        })
      },
      select: {
        deliveredAt: true,
        serviceFare: true,
      },
      orderBy: {
        deliveredAt: 'asc',
      },
    }),
  ]);

  const chartData = await buildChartData(
    chartRawData.map(r => ({ 
      completedDate: r.deliveredAt, 
      total: r.serviceFare 
    }))
  );

  const result: ServiceEarnings = {
    gross: decimalToNumber(agg._sum.serviceFare),
    commission: decimalToNumber(agg._sum.safegoCommission),
    net: decimalToNumber(agg._sum.restaurantPayout),
    count: agg._count,
    chartData,
  };

  setCache(cacheKey, result);
  return result;
}

export async function getParcelEarnings(filters: EarningsFilters = {}): Promise<ServiceEarnings> {
  const cacheKey = `parcel-${JSON.stringify(filters)}`;
  const cached = getCached<ServiceEarnings>(cacheKey);
  if (cached) return cached;

  const dateFilter: DateFilter = {};
  if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
  if (filters.dateTo) dateFilter.lte = filters.dateTo;

  const [agg, chartRawData] = await Promise.all([
    db.delivery.aggregate({
      where: {
        status: "delivered",
        deliveredAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          driver: { user: { countryCode: filters.country } }
        })
      },
      _sum: {
        serviceFare: true,
        safegoCommission: true,
        driverPayout: true,
      },
      _count: true,
    }),
    
    db.delivery.findMany({
      where: {
        status: "delivered",
        deliveredAt: dateFilter,
        ...(filters.country && filters.country !== 'all' && {
          driver: { user: { countryCode: filters.country } }
        })
      },
      select: {
        deliveredAt: true,
        serviceFare: true,
      },
      orderBy: {
        deliveredAt: 'asc',
      },
    }),
  ]);

  const chartData = await buildChartData(
    chartRawData.map(r => ({ 
      completedDate: r.deliveredAt, 
      total: r.serviceFare 
    }))
  );

  const result: ServiceEarnings = {
    gross: decimalToNumber(agg._sum.serviceFare),
    commission: decimalToNumber(agg._sum.safegoCommission),
    net: decimalToNumber(agg._sum.driverPayout),
    count: agg._count,
    chartData,
  };

  setCache(cacheKey, result);
  return result;
}

export async function getPayoutAnalytics(filters: EarningsFilters = {}): Promise<PayoutAnalytics> {
  const cacheKey = `payouts-${JSON.stringify(filters)}`;
  const cached = getCached<PayoutAnalytics>(cacheKey);
  if (cached) return cached;

  const dateFilter: DateFilter = {};
  if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
  if (filters.dateTo) dateFilter.lte = filters.dateTo;

  const countryFilter = filters.country && filters.country !== 'all' 
    ? { countryCode: filters.country } 
    : {};

  const [methodGroups, statusGroups, failedPayouts] = await Promise.all([
    db.payout.groupBy({
      by: ['method'],
      where: {
        createdAt: dateFilter,
        status: 'completed',
        ...countryFilter,
      },
      _sum: {
        amount: true,
      },
    }),
    
    db.payout.groupBy({
      by: ['status'],
      where: {
        createdAt: dateFilter,
        ...countryFilter,
      },
      _sum: {
        amount: true,
      },
    }),
    
    db.payout.findMany({
      where: {
        status: 'failed',
        createdAt: dateFilter,
        ...countryFilter,
      },
      select: {
        id: true,
        amount: true,
        failureReason: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    }),
  ]);

  const weeklyAuto = methodGroups.find(m => m.method === 'auto_weekly')?._sum.amount ?? null;
  const manualRequest = methodGroups.find(m => m.method === 'manual_request')?._sum.amount ?? null;
  const manualAdmin = methodGroups.find(m => m.method === 'manual_admin_settlement')?._sum.amount ?? null;
  
  const result: PayoutAnalytics = {
    weeklyAutoPayouts: decimalToNumber(weeklyAuto),
    manualCashouts: decimalToNumber(manualRequest) + decimalToNumber(manualAdmin),
    pending: decimalToNumber(statusGroups.find(s => s.status === 'pending')?._sum.amount ?? null),
    completed: decimalToNumber(statusGroups.find(s => s.status === 'completed')?._sum.amount ?? null),
    failed: failedPayouts.map(p => ({
      id: p.id,
      amount: decimalToNumber(p.amount),
      reason: p.failureReason || 'Unknown error',
      date: p.createdAt.toISOString(),
    })),
  };

  setCache(cacheKey, result);
  return result;
}
