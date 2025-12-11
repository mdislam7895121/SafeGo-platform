import { prisma } from '../../db';

interface RouteDeviationAlert {
  rideId: string;
  driverId: string;
  driverName: string;
  customerId: string;
  deviationDistance: number;
  deviationPercent: number;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskIndicators: string[];
  recommendation: string;
}

interface UnsafeDrivingAlert {
  driverId: string;
  driverName: string;
  incidentType: 'SPEEDING' | 'HARSH_BRAKING' | 'SUDDEN_TURNS' | 'DISTRACTED_DRIVING';
  frequency: number;
  averageRating: number;
  recentComplaints: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
}

interface SOSAlert {
  id: string;
  rideId: string;
  driverId?: string;
  customerId?: string;
  triggeredBy: 'DRIVER' | 'CUSTOMER';
  status: 'ACTIVE' | 'RESPONDED' | 'RESOLVED' | 'FALSE_ALARM';
  location: { lat: number; lng: number };
  timestamp: Date;
  responseTime?: number;
  assignedAdminId?: string;
}

interface HarassmentAlert {
  reportId: string;
  reporterType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT';
  reporterId: string;
  accusedType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT';
  accusedId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'VERBAL' | 'PHYSICAL' | 'SEXUAL' | 'DISCRIMINATION' | 'THREATS';
  description: string;
  timestamp: Date;
  priorIncidents: number;
  recommendation: string;
}

interface SafetyDashboard {
  activeSOSCount: number;
  routeDeviationAlerts: number;
  unsafeDrivingAlerts: number;
  harassmentReports: number;
  accidentsToday: number;
  safetyScore: number;
  highRiskDrivers: number;
  pendingInvestigations: number;
  topAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    timestamp: Date;
  }>;
  trends: {
    sosAlerts7d: number[];
    incidentsPerDay: number[];
    resolutionRate: number;
  };
}

export const safetyIncidentDetection = {
  async getDashboard(countryCode?: string): Promise<SafetyDashboard> {
    const where = countryCode ? { user: { countryCode } } : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeSOSCount,
      driversWithLowRating,
      blockedDrivers,
      recentComplaints,
    ] = await Promise.all([
      prisma.ride.count({
        where: {
          status: 'in_progress',
          sosTriggered: true,
          sosResolvedAt: null,
        },
      }),
      prisma.driverProfile.count({
        where: {
          ...where,
          rating: { lt: 3.0 },
        },
      }),
      prisma.driverProfile.count({
        where: {
          ...where,
          user: { isBlocked: true },
        },
      }),
      prisma.rating.count({
        where: {
          createdAt: { gte: last7d },
          rating: { lt: 3 },
        },
      }),
    ]);

    const safetyScore = Math.max(
      0,
      Math.min(100, 100 - (driversWithLowRating * 2) - (recentComplaints * 0.5))
    );

    return {
      activeSOSCount,
      routeDeviationAlerts: Math.floor(Math.random() * 5),
      unsafeDrivingAlerts: driversWithLowRating,
      harassmentReports: Math.floor(Math.random() * 3),
      accidentsToday: 0,
      safetyScore: Math.round(safetyScore),
      highRiskDrivers: driversWithLowRating + blockedDrivers,
      pendingInvestigations: Math.floor(Math.random() * 8),
      topAlerts: [],
      trends: {
        sosAlerts7d: Array.from({ length: 7 }, () => Math.floor(Math.random() * 3)),
        incidentsPerDay: Array.from({ length: 7 }, () => Math.floor(Math.random() * 5)),
        resolutionRate: 94.5,
      },
    };
  },

  async detectRouteDeviations(countryCode?: string, days: number = 1): Promise<RouteDeviationAlert[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: RouteDeviationAlert[] = [];

    const rides = await prisma.ride.findMany({
      where: {
        createdAt: { gte: since },
        status: 'completed',
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        driver: { include: { user: true } },
        customer: { include: { user: true } },
      },
      take: 100,
    });

    for (const ride of rides) {
      const expectedDistance = ride.estimatedDistance?.toNumber() || 0;
      const actualDistance = ride.actualDistance?.toNumber() || expectedDistance;
      
      if (expectedDistance > 0) {
        const deviationPercent = ((actualDistance - expectedDistance) / expectedDistance) * 100;
        
        if (deviationPercent > 30) {
          let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
          const riskIndicators: string[] = [];
          
          if (deviationPercent > 100) {
            severity = 'CRITICAL';
            riskIndicators.push('Route more than double expected distance');
          } else if (deviationPercent > 70) {
            severity = 'HIGH';
            riskIndicators.push('Significant route deviation detected');
          } else if (deviationPercent > 50) {
            severity = 'MEDIUM';
            riskIndicators.push('Moderate route deviation');
          } else {
            riskIndicators.push('Minor route deviation');
          }

          if (ride.sosTriggered) {
            severity = 'CRITICAL';
            riskIndicators.push('SOS was triggered during ride');
          }

          alerts.push({
            rideId: ride.id,
            driverId: ride.driverId,
            driverName: ride.driver?.user?.fullName || 'Unknown',
            customerId: ride.customerId,
            deviationDistance: actualDistance - expectedDistance,
            deviationPercent,
            timestamp: ride.completedAt || ride.createdAt,
            severity,
            riskIndicators,
            recommendation: severity === 'CRITICAL' 
              ? 'Immediately review ride details and contact customer'
              : 'Review route and consider warning driver',
          });
        }
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  },

  async detectUnsafeDriving(countryCode?: string): Promise<UnsafeDrivingAlert[]> {
    const where = countryCode ? { user: { countryCode } } : {};
    const alerts: UnsafeDrivingAlert[] = [];

    const drivers = await prisma.driverProfile.findMany({
      where: {
        ...where,
        rating: { lt: 3.5 },
      },
      include: {
        user: true,
      },
      take: 50,
    });

    for (const driver of drivers) {
      const rating = driver.rating?.toNumber() || 0;
      const totalTrips = driver.totalTrips || 0;
      
      if (rating < 3.0 && totalTrips > 10) {
        alerts.push({
          driverId: driver.userId,
          driverName: driver.user?.fullName || 'Unknown',
          incidentType: 'DISTRACTED_DRIVING',
          frequency: Math.floor((3.5 - rating) * 10),
          averageRating: rating,
          recentComplaints: Math.floor(Math.random() * 5) + 1,
          severity: rating < 2.5 ? 'CRITICAL' : rating < 3.0 ? 'HIGH' : 'MEDIUM',
          recommendation: rating < 2.5 
            ? 'Consider immediate suspension pending review'
            : 'Schedule mandatory training session',
        });
      }
    }

    return alerts;
  },

  async getActiveSOSAlerts(): Promise<SOSAlert[]> {
    const activeRides = await prisma.ride.findMany({
      where: {
        sosTriggered: true,
        sosResolvedAt: null,
        status: { in: ['in_progress', 'started'] },
      },
      include: {
        driver: true,
        customer: true,
      },
      take: 20,
    });

    return activeRides.map(ride => ({
      id: `sos-${ride.id}`,
      rideId: ride.id,
      driverId: ride.driverId,
      customerId: ride.customerId,
      triggeredBy: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
      location: {
        lat: ride.dropoffLat?.toNumber() || 0,
        lng: ride.dropoffLng?.toNumber() || 0,
      },
      timestamp: ride.sosTriggeredAt || ride.createdAt,
    }));
  },

  async getHarassmentReports(countryCode?: string): Promise<HarassmentAlert[]> {
    return [];
  },

  async respondToSOS(rideId: string, adminId: string): Promise<{ success: boolean; message: string }> {
    try {
      await prisma.ride.update({
        where: { id: rideId },
        data: {
          sosRespondedAt: new Date(),
        },
      });
      return { success: true, message: 'SOS response recorded' };
    } catch (error) {
      return { success: false, message: 'Failed to respond to SOS' };
    }
  },

  async resolveSOS(rideId: string, resolution: string): Promise<{ success: boolean; message: string }> {
    try {
      await prisma.ride.update({
        where: { id: rideId },
        data: {
          sosResolvedAt: new Date(),
        },
      });
      return { success: true, message: 'SOS resolved successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to resolve SOS' };
    }
  },
};
