/**
 * Phase 4: Admin Monitoring Service
 * 
 * Real-time aggregated dashboard data for admin monitoring.
 * Provides overview metrics, live map data, and system health indicators.
 */

import { prisma } from "../lib/prisma";
import { formatCurrency, formatCurrencyByCountry } from "../../shared/currencyFormatting";

export interface MonitoringOverview {
  timestamp: Date;
  
  // Driver metrics
  totalActiveDrivers: number;
  totalOnlineDrivers: number;
  driversOnRide: number;
  driversOnFoodDelivery: number;
  driversOnParcelDelivery: number;
  driversAvailable: number;
  
  // Customer metrics
  totalActiveCustomers: number;
  
  // Trip metrics
  ridesInProgress: number;
  ridesRequestedToday: number;
  ridesCompletedToday: number;
  ridesCancelledToday: number;
  
  foodOrdersInProgress: number;
  foodOrdersToday: number;
  foodOrdersDeliveredToday: number;
  
  parcelsInProgress: number;
  parcelsToday: number;
  parcelsDeliveredToday: number;
  scheduledParcelsPending: number;
  
  // Financial metrics (today's running totals)
  revenueTodayAmount: string;
  commissionTodayAmount: string;
  currencyCode: string;
  
  // Pending settlements
  pendingDriverSettlements: number;
  pendingRestaurantSettlements: number;
  
  // Alerts
  openFraudAlerts: number;
  highSeverityAlerts: number;
}

export interface LiveMapDriver {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  isAvailable: boolean;
  currentServiceMode: string;
  lastUpdateAt: Date;
  currentAssignmentId?: string;
  currentAssignmentType?: string;
}

export interface LiveMapRide {
  rideId: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  driverId?: string;
  customerMasked: string; // Masked customer info
}

export interface LiveMapFoodOrder {
  orderId: string;
  status: string;
  restaurantLat: number;
  restaurantLng: number;
  deliveryLat: number;
  deliveryLng: number;
  driverId?: string;
  restaurantName: string;
  customerMasked: string;
}

export interface LiveMapParcel {
  deliveryId: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  driverId?: string;
  isScheduled: boolean;
  scheduledPickupAt?: Date;
  customerMasked: string;
}

export interface LiveMapData {
  drivers: LiveMapDriver[];
  rides: LiveMapRide[];
  foodOrders: LiveMapFoodOrder[];
  parcels: LiveMapParcel[];
  timestamp: Date;
}

/**
 * Get the start of today in UTC
 */
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Mask customer information for privacy
 */
function maskCustomerInfo(name?: string | null, phone?: string | null): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1][0]}***`;
    }
    return `${name[0]}***`;
  }
  if (phone) {
    return `***${phone.slice(-4)}`;
  }
  return 'Customer';
}

/**
 * Get real-time monitoring overview data
 */
export async function getMonitoringOverview(countryCode?: string): Promise<MonitoringOverview> {
  const startOfToday = getStartOfToday();
  const countryFilter = countryCode ? { countryCode } : {};
  
  // Run all queries in parallel for performance
  const [
    driverStats,
    rideStats,
    foodOrderStats,
    parcelStats,
    financialStats,
    settlementStats,
    alertStats,
    activeCustomers,
  ] = await Promise.all([
    // Driver statistics
    prisma.driverRealtimeState.groupBy({
      by: ['isOnline', 'isAvailable', 'currentServiceMode'],
      _count: { id: true },
      where: countryCode ? { countryCode } : {},
    }),
    
    // Ride statistics
    Promise.all([
      prisma.ride.count({
        where: {
          ...countryFilter,
          status: { in: ['in_progress', 'driver_arriving', 'waiting_for_pickup'] },
        },
      }),
      prisma.ride.count({
        where: {
          ...countryFilter,
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.ride.count({
        where: {
          ...countryFilter,
          completedAt: { gte: startOfToday },
        },
      }),
      prisma.ride.count({
        where: {
          ...countryFilter,
          cancelledAt: { gte: startOfToday },
        },
      }),
    ]),
    
    // Food order statistics
    Promise.all([
      prisma.foodOrder.count({
        where: {
          status: { in: ['preparing', 'ready', 'picked_up', 'on_the_way'] },
        },
      }),
      prisma.foodOrder.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.foodOrder.count({
        where: {
          deliveredAt: { gte: startOfToday },
        },
      }),
    ]),
    
    // Parcel statistics
    Promise.all([
      prisma.delivery.count({
        where: {
          serviceType: 'parcel',
          status: { in: ['in_progress', 'picked_up', 'out_for_delivery'] },
          ...(countryCode ? { countryCode } : {}),
        },
      }),
      prisma.delivery.count({
        where: {
          serviceType: 'parcel',
          createdAt: { gte: startOfToday },
          ...(countryCode ? { countryCode } : {}),
        },
      }),
      prisma.delivery.count({
        where: {
          serviceType: 'parcel',
          deliveredAt: { gte: startOfToday },
          ...(countryCode ? { countryCode } : {}),
        },
      }),
      prisma.delivery.count({
        where: {
          serviceType: 'parcel',
          pickupType: 'scheduled',
          scheduledDispatchStatus: 'pending',
          ...(countryCode ? { countryCode } : {}),
        },
      }),
    ]),
    
    // Financial statistics (today's totals)
    Promise.all([
      prisma.ride.aggregate({
        _sum: { serviceFare: true, safegoCommission: true },
        where: {
          ...countryFilter,
          completedAt: { gte: startOfToday },
        },
      }),
      prisma.foodOrder.aggregate({
        _sum: { serviceFare: true, safegoCommission: true },
        where: {
          deliveredAt: { gte: startOfToday },
        },
      }),
      prisma.delivery.aggregate({
        _sum: { serviceFare: true, safegoCommission: true },
        where: {
          serviceType: 'parcel',
          deliveredAt: { gte: startOfToday },
          ...(countryCode ? { countryCode } : {}),
        },
      }),
    ]),
    
    // Settlement statistics
    Promise.all([
      prisma.ride.count({
        where: {
          ...countryFilter,
          settlementStatus: 'pending',
          completedAt: { not: null },
        },
      }),
      prisma.foodOrder.count({
        where: {
          settlementStatus: 'pending',
          deliveredAt: { not: null },
        },
      }),
    ]),
    
    // Fraud alert statistics
    Promise.all([
      prisma.fraudAlert.count({
        where: { status: 'open' },
      }),
      prisma.fraudAlert.count({
        where: { status: 'open', severity: { in: ['high', 'critical'] } },
      }),
    ]),
    
    // Active customers (placed order in last 24 hours)
    prisma.customerProfile.count({
      where: {
        ...(countryCode ? { countryCode } : {}),
        OR: [
          { rides: { some: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } },
          { foodOrders: { some: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } },
          { deliveries: { some: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } },
        ],
      },
    }),
  ]);
  
  // Process driver stats
  let totalOnlineDrivers = 0;
  let driversAvailable = 0;
  let driversOnRide = 0;
  let driversOnFoodDelivery = 0;
  let driversOnParcelDelivery = 0;
  
  for (const stat of driverStats) {
    if (stat.isOnline) {
      totalOnlineDrivers += stat._count.id;
      if (stat.isAvailable) {
        driversAvailable += stat._count.id;
      }
      if (stat.currentServiceMode === 'ride') {
        driversOnRide += stat._count.id;
      } else if (stat.currentServiceMode === 'food') {
        driversOnFoodDelivery += stat._count.id;
      } else if (stat.currentServiceMode === 'parcel') {
        driversOnParcelDelivery += stat._count.id;
      }
    }
  }
  
  // Calculate total revenue and commission
  const [rideRevenue, foodRevenue, parcelRevenue] = financialStats;
  const totalRevenue = 
    Number(rideRevenue._sum.serviceFare || 0) + 
    Number(foodRevenue._sum.serviceFare || 0) + 
    Number(parcelRevenue._sum.serviceFare || 0);
  const totalCommission = 
    Number(rideRevenue._sum.safegoCommission || 0) + 
    Number(foodRevenue._sum.safegoCommission || 0) + 
    Number(parcelRevenue._sum.safegoCommission || 0);
  
  const currencyCode = countryCode === 'BD' ? 'BDT' : 'USD';
  
  return {
    timestamp: new Date(),
    
    // Driver metrics
    totalActiveDrivers: totalOnlineDrivers,
    totalOnlineDrivers,
    driversOnRide,
    driversOnFoodDelivery,
    driversOnParcelDelivery,
    driversAvailable,
    
    // Customer metrics
    totalActiveCustomers: activeCustomers,
    
    // Ride metrics
    ridesInProgress: rideStats[0],
    ridesRequestedToday: rideStats[1],
    ridesCompletedToday: rideStats[2],
    ridesCancelledToday: rideStats[3],
    
    // Food order metrics
    foodOrdersInProgress: foodOrderStats[0],
    foodOrdersToday: foodOrderStats[1],
    foodOrdersDeliveredToday: foodOrderStats[2],
    
    // Parcel metrics
    parcelsInProgress: parcelStats[0],
    parcelsToday: parcelStats[1],
    parcelsDeliveredToday: parcelStats[2],
    scheduledParcelsPending: parcelStats[3],
    
    // Financial metrics
    revenueTodayAmount: formatCurrency(totalRevenue, currencyCode as 'BDT' | 'USD'),
    commissionTodayAmount: formatCurrency(totalCommission, currencyCode as 'BDT' | 'USD'),
    currencyCode,
    
    // Settlements
    pendingDriverSettlements: settlementStats[0],
    pendingRestaurantSettlements: settlementStats[1],
    
    // Alerts
    openFraudAlerts: alertStats[0],
    highSeverityAlerts: alertStats[1],
  };
}

/**
 * Get live map data with driver locations and active trips
 */
export async function getLiveMapData(countryCode?: string): Promise<LiveMapData> {
  const countryFilter = countryCode ? { countryCode } : {};
  
  // Fetch all data in parallel
  const [drivers, rides, foodOrders, parcels] = await Promise.all([
    // Online drivers with locations
    prisma.driverRealtimeState.findMany({
      where: {
        isOnline: true,
        lastKnownLat: { not: null },
        lastKnownLng: { not: null },
        ...(countryCode ? { countryCode } : {}),
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      take: 500, // Limit for performance
    }),
    
    // Active rides
    prisma.ride.findMany({
      where: {
        ...countryFilter,
        status: { in: ['requested', 'driver_accepted', 'driver_arriving', 'waiting_for_pickup', 'in_progress'] },
        pickupLat: { not: null },
        pickupLng: { not: null },
      },
      include: {
        customer: {
          select: { fullName: true, phoneNumber: true },
        },
      },
      take: 200,
    }),
    
    // Active food orders
    prisma.foodOrder.findMany({
      where: {
        status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'on_the_way'] },
        deliveryLat: { not: null },
        deliveryLng: { not: null },
      },
      include: {
        customer: {
          select: { fullName: true, phoneNumber: true },
        },
        restaurant: {
          select: { restaurantName: true },
        },
      },
      take: 200,
    }),
    
    // Active parcels
    prisma.delivery.findMany({
      where: {
        serviceType: 'parcel',
        status: { in: ['pending', 'searching_driver', 'driver_assigned', 'picked_up', 'out_for_delivery'] },
        pickupLat: { not: null },
        pickupLng: { not: null },
        ...(countryCode ? { countryCode } : {}),
      },
      include: {
        customer: {
          select: { fullName: true, phoneNumber: true },
        },
      },
      take: 200,
    }),
  ]);
  
  return {
    drivers: drivers.map(d => ({
      driverId: d.driverId,
      driverName: d.driver?.fullName || 'Unknown',
      lat: d.lastKnownLat!,
      lng: d.lastKnownLng!,
      isAvailable: d.isAvailable,
      currentServiceMode: d.currentServiceMode,
      lastUpdateAt: d.lastUpdateAt,
      currentAssignmentId: d.currentAssignmentId || undefined,
      currentAssignmentType: d.currentServiceMode !== 'offline' ? d.currentServiceMode : undefined,
    })),
    
    rides: rides.map((r: any) => ({
      rideId: r.id,
      status: r.status,
      pickupLat: r.pickupLat!,
      pickupLng: r.pickupLng!,
      dropoffLat: r.dropoffLat || r.pickupLat!,
      dropoffLng: r.dropoffLng || r.pickupLng!,
      driverId: r.driverId || undefined,
      customerMasked: maskCustomerInfo(r.customer?.fullName, r.customer?.phoneNumber),
    })),
    
    foodOrders: foodOrders.map((o: any) => ({
      orderId: o.id,
      status: o.status,
      restaurantLat: o.pickupLat || 0,
      restaurantLng: o.pickupLng || 0,
      deliveryLat: o.deliveryLat!,
      deliveryLng: o.deliveryLng!,
      driverId: o.driverId || undefined,
      restaurantName: o.restaurant?.restaurantName || 'Restaurant',
      customerMasked: maskCustomerInfo(o.customer?.fullName, o.customer?.phoneNumber),
    })),
    
    parcels: parcels.map((p: any) => ({
      deliveryId: p.id,
      status: p.status,
      pickupLat: p.pickupLat!,
      pickupLng: p.pickupLng!,
      dropoffLat: p.dropoffLat || p.pickupLat!,
      dropoffLng: p.dropoffLng || p.pickupLng!,
      driverId: p.driverId || undefined,
      isScheduled: p.pickupType === 'scheduled',
      scheduledPickupAt: p.scheduledPickupAt || undefined,
      customerMasked: maskCustomerInfo(p.customer?.fullName, p.customer?.phoneNumber),
    })),
    
    timestamp: new Date(),
  };
}

/**
 * Create a monitoring snapshot for historical reference
 */
export async function createMonitoringSnapshot(countryCode?: string): Promise<void> {
  const overview = await getMonitoringOverview(countryCode);
  
  await prisma.adminMonitoringSnapshot.create({
    data: {
      countryCode,
      totalActiveDrivers: overview.totalActiveDrivers,
      totalOnlineDrivers: overview.totalOnlineDrivers,
      driversOnRide: overview.driversOnRide,
      driversOnFoodDelivery: overview.driversOnFoodDelivery,
      driversOnParcelDelivery: overview.driversOnParcelDelivery,
      totalActiveCustomers: overview.totalActiveCustomers,
      ridesInProgress: overview.ridesInProgress,
      foodOrdersInProgress: overview.foodOrdersInProgress,
      parcelsInProgress: overview.parcelsInProgress,
      scheduledParcelsPending: overview.scheduledParcelsPending,
      revenueTodayAmount: parseFloat(overview.revenueTodayAmount.replace(/[^\d.-]/g, '')) || 0,
      commissionTodayAmount: parseFloat(overview.commissionTodayAmount.replace(/[^\d.-]/g, '')) || 0,
      pendingDriverSettlements: overview.pendingDriverSettlements,
      pendingRestaurantSettlements: overview.pendingRestaurantSettlements,
      openFraudAlerts: overview.openFraudAlerts,
    },
  });
}

/**
 * Get historical snapshots for trend analysis
 */
export async function getMonitoringSnapshots(
  startDate: Date,
  endDate: Date,
  countryCode?: string,
  limit = 100
): Promise<any[]> {
  return prisma.adminMonitoringSnapshot.findMany({
    where: {
      snapshotAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(countryCode ? { countryCode } : {}),
    },
    orderBy: { snapshotAt: 'desc' },
    take: limit,
  });
}
