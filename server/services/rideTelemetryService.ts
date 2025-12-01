/**
 * SafeGo Phase 1B: Ride Telemetry Service
 * Live route tracking and location sampling during trips
 */

import { prisma } from '../db';
import { getDispatchFeatureConfig } from '../config/dispatchFeatures';
import { routingService } from './routingService';

export interface LocationUpdate {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export interface TelemetrySample {
  id: string;
  rideId: string;
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  distanceFromPrevious?: number;
  cumulativeDistance?: number;
  recordedAt: Date;
}

class RideTelemetryService {
  private lastSampleTime = new Map<string, number>();
  private lastPosition = new Map<string, { lat: number; lng: number }>();
  private cumulativeDistance = new Map<string, number>();

  async recordLocationSample(
    rideId: string,
    driverId: string,
    location: LocationUpdate
  ): Promise<TelemetrySample | null> {
    const config = getDispatchFeatureConfig();
    if (!config.liveRouteUpdates.enabled) {
      return null;
    }

    const now = Date.now();
    const lastTime = this.lastSampleTime.get(rideId) || 0;
    const minInterval = config.liveRouteUpdates.broadcastIntervalSeconds * 1000;

    if (now - lastTime < minInterval) {
      return null;
    }

    const existingCount = await prisma.rideTelemetryLocation.count({
      where: { rideId },
    });

    if (existingCount >= config.liveRouteUpdates.maxSamplesPerTrip) {
      return null;
    }

    let distanceFromPrevious: number | undefined;
    let cumulative = this.cumulativeDistance.get(rideId) || 0;

    const lastPos = this.lastPosition.get(rideId);
    if (lastPos) {
      distanceFromPrevious = routingService.calculateDistanceBetweenPoints(
        lastPos.lat,
        lastPos.lng,
        location.lat,
        location.lng
      );
      cumulative += distanceFromPrevious;
    }

    const sample = await prisma.rideTelemetryLocation.create({
      data: {
        rideId,
        driverId,
        lat: location.lat,
        lng: location.lng,
        heading: location.heading,
        speed: location.speed,
        accuracy: location.accuracy,
        distanceFromPrevious,
        cumulativeDistance: cumulative,
      },
    });

    this.lastSampleTime.set(rideId, now);
    this.lastPosition.set(rideId, { lat: location.lat, lng: location.lng });
    this.cumulativeDistance.set(rideId, cumulative);

    return {
      id: sample.id,
      rideId: sample.rideId,
      driverId: sample.driverId,
      lat: sample.lat,
      lng: sample.lng,
      heading: sample.heading || undefined,
      speed: sample.speed || undefined,
      distanceFromPrevious: sample.distanceFromPrevious || undefined,
      cumulativeDistance: sample.cumulativeDistance || undefined,
      recordedAt: sample.recordedAt,
    };
  }

  async getTelemetryForRide(rideId: string): Promise<TelemetrySample[]> {
    const samples = await prisma.rideTelemetryLocation.findMany({
      where: { rideId },
      orderBy: { recordedAt: 'asc' },
    });

    return samples.map((s) => ({
      id: s.id,
      rideId: s.rideId,
      driverId: s.driverId,
      lat: s.lat,
      lng: s.lng,
      heading: s.heading || undefined,
      speed: s.speed || undefined,
      distanceFromPrevious: s.distanceFromPrevious || undefined,
      cumulativeDistance: s.cumulativeDistance || undefined,
      recordedAt: s.recordedAt,
    }));
  }

  async calculateActualTripMetrics(rideId: string): Promise<{
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    sampleCount: number;
  }> {
    const samples = await prisma.rideTelemetryLocation.findMany({
      where: { rideId },
      orderBy: { recordedAt: 'asc' },
      select: {
        lat: true,
        lng: true,
        recordedAt: true,
        cumulativeDistance: true,
      },
    });

    if (samples.length < 2) {
      return {
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        sampleCount: samples.length,
      };
    }

    const lastSample = samples[samples.length - 1];
    const firstSample = samples[0];

    const totalDistanceMeters = lastSample.cumulativeDistance || 0;
    const totalDurationSeconds = Math.round(
      (lastSample.recordedAt.getTime() - firstSample.recordedAt.getTime()) / 1000
    );

    return {
      totalDistanceMeters,
      totalDurationSeconds,
      sampleCount: samples.length,
    };
  }

  clearRideCache(rideId: string): void {
    this.lastSampleTime.delete(rideId);
    this.lastPosition.delete(rideId);
    this.cumulativeDistance.delete(rideId);
  }

  getLatestPosition(rideId: string): { lat: number; lng: number } | null {
    return this.lastPosition.get(rideId) || null;
  }

  getCumulativeDistance(rideId: string): number {
    return this.cumulativeDistance.get(rideId) || 0;
  }
}

export const rideTelemetryService = new RideTelemetryService();
