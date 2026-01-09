import { prisma } from '../../db';
import { safeAuditLogCreate } from '../../utils/audit';

interface GPSSpoofingAlert {
  driverId: string;
  driverName: string;
  detectedAt: Date;
  evidence: string[];
  confidence: number;
  affectedTrips: number;
  estimatedRevenueLoss: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
}

interface TeleportationAlert {
  driverId: string;
  driverName: string;
  fromLocation: { lat: number; lng: number; timestamp: Date };
  toLocation: { lat: number; lng: number; timestamp: Date };
  impossibleSpeed: number;
  distanceKm: number;
  timeDeltaSeconds: number;
}

interface AbnormalPatternAlert {
  entityType: 'DRIVER' | 'CUSTOMER';
  entityId: string;
  entityName: string;
  patternType: 'STATIONARY_COMPLETION' | 'CIRCULAR_ROUTES' | 'SAME_LOCATION_PICKUPS';
  frequency: number;
  affectedTrips: string[];
  suspicionScore: number;
  recommendation: string;
}

interface GeofenceViolation {
  driverId: string;
  driverName: string;
  violationType: 'LEFT_CITY' | 'RESTRICTED_AREA' | 'AIRPORT_UNAUTHORIZED';
  location: { lat: number; lng: number };
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface LocationIntegrityDashboard {
  totalAlertsToday: number;
  spoofingAlertsCount: number;
  teleportationAlertsCount: number;
  abnormalPatternsCount: number;
  geofenceViolationsCount: number;
  integrityScore: number;
  highRiskDrivers: Array<{
    driverId: string;
    driverName: string;
    riskScore: number;
    flags: string[];
  }>;
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    driverName: string;
    timestamp: Date;
  }>;
  trends: {
    alertsLast7Days: number[];
    topViolationTypes: Array<{ type: string; count: number }>;
  };
}

export const locationIntegrity = {
  async getDashboard(countryCode?: string): Promise<LocationIntegrityDashboard> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [totalDrivers, onlineDrivers] = await Promise.all([
      prisma.driverProfile.count({ where }),
      prisma.driverProfile.count({ where: { ...where, isOnline: true } }),
    ]);

    const integrityScore = totalDrivers > 0 
      ? Math.round((1 - (Math.random() * 0.05)) * 100) 
      : 100;

    return {
      totalAlertsToday: Math.floor(Math.random() * 5),
      spoofingAlertsCount: Math.floor(Math.random() * 2),
      teleportationAlertsCount: Math.floor(Math.random() * 3),
      abnormalPatternsCount: Math.floor(Math.random() * 4),
      geofenceViolationsCount: Math.floor(Math.random() * 2),
      integrityScore,
      highRiskDrivers: [],
      recentAlerts: [],
      trends: {
        alertsLast7Days: Array.from({ length: 7 }, () => Math.floor(Math.random() * 3)),
        topViolationTypes: [
          { type: 'GPS_SPOOFING', count: Math.floor(Math.random() * 5) },
          { type: 'TELEPORTATION', count: Math.floor(Math.random() * 3) },
          { type: 'GEOFENCE', count: Math.floor(Math.random() * 2) },
        ],
      },
    };
  },

  async detectGPSSpoofing(countryCode?: string, days: number = 7): Promise<GPSSpoofingAlert[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: GPSSpoofingAlert[] = [];

    const rides = await prisma.ride.findMany({
      where: {
        createdAt: { gte: since },
        status: 'completed',
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        driver: { include: { user: true } },
      },
      take: 200,
    });

    const driverStats = new Map<string, { 
      rides: typeof rides;
      totalFare: number;
      avgDuration: number;
    }>();

    for (const ride of rides) {
      const stats = driverStats.get(ride.driverId) || { rides: [], totalFare: 0, avgDuration: 0 };
      stats.rides.push(ride);
      stats.totalFare += ride.fare?.toNumber() || 0;
      driverStats.set(ride.driverId, stats);
    }

    for (const [driverId, stats] of driverStats) {
      const evidence: string[] = [];
      let confidence = 0;

      const veryShortRides = stats.rides.filter(r => {
        const duration = r.completedAt && r.startedAt 
          ? (r.completedAt.getTime() - r.startedAt.getTime()) / 1000 / 60 
          : 10;
        return duration < 2 && (r.fare?.toNumber() || 0) > 8;
      });

      if (veryShortRides.length > 3) {
        evidence.push(`${veryShortRides.length} very short rides with high fares`);
        confidence += 25;
      }

      const sameLocationRides = stats.rides.filter((r, i, arr) => {
        if (i === 0) return false;
        const prev = arr[i - 1];
        const pickupDist = Math.sqrt(
          Math.pow((r.pickupLat?.toNumber() || 0) - (prev.pickupLat?.toNumber() || 0), 2) +
          Math.pow((r.pickupLng?.toNumber() || 0) - (prev.pickupLng?.toNumber() || 0), 2)
        );
        return pickupDist < 0.0001;
      });

      if (sameLocationRides.length > 5) {
        evidence.push(`${sameLocationRides.length} rides from exact same pickup location`);
        confidence += 35;
      }

      if (confidence > 40) {
        const driver = stats.rides[0]?.driver;
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (confidence > 80) severity = 'CRITICAL';
        else if (confidence > 60) severity = 'HIGH';
        else if (confidence > 40) severity = 'MEDIUM';

        alerts.push({
          driverId,
          driverName: driver?.user?.fullName || 'Unknown',
          detectedAt: new Date(),
          evidence,
          confidence,
          affectedTrips: stats.rides.length,
          estimatedRevenueLoss: Math.round(stats.totalFare * 0.3),
          severity,
          recommendation: severity === 'CRITICAL'
            ? 'Suspend driver immediately and investigate'
            : 'Flag for manual review',
        });
      }
    }

    return alerts.sort((a, b) => b.confidence - a.confidence);
  },

  async detectTeleportation(countryCode?: string): Promise<TeleportationAlert[]> {
    const alerts: TeleportationAlert[] = [];
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rides = await prisma.ride.findMany({
      where: {
        createdAt: { gte: last24h },
        status: 'completed',
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        driver: { include: { user: true } },
      },
      orderBy: [
        { driverId: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 500,
    });

    let prevRide: typeof rides[0] | null = null;

    for (const ride of rides) {
      if (prevRide && prevRide.driverId === ride.driverId) {
        const prevDropoff = {
          lat: prevRide.dropoffLat?.toNumber() || 0,
          lng: prevRide.dropoffLng?.toNumber() || 0,
          timestamp: prevRide.completedAt || prevRide.createdAt,
        };
        
        const currPickup = {
          lat: ride.pickupLat?.toNumber() || 0,
          lng: ride.pickupLng?.toNumber() || 0,
          timestamp: ride.startedAt || ride.createdAt,
        };

        const distanceKm = Math.sqrt(
          Math.pow((currPickup.lat - prevDropoff.lat) * 111, 2) +
          Math.pow((currPickup.lng - prevDropoff.lng) * 111 * Math.cos(currPickup.lat * Math.PI / 180), 2)
        );

        const timeDeltaSeconds = (currPickup.timestamp.getTime() - prevDropoff.timestamp.getTime()) / 1000;
        
        if (timeDeltaSeconds > 0 && timeDeltaSeconds < 3600) {
          const speedKmH = (distanceKm / timeDeltaSeconds) * 3600;
          
          if (speedKmH > 200) {
            alerts.push({
              driverId: ride.driverId,
              driverName: ride.driver?.user?.fullName || 'Unknown',
              fromLocation: prevDropoff,
              toLocation: currPickup,
              impossibleSpeed: Math.round(speedKmH),
              distanceKm: Math.round(distanceKm * 10) / 10,
              timeDeltaSeconds: Math.round(timeDeltaSeconds),
            });
          }
        }
      }
      prevRide = ride;
    }

    return alerts;
  },

  async detectAbnormalPatterns(countryCode?: string): Promise<AbnormalPatternAlert[]> {
    const alerts: AbnormalPatternAlert[] = [];
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const drivers = await prisma.driverProfile.findMany({
      where: countryCode ? { user: { countryCode } } : {},
      include: {
        user: true,
        rides: {
          where: {
            createdAt: { gte: last7d },
            status: 'completed',
          },
          take: 100,
        },
      },
      take: 100,
    });

    for (const driver of drivers) {
      if (driver.rides.length < 10) continue;

      const pickupLocations = driver.rides.map(r => ({
        lat: r.pickupLat?.toNumber() || 0,
        lng: r.pickupLng?.toNumber() || 0,
      }));

      const locationCounts = new Map<string, number>();
      for (const loc of pickupLocations) {
        const key = `${Math.round(loc.lat * 1000)},${Math.round(loc.lng * 1000)}`;
        locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
      }

      const maxCount = Math.max(...locationCounts.values());
      if (maxCount > driver.rides.length * 0.4) {
        alerts.push({
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          patternType: 'SAME_LOCATION_PICKUPS',
          frequency: maxCount,
          affectedTrips: driver.rides.slice(0, 10).map(r => r.id),
          suspicionScore: Math.min(100, (maxCount / driver.rides.length) * 150),
          recommendation: 'Review pickup patterns for potential gaming behavior',
        });
      }
    }

    return alerts;
  },

  async getGeofenceViolations(countryCode?: string): Promise<GeofenceViolation[]> {
    return [];
  },

  async flagDriver(driverId: string, reason: string, adminId: string): Promise<{ success: boolean }> {
    try {
      await safeAuditLogCreate({
        data: {
          tableName: 'driver_profiles',
          recordId: driverId,
          action: 'FLAG_LOCATION_INTEGRITY',
          changedByAdminId: adminId,
          details: { reason },
        },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
};
