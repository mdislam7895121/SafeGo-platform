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

interface RBACFilter {
  isUnrestricted: boolean;
  countryCode?: string | null;
  cityCode?: string | null;
}

interface EarningsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  rbacFilter?: RBACFilter;
}

const decimalToNumber = (value: Decimal | null): number => {
  if (!value) return 0;
  return Number(value.toString());
};

// Safe wrapper helpers for defensive null handling
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return defaultValue;
  }
  return Number(value);
};

const safeArray = <T>(value: any, defaultValue: T[] = []): T[] => {
  if (!Array.isArray(value)) {
    return defaultValue;
  }
  return value;
};

const safeString = (value: any, defaultValue: string = ""): string => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value);
};

// Build jurisdiction filter from RBAC filter
function buildJurisdictionFilter(rbacFilter?: RBACFilter): any {
  if (!rbacFilter || rbacFilter.isUnrestricted) {
    return {};
  }
  
  const filter: any = {};
  if (rbacFilter.countryCode) {
    filter.countryCode = rbacFilter.countryCode;
  }
  if (rbacFilter.cityCode) {
    filter.cityCode = rbacFilter.cityCode;
  }
  
  return filter;
}

// Build comprehensive payout RBAC filter for ALL owner types (driver, restaurant, customer)
async function buildPayoutRBACFilter(rbacFilter?: RBACFilter): Promise<any> {
  if (!rbacFilter || rbacFilter.isUnrestricted) {
    return {};
  }
  
  // For COUNTRY_ADMIN: Filter by payout.countryCode directly (simple and efficient)
  if (rbacFilter.countryCode && !rbacFilter.cityCode) {
    return {
      countryCode: rbacFilter.countryCode,
    };
  }
  
  // For CITY_ADMIN: Need to filter by both country and city
  // Since cityCode is on the user profile, we need to pre-fetch owner IDs in the jurisdiction
  if (rbacFilter.countryCode && rbacFilter.cityCode) {
    // Pre-fetch driver IDs in the city
    const driversInCity = await db.driverProfile.findMany({
      where: {
        user: {
          countryCode: rbacFilter.countryCode,
          cityCode: rbacFilter.cityCode,
        },
      },
      select: { id: true },
    });
    const driverIds = driversInCity.map(d => d.id);

    // Pre-fetch restaurant IDs in the city
    const restaurantsInCity = await db.restaurantProfile.findMany({
      where: {
        user: {
          countryCode: rbacFilter.countryCode,
          cityCode: rbacFilter.cityCode,
        },
      },
      select: { id: true },
    });
    const restaurantIds = restaurantsInCity.map(r => r.id);

    // Pre-fetch customer IDs in the city (for refunds, referrals, etc.)
    const customersInCity = await db.customerProfile.findMany({
      where: {
        user: {
          countryCode: rbacFilter.countryCode,
          cityCode: rbacFilter.cityCode,
        },
      },
      select: { id: true },
    });
    const customerIds = customersInCity.map(c => c.id);

    // Build OR filter for all owner types in the city
    const ownerFilters = [];
    if (driverIds.length > 0) {
      ownerFilters.push({
        ownerType: 'driver',
        ownerId: { in: driverIds },
      });
    }
    if (restaurantIds.length > 0) {
      ownerFilters.push({
        ownerType: 'restaurant',
        ownerId: { in: restaurantIds },
      });
    }
    if (customerIds.length > 0) {
      ownerFilters.push({
        ownerType: 'customer',
        ownerId: { in: customerIds },
      });
    }

    // If no owners found in city, use impossible condition to guarantee empty results
    if (ownerFilters.length === 0) {
      return {
        walletId: { in: [] },
      };
    }

    return {
      countryCode: rbacFilter.countryCode,
      OR: ownerFilters,
    };
  }
  
  return {};
}

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

  // Build jurisdiction filter from RBAC
  const userFilter = buildJurisdictionFilter(filters.rbacFilter);
  const customerJurisdictionFilter = Object.keys(userFilter).length > 0 
    ? { customer: { user: userFilter } } 
    : {};
  const driverJurisdictionFilter = Object.keys(userFilter).length > 0 
    ? { driver: { user: userFilter } } 
    : {};
  const restaurantJurisdictionFilter = Object.keys(userFilter).length > 0 
    ? { restaurant: { user: userFilter } } 
    : {};

  // Build comprehensive payout RBAC filter for all owner types
  const payoutRBACFilter = await buildPayoutRBACFilter(filters.rbacFilter);

  const [ridesAgg, foodAgg, parcelAgg, payoutsAgg] = await Promise.all([
    db.ride.aggregate({
      where: {
        status: "completed",
        ...(Object.keys(dateFilter).length > 0 ? { completedAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
        ...(Object.keys(dateFilter).length > 0 ? { deliveredAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
        ...(Object.keys(dateFilter).length > 0 ? { deliveredAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...payoutRBACFilter,
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
    totalRidesEarnings: safeNumber(decimalToNumber(ridesAgg._sum.serviceFare), 0),
    totalFoodEarnings: safeNumber(decimalToNumber(foodAgg._sum.serviceFare), 0),
    totalParcelEarnings: safeNumber(decimalToNumber(parcelAgg._sum.serviceFare), 0),
    totalCommission: safeNumber(
      decimalToNumber(ridesAgg._sum.safegoCommission) +
      decimalToNumber(foodAgg._sum.safegoCommission) +
      decimalToNumber(parcelAgg._sum.safegoCommission),
      0
    ),
    payoutsCompleted: safeNumber(decimalToNumber(payoutsCompleted), 0),
    payoutsPending: safeNumber(decimalToNumber(payoutsPending), 0),
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

  // Build jurisdiction filter from RBAC
  const userFilter = buildJurisdictionFilter(filters.rbacFilter);
  const customerJurisdictionFilter = Object.keys(userFilter).length > 0 
    ? { customer: { user: userFilter } } 
    : {};

  const [agg, chartRawData] = await Promise.all([
    db.ride.aggregate({
      where: {
        status: "completed",
        ...(Object.keys(dateFilter).length > 0 ? { completedAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
        ...(Object.keys(dateFilter).length > 0 ? { completedAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
    gross: safeNumber(decimalToNumber(agg._sum.serviceFare), 0),
    commission: safeNumber(decimalToNumber(agg._sum.safegoCommission), 0),
    net: safeNumber(decimalToNumber(agg._sum.driverPayout), 0),
    count: safeNumber(agg._count, 0),
    chartData: safeArray(chartData, []),
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

  // Build jurisdiction filter from RBAC
  const userFilter = buildJurisdictionFilter(filters.rbacFilter);
  const customerJurisdictionFilter = Object.keys(userFilter).length > 0 
    ? { customer: { user: userFilter } } 
    : {};

  const [agg, chartRawData] = await Promise.all([
    db.foodOrder.aggregate({
      where: {
        status: "delivered",
        ...(Object.keys(dateFilter).length > 0 ? { deliveredAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
        ...(Object.keys(dateFilter).length > 0 ? { deliveredAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
    gross: safeNumber(decimalToNumber(agg._sum.serviceFare), 0),
    commission: safeNumber(decimalToNumber(agg._sum.safegoCommission), 0),
    net: safeNumber(decimalToNumber(agg._sum.restaurantPayout), 0),
    count: safeNumber(agg._count, 0),
    chartData: safeArray(chartData, []),
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

  // Build jurisdiction filter from RBAC
  const userFilter = buildJurisdictionFilter(filters.rbacFilter);
  const customerJurisdictionFilter = Object.keys(userFilter).length > 0 
    ? { customer: { user: userFilter } } 
    : {};

  const [agg, chartRawData] = await Promise.all([
    db.delivery.aggregate({
      where: {
        status: "delivered",
        ...(Object.keys(dateFilter).length > 0 ? { deliveredAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
        ...(Object.keys(dateFilter).length > 0 ? { deliveredAt: dateFilter } : {}),
        ...customerJurisdictionFilter,
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
    gross: safeNumber(decimalToNumber(agg._sum.serviceFare), 0),
    commission: safeNumber(decimalToNumber(agg._sum.safegoCommission), 0),
    net: safeNumber(decimalToNumber(agg._sum.driverPayout), 0),
    count: safeNumber(agg._count, 0),
    chartData: safeArray(chartData, []),
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

  // Build comprehensive payout RBAC filter for all owner types
  const payoutRBACFilter = await buildPayoutRBACFilter(filters.rbacFilter);

  const [methodGroups, statusGroups, failedPayouts] = await Promise.all([
    db.payout.groupBy({
      by: ['method'],
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        status: 'completed',
        ...payoutRBACFilter,
      },
      _sum: {
        amount: true,
      },
    }),
    
    db.payout.groupBy({
      by: ['status'],
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...payoutRBACFilter,
      },
      _sum: {
        amount: true,
      },
    }),
    
    db.payout.findMany({
      where: {
        status: 'failed',
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...payoutRBACFilter,
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
    weeklyAutoPayouts: safeNumber(decimalToNumber(weeklyAuto), 0),
    manualCashouts: safeNumber(decimalToNumber(manualRequest) + decimalToNumber(manualAdmin), 0),
    pending: safeNumber(decimalToNumber(statusGroups.find(s => s.status === 'pending')?._sum.amount ?? null), 0),
    completed: safeNumber(decimalToNumber(statusGroups.find(s => s.status === 'completed')?._sum.amount ?? null), 0),
    failed: safeArray(failedPayouts.map(p => ({
      id: safeString(p.id, ""),
      amount: safeNumber(decimalToNumber(p.amount), 0),
      reason: safeString(p.failureReason, 'Unknown error'),
      date: safeString(p.createdAt.toISOString(), ""),
    })), []),
  };

  setCache(cacheKey, result);
  return result;
}
