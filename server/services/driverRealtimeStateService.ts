/**
 * SafeGo Driver Real-Time State Service
 * Phase 1A: Manages driver presence, location, and availability
 */

import { prisma } from '../db';
import { DispatchServiceMode, Prisma } from '@prisma/client';

export interface DriverLocationUpdate {
  driverId: string;
  lat: number;
  lng: number;
  countryCode?: string;
  cityCode?: string;
}

export interface AvailableDriver {
  driverId: string;
  lat: number;
  lng: number;
  distanceKm: number;
  serviceMode: DispatchServiceMode;
  rating: number;
  vehicleCategory?: string;
}

export class DriverRealtimeStateService {
  private static instance: DriverRealtimeStateService;

  public static getInstance(): DriverRealtimeStateService {
    if (!DriverRealtimeStateService.instance) {
      DriverRealtimeStateService.instance = new DriverRealtimeStateService();
    }
    return DriverRealtimeStateService.instance;
  }

  async setDriverOnline(
    driverId: string,
    serviceMode: DispatchServiceMode,
    lat?: number,
    lng?: number,
    countryCode?: string,
    cityCode?: string
  ): Promise<void> {
    await prisma.driverRealtimeState.upsert({
      where: { driverId },
      update: {
        isOnline: true,
        isAvailable: true,
        currentServiceMode: serviceMode,
        lastKnownLat: lat,
        lastKnownLng: lng,
        countryCode,
        cityCode,
        connectedAt: new Date(),
        disconnectedAt: null,
        lastUpdateAt: new Date(),
      },
      create: {
        driverId,
        isOnline: true,
        isAvailable: true,
        currentServiceMode: serviceMode,
        lastKnownLat: lat,
        lastKnownLng: lng,
        countryCode,
        cityCode,
        connectedAt: new Date(),
        lastUpdateAt: new Date(),
      },
    });
  }

  async setDriverOffline(driverId: string): Promise<void> {
    await prisma.driverRealtimeState.upsert({
      where: { driverId },
      update: {
        isOnline: false,
        isAvailable: false,
        currentServiceMode: DispatchServiceMode.offline,
        currentAssignmentId: null,
        disconnectedAt: new Date(),
        lastUpdateAt: new Date(),
      },
      create: {
        driverId,
        isOnline: false,
        isAvailable: false,
        currentServiceMode: DispatchServiceMode.offline,
        disconnectedAt: new Date(),
        lastUpdateAt: new Date(),
      },
    });
  }

  async updateDriverLocation(update: DriverLocationUpdate): Promise<void> {
    await prisma.driverRealtimeState.upsert({
      where: { driverId: update.driverId },
      update: {
        lastKnownLat: update.lat,
        lastKnownLng: update.lng,
        countryCode: update.countryCode,
        cityCode: update.cityCode,
        lastUpdateAt: new Date(),
      },
      create: {
        driverId: update.driverId,
        lastKnownLat: update.lat,
        lastKnownLng: update.lng,
        countryCode: update.countryCode,
        cityCode: update.cityCode,
        isOnline: false,
        isAvailable: false,
        currentServiceMode: DispatchServiceMode.offline,
        lastUpdateAt: new Date(),
      },
    });
  }

  async setDriverBusy(driverId: string, assignmentId: string): Promise<void> {
    await prisma.driverRealtimeState.update({
      where: { driverId },
      data: {
        isAvailable: false,
        currentAssignmentId: assignmentId,
        lastUpdateAt: new Date(),
      },
    });
  }

  async setDriverAvailable(driverId: string): Promise<void> {
    await prisma.driverRealtimeState.update({
      where: { driverId },
      data: {
        isAvailable: true,
        currentAssignmentId: null,
        lastUpdateAt: new Date(),
      },
    });
  }

  async getDriverState(driverId: string) {
    return prisma.driverRealtimeState.findUnique({
      where: { driverId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    });
  }

  async getOnlineDriversCount(
    countryCode?: string,
    cityCode?: string,
    serviceMode?: DispatchServiceMode
  ): Promise<number> {
    const where: Prisma.DriverRealtimeStateWhereInput = {
      isOnline: true,
      isAvailable: true,
    };

    if (countryCode) where.countryCode = countryCode;
    if (cityCode) where.cityCode = cityCode;
    if (serviceMode) where.currentServiceMode = serviceMode;

    return prisma.driverRealtimeState.count({ where });
  }

  calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async findNearestDriversForDispatch(options: {
    pickupLat: number;
    pickupLng: number;
    serviceMode: DispatchServiceMode;
    countryCode?: string;
    cityCode?: string;
    maxRadiusKm: number;
    maxCandidates: number;
    excludeDriverIds?: string[];
  }): Promise<AvailableDriver[]> {
    const {
      pickupLat,
      pickupLng,
      serviceMode,
      countryCode,
      cityCode,
      maxRadiusKm,
      maxCandidates,
      excludeDriverIds = [],
    } = options;

    const where: Prisma.DriverRealtimeStateWhereInput = {
      isOnline: true,
      isAvailable: true,
      currentServiceMode: serviceMode,
      lastKnownLat: { not: null },
      lastKnownLng: { not: null },
    };

    if (countryCode) where.countryCode = countryCode;
    if (excludeDriverIds.length > 0) {
      where.driverId = { notIn: excludeDriverIds };
    }

    const onlineDrivers = await prisma.driverRealtimeState.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            vehicles: {
              where: { isPrimary: true, isActive: true },
              select: { vehicleCategory: true },
            },
          },
        },
      },
    });

    const driversWithDistance: AvailableDriver[] = onlineDrivers
      .filter((d) => d.lastKnownLat !== null && d.lastKnownLng !== null)
      .map((d) => {
        const distanceKm = this.calculateHaversineDistance(
          pickupLat,
          pickupLng,
          d.lastKnownLat!,
          d.lastKnownLng!
        );
        return {
          driverId: d.driverId,
          lat: d.lastKnownLat!,
          lng: d.lastKnownLng!,
          distanceKm,
          serviceMode: d.currentServiceMode,
          rating: 4.5,
          vehicleCategory: d.driver.vehicles[0]?.vehicleCategory || undefined,
        };
      })
      .filter((d) => d.distanceKm <= maxRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, maxCandidates);

    return driversWithDistance;
  }

  async cleanupStaleConnections(staleThresholdMinutes: number = 5): Promise<number> {
    const staleThreshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
    
    const result = await prisma.driverRealtimeState.updateMany({
      where: {
        isOnline: true,
        lastUpdateAt: { lt: staleThreshold },
      },
      data: {
        isOnline: false,
        isAvailable: false,
        currentServiceMode: DispatchServiceMode.offline,
        disconnectedAt: new Date(),
      },
    });

    return result.count;
  }
}

export const driverRealtimeStateService = DriverRealtimeStateService.getInstance();
