import { prisma } from '../db';
import { navigationService } from './navigationService';
import type { RoutingConfig, RouteOptimizationRun } from '@prisma/client';

interface RouteOption {
  index: number;
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceScore: number;
  timeScore: number;
  safetyScore: number;
  overallScore: number;
}

interface OptimizationContext {
  trafficLevel?: number;
  weatherCondition?: string;
  timeOfDay?: string;
  avoidTolls?: boolean;
  preferHighways?: boolean;
}

interface OptimizationResult {
  selectedRoute: RouteOption;
  alternativeRoutes: RouteOption[];
  optimizationRun: RouteOptimizationRun;
}

class RoutingOptimizationEngine {
  async getOrCreateConfig(countryCode: string, cityCode?: string): Promise<RoutingConfig> {
    let config = await prisma.routingConfig.findFirst({
      where: {
        countryCode,
        cityCode: cityCode || null,
        isActive: true,
      },
    });

    if (!config && cityCode) {
      config = await prisma.routingConfig.findFirst({
        where: {
          countryCode,
          cityCode: null,
          isActive: true,
        },
      });
    }

    if (!config) {
      config = await prisma.routingConfig.create({
        data: {
          countryCode,
          cityCode,
          provider: 'internal',
          distanceWeight: 40,
          timeWeight: 40,
          trafficWeight: 10,
          safetyWeight: 10,
          maxRerouteAttempts: 3,
          rerouteTriggerMeters: 100,
          updateIntervalSeconds: 10,
          tollAvoidance: false,
          highwayPreference: true,
          isActive: true,
        },
      });
    }

    return config;
  }

  async updateConfig(
    countryCode: string,
    cityCode: string | null,
    updates: Partial<RoutingConfig>
  ): Promise<RoutingConfig> {
    return prisma.routingConfig.upsert({
      where: {
        countryCode_cityCode: { countryCode, cityCode },
      },
      create: {
        countryCode,
        cityCode,
        provider: (updates.provider as any) || 'internal',
        distanceWeight: updates.distanceWeight || 40,
        timeWeight: updates.timeWeight || 40,
        trafficWeight: updates.trafficWeight || 10,
        safetyWeight: updates.safetyWeight || 10,
        maxRerouteAttempts: updates.maxRerouteAttempts || 3,
        rerouteTriggerMeters: updates.rerouteTriggerMeters || 100,
        updateIntervalSeconds: updates.updateIntervalSeconds || 10,
        tollAvoidance: updates.tollAvoidance || false,
        highwayPreference: updates.highwayPreference ?? true,
        isActive: updates.isActive ?? true,
      },
      update: updates,
    });
  }

  async optimizeRoute(
    tripType: string,
    tripId: string,
    driverId: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    context?: OptimizationContext
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    const routes = await this.fetchMultipleRoutes(originLat, originLng, destLat, destLng, context);

    const etaProfile = await prisma.driverEtaProfile.findUnique({
      where: { driverId },
    });

    const scoredRoutes = routes.map((route, index) => {
      const scores = this.scoreRoute(route, context, etaProfile);
      return {
        index,
        ...route,
        ...scores,
      };
    });

    scoredRoutes.sort((a, b) => b.overallScore - a.overallScore);

    const selectedRoute = scoredRoutes[0];
    const alternativeRoutes = scoredRoutes.slice(1);

    const optimizationRun = await prisma.routeOptimizationRun.create({
      data: {
        tripType,
        tripId,
        driverId,
        originLat,
        originLng,
        destinationLat: destLat,
        destinationLng: destLng,
        trafficLevel: context?.trafficLevel,
        weatherCondition: context?.weatherCondition,
        timeOfDay: context?.timeOfDay || this.getTimeOfDay(),
        selectedRouteIndex: selectedRoute.index,
        routeCount: scoredRoutes.length,
        optimizedDistanceM: selectedRoute.distanceMeters,
        optimizedDurationSec: selectedRoute.durationSeconds,
        optimizedPolyline: selectedRoute.polyline,
        distanceScore: selectedRoute.distanceScore,
        timeScore: selectedRoute.timeScore,
        safetyScore: selectedRoute.safetyScore,
        overallScore: selectedRoute.overallScore,
        provider: 'internal',
        providerResponseMs: Date.now() - startTime,
      },
    });

    return {
      selectedRoute,
      alternativeRoutes,
      optimizationRun,
    };
  }

  private async fetchMultipleRoutes(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    context?: OptimizationContext
  ): Promise<Array<{ polyline: string; distanceMeters: number; durationSeconds: number }>> {
    const routes: Array<{ polyline: string; distanceMeters: number; durationSeconds: number }> = [];

    const directRoute = await navigationService.fetchRoute(originLat, originLng, destLat, destLng);
    routes.push({
      polyline: directRoute.polyline,
      distanceMeters: directRoute.distanceMeters,
      durationSeconds: directRoute.durationSeconds,
    });

    const alternateDistance = directRoute.distanceMeters * (0.95 + Math.random() * 0.15);
    const alternateDuration = directRoute.durationSeconds * (0.9 + Math.random() * 0.25);

    routes.push({
      polyline: this.generateAlternatePolyline(originLat, originLng, destLat, destLng, 0.001),
      distanceMeters: Math.round(alternateDistance),
      durationSeconds: Math.round(alternateDuration),
    });

    const shortcutDistance = directRoute.distanceMeters * (0.88 + Math.random() * 0.1);
    const shortcutDuration = directRoute.durationSeconds * (0.92 + Math.random() * 0.15);

    routes.push({
      polyline: this.generateAlternatePolyline(originLat, originLng, destLat, destLng, -0.001),
      distanceMeters: Math.round(shortcutDistance),
      durationSeconds: Math.round(shortcutDuration),
    });

    return routes;
  }

  private generateAlternatePolyline(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    offset: number
  ): string {
    const midLat = (originLat + destLat) / 2 + offset;
    const midLng = (originLng + destLng) / 2 + offset * 1.5;

    return this.encodePolyline([
      { lat: originLat, lng: originLng },
      { lat: midLat, lng: midLng },
      { lat: destLat, lng: destLng },
    ]);
  }

  private scoreRoute(
    route: { distanceMeters: number; durationSeconds: number },
    context?: OptimizationContext,
    etaProfile?: any
  ): { distanceScore: number; timeScore: number; safetyScore: number; overallScore: number } {
    const baseDistanceScore = 100 - Math.min(100, route.distanceMeters / 500);

    const baseDurationMinutes = route.durationSeconds / 60;
    const timeScore = 100 - Math.min(100, baseDurationMinutes * 2);

    let trafficMultiplier = 1.0;
    if (context?.trafficLevel) {
      trafficMultiplier = 1 + (context.trafficLevel / 100) * 0.5;
    }

    const adjustedTimeScore = timeScore / trafficMultiplier;

    const safetyScore = 75 + Math.random() * 20;

    const distanceWeight = 0.4;
    const timeWeight = 0.4;
    const safetyWeight = 0.2;

    const overallScore =
      baseDistanceScore * distanceWeight +
      adjustedTimeScore * timeWeight +
      safetyScore * safetyWeight;

    return {
      distanceScore: Math.round(baseDistanceScore * 100) / 100,
      timeScore: Math.round(adjustedTimeScore * 100) / 100,
      safetyScore: Math.round(safetyScore * 100) / 100,
      overallScore: Math.round(overallScore * 100) / 100,
    };
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) return 'morning_rush';
    if (hour >= 10 && hour < 16) return 'midday';
    if (hour >= 16 && hour < 20) return 'evening_rush';
    if (hour >= 20 && hour < 23) return 'evening';
    return 'night';
  }

  private encodePolyline(points: Array<{ lat: number; lng: number }>): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const point of points) {
      const lat = Math.round(point.lat * 1e5);
      const lng = Math.round(point.lng * 1e5);

      encoded += this.encodeNumber(lat - prevLat);
      encoded += this.encodeNumber(lng - prevLng);

      prevLat = lat;
      prevLng = lng;
    }

    return encoded;
  }

  private encodeNumber(num: number): string {
    let encoded = '';
    let value = num < 0 ? ~(num << 1) : num << 1;

    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }

    encoded += String.fromCharCode(value + 63);
    return encoded;
  }

  async getOptimizationHistory(
    tripType: string,
    tripId: string
  ): Promise<RouteOptimizationRun[]> {
    return prisma.routeOptimizationRun.findMany({
      where: { tripType, tripId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDriverOptimizationStats(
    driverId: string,
    days: number = 7
  ): Promise<{
    totalOptimizations: number;
    avgDistanceSaved: number;
    avgTimeSaved: number;
    avgOverallScore: number;
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const runs = await prisma.routeOptimizationRun.findMany({
      where: {
        driverId,
        createdAt: { gte: fromDate },
      },
    });

    if (runs.length === 0) {
      return {
        totalOptimizations: 0,
        avgDistanceSaved: 0,
        avgTimeSaved: 0,
        avgOverallScore: 0,
      };
    }

    const avgOverallScore = runs.reduce((sum, r) => sum + Number(r.overallScore || 0), 0) / runs.length;

    return {
      totalOptimizations: runs.length,
      avgDistanceSaved: 0,
      avgTimeSaved: 0,
      avgOverallScore: Math.round(avgOverallScore * 100) / 100,
    };
  }
}

export const routingOptimizationEngine = new RoutingOptimizationEngine();
