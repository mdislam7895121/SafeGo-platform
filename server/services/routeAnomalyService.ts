import { prisma } from '../db';

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp?: string;
}

export interface DeviationResult {
  isDeviated: boolean;
  deviationDistance: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  nearestExpectedPoint?: RoutePoint;
}

export class RouteAnomalyService {
  private static instance: RouteAnomalyService;

  private readonly SEVERITY_THRESHOLDS = {
    low: 500,
    medium: 1000,
    high: 2000,
    critical: 5000
  };

  static getInstance(): RouteAnomalyService {
    if (!this.instance) {
      this.instance = new RouteAnomalyService();
    }
    return this.instance;
  }

  async startRouteMonitoring(
    rideId: string,
    driverId: string,
    customerId: string,
    expectedRoute: RoutePoint[],
    expectedDistance: number,
    deviationThreshold: number = 500
  ): Promise<string> {
    const existingSession = await prisma.routeMonitoringSession.findUnique({
      where: { rideId }
    });

    if (existingSession) {
      await prisma.routeMonitoringSession.update({
        where: { rideId },
        data: {
          expectedRoute,
          expectedDistance,
          deviationThreshold,
          isMonitoring: true,
          alertsSent: 0
        }
      });
      return existingSession.id;
    }

    const session = await prisma.routeMonitoringSession.create({
      data: {
        rideId,
        driverId,
        customerId,
        expectedRoute,
        expectedDistance,
        deviationThreshold,
        isMonitoring: true,
        alertsSent: 0
      }
    });

    return session.id;
  }

  async checkDeviation(
    rideId: string,
    currentLocation: RoutePoint
  ): Promise<DeviationResult | null> {
    const session = await prisma.routeMonitoringSession.findUnique({
      where: { rideId }
    });

    if (!session || !session.isMonitoring) {
      return null;
    }

    const expectedRoute = session.expectedRoute as RoutePoint[];
    const deviationThreshold = Number(session.deviationThreshold);

    const nearestPoint = this.findNearestPointOnRoute(currentLocation, expectedRoute);
    const deviationDistance = this.calculateDistance(currentLocation, nearestPoint);

    const isDeviated = deviationDistance > deviationThreshold;
    const severity = this.calculateSeverity(deviationDistance);

    if (isDeviated) {
      await this.recordDeviationEvent(session.id, currentLocation, deviationDistance, severity);
    }

    return {
      isDeviated,
      deviationDistance,
      severity,
      nearestExpectedPoint: nearestPoint
    };
  }

  async recordDeviationEvent(
    sessionId: string,
    location: RoutePoint,
    distance: number,
    severity: string
  ): Promise<void> {
    const session = await prisma.routeMonitoringSession.findUnique({
      where: { id: sessionId },
      select: { alertsSent: true, customerId: true, rideId: true }
    });

    if (!session) return;

    const shouldAlertCustomer = session.alertsSent < 3 && (severity === 'high' || severity === 'critical');
    const shouldAlertSupport = severity === 'critical';

    await prisma.routeDeviationEvent.create({
      data: {
        sessionId,
        deviationLocation: { lat: location.lat, lng: location.lng },
        deviationDistance: distance,
        severity,
        alertSentToCustomer: shouldAlertCustomer,
        alertSentToSupport: shouldAlertSupport
      }
    });

    if (shouldAlertCustomer) {
      await prisma.routeMonitoringSession.update({
        where: { id: sessionId },
        data: { alertsSent: { increment: 1 } }
      });

      await this.sendCustomerAlert(session.customerId, session.rideId, distance, severity);
    }

    if (shouldAlertSupport) {
      await this.sendSupportAlert(session.rideId, distance);
    }
  }

  async stopRouteMonitoring(rideId: string): Promise<void> {
    await prisma.routeMonitoringSession.updateMany({
      where: { rideId },
      data: { isMonitoring: false }
    });
  }

  async getDeviationHistory(rideId: string): Promise<any[]> {
    const session = await prisma.routeMonitoringSession.findUnique({
      where: { rideId },
      include: {
        deviations: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return session?.deviations || [];
  }

  async submitDriverExplanation(
    deviationEventId: string,
    explanation: string
  ): Promise<void> {
    await prisma.routeDeviationEvent.update({
      where: { id: deviationEventId },
      data: {
        driverExplanation: explanation,
        resolved: true
      }
    });
  }

  async getActiveMonitoringSessions(
    filters?: {
      driverId?: string;
      hasDeviations?: boolean;
      limit?: number;
    }
  ): Promise<any[]> {
    return prisma.routeMonitoringSession.findMany({
      where: {
        isMonitoring: true,
        ...(filters?.driverId && { driverId: filters.driverId }),
        ...(filters?.hasDeviations && { deviations: { some: {} } })
      },
      include: {
        ride: {
          select: { 
            id: true, 
            status: true, 
            pickupAddress: true, 
            dropoffAddress: true 
          }
        },
        deviations: {
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50
    });
  }

  async getDeviationStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDeviations: number;
    bySeverity: Record<string, number>;
    avgDeviationDistance: number;
  }> {
    const deviations = await prisma.routeDeviationEvent.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        severity: true,
        deviationDistance: true
      }
    });

    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let totalDistance = 0;
    for (const d of deviations) {
      bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
      totalDistance += Number(d.deviationDistance);
    }

    return {
      totalDeviations: deviations.length,
      bySeverity,
      avgDeviationDistance: deviations.length > 0 ? totalDistance / deviations.length : 0
    };
  }

  private findNearestPointOnRoute(current: RoutePoint, route: RoutePoint[]): RoutePoint {
    if (route.length === 0) {
      return current;
    }

    let nearestPoint = route[0];
    let minDistance = this.calculateDistance(current, route[0]);

    for (const point of route) {
      const distance = this.calculateDistance(current, point);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    return nearestPoint;
  }

  private calculateDistance(p1: RoutePoint, p2: RoutePoint): number {
    const R = 6371000;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateSeverity(distance: number): 'low' | 'medium' | 'high' | 'critical' {
    if (distance >= this.SEVERITY_THRESHOLDS.critical) return 'critical';
    if (distance >= this.SEVERITY_THRESHOLDS.high) return 'high';
    if (distance >= this.SEVERITY_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  private async sendCustomerAlert(
    customerId: string,
    rideId: string,
    deviationDistance: number,
    severity: string
  ): Promise<void> {
    console.log(`[RouteAnomalyService] Alert sent to customer ${customerId} for ride ${rideId}: ${Math.round(deviationDistance)}m deviation (${severity})`);
  }

  private async sendSupportAlert(rideId: string, deviationDistance: number): Promise<void> {
    console.log(`[RouteAnomalyService] Support alert for ride ${rideId}: ${Math.round(deviationDistance)}m critical deviation`);
  }
}

export const routeAnomalyService = RouteAnomalyService.getInstance();
